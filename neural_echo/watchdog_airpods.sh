#!/bin/bash
# Watchdog fuer die AirPods Max.
#
# Warum das noetig ist: die AirPods Max schalten sich nach einer Weile ohne
# Bewegung selbst ab und trennen die Bluetooth-Verbindung. In der Ausstellung
# steht niemand daneben, der sie neu verbindet – also macht das dieses Script.
#
# Es prueft alle paar Sekunden, ob die Kopfhoerer verbunden sind, und
# verbindet sie sonst neu. start.sh startet es im Hintergrund mit.
#
# Das Werkzeug dahinter ist blueutil und liegt fertig in tools/ –
# auf einem Apple-Silicon-Mac ist also nichts zu installieren.

# ─────────────────────────────────────────────────────────────
# EINSTELLUNGEN – hier drehen, sonst nirgends
# ─────────────────────────────────────────────────────────────

# Bluetooth-Adresse der AirPods Max.
# ACHTUNG beim Rechner- oder Kopfhoererwechsel: das sind konkrete Geraete,
# jedes Paar hat seine eigene Adresse. Neue herausfinden mit:
#     ./tools/blueutil --paired
AIRPODS="70-F9-4A-94-0D-D5"

# Wie oft wird geprueft (Sekunden). 10 ist ein guter Kompromiss:
# schnell genug fuer Besucher, aber kein Dauerfeuer auf den Bluetooth-Stack.
INTERVALL=10

# Nach so vielen Fehlversuchen hintereinander wird die Pause laenger.
# Warum: liegen die AirPods im Tiefschlaf, hilft Wiederholen nicht – sie
# muessen erst bewegt werden. Dauerversuche wuerden nur den Akku leeren.
FEHLER_BIS_PAUSE=3
LANGE_PAUSE=60

# Auf diese Lautstaerke (0-100) wird die Systemausgabe erzwungen, solange die
# AirPods verbunden sind. Warum ueberhaupt noetig: macOS merkt sich pro Geraet
# eine eigene Lautstaerke und stellt sie manchmal erst ein paar Sekunden NACH
# dem Verbindungsaufbau wieder her – einmaliges Setzen direkt beim Connect
# reicht deshalb nicht, es muss bei jeder Pruefung erneut gesetzt werden.
LAUTSTAERKE_ZIEL=100

# ─────────────────────────────────────────────────────────────
# HILFSMITTEL
# ─────────────────────────────────────────────────────────────

# Jede Meldung bekommt eine Uhrzeit – so laesst sich nach der Ausstellung
# nachvollziehen, wann die Verbindung wie oft abgerissen ist.
melde() {
  echo "[$(date '+%H:%M:%S')] [airpods] $1"
}

# Erzwingt die Ziel-Lautstaerke ueber osascript. Kein Fehler-Handling noetig:
# schlaegt es mal fehl (z.B. kein Login-Session-Kontext), wird es bei der
# naechsten Pruefung ohnehin wieder versucht.
setze_lautstaerke() {
  osascript -e "set volume output volume $LAUTSTAERKE_ZIEL" >/dev/null 2>&1
}

# ─────────────────────────────────────────────────────────────
# VORPRUEFUNG
# ─────────────────────────────────────────────────────────────

# Welches blueutil benutzen wir? Bevorzugt die mitgelieferte Kopie in tools/,
# damit auf dem Ausstellungsrechner nichts installiert werden muss. Nur falls
# die fehlt oder nicht laeuft (z.B. Intel-Mac – die Kopie ist arm64), greifen
# wir auf ein per Homebrew installiertes blueutil zurueck.
#
# $0 ist der Pfad zu diesem Script. Ueber seinen Ordner finden wir tools/
# auch dann, wenn das Script aus einem anderen Verzeichnis aufgerufen wird.
EIGENER_ORDNER="$(cd "$(dirname "$0")" && pwd)"
BLUEUTIL="$EIGENER_ORDNER/tools/blueutil"

if ! "$BLUEUTIL" --version >/dev/null 2>&1; then
  BLUEUTIL="$(command -v blueutil)"
fi

if [ -z "$BLUEUTIL" ]; then
  melde "Kein lauffaehiges blueutil gefunden."
  melde "tools/blueutil ist arm64 – auf einem Intel-Mac:  brew install blueutil"
  exit 1
fi

# Bluetooth kann komplett aus sein – dann hilft kein Verbinden.
if [ "$("$BLUEUTIL" --power)" = "0" ]; then
  melde "Bluetooth war aus, schalte es ein."
  "$BLUEUTIL" --power 1
  sleep 2
fi

# Sind die AirPods ueberhaupt mit diesem Mac gekoppelt? Ohne Kopplung kann
# das Script nichts tun – dann muss einmal von Hand ueber die
# Systemeinstellungen gekoppelt werden.
if ! "$BLUEUTIL" --paired | grep -qi "$AIRPODS"; then
  melde "AirPods ($AIRPODS) sind mit diesem Mac nicht gekoppelt."
  melde "Einmal in den Systemeinstellungen koppeln, dann laeuft der Rest automatisch."
  exit 1
fi

melde "Watchdog laeuft. Pruefe alle ${INTERVALL}s."

# ─────────────────────────────────────────────────────────────
# DIE SCHLEIFE
# ─────────────────────────────────────────────────────────────

fehler=0          # wie viele Versuche hintereinander schiefgingen
war_verbunden=1   # damit die erste Meldung nur bei echtem Problem kommt

while true; do

  if [ "$("$BLUEUTIL" --is-connected "$AIRPODS")" = "1" ]; then

    # Alles gut. Nur melden, wenn sich der Zustand geaendert hat –
    # sonst laeuft das Log in der Ausstellung mit tausend Zeilen voll.
    if [ "$war_verbunden" = "0" ]; then
      melde "Verbindung steht wieder."
    fi
    war_verbunden=1
    fehler=0

    # Bei jeder Pruefung erneut setzen, nicht nur einmal beim Connect – siehe
    # Begruendung bei LAUTSTAERKE_ZIEL weiter oben.
    setze_lautstaerke

  else

    if [ "$war_verbunden" = "1" ]; then
      melde "Verbindung weg – versuche neu zu verbinden."
    fi
    war_verbunden=0

    # --connect wartet von sich aus, bis die Verbindung steht oder es
    # aufgibt (dauert im Fehlerfall rund 20 Sekunden), und meldet das
    # Ergebnis ueber seinen Exit-Code. Deshalb reicht dieser eine Aufruf.
    if "$BLUEUTIL" --connect "$AIRPODS" >/dev/null 2>&1; then
      melde "Verbunden."
      war_verbunden=1
      fehler=0
      # Kurz Luft lassen: macOS braucht einen Moment, bis die AirPods als
      # Audio-Ausgang bereitstehen. Ohne das spielt der Ton kurz ueber die
      # eingebauten Lautsprecher.
      sleep 3
      setze_lautstaerke
    else
      fehler=$((fehler + 1))
      melde "Verbindung fehlgeschlagen (Versuch $fehler)."

      if [ "$fehler" -ge "$FEHLER_BIS_PAUSE" ]; then
        melde "Mehrfach fehlgeschlagen – AirPods schlafen vermutlich. Warte ${LANGE_PAUSE}s."
        melde "Tipp: AirPods einmal aufsetzen oder bewegen, dann wachen sie auf."
        sleep "$LANGE_PAUSE"
        fehler=0
      fi
    fi
  fi

  sleep "$INTERVALL"
done
