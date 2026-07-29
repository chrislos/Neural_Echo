// 3dhead.js
// Alles, was man SIEHT, wohnt in dieser Datei: die Three.js-Szene, die Kamera,
// der Renderer und der Drahtgitter-Kopf mit Nase und Ohren.
// Der Hauptcode (index.js) muss davon nichts im Detail wissen – er ruft nur:
//   erstelleKopfSzene(canvas)      → baut alles einmal auf
//   setzeKopfDrehung(yaw, p, r)    → dreht den Kopf jede Frame
//   macheKugel()                   → erzeugt eine rote Klangquellen-Kugel
//   render()                       → zeichnet das aktuelle Bild
// Diese Aufteilung heißt "Modul": eine Datei = eine Aufgabe.

import * as THREE from 'three';

export function erstelleKopfSzene(canvas) {

  // ─── GRÖSSE ────────────────────────────────────────────────────────────────
  // Fenstergröße einmal merken, damit wir sie nicht zweimal hinschreiben müssen.
  const sizes = {
    width:  window.innerWidth,
    height: window.innerHeight
  };

  // ─── SZENE ─────────────────────────────────────────────────────────────────
  // THREE.Scene ist der unsichtbare Container, in dem alle 3D-Objekte leben.
  const szene = new THREE.Scene();

  // ─── KAMERA ────────────────────────────────────────────────────────────────
  // PerspectiveCamera simuliert das menschliche Auge: weiter entfernte Objekte
  // erscheinen kleiner. Parameter: Blickwinkel 50°, Seitenverhältnis,
  // Nah-Clipping 0.1m, Fern-Clipping 100m.
  // Die Kamera sitzt bei +8 auf der Z-Achse – wir schauen dem Kopf ins Gesicht.
  // Visuell und Audio haben dadurch gleiche Vorzeichen – keine Spiegelung.
  const kamera = new THREE.PerspectiveCamera(50, sizes.width / sizes.height, 0.1, 100);
  kamera.position.set(0, 0, 8);
  kamera.lookAt(0, 0, 0);
  szene.add(kamera);

  // ─── RENDERER ──────────────────────────────────────────────────────────────
  // Der WebGLRenderer übersetzt die 3D-Szene in Pixel auf dem Canvas.
  // PixelRatio auf max. 2 begrenzen – mehr kostet auf Retina nur Rechenleistung.
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
  });
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000);

  // Wenn das Fenster skaliert wird, müssen Kamera und Renderer nachziehen,
  // sonst wird das Bild verzerrt oder abgeschnitten.
  window.addEventListener('resize', () => {
    sizes.width  = window.innerWidth;
    sizes.height = window.innerHeight;
    kamera.aspect = sizes.width / sizes.height;
    kamera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });

  // ─── KOPF-GRUPPE ───────────────────────────────────────────────────────────
  // THREE.Group ist ein leerer Container mit Position und Rotation.
  // Alles, was wir hineinlegen (Kopf, Nase, Ohren), dreht sich gemeinsam mit,
  // wenn wir die Rotation der Gruppe setzen.
  const kopf = new THREE.Group();
  szene.add(kopf);

  const lineColor = '#626262';

  // Ein Mesh besteht immer aus Geometry (Form) + Material (Aussehen).
  // wireframe: true zeichnet nur die Gitterkanten, nicht die Flächen.
  const kopfMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.75, 28, 20),
    new THREE.MeshBasicMaterial({ color: lineColor, wireframe: true })
  );
  kopf.add(kopfMesh);

  // Nase: zeigt an, wohin der Kopf schaut.
  const naseMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 6),
    new THREE.MeshBasicMaterial({ color: lineColor, wireframe: true })
  );
  naseMesh.position.set(0, -0.05, 0.82);
  kopf.add(naseMesh);

  // Geometrie und Material werden für beide Ohren geteilt – spart Speicher.
  const ohrGeo = new THREE.SphereGeometry(0.1, 8, 6);
  const ohrMat = new THREE.MeshBasicMaterial({ color: lineColor, wireframe: true });

  const ohrLinks = new THREE.Mesh(ohrGeo, ohrMat);
  ohrLinks.position.set(-0.82, 0, 0);
  kopf.add(ohrLinks);

  const ohrRechts = new THREE.Mesh(ohrGeo, ohrMat);
  ohrRechts.position.set(0.82, 0, 0);
  kopf.add(ohrRechts);

  // ─── ÖFFENTLICHE FUNKTIONEN ────────────────────────────────────────────────

  // Dreht den Drahtgitter-Kopf passend zu den AirPods-Winkeln.
  // Euler-Reihenfolge YXZ: erst yaw (links/rechts), dann pitch (nicken) –
  // das entspricht der natürlichen Kopfbewegung.
  // +Math.PI dreht den Kopf um 180°, damit die Nase zur Kamera zeigt.
  function setzeKopfDrehung(yaw, pitch, roll) {
    kopf.rotation.order = 'YXZ';
    kopf.rotation.y = yaw + Math.PI;
    kopf.rotation.x = pitch;
    kopf.rotation.z = roll;
  }

  // Erzeugt eine kleine rote Kugel als sichtbare Klangquelle.
  // Sie sitzt NICHT in der Kopf-Gruppe, weil sie sich nicht mitdrehen soll –
  // ihre Position ist fest im Raum. Sie startet unsichtbar; der Hauptcode
  // blendet sie ein, sobald ihre Szene beginnt.
  function macheKugel() {
    const kugel = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 20, 10),
      new THREE.MeshBasicMaterial({ color: '#ff0000' })
    );
    kugel.visible = false;
    szene.add(kugel);
    return kugel;
  }

  // Zeichnet das aktuelle Bild – wird vom tick() in index.js jede Frame gerufen.
  function render() {
    renderer.render(szene, kamera);
  }

  // Wir geben nur das nach draußen, was der Hauptcode wirklich braucht.
  return { setzeKopfDrehung, macheKugel, render };
}
