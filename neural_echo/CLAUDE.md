# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Complete "Neural Echo" listening experience (see `../skript.txt`): intro →
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

```
src/index.js   – everything audible + the flow:
                 initAudio() loads/wires ALL audio once (Tone.js players,
                 Resonance sources, two 16ch ambisonic beds decoded to
                 AudioBuffers; starteAmbi() builds a FRESH BufferSource per
                 start so beds are restartable across visitors);
                 szene…() functions only start players/fades and chain via
                 Player.onstop + spaeter(); a single `phase` string ('warten' |
                 'intro' | 'kugel1' | 'kugel2' | 'fink' | 'musik') tells tick()
                 which interaction is active; ONE requestAnimationFrame loop
                 (starteTick() has a guard against double loops).
                 Installation mode: headphones on/off is detected from head
                 MOVEMENT (BEWEGUNGS_SCHWELLE / AB_TIMEOUT in ws.onmessage);
                 onHeadphonesOn() calibrates + starts, onHeadphonesOff() runs
                 stelleAllesZurueck() – it sets laeuft=false FIRST so pending
                 onstop callbacks and spaeter()-timeouts can't fire scenes,
                 then stops everything and cancels volume ramps. Dev helpers:
                 key 'h' simulates on/off, URL param '?auto' auto-starts.
src/3dhead.js  – all visuals (Three.js wireframe head, red source balls,
                 renderer). Returns { setzeKopfDrehung, macheKugel, render }.
static/        – all audio; Vite serves it at '/' (publicDir).
```

## Conventions

- Comments in German, aimed at students, explaining why – keep that style.
- Load in `initAudio()`, play in scenes. Never load audio inside a scene.
- Axis convention inherited from the prototypes: audio X and visual X are
  mirrored (ball alignment uses `-richtung`, finch position negates X).
  Do not "fix" the signs – they are correct for this setup.
- Voice files for scenes 1b/2/3 are placeholder cuts from `../master.wav`
  (full mix underneath); replace same-named files in `static/` when dry
  recordings exist.
- Missing: percussion instrument (scene 3, add as 5th entry in `orchester`),
  final second interaction sound (kugel2 layers are prototype placeholders).
