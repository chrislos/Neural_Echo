#!/bin/bash
# Startet den Vite-Dev-Server UND öffnet Chrome mit Autoplay-Flag (kein Klick nötig).
# Aufruf:  ./start.sh   (im Sonar_Levels-Ordner)

# In den Ordner wechseln, in dem dieses Script liegt – egal von wo man es aufruft.
cd "$(dirname "$0")"

# Vite-Dev-Server im Hintergrund starten und seine Prozess-ID merken.
npm run dev &
VITE_PID=$!

# Kurz warten, bis der Server wirklich oben ist.
sleep 2

# Chrome mit Autoplay-Flag und eigenem Profil starten.
#  --autoplay-policy=no-user-gesture-required → Sound darf ohne Klick starten
#  --user-data-dir=/tmp/kiosk-profile         → eigenes Profil, damit das Flag sicher greift
#  --kiosk (auskommentiert)                   → Vollbild fuer die Ausstellung
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --autoplay-policy=no-user-gesture-required \
  --user-data-dir=/tmp/kiosk-profile \
  --kiosk \
  http://localhost:3000

# Wenn Chrome geschlossen wird, laeuft das Script hier weiter und beendet auch Vite.
kill $VITE_PID
