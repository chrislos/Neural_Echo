// ═══════════════════════════════════════════════════════════════════════════
//  N E U R A L   E C H O
//  Eine binaurale Hör-Erfahrung. Du setzt Kopfhörer auf, drehst den Kopf –
//  und der Klang reagiert darauf, als stündest du wirklich in dem Raum.
// ═══════════════════════════════════════════════════════════════════════════
//
//  WAS PASSIERT HIER?
//
//    INTRO     Eine Stimme begrüßt dich, ein Swoosh öffnet den Raum.
//    SZENE 1   Zwei Klangkugeln liegen links und rechts. Schaust du eine an,
//              kommt sie näher – bis du sie "eingefangen" hast.
//    SZENE 2   Ein Hausfink zwitschert. Drehst du den Kopf nach rechts,
//              wird die Zeit langsamer und du hörst Details in seinem Gesang.
//    SZENE 3   Ein musikalischer Raum: Wo du hinschaust, spielt ein Instrument.
//
//  Der genaue Text und welche Audio-Datei wo läuft: concept/skript.txt
//
//  WELCHE BAUTEILE ARBEITEN ZUSAMMEN?
//
//    Three.js    zeichnet den Drahtgitter-Kopf auf den Bildschirm  → 3dhead.js
//    Tone.js     lädt und spielt einzelne Audio-Dateien ab
//    Resonance   platziert Klänge im 3D-Raum, damit sie binaural klingen
//    WebSocket   liefert die Kopfdrehung von den AirPods (Port 8080)
//
//  WIE IST DIESE DATEI AUFGEBAUT? (von oben nach unten lesbar)
//
//    TEIL 1   Die Audio-Dateien
//    TEIL 2   Einstellungen – alle Zahlen, an denen man drehen kann
//    TEIL 3   Variablen, die sich während der Experience verändern
//    TEIL 4   Werkzeugkasten – die wenigen Funktionen, die überall gebraucht werden
//    TEIL 5   Headtracking – die Winkel von den AirPods
//    TEIL 6   Audio laden und verkabeln
//    TEIL 7   Der Ablauf – eine Funktion pro Szene
//    TEIL 8   Jede Frame – hier passiert die Interaktion
//    TEIL 9   Kopfhörer auf und ab (Start und Reset)
//    TEIL 10  Hochfahren und Tasten zum Testen
//
//  DREI REGELN, DIE SICH DURCH DIE GANZE DATEI ZIEHEN:
//
//    1. GELADEN wird nur in TEIL 6, GESPIELT nur in TEIL 7 und 8.
//       Nie eine Audio-Datei mitten in einer Szene laden – das ruckelt.
//    2. Es gibt genau EINE Schleife (tick) und EINE Variable, die sagt,
//       welche Interaktion gerade dran ist (phase).
//    3. Eine Szene macht alles, was sie tut, in ihrer eigenen Funktion.
//       Nur was wirklich überall gebraucht wird, steht im Werkzeugkasten.

import * as Tone from 'tone';
import { ResonanceAudio } from 'resonance-audio';
import { erstelleKopfSzene } from './3dhead.js';


// ═══════════════════════════════════════════════════════════════════════════
//  TEIL 1 – DIE AUDIO-DATEIEN
//  Alle Klänge und Musikspuren liegen flach in static/, die gesprochenen
//  Ansagen dagegen in static/voices/DE/ – ein Ordner pro Sprache, damit man
//  die Sprachfassung als Ganzes austauschen kann.
//  Der Server bietet static/ unter '/' an: aus static/s2_fink_(mono).wav wird
//  '/s2_fink_(mono).wav' und aus static/voices/DE/intro_speech_(mono).wav
//  wird '/voices/DE/intro_speech_(mono).wav'.
//  Das Präfix im Dateinamen (intro_, s1_, s2_, s3_) sagt, zu welcher Szene
//  eine Aufnahme gehört. So kann man eine neue Sprachdatei einfach über die
//  alte kopieren, ohne im Code etwas zu ändern.
//
//  Die Namen stehen hier gesammelt an EINER Stelle. Wird eine Aufnahme neu
//  geschnitten, ändert man nur diese Liste – der restliche Code bleibt gleich.
//
//    "(mono)"  = 1 Kanal    → wird von Tone.js an eine Stelle im Raum gesetzt
//    "(ambiX)" = 16 Kanäle  → Ambisonics, eine Rundum-Aufnahme (siehe TEIL 4)
// ═══════════════════════════════════════════════════════════════════════════

// Alle Sprachaufnahmen kommen aus diesem Ordner. Für eine andere Sprache
// tauscht man nur diese eine Zeile (z. B. '/voices/EN/'), die Dateinamen
// darunter bleiben in jeder Sprachfassung gleich.
const STIMMEN_ORDNER = '/voices/DE/';

const DATEIEN = {
  introStimme: STIMMEN_ORDNER + 'intro_speech_(mono).wav',
  introSwoosh: '/intro_swoosh_(ambiX).wav',

  s1Natur:   '/s1_natureLoop_(ambiX).wav',
  s1Stimme1: STIMMEN_ORDNER + 's1_speech1_(mono).wav', // "…dreh deinen Kopf nach links"
  s1Stimme2: STIMMEN_ORDNER + 's1_speech2_(mono).wav', // "…jetzt nach rechts"
  // s1_speech3 ("Jetzt bist du ja schon Profi…") gibt es nicht mehr als eigene
  // Datei – der Satz steckt jetzt vorne in s2_speech1.

  // Jede Klangkugel besteht aus drei Loops, die beim Näherkommen nacheinander
  // dazukommen: erst nur "fern", dann "mittel", ganz nah dann auch "nah".
  s1Kugel1: [
    '/s1_ineractiveSound1_distantLoop_(mono).wav',
    '/s1_ineractiveSound1_middleLoop_(mono).wav',
    '/s1_ineractiveSound1_nearLoop_(mono).wav',
  ],
  s1Kugel2: [
    '/s1_ineractiveSound2_distantLoop_(mono).wav',
    '/s1_ineractiveSound2_middleLoop_(mono).wav',
    '/s1_ineractiveSound2_nearLoop_(mono).wav',
  ],

  // Belohnung nach jeder eingefangenen Kugel. Ambisonics-Aufnahmen, sie laufen
  // also einmal durch den ganzen Raum statt aus einer Richtung.
  s1Erfolg1: '/s1_ineractiveSound1_success_(ambiX).wav',
  s1Erfolg2: '/s1_ineractiveSound2_success_(ambiX).wav',

  s2Swoosh:  '/s2_swoosh_(ambiX).wav',
  s2Natur:   '/s2_natureLoop_(ambiX).wav',      // wird mit-verlangsamt
  s2NaturFx: '/s2_lowNatureFxLoop_(ambiX).wav', // bleibt normal schnell
  s2Fink:    '/s2_fink_(mono).wav',
  // Die Ansage von Szene 2 besteht aus VIER Teilen. Beide Schnitte haben einen
  // Grund, sie sind nicht willkürlich gesetzt:
  //
  //   1 → 2  liegt bei "Hier links hörst du…". Ab diesem Satz spricht die
  //          Stimme VON LINKS, aus genau der Richtung, aus der gleich der Fink
  //          zwitschert.
  //   2 → 3  liegt in der Pause, in der der Fink ruft. Er ruft zwei Mal, und
  //          das dauert länger als jede Pause, die man in eine Aufnahme
  //          schneiden würde. Als zwei Dateien können wir uns so viel Zeit
  //          lassen, wie der Vogel braucht, und danach weitersprechen.
  s2Stimme1: STIMMEN_ORDNER + 's2_speech1_(mono).wav', // "Jetzt bist du ja schon Profi… / Wusstest du…"
  s2Stimme2: STIMMEN_ORDNER + 's2_speech2_(mono).wav', // "Hier links hörst du…" – kommt VON LINKS
  s2Stimme3: STIMMEN_ORDNER + 's2_speech3_(mono).wav', // "Um dessen Komplexität…" – auch von links
  s2Stimme4: STIMMEN_ORDNER + 's2_speech4_(mono).wav', // "Hör zum Schluss noch mal…"

  s3Stimme1:    STIMMEN_ORDNER + 's3_speech1_(mono).wav',
  s3Basis:      '/s3_musik_basis.wav',
  s3Cello:      '/s3_musik_cello.wav',
  s3Gitarre:    '/s3_musik_gitarre.wav',
  s3Klavier:    '/s3_musik_klavier.wav',
  s3Floete:     '/s3_musik_floete.wav',
  s3Perkussion: '/s3_musik_perkussion.wav',
};


// ═══════════════════════════════════════════════════════════════════════════
//  TEIL 2 – EINSTELLUNGEN
//  Alles, woran man beim Ausprobieren dreht, steht hier oben an einer Stelle.
//  GROSSBUCHSTABEN heißt in JavaScript: "das ist ein fester Wert".
// ═══════════════════════════════════════════════════════════════════════════

// ─── Szene 1: die zwei Klangkugeln ───
const DIST_FERN         = 6;   // Meter: so weit weg startet eine Kugel
const DIST_NAH          = 0.3; // Meter: ab hier gilt sie als eingefangen.
                               // Gilt für BEIDE Kugeln gleich – sie kommen also
                               // bis dicht ans Ohr. Der sichtbare Punkt fährt
                               // dabei in den Drahtgitter-Kopf hinein (dessen
                               // Ohren sitzen bei 0.82); das ist Absicht, Bild
                               // und Klang sollen zusammenbleiben.

// Resonance rechnet den Abstand normalerweise nur bis auf einen Meter herunter:
// Näher als das wird nichts mehr lauter, der Wert bleibt einfach stehen. Für
// uns ist das zu früh – die Kugel soll ja bis fast an den Kopf kommen und dabei
// spürbar zunehmen. Wir setzen die Grenze deshalb weiter herunter.
//
// Ganz auf 0 geht nicht: Bei Abstand null wüsste die Rechnung keine Richtung
// mehr und der Pegel liefe ins Unendliche. 0.25 Meter sind ungefähr eine
// Handbreit vom Ohr – näher muss es nicht werden.
const KUGEL_MIN_DISTANZ = 0.25;
const BLICK_GENAUIGKEIT = 0.8; // wie genau man treffen muss (1 = haargenau)
const RUECKZUG_TEMPO    = 1;   // Meter pro Sekunde: so schnell weicht sie zurück

// Wie schnell die Kugel auf dich zukommt, in Metern pro Sekunde.
//
// Das letzte Drittel ist der Moment, auf den die ganze Szene hinausläuft: Bis
// dahin zieht man mühsam, danach ist die Kugel gelockt und kommt von selbst –
// sie wird immer schneller, je näher sie kommt. Deshalb steigt das Tempo zum
// Schluss an, statt zu bremsen.
//
// ACHTUNG: TEIL 8 setzt kugel.tempo in JEDEM Frame neu – diese Werte sind die
// echten Regler, der Startwert in TEIL 3 wird sofort überschrieben.
const KUGEL_TEMPO_WEIT = 0.92; // Grundtempo, solange sie sich noch ziert.
                               // Bewusst zäh: Dieser Mittelteil ist die Arbeit,
                               // der Sog danach die Belohnung. 1.2 geteilt durch
                               // 1.3 – also 30 % mehr Zeit als vorher.
const KUGEL_TEMPO_SOG  = 1.69; // Tempo direkt vor dem Ziel – der Sog.
                               // Nicht einfach 2.5 geteilt durch 1.25: Das
                               // Tempo STEIGT über das letzte Drittel hinweg von
                               // KUGEL_TEMPO_WEIT bis hierher. Nur der Endwert
                               // ändert sich, der Anfang bleibt – für 25 % mehr
                               // Zeit muss der Endwert deshalb stärker runter.
const KUGEL_SOG_AB     = 0.66; // ab dieser Nähe beginnt das letzte Drittel
const EINFADE_SEK       = 2;   // Sekunden: so sanft taucht eine Kugel auf
const AUSFADE_SEK       = 1.5; // Sekunden: so sanft verschwindet sie beim Einfangen

// Der Erfolgsklang, wenn die erste Kugel eingefangen ist. Wie bei allen Betten
// ein Faktor und kein Dezibel-Wert: 1 = so laut wie aufgenommen, 0.01 = ein
// Hundertstel davon (40 dB leiser), 0.2 = ein Fünftel (14 dB leiser).
//
// Sie sollen die Belohnung markieren, nicht den Moment überfahren: Die Kugel
// fadet ja noch aus, und gleich danach geht es weiter. Die zwei Werte sind
// unterschiedlich, weil die zwei Aufnahmen unterschiedlich laut sind – nicht,
// weil die zweite Belohnung wichtiger wäre.
const ERFOLG1_LAUTSTAERKE = 0.01;
const ERFOLG2_LAUTSTAERKE = 0.2;

// ─── Das vierte Layer: die Fliege ───
// Die drei Loops einer Kugel sind Aufnahmen. Dieses Layer nicht – es entsteht
// live in Tone.js und läuft DURCHGEHEND: weißes Rauschen, das von einem
// Sägezahn zerhackt wird. Das ergibt ein Flattern, wie ein Insekt, das um
// deinen Kopf kreist. Je näher die Kugel kommt, desto schneller flattert es.
//
// Warum Rauschen und kein Ton? Rauschen hat keine Tonhöhe, es enthält alle
// Frequenzen gleichzeitig. Erstens steht es damit zu nichts in Konkurrenz.
// Zweitens – und das ist der eigentliche Grund – kann man es viel genauer
// orten: Dein Gehör vergleicht die Ohrsignale über viele Frequenzen hinweg und
// wertet aus, wie deine Ohrmuschel den Klang je nach Richtung verfärbt. Einem
// einzelnen Ton fehlt dieses Material, der ist schwer zu lokalisieren.
//
// Warum Sägezahn und nicht Sinus? Der Sägezahn ist unsymmetrisch: harter
// Einsatz, dann Abfall. Genau das macht daraus einen Flügelschlag statt eines
// Säuselns.
//
// DER WICHTIGE BEREICH: Unter etwa 20 Hz hört man so eine Modulation als
// Rhythmus – man könnte die Schläge mitzählen. Darüber verschmelzen sie zu
// Rauheit, es wird ein schnarrender Klang. Die Werte unten sind absichtlich so
// gelegt, dass die Fliege beim Herankommen über diese Grenze läuft: Aus
// "da flattert etwas hinten" wird "es ist an meinem Ohr", ohne dass wir dafür
// irgendetwas umschalten müssten.
const FLIEGE_RAUSCH_ART = 'white'; // 'white' = hell, 'pink' = weicher, 'brown' = dumpf
// Die Flatterrate läuft über DREI Abschnitte, und zwar genau über die, die auch
// in der Anzeige oben rechts als Zone 1/2/3 stehen. In jedem Abschnitt
// verdoppelt sich das Tempo:
//
//   Zone 1 "fern"   naehe 0    bis 0.50   →  1 bis 2 Hz
//   Zone 2 "mitte"  naehe 0.50 bis 0.66   →  2 bis 4 Hz
//   Zone 3 "SOG"    naehe 0.66 bis 1      →  4 bis 8 Hz
//
// Jede Verdopplung ist für das Ohr derselbe Schritt, obwohl die Abschnitte
// unterschiedlich lang sind. Dadurch beschleunigt es zum Schluss immer heftiger:
// Die letzte Verdopplung passiert auf dem kürzesten Stück Weg.
//
// Alles bleibt unter 20 Hz, dem Punkt, ab dem Flattern in Rauheit umkippen
// würde – man kann die Schläge also die ganze Zeit über mitzählen.
const FLIEGE_HZ_FERN    = 1;   // Flügelschläge pro Sekunde, ganz weit weg
const FLIEGE_HZ_MITTE   = 2;   // ... am Ende von Zone 1
const FLIEGE_HZ_SOG     = 4;   // ... am Ende von Zone 2, wo der Sog beginnt
const FLIEGE_HZ_NAH     = 8;   // ... ganz nah
const FLIEGE_MITTE_BEI  = 0.5; // Grenze zwischen Zone 1 und 2 (Zone 3 = KUGEL_SOG_AB)
// Der Abstand zwischen diesen beiden Werten ist groß und das ist Absicht: In
// der Ferne soll man die Fliege gerade eben hören, wenn man sie direkt anschaut
// – sie ist dort der einzige Hinweis. Beim Näherkommen zieht sie sich stark
// zurück, weil dann die Aufnahmen die Arbeit übernehmen.
const FLIEGE_DB_FERN    = -32;     // Dezibel in der Ferne
const FLIEGE_DB_NAH     = -52;     // Dezibel nah – da übernehmen die Aufnahmen

// Auch die Fliege versteckt sich, und zwar noch entschiedener als die
// Aufnahmen: Schaut man geradeaus, soll sie praktisch weg sein. -30 dB ist
// weniger als ein Zehntel der Lautstärke, das hört man neben dem Naturbett
// nicht mehr heraus. Sie taucht erst auf, wenn man sich wirklich hindreht.
const FLIEGE_BLICK_DB_WEG = -30; // Dezibel Absenkung bei Blick geradeaus

// Der Tiefpass hängt NICHT an den Flügelschlägen, sondern an der Entfernung.
// Er geht beim Näherkommen AUF: aus der Ferne fehlen die obersten Höhen, ganz
// nah ist alles da. Genau das macht Luft auch in echt – sie schluckt hohe Töne
// stärker als tiefe, deshalb klingt Fernes dumpfer.
//
// Zwei Oktaven Unterschied: In der Ferne fehlt der Fliege deutlich mehr als nur
// das oberste Glitzern, sie klingt hörbar bedeckt. Ganz nah ist dann alles da.
// Je weiter die zwei Werte auseinanderliegen, desto stärker liest sich die
// Annäherung als Klangfarbe und nicht nur als Lautstärke.
const FLIEGE_FILTER_FERN_HZ = 4000;  // Hz, wenn die Kugel ganz weit weg ist
const FLIEGE_FILTER_NAH_HZ  = 16000; // Hz, wenn sie so nah ist wie erlaubt

// Die Fliege hört nicht nur auf die Entfernung, sondern auch direkt auf deinen
// Kopf. Die Entfernung ändert sich langsam – die Blickrichtung sofort. Deshalb
// ist DAS der Teil, der sich lebendig anfühlt: Du drehst dich hin, und noch
// bevor die Kugel überhaupt losgefahren ist, flattert sie aufgeregter.
//
// Die zwei Werte sind Multiplikatoren auf die Flatterrate:
// mal 0.5 heißt halbe Geschwindigkeit (träge), mal 2 doppelte (aufgeregt).
const FLIEGE_BLICK_AB    = 0.5; // abgewandt: die Fliege wird träge
const FLIEGE_BLICK_DRAUF = 2;   // genau drauf: die Fliege wird aufgeregt

// Etwas Hall, damit die Fliege im Raum steht und nicht am Ohr klebt. Deutlich
// weniger als bei einem Impuls: Ein Dauerklang mit langer Fahne würde sonst zu
// einer Rauschfläche verschmieren. Nur die Fliege bekommt diesen Hall – die
// Aufnahmen und die Stimmen bleiben trocken.
const FLIEGE_HALL_DECAY  = 3;    // Sekunden Nachhall
const FLIEGE_HALL_ANTEIL = 0.25; // 0 = trocken, 1 = nur Hall

// ─── Das erste der drei aufgenommenen Layer ───
// Der Fern-Loop läuft immer, auch ganz weit weg. Er liegt bewusst unter 0 dB,
// damit die Fliege darunter noch Platz hat. Beim Näherkommen wird er LEISER –
// klingt verkehrt, ist es aber nicht: Resonance macht ihn durch die kürzere
// Entfernung ohnehin lauter, diese Kurve nimmt davon wieder etwas zurück.
const LAYER1_DB_FERN = -6;  // Dezibel, wenn die Kugel ganz weit weg ist
const LAYER1_DB_NAH  = -12; // Dezibel, wenn sie so nah ist wie erlaubt

// ─── Die Klänge sollen sich verstecken ───
// Schaust du geradeaus, sind die Aufnahmen stark abgesenkt – erst wenn du dich
// hindrehst, tauchen sie auf. Damit wird das Suchen selbst zur Aufgabe, statt
// dass die Kugel einfach die ganze Zeit vor sich hin klingt.
//
// SCHAERFE bestimmt, wie eng dieser "Hörkegel" ist. Der Blickwert läuft von 0
// (seitlich) bis 1 (genau drauf), und wir potenzieren ihn: Bei 1 ändert sich
// nichts, bei 3 fällt er viel steiler ab – aus 0.7 wird dann 0.34. Größer heißt
// also: enger, man muss genauer treffen.
const KUGEL_BLICK_DB_WEG   = -18; // Dezibel Absenkung bei Blick geradeaus
const KUGEL_BLICK_SCHAERFE = 3;   // größer = engerer Hörkegel

// ─── Szene 2: der Hausfink ───
// Der Kopf wird zum Regler: ganz links = normales Tempo,
// ganz rechts = stark verlangsamt (und dadurch tiefer, wie eine Bandmaschine).
const FINK_YAW_LINKS  =  Math.PI / 2; // +90 Grad = ganz links
const FINK_YAW_RECHTS = -Math.PI / 2; // -90 Grad = ganz rechts
const FINK_MIN_TEMPO  = 0.1;  // langsamster Punkt: 10 % Geschwindigkeit – der Ruf
                              // liegt dort gut drei Oktaven tiefer als im
                              // Original und zieht mit dem Natur-Bett gleich.
const NATUR_MIN_TEMPO = 0.1;  // das Natur-Bett wird noch etwas stärker gebremst
const FINK_ABSTAND    = 2;    // Meter: so weit vor den Augen schwebt der Vogel
const FINK_LOOP_KURZ  = 0.4;  // Sekunden: kürzeste Loop-Länge (siehe TEIL 8)

// Der kurze Vorgeschmack zwischen den zwei Ansagen von links. Die Sprecherin
// sagt in s2_speech2 "Hier links hörst du einen kurzen Ausschnitt vom Gesang
// des Hausfinken" – und wenn diese Datei durch ist, gehört die Pause dem Vogel.
//
// Er ruft ZWEI Mal. Einmal ist zu wenig, um sich eine Melodie zu merken – und
// genau darum geht es gleich, wenn man die Zeit dehnt.
//
// Alle drei Zeiten zählen ab dem ENDE von s2_speech2.
const FINK_VORSCHAU_NACH_SEK  = 0.6; // kurz Luft holen, dann der erste Ruf
const FINK_VORSCHAU_PAUSE_SEK = 2.4; // dann kommt derselbe Ruf ein zweites Mal.
                                     // Die Aufnahme ist 1,9 s lang, es bleibt
                                     // also eine halbe Sekunde Luft dazwischen –
                                     // so klingt es nach einem Vogel, der zwei
                                     // Mal ruft, und nicht nach einem Loop.
const S2_STIMME3_NACH_SEK     = 6;   // dann spricht sie weiter. Der zweite Ruf
                                     // ist bei 0,6 + 2,4 + 1,9 = 4,9 s vorbei,
                                     // er darf also noch gut eine Sekunde
                                     // nachhängen, bevor sie einsetzt.
const FINK_VORSCHAU_ABSTAND   = 2;   // Meter links vom Hörer

// Die Ansage s2_speech2 kommt aus derselben RICHTUNG wie der Vogel, steht aber
// deutlich weiter hinten. Dadurch bleibt "hier links" räumlich stimmig, und der
// Vogel sitzt klar VOR der Sprecherin statt in ihr drin. Vier Meter Abstand
// klingen nach "sie steht drüben im Raum" – der Vogel bekommt dadurch den
// Vordergrund, auf den es in diesem Moment ankommt.
const S2_STIMME_LINKS_ABSTAND = FINK_VORSCHAU_ABSTAND + 4;

// Wie laut der Fink läuft, sobald man ihn steuern darf. Steht hier, weil er an
// mehreren Stellen gebraucht wird: beim ersten Einfaden, beim Verstummen während
// der Schluss-Ansage und beim Zurückkommen danach.
const FINK_DB                = 2;   // Dezibel
const FINK_STUMM_FADE_SEK    = 1.5; // so sanft geht er weg und kommt zurück

// ─── Szene 3: der musikalische Raum ───
// Jedes Instrument hängt in einer Richtung im Raum. Zwei Winkel beschreiben sie:
//    azimut = links/rechts   (0 = geradeaus, + = rechts, − = links)
//    hoehe  = oben/unten     (0 = auf Ohrhöhe, 90 = senkrecht über dir)
// "beam" ist die Breite des Bereichs, in dem das Instrument angeht – wie der
// Lichtkegel einer Taschenlampe. "pegel" ist die aktuelle Lautstärke von
// 0 (stumm) bis 1 (voll); die rechnet TEIL 8 jede Frame neu aus.
//
// "db" gleicht aus, dass die fünf Aufnahmen unterschiedlich kräftig sind. 0
// heißt "so wie alle anderen", die Zahl wird auf ORCH_GRUND_DB draufgerechnet.
// Es geht dabei NICHT um Wichtigkeit, sondern darum, dass kein Instrument beim
// Herumschauen heraussticht oder untergeht.
//
// Warum das Klavier auf 60 statt 90 Grad hängt: Niemand legt den Kopf senkrecht
// nach oben. Bei 60 Grad reicht ein deutliches Nicken – und es klingt trotzdem
// eindeutig von oben.
//
// Die vier anderen stehen bei 45 und 100 Grad, also zwei davon knapp HINTER der
// Ohrachse (90 Grad wäre genau seitlich). Das ist Absicht: Vorne im Blickfeld
// liegen die Instrumente sonst so dicht beieinander, dass man beim Umschauen
// mehrere gleichzeitig erwischt. Weiter außen ist jedes klar für sich – und man
// muss sich wirklich umdrehen, um das letzte zu finden. Der Kegel (beam 25)
// beginnt trotzdem schon bei 75 Grad Kopfdrehung, es bleibt also erreichbar.
const orchester = [
  { name: 'cello',      datei: DATEIEN.s3Cello,      azimut: 100, hoehe:  0, beam: 25, db:  2, pegel: 0 },
  { name: 'gitarre',    datei: DATEIEN.s3Gitarre,    azimut:  45, hoehe:  0, beam: 25, db: -4, pegel: 0 },
  { name: 'klavier',    datei: DATEIEN.s3Klavier,    azimut:   0, hoehe: 60, beam: 40, db:  0, pegel: 0 },
  { name: 'floete',     datei: DATEIEN.s3Floete,     azimut: -45, hoehe:  0, beam: 25, db:  0, pegel: 0 },
  { name: 'perkussion', datei: DATEIEN.s3Perkussion, azimut:-100, hoehe:  0, beam: 25, db:  3, pegel: 0 },
];
const ORCH_ABSTAND  = 6;  // Meter: so weit weg stehen die Instrumente
const ORCH_GRUND_DB = -6; // Dezibel: der gemeinsame Startpunkt aller Instrumente
const ANSCHAU_SEK  = 2.5; // Sekunden: so schnell fadet ein Instrument ein
const AUSKLING_SEK = 10;  // Sekunden: so langsam klingt es wieder aus. Bewusst
                          // viel länger als das Einfaden – dreht man sich weg,
                          // soll das Instrument noch lange nachhängen, damit
                          // man mehrere gleichzeitig zum Klingen bringen kann.

// ─── Wie weit weg spricht die Stimme? ───
// Je größer die Zahl, desto weiter steht die Sprecherin vor dir – und desto
// weniger klebt sie am Kopf. Der Raum ist trocken (kein Hall), deshalb macht
// sich der Abstand vor allem als "sie steht im Raum" statt "sie flüstert mir
// ins Ohr" bemerkbar. In Szene 1 wandert die Stimme nach links bzw. rechts,
// damit sie aus genau der Richtung kommt, in die man schauen soll – die zwei
// Richtungen haben deshalb ihren eigenen Abstand.
const STIMME_ABSTAND        = 3.5; // Meter: Ansagen von vorne (Intro, Szene 2)
const STIMME_ABSTAND_LINKS  = 3.5; // Meter: "Hey, hier bin ich" von links
const STIMME_ABSTAND_RECHTS = 4;   // Meter: "Sehr gut…" von rechts

// ─── Wie lange dauern die Übergänge? (siehe concept/skript.txt) ───
const INTRO_SWOOSH_NACH_SEK = 6;   // Swoosh kommt mitten in die Intro-Stimme.
                                   // Gemessen ab dem ersten Wort, nicht ab
                                   // der Uhr in der Anzeige – die läuft schon
                                   // START_VERZOEGERUNG_SEK früher los
                                   // (siehe TEIL 9).
const S2_SWOOSH_NACH_SEK    = 8.95; // In Szene 2 wechselt der Raum ERST, wenn
                                    // die ganze Ansage gesprochen ist. Sie ist
                                    // ja selbst die Überleitung: Sie beginnt
                                    // noch in Szene 1 ("Jetzt bist du ja schon
                                    // Profi…") und endet mit "…dreh deinen Kopf
                                    // langsam nach rechts". Der Swoosh setzt in
                                    // der Schlusspause ein, kurz bevor der Fink
                                    // zu hören ist.
                                    //
                                    // ACHTUNG, gezählt ab dem Start von
                                    // s2_speech3 – dem letzten der vier Teile
                                    // vor dem Fink. Das letzte Wort fällt dort
                                    // auf etwa 9,1 s.
// Ruhe, bevor "Jetzt bist du ja schon Profi…" einsetzt. Die zwei Sekunden
// geben der eingefangenen Kugel Zeit auszuklingen, bevor gesprochen wird.
//
// Alle späteren Zeiten in Szene 2 hängen an einer Datei (sie zählen ab deren
// Ende oder Start) und sind von dieser Wartezeit deshalb NICHT betroffen –
// speech2 beginnt ja erst, wenn speech1 fertig gesprochen hat.
const S2_STIMME_NACH_SEK    = 2;

const PAUSE_VOR_LINKS_SEK   = 11.8; // Ruhe, bevor die Stimme von links spricht.
                                    // So lang, weil der Intro-Swoosh 9 Sekunden
                                    // dauert: erst wenn der ganz durch ist, sagt
                                    // sie "Hey, hier bin ich" (Uhr ca. 21 s).
                                    // Die zwei Sekunden über den Swoosh hinaus
                                    // sind Absicht – der Nachhall darf ausgehen,
                                    // bevor sie anfängt.
const PAUSE_VOR_STIMME_SEK  = 1.5; // Ruhe vor den übrigen Ansagen
const FINK_SPIELZEIT_SEK    = 25;  // freies Ausprobieren, dann kommt die Ansage
const FINK_ENDE_PAUSE_SEK   = 15;  // Pause nach "…eine ganze Melodie steckt?" –
                                   // lang genug, um die Melodie im Fink wirklich
                                   // zu suchen, bevor Szene 3 übernimmt
const SZENE3_FADE_SEK       = 5;   // Überblendung von Szene 2 nach Szene 3
const BASIS_EINFADE_SEK     = SZENE3_FADE_SEK + 6; // Die Streicherfläche braucht
                                   // länger als der Rest der Überblendung. Sie
                                   // soll nicht "anfangen", sondern unbemerkt da
                                   // sein: Während die Sprecherin einführt,
                                   // schiebt sie sich langsam darunter, und wenn
                                   // die Ansage endet, steht der Raum schon.
                                   // Natur und Fink gehen weiter über
                                   // SZENE3_FADE_SEK weg – nur das Bett kriecht.
const S3_STIMME_NACH_SEK    = 4;   // "Deine neuen Ohren sind jetzt sehr gut
                                   // trainiert…" startet NICHT gleich mit dem
                                   // Crossfade, sondern kurz vor dessen Ende:
                                   // Da ist die Natur schon fast weg und die
                                   // Basis-Fläche fast da – der ruhigste Moment
                                   // der Überblendung. Die Überblendung selbst
                                   // bleibt unverändert bei SZENE3_FADE_SEK.
// Ein Outro gibt es nicht mehr: "Wenn du genug gehört hast, darfst du deine
// Kopfhörer wieder absetzen" ist schon das Ende von s3_speech1.

// ─── Kopfhörer auf oder ab? ───
// Die Idee: Wer den Kopfhörer trägt, bewegt den Kopf IMMER ein kleines bisschen.
// Hängt der Kopfhörer am Haken, ist das Signal dagegen totenstill. Wir messen
// also nur: "Wann gab es zuletzt eine echte Bewegung?"
const BEWEGUNGS_SCHWELLE = 0.000000015; // ab so viel Änderung zählt es als Bewegung
const AB_TIMEOUT_MS      = 5000;        // so lange still = Kopfhörer liegt ab

// ─── Der Moment zwischen Aufsetzen und Intro ───
// Erkannt wird das Aufsetzen an der ersten Bewegung – da sitzt der Kopfhörer
// aber meist noch gar nicht richtig. Deshalb bleibt es erst einmal still:
// die Person rückt den Kopfhörer zurecht und schaut nach vorne, und ERST DANN
// wird gemessen, wo "geradeaus" ist (siehe beiKopfhoererAuf in TEIL 9).
const START_VERZOEGERUNG_SEK = 4; // Ruhe nach dem Aufsetzen, bevor das Intro beginnt
const KALIBRIER_FENSTER_SEK  = 2; // über so viele Sekunden wird die Nullstellung gemittelt

// Sicherheitsnetz für den fortlaufenden Winkel in TEIL 5. Der zählt beim
// Drehen immer weiter, und genau das kann schiefgehen: Stockt die Verbindung
// einen Moment und man dreht in dieser Lücke weit genug, rät die Rechnung die
// Drehrichtung falsch und addiert dauerhaft eine ganze Umdrehung dazu. Danach
// stünde Szene 2 für immer am Anschlag – die Zeitlupe wäre eingefroren.
//
// Mehr als 180 Grad braucht Szene 2 nie: Ab 90 Grad ist der Effekt sowieso
// ausgereizt. Wir begrenzen deshalb hart. Dadurch bringt ein Zurückdrehen die
// Szene immer innerhalb einer halben Umdrehung zurück, egal was vorher schiefging.
const YAW_GRENZE = Math.PI; // 180 Grad nach jeder Seite

const HINWEIS_TEXT = 'setz die Kopfhörer auf … · h = simulieren · r = reset · 1/2 bzw. e = Erfolgsklänge';


// ═══════════════════════════════════════════════════════════════════════════
//  TEIL 3 – VARIABLEN, DIE SICH VERÄNDERN
//  Alles hier startet leer und wird später gefüllt. "let" heißt: darf sich
//  ändern. "const" bei einem Objekt heißt: das Objekt bleibt dasselbe, aber
//  seine Inhalte dürfen sich ändern.
// ═══════════════════════════════════════════════════════════════════════════

// Der 3D-Kopf auf dem Bildschirm. Das ganze Three.js-Setup wohnt in 3dhead.js –
// wir bekommen nur drei Funktionen zurück und müssen uns um nichts Weiteres
// kümmern: setzeKopfDrehung(), macheKugel() und render().
const canvas = document.querySelector('canvas.webgl');
const kopf3d = erstelleKopfSzene(canvas);

// WELCHE INTERAKTION IST GERADE DRAN?
// Diese eine Variable steuert TEIL 8. Sie ersetzt viele einzelne
// Ja/Nein-Variablen und macht den Ablauf leichter nachvollziehbar.
//   'laden'   → die Audio-Dateien werden noch geladen
//   'warten'  → alles bereit, der Kopfhörer hängt am Haken
//   'intro'   → eine Stimme spricht, es gibt nichts zu tun
//   'kugel1'  → die linke Kugel darf herbeigelockt werden
//   'kugel2'  → die rechte Kugel darf herbeigelockt werden
//   'fink'    → die Kopfdrehung steuert die Geschwindigkeit
//   'musik'   → die Blickrichtung schaltet Instrumente an
let phase = 'laden';

// Trägt gerade jemand den Kopfhörer und die Experience läuft?
// Wichtig beim Zurücksetzen: siehe stelleAllesZurueck() in TEIL 9.
let laeuft = false;

// Normalerweise steht die Stimme fest im Raum. Für die Schluss-Ansage von
// Szene 2 soll sie sich aber wie der Fink mitdrehen und immer vor dem Kopf
// bleiben – egal, wie weit man beim Zeitlupe-Spielen gerade weggedreht ist.
// TEIL 8 schiebt sie dann jede Frame vor die Augen.
let stimmeFolgtKopf = false;

// Wann wurde der Kopfhörer aufgesetzt? Daraus rechnet die Anzeige in TEIL 8
// die laufende Zeit aus – so kann man beim Testen genau sagen, bei welcher
// Sekunde etwas zu früh oder zu spät kommt. 0 heißt: läuft gerade nicht.
let startZeit = 0;

// Nur für die Anzeige oben rechts: Werte, die tief in TEIL 8 ausgerechnet
// werden und die man beim Einstellen sehen will. Sie steuern nichts.
let anzeigeNaehe     = 0;
let anzeigeFlatterHz = 0;
let anzeigeZone      = '–';

// Derselbe Blick nach links/rechts, aber ohne Naht bei 180 Grad: Dieser Wert
// zählt beim Weiterdrehen einfach weiter (siehe TEIL 5). NUR Szene 2 benutzt
// ihn – die anderen Szenen rechnen mit Sinus und Cosinus und merken von der
// Naht ohnehin nichts.
let yawFortlaufend = 0;
let letzterYaw     = 0; // Stellung der vorigen Messung, für den Schritt

// Die Kopfwinkel in Radiant (yaw = links/rechts, pitch = nicken, roll = kippen).
let yaw = 0, pitch = 0, roll = 0;

// Audio-Grundgerüst – wird einmal in TEIL 6 aufgebaut.
let audioCtx       = null; // die Audio-Zentrale des Browsers
let resonanceScene = null; // der virtuelle Raum für den 3D-Klang
let stimmQuelle    = null; // die Stelle im Raum, aus der die Sprecherin spricht
let audioBereit    = false;

// Alle Sprecherinnen-Aufnahmen. Sie sind mono und laufen durch Tone.js.
const stimme = {};

// Die zwei Klangkugeln aus Szene 1.
//   richtung: -1 = links im Raum, +1 = rechts im Raum
//   dist:     aktuelle Entfernung in Metern
//   nahDist:  bis hierher darf sie heran – dann gilt sie als eingefangen
//   pegel:    Korrektur in Dezibel (negativ = leiser). Wirkt NICHT überall
//             gleich, sondern wächst mit der Nähe: ganz weit weg gar nicht,
//             am Ohr voll (siehe TEIL 8)
//   tempo:    wie schnell sie näher kommt (wird nah am Kopf kleiner)
//   spieler:  die drei Loops, lautstaerken: je ein Lautstärke-Regler dazu
//   fliegeRauschen/fliegeLautstaerke: das vierte, erzeugte Layer (siehe TEIL 2)
//   fliegeTempoLfo: der Sägezahn, der es zerhackt
//   fliegeFilter: der Tiefpass, der mit der Entfernung aufgeht
//   auftauchBlende: der Einfade-Regler beim Auftauchen (siehe TEIL 6)
//   auftauchen: true, solange diese Blende noch hochfährt – so lange bleibt
//               die Kugel stehen, obwohl der Blick schon zählt (siehe TEIL 8)
//
// Warum die linke Kugel einen eigenen pegel hat: Ihre Aufnahme drückt deutlich
// mehr als die rechte – aber erst, wenn sie nah ist. Deshalb wirken die -6 dB
// auch erst dort. Ganz weit weg sind beide Kugeln gleich laut, sonst wäre die
// linke beim Auftauchen schwerer zu finden als die rechte. Die Entfernung ist
// bei beiden gleich (DIST_NAH), ausgeglichen wird allein über die Lautstärke.
const kugel1 = { richtung: -1, dist: DIST_FERN, nahDist: DIST_NAH, pegel: -6, tempo: KUGEL_TEMPO_WEIT, kugel3d: null, quelle: null, spieler: [], lautstaerken: [], fliegeRauschen: null, fliegeLautstaerke: null, fliegeTempoLfo: null, fliegeFilter: null, blickDaempfung: null, auftauchBlende: null, auftauchen: false };
const kugel2 = { richtung:  1, dist: DIST_FERN, nahDist: DIST_NAH, pegel: 0, tempo: KUGEL_TEMPO_WEIT, kugel3d: null, quelle: null, spieler: [], lautstaerken: [], fliegeRauschen: null, fliegeLautstaerke: null, fliegeTempoLfo: null, fliegeFilter: null, blickDaempfung: null, auftauchBlende: null, auftauchen: false };

// Der Fink aus Szene 2.
const fink = { spieler: null, lautstaerke: null, quelle: null, tempo: 1 };

// Derselbe Ruf, aber schon MITTEN in der Ansage einmal von links: "Hier links
// hörst du einen kurzen Ausschnitt vom Gesang des Hausfinken."
// Warum ein zweiter Abspieler und nicht einfach der von oben? Der Fink oben
// wird vom Kopf verlangsamt und läuft als Endlos-Loop. Dieser hier soll genau
// einmal und immer im Originaltempo kommen – zwei Aufgaben, zwei Abspieler.
const finkVorschau = { spieler: null, quelle: null };

// Die Klangfläche, über der in Szene 3 die Instrumente liegen.
let basisSpieler     = null;
let basisLautstaerke = null;

// Die Ambisonics-Aufnahmen. Was ein "Bett" ist, steht gleich in TEIL 4.
const nature1     = { buffer: null, gain: null, quelle: null }; // Szene 1: Wiese, Insekten
const nature2     = { buffer: null, gain: null, quelle: null }; // Szene 2: wird verlangsamt
const natureFx    = { buffer: null, gain: null, quelle: null }; // Szene 2: bleibt normal schnell
const swooshIntro = { buffer: null, gain: null, quelle: null };
const swooshS2    = { buffer: null, gain: null, quelle: null };
const erfolg1     = { buffer: null, gain: null, quelle: null }; // Szene 1: erste Kugel gefangen
const erfolg2     = { buffer: null, gain: null, quelle: null }; // Szene 1: zweite Kugel gefangen


// ═══════════════════════════════════════════════════════════════════════════
//  TEIL 4 – DER WERKZEUGKASTEN
//  Nur das, was wirklich an vielen Stellen gebraucht wird. Alles andere steht
//  direkt dort, wo es passiert – damit man beim Lesen nicht hin- und
//  herspringen muss.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Rechnen ───
// Liefert den Wert zwischen a und b an der Stelle t.
//   lerp(0, 10, 0)   → 0
//   lerp(0, 10, 0.5) → 5      (genau in der Mitte)
//   lerp(0, 10, 1)   → 10
// t wird auf 0…1 begrenzt, damit nichts über das Ziel hinausschießt.
function lerp(a, b, t) {
  const begrenzt = Math.max(0, Math.min(1, t));
  return a + (b - a) * begrenzt;
}

// ─── Timer ───
// Die Szenen hängen über Timer aneinander. Wird der Kopfhörer mittendrin
// abgelegt, müssen ALLE noch offenen Timer gelöscht werden – sonst startet
// z.B. 15 Sekunden später eine Ansage in die Stille hinein.
// Deshalb: in den Szenen immer spaeter() statt setTimeout() benutzen.
let offeneTimer = [];

function spaeter(funktion, sekunden) {
  const id = setTimeout(funktion, sekunden * 1000);
  offeneTimer.push(id);
}

// ─── Ambisonics-Aufnahmen ───
//
// Was ist Ambisonics? Eine normale Aufnahme hat 1 oder 2 Kanäle. Eine
// Ambisonics-Aufnahme hat hier 16 und speichert damit den Klang aus ALLEN
// Richtungen gleichzeitig. Dreht man den Kopf, rechnet Resonance daraus in
// Echtzeit aus, was man jetzt links und rechts hören müsste.
//
// Solche Aufnahmen laufen NICHT durch Tone.js, sondern direkt in Resonance.
// Wir nennen so eine Aufnahme hier ein "Bett": eine Klangschicht, die unter
// allem anderen liegt. Ein Bett besteht aus drei Teilen:
//   buffer – die fertig geladene Aufnahme im Speicher
//   gain   – der Lautstärke-Regler
//   quelle – der Abspieler
//
// Wichtig: So ein Abspieler ist EINWEG, er lässt sich nur ein einziges Mal
// starten. Deshalb merken wir uns die Aufnahme (buffer) und bauen bei jedem
// Start einen frischen Abspieler daraus. Nur so kann der nächste Besucher
// wieder von vorne beginnen.

// Startet ein Bett als Endlos-Loop und fadet es sanft ein.
function starteBett(bett, dauerSek, zielLautstaerke) {
  const jetzt = audioCtx.currentTime;

  bett.quelle = audioCtx.createBufferSource();
  bett.quelle.buffer = bett.buffer;
  bett.quelle.loop = true;
  bett.quelle.connect(bett.gain);

  // Erst die Lautstärke auf 0 stellen, DANN starten –
  // sonst blitzt für einen Moment die volle Lautstärke auf.
  bett.gain.gain.cancelScheduledValues(jetzt);
  bett.gain.gain.setValueAtTime(0, jetzt);
  bett.quelle.start();
  bett.gain.gain.linearRampToValueAtTime(zielLautstaerke, jetzt + dauerSek);
}

// Dasselbe für die Swooshes und den Erfolgsklang: einmal durchlaufen lassen,
// ohne Loop und ohne Fade – ein Übergangsgeräusch soll ja sofort da sein.
//
// lautstaerke ist ein Faktor wie bei starteBett: 1 = so laut wie aufgenommen,
// 2 = doppelt so laut. Wer ihn weglässt, bekommt 1 – so bleiben die Swooshes
// unverändert, ohne dass man sie anfassen muss.
function spieleBettEinmal(bett, lautstaerke = 1) {
  const jetzt = audioCtx.currentTime;

  bett.quelle = audioCtx.createBufferSource();
  bett.quelle.buffer = bett.buffer;
  bett.quelle.connect(bett.gain);

  bett.gain.gain.cancelScheduledValues(jetzt);
  bett.gain.gain.setValueAtTime(lautstaerke, jetzt);
  bett.quelle.start();
}

// Fadet ein Bett aus und stoppt es danach wirklich –
// ohne das Stoppen würde es leise weiterlaufen und Rechenzeit fressen.
function stoppeBett(bett, dauerSek) {
  if (!bett.quelle) return; // läuft gerade gar nicht

  const alteQuelle = bett.quelle;
  bett.quelle = null;

  const jetzt = audioCtx.currentTime;
  bett.gain.gain.cancelScheduledValues(jetzt);
  bett.gain.gain.setValueAtTime(bett.gain.gain.value, jetzt);
  bett.gain.gain.linearRampToValueAtTime(0, jetzt + dauerSek);

  // Hier absichtlich setTimeout statt spaeter(): dieses Aufräumen soll auch
  // dann noch passieren, wenn zwischendurch alles zurückgesetzt wird.
  setTimeout(() => alteQuelle.stop(), dauerSek * 1000);
}

// Lädt eine Ambisonics-Datei, packt sie aus und hängt den Regler an Resonance.
// Der Abspieler entsteht erst später in starteBett() – jedes Mal frisch.
// Der Fortschritt landet in der Konsole: Bei über 100 MB pro Datei will man
// beim Entwickeln sehen, dass überhaupt etwas passiert.
async function ladeBett(bett, url) {
  const antwort = await fetch(url);
  if (!antwort.ok) throw new Error(`Konnte ${url} nicht laden (${antwort.status})`);

  const gesamt  = Number(antwort.headers.get('content-length')) || 0;
  const leser   = antwort.body.getReader();
  const stuecke = [];
  let geladen = 0;

  while (true) {
    const { done, value } = await leser.read();
    if (done) break;
    stuecke.push(value);
    geladen += value.length;
    if (gesamt > 0) console.log(`Lade ${url}: ${Math.round(geladen / gesamt * 100)}%`);
  }

  // Alle Stücke zu einer Datei zusammensetzen und in Audio umwandeln.
  const rohdaten = await new Blob(stuecke).arrayBuffer();
  bett.buffer = await audioCtx.decodeAudioData(rohdaten);

  bett.gain = audioCtx.createGain();
  bett.gain.gain.value = 0; // startet stumm
  bett.gain.connect(resonanceScene.ambisonicInput);
}


// ═══════════════════════════════════════════════════════════════════════════
//  TEIL 5 – HEADTRACKING
//  Eine kleine App auf dem Mac (headtracker_bridge) liest die Bewegungsdaten
//  der AirPods aus und schickt sie als Nachricht an diesen Browser-Tab.
// ═══════════════════════════════════════════════════════════════════════════

const ws = new WebSocket('ws://localhost:8080');

// Die AirPods wissen nicht, wo "geradeaus" ist – ihr Nullpunkt ist zufällig.
// Deshalb merken wir uns eine Messung als Nullstellung und ziehen sie ab.
let rohYaw = 0, rohPitch = 0, rohRoll = 0;
let nullYaw = 0, nullPitch = 0, nullRoll = 0;
let schonKalibriert = false;

// Die Messungen der letzten KALIBRIER_FENSTER_SEK Sekunden. Diese Liste wandert
// mit der Zeit mit: vorne kommt jede neue Messung dazu, hinten fallen die zu
// alten heraus. Daraus mittelt setzeNullstellung() die Kopfhaltung.
const verlauf = [];

// Für die Kopfhörer-Erkennung (Einstellungen dazu stehen in TEIL 2).
let kopfhoererAuf  = false;
let vergleichsYaw  = 0; // der zuletzt gemerkte Bewegungspunkt
let letzteBewegung = 0; // Zeitpunkt der letzten echten Bewegung

// Diese Funktion läuft jedes Mal, wenn eine neue Messung ankommt.
ws.onmessage = (nachricht) => {
  const daten = JSON.parse(nachricht.data);
  rohYaw   = daten.yaw;
  rohPitch = daten.pitch;
  rohRoll  = daten.roll;

  const jetzt = performance.now();

  // Die Messung ans Ende des Verlaufs hängen und vorne alles wegwerfen, was
  // älter ist als das Fenster. So stehen dort immer genau die letzten
  // KALIBRIER_FENSTER_SEK Sekunden – egal wie schnell die Bridge sendet.
  verlauf.push({ zeit: jetzt, yaw: rohYaw, pitch: rohPitch, roll: rohRoll });
  while (verlauf.length > 0 && jetzt - verlauf[0].zeit > KALIBRIER_FENSTER_SEK * 1000) {
    verlauf.shift();
  }

  // Die allererste Messung wird zur Nullstellung.
  if (!schonKalibriert) {
    setzeNullstellung();
    schonKalibriert = true;
  }

  yaw   = rohYaw   - nullYaw;
  pitch = rohPitch - nullPitch;
  roll  = rohRoll  - nullRoll;

  // Winkel sind ein Kreis, keine Gerade: Bei +180 Grad geht es nicht weiter
  // hoch, sondern es beginnt wieder bei -180. Beide Werte oben liegen einzeln
  // in diesem Bereich, ihre Differenz aber zwischen -360 und +360 Grad. Ohne
  // Zurückfalten macht yaw an dieser Nahtstelle einen Sprung um eine ganze
  // Umdrehung – und Szene 2 rechnet mit yaw direkt, dort hört man das sofort
  // als Sprung zurück auf normales Tempo.
  //
  // Szene 1 und 3 merken davon nichts, die benutzen Math.sin/Math.cos vom yaw,
  // und die wiederholen sich sowieso alle 360 Grad.
  if (yaw >  Math.PI) yaw -= 2 * Math.PI;
  if (yaw < -Math.PI) yaw += 2 * Math.PI;

  // roll hat dasselbe Problem. Hörbar ist es nicht, aber das Drahtgitter-
  // Modell würde sich an der Nahtstelle einmal komplett überschlagen.
  if (roll >  Math.PI) roll -= 2 * Math.PI;
  if (roll < -Math.PI) roll += 2 * Math.PI;

  // pitch braucht das nicht: Nicken geht nur von -90 bis +90 Grad, dieser
  // Bereich hat keine Nahtstelle.

  // ─── Der fortlaufende Winkel ───
  // yaw ist damit sprungfrei, hat aber immer noch eine Naht: Genau hinter dir,
  // bei 180 Grad, kippt er von +180 auf -180. Für Szene 1 und 3 ist das egal,
  // Szene 2 rechnet aber direkt damit – dort wäre es ein Sprung von Zeitlupe
  // auf volles Tempo.
  //
  // Deshalb führen wir zusätzlich einen Winkel mit, der einfach weiterzählt:
  // Statt die Stellung zu übernehmen, addieren wir jede Messung nur den SCHRITT
  // seit der letzten dazu. Und den falten wir zurück – ein einzelner Schritt ist
  // ja immer winzig, ein scheinbarer Sprung um 360 Grad kann nur die Naht sein.
  //
  // Dadurch geht es beim Weiterdrehen nach rechts immer weiter ins Minus, statt
  // vorne wieder anzufangen: -170, -190, -210 Grad. Szene 2 begrenzt das selbst
  // (lerp lässt nichts unter 0 und über 1 zu), also bleibt die Zeitlupe hinten
  // einfach stehen, statt umzuschlagen. Nach links gilt dasselbe umgekehrt:
  // Dort ist bei vollem Tempo Schluss.
  let schritt = yaw - letzterYaw;
  if (schritt >  Math.PI) schritt -= 2 * Math.PI;
  if (schritt < -Math.PI) schritt += 2 * Math.PI;

  yawFortlaufend += schritt;
  letzterYaw = yaw;

  // Und hier das Sicherheitsnetz (siehe YAW_GRENZE in TEIL 2): Der Wert darf
  // nicht unbegrenzt weglaufen, sonst kommt man nie wieder zurück.
  if (yawFortlaufend >  YAW_GRENZE) yawFortlaufend =  YAW_GRENZE;
  if (yawFortlaufend < -YAW_GRENZE) yawFortlaufend = -YAW_GRENZE;

  // Hat sich der Kopf seit dem letzten gemerkten Punkt deutlich bewegt?
  // Wir vergleichen bewusst NICHT mit der letzten Messung, sondern mit dem
  // zuletzt gemerkten Bewegungspunkt – so sind doppelt gesendete Messungen
  // (die Bridge sendet schneller, als die AirPods liefern) automatisch harmlos.
  if (Math.abs(yaw - vergleichsYaw) > BEWEGUNGS_SCHWELLE) {
    vergleichsYaw = yaw;
    letzteBewegung = jetzt;

    // AUFGESETZT: es bewegt sich wieder, obwohl der Kopfhörer als "ab" galt.
    if (!kopfhoererAuf) {
      kopfhoererAuf = true;
      beiKopfhoererAuf();
    }
  }

  // ABGELEGT: schon lange keine Bewegung mehr.
  if (kopfhoererAuf && jetzt - letzteBewegung > AB_TIMEOUT_MS) {
    kopfhoererAuf = false;
    beiKopfhoererAb();
  }
};

// Die Kopfhaltung der letzten Sekunden wird als neues "geradeaus" gespeichert.
//
// Warum ein Mittelwert und nicht einfach die letzte Messung? Wer gerade den
// Kopfhörer aufgesetzt hat, hält den Kopf noch nicht ruhig. Trifft man genau
// so ein Zucken, ist "geradeaus" für den Rest der Experience schief. Über
// zwei Sekunden gemittelt fallen solche Ausreißer kaum ins Gewicht.
//
// ACHTUNG bei Winkeln: Einfach zusammenzählen und teilen geht hier NICHT.
// Der Wert springt bei einer halben Drehung von +3.14 auf -3.14, und der
// Mittelwert wäre 0 – also ausgerechnet die Gegenrichtung. Deshalb machen wir
// aus jedem Winkel erst einen Punkt auf einem Kreis (mit sin und cos), mitteln
// diese Punkte, und rechnen mit atan2 den mittleren Winkel wieder zurück.
function setzeNullstellung() {
  // Noch keine Messung da (z.B. Bridge nicht verbunden)? Dann bleibt es beim
  // aktuellen Wert – ohne diese Zeile käme unten atan2(0, 0) heraus.
  if (verlauf.length === 0) {
    nullYaw   = rohYaw;
    nullPitch = rohPitch;
    nullRoll  = rohRoll;
    return;
  }

  let sinYaw = 0, cosYaw = 0;
  let sinPitch = 0, cosPitch = 0;
  let sinRoll = 0, cosRoll = 0;

  for (const messung of verlauf) {
    sinYaw   += Math.sin(messung.yaw);
    cosYaw   += Math.cos(messung.yaw);
    sinPitch += Math.sin(messung.pitch);
    cosPitch += Math.cos(messung.pitch);
    sinRoll  += Math.sin(messung.roll);
    cosRoll  += Math.cos(messung.roll);
  }

  // atan2 braucht die Summen nicht durch die Anzahl geteilt –
  // die Richtung des Punktes ändert sich dadurch ja nicht.
  nullYaw   = Math.atan2(sinYaw, cosYaw);
  nullPitch = Math.atan2(sinPitch, cosPitch);
  nullRoll  = Math.atan2(sinRoll, cosRoll);

  // Der fortlaufende Winkel fängt bei jeder Kalibrierung wieder bei 0 an.
  // Ohne das würde die neue Nullstellung als ein riesiger Schritt gezählt –
  // und die Zeitlupe stünde danach sofort am Anschlag.
  yawFortlaufend = 0;
  letzterYaw     = 0;

  console.log(`Nullstellung gemittelt aus ${verlauf.length} Messungen`);
}


// ═══════════════════════════════════════════════════════════════════════════
//  TEIL 6 – AUDIO LADEN UND VERKABELN
//  Läuft genau EINMAL beim Start der Seite und von oben nach unten durch:
//  Zentrale bauen → Stimmen → Ambisonics → Kugeln → Fink → Musik-Raum.
//  Hier wird nur geladen und zusammengesteckt, abgespielt wird in TEIL 7.
// ═══════════════════════════════════════════════════════════════════════════

let ladenGestartet = false;

async function initAudio() {
  if (ladenGestartet) return; // nicht zweimal laden
  ladenGestartet = true;

  // ─── Die Audio-Zentrale des Browsers ───
  audioCtx = new AudioContext();

  // resume() weckt die Zentrale auf. Das await ist wichtig: Blockiert der
  // Browser Audio (weil noch niemand geklickt hat), warten wir hier so lange,
  // bis der erste Klick kommt – siehe TEIL 10.
  await audioCtx.resume();
  Tone.setContext(new Tone.Context(audioCtx)); // Tone.js nutzt dieselbe Zentrale

  // Chrome pausiert die Zentrale manchmal von selbst (z.B. wenn der Tab lange
  // im Hintergrund liegt). Dann holen wir sie automatisch zurück.
  audioCtx.onstatechange = () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
  };

  // ─── Der virtuelle Raum ───
  // ambisonicOrder 3 = hohe räumliche Auflösung.
  //
  // Die Wandmaterialien entscheiden, wie viel Hall entsteht: Jede Fläche wirft
  // Schall zurück, und diese Rückwürfe hört man als Hall. 'transparent' heißt
  // "diese Wand wirft gar nichts zurück" – der Raum ist damit komplett trocken.
  // Nur so bleiben die Stimmen klar verständlich; die Richtung hört man trotzdem,
  // die kommt vom binauralen Rendering und nicht vom Hall.
  //
  // Zum Ausprobieren: einzelne Flächen auf 'uniform' (etwas Raum) oder
  // 'parquet-on-concrete' (harter Boden, viel Hall) stellen. Je größer der Raum
  // und je härter das Material, desto halliger.
  //
  // Die Ambisonics-Betten (TEIL 4) gehen NICHT durch diesen Raum, sie hängen
  // direkt am ambisonicInput – ihre Räumlichkeit steckt schon in der Aufnahme.
  resonanceScene = new ResonanceAudio(audioCtx, { ambisonicOrder: 3 });
  resonanceScene.output.connect(audioCtx.destination);
  resonanceScene.setRoomProperties(
    { width: 10, height: 4, depth: 10 },
    {
      left:  'transparent', right: 'transparent',
      front: 'transparent', back:  'transparent',
      down:  'transparent', up:    'transparent',
    }
  );

  // ─── Die Stimmen ───
  // Alle Ansagen laufen durch EINE Quelle im Raum. Die steht normalerweise
  // STIMME_ABSTAND Meter vor dem Hörer – in Szene 1 wandert sie nach links
  // bzw. rechts, damit die Stimme aus genau der Richtung kommt, in die man
  // schauen soll.
  stimmQuelle = resonanceScene.createSource();
  stimmQuelle.setPosition(0, 0, -STIMME_ABSTAND);

  stimme.intro    = new Tone.Player(DATEIEN.introStimme).connect(stimmQuelle.input);
  stimme.s1Links  = new Tone.Player(DATEIEN.s1Stimme1).connect(stimmQuelle.input);
  stimme.s1Rechts = new Tone.Player(DATEIEN.s1Stimme2).connect(stimmQuelle.input);
  stimme.s2Teil1  = new Tone.Player(DATEIEN.s2Stimme1).connect(stimmQuelle.input);
  stimme.s2Links1 = new Tone.Player(DATEIEN.s2Stimme2).connect(stimmQuelle.input);
  stimme.s2Links2 = new Tone.Player(DATEIEN.s2Stimme3).connect(stimmQuelle.input);
  stimme.s2Ende   = new Tone.Player(DATEIEN.s2Stimme4).connect(stimmQuelle.input);
  stimme.s3       = new Tone.Player(DATEIEN.s3Stimme1).connect(stimmQuelle.input);

  // Die Ansage von links stand früher näher am Ohr als die anderen und war
  // deshalb 3 dB abgesenkt. Seit alle Ansagen STIMME_ABSTAND Meter entfernt
  // sind, gilt das nicht mehr – jetzt darf sie sogar etwas drüber liegen,
  // weil sie von der Seite kommt und dort weniger präsent wirkt.
  stimme.s1Links.volume.value = 1;

  // Zwei Ansagen in Szene 2 mussten nachgezogen werden – beide, weil neben
  // ihnen etwas anderes im Vordergrund steht:
  //
  //   "Um dessen Komplexität…"  spricht aus 6 Metern von links, doppelt so weit
  //                             weg wie die übrigen Ansagen. Resonance macht
  //                             Entferntes leiser, das holen wir hier zurück.
  //   "Hör zum Schluss…"        liegt über der laufenden Szene: Natur-Bett,
  //                             FX-Bett und der ausfadende Fink. Dagegen muss
  //                             sie sich durchsetzen, sonst überhört man sie.
  //
  // Die Zahlen sind DEZIBEL (Tone.js rechnet hier in dB, nicht in Faktoren):
  // +6 dB ist ungefähr doppelt so laut empfunden, +4 dB deutlich hörbar mehr.
  stimme.s2Links2.volume.value = 4;
  stimme.s2Ende.volume.value   = 6;

  // ─── Die sieben Ambisonics-Dateien ───
  // Bewusst NACHEINANDER (jedes await wartet auf das vorherige): zusammen sind
  // das rund 400 MB, alles gleichzeitig auszupacken würde den Speicher sprengen.
  await ladeBett(swooshIntro, DATEIEN.introSwoosh);
  await ladeBett(nature1,     DATEIEN.s1Natur);
  await ladeBett(erfolg1,     DATEIEN.s1Erfolg1);
  await ladeBett(erfolg2,     DATEIEN.s1Erfolg2);
  await ladeBett(swooshS2,    DATEIEN.s2Swoosh);
  await ladeBett(nature2,     DATEIEN.s2Natur);
  await ladeBett(natureFx,    DATEIEN.s2NaturFx);

  // ─── Die zwei Klangkugeln ───
  // Jede bekommt eine eigene Stelle im Raum, einen sichtbaren Punkt und drei
  // Loops mit je einem Lautstärke-Regler. Alle starten stumm (-Infinity dB) –
  // hörbar wird erst, was TEIL 8 beim Näherkommen hochregelt.
  for (const kugel of [kugel1, kugel2]) {
    const dateiListe = kugel === kugel1 ? DATEIEN.s1Kugel1 : DATEIEN.s1Kugel2;

    kugel.quelle = resonanceScene.createSource();
    kugel.quelle.setPosition(kugel.richtung * DIST_FERN, 0, 0);

    // Ohne das würde Resonance ab einem Meter aufhören, den Abstand zu
    // berücksichtigen – die letzten Zentimeter wären dann tonlos gleich laut.
    kugel.quelle.setMinDistance(KUGEL_MIN_DISTANZ);

    kugel.kugel3d = kopf3d.macheKugel();

    // Ganz am Ende der Kette, kurz vor dem Raum, sitzt die Auftauch-Blende.
    // Sie hat nur EINE Aufgabe: Beim Auftauchen fährt sie über EINFADE_SEK aus
    // der Stille hoch, damit die Kugel nicht in den Raum springt. Alles andere
    // hängt hinter ihr – auch die Fliege –, also fadet die ganze Kugel als
    // Ganzes ein, egal wohin du gerade schaust.
    kugel.auftauchBlende = new Tone.Volume(-Infinity);
    kugel.auftauchBlende.connect(kugel.quelle.input);

    // Ein einziger Regler HINTER den drei Loops senkt alle gemeinsam ab, solange
    // du nicht hinschaust. Als eigener Knoten, damit die Ein- und Ausfahrten der
    // einzelnen Loops davon nichts mitbekommen – jeder Regler kümmert sich um
    // genau eine Sache. Er startet abgesenkt, denn zu Beginn schaust du geradeaus.
    kugel.blickDaempfung = new Tone.Volume(KUGEL_BLICK_DB_WEG);
    kugel.blickDaempfung.connect(kugel.auftauchBlende);

    for (const url of dateiListe) { // Reihenfolge: fern → mittel → nah
      const regler = new Tone.Volume(-Infinity);
      regler.connect(kugel.blickDaempfung);
      kugel.lautstaerken.push(regler);
      kugel.spieler.push(new Tone.Player({ url, loop: true }).connect(regler));
    }

    // ─── Das vierte Layer: die Fliege ───
    // Der Signalweg, von hinten nach vorne gelesen:
    //
    //   Rauschen → Tiefpass → Flatter-Regler → Hall → Lautstärke → quelle
    //                  ↑              ↑
    //            Entfernung     fliegeTempoLfo (Sägezahn)
    //
    // Das Rauschen läuft DURCHGEHEND. Zwei Dinge formen es, und zwar bewusst
    // getrennt: Der Sägezahn zerhackt es in Flügelschläge – das ist die schnelle
    // Bewegung. Der Tiefpass dagegen folgt nur der Entfernung und geht über die
    // ganze Annäherung hinweg langsam auf – das ist die langsame Bewegung.
    // Beides an denselben Sägezahn zu hängen, hat sich als zu unruhig erwiesen.
    //
    // WICHTIG: Die Fliege geht an blickDaempfung VORBEI. Sie ist ja das
    // Peilsignal – wenn auch sie verstummen würde, sobald man geradeaus schaut,
    // hätte man keinen Anhaltspunkt mehr, wohin man sich überhaupt drehen soll.
    // Beim Wegschauen wird sie nur träger, nicht leiser. Durch die
    // Auftauch-Blende läuft sie aber sehr wohl – ihr Einsatz soll ja genauso
    // sanft sein wie der der Aufnahmen.
    kugel.fliegeLautstaerke = new Tone.Volume(-Infinity);
    kugel.fliegeLautstaerke.connect(kugel.auftauchBlende);

    kugel.fliegeRauschen = new Tone.Noise(FLIEGE_RAUSCH_ART);

    kugel.fliegeFilter = new Tone.Filter({ type: 'lowpass', frequency: FLIEGE_FILTER_FERN_HZ });
    const fliegeFlattern = new Tone.Gain(0);

    // Ein LFO ist ein Oszillator, der so langsam schwingt, dass man ihn nicht
    // als Ton hört, sondern als Bewegung. min und max sagen, zwischen welchen
    // zwei Werten er hin und her fährt.
    //
    // Hier stehen sie ABSICHTLICH verkehrt herum (max zuerst, dann min): Ein
    // Sägezahn steigt langsam an und fällt hart ab. Andersherum gelesen wird
    // daraus der harte Einsatz mit langsamem Abfall – ein Flügelschlag eben.
    // Klingt es bei dir umgekehrt richtiger, tausche einfach die zwei Zahlen.
    kugel.fliegeTempoLfo = new Tone.LFO({
      type: 'sawtooth', frequency: FLIEGE_HZ_FERN, min: 1, max: 0,
    });
    kugel.fliegeTempoLfo.connect(fliegeFlattern.gain);

    // Der Hall sitzt IM Weg der Fliege, nicht daneben. Dadurch nimmt jedes
    // Ausfaden die Hallfahne gleich mit, statt sie allein weiterklingen zu
    // lassen. Und weil der Hall vor der Quelle liegt, wandert die Fahne mit.
    //
    // Tone.Reverb rechnet sich beim Erzeugen eine Hallfahne aus – das dauert
    // einen Moment, deshalb das await. Ohne wäre der Anfang trocken.
    const fliegeHall = new Tone.Reverb({ decay: FLIEGE_HALL_DECAY, wet: FLIEGE_HALL_ANTEIL });
    await fliegeHall.ready;

    kugel.fliegeRauschen.connect(kugel.fliegeFilter);
    kugel.fliegeFilter.connect(fliegeFlattern);
    fliegeFlattern.connect(fliegeHall);
    fliegeHall.connect(kugel.fliegeLautstaerke);
  }

  // ─── Der Fink ───
  // Er bekommt eine eigene Stelle im Raum. TEIL 8 schiebt sie jede Frame vor
  // die Augen – so schwebt der Vogel immer in Blickrichtung, klingt aber mit
  // echtem räumlichem Abstand statt flach im Kopf.
  fink.quelle      = resonanceScene.createSource();
  fink.lautstaerke = new Tone.Volume(-Infinity);
  fink.spieler     = new Tone.Player({ url: DATEIEN.s2Fink, loop: true });
  fink.spieler.connect(fink.lautstaerke);
  fink.lautstaerke.connect(fink.quelle.input);

  // Der Vorgeschmack mitten in der Ansage: dieselbe Aufnahme, aber OHNE Loop
  // und an einer festen Stelle links. Die bleibt den ganzen Abschnitt über
  // stehen – der Ruf soll ja wirklich von links kommen und nicht dorthin
  // wandern, wo man gerade hinschaut.
  finkVorschau.quelle  = resonanceScene.createSource();
  finkVorschau.quelle.setPosition(-FINK_VORSCHAU_ABSTAND, 0, 0);
  finkVorschau.spieler = new Tone.Player({ url: DATEIEN.s2Fink, loop: false });
  finkVorschau.spieler.connect(finkVorschau.quelle.input);

  // ─── Der Musik-Raum ───
  // Die Basis-Fläche läuft OHNE Resonance direkt auf den Ausgang: Sie soll den
  // ganzen Raum füllen und nicht aus einer bestimmten Richtung kommen.
  basisLautstaerke = new Tone.Volume(-Infinity).toDestination();
  basisSpieler = new Tone.Player({ url: DATEIEN.s3Basis, loop: true, volume: -6 })
    .connect(basisLautstaerke);

  for (const instrument of orchester) {
    // Aus den zwei Winkeln wird ein Pfeil der Länge 1 – die Richtung, in der
    // das Instrument steht. "Geradeaus" ist im Audio-Raum -Z, daher das Minus.
    const a = instrument.azimut * Math.PI / 180;
    const h = instrument.hoehe  * Math.PI / 180;
    instrument.x =  Math.cos(h) * Math.sin(a);
    instrument.y =  Math.sin(h);
    instrument.z = -Math.cos(h) * Math.cos(a);

    // Den Pfeil auf den Abstand strecken – das ergibt die Position im Raum.
    const quelle = resonanceScene.createSource();
    quelle.setPosition(
      ORCH_ABSTAND * instrument.x,
      ORCH_ABSTAND * instrument.y,
      ORCH_ABSTAND * instrument.z
    );

    // Abspieler und Regler direkt am Instrument speichern –
    // dann steht in TEIL 8 alles beisammen.
    instrument.lautstaerke = new Tone.Volume(-Infinity);
    instrument.lautstaerke.connect(quelle.input);
    // Der eigene db-Wert kommt auf den gemeinsamen Grundpegel drauf. Er steht
    // HIER am Abspieler und nicht am Regler darunter: Den schreibt TEIL 8 in
    // jeder Frame neu, dort wäre die Anpassung sofort wieder überschrieben.
    instrument.spieler = new Tone.Player({
      url: instrument.datei,
      loop: true,
      volume: ORCH_GRUND_DB + instrument.db,
    }).connect(instrument.lautstaerke);
  }

  // ─── Fertig ───
  await Tone.loaded(); // warten, bis alle Tone.js-Dateien ausgepackt sind

  audioBereit = true;
  phase = 'warten';
  console.log('Audio komplett geladen – warte auf Kopfhörer.');

  const hinweis = document.getElementById('hint');
  hinweis.textContent = HINWEIS_TEXT;
  hinweis.classList.remove('hidden');

  // Falls jemand den Kopfhörer schon aufgesetzt hat, während wir noch luden:
  // die Experience jetzt nachholen, statt sie zu verschlucken.
  if (startWartet) {
    startWartet = false;
    beiKopfhoererAuf();
  }
}


// ═══════════════════════════════════════════════════════════════════════════
//  TEIL 7 – DER ABLAUF
//  Eine Funktion pro Abschnitt aus dem Skript. Jede startet ihre Klänge selbst
//  und gibt am Ende an die nächste weiter. Die Interaktion passiert nicht
//  hier, sondern in TEIL 8.
//
//  Wie hängen die Funktionen zusammen?
//
//    intro ─→ szene1Links ─→ [Kugel einfangen] ─→ szene1Rechts
//                                                      │
//                    szene2 ←─ [Kugel einfangen] ←─────┘
//                      │
//                      └─→ szene2Ende ─→ szene3 ─→ Ende (Kopfhörer absetzen)
//
//  Zwei Arten von Übergang kommen vor:
//    spaeter(…)         – nach einer festen Zeit
//    .onstop = () => …  – sobald eine Ansage fertig gesprochen ist
//
//  In JEDEM Übergang steht "if (!laeuft) return;". Der Grund: Wenn jemand
//  mittendrin den Kopfhörer absetzt, dürfen wartende Übergänge nichts mehr
//  starten. laeuft ist der Hauptschalter dafür.
// ═══════════════════════════════════════════════════════════════════════════

// INTRO – "Hey, wenn du bereit bist, schließe gerne deine Augen…"
function intro() {
  console.log('INTRO');
  phase = 'intro';
  stimmQuelle.setPosition(0, 0, -STIMME_ABSTAND); // Stimme kommt von vorne
  stimme.intro.start();

  // Mitten in der Ansage öffnet der Swoosh den Raum und die Wiese fadet ein.
  spaeter(() => {
    if (!laeuft) return;
    spieleBettEinmal(swooshIntro);
    starteBett(nature1, 3, 0.9);
  }, INTRO_SWOOSH_NACH_SEK);

  stimme.intro.onstop = () => {
    if (!laeuft) return;
    szene1Links();
  };
}

// SZENE 1a – "Hey, hier bin ich. Dreh doch deinen Kopf mal nach links zu mir…"
function szene1Links() {
  console.log('SZENE 1 – Kugel links');
  phase = 'intro'; // solange die Stimme spricht, gibt es nichts zu tun

  // Stimme kommt von LINKS. Direkt neben dem Ohr würde sie zu sehr drücken,
  // aus ein paar Metern bleibt die Richtung eindeutig und es klingt angenehm.
  stimmQuelle.setPosition(-STIMME_ABSTAND_LINKS, 0, 0);

  spaeter(() => {
    if (!laeuft) return;
    stimme.s1Links.start();

    stimme.s1Links.onstop = () => {
      if (!laeuft) return;

      // Die Kugel taucht auf: Sie steht still ganz weit weg, und die
      // Auftauch-Blende holt sie über EINFADE_SEK aus der Stille herauf.
      kugel1.dist = DIST_FERN;
      kugel1.quelle.setPosition(kugel1.richtung * DIST_FERN, 0, 0);
      kugel1.kugel3d.position.set(kugel1.richtung * DIST_FERN, 0, 0);
      kugel1.kugel3d.visible = true;

      for (const spieler of kugel1.spieler) spieler.start();

      // Rauschen und Sägezahn laufen ab jetzt durchgehend – hörbar wird davon
      // nur, was die Regler durchlassen.
      kugel1.fliegeRauschen.start();
      kugel1.fliegeTempoLfo.start();

      // WARUM die Blende und nicht einfach ein Fade auf dem Fern-Loop:
      // Wie laut die Kugel ist, hängt auch davon ab, wohin du schaust
      // (blickDaempfung, -18 dB beim Wegschauen). Früher lief der Fade hinter
      // einer FESTEN Dämpfung ab, und in dem Moment, in dem TEIL 8 übernahm,
      // sprang sie auf den Wert für die echte Blickrichtung. Wer schon nach
      // links schaute, bekam die Kugel deshalb mit einem Schlag um 18 dB
      // lauter – genau das klang abrupt. Jetzt rechnet TEIL 8 den Blick von
      // der ersten Frame an mit, und die Blende davor macht den sanften
      // Einsatz. Es gibt also keine Übergabe mehr, an der etwas springen kann.
      kugel1.auftauchBlende.volume.cancelScheduledValues(0);
      kugel1.auftauchBlende.volume.value = -Infinity;
      kugel1.auftauchBlende.volume.rampTo(0, EINFADE_SEK);

      // Blick zählt sofort, bewegen darf sie sich noch nicht: auftauchen hält
      // sie stehen, bis die Blende oben ist (siehe TEIL 8).
      kugel1.auftauchen = true;
      phase = 'kugel1';

      spaeter(() => {
        if (laeuft) kugel1.auftauchen = false;
      }, EINFADE_SEK);
    };
  }, PAUSE_VOR_LINKS_SEK);
}

// SZENE 1b – "Sehr gut. Jetzt dreh dich mal nach rechts…"
function szene1Rechts() {
  console.log('SZENE 1 – Kugel rechts');
  phase = 'intro';
  stimmQuelle.setPosition(STIMME_ABSTAND_RECHTS, 0, 0); // Stimme kommt von RECHTS

  spaeter(() => {
    if (!laeuft) return;
    stimme.s1Rechts.start();

    stimme.s1Rechts.onstop = () => {
      if (!laeuft) return;

      // Gleiches Auftauchen wie oben, diesmal mit der rechten Kugel.
      kugel2.dist = DIST_FERN;
      kugel2.quelle.setPosition(kugel2.richtung * DIST_FERN, 0, 0);
      kugel2.kugel3d.position.set(kugel2.richtung * DIST_FERN, 0, 0);
      kugel2.kugel3d.visible = true;

      for (const spieler of kugel2.spieler) spieler.start();

      kugel2.fliegeRauschen.start();
      kugel2.fliegeTempoLfo.start();

      kugel2.auftauchBlende.volume.cancelScheduledValues(0);
      kugel2.auftauchBlende.volume.value = -Infinity;
      kugel2.auftauchBlende.volume.rampTo(0, EINFADE_SEK);

      kugel2.auftauchen = true;
      phase = 'kugel2';

      spaeter(() => {
        if (laeuft) kugel2.auftauchen = false;
      }, EINFADE_SEK);
    };
  }, PAUSE_VOR_STIMME_SEK);
}

// SZENE 2 – der Hausfink.
// Die Ansage s2_speech1 ist EINE lange Datei, die noch in Szene 1 anfängt
// ("Jetzt bist du ja schon Profi im Klänge herbeilocken…") und dann zum
// Hausfink überleitet. Deshalb läuft sie hier von Anfang bis Ende durch.
//
// Danach spricht sie VON LINKS weiter, und zwar in zwei Dateien: Zwischen
// s2_speech2 ("Hier links hörst du…") und s2_speech3 ("Um dessen Komplexität…")
// liegt die Pause, in der der Fink zwei Mal als Vorgeschmack ruft.
//
// Der Raum wechselt erst am Ende der Ansage: Der Swoosh setzt nach
// S2_SWOOSH_NACH_SEK in s2_speech3 ein, in der Schlusspause nach
// "…um die Zeit zu verlangsamen".
//
// Der echte Fink kommt noch später – erst wenn die Stimme ganz fertig ist. Er
// soll nicht in die Ansage hineinzwitschern. Ab da übersetzt TEIL 8 jede
// Kopfdrehung in Tempo.
//
// Szene 2 hat ZWEI Ambisonics-Betten übereinander:
//   nature2  – wird zusammen mit dem Fink verlangsamt (das ist die Zeitlupe)
//   natureFx – bleibt im Originaltempo und legt nur leise Atmosphäre darunter,
//              damit der Raum bei starker Verlangsamung nicht einschläft
function szene2() {
  console.log('SZENE 2 – Fink');
  phase = 'intro'; // solange die Stimme spricht, gibt es nichts zu steuern
  stimmQuelle.setPosition(0, 0, -STIMME_ABSTAND); // Stimme wieder nach vorne

  // TEIL 1 der Ansage, von vorne gesprochen. Sie beginnt nicht sofort – erst
  // klingt die gefangene Kugel aus.
  spaeter(() => {
    if (!laeuft) return;
    stimme.s2Teil1.start();
  }, S2_STIMME_NACH_SEK);

  // TEIL 2 – ab hier VON LINKS. Die Stimme wandert auf genau die Stelle, an der
  // gleich der Fink zwitschert, nur ein Stück weiter dahinter.
  // Dadurch sagt sie "hier links" tatsächlich von dort, wo "hier" ist.
  stimme.s2Teil1.onstop = () => {
    if (!laeuft) return;

    stimmQuelle.setPosition(-S2_STIMME_LINKS_ABSTAND, 0, 0);
    stimme.s2Links1.start();
  };

  // "…vom Gesang des Hausfinken." Jetzt gehört die Pause dem Vogel: Er ruft
  // zwei Mal von links, im Originaltempo, damit man gleich hört, wie er sich
  // später verändert. Erst danach spricht sie weiter.
  //
  // Deshalb sind das zwei Dateien und nicht eine: So lang wie diese Pause
  // schneidet man keine Stille in eine Sprachaufnahme.
  // Alle Zeiten hier zählen ab dem Ende von s2_speech2.
  stimme.s2Links1.onstop = () => {
    if (!laeuft) return;

    spaeter(() => {
      if (!laeuft) return;
      finkVorschau.spieler.start();
    }, FINK_VORSCHAU_NACH_SEK);

    spaeter(() => {
      if (!laeuft) return;
      finkVorschau.spieler.start();
    }, FINK_VORSCHAU_NACH_SEK + FINK_VORSCHAU_PAUSE_SEK);

    // TEIL 3 – "Um dessen Komplexität nun besser wahrnehmen zu können…",
    // weiterhin von links.
    spaeter(() => {
      if (!laeuft) return;
      stimme.s2Links2.start();
    }, S2_STIMME3_NACH_SEK);

    // Der Raum wechselt mitten in TEIL 3, in dessen Schlusspause. Gezählt wird
    // ab hier, deshalb die zwei Zeiten zusammen: erst warten, bis TEIL 3 läuft,
    // dann noch S2_SWOOSH_NACH_SEK in die Datei hinein.
    spaeter(() => {
      if (!laeuft) return;
      spieleBettEinmal(swooshS2);
      stoppeBett(nature1, 4);
      // Die Wiese in Szene 2 steht deutlich lauter als die aus Szene 1 (0.9):
      // Sie wird ja gleich mit dem Fink verlangsamt und ist dann das eigentliche
      // Klangereignis, nicht nur Hintergrund. Je präsenter sie ist, desto stärker
      // wirkt die Zeitlupe.
      //
      // Achtung, die Zahl ist KEIN Dezibel-Wert, sondern ein Faktor: 1 = so laut
      // wie aufgenommen, 2 = doppelt so laut. Dezibel rechnet man um, indem man
      // multipliziert – +3 dB sind mal 1.41. Aus den früheren 1.8 werden so 2.54.
      starteBett(nature2, 4, 2.54);
      starteBett(natureFx, 4, 0.45);
    }, S2_STIMME3_NACH_SEK + S2_SWOOSH_NACH_SEK);
  };

  // Ausgesprochen – jetzt übernimmt der echte Fink, und der Kopf wird zum
  // Geschwindigkeitsregler.
  stimme.s2Links2.onstop = () => {
    if (!laeuft) return;

    fink.spieler.playbackRate = 1; // sicherheitshalber im Originaltempo starten
    fink.spieler.start();
    fink.lautstaerke.volume.rampTo(FINK_DB, FINK_STUMM_FADE_SEK);

    phase = 'fink'; // jetzt erst wird der Kopf zum Geschwindigkeitsregler

    spaeter(szene2Ende, FINK_SPIELZEIT_SEK); // erst frei ausprobieren lassen
  };
}

// SZENE 2 ENDE – "Hör zum Schluss noch mal genauer hin…"
function szene2Ende() {
  if (!laeuft) return;
  console.log('SZENE 2 – Ende');

  // Ab jetzt wandert die Stimme mit dem Kopf mit (siehe TEIL 8). Sonst käme
  // dieser Satz aus der Richtung, in der die Stimme zuletzt stand – und man
  // steht beim Zeitlupe-Spielen ja meistens weit weggedreht.
  stimmeFolgtKopf = true;

  // Der Fink verstummt, solange gesprochen wird. Er läuft dabei WEITER, nur
  // eben stumm – so bleibt er im Takt und reagiert auch weiter auf den Kopf.
  // Danach kommt er einfach zurück, statt neu anzufangen.
  fink.lautstaerke.volume.rampTo(-Infinity, FINK_STUMM_FADE_SEK);

  stimme.s2Ende.start();
  stimme.s2Ende.onstop = () => {
    stimmeFolgtKopf = false;
    if (!laeuft) return;

    fink.lautstaerke.volume.rampTo(FINK_DB, FINK_STUMM_FADE_SEK);
    spaeter(szene3, FINK_ENDE_PAUSE_SEK);
  };
}

// SZENE 3 – der musikalische Raum.
// Fink und Natur faden aus, die Basis-Fläche fadet ein. Die Instrumente laufen
// alle mit, sind aber stumm – hörbar macht sie erst der Blick in TEIL 8.
function szene3() {
  if (!laeuft) return;
  console.log('SZENE 3 – Musik');

  fink.lautstaerke.volume.rampTo(-Infinity, SZENE3_FADE_SEK);
  spaeter(() => fink.spieler.stop(), SZENE3_FADE_SEK); // erst nach dem Fade
  stoppeBett(nature2, SZENE3_FADE_SEK);
  stoppeBett(natureFx, SZENE3_FADE_SEK);

  basisSpieler.start();
  basisLautstaerke.volume.rampTo(-24, BASIS_EINFADE_SEK);
  for (const instrument of orchester) instrument.spieler.start();

  // Während der Überblendung und der Ansage gibt es noch nichts zu steuern.
  // Die Instrumente laufen zwar schon mit, bleiben aber stumm – sonst weckt
  // eine zufällige Kopfdrehung mitten im Übergang ein Instrument, das dort
  // überhaupt nichts zu suchen hat.
  phase = 'intro';

  // Die Stimme stand zuletzt vor dem Kopf und ist mitgewandert (Szene 2 Ende).
  // Für die Ansage kommt sie zurück auf ihren festen Platz vorne.
  stimmQuelle.setPosition(0, 0, -STIMME_ABSTAND);

  // Die Ansage endet mit "Wenn du genug gehört hast, darfst du deine Kopfhörer
  // wieder absetzen" – danach kommt nichts mehr. Die Szene läuft weiter, bis
  // der Kopfhörer tatsächlich abgelegt wird (siehe TEIL 9).
  //
  // Sie wartet den größten Teil der Überblendung ab, damit die Stimme nicht
  // gegen die ausfadende Natur ansprechen muss.
  spaeter(() => {
    if (!laeuft) return;
    stimme.s3.start();

    // ERST wenn sie fertig gesprochen hat, wird der Blick zur Taschenlampe.
    stimme.s3.onstop = () => {
      if (!laeuft) return;
      phase = 'musik';
    };
  }, S3_STIMME_NACH_SEK);
}


// ═══════════════════════════════════════════════════════════════════════════
//  TEIL 8 – JEDE FRAME
//  requestAnimationFrame ruft tick() etwa 60-mal pro Sekunde auf. Das ist die
//  Stelle, an der aus einer Kopfdrehung eine Reaktion wird. Alle drei
//  Interaktionen stehen hier untereinander – welche dran ist, sagt phase.
//
//  WICHTIG: tick() darf nur EINMAL gestartet werden. Liefe die Schleife
//  doppelt, würde alles doppelt so schnell passieren.
// ═══════════════════════════════════════════════════════════════════════════

let tickLaeuft = false;
let letzteZeit = 0;

function starteTick() {
  if (tickLaeuft) return; // genau dieser Schutz
  tickLaeuft = true;
  letzteZeit = performance.now() / 1000;
  tick();
}

function tick() {
  // deltaZeit = wie viele Sekunden seit dem letzten Bild vergangen sind.
  // Damit rechnen wir alle Bewegungen um, statt "pro Bild" – sonst liefe die
  // Experience auf einem schnelleren Rechner schneller ab.
  const jetzt = performance.now() / 1000;
  const deltaZeit = jetzt - letzteZeit;
  letzteZeit = jetzt;

  // Wohin schaue ich gerade? Ein Pfeil der Länge 1, einmal pro Bild berechnet
  // und unten mehrfach benutzt. "Geradeaus" ist im Audio-Raum -Z.
  const blickX =  Math.sin(yaw) * Math.cos(pitch);
  const blickY =  Math.sin(pitch);
  const blickZ = -Math.cos(yaw) * Math.cos(pitch);

  // ─── 1. Den Drahtgitter-Kopf auf dem Bildschirm mitdrehen ───
  kopf3d.setzeKopfDrehung(yaw, pitch, roll);

  // ─── 2. Resonance sagen, wohin der Kopf schaut ───
  // Ohne das würde der 3D-Klang nicht mitdrehen.
  if (audioBereit) {
    resonanceScene.setListenerOrientation(blickX, blickY, blickZ, 0, 1, 0);
  }

  // ─── 3. SZENE 1: eine Kugel herbeilocken ───
  if (audioBereit && (phase === 'kugel1' || phase === 'kugel2')) {
    const kugel = phase === 'kugel1' ? kugel1 : kugel2;

    // Schaue ich zur Kugel hin? Multipliziert man zwei Pfeile der Länge 1
    // (x·x + y·y + z·z), bekommt man heraus, wie ähnlich ihre Richtungen sind:
    // 1 = genau drauf, 0 = seitlich, -1 = abgewandt. Die Kugel liegt genau
    // seitlich, ihr Pfeil ist also (-richtung, 0, 0) – übrig bleibt eine
    // einzige Multiplikation.
    // Das Minus vor richtung ist Absicht: Audio-Achse und Bild-Achse sind in
    // diesem Projekt gespiegelt. Nicht "korrigieren", so stimmt es.
    //
    // blickTreffer behalten wir als Zahl, nicht nur als ja/nein: Das Heranziehen
    // der Kugel braucht die klare Entscheidung (schautHin), die Fliege weiter
    // unten dagegen den weichen Verlauf dazwischen.
    const blickTreffer = blickX * -kugel.richtung;
    const schautHin    = blickTreffer > BLICK_GENAUIGKEIT;

    // Hinschauen zieht die Kugel heran, Wegschauen lässt sie zurückweichen.
    // Solange sie noch auftaucht, bleibt sie stehen: Erst soll man sie in Ruhe
    // hören, dann darf man sie holen. Die Lautstärken darunter rechnen aber
    // schon mit – sonst gäbe es beim Losfahren einen Sprung.
    if (kugel.auftauchen) {
      // nichts bewegen
    } else if (schautHin) {
      kugel.dist = Math.max(kugel.nahDist, kugel.dist - kugel.tempo * deltaZeit);
    } else {
      kugel.dist = Math.min(DIST_FERN, kugel.dist + RUECKZUG_TEMPO * deltaZeit);
    }

    // Klang und sichtbarer Punkt wandern gemeinsam.
    kugel.quelle.setPosition(kugel.richtung * kugel.dist, 0, 0);
    kugel.kugel3d.position.set(kugel.richtung * kugel.dist, 0, 0);

    // naehe: 0 = ganz weit weg, 1 = so nah wie diese Kugel kommen darf.
    const naehe = 1 - (kugel.dist - kugel.nahDist) / (DIST_FERN - kugel.nahDist);

    // Wie viel von den Aufnahmen darf man überhaupt hören? Geradeaus fast
    // nichts, hingedreht alles. Math.pow schärft den Verlauf: Ohne das Potenzieren
    // wäre schon auf halbem Weg zur Kugel der halbe Klang da, die Kugel würde sich
    // nicht mehr "verstecken". Die Fliege ist davon nicht betroffen, sie bleibt als
    // Wegweiser hörbar (siehe TEIL 6).
    const blickAnteil   = Math.max(0, blickTreffer);
    const blickSchaerfe = Math.pow(blickAnteil, KUGEL_BLICK_SCHAERFE);
    kugel.blickDaempfung.volume.value = lerp(KUGEL_BLICK_DB_WEG, 0, blickSchaerfe);

    // Die drei Loops kommen nacheinander dazu: der Fern-Loop ist immer zu
    // hören, der mittlere ab 10 % Nähe, der nahe ab 30 %. Die Werte sind
    // Dezibel: 0 = laut, -30 = sehr leise, -Infinity = ganz aus.
    // Die Kugel-Korrektur wächst mit der Nähe: Bei naehe 0 ist sie 0, am Ziel
    // voll. So klingen beide Kugeln beim Auftauchen gleich präsent – man muss
    // die linke nicht mühsamer suchen als die rechte – und trotzdem wird sie
    // am Ohr zurückgenommen, wo ihre Aufnahme sonst drücken würde.
    const pegelJetzt = lerp(0, kugel.pegel, naehe);

    // pegelJetzt kommt überall dazu – damit lässt sich eine ganze Kugel
    // leiser stellen, ohne die Kurven anzufassen (siehe TEIL 3).
    kugel.lautstaerken[0].volume.value = lerp(LAYER1_DB_FERN, LAYER1_DB_NAH, naehe) + pegelJetzt;

    if (naehe > 0.1) kugel.lautstaerken[1].volume.value = lerp(-30, -6, (naehe - 0.1) / 0.75) + pegelJetzt;
    else             kugel.lautstaerken[1].volume.value = -Infinity;

    // Der Nah-Loop liegt 6 dB über dem mittleren (-24 bis 0 statt -30 bis -6).
    // Er ist der Klang, für den die ganze Sucherei gemacht wurde – ganz am Ende
    // darf er die anderen beiden überstrahlen.
    if (naehe > 0.3) kugel.lautstaerken[2].volume.value = lerp(-24, 0, (naehe - 0.3) / 0.45) + pegelJetzt;
    else             kugel.lautstaerken[2].volume.value = -Infinity;

    // Das vierte Layer: die Fliege. Hier wird nichts ausgelöst – das Rauschen
    // läuft ja durch. Wir verändern nur, wie schnell die zwei Sägezähne es
    // zerhacken.
    //
    // Zwei Dinge bestimmen die Flatterrate. Erstens die Entfernung – die ändert
    // sich langsam. Zweitens dein Blick – der ändert sich sofort. Deshalb
    // multiplizieren wir: Die Entfernung gibt das Grundtempo vor, der Blick
    // beschleunigt oder bremst es.
    //
    // Zuerst die Grundrate aus der Entfernung, in drei Abschnitten – denselben,
    // die unten in der Anzeige als Zone 1/2/3 stehen. In jedem Abschnitt rechnen
    // wir den Weg noch einmal von 0 bis 1 durch, damit lerp damit umgehen kann.
    let grundRate;
    if (naehe < FLIEGE_MITTE_BEI) {
      grundRate = lerp(FLIEGE_HZ_FERN, FLIEGE_HZ_MITTE, naehe / FLIEGE_MITTE_BEI);
    } else if (naehe < KUGEL_SOG_AB) {
      grundRate = lerp(FLIEGE_HZ_MITTE, FLIEGE_HZ_SOG, (naehe - FLIEGE_MITTE_BEI) / (KUGEL_SOG_AB - FLIEGE_MITTE_BEI));
    } else {
      grundRate = lerp(FLIEGE_HZ_SOG, FLIEGE_HZ_NAH, (naehe - KUGEL_SOG_AB) / (1 - KUGEL_SOG_AB));
    }

    const flatterRate = grundRate * lerp(FLIEGE_BLICK_AB, FLIEGE_BLICK_DRAUF, blickAnteil);

    kugel.fliegeTempoLfo.frequency.value = flatterRate;

    // Für die Anzeige mitschreiben. Die drei Zonen sind die Abschnitte der
    // Annäherung: bis zum Stützpunkt der Flatterkurve, von dort bis zum Sog,
    // und der Sog selbst. Steuern tut das hier nichts.
    anzeigeNaehe     = naehe;
    anzeigeFlatterHz = flatterRate;
    if (naehe < FLIEGE_MITTE_BEI)   anzeigeZone = '1 fern';
    else if (naehe < KUGEL_SOG_AB)  anzeigeZone = '2 mitte';
    else                            anzeigeZone = '3 SOG';

    // Der Tiefpass folgt allein der Entfernung, nicht dem Flattern. Gerechnet
    // wird über Oktaven, also über Verdopplungen: Für das Ohr ist der Schritt
    // von 4000 auf 8000 Hz genauso groß wie der von 8000 auf 16000. Geradlinig
    // in Hertz gerechnet wäre die erste Hälfte der Strecke die auffällige und
    // die zweite fast unhörbar.
    //
    // Die Rechnung funktioniert in beide Richtungen – wäre FERN größer als NAH,
    // würde filterOktaven einfach negativ und der Filter führe zu.
    const filterOktaven = Math.log2(FLIEGE_FILTER_NAH_HZ / FLIEGE_FILTER_FERN_HZ);
    kugel.fliegeFilter.frequency.value = FLIEGE_FILTER_FERN_HZ * Math.pow(2, filterOktaven * naehe);

    // Zwei Absenkungen addieren sich hier: die aus der Entfernung und die aus
    // dem Blick. In Dezibel darf man addieren – zwei Regler hintereinander
    // ergeben zusammen die Summe ihrer dB-Werte. blickSchaerfe ist derselbe
    // geschärfte Blickwert wie oben bei den Aufnahmen, die Fliege benutzt nur
    // eine eigene, tiefere Absenkung.
    //
    // kugel.pegel kommt bewusst NICHT dazu: Die Fliege ist erzeugt und nicht
    // aufgenommen, sie klingt auf beiden Seiten gleich – anders als die linke
    // Aufnahme, die deshalb 6 dB Korrektur bekommt.
    kugel.fliegeLautstaerke.volume.value =
        lerp(FLIEGE_DB_FERN, FLIEGE_DB_NAH, naehe)
      + lerp(FLIEGE_BLICK_DB_WEG, 0, blickSchaerfe);

    // Im letzten Drittel zieht die Kugel an. sogAnteil zählt dieses Drittel noch
    // einmal von 0 bis 1 durch: bei KUGEL_SOG_AB fängt es bei 0 an, ganz am Ziel
    // ist es 1. Daraus wird ein stufenlos steigendes Tempo – man hört, wie sie
    // von selbst kommt, statt gezogen zu werden.
    if (naehe > KUGEL_SOG_AB) {
      const sogAnteil = (naehe - KUGEL_SOG_AB) / (1 - KUGEL_SOG_AB);
      kugel.tempo = lerp(KUGEL_TEMPO_WEIT, KUGEL_TEMPO_SOG, sogAnteil);
    } else {
      kugel.tempo = KUGEL_TEMPO_WEIT;
    }

    // Angekommen? Dann ist sie eingefangen.
    //
    // Sie wird NICHT hart abgeschaltet, sondern fadet über AUSFADE_SEK aus:
    // ein abruptes Abreißen klingt nach Fehler, ein Ausklingen nach "gefangen".
    // Die nächste Szene wird trotzdem sofort angestoßen – sie beginnt mit ihrer
    // eigenen Pause, die Stimme setzt also genau dann ein, wenn der Klang weg
    // ist. Und weil die Szene phase sofort umstellt, rechnet der Block hier
    // oben nicht mehr gegen den Fade an.
    if (kugel.dist <= kugel.nahDist) {
      for (const regler of kugel.lautstaerken) regler.volume.rampTo(-Infinity, AUSFADE_SEK);
      kugel.fliegeLautstaerke.volume.rampTo(-Infinity, AUSFADE_SEK);

      spaeter(() => {
        for (const spieler of kugel.spieler) spieler.stop();
        // Auch Rauschen und Sägezahn anhalten – sie liefen sonst stumm weiter
        // und würden dauerhaft Rechenzeit fressen.
        kugel.fliegeRauschen.stop();
        kugel.fliegeTempoLfo.stop();
        kugel.kugel3d.visible = false;
      }, AUSFADE_SEK);

      // Geschafft! Der Erfolgsklang legt sich als Ambisonics-Aufnahme über den
      // ganzen Raum, während die Kugel selbst noch ausfadet. Er kommt deshalb
      // aus keiner Richtung, sondern von überall – das unterscheidet ihn hörbar
      // von allem, was man vorher suchen musste. Jede Kugel hat ihren eigenen.
      if (phase === 'kugel1') {
        spieleBettEinmal(erfolg1, ERFOLG1_LAUTSTAERKE);
        szene1Rechts(); // stellt phase selbst um
      } else {
        spieleBettEinmal(erfolg2, ERFOLG2_LAUTSTAERKE);

        // Nach der zweiten Kugel geht es direkt in Szene 2. phase MUSS hier
        // sofort umgestellt werden – sonst wäre dist immer noch <= nahDist und
        // dieser Block würde in der nächsten Frame gleich noch einmal starten.
        phase = 'intro';
        spaeter(szene2, PAUSE_VOR_STIMME_SEK);
      }
    }
  }

  // ─── 4. SZENE 2: Kopfdrehung wird zur Geschwindigkeit ───
  if (audioBereit && phase === 'fink') {
    // t beschreibt, wie weit rechts der Kopf steht: 0 = ganz links, 1 = ganz rechts.
    // yawFortlaufend statt yaw: Hinter dir hätte yaw eine Naht, und die Zeitlupe
    // würde dort auf volles Tempo umschlagen. So läuft der Wert einfach weiter,
    // und lerp unten begrenzt ihn – nach rechts bleibt es hinten bei fast
    // Stillstand stehen, nach links bei vollem Tempo.
    const t = (FINK_YAW_LINKS - yawFortlaufend) / (FINK_YAW_LINKS - FINK_YAW_RECHTS);

    // playbackRate wirkt wie eine Bandmaschine: langsamer UND tiefer.
    // Weil wir das jede Frame neu setzen, sind die Schritte so klein,
    // dass es sich stufenlos anfühlt.
    fink.tempo = lerp(1, FINK_MIN_TEMPO, t);
    fink.spieler.playbackRate = fink.tempo;

    // Das Natur-Bett macht dieselbe Bewegung mit. Alle 16 Ambisonics-Kanäle
    // werden gleich verlangsamt, deshalb bleiben die Richtungen erhalten.
    // natureFx bleibt bewusst UNANGETASTET – dieses zweite Bett soll normal
    // weiterlaufen, damit der Raum in der Zeitlupe noch atmet.
    if (nature2.quelle) nature2.quelle.playbackRate.value = lerp(1, NATUR_MIN_TEMPO, t);

    // Die Aufnahme ist 1.9 Sekunden lang, der Ruf steckt aber nur in den ersten
    // 0.3 Sekunden – danach kommt Stille. Je weiter rechts der Kopf steht, desto
    // früher springt der Loop zurück: die Rufe rücken zusammen und man hört die
    // versteckte Melodie dichter.
    const laenge = fink.spieler.buffer.duration;
    if (laenge > 0) fink.spieler.loopEnd = lerp(laenge, FINK_LOOP_KURZ, t);

    // Der Vogel schwebt immer FINK_ABSTAND Meter in Blickrichtung.
    // Das x wird negiert – wieder die gespiegelte Achse (siehe oben).
    fink.quelle.setPosition(
      -FINK_ABSTAND * blickX,
       FINK_ABSTAND * blickY,
       FINK_ABSTAND * blickZ
    );

    // Die Schluss-Ansage macht dieselbe Bewegung: Sie steht immer vorne, egal
    // wohin man sich gedreht hat. Genau dieselbe Rechnung wie beim Fink, nur
    // mit dem Abstand der Stimme (siehe stimmeFolgtKopf in TEIL 3).
    if (stimmeFolgtKopf) {
      stimmQuelle.setPosition(
        -STIMME_ABSTAND * blickX,
         STIMME_ABSTAND * blickY,
         STIMME_ABSTAND * blickZ
      );
    }
  }

  // ─── 5. SZENE 3: der Blick als Taschenlampe ───
  // Was im Lichtkegel liegt, fadet ein; alles andere klingt langsam aus.
  if (audioBereit && phase === 'musik') {
    for (const instrument of orchester) {
      // Wieder die Multiplikation zweier Pfeile (siehe Szene 1), diesmal in
      // alle drei Richtungen – dadurch findet man auch das Klavier über sich.
      // Das Minus vor blickX ist die gespiegelte Achse: nach rechts schauen
      // soll Cello und Gitarre treffen.
      const aehnlichkeit = -blickX * instrument.x + blickY * instrument.y + blickZ * instrument.z;

      // Math.cos rechnet die Kegelbreite in denselben Vergleichswert um:
      // beam 25 Grad → alles über cos(25°) = 0.906 liegt im Kegel.
      const imKegel = aehnlichkeit > Math.cos(instrument.beam * Math.PI / 180);

      // Der Pegel wandert zum Ziel – hoch geht schnell, runter langsam.
      if (imKegel) {
        instrument.pegel = Math.min(1, instrument.pegel + deltaZeit / ANSCHAU_SEK);
      } else {
        instrument.pegel = Math.max(0, instrument.pegel - deltaZeit / AUSKLING_SEK);
      }

      // Pegel (0…1) in Dezibel: 1 → 0 dB, 0.5 → -6 dB, fast 0 → ganz aus.
      if (instrument.pegel > 0.001) {
        instrument.lautstaerke.volume.value = 20 * Math.log10(instrument.pegel);
      } else {
        instrument.lautstaerke.volume.value = -Infinity;
      }
    }
  }

  // ─── 6. Die kleine Anzeige oben in der Ecke (nur zum Entwickeln) ───
  // Ganz oben die laufende Zeit seit dem Aufsetzen, in Sekunden mit einer
  // Nachkommastelle. Damit kann man beim Testen sagen "der Swoosh kommt bei
  // 8.5, er müsste bei 6" – und genau diese Zahl steht dann in TEIL 2.
  const zeit = startZeit === 0 ? 0 : (performance.now() - startZeit) / 1000;
  const angezeigteKugel = phase === 'kugel2' ? kugel2 : kugel1;
  document.getElementById('hud').innerHTML =
    `zeit &nbsp;${zeit.toFixed(1)} s<br>` +
    `yaw &nbsp;&nbsp;${yaw.toFixed(2)} / ${yawFortlaufend.toFixed(2)}<br>` +
    `pitch ${pitch.toFixed(2)}<br>` +
    `phase ${phase}<br>` +
    `KH &nbsp;&nbsp;&nbsp;${kopfhoererAuf ? 'auf' : 'ab'}<br>` +
    `dist &nbsp;${angezeigteKugel.dist.toFixed(2)} m<br>` +
    `naehe ${anzeigeNaehe.toFixed(2)}<br>` +
    `zone &nbsp;${anzeigeZone}<br>` +
    `lfo &nbsp;&nbsp;${anzeigeFlatterHz.toFixed(1)} Hz<br>` +
    `tempo ${fink.tempo.toFixed(2)}<br>` +
    `ctx &nbsp;&nbsp;${audioCtx ? audioCtx.state : '–'}`;

  // ─── 7. Bild zeichnen und das nächste anfordern – das ist die Schleife ───
  kopf3d.render();
  window.requestAnimationFrame(tick);
}


// ═══════════════════════════════════════════════════════════════════════════
//  TEIL 9 – KOPFHÖRER AUF UND AB
//  In der Ausstellung gibt es keinen Startknopf: Die Experience beginnt, wenn
//  jemand den Kopfhörer aufsetzt, und stellt sich komplett zurück, wenn er
//  wieder abgelegt wird – bereit für den nächsten Besucher.
// ═══════════════════════════════════════════════════════════════════════════

let startWartet = false; // jemand hat aufgesetzt, während noch geladen wurde

function beiKopfhoererAuf() {
  console.log('Kopfhörer AUFGESETZT');

  if (!audioBereit) {
    console.warn('Audio lädt noch – die Experience startet automatisch, sobald fertig.');
    startWartet = true;
    return;
  }

  if (laeuft) return; // läuft schon – nichts doppelt starten

  laeuft = true;
  startZeit = performance.now(); // ab hier läuft die Uhr in der Anzeige
  document.getElementById('hint').classList.add('hidden');
  starteTick();

  // Jetzt erst einmal nichts. Die Person hat den Kopfhörer eben erst in der
  // Hand gehabt – sie rückt ihn zurecht, setzt sich hin, schaut nach vorne.
  //
  // ERST AM ENDE dieser Ruhe wird "geradeaus" festgelegt, und zwar aus den
  // letzten KALIBRIER_FENSTER_SEK Sekunden. Genau dann steht der Kopf am
  // ruhigsten, und der Nullpunkt liegt da, wo die Person wirklich hinschaut.
  // Würden wir gleich beim ersten Zucken messen, wäre "geradeaus" dort, wo
  // der Kopfhörer beim Aufsetzen gerade hinzeigte.
  spaeter(() => {
    if (!laeuft) return;
    setzeNullstellung();
    intro();
  }, START_VERZOEGERUNG_SEK);
}

// Der komplette Reset für den nächsten Besucher.
// Die Reihenfolge ist wichtig: ZUERST laeuft = false setzen, damit wartende
// Übergänge aus TEIL 7 keine neue Szene mehr starten können – und ERST DANN
// alles anhalten.
function beiKopfhoererAb() {
  console.log('Kopfhörer ABGELEGT – alles zurücksetzen');
  startWartet = false;
  if (!laeuft) return;

  laeuft = false;
  phase = 'warten';
  startZeit = 0; // Uhr anhalten

  // Alle noch offenen Timer löschen.
  for (const id of offeneTimer) clearTimeout(id);
  offeneTimer = [];

  // Alle Ansagen stoppen. Object.values() gibt alle Werte des Objekts als Liste.
  // Ein bereits gestoppter Player nimmt stop() klaglos hin.
  for (const einzelneStimme of Object.values(stimme)) einzelneStimme.stop();

  // Alles Ambisonische kurz ausfaden – auch einen Swoosh,
  // der gerade noch mitten im Übergang läuft.
  for (const bett of [nature1, nature2, natureFx, swooshIntro, swooshS2, erfolg1, erfolg2]) {
    stoppeBett(bett, 0.5);
  }

  // Die Kugeln: Klang aus, wieder weit weg, unsichtbar.
  // cancelScheduledValues bricht laufende Lautstärke-Fahrten ab – sonst würde
  // ein noch laufender Fade unseren Reset-Wert gleich wieder überschreiben.
  for (const kugel of [kugel1, kugel2]) {
    for (const regler of kugel.lautstaerken) {
      regler.volume.cancelScheduledValues(0);
      regler.volume.value = -Infinity;
    }
    for (const spieler of kugel.spieler) spieler.stop();

    kugel.fliegeLautstaerke.volume.cancelScheduledValues(0);
    kugel.fliegeLautstaerke.volume.value = -Infinity;
    kugel.fliegeRauschen.stop();
    kugel.fliegeTempoLfo.stop();
    kugel.blickDaempfung.volume.value = KUGEL_BLICK_DB_WEG;

    // Die Auftauch-Blende wieder ganz zu – die nächste Runde soll erneut aus
    // der Stille kommen und nicht dort weitermachen, wo diese aufgehört hat.
    kugel.auftauchBlende.volume.cancelScheduledValues(0);
    kugel.auftauchBlende.volume.value = -Infinity;
    kugel.auftauchen = false;

    kugel.dist  = DIST_FERN;
    kugel.tempo = 0.8;
    kugel.quelle.setPosition(kugel.richtung * DIST_FERN, 0, 0);
    kugel.kugel3d.visible = false;
  }

  // Der Fink: stoppen und den Geschwindigkeitsregler zurück auf Original.
  fink.spieler.stop();
  fink.spieler.playbackRate = 1;
  fink.lautstaerke.volume.cancelScheduledValues(0);
  fink.lautstaerke.volume.value = -Infinity;
  fink.tempo = 1;
  finkVorschau.spieler.stop(); // falls der Ruf gerade mitten in der Ansage lief

  // Der Musik-Raum: Basis und Instrumente stoppen, alle Pegel auf 0.
  basisSpieler.stop();
  basisLautstaerke.volume.cancelScheduledValues(0);
  basisLautstaerke.volume.value = -Infinity;
  for (const instrument of orchester) {
    instrument.spieler.stop();
    instrument.lautstaerke.volume.value = -Infinity;
    instrument.pegel = 0;
  }

  // Die Anzeigewerte zurücksetzen, sonst steht dort der letzte Stand.
  anzeigeNaehe     = 0;
  anzeigeFlatterHz = 0;
  anzeigeZone      = '–';

  // Die Stimme zurück nach vorne für den nächsten Durchlauf – und sie soll
  // dem Kopf nicht mehr folgen, falls mitten in der Schluss-Ansage abgesetzt
  // wurde.
  stimmeFolgtKopf = false;
  stimmQuelle.setPosition(0, 0, -STIMME_ABSTAND);

  const hinweis = document.getElementById('hint');
  hinweis.textContent = HINWEIS_TEXT;
  hinweis.classList.remove('hidden');
}


// ═══════════════════════════════════════════════════════════════════════════
//  TEIL 10 – HOCHFAHREN UND TASTEN ZUM TESTEN
// ═══════════════════════════════════════════════════════════════════════════

// In der Ausstellung startet Chrome mit einem besonderen Flag (siehe start.sh),
// dann darf Audio ohne Klick loslegen. Beim normalen Entwickeln blockiert der
// Browser das – dann ist der erste Klick oder Tastendruck der Auslöser.
initAudio()
  .then(() => starteTick()) // der Kopf ist sofort live, die Experience wartet
  .catch((fehler) => {
    console.warn('Automatischer Start nicht möglich – warte auf Klick oder Taste.', fehler);
  });

async function beimErstenKlick() {
  try {
    await initAudio();
    if (audioBereit) {
      window.removeEventListener('click', beimErstenKlick);
      window.removeEventListener('keydown', beimErstenKlick);
      starteTick();
    }
  } catch (fehler) {
    console.error('Fehler beim Audio-Start:', fehler);
  }
}
window.addEventListener('click', beimErstenKlick);
window.addEventListener('keydown', beimErstenKlick);

// Tasten zum Testen ohne AirPods:
//   r = aktuelle Kopfhaltung als "geradeaus" speichern
//   h = Kopfhörer aufsetzen bzw. ablegen simulieren
window.addEventListener('keydown', (ereignis) => {
  if (ereignis.key === 'r') setzeNullstellung();

  if (ereignis.key === 'h') {
    kopfhoererAuf = !kopfhoererAuf;
    if (kopfhoererAuf) {
      // Diese zwei Zeilen sind nötig, falls nebenbei die echte Bridge läuft:
      // sonst würde der AB_TIMEOUT die Simulation sofort wieder beenden.
      letzteBewegung = performance.now();
      vergleichsYaw = yaw;
      beiKopfhoererAuf();
    } else {
      beiKopfhoererAb();
    }
  }

  // "1" und "2" spielen die Erfolgsklänge allein ab – ohne die ausfadende
  // Kugel daneben. So hört man, wie sie wirklich im Raum stehen, statt sie über
  // dem Rest der Szene beurteilen zu müssen. Die Lautstärke ist dieselbe wie in
  // der Experience.
  if (ereignis.key === '1' && audioBereit) spieleBettEinmal(erfolg1, ERFOLG1_LAUTSTAERKE);
  if (ereignis.key === '2' && audioBereit) spieleBettEinmal(erfolg2, ERFOLG2_LAUTSTAERKE);

  // "e" liegt zusätzlich auf dem zweiten – er ist der, den man beim Einstellen
  // am häufigsten hört, und die Taste liegt bequemer als die Ziffer.
  if (ereignis.key === 'e' && audioBereit) spieleBettEinmal(erfolg2, ERFOLG2_LAUTSTAERKE);
});

// Mit "?auto" in der Adresszeile (http://localhost:3000/?auto) simulieren wir
// das Aufsetzen direkt nach dem Laden – praktisch zum schnellen Ausprobieren.
if (new URLSearchParams(location.search).has('auto')) {
  const warteAufAudio = setInterval(() => {
    if (audioBereit) {
      clearInterval(warteAufAudio);
      kopfhoererAuf = true;
      beiKopfhoererAuf();
    }
  }, 200);
}
