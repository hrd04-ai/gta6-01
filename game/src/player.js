// Rico Vega on foot: third-person movement that answers to the camera,
// a punch for close work, a pistol for louder problems, and the E key that
// turns any car on the street into his car.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, angleDiff } from './random.js';
import { resolveCircleVsBuildings } from './city.js';
import { createPlayerModel } from './pedestrians.js';

export class Player {
  constructor(scene) {
    this.model = createPlayerModel();
    scene.add(this.model.group);
    this.x = 0; this.z = 0;
    this.heading = 0;
    this.vx = 0; this.vz = 0;
    this.health = CONFIG.player.health;
    this.maxHealth = CONFIG.player.health;
    this.armed = false; // pistol unlocked by mission 1
    this.ammo = CONFIG.player.magSize;
    this.reloadTimer = 0;
    this.punchTimer = 0;
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.onFoot = true;
    this.inCar = null; // PlayerCar when driving
    this.walkPhase = 0;
    this.dead = false;
    this.invulnTimer = 0;
  }

  place(x, z, heading) {
    this.x = x; this.z = z; this.heading = heading;
    this.vx = 0; this.vz = 0;
    this.model.group.position.set(x, 0, z);
    this.model.group.rotation.y = heading;
  }

  get speed() {
    return Math.hypot(this.vx, this.vz);
  }

  hurt(amount, world) {
    if (this.invulnTimer > 0 || this.dead) return;
    this.health -= amount;
    this.invulnTimer = 0.4;
    world.onPlayerHurt?.();
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      world.onPlayerWasted?.();
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  // Returns the world position of the muzzle, for tracer effects.
  muzzlePosition() {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    return { x: this.x + fx * 0.7, y: 1.35, z: this.z + fz * 0.7 };
  }

  update(dt, input, cameraHeading, world) {
    if (!this.onFoot || this.dead) return;
    const cfg = CONFIG.player;
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.reloadTimer = Math.max(0, this.reloadTimer - dt);
    if (this.reloadTimer === 0 && this.ammo === 0) {
      this.ammo = cfg.magSize;
      world.onReloaded?.();
    }

    // Movement is camera-relative: W runs away from the camera (along the
    // view direction), A/D strafe across it.
    let mx = 0, mz = 0;
    if (input.forward) { mx += Math.sin(cameraHeading); mz += Math.cos(cameraHeading); }
    if (input.back) { mx -= Math.sin(cameraHeading); mz -= Math.cos(cameraHeading); }
    if (input.left) { mx += Math.cos(cameraHeading); mz -= Math.sin(cameraHeading); }
    if (input.right) { mx -= Math.cos(cameraHeading); mz += Math.sin(cameraHeading); }
    const mLen = Math.hypot(mx, mz);
    const top = input.run ? cfg.runSpeed : cfg.walkSpeed;
    if (mLen > 0) {
      mx /= mLen; mz /= mLen;
      this.vx += mx * cfg.accel * dt;
      this.vz += mz * cfg.accel * dt;
      const sp = Math.hypot(this.vx, this.vz);
      if (sp > top) {
        this.vx = (this.vx / sp) * top;
        this.vz = (this.vz / sp) * top;
      }
      const wantHeading = Math.atan2(this.vx, this.vz);
      this.heading += clamp(angleDiff(this.heading, wantHeading), -7 * dt, 7 * dt);
    } else {
      const sp = Math.hypot(this.vx, this.vz);
      const dec = cfg.friction * dt;
      if (sp <= dec) { this.vx = 0; this.vz = 0; }
      else { this.vx -= (this.vx / sp) * dec; this.vz -= (this.vz / sp) * dec; }
    }

    let nx = this.x + this.vx * dt;
    let nz = this.z + this.vz * dt;
    const resolved = resolveCircleVsBuildings(nx, nz, cfg.radius, world.colliders);
    if (resolved.x !== nx || resolved.z !== nz) {
      // Slide along the wall instead of sticking to it.
      this.vx *= 0.4; this.vz *= 0.4;
    }
    nx = clamp(resolved.x, -172, 156);
    nz = clamp(resolved.z, -172, 156);
    this.x = nx; this.z = nz;

    // Walk cycle: legs and arms swing with speed.
    this.walkPhase += dt * this.speed * 2.4;
    const swing = Math.sin(this.walkPhase) * clamp(this.speed / 5, 0, 1) * 0.6;
    this.model.legL.rotation.x = swing;
    this.model.legR.rotation.x = -swing;
    this.model.armL.rotation.x = -swing * 0.7;
    this.model.armR.rotation.x = swing * 0.7;

    // Punch: a short arc in front of the player.
    if (this.punchTimer > 0) {
      this.punchTimer -= dt;
      this.model.armR.rotation.x = -1.9 * Math.sin((this.punchTimer / 0.28) * Math.PI);
    }
    if (input.punch && this.punchCooldown <= 0) {
      this.punchCooldown = 0.42;
      this.punchTimer = 0.28;
      world.onPunch?.(this);
    }
    // Edge-triggered: a press is one punch, even if the frame that reads it
    // comes late.
    input.punch = false;

    // Shooting: hitscan against cops, guards and peds in a narrow cone.
    // A queued click fires on the next frame even if the button was already
    // released — at low frame rates a down/up pair can otherwise land
    // between two frames and be swallowed entirely.
    if ((input.shoot || input.shootQueued) && this.armed && this.shootCooldown <= 0 && this.reloadTimer <= 0) {
      if (this.ammo <= 0) {
        this.reloadTimer = cfg.reloadSeconds;
        world.onReloadStart?.();
      } else {
        this.shootCooldown = 0.22;
        this.ammo -= 1;
        world.onShoot?.(this);
      }
      input.shootQueued = false;
    } else if (!this.armed) {
      input.shootQueued = false;
    }
    if (input.reload && this.ammo < cfg.magSize && this.reloadTimer <= 0) {
      this.reloadTimer = cfg.reloadSeconds;
      world.onReloadStart?.();
    }

    this.model.group.position.set(this.x, 0, this.z);
    this.model.group.rotation.y = this.heading;
    this.model.gun.visible = this.armed;
  }

  // Step out of the driver's seat beside the car.
  exitCar(colliders = []) {
    if (!this.inCar) return;
    const car = this.inCar;
    const px = car.x + Math.cos(car.heading) * 2.6;
    const pz = car.z - Math.sin(car.heading) * 2.6;
    car.active = false;
    this.inCar = null;
    this.onFoot = true;
    const resolved = resolveCircleVsBuildings(px, pz, CONFIG.player.radius, colliders);
    this.place(resolved.x, resolved.z, car.heading);
    this.model.group.visible = true;
  }

  enterCar(car, world) {
    this.inCar = car;
    this.onFoot = false;
    car.active = true;
    this.model.group.visible = false;
    this.vx = 0; this.vz = 0;
    world.onEnterCar?.(car);
  }
}
