// The wanted system and the Palmera Bay police.
// Stars rise with crimes and fall when the player stays out of sight.
// Police cruisers spawn off-screen and chase the player's car; foot
// cops close in on foot and try to bust the player. Lose them, and the
// heat cools — get caught on foot, and it is a night in the cells.

import { POLICE, WORLD, ECONOMY } from './config.js';
import { Car } from './vehicles.js';
import { clamp, angleDiff, wrapAngle } from './random.js';

export class Wanted {
  constructor() {
    this.stars = 0;
    this.unseenTimer = 0;
    this.lastSeen = 0;
    this.heat = 0; // 0..1, how "hot" the player is right now
  }

  addStars(n, reason) {
    const before = this.stars;
    this.stars = clamp(this.stars + n, 0, POLICE.maxStars);
    this.unseenTimer = 0;
    return { before, after: this.stars, reason };
  }

  clear() {
    this.stars = 0;
    this.unseenTimer = 0;
    this.heat = 0;
  }

  update(dt, seen) {
    if (this.stars === 0) {
      this.heat = Math.max(0, this.heat - dt * 0.4);
      return;
    }
    if (seen) {
      this.unseenTimer = 0;
      this.heat = Math.min(1, this.heat + dt * 0.5);
    } else {
      this.unseenTimer += dt;
      this.heat = Math.max(0, this.heat - dt * 0.15);
      if (this.unseenTimer >= POLICE.decayDelay) {
        this.stars -= 1;
        this.unseenTimer = 0;
      }
    }
  }
}

export class PoliceUnit {
  constructor(x, y, onFoot) {
    this.onFoot = onFoot;
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.speed = 0;
    this.health = onFoot ? 60 : 120;
    this.dead = false;
    this.bustTimer = 0;
    this.shootCooldown = 1.2;
    this.car = null;
    if (!onFoot) {
      this.car = new Car(x, y, 0, { color: '#f4f1de', model: 'Interceptor', kind: 'police', driver: 'ai' });
    }
  }

  get pos() {
    return this.car ?? this;
  }

  update(dt, target, city, effects) {
    if (this.dead) return;
    if (this.car) {
      const c = this.car;
      const dx = target.x - c.x;
      const dy = target.y - c.y;
      const dist = Math.hypot(dx, dy);
      const want = Math.atan2(dy, dx);
      const diff = angleDiff(c.angle, want);
      const steer = clamp(diff * 2.6, -1, 1);
      const cruise = POLICE.pursuitSpeed * (dist > 500 ? 1.08 : 0.92);
      c.speed += (cruise - c.speed) * 0.8 * dt;
      c.angle = wrapAngle(c.angle + steer * 2.4 * dt);
      const nx = c.x + Math.cos(c.angle) * c.speed * dt;
      const ny = c.y + Math.sin(c.angle) * c.speed * dt;
      if (!city.buildingAt(nx, ny) && !city.isSea(nx, ny)) {
        c.x = nx;
        c.y = ny;
      } else {
        c.angle = wrapAngle(c.angle + Math.PI * 0.6);
        c.speed *= 0.5;
      }
      this.x = c.x;
      this.y = c.y;
      c.smoking = c.health < 45;
      if (c.health <= 0) {
        c.dead = true;
        this.dead = true;
        effects.explosion(c.x, c.y);
      }
      return;
    }
    // Foot cop: run at the player, try to bust them.
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    this.angle = Math.atan2(dy, dx);
    if (dist > POLICE.bustRadius) {
      this.bustTimer = 0;
      const speed = 235;
      const nx = this.x + Math.cos(this.angle) * speed * dt;
      const ny = this.y + Math.sin(this.angle) * speed * dt;
      if (city.isWalkable(nx, this.y)) this.x = nx;
      if (city.isWalkable(this.x, ny)) this.y = ny;
    } else {
      this.bustTimer += dt;
    }
    this.shootCooldown -= dt;
  }

  // Returns 'busted' when the cop has pinned the player long enough.
  bustCheck(player) {
    if (this.onFoot && !this.dead && !player.inCar) {
      const d = Math.hypot(player.x - this.x, player.y - this.y);
      if (d <= POLICE.bustRadius && this.bustTimer >= POLICE.bustTime) return 'busted';
    }
    return null;
  }

  draw(ctx) {
    if (this.dead) return;
    if (this.car) {
      this.car.draw(ctx);
      return;
    }
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(this.angle);
    ctx.fillStyle = '#1c2f6e';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(2, -3, 8, 6);
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(8, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class PoliceDirector {
  constructor(city) {
    this.city = city;
    this.units = [];
    this.spawnTimer = 0;
    this.wanted = new Wanted();
  }

  reset() {
    this.units = [];
    this.spawnTimer = 0;
    this.wanted.clear();
  }

  crime(stars, reason) {
    const change = this.wanted.addStars(stars, reason);
    if (change.after > change.before && change.after > 0) {
      // Spawn one unit immediately on a fresh star so the heat is felt.
      this.spawnTimer = 0;
    }
    return change;
  }

  update(dt, player, camera, effects, audio) {
    const target = player.inCar ? player.inCar : player;
    const px = target.x;
    const py = target.y;

    // Does any unit currently see the player?
    let seen = false;
    for (const u of this.units) {
      if (u.dead) continue;
      const d = Math.hypot(u.x - px, u.y - py);
      if (d < POLICE.sightRange) {
        seen = true;
        break;
      }
    }
    this.wanted.update(dt, seen);

    // Spawn to the cap for the current star level, off-screen.
    const stars = this.wanted.stars;
    this.spawnTimer -= dt;
    const cap = POLICE.maxUnits[stars] ?? 0;
    const alive = this.units.filter((u) => !u.dead).length;
    if (stars > 0 && alive < cap && this.spawnTimer <= 0) {
      this.spawnTimer = POLICE.spawnInterval[stars] ?? 2;
      const onFoot = stars >= 2 && Math.random() < 0.3 && !player.inCar;
      const angle = Math.random() * Math.PI * 2;
      const dist = 720 + Math.random() * 260;
      let x = px + Math.cos(angle) * dist;
      let y = py + Math.sin(angle) * dist;
      x = clamp(x, 60, WORLD.width - 60);
      y = clamp(y, 60, WORLD.height - 220);
      if (!this.city.buildingAt(x, y)) {
        const unit = new PoliceUnit(x, y, onFoot);
        this.units.push(unit);
        audio.sirenBlip();
      }
    }

    // Despawn units that fell far behind and are off-screen.
    this.units = this.units.filter((u) => {
      if (u.dead) return false;
      const d = Math.hypot(u.x - px, u.y - py);
      return d < 1900;
    });

    for (const u of this.units) u.update(dt, target, this.city, effects);

    // Ramming: a police car hitting the player's car hurts the player.
    if (player.inCar) {
      for (const u of this.units) {
        if (!u.car || u.dead) continue;
        const d = Math.hypot(u.car.x - player.inCar.x, u.car.y - player.inCar.y);
        if (d < 40 && Math.abs(u.car.speed) > 180) {
          player.takeDamage(POLICE.ramDamage * dt * 2);
          effects.sparks(player.inCar.x, player.inCar.y);
          u.car.speed *= 0.4;
        }
      }
    }

    audio.setSiren(stars > 0);
    return { stars, seen };
  }

  bustCheck(player) {
    for (const u of this.units) {
      const result = u.bustCheck(player);
      if (result) return result;
    }
    return null;
  }

  draw(ctx) {
    for (const u of this.units) u.draw(ctx);
  }
}

export { ECONOMY };
