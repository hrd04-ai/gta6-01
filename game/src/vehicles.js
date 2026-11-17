// Cars: mesh factory, arcade driving physics, traffic that obeys lights and
// queues, and the parked cars Rico can steal. Collisions are circle vs AABB.
import * as THREE from 'three';
import { CFG, CAR_COLORS } from './config.js';
import { makeRng } from './random.js';

export function circleHitsBox(x, z, r, box) {
  const cx = Math.max(box.minX, Math.min(x, box.maxX));
  const cz = Math.max(box.minZ, Math.min(z, box.maxZ));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

export function collideWorld(x, z, r, colliders) {
  for (const b of colliders) if (circleHitsBox(x, z, r, b)) return b;
  return null;
}

export function makeCarMesh(color, police = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: police ? 0xf2f2f2 : color, roughness: 0.35, metalness: 0.55,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.85, 2.0), bodyMat);
  body.position.y = 0.75;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.75, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.15, metalness: 0.7 }),
  );
  cabin.position.set(-0.2, 1.5, 0);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[1.5, 0.95], [1.5, -0.95], [-1.5, 0.95], [-1.5, -0.95]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffedb0, emissiveIntensity: 0.9 });
  for (const wz of [0.6, -0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.4), lightMat);
    lamp.position.set(2.22, 0.8, wz);
    group.add(lamp);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xcc2222, emissiveIntensity: 0.7 });
  for (const wz of [0.6, -0.6]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.4), tailMat);
    tail.position.set(-2.22, 0.8, wz);
    group.add(tail);
  }
  if (police) {
    const barMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 1.5), barMat);
    bar.position.set(-0.2, 2.05, 0);
    group.add(bar);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.3, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2222, emissiveIntensity: 1.6 }),
    );
    red.position.set(-0.2, 2.05, 0.42);
    group.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.3, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x000033, emissive: 0x2244ff, emissiveIntensity: 1.6 }),
    );
    blue.position.set(-0.2, 2.05, -0.42);
    group.add(blue);
    group.userData.barRed = red;
    group.userData.barBlue = blue;
  }
  group.userData.wheels = wheels;
  return group;
}

function randomRoadPoint(rng) {
  const road = (Math.floor(rng.next() * 7) - 3) * CFG.roadSpacing;
  const along = rng.range(-140, 140);
  if (rng.chance(0.5)) return { x: road, z: along, axis: 'ns' };
  return { x: along, z: road, axis: 'ew' };
}

export class TrafficSystem {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    for (let i = 0; i < CFG.trafficCount; i++) {
      const p = randomRoadPoint(rng);
      const color = CAR_COLORS[Math.floor(rng.next() * CAR_COLORS.length)];
      const mesh = makeCarMesh(color);
      scene.add(mesh);
      const heading = p.axis === 'ns' ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
      const car = {
        mesh, pos: new THREE.Vector3(p.x, 0, p.z), heading,
        speed: rng.range(7, 11), targetSpeed: rng.range(7, 11),
        axis: p.axis, color, kind: 'traffic',
      };
      this.cars.push(car);
      this.placeCar(car);
    }
  }

  placeCar(car) {
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = -car.heading + Math.PI / 2;
    for (const w of car.mesh.userData.wheels) w.rotation.z += car.speed * 0.016;
  }

  // Next intersection ahead on this car's road.
  nextLight(car) {
    const dir = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    for (let d = 4; d <= 16; d += 4) {
      const x = car.pos.x + dir.x * d;
      const z = car.pos.z + dir.z * d;
      for (const l of this.city.lights) {
        if (Math.abs(x - l.x) < 9 && Math.abs(z - l.z) < 9) return { dist: d, light: l };
      }
    }
    return null;
  }

  update(dt) {
    for (const car of this.cars) {
      let want = car.targetSpeed;
      // Red light ahead: stop before the intersection.
      const ahead = this.nextLight(car);
      if (ahead && this.city.lightStateAt(ahead.light.x, ahead.light.z, car.axis) === 'red' && ahead.dist < 12) {
        want = 0;
      }
      // Queue behind a slower car ahead.
      const dir = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.pos.x - car.pos.x;
        const dz = other.pos.z - car.pos.z;
        const along = dx * dir.x + dz * dir.z;
        const side = Math.abs(dx * -dir.z + dz * dir.x);
        if (along > 0 && along < 9 && side < 3) { want = Math.min(want, other.speed * 0.85); break; }
      }
      car.speed += (want - car.speed) * Math.min(1, dt * 1.6);
      car.pos.x += Math.cos(car.heading) * car.speed * dt;
      car.pos.z += -Math.sin(car.heading) * car.speed * dt;
      // Reached the edge: turn onto a cross road, keep flowing.
      if (Math.abs(car.pos.x) > 150 || Math.abs(car.pos.z) > 150) {
        const atEdgeX = Math.abs(car.pos.x) > 150;
        car.pos.x = THREE.MathUtils.clamp(car.pos.x, -148, 148);
        car.pos.z = THREE.MathUtils.clamp(car.pos.z, -148, 148);
        const turn = this.rng.chance(0.5) ? 1 : -1;
        car.heading += turn * Math.PI / 2;
        car.axis = atEdgeX ? 'ew' : 'ns';
      }
      // Occasionally turn at an intersection for variety.
      if (this.rng.chance(dt * 0.05)) {
        const nearRoad = (Math.abs(car.pos.x) % CFG.roadSpacing) < 3 || (Math.abs(car.pos.z) % CFG.roadSpacing) < 3;
        if (nearRoad && this.rng.chance(0.5)) {
          car.heading += (this.rng.chance(0.5) ? 1 : -1) * Math.PI / 2;
          car.axis = car.axis === 'ns' ? 'ew' : 'ns';
        }
      }
      this.placeCar(car);
    }
  }
}

export class ParkedCars {
  constructor(scene, rng) {
    this.scene = scene;
    this.cars = [];
    const spots = [];
    for (let k = -3; k <= 3; k++) {
      for (const s of [-120, -76, -32, 32, 76, 120]) {
        if (rng.chance(0.5)) spots.push({ x: k * CFG.roadSpacing + 9.8, z: s, heading: 0 });
        else spots.push({ x: s, z: k * CFG.roadSpacing + 9.8, heading: Math.PI / 2 });
      }
    }
    for (let i = 0; i < CFG.parkedCount && spots.length; i++) {
      const spot = spots.splice(Math.floor(rng.next() * spots.length), 1)[0];
      const color = CAR_COLORS[Math.floor(rng.next() * CAR_COLORS.length)];
      const mesh = makeCarMesh(color);
      mesh.position.set(spot.x, 0, spot.z);
      mesh.rotation.y = -spot.heading + Math.PI / 2;
      scene.add(mesh);
      this.cars.push({
        mesh, pos: new THREE.Vector3(spot.x, 0, spot.z), heading: spot.heading,
        speed: 0, hp: 100, color, kind: 'parked', taken: false,
      });
    }
  }

  nearest(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.cars) {
      if (car.taken) continue;
      const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }
}

// Arcade driving for the car Rico is in. Returns events for sound/effects.
export function drivePlayerCar(car, input, dt, colliders, effects, audio) {
  const events = { hit: false, hard: false };
  const forward = (input.up ? 1 : 0) - (input.down ? 0.55 : 0);
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const speed01 = Math.min(1, Math.abs(car.speed) / CFG.carTopSpeed);
  // Steering only bites while moving; handbrake slides.
  const grip = input.handbrake ? 0.35 : 1;
  car.heading += steer * CFG.carTurn * grip * dt * Math.sign(car.speed || 1) * Math.min(1, Math.abs(car.speed) / 8 + 0.25);
  if (forward > 0) car.speed += CFG.carAccel * dt * (1 - speed01 * 0.7);
  else if (forward < 0) car.speed -= (car.speed > 0.5 ? CFG.carBrake : CFG.carAccel * 0.5) * dt;
  else car.speed -= car.speed * 1.4 * dt;
  car.speed = THREE.MathUtils.clamp(car.speed, -CFG.carReverseSpeed, CFG.carTopSpeed);
  const nx = car.pos.x + Math.cos(car.heading) * car.speed * dt;
  const nz = car.pos.z + -Math.sin(car.heading) * car.speed * dt;
  // World bounds: bay and harbor edges block the car.
  const bx = THREE.MathUtils.clamp(nx, -CFG.worldHalf, CFG.harborEdge - 4);
  const bz = THREE.MathUtils.clamp(nz, -CFG.worldHalf, CFG.bayEdge - 4);
  const hitBox = collideWorld(bx, bz, 2.1, colliders);
  if (hitBox) {
    const impact = Math.abs(car.speed);
    car.speed *= -0.25;
    car.hp -= impact * 1.6;
    events.hit = true;
    if (impact > 12) { events.hard = true; effects.addShake(0.5); }
    // Slide along the box instead of sticking.
    if (Math.abs(bx - car.pos.x) > Math.abs(bz - car.pos.z)) car.pos.z = bz;
    else car.pos.x = bx;
  } else {
    car.pos.x = bx;
    car.pos.z = bz;
  }
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = -car.heading + Math.PI / 2;
  car.mesh.rotation.z = steer * Math.min(0.06, Math.abs(car.speed) * 0.002) * (car.speed >= 0 ? 1 : -1);
  for (const w of car.mesh.userData.wheels) w.rotation.z += car.speed * dt * 0.8;
  if (input.handbrake && Math.abs(car.speed) > 10) {
    effects.skid(car.pos.x - Math.cos(car.heading) * 1.5, car.pos.z + Math.sin(car.heading) * 1.5, car.heading);
    if (Math.random() < dt * 20) effects.smoke(car.pos, 1);
  }
  if (car.hp < 35 && Math.random() < dt * 6) effects.smoke(new THREE.Vector3(car.pos.x, 1.4, car.pos.z), 1);
  audio.setEngine(Math.min(1, Math.abs(car.speed) / CFG.carTopSpeed), true);
  return events;
}
