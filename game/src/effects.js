// Particles, skid marks, shockwaves and floating text for Palmera Bay.
// The game world keeps one Effects instance; anything that makes a
// bang, a screech or a spark tells it, and it draws and fades them.

import { makeRng } from './random.js';

const PARTICLE_COLORS = ['#ffb347', '#ff5da2', '#ffd166', '#ffffff', '#ff7b54'];

export class Effects {
  constructor() {
    this.particles = [];
    this.skids = [];
    this.texts = [];
    this.shockwaves = [];
    this.shake = 0;
    this.rng = makeRng(987654);
  }

  addShake(amount) {
    this.shake = Math.min(18, this.shake + amount);
  }

  shakeOffset() {
    if (this.shake <= 0.1) return { x: 0, y: 0 };
    return {
      x: (this.rng.next() - 0.5) * this.shake,
      y: (this.rng.next() - 0.5) * this.shake,
    };
  }

  burst(x, y, count, color, speed = 220, life = 0.6, size = 4) {
    for (let i = 0; i < count; i++) {
      const a = this.rng.next() * Math.PI * 2;
      const v = speed * (0.35 + this.rng.next() * 0.85);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: life * (0.6 + this.rng.next() * 0.7),
        maxLife: life,
        size: size * (0.6 + this.rng.next() * 0.8),
        color: color ?? PARTICLE_COLORS[this.rng.int(0, PARTICLE_COLORS.length - 1)],
      });
    }
  }

  explosion(x, y) {
    this.burst(x, y, 42, '#ff7b54', 380, 0.9, 6);
    this.burst(x, y, 24, '#ffd166', 260, 0.7, 5);
    this.burst(x, y, 18, '#5a5a5a', 140, 1.2, 7);
    this.shockwaves.push({ x, y, r: 8, maxR: 130, life: 0.5, maxLife: 0.5 });
    this.addShake(12);
  }

  muzzle(x, y, angle) {
    this.burst(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, 4, '#ffd166', 300, 0.14, 3);
  }

  blood(x, y) {
    this.burst(x, y, 8, '#c0392b', 130, 0.5, 3);
  }

  sparks(x, y) {
    this.burst(x, y, 6, '#ffe9a0', 260, 0.3, 2.5);
  }

  smoke(x, y) {
    this.particles.push({
      x, y,
      vx: (this.rng.next() - 0.5) * 30,
      vy: -40 - this.rng.next() * 30,
      life: 1.1, maxLife: 1.1,
      size: 7 + this.rng.next() * 6,
      color: 'rgba(90,90,90,0.5)',
    });
  }

  skid(x, y, angle, length) {
    this.skids.push({ x, y, angle, length, life: 6, maxLife: 6 });
    if (this.skids.length > 220) this.skids.shift();
  }

  floatText(x, y, text, color = '#fff3e0') {
    this.texts.push({ x, y, text, color, life: 1.4, maxLife: 1.4 });
  }

  update(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.2 * dt;
      p.vy *= 1 - 2.2 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const s of this.skids) s.life -= dt;
    this.skids = this.skids.filter((s) => s.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 34 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const w of this.shockwaves) {
      w.life -= dt;
      w.r = w.maxR * (1 - w.life / w.maxLife);
    }
    this.shockwaves = this.shockwaves.filter((w) => w.life > 0);
    this.shake = Math.max(0, this.shake - 26 * dt);
  }

  drawUnder(ctx) {
    // Skid marks live under the cars.
    ctx.save();
    for (const s of this.skids) {
      ctx.globalAlpha = 0.35 * (s.life / s.maxLife);
      ctx.strokeStyle = '#14101a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + Math.cos(s.angle) * s.length, s.y + Math.sin(s.angle) * s.length);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawOver(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * (p.life / p.maxLife)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const w of this.shockwaves) {
      ctx.globalAlpha = Math.max(0, w.life / w.maxLife) * 0.8;
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    for (const t of this.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }
}
