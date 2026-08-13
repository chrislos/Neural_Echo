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
#
# Der Wert hier ist nur die Vorgabe. Im Futurium stehen zwei Rechner mit je
# einem eigenen Kopfhoerer – dort steht die richtige Adresse in standort.conf
# (siehe standort.conf.beispiel), und die ueberschreibt diese Zeile gleich
# unten. So bleibt diese Datei auf beiden Rechnern identisch und "git pull"
# macht keinen Konflikt.
AIRPODS="70-F9-4A-94-0D-D5"

# Wie oft wird geprueft (Sekunden). 10 ist ein guter Kompromiss:
# schnell genug fuer Besucher, aber kein Dauerfeuer auf den Bluetooth-Stack.
INTERVALL=10

# Nach so vielen Fehlversuchen hintereinander wird die Pause laenger.
# Warum: liegen die AirPods im Tiefschlaf, hilft Wiederholen nicht – sie
# muessen erst bewegt werden. Dauerversuche wuerden nur den Akku leeren.
FEHLER_BIS_PAUSE=3
LANGE_PAUSE=60

# Waehrend einer solchen Pause wird trotzdem in diesem Takt (Sekunden) kurz
# nachgesehen, ob die AirPods inzwischen verbunden sind – dann bricht die Pause
# sofort ab.
#
# Warum das wichtig ist: die AirPods Max verbinden sich beim Aufsetzen oft VON
# SELBST wieder. Wuerde der Watchdog stur seine 60 Sekunden abwarten, laeuft das
# Intro laengst – mit der leisen Lautstaerke, die macOS sich fuer die AirPods
# gemerkt hat. Genau der leise Start, den wir vermeiden wollen.
#
# Das ist kein Widerspruch zu INTERVALL: --is-connected ist eine reine Abfrage,
# billig und ohne Funkverkehr. Teuer und akkufressend sind die VERBINDUNGS-
# VERSUCHE, und die bleiben so selten wie vorher.
VERBINDUNGS_PRUEFTAKT=2

# Auf diese Lautstaerke (0-100) wird die Systemausgabe erzwungen, solange die
# AirPods verbunden sind. Warum ueberhaupt noetig: macOS merkt sich pro Geraet
# eine eigene Lautstaerke und stellt sie manchmal erst ein paar Sekunden NACH
# dem Verbindungsaufbau wieder her – einmaliges Setzen direkt beim Connect
# reicht deshalb nicht, es muss immer wieder gesetzt werden.
LAUTSTAERKE_ZIEL=100

# Wie oft die Lautstaerke nachgesetzt wird (Sekunden). Bewusst viel haeufiger
# als INTERVALL: der Bluetooth-Check darf selten sein, die Lautstaerke muss
# schnell stimmen. Setzt sich ein Besucher direkt nach einem Reconnect die
# AirPods auf, faengt die Erfahrung sonst mit dem leisen Pegel an, den macOS
# sich fuer dieses Geraet gemerkt hat.
#
# Das kostet nichts: steht die Lautstaerke schon auf dem Ziel, passiert nichts –
# kein Klick, keine Unterbrechung, kein Rueckmeldeton.
#
# 0 schaltet das Nachsetzen ganz ab. Das braucht man beim Einpegeln von Hand,
# sonst dreht das Script sofort wieder hoch.
#
# Am besten ein Wert, durch den INTERVALL glatt teilbar ist – sonst wird die
# Wartezeit bis zur naechsten Verbindungspruefung etwas laenger (bei 3s: 12
# statt 10 Sekunden). Schadet nichts, ist nur gut zu wissen.
LAUTSTAERKE_INTERVALL=2

# ─────────────────────────────────────────────────────────────
# WAS AN DIESEM RECHNER ANDERS IST
# ─────────────────────────────────────────────────────────────

# $0 ist der Pfad zu diesem Script. Ueber seinen Ordner finden wir standort.conf
# und tools/ auch dann, wenn das Script aus einem anderen Verzeichnis aufgerufen
# wird.
EIGENER_ORDNER="$(cd "$(dirname "$0")" && pwd)"

# standort.conf liegt neben diesem Script und ist bewusst NICHT in git: Sie
# enthaelt die Werte, die sich von Rechner zu Rechner unterscheiden – fuer den
# Watchdog ist das die Bluetooth-Adresse des Kopfhoerers, der an dieser Station
# haengt. Der Punkt-Befehl liest die Datei so, als staende ihr Inhalt hier.
#
# Fehlt die Datei, bleibt es bei der Vorgabe oben und alles laeuft wie bisher.
if [ -f "$EIGENER_ORDNER/standort.conf" ]; then
  . "$EIGENER_ORDNER/standort.conf"
fi

# ─────────────────────────────────────────────────────────────
# HILFSMITTEL
# ─────────────────────────────────────────────────────────────

# Jede Meldung bekommt eine Uhrzeit – so laesst sich nach der Ausstellung
# nachvollziehen, wann die Verbindung wie oft abgerissen ist.
melde() {
  echo "[$(date '+%H:%M:%S')] [airpods] $1"
}

# Erzwingt die Ziel-Lautstaerke ueber osascript. Kein Fehler-Handling noetig:
# schlaegt es mal fehl (z.B. kein Login-Session-Kontext), wird es gleich
# ohnehin wieder versucht.
#
# Die zweite Zeile hebt eine Stummschaltung auf: "output volume 100" allein tut
# das NICHT, ein stummer Mac bliebe also stumm – und von aussen sieht das aus
# wie ein kaputter Kopfhoerer.
setze_lautstaerke() {
  osascript -e "set volume output volume $LAUTSTAERKE_ZIEL" \
            -e "set volume without output muted" >/dev/null 2>&1
}

# Wartet bis zur naechsten Verbindungspruefung und haelt dabei die Lautstaerke
# oben. Wird nur aufgerufen, wenn die AirPods verbunden sind – bei getrennten
# AirPods faellt die Ausgabe auf die eingebauten Lautsprecher zurueck, und die
# wuerden wir sonst auf volle Lautstaerke stellen.
warte_und_halte_lautstaerke() {
  if [ "$LAUTSTAERKE_INTERVALL" -le 0 ]; then
    sleep "$INTERVALL"
    return
  fi

  rest="$INTERVALL"
  while [ "$rest" -gt 0 ]; do
    setze_lautstaerke
    sleep "$LAUTSTAERKE_INTERVALL"
    rest=$((rest - LAUTSTAERKE_INTERVALL))
  done
}

# Wartet die uebergebene Zeit ab, bricht aber sofort ab, sobald die AirPods
# verbunden sind. Fuer alle Wartezeiten im GETRENNTEN Zustand – siehe
# VERBINDUNGS_PRUEFTAKT oben fuer das Warum.
#
# Die Lautstaerke wird hier absichtlich NICHT gesetzt: nach dem Abbruch geht es
# oben in der Schleife weiter, und der Verbunden-Zweig setzt sie als Erstes.
# So gibt es dafuer weiterhin genau eine Stelle.
warte_auf_verbindung() {
  # 0 heisst "nicht zwischendurch nachsehen" – und verhindert nebenbei eine
  # Schleife ohne Wartezeit, die einen Kern voll auslasten wuerde.
  if [ "$VERBINDUNGS_PRUEFTAKT" -le 0 ]; then
    sleep "$1"
    return
  fi

  rest_pause="$1"

  while [ "$rest_pause" -gt 0 ]; do
    sleep "$VERBINDUNGS_PRUEFTAKT"
    rest_pause=$((rest_pause - VERBINDUNGS_PRUEFTAKT))

    if [ "$("$BLUEUTIL" --is-connected "$AIRPODS")" = "1" ]; then
      return
    fi
  done
}

# ─────────────────────────────────────────────────────────────
# VORPRUEFUNG
# ─────────────────────────────────────────────────────────────

# Welche Adresse gilt jetzt eigentlich? Bei zwei Stationen mit zwei Kopfhoerern
# ist das die erste Frage, wenn einer nicht verbindet – also steht sie im Log.
melde "Kopfhoerer-Adresse: $AIRPODS"

# Welches blueutil benutzen wir? Bevorzugt die mitgelieferte Kopie in tools/,
# damit auf dem Ausstellungsrechner nichts installiert werden muss. Nur falls
# die fehlt oder nicht laeuft (z.B. Intel-Mac – die Kopie ist arm64), greifen
# wir auf ein per Homebrew installiertes blueutil zurueck.
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

melde "Watchdog laeuft. Verbindung alle ${INTERVALL}s, Lautstaerke alle ${LAUTSTAERKE_INTERVALL}s."

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

    # Warten bis zur naechsten Pruefung – und dabei laufend die Lautstaerke
    # nachsetzen, nicht nur einmal beim Connect (siehe LAUTSTAERKE_ZIEL oben).
    warte_und_halte_lautstaerke

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
      warte_und_halte_lautstaerke
    else
      fehler=$((fehler + 1))
      melde "Verbindung fehlgeschlagen (Versuch $fehler)."

      if [ "$fehler" -ge "$FEHLER_BIS_PAUSE" ]; then
        melde "Mehrfach fehlgeschlagen – AirPods schlafen vermutlich. Warte ${LANGE_PAUSE}s."
        melde "Tipp: AirPods einmal aufsetzen oder bewegen, dann wachen sie auf."
        warte_auf_verbindung "$LANGE_PAUSE"
        fehler=0
      fi

      # Getrennte AirPods: hier nur warten. Die Lautstaerke lassen wir in Ruhe,
      # solange der Ton auf den eingebauten Lautsprechern liegt.
      warte_auf_verbindung "$INTERVALL"
    fi
  fi
done
