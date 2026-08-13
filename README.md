# Neural Echo

Eine binaurale Hör-Erfahrung mit Headtracking. Man setzt Kopfhörer auf, dreht
den Kopf – und der Klang reagiert darauf, als stünde man wirklich in dem Raum.

Entstanden im Rahmen eines Kurses an der **Staatlichen Hochschule für Musik Trossingen**
für das **Futurium Berlin**. Der Code ist bewusst als Lehr-Codebase geschrieben:
deutsche Kommentare, die das WARUM erklären, flache Struktur, keine Abkürzungen...

In der Ausstellung läuft das Ganze ohne Personal: Der Rechner startet die
Experience beim Login von selbst, sie beginnt, sobald jemand den Kopfhörer
aufsetzt, und setzt sich beim Ablegen komplett zurück.

![Die Experience im Browser: der Drahtgitter-Kopf in der Mitte, rechts oben die
Kontrollanzeige](neural_echo/concept/screenshot.png)

Viel zu sehen gibt es absichtlich nicht – das Stück findet in den Ohren statt.
Der Drahtgitter-Kopf in der Mitte ist der eigene: Er dreht sich mit, und daran
erkennt man beim Aufbau sofort, ob das Headtracking sauber läuft.

Das Bild zeigt den **Entwickler-Blick** unter `localhost:3000`. In der
Ausstellung startet Chrome mit `--kiosk`, also ohne Fensterrahmen und
Adresszeile. Die Kontrollanzeige rechts oben steuert nichts, sie hilft beim
Einstellen – was die einzelnen Zeilen bedeuten, steht in der
[README der Web-App](neural_echo/README.md#tasten-und-anzeige).

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
  static/                  Klänge und Musik – NICHT im Repo, siehe unten
    voices/DE/             die deutschen Ansagen
    voices/EN/             dieselben Dateinamen auf Englisch
  standort.conf            was an DIESEM Rechner anders ist (Sprache, Kopfhörer)
  standort.conf.beispiel   die Vorlage dafür – standort.conf selbst ist nicht im Repo
  concept/
    skript.txt             das Skript: jeder Satz mit zugehöriger Audio-Datei
    scope.jpg              Konzeptskizze
    screenshot.png         die Experience im Browser (Bild in dieser README)
    spatial_audio.jpeg     das Ambisonics-Mikrofon im Feld (Bild in dieser README)
  start.sh                 startet die ganze Installation (Bridge, Watchdog, Vite, Chrome)
  watchdog_airpods.sh      verbindet die AirPods neu, wenn sie sich abschalten
  tools/blueutil           Bluetooth-Werkzeug für den Watchdog (arm64, liegt fertig dabei)
  headtracker_bridge/      die Swift-App (eigenes Xcode-Projekt, eigene CLAUDE.md)
```

---

## Wichtig: Die Audio-Dateien liegen NICHT im Repo

![Ein kugelförmiges Ambisonics-Mikrofon auf einem Stativ, mitten in einer hohen
Sommerwiese](neural_echo/concept/spatial_audio.jpeg)

So entstehen die **Ambisonics-Betten**: Ein Mikrofon mit Kapseln in alle
Richtungen nimmt nicht eine Blickrichtung auf, sondern den ganzen Raum auf
einmal. Beim Abspielen wird daraus zurückgerechnet, was an jedes Ohr gehört –
und weil das erst beim Hören passiert, dreht sich die Wiese mit, wenn man den
Kopf dreht. Genau das ist der Unterschied zu einer Stereo-Aufnahme, die immer
gleich bleibt, egal wohin man schaut.

Diese Betten liegen unter allem: die Wiese in Szene 1, die zwei Naturspuren in
Szene 2, die Swooshes und die Erfolgsklänge. Sie kommen aus keiner bestimmten
Richtung, sondern von überall – deshalb hört man sofort den Unterschied, wenn
danach eine einzelne Klangkugel aus genau einer Richtung auftaucht.

`*.wav` ist in der `.gitignore` ausgeschlossen – zusammen sind es rund
**850 MB**, davon allein 390 MB Ambisonics. Wer das Repo klont, bekommt Code,
aber keinen Ton.

Der Inhalt von `neural_echo/static/` muss also separat kopiert werden – und
zwar mitsamt dem Unterordner `voices/`, in dem die gesprochenen Ansagen liegen.
Welche Dateien gebraucht werden und wie sie heißen müssen, steht in
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

**5. `standort.conf` anlegen.** Darin steht, was diesen Rechner von den anderen
unterscheidet: die Sprachfassung und die Bluetooth-Adresse seines Kopfhörers.

```bash
cp standort.conf.beispiel standort.conf
./tools/blueutil --paired      # zeigt die Adresse des gekoppelten Kopfhörers
```

Dann die zwei Werte in `standort.conf` eintragen:

```sh
SPRACHE="DE"                     # DE oder EN
AIRPODS="70-F9-4A-94-0D-D5"      # die Adresse aus dem Befehl oben
```

Die Datei ist **nicht im Repo** (siehe `.gitignore`) – genau deshalb gibt es
sie: So laufen alle Rechner auf identischem Code, und `git pull` macht nirgends
einen Konflikt. Fehlt sie, läuft die deutsche Fassung mit der im Watchdog
hinterlegten Vorgabe-Adresse.

**6. Testlauf:**

```bash
./start.sh
```

Oben rechts im Bild steht `spr DE` bzw. `spr EN` – daran sieht man auf einen
Blick, ob die richtige Fassung läuft.

---

## Zwei Stationen: Deutsch und Englisch

Im Futurium stehen zwei Mac minis nebeneinander. Sie unterscheiden sich in
**genau zwei Dingen**, und beide stehen in `standort.conf`:

| | Station 1 | Station 2 |
|---|---|---|
| `SPRACHE` | `DE` | `EN` |
| `AIRPODS` | Adresse Kopfhörer 1 | Adresse Kopfhörer 2 |

Alles andere ist identisch – **derselbe Commit, derselbe Code**. Es gibt keinen
zweiten Branch und keine zweite `index.js`. Wer am Sounddesign arbeitet, ändert
es damit automatisch für beide Fassungen.

**Wie die Sprache in die App kommt:** `start.sh` liest `SPRACHE` aus
`standort.conf` und hängt sie an die Adresse an, mit der Chrome startet:

```
http://localhost:3000/?lang=EN
```

`src/index.js` liest den Parameter ganz oben in TEIL 1 aus und lädt die Ansagen
aus `static/voices/DE/` bzw. `static/voices/EN/`. Steht dort etwas Unbekanntes,
läuft die deutsche Fassung – ein Tippfehler legt die Ausstellung nicht lahm.

Zum Ausprobieren am eigenen Rechner braucht es keine `standort.conf`, es reicht
die Adresszeile: `http://localhost:3000/?lang=EN` (mit `&auto` startet die
Experience gleich mit).

**Was sich pro Sprache einstellen lässt**, steht gesammelt in der Tabelle
`SPRACHEN` in `src/index.js`, TEIL 1: der Ordner, drei Lautstärke-Korrekturen
für einzelne Ansagen und der Hinweistext auf dem Bildschirm. Mehr braucht es
nicht, weil der Ablauf fast überall am **Ende** einer Sprachdatei hängt und
nicht an festen Zeiten – ist eine englische Ansage länger, wartet die nächste
Szene von allein länger.

**Beim Koppeln aufpassen:** Jeden Kopfhörer nur mit *seinem* Rechner koppeln.
Ist ein Kopfhörer beiden Rechnern bekannt, holt ihn der Watchdog der anderen
Station im laufenden Betrieb zu sich herüber – mitten in der Experience.

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

**Das Fenster bleibt sichtbar:** launchd startet Scripte unsichtbar im
Hintergrund. Deshalb merkt `start.sh` selbst, dass es ohne Terminal läuft
(kein tty), und startet sich dann noch einmal in einem echten
Terminal-Fenster – so kann man sich per Bildschirmfreigabe draufschalten und
die Ausgabe live mitlesen. Das Chrome-Kiosk-Fenster liegt im Vollbild darüber,
im Ausstellungsbetrieb sieht man davon also nichts.

Der unsichtbare erste Aufruf bleibt dabei am Leben, solange das Fenster läuft,
und reicht dessen Exit-Code an launchd weiter – nur so greift der Neustart bei
einem Absturz. Klappt das Öffnen nicht (z.B. weil die Automation-Berechtigung
für Terminal fehlt – macOS fragt beim ersten Mal nach), läuft die Installation
wie früher unsichtbar weiter.

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
  erst Sekunden nach dem Verbinden wieder her. Deshalb wird die Lautstärke nicht
  nur einmal beim Verbinden gesetzt, sondern **alle 2 Sekunden** nachgezogen –
  in einem eigenen, schnelleren Takt als die Verbindungsprüfung. Sonst kann ein
  Besucher, der die gerade neu verbundenen Kopfhörer sofort aufsetzt, die ersten
  Sekunden zu leise hören. Eine Stummschaltung wird dabei mit aufgehoben.

  Der Takt steht im Watchdog bei `LAUTSTAERKE_INTERVALL`. **Beim Einpegeln von
  Hand auf 0 setzen** (oder den Watchdog beenden) – sonst dreht das Script jedes
  Leiserdrehen sofort wieder hoch. Die Lautstärke der App selbst ist davon nicht
  betroffen: der Watchdog fasst nur die Systemausgabe an, gemischt wird im
  Browser.

  Bei *getrennten* AirPods bleibt die Lautstärke unangetastet – der Ton liegt
  dann auf den eingebauten Lautsprechern, und die soll niemand auf 100 finden.

Das Werkzeug dahinter ist `blueutil` und liegt fertig in `tools/` – auf einem
Apple-Silicon-Mac ist nichts zu installieren. Auf einem Intel-Mac braucht es
`brew install blueutil`, die mitgelieferte Kopie ist arm64.

**Welchen Kopfhörer der Watchdog überwacht**, steht in `standort.conf` bei
`AIRPODS=` – pro Rechner ein anderer. Er schreibt die Adresse beim Start ins
Log; bei zwei Stationen ist das die erste Frage, wenn einer nicht verbindet.

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

Läuft alles im sichtbaren Terminal-Fenster (siehe oben), schreibt `start.sh`
seine Ausgabe zusätzlich per `tee` in `start.log` – im Fenster mitlesen und
hinterher nachlesen geht also beides.

---

## Wenn etwas nicht geht

| Symptom | Ursache | Was tun |
|---|---|---|
| Kein Ton, Seite lädt ewig | Die Audio-Dateien fehlen in `static/` | Dateien kopieren, siehe oben |
| Kopf auf dem Bildschirm bewegt sich nicht | Bridge lief beim Laden der Seite noch nicht | Bridge starten, **dann** die Seite neu laden – die WebSocket-Verbindung wird nur einmal aufgebaut |
| Bridge liefert keine Daten | Build nicht signiert oder Head-Pose-Entitlement fehlt | In Xcode Development Team setzen und neu bauen |
| „Geradeaus" ist schief | Kalibrierung erwischte eine Kopfbewegung | Taste `r` drückt eine neue Kalibrierung durch |
| AirPods immer wieder weg | Falsche Bluetooth-Adresse im Watchdog | `./tools/blueutil --paired` und `AIRPODS=` in `standort.conf` korrigieren |
| Kopfhörer wandert zur anderen Station | Er ist mit beiden Rechnern gekoppelt, der andere Watchdog holt ihn | Auf dem fremden Rechner die Kopplung entfernen |
| Falsche Sprache läuft | `standort.conf` fehlt oder `SPRACHE` ist falsch gesetzt | Datei anlegen bzw. korrigieren und `start.sh` neu starten; oben rechts steht `spr DE`/`spr EN` |
| Ton kommt aus den Mac-Lautsprechern | AirPods waren beim Start noch nicht als Ausgang bereit | Der Watchdog fängt das normalerweise ab; sonst Ausgabegerät von Hand umstellen |
| Nach einer Weile reagiert nichts mehr | Chrome hat gedrosselt (Fenster galt als verdeckt) | Prüfen, ob die `--disable-…`-Flags in `start.sh` noch da sind |
| Zeitlupe in Szene 2 hängt am Anschlag | Aussetzer in der Verbindung beim Drehen | Kopf zurückdrehen – `YAW_GRENZE` fängt das ab; sonst `r` |
| Beim Booten kommt kein Terminal-Fenster | Terminal darf nicht per Automation gesteuert werden | *Systemeinstellungen → Datenschutz → Automation* freigeben; die Installation läuft solange unsichtbar weiter (Ausgabe in `start.log`) |

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
