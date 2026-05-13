let isPlaying = false;
// boolean

let player;
let ambiSource;

let panner; // an den wollen wir ran.

let resonanceScene; // wir erstellen eine 3D Szene
let resonanceSource; // .. und quelle

let distance = 2;
let fac = 100;
let angle = 0;

let headGfx;



// websocket data
const ws = new WebSocket("ws://localhost:8080");
   
let yaw = 0; //links - rechts
let pitch = 0; // nicken
let roll = 0; // kopf zur schulter


let rawYaw = 0, rawPitch = 0, rawRoll = 0; // das werden die werte sein, die direkt über swift ankommen
let offsetYaw = 0, offsetPitch = 0, offsetRoll = 0; //unser kalibrierungs offset (wird über reset ausgefüht)
let connected = false;


function reset() {
  offsetYaw = rawYaw;
  offsetPitch = rawPitch;
  offsetRoll = rawRoll;
}



function setup() {
  createCanvas(windowWidth, windowHeight);
  headGfx = createGraphics(200, 200, WEBGL);

  // checken ob wir eine websocket verbindung habe zum port 8080
  // ws.onopen = () => connected = true; 
  // ws.onclose = () => connected = false;

  // websocket callback, das das rohe JSON data package entpackt und direkt mit der kalibrierungsdifferenz korrekt ausgibt
  ws.onmessage = (incoming) => {
    const d = JSON.parse(incoming.data);
    console.log(incoming);

    rawYaw = d.yaw; 
    rawPitch = d.pitch; 
    rawRoll = d.roll;
    
    yaw = rawYaw - offsetYaw;
    pitch = rawPitch - offsetPitch;
    roll = rawRoll - offsetRoll;

  };

}

function keyPressed(){

  if(key == "r"){
    reset();
  }

}


function draw() {
  background(100);
  console.log(isPlaying);

  fill(0);
  text("context " + Tone.context.state, width/2, height/2 + 60);
  text("time " + Tone.now(), width/2, height/2 + 60 + 60);


  angle += 0.01;

  let soundX = cos(angle) * distance;
  let soundY = 0;
  let soundZ = sin(angle) * distance;


  fill(255);
  // line. x, y, x, y ... (stat -> ende)
  line(width/2, height/2, width/2 + soundX *fac, height/2 + soundZ * fac)
  circle(width/2 + soundX *fac, height/2 + soundZ * fac,  30);


  if(isPlaying && resonanceSource){

    // Schallquelle in der 3D-Szene positionieren.
    // soundX/soundZ kommen vom Kreis-Orbit oben — die Quelle dreht sich
    // um den Hörer herum. soundY bleibt 0 (gleiche Höhe wie Hörer).
    resonanceSource.setPosition(soundX, soundY, soundZ);
   
    /*
    // --- Listener-Orientierung aus Headtracking übernehmen ---
    //
    // Resonance Audio arbeitet mit zwei Vektoren:
    //   forward = wohin der Kopf schaut (Blickrichtung)
    //   up      = was "oben" für den Kopf ist
    //
    // Wir haben yaw und pitch als Euler-Winkel in Radiant vom AirPods-Sensor.
    // Diese müssen wir in einen 3D-Vektor umrechnen.
    //
    // Ausgangspunkt: Hörer schaut in -Z Richtung (Standard in Web Audio).
    //   yaw   = Drehung um die Y-Achse (links/rechts schauen)
    //   pitch = Drehung um die X-Achse (nicken, oben/unten)
    //
    // Rotation anwenden:
    //   fwdX =  sin(yaw) * cos(pitch)   — X-Anteil der Blickrichtung
    //   fwdY =  sin(pitch)              — Y-Anteil (positiv = nach oben schauen)
    //   fwdZ = -cos(yaw) * cos(pitch)   — Z-Anteil (negativ = vorwärts)
    //
    // Beispiel zur Kontrolle:
    //   yaw=0, pitch=0 → forward=(0, 0, -1) = geradeaus ✓
    //   yaw=π/2, pitch=0 → forward=(1, 0, 0) = nach rechts ✓
    //   yaw=0, pitch=π/2 → forward=(0, 1, 0) = nach oben ✓
    //
    // up-Vektor bleibt (0,1,0) — wir ignorieren roll vorerst.
    // Roll würde den up-Vektor kippen, macht für Audio kaum einen Unterschied.
    */

    const fwdX = Math.sin(yaw) * Math.cos(pitch);
    const fwdY = Math.sin(pitch);
    const fwdZ = -Math.cos(yaw) * Math.cos(pitch);

    resonanceScene.setListenerOrientation(fwdX, fwdY, fwdZ, 0, 1, 0);

  }


  circle(width/2, height/2, 50);
  circle(width/2, height/2-25, 10);

  // 3D Kopf oben rechts
  drawHead();
  image(headGfx, width - 220, 20);
  fill(200);
  textAlign(LEFT);
  text("yaw " + nf(yaw, 1, 2), width - 220, 235);
  text("pitch " + nf(pitch, 1, 2), width - 220, 250);
  text("roll " + nf(roll, 1, 2), width - 220, 265);

}



async function mousePressed(){
  if(!isPlaying){5
    // await Tonwe.start(); // brauchen wir nicht mehr weil wir einen eigenen "shared" audiocontext als Object anlegen.
    const audioCtx = new AudioContext();   // const weil wir nur einmal audioCtx zuweisen und nicht mehr ändern
    Tone.setContext(audioCtx); // Tone nutzt den context
    await audioCtx.resume();  // stat Tone.start, lassen wir den audiocontext "los" bzw weiterlaufen
    
    // wir erstellen eine Ambisoncis Order 3 Szene un dverbinden den Output mit unserem audioContext
    resonanceScene = new ResonanceAudio(audioCtx, {                                                                                                     
        ambisonicOrder: 3
      });
    resonanceScene.output.connect(audioCtx.destination);


    resonanceScene.setRoomProperties(                                                                                                                  
    { width: 10, height: 10, depth: 20 },  // Meter
    {                                                                                                                                                
      left: 'brick-bare',
      right: 'brick-bare',                                                                                                                           
      front: 'brick-bare',
      back: 'brick-bare',                                                                                                                            
      down: 'parquet-on-concrete',
      up: 'wood-ceiling'                                                                                                                   
    }
  );    

    /*
      Beton/Stein:                                                                                                                                       
    - brick-bare, brick-painted
    - concrete, concrete-block-coarse, concrete-block-painted, concrete-or-tile                                                                        
    - marble, plaster-rough, plaster-smooth                                    
                                                                                                                                                      
    Glas:           
    - glass-thin, glass-thick, glass-insulation                                                                                                        
    
    Holz:                                                                                                                                              
    - wood-panel, wood-ceiling, parquet-on-concrete
                                                  
    Weich/Absorbierend:
    - curtain-heavy, carpet (via acoustic-ceiling-tiles), grass                                                                                        
                                                                                                                                                      
    Sonstiges:                                                                                                                                         
    - metal, transparent (kein Nachhall)                                                                                                               
                                                                                                                                                      
    transparent ist komplett absorbierend — nützlich wenn du eine Wand akustisch "abschalten" willst.
                                                                                                          
    */
    
    // wir erstellen eine klangQuelle in der szene
    resonanceSource = resonanceScene.createSource();
    
    // panner = new Tone.Panner3D({
    //   panningModel: "HRTF",
    //   distanceModel: "inverse", // Lautstärke nimmt mit Distanz ab
    //   refDistance: 1, // in metern
    //   rolloffFactor: 1, // wie schnell leiser wird
    //   positionX: 0,
    //   positionY: 0,
    //   positionZ: distance

    // }).toDestination();


    player = new Tone.Player({
      url: "birds.mp3",
      loop: true,
      autostart: false
    }).connect(resonanceSource.input);


    await Tone.loaded();
    player.start();

    // rode_ambix.wav: AmbiX Order 1 (4 Kanäle, ACN/SN3D) direkt in die Szene einspeisen
    const ambiResponse = await fetch('rode_ambix.wav');
    const ambiArrayBuffer = await ambiResponse.arrayBuffer();
    const ambiBuffer = await audioCtx.decodeAudioData(ambiArrayBuffer);
    ambiSource = audioCtx.createBufferSource();
    ambiSource.buffer = ambiBuffer;
    ambiSource.loop = true;
    ambiSource.connect(resonanceScene.ambisonicInput);
    ambiSource.start();

    isPlaying = true;
  } else {


  }
}


function drawHead() {
  headGfx.clear();
  headGfx.background(60);
  headGfx.lights();
  headGfx.noStroke();

  headGfx.push();
  headGfx.rotateZ(roll);
  headGfx.rotateX(pitch);
  headGfx.rotateY(yaw);

  // Kopf
  headGfx.fill(220, 180, 140);
  headGfx.sphere(55);

  // Nase (zeigt Richtung an: +Z = zum Betrachter)
  headGfx.push();
  headGfx.translate(0, 8, 56);
  headGfx.fill(195, 145, 115);
  headGfx.sphere(10);
  headGfx.pop();

  // Linkes Ohr
  headGfx.push();
  headGfx.translate(-58, 0, 0);
  headGfx.fill(200, 155, 125);
  headGfx.sphere(10);
  headGfx.pop();

  // Rechtes Ohr
  headGfx.push();
  headGfx.translate(58, 0, 0);
  headGfx.fill(200, 155, 125);
  headGfx.sphere(10);
  headGfx.pop();

  headGfx.pop();
}
