# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the project

There is no build step. Serve the directory over HTTP (required for loading audio files — `file://` won't work):

```bash
npx http-server .
# or use VS Code Live Server extension
```

Then open `http://localhost:8080` in a browser. Click anywhere on the canvas to start audio playback.

## Architecture

This is a single-file p5.js + Tone.js sketch (`sketch.js`) that demonstrates 3D binaural audio spatialisation.

**Audio signal chain:**
`Tone.Player` (birds.mp3, looped) → `Tone.Panner3D` (HRTF model) → audio output

The sound source orbits the listener in the horizontal XZ plane. Each draw frame increments `angle`, computes `(soundX, soundZ)` from polar coordinates, updates the panner's position, and draws a visual representation (line + circle from canvas center).

**Library notes:**
- `libraries/haa.js` — Tone.js minified bundle (renamed). This is what the HTML loads.
- `libraries/Tone.js` — identical Tone.js file, not loaded by the HTML.
- `libraries/p5.min.js` — p5.js (loaded).
- `libraries/p5.sound.min.js` — p5.sound (commented out in `index.html`; replaced by Tone.js).
- `node_modules/resonance-audio` — Google Resonance Audio npm package, installed but not yet used. This is the intended next step (hence the repo name).

**Key globals in sketch.js:** `isPlaying`, `player` (Tone.Player), `panner` (Tone.Panner3D), `angle`, `distance`, `fac` (pixels-per-meter scale factor).

## Audio context lifecycle

`Tone.start()` must be called inside a user gesture (`mousePressed`). The sketch guards all panner updates with `if(isPlaying && panner)` for the frames before audio is ready.
