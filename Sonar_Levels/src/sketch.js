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
import * as THREE from 'three';
import * as Tone from 'tone';
import { ResonanceAudio } from 'resonance-audio';



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
const srcMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 20, 10),
  new THREE.MeshBasicMaterial({ color: "#ff0000" })
);
scene.add(srcMesh);



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
  // neuer Wert die BEWEGUNGS_SCHWELLE wieder reißt, gehen wir rein und
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

// onHeadphonesOn() feuert einmal, wenn jemand den Kopfhörer aufsetzt.
// Hier kommt später die erste Message / das Onboarding rein.
function onHeadphonesOn() {
  console.log('headphonesOn – Kopfhörer aufgesetzt, erste Message starten');
}

// onHeadphonesOff() feuert, wenn der Kopfhörer lange genug still lag.
// Das ist der Reset-Hook: hier wird später das ganze Spiel auf Anfang gesetzt.
function onHeadphonesOff() {
  console.log('headphonesOff – Kopfhörer abgelegt, Spiel zurücksetzen');
}

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

function getAlignment() {
  // fwd geht von 1 bis -1 da yaw als radians winkel -2pi bis 2pi  geht  
  // daraus bekommen wir einen foward schauenden x/z vector im wertebereich von (-1 bis 1, -1 bis 1)    

  const fwdX = Math.sin(yaw);   // Blickvektor horizontal (X)
  const fwdZ = Math.cos(yaw);  // Blickvektor horizontal (Z)

  const srcX = 1;  // Klangquelle ist auf der +X Achse
  const srcZ = 0;

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
  return fwdX * srcX
}

// DIST_FAR / DIST_NEAR definieren wie nah die Quelle kommen kann.
// Großbuchstaben = Konvention für Konstanten die sich nie ändern.
const DIST_FAR   = 6;
const DIST_NEAR  = 0.5;

const INTERVAL_SLOW = 2000; // ms – langsamer Puls wenn man wegschaut
const INTERVAL_FAST  =  150; // ms – schneller Puls wenn man direkt draufschaut

// wir starten initial:
let sourceDist     = DIST_FAR;
let pingIntervalMs = INTERVAL_SLOW;



// ─── AUDIO (Tone.js + Resonance Audio) ────────────────────────────────────

// Browser erlauben keinen Ton ohne vorherige Nutzer-Interaktion (Autoplay-Policy).
// Deshalb starten wir alles erst beim ersten Klick.
// Die Audio-Variablen werden hier als null deklariert und erst im Click-Handler befüllt.
let isPlaying      = false;
let resonanceScene = null;
let resonanceSource= null;
let synth          = null;
let pingTimeoutId  = null;
let lastPingTime   = 0;

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

// async/await: AudioContext.resume() gibt ein Promise zurück – wir warten mit
// "await" darauf, bevor wir weitermachen. Das stellt sicher dass der Audio-Thread
// wirklich läuft bevor wir Töne erzeugen.

// click ist ein nativer event listener der dann feuert wenn die maus geklickt wird.
window.addEventListener('click', async () => {
  if (isPlaying) return;

  // AudioContext ist die native Browser-API für alles mit Audio.
  // Tone.js und Resonance Audio bauen beide darauf auf – wir teilen einen Context.
  const audioCtx = new AudioContext();
  Tone.setContext(audioCtx);

  // es scheint audioCtx.resume() braucht eine weile bis es losgeht. daher deklarieren  wir den sound init callback als async.
  await audioCtx.resume();

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

  isPlaying = true;

  // wir haben im html einen kleinen tag:  <div id="hint">click to start &nbsp;·&nbsp; r = reset</div>
  // den zeigen wir nun nicht mehr. in dem wir sagen du bist jetzt hidden im css
  // im style.css ist hinterlegt das die opacity (also der alpha) einfach auf 0 gesetzt wird.
  document.getElementById('hint').classList.add('hidden');

  // jetzt ist alles geladen und wir können unserern trigger ping loop zum ersten mal ausführen (und dann loopt er selbstständig weiter)
  triggerPing();
});



// ─── ANIMATION LOOP ────────────────────────────────────────────────────────

// THREE.Clock misst die vergangene Zeit in Sekunden seit dem Start.
// requestAnimationFrame ruft tick() ca. 60x pro Sekunde auf – synchron zum
// Bildschirm-Refresh. Alle Animationen und Updates passieren hier drin.
const clock = new THREE.Clock();

// der tick inklusive der aufforderung ganz am ende (requestanimation) frame ist exakt der draw() loop in p5js nur selbst gecodet.
const tick = () => {
  const elapsedTime = clock.getElapsedTime();


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

    // nimm immer die höhere zahl. bei -1 = 0
    // bei 1 = 1. bei 0 = 0. 
    const a = Math.max(0, getAlignment());

    /*
      Beispiel:
    - a = 0.3 → t = 0.09 (kaum Effekt)
    - a = 0.7 → t = 0.49 (mittlerer Effekt)
    - a = 1.0 → t = 1.00 (voller Effekt)
    */
    const t = a * a;

    // das ist eine lineare interpolation.
    
    /*
    - (DIST_NEAR - DIST_FAR) = (0.5 - 6) = -5.5 — das ist die Spanne, negativ weil wir näher kommen
    - mal a (0 bis 1) → skaliert diese Spanne
    - plus DIST_FAR (6) → verschiebt den Startpunkt

    Also:
    - a = 0 → 6 + (-5.5 * 0) = 6 (weit weg)
    - a = 0.5 → 6 + (-5.5 * 0.5) = 3.25 (halbweg)
    - a = 1 → 6 + (-5.5 * 1) = 0.5 (nah dran)

    */
    sourceDist     = DIST_FAR  + (DIST_NEAR  - DIST_FAR)  * a;
    pingIntervalMs = INTERVAL_SLOW + (INTERVAL_FAST - INTERVAL_SLOW) * t;

    // 3. RESONANCE-QUELLE positionieren
    // Audio: −X = linkes Ohr des Hörers (Resonance-Konvention)
    resonanceSource.setPosition(-sourceDist, 0, 0);

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
    `bpm &nbsp;${bpm.toFixed(1)}`;


  // 9. RENDERN + nächsten Frame anfordern
  // final rendern wir die szene 
  renderer.render(scene, cam);

  // und wir requesten mit 60 fps speed schon den nächsten tick. Also auch ein loop, der sich selbst aufruft.
  window.requestAnimationFrame(tick);
};

tick();
