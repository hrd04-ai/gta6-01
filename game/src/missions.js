// The story of Rico Vega: five missions that take him from a stolen sedan
// to the biggest score Palmera Bay has ever seen, plus fares for cash
// between jobs. Every mission is data: steps with a type, a target and
// the words Rico hears as he works.

import * as THREE from 'three';
import { CONFIG, PLACES } from './config.js';
import { createRng, pick, range, int, clamp } from './random.js';

export const MISSION_DEFS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    intro: [
      'MARA: Rico, you need wheels before you need a plan.',
      'MARA: Any car on the street. Take it. Drive it to the Marina.',
    ],
    reward: 300,
    steps: [
      { type: 'steal-car', text: 'Steal any car (press E near one)' },
      { type: 'goto', target: PLACES.marina, radius: 8, text: 'Drive to Sunset Marina' },
    ],
    complete: 'MARA: Clean. Here is your piece — do not wave it around.',
  },
  {
    id: 'the-pickup',
    title: 'The Pickup',
    intro: [
      'MARA: A package is waiting in the Canal Row alley.',
      'MARA: Walk in, grab it, and bring it to the Drop. No sirens.',
    ],
    reward: 600,
    steps: [
      { type: 'goto', target: PLACES.alley, radius: 5, text: 'Go to the Canal Row alley' },
      { type: 'collect', target: PLACES.alley, radius: 4, text: 'Collect the package' },
      { type: 'goto', target: PLACES.drop, radius: 8, text: 'Deliver the package to the Drop' },
    ],
    complete: 'MARA: Delivered. The crew is starting to notice you.',
  },
  {
    id: 'harbor-run',
    title: 'Harbor Run',
    intro: [
      'MARA: A container at Harbor East leaves in 75 seconds.',
      'MARA: Be in it. I mean: be there. Drive like the bay is on fire.',
    ],
    reward: 900,
    steps: [
      { type: 'timed-drive', target: PLACES.harbor, radius: 10, time: 75, text: 'Reach Harbor East before the ship leaves' },
    ],
    complete: 'MARA: Made it with seconds to spare. You drive like you mean it.',
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    intro: [
      'MARA: Somebody talked. The whole PBPD is looking for you.',
      'MARA: Survive a minute of this, then vanish to the Safehouse.',
    ],
    reward: 1200,
    steps: [
      { type: 'survive', time: 60, text: 'Survive the heat — 3 stars and counting' },
      { type: 'goto', target: PLACES.safehouse, radius: 8, text: 'Reach the Safehouse' },
    ],
    complete: 'MARA: They lost you. That is how you stay free in this city.',
  },
  {
    id: 'the-big-score',
    title: 'The Big Score',
    intro: [
      'MARA: Palmera Trust Bank. Three guards, one vault, one way out.',
      'MARA: Take the cash, lose the cops, meet me at the Safehouse.',
    ],
    reward: 5000,
    steps: [
      { type: 'goto', target: PLACES.bank, radius: 10, text: 'Reach Palmera Trust Bank' },
      { type: 'combat', target: PLACES.bank, radius: 16, count: 3, text: 'Deal with the bank guards (0/3)' },
      { type: 'collect', target: PLACES.bank, radius: 6, text: 'Grab the cash from the vault' },
      { type: 'goto', target: PLACES.safehouse, radius: 8, text: 'Escape to the Safehouse — lose the heat' },
    ],
    complete: 'MARA: Five thousand, clean. Palmera Bay is yours now, Rico.',
  },
];

function createGuardModel() {
  const group = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a06a, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.6, 4, 8), suit);
  torso.position.y = 1.18;
  torso.castShadow = true;
  group.add(torso);
  const vest = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.5, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.8 }),
  );
  vest.position.set(0, 1.25, 0.3);
  group.add(vest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), skin);
  head.position.y = 1.9;
  group.add(head);
  const shades = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.1, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 }),
  );
  shades.position.set(0, 1.93, 0.22);
  group.add(shades);
  const legGeo = new THREE.CapsuleGeometry(0.14, 0.55, 4, 6);
  const legL = new THREE.Mesh(legGeo, suit);
  legL.position.set(-0.17, 0.52, 0);
  const legR = new THREE.Mesh(legGeo, suit);
  legR.position.set(0.17, 0.52, 0);
  group.add(legL, legR);
  const armGeo = new THREE.CapsuleGeometry(0.1, 0.45, 4, 6);
  const armL = new THREE.Mesh(armGeo, suit);
  armL.position.set(-0.45, 1.28, 0);
  const armR = new THREE.Mesh(armGeo, suit);
  armR.position.set(0.45, 1.28, 0);
  group.add(armR);
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.12, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.4 }),
  );
  gun.position.set(0.45, 1.0, 0.3);
  group.add(gun);
  return { group, legL, legR, armL, armR };
}

export class MissionSystem {
  constructor(scene, seed = CONFIG.seed) {
    this.scene = scene;
    this.rng = createRng(seed + 707);
    this.index = 0;
    this.stepIndex = 0;
    this.active = false;
    this.storyDone = false;
    this.timer = 0;
    this.stepTimer = 0;
    this.guards = [];
    this.faresEnabled = false;
    this.fare = null; // {state:'pickup'|'drop', x, z, pay, timer}
    this.fareCooldown = 8;

    // The beacon: a shaft of gold light and a floating diamond that marks
    // the current objective from anywhere in the city.
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xffc23c, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true), beaconMat);
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshStandardMaterial({ color: 0xffc23c, emissive: 0xcc8800, emissiveIntensity: 1.4 }),
    );
    this.diamond.visible = false;
    scene.add(this.diamond);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(3.4, 4, 32),
      new THREE.MeshBasicMaterial({ color: 0xffc23c, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);
  }

  get def() {
    return MISSION_DEFS[this.index];
  }

  get step() {
    return this.def ? this.def.steps[this.stepIndex] : null;
  }

  get target() {
    const s = this.step;
    if (!s || !s.target) return null;
    return s.target;
  }

  startMission(index, ctx) {
    this.index = index;
    this.stepIndex = 0;
    this.active = true;
    this.timer = 0;
    this.stepTimer = 0;
    const def = this.def;
    for (const line of def.intro) ctx.onToast?.(line, 3.2);
    ctx.onObjective?.(def.title);
    if (def.id === 'heat-wave') ctx.police.addHeat(110);
    if (def.id === 'the-big-score') this.spawnGuards();
  }

  restartCurrent(ctx) {
    this.clearGuards();
    this.startMission(this.index, ctx);
  }

  spawnGuards() {
    this.clearGuards();
    const b = PLACES.bank;
    const spots = [
      { x: b.x - 8, z: b.z - 6 }, { x: b.x + 8, z: b.z - 4 }, { x: b.x, z: b.z + 8 },
    ];
    for (const s of spots) {
      const model = createGuardModel();
      model.group.position.set(s.x, 0, s.z);
      this.scene.add(model.group);
      this.guards.push({
        model, x: s.x, z: s.z, hp: 60, heading: 0,
        shootCooldown: range(this.rng, 0.8, 1.6),
        walkPhase: 0, home: s,
      });
    }
  }

  clearGuards() {
    for (const g of this.guards) this.scene.remove(g.model.group);
    this.guards = [];
  }

  damageGuard(guard, dmg, ctx) {
    guard.hp -= dmg;
    if (guard.hp <= 0) {
      this.scene.remove(guard.model.group);
      this.guards = this.guards.filter((g) => g !== guard);
      ctx.police.addHeat(30);
      ctx.onToast?.('Guard down.', 1.6);
      return true;
    }
    return false;
  }

  // Nearest guard inside a cone from (ox, oz) along (dx, dz), or null.
  shootRay(ox, oz, dx, dz, rangeMax) {
    let best = null, bestD = rangeMax;
    for (const g of this.guards) {
      const vx = g.x - ox, vz = g.z - oz;
      const d = Math.hypot(vx, vz);
      if (d > bestD || d < 0.5) continue;
      const dot = (vx * dx + vz * dz) / d;
      if (dot > 0.985) { best = g; bestD = d; }
    }
    return best ? { guard: best, dist: bestD } : null;
  }

  punchArc(ox, oz, heading, rangeMax) {
    let best = null, bestD = rangeMax;
    for (const g of this.guards) {
      const vx = g.x - ox, vz = g.z - oz;
      const d = Math.hypot(vx, vz);
      if (d > bestD || d < 0.4) continue;
      const dot = (vx * Math.sin(heading) + vz * Math.cos(heading)) / d;
      if (dot > 0.5) { best = g; bestD = d; }
    }
    return best;
  }

  completeStep(ctx) {
    const done = this.step; // the step just finished, before we advance
    this.stepIndex++;
    this.stepTimer = 0;
    if (this.stepIndex >= this.def.steps.length) {
      this.completeMission(ctx);
      return;
    }
    if (done.type === 'collect' && this.def.id === 'the-pickup') {
      ctx.police.addHeat(25);
      ctx.onToast?.('The package is hot — PBPD is onto you!', 3);
    }
    if (done.type === 'collect' && this.def.id === 'the-big-score') {
      ctx.police.addHeat(120);
      ctx.onToast?.('Four stars! Lose them and reach the Safehouse.', 3.5);
    }
  }

  completeMission(ctx) {
    const def = this.def;
    ctx.onCash?.(def.reward);
    ctx.onToast?.(`${def.complete} (+$${def.reward})`, 4);
    ctx.onMissionComplete?.(def);
    this.active = false;
    this.hideBeacon();
    if (this.index === 0) ctx.onUnlockPistol?.();
    if (this.index === 1) this.faresEnabled = true;
    if (this.index >= MISSION_DEFS.length - 1) {
      this.storyDone = true;
      ctx.onStoryComplete?.();
      return;
    }
    this.index++;
    this.startMission(this.index, ctx);
  }

  failMission(ctx, reason) {
    ctx.onToast?.(`${reason} — try again.`, 3.5);
    ctx.onMissionFailed?.(this.def);
    this.restartCurrent(ctx);
  }

  hideBeacon() {
    this.beacon.visible = false;
    this.diamond.visible = false;
    this.ring.visible = false;
  }

  objectiveText() {
    if (!this.active) {
      if (this.storyDone) return { title: 'Free Roam', text: 'Palmera Bay is yours. Fares pay cash — look for the gold markers.' };
      return { title: 'Palmera Bay', text: 'Press Enter to start the story.' };
    }
    const s = this.step;
    let text = s.text;
    if (s.type === 'combat') {
      text = `Deal with the bank guards (${s.count - this.guards.length}/${s.count})`;
    }
    return { title: this.def.title, text, timer: s.time ? Math.max(0, s.time - this.stepTimer) : null };
  }

  playerPos(ctx) {
    const p = ctx.player;
    return p.inCar ? { x: p.inCar.x, z: p.inCar.z } : { x: p.x, z: p.z };
  }

  update(dt, ctx) {
    // Beacon animation and placement.
    const t = this.target;
    if (this.active && t) {
      this.beacon.visible = true;
      this.diamond.visible = true;
      this.ring.visible = true;
      this.beacon.position.set(t.x, 30, t.z);
      this.diamond.position.set(t.x, 8 + Math.sin(ctx.time * 2) * 0.8, t.z);
      this.diamond.rotation.y += dt * 1.5;
      this.ring.position.set(t.x, 0.15, t.z);
      const pulse = 0.55 + Math.sin(ctx.time * 3) * 0.2;
      this.ring.material.opacity = pulse;
    } else if (!this.fare) {
      this.hideBeacon();
    }

    // Fares: a gold marker appears, a passenger rides, cash lands.
    if (this.faresEnabled && this.active === false) {
      this.updateFare(dt, ctx);
    }

    if (!this.active) return;
    const s = this.step;
    if (!s) return;
    const pos = this.playerPos(ctx);
    const player = ctx.player;

    if (s.type === 'steal-car') {
      if (player.inCar) this.completeStep(ctx);
      return;
    }
    if (s.type === 'timed-drive' || s.type === 'survive') {
      this.stepTimer += dt;
      if (s.type === 'timed-drive') {
        const d = Math.hypot(pos.x - s.target.x, pos.z - s.target.z);
        if (d < s.radius) { this.completeStep(ctx); return; }
        if (this.stepTimer > s.time) { this.failMission(ctx, 'Too slow — the ship left'); return; }
      }
      if (s.type === 'survive' && this.stepTimer > s.time) {
        this.completeStep(ctx);
        return;
      }
      return;
    }
    if (s.type === 'combat') {
      // Guards hold their ground and shoot at Rico.
      for (const g of this.guards) {
        const d = Math.hypot(player.x - g.x, player.z - g.z);
        const want = Math.atan2(player.x - g.x, player.z - g.z);
        g.heading += clamp(want - g.heading, -3 * dt, 3 * dt);
        g.model.group.rotation.y = g.heading;
        g.shootCooldown -= dt;
        if (d < 30 && g.shootCooldown <= 0 && player.onFoot && !player.dead) {
          g.shootCooldown = range(this.rng, 1.1, 1.8);
          ctx.onGuardShoot?.(g);
          if (this.rng() < 0.32) player.hurt(8, ctx);
        }
      }
      if (this.guards.length === 0) this.completeStep(ctx);
      return;
    }
    // goto / collect: stand in the radius.
    const d = Math.hypot(pos.x - s.target.x, pos.z - s.target.z);
    if (d < s.radius) {
      if (s.type === 'collect') {
        ctx.onPickup?.();
      }
      this.completeStep(ctx);
    }
  }

  updateFare(dt, ctx) {
    this.fareCooldown -= dt;
    if (!this.fare && this.fareCooldown <= 0) {
      const p = this.randomFarePoint();
      this.fare = { state: 'pickup', x: p.x, z: p.z, pay: int(this.rng, CONFIG.money.fareMin, CONFIG.money.fareMax) };
      ctx.onToast?.(`Fare nearby — pick up the passenger ($${this.fare.pay}).`, 3);
    }
    if (this.fare) {
      const pos = this.playerPos(ctx);
      const d = Math.hypot(pos.x - this.fare.x, pos.z - this.fare.z);
      this.beacon.visible = true;
      this.diamond.visible = true;
      this.ring.visible = true;
      this.beacon.position.set(this.fare.x, 30, this.fare.z);
      this.diamond.position.set(this.fare.x, 8 + Math.sin(ctx.time * 2) * 0.8, this.fare.z);
      this.diamond.rotation.y += dt * 1.5;
      this.ring.position.set(this.fare.x, 0.15, this.fare.z);
      if (d < 6) {
        if (this.fare.state === 'pickup') {
          const drop = this.randomFarePoint();
          this.fare = { state: 'drop', x: drop.x, z: drop.z, pay: this.fare.pay };
          ctx.onToast?.('Passenger aboard — take them to the gold marker.', 3);
        } else {
          ctx.onCash?.(this.fare.pay);
          ctx.onToast?.(`Fare complete (+$${this.fare.pay}).`, 2.5);
          this.fare = null;
          this.fareCooldown = 15;
          this.hideBeacon();
        }
      }
    }
  }

  randomFarePoint() {
    const lines = CONFIG.world.lines;
    const line = pick(this.rng, lines);
    const along = range(this.rng, -140, 140);
    if (this.rng() < 0.5) return { x: line + 8, z: along };
    return { x: along, z: line + 8 };
  }
}
