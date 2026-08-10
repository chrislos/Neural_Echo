import * as THREE from 'three';
import * as Tone from 'tone';
import { ResonanceAudio } from 'resonance-audio';

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}


window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  cam.aspect = sizes.width/sizes.height;

  cam.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

})

const canvas = document.querySelector('canvas.webgl');
const scene = new THREE.Scene();

const cam = new THREE.PerspectiveCamera(50, sizes.width / sizes.height, 0.1, 100);
cam.position.set(0,0,8);
cam.lookAt(0,0,0);
scene.add(cam);


const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true
});

renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000); // schwarz


// Kopf

const head = new THREE.Group();
scene.add(head);

const lineColor = '#626262';

// mesh braucht geometry, material
const headMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.75, 28, 20), 
  new THREE.MeshBasicMaterial({
    color: lineColor,
    wireframe: true
  })
)

head.add(headMesh);


const noseMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 8, 6),
  new THREE.MeshBasicMaterial(
    { color: lineColor, 
      wireframe: true 
    })
);


noseMesh.position.set(0, -0.05, -0.82);
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


const srcMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 20, 10),
  new THREE.MeshBasicMaterial({ color: "#ff0000" })
);
scene.add(srcMesh);


// websocket

const ws = new WebSocket('ws://localhost:8080');

let yaw = 0; // links rechts
let pitch = 0 // nicken
let roll = 0; // kippen


let rawYaw = 0, rawPitch = 0, rawRoll = 0;
let offsetYaw = 0, offsetPitch = 0, offsetRoll = 0;
let calibrated = false;

ws.onmessage = (event) => {

  const d = JSON.parse(event.data);
  rawYaw = d.yaw;
  rawPitch = d.pitch;
  rawRoll = d.roll;

  if (!calibrated){
    reset();
    calibrated = true;
  }

  yaw = rawYaw - offsetYaw;
  pitch = rawPitch - offsetPitch;
  roll = rawRoll - offsetRoll;
}


function reset(){
  offsetYaw = rawYaw;
  offsetPitch = rawPitch;
  offsetRoll = rawRoll;
}


window.addEventListener('keydown', (data) => {

  if(data.key === 'r') {
    reset();
  }


})














// DRAW LOOP
const clock = new THREE.Clock();
const tick = () => {
  
  head.rotation.order = 'YXZ';
  head.rotation.y = yaw;
  head.rotation.x = pitch;
  head.rotation.z = roll;

  renderer.render(scene, cam);

  window.requestAnimationFrame(tick);
}

tick();