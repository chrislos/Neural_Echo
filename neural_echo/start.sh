#!/bin/bash
# Startet den Vite-Dev-Server UND öffnet Chrome mit Autoplay-Flag (kein Klick nötig).
# Aufruf:  ./start.sh   (im neural_echo-Ordner)

# In den Ordner wechseln, in dem dieses Script liegt – egal von wo man es aufruft.
cd "$(dirname "$0")"

# ── Sichtbares Fenster beim Autostart ────────────────────────────────────────
# Beim Booten startet der LaunchAgent dieses Script unsichtbar im Hintergrund;
# man sieht die Ausgabe dann nur in start.log. Fuer die Fehlersuche aus der
# Ferne (Bildschirmfreigabe) ist ein echtes Terminal-Fenster viel praktischer.
# Also: laeuft das Script OHNE Terminal (also ohne tty auf der Ausgabe), dann
# startet es sich selbst noch einmal in einem sichtbaren Terminal-Fenster.
# Ruft man es von Hand auf, ist ja schon ein Terminal da – dann passiert hier
# nichts und es laeuft ganz normal weiter.
STATUS_DATEI="/tmp/neural_echo_start.status"

if [ ! -t 1 ] && [ -z "$IM_TERMINAL" ]; then
  rm -f "$STATUS_DATEI"

  # "do script" oeffnet ein neues Terminal-Fenster und tippt den Befehl hinein.
  # IM_TERMINAL=1 verhindert, dass sich das Script dort sofort wieder selbst
  # startet. Der Exit-Code wird in die STATUS_DATEI geschrieben, damit wir ihn
  # unten an launchd weiterreichen koennen – nur so greift dessen
  # "neu starten, wenn es abstuerzt".
  if osascript >/dev/null <<APPLESCRIPT
    tell application "Terminal"
      activate
      do script "cd '$(pwd)' && IM_TERMINAL=1 ./start.sh; echo \$? > '$STATUS_DATEI'"
    end tell
APPLESCRIPT
  then
    # Warten, bis das Fenster-Script fertig ist (laeuft also die ganze
    # Ausstellung lang). Solange bleibt auch dieser Starter am Leben – launchd
    # sieht den Job dadurch als "laeuft" und startet ihn nicht ein zweites Mal.
    while [ ! -f "$STATUS_DATEI" ] && pgrep -x Terminal >/dev/null; do
      sleep 5
    done
    # Keine Status-Datei? Dann wurde das Terminal beendet, ohne dass das Script
    # sauber durchgelaufen ist – als Fehler melden, damit launchd neu startet.
    exit "$(cat "$STATUS_DATEI" 2>/dev/null || echo 1)"
  fi

  # Kein Terminal-Fenster moeglich (z.B. fehlende Automation-Berechtigung):
  # dann lieber unsichtbar weiterlaufen als die Ausstellung gar nicht starten.
  echo "Terminal-Fenster konnte nicht geoeffnet werden – laufe unsichtbar weiter."
fi

# Im Terminal-Fenster zusaetzlich alles in start.log mitschreiben. Beim
# unsichtbaren Start hat das der LaunchAgent erledigt; jetzt geht die Ausgabe
# ins Fenster und waere nach dem Schliessen weg.
if [ -n "$IM_TERMINAL" ]; then
  exec > >(tee -a start.log) 2>&1
fi

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
