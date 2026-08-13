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
TEIL 1   DATEIEN – all file paths in one place; swap recordings here only.
         Also the `SPRACHEN` table + `SPRACHE` (read from `?lang=`)
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
TEIL 10  boot + the ONE key, 'r' (recalibrate). URL param '?auto' auto-starts.
         Do not add audition/simulation keys back – they were removed on
         purpose; use '?auto' or the real AirPods instead.
```

Deliberately FLAT: a scene does its own work inside its own function rather
than calling out to small helpers. Only genuinely shared code lives in TEIL 4.
When adding to a scene, add it inline – do not extract a helper "for tidiness".

```
src/3dhead.js  – all visuals (Three.js wireframe head, red source balls,
                 renderer). Returns { setzeKopfDrehung, macheKugel, render }.
static/        – all sounds and music, FLAT (no scene subfolders) so a
                 re-recorded file can simply be copied over the old one. The
                 scene is encoded in the filename prefix: intro_, s1_, s2_,
                 s3_. Vite serves the folder at '/' (publicDir), so a path is
                 just '/s2_fink_(mono).wav'. Parentheses need no encoding.
static/voices/DE/ + EN/
               – the spoken lines, one folder per language version, IDENTICAL
                 filenames in each. TEIL 1 builds every path from
                 `sprache.ordner` – never hardcode a folder in an entry.
                 `static/_old/` (retired prototype set), the other
                 `static/voices/*` folders (alternate speaker takes) and
                 `*.asd` (Ableton caches) are not loaded – ignore them.
standort.conf  – per-machine config (language + AirPods BT address), gitignored;
                 `standort.conf.beispiel` is the committed template. Both
                 start.sh and watchdog_airpods.sh source it, each with a
                 working default so a fresh clone runs without it.
start.sh       – exhibition launcher. Order matters: the bridge must answer on
                 port 8080 BEFORE Chrome loads the page, because index.js opens
                 the WebSocket exactly once and never retries.
watchdog_airpods.sh + tools/blueutil
               – reconnects the AirPods Max when they power themselves off
                 (INTERVALL, 10s) and re-forces system volume on a separate,
                 faster tick (LAUTSTAERKE_INTERVALL, 2s) so a visitor putting on
                 freshly reconnected AirPods never starts out too quiet. Volume
                 is only touched while CONNECTED – otherwise output has fallen
                 back to the built-in speakers. The BT address is hardcoded at
                 the top and is per-device.
```

## Bilingual (DE/EN)

Both language versions run from ONE `index.js`; there is no second branch or
copy. Two exhibition Macs run the same commit and differ only in their
gitignored `standort.conf`.

- Language is DATA, not control flow. Everything language-dependent lives in
  the `SPRACHEN` table in TEIL 1 (folder, five dB trims, the on-screen hint).
  Never add `if (SPRACHE === 'EN')` to a scene – that reintroduces the
  double-maintenance problem the table exists to prevent.
- Scene transitions hang off `.onstop`, i.e. the END of a voice file, so they
  shift with the recording automatically. Keep it that way when adding scenes.
- A cue that must land INSIDE a voice file is computed from
  `spieler.buffer.duration` (see the scene-2 swoosh), not from an absolute
  offset – an absolute offset silently breaks on the other language. The intro
  swoosh is the one exception, documented in place.
- Per-voice dB trims belong in `SPRACHEN`, not in TEIL 6: they are properties
  of the recording, not of the scene.

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
- A ball's chain ends in `auftauchBlende`, a Volume right before the Resonance
  source that fades the WHOLE ball (recorded layers and Fliege) up from silence
  over `EINFADE_SEK`. `phase` flips to 'kugel1'/'kugel2' immediately when the
  ball appears, so tick() owns `blickDaempfung` from the first frame — the
  `kugel.auftauchen` flag, not a delayed phase flip, is what keeps the ball
  from moving during the fade. Do not reintroduce a delayed handover: a fixed
  damping during the fade caused an audible 18 dB jump for anyone already
  looking at the ball.
- Each ball has four layers: three recorded loops plus the "Fliege", a
  synthesized layer built in initAudio(): noise shaped by an LFO
  (`FLIEGE_RAUSCH_ART` / `FLIEGE_LFO_ART`, pink + triangle – both were picked by
  ear, so treat them as tunables, not as facts). The triangle is settled: a
  reversed-sawtooth variant was tried and dropped for being too restless over a
  full scene, and the `min`/`max` inversion (1/0) that existed only to build it
  is gone with it – the LFO now runs plainly 0→1. Do not reintroduce either.
  `FLIEGE_FLATTERN_AN`
  switches the modulation off entirely (currently ON; the switch exists as an
  A/B aid from a crackle hunt that turned out to be about stepped params, not
  the LFO); when off, the LFO is still built and started, it just isn't
  connected, so the readout keeps showing the rate it would run at. The
  Fliege bypasses
  `blickDaempfung` on purpose – it is the homing signal and must stay audible
  when looking away, only getting slower, never quieter.
- Per-ball level trims live on the ball object in TEIL 3, not in TEIL 2: `pegel`
  (whole ball, fades in with proximity) plus the flat per-layer `fliegePegel`
  and `layer3Pegel`. They exist because the two balls are different RECORDINGS;
  reach for one of them rather than bending the shared curves in TEIL 2, which
  would move both balls.
- Anything tick() nudges every frame must RAMP, never be assigned: use
  `param.rampTo(x, REGLER_RAMPE_SEK)` instead of `param.value = x`. A per-frame
  `.value =` is a hard step in gain, i.e. a click 60× a second, heard as fine
  crackle — loudest when the source is close and the head turns fast. The
  `-Infinity` "hard off" branches keep `.value =` (they are silent anyway).
  For the same reason the look direction is smoothed (`KOPF_GLAETTUNG_SEK`)
  before it reaches Resonance: AirPods deliver ~25 Hz into a 60 Hz loop, and
  every step of that staircase rewrites nine rotation-matrix gains inside
  Omnitone — all of which the library sets as bare `.value =`. Smoothing the
  look VECTOR, not yaw/pitch: yaw has a ±180° seam that would spin the field.
- Catching a ball plays a per-ball ambisonic success bed (`erfolg1`/`erfolg2`)
  at `ERFOLG1_LAUTSTAERKE` / `ERFOLG2_LAUTSTAERKE`. Two different values
  because the two recordings differ in level, not in importance.
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
