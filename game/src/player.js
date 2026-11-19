// The player on foot: Rico Marin, driver-for-hire in Palmera Bay.
// Walks and runs with WASD, aims with the mouse, shoots with click,
// punches with F, and gets in and out of cars with E. The player owns
// health, ammo and the wanted interaction hooks; the car itself lives
// in vehicles.js and the police in police.js.

import { PLAYER, WORLD } from './config.js';
import { clamp } from './random.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.aimAngle = -Math.PI / 2;
    this.speed = 0;
    this.health = PLAYER.maxHealth;
    this.ammo = PLAYER.pistolAmmoMax;
    this.inCar = null; // the Car instance the player is driving, or null
    this.moving = false;
    this.running = false;
    this.shootCooldown = 0;
    this.punchCooldown = 0;
    this.hurtFlash = 0;
    this.dead = false;
    this.stealProgress = 0;
    this.stealTarget = null;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.health = PLAYER.maxHealth;
    this.ammo = PLAYER.pistolAmmoMax;
    this.inCar = null;
    this.dead = false;
    this.shootCooldown = 0;
    this.hurtFlash = 0;
  }

  takeDamage(amount) {
    if (this.dead) return;
    this.health -= amount;
    this.hurtFlash = 0.35;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  heal(amount) {
    this.health = Math.min(PLAYER.maxHealth, this.health + amount);
  }

  update(dt, input, city, cars, effects) {
    if (this.dead || this.inCar) {
      this.shootCooldown = Math.max(0, this.shootCooldown - dt);
      return;
    }
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);

    // Aim follows the mouse in world space.
    this.aimAngle = Math.atan2(input.mouseWorldY - this.y, input.mouseWorldX - this.x);

    let mx = 0;
    let my = 0;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) my -= 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) my += 1;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) mx -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) mx += 1;
    this.moving = mx !== 0 || my !== 0;
    this.running = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');

    if (this.moving) {
      const len = Math.hypot(mx, my);
      const speed = this.running ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const nx = this.x + (mx / len) * speed * dt;
      const ny = this.y + (my / len) * speed * dt;
      this.angle = Math.atan2(my, mx);
      // Slide along walls: try the full step, then each axis alone.
      if (city.isWalkable(nx, this.y)) this.x = nx;
      if (city.isWalkable(this.x, ny)) this.y = ny;
      this.x = clamp(this.x, 24, WORLD.width - 24);
      this.y = clamp(this.y, 24, WORLD.height - 24);
      city.resolveBuildingCollision(this, PLAYER.radius);
      void effects;
    }
  }

  // Returns a shot {x, y, angle} when the trigger is pulled, else null.
  tryShoot(input) {
    if (this.dead || this.inCar) return null;
    if (this.shootCooldown > 0 || this.ammo <= 0) return null;
    if (!input.mouseDown) return null;
    this.shootCooldown = PLAYER.pistolRate;
    this.ammo -= 1;
    this.aimAngle = Math.atan2(input.mouseWorldY - this.y, input.mouseWorldX - this.x);
    return {
      x: this.x + Math.cos(this.aimAngle) * 20,
      y: this.y + Math.sin(this.aimAngle) * 20,
      angle: this.aimAngle,
    };
  }

  tryPunch(input) {
    if (this.dead || this.inCar) return false;
    if (this.punchCooldown > 0) return false;
    if (!input.keys.has('KeyF')) return false;
    this.punchCooldown = 0.45;
    return true;
  }

  // Nearest car the player could enter, within interaction range.
  nearbyCar(cars) {
    let best = null;
    let bestD = 74;
    for (const car of cars) {
      const d = Math.hypot(car.x - this.x, car.y - this.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  draw(ctx, time) {
    if (this.inCar || this.dead) return;
    const bob = this.moving ? Math.sin(time * 11) * 2 : 0;
    ctx.save();
    ctx.translate(this.x, this.y + bob * 0.4);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body: sunset jacket, dark jeans.
    ctx.rotate(this.angle);
    ctx.fillStyle = '#2b2f4a';
    ctx.fillRect(-7, -8, 15, 16); // legs
    ctx.fillStyle = '#ff5da2';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(2, -4, 9, 8); // jacket stripe
    // Pistol arm points at the aim angle.
    ctx.rotate(this.aimAngle - this.angle);
    ctx.fillStyle = '#2b2f4a';
    ctx.fillRect(6, -3, 14, 6);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(16, -2, 10, 4);
    ctx.restore();
    if (this.hurtFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.hurtFlash * 1.4;
      ctx.fillStyle = '#ff2d55';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
