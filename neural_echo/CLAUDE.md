# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Complete "Neural Echo" listening experience (see `concept/skript.txt`, which
names the audio file behind every line of the script): intro →
scene 1 (attract two sound balls by looking at them) → scene 2 (house finch,
head rotation slows playback) → scene 3 (musical room, gaze activates
instruments). Binaural audio via Resonance Audio, head tracking from AirPods
over WebSocket (port 8080, see `../headtracker_bridge`).

Built as a teaching codebase for 16-year-old students: German comments that
explain the WHY, kept deliberately simple.

## Commands

```
npm install      # once
npm run dev      # Vite dev server on port 3000
./start.sh       # dev server + Chrome with autoplay flag (kiosk-style)
npm run build    # production build to dist/
```

## Architecture

`src/index.js` is written to be read top to bottom by a beginner student and is
split into numbered TEIL sections. Keep that structure when editing – put new
code in the part it belongs to instead of appending at the end:

```
TEIL 1   DATEIEN – all file paths in one place; swap recordings here only
TEIL 2   settings (every tunable number, incl. the `orchester` array)
TEIL 3   mutable state (`phase`, `laeuft`, angles, kugel1/kugel2, fink, beds)
TEIL 4   the ONLY shared helpers: lerp, spaeter, and the ambisonic beds
         (starteBett = loop, spieleBettEinmal = one-shot, stoppeBett,
         ladeBett = fetch + decode + wire). Each start builds a FRESH
         BufferSource, since a BufferSource can only be started once.
TEIL 5   headtracking: WebSocket, calibration, headphone on/off detected from
         head MOVEMENT (BEWEGUNGS_SCHWELLE / AB_TIMEOUT_MS)
TEIL 6   initAudio() – ONE linear function that loads and wires everything:
         context → room → voices → 5 ambisonic files (~400 MB, sequential on
         purpose) → balls → finch → music room
TEIL 7   the flow: one function per script section, chained via Player.onstop
         and spaeter(); every chain starts with `if (!laeuft) return;`
TEIL 8   tick() – ONE requestAnimationFrame loop (starteTick() guards against
         double loops). The look direction is computed once per frame as
         blickX/Y/Z; all three interactions sit inline in numbered blocks,
         `phase` picks which one runs.
TEIL 9   beiKopfhoererAuf() / beiKopfhoererAb() – the latter is the full reset
         and sets laeuft=false FIRST so pending onstop callbacks and timeouts
         can't fire scenes, then stops everything
TEIL 10  boot + dev keys ('h' simulates on/off, 'r' recalibrates,
         URL param '?auto' auto-starts)
```

Deliberately FLAT: a scene does its own work inside its own function rather
than calling out to small helpers. Only genuinely shared code lives in TEIL 4.
When adding to a scene, add it inline – do not extract a helper "for tidiness".

```
src/3dhead.js  – all visuals (Three.js wireframe head, red source balls,
                 renderer). Returns { setzeKopfDrehung, macheKugel, render }.
static/        – all audio, one folder per scene (INTRO, SZENE_1…3); Vite
                 serves it at '/' (publicDir), so the folder is part of the
                 URL. Parentheses in the filenames need no encoding.
                 `static/_old/` is the retired prototype set – ignore it.
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
- Scene 2 runs two ambisonic beds at once: `nature2` is slowed together with
  the finch, `natureFx` deliberately stays at original speed. Only ever touch
  `nature2.quelle.playbackRate`.
- Scene 3 placement is 3D: each `orchester` entry has `azimut` + `hoehe` +
  its own `beam` + its file, and gets `x/y/z` (unit vector) plus its
  player/volume attached in initAudio(). The scanner multiplies that vector
  with the look direction, so the piano overhead is found by tilting the head
  up. Adjust angles in TEIL 2, not in tick().
- No outro and no "success" sound in the final set – the closing line is part
  of `s3_speech1`, and catching a ball is rewarded by its near loop.
