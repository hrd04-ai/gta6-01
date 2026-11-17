// The PBPD: a wanted system that turns crimes into stars, and stars into
// flashing lightbars, pursuit cars that ram, and foot cops who drag Rico
// back to the station. Lose them by distance and time; pay for it if they
// catch you.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRng, pick, range, int, clamp, angleDiff } from './random.js';
import { createCarModel } from './vehicles.js';
import { resolveCircleVsBuildings } from './city.js';

function createCopModel() {
  const group = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x1d3a5f, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5a, roughness: 0.8 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.6, 4, 8), navy);
  torso.position.y = 1.18;
  torso.castShadow = true;
  group.add(torso);

  const badge = new THREE.Mesh(
    new THREE.CircleGeometry(0.08, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xaa8800, emissiveIntensity: 0.5 }),
  );
  badge.position.set(0.14, 1.35, 0.33);
  group.add(badge);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), skin);
  head.position.y = 1.9;
  group.add(head);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.28, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: 0x14273d, roughness: 0.7 }),
  );
  cap.position.y = 2.08;
  group.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.2), cap.material);
  brim.position.set(0, 2.03, 0.26);
  group.add(brim);

  const legGeo = new THREE.CapsuleGeometry(0.14, 0.55, 4, 6);
  const legL = new THREE.Mesh(legGeo, navy);
  legL.position.set(-0.17, 0.52, 0);
  const legR = new THREE.Mesh(legGeo, navy);
  legR.position.set(0.17, 0.52, 0);
  group.add(legL, legR);

  const armGeo = new THREE.CapsuleGeometry(0.1, 0.45, 4, 6);
  const armL = new THREE.Mesh(armGeo, navy);
  armL.position.set(-0.45, 1.28, 0);
  const armR = new THREE.Mesh(armGeo, navy);
  armR.position.set(0.45, 1.28, 0);
  group.add(armL, armR);

  return { group, legL, legR, armL, armR };
}

export class PoliceSystem {
  constructor(scene, city, seed = CONFIG.seed) {
    this.scene = scene;
    this.city = city;
    this.rng = createRng(seed + 505);
    this.heat = 0;
    this.cars = [];
    this.cops = [];
    this.spawnTimer = 0;
    this.copSpawnTimer = 0;
    this.loseTimer = 0;
    this.flashTimer = 0;
    this.time = 0;
  }

  get stars() {
    const t = CONFIG.wanted.starThresholds;
    let s = 0;
    for (let i = 1; i < t.length; i++) if (this.heat >= t[i]) s = i;
    return Math.min(5, s);
  }

  addHeat(n) {
    this.heat = Math.min(300, this.heat + n);
  }

  clearWanted() {
    this.heat = 0;
    this.loseTimer = 0;
    for (const c of this.cars) this.scene.remove(c.model.group);
    for (const c of this.cops) this.scene.remove(c.model.group);
    this.cars = [];
    this.cops = [];
  }

  nearestDistance(x, z) {
    let best = Infinity;
    for (const c of this.cars) best = Math.min(best, Math.hypot(c.x - x, c.z - z));
    for (const c of this.cops) best = Math.min(best, Math.hypot(c.x - x, c.z - z));
    return best;
  }

  // A road point roughly `dist` metres from the player, for spawning units.
  spawnPointNear(px, pz, dist) {
    const lines = CONFIG.world.lines;
    for (let tries = 0; tries < 12; tries++) {
      const a = range(this.rng, 0, Math.PI * 2);
      const x = px + Math.cos(a) * dist;
      const z = pz + Math.sin(a) * dist;
      // Snap to the nearest road line.
      let best = null, bestD = Infinity;
      for (const line of lines) {
        const d = Math.min(Math.abs(x - line), Math.abs(z - line));
        if (d < bestD) { bestD = d; best = line; }
      }
      if (bestD > 8) continue;
      const onX = Math.abs(x - best) < Math.abs(z - best);
      const sx = onX ? best : x;
      const sz = onX ? z : best;
      if (Math.abs(sx) > 165 || Math.abs(sz) > 165) continue;
      return { x: clamp(sx, -165, 155), z: clamp(sz, -165, 155) };
    }
    return { x: clamp(px + dist, -165, 155), z: pz };
  }

  spawnPoliceCar(px, pz) {
    const p = this.spawnPointNear(px, pz, CONFIG.police.spawnDistance);
    const model = createCarModel('police', 0x1a2a3a);
    model.group.position.set(p.x, 0, p.z);
    this.scene.add(model.group);
    this.cars.push({
      model, x: p.x, z: p.z,
      heading: Math.atan2(px - p.x, pz - p.z),
      speed: 12, stuckTimer: 0, ramCooldown: 0,
    });
  }

  spawnCop(px, pz) {
    const p = this.spawnPointNear(px, pz, 26);
    const model = createCopModel();
    model.group.position.set(p.x, 0, p.z);
    this.scene.add(model.group);
    this.cops.push({
      model, x: p.x, z: p.z,
      heading: Math.atan2(px - p.x, pz - p.z),
      speed: range(this.rng, 5.4, 6.4),
      hp: 50,
      bustTimer: 0, walkPhase: range(this.rng, 0, 6),
      punchCooldown: 0,
    });
  }

  // Nearest cop inside a shooting cone from (ox, oz) along (dx, dz).
  shootRay(ox, oz, dx, dz, rangeMax) {
    let best = null, bestD = rangeMax;
    for (const c of this.cops) {
      const vx = c.x - ox, vz = c.z - oz;
      const d = Math.hypot(vx, vz);
      if (d > bestD || d < 0.5) continue;
      const dot = (vx * dx + vz * dz) / d;
      if (dot > 0.985) { best = c; bestD = d; }
    }
    return best ? { cop: best, dist: bestD } : null;
  }

  // Nearest cop inside a punch arc in front of the given heading.
  punchArc(ox, oz, heading, rangeMax) {
    let best = null, bestD = rangeMax;
    for (const c of this.cops) {
      const vx = c.x - ox, vz = c.z - oz;
      const d = Math.hypot(vx, vz);
      if (d > bestD || d < 0.4) continue;
      const dot = (vx * Math.sin(heading) + vz * Math.cos(heading)) / d;
      if (dot > 0.5) { best = c; bestD = d; }
    }
    return best;
  }

  // Damage a cop; a dead cop is removed and the heat jumps.
  damageCop(cop, dmg, ctx) {
    cop.hp -= dmg;
    if (cop.hp <= 0) {
      this.scene.remove(cop.model.group);
      this.cops = this.cops.filter((c) => c !== cop);
      this.addHeat(40);
      ctx.onToast?.('You dropped a cop. The whole city will hear about that.', 2.5);
      return true;
    }
    return false;
  }

  update(dt, ctx) {
    this.time += dt;
    const player = ctx.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const pz = player.inCar ? player.inCar.z : player.z;
    const stars = this.stars;

    // Wanted decay: out of sight long enough and the heat bleeds off.
    if (stars > 0) {
      const near = this.nearestDistance(px, pz);
      if (near > CONFIG.police.loseDistance) {
        this.loseTimer += dt;
        if (this.loseTimer > CONFIG.police.decaySeconds) {
          this.heat = Math.max(0, this.heat - 45);
          this.loseTimer = 0;
        }
      } else {
        this.loseTimer = 0;
      }
    }

    // Spawning keeps pressure proportional to the stars.
    this.spawnTimer -= dt;
    if (stars > 0 && this.cars.length < Math.min(stars, CONFIG.police.maxCars) && this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      this.spawnPoliceCar(px, pz);
    }
    this.copSpawnTimer -= dt;
    if (stars > 0 && player.onFoot && this.cops.length < Math.min(stars + 1, CONFIG.police.maxCops) && this.copSpawnTimer <= 0) {
      this.copSpawnTimer = 3;
      this.spawnCop(px, pz);
    }
    if (stars === 0) {
      // No heat: units give up and drive off.
      for (const c of this.cars) {
        c.speed = 14;
        c.heading += 0.4 * dt;
      }
      if (this.cars.length && this.nearestDistance(px, pz) > 150) {
        const c = this.cars.shift();
        this.scene.remove(c.model.group);
      }
      if (this.cops.length && this.nearestDistance(px, pz) > 120) {
        const c = this.cops.shift();
        this.scene.remove(c.model.group);
      }
    }

    // Lightbar flash: red and blue alternate twice a second.
    this.flashTimer += dt;
    const flashOn = Math.floor(this.flashTimer * 4) % 2 === 0;
    for (const c of this.cars) {
      if (!c.model.lightbar) continue;
      c.model.lightbar.red.emissiveIntensity = flashOn ? 3 : 0.2;
      c.model.lightbar.blue.emissiveIntensity = flashOn ? 0.2 : 3;
    }

    // Police cars: pursuit steering, building collisions, ramming.
    for (const c of this.cars) {
      c.ramCooldown = Math.max(0, c.ramCooldown - dt);
      const want = Math.atan2(px - c.x, pz - c.z);
      const targetSpeed = stars > 0 ? CONFIG.police.chaseSpeed : 14;
      c.heading += clamp(angleDiff(c.heading, want), -2.4 * dt, 2.4 * dt);
      c.speed += clamp(targetSpeed - c.speed, -18 * dt, 10 * dt);
      let nx = c.x + Math.sin(c.heading) * c.speed * dt;
      let nz = c.z + Math.cos(c.heading) * c.speed * dt;
      const before = { x: nx, z: nz };
      const r = resolveCircleVsBuildings(nx, nz, 2.2, ctx.colliders);
      nx = r.x; nz = r.z;
      if (Math.abs(before.x - nx) > 0.05 || Math.abs(before.z - nz) > 0.05) {
        c.stuckTimer += dt;
        c.speed *= 0.5;
        if (c.stuckTimer > 2.5) {
          // Back out and try another angle.
          c.heading += Math.PI * 0.8;
          c.stuckTimer = 0;
        }
      } else {
        c.stuckTimer = Math.max(0, c.stuckTimer - dt);
      }
      c.x = nx; c.z = nz;
      c.model.group.position.set(c.x, 0, c.z);
      c.model.group.rotation.y = c.heading;
      for (const w of c.model.wheels) w.rotation.x += c.speed * dt * 2.6;

      // Ramming the player's car, or running down Rico on foot.
      const d = Math.hypot(px - c.x, pz - c.z);
      if (stars > 0 && d < 4.6 && c.ramCooldown <= 0) {
        c.ramCooldown = 1.2;
        if (player.inCar) {
          player.inCar.hp -= CONFIG.police.ramDamage;
          player.inCar.speed *= 0.6;
          ctx.onRam?.(c);
        } else {
          player.hurt(12, ctx);
          player.vx += (player.x - c.x) / (d || 1) * 9;
          player.vz += (player.z - c.z) / (d || 1) * 9;
          ctx.onRam?.(c);
        }
      }
    }

    // Foot cops: run Rico down, then hold him for the bust.
    for (const c of this.cops) {
      c.punchCooldown = Math.max(0, c.punchCooldown - dt);
      const d = Math.hypot(px - c.x, pz - c.z);
      if (player.onFoot && !player.dead) {
        const want = Math.atan2(px - c.x, pz - c.z);
        c.heading += clamp(angleDiff(c.heading, want), -4 * dt, 4 * dt);
        c.speed = d < 2.2 ? 0 : range(this.rng, 5.4, 6.4);
        const nx = c.x + Math.sin(c.heading) * c.speed * dt;
        const nz = c.z + Math.cos(c.heading) * c.speed * dt;
        const r = resolveCircleVsBuildings(nx, nz, 0.6, ctx.colliders);
        c.x = r.x; c.z = r.z;
        c.walkPhase += dt * c.speed * 3;
        const swing = Math.sin(c.walkPhase) * 0.5;
        c.model.legL.rotation.x = swing;
        c.model.legR.rotation.x = -swing;
        if (d < 1.7 && stars > 0) {
          c.bustTimer += dt;
          if (c.punchCooldown <= 0) {
            c.punchCooldown = 0.9;
            player.hurt(6, ctx);
          }
          if (c.bustTimer > CONFIG.police.bustSeconds) {
            ctx.onBusted?.();
            return;
          }
        } else {
          c.bustTimer = Math.max(0, c.bustTimer - dt * 2);
        }
      } else {
        // Player is driving: cops stand down and jog to the nearest road.
        c.bustTimer = 0;
      }
      c.model.group.position.set(c.x, 0, c.z);
      c.model.group.rotation.y = c.heading;
    }
  }
}
