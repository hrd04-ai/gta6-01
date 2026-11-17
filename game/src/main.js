// Palmera Bay: Sunset Heat — bootstrap, camera, input and the game loop.
// The systems (city, traffic, pedestrians, player, police, missions,
// effects, HUD, sound) are wired together here through one `world` object
// of callbacks, so each module stays small and single-purpose.

import * as THREE from 'three';
import { CONFIG, PLACES } from './config.js';
import { clamp, angleDiff } from './random.js';
import { buildCity } from './city.js';
import { TrafficSystem, PlayerCar, createCarModel } from './vehicles.js';
import { PedestrianSystem } from './pedestrians.js';
import { Player } from './player.js';
import { PoliceSystem } from './police.js';
import { MissionSystem } from './missions.js';
import { Effects } from './effects.js';
import { HUD } from './hud.js';
import { SoundBank } from './audio.js';
import { saveGame, loadGame, clearSave, hasSave } from './save.js';
import { setupShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const SEED = Number(params.get('seed') || CONFIG.seed);
const SHOT = params.get('shot');

// ---------------------------------------------------------------------------
// Renderer, scene, golden-hour light
// ---------------------------------------------------------------------------
const canvasHost = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
canvasHost.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.sun.skyHorizon);
scene.fog = new THREE.Fog(CONFIG.sun.fogColor, CONFIG.sun.fogNear, CONFIG.sun.fogFar);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

// A gradient sky dome: blue overhead, sunset orange at the horizon.
{
  const skyGeo = new THREE.SphereGeometry(700, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(CONFIG.sun.skyTop) },
      horizon: { value: new THREE.Color(CONFIG.sun.skyHorizon) },
    },
    vertexShader: 'varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vPos; uniform vec3 top; uniform vec3 horizon; void main() { float h = clamp(normalize(vPos).y * 1.6 + 0.12, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.75)), 1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
}

const sunAngle = THREE.MathUtils.degToRad(CONFIG.sun.azimuthDeg);
const sunElev = THREE.MathUtils.degToRad(CONFIG.sun.elevationDeg);
const sun = new THREE.DirectionalLight(CONFIG.sun.color, CONFIG.sun.intensity);
sun.position.set(Math.cos(sunElev) * Math.cos(sunAngle) * 220, Math.sin(sunElev) * 220, Math.cos(sunElev) * Math.sin(sunAngle) * 220);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -190;
sun.shadow.camera.right = 190;
sun.shadow.camera.top = 190;
sun.shadow.camera.bottom = -190;
sun.shadow.camera.far = 600;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xffd9a0, 0x8a6a4a, 0.9);
scene.add(hemi);
// A soft warm fill from the south-east, so the sides the low sun leaves in
// shadow still read — the car's paint, the building faces, the street.
const fill = new THREE.DirectionalLight(0xffd9a8, 0.55);
fill.position.set(120, 90, 160);
scene.add(fill);

// ---------------------------------------------------------------------------
// World systems
// ---------------------------------------------------------------------------
const city = buildCity(scene, SEED);
const traffic = new TrafficSystem(scene, city, SEED);
const peds = new PedestrianSystem(scene, city, SEED);
const player = new Player(scene);
const playerCar = new PlayerCar(scene, createCarModel('sedan', 0x2980b9));
const police = new PoliceSystem(scene, city, SEED);
const missions = new MissionSystem(scene, SEED);
const effects = new Effects(scene);
const hud = new HUD(document);
const sound = new SoundBank();

let cash = CONFIG.money.startCash;
let clockMinutes = 17 * 60 + 40; // golden hour
let time = 0;
let state = 'title'; // title | playing | paused | wasted | busted
let suppressToasts = false;
let shotMode = null;
let shotSettle = 0;
let shotAutoFireTimer = 0;
let saveTimer = 0;
let garageCooldown = 0;
let stateTimer = 0; // time spent in wasted/busted overlay

player.place(PLACES.spawn.x, PLACES.spawn.z, Math.PI);
playerCar.place(6, -104, Math.PI);
playerCar.active = false;

// Tracer lines for gunfire: a short-lived bright line from muzzle to hit.
const tracers = [];
{
  const mat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 5; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, mat.clone());
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
}
function fireTracer(from, to) {
  const t = tracers.find((x) => x.life <= 0) || tracers[0];
  const pos = t.line.geometry.attributes.position;
  pos.setXYZ(0, from.x, from.y, from.z);
  pos.setXYZ(1, to.x, to.y, to.z);
  pos.needsUpdate = true;
  t.line.visible = true;
  t.line.material.opacity = 0.9;
  t.life = 0.09;
}

// ---------------------------------------------------------------------------
// Input: keyboard, mouse orbit, wheel zoom, click to shoot.
// ---------------------------------------------------------------------------
const input = {
  forward: false, back: false, left: false, right: false,
  run: false, handbrake: false, punch: false, shoot: false, shootQueued: false,
  reload: false,
};
const keys = {};
let camYaw = Math.PI;
let camPitch = 0.32;
let camDist = 9;
let dragging = false;
let dragMoved = 0;
let lastMouse = { x: 0, y: 0 };

function refreshKeys() {
  input.forward = !!(keys.KeyW || keys.ArrowUp);
  input.back = !!(keys.KeyS || keys.ArrowDown);
  input.left = !!(keys.KeyA || keys.ArrowLeft);
  input.right = !!(keys.KeyD || keys.ArrowRight);
  input.run = !!keys.ShiftLeft || !!keys.ShiftRight;
  input.handbrake = !!keys.Space;
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  refreshKeys();
  if (e.code === 'KeyF') input.punch = true;
  if (e.code === 'KeyR') input.reload = true;
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyE' && state === 'playing') tryEnterExitCar();
  if (e.code === 'Escape' && state === 'playing') pauseGame();
  else if (e.code === 'Escape' && state === 'paused') resumeGame();
  if (e.code === 'Enter' && state === 'title') startNewGame();
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  refreshKeys();
  if (e.code === 'KeyR') input.reload = false;
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  dragging = true;
  dragMoved = 0;
  lastMouse = { x: e.clientX, y: e.clientY };
  if (state === 'playing' && player.onFoot && player.armed) {
    input.shoot = true;
    input.shootQueued = true;
  }
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastMouse.x;
  const dy = e.clientY - lastMouse.y;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  lastMouse = { x: e.clientX, y: e.clientY };
  camYaw -= dx * 0.005;
  camPitch = clamp(camPitch + dy * 0.005, 0.08, 1.05);
});
window.addEventListener('pointerup', () => {
  dragging = false;
  input.shoot = false;
});
renderer.domElement.addEventListener('wheel', (e) => {
  camDist = clamp(camDist * (1 + Math.sign(e.deltaY) * 0.08), 5, 15);
  e.preventDefault();
}, { passive: false });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// The world object: every callback the systems use to talk back to the game.
// ---------------------------------------------------------------------------
const world = {
  colliders: city.colliders,
  traffic,
  peds,
  police,
  player,
  missions,
  effects,
  hud,
  sound,
  get time() { return time; },

  onCash(n) {
    cash += n;
    hud.setCash(cash);
    sound.pickup();
    doSave();
  },
  onToast(text, seconds) {
    if (!suppressToasts) hud.toast(text, seconds);
  },
  onObjective(title) {
    hud.setStoryTag(title);
  },
  onMissionComplete() {
    sound.missionJingle();
    doSave();
  },
  onMissionFailed() {
    sound.failSting();
  },
  onStoryComplete() {
    hud.toast('Story complete — Palmera Bay is yours. Fares still pay cash.', 5);
    doSave();
  },
  onUnlockPistol() {
    player.armed = true;
    hud.toast('Pistol unlocked — left click to shoot, R to reload.', 4);
  },
  onPickup() {
    sound.pickup();
  },
  onReloadStart() { sound.click(); },
  onReloaded() { sound.click(); },
  onEnterCar() {
    sound.click();
    sound.startEngine();
  },
  onPlayerHurt() {
    hud.damageFlash();
    sound.blip(140, 80, 0.15, 0.2, 'square');
  },
  onPlayerWasted() {
    state = 'wasted';
    stateTimer = 0;
    sound.failSting();
    sound.stopEngine();
    sound.stopSiren();
    hud.showWasted(true);
  },
  onBusted() {
    state = 'busted';
    stateTimer = 0;
    sound.failSting();
    sound.stopEngine();
    sound.stopSiren();
    const fine = Math.floor(cash * CONFIG.money.bustFine);
    cash -= fine;
    hud.setCash(cash);
    hud.toast(`Busted — PBPD took $${fine} as a fine.`, 4);
    hud.showBusted(true);
  },
  onRam() {
    effects.shake(0.4);
    sound.crash(0.7);
    hud.damageFlash();
  },
  onCrash(speed) {
    effects.shake(clamp(speed / 40, 0.15, 0.7));
    sound.crash(clamp(speed / 30, 0.3, 1));
    if (player.inCar) hud.damageFlash();
  },
  onPedHit(ped) {
    police.addHeat(CONFIG.wanted.hitPedestrian);
    peds.scare(ped.x, ped.z, 18);
    sound.crash(0.5);
  },
  onTireSmoke(x, z) {
    effects.tireSmoke(x, z);
  },
  onGuardShoot(g) {
    sound.gunshot();
    const from = { x: g.x, y: 1.4, z: g.z };
    const to = { x: player.x, y: 1.2, z: player.z };
    fireTracer(from, to);
    peds.scare(g.x, g.z, 20);
  },
  onPunch(p) {
    sound.punch();
    // Cops and guards first, then the nearest pedestrian in the arc.
    const cop = police.punchArc(p.x, p.z, p.heading, CONFIG.player.punchRange);
    if (cop) { police.damageCop(cop, CONFIG.player.punchDamage, world); return; }
    const guard = missions.punchArc(p.x, p.z, p.heading, CONFIG.player.punchRange);
    if (guard) { missions.damageGuard(guard, CONFIG.player.punchDamage, world); return; }
    for (const ped of peds.list) {
      if (ped.fallen) continue;
      const vx = ped.x - p.x, vz = ped.z - p.z;
      const d = Math.hypot(vx, vz);
      if (d > CONFIG.player.punchRange || d < 0.3) continue;
      const dot = (vx * Math.sin(p.heading) + vz * Math.cos(p.heading)) / d;
      if (dot > 0.5) {
        peds.fall(ped, vx / d, vz / d, 5);
        police.addHeat(10);
        peds.scare(ped.x, ped.z, 15);
        return;
      }
    }
  },
  onShoot(p) {
    sound.gunshot();
    const m = p.muzzlePosition();
    const dx = Math.sin(p.heading), dz = Math.cos(p.heading);
    const rangeMax = CONFIG.player.pistolRange;
    // Nearest shootable in the cone: cop, guard, then pedestrian.
    const copHit = police.shootRay(p.x, p.z, dx, dz, rangeMax);
    const guardHit = missions.shootRay(p.x, p.z, dx, dz, rangeMax);
    let target = null, targetDist = rangeMax, targetPos = null;
    if (copHit) { target = 'cop'; targetDist = copHit.dist; targetPos = { x: copHit.cop.x, y: 1.3, z: copHit.cop.z }; }
    if (guardHit && guardHit.dist < targetDist) { target = 'guard'; targetDist = guardHit.dist; targetPos = { x: guardHit.guard.x, y: 1.3, z: guardHit.guard.z }; }
    if (!target) {
      for (const ped of peds.list) {
        if (ped.fallen) continue;
        const vx = ped.x - p.x, vz = ped.z - p.z;
        const d = Math.hypot(vx, vz);
        if (d > targetDist || d < 0.5) continue;
        if ((vx * dx + vz * dz) / d > 0.985) {
          target = 'ped'; targetDist = d; targetPos = { x: ped.x, y: 1.2, z: ped.z };
        }
      }
    }
    const end = targetPos || { x: m.x + dx * rangeMax, y: 1.3, z: m.z + dz * rangeMax };
    effects.muzzle(m.x, m.y, m.z, dx, dz);
    fireTracer(m, end);
    effects.shake(0.06);
    police.addHeat(CONFIG.wanted.shoot);
    peds.scare(p.x, p.z, 26);
    if (target === 'cop') police.damageCop(copHit.cop, CONFIG.player.pistolDamage, world);
    if (target === 'guard') missions.damageGuard(guardHit.guard, CONFIG.player.pistolDamage, world);
    if (target === 'ped') {
      for (const ped of peds.list) {
        if (Math.abs(ped.x - end.x) < 0.6 && Math.abs(ped.z - end.z) < 0.6 && !ped.fallen) {
          peds.fall(ped, dx, dz, 6);
          police.addHeat(20);
        }
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Game state: title, pause, respawn, stealing, the garage.
// ---------------------------------------------------------------------------
function doSave() {
  const pos = player.inCar ? { x: player.inCar.x, z: player.inCar.z } : { x: player.x, z: player.z };
  saveGame({
    cash, missionIndex: missions.index, storyDone: missions.storyDone,
    health: player.health, armed: player.armed,
    x: pos.x, z: pos.z, heading: player.heading, clockMinutes,
  });
}

function toggleMute() {
  sound.setMuted(!sound.muted);
  hud.toast(sound.muted ? 'Sound off.' : 'Sound on.', 1.5);
}

function startNewGame() {
  sound.init();
  clearSave();
  cash = CONFIG.money.startCash;
  hud.setCash(cash);
  player.health = player.maxHealth;
  player.dead = false;
  player.armed = false;
  player.ammo = CONFIG.player.magSize;
  player.place(PLACES.spawn.x, PLACES.spawn.z, Math.PI);
  playerCar.place(6, -104, Math.PI);
  playerCar.active = false;
  playerCar.hp = CONFIG.car.health;
  police.clearWanted();
  missions.clearGuards();
  state = 'playing';
  hud.hideMenus();
  hud.setObjective('First Wheels', 'Steal any car (press E near one)', null, null);
  missions.startMission(0, world);
  hud.toast('Welcome to Palmera Bay. Mara is waiting on your first job.', 4);
}

function continueGame() {
  const s = loadGame();
  if (!s) { startNewGame(); return; }
  sound.init();
  cash = s.cash;
  hud.setCash(cash);
  player.health = s.health;
  player.dead = false;
  player.armed = s.armed;
  player.ammo = CONFIG.player.magSize;
  player.place(s.x, s.z, s.heading);
  clockMinutes = s.clockMinutes || clockMinutes;
  police.clearWanted();
  state = 'playing';
  hud.hideMenus();
  if (s.storyDone) {
    missions.storyDone = true;
    missions.active = false;
    missions.faresEnabled = true;
    hud.setObjective('Free Roam', 'Palmera Bay is yours. Fares pay cash.', null, null);
  } else {
    missions.startMission(s.missionIndex, world);
  }
  hud.toast('Welcome back, Rico.', 3);
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  sound.stopEngine();
  hud.showPause(true);
}

function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  hud.showPause(false);
}

function respawnAt(place, label) {
  player.dead = false;
  player.health = player.maxHealth;
  player.place(place.x, place.z, 0);
  if (player.inCar) {
    player.inCar.active = false;
    player.inCar = null;
    player.onFoot = true;
    player.model.group.visible = true;
  }
  police.clearWanted();
  missions.restartCurrent(world);
  hud.hideMenus();
  hud.toast(`You wake up at ${label}. The story continues.`, 4);
  state = 'playing';
  doSave();
}

function tryEnterExitCar() {
  if (player.inCar) {
    player.exitCar(city.colliders);
    sound.stopEngine();
    return;
  }
  // Nearest stealable car: parked first, then slow traffic.
  const parked = traffic.nearestParked(player.x, player.z, CONFIG.car.enterRange);
  const moving = traffic.nearestTrafficCar(player.x, player.z, CONFIG.car.enterRange);
  let stolen = null;
  if (parked) {
    stolen = { kind: parked.kind, color: parked.color, x: parked.x, z: parked.z, heading: parked.heading };
    parked.taken = true;
    traffic.scene.remove(parked.model.group);
  } else if (moving && moving.speed < 4) {
    stolen = { kind: moving.model.kind, color: moving.model.color, x: moving.x, z: moving.z, heading: moving.heading };
    traffic.scene.remove(moving.model.group);
    traffic.cars = traffic.cars.filter((c) => c !== moving);
  }
  if (!stolen) {
    sound.denied();
    hud.toast('No car in reach. Get closer to one and press E.', 2);
    return;
  }
  // The old ride becomes a parked car where it stands; the stolen car
  // becomes the ride, as a fresh model of the same kind and colour.
  traffic.parked.push({
    model: playerCar.model, x: playerCar.x, z: playerCar.z,
    heading: playerCar.heading, kind: playerCar.kind, color: playerCar.color, taken: false,
  });
  playerCar.model = createCarModel(stolen.kind, stolen.color);
  playerCar.kind = stolen.kind;
  playerCar.color = stolen.color;
  scene.add(playerCar.model.group);
  playerCar.place(stolen.x, stolen.z, stolen.heading);
  playerCar.hp = CONFIG.car.health;
  player.enterCar(playerCar, world);
  police.addHeat(CONFIG.wanted.stealCar);
  peds.scare(player.x, player.z, 12);
}

// The garage: drive in, pay up, drive out fixed and clean.
function checkGarage() {
  if (!player.inCar || garageCooldown > 0) return;
  const g = PLACES.garage;
  const d = Math.hypot(player.inCar.x - g.x, player.inCar.z - g.z);
  if (d > 12) return;
  garageCooldown = 4;
  const messages = [];
  if (playerCar.hp < 100 && cash >= CONFIG.money.garageRepair) {
    cash -= CONFIG.money.garageRepair;
    playerCar.hp = 100;
    messages.push(`repaired for $${CONFIG.money.garageRepair}`);
  }
  if (police.stars > 0 && cash >= CONFIG.money.garageClean) {
    cash -= CONFIG.money.garageClean;
    police.clearWanted();
    messages.push(`resprayed clean for $${CONFIG.money.garageClean}`);
  }
  if (messages.length) {
    hud.setCash(cash);
    hud.toast(`Spray & Save: ${messages.join(', ')}.`, 3);
    sound.pickup();
  }
}

// ---------------------------------------------------------------------------
// Camera: third-person follow that settles behind the action, or the fixed
// pose a screenshot asked for.
// ---------------------------------------------------------------------------
function cameraHeading() {
  return camYaw + Math.PI;
}

function updateCamera(dt) {
  if (shotMode && shotMode.camera) {
    const cam = shotMode.camera;
    if (cam.follow) {
      // A chase camera that rides with the car, so a moving shot keeps its
      // framing while the car drives away from a fixed pose.
      const f = player.inCar ? player.inCar : player;
      const fx = Math.sin(f.heading), fz = Math.cos(f.heading);
      camera.position.set(f.x - fx * cam.back, cam.height, f.z - fz * cam.back);
      camera.lookAt(f.x + fx * cam.lookAhead, cam.lookHeight, f.z + fz * cam.lookAhead);
      return;
    }
    camera.position.set(cam.pos.x, cam.pos.y, cam.pos.z);
    camera.lookAt(cam.look.x, cam.look.y, cam.look.z);
    return;
  }
  const focus = player.inCar
    ? { x: player.inCar.x, z: player.inCar.z, y: 1.8 }
    : { x: player.x, z: player.z, y: 1.7 };
  // Drift the camera behind the direction of travel.
  const moving = player.inCar ? Math.abs(player.inCar.speed) > 3 : player.speed > 1.5;
  if (moving) {
    const h = player.inCar ? player.inCar.heading : player.heading;
    const wantYaw = h + Math.PI;
    camYaw += clamp(angleDiff(camYaw, wantYaw), -1.4 * dt, 1.4 * dt);
  }
  const dist = camDist + (player.inCar ? 3 : 0);
  const pitch = camPitch + (player.inCar ? 0.06 : 0);
  const cx = focus.x + Math.sin(camYaw) * Math.cos(pitch) * dist;
  const cz = focus.z + Math.cos(camYaw) * Math.cos(pitch) * dist;
  const cy = focus.y + Math.sin(pitch) * dist;
  const shake = effects.shakeOffset();
  camera.position.set(cx + shake.x, cy + shake.y, cz);
  camera.lookAt(focus.x, focus.y + 0.4, focus.z);
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
document.getElementById('btnNew')?.addEventListener('click', () => { sound.init(); startNewGame(); });
document.getElementById('btnContinue')?.addEventListener('click', () => { sound.init(); continueGame(); });
document.getElementById('btnResume')?.addEventListener('click', () => resumeGame());
document.getElementById('btnSave')?.addEventListener('click', () => { doSave(); hud.toast('Progress saved.', 2); });
document.getElementById('btnRestart')?.addEventListener('click', () => {
  hud.showPause(false);
  missions.restartCurrent(world);
  hud.toast('Mission restarted.', 2);
  state = 'playing';
});
document.getElementById('btnQuit')?.addEventListener('click', () => {
  state = 'title';
  sound.stopEngine();
  sound.stopSiren();
  hud.showTitle();
});
document.getElementById('btnMute')?.addEventListener('click', () => toggleMute());

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
let hudTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state === 'playing' || shotMode) {
    time += dt;
    clockMinutes += dt * 0.25;
    garageCooldown = Math.max(0, garageCooldown - dt);
    saveTimer += dt;
    if (saveTimer > 30) { saveTimer = 0; doSave(); }

    const camH = cameraHeading();
    if (player.onFoot) player.update(dt, input, camH, world);
    else playerCar.update(dt, input, world);
    input.punch = false;

    traffic.update(dt, { playerCar });
    peds.update(dt);
    police.update(dt, world);
    missions.update(dt, world);
    effects.update(dt);
    city.updateTrafficLights(time);
    for (const boat of city.boats) {
      boat.position.y = 0.1 + Math.sin(time * 0.7 + boat.position.x) * 0.15;
      boat.rotation.z = Math.sin(time * 0.5 + boat.position.z) * 0.02;
    }
    for (const t of tracers) {
      if (t.life > 0) {
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
        if (t.life <= 0) t.line.visible = false;
      }
    }

    // Car health: a wrecked ride explodes and Rico walks away from it.
    if (player.inCar && playerCar.hp <= 0) {
      effects.explosion(playerCar.x, 1, playerCar.z);
      sound.crash(1);
      police.addHeat(10);
      const car = player.inCar;
      player.exitCar(city.colliders);
      car.hp = 100;
      car.active = false;
      car.place(car.x + 6, car.z + 6, car.heading);
      hud.toast('Your ride is toast. Find another one.', 3);
    }

    // Engine and siren follow the action.
    if (player.inCar) {
      sound.setEngine(Math.abs(playerCar.speed) / CONFIG.car.maxSpeed, true);
    } else {
      sound.setEngine(0, false);
    }
    const nearPolice = police.nearestDistance(player.x, player.z);
    if (police.stars > 0 && nearPolice < 80) sound.startSiren();
    else sound.stopSiren();

    checkGarage();

    // HUD, four times a second.
    hudTimer += dt;
    if (hudTimer > 0.25) {
      hudTimer = 0;
      hud.setCash(cash);
      hud.setHealth(player.health, player.maxHealth);
      hud.setStars(police.stars);
      hud.setSpeed(player.inCar ? playerCar.speedKmh : 0, !!player.inCar);
      hud.setWeapon(player.armed ? `Pistol ${player.ammo}/${CONFIG.player.magSize}` : 'Fists');
      hud.setClock(clockMinutes);
      hud.setCrosshair(player.onFoot && player.armed);
      const obj = missions.objectiveText();
      const target = missions.target || (missions.fare ? { x: missions.fare.x, z: missions.fare.z } : null);
      let dist = null;
      if (target) {
        const px = player.inCar ? playerCar.x : player.x;
        const pz = player.inCar ? playerCar.z : player.z;
        dist = Math.hypot(target.x - px, target.z - pz);
      }
      hud.setObjective(obj.title, obj.text, obj.timer ?? null, dist);
      hud.drawMinimap({
        x: player.inCar ? playerCar.x : player.x,
        z: player.inCar ? playerCar.z : player.z,
        heading: player.inCar ? playerCar.heading : player.heading,
        traffic: traffic.cars,
        police: [...police.cars, ...police.cops],
        objective: target,
        stars: police.stars,
        time,
      });
    }

    // Screenshot mode: let the scene settle, then signal the driver.
    if (shotMode) {
      shotSettle += dt;
      if (shotMode.autoFire) {
        shotAutoFireTimer -= dt;
        if (shotAutoFireTimer <= 0) {
          shotAutoFireTimer = 0.9;
          if (player.armed && !player.dead) world.onShoot(player);
        }
      }
      if (shotSettle > 1.6 && !window.__shotReady) {
        window.__shotReady = true;
      }
    }
  }

  if (state === 'wasted' || state === 'busted') {
    stateTimer += dt;
    if (stateTimer > 2.6) {
      if (state === 'wasted') respawnAt(PLACES.hospital, 'St. Coral Hospital');
      else respawnAt(PLACES.policeStation, 'PBPD Station');
    }
  }

  // The sun follows the player so shadows stay crisp everywhere.
  sun.position.set(
    player.x + Math.cos(sunElev) * Math.cos(sunAngle) * 220,
    Math.sin(sunElev) * 220,
    player.z + Math.cos(sunElev) * Math.sin(sunAngle) * 220,
  );
  sun.target.position.set(player.x, 0, player.z);
  sun.target.updateMatrixWorld();

  updateCamera(dt);
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
hud.setCash(cash);
hud.setHealth(player.health, player.maxHealth);
hud.setStars(0);
hud.setWeapon('Fists');
hud.setClock(clockMinutes);

const btnContinue = document.getElementById('btnContinue');
if (btnContinue) btnContinue.style.display = hasSave() ? 'inline-block' : 'none';

if (SHOT) {
  // Screenshot mode: skip the title, stage the scene, play it live.
  sound.init();
  state = 'playing';
  hud.hideMenus();
  suppressToasts = true;
  player.invulnTimer = 9999; // the shot must not end in a respawn
  const game = {
    scene, player, playerCar, traffic, peds, police, missions, effects, hud, sound,
    worldCallbacks: world,
    get cash() { return cash; },
    set cash(v) { cash = v; hud.setCash(cash); },
    get clockMinutes() { return clockMinutes; },
    set clockMinutes(v) { clockMinutes = v; },
    get time() { return time; },
    save: () => doSave(),
    suppressToasts: true,
  };
  shotMode = setupShot(game, SHOT);
  if (shotMode.camera && shotMode.camera.pos) {
    camYaw = Math.atan2(
      shotMode.camera.pos.x - shotMode.camera.look.x,
      shotMode.camera.pos.z - shotMode.camera.look.z,
    );
  }
  hud.setObjective(missions.objectiveText().title, missions.objectiveText().text, null, null);
} else {
  hud.showTitle();
}

window.__game = {
  player, playerCar, traffic, peds, police, missions, effects, hud, sound, city,
  get cash() { return cash; },
  set cash(v) { cash = v; hud.setCash(cash); },
  get time() { return time; },
  get clockMinutes() { return clockMinutes; },
  save: () => doSave(),
};
animate();
