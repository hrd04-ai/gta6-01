// Cars for Palmera Bay: Sunset Heat.
// One Car class covers the player's ride, traffic and police cruisers:
// arcade physics (acceleration, steering, grip, drift), road-following
// traffic AI, parked cars to steal, and collision with the city and
// with other cars. Colours and models are drawn from the palette.

import { CAR, WORLD } from './config.js';
import { makeRng, clamp, wrapAngle, angleDiff } from './random.js';

export const CAR_COLORS = ['#e84545', '#3a86ff', '#ffd166', '#37e0d8', '#ff5da2', '#f4f1de', '#7d5ba6', '#ff8c42'];
export const CAR_MODELS = ['Sunset GT', 'Marina', 'Coral', 'Palm Cruiser', 'Bay Runner', 'Tropicana'];

export class Car {
  constructor(x, y, angle, opts = {}) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.color = opts.color ?? '#e84545';
    this.model = opts.model ?? 'Marina';
    this.kind = opts.kind ?? 'traffic'; // traffic | parked | player | police
    this.driver = opts.driver ?? 'ai'; // ai | player | none
    this.health = 100;
    this.w = 46;
    this.h = 24;
    this.dead = false;
    this.smoking = false;
    this.target = null; // traffic waypoint
    this.waitAtLight = 0;
    this.honkCooldown = 0;
    this.stealable = this.kind === 'parked';
    this.isMissionCar = false;
    this.lastSkid = 0;
  }

  get forwardX() {
    return Math.cos(this.angle);
  }

  get forwardY() {
    return Math.sin(this.angle);
  }

  // Arcade car physics: throttle, brake/reverse, steering that scales
  // with speed, lateral grip, drag, and a drift slide at high speed.
  drive(dt, input, city) {
    const throttle = input.up ? 1 : input.down ? -1 : 0;
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const dir = this.speed >= 0 ? 1 : -1;

    if (throttle > 0) this.speed += CAR.accel * dt;
    else if (throttle < 0) {
      this.speed -= (this.speed > 8 ? CAR.brake : CAR.reverseAccel) * dt;
    } else {
      this.speed -= Math.sign(this.speed) * 220 * dt;
      if (Math.abs(this.speed) < 6) this.speed = 0;
    }
    this.speed = clamp(this.speed, -CAR.maxReverse, CAR.maxSpeed);
    this.speed -= this.speed * CAR.drag * dt * 0.5;

    const speedNorm = Math.min(1, Math.abs(this.speed) / CAR.maxSpeed);
    const steerAmount = steer * CAR.steerRate * (0.35 + 0.65 * speedNorm) * dt * dir;
    this.angle = wrapAngle(this.angle + steerAmount);

    const vx = this.forwardX * this.speed;
    const vy = this.forwardY * this.speed;
    const nx = this.x + vx * dt;
    const ny = this.y + vy * dt;

    const blocked = city.buildingAt(nx, ny) || city.isSea(nx, ny);
    if (!blocked) {
      this.x = nx;
      this.y = ny;
    } else {
      // Scrape along the wall instead of stopping dead.
      if (!city.buildingAt(nx, this.y) && !city.isSea(nx, this.y)) this.x = nx;
      else if (!city.buildingAt(this.x, ny) && !city.isSea(this.x, ny)) this.y = ny;
      if (Math.abs(this.speed) > 120) this.health -= Math.abs(this.speed) * dt * 0.06;
      this.speed *= 0.55;
    }
    this.x = clamp(this.x, 30, WORLD.width - 30);
    this.y = clamp(this.y, 30, WORLD.height - 30);
    this.smoking = this.health < 45;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
    return { speedNorm, drifting: Math.abs(steer) > 0 && speedNorm > 0.55 };
  }

  // Traffic AI: pick a road waypoint, steer toward it, keep cruise speed.
  driveTraffic(dt, city, rng) {
    if (!this.target || Math.hypot(this.target.x - this.x, this.target.y - this.y) < 60) {
      this.target = city.randomRoadPoint(rng);
    }
    const want = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    const diff = angleDiff(this.angle, want);
    const steer = clamp(diff * 2.2, -1, 1);
    const cruise = this.model === 'Sunset GT' ? 210 : 150;
    this.speed += (cruise - this.speed) * 0.5 * dt;
    this.angle = wrapAngle(this.angle + steer * 1.9 * dt * (this.speed >= 0 ? 1 : -1));
    const nx = this.x + this.forwardX * this.speed * dt;
    const ny = this.y + this.forwardY * this.speed * dt;
    if (!city.buildingAt(nx, ny) && !city.isSea(nx, ny)) {
      this.x = nx;
      this.y = ny;
    } else {
      this.target = city.randomRoadPoint(rng);
      this.angle = wrapAngle(this.angle + Math.PI / 2);
    }
    this.x = clamp(this.x, 30, WORLD.width - 30);
    this.y = clamp(this.y, 30, WORLD.height - 30);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 26, 15, this.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(this.angle);
    // Body.
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.roundRect(-23, -12, 46, 24, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,24,40,0.9)';
    ctx.beginPath();
    ctx.roundRect(-8, -10, 18, 20, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,220,255,0.85)';
    ctx.fillRect(6, -9, 4, 18);
    // Headlights and tail lights.
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(21, -9, 3, 5);
    ctx.fillRect(21, 4, 3, 5);
    ctx.fillStyle = '#ff2d55';
    ctx.fillRect(-24, -9, 3, 5);
    ctx.fillRect(-24, 4, 3, 5);
    if (this.kind === 'police') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -12, 8, 24);
      ctx.fillStyle = '#1c1c1c';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 2, 3);
      // Light bar.
      const t = Date.now() / 240;
      ctx.fillStyle = Math.floor(t) % 2 === 0 ? '#ff2d55' : '#2d7bff';
      ctx.fillRect(-4, -13, 5, 4);
      ctx.fillStyle = Math.floor(t) % 2 === 0 ? '#2d7bff' : '#ff2d55';
      ctx.fillRect(1, -13, 5, 4);
    }
    if (this.isMissionCar) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(0, -18, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (this.smoking && !this.dead) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.arc(this.x - 14, this.y - 8, 5 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// Keep two cars from overlapping: push both apart along the line
// between them and trade a little speed. Returns true on a hit.
export function separateCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = 34;
  if (d >= min || d < 0.001) return false;
  const push = (min - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const tmp = a.speed;
  a.speed = b.speed * 0.6;
  b.speed = tmp * 0.6;
  return true;
}

export function spawnParkedCars(city, count, rng) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < count * 12) {
    const p = city.randomRoadPoint(rng);
    const vertical = rng.chance(0.5);
    const angle = vertical ? Math.PI / 2 : 0;
    const off = rng.chance(0.5) ? 34 : -34;
    const x = vertical ? p.x + off : p.x;
    const y = vertical ? p.y : p.y + off;
    if (city.buildingAt(x, y)) continue;
    const car = new Car(x, y, angle + (rng.chance(0.5) ? Math.PI : 0), {
      color: CAR_COLORS[rng.int(0, CAR_COLORS.length - 1)],
      model: CAR_MODELS[rng.int(0, CAR_MODELS.length - 1)],
      kind: 'parked',
      driver: 'none',
    });
    cars.push(car);
  }
  return cars;
}

export function spawnTraffic(city, count, rng) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = city.randomRoadPoint(rng);
    cars.push(new Car(p.x, p.y, rng.next() * Math.PI * 2, {
      color: CAR_COLORS[rng.int(0, CAR_COLORS.length - 1)],
      model: CAR_MODELS[rng.int(0, CAR_MODELS.length - 1)],
      kind: 'traffic',
      driver: 'ai',
    }));
  }
  return cars;
}

export function makeRngForCars(seed) {
  return makeRng(seed);
}
