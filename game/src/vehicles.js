// Cars of Palmera Bay: box-built models in sunset colours, civilian traffic
// that follows the road graph and stops at red lights, parked cars waiting
// to be stolen, and the player's arcade driving physics.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRng, pick, range, int, clamp, angleDiff } from './random.js';
import { resolveCircleVsBuildings, trafficPhase } from './city.js';

// ---------------------------------------------------------------------------
// Car models. Built from boxes and cylinders, facing +z, so a group's
// rotation.y is its heading and forward is (sin h, 0, cos h).
// ---------------------------------------------------------------------------
export function createCarModel(kind, color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2733, roughness: 0.1, metalness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.8 });

  const dims = kind === 'truck'
    ? { bodyW: 2.3, bodyL: 6.2, bodyH: 1.5, cabinL: 2.0, cabinH: 1.1, y: 0.95 }
    : kind === 'sports'
      ? { bodyW: 2.0, bodyL: 4.5, bodyH: 0.55, cabinL: 1.9, cabinH: 0.5, y: 0.55 }
      : { bodyW: 2.0, bodyL: 4.4, bodyH: 0.75, cabinL: 2.2, cabinH: 0.62, y: 0.75 };

  const body = new THREE.Mesh(new THREE.BoxGeometry(dims.bodyW, dims.bodyH, dims.bodyL), paint);
  body.position.y = dims.y;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(dims.bodyW - 0.25, dims.cabinH, dims.cabinL), glassMat);
  cabin.position.set(0, dims.y + dims.bodyH / 2 + dims.cabinH / 2 - 0.05, kind === 'truck' ? 1.6 : -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  // Bumpers and trim.
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(dims.bodyW, 0.22, 0.3), darkMat);
  bumperF.position.set(0, dims.y - 0.15, dims.bodyL / 2);
  group.add(bumperF);
  const bumperR = bumperF.clone();
  bumperR.position.z = -dims.bodyL / 2;
  group.add(bumperR);

  // Headlights (warm) and taillights (red), emissive so they read at dusk.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf80, emissiveIntensity: 1.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xdd2222, emissiveIntensity: 1.2 });
  for (const sx of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), headMat);
    head.position.set(sx * (dims.bodyW / 2 - 0.32), dims.y + 0.08, dims.bodyL / 2 + 0.02);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08), tailMat);
    tail.position.set(sx * (dims.bodyW / 2 - 0.32), dims.y + 0.08, -dims.bodyL / 2 - 0.02);
    group.add(tail);
  }

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.32, 8);
  hubGeo.rotateZ(Math.PI / 2);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.4, metalness: 0.7 });
  const wheels = [];
  for (const [wx, wz] of [
    [-dims.bodyW / 2, dims.bodyL / 2 - 0.9], [dims.bodyW / 2, dims.bodyL / 2 - 0.9],
    [-dims.bodyW / 2, -dims.bodyL / 2 + 0.9], [dims.bodyW / 2, -dims.bodyL / 2 + 0.9],
  ]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, 0.38, wz);
    wheel.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.position.copy(wheel.position);
    group.add(wheel);
    group.add(hub);
    wheels.push(wheel, hub);
  }

  let lightbar = null;
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.28, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xf1c40f, emissive: 0xa8820a, emissiveIntensity: 0.8 }),
    );
    sign.position.set(0, dims.y + dims.bodyH / 2 + dims.cabinH + 0.1, -0.2);
    group.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), darkMat);
    bar.position.set(0, dims.y + dims.bodyH / 2 + dims.cabinH + 0.05, -0.2);
    group.add(bar);
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x2255ff, emissive: 0x2255ff, emissiveIntensity: 2 });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.42), redMat);
    red.position.set(-0.28, dims.y + dims.bodyH / 2 + dims.cabinH + 0.16, -0.2);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.42), blueMat);
    blue.position.set(0.28, dims.y + dims.bodyH / 2 + dims.cabinH + 0.16, -0.2);
    group.add(red, blue);
    lightbar = { red: redMat, blue: blueMat, phase: 0 };
  }
  if (kind === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4), darkMat);
    spoiler.position.set(0, dims.y + 0.45, -dims.bodyL / 2 + 0.2);
    group.add(spoiler);
  }

  return { group, wheels, lightbar, kind, color };
}

// ---------------------------------------------------------------------------
// Civilian traffic: cars that pick an edge of the road graph, drive it,
// obey the lights, queue behind the car ahead, and pick a new edge at the
// far intersection. Parked cars line the roads for the player to steal.
// ---------------------------------------------------------------------------
export class TrafficSystem {
  constructor(scene, city, seed = CONFIG.seed) {
    this.scene = scene;
    this.city = city;
    this.rng = createRng(seed + 101);
    this.cars = [];
    this.parked = [];
    this.time = 0;
    this.spawnParkedCars();
    this.spawnTraffic();
  }

  edgeEndpoints(edge) {
    // Lane offset: +2.8 m on one side of the road, -2.8 on the other.
    const alongX = Math.abs(edge.bx - edge.ax) > 0.1;
    if (alongX) {
      return { ax: edge.ax, az: edge.az + edge.lane, bx: edge.bx, bz: edge.bz + edge.lane };
    }
    return { ax: edge.ax + edge.lane, az: edge.az, bx: edge.bx + edge.lane, bz: edge.bz };
  }

  pickEdge(fromNodeId = null) {
    const pool = fromNodeId
      ? this.city.roadGraph.edges.filter((e) => e.from === fromNodeId)
      : this.city.roadGraph.edges;
    return pick(this.rng, pool);
  }

  spawnTraffic() {
    for (let i = 0; i < CONFIG.traffic.count; i++) {
      const kind = pick(this.rng, ['sedan', 'sedan', 'sedan', 'taxi', 'truck', 'sports']);
      const color = kind === 'taxi' ? 0xf1c40f : pick(this.rng, CONFIG.palette.car);
      const model = createCarModel(kind, color);
      const edge = this.pickEdge();
      const pts = this.edgeEndpoints(edge);
      const len = Math.hypot(pts.bx - pts.ax, pts.bz - pts.az);
      const car = {
        model,
        edge,
        dist: range(this.rng, 0, len),
        len,
        speed: range(this.rng, CONFIG.traffic.speedMin, CONFIG.traffic.speedMax),
        cruise: range(this.rng, CONFIG.traffic.speedMin, CONFIG.traffic.speedMax),
        x: pts.ax, z: pts.az,
        heading: Math.atan2(pts.bx - pts.ax, pts.bz - pts.az),
      };
      model.group.position.set(car.x, 0, car.z);
      model.group.rotation.y = car.heading;
      this.scene.add(model.group);
      this.cars.push(car);
    }
  }

  spawnParkedCars() {
    // Parked along avenue x=0 and street z=-46, both sides, clear of corners.
    const spots = [];
    for (const z of [-120, -70, -20, 30, 80, 120]) spots.push({ x: 4.6, z, heading: 0 });
    for (const z of [-100, -60, 10, 60, 110]) spots.push({ x: -4.6, z, heading: Math.PI });
    for (const x of [-120, -70, 60, 110]) spots.push({ x, z: -41.4, heading: Math.PI / 2 });
    for (const x of [-100, -30, 30, 100]) spots.push({ x, z: -50.6, heading: -Math.PI / 2 });
    for (const s of spots) {
      const kind = pick(this.rng, ['sedan', 'sedan', 'sports', 'truck']);
      const color = pick(this.rng, CONFIG.palette.car);
      const model = createCarModel(kind, color);
      model.group.position.set(s.x, 0, s.z);
      model.group.rotation.y = s.heading;
      this.scene.add(model.group);
      this.parked.push({ model, x: s.x, z: s.z, heading: s.heading, kind, color, taken: false });
    }
  }

  nearestParked(x, z, maxDist) {
    let best = null, bestD = maxDist;
    for (const p of this.parked) {
      if (p.taken) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) { best = p; bestD = d; }
    }
    return best;
  }

  nearestTrafficCar(x, z, maxDist) {
    let best = null, bestD = maxDist;
    for (const c of this.cars) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  update(dt, ctx) {
    this.time += dt;
    const phase = trafficPhase(this.time);
    for (const car of this.cars) {
      const pts = this.edgeEndpoints(car.edge);
      const alongX = Math.abs(car.edge.bx - car.edge.ax) > 0.1;
      const remaining = car.len - car.dist;
      let target = car.cruise;

      // Red light at the far intersection: stop before it.
      const lightGreen = alongX ? phase === 1 : phase === 0;
      if (!lightGreen && remaining < CONFIG.traffic.lightStopDistance + car.speed * 0.6) {
        target = 0;
      }
      // Queue behind the car ahead on the same edge.
      for (const other of this.cars) {
        if (other === car || other.edge !== car.edge) continue;
        const gap = other.dist - car.dist;
        if (gap > 0 && gap < CONFIG.traffic.followGap) target = 0;
      }
      // The player's car ahead blocks the lane too.
      if (ctx.playerCar && ctx.playerCar.active) {
        const dx = ctx.playerCar.x - car.x, dz = ctx.playerCar.z - car.z;
        const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
        const ahead = dx * fx + dz * fz;
        const side = Math.abs(dx * fz - dz * fx);
        if (ahead > 0 && ahead < 10 && side < 3) target = 0;
      }

      car.speed += clamp(target - car.speed, -14 * dt, 8 * dt);
      if (car.speed < 0.05 && target === 0) car.speed = 0;
      car.dist += car.speed * dt;
      if (car.dist >= car.len) {
        // Reached the intersection: pick a new edge, never a U-turn if avoidable.
        const nodeId = car.edge.to;
        const outs = this.city.roadGraph.edges.filter((e) => e.from === nodeId);
        const forward = outs.filter((e) => !(Math.abs(e.bx - car.edge.ax) < 0.1 && Math.abs(e.bz - car.edge.az) < 0.1));
        car.edge = pick(this.rng, forward.length ? forward : outs);
        const p2 = this.edgeEndpoints(car.edge);
        car.len = Math.hypot(p2.bx - p2.ax, p2.bz - p2.az);
        car.dist = 0;
        car.heading = Math.atan2(p2.bx - p2.ax, p2.bz - p2.az);
      }
      const p = this.edgeEndpoints(car.edge);
      const t = clamp(car.dist / car.len, 0, 1);
      car.x = p.ax + (p.bx - p.ax) * t;
      car.z = p.az + (p.bz - p.az) * t;
      car.model.group.position.set(car.x, 0, car.z);
      car.model.group.rotation.y = car.heading;
      for (const w of car.model.wheels) w.rotation.x += car.speed * dt * 2.6;
    }
  }
}

// ---------------------------------------------------------------------------
// The player's car: arcade physics — accelerate, brake, reverse, handbrake
// slides — with building, traffic and pedestrian collisions.
// ---------------------------------------------------------------------------
export class PlayerCar {
  // Wraps a car model the player is driving. The model is swapped when
  // Rico steals a different car, so the car he drives always looks like
  // the one he took.
  constructor(scene, model) {
    this.scene = scene;
    this.model = model;
    scene.add(this.model.group);
    this.active = false; // the player is driving it
    this.x = 0; this.z = 0;
    this.heading = 0;
    this.speed = 0;
    this.hp = CONFIG.car.health;
    this.steer = 0;
    this.smokeTimer = 0;
    this.kind = model.kind;
    this.color = model.color;
  }

  place(x, z, heading) {
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0;
    this.model.group.position.set(x, 0, z);
    this.model.group.rotation.y = heading;
  }

  get speedKmh() {
    return Math.abs(this.speed) * 3.6;
  }

  update(dt, input, world) {
    if (!this.active) return;
    const cfg = CONFIG.car;
    const fwd = input.forward ? 1 : 0;
    const back = input.back ? 1 : 0;
    const handbrake = input.handbrake ? 1 : 0;

    // Longitudinal.
    if (fwd) this.speed += cfg.accel * dt;
    if (back) {
      if (this.speed > 0.5) this.speed -= cfg.brake * dt;
      else this.speed -= cfg.reverseAccel * dt;
    }
    if (!fwd && !back) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 6 * dt);
    this.speed -= this.speed * cfg.drag * dt;
    this.speed = clamp(this.speed, -cfg.maxReverse, cfg.maxSpeed);

    // Steering: sharper at low speed, looser at high speed, drifty on brake.
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 10);
    const steerAuthority = clamp(Math.abs(this.speed) / 8, 0, 1) * (handbrake ? 1.5 : 1);
    const turn = this.steer * cfg.steerMax * steerAuthority * (this.speed >= 0 ? 1 : -1);
    this.heading += turn * dt * (handbrake ? 1.6 : 1.0);
    if (handbrake) this.speed -= this.speed * 1.4 * dt;

    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    let nx = this.x + fx * this.speed * dt;
    let nz = this.z + fz * this.speed * dt;

    // Buildings: slide along walls, lose speed and health on a hard hit.
    const before = { x: nx, z: nz };
    const resolved = resolveCircleVsBuildings(nx, nz, cfg.radius, world.colliders);
    nx = resolved.x; nz = resolved.z;
    if (Math.abs(before.x - nx) > 0.01 || Math.abs(before.z - nz) > 0.01) {
      if (Math.abs(this.speed) > 9) {
        this.hp -= Math.abs(this.speed) * 0.55;
        world.onCrash?.(Math.abs(this.speed));
      }
      this.speed *= 0.55;
    }

    // World bounds: the bay to the south, the harbor to the east.
    nx = clamp(nx, -172, 156);
    nz = clamp(nz, -172, 156);
    if (Math.abs(nx) > 155 || Math.abs(nz) > 155) this.speed *= 0.9;

    // Traffic cars: shove both apart, both take damage.
    for (const car of world.traffic.cars) {
      const dx = nx - car.x, dz = nz - car.z;
      const d = Math.hypot(dx, dz);
      if (d < 4.4 && d > 0.01) {
        const push = (4.4 - d) / 2;
        nx += (dx / d) * push;
        nz += (dz / d) * push;
        if (Math.abs(this.speed) > 6) {
          this.hp -= 4;
          world.onCrash?.(Math.abs(this.speed) * 0.6);
          this.speed *= 0.7;
        }
      }
    }

    // Pedestrians: a hit sends them sprawling and draws heat.
    for (const ped of world.peds.list) {
      if (ped.fallen) continue;
      const dx = nx - ped.x, dz = nz - ped.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.4 && Math.abs(this.speed) > 2) {
        world.peds.fall(ped, dx / (d || 1), dz / (d || 1), this.speed);
        world.onPedHit?.(ped);
        this.speed *= 0.85;
      }
    }

    this.x = nx; this.z = nz;
    this.model.group.position.set(this.x, 0, this.z);
    this.model.group.rotation.y = this.heading;
    // Body roll and wheel spin sell the speed.
    this.model.group.rotation.z = -this.steer * 0.05 * clamp(Math.abs(this.speed) / 12, 0, 1);
    for (const w of this.model.wheels) w.rotation.x += this.speed * dt * 2.6;

    // Tire smoke when the handbrake slides the car.
    this.smokeTimer -= dt;
    if (handbrake && Math.abs(this.speed) > 8 && this.smokeTimer <= 0) {
      this.smokeTimer = 0.08;
      world.onTireSmoke?.(this.x - fx * 1.8, this.z - fz * 1.8);
    }
  }
}
