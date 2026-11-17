// Rico Vega on foot: camera-relative movement, sprint, punch, pistol with a
// 12-round magazine, and getting in and out of cars. The player is a simple
// articulated figure built from boxes so the game needs no external models.
import * as THREE from 'three';
import { CFG } from './config.js';
import { collideWorld } from './vehicles.js';

function buildRico() {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d5f, roughness: 0.8 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0xd84b2e, roughness: 0.75 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.9 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
  head.position.y = 1.62;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 8, 0, Math.PI * 2, 0, 1.2), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }));
  hair.position.y = 1.66;
  group.add(hair);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.78, 0.38), jacket);
  torso.position.y = 1.05;
  group.add(torso);
  const legGeo = new THREE.BoxGeometry(0.26, 0.72, 0.28);
  const legL = new THREE.Mesh(legGeo, jeans);
  legL.position.set(0.17, 0.36, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, jeans);
  legR.position.set(-0.17, 0.36, 0);
  group.add(legR);
  const armGeo = new THREE.BoxGeometry(0.2, 0.68, 0.22);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(0.44, 1.05, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(-0.44, 1.05, 0);
  group.add(armR);
  // Pistol in the right hand, visible when armed.
  const gun = new THREE.Group();
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.42), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 }));
  gun.add(gunBody);
  gun.position.set(-0.44, 0.72, 0.28);
  gun.visible = false;
  group.add(gun);
  group.userData = { legL, legR, armL, armR, gun };
  return group;
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.mesh = buildRico();
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(-22, 0, 10);
    this.heading = Math.PI / 2;
    this.speed = 0;
    this.health = 100;
    this.inCar = null;
    this.armed = false;
    this.ammo = CFG.pistolMag;
    this.reloadTimer = 0;
    this.punchTimer = 0;
    this.punchQueued = false;
    this.walkPhase = 0;
    this.lastSafePos = this.pos.clone();
  }

  reset(spawn) {
    this.pos.copy(spawn);
    this.heading = Math.PI / 2;
    this.health = 100;
    this.inCar = null;
    this.armed = false;
    this.ammo = CFG.pistolMag;
    this.mesh.position.copy(this.pos);
    this.mesh.visible = true;
  }

  aimDirection(cameraYaw) {
    return cameraYaw;
  }

  update(dt, input, cameraYaw, colliders, effects) {
    if (this.inCar) return;
    if (this.punchTimer > 0) this.punchTimer -= dt;
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.ammo = CFG.pistolMag;
    }
    // Camera-relative movement.
    const fwd = { x: Math.sin(cameraYaw), z: Math.cos(cameraYaw) };
    const right = { x: Math.cos(cameraYaw), z: -Math.sin(cameraYaw) };
    let mx = 0;
    let mz = 0;
    if (input.up) { mx += fwd.x; mz += fwd.z; }
    if (input.down) { mx -= fwd.x; mz -= fwd.z; }
    if (input.left) { mx -= right.x; mz -= right.z; }
    if (input.right) { mx += right.x; mz += right.z; }
    const len = Math.hypot(mx, mz);
    const sprint = input.sprint && len > 0;
    const target = len > 0 ? (sprint ? CFG.sprintSpeed : CFG.walkSpeed) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 10);
    if (len > 0) {
      mx /= len;
      mz /= len;
      this.heading = Math.atan2(-mz, mx);
      const nx = this.pos.x + mx * this.speed * dt;
      const nz = this.pos.z + mz * this.speed * dt;
      const hit = collideWorld(nx, nz, 0.7, colliders);
      if (!hit) {
        this.pos.x = THREE.MathUtils.clamp(nx, -CFG.worldHalf, CFG.harborEdge - 2);
        this.pos.z = THREE.MathUtils.clamp(nz, -CFG.worldHalf, CFG.bayEdge - 2);
        this.lastSafePos.copy(this.pos);
      }
      this.walkPhase += dt * this.speed * 1.9;
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = -this.heading + Math.PI / 2;
    const swing = Math.sin(this.walkPhase) * Math.min(1, this.speed / CFG.walkSpeed) * 0.55;
    const u = this.mesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = this.armed ? -1.2 : -swing * 0.7;
    u.armR.rotation.x = this.punchTimer > 0.25 ? -1.9 : swing * 0.7;
    u.gun.visible = this.armed;
    if (this.punchQueued && this.punchTimer <= 0) {
      this.punchQueued = false;
      this.punchTimer = 0.45;
      return 'punch';
    }
    return null;
  }

  queuePunch() {
    if (!this.inCar) this.punchQueued = true;
  }

  // Hitscan shot toward the camera aim. Returns the hit point or null.
  shoot(camera, targets) {
    if (this.inCar || this.armed === false || this.reloadTimer > 0 || this.ammo <= 0) return null;
    this.ammo--;
    const origin = new THREE.Vector3(this.pos.x, 1.45, this.pos.z);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    let best = null;
    let bestD = CFG.pistolRange;
    for (const t of targets) {
      if (t.dead || t.down) continue;
      const dx = t.pos.x - origin.x;
      const dz = t.pos.z - origin.z;
      const along = dx * dir.x + dz * dir.z;
      if (along < 0 || along > bestD) continue;
      const side = Math.abs(dx * -dir.z + dz * dir.x);
      if (side < 1.6) { bestD = along; best = t; }
    }
    const hitPoint = origin.clone().add(dir.clone().multiplyScalar(best ? bestD : CFG.pistolRange));
    return { target: best, point: hitPoint };
  }

  takeDamage(amount, effects) {
    this.health = Math.max(0, this.health - amount);
    effects.addShake(0.6);
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(100, this.health + amount);
  }
}
