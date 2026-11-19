// Pedestrians for Palmera Bay: Sunset Heat.
// Walkers stroll the sidewalks and the beachfront, chat in pairs, and
// flee when they hear a gunshot or see a car coming at them. A few are
// tourists; hitting one is a crime, and the police notice.

import { PEDS, WORLD } from './config.js';
import { makeRng, clamp, angleTo } from './random.js';

const SHIRTS = ['#e84545', '#3a86ff', '#ffd166', '#37e0d8', '#ff5da2', '#f4f1de', '#7d5ba6', '#ff8c42', '#5ec962'];
const NAMES = ['Mia', 'Leo', 'Sofia', 'Dante', 'Luna', 'Marco', 'Isla', 'Nico', 'Carmen', 'Felix', 'Rosa', 'Hugo'];

export class Pedestrian {
  constructor(x, y, rng) {
    this.x = x;
    this.y = y;
    this.angle = rng.next() * Math.PI * 2;
    this.name = NAMES[rng.int(0, NAMES.length - 1)];
    this.shirt = SHIRTS[rng.int(0, SHIRTS.length - 1)];
    this.tourist = rng.chance(0.3);
    this.speed = PEDS.walkSpeed * rng.range(0.7, 1.3);
    this.target = null;
    this.state = 'walk'; // walk | flee | down
    this.fleeTimer = 0;
    this.downTimer = 0;
    this.panic = 0;
    this.rng = rng;
    this.walkPhase = rng.next() * Math.PI * 2;
  }

  scare(fromX, fromY) {
    if (this.state === 'down') return;
    this.state = 'flee';
    this.fleeTimer = 2.5 + this.rng.next() * 2;
    this.panic = 1;
    this.angle = angleTo(fromX, fromY, this.x, this.y);
  }

  knockDown() {
    this.state = 'down';
    this.downTimer = 6;
    this.panic = 1;
  }

  update(dt, city) {
    this.walkPhase += dt * 8;
    if (this.state === 'down') {
      this.downTimer -= dt;
      if (this.downTimer <= 0) this.state = 'walk';
      return;
    }
    if (this.state === 'flee') {
      this.fleeTimer -= dt;
      const speed = PEDS.fleeSpeed;
      const nx = this.x + Math.cos(this.angle) * speed * dt;
      const ny = this.y + Math.sin(this.angle) * speed * dt;
      if (city.isWalkable(nx, this.y)) this.x = nx;
      if (city.isWalkable(this.x, ny)) this.y = ny;
      this.x = clamp(this.x, 24, WORLD.width - 24);
      this.y = clamp(this.y, 24, WORLD.height - 24);
      if (this.fleeTimer <= 0) {
        this.state = 'walk';
        this.panic = 0;
      }
      return;
    }
    // Stroll: pick a nearby sidewalk or beach point and walk to it.
    if (!this.target || Math.hypot(this.target.x - this.x, this.target.y - this.y) < 26) {
      const beach = this.rng.chance(0.25);
      if (beach) {
        this.target = {
          x: clamp(this.x + this.rng.range(-300, 300), 60, WORLD.width - 60),
          y: WORLD.beachY + this.rng.range(10, 130),
        };
      } else {
        const p = city.nearestRoadPoint(this.x, this.y);
        const along = this.rng.range(-260, 260);
        const side = this.rng.chance(0.5) ? 58 : -58;
        this.target = {
          x: clamp(p.x + (Math.abs(p.x - this.x) > 4 ? along : side), 40, WORLD.width - 40),
          y: clamp(p.y + (Math.abs(p.y - this.y) > 4 ? side : along), 40, WORLD.height - 40),
        };
      }
    }
    const a = angleTo(this.x, this.y, this.target.x, this.target.y);
    this.angle = a;
    const nx = this.x + Math.cos(a) * this.speed * dt;
    const ny = this.y + Math.sin(a) * this.speed * dt;
    if (city.isWalkable(nx, this.y)) this.x = nx;
    if (city.isWalkable(this.x, ny)) this.y = ny;
  }

  draw(ctx) {
    const bob = this.state === 'walk' ? Math.sin(this.walkPhase) * 1.5 : 0;
    ctx.save();
    ctx.translate(this.x, this.y + bob * 0.3);
    if (this.state === 'down') {
      ctx.rotate(this.angle + Math.PI / 2);
      ctx.fillStyle = this.shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath();
      ctx.arc(16, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 7, 9, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(this.angle);
    ctx.fillStyle = '#2b2f4a';
    ctx.fillRect(-5, -6, 11, 12);
    ctx.fillStyle = this.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(7, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    if (this.tourist) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-3, -12, 6, 4);
    }
    ctx.restore();
    if (this.panic > 0) {
      ctx.save();
      ctx.fillStyle = '#ff2d55';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', this.x, this.y - 16);
      ctx.restore();
    }
  }
}

export function spawnPedestrians(city, count, seed = 777) {
  const rng = makeRng(seed);
  const peds = [];
  for (let i = 0; i < count; i++) {
    let x;
    let y;
    if (rng.chance(0.3)) {
      x = rng.range(60, WORLD.width - 60);
      y = WORLD.beachY + rng.range(10, 130);
    } else {
      const p = city.randomRoadPoint(rng);
      x = p.x + rng.range(-70, 70);
      y = p.y + rng.range(-70, 70);
    }
    peds.push(new Pedestrian(x, y, rng));
  }
  return peds;
}
