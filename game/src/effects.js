// Particles, smoke, muzzle flashes, skid marks and screen shake.
// One pooled point cloud keeps the per-frame allocation at zero.
import * as THREE from 'three';

const MAX_PARTICLES = 420;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.vel = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.head = 0;
    this.positions.fill(99999);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.9, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // Muzzle flash: a small additive sprite shown for one or two frames.
    const flashMat = new THREE.SpriteMaterial({
      color: 0xffd76a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.flash = new THREE.Sprite(flashMat);
    this.flash.scale.set(2.2, 2.2, 1);
    scene.add(this.flash);
    this.flashLife = 0;

    // Skid marks: dark quads laid flat on the road, oldest recycled.
    this.skids = [];
    const skidGeo = new THREE.PlaneGeometry(0.5, 2.2);
    const skidMat = new THREE.MeshBasicMaterial({ color: 0x141414, transparent: true, opacity: 0.55, depthWrite: false });
    for (let i = 0; i < 90; i++) {
      const mesh = new THREE.Mesh(skidGeo, skidMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.06;
      mesh.visible = false;
      scene.add(mesh);
      this.skids.push(mesh);
    }
    this.skidHead = 0;

    this.shake = 0;
  }

  spawn(x, y, z, vx, vy, vz, r, g, b, life) {
    const i = this.head;
    this.head = (this.head + 1) % MAX_PARTICLES;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.colors[i * 3] = r;
    this.colors[i * 3 + 1] = g;
    this.colors[i * 3 + 2] = b;
    this.life[i] = life;
    this.maxLife[i] = life;
  }

  burst(pos, count, color, speed = 6, up = 4, life = 0.7) {
    const c = new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.spawn(pos.x, pos.y, pos.z, Math.cos(a) * s, up * Math.random(), Math.sin(a) * s, c.r, c.g, c.b, life * (0.6 + Math.random() * 0.7));
    }
  }

  smoke(pos, count = 3) {
    for (let n = 0; n < count; n++) {
      this.spawn(
        pos.x + (Math.random() - 0.5), pos.y + Math.random() * 0.4, pos.z + (Math.random() - 0.5),
        (Math.random() - 0.5) * 0.8, 1.2 + Math.random(), (Math.random() - 0.5) * 0.8,
        0.32, 0.32, 0.34, 1.4 + Math.random() * 0.8,
      );
    }
  }

  muzzle(pos) {
    this.flash.position.copy(pos);
    this.flash.material.opacity = 1;
    this.flashLife = 0.06;
  }

  skid(x, z, angle) {
    const mesh = this.skids[this.skidHead];
    this.skidHead = (this.skidHead + 1) % this.skids.length;
    mesh.position.set(x, 0.06, z);
    mesh.rotation.z = angle;
    mesh.visible = true;
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  update(dt) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[i * 3] = 99999;
        continue;
      }
      this.positions[i * 3] += this.vel[i * 3] * dt;
      this.positions[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] -= 3.5 * dt;
      const fade = this.life[i] / this.maxLife[i];
      this.colors[i * 3] *= (0.92 + 0.08 * fade);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    if (this.flashLife > 0) {
      this.flashLife -= dt;
      if (this.flashLife <= 0) this.flash.material.opacity = 0;
    }
    this.shake = Math.max(0, this.shake - dt * 2.4);
  }

  shakeOffset() {
    if (this.shake <= 0.01) return { x: 0, y: 0 };
    const s = this.shake * 0.35;
    return { x: (Math.random() - 0.5) * s, y: (Math.random() - 0.5) * s };
  }
}
