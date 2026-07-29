// NEURAL ECHO – die komplette Experience
//
// Ablauf (siehe skript.txt im Repo-Root):
//   INTRO    → Stimme begrüßt, Swoosh, Natur-Ambix fadet ein
//   SZENE 1  → zwei Klangkugeln (links, dann rechts) durch Hinschauen herbeilocken
//   SZENE 2  → Hausfink: Kopf nach rechts drehen = Zeit verlangsamen
//   SZENE 3  → musikalischer Raum: Instrumente durch Blickrichtung aktivieren
//
// Architektur:
//   3dhead.js  → alles Sichtbare (Three.js: Kopf, Kugeln, Renderer)
//   Tone.js    → lädt und spielt die Audio-Dateien
//   Resonance  → positioniert Klänge im 3D-Raum (binaural)
//   WebSocket  → Kopfrotation von den AirPods (headtracker_bridge, Port 8080)
//
// INSTALLATION (Futurium): Die Experience startet, wenn jemand den Kopfhörer
// AUFSETZT (wir erkennen das an der Kopfbewegung), und setzt sich komplett
// zurück, wenn er wieder ABGELEGT wird – bereit für den nächsten Besucher.
//
// Grundregel im Code: initAudio() LÄDT alles, die szene…()-Funktionen SPIELEN.
// Der tick() läuft als EINE einzige Schleife und kümmert sich jede Frame um
// Kopfdrehung, Interaktion und Rendern – welche Interaktion gerade gilt,
// entscheidet die Variable "phase".

import * as Tone from 'tone';
import { ResonanceAudio } from 'resonance-audio';
import { erstelleKopfSzene } from './3dhead.js';


// ─── 3D-KOPF ───────────────────────────────────────────────────────────────
// Das ganze Three.js-Setup wohnt in 3dhead.js – wir bekommen nur drei
// Funktionen zurück und müssen uns hier um nichts Visuelles mehr kümmern.
const canvas = document.querySelector('canvas.webgl');
const kopf3d = erstelleKopfSzene(canvas);


// ─── PHASE ─────────────────────────────────────────────────────────────────
// EINE Variable sagt dem tick(), welche Interaktion gerade aktiv ist.
// Das ersetzt viele einzelne booleans (isSonarActive, scene5Active, …)
// und macht den Ablauf leichter nachvollziehbar.
//   'laden'   → Audio lädt noch
//   'warten'  → alles bereit, Kopfhörer hängt im Raum
//   'intro'   → Stimme läuft, keine Interaktion
//   'kugel1'  → linke Kugel herbeilocken
//   'kugel2'  → rechte Kugel herbeilocken
//   'fink'    → Kopfdrehung steuert die Abspielgeschwindigkeit
//   'musik'   → Blickrichtung aktiviert Instrumente
let phase = 'laden';

// laeuft = trägt gerade jemand den Kopfhörer und die Experience spielt?
// Alle Szenen-Verkettungen prüfen dieses Flag – nach einem Reset dürfen
// alte Callbacks (z.B. das Ende einer gestoppten Stimme) NICHTS mehr starten.
let laeuft = false;


// ─── HEADTRACKING (WebSocket) ──────────────────────────────────────────────
// Die Swift-App (headtracker_bridge) sendet die AirPods-Winkel als JSON.
// yaw = links/rechts, pitch = nicken, roll = kippen (alles in Radiant).
const ws = new WebSocket('ws://localhost:8080');

let yaw = 0, pitch = 0, roll = 0;

// Die AirPods wissen nicht, was "geradeaus" ist – ihr Referenzrahmen ist
// zufällig. Deshalb merken wir uns die erste Messung als Null-Offset.
let rawYaw = 0, rawPitch = 0, rawRoll = 0;
let offsetYaw = 0, offsetPitch = 0, offsetRoll = 0;
let calibrated = false;

// ─── KOPFHÖRER AUF/AB ERKENNEN ───
// Idee: Solange jemand den Kopfhörer trägt, bewegt sich der Kopf IMMER ein
// kleines bisschen (niemand hält perfekt still). Hängt der Kopfhörer am
// Haken, ist das Signal dagegen totenstill. Wir messen also nur:
// "Wann gab es zuletzt eine echte Bewegung?"
let headphonesOn = false;
let referenzYaw = 0;     // letzter "eingerasteter" yaw-Wert
let letzteBewegung = 0;  // Zeitpunkt (ms) der letzten echten Bewegung

// Stellschrauben für die Erkennung (Werte aus den Prototyp-Tests):
const BEWEGUNGS_SCHWELLE = 0.000000015; // ab wie viel yaw-Änderung zählt es als Bewegung (rad)
const AB_TIMEOUT = 5000;                // ms ohne Bewegung → Kopfhörer gilt als abgelegt

ws.onmessage = (event) => {
  const d = JSON.parse(event.data);
  rawYaw   = d.yaw;
  rawPitch = d.pitch;
  rawRoll  = d.roll;

  if (!calibrated) {
    reset();
    calibrated = true;
  }

  yaw   = rawYaw   - offsetYaw;
  pitch = rawPitch - offsetPitch;
  roll  = rawRoll  - offsetRoll;

  const jetzt = performance.now();

  // Hat sich yaw seit dem letzten eingerasteten Referenzwert deutlich bewegt?
  // referenzYaw ist bewusst NICHT "der letzte Frame", sondern der zuletzt
  // eingerastete Bewegungspunkt – so sind doppelte Frames (die Bridge sendet
  // schneller, als die AirPods liefern) automatisch harmlos.
  if (Math.abs(yaw - referenzYaw) > BEWEGUNGS_SCHWELLE) {
    referenzYaw    = yaw;
    letzteBewegung = jetzt;

    // AUFSETZEN: Es bewegt sich, aber der Kopfhörer galt als "ab".
    if (!headphonesOn) {
      headphonesOn = true;
      onHeadphonesOn();
    }
  }

  // ABLEGEN: Kopfhörer galt als "auf", aber seit AB_TIMEOUT keine Bewegung.
  if (headphonesOn && jetzt - letzteBewegung > AB_TIMEOUT) {
    headphonesOn = false;
    onHeadphonesOff();
  }
};

// reset() speichert die aktuelle Kopfposition als neue "Nullstellung".
function reset() {
  offsetYaw   = rawYaw;
  offsetPitch = rawPitch;
  offsetRoll  = rawRoll;
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'r') reset();

  // DEV-Helfer: Taste 'h' simuliert Aufsetzen/Ablegen – zum Testen ohne
  // AirPods. Beim Simulieren müssen wir letzteBewegung mitsetzen: Läuft
  // nebenbei die echte Bridge, würde der AB_TIMEOUT die Simulation sonst
  // sofort wieder "ablegen".
  if (e.key === 'h') {
    headphonesOn = !headphonesOn;
    if (headphonesOn) {
      letzteBewegung = performance.now();
      referenzYaw = yaw;
      onHeadphonesOn();
    } else {
      onHeadphonesOff();
    }
  }
});


// ─── MATHE-HELFER ──────────────────────────────────────────────────────────

// Lineare Interpolation: liefert den Wert zwischen a und b an der Stelle t
// (t wird auf 0…1 begrenzt, damit nichts "über das Ziel hinausschießt").
function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

// Schaue ich gerade in Richtung einer Quelle bei (srcX, srcZ)?
// Wir bauen aus dem yaw-Winkel einen Blick-Pfeil (Vektor) und multiplizieren
// ihn mit dem Pfeil zur Quelle (Dot-Product):
//    1 = direkt draufgeschaut,  0 = Quelle seitlich,  -1 = abgewandt
function getAlignment(srcX, srcZ) {
  const fwdX = Math.sin(yaw);
  const fwdZ = Math.cos(yaw);
  return fwdX * srcX + fwdZ * srcZ;
}


// ─── KONSTANTEN FÜR DIE KUGELN (SZENE 1) ───────────────────────────────────
const DIST_FAR  = 6;   // Meter: Start-Entfernung der Kugel
const DIST_NEAR = 1;   // Meter: hier gilt sie als "eingefangen"
const ALIGNMENT_THRESHOLD = 0.8; // wie genau man hinschauen muss (1 = exakt)
const RETREAT_SPEED = 1;         // m/s: so schnell weicht sie beim Wegschauen zurück
const EINFADE_SEK = 2;           // Sekunden: sanftes Auftauchen der Kugel

// ─── KONSTANTEN FÜR DEN FINK (SZENE 2) ─────────────────────────────────────
// Der Kopf wird zum Abspielregler: ganz links = Originaltempo,
// ganz rechts = stark verlangsamt (und dadurch tiefer – wie eine Bandmaschine).
const FINK_YAW_LINKS  =  Math.PI / 2; // +90° = ganz links → Original
const FINK_YAW_RECHTS = -Math.PI / 2; // -90° = ganz rechts → maximal langsam
const FINK_MIN_RATE   = 0.15;         // tiefster Punkt: ~15% Tempo
const FINK_DIST       = 2;            // Meter: wie weit vor den Augen der Vogel hängt
const AMBI_MIN_RATE   = 0.1;          // Natur-Bett bei "ganz rechts": 10% Tempo
const FINK_LOOP_MIN   = 0.4;          // kürzeste Loop-Länge (schneidet die Stille ab)

// ─── KONSTANTEN FÜR DEN MUSIK-RAUM (SZENE 3) ───────────────────────────────
// Jedes Instrument hat einen Winkel im Halbkreis vor dem Hörer und einen
// aktuellen Pegel von 0 (stumm) bis 1 (voll). Der "Lupe"-Scanner im tick()
// fadet ein, was man anschaut, und lässt den Rest langsam ausklingen.
// TODO: Perkussion fehlt noch als Audio-Datei (siehe skript.txt) –
//       einfach hier als 5. Eintrag ergänzen, sobald sie existiert.
const orchester = [
  { name: 'cello',   winkel:  80, pegel: 0 }, // ganz rechts
  { name: 'gitarre', winkel:  40, pegel: 0 }, // halb rechts
  { name: 'klavier', winkel: -40, pegel: 0 }, // halb links
  { name: 'floete',  winkel: -80, pegel: 0 }, // ganz links
];
const SCANNER_BEAM_HALB  = 25;  // Grad: halbe Breite der "Lupe"
const SCANNER_ATTACK_SEK = 2.5; // schnelles Einfaden beim Anschauen
const SCANNER_DECAY_SEK  = 5;   // langsames Ausklingen nach dem Wegschauen

// ─── TIMING DER SZENEN-ÜBERGÄNGE (aus skript.txt) ──────────────────────────
const INTRO_SWOOSH_NACH_SEK   = 6.5; // Swoosh + Natur mitten in der Intro-Stimme
const FINK_SPIELZEIT_SEK      = 15;  // freies Spielen, bevor die End-Stimme kommt
const FINK_ENDE_PAUSE_SEK     = 5;   // Pause nach "…ganze Melodie steckt?"
const MUSIK_OUTRO_NACH_SEK    = 2;   // Outro-Stimme kurz nach der Szene-3-Stimme


// ─── AUDIO-ZUSTAND ─────────────────────────────────────────────────────────
// Alles startet als null/leer und wird EINMAL in initAudio() befüllt.
let audioCtx        = null;
let resonanceScene  = null;
let voiceSource     = null; // Resonance-Quelle für alle Stimmen (wandert je Szene)
let fxSource        = null; // Resonance-Quelle für Effekte (Swoosh), fix vorne
let isPlaying       = false;
let audioInitStarted = false; // verhindert doppeltes initAudio()
let startPending    = false;  // Kopfhörer aufgesetzt, bevor Audio fertig geladen war

const sounds = {}; // Stimmen + Swoosh + Success

// Natur-Betten: Ambisonics-Dateien (16 Kanäle) laufen NICHT durch Tone.js,
// sondern direkt in den ambisonicInput von Resonance. Wichtig für die
// Installation: BufferSources sind EINWEG (nur einmal startbar) – deshalb
// merken wir uns hier den dekodieren BUFFER und bauen bei jedem Start eine
// frische Source daraus. So kann jeder Besucher wieder von vorn beginnen.
// nature1 = Wiese/Insekten (Szene 1), nature2 = "Low Nature" (Szene 2, pitchbar).
const nature1 = { buffer: null, gain: null, source: null };
const nature2 = { buffer: null, gain: null, source: null };

// Die zwei Kugeln aus Szene 1. richtung -1 = links, +1 = rechts.
// Jede hat 3 Klang-Schichten (Layer), die beim Näherkommen dazukommen.
// tempo wird im tick() angepasst (nah = langsamer, damit das Ende spürbar ist).
const kugel1 = { richtung: -1, dist: DIST_FAR, tempo: 0.8, mesh: null, quelle: null, player: [], vols: [] };
const kugel2 = { richtung:  1, dist: DIST_FAR, tempo: 0.8, mesh: null, quelle: null, player: [], vols: [] };

const fink  = { player: null, vol: null, quelle: null, rate: 1, loop: 0 };
const musik = {}; // basis + Instrumente (player, vol, quelle je Name)


// ─── TIMEOUT-VERWALTUNG ────────────────────────────────────────────────────
// Die Szenen verketten sich über setTimeout. Wird der Kopfhörer mittendrin
// abgelegt, müssen ALLE noch ausstehenden Übergänge gelöscht werden – sonst
// startet z.B. 15 Sekunden später die Fink-End-Stimme in die Stille hinein.
// Deshalb: Szenen benutzen spaeter() statt setTimeout, und der Reset räumt auf.
let szenenTimeouts = [];

function spaeter(fn, ms) {
  const id = setTimeout(fn, ms);
  szenenTimeouts.push(id);
  return id;
}

function alleTimeoutsLoeschen() {
  for (const id of szenenTimeouts) clearTimeout(id);
  szenenTimeouts = [];
}


// ─── FADE-HELFER FÜR DIE NATUR-BETTEN ──────────────────────────────────────
// Native BufferSources haben kein rampTo wie Tone – wir rampen den Gain-Node.

// Baut eine FRISCHE Source aus dem gespeicherten Buffer und fadet sie ein.
function starteAmbi(bett, dauerSek = 2, zielGain = 1) {
  const jetzt = audioCtx.currentTime;
  bett.source = audioCtx.createBufferSource();
  bett.source.buffer = bett.buffer;
  bett.source.loop = true;
  bett.source.connect(bett.gain);
  // Gain auf 0 setzen BEVOR wir starten, sonst blitzt kurz volle Lautstärke auf.
  bett.gain.gain.cancelScheduledValues(jetzt);
  bett.gain.gain.setValueAtTime(0, jetzt);
  bett.source.start();
  bett.gain.gain.linearRampToValueAtTime(zielGain, jetzt + dauerSek);
}

// Fadet aus und stoppt die Source danach wirklich (sonst hört man den Cut).
function stoppeAmbi(bett, dauerSek = 2) {
  if (!bett.source) return; // läuft gar nicht
  const source = bett.source;
  bett.source = null;
  const jetzt = audioCtx.currentTime;
  bett.gain.gain.cancelScheduledValues(jetzt);
  bett.gain.gain.setValueAtTime(bett.gain.gain.value, jetzt);
  bett.gain.gain.linearRampToValueAtTime(0, jetzt + dauerSek);
  // bewusst natives setTimeout: dieses Aufräumen soll auch einen Reset überleben
  setTimeout(() => source.stop(), dauerSek * 1000);
}

// Lädt eine Datei und loggt den Fortschritt – bei den großen Ambix-Dateien
// (70+ MB) will man sehen, dass etwas passiert.
async function ladeMitProzent(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP-Fehler beim Laden von ${url}: ${res.status}`);

  const total = parseInt(res.headers.get('content-length') || '0', 10);
  const reader = res.body.getReader();
  let loaded = 0, chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (total > 0) {
      console.log(`Lade ${url}: ${Math.round((loaded / total) * 100)}%`);
    }
  }

  const result = new Uint8Array(loaded);
  let pos = 0;
  for (const c of chunks) { result.set(c, pos); pos += c.length; }
  return result.buffer;
}

// Lädt ein Ambisonics-Bett: dekodieren → Buffer merken, Gain verkabeln.
// Die Source selbst entsteht erst in starteAmbi() – jedes Mal frisch.
async function ladeAmbiBett(url) {
  const arrayBuffer = await ladeMitProzent(url);
  const buffer = await audioCtx.decodeAudioData(arrayBuffer);
  const gain = audioCtx.createGain();
  gain.gain.value = 0;
  gain.connect(resonanceScene.ambisonicInput);
  return { buffer, gain, source: null };
}


// ─── AUDIO LADEN ───────────────────────────────────────────────────────────
// Hier wird NUR geladen und verkabelt – abgespielt wird erst in den Szenen.

async function initAudio() {
  if (audioInitStarted) return;
  audioInitStarted = true;

  // Ein AudioContext für alles – Tone.js und Resonance teilen ihn sich.
  audioCtx = new AudioContext();
  await audioCtx.resume();
  Tone.setContext(new Tone.Context(audioCtx));

  // Falls Chrome den Context im Dauerbetrieb mal pausiert (Tab im Hintergrund),
  // holen wir ihn automatisch zurück. Wichtig für die Ausstellung: der Context
  // wird EINMAL erzeugt und läuft den ganzen Tag – Kopfhörer auf/ab steuert
  // nur das Playback, nicht den Context.
  audioCtx.onstatechange = () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
  };

  // Resonance baut einen virtuellen Raum. ambisonicOrder 3 = hohe räumliche
  // Auflösung. Die Materialien schlucken viel Schall → wenig Hall, der Klang
  // bleibt auch nah an der Quelle trocken.
  resonanceScene = new ResonanceAudio(audioCtx, { ambisonicOrder: 3 });
  resonanceScene.output.connect(audioCtx.destination);
  resonanceScene.setRoomProperties(
    { width: 10, height: 4, depth: 10 },
    {
      left: 'curtain-heavy', right: 'curtain-heavy',
      front: 'curtain-heavy', back: 'curtain-heavy',
      down: 'parquet-on-concrete', up: 'acoustic-ceiling-tiles'
    }
  );

  // ─── STIMMEN + EFFEKTE ───
  // Alle Stimmen laufen durch EINE Resonance-Quelle. Die steht normalerweise
  // 2 m VOR dem Hörer (-Z) – in Szene 1 wandert sie nach links/rechts, damit
  // die Stimme aus der Richtung kommt, in die man schauen soll.
  voiceSource = resonanceScene.createSource();
  voiceSource.setPosition(0, 0, -2);
  fxSource = resonanceScene.createSource();
  fxSource.setPosition(0, 0, -2);

  // Tone.Player dekodiert die Dateien komplett in den RAM – gut für kurze
  // Files (Stimmen, Effekte), NICHT für die großen Ambix-Betten.
  sounds.voiceIntro      = new Tone.Player('/voice_intro.wav').connect(voiceSource.input);
  sounds.voiceS1Links    = new Tone.Player('/voice_szene1_links.wav').connect(voiceSource.input);
  sounds.voiceS1Links.volume.value = 2;
  sounds.voiceS1Rechts   = new Tone.Player('/voice_szene1_rechts.wav').connect(voiceSource.input);
  sounds.voiceS1Profi    = new Tone.Player('/voice_szene1_profi.wav').connect(voiceSource.input);
  sounds.voiceS2Fink     = new Tone.Player('/voice_szene2_fink.wav').connect(voiceSource.input);
  sounds.voiceS2Ende     = new Tone.Player('/voice_szene2_ende.wav').connect(voiceSource.input);
  sounds.voiceS3         = new Tone.Player('/voice_szene3.wav').connect(voiceSource.input);
  sounds.voiceOutro      = new Tone.Player('/voice_outro.wav').connect(voiceSource.input);

  sounds.swoosh = new Tone.Player('/swoosh.wav').connect(fxSource.input);
  sounds.swoosh.volume.value = 2;
  sounds.success = new Tone.Player('/success.wav').connect(fxSource.input);
  sounds.success.volume.value = -9;

  // ─── NATUR-BETTEN (Ambisonics) ───
  Object.assign(nature1, await ladeAmbiBett('/nature_ambix.wav'));
  Object.assign(nature2, await ladeAmbiBett('/lowNature_ambix.wav'));

  // ─── KUGELN (SZENE 1) ───
  // Jede Kugel: eigene Resonance-Quelle + 3 loopende Layer mit je einem
  // Volume-Node. Alle starten stumm (-Infinity dB) – hörbar wird erst,
  // was der tick() beim Näherkommen hochregelt.
  for (const [kugel, praefix] of [[kugel1, 'kugel1'], [kugel2, 'kugel2']]) {
    kugel.quelle = resonanceScene.createSource();
    kugel.quelle.setPosition(kugel.richtung * DIST_FAR, 0, 0);
    kugel.mesh = kopf3d.macheKugel();
    for (let i = 1; i <= 3; i++) {
      const vol = new Tone.Volume(-Infinity);
      vol.connect(kugel.quelle.input);
      const player = new Tone.Player({ url: `/${praefix}_layer${i}.wav`, loop: true }).connect(vol);
      kugel.vols.push(vol);
      kugel.player.push(player);
    }
  }

  // ─── FINK (SZENE 2) ───
  // Der Vogel bekommt eine eigene Resonance-Quelle, die der tick() jede Frame
  // FINK_DIST Meter in Blickrichtung setzt – so schwebt er immer vor den Augen,
  // klingt aber mit echtem räumlichem Abstand statt flach im Kopf.
  fink.quelle = resonanceScene.createSource();
  fink.vol    = new Tone.Volume(-Infinity);
  fink.player = new Tone.Player({ url: '/fink.wav', loop: true }).connect(fink.vol);
  fink.vol.connect(fink.quelle.input);

  // ─── MUSIK-RAUM (SZENE 3) ───
  // Basis-Fläche: läuft OHNE Resonance direkt stereo auf den Ausgang –
  // sie soll den Raum füllen, nicht aus einer Richtung kommen.
  musik.basisVol = new Tone.Volume(-Infinity).toDestination();
  musik.basis    = new Tone.Player({ url: '/musik_basis.wav', loop: true, volume: -6 })
    .connect(musik.basisVol);

  // Die Instrumente stehen im Halbkreis VOR dem Hörer (Front = -Z).
  // Aus Winkel + Radius wird die Position: x = R·sin(a), z = -R·cos(a).
  const ORCH_RADIUS = 6;
  for (const inst of orchester) {
    const rad = inst.winkel * Math.PI / 180;
    const quelle = resonanceScene.createSource();
    quelle.setPosition(ORCH_RADIUS * Math.sin(rad), 0, -ORCH_RADIUS * Math.cos(rad));
    const vol = new Tone.Volume(-Infinity);
    vol.connect(quelle.input);
    const player = new Tone.Player({ url: `/musik_${inst.name}.wav`, loop: true, volume: -6 })
      .connect(vol);
    musik[inst.name] = { player, vol, quelle };
  }

  // Warten, bis ALLE Tone.Player ihre Dateien dekodiert haben.
  await Tone.loaded();
  isPlaying = true;
  phase = 'warten';
  console.log('Audio komplett geladen – warte auf Kopfhörer.');
  setzeHint('setz die Kopfhörer auf … · h = simulieren · r = reset');

  // Falls jemand den Kopfhörer schon aufgesetzt hat, während wir noch luden:
  // die Experience jetzt nachholen, statt sie zu verschlucken.
  if (startPending) {
    startPending = false;
    onHeadphonesOn();
  }
}


// ─── KOPFHÖRER-EVENTS ──────────────────────────────────────────────────────

// Feuert EINMAL, wenn jemand den Kopfhörer aufsetzt.
function onHeadphonesOn() {
  console.log('Kopfhörer AUFGESETZT');

  if (!isPlaying) {
    // Audio lädt noch – wir merken uns den Wunsch und starten nach dem Laden.
    console.warn('Audio lädt noch – Experience startet automatisch, sobald fertig.');
    startPending = true;
    return;
  }

  // Die aktuelle Blickrichtung wird zur neuen Nullstellung ("geradeaus") –
  // jeder Besucher setzt den Kopfhörer ja etwas anders auf.
  reset();
  starteExperience();
}

// Feuert, wenn der Kopfhörer lange genug still lag → alles auf Anfang.
function onHeadphonesOff() {
  console.log('Kopfhörer ABGELEGT – alles zurücksetzen');
  startPending = false;
  if (laeuft) stelleAllesZurueck();
}

// Der komplette Reset für den nächsten Besucher. Reihenfolge ist wichtig:
// ERST laeuft=false setzen (damit stoppende Player über ihre onstop-Callbacks
// keine neuen Szenen mehr anstoßen), DANN alles stoppen und zurücksetzen.
function stelleAllesZurueck() {
  laeuft = false;
  phase = 'warten';
  alleTimeoutsLoeschen();

  // Alle Stimmen und Effekte stoppen (stop() auf einem stehenden Player ist harmlos).
  for (const name of Object.keys(sounds)) sounds[name].stop();

  // Natur-Betten kurz ausfaden und stoppen.
  stoppeAmbi(nature1, 0.5);
  stoppeAmbi(nature2, 0.5);

  // Kugeln: Klang aus, Position zurück auf weit weg, unsichtbar.
  // cancelScheduledValues: falls gerade noch eine rampTo-Fahrt läuft, würde
  // sie unseren Reset-Wert sonst gleich wieder überschreiben.
  for (const kugel of [kugel1, kugel2]) {
    for (const vol of kugel.vols) {
      vol.volume.cancelScheduledValues(0);
      vol.volume.value = -Infinity;
    }
    for (const p of kugel.player) p.stop();
    kugel.dist  = DIST_FAR;
    kugel.tempo = 0.8;
    kugel.quelle.setPosition(kugel.richtung * DIST_FAR, 0, 0);
    kugel.mesh.visible = false;
  }

  // Fink: stoppen und den Abspielregler zurück auf Original.
  fink.player.stop();
  fink.player.playbackRate = 1;
  fink.vol.volume.cancelScheduledValues(0);
  fink.vol.volume.value = -Infinity;
  fink.rate = 1;
  fink.loop = 0;

  // Musik-Raum: Basis + Instrumente stoppen, Scanner-Pegel nullen.
  musik.basis.stop();
  musik.basisVol.volume.cancelScheduledValues(0);
  musik.basisVol.volume.value = -Infinity;
  for (const inst of orchester) {
    musik[inst.name].player.stop();
    musik[inst.name].vol.volume.value = -Infinity;
    inst.pegel = 0;
  }

  // Stimme zurück nach vorne für den nächsten Durchlauf.
  voiceSource.setPosition(0, 0, -2);

  setzeHint('setz die Kopfhörer auf … · h = simulieren · r = reset');
}


// ─── SZENEN ────────────────────────────────────────────────────────────────
// Jede Funktion startet genau EINEN Abschnitt aus dem Skript und übergibt
// am Ende an die nächste. Die Interaktion selbst passiert im tick().
// Alle Verkettungen (onstop + spaeter) prüfen "laeuft" – nach einem Reset
// darf nichts davon mehr feuern.

// INTRO: "Hey, wenn du bereit bist…" – mitten in der Stimme öffnen Swoosh
// und Natur-Ambix den Raum. Danach geht es nach Szene 1.
function intro() {
  console.log('INTRO');
  phase = 'intro';
  voiceSource.setPosition(0, 0, -2); // Stimme vorne
  sounds.voiceIntro.start();

  spaeter(() => {
    if (!laeuft) return;
    sounds.swoosh.start();
    starteAmbi(nature1, 3, 0.3);
  }, INTRO_SWOOSH_NACH_SEK * 1000);

  sounds.voiceIntro.onstop = () => {
    if (!laeuft) return;
    szene1Links();
  };
}

// Blendet eine Kugel sanft ein und macht sie danach interaktiv.
// Erst steht sie als statischer Punkt ganz weit weg und ihr Grund-Layer
// fadet hoch – DANN darf der tick() sie auf den Blick reagieren lassen.
function kugelStarten(kugel, naechstePhase) {
  kugel.dist = DIST_FAR;
  kugel.quelle.setPosition(kugel.richtung * DIST_FAR, 0, 0);
  kugel.mesh.position.set(kugel.richtung * DIST_FAR, 0, 0);
  kugel.mesh.visible = true;

  for (const p of kugel.player) p.start();
  kugel.vols[0].volume.rampTo(0, EINFADE_SEK); // nur Layer 1, Rest kommt beim Näherkommen

  spaeter(() => { if (laeuft) phase = naechstePhase; }, EINFADE_SEK * 1000);
}

// Beendet eine eingefangene Kugel: Success-Sound, Klang aus, Kugel weg.
function kugelEinfangen(kugel) {
  sounds.success.start();
  for (const vol of kugel.vols) vol.volume.value = -Infinity;
  for (const p of kugel.player) p.stop();
  kugel.mesh.visible = false;
}

// SZENE 1a: "Hey, hier bin ich. Dreh doch deinen Kopf mal nach links…"
function szene1Links() {
  console.log('SZENE 1 – Kugel links');
  phase = 'intro'; // noch keine Interaktion, solange die Stimme spricht
  voiceSource.setPosition(-2, 0, 0); // Stimme kommt von LINKS
  spaeter(() => {
    if (!laeuft) return;
    sounds.voiceS1Links.start();
    sounds.voiceS1Links.onstop = () => {
      if (!laeuft) return;
      kugelStarten(kugel1, 'kugel1');
    };
  }, 3000);
}

// SZENE 1b: "Sehr gut. Jetzt dreh dich mal nach rechts…"
function szene1Rechts() {
  console.log('SZENE 1 – Kugel rechts');
  phase = 'intro';
  voiceSource.setPosition(2, 0, 0); // Stimme kommt von RECHTS
  spaeter(() => {
    if (!laeuft) return;
    sounds.voiceS1Rechts.start();
    sounds.voiceS1Rechts.onstop = () => {
      if (!laeuft) return;
      kugelStarten(kugel2, 'kugel2');
    };
  }, 1500);
}

// SZENE 1 ENDE: "Jetzt bist du ja schon Profi im Klänge herbeilocken…"
function szene1Profi() {
  console.log('SZENE 1 – Ende');
  phase = 'intro';
  voiceSource.setPosition(0, 0, -2); // Stimme wieder vorne
  spaeter(() => {
    if (!laeuft) return;
    sounds.voiceS1Profi.start();
    sounds.voiceS1Profi.onstop = () => {
      if (!laeuft) return;
      szene2();
    };
  }, 1500);
}

// SZENE 2: Hausfink. Swoosh als Übergang, das Natur-Bett wechselt auf die
// pitchbare "Low Nature"-Aufnahme, der Fink loopt vor den Augen.
// Ab jetzt übersetzt der tick() jede Kopfdrehung in Abspielgeschwindigkeit.
function szene2() {
  console.log('SZENE 2 – Fink');
  sounds.swoosh.start();
  stoppeAmbi(nature1, 4);
  starteAmbi(nature2, 4, 0.3);

  fink.player.playbackRate = 1; // sicherheitshalber: frisch im Originaltempo
  fink.player.start();
  fink.vol.volume.rampTo(2, 1.5);
  phase = 'fink'; // Interaktion läuft schon, während die Stimme erklärt

  sounds.voiceS2Fink.start();
  sounds.voiceS2Fink.onstop = () => {
    if (!laeuft) return;
    // freies Spielen, dann die Abschluss-Beobachtung
    spaeter(() => szene2Ende(), FINK_SPIELZEIT_SEK * 1000);
  };
}

// SZENE 2 ENDE: "Hör zum Schluss noch mal genauer hin…"
function szene2Ende() {
  console.log('SZENE 2 – Ende');
  sounds.voiceS2Ende.start();
  sounds.voiceS2Ende.onstop = () => {
    if (!laeuft) return;
    spaeter(() => szene3(), FINK_ENDE_PAUSE_SEK * 1000);
  };
}

// SZENE 3: der musikalische Raum. Fink + Natur faden aus, die Basis-Fläche
// fadet ein, die Instrumente laufen stumm los – hörbar macht sie nur der
// "Lupe"-Scanner im tick(), je nachdem, wohin man schaut.
function szene3(fadeSek = 5) {
  console.log('SZENE 3 – Musik');
  fink.vol.volume.rampTo(-Infinity, fadeSek);
  spaeter(() => fink.player.stop(), fadeSek * 1000); // erst nach dem Fade stoppen
  stoppeAmbi(nature2, fadeSek);

  musik.basis.start();
  musik.basisVol.volume.rampTo(-24, fadeSek);
  for (const inst of orchester) musik[inst.name].player.start();

  phase = 'musik';

  sounds.voiceS3.start();
  sounds.voiceS3.onstop = () => {
    if (!laeuft) return;
    // "Wenn du genug gehört hast, darfst du deine Kopfhörer wieder absetzen."
    spaeter(() => sounds.voiceOutro.start(), MUSIK_OUTRO_NACH_SEK * 1000);
  };
}


// ─── TICK: DIE EINE SCHLEIFE ───────────────────────────────────────────────
// requestAnimationFrame ruft tick() ~60x pro Sekunde auf. WICHTIG: tick()
// darf nur EINMAL gestartet werden – sonst laufen mehrere Schleifen parallel
// und alles (Bewegung, Fades) passiert doppelt so schnell.
// Der tick läuft dauerhaft weiter (auch im 'warten'-Zustand), damit der
// Drahtgitter-Kopf immer live ist – die Interaktion steuert die phase.
let tickLaeuft = false;
let letzteZeit = 0;

function starteTick() {
  if (tickLaeuft) return; // der Doppel-Tick-Schutz
  tickLaeuft = true;
  letzteZeit = performance.now() / 1000;
  tick();
}

// Bewegt eine Kugel je nach Blick, regelt ihre 3 Klang-Schichten
// und meldet zurück, ob sie eingefangen wurde (true/false).
function updateKugel(kugel, deltaTime) {
  // Schaue ich zur Kugel? (-richtung, weil Audio- und Visuell-Achse
  // in diesem Projekt gespiegelt sind – Konvention aus den Prototypen.)
  const blick = Math.max(0, getAlignment(-kugel.richtung, 0));

  if (blick > ALIGNMENT_THRESHOLD) {
    kugel.dist = Math.max(DIST_NEAR, kugel.dist - kugel.tempo * deltaTime);
  } else {
    kugel.dist = Math.min(DIST_FAR, kugel.dist + RETREAT_SPEED * deltaTime);
  }

  // Audio-Quelle und rote Kugel wandern gemeinsam.
  kugel.quelle.setPosition(kugel.richtung * kugel.dist, 0, 0);
  kugel.mesh.position.set(kugel.richtung * kugel.dist, 0, 0);

  // naehe: 0 = ganz weit weg, 1 = direkt am Kopf.
  const naehe = 1 - ((kugel.dist - DIST_NEAR) / (DIST_FAR - DIST_NEAR));

  // Drei Schichten, die nacheinander dazukommen – je näher, desto voller
  // der Klang. Werte in Dezibel: 0 = laut, -30 = sehr leise, -Infinity = aus.
  kugel.vols[0].volume.value = -6 * naehe;
  kugel.vols[1].volume.value = naehe > 0.1
    ? lerp(-30, -6, (naehe - 0.1) / 0.75)
    : -Infinity;
  kugel.vols[2].volume.value = naehe > 0.3
    ? lerp(-30, -6, (naehe - 0.3) / 0.45)
    : -Infinity;

  // Je näher die Kugel, desto langsamer kommt sie – so ist das Ankommen
  // spürbar, ohne dass man ewig warten muss.
  if (naehe > 0.8)      kugel.tempo = 0.3;
  else if (naehe > 0.6) kugel.tempo = 0.7;
  else                  kugel.tempo = 0.8;

  return kugel.dist <= DIST_NEAR; // eingefangen?
}

function tick() {
  const jetzt = performance.now() / 1000;
  const deltaTime = jetzt - letzteZeit;
  letzteZeit = jetzt;

  // 1. Drahtgitter-Kopf drehen (rein visuell, wohnt in 3dhead.js)
  kopf3d.setzeKopfDrehung(yaw, pitch, roll);

  // 2. Resonance sagen, wie der Kopf im Raum steht – sonst stimmt der
  // 3D-Klang nicht. Aus yaw/pitch wird ein Blick-Vektor.
  if (isPlaying) {
    const fwdX =  Math.sin(yaw) * Math.cos(pitch);
    const fwdY =  Math.sin(pitch);
    const fwdZ = -Math.cos(yaw) * Math.cos(pitch);
    resonanceScene.setListenerOrientation(fwdX, fwdY, fwdZ, 0, 1, 0);
  }

  // 3. Interaktion – je nachdem, in welcher Phase wir sind.

  // SZENE 1: Kugel links bzw. rechts herbeilocken.
  if (isPlaying && phase === 'kugel1') {
    if (updateKugel(kugel1, deltaTime)) {
      kugelEinfangen(kugel1);
      szene1Rechts();
    }
  }
  if (isPlaying && phase === 'kugel2') {
    if (updateKugel(kugel2, deltaTime)) {
      kugelEinfangen(kugel2);
      szene1Profi();
    }
  }

  // SZENE 2: Kopfdrehung → Abspielgeschwindigkeit von Fink + Natur-Bett.
  if (isPlaying && phase === 'fink') {
    // t: 0 = ganz links (Original), 1 = ganz rechts (maximal langsam)
    const t = (FINK_YAW_LINKS - yaw) / (FINK_YAW_LINKS - FINK_YAW_RECHTS);

    // playbackRate wirkt wie eine Bandmaschine: langsamer UND tiefer.
    // Jede Frame neu gesetzt sind die Schritte so klein, dass es gleitet.
    fink.rate = lerp(1, FINK_MIN_RATE, t);
    fink.player.playbackRate = fink.rate;

    // Das Natur-Bett macht dieselbe Bewegung mit – alle 16 Ambisonics-Kanäle
    // werden identisch verlangsamt, deshalb bleiben die Richtungen erhalten.
    if (nature2.source) nature2.source.playbackRate.value = lerp(1, AMBI_MIN_RATE, t);

    // Loop-Länge mitziehen: fink.wav hat nach den Rufen eine lange Pause.
    // Je weiter rechts, desto früher springt der Loop zurück – die Rufe
    // rücken zusammen und man hört die versteckte Melodie dichter.
    const dauer = fink.player.buffer.duration;
    if (dauer > 0) {
      fink.loop = lerp(dauer, FINK_LOOP_MIN, t);
      fink.player.loopEnd = fink.loop;
    }

    // Der Vogel schwebt immer FINK_DIST Meter in Blickrichtung.
    // X wird negiert – Audio- und Visuell-Achse sind gespiegelt (s.o.).
    const fwdX =  Math.sin(yaw) * Math.cos(pitch);
    const fwdY =  Math.sin(pitch);
    const fwdZ = -Math.cos(yaw) * Math.cos(pitch);
    fink.quelle.setPosition(-FINK_DIST * fwdX, FINK_DIST * fwdY, FINK_DIST * fwdZ);
  }

  // SZENE 3: der "Lupe"-Scanner über die Instrumente.
  if (isPlaying && phase === 'musik') {
    // Blickrichtung in Grad. Das Minus dreht das yaw-Vorzeichen der AirPods
    // passend zu den Instrument-Winkeln (rechts schauen = Cello/Gitarre).
    const blickGrad = -yaw * 180 / Math.PI;

    for (const inst of orchester) {
      // Winkel-Abstand zwischen Blick und Instrument, auf -180…180 normiert.
      let diff = blickGrad - inst.winkel;
      diff = Math.abs(((diff + 180) % 360 + 360) % 360 - 180);

      // Im "Strahl" der Lupe? → Ziel-Pegel 1, sonst 0.
      const ziel = diff < SCANNER_BEAM_HALB ? 1 : 0;

      // Rauf geht schnell (Attack), runter langsam (Decay).
      const dauer = ziel > inst.pegel ? SCANNER_ATTACK_SEK : SCANNER_DECAY_SEK;
      const schritt = deltaTime / dauer;
      if (ziel > inst.pegel) inst.pegel = Math.min(ziel, inst.pegel + schritt);
      else                   inst.pegel = Math.max(ziel, inst.pegel - schritt);

      // Pegel (0…1) in dB: 1 → 0 dB, 0.5 → -6 dB, ~0 → praktisch stumm.
      musik[inst.name].vol.volume.value =
        inst.pegel > 0.001 ? 20 * Math.log10(inst.pegel) : -Infinity;
    }
  }

  // 4. HUD aktualisieren – kleine Live-Anzeige zum Entwickeln.
  const aktiveKugel = phase === 'kugel2' ? kugel2 : kugel1;
  document.getElementById('hud').innerHTML =
    `yaw &nbsp;${yaw.toFixed(2)}<br>` +
    `phase ${phase}<br>` +
    `HP &nbsp;&nbsp;${headphonesOn ? 'auf' : 'ab'}<br>` +
    `dist ${aktiveKugel.dist.toFixed(2)} m<br>` +
    `rate ${fink.rate.toFixed(2)}<br>` +
    `ctx &nbsp;${audioCtx ? audioCtx.state : '–'}`;

  // 5. Bild zeichnen + nächsten Frame anfordern (die Schleife).
  kopf3d.render();
  window.requestAnimationFrame(tick);
}


// ─── START ─────────────────────────────────────────────────────────────────
// In der Ausstellung läuft Chrome mit dem Flag
// --autoplay-policy=no-user-gesture-required (siehe start.sh) – dann darf
// Audio ohne Klick starten. Die Experience selbst wartet danach auf das
// Aufsetzen der Kopfhörer (onHeadphonesOn).
// Beim normalen Entwickeln blockiert der Browser das Audio → der
// Klick/Tastendruck unten ist der Fallback zum Entsperren.

function setzeHint(text) {
  const hint = document.getElementById('hint');
  hint.textContent = text;
  hint.classList.remove('hidden');
}

function starteExperience() {
  if (laeuft) return; // läuft schon – nichts doppelt starten
  laeuft = true;
  document.getElementById('hint').classList.add('hidden');
  starteTick();
  // kurze Ruhe, bevor die Stimme beginnt
  spaeter(() => intro(), 2000);
}

initAudio()
  .then(() => starteTick()) // Kopf ist sofort live, Experience wartet auf Kopfhörer
  .catch(err => console.warn('Auto-Start nicht möglich (kein Autoplay-Flag?) – warte auf Klick/Taste.', err));

async function ersterKlick() {
  try {
    await initAudio();
    if (isPlaying) {
      window.removeEventListener('click', ersterKlick);
      window.removeEventListener('keydown', ersterKlick);
      starteTick();
    }
  } catch (error) {
    console.error('Fehler beim Audio-Start:', error);
  }
}
window.addEventListener('click', ersterKlick);
window.addEventListener('keydown', ersterKlick);

// DEV-Helfer: mit "?auto" in der URL (http://localhost:3000/?auto) simulieren
// wir das Aufsetzen direkt nach dem Laden – praktisch ohne AirPods.
if (new URLSearchParams(location.search).has('auto')) {
  const warteAufAudio = setInterval(() => {
    if (isPlaying) {
      clearInterval(warteAufAudio);
      headphonesOn = true;
      onHeadphonesOn();
    }
  }, 200);
}
