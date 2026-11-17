// Juice: one pooled particle system for muzzle flashes, impacts, smoke
// and explosions, plus the screen shake that sells every crash. No textures,
// no files — just points, colour and velocity.

import * as THREE from 'three';

// Local jitter helper: effects are visual noise, they need no seed.
const rr = (min, max) => min + Math.random() * (max - min);

const MAX_PARTICLES = 700;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.free = [];
    this.shakeAmount = 0;

    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.free.push(i);
      this.positions[i * 3 + 1] = -100; // park unused particles underground
    }
  }

  spawn(x, y, z, vx, vy, vz, life, r, g, b, gravity = -9) {
    if (!this.free.length) return;
    const i = this.free.pop();
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    this.colors[i * 3] = r;
    this.colors[i * 3 + 1] = g;
    this.colors[i * 3 + 2] = b;
    this.particles.push({ i, vx, vy, vz, life, maxLife: life, gravity });
  }

  burst(x, y, z, count, color, speed, life = 0.7, up = 2) {
    const c = new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2;
      const e = rr(-0.4, 1);
      const s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(
        x, y, z,
        Math.cos(a) * s, e * s + up, Math.sin(a) * s,
        life * (0.6 + Math.random() * 0.7),
        c.r, c.g, c.b,
      );
    }
  }

  muzzle(x, y, z, dx, dz) {
    this.burst(x, y, z, 6, 0xffd76a, 7, 0.16, 0.5);
    this.spawn(x + dx, y, z + dz, dx * 14, 0.5, dz * 14, 0.1, 1, 0.85, 0.4, 0);
  }

  tireSmoke(x, z) {
    for (let n = 0; n < 3; n++) {
      this.spawn(
        x + rr(-0.3, 0.3), 0.25, z + rr(-0.3, 0.3),
        rr(-0.6, 0.6), rr(0.8, 1.6), rr(-0.6, 0.6),
        0.9, 0.55, 0.55, 0.55, 1.2,
      );
    }
  }

  explosion(x, y, z) {
    this.burst(x, y + 0.5, z, 42, 0xff7a1a, 13, 0.9, 5);
    this.burst(x, y + 0.5, z, 26, 0xffd76a, 9, 0.6, 4);
    this.burst(x, y + 1.2, z, 20, 0x555555, 4, 1.6, 3);
    this.shake(0.9);
  }

  impact(x, y, z) {
    this.burst(x, y, z, 10, 0xffe9a8, 5, 0.4, 1);
  }

  shake(amount) {
    this.shakeAmount = Math.min(1.2, this.shakeAmount + amount);
  }

  shakeOffset() {
    if (this.shakeAmount <= 0.01) return { x: 0, y: 0 };
    const s = this.shakeAmount * this.shakeAmount;
    return {
      x: (Math.random() * 2 - 1) * s * 0.5,
      y: (Math.random() * 2 - 1) * s * 0.35,
    };
  }

  update(dt) {
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 1.8);
    for (let n = this.particles.length - 1; n >= 0; n--) {
      const p = this.particles[n];
      p.life -= dt;
      if (p.life <= 0) {
        this.positions[p.i * 3 + 1] = -100;
        this.free.push(p.i);
        this.particles.splice(n, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      this.positions[p.i * 3] += p.vx * dt;
      this.positions[p.i * 3 + 1] += p.vy * dt;
      this.positions[p.i * 3 + 2] += p.vz * dt;
      if (this.positions[p.i * 3 + 1] < 0.05) {
        this.positions[p.i * 3 + 1] = 0.05;
        p.vy *= -0.3;
        p.vx *= 0.7;
        p.vz *= 0.7;
      }
      const fade = p.life / p.maxLife;
      this.colors[p.i * 3] *= 0.985 + fade * 0.015;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
