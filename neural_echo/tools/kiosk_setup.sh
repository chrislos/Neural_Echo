#!/bin/bash
#
# kiosk_setup.sh — Mac mini für Dauerbetrieb / Kiosk-Modus konfigurieren
#
#   sudo ./scripts/kiosk_setup.sh          # anwenden
#   sudo ./scripts/kiosk_setup.sh --undo   # Standardwerte zurücksetzen
#
# Kein nächtlicher Auto-Restart, kein Auto-Login (ist bereits eingerichtet).
# Einzelne pmset-Keys existieren nicht auf jeder Hardware/macOS-Version —
# solche Aufrufe werden abgefangen und nur als "übersprungen" gemeldet.

set -u

UNDO=0
[ "${1:-}" = "--undo" ] && UNDO=1

if [ "$(id -u)" -ne 0 ]; then
  echo "Bitte mit sudo starten:  sudo $0 ${1:-}" >&2
  exit 1
fi

# Eingeloggter Desktop-User (nicht root) — für die per-User defaults
CONSOLE_USER=$(stat -f "%Su" /dev/console)
as_user() { sudo -u "$CONSOLE_USER" "$@" >/dev/null 2>&1 || echo "  (übersprungen: $*)"; }
try() { "$@" >/dev/null 2>&1 || echo "  (übersprungen: $*)"; }

echo "==> Konfiguriere Kiosk-Modus für User: $CONSOLE_USER"

if [ "$UNDO" -eq 0 ]; then

  echo "==> 1/6  Energie: kein Sleep, kein Ruhezustand"
  try pmset -a sleep 0            # System schläft nie
  try pmset -a displaysleep 0     # Display bleibt an
  try pmset -a disksleep 0        # Festplatte bleibt wach
  try pmset -a hibernatemode 0    # kein Ruhezustand / kein Sleepimage
  try pmset -a standby 0
  try pmset -a autopoweroff 0
  try pmset -a powernap 0
  try pmset -a proximitywake 0    # kein Aufwecken durch iPhone/Watch
  try pmset -a ttyskeepawake 1
  try systemsetup -setcomputersleep Never

  echo "==> 2/6  Neustart nach Stromausfall und nach Systemhänger"
  try pmset -a autorestart 1
  try systemsetup -setrestartpowerfailure on
  try systemsetup -setrestartfreeze on
  try nvram AutoBoot=%03          # Apple Silicon: Boot bei Stromrückkehr

  echo "==> 3/6  Bildschirmschoner, Sperre und Hot Corners aus"
  as_user defaults -currentHost write com.apple.screensaver idleTime -int 0
  as_user defaults write com.apple.screensaver askForPassword -int 0
  as_user defaults write com.apple.screensaver askForPasswordDelay -int 0
  for c in tl tr bl br; do
    as_user defaults write com.apple.dock "wvous-${c}-corner" -int 0
    as_user defaults write com.apple.dock "wvous-${c}-modifier" -int 0
  done

  echo "==> 4/6  Automatische Updates und Update-Neustarts unterbinden"
  try softwareupdate --schedule off
  try defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticCheckEnabled -bool false
  try defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticDownload -bool false
  try defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates -bool false
  try defaults write /Library/Preferences/com.apple.commerce AutoUpdate -bool false

  echo "==> 5/6  Störende Dialoge und Assistenten aus"
  as_user defaults write com.apple.CrashReporter DialogType none
  try defaults write /Library/Preferences/com.apple.CrashReporter DialogType none
  as_user defaults write com.apple.loginwindow TALLogoutSavesState -bool false
  try defaults write /Library/Preferences/com.apple.TimeMachine DoNotOfferNewDisksForBackup -bool true
  try defaults write /Library/Preferences/com.apple.Bluetooth BluetoothAutoSeekKeyboard -bool false
  try defaults write /Library/Preferences/com.apple.Bluetooth BluetoothAutoSeekPointingDevice -bool false

  echo "==> 6/6  Dock sichtbar lassen, Siri-Menü aus"
  # Dock bleibt bewusst eingeblendet (kein autohide) — er wird im Betrieb gebraucht.
  as_user defaults write com.apple.dock autohide -bool false
  as_user defaults delete com.apple.dock autohide-delay
  as_user defaults write com.apple.dock no-bouncing -bool true
  as_user defaults write com.apple.Siri StatusMenuVisible -bool false
  as_user killall Dock

  echo
  echo "==> Fertig. Aktuelle Energie-Einstellungen:"
  pmset -g custom

else

  echo "==> Setze Standardwerte zurück"
  try pmset -a sleep 10
  try pmset -a displaysleep 10
  try pmset -a disksleep 10
  try pmset -a hibernatemode 3
  try pmset -a standby 1
  try pmset -a autopoweroff 1
  try pmset -a powernap 1
  try pmset -a autorestart 0
  try systemsetup -setrestartfreeze off
  as_user defaults -currentHost write com.apple.screensaver idleTime -int 300
  as_user defaults write com.apple.screensaver askForPassword -int 1
  try softwareupdate --schedule on
  try defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticCheckEnabled -bool true
  as_user defaults delete com.apple.CrashReporter DialogType
  as_user defaults write com.apple.dock autohide -bool false
  as_user defaults delete com.apple.dock autohide-delay
  as_user killall Dock
  echo "==> Zurückgesetzt."

fi
