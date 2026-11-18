// Wanted level and the Palmera Bay PD: pursuit cars that ram, foot cops
// that chase and bust, sirens, and heat that cools off when Rico behaves.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCarMesh, collideWorld } from './vehicles.js';

function makeCopMesh() {
  const group = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x1e2a4a, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d5f, roughness: 0.8 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), skin);
  head.position.y = 1.62;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.14, 10), navy);
  cap.position.y = 1.86;
  group.add(cap);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.78, 0.38), navy);
  torso.position.y = 1.05;
  group.add(torso);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.05), new THREE.MeshStandardMaterial({ color: 0xd8b13a, metalness: 0.7, roughness: 0.3 }));
  badge.position.set(0.16, 1.25, 0.2);
  group.add(badge);
  const legGeo = new THREE.BoxGeometry(0.25, 0.72, 0.27);
  const legL = new THREE.Mesh(legGeo, navy);
  legL.position.set(0.16, 0.36, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, navy);
  legR.position.set(-0.16, 0.36, 0);
  group.add(legR);
  group.userData = { legL, legR };
  return group;
}

export class PoliceSystem {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.heat = 0;
    this.wanted = 0;
    this.pursuit = [];
    this.cops = [];
    this.time = 0;
  }

  get stars() { return this.wanted; }

  addHeat(amount) {
    this.heat = Math.min(100, this.heat + amount);
    const w = this.heat <= 0 ? 0 : Math.min(CFG.maxWanted, 1 + Math.floor(this.heat / 20));
    if (w > this.wanted) this.wanted = w;
  }

  clearWanted() {
    this.heat = 0;
    this.wanted = 0;
    this.despawnAll();
  }

  despawnAll() {
    for (const c of this.pursuit) this.scene.remove(c.mesh);
    for (const c of this.cops) this.scene.remove(c.mesh);
    this.pursuit = [];
    this.cops = [];
  }

  spawnPursuitNear(pos) {
    const angle = Math.random() * Math.PI * 2;
    const x = THREE.MathUtils.clamp(pos.x + Math.cos(angle) * 45, -150, 150);
    const z = THREE.MathUtils.clamp(pos.z + Math.sin(angle) * 45, -150, 150);
    const mesh = makeCarMesh(0xffffff, true);
    this.scene.add(mesh);
    const car = { mesh, pos: new THREE.Vector3(x, 0, z), heading: 0, speed: 0, hp: 60, kind: 'police' };
    this.pursuit.push(car);
    return car;
  }

  spawnCopNear(pos) {
    const angle = Math.random() * Math.PI * 2;
    const x = THREE.MathUtils.clamp(pos.x + Math.cos(angle) * 22, -150, 150);
    const z = THREE.MathUtils.clamp(pos.z + Math.sin(angle) * 22, -150, 150);
    const mesh = makeCopMesh();
    this.scene.add(mesh);
    const cop = { mesh, pos: new THREE.Vector3(x, 0, z), heading: 0, walkPhase: 0, dead: false, down: false };
    this.cops.push(cop);
    return cop;
  }

  update(dt, G) {
    this.time += dt;
    const player = G.player;
    const pPos = player.inCar ? player.inCar.pos : player.pos;
    // Heat cools when Rico stays clean; wanted drops a star at a time.
    if (this.heat > 0) {
      this.heat = Math.max(0, this.heat - CFG.heatDecay * 10 * dt);
      const w = this.heat <= 0 ? 0 : Math.min(CFG.maxWanted, 1 + Math.floor(this.heat / 20));
      if (w < this.wanted) this.wanted = w;
    }
    if (this.wanted === 0) {
      if (this.pursuit.length || this.cops.length) this.despawnAll();
      return { busted: false };
    }
    // Match pursuit pressure to the wanted level.
    const wantCars = Math.min(this.wanted, 3);
    while (this.pursuit.length < wantCars) this.spawnPursuitNear(pPos);
    while (this.pursuit.length > wantCars) {
      const c = this.pursuit.pop();
      this.scene.remove(c.mesh);
    }
    const wantCops = this.wanted >= 2 ? Math.min(this.wanted - 1, 3) : 0;
    while (this.cops.length < wantCops) this.spawnCopNear(pPos);
    while (this.cops.length > wantCops) {
      const c = this.cops.pop();
      this.scene.remove(c.mesh);
    }
    // Pursuit cars: chase and ram.
    for (const car of this.pursuit) {
      const dx = pPos.x - car.pos.x;
      const dz = pPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(-dz, dx);
      let diff = targetHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += THREE.MathUtils.clamp(diff, -1.6 * dt, 1.6 * dt);
      const wantSpeed = dist > 30 ? 30 : 24;
      car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.2);
      car.pos.x += Math.cos(car.heading) * car.speed * dt;
      car.pos.z += -Math.sin(car.heading) * car.speed * dt;
      if (collideWorld(car.pos.x, car.pos.z, 2.1, this.city.colliders)) {
        car.pos.x -= Math.cos(car.heading) * car.speed * dt;
        car.pos.z -= -Math.sin(car.heading) * car.speed * dt;
        car.heading += 0.9 * dt;
      }
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = -car.heading + Math.PI / 2;
      const flash = Math.sin(this.time * 9) > 0;
      if (car.mesh.userData.barRed) car.mesh.userData.barRed.material.emissiveIntensity = flash ? 2.2 : 0.2;
      if (car.mesh.userData.barBlue) car.mesh.userData.barBlue.material.emissiveIntensity = flash ? 0.2 : 2.2;
      // Ram the player's car.
      if (player.inCar && dist < 4.2) {
        player.inCar.hp -= 26 * dt * 4;
        player.inCar.speed *= 0.96;
        if (Math.random() < dt * 8) G.audio.crash();
        if (player.inCar.hp <= 0) {
          G.events.push('carWrecked');
          player.inCar.hp = 0;
        }
      }
    }
    // Foot cops: run the player down and bust on contact (on foot only).
    for (const cop of this.cops) {
      if (cop.dead) continue;
      const dx = player.pos.x - cop.pos.x;
      const dz = player.pos.z - cop.pos.z;
      const dist = Math.hypot(dx, dz);
      cop.heading = Math.atan2(-dz, dx);
      const speed = CFG.copRunSpeed;
      cop.pos.x += Math.cos(cop.heading) * speed * dt;
      cop.pos.z += -Math.sin(cop.heading) * speed * dt;
      cop.walkPhase += dt * 9;
      cop.mesh.position.copy(cop.pos);
      cop.mesh.rotation.y = -cop.heading + Math.PI / 2;
      cop.mesh.userData.legL.rotation.x = Math.sin(cop.walkPhase) * 0.7;
      cop.mesh.userData.legR.rotation.x = -Math.sin(cop.walkPhase) * 0.7;
      if (!player.inCar && dist < CFG.bustRange) return { busted: true };
    }
    return { busted: false };
  }
}
