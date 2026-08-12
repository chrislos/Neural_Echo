# Neural Echo

Eine binaurale Hör-Erfahrung mit Headtracking. Man setzt Kopfhörer auf, dreht
den Kopf – und der Klang reagiert darauf, als stünde man wirklich in dem Raum.

Entstanden im Rahmen eines Kurses an der **Hochschule für Musik Trossingen**
für das **Futurium Berlin**. Der Code ist bewusst als Lehr-Codebase geschrieben:
deutsche Kommentare, die das WARUM erklären, flache Struktur, keine Abkürzungen –
Sechzehnjährige sollen ihn von oben nach unten lesen können.

In der Ausstellung läuft das Ganze ohne Personal: Der Rechner startet die
Experience beim Login von selbst, sie beginnt, sobald jemand den Kopfhörer
aufsetzt, und setzt sich beim Ablegen komplett zurück.

---

## Was passiert

| Abschnitt | Was zu hören ist | Was man tut |
|---|---|---|
| **Intro** | Eine Stimme begrüßt dich, ein Swoosh öffnet den Raum | zuhören |
| **Szene 1** | Zwei Klangkugeln liegen links und rechts | eine anschauen – sie kommt näher, bis sie „eingefangen" ist |
| **Szene 2** | Ein Hausfink zwitschert | den Kopf nach rechts drehen – die Zeit wird langsamer, Details im Gesang werden hörbar |
| **Szene 3** | Ein musikalischer Raum mit fünf Instrumenten | umschauen – wo du hinschaust, spielt ein Instrument |

Der genaue Text und welche Audio-Datei wo läuft, steht in
[`neural_echo/concept/skript.txt`](neural_echo/concept/skript.txt).

---

## Wie das Ganze zusammenhängt

```
   AirPods Max
        │  Bewegungsdaten (Core Motion)
        ▼
   headtracker_bridge          macOS-Menüleisten-App in Swift.
   (Swift, macOS)              Liest die Kopfdrehung aus und sendet sie
        │                      als JSON {"yaw","pitch","roll"} …
        │  WebSocket, Port 8080
        ▼
   Browser (Chrome)            … an die Web-App:
   src/index.js                Tone.js spielt die Dateien ab,
   ├─ Tone.js                  Resonance Audio setzt sie in den 3D-Raum,
   ├─ Resonance Audio          Three.js zeichnet den Drahtgitter-Kopf.
   └─ Three.js
        │  binaurales Stereo
        ▼
   AirPods Max
```

Warum ein Browser? Resonance Audio und Tone.js sind Web-Bibliotheken, und die
Web Audio API rechnet das binaurale Rendering in Echtzeit. Chrome wird deshalb
im Kiosk-Modus als Abspielgerät benutzt – der Besucher sieht davon nichts.

Warum eine eigene Swift-App dazwischen? Nur native macOS-Apps kommen über
`CMHeadphoneMotionManager` an die Bewegungsdaten der AirPods. Ein Browser kann
das nicht. Die Bridge ist der kleinstmögliche Übersetzer: AirPods rein,
WebSocket raus.

---

## Was wo liegt

```
README.md                  ← diese Datei: Projekt, Einrichtung, Ausstellungsbetrieb
neural_echo/
  README.md                die Web-App: starten, Tasten, Aufbau, Audio-Inventar
  CLAUDE.md                Konventionen für die Arbeit am Code
  src/
    index.html             die Seite (Canvas + HUD)
    style.css              Styles
    index.js               der komplette Ablauf: Audio, Szenen, Interaktion
    3dhead.js              alles Sichtbare (Three.js)
  static/                  ALLE Audio-Dateien – NICHT im Repo, siehe unten
  concept/
    skript.txt             das Skript: jeder Satz mit zugehöriger Audio-Datei
    scope.jpg              Konzeptskizze
  start.sh                 startet die ganze Installation (Bridge, Watchdog, Vite, Chrome)
  watchdog_airpods.sh      verbindet die AirPods neu, wenn sie sich abschalten
  tools/blueutil           Bluetooth-Werkzeug für den Watchdog (arm64, liegt fertig dabei)
  headtracker_bridge/      die Swift-App (eigenes Xcode-Projekt, eigene CLAUDE.md)
```

---

## Wichtig: Die Audio-Dateien liegen NICHT im Repo

`*.wav` ist in der `.gitignore` ausgeschlossen – zusammen sind es rund
**850 MB**, davon allein 390 MB Ambisonics. Wer das Repo klont, bekommt Code,
aber keinen Ton.

Der Inhalt von `neural_echo/static/` muss also separat kopiert werden. Welche
Dateien gebraucht werden und wie sie heißen müssen, steht in
[`neural_echo/README.md`](neural_echo/README.md#audio-inventar).

Das Gleiche gilt für gebaute Sachen: `node_modules/`, `dist/`, die fertige
`.app` der Bridge und die Laufzeit-Logs sind ebenfalls ausgeschlossen.

---

## Einen neuen Rechner einrichten

Gebraucht werden: **macOS 12 oder neuer**, **Xcode**, **Node.js**, **Google
Chrome** und **AirPods Max** (oder andere AirPods mit Headtracking).

**1. Repo holen und Abhängigkeiten installieren**

```bash
git clone <repo-url> Neural_Echo
cd Neural_Echo/neural_echo
npm install
```

**2. Audio-Dateien nach `neural_echo/static/` kopieren** – siehe oben.

**3. Die Bridge bauen.** `headtracker_bridge/headtracker_bridge.xcodeproj` in
Xcode öffnen, unter *Signing & Capabilities* das eigene Development Team
eintragen und bauen. Das Entitlement `com.apple.developer.coremotion.head-pose`
funktioniert **nur mit signiertem Build** – ohne Signatur kommen keine Daten.
Details in [`neural_echo/headtracker_bridge/CLAUDE.md`](neural_echo/headtracker_bridge/CLAUDE.md).

`start.sh` erwartet die fertige App unter
`headtracker_bridge/Debug/headtracker_bridge.app`. Wenn Xcode woanders hin
baut, entweder das Build-Ziel anpassen oder die App dorthin kopieren.

**4. AirPods koppeln** – einmal ganz normal über die Systemeinstellungen.

**5. Die Bluetooth-Adresse in den Watchdog eintragen.** Jedes Kopfhörer-Paar
hat seine eigene:

```bash
./tools/blueutil --paired
```

Die Adresse oben in `watchdog_airpods.sh` bei `AIRPODS=` eintragen.

**6. Testlauf:**

```bash
./start.sh
```

---

## Starten

```bash
cd neural_echo
./start.sh
```

`start.sh` fährt die komplette Installation hoch, und zwar in dieser Reihenfolge:

1. **Bridge starten** und warten, bis Port 8080 wirklich antwortet. Die
   Reihenfolge ist nicht beliebig: `index.js` baut die WebSocket-Verbindung nur
   **einmal beim Laden** auf. War die Bridge noch nicht da, bleibt das
   Headtracking für die ganze Sitzung tot.
2. **Watchdog** im Hintergrund (verbindet die AirPods neu, siehe unten).
3. **`caffeinate`**, damit Bildschirm und Rechner nicht einschlafen – nur
   solange das Script läuft, nicht dauerhaft global.
4. **Vite-Dev-Server** auf Port 3000.
5. **Chrome im Kiosk-Modus** mit `--autoplay-policy=no-user-gesture-required`,
   damit der Ton ohne Klick losgeht, und mit abgeschalteter
   Hintergrund-Drosselung (dazu unten mehr).

Beendet man das Script (Cmd+Q in Chrome oder Strg+C), räumt es alle
Hintergrund-Prozesse wieder ab.

**Zum Entwickeln** reicht `npm run dev`. Dann muss man im Browser aber einmal
klicken, bevor der Sound startet – das ist der Autoplay-Schutz. Und die Bridge
muss man selbst starten, sonst gibt es keine Kopfdrehung.

---

## Ausstellungsbetrieb

### Kopfhörer auf und ab

Es gibt keinen Startknopf. Die Experience beginnt **beim Aufsetzen** und setzt
sich **beim Ablegen komplett zurück** – bereit für den nächsten Besucher.

Erkannt wird das an der Bewegung: Wer den Kopfhörer trägt, bewegt den Kopf
immer ein kleines bisschen. Hängt er am Haken, ist das Signal still. Nach fünf
Sekunden ohne Bewegung gilt er als abgelegt.

Beim Aufsetzen bleibt es erst vier Sekunden still – die Person rückt den
Kopfhörer zurecht und schaut nach vorne –, und **erst dann** wird die aktuelle
Blickrichtung als „geradeaus" gemessen. Würde man gleich beim ersten Zucken
messen, wäre „geradeaus" dort, wo der Kopfhörer beim Aufsetzen gerade hinzeigte.

Die Stellschrauben dafür (`BEWEGUNGS_SCHWELLE`, `AB_TIMEOUT_MS`,
`START_VERZOEGERUNG_SEK`, `KALIBRIER_FENSTER_SEK`) stehen in `src/index.js`,
TEIL 2.

### Automatischer Start beim Login

Ein LaunchAgent unter `~/Library/LaunchAgents/com.neuralecho.start.plist`
startet `start.sh` beim Login und wieder neu, falls es abstürzt. Er liegt
absichtlich nicht im Repo, weil absolute Pfade darin stehen. So sieht er aus:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.neuralecho.start</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/PFAD/ZU/neural_echo/start.sh</string>
    </array>

    <!-- launchd hat ein minimales PATH ohne /usr/local/bin, wo node/npm liegen. -->
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <!-- Nur bei Absturz neu starten, nicht bei normalem Beenden. -->
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>

    <key>StandardOutPath</key>
    <string>/PFAD/ZU/neural_echo/start.log</string>
    <key>StandardErrorPath</key>
    <string>/PFAD/ZU/neural_echo/start-error.log</string>

    <key>WorkingDirectory</key>
    <string>/PFAD/ZU/neural_echo</string>
</dict>
</plist>
```

Alle vier `/PFAD/ZU/`-Stellen auf den echten Ordner setzen, dann:

```bash
launchctl load   ~/Library/LaunchAgents/com.neuralecho.start.plist   # aktivieren
launchctl unload ~/Library/LaunchAgents/com.neuralecho.start.plist   # abschalten
```

Damit das überhaupt greift, muss der Ausstellungsrechner sich beim Hochfahren
automatisch anmelden (*Systemeinstellungen → Benutzer → Automatische Anmeldung*).

### Der AirPods-Watchdog

`watchdog_airpods.sh` läuft die ganze Zeit mit und löst zwei Probleme, die in
einer unbeaufsichtigten Ausstellung sonst den Betrieb beenden:

- **Die AirPods Max schalten sich nach einer Weile ohne Bewegung selbst ab.**
  Der Watchdog prüft alle 10 Sekunden, ob sie verbunden sind, und verbindet
  sonst neu. Nach drei Fehlversuchen wartet er 60 Sekunden – liegen die
  Kopfhörer im Tiefschlaf, hilft Wiederholen nicht, sie müssen erst bewegt
  werden.
- **macOS merkt sich pro Gerät eine eigene Lautstärke** und stellt sie manchmal
  erst Sekunden nach dem Verbinden wieder her. Deshalb wird die Lautstärke bei
  *jeder* Prüfung neu gesetzt, nicht nur einmal beim Verbinden.

Das Werkzeug dahinter ist `blueutil` und liegt fertig in `tools/` – auf einem
Apple-Silicon-Mac ist nichts zu installieren. Auf einem Intel-Mac braucht es
`brew install blueutil`, die mitgelieferte Kopie ist arm64.

### Warum Chrome bestimmte Flags bekommt

Wird der Monitor kurz stromlos (Kabel raus, Bildschirmschoner des Monitors),
hält macOS das Chrome-Fenster für verdeckt. Chrome drosselt dann von sich aus
`requestAnimationFrame` und Timer, um Strom zu sparen – und genau darauf läuft
die ganze Interaktion. Die Kopfdrehung käme weiter per WebSocket an, würde aber
nicht mehr verarbeitet. Die drei `--disable-…backgrounding/-throttling`-Flags in
`start.sh` schalten das ab.

### Logs

`start.log` und `start-error.log` liegen im `neural_echo`-Ordner und sind aus
dem Repo ausgeschlossen – reine Betriebsdaten. Jede Watchdog-Meldung hat eine
Uhrzeit, damit man nach der Ausstellung nachvollziehen kann, wann die
Verbindung wie oft abgerissen ist.

---

## Wenn etwas nicht geht

| Symptom | Ursache | Was tun |
|---|---|---|
| Kein Ton, Seite lädt ewig | Die Audio-Dateien fehlen in `static/` | Dateien kopieren, siehe oben |
| Kopf auf dem Bildschirm bewegt sich nicht | Bridge lief beim Laden der Seite noch nicht | Bridge starten, **dann** die Seite neu laden – die WebSocket-Verbindung wird nur einmal aufgebaut |
| Bridge liefert keine Daten | Build nicht signiert oder Head-Pose-Entitlement fehlt | In Xcode Development Team setzen und neu bauen |
| „Geradeaus" ist schief | Kalibrierung erwischte eine Kopfbewegung | Taste `r` drückt eine neue Kalibrierung durch |
| AirPods immer wieder weg | Falsche Bluetooth-Adresse im Watchdog | `./tools/blueutil --paired` und `AIRPODS=` korrigieren |
| Ton kommt aus den Mac-Lautsprechern | AirPods waren beim Start noch nicht als Ausgang bereit | Der Watchdog fängt das normalerweise ab; sonst Ausgabegerät von Hand umstellen |
| Nach einer Weile reagiert nichts mehr | Chrome hat gedrosselt (Fenster galt als verdeckt) | Prüfen, ob die `--disable-…`-Flags in `start.sh` noch da sind |
| Zeitlupe in Szene 2 hängt am Anschlag | Aussetzer in der Verbindung beim Drehen | Kopf zurückdrehen – `YAW_GRENZE` fängt das ab; sonst `r` |

---

## Weiterlesen

- [`neural_echo/README.md`](neural_echo/README.md) – die Web-App: Tasten, HUD,
  Aufbau von `index.js`, Audio-Inventar, die wichtigsten Stellschrauben
- [`neural_echo/CLAUDE.md`](neural_echo/CLAUDE.md) – Konventionen für die Arbeit
  am Code
- [`neural_echo/headtracker_bridge/CLAUDE.md`](neural_echo/headtracker_bridge/CLAUDE.md)
  – Aufbau der Swift-App
- [`neural_echo/concept/skript.txt`](neural_echo/concept/skript.txt) – das
  Skript mit allen Texten, Dateinamen und Längen
