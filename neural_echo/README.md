# Neural Echo – die Web-App

Die komplette Hör-Experience aus [`concept/skript.txt`](concept/skript.txt) als
ein durchgehender Ablauf: Intro → Szene 1 (Klänge herbeilocken) → Szene 2
(Hausfink / Zeit verlangsamen) → Szene 3 (musikalischer Raum). Binaural über
Kopfhörer, gesteuert mit AirPods-Headtracking.

Diese Datei beschreibt den **Code**. Projektüberblick, Einrichtung eines neuen
Rechners und Ausstellungsbetrieb (Autostart, Watchdog, Troubleshooting) stehen
im [README im Repo-Root](../README.md).

---

## Starten

```bash
npm install     # einmalig
./start.sh      # Bridge + Watchdog + Vite + Chrome mit Autoplay-Flag
```

Zum reinen Entwickeln reicht `npm run dev` (Port 3000). Dann muss man im
Browser aber einmal klicken, bevor der Sound losgeht – Autoplay-Schutz –, und
die Headtracker-Bridge muss man selbst starten.

Die Audio-Dateien liegen **nicht im Repo** (`*.wav` ist ausgeschlossen, rund
850 MB). Ohne den Inhalt von `static/` läuft nichts, siehe
[Audio-Inventar](#audio-inventar).

## Tasten und Anzeige

| Taste / Parameter | Wirkung |
|---|---|
| `h` | Aufsetzen bzw. Ablegen simulieren – der ganze Ablauf ohne AirPods |
| `r` | Blickrichtung neu kalibrieren („geradeaus" neu setzen) |
| `1` / `2` | Erfolgsklang der ersten bzw. zweiten Kugel allein abspielen |
| `e` | dasselbe wie `2` – liegt bequemer, den hört man beim Einstellen am häufigsten |
| `?auto` in der Adresszeile | startet die Experience direkt nach dem Laden |

Oben in der Ecke steht eine kleine Anzeige, die beim Einstellen hilft. Sie
steuert nichts:

```
zeit    Sekunden seit dem Aufsetzen – damit lässt sich sagen
        „der Swoosh kommt bei 8.5, er müsste bei 6"
yaw     Blick links/rechts, als Winkel / als fortlaufender Wert (siehe TEIL 5)
pitch   Nicken
phase   welche Interaktion gerade gilt
KH      Kopfhörer auf oder ab
dist    Entfernung der aktuellen Kugel in Metern
naehe   0 = ganz weit weg, 1 = am Ohr
zone    1 fern / 2 mitte / 3 SOG – die drei Abschnitte der Annäherung
lfo     aktuelle Flatterrate der Fliege in Hz
tempo   Abspielgeschwindigkeit des Finken
ctx     Zustand der Audio-Zentrale (running / suspended)
```

## Ordnerstruktur

```
src/
  index.html   die Seite (Canvas + HUD)
  style.css    Styles
  index.js     der komplette Ablauf: Audio, Szenen, Interaktion, tick()
  3dhead.js    alles Sichtbare (Three.js: Drahtgitter-Kopf, Kugeln)
static/        Klänge und Musik, flach (Vite liefert den Ordner unter '/' aus)
  voices/DE/   die gesprochenen Ansagen – ein Ordner pro Sprachfassung
concept/       Skript und Konzeptskizze
```

## Wie `index.js` aufgebaut ist

Die Datei ist zum Lesen von oben nach unten gedacht und in nummerierte
TEIL-Abschnitte geteilt. Neuer Code gehört in den Teil, in den er inhaltlich
passt – nicht ans Ende:

```
TEIL 1   Die Audio-Dateien – alle Pfade an einer Stelle
TEIL 2   Einstellungen – jede Zahl, an der man dreht
TEIL 3   Variablen, die sich während der Experience verändern
TEIL 4   Werkzeugkasten – nur was wirklich überall gebraucht wird
TEIL 5   Headtracking – WebSocket, Kalibrierung, Kopfhörer-Erkennung
TEIL 6   Audio laden und verkabeln (initAudio)
TEIL 7   Der Ablauf – eine Funktion pro Szene
TEIL 8   Jede Frame – hier passiert die Interaktion (tick)
TEIL 9   Kopfhörer auf und ab – Start und kompletter Reset
TEIL 10  Hochfahren und Tasten zum Testen
```

Drei Regeln ziehen sich durch die ganze Datei:

1. **Geladen wird nur in TEIL 6, gespielt nur in TEIL 7 und 8.** Eine Datei
   mitten in einer Szene zu laden würde ruckeln.
2. **Es gibt genau eine Schleife** (`tick`, per `requestAnimationFrame`) und
   **eine Variable** (`phase`), die sagt, welche Interaktion gerade dran ist.
   `starteTick()` hat einen Schutz, damit nie zwei Loops parallel laufen.
3. **Eine Szene macht alles in ihrer eigenen Funktion.** Nur was wirklich
   überall gebraucht wird, steht im Werkzeugkasten – das ist Absicht, nicht
   Nachlässigkeit: Man soll beim Lesen nicht hin- und herspringen müssen.

Der Ablauf hängt so zusammen:

```
intro ─→ szene1Links ─→ [Kugel einfangen] ─→ szene1Rechts
                                                  │
                szene2 ←─ [Kugel einfangen] ←─────┘
                  │
                  └─→ szene2Ende ─→ szene3 ─→ Ende (Kopfhörer absetzen)
```

Übergänge laufen entweder über `spaeter(…)` (nach fester Zeit) oder über
`.onstop` (sobald eine Ansage fertig gesprochen ist). In **jedem** Übergang
steht `if (!laeuft) return;` – setzt jemand mitten in der Experience den
Kopfhörer ab, dürfen wartende Übergänge nichts mehr starten.

## Woraus eine Klangkugel besteht

Szene 1 ist der aufwendigste Teil. Jede Kugel hat **vier** Schichten, und nur
drei davon sind Aufnahmen:

| Schicht | Was | Wann hörbar |
|---|---|---|
| `distantLoop` | Aufnahme | immer, auch ganz weit weg |
| `middleLoop` | Aufnahme | ab 10 % Nähe |
| `nearLoop` | Aufnahme | ab 30 % Nähe – der Klang, für den die Sucherei gemacht wurde |
| „die Fliege" | **erzeugt**, nicht aufgenommen | durchgehend |

Die Fliege entsteht live in Tone.js: weißes Rauschen, das von einem Sägezahn
zerhackt wird – ein Flattern, wie ein Insekt, das um den Kopf kreist. Je näher
die Kugel kommt, desto schneller flattert es (1 → 8 Hz über drei Abschnitte),
und ein Tiefpass geht dabei auf, weil Fernes in echt auch dumpfer klingt.

Der wichtige Unterschied: Die drei Aufnahmen werden stark abgesenkt, solange
man geradeaus schaut – die Kugel versteckt sich, das Suchen ist die Aufgabe.
Die Fliege macht das **nicht** mit. Sie ist das Peilsignal; verstummte auch sie,
wüsste man gar nicht, wohin man sich drehen soll. Beim Wegschauen wird sie nur
träger, nicht leiser.

**Wie eine Kugel auftaucht.** Ganz am Ende der Kette, kurz vor dem Raum, sitzt
ein eigener Regler: die `auftauchBlende`. Sie fährt die **ganze** Kugel –
Aufnahmen und Fliege zusammen – über `EINFADE_SEK` aus der Stille hoch. In
dieser Zeit bleibt die Kugel stehen (`kugel.auftauchen`), der Blick zählt aber
schon: Wer bereits hinschaut, hört sie sanft kommen und kann sie danach sofort
holen. Deshalb steht die Blende ganz hinten und nicht auf einem einzelnen Loop
– die Blickdämpfung davor darf sich frei bewegen, ohne den Einsatz zu stören.

Ist eine Kugel eingefangen, legt sich ein **Erfolgsklang** über den ganzen Raum
– eine Ambisonics-Aufnahme, die deshalb aus keiner Richtung kommt, sondern von
überall. Das unterscheidet sie hörbar von allem, was man vorher suchen musste.
Jede Kugel hat ihren eigenen.

## Audio-Inventar

Alle Dateien liegen **flach** in `static/`, ohne Unterordner – so kann eine neu
geschnittene Aufnahme einfach über die alte kopiert werden, ohne dass im Code
etwas geändert werden muss. Die Szene steckt im Präfix des Dateinamens.

- `(mono)` = 1 Kanal, wird von Resonance an eine Stelle im Raum gesetzt
- `(ambiX)` = 16 Kanäle Ambisonics, eine Rundum-Aufnahme; läuft direkt in
  Resonance und nicht durch Tone.js

| Datei | Rolle |
|---|---|
| `intro_speech_(mono).wav` | Begrüßung |
| `intro_swoosh_(ambiX).wav` | öffnet den Raum, mitten in der Begrüßung |
| `s1_natureLoop_(ambiX).wav` | Wiese, Insekten – das Bett von Szene 1 |
| `s1_speech1_(mono).wav` | „Hey, hier bin ich…" – kommt von links |
| `s1_speech2_(mono).wav` | „Sehr gut. Jetzt dreh dich mal nach rechts…" – von rechts |
| `s1_ineractiveSound1_{distant,middle,near}Loop_(mono).wav` | die drei Schichten der **linken** Kugel |
| `s1_ineractiveSound2_{distant,middle,near}Loop_(mono).wav` | die drei Schichten der **rechten** Kugel |
| `s1_ineractiveSound1_success_(ambiX).wav` | Belohnung, linke Kugel eingefangen |
| `s1_ineractiveSound2_success_(ambiX).wav` | Belohnung, rechte Kugel eingefangen |
| `s2_swoosh_(ambiX).wav` | Übergang in Szene 2 |
| `s2_natureLoop_(ambiX).wav` | Bett Szene 2 – wird mit dem Finken verlangsamt |
| `s2_lowNatureFxLoop_(ambiX).wav` | zweites Bett Szene 2 – bleibt bewusst im Originaltempo |
| `s2_fink_(mono).wav` | Hausfink-Ruf, läuft als Loop |
| `s2_speech1_(mono).wav` | „Jetzt bist du ja schon Profi… / Wusstest du…" – von vorne |
| `s2_speech2_(mono).wav` | „Hier links hörst du…" – **kommt von links**, aus der Richtung des Vogels |
| `s2_speech3_(mono).wav` | „Hör zum Schluss noch mal…" |
| `s3_speech1_(mono).wav` | Ansage Szene 3; endet mit dem Schlusssatz (kein eigenes Outro) |
| `s3_musik_basis.wav` | Streicherfläche, unter allem |
| `s3_musik_cello/gitarre/klavier/floete/perkussion.wav` | die fünf Instrumente im Raum |

**Nicht geladene Dateien in `static/`:**

- `s3_speech2_(mono)_Vorschlag von Mathis.wav` – Alternative, wird nicht benutzt
- `static/Voices/` – Aufnahmen der verschiedenen Sprecherinnen und Sprecher
  (Anna GER/ENG, Joel, Mathis, Till) als Reservoir
- `static/_old/` – der ausgemusterte Prototyp-Satz
- `*.asd` – Wellenform-Caches von Ableton, ohne Bedeutung

## Woran man dreht

Alle Zahlen stehen gesammelt in **TEIL 2** von `src/index.js`. Die Klassiker:

| Was | Wo |
|---|---|
| Wie schnell eine Kugel kommt, wie eng man treffen muss | `KUGEL_TEMPO_*`, `BLICK_GENAUIGKEIT`, `KUGEL_SOG_AB` |
| Wie stark sich die Kugeln verstecken | `KUGEL_BLICK_DB_WEG`, `KUGEL_BLICK_SCHAERFE` |
| Die Fliege (Rate, Lautstärke, Filter, Hall) | alle `FLIEGE_*` |
| Lautstärke der Erfolgsklänge | `ERFOLG1_LAUTSTAERKE`, `ERFOLG2_LAUTSTAERKE` |
| Wie stark der Fink verlangsamt | `FINK_MIN_TEMPO`, `NATUR_MIN_TEMPO`, `FINK_LOOP_KURZ` |
| Wo die Instrumente hängen, wie breit ihr Kegel ist | das `orchester`-Array, `ORCH_ABSTAND` |
| Wie schnell Instrumente ein- und ausklingen | `ANSCHAU_SEK`, `AUSKLING_SEK` |
| Alle Timings der Übergänge | die `*_SEK`-Konstanten |
| Kopfhörer-Erkennung und Kalibrierung | `BEWEGUNGS_SCHWELLE`, `AB_TIMEOUT_MS`, `START_VERZOEGERUNG_SEK`, `KALIBRIER_FENSTER_SEK` |

Zwei Dinge, die beim Ändern gerne stolpern lassen:

- **Audio-X und Bild-X sind gespiegelt.** An drei Stellen wird die
  Blickrichtung deshalb auf X negiert (Kugel-Treffer, Position des Finken,
  Instrumenten-Scanner). Das ist richtig so und darf nicht „korrigiert" werden.
- **Betten rechnen mit Faktoren, nicht mit Dezibel.** `starteBett(…, 2.54)`
  heißt „2,54-mal so laut wie aufgenommen". Tone.js-Regler dagegen arbeiten in
  Dezibel. Die zwei nicht verwechseln.
