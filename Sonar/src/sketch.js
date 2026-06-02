// Sonar Pingpong
// Eine Schallquelle steht fest rechts im Raum.
// Je mehr du in ihre Richtung schaust, desto näher kommt sie
// und desto schneller pingt sie.
//
// Architektur:
//   Three.js  → 3D-Visualisierung (Wireframe-Kopf + Klangquelle)
//   Tone.js   → Synth + Scheduling
//   Resonance → 3D-Positionierung des Klangs
//   WebSocket → Kopfrotation von den AirPods

import * as THREE from 'three';
import * as Tone from 'tone';
import { ResonanceAudio } from 'resonance-audio';



// ─── GRÖSSE ────────────────────────────────────────────────────────────────

const sizes = {
  width:  window.innerWidth,
  height: window.innerHeight
};

window.addEventListener('resize', () => {
  sizes.width  = window.innerWidth;
  sizes.height = window.innerHeight;

  cam.aspect = sizes.width / sizes.height;
  cam.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});



// ─── SCENE ─────────────────────────────────────────────────────────────────

const canvas = document.querySelector('canvas.webgl');
const scene  = new THREE.Scene();



// ─── KAMERA ────────────────────────────────────────────────────────────────
// Etwas erhöht und leicht schräg von oben – so sieht man den Kopf und
// die Klangquelle gleichzeitig gut.

const cam = new THREE.PerspectiveCamera(50, sizes.width / sizes.height, 0.1, 100);
// Over-the-shoulder: Kamera sitzt HINTER dem Kopf (−Z).
// Wir sehen den Hinterkopf. Nase zeigt von uns weg = Blickrichtung des Users.
cam.position.set(0, 0, -8);
cam.lookAt(0, 0, 0);
scene.add(cam);



// ─── RENDERER ──────────────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000);



// ─── KOPF-GRUPPE ───────────────────────────────────────────────────────────
// Alles was sich mit dem Headtracking dreht, kommt in diese Gruppe.
// head.rotation.y = yaw, .x = pitch, .z = roll

const head = new THREE.Group();
scene.add(head);

// Hauptkopf: SphereGeometry mit wireframe:true für den Gitter-Look
const headMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.75, 14, 10),
  new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true })
);
head.add(headMesh);

// Nase: zeigt an, wohin der Kopf schaut (+Z = aus dem Kopf raus)
const noseMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 8, 6),
  new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true })
);
noseMesh.position.set(0, -0.05, 0.82);
head.add(noseMesh);

// Ohren: links und rechts
const earGeo = new THREE.SphereGeometry(0.1, 8, 6);
const earMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });

const leftEar  = new THREE.Mesh(earGeo, earMat);
leftEar.position.set(-0.82, 0, 0);
head.add(leftEar);

const rightEar = new THREE.Mesh(earGeo, earMat);
rightEar.position.set( 0.82, 0, 0);
head.add(rightEar);



// ─── KLANGQUELLE ───────────────────────────────────────────────────────────
// Kleine Kugel die sich auf der X-Achse bewegt.
// Richtung: immer rechts (+X). Abstand: sourceDist (ändert sich per Headtracking).

const srcMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 10, 8),
  new THREE.MeshBasicMaterial({ color: 0xffffff })
);
scene.add(srcMesh);

// Verbindungslinie: Kopf → Quelle (zeigt Distanz visuell)
const lineGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(1, 0, 0), // wird jedes Frame aktualisiert
]);
const lineMesh = new THREE.Line(
  lineGeo,
  new THREE.LineBasicMaterial({ color: 0x333333 })
);
scene.add(lineMesh);



// ─── PING-RING ─────────────────────────────────────────────────────────────
// Wenn ein Ton ausgelöst wird, expandiert eine Drahtgitter-Kugel von der Quelle aus.

const pingMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1, 8, 6),
  new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0 })
);
scene.add(pingMesh);



// ─── DISTANZRINGE (Boden-Gitter) ───────────────────────────────────────────
// Konzentrische Kreise in der XZ-Ebene (y=0) als räumliche Orientierungshilfe.
// Sehr dunkel – kaum sichtbar, aber geben dem Raum eine Tiefe.

for (let r = 1; r <= 7; r++) {
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x111111 })
  ));
}



// ─── HEADTRACKING (WebSocket) ───────────────────────────────────────────────
// Der Swift Headtracker schickt Euler-Winkel als JSON über WebSocket.

const ws = new WebSocket('ws://localhost:8080');

let yaw   = 0; // links/rechts
let pitch = 0; // nicken
let roll  = 0; // kippen

let rawYaw = 0, rawPitch = 0, rawRoll = 0;
let offsetYaw = 0, offsetPitch = 0, offsetRoll = 0;
let calibrated = false;

ws.onmessage = (event) => {
  const d  = JSON.parse(event.data);
  rawYaw   = d.yaw;
  rawPitch = d.pitch;
  rawRoll  = d.roll;

  // Automatische Kalibrierung beim ersten Signal:
  // CMHeadphoneMotionManager startet mit einem "arbitrary" Referenzrahmen –
  // die AirPods wissen nicht was "vorwärts" ist. Erste Messung = Null-Offset.
  if (!calibrated) {
    reset();
    calibrated = true;
  }

  yaw   = rawYaw   - offsetYaw;
  pitch = rawPitch - offsetPitch;
  roll  = rawRoll  - offsetRoll;
};

function reset() {
  offsetYaw   = rawYaw;
  offsetPitch = rawPitch;
  offsetRoll  = rawRoll;
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'r') reset();
});



// ─── SONAR-LOGIK ───────────────────────────────────────────────────────────
// Wie sehr schaut man in Richtung der Quelle?
//
//   Blickvektor (horizontal):  (sin(yaw), 0, -cos(yaw))
//   Quell-Richtung (normiert): (1, 0, 0)  →  Quelle ist immer rechts
//
//   Dot-Product = Projektion des Blickvektors auf Quell-Richtung
//   → 1 = direkt draufgeschaut, -1 = genau weggeschaut, 0 = 90°
//
// Das Ergebnis wird auf [0..1] geclamped (nur die "richtige" Seite zählt).

function getAlignment() {
  const fwdX = Math.sin(yaw);
  const fwdZ = -Math.cos(yaw);
  // Dot-Product mit Quell-Richtung.
  // Vorzeichen: positive yaw = Kopf dreht links (AirPods-Konvention).
  // Quelle ist links → positiv wenn man nach links schaut → sin(yaw) direkt verwenden.
  return fwdX;
}

// Quelle: feste Richtung −X (links), variables Abstand
const DIST_FAR   = 6;    // Meter wenn man wegschaut
const DIST_NEAR  = 0.5;  // Meter wenn man direkt draufschaut

// Ping-Intervall
const INTERVAL_SLOW = 2000; // ms – langsamer Puls
const INTERVAL_FAST  =  150; // ms – schneller Puls

let sourceDist     = DIST_FAR;
let pingIntervalMs = INTERVAL_SLOW;



// ─── AUDIO (Tone.js + Resonance Audio) ────────────────────────────────────
// Erst nach einem User-Klick starten (Browser-Policy für Audio).

let isPlaying      = false;
let resonanceScene = null;
let resonanceSource= null;
let synth          = null;
let pingTimeoutId  = null;
let lastPingTime   = 0; // THREE.Clock-Sekunden

// Rekursiver Ping-Scheduler: liest pingIntervalMs bei jedem Aufruf neu
function triggerPing() {
  if (!isPlaying) return;
  synth.triggerAttackRelease('C5', '16n');
  lastPingTime = clock.getElapsedTime();
  pingTimeoutId = setTimeout(triggerPing, pingIntervalMs);
}

window.addEventListener('click', async () => {
  if (isPlaying) return;

  // AudioContext + Tone.js
  const audioCtx = new AudioContext();
  Tone.setContext(audioCtx);
  await audioCtx.resume();

  // Resonance Audio Szene: 3D-Raumakustik mit Ambisonics Order 3
  resonanceScene = new ResonanceAudio(audioCtx, { ambisonicOrder: 3 });
  resonanceScene.output.connect(audioCtx.destination);

  resonanceScene.setRoomProperties(
    { width: 8, height: 4, depth: 8 },
    {
      left: 'brick-bare', right: 'brick-bare',
      front: 'brick-bare', back: 'brick-bare',
      down: 'parquet-on-concrete', up: 'wood-ceiling'
    }
  );

  // Klangquelle in der Szene
  resonanceSource = resonanceScene.createSource();
  resonanceSource.setPosition(-DIST_FAR, 0, 0); // Startposition sofort setzen (nicht 0,0,0)

  // Sinus-Synth: kurzer, sauberer Ping-Ton
  // oscillator.type "sine" = reiner Sinuston (kein Oberton-Overlay)
  // decay 0.5 = klingt 0.5s nach und verschwindet dann
  synth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.005, decay: 0.5, sustain: 0, release: 0.2 }
  }).connect(resonanceSource.input);

  isPlaying = true;

  // Hint-Text ausblenden
  document.getElementById('hint').classList.add('hidden');

  triggerPing();
});



// ─── ANIMATION LOOP ────────────────────────────────────────────────────────
// tick() wird 60× pro Sekunde aufgerufen (requestAnimationFrame).
// Genau das Pattern aus den Three.js-Übungen.

const clock = new THREE.Clock();

const tick = () => {
  const elapsedTime = clock.getElapsedTime();


  // 1. KOPF-ROTATION aus Headtracking
  // Euler-Reihenfolge YXZ: yaw zuerst, dann pitch – natürlich für Kopfbewegung
  head.rotation.order = 'YXZ';
  head.rotation.y =  yaw;
  head.rotation.x =  pitch;
  head.rotation.z =  roll;


  // 2. ALIGNMENT berechnen + Parameter interpolieren
  if (isPlaying && resonanceSource) {
    const a = Math.max(0, getAlignment()); // 0..1 (nur positive Seite)
    const t = a * a; // quadratisch → stärker sobald man fast direkt draufschaut

    sourceDist     = DIST_FAR  + (DIST_NEAR  - DIST_FAR)  * a;
    pingIntervalMs = INTERVAL_SLOW + (INTERVAL_FAST - INTERVAL_SLOW) * t;

    // 3. RESONANCE-QUELLE positionieren
    // Audio: −X = linkes Ohr des Hörers (Resonance-Konvention unverändert)
    resonanceSource.setPosition(-sourceDist, 0, 0);

    // 4. LISTENER-ORIENTIERUNG: wie der Kopf im Raum steht
    // Aus Euler-Winkeln → 3D-Vorwärtsvektor berechnen
    const fwdX =  Math.sin(yaw) * Math.cos(pitch);
    const fwdY =  Math.sin(pitch);
    const fwdZ = -Math.cos(yaw) * Math.cos(pitch);
    resonanceScene.setListenerOrientation(fwdX, fwdY, fwdZ, 0, 1, 0);
  }


  // 5. KLANGQUELLE MESH positionieren
  // Visuell: +X → erscheint LINKS auf dem Screen (Back-Camera spiegelt X)
  // Audio:   −X → linkes Ohr (s.o.) — beide Seiten stimmen für den User überein
  srcMesh.position.set(sourceDist, 0, 0);


  // 6. VERBINDUNGSLINIE aktualisieren
  // BufferGeometry positions array direkt schreiben: [x0,y0,z0, x1,y1,z1]
  const posArr = lineMesh.geometry.attributes.position.array;
  posArr[3] = sourceDist; // Endpunkt X
  lineMesh.geometry.attributes.position.needsUpdate = true;


  // 7. PING-RING animieren: expandiert von der Quelle aus und wird transparent
  const dtPing = elapsedTime - lastPingTime; // Sekunden seit letztem Ping
  if (dtPing < 1.5 && isPlaying) {
    const progress = dtPing / 1.5;           // 0 → 1
    const scale    = sourceDist * 0.6 * progress;
    pingMesh.position.set(sourceDist, 0, 0);
    pingMesh.scale.setScalar(scale);
    pingMesh.material.opacity = 1 - progress;
  } else {
    pingMesh.scale.setScalar(0);
    pingMesh.material.opacity = 0;
  }


  // 8. HUD aktualisieren
  const bpm = 60000 / pingIntervalMs;
  document.getElementById('hud').innerHTML =
    `yaw &nbsp;${yaw.toFixed(2)}<br>` +
    `dist ${sourceDist.toFixed(2)} m<br>` +
    `bpm &nbsp;${bpm.toFixed(1)}`;


  // 9. RENDERN
  renderer.render(scene, cam);
  window.requestAnimationFrame(tick);
};

tick();
