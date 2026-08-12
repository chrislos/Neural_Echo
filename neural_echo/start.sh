#!/bin/bash
# Startet den Vite-Dev-Server UND öffnet Chrome mit Autoplay-Flag (kein Klick nötig).
# Aufruf:  ./start.sh   (im neural_echo-Ordner)

# In den Ordner wechseln, in dem dieses Script liegt – egal von wo man es aufruft.
cd "$(dirname "$0")"

# headtracker_bridge zuerst starten: das ist die App, die die Kopfdrehung der
# AirPods per WebSocket auf Port 8080 anbietet. Sie MUSS laufen, bevor Chrome
# die Seite laedt – src/index.js baut die WebSocket-Verbindung naemlich nur
# EINMAL beim Laden auf und versucht es bei einem Fehlschlag nie wieder. War
# die Bridge noch nicht bereit, bleibt das Headtracking fuer die ganze
# Sitzung tot, bis man die Seite von Hand neu laedt.
#
# "open -a" oeffnet die App und kehrt sofort zurueck (im Gegensatz zu einem
# direkten Aufruf der Bridge wuerde das Script sonst hier haengen bleiben).
open -a "$(pwd)/headtracker_bridge/Debug/headtracker_bridge.app"

# Jetzt warten, bis Port 8080 wirklich antwortet, statt blind eine feste
# Anzahl Sekunden zu schlafen – so dauert der Start nie laenger als noetig,
# ist aber trotzdem sicher, egal wie lange die Bridge zum Hochfahren braucht.
echo "Warte auf headtracker_bridge (Port 8080) …"
for i in $(seq 1 30); do
  if (exec 3<>/dev/tcp/localhost/8080) 2>/dev/null; then
    exec 3<&- 3>&-
    echo "headtracker_bridge ist bereit."
    break
  fi
  sleep 1
done

# Watchdog im Hintergrund: verbindet die AirPods Max neu, wenn sie sich
# selbst abschalten. Laeuft die ganze Zeit mit (siehe watchdog_airpods.sh).
./watchdog_airpods.sh &
WATCHDOG_PID=$!

# Verhindert, dass Bildschirm/System/Platte schlafen – nur solange dieses
# Script laeuft (im Gegensatz zu "pmset -a displaysleep 0", was dauerhaft
# global gilt, auch wenn gar keine Ausstellung laeuft). -d Display, -i Idle-
# Sleep des Systems, -s System-Sleep am Netzteil, -m Platte.
caffeinate -d -i -s -m &
CAFFEINATE_PID=$!

# Vite-Dev-Server im Hintergrund starten und seine Prozess-ID merken.
npm run dev &
VITE_PID=$!

# Wenn das Script endet – egal ob normal oder per Strg+C – muessen alle
# Hintergrund-Prozesse mit weg. Sonst laufen nach dem Schliessen von Chrome
# noch Watchdog, Caffeinate und Server weiter und der naechste Start
# scheitert am Port (bzw. der Mac schlaeft nie wieder ein).
aufraeumen() {
  kill $WATCHDOG_PID $CAFFEINATE_PID $VITE_PID 2>/dev/null
}
trap aufraeumen EXIT

# Kurz warten, bis der Server wirklich oben ist.
sleep 2

# Chrome mit Autoplay-Flag und eigenem Profil starten.
#  --autoplay-policy=no-user-gesture-required → Sound darf ohne Klick starten
#  --user-data-dir=...                        → eigenes Profil (NICHT in /tmp, sonst nach Neustart weg)
#  --no-first-run / --no-default-browser-check → kein Begruessungs-/Standardbrowser-Dialog
#
# Die drei --disable-...backgrounding/-throttling Flags sind wichtig fuer die
# Ausstellung: wird der Monitor kurz stromlos (Kabel raus, Bildschirmschoner
# des Monitors o.ae.), haelt macOS das Chrome-Fenster fuer "verdeckt" und
# Chrome drosselt dann von sich aus requestAnimationFrame und Timer, um
# Akku/CPU zu sparen. Genau darauf laeuft tick() (TEIL 8) – die Kopfdrehung
# kommt zwar weiter per WebSocket an, wird aber nicht mehr verarbeitet, bis
# das Fenster wieder Fokus bekommt. Die Flags schalten diese Drosselung ab.
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --autoplay-policy=no-user-gesture-required \
  --user-data-dir="$HOME/.kiosk-profile" \
  --no-first-run \
  --no-default-browser-check \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-background-timer-throttling \
  --kiosk \
  http://localhost:3000
  # --kiosk = für die Ausstellung: Vollbild ohne Browser-UI. Zum Beenden Cmd+Q.
  #           Zum Entwickeln die Zeile einfach auskommentieren.

# Wenn Chrome geschlossen wird, läuft das Script hier weiter – aufraeumen()
# (siehe trap oben) beendet dann Vite und den Watchdog.
