# Neural Echo

Die komplette Hör-Experience aus `skript.txt` – Intro, Szene 1 (Klänge
herbeilocken), Szene 2 (Hausfink / Zeit verlangsamen) und Szene 3
(musikalischer Raum) – als ein durchgehender Ablauf. Binaural über Kopfhörer,
gesteuert mit AirPods-Headtracking.

## Starten

1. Die Headtracker-Bridge starten (Xcode-Projekt `headtracker_bridge` im
   Repo-Root) – sie sendet die AirPods-Winkel über WebSocket auf Port 8080.
2. Im `neural_echo`-Ordner:

```
npm install     # einmalig
./start.sh      # startet Vite + Chrome mit Autoplay-Flag
```

Ohne `start.sh` geht auch `npm run dev` – dann muss man im Browser einmal
klicken, bevor der Sound losgeht (Autoplay-Schutz des Browsers).

## Kopfhörer auf / ab (Installations-Modus)

Die Experience startet **automatisch beim Aufsetzen** der Kopfhörer und setzt
sich **komplett zurück beim Ablegen** – bereit für den nächsten Besucher.

Die Erkennung funktioniert über Bewegung: Wer den Kopfhörer trägt, bewegt den
Kopf immer minimal. Hängt er am Haken, ist das Signal still → nach
`AB_TIMEOUT` (5 s) ohne Bewegung gilt er als abgelegt. Beim Aufsetzen wird
außerdem die aktuelle Blickrichtung als "geradeaus" kalibriert.

Stellschrauben in `index.js`: `BEWEGUNGS_SCHWELLE` und `AB_TIMEOUT`.

Tasten zum Entwickeln:
- `h` = Aufsetzen/Ablegen simulieren (ohne AirPods testen)
- `r` = Blickrichtung neu kalibrieren ("geradeaus" neu setzen)
- URL-Parameter `?auto` = startet die Experience direkt nach dem Laden

## Ordnerstruktur

```
src/
  index.html   – die Seite (Canvas + HUD)
  style.css    – Styles
  index.js     – der komplette Ablauf: Audio, Szenen, Interaktion, tick()
  3dhead.js    – alles Sichtbare (Three.js: Drahtgitter-Kopf, Kugeln)
static/        – alle Audio-Dateien (Vite liefert sie unter '/' aus)
```

## Wie der Code aufgebaut ist

- **`initAudio()` lädt, die `szene…()`-Funktionen spielen.** Alles wird einmal
  beim Start geladen und verkabelt; die Szenen starten dann nur noch Player
  und Fades.
- **Eine `phase`-Variable** (`intro`, `kugel1`, `kugel2`, `fink`, `musik`)
  sagt dem `tick()`, welche Interaktion gerade gilt.
- **Genau EIN `tick()`-Loop** (requestAnimationFrame) kümmert sich um
  Kopfdrehung, Interaktion, HUD und Rendern. `starteTick()` hat einen Schutz,
  damit nie zwei Loops parallel laufen.

## Audio-Dateien (static/)

| Datei | Rolle |
|---|---|
| `voice_*.wav` | Sprecherin, je Szenenabschnitt eine Datei |
| `swoosh.wav` | Übergangs-Sound |
| `nature_ambix.wav` | Natur-Bett Szene 1 (Ambisonics, 16 Kanäle) |
| `lowNature_ambix.wav` | Natur-Bett Szene 2, wird beim Kopfdrehen verlangsamt |
| `kugel1_layer1–3.wav` | die 3 Klang-Schichten der linken Kugel |
| `kugel2_layer1–3.wav` | die 3 Schichten der rechten Kugel |
| `fink.wav` | Hausfink-Ruf (Loop) |
| `success.wav` | Kugel eingefangen |
| `musik_basis.wav` | Grundfläche Szene 3 |
| `musik_cello/gitarre/klavier/floete.wav` | die Instrumente im Halbkreis |

## Was noch fehlt / Platzhalter

- **Perkussion (Szene 3):** im Skript vorgesehen, Audio existiert noch nicht.
  Sobald es da ist: Datei als `musik_perkussion.wav` in `static/` legen und in
  `index.js` im `orchester`-Array als 5. Eintrag ergänzen.
- **`kugel2_layer1–3.wav`:** aktuell die Platzhalter-Layer aus dem Prototyp
  (LayerB), noch nicht der finale zweite Interaktions-Sound.
- **Die `voice_*`-Dateien für Szene 1b/2/3** sind aus `master.wav`
  (dem Gesamtmix) geschnitten – unter der Stimme liegt also leise das
  Klangbett des Prototyps. Sobald die trockenen Sprachaufnahmen da sind,
  einfach die Dateien gleichen Namens in `static/` ersetzen.
