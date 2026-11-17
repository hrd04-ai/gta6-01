// Palmera Bay: Sunset Heat — game shell. Owns the renderer, the loop, input,
// camera, the title/pause/wasted/busted state machine and the wiring between
// every system. The world itself lives in city.js and the other modules.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng } from './random.js';
import { AudioSys } from './audio.js';
import { Effects } from './effects.js';
import { buildCity } from './city.js';
import { TrafficSystem, ParkedCars, drivePlayerCar, collideWorld } from './vehicles.js';
import { PedSystem } from './pedestrians.js';
import { Player } from './player.js';
import { PoliceSystem } from './police.js';
import { MissionSystem } from './missions.js';
import { HUD } from './hud.js';
import { stageShot } from './shots.js';
import { loadSave, writeSave, clearSave } from './save.js';

const SPAWN = { x: -22, z: 0 };
const HOSPITAL = { x: -22, z: 66 };
const POLICE_STATION = { x: -66, z: -22 };

export class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    document.getElementById('game-root').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CFG.skyBottom);
    this.scene.fog = new THREE.Fog(CFG.fogColor, CFG.fogNear, CFG.fogFar);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(-40, 26, 60);

    // Sunset sun + warm hemisphere light.
    const sun = new THREE.DirectionalLight(CFG.sunColor, 2.6);
    sun.position.set(-120, 140, -80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -190;
    sun.shadow.camera.right = 190;
    sun.shadow.camera.top = 190;
    sun.shadow.camera.bottom = -190;
    sun.shadow.camera.far = 500;
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xffd9a0, 0x5a6a7a, 1.15));

    this.rng = makeRng(CFG.shotSeed * 101 + 13);
    this.audio = new AudioSys();
    this.effects = new Effects(this.scene);
    this.city = buildCity(this.scene);
    this.traffic = new TrafficSystem(this.scene, this.city, makeRng(99));
    this.parked = new ParkedCars(this.scene, makeRng(7));
    this.peds = new PedSystem(this.scene, makeRng(21));
    this.player = new Player(this.scene);
    this.police = new PoliceSystem(this.scene, this.city);
    this.missions = new MissionSystem(this.scene);
    this.hud = new HUD();

    this.state = 'title';
    this.time = 0;
    this.cash = CFG.startCash;
    this.cameraYaw = Math.PI;
    this.cameraPitch = 0.32;
    this.cameraMode = 'follow';
    this.events = [];
    this.keys = {};
    this.mouseDown = false;
    this.dragging = false;
    this.lastMouse = { x: 0, y: 0 };
    this.saveData = loadSave();
    this.clock = new THREE.Clock();
    this.firstFrame = false;

    this.bindInput();
    window.addEventListener('resize', () => this.onResize());
    this.showTitle();
    this.loop();
  }

  // ---------- menus ----------
  showTitle() {
    this.state = 'title';
    const buttons = [];
    if (this.saveData) {
      buttons.push({
        label: `Continue — Mission ${this.saveData.mission + 1}, $${this.saveData.cash}`,
        onClick: () => this.startGame(true),
      });
    }
    buttons.push({ label: 'New Game', onClick: () => this.startGame(false) });
    buttons.push({
      label: 'How to Play',
      onClick: () => this.showHowTo(),
    });
    this.hud.showMenu(
      'PALMERA BAY',
      'Sunset Heat — an open-world crime story. Steal cars, outrun the PD, run Mara\'s jobs and take the Bay Bank for $5,000. WASD move/drive · Mouse aim · Click shoot · F punch · E enter car · 1 pistol · R reload · G garage · P pause.',
      buttons,
    );
  }

  showHowTo() {
    this.hud.showMenu(
      'HOW TO PLAY',
      'On foot: WASD to move, Shift to sprint, F to punch, 1 to draw your pistol, click to shoot, R to reload. Near a parked car press E to steal it (the cops notice). Driving: W/S accelerate and brake, A/D steer, Space handbrake. Missions come from Mara — follow the yellow beacon. At the garage press G: repair $80, clean your wanted level $200. Side fares pay $45. Save: autosaves after every mission.',
      [{ label: 'Back', onClick: () => this.showTitle() }],
    );
  }

  showPause() {
    this.state = 'paused';
    this.saveGame();
    this.hud.showMenu('PAUSED', 'Take a breath, Rico. The bay will wait.', [
      { label: 'Resume', onClick: () => this.resume() },
      { label: 'Restart from Title', onClick: () => { this.hud.hideMenu(); this.showTitle(); } },
    ]);
  }

  resume() {
    this.state = 'playing';
    this.hud.hideMenu();
  }

  showWasted() {
    this.state = 'wasted';
    this.hud.showDialogue('Mara: Rico! Get up — the bay does not wait for anybody.');
    this.hud.showMenu('WASTED', 'Rico is down. The hospital patches him up for $150.', [
      {
        label: 'Respawn at Hospital (−$150)',
        onClick: () => {
          this.cash = Math.max(0, this.cash - 150);
          this.player.reset(new THREE.Vector3(HOSPITAL.x, 0, HOSPITAL.z));
          this.police.clearWanted();
          this.resume();
        },
      },
    ]);
  }

  showBusted() {
    this.state = 'busted';
    const bail = Math.min(200, this.cash);
    this.hud.showMenu('BUSTED', `The Palmera Bay PD has you. Bail is $${bail}.`, [
      {
        label: `Pay Bail $${bail}`,
        onClick: () => {
          this.cash -= bail;
          this.player.reset(new THREE.Vector3(POLICE_STATION.x, 0, POLICE_STATION.z));
          this.police.clearWanted();
          this.resume();
        },
      },
    ]);
  }

  // ---------- game flow ----------
  startGame(continueSave) {
    this.audio.ensure();
    this.audio.startMusic();
    this.hud.hideMenu();
    this.state = 'playing';
    if (continueSave && this.saveData) {
      const s = this.saveData;
      this.cash = s.cash;
      this.player.reset(new THREE.Vector3(s.px, 0, s.pz));
      this.police.wanted = s.wanted;
      this.police.heat = s.wanted * 20;
      this.missions.index = Math.min(s.mission, 4);
      this.missions.faresDone = s.fares || 0;
      this.missions.startMission(this, this.missions.index);
      this.hud.toast('Save loaded — welcome back, Rico');
    } else {
      clearSave();
      this.saveData = null;
      this.cash = CFG.startCash;
      this.player.reset(new THREE.Vector3(SPAWN.x, 0, SPAWN.z));
      this.police.clearWanted();
      this.missions.index = 0;
      this.missions.done = false;
      this.missions.faresDone = 0;
      this.missions.startMission(this, 0);
    }
  }

  saveGame() {
    writeSave({
      missionIndex: this.missions.index,
      cash: this.cash,
      player: this.player,
      wanted: this.police.wanted,
      faresDone: this.missions.faresDone,
    });
  }

  // ---------- input ----------
  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (this.state !== 'playing') {
        if (e.code === 'Enter' && this.state === 'title') this.startGame(!!this.saveData);
        return;
      }
      if (e.code === 'KeyP' || e.code === 'Escape') { this.showPause(); return; }
      if (e.code === 'KeyM') { this.audio.setMuted(!this.audio.muted); this.hud.toast(this.audio.muted ? 'Sound off' : 'Sound on'); return; }
      if (e.code === 'Digit1') { this.player.armed = true; this.audio.click(); }
      if (e.code === 'Digit2') { this.player.armed = false; this.audio.click(); }
      if (e.code === 'KeyR' && this.player.armed && this.player.ammo < CFG.pistolMag) {
        this.player.reloadTimer = 1.1;
        this.audio.reload();
      }
      if (e.code === 'KeyF') this.player.queuePunch();
      if (e.code === 'KeyE') this.tryEnterExitCar();
      if (e.code === 'KeyG') this.tryGarage();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.dragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      if (this.state === 'playing') this.handleShoot();
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging || this.state !== 'playing') return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      this.cameraYaw -= dx * 0.005;
      this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + dy * 0.003, -0.1, 0.9);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  inputState() {
    return {
      up: !!(this.keys.KeyW || this.keys.ArrowUp),
      down: !!(this.keys.KeyS || this.keys.ArrowDown),
      left: !!(this.keys.KeyA || this.keys.ArrowLeft),
      right: !!(this.keys.KeyD || this.keys.ArrowRight),
      sprint: !!this.keys.ShiftLeft,
      handbrake: !!this.keys.Space,
    };
  }

  tryEnterExitCar() {
    const player = this.player;
    if (player.inCar) {
      const car = player.inCar;
      player.inCar = null;
      player.mesh.visible = true;
      player.pos.set(car.pos.x + Math.sin(car.heading + Math.PI / 2) * 3, 0, car.pos.z + Math.cos(car.heading + Math.PI / 2) * 3);
      player.mesh.position.copy(player.pos);
      this.audio.setEngine(0, false);
      return;
    }
    const near = this.parked.nearest(player.pos, 5);
    if (near) {
      near.taken = true;
      player.inCar = near;
      player.mesh.visible = false;
      this.police.addHeat(8);
      this.hud.toast('Car stolen — the PD noticed');
      this.audio.pickup();
      return;
    }
    // Also allow taking a slow traffic car.
    let best = null;
    let bestD = 5;
    for (const car of this.traffic.cars) {
      const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
      if (d < bestD && car.speed < 4) { bestD = d; best = car; }
    }
    if (best) {
      this.traffic.cars.splice(this.traffic.cars.indexOf(best), 1);
      this.scene.remove(best.mesh);
      const mesh = best.mesh;
      this.scene.add(mesh);
      player.inCar = { mesh, pos: best.pos, heading: best.heading, speed: 0, hp: 100, color: best.color, kind: 'player' };
      player.mesh.visible = false;
      this.police.addHeat(10);
      this.hud.toast('Carjacked! The PD is on you');
      this.audio.pickup();
    }
  }

  tryGarage() {
    const g = this.city.landmarks.garage;
    const pPos = this.player.inCar ? this.player.inCar.pos : this.player.pos;
    const d = Math.hypot(pPos.x - g.x, pPos.z - g.z);
    if (d > 12) { this.hud.toast('Get to the garage on 5th Ave to use it'); return; }
    if (this.player.inCar && this.player.inCar.hp < 100 && this.cash >= CFG.repairCost) {
      this.cash -= CFG.repairCost;
      this.player.inCar.hp = 100;
      this.hud.toast(`Repaired — $${CFG.repairCost}`);
      this.audio.pickup();
      return;
    }
    if (this.police.wanted > 0 && this.cash >= CFG.cleanCost) {
      this.cash -= CFG.cleanCost;
      this.police.clearWanted();
      this.hud.toast(`Wanted level cleaned — $${CFG.cleanCost}`);
      this.audio.pickup();
      return;
    }
    this.hud.toast('Nothing to fix here — car is fine and you are clean');
    this.audio.denied();
  }

  shootTargets() {
    return [
      ...this.missions.aliveGuards(),
      ...this.police.cops.filter((c) => !c.dead),
    ];
  }

  handleShoot() {
    const player = this.player;
    if (!player.armed || player.reloadTimer > 0) return;
    if (player.ammo <= 0) {
      this.audio.denied();
      this.hud.toast('Magazine empty — press R to reload');
      return;
    }
    const result = player.shoot(this.camera, this.shootTargets());
    if (!result) return;
    this.audio.shot();
    const muzzle = new THREE.Vector3(player.pos.x, 1.45, player.pos.z);
    this.effects.muzzle(muzzle);
    this.effects.burst(result.point, 4, 0xffd76a, 4, 2, 0.3);
    this.effects.addShake(0.12);
    if (result.target) {
      const t = result.target;
      t.hp = (t.hp ?? 100) - CFG.pistolDamage;
      this.effects.burst(result.point, 8, 0xc22e2e, 5, 3, 0.5);
      if (t.hp <= 0) {
        t.dead = true;
        if (t.mesh) {
          t.mesh.rotation.z = Math.PI / 2;
          t.mesh.position.y = 0.35;
        }
        if (this.missions.guards.includes(t)) this.hud.toast('Guard down');
        else this.hud.toast('Cop down — the heat is on you now');
      }
      this.police.addHeat(6);
      this.peds.scare(player.pos.x, player.pos.z, 30);
    } else {
      this.peds.scare(player.pos.x, player.pos.z, 22);
    }
  }

  handlePunch() {
    const player = this.player;
    const fx = Math.cos(player.heading);
    const fz = -Math.sin(player.heading);
    let hitAny = false;
    for (const t of [...this.shootTargets(), ...this.peds.peds.filter((p) => !p.down)]) {
      const dx = t.pos.x - player.pos.x;
      const dz = t.pos.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < CFG.punchRange && dx * fx + dz * fz > 0) {
        hitAny = true;
        if (t.hp !== undefined) {
          t.hp -= CFG.punchDamage;
          if (t.hp <= 0 && !t.dead) {
            t.dead = true;
            if (t.mesh) { t.mesh.rotation.z = Math.PI / 2; t.mesh.position.y = 0.35; }
          }
        } else {
          this.peds.knockDown(player.pos, CFG.punchRange);
        }
        this.effects.burst(new THREE.Vector3(t.pos.x, 1.2, t.pos.z), 5, 0xffffff, 3, 2, 0.4);
      }
    }
    if (hitAny) {
      this.audio.punch();
      this.police.addHeat(5);
      this.peds.scare(player.pos.x, player.pos.z, 18);
    }
  }

  // ---------- camera ----------
  updateCamera(dt) {
    const player = this.player;
    const focus = player.inCar ? player.inCar.pos : player.pos;
    const heading = player.inCar ? player.inCar.heading : player.heading;
    const yaw = player.armed && !player.inCar ? this.cameraYaw : (player.inCar ? heading : this.cameraYaw);
    const dist = player.inCar ? 13 : 9;
    const height = player.inCar ? 5.2 : 4.2;
    const cx = focus.x - Math.sin(yaw) * dist;
    const cz = focus.z - Math.cos(yaw) * dist;
    const want = new THREE.Vector3(cx, height, cz);
    this.camera.position.lerp(want, Math.min(1, dt * 6));
    // Keep the camera out of buildings: lift it when blocked.
    const hit = collideWorld(this.camera.position.x, this.camera.position.z, 1.5, this.city.colliders);
    if (hit) this.camera.position.y = Math.max(this.camera.position.y, 14);
    // Lift it higher when a building stands between camera and player.
    for (let t = 0.2; t < 1; t += 0.2) {
      const sx = THREE.MathUtils.lerp(this.camera.position.x, focus.x, t);
      const sz = THREE.MathUtils.lerp(this.camera.position.z, focus.z, t);
      if (collideWorld(sx, sz, 1, this.city.colliders)) {
        this.camera.position.y = Math.max(this.camera.position.y, 15);
        break;
      }
    }
    const look = new THREE.Vector3(focus.x, player.inCar ? 1.6 : 1.5, focus.z);
    if (player.armed && !player.inCar) {
      look.x += Math.sin(this.cameraYaw) * 4;
      look.z += Math.cos(this.cameraYaw) * 4;
    }
    this.camera.lookAt(look);
    const shake = this.effects.shakeOffset();
    this.camera.position.x += shake.x;
    this.camera.position.y += shake.y;
    this.hud.setCrosshair(player.armed && !player.inCar && this.state === 'playing');
  }

  updateTitleCamera(dt) {
    const t = this.time * 0.05;
    this.camera.position.set(Math.cos(t) * 150, 70, Math.sin(t) * 150);
    this.camera.lookAt(0, 0, 0);
  }

  // ---------- loop ----------
  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    // Staged screenshots freeze the simulation: the frame is composed once
    // and rendered identically every frame.
    if (this.frozen) {
      this.renderer.render(this.scene, this.camera);
      if (!this.firstFrame) {
        this.firstFrame = true;
        if (window.__PB) window.__PB.ready = true;
      }
      return;
    }
    if (this.state === 'title') {
      this.city.update(dt, this.time);
      this.traffic.update(dt);
      this.updateTitleCamera(dt);
    } else if (this.state === 'playing') {
      const input = this.inputState();
      if (this.keys.ArrowLeft) this.cameraYaw += 1.9 * dt;
      if (this.keys.ArrowRight) this.cameraYaw -= 1.9 * dt;
      const player = this.player;
      if (player.inCar) {
        const ev = drivePlayerCar(player.inCar, input, dt, this.city.colliders, this.effects, this.audio);
        if (ev.hit) {
          this.audio.crash();
          this.effects.burst(player.inCar.pos.clone().setY(1), 6, 0xffa040, 4, 2, 0.5);
          this.police.addHeat(2);
        }
        if (player.inCar.hp <= 0) {
          this.events.push('carWrecked');
          const wreck = player.inCar;
          player.inCar = null;
          player.mesh.visible = true;
          player.pos.set(wreck.pos.x + 4, 0, wreck.pos.z + 2);
          this.hud.toast('Your car is wrecked!');
          this.audio.crash();
        }
      } else {
        const acted = player.update(dt, input, this.cameraYaw, this.city.colliders, this.effects);
        if (acted === 'punch') this.handlePunch();
        this.audio.setEngine(0, false);
      }
      this.city.update(dt, this.time);
      this.traffic.update(dt);
      this.peds.update(dt, player.inCar ? player.inCar.pos : player.pos, player.inCar ? Math.abs(player.inCar.speed) : player.speed);
      const policeResult = this.police.update(dt, this);
      if (policeResult.busted) {
        this.audio.setSiren(false);
        this.showBusted();
      }
      this.missions.update(dt, this);
      this.effects.update(dt);
      this.audio.setSiren(this.police.wanted > 0);
      // Wasted check.
      if (player.health <= 0) {
        this.showWasted();
      }
      // Drain queued events.
      if (this.events.includes('wasted')) this.showWasted();
      if (this.events.includes('carWrecked')) { /* handled above */ }
      this.events = [];
      this.updateCamera(dt);
      this.hud.update(this);
      if (player.health < 45) this.hud.flashDamage();
    }
    this.renderer.render(this.scene, this.camera);
    if (!this.firstFrame) {
      this.firstFrame = true;
      if (window.__PB) window.__PB.ready = true;
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Boot. The ?shot= parameter stages a screenshot state before first render.
const game = new Game();
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  game.state = 'playing';
  game.hud.hideMenu();
  game.audio.ensure();
  stageShot(game, shot);
}
window.__PB = {
  ready: game.firstFrame,
  game,
  state() {
    const g = game;
    return {
      state: g.state,
      mission: g.missions.index,
      cash: Math.round(g.cash),
      health: Math.round(g.player.health),
      wanted: g.police.wanted,
      inCar: !!g.player.inCar,
      ammo: g.player.ammo,
      px: +(g.player.inCar ? g.player.inCar.pos.x : g.player.pos.x).toFixed(1),
      pz: +(g.player.inCar ? g.player.inCar.pos.z : g.player.pos.z).toFixed(1),
      cars: g.traffic.cars.length,
      peds: g.peds.countStanding(),
      guards: g.missions.aliveGuards().length,
      pursuit: g.police.pursuit.length,
    };
  },
  start() { game.startGame(false); },
  keys(codes, ms = 400) {
    for (const c of codes) game.keys[c] = true;
    window.setTimeout(() => { for (const c of codes) game.keys[c] = false; }, ms);
  },
  setYaw(yaw) { game.cameraYaw = yaw; },
  click() { game.handleShoot(); },
};
