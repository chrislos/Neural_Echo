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
//  Alle Aufnahmen liegen flach in static/ – ein Ordner, keine Unterordner.
//  Der Server bietet diesen Ordner unter '/' an: aus
//  static/intro_speech_(mono).wav wird '/intro_speech_(mono).wav'.
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

const DATEIEN = {
  introStimme: '/intro_speech_(mono).wav',
  introSwoosh: '/intro_swoosh_(ambiX).wav',

  s1Natur:   '/s1_natureLoop_(ambiX).wav',
  s1Stimme1: '/s1_speech1_(mono).wav', // "…dreh deinen Kopf nach links"
  s1Stimme2: '/s1_speech2_(mono).wav', // "…jetzt nach rechts"
  // s1_speech3 ("Jetzt bist du ja schon Profi…") gibt es nicht mehr als eigene
  // Datei – der Satz steckt jetzt vorne in s2_speech1. Die alte Datei liegt
  // noch in static/, wird aber nirgends mehr geladen.

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

  s2Swoosh:  '/s2_swoosh_(ambiX).wav',
  s2Natur:   '/s2_natureLoop_(ambiX).wav',      // wird mit-verlangsamt
  s2NaturFx: '/s2_lowNatureFxLoop_(ambiX).wav', // bleibt normal schnell
  s2Fink:    '/s2_fink_(mono).wav',
  s2Stimme1: '/s2_speech1_(mono).wav', // "Wusstest du, dass…"
  s2Stimme2: '/s2_speech2_(mono).wav', // "Hör zum Schluss noch mal…"

  s3Stimme1:    '/s3_speech1_(mono).wav',
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
const DIST_NAH          = 1;   // Meter: ab hier gilt sie als eingefangen
                               // (Standardwert – die linke Kugel bleibt etwas
                               //  weiter weg, siehe kugel1.nahDist in TEIL 3)
const BLICK_GENAUIGKEIT = 0.8; // wie genau man treffen muss (1 = haargenau)
const RUECKZUG_TEMPO    = 1;   // Meter pro Sekunde: so schnell weicht sie zurück
const EINFADE_SEK       = 2;   // Sekunden: so sanft taucht eine Kugel auf
const AUSFADE_SEK       = 1.5; // Sekunden: so sanft verschwindet sie beim Einfangen

// ─── Szene 2: der Hausfink ───
// Der Kopf wird zum Regler: ganz links = normales Tempo,
// ganz rechts = stark verlangsamt (und dadurch tiefer, wie eine Bandmaschine).
const FINK_YAW_LINKS  =  Math.PI / 2; // +90 Grad = ganz links
const FINK_YAW_RECHTS = -Math.PI / 2; // -90 Grad = ganz rechts
const FINK_MIN_TEMPO  = 0.15; // langsamster Punkt: 15 % Geschwindigkeit
const NATUR_MIN_TEMPO = 0.1;  // das Natur-Bett wird noch etwas stärker gebremst
const FINK_ABSTAND    = 2;    // Meter: so weit vor den Augen schwebt der Vogel
const FINK_LOOP_KURZ  = 0.4;  // Sekunden: kürzeste Loop-Länge (siehe TEIL 8)

// Der kurze Vorgeschmack mitten in der Ansage. Die Sekunde bezieht sich auf
// den Start von s2_speech1: Dort sagt die Sprecherin "Hier links hörst du
// einen kurzen Ausschnitt vom Gesang des Hausfinken" – und genau in der
// Sprechpause danach zwitschert er einmal.
const FINK_VORSCHAU_SEK      = 27; // Sekunde in s2_speech1
const FINK_VORSCHAU_ABSTAND  = 2;  // Meter links vom Hörer

// ─── Szene 3: der musikalische Raum ───
// Jedes Instrument hängt in einer Richtung im Raum. Zwei Winkel beschreiben sie:
//    azimut = links/rechts   (0 = geradeaus, + = rechts, − = links)
//    hoehe  = oben/unten     (0 = auf Ohrhöhe, 90 = senkrecht über dir)
// "beam" ist die Breite des Bereichs, in dem das Instrument angeht – wie der
// Lichtkegel einer Taschenlampe. "pegel" ist die aktuelle Lautstärke von
// 0 (stumm) bis 1 (voll); die rechnet TEIL 8 jede Frame neu aus.
//
// Warum das Klavier auf 60 statt 90 Grad hängt: Niemand legt den Kopf senkrecht
// nach oben. Bei 60 Grad reicht ein deutliches Nicken – und es klingt trotzdem
// eindeutig von oben.
const orchester = [
  { name: 'cello',      datei: DATEIEN.s3Cello,      azimut:  80, hoehe:  0, beam: 25, pegel: 0 },
  { name: 'gitarre',    datei: DATEIEN.s3Gitarre,    azimut:  40, hoehe:  0, beam: 25, pegel: 0 },
  { name: 'klavier',    datei: DATEIEN.s3Klavier,    azimut:   0, hoehe: 60, beam: 40, pegel: 0 },
  { name: 'floete',     datei: DATEIEN.s3Floete,     azimut: -40, hoehe:  0, beam: 25, pegel: 0 },
  { name: 'perkussion', datei: DATEIEN.s3Perkussion, azimut: -80, hoehe:  0, beam: 25, pegel: 0 },
];
const ORCH_ABSTAND = 6;   // Meter: so weit weg stehen die Instrumente
const ANSCHAU_SEK  = 2.5; // Sekunden: so schnell fadet ein Instrument ein
const AUSKLING_SEK = 5;   // Sekunden: so langsam klingt es wieder aus

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
                                   // 2 Sekunden früher los (siehe TEIL 9).
const S2_SWOOSH_NACH_SEK    = 36.5; // In Szene 2 wechselt der Raum ERST, wenn
                                    // die ganze Ansage gesprochen ist. Sie ist
                                    // ja selbst die Überleitung: Sie beginnt
                                    // noch in Szene 1 ("Jetzt bist du ja schon
                                    // Profi…") und endet mit "…dreh deinen Kopf
                                    // langsam nach rechts". Der Swoosh setzt in
                                    // der Schlusspause ein (ab 36,5 s), kurz
                                    // bevor der Fink zu hören ist.
const PAUSE_VOR_LINKS_SEK   = 9.8; // Ruhe, bevor die Stimme von links spricht.
                                   // So lang, weil der Intro-Swoosh 9 Sekunden
                                   // dauert: erst wenn der ganz durch ist, sagt
                                   // sie "Hey, hier bin ich" (Uhr ca. 19 s).
const PAUSE_VOR_STIMME_SEK  = 1.5; // Ruhe vor den übrigen Ansagen
const FINK_SPIELZEIT_SEK    = 25;  // freies Ausprobieren, dann kommt die Ansage
const FINK_ENDE_PAUSE_SEK   = 15;  // Pause nach "…eine ganze Melodie steckt?" –
                                   // lang genug, um die Melodie im Fink wirklich
                                   // zu suchen, bevor Szene 3 übernimmt
const SZENE3_FADE_SEK       = 5;   // Überblendung von Szene 2 nach Szene 3
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

const HINWEIS_TEXT = 'setz die Kopfhörer auf … · h = simulieren · r = reset';


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

// Wann wurde der Kopfhörer aufgesetzt? Daraus rechnet die Anzeige in TEIL 8
// die laufende Zeit aus – so kann man beim Testen genau sagen, bei welcher
// Sekunde etwas zu früh oder zu spät kommt. 0 heißt: läuft gerade nicht.
let startZeit = 0;

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
//   pegel:    Korrektur in Dezibel (negativ = leiser)
//   tempo:    wie schnell sie näher kommt (wird nah am Kopf kleiner)
//   spieler:  die drei Loops, lautstaerken: je ein Lautstärke-Regler dazu
//
// Warum die linke Kugel eigene Werte hat: Ihre Aufnahme drückt deutlich mehr
// als die rechte. Sie bleibt deshalb einen Schritt weiter weg (1.8 statt 1
// Meter) und läuft 6 dB leiser – sonst kippt sie einem am Ende ins Ohr.
const kugel1 = { richtung: -1, dist: DIST_FERN, nahDist: 1.8, pegel: -6, tempo: 0.8, kugel3d: null, quelle: null, spieler: [], lautstaerken: [] };
const kugel2 = { richtung:  1, dist: DIST_FERN, nahDist: DIST_NAH, pegel: 0, tempo: 0.8, kugel3d: null, quelle: null, spieler: [], lautstaerken: [] };

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

// Dasselbe für die Swooshes: einmal durchlaufen lassen, ohne Loop und ohne
// Fade – ein Übergangsgeräusch soll ja sofort da sein.
function spieleBettEinmal(bett) {
  const jetzt = audioCtx.currentTime;

  bett.quelle = audioCtx.createBufferSource();
  bett.quelle.buffer = bett.buffer;
  bett.quelle.connect(bett.gain);

  bett.gain.gain.cancelScheduledValues(jetzt);
  bett.gain.gain.setValueAtTime(1, jetzt);
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
  stimme.s2Fink   = new Tone.Player(DATEIEN.s2Stimme1).connect(stimmQuelle.input);
  stimme.s2Ende   = new Tone.Player(DATEIEN.s2Stimme2).connect(stimmQuelle.input);
  stimme.s3       = new Tone.Player(DATEIEN.s3Stimme1).connect(stimmQuelle.input);

  // Die Ansage von links stand früher näher am Ohr als die anderen und war
  // deshalb 3 dB abgesenkt. Seit alle Ansagen STIMME_ABSTAND Meter entfernt
  // sind, gilt das nicht mehr – jetzt darf sie sogar etwas drüber liegen,
  // weil sie von der Seite kommt und dort weniger präsent wirkt.
  stimme.s1Links.volume.value = 1;

  // ─── Die fünf Ambisonics-Dateien ───
  // Bewusst NACHEINANDER (jedes await wartet auf das vorherige): zusammen sind
  // das rund 400 MB, alles gleichzeitig auszupacken würde den Speicher sprengen.
  await ladeBett(swooshIntro, DATEIEN.introSwoosh);
  await ladeBett(nature1,     DATEIEN.s1Natur);
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
    kugel.kugel3d = kopf3d.macheKugel();

    for (const url of dateiListe) { // Reihenfolge: fern → mittel → nah
      const regler = new Tone.Volume(-Infinity);
      regler.connect(kugel.quelle.input);
      kugel.lautstaerken.push(regler);
      kugel.spieler.push(new Tone.Player({ url, loop: true }).connect(regler));
    }
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
    instrument.spieler = new Tone.Player({ url: instrument.datei, loop: true, volume: -6 })
      .connect(instrument.lautstaerke);
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

      // Die Kugel taucht auf: erst steht sie still ganz weit weg und ihr
      // Fern-Loop fadet hoch – ERST DANN darf TEIL 8 sie auf den Blick
      // reagieren lassen (phase = 'kugel1').
      kugel1.dist = DIST_FERN;
      kugel1.quelle.setPosition(kugel1.richtung * DIST_FERN, 0, 0);
      kugel1.kugel3d.position.set(kugel1.richtung * DIST_FERN, 0, 0);
      kugel1.kugel3d.visible = true;

      for (const spieler of kugel1.spieler) spieler.start();
      kugel1.lautstaerken[0].volume.rampTo(0, EINFADE_SEK);

      spaeter(() => {
        if (laeuft) phase = 'kugel1';
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
      kugel2.lautstaerken[0].volume.rampTo(0, EINFADE_SEK);

      spaeter(() => {
        if (laeuft) phase = 'kugel2';
      }, EINFADE_SEK);
    };
  }, PAUSE_VOR_STIMME_SEK);
}

// SZENE 2 – der Hausfink.
// Die Ansage s2_speech1 ist EINE lange Datei, die noch in Szene 1 anfängt
// ("Jetzt bist du ja schon Profi im Klänge herbeilocken…") und dann zum
// Hausfink überleitet. Deshalb läuft sie hier von Anfang bis Ende durch, und
// der Raum wechselt MITTENDRIN: nach S2_SWOOSH_NACH_SEK, genau in der
// Sprechpause vor "Wusstest du, dass…". Dasselbe Prinzip wie beim Intro.
//
// Der Fink kommt noch später – erst wenn die Stimme ganz fertig ist. Er soll
// nicht in die Ansage hineinzwitschern. Ab da übersetzt TEIL 8 jede
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

  spaeter(() => {
    if (!laeuft) return;
    spieleBettEinmal(swooshS2);
    stoppeBett(nature1, 4);
    // Die Wiese in Szene 2 steht doppelt so laut wie die aus Szene 1 (0.9):
    // Sie wird ja gleich mit dem Fink verlangsamt und ist dann das eigentliche
    // Klangereignis, nicht nur Hintergrund.
    starteBett(nature2, 4, 1.8);
    starteBett(natureFx, 4, 0.45);
  }, S2_SWOOSH_NACH_SEK);

  // "Hier links hörst du einen kurzen Ausschnitt vom Gesang des Hausfinken."
  // Genau in der Sprechpause nach diesem Satz kommt der Ruf einmal von links –
  // im Originaltempo, damit man gleich hört, wie er sich später verändert.
  spaeter(() => {
    if (!laeuft) return;
    finkVorschau.spieler.start();
  }, FINK_VORSCHAU_SEK);

  stimme.s2Fink.start();
  stimme.s2Fink.onstop = () => {
    if (!laeuft) return;

    fink.spieler.playbackRate = 1; // sicherheitshalber im Originaltempo starten
    fink.spieler.start();
    fink.lautstaerke.volume.rampTo(2, 1.5);

    phase = 'fink'; // jetzt erst wird der Kopf zum Geschwindigkeitsregler

    spaeter(szene2Ende, FINK_SPIELZEIT_SEK); // erst frei ausprobieren lassen
  };
}

// SZENE 2 ENDE – "Hör zum Schluss noch mal genauer hin…"
function szene2Ende() {
  if (!laeuft) return;
  console.log('SZENE 2 – Ende');

  stimme.s2Ende.start();
  stimme.s2Ende.onstop = () => {
    if (!laeuft) return;
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
  basisLautstaerke.volume.rampTo(-24, SZENE3_FADE_SEK);
  for (const instrument of orchester) instrument.spieler.start();

  phase = 'musik';

  // Die Ansage endet mit "Wenn du genug gehört hast, darfst du deine Kopfhörer
  // wieder absetzen" – danach kommt nichts mehr. Die Szene läuft weiter, bis
  // der Kopfhörer tatsächlich abgelegt wird (siehe TEIL 9).
  stimme.s3.start();
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
    const schautHin = blickX * -kugel.richtung > BLICK_GENAUIGKEIT;

    // Hinschauen zieht die Kugel heran, Wegschauen lässt sie zurückweichen.
    if (schautHin) {
      kugel.dist = Math.max(kugel.nahDist, kugel.dist - kugel.tempo * deltaZeit);
    } else {
      kugel.dist = Math.min(DIST_FERN, kugel.dist + RUECKZUG_TEMPO * deltaZeit);
    }

    // Klang und sichtbarer Punkt wandern gemeinsam.
    kugel.quelle.setPosition(kugel.richtung * kugel.dist, 0, 0);
    kugel.kugel3d.position.set(kugel.richtung * kugel.dist, 0, 0);

    // naehe: 0 = ganz weit weg, 1 = so nah wie diese Kugel kommen darf.
    const naehe = 1 - (kugel.dist - kugel.nahDist) / (DIST_FERN - kugel.nahDist);

    // Die drei Loops kommen nacheinander dazu: der Fern-Loop ist immer zu
    // hören, der mittlere ab 10 % Nähe, der nahe ab 30 %. Die Werte sind
    // Dezibel: 0 = laut, -30 = sehr leise, -Infinity = ganz aus.
    // kugel.pegel kommt überall dazu – damit lässt sich eine ganze Kugel
    // leiser stellen, ohne die Kurven anzufassen (siehe TEIL 3).
    kugel.lautstaerken[0].volume.value = -6 * naehe + kugel.pegel;

    if (naehe > 0.1) kugel.lautstaerken[1].volume.value = lerp(-30, -6, (naehe - 0.1) / 0.75) + kugel.pegel;
    else             kugel.lautstaerken[1].volume.value = -Infinity;

    if (naehe > 0.3) kugel.lautstaerken[2].volume.value = lerp(-30, -6, (naehe - 0.3) / 0.45) + kugel.pegel;
    else             kugel.lautstaerken[2].volume.value = -Infinity;

    // Kurz vor dem Ziel wird die Kugel langsamer. So ist das Ankommen spürbar,
    // ohne dass man ewig warten muss.
    if (naehe > 0.8)      kugel.tempo = 0.3;
    else if (naehe > 0.6) kugel.tempo = 0.7;
    else                  kugel.tempo = 0.8;

    // Angekommen? Dann ist sie eingefangen. (Einen extra Erfolgs-Ton gibt es
    // nicht – die Belohnung ist der Nah-Loop, den man kurz vorher in voller
    // Lautstärke hört.)
    //
    // Sie wird NICHT hart abgeschaltet, sondern fadet über AUSFADE_SEK aus:
    // ein abruptes Abreißen klingt nach Fehler, ein Ausklingen nach "gefangen".
    // Die nächste Szene wird trotzdem sofort angestoßen – sie beginnt mit ihrer
    // eigenen Pause, die Stimme setzt also genau dann ein, wenn der Klang weg
    // ist. Und weil die Szene phase sofort umstellt, rechnet der Block hier
    // oben nicht mehr gegen den Fade an.
    if (kugel.dist <= kugel.nahDist) {
      for (const regler of kugel.lautstaerken) regler.volume.rampTo(-Infinity, AUSFADE_SEK);

      spaeter(() => {
        for (const spieler of kugel.spieler) spieler.stop();
        kugel.kugel3d.visible = false;
      }, AUSFADE_SEK);

      if (phase === 'kugel1') {
        szene1Rechts(); // stellt phase selbst um
      } else {
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
    const t = (FINK_YAW_LINKS - yaw) / (FINK_YAW_LINKS - FINK_YAW_RECHTS);

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
    `yaw &nbsp;&nbsp;${yaw.toFixed(2)}<br>` +
    `pitch ${pitch.toFixed(2)}<br>` +
    `phase ${phase}<br>` +
    `KH &nbsp;&nbsp;&nbsp;${kopfhoererAuf ? 'auf' : 'ab'}<br>` +
    `dist &nbsp;${angezeigteKugel.dist.toFixed(2)} m<br>` +
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
  for (const bett of [nature1, nature2, natureFx, swooshIntro, swooshS2]) {
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

  // Die Stimme zurück nach vorne für den nächsten Durchlauf.
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
