// Palmera Bay: Sunset Heat — the game itself.
// Owns the loop, the camera, input, combat, car enter/exit, collisions
// and the wiring between the city, the player, traffic, pedestrians,
// the police and the missions. One Game per page; the page boots it
// from index.html.

import { WORLD, PLAYER, CAR, ECONOMY, POLICE } from './config.js';
import { City } from './city.js';
import { AudioEngine } from './audio.js';
import { Effects } from './effects.js';
import { Player } from './player.js';
import { Car, separateCars, spawnParkedCars, spawnTraffic } from './vehicles.js';
import { spawnPedestrians } from './pedestrians.js';
import { PoliceDirector, PoliceUnit } from './police.js';
import { MissionManager } from './missions.js';
import { Hud } from './hud.js';
import { loadSave, writeSave, missionCompleted } from './save.js';
import { makeRng, clamp } from './random.js';
import { shotFromUrl, stageShot } from './shots.js';

const BULLET_SPEED = 950;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rng = makeRng(20261119);
    this.city = new City(20261119);
    this.audio = new AudioEngine();
    this.effects = new Effects();
    this.save = loadSave();
    this.player = new Player(630, 700);
    this.cars = [];
    this.peds = [];
    this.bullets = [];
    this.police = new PoliceDirector(this.city);
    this.missions = new MissionManager();
    this.missions.loadCompleted(this.save.completedMissions);
    this.hud = new Hud();
    this.camera = { x: 630, y: 700, w: 1200, h: 800, zoom: 1 };
    this.state = 'title'; // title | playing | paused | busted | wasted | complete
    this.time = 0;
    this.playSeconds = 0;
    this.input = {
      keys: new Set(),
      mouseDown: false,
      mouseX: 0,
      mouseY: 0,
      mouseWorldX: 0,
      mouseWorldY: 0,
    };
    this.lastTs = 0;
    this.bustedTimer = 0;
    this.wastedTimer = 0;
    this.enterCooldown = 0;
    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();
    this.bindInput();
    this.populateWorld();
  }

  populateWorld() {
    this.cars = spawnParkedCars(this.city, 10, makeRng(4242));
    this.cars.push(...spawnTraffic(this.city, 22, makeRng(1337)));
    // The player's starter car: a Coral coupe by Vera's garage.
    const starter = new Car(700, 700, Math.PI / 2, {
      color: '#37e0d8', model: 'Coral', kind: 'parked', driver: 'none',
    });
    starter.owned = true; // Rico's own car: taking it is not a crime.
    this.cars.push(starter);
    this.peds = spawnPedestrians(this.city, 42, 777);
  }

  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      this.audio.ensure();
      this.input.keys.add(e.code);
      if (e.code === 'KeyM') {
        this.audio.setMuted(!this.audio.muted);
        this.save.muted = this.audio.muted;
        writeSave(this.save);
        this.hud.toast(this.audio.muted ? 'Sound muted' : 'Sound on');
      }
      if (e.code === 'KeyP' && (this.state === 'playing' || this.state === 'paused')) {
        this.state = this.state === 'playing' ? 'paused' : 'playing';
      }
      if (e.code === 'KeyR' && (this.state === 'busted' || this.state === 'wasted')) {
        this.respawn();
      }
      if (e.code === 'KeyE') this.tryEnterExitCar();
    });
    window.addEventListener('keyup', (e) => this.input.keys.delete(e.code));
    this.canvas.addEventListener('mousemove', (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.input.mouseX = e.clientX - r.left;
      this.input.mouseY = e.clientY - r.top;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.audio.ensure();
        this.input.mouseDown = true;
      }
    });
    window.addEventListener('mouseup', () => {
      this.input.mouseDown = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = w;
    this.viewH = h;
  }

  cameraSnap(x, y) {
    this.camera.x = x;
    this.camera.y = y;
  }

  // The context missions receive: the world, through the game's own
  // public surface, so a mission never reaches into private state.
  missionContext() {
    return {
      player: this.player,
      cars: this.cars,
      police: this.police,
      audio: this.audio,
      effects: this.effects,
      vehicleModule: { Car },
    };
  }

  spawnChasePack(n) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.next() * Math.PI * 2;
      const px = this.player.inCar ? this.player.inCar.x : this.player.x;
      const py = this.player.inCar ? this.player.inCar.y : this.player.y;
      const x = clamp(px + Math.cos(a) * 650, 60, WORLD.width - 60);
      const y = clamp(py + Math.sin(a) * 650, 60, WORLD.height - 260);
      if (this.city.buildingAt(x, y)) continue;
      this.police.units.push(new PoliceUnit(x, y, false));
    }
  }

  spawnFootCops(n, x, y) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const cx = clamp(x + Math.cos(a) * 220, 60, WORLD.width - 60);
      const cy = clamp(y + Math.sin(a) * 220, 60, WORLD.height - 260);
      this.police.units.push(new PoliceUnit(cx, cy, true));
    }
  }

  start() {
    this.audio.ensure();
    this.audio.setMuted(this.save.muted);
    if (this.save.musicOn) this.audio.startMusic();
    this.state = 'playing';
    document.getElementById('menu')?.classList.add('hidden');
    this.hud.toast('Welcome to Palmera Bay — press TAB for jobs');
    this.hud.showMessage('PALMERA BAY', 2.5);
  }

  respawn() {
    const fee = Math.min(this.save.cash, ECONOMY.hospitalFee);
    this.save.cash -= fee;
    writeSave(this.save);
    this.player.reset(630, 700);
    this.police.reset();
    this.cameraSnap(630, 700);
    this.state = 'playing';
    this.hud.toast(fee > 0 ? `Hospital bill -$${fee}` : 'Back on your feet');
  }

  tryEnterExitCar() {
    if (this.state !== 'playing' || this.enterCooldown > 0) return;
    const p = this.player;
    if (p.inCar) {
      const car = p.inCar;
      car.kind = 'parked';
      car.driver = 'none';
      car.speed = 0;
      p.inCar = null;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      p.angle = car.angle;
      this.audio.doorSlam();
      this.enterCooldown = 0.35;
      return;
    }
    const car = p.nearbyCar(this.cars.filter((c) => c.kind !== 'police' && !c.dead));
    if (car) {
      p.stealTarget = car;
      p.stealProgress = 0;
    }
  }

  // Holding E beside a car fills the steal bar; letting go resets it.
  updateSteal(dt) {
    const p = this.player;
    if (p.inCar) return;
    if (!this.input.keys.has('KeyE') || !p.stealTarget) {
      if (p.stealTarget) p.stealProgress = 0;
      p.stealTarget = null;
      return;
    }
    const car = p.stealTarget;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d > 90 || car.kind === 'police' || car.dead) {
      p.stealTarget = null;
      p.stealProgress = 0;
      return;
    }
    p.stealProgress += dt / CAR.stealTime;
    if (p.stealProgress >= 1) {
      car.kind = 'player';
      car.driver = 'player';
      car.stealable = false;
      p.inCar = car;
      p.x = car.x;
      p.y = car.y;
      p.stealTarget = null;
      p.stealProgress = 0;
      this.audio.doorSlam();
      this.enterCooldown = 0.35;
      if (car.owned) {
        this.hud.toast('Your Coral — let\u2019s roll', '#37e0d8');
      } else if (!car.isMissionCar) {
        this.police.crime(ECONOMY.carTheftStars, 'car-theft');
        this.save.carsStolen += 1;
        this.hud.toast('Stolen! The cops were called', '#ff8c42');
      }
    }
  }

  update(dt) {
    this.time += dt;
    this.effects.update(dt);
    this.hud.update(dt);
    this.enterCooldown = Math.max(0, this.enterCooldown - dt);
    if (this.state !== 'playing') {
      if (this.state === 'busted') this.bustedTimer += dt;
      if (this.state === 'wasted') this.wastedTimer += dt;
      return;
    }
    this.playSeconds += dt;
    this.save.playSeconds = Math.floor(this.playSeconds);
    if (this.playSeconds - (this._lastAutosave ?? 0) >= 20) {
      this._lastAutosave = this.playSeconds;
      writeSave(this.save);
    }

    // Mouse world position for aiming.
    const cam = this.camera;
    this.input.mouseWorldX = cam.x + (this.input.mouseX - this.viewW / 2) / cam.zoom;
    this.input.mouseWorldY = cam.y + (this.input.mouseY - this.viewH / 2) / cam.zoom;

    const p = this.player;
    p.update(dt, this.input, this.city, this.cars, this.effects);

    // Driving.
    if (p.inCar) {
      const car = p.inCar;
      const driveInput = {
        up: this.input.keys.has('KeyW') || this.input.keys.has('ArrowUp'),
        down: this.input.keys.has('KeyS') || this.input.keys.has('ArrowDown'),
        left: this.input.keys.has('KeyA') || this.input.keys.has('ArrowLeft'),
        right: this.input.keys.has('KeyD') || this.input.keys.has('ArrowRight'),
      };
      const { speedNorm, drifting } = car.drive(dt, driveInput, this.city);
      this.audio.setEngine(speedNorm, true);
      p.x = car.x;
      p.y = car.y;
      if (drifting && Math.abs(car.speed) > 200) {
        this.effects.skid(car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, car.angle, 26);
        if (Math.random() < dt * 8) this.effects.smoke(car.x, car.y + 10);
      }
      if (car.dead) {
        this.effects.explosion(car.x, car.y);
        this.audio.explosion();
        p.inCar = null;
        p.x = car.x + 40;
        p.y = car.y + 40;
        p.takeDamage(25);
      }
    } else {
      this.audio.setEngine(0, false);
    }
    this.updateSteal(dt);

    // Shooting.
    const shot = p.tryShoot(this.input);
    if (shot) {
      this.bullets.push({ ...shot, life: PLAYER.pistolRange / BULLET_SPEED, vx: Math.cos(shot.angle) * BULLET_SPEED, vy: Math.sin(shot.angle) * BULLET_SPEED });
      this.audio.shot();
      this.effects.muzzle(shot.x, shot.y, shot.angle);
      this.police.crime(ECONOMY.shootStars, 'gunfire');
    }
    if (p.tryPunch(this.input)) {
      this.audio.punch();
      this.punchHit();
    }

    // Bullets.
    this.updateBullets(dt);

    // Traffic.
    for (const car of this.cars) {
      if (car.driver === 'ai' && car.kind === 'traffic' && !car.dead) car.driveTraffic(dt, this.city, this.rng);
    }
    // Car-car separation.
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i];
        const b = this.cars[j];
        if (a.dead || b.dead) continue;
        if (separateCars(a, b)) {
          if (Math.abs(a.speed) > 200 || Math.abs(b.speed) > 200) {
            this.effects.sparks((a.x + b.x) / 2, (a.y + b.y) / 2);
            if (a === p.inCar || b === p.inCar) this.audio.crash();
          }
        }
      }
    }
    // Player car vs pedestrians.
    if (p.inCar) {
      for (const ped of this.peds) {
        if (ped.state === 'down') continue;
        const d = Math.hypot(ped.x - p.inCar.x, ped.y - p.inCar.y);
        if (d < 30 && Math.abs(p.inCar.speed) > 140) {
          ped.knockDown();
          this.effects.blood(ped.x, ped.y);
          this.police.crime(ECONOMY.pedHitStars, 'hit-pedestrian');
          this.hud.toast('You hit a pedestrian!', '#ff2d55');
          this.audio.crash();
          for (const other of this.peds) {
            if (Math.hypot(other.x - ped.x, other.y - ped.y) < 260) other.scare(ped.x, ped.y);
          }
        } else if (d < 90 && Math.abs(p.inCar.speed) > 60) {
          ped.scare(p.inCar.x, p.inCar.y);
        }
      }
    }
    // On-foot player vs pedestrians: gentle push, no crime.
    if (!p.inCar) {
      for (const ped of this.peds) {
        const d = Math.hypot(ped.x - p.x, ped.y - p.y);
        if (d < 20 && d > 0.01) {
          ped.x += ((ped.x - p.x) / d) * (20 - d);
          ped.y += ((ped.y - p.y) / d) * (20 - d);
        }
      }
    }

    // Pedestrians.
    for (const ped of this.peds) ped.update(dt, this.city);

    // Police.
    const policeState = this.police.update(dt, p, this.camera, this.effects, this.audio);
    if (policeState.stars > this.save.bestWanted) {
      this.save.bestWanted = policeState.stars;
    }
    if (this.police.bustCheck(p) === 'busted') {
      this.state = 'busted';
      this.bustedTimer = 0;
      this.audio.busted();
      this.police.reset();
      return;
    }
    // Foot cops shoot at close range.
    for (const u of this.police.units) {
      if (u.onFoot && !u.dead && u.shootCooldown <= 0) {
        const d = Math.hypot(u.x - p.x, u.y - p.y);
        if (d < 320 && !p.inCar) {
          u.shootCooldown = 1.6;
          p.takeDamage(9);
          this.effects.muzzle(u.x, u.y, Math.atan2(p.y - u.y, p.x - u.x));
          this.audio.shot();
        }
      }
    }
    if (p.dead) {
      this.state = 'wasted';
      this.wastedTimer = 0;
      this.audio.explosion();
      return;
    }

    // Missions.
    this.missions.update(dt, this.missionContext());
    for (const ev of this.missions.events.splice(0)) {
      if (ev.type === 'mission-done') {
        this.save.cash += ev.payout;
        this.save.totalEarned += ev.payout;
        missionCompleted(this.save, ev.mission.id);
        writeSave(this.save);
        this.hud.toast(`Job done: ${ev.mission.name} +$${ev.payout}`, '#5ec962');
        this.audio.cash();
        if (this.missions.allDone()) {
          this.state = 'complete';
          this.hud.toast('All missions complete!', '#ffd166');
        }
      } else if (ev.type === 'mission-start') {
        this.hud.showMessage(`NEW JOB: ${ev.mission.name}`, 3);
        this.hud.toast(`${ev.mission.giver}: ${ev.mission.brief}`);
      } else if (ev.type === 'mission-fail') {
        this.hud.toast(`Job failed — ${ev.reason}`, '#ff2d55');
        this.audio.missionFail();
      }
    }

    // Camera follows the player, zoomed out while driving.
    const targetZoom = p.inCar ? this.viewH / 1150 : this.viewH / 900;
    cam.zoom += (targetZoom - cam.zoom) * Math.min(1, dt * 3);
    const tx = p.inCar ? p.inCar.x : p.x;
    const ty = p.inCar ? p.inCar.y : p.y;
    cam.x += (tx - cam.x) * Math.min(1, dt * 5);
    cam.y += (ty - cam.y) * Math.min(1, dt * 5);
    cam.x = clamp(cam.x, this.viewW / 2 / cam.zoom, WORLD.width - this.viewW / 2 / cam.zoom);
    cam.y = clamp(cam.y, this.viewH / 2 / cam.zoom, WORLD.height - this.viewH / 2 / cam.zoom);
    cam.w = this.viewW / cam.zoom;
    cam.h = this.viewH / cam.zoom;
  }

  punchHit() {
    const p = this.player;
    const ax = p.x + Math.cos(p.aimAngle) * 26;
    const ay = p.y + Math.sin(p.aimAngle) * 26;
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - ax, ped.y - ay) < 30) {
        ped.knockDown();
        this.effects.blood(ped.x, ped.y);
        this.police.crime(ECONOMY.pedHitStars, 'assault');
        for (const other of this.peds) {
          if (Math.hypot(other.x - ped.x, other.y - ped.y) < 260) other.scare(ped.x, ped.y);
        }
        return;
      }
    }
    for (const u of this.police.units) {
      if (u.onFoot && !u.dead && Math.hypot(u.x - ax, u.y - ay) < 34) {
        u.health -= PLAYER.punchDamage;
        if (u.health <= 0) {
          u.dead = true;
          this.police.crime(ECONOMY.killCopStars, 'cop-down');
        }
        return;
      }
    }
  }

  updateBullets(dt) {
    const p = this.player;
    for (const b of this.bullets) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (this.city.buildingAt(b.x, b.y)) {
        b.life = 0;
        this.effects.sparks(b.x, b.y);
        continue;
      }
      for (const ped of this.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          ped.knockDown();
          this.effects.blood(ped.x, ped.y);
          this.police.crime(ECONOMY.pedHitStars, 'shooting');
          b.life = 0;
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const u of this.police.units) {
        if (u.dead) continue;
        const ux = u.car ? u.car.x : u.x;
        const uy = u.car ? u.car.y : u.y;
        const r = u.car ? 26 : 14;
        if (Math.hypot(ux - b.x, uy - b.y) < r) {
          if (u.car) {
            u.car.health -= PLAYER.pistolDamage;
            if (u.car.health <= 0) {
              u.car.dead = true;
              u.dead = true;
              this.effects.explosion(ux, uy);
              this.audio.explosion();
              this.police.crime(ECONOMY.killCopStars, 'cop-car-destroyed');
            }
          } else {
            u.health -= PLAYER.pistolDamage;
            if (u.health <= 0) {
              u.dead = true;
              this.effects.blood(ux, uy);
              this.police.crime(ECONOMY.killCopStars, 'cop-down');
            }
          }
          b.life = 0;
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const car of this.cars) {
        if (car === p.inCar || car.dead || car.kind === 'player') continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 26) {
          car.health -= PLAYER.pistolDamage;
          this.effects.sparks(b.x, b.y);
          if (car.health <= 0) {
            car.dead = true;
            this.effects.explosion(car.x, car.y);
            this.audio.explosion();
          }
          b.life = 0;
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  render() {
    const ctx = this.ctx;
    const { width, height } = ctx.canvas;
    const cam = this.camera;
    const shake = this.effects.shakeOffset();
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    // Sunset grade: warm wash over everything, stronger at the edges.
    ctx.translate(this.viewW / 2 + shake.x, this.viewH / 2 + shake.y);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    this.city.draw(ctx, cam);
    this.effects.drawUnder(ctx);
    for (const car of this.cars) if (!car.dead) car.draw(ctx);
    // Wrecked cars smoulder where they died.
    for (const car of this.cars) {
      if (!car.dead) continue;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#1c1c1c';
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.beginPath();
      ctx.roundRect(-23, -12, 46, 24, 7);
      ctx.fill();
      ctx.restore();
    }
    for (const ped of this.peds) ped.draw(ctx);
    this.police.draw(ctx);
    this.missions.drawMarker(ctx, this.time);
    this.missions.drawRobProgress(ctx);
    this.player.draw(ctx, this.time);
    // Bullets as tracers.
    ctx.save();
    ctx.strokeStyle = '#ffe9a0';
    ctx.lineWidth = 2;
    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
    this.effects.drawOver(ctx);
    // The sun over the sea, when the camera can see it.
    if (cam.y + cam.h / 2 > WORLD.seaY - 40) {
      const sx = 2100;
      const sy = WORLD.seaY + 90;
      const g = ctx.createRadialGradient(sx, sy, 10, sx, sy, 320);
      g.addColorStop(0, 'rgba(255, 209, 102, 0.95)');
      g.addColorStop(0.35, 'rgba(255, 123, 84, 0.55)');
      g.addColorStop(1, 'rgba(255, 123, 84, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 320, sy - 320, 640, 640);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(sx, sy, 52, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Warm sunset vignette over the whole screen.
    const vg = ctx.createRadialGradient(
      this.viewW / 2, this.viewH / 2, Math.min(this.viewW, this.viewH) * 0.42,
      this.viewW / 2, this.viewH / 2, Math.max(this.viewW, this.viewH) * 0.75,
    );
    vg.addColorStop(0, 'rgba(255, 140, 80, 0)');
    vg.addColorStop(1, 'rgba(120, 30, 90, 0.28)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    if (this.state === 'playing' || this.state === 'paused') {
      this.hud.draw(ctx, {
        save: this.save,
        player: this.player,
        wanted: this.police.wanted,
        missions: this.missions,
        city: this.city,
        police: this.police,
        cars: this.cars,
        peds: this.peds,
      }, this.time);
    }
    if (this.state === 'title') {
      this.hud.drawScreen(ctx, 'PALMERA BAY', 'SUNSET HEAT', [
        'An open-city crime story in the golden hour.',
        'Steal cars, outrun the Palmera Bay PD, run five jobs for Vera.',
        'WASD drive & walk · Mouse aim · Click shoot · E enter car',
        'Click START below — or press Enter.',
      ]);
    } else if (this.state === 'paused') {
      this.hud.drawScreen(ctx, 'PAUSED', 'Take a breath, Rico.', [
        'P resume · M mute · R restart after busted / wasted',
        `Cash $${this.save.cash.toLocaleString('en-US')} · Missions ${this.save.missionsDone}/5`,
      ]);
    } else if (this.state === 'busted') {
      this.hud.drawScreen(ctx, 'BUSTED', 'The Palmera Bay PD got you.', [
        'A night in the cells. The city waits.',
        'Press R to walk out and start again.',
      ]);
    } else if (this.state === 'wasted') {
      this.hud.drawScreen(ctx, 'WASTED', 'The sunset fades…', [
        'Rico is down. The bay keeps its secrets.',
        'Press R to get back on your feet.',
      ]);
    } else if (this.state === 'complete') {
      this.hud.drawScreen(ctx, 'PALMERA BAY IS YOURS', 'All five jobs done.', [
        `Total earned $${this.save.totalEarned.toLocaleString('en-US')} · Best wanted ${this.save.bestWanted}★`,
        'Free roam continues — press P to pause, keep driving.',
      ]);
      // Keep the world alive behind the banner: resume free roam.
      if (this.input.keys.has('KeyP') || this.input.mouseDown) {
        this.state = 'playing';
      }
    }
  }

  loop(ts) {
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000 || 0.016);
    this.lastTs = ts;
    if (this.state !== 'title') this.update(dt);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  boot() {
    // Enter on the title screen starts the game.
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' && this.state === 'title') this.start();
      if (e.code === 'Tab' && this.state === 'playing') {
        e.preventDefault();
        this.openJobBoard();
      }
    });
    document.getElementById('start-btn')?.addEventListener('click', () => this.start());
    document.getElementById('continue-btn')?.addEventListener('click', () => this.start());
    document.querySelectorAll('[data-mission]')?.forEach((btn) => {
      btn.addEventListener('click', () => {
        const def = this.missions.defs.find((d) => d.id === btn.dataset.mission);
        if (!def) return;
        if (this.state === 'title') this.start();
        if (this.missions.active) {
          this.hud.toast('Finish the current job first');
          return;
        }
        if (this.missions.completed.has(def.id)) {
          this.hud.toast('Job already done');
          return;
        }
        this.missions.start(def, this.missionContext());
      });
    });
    const shot = shotFromUrl();
    if (shot) {
      // Staged screenshots skip the menu entirely.
      this.audio.ensure();
      stageShot(this, shot);
      document.getElementById('menu')?.classList.add('hidden');
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  openJobBoard() {
    const next = this.missions.next();
    const menu = document.getElementById('menu');
    if (!menu) return;
    if (this.missions.active) {
      this.hud.toast(`Current job: ${this.missions.active.def.name}`);
      return;
    }
    if (!next) {
      this.hud.toast('No jobs left — Palmera Bay is yours');
      return;
    }
    this.state = 'paused';
    menu.classList.remove('hidden');
    document.getElementById('menu-title').textContent = 'JOB BOARD';
    document.getElementById('menu-sub').textContent = `${next.giver} — ${next.name} · $${next.payout}`;
  }
}

export function bootGame(canvas) {
  const game = new Game(canvas);
  game.boot();
  window.__palmeraGame = game;
  return game;
}
