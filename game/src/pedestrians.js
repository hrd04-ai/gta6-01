// The crowds of Palmera Bay: low-poly walkers who stroll the sidewalks,
// cross at the corners, and scatter when a gun goes off or a car mounts
// the kerb. They are what makes the city feel alive between the missions.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRng, pick, range, int, clamp } from './random.js';

function createPedModel(rng) {
  const group = new THREE.Group();
  const shirt = pick(rng, CONFIG.palette.pedShirt);
  const skin = pick(rng, [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0]);
  const pants = pick(rng, [0x2c3e50, 0x34495e, 0x7f8c8d, 0x5d4037, 0x1a1a2e]);

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.55, 4, 8),
    new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 }),
  );
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 }),
  );
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: pick(rng, [0x1a1a1a, 0x4a3220, 0x8a8a8a, 0xd9a441]), roughness: 1 }),
  );
  hair.position.y = 1.9;
  group.add(hair);

  const legGeo = new THREE.CapsuleGeometry(0.13, 0.5, 4, 6);
  const legMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.95 });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.16, 0.5, 0);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.16, 0.5, 0);
  group.add(legL, legR);

  const armGeo = new THREE.CapsuleGeometry(0.09, 0.42, 4, 6);
  const armMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 });
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-0.42, 1.25, 0);
  const armR = new THREE.Mesh(armGeo, armMat);
  armR.position.set(0.42, 1.25, 0);
  group.add(armL, armR);

  return { group, legL, legR, armL, armR };
}

export class PedestrianSystem {
  constructor(scene, city, seed = CONFIG.seed) {
    this.scene = scene;
    this.city = city;
    this.rng = createRng(seed + 303);
    this.list = [];
    this.spawnAll();
  }

  randomSidewalkPoint() {
    // Sidewalk spots run just off the road lines, clear of intersections.
    const lines = CONFIG.world.lines;
    const line = pick(this.rng, lines);
    const along = range(this.rng, -150, 150);
    if (Math.abs(along % CONFIG.world.blockPitch) < 9) return this.randomSidewalkPoint();
    if (this.rng() < 0.5) return { x: line + 8.4, z: along };
    return { x: along, z: line + 8.4 };
  }

  spawnAll() {
    for (let i = 0; i < CONFIG.pedestrians.count; i++) {
      const model = createPedModel(this.rng);
      const p = this.randomSidewalkPoint();
      const ped = {
        model,
        x: p.x, z: p.z,
        heading: range(this.rng, 0, Math.PI * 2),
        speed: range(this.rng, CONFIG.pedestrians.walkSpeedMin, CONFIG.pedestrians.walkSpeedMax),
        walkPhase: range(this.rng, 0, Math.PI * 2),
        target: this.randomSidewalkPoint(),
        fleeing: false,
        fleeTimer: 0,
        fallen: false,
        fallTimer: 0,
        fallVX: 0, fallVZ: 0,
      };
      model.group.position.set(ped.x, 0, ped.z);
      model.group.rotation.y = ped.heading;
      this.scene.add(model.group);
      this.list.push(ped);
    }
  }

  // A gunshot or a speeding car nearby makes everyone in the area run.
  scare(x, z, radius) {
    for (const ped of this.list) {
      if (ped.fallen) continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < radius) {
        ped.fleeing = true;
        ped.fleeTimer = range(this.rng, 2.5, 4.5);
        ped.heading = Math.atan2(ped.x - x, ped.z - z);
      }
    }
  }

  fall(ped, vx, vz, speed) {
    ped.fallen = true;
    ped.fallTimer = 4;
    ped.fallVX = vx * speed * 0.4;
    ped.fallVZ = vz * speed * 0.4;
  }

  update(dt) {
    for (const ped of this.list) {
      if (ped.fallen) {
        ped.fallTimer -= dt;
        ped.x += ped.fallVX * dt;
        ped.z += ped.fallVZ * dt;
        ped.fallVX *= 0.9;
        ped.fallVZ *= 0.9;
        // Sprawled on the ground, then gets up and walks off.
        ped.model.group.rotation.x = -Math.PI / 2 * clamp(1 - ped.fallTimer / 4, 0, 1) * 0.9;
        if (ped.fallTimer <= 0) {
          ped.fallen = false;
          ped.model.group.rotation.x = 0;
          const p = this.randomSidewalkPoint();
          ped.x = p.x; ped.z = p.z;
          ped.target = this.randomSidewalkPoint();
        }
        continue;
      }
      if (ped.fleeing) {
        ped.fleeTimer -= dt;
        if (ped.fleeTimer <= 0) ped.fleeing = false;
      }
      const speed = ped.fleeing ? CONFIG.pedestrians.fleeSpeed : ped.speed;
      const dx = ped.target.x - ped.x, dz = ped.target.z - ped.z;
      const d = Math.hypot(dx, dz);
      if (d < 2) {
        ped.target = this.randomSidewalkPoint();
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - ped.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      ped.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
      ped.x += Math.sin(ped.heading) * speed * dt;
      ped.z += Math.cos(ped.heading) * speed * dt;
      ped.x = clamp(ped.x, -168, 156);
      ped.z = clamp(ped.z, -168, 156);
      ped.walkPhase += dt * speed * 3.2;
      const swing = Math.sin(ped.walkPhase) * 0.55;
      ped.model.legL.rotation.x = swing;
      ped.model.legR.rotation.x = -swing;
      ped.model.armL.rotation.x = -swing * 0.7;
      ped.model.armR.rotation.x = swing * 0.7;
      ped.model.group.position.set(ped.x, 0, ped.z);
      ped.model.group.rotation.y = ped.heading;
    }
  }
}

// The player character, Rico Vega: a distinct figure in a sunset-orange
// jacket, so the eye finds him instantly in a crowd or a chase.
export function createPlayerModel() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0xe8632c, roughness: 0.85 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.95 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.8 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.6, 4, 8), jacket);
  torso.position.y = 1.18;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), skin);
  head.position.y = 1.9;
  head.castShadow = true;
  group.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 }),
  );
  hair.position.y = 1.95;
  group.add(hair);

  const legGeo = new THREE.CapsuleGeometry(0.14, 0.55, 4, 6);
  const legL = new THREE.Mesh(legGeo, jeans);
  legL.position.set(-0.17, 0.52, 0);
  const legR = new THREE.Mesh(legGeo, jeans);
  legR.position.set(0.17, 0.52, 0);
  group.add(legL, legR);

  const armGeo = new THREE.CapsuleGeometry(0.1, 0.45, 4, 6);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(-0.45, 1.28, 0);
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(0.45, 1.28, 0);
  group.add(armL, armR);

  // A pistol in the right hand when armed.
  const gun = new THREE.Group();
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.34), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.7 }));
  gun.add(gunBody);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.09), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  grip.position.set(0, -0.1, -0.1);
  gun.add(grip);
  gun.position.set(0.45, 0.95, 0.25);
  gun.visible = false;
  group.add(gun);

  return { group, legL, legR, armL, armR, gun };
}
