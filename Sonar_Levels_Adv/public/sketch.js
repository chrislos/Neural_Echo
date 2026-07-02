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

// Wir laden drei externe Libraries als ES-Module.
// "import * as THREE" bedeutet: alles was three.js exportiert landet unter dem Namen THREE –
// danach können wir THREE.Scene, THREE.Mesh usw. schreiben.


// Notiz alle funktionen als export den anderen dateien erhältlich machen!!!
import * as THREE from 'three';
import * as Tone from 'tone';
import { ResonanceAudio } from 'resonance-audio';
import { pingpong } from 'three/src/math/MathUtils.js';


let ambiSource;   
let ambiSource2; 
let ambiGain;
let ambiGain2;
let isSonarActive = false; //Check für die Kugel in Scene 3
let isSonarActive3 = false; //Check für die Kugel in Scene 4



// ─── GRÖSSE ────────────────────────────────────────────────────────────────

// Wir benutzen die native window-Funktion um die Fenstergröße (innerWidth / innerHeight)
// in Pixel als Objekt anzulegen. So müssen wir die Werte nicht zweimal hinschreiben.
const sizes = {
  width:  window.innerWidth,
  height: window.innerHeight
};

// window.addEventListener lauscht auf Browser-Events. "resize" feuert jedes Mal,
// wenn das Fenster skaliert wird. Wir aktualisieren sizes, Kamera und Renderer
// damit das Bild nicht verzerrt oder abgeschnitten wird.
window.addEventListener('resize', () => {
  // wir überschreiben die neuen width/height werte
  sizes.width  = window.innerWidth;
  sizes.height = window.innerHeight;

  //unsere kamera bekommt die gleiche ratio wie unser browser dimensionen
  cam.aspect = sizes.width / sizes.height;
  // three js muss die camera matrix auch aktualisieren wenn wir die ratio öbderb
  cam.updateProjectionMatrix();

  // unser renderer bekommt die gleiche ratio
  renderer.setSize(sizes.width, sizes.height);

  // wir achten darauf dass unser renderer maximal eine dpi ration von 2 hat (retina) und nicht unnötig größer
  // Math.min gibt immer den niedrigsten wert aus. (in unserem Fall also max 2)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});



// ─── SCENE ─────────────────────────────────────────────────────────────────

// Das Canvas-Element holen wir uns direkt aus dem DOM – es ist in index.html definiert.
// THREE.Scene ist der unsichtbare Container, in dem alle 3D-Objekte leben.
// Nichts wird gerendert, solange es nicht zur Scene hinzugefügt wurde.

// canvas sitzt als html element im index.html inkl der klasse webgl
const canvas = document.querySelector('canvas.webgl');

// wir erstellen unsere three js scene (fast analog zur späteren resonance audio scene)
const scene  = new THREE.Scene();



// ─── KAMERA ────────────────────────────────────────────────────────────────

// PerspectiveCamera simuliert das menschliche Auge: weiter entfernte Objekte
// erscheinen kleiner (Zentralperspektive). Die vier Parameter sind:
// Blickwinkel (50°), Seitenverhältnis, Nah-Clipping (0.1m), Fern-Clipping (100m).
// Kamera sitzt vor  dem der mesh kugel, die den kopf repräsentiert (Z). 
// wir sehen den Hinterkopf, weil wir das Mesh des Kopfes um 180grad drehen
const cam = new THREE.PerspectiveCamera(50, sizes.width / sizes.height, 0.1, 100);

// die +z achse kommt aus dem screen raus zum betrachter. wir sitzen bei +8 auf der z achse – direkt vor dem kopf –
// und schauen auf das gesicht. visuell und audio haben jetzt gleiche vorzeichen – keine spiegelung mehr.
cam.position.set(0, 0, 8);

// wir schauen auf den 0 punkt
cam.lookAt(0, 0, 0);

// und wir adden die kamera zur scene
scene.add(cam);



// ─── RENDERER ──────────────────────────────────────────────────────────────

// Der WebGLRenderer übersetzt die 3D-Szene in Pixel und zeichnet sie auf das Canvas.
// setPixelRatio begrenzt auf 2 – auf Retina-Displays mit höherem Ratio würde es
// sonst unnötig viel Rechenleistung kosten.
const renderer = new THREE.WebGLRenderer({ 
  canvas: canvas, 
  antialias: true 
});

renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000);



// ─── KOPF-GRUPPE ───────────────────────────────────────────────────────────

// THREE.Group ist ein leerer Container – kein sichtbares Objekt, aber er hat
// eine Position und Rotation. Alles was wir in die Gruppe packen dreht sich
// mit, wenn wir head.rotation setzen. So bewegen Kopf, Nase und Ohren sich gemeinsam.
const head = new THREE.Group();
scene.add(head);

const lineColor = '#626262'

// Ein Mesh besteht immer aus zwei Teilen: Geometry (Form) + Material (Aussehen).
// wireframe: true zeichnet nur die Kanten des Gitters, nicht die Flächen.
const headMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.75, 28, 20), // radius in metern, anzahl vertikaler Segmente, anzahl horizontaler elemente
  new THREE.MeshBasicMaterial({ 
    color: lineColor, 
    wireframe: true 
  })
);
head.add(headMesh);

// Nase: zeigt an, wohin der Kopf schaut (+Z = aus dem Kopf raus)
const noseMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 8, 6),
  new THREE.MeshBasicMaterial(
    { color: lineColor, 
      wireframe: true 
    })
);
noseMesh.position.set(0, -0.05, 0.82);
head.add(noseMesh);

// Geometrie und Material werden für beide Ohren geteilt – spart Speicher.


const earGeo = new THREE.SphereGeometry(0.1, 8, 6);
const earMat = new THREE.MeshBasicMaterial({ 
  color: lineColor, 
  wireframe: true 
});

const leftEar  = new THREE.Mesh(earGeo, earMat);

// mit dem property position können wir via set die ohrenpositionen variieren.
leftEar.position.set(-0.82, 0, 0);
head.add(leftEar);

const rightEar = new THREE.Mesh(earGeo, earMat);
rightEar.position.set( 0.82, 0, 0);
head.add(rightEar);



// ─── KLANGQUELLE ───────────────────────────────────────────────────────────

// Die Klangquelle ist eine kleine Kugel ohne wireframe – damit sie sich
// vom Kopf-Gitter abhebt. Sie sitzt NICHT in der head-Gruppe, weil sie
// sich nicht mit dem Kopf dreht – ihre Position ist fest im Raum.
// Insgesamt befinden sich hier 5 Kugeln (1 für den Start 4 weitere für Scene4)
const srcMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 20, 10),
  new THREE.MeshBasicMaterial({ color: "#ff0000" })
);
scene.add(srcMesh);
srcMesh.visible = false;

//Scene 4 Kugeln 
const Scene3K = new THREE.Mesh(  
  new THREE.SphereGeometry(0.12, 20, 10),
  new THREE.MeshBasicMaterial({ color: "#ff0000" })
);
scene.add(Scene3K);
Scene3K.visible = false;

// const Scene4K2 = new THREE.Mesh(  
//   new THREE.SphereGeometry(0.12, 20, 10),
//   new THREE.MeshBasicMaterial({ color: "#ff0000" })
// );
// scene.add(Scene4K2);
// Scene4K2.visible = false;

// const Scene4K3 = new THREE.Mesh(  
//   new THREE.SphereGeometry(0.12, 20, 10),
//   new THREE.MeshBasicMaterial({ color: "#ff0000" })
// );
// scene.add(Scene4K3);
// Scene4K3.visible = false;

// const Scene4K4 = new THREE.Mesh(  
//   new THREE.SphereGeometry(0.12, 20, 10),
//   new THREE.MeshBasicMaterial({ color: "#ff0000" })
// );
// scene.add(Scene4K4);
// Scene4K4.visible = false;
// //Änderungsvorschlag -> For Schleife??


// ─── Lineare Interpolationsfunktion ───────────────────────────────────────────────────────────
function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}



// ─── PING-RING ─────────────────────────────────────────────────────────────

// transparent: true + opacity: 0 macht das Mesh unsichtbar – es ist trotzdem
// in der Szene und kann per Animation ein- und ausgeblendet werden.
// Im tick() lassen wir es bei jedem Ping aufblitzen und expandieren.
const pingMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1, 100, 50),
  new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    wireframe: true, 
    transparent: true, 
    opacity: 0 
  })
);
scene.add(pingMesh);


// ─── HEADTRACKING (WebSocket) ───────────────────────────────────────────────

// WebSocket ist eine native Browser-API für eine persistente Zwei-Wege-Verbindung.
// Wir verbinden uns zur Swift-App die auf Port 8080 läuft und AirPods-Daten sendet.
// ws.onmessage wird jedes Mal aufgerufen wenn ein neues Datenpaket ankommt.
const ws = new WebSocket('ws://localhost:8080');

let yaw   = 0; // links/rechts
let pitch = 0; // nicken
let roll  = 0; // kippen

let rawYaw = 0, rawPitch = 0, rawRoll = 0;
let offsetYaw = 0, offsetPitch = 0, offsetRoll = 0;
let calibrated = false;

// Headphones-Zustand: das ist die zentrale Boolean, die das ganze Spiel steuert.
// false = Kopfhörer hängt im Ausstellungsraum / liegt ab.
// true  = jemand trägt ihn und bewegt den Kopf.
let headphonesOn = false;

// Bewegungs-Erkennung – bewusst ZEIT-basiert statt frame-basiert:
// Die Bridge sendet mit 60fps, die AirPods liefern aber langsamer → es kommen
// oft doppelte Frames mit identischem Wert (aenderung == 0). Ein "Frames-in-Folge"-
let referenzYaw = 0;        // letzter "eingerasteter" yaw-Wert
let letzteBewegung = 0;     // Zeitpunkt (ms) der letzten echten Bewegung

const BEWEGUNGS_SCHWELLE = 0.000000015; // ab wie viel yaw-Änderung zählt es als Bewegung (rad)
const AB_TIMEOUT = 5000;         // ms ohne Bewegung → Kopfhörer gilt als abgelegt

ws.onmessage = (event) => {
  // wir entpacken d aus dem data property dass uns der websocket im package mitliefert als json
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

  // ─── KOPFHÖRER AUF / AB ERKENNEN ───
  const jetzt = performance.now(); // performance ist ein globale object wie window, console etc.

  // Hat sich yaw seit dem letzten "eingerasteten" Referenzwert deutlich bewegt?
  // (Richtung egal → Math.abs). Doppelte Frames ändern nichts → harmlos.
  //
  // Warum das gegen Doppel-Frames immun ist:
  // Sind yaw(t-1) und yaw(jetzt) gleich (Doppel-Frame), ist der Abstand zur
  // Referenz identisch → wir gehen NICHT in die if. referenzYaw bleibt stehen,
  // letzteBewegung bleibt stehen. Erst wenn nach dem/den Doppel-Frame(s) ein
  // neuer Wert die BEWEGUNGS_SCHWELLE wieder reißt, gehen wir rein undok
  // überschreiben letzteBewegung mit dem aktuellen (größeren) ms-Wert.
  // Dadurch ist (jetzt - letzteBewegung) wieder klein → kleiner als AB_TIMEOUT
  // → die zweite if (ABNEHMEN) bleibt inaktiv.
  //
  // Hinweis: referenzYaw ist nicht "der letzte Frame", sondern der zuletzt
  // EINGERASTETE Bewegungspunkt – er steht still, bis ein Wert relativ zu IHM
  // die Schwelle überschreitet.

  if (Math.abs(yaw - referenzYaw) > BEWEGUNGS_SCHWELLE) {
    referenzYaw    = yaw;     // Referenz nachziehen
    letzteBewegung = jetzt;   // Zeitpunkt der Bewegung merken

    // AUFSETZEN: Es bewegt sich und der Kopfhörer galt als "ab" → jemand trägt ihn.
    if (!headphonesOn) {
      headphonesOn = true;
      onHeadphonesOn();
    }
  }

  // ABNEHMEN: Kopfhörer galt als "auf", aber seit AB_TIMEOUT ms keine Bewegung
  // mehr → er hängt wieder im Raum. Das setzt das Spiel zurück.
  if (headphonesOn && jetzt - letzteBewegung > AB_TIMEOUT) {
    headphonesOn = false;
    onHeadphonesOff();
  }
};

// reset() speichert die aktuelle Kopfposition als "Nullstellung".
// Danach sind alle Winkel relativ zu dieser Position.
function reset() {
  offsetYaw   = rawYaw;
  offsetPitch = rawPitch;
  offsetRoll  = rawRoll;
}

window.addEventListener('keydown', (e) => {
  // e ist ein KeyboardEvent-Objekt. dessen property key die gedrückte taste liefert. wenn r gedrückt wird resseten wir die aktuellen offsets.
  if (e.key === 'r') reset();
});



// ─── SONAR-LOGIK ───────────────────────────────────────────────────────────

// Stell dir vor du stehst in einem Raum und ein Lautsprecher ist links von dir.
// Diese Funktion berechnet: schaust du gerade in seine Richtung – oder weg?
//
// Dafür benutzen wir zwei Vektoren (Pfeile im 2D-Raum):
//   fwdX / fwdZ  →  wohin schaut dein Kopf gerade? (aus dem yaw-Winkel berechnet)
//   srcX / srcZ  →  wo steht die Klangquelle? (immer auf der +X Achse, also links)
//
// Das Dot-Product multipliziert die zwei Pfeile miteinander:
//   Ergebnis  1 = beide Pfeile zeigen in die gleiche Richtung → direkt draufgeschaut
//   Ergebnis  0 = Pfeile stehen 90° aufeinander               → Quelle ist seitlich
//   Ergebnis -1 = Pfeile zeigen in entgegengesetzte Richtung  → komplett abgewandt
//
// Weil die Quelle immer bei srcX=1, srcZ=0 sitzt kürzt sich die Rechnung:
// fwdX*1 + fwdZ*0 = fwdX  →  es bleibt nur Math.sin(yaw) übrig.

// https://www.youtube.com/watch?v=LyGKycYT2v0

/*
  Grundprinzip: Jeder Winkel lässt sich in einen Richtungspfeil (Vektor) umrechnen:
  X = sin(winkel)
  Z = cos(winkel)
  
  Stell dir eine Uhr von oben vor:
  - yaw = 0 (geradeaus) → sin(0) = 0, cos(0) = 1 → Pfeil zeigt in +Z
  - yaw = 90° (links) → sin(90°) = 1, cos(90°) = 0 → Pfeil zeigt in +X
  - yaw = -90° (rechts) → sin(-90°) = -1 → Pfeil zeigt in -X

  Warum -cos?
  Das Minus dreht den Nullpunkt um — in unserer Szene zeigt der Kopf bei yaw=0 in -Z (in den Bildschirm rein), nicht in +Z. Das - passt das an die Koordinaten-Konvention der AirPods
  an.

*/

function getAlignment(srcX, srcZ) {
  // fwd geht von 1 bis -1 da yaw als radians winkel -2pi bis 2pi  geht  
  // daraus bekommen wir einen foward schauenden x/z vector im wertebereich von (-1 bis 1, -1 bis 1)    

  const fwdX = Math.sin(yaw);   // Blickvektor horizontal (X)
  const fwdZ = Math.cos(yaw);  // Blickvektor horizontal (Z)


  // let dotProduct = fwdX * srcX + fwdZ * srcZ; // Dot-Product → vereinfacht sich zu fwdX
  /*
  yaw = 0 (geradeaus):
  - fwdX = sin(0) = 0
  - dot = 0 * 1 + 0 * 0 = 0 --> Quelle ist 90° seitlich, keine Übereinstimmung

  yaw = π/2 (links, zur Quelle hin):
  - fwdX = sin(π/2) = 1
  - dot = 1 * 1 + 0 * 0 = 1 --> direkt draufgeschaut

  yaw = -π/2 (rechts, von Quelle weg):
  - fwdX = sin(-π/2) = -1
  - dot = -1 * 1 + 0 * 0 = -1 --> komplett abgewandt

  */
  return fwdX * srcX + fwdZ * srcZ
}

// DIST_FAR / DIST_NEAR definieren wie nah die Quelle kommen kann.
// Großbuchstaben = Konvention für Konstanten die sich nie ändern.
const DIST_FAR   = 6;
const DIST_NEAR  = 1;

const INTERVAL_SLOW = 2000; // ms – langsamer Puls wenn man wegschaut
const INTERVAL_FAST  =  150; // ms – schneller Puls wenn man direkt draufschaut

// wir starten initial:
let sourceDist     = DIST_FAR;
let sourceDist3   = DIST_FAR;
let pingIntervalMs = INTERVAL_SLOW;



// ─── AUDIO (Tone.js + Resonance Audio) ────────────────────────────────────

// Normalerweise erlauben Browser keinen Ton ohne Nutzer-Interaktion (Autoplay-Policy).
// Mit dem Chrome-Start-Flag --autoplay-policy=no-user-gesture-required umgehen wir das
// und starten den Sound direkt beim Laden (siehe initAudio unten).
// Die Audio-Variablen werden hier als null deklariert und erst in initAudio() befüllt.
let isPlaying      = false;
let audioInitStarted = false; // verhindert doppeltes initAudio() (Auto-Start + Klick gleichzeitig)
let startPending   = false;   // Kopfhörer wurde aufgesetzt, bevor Audio fertig geladen war
let resonanceScene = null;
let resonanceSource= null;
let resonanceSource3= null;
let synth          = null;
let pingTimeoutId  = null;
let lastPingTime   = 0;

let audioCtx = null;

// voiceSource = eine fixe binaurale Quelle VOR dem Hörer, durch die alle
// Instruktions-Stimmen laufen. sounds = zentrale Ablage der vorgeladenen Player.
let voiceSource = null;
let soundsSource = null;
const sounds = {}; //machen es global damit andere es lesen können
const soundsBall = {};
const soundsBall3 = {};
const soundsFinal = {}; // Scene5: Stereo-Bett + 4 Instrument-Layer (Stereo-Bett direkt, Instrumente durch Resonance)

// ─── SCENE 5: "Lupe"-Scanner über das Orchester ───
// Idee: Man fährt mit dem Kopf über 4 Instrumente, die vor einem im Halbkreis
// stehen. Das Instrument, in dessen Richtung man schaut, fadet SCHNELL ein
// (Attack). Schaut man weg, klingt es LANGSAM aus (Decay) und bleibt so noch
// eine Weile stehen – wie eine Lupe, mit der man die Klangflächen erkundet.
let scene5Active = false; // schaltet den Scanner im tick() an

// Jedes Instrument hat einen Winkel (wie in initAudio positioniert) und einen
// aktuellen Pegel "level" von 0 (stumm) bis 1 (voll). Den Namen nutzen wir, um
// den passenden Volume-Node in soundsFinal zu finden (name + 'Vol').
const orchestra = [
  { name: 'cello', angle:  80, level: 0 }, // ganz rechts
  { name: 'git',   angle:  40, level: 0 }, // halb rechts
  { name: 'piano', angle: -40, level: 0 }, // halb links
  { name: 'flute', angle: -80, level: 0 }, // ganz links
];
const SCANNER_BEAM_HALF  = 25;  // Grad: halbe Breite der "Lupe" (Blick-Toleranz)
const SCANNER_ATTACK_SEK = 2.5; // schnelles Einfaden beim Anschauen
const SCANNER_DECAY_SEK  = 5;   // langsames Ausklingen nach dem Wegschauen

// triggerPing() ruft sich selbst immer wieder auf (rekursiv via setTimeout).
// So kann das Intervall dynamisch ändern – setTimeout liest pingIntervalMs bei
// jedem Aufruf neu, setInterval würde am anfangs gesetzten Wert festhalten.
function triggerPing() {
  // wenn ich noch nicht den audiocontext gestarte habe springe ich sofort aus der triggerPing function().
  if (!isPlaying) return;

  // spiele den C5 ton al 16tel länge
  synth.triggerAttackRelease('C5', '16n');

  // wir messen auch genau wann der letzt Ping ausgelöst wurde. Das brauchen wir für unseren tick scope später...
  lastPingTime = clock.getElapsedTime();

  // wir planen den nächsten triggerPIng aufruf in der zukunft. 
  // Dadurch dass dieser INNERHALB der funktion sitzt haben wir einen endlos loop.
  pingTimeoutId = setTimeout(triggerPing, pingIntervalMs);
}

function fadeOutAmbi(source, gainNode, dauerSek = 2) {
  const jetzt = audioCtx.currentTime;

  // cancelScheduledValues verhindert Konflikte, falls schon ein Fade läuft
  gainNode.gain.cancelScheduledValues(jetzt);
  gainNode.gain.setValueAtTime(gainNode.gain.value, jetzt); // aktuellen Wert "einfrieren"
  gainNode.gain.linearRampToValueAtTime(0, jetzt + dauerSek); // linear auf 0 in dauerSek Sekunden

  // erst NACH dem Fade wirklich stoppen, sonst hört man den Cut trotzdem
  setTimeout(() => source.stop(), dauerSek * 1000);
}

function fadeInAmbi(source, gainNode, dauerSek = 2, startVolume = 1) {
  const jetzt = audioCtx.currentTime;

  // Gain auf 0 setzen BEVOR wir starten, sonst hört man kurz die volle Lautstärke aufblitzen
  gainNode.gain.cancelScheduledValues(jetzt);
  gainNode.gain.setValueAtTime(0, jetzt);

  // Quelle jetzt tatsächlich starten (bei Gain 0, also stumm)
  source.start();

  // und dann über dauerSek Sekunden hochrampen
  gainNode.gain.linearRampToValueAtTime(startVolume, jetzt + dauerSek);
}

// async/await: AudioContext.resume() gibt ein Promise zurück – wir warten mit
// "await" darauf, bevor wir weitermachen. Das stellt sicher dass der Audio-Thread
// wirklich läuft bevor wir Töne erzeugen.

// initAudio() ersetzt den früheren Klick: dank Autoplay-Flag dürfen wir den
// AudioContext direkt beim Laden starten – ganz ohne Maus-Interaktion.
// Wichtig für die Ausstellung: dieser Context wird EINMAL erzeugt und läuft den
// ganzen Tag. headphonesOn/off steuern später nur das Playback, nicht den Context.

let MainVolumeK1 = 0; //Main Lautstärke um zu dividieren
let MainVolumeK2 = 0; //Main Lautstärke um zu dividieren 

async function initAudio() {
  if (audioInitStarted) return; // schützt gegen Auto-Start UND Klick gleichzeitig (isPlaying wird erst am Ende true)
  audioInitStarted = true;
  if (isPlaying) return; // doppelte Initialisierung verhindern

  // AudioContext ist die native Browser-API für alles mit Audio.
  // Tone.js und Resonance Audio bauen beide darauf auf – wir teilen einen Context.
  
  audioCtx = new AudioContext(); 
  await audioCtx.resume();
  
  const toneCtx = new Tone.Context(audioCtx);
  Tone.setContext(toneCtx);

  // es scheint audioCtx.resume() braucht eine weile bis es losgeht. daher deklarieren  wir den sound init callback als async.
  await audioCtx.resume();

  console.log(audioCtx.state);

  // Falls Chrome den Context im Dauerbetrieb mal selbst pausiert (z.B. Tab im
  // Hintergrund), holen wir ihn automatisch wieder zurück.
  audioCtx.onstatechange = () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
  };

  // ResonanceAudio baut einen virtuellen Raum mit Wänden, Boden und Decke.
  // ambisonicOrder: 3 = höhere räumliche Auflösung (rechenintensiver aber besser).
  resonanceScene = new ResonanceAudio(audioCtx, { ambisonicOrder: 3 });
  // wir verbinden die Szene direkt mit unserem audio out (summe)
  resonanceScene.output.connect(audioCtx.destination);

  // wir setzen alles in einen "realen" Raum (reverb)
  resonanceScene.setRoomProperties(
    { width: 10, 
      height: 4, 
      depth: 10 
    },
    {
      // absorbierende Materialien statt 'brick-bare' = deutlich weniger Hall.
      // 'curtain-heavy' schluckt viel, 'acoustic-ceiling-tiles' macht die Decke
      // praktisch schalltot. So bleibt der Klang auch nah an der Quelle trocken.
      left: 'curtain-heavy',
      right: 'curtain-heavy',
      front: 'curtain-heavy',
      back: 'curtain-heavy',
      down: 'parquet-on-concrete',
      up: 'acoustic-ceiling-tiles'
    }
  );

  // createSource() legt eine virtuelle Schallquelle im Raum an.
  // Sofort setPosition() aufrufen – sonst sitzt sie bei (0,0,0), also im Kopf.
  resonanceSource = resonanceScene.createSource();
  resonanceSource3 = resonanceScene.createSource();

  // wir positionieren die Quelle hier -6m auf der x achse, und 0 0 für y und z.
  resonanceSource.setPosition(-DIST_FAR, 0, 0); 
  

  // Tone.Synth erzeugt einen Synthesizer. oscillator.type "sine" = reiner Sinuston.
  // Die envelope steuert die Lautstärke-Hüllkurve: attack (Einschwingen),
  // decay (Abfall), sustain (Halten), release (Ausschwingen).
  // .connect(resonanceSource.input) leitet den Ton durch Resonance Audio.
  synth = new Tone.Synth({
    // volume ist in Dezibel (dB). 0 = voller Pegel, negative Werte = leiser.
    // -8 dB nimmt die Lautstärke spürbar zurück, ohne sie zu stark zu drücken.
    volume: -8,
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.005,
      decay: 0.5,
      sustain: 0,
      release: 0.2 }
  }).connect(resonanceSource.input);

  // ─── VOICE-QUELLE (binaural, fix vor dem Hörer) ───
  // Alle Instruktions-Stimmen laufen durch EINE Resonance-Quelle, die statisch
  // vor dem Hörer sitzt (Ruhe-Blickachse = -Z). Drehst du den Kopf, bleibt die
  // Stimme im Raum verankert statt flach mitzuwandern.
  voiceSource = resonanceScene.createSource(); // 
  soundsSource = resonanceScene.createSource(); // kollektion an stimmen und soundFX
  voiceSource.setPosition(0, 0, -2); // -Z = direkt vor dem Hörer, ca. 2 m
  soundsSource.setPosition(0, 0, -2); // -Z = direkt vor dem Hörer, ca. 2 m
   
  //Ambi
    // const ambiResponse = await fetch('/src/AmbiNature.wav');
    const ambiArrayBuffer = await ladeMitProzent('/src/AmbiNature.wav');
    const ambiBuffer = await audioCtx.decodeAudioData(ambiArrayBuffer);
    ambiSource = audioCtx.createBufferSource();
    ambiSource.buffer = ambiBuffer;
    ambiSource.loop = true;
    
    ambiGain = audioCtx.createGain();
    ambiGain.gain.value = 1; // Startlautstärke voll
    ambiSource.connect(ambiGain);
    ambiGain.connect(resonanceScene.ambisonicInput);

    // //AmbiSound2 (muss wegen API immer komplett neu aufgesetzt werden)
    const ambiArrayBuffer2 = await ladeMitProzent('/src/AmbiNature.wav');
    const ambiBuffer2 = await audioCtx.decodeAudioData(ambiArrayBuffer2);
    ambiSource2 = audioCtx.createBufferSource();
    ambiSource2.buffer = ambiBuffer2;
    ambiSource2.loop = false;
    
    ambiGain2 = audioCtx.createGain();
    ambiGain2.gain.value = 1;
    ambiSource2.connect(ambiGain2);
    ambiGain2.connect(resonanceScene.ambisonicInput);

  // Alle (kurzen) Voice-Files hier zentral vorladen, damit später kein Lade-/
  // Dekodier-Hänger das Timing stört. Tone.Player dekodiert in den RAM – nur für
  // kurze Sprach-Files gedacht, NICHT für die großen Ambisonics-Wavs.

  //Wichtige Notiz: Die Sources sollen natürlich geändert werden!! (Gerade alles gleich)
  sounds.stimme1 = new Tone.Player('/src/till_voice1.wav').connect(voiceSource.input);
  sounds.stimme2 = new Tone.Player('/src/mathisVoice1.wav').connect(voiceSource.input);
  sounds.stimme2.volume.value = 2;
  sounds.stimme3 = new Tone.Player('/src/mathisVoice2.wav').connect(voiceSource.input);

  sounds.swoosh = new Tone.Player('/src/swoosh1.wav').connect(soundsSource.input);
  sounds.swoosh.volume.value = 2;
  sounds.victory = new Tone.Player('/src/Success_End.wav').connect(resonanceSource.input);
  sounds.victory.volume.value = -9;

  //Erstellen der Klangflächen der Kugel (Scene3)
  soundsBall.vol1 = new Tone.Volume(-Infinity); // startet summ
  soundsBall.vol2 = new Tone.Volume(-Infinity);
  soundsBall.vol3 = new Tone.Volume(-Infinity);

  soundsBall.element1 = new Tone.Player({ url: '/src/Layer_1.wav', 
    loop: true})
    .connect(soundsBall.vol1);
  soundsBall.vol1.connect(resonanceSource.input);

  soundsBall.element2 = new Tone.Player({ url: '/src/Layer_2.wav', loop: true })
    .connect(soundsBall.vol2);
  soundsBall.vol2.connect(resonanceSource.input);

  soundsBall.element3 = new Tone.Player({ url: '/src/Layer_3.wav', loop: true })
    .connect(soundsBall.vol3);
  soundsBall.vol3.connect(resonanceSource.input);
  

  //Erstellen der Klangfläche für nächste Kugel (Scene4)
  soundsBall3.vol1 = new Tone.Volume(-Infinity); // startet stumm
  soundsBall3.vol2 = new Tone.Volume(-Infinity);
  soundsBall3.vol3 = new Tone.Volume(-Infinity);

  soundsBall3.element1 = new Tone.Player({ url: '/src/LayerB_1.wav', 
    loop: true,
    volume: -12 })
    .connect(soundsBall3.vol1);
  soundsBall3.vol1.connect(resonanceSource.input);

  soundsBall3.element2 = new Tone.Player({ url: '/src/LayerB_2.wav', loop: true,
    volume: -12  })
    .connect(soundsBall3.vol2);
  soundsBall3.vol2.connect(resonanceSource.input);

  soundsBall3.element3 = new Tone.Player({ url: '/src/LayerB_3.wav', loop: true,
    volume: -12  })
    .connect(soundsBall3.vol3);
  soundsBall3.vol3.connect(resonanceSource.input);

  // ─── SCENE 5: Finale Klangflächen ───
  // Aufteilung:
  //   • Stereo-Bett  → direkt an den Ausgang (Stereo, OHNE Resonance).
  //     .toDestination() = Tone-Hauptausgang, umgeht den Ambisonics-Renderer.
  //   • 4 Instrumente → DURCH Resonance, damit wir sie im Raum positionieren
  //     können (Orchester-Aufstellung vor dem Hörer). Sie drehen sich dann
  //     korrekt mit, wenn man den Kopf bewegt.
  // Alle sind als loop geflaggt (nahtloser Loop) und starten stumm (-Infinity dB);
  // eingefadet wird später in scene5().

  // Stereo-Bett (Grundlage, direkt stereo)
  soundsFinal.stereoVol = new Tone.Volume(-Infinity).toDestination();
  soundsFinal.stereo    = new Tone.Player({ url: '/src/amb_stereo.wav', loop: true, volume: -6 })
    .connect(soundsFinal.stereoVol);

  // ─── Orchester-Aufstellung der 4 Instrumente ───
  // Wir stellen sie in einem Halbkreis VOR den Hörer (Front = -Z, rechts = +X,
  // links = -X). Winkel von der Blickachse aus (positiv = rechts):
  //   Cello   ganz rechts  (+80°)
  //   Gitarre halb rechts  (+40°)
  //   Piano   halb links   (-40°)
  //   Flöte   ganz links   (-80°)
  // Aus Winkel + Radius rechnen wir die x/z-Position:  x = R·sin(a), z = -R·cos(a)
  const ORCH_RADIUS = 6; // Meter Abstand der Instrumente vom Kopf (weiter weg = besser unterscheidbar)
  const winkelZuXZ = (gradWinkel) => {
    const rad = gradWinkel * Math.PI / 180;
    return { x: ORCH_RADIUS * Math.sin(rad), z: -ORCH_RADIUS * Math.cos(rad) };
  };

  // kleine Helfer-Funktion: legt eine positionierte Resonance-Quelle + Player an
  const macheInstrument = (url, gradWinkel) => {
    const src = resonanceScene.createSource();
    const { x, z } = winkelZuXZ(gradWinkel);
    src.setPosition(x, 0, z);
    const vol = new Tone.Volume(-Infinity); // startet stumm
    const player = new Tone.Player({ url, loop: true, volume: -6
     }).connect(vol);
    vol.connect(src.input);
    return { src, vol, player };
  };

  const cello = macheInstrument('/src/amb_cello.wav',  80); // ganz rechts
  soundsFinal.celloSrc = cello.src;
  soundsFinal.celloVol = cello.vol;
  soundsFinal.cello    = cello.player;

  const git = macheInstrument('/src/amb_git.wav',      40); // halb rechts
  soundsFinal.gitSrc = git.src;
  soundsFinal.gitVol = git.vol;
  soundsFinal.git    = git.player;

  const piano = macheInstrument('/src/amb_piano.wav', -40); // halb links
  soundsFinal.pianoSrc = piano.src;
  soundsFinal.pianoVol = piano.vol;
  soundsFinal.piano    = piano.player;

  const flute = macheInstrument('/src/amb_flute.wav', -80); // ganz links
  soundsFinal.fluteSrc = flute.src;
  soundsFinal.fluteVol = flute.vol;
  soundsFinal.flute    = flute.player;

  //   // kurze Sprach-Files gedacht, NICHT für die großen Ambisonics-Wavs.
  // sounds.oneTwo = new Tone.Player('/1-1.mp3').connect(voiceSource.input);
  //   // kurze Sprach-Files gedacht, NICHT für die großen Ambisonics-Wavs.
  // sounds.oneThree = new Tone.Player('/1-1.mp3').connect(voiceSource.input);


  // Tone.loaded() wartet, bis ALLE oben erzeugten Player ihre Buffer dekodiert haben.
  await Tone.loaded();
  console.log("tone.js hat gestartet");

  isPlaying = true;

  // wir haben im html einen kleinen tag:  <div id="hint">click to start &nbsp;·&nbsp; r = reset</div>
  // den zeigen wir nun nicht mehr. in dem wir sagen du bist jetzt hidden im css
  // im style.css ist hinterlegt das die opacity (also der alpha) einfach auf 0 gesetzt wird.
  document.getElementById('hint').classList.add('hidden');

  // Audio ist jetzt bereit. Der Ping-Loop startet aber NICHT hier, sondern erst
  // am Ende der onHeadphonesOn()-Sequenz (2s warten → 1-1.mp3 → dann Pings).

  // Falls der Kopfhörer schon aufgesetzt wurde, während wir noch luden:
  // die Experience jetzt nachholen, statt sie verschluckt zu haben.
  if (startPending) {
    startPending = false;
    onHeadphonesOn();
  }
}

const clock = new THREE.Clock();
let lastFrameTime = 0;

// DEV-Fallback: Ohne das Autoplay-Flag (also im normalen Chrome beim Entwickeln)
// startet der AudioContext "suspended" – resume() bleibt blockiert, bis eine
// Nutzer-Geste kommt. Ein Klick (oder Tastendruck) weckt ihn dann auf.
// In der Ausstellung (mit Flag) läuft der Context schon → der Klick tut hier nichts.
async function handleFirstClick() {
  console.log("--> ERSTER KLICK REGISTRIERT!");
  try {
    // Weckt Tone.js für den Browser auf
    //await Tone.start(); alt
    
    // Startet dein gesamtes Audio-Setup (inkl. Download)
    await initAudio();
    
    // Wenn alles geladen ist, zünden wir die Kopfhörer-Logik
    if (isPlaying) {
      //onHeadphonesOn();
      // Listener entfernen, um Doppel-Klicks zu vermeiden
      window.removeEventListener('click', handleFirstClick);
      window.removeEventListener('keydown', handleFirstClick);
    }
  } catch (error) {
    console.error("Fehler beim Starten des Audio-Setups:", error);
  }
}
window.addEventListener('click', handleFirstClick);
window.addEventListener('keydown', handleFirstClick);

// KIOSK-AUTOPLAY: Dank Chrome-Flag --autoplay-policy=no-user-gesture-required
// dürfen wir den AudioContext ohne Klick starten. Wir stoßen das Laden also
// direkt beim Öffnen des Patches an. Die Klick/Tasten-Listener oben bleiben nur
// noch als Fallback für die Entwicklung (normaler Chrome OHNE das Flag).
initAudio()
  .then(() => console.log("Audio automatisch geladen (Kiosk-Autoplay)."))
  .catch(err => console.warn("Auto-Start nicht möglich (kein Autoplay-Flag?) – warte auf Klick/Taste.", err));

// ─── ANIMATION LOOP ────────────────────────────────────────────────────────

// THREE.Clock misst die vergangene Zeit in Sekunden seit dem Start.
// requestAnimationFrame ruft tick() ca. 60x pro Sekunde auf – synchron zum
// Bildschirm-Refresh. Alle Animationen und Updates passieren hier drin.
// const clock = new THREE.Clock();

// der tick inklusive der aufforderung ganz am ende (requestanimation) frame ist exakt der draw() loop in p5js nur selbst gecodet.
const ALIGNMENT_THRESHOLD = 0.8;
let APPROACH_SPEEDB1 = 0.8; // m/s, wie schnell sie näher kommt beim Hinschauen
let APPROACH_SPEEDB2 = 0.8; // m/s, wie schnell sie näher kommt beim Hinschauen
const RETREAT_SPEED  = 1; // m/s, wie schnell sie zurückweicht beim Wegschauen

const tick = () => {
  const elapsedTime = clock.getElapsedTime();
  const deltaTime = elapsedTime - lastFrameTime;  // ← diese Zeile fehlt bei euch
  lastFrameTime = elapsedTime;


  // 1. KOPF-ROTATION aus Headtracking
  // Euler-Reihenfolge YXZ: yaw zuerst, dann pitch – natürlich für Kopfbewegung.
  // +Math.PI dreht den Kopf um 180° damit die Nase zur Front-Kamera zeigt.
  head.rotation.order = 'YXZ';
  head.rotation.y =  yaw + Math.PI; // +180° damit Nase zur Front-Kamera zeigt
  head.rotation.x =  pitch;
  head.rotation.z =  roll;



  // 2. ALIGNMENT berechnen + Parameter interpolieren
  // Math.max(0, ...) clampt negative Werte auf 0 – nur die "richtige" Seite zählt.
  // a*a (quadratisch) macht den Effekt nichtlinear: erst wenn man fast direkt
  // draufschaut wird es richtig schnell.
  if (isPlaying && resonanceSource) {
    // 4. LISTENER-ORIENTIERUNG: Resonance muss wissen wie der Kopf im Raum steht.
    // Wir rechnen aus den Euler-Winkeln einen Vorwärts-Vektor (fwdX/Y/Z) und
    // übergeben ihn als "Blickrichtung des Hörers".

    /*
    - fwdX = sin(yaw) * cos(pitch) — X-Anteil wird durch Pitch gedämpft: wenn du stark nickst, schaust du mehr nach oben/unten, weniger nach links/rechts
    - fwdY = sin(pitch) — der vertikale Anteil, kommt direkt aus dem Pitch-Winkel
    - fwdZ = -cos(yaw) * cos(pitch) — gleiche Logik wie X, nur für Z

    Bei getAlignment() haben wir pitch ignoriert weil die Quelle auf Ohrhöhe ist — da reicht die horizontale Ebene. Hier für Resonance braucht es den vollen 3D-Vektor damit der
    Raumklang auch beim Nicken stimmt.
    */
    const fwdX =  Math.sin(yaw) * Math.cos(pitch);
    const fwdY =  Math.sin(pitch);
    const fwdZ = -Math.cos(yaw) * Math.cos(pitch);
    

    // 0 1 0 ist der up vector zeigt wo bei mir in meiner orientierung "oben ist" ich könnte mich ja theoretisch neigen...
    resonanceScene.setListenerOrientation(fwdX, fwdY, fwdZ, 0, 1, 0);
  }

  if (isPlaying && resonanceSource && isSonarActive) {
    const aRechts = Math.max(0, getAlignment(1, 0));

    // Innerhalb des Schwellwerts ("Room of Error"): Kugel bewegt sich näher.
    // Außerhalb: sie bewegt sich wieder zurück Richtung DIST_FAR.
    if (aRechts > ALIGNMENT_THRESHOLD) {
      sourceDist = Math.max(DIST_NEAR, sourceDist - APPROACH_SPEEDB1 * deltaTime);
    } else {
      sourceDist = Math.min(DIST_FAR, sourceDist + RETREAT_SPEED * deltaTime);
    }
    

    // 3. RESONANCE-QUELLE positionieren
    // Wir sagen dem 3D-Sound-System, wo die Klangquelle gerade steht.
    // sourceDist ist der Abstand zum Kopf; das Minus schiebt sie nach LINKS (-X).
    // Je kleiner sourceDist, desto näher (und damit lauter) klingt die Quelle.
    resonanceSource.setPosition(-sourceDist, 0, 0);
    srcMesh.visible = true; // die rote Kugel jetzt sichtbar machen

    // Klangquellen-Kugeln einfaden
    // "naehe" rechnet den Abstand in einen einfachen Wert von 0 bis 1 um:
    //   naehe = 0  → Quelle ist ganz weit weg (bei DIST_FAR)
    //   naehe = 1  → Quelle ist ganz nah dran (bei DIST_NEAR)
    // Trick dahinter: (sourceDist - DIST_NEAR) / (DIST_FAR - DIST_NEAR) ergibt
    // 0 wenn nah und 1 wenn weit. Mit "1 - (...)" drehen wir das um, damit
    // 1 = nah bedeutet – das fühlt sich logischer an.
    const naehe = 1 - ((sourceDist - DIST_NEAR) / (DIST_FAR - DIST_NEAR));

    // Wir haben DREI Klang-Schichten (Layer 1, 2, 3), die übereinander liegen.
    // Je näher man kommt, desto mehr Schichten schalten wir dazu → der Klang
    // wird voller. Die Lautstärke ist in Dezibel (dB): 0 = laut, -30 = sehr leise,
    // -Infinity = komplett aus. MainVolumeK1 ist ein globaler Regler, mit dem man
    // alle Schichten gleichzeitig lauter/leiser macht.

    // Layer 1: läuft immer mit und bildet die Grundschicht.
    soundsBall.vol1.volume.value = (-6 * naehe) + MainVolumeK1;

    // Layer 2: kommt schon früh dazu, ab 10% Nähe.
    // Ist man näher als 0.25, faden wir sanft von -30 dB (leise) auf -6 dB (lauter).
    // Der Ausdruck (naehe - 0.25) / 0.75 rechnet die Strecke von 0.25 bis 1.0 wieder
    // in einen 0-bis-1-Wert um, den lerp braucht. Sonst (weiter weg): komplett stumm.
    soundsBall.vol2.volume.value = naehe > 0.1
      ? lerp(-30, -6, (naehe - 0.1) / 0.75) + MainVolumeK1
      : -Infinity;

    // Layer 3: die oberste Schicht, kommt in der Mitte dazu (ab ~55%).
    // Gleiches Prinzip: von -30 dB auf -6 dB hochfaden. Vorher: stumm.
    soundsBall.vol3.volume.value = naehe > 0.3
      ? lerp(-30, -6, (naehe - 0.3) / 0.45) + MainVolumeK1
      : -Infinity;
    
    // "Verlangsamen" der Kugel, je näher sie kommt.
    // Wichtig: von NAH nach WEIT prüfen und else-if benutzen, damit sich die
    // Bedingungen nicht gegenseitig überschreiben. Die End-Bremse ist bewusst
    // nicht mehr so hart wie früher (0.2) – sonst wartet man ewig, bis die
    // Kugel den Kopf erreicht. Jetzt kommt der Schluss spürbar, aber zügig.
    if (naehe > 0.8) {
      APPROACH_SPEEDB1 = 0.3;   // ganz nah → nur leicht gebremst
    } else if (naehe > 0.6) {
      APPROACH_SPEEDB1 = 0.7;   // mittel-nah
    } else {
      APPROACH_SPEEDB1 = 0.8;   // weit weg → schnell heran
    }

    // Ziel erreicht → erste Kugel ist "eingefangen", Übergang zu Scene3.
    if (sourceDist <= DIST_NEAR && !isSonarActive3) {
      sounds.victory.start();

      // WICHTIG: Die erste Kugel KOMPLETT abschalten. Ohne dieses Flag auf false
      // würde der obere Block jeden Frame weiterlaufen und die Lautstärke sofort
      // wieder hochsetzen – dann bringt das .stop() unten nichts.
      isSonarActive = false;

      // Klang der 1. Kugel sicher verstummen: erst stumm schalten, dann stoppen.
      soundsBall.vol1.volume.value = -Infinity;
      soundsBall.vol2.volume.value = -Infinity;
      soundsBall.vol3.volume.value = -Infinity;
      soundsBall.element1.stop();
      soundsBall.element2.stop();
      soundsBall.element3.stop();

      // rote Kugel ausblenden – ab jetzt übernimmt die zweite Kugel (Scene3K)
      srcMesh.visible = false;

      scene3();
    }
  }

  if (isPlaying && resonanceSource && isSonarActive3) {
    const aLinks = Math.max(0, getAlignment(-1,0));

    // Innerhalb des Schwellwerts ("Room of Error"): Kugel bewegt sich näher.
    // Außerhalb: sie bewegt sich wieder zurück Richtung DIST_FAR.
    if (aLinks > ALIGNMENT_THRESHOLD) {
      sourceDist3 = Math.max(DIST_NEAR, sourceDist3 - APPROACH_SPEEDB2 * deltaTime);
    } else {
      sourceDist3 = Math.min(DIST_FAR, sourceDist3 + RETREAT_SPEED * deltaTime);
    }

    // 3. RESONANCE-QUELLE positionieren (unverändert)
    resonanceSource3.setPosition(sourceDist3, 0, 0);
    Scene3K.position.set(sourceDist3, 0, 0);
    Scene3K.visible = true;

    // Klangquellen Kugeln einfaden (unverändert)
    const naehe2 = 1 - ((sourceDist3 - DIST_NEAR) / (DIST_FAR - DIST_NEAR));
    soundsBall3.vol1.volume.value = (-6 * naehe2) + MainVolumeK2;
    soundsBall3.vol2.volume.value = naehe2 > 0.4 
      ? lerp(-30, -6, ((naehe2 - 0.4) / 0.6) + MainVolumeK2) 
      : -Infinity;
    soundsBall3.vol3.volume.value = naehe2 > 0.75 
      ? lerp(-30, -6, ((naehe2 - 0.75) / 0.25) + MainVolumeK2) 
      : -Infinity;
    
    //Das "verlangsamen" der Kugel
    if (naehe2 < 0.5) {
      APPROACH_SPEEDB2 = 0.8; 
    }

    if (naehe2 < 0.7) {
      APPROACH_SPEEDB2 = 0.5 
    }
    
    if (naehe2 > 0.8) {
      APPROACH_SPEEDB2 = 0.2 
    }

    // Ziel erreicht → zweite Kugel eingefangen, Übergang zu Scene4.
    if (sourceDist3 <= DIST_NEAR) {
      sounds.victory.start();
      isSonarActive = false;
      isSonarActive3 = false;
      srcMesh.visible = false;
      Scene3K.visible = false;

      // Beide Kugeln sicher verstummen: erst stumm schalten, dann stoppen.
      soundsBall.vol1.volume.value = -Infinity;
      soundsBall.vol2.volume.value = -Infinity;
      soundsBall.vol3.volume.value = -Infinity;
      soundsBall3.vol1.volume.value = -Infinity;
      soundsBall3.vol2.volume.value = -Infinity;
      soundsBall3.vol3.volume.value = -Infinity;
      soundsBall.element1.stop();
      soundsBall.element2.stop();
      soundsBall.element3.stop();
      soundsBall3.element1.stop();
      soundsBall3.element2.stop();
      soundsBall3.element3.stop();
      scene4();
    }
  }

  // ─── SCENE 5: "Lupe"-Scanner über das Orchester ───
  // Läuft jeden Frame, sobald scene5Active ist. Wir schauen für jedes der 4
  // Instrumente, ob der Kopf gerade in seine Richtung zeigt, und faden es
  // entsprechend ein (schnell) oder wieder aus (langsam).
  if (isPlaying && scene5Active) {
    // Blickrichtung horizontal in Grad. yaw > 0 = nach rechts (gleiche
    // Konvention wie die Instrument-Winkel in initAudio).
    const blickGrad = yaw * 180 / Math.PI;

    for (const inst of orchestra) {
      // Winkel-Abstand zwischen Blick und Instrument (auf -180..180 normiert,
      // damit ein Überlauf über ±180° nicht zu falschen Werten führt).
      let diff = blickGrad - inst.angle;
      diff = Math.abs(((diff + 180) % 360 + 360) % 360 - 180);

      // Schaue ich in den "Strahl" dieses Instruments? → Ziel-Pegel 1, sonst 0.
      const zielLevel = diff < SCANNER_BEAM_HALF ? 1 : 0;

      // Rauf (Attack) geht schnell, runter (Decay) langsam. Wir bewegen den
      // aktuellen Pegel linear Richtung Ziel, Schrittweite = deltaTime / Dauer.
      const dauer  = zielLevel > inst.level ? SCANNER_ATTACK_SEK : SCANNER_DECAY_SEK;
      const schritt = deltaTime / dauer;
      if (zielLevel > inst.level) {
        inst.level = Math.min(zielLevel, inst.level + schritt);
      } else {
        inst.level = Math.max(zielLevel, inst.level - schritt);
      }

      // Pegel (0..1) in dB umrechnen und am Volume-Node setzen.
      // 20*log10(level): 1 → 0 dB, 0.5 → -6 dB, ~0 → praktisch stumm.
      const vol = soundsFinal[inst.name + 'Vol'];
      vol.volume.value = inst.level > 0.001 ? 20 * Math.log10(inst.level) : -Infinity;
    }
  }

  // 5. KLANGQUELLE MESH positionieren
  // Visuell: -X → erscheint LINKS auf dem Screen (Front-Kamera, keine Spiegelung)
  // Audio:   -X → linkes Ohr – beide Seiten stimmen überein
  srcMesh.position.set(-sourceDist, 0, 0);



  // 7. PING-RING animieren
  // dtPing = Sekunden seit dem letzten Ping. Über 1.5 Sekunden blendet der Ring
  // komplett aus. progress (0→1) steuert gleichzeitig Scale und Opacity.
  // const dtPing = elapsedTime - lastPingTime;
  // if (dtPing < 1.5 && isPlaying) {
  //   const progress = dtPing / 1.5;
  //   const scale    = sourceDist * 0.6 * progress;
  //   pingMesh.position.set(sourceDist, 0, 0);
  //   pingMesh.scale.setScalar(scale);
  //   pingMesh.material.opacity = 1 - progress;
  // } else {
  //   pingMesh.scale.setScalar(0);
  //   pingMesh.material.opacity = 0;
  // }



  // 8. HUD aktualisieren
  // Template Literals (Backticks) erlauben Variablen direkt im String mit ${}.
  // toFixed(2) rundet auf 2 Nachkommastellen.
  // das ist einfach ein HTML code Update:
  const bpm = 60000 / pingIntervalMs;



  document.getElementById('hud').innerHTML =
    `yaw &nbsp;${yaw.toFixed(2)}<br>` +
    `dist ${sourceDist.toFixed(2)} m<br>` +
    `bpm &nbsp;${bpm.toFixed(1)}<br>` +
    `ctx &nbsp;${audioCtx.state}<br>`; 
    // + `HP &nbsp;${headphonesOn}`  
    



  // 9. RENDERN + nächsten Frame anfordern
  // final rendern wir die szene 
  renderer.render(scene, cam);

  // und wir requesten mit 60 fps speed schon den nächsten tick. Also auch ein loop, der sich selbst aufruft.
  // window.requestAnimationFrame(tick); wird in story.js wiederholt

  // if (scene3CheckB == false) {
  //   window.requestAnimationFrame(tick); // -> Hier passiert die schleife statt davor ganz unten
  // }
  // else {
  //   console.log("Wir sind fertig mit Tick!");
  //   scene4(); //Checke wieder story.js
  // }
  window.requestAnimationFrame(tick);
};
//--Setup------------------------------------------------------

// Diese Funktion lädt die Datei und updatet das HTML-Feld live
async function ladeMitProzent(url) {
  console.log("Starte Download für: " + url);
  const res = await fetch(url);
  
  if (!res.ok) {
    throw new Error(`HTTP-Fehler beim Laden! Status: ${res.status}`);
  }

  // Sicherstellen, dass wir eine Zahl bekommen, ansonsten nutzen wir 0
  const contentLengthHeader = res.headers.get('content-length');
  const total = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
  
  const reader = res.body.getReader();
  let loaded = 0, chunks = [];

  while(true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    chunks.push(value);
    loaded += value.length;
    
    // Nur loggen, wenn der Server uns eine echte Gesamtgröße geliefert hat
    if (total && total > 0) {
      console.log(`Lade Audio: ${Math.round((loaded / total) * 100)}%`);
    } else {
      // Fallback: Wenn der Server die Größe nicht weiß, loggen wir die Megabytes
      console.log(`Lade Audio: ${(loaded / (1024 * 1024)).toFixed(2)} MB geladen...`);
    }
  }
  
  console.log("Download beendet. Verarbeite Audiodaten in der CPU...");
  
  const result = new Uint8Array(loaded);
  let pos = 0;
  for (const c of chunks) { 
    result.set(c, pos); 
    pos += c.length; 
  }
  return result.buffer;
}

let scene2CheckB = false;
let scene4CheckB = false;

function onHeadphonesOn(){
  // onHeadphonesOn() feuert einmal, wenn jemand den Kopfhörer aufsetzt.
  // Ablauf-Timing:
  //   1) 2 Sekunden warten
  //   2) oneOne-Voice abspielen (binaural, fix vor dem Hörer durch voiceSource)
  //   3) wenn die Stimme zu Ende ist → den Ping-Part starten
  console.log('headphonesOn – Kopfhörer aufgesetzt');
  //reset(); // aktuelle Kopfposition als Nullstellung übernehmen
  if (!isPlaying) {
      console.warn("Ambi-Sound lädt noch im Hintergrund – Experience startet automatisch, sobald geladen.");
      startPending = true; // sobald initAudio() fertig ist, wird die Szene nachgeholt
      return; // Wir brechen hier ab, damit es nicht abstürzt!
  }
  tick();
  scene1();
}

// onHeadphonesOff() feuert, wenn der Kopfhörer lange genug still lag.
// Das ist der Reset-Hook: hier wird später das ganze Spiel auf Anfang gesetzt.
function onHeadphonesOff() {
  console.log('headphonesOff – Kopfhörer abgelegt, Spiel zurücksetzen');
}

//--Einzelne Szenen------------------------------------------------------------------

function scene1() {
    console.log("Wir sind in Scene1");
    voiceSource.setPosition(0, 0, -2); // -Z = direkt vor dem Hörer, ca. 2 m 
    soundsSource.setPosition(0, 0, -2); // -Z = direkt vor dem Hörer, ca. 2 m 
    sounds.stimme1.start();
    setTimeout(() => {
      // wir ersrtzten perspektivisch den swoosh durch ein 20s ambix file
      // der paralell zum fade in von nature läuft aber nicht eingefadet werden muss, da das im ambix bereits drinne ist

      sounds.swoosh.start(); // ist aktuell unser swoosh
      fadeInAmbi(ambiSource, ambiGain, 2, 0.3);
      sounds.stimme1.onstop = () => {
        scene2();
      }
    }, 6500); 
}

function scene2(){
  console.log("Wir sind in Scene2");
  voiceSource.setPosition(-2, 0, 0); //Setzt stimme Links
  setTimeout(() => {
    sounds.stimme2.start();
    sounds.stimme2.onstop = () => {
        // ─── EINFADE-PHASE (Intro der ersten Kugel) ───
        // Wir wollen, dass die Kugel NICHT plötzlich da ist, sondern langsam
        // "auftaucht". Deshalb passiert das hier in zwei Schritten:
        //
        //   1) Die Kugel steht als STATISCHER Punkt ganz weit weg (DIST_FAR).
        //      Ihr Klang startet stumm und wird über 3 Sekunden sanft eingefadet.
        //      In dieser Zeit reagiert sie noch NICHT auf den Kopf (nicht interaktiv).
        //
        //   2) Nach den 3 Sekunden wird isSonarActive = true → ab jetzt kann man
        //      sie durch Hinschauen heranziehen (die eigentliche Interaktion).

        const EINFADE_SEK = 2; // wie lange das Einfaden dauert (etwas flotter als vorher)

        // Kugel fix auf maximale Distanz setzen und sichtbar machen
        sourceDist = DIST_FAR;
        srcMesh.position.set(-sourceDist, 0, 0);
        srcMesh.visible = true;
        resonanceSource.setPosition(-sourceDist, 0, 0);

        // Klang-Layer starten, aber erstmal komplett stumm (-Infinity dB)
        soundsBall.element1.start();
        soundsBall.element2.start();
        soundsBall.element3.start();
        soundsBall.vol1.volume.value = -Infinity;
        soundsBall.vol2.volume.value = -Infinity;
        soundsBall.vol3.volume.value = -Infinity;

        // Nur Layer 1 ist bei maximaler Distanz hörbar → den über 3s hochfaden.
        // rampTo(zielwert, sekunden) macht das butterweich statt schlagartig.
        // (Layer 2 & 3 bleiben stumm, sie kommen später beim Näherkommen dazu.)
        soundsBall.vol1.volume.rampTo(MainVolumeK1, EINFADE_SEK);

        // Erst NACH dem Einfaden wird die Kugel interaktiv
        setTimeout(() => {
          isSonarActive = true;
        }, EINFADE_SEK * 1000);


        tick();
    }
  }, 3000);

}

function scene3() {
  console.log("Wir sind in Scene3");
  isSonarActive3 = true;
  soundsBall3.element1.start();
  soundsBall3.element2.start();
  soundsBall3.element3.start();
}

function scene4() {
  console.log("Wir sind in Scene4");
  voiceSource.setPosition(0, 0, -2); //Setzt stimme wieder nach vorne
  setTimeout(() => {        //Super ekelhafte Verkettung XD
    sounds.stimme3.start();
    setTimeout(() => {
      fadeOutAmbi(ambiSource, ambiGain, 4);
      sounds.swoosh.start();
      fadeInAmbi(ambiSource2, ambiGain2, 4, 0.3);

      // ambiSource2 läuft jetzt. Nach 15 Sekunden CROSSFADEN wir:
      // ambiSource2 fadet aus, während scene5 (Stereo-Bett + Instrumente)
      // GLEICHZEITIG einfadet. So entsteht keine Lücke/Stille dazwischen.
      const AMBI2_SPIELZEIT_SEK = 15; // wie lange ambiSource2 spielt, bevor der Crossfade beginnt
      const CROSSFADE_SEK       = 5;  // gemeinsame Über-Kreuz-Dauer

      setTimeout(() => {
        fadeOutAmbi(ambiSource2, ambiGain2, CROSSFADE_SEK); // altes Ambix raus ...
        scene5(CROSSFADE_SEK);                              // ... neue Klangwelt gleichzeitig rein
      }, AMBI2_SPIELZEIT_SEK * 1000);
    }, 6000);
  }, 4000);
}

function scene5(fadeSek = 5) {
  console.log("Wir sind in Scene5");

  const ZIEL_LAUTSTAERKE = 0; // Ziel-Pegel in dB (0 = voll)

  // Stereo-Bett faded als Crossfade rein (ersetzt nahtlos das alte Ambix).
  // Es ist als loop geflaggt und läuft ab jetzt endlos als Grundklang.
  soundsFinal.stereo.start();
  soundsFinal.stereoVol.volume.rampTo(ZIEL_LAUTSTAERKE, fadeSek);

  // Die 4 Instrumente laufen bereits (loop), bleiben aber STUMM. Sie werden
  // NICHT hier eingefadet, sondern ausschließlich vom "Lupe"-Scanner im tick()
  // gesteuert: sichtbar/hörbar wird nur, was man gerade anschaut.
  soundsFinal.cello.start();
  soundsFinal.git.start();
  soundsFinal.piano.start();
  soundsFinal.flute.start();

  // Scanner scharf schalten – ab jetzt reagieren die Instrumente auf den Blick.
  scene5Active = true;
}

//Notizen: Die Kugel erst hinbewegen lassen, wenn Stimme fertig+ Plus leiser werden lassen (schneller zur Seite fliegen lassen)
// Außerdem langsamer ankommen lassen  