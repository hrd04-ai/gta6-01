// Pedestrians: sidewalk walkers who stroll, wait at curbs and flee from
// gunfire, sirens and speeding cars. Cheap capsule figures, one shared system.
import * as THREE from 'three';
import { CFG, PED_SHIRTS } from './config.js';
import { makeRng } from './random.js';

function makePedMesh(shirtColor, rng) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: [0xe8b88a, 0xc98d5f, 0x8a5a38][Math.floor(rng.next() * 3)], roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.9 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), skin);
  head.position.y = 1.62;
  group.add(head);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.36), shirt);
  torso.position.y = 1.05;
  group.add(torso);
  const legGeo = new THREE.BoxGeometry(0.24, 0.7, 0.26);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(0.16, 0.35, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(-0.16, 0.35, 0);
  group.add(legR);
  const armGeo = new THREE.BoxGeometry(0.18, 0.65, 0.2);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(0.42, 1.05, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(-0.42, 1.05, 0);
  group.add(armR);
  group.userData = { legL, legR, armL, armR };
  return group;
}

export class PedSystem {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.peds = [];
    for (let i = 0; i < CFG.pedCount; i++) {
      const shirt = PED_SHIRTS[Math.floor(rng.next() * PED_SHIRTS.length)];
      const mesh = makePedMesh(shirt, rng);
      scene.add(mesh);
      const road = (Math.floor(rng.next() * 7) - 3) * CFG.roadSpacing;
      const along = rng.range(-145, 145);
      const onX = rng.chance(0.5);
      const ped = {
        mesh,
        pos: new THREE.Vector3(onX ? road + 10.5 : along, 0, onX ? along : road + 10.5),
        heading: rng.next() * Math.PI * 2,
        speed: rng.range(1.2, 2.2),
        walkPhase: rng.next() * Math.PI * 2,
        state: 'walk',
        flee: 0,
        down: false,
      };
      this.peds.push(ped);
      this.place(ped);
    }
  }

  place(ped) {
    ped.mesh.position.copy(ped.pos);
    ped.mesh.rotation.y = -ped.heading + Math.PI / 2;
    const swing = Math.sin(ped.walkPhase) * 0.5;
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
    ped.mesh.userData.armL.rotation.x = -swing * 0.7;
    ped.mesh.userData.armR.rotation.x = swing * 0.7;
  }

  scare(x, z, radius) {
    for (const ped of this.peds) {
      if (ped.down) continue;
      const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
      if (d < radius) {
        ped.state = 'flee';
        ped.flee = 2.5 + Math.random() * 2;
        ped.heading = Math.atan2(-(ped.pos.z - z), ped.pos.x - x);
      }
    }
  }

  knockDown(pos, radius) {
    let hit = 0;
    for (const ped of this.peds) {
      if (ped.down) continue;
      if (Math.hypot(ped.pos.x - pos.x, ped.pos.z - pos.z) < radius) {
        ped.down = true;
        ped.mesh.rotation.z = Math.PI / 2;
        ped.mesh.position.y = 0.35;
        hit++;
      }
    }
    return hit;
  }

  update(dt, playerPos, playerSpeed) {
    for (const ped of this.peds) {
      if (ped.down) continue;
      if (ped.state === 'flee') {
        ped.flee -= dt;
        ped.speed = 5.2;
        if (ped.flee <= 0) { ped.state = 'walk'; ped.speed = 1.6; }
      } else {
        ped.speed = 1.6;
        // A speeding car nearby makes peds step away.
        if (playerSpeed > 14) {
          const d = Math.hypot(ped.pos.x - playerPos.x, ped.pos.z - playerPos.z);
          if (d < 7) { ped.state = 'flee'; ped.flee = 1.6; }
        }
      }
      ped.pos.x += Math.cos(ped.heading) * ped.speed * dt;
      ped.pos.z += -Math.sin(ped.heading) * ped.speed * dt;
      ped.walkPhase += dt * ped.speed * 3.2;
      // Stay on the sidewalks: turn around at the city edge or mid-block.
      if (Math.abs(ped.pos.x) > 152 || Math.abs(ped.pos.z) > 148) {
        ped.heading += Math.PI + (Math.random() - 0.5);
        ped.pos.x = THREE.MathUtils.clamp(ped.pos.x, -150, 150);
        ped.pos.z = THREE.MathUtils.clamp(ped.pos.z, -146, 146);
      }
      if (Math.random() < dt * 0.06) ped.heading += (Math.random() - 0.5) * 1.2;
      this.place(ped);
    }
  }

  countStanding() {
    return this.peds.filter((p) => !p.down).length;
  }
}
