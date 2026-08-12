# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Complete "Neural Echo" listening experience (see `concept/skript.txt`, which
names the audio file behind every line of the script): intro →
scene 1 (attract two sound balls by looking at them) → scene 2 (house finch,
head rotation slows playback) → scene 3 (musical room, gaze activates
instruments). Binaural audio via Resonance Audio, head tracking from AirPods
over WebSocket (port 8080, see `headtracker_bridge/`).

Built as a teaching codebase for 16-year-old students: German comments that
explain the WHY, kept deliberately simple.

It also runs unattended as an exhibition installation (autostart via
LaunchAgent, AirPods watchdog, kiosk Chrome). The operational side is
documented in the repo-root `../README.md` — keep that file in sync when
touching `start.sh` or `watchdog_airpods.sh`.

## Commands

```
npm install      # once
npm run dev      # Vite dev server on port 3000
./start.sh       # bridge + watchdog + caffeinate + dev server + kiosk Chrome
npm run build    # production build to dist/
```

`static/*.wav` is gitignored (~850 MB, 390 MB of it ambisonic). A fresh clone
has no audio and will fail to load — the files must be copied in separately.

## Architecture

`src/index.js` is written to be read top to bottom by a beginner student and is
split into numbered TEIL sections. Keep that structure when editing – put new
code in the part it belongs to instead of appending at the end:

```
TEIL 1   DATEIEN – all file paths in one place; swap recordings here only
TEIL 2   settings (every tunable number, incl. the `orchester` array)
TEIL 3   mutable state (`phase`, `laeuft`, angles, kugel1/kugel2, fink, beds)
TEIL 4   the ONLY shared helpers: lerp, spaeter, and the ambisonic beds
         (starteBett = loop, spieleBettEinmal = one-shot with optional gain
         factor, stoppeBett, ladeBett = fetch + decode + wire). Each start
         builds a FRESH BufferSource, since a BufferSource can only be
         started once.
TEIL 5   headtracking: WebSocket, calibration, headphone on/off detected from
         head MOVEMENT (BEWEGUNGS_SCHWELLE / AB_TIMEOUT_MS), plus the
         wrap-free `yawFortlaufend` that only scene 2 uses
TEIL 6   initAudio() – ONE linear function that loads and wires everything:
         context → room → voices → 7 ambisonic files (~390 MB, sequential on
         purpose) → balls (3 recorded layers + the synthesized "Fliege") →
         finch → music room
TEIL 7   the flow: one function per script section, chained via Player.onstop
         and spaeter(); every chain starts with `if (!laeuft) return;`
TEIL 8   tick() – ONE requestAnimationFrame loop (starteTick() guards against
         double loops). The look direction is computed once per frame as
         blickX/Y/Z; all three interactions sit inline in numbered blocks,
         `phase` picks which one runs.
TEIL 9   beiKopfhoererAuf() / beiKopfhoererAb() – the latter is the full reset
         and sets laeuft=false FIRST so pending onstop callbacks and timeouts
         can't fire scenes, then stops everything
TEIL 10  boot + dev keys ('h' simulates on/off, 'r' recalibrates, '1'/'2'/'e'
         audition the success sounds, URL param '?auto' auto-starts)
```

Deliberately FLAT: a scene does its own work inside its own function rather
than calling out to small helpers. Only genuinely shared code lives in TEIL 4.
When adding to a scene, add it inline – do not extract a helper "for tidiness".

```
src/3dhead.js  – all visuals (Three.js wireframe head, red source balls,
                 renderer). Returns { setzeKopfDrehung, macheKugel, render }.
static/        – all audio, FLAT (no scene subfolders) so a re-recorded file
                 can simply be copied over the old one. The scene is encoded
                 in the filename prefix: intro_, s1_, s2_, s3_. Vite serves
                 the folder at '/' (publicDir), so a path is just
                 '/s1_speech1_(mono).wav'. Parentheses need no encoding.
                 `static/_old/` (retired prototype set), `static/Voices/`
                 (alternate speaker takes) and `*.asd` (Ableton caches) are
                 not loaded – ignore them.
start.sh       – exhibition launcher. Order matters: the bridge must answer on
                 port 8080 BEFORE Chrome loads the page, because index.js opens
                 the WebSocket exactly once and never retries.
watchdog_airpods.sh + tools/blueutil
               – reconnects the AirPods Max when they power themselves off and
                 re-forces system volume on every check. The BT address is
                 hardcoded at the top and is per-device.
```

## Conventions

- Comments in German, aimed at students, explaining why – keep that style.
  Same for identifiers: German names, no abbreviations, plain constructs.
  Avoid destructuring in loops, tuple returns, functions stored in data
  objects – a beginner should not have to decode syntax to follow the flow.
- Load in `initAudio()` (TEIL 6), play in scenes (TEIL 7/8). Never load audio
  inside a scene.
- Axis convention inherited from the prototypes: audio X and visual X are
  mirrored, so the look direction is negated on X in three places – ball
  alignment (`blickX * -kugel.richtung`), finch position, and the instrument
  scanner. Do not "fix" the signs – they are correct for this setup.
- Ambisonic beds take a linear GAIN FACTOR (`starteBett(nature2, 4, 2.54)`),
  Tone.js nodes take DECIBELS. Do not mix the two units up.
- Each ball has four layers: three recorded loops plus the "Fliege", a
  synthesized noise/sawtooth layer built in initAudio(). The Fliege bypasses
  `blickDaempfung` on purpose – it is the homing signal and must stay audible
  when looking away, only getting slower, never quieter.
- Catching a ball plays a per-ball ambisonic success bed (`erfolg1`/`erfolg2`)
  at `ERFOLG1_LAUTSTAERKE` / `ERFOLG2_LAUTSTAERKE`. Two different values
  because the two recordings differ in level, not in importance. Keys '1',
  '2' and 'e' audition them standalone.
- Scene 2 runs two ambisonic beds at once: `nature2` is slowed together with
  the finch, `natureFx` deliberately stays at original speed. Only ever touch
  `nature2.quelle.playbackRate`.
- Scene 3 placement is 3D: each `orchester` entry has `azimut` + `hoehe` +
  its own `beam` + its file, and gets `x/y/z` (unit vector) plus its
  player/volume attached in initAudio(). The scanner multiplies that vector
  with the look direction, so the piano overhead is found by tilting the head
  up. Adjust angles in TEIL 2, not in tick(). The orchestra is complete with
  five instruments (cello, guitar, piano, flute, percussion).
- There is no outro – the closing line is part of `s3_speech1`.
