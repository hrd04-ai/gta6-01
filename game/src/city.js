// Palmera Bay's city: a procedural sun-soaked grid of avenues and streets,
// pastel towers, palm-lined sidewalks, a marina to the south and a container
// harbor to the east. Everything is generated from the seed, so the same
// city loads for every player and every screenshot.

import * as THREE from 'three';
import { CONFIG, PLACES } from './config.js';
import { createRng, hash2, pick, range, int } from './random.js';

const LINES = CONFIG.world.lines;
const PITCH = CONFIG.world.blockPitch;
const ROAD = CONFIG.world.roadWidth;
const HALF = CONFIG.world.groundSize / 2;

// Block centres sit between road lines.
export function blockCenters() {
  const centers = [];
  for (let i = 0; i < LINES.length - 1; i++) {
    centers.push(LINES[i] + PITCH / 2);
  }
  return centers;
}

// ---------------------------------------------------------------------------
// Ground texture: one big canvas paints the whole city floor — asphalt roads
// with dashes and crosswalks, concrete sidewalks, grass and parking bays.
// ---------------------------------------------------------------------------
function paintGroundTexture(rng) {
  const S = 2048;
  const scale = S / CONFIG.world.groundSize; // px per metre
  const toPx = (v) => (v + HALF) * scale;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');

  // Base: sun-bleached concrete.
  g.fillStyle = '#b9a98f';
  g.fillRect(0, 0, S, S);

  // Block interiors: grass, plazas and parking lots.
  const centers = blockCenters();
  for (const cx of centers) {
    for (const cz of centers) {
      const h = hash2(cx, cz, 7);
      const x = toPx(cx - PITCH / 2 + 1), z = toPx(cz - PITCH / 2 + 1);
      const w = (PITCH - 2) * scale;
      if (h < 0.16) {
        g.fillStyle = '#7ba05b'; // pocket park
      } else if (h < 0.3) {
        g.fillStyle = '#8d8d84'; // parking lot
      } else {
        g.fillStyle = '#c2b49a'; // sidewalk slab
      }
      g.fillRect(x, z, w, w);
      if (h < 0.3 && h >= 0.16) {
        // Parking bays.
        g.strokeStyle = 'rgba(255,255,255,0.55)';
        g.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const bx = x + (w / 6) * i;
          g.beginPath();
          g.moveTo(bx, z + 6); g.lineTo(bx, z + w * 0.4);
          g.stroke();
        }
      }
      if (h < 0.16) {
        // Park paths.
        g.strokeStyle = '#c2b49a';
        g.lineWidth = 10;
        g.beginPath(); g.moveTo(x, z + w / 2); g.lineTo(x + w, z + w / 2); g.stroke();
        g.beginPath(); g.moveTo(x + w / 2, z); g.lineTo(x + w / 2, z + w); g.stroke();
      }
    }
  }

  // Roads: asphalt strips along every line.
  g.fillStyle = '#3d3a38';
  for (const line of LINES) {
    g.fillRect(0, toPx(line - ROAD / 2), S, ROAD * scale);
    g.fillRect(toPx(line - ROAD / 2), 0, ROAD * scale, S);
  }

  // Lane dashes and edge lines.
  g.fillStyle = '#e8c33c';
  for (const line of LINES) {
    for (let d = -HALF + 4; d < HALF - 4; d += 8) {
      g.fillRect(toPx(d), toPx(line) - 2, 4 * scale, 4);
      g.fillRect(toPx(line) - 2, toPx(d), 4, 4 * scale);
    }
  }
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 2;
  for (const line of LINES) {
    g.beginPath(); g.moveTo(0, toPx(line - ROAD / 2 + 0.6)); g.lineTo(S, toPx(line - ROAD / 2 + 0.6)); g.stroke();
    g.beginPath(); g.moveTo(0, toPx(line + ROAD / 2 - 0.6)); g.lineTo(S, toPx(line + ROAD / 2 - 0.6)); g.stroke();
    g.beginPath(); g.moveTo(toPx(line - ROAD / 2 + 0.6), 0); g.lineTo(toPx(line - ROAD / 2 + 0.6), S); g.stroke();
    g.beginPath(); g.moveTo(toPx(line + ROAD / 2 - 0.6), 0); g.lineTo(toPx(line + ROAD / 2 - 0.6), S); g.stroke();
  }

  // Crosswalks at every intersection.
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (const ax of LINES) {
    for (const az of LINES) {
      for (let i = -2; i <= 2; i++) {
        g.fillRect(toPx(ax + i * 1.8) - 3, toPx(az - ROAD / 2) + 2, 6, (ROAD - 1.5) * scale / 2 - 2);
        g.fillRect(toPx(ax + i * 1.8) - 3, toPx(az + 0.8), 6, (ROAD - 1.5) * scale / 2 - 2);
        g.fillRect(toPx(ax - ROAD / 2) + 2, toPx(az + i * 1.8) - 3, (ROAD - 1.5) * scale / 2 - 2, 6);
        g.fillRect(toPx(ax + 0.8), toPx(az + i * 1.8) - 3, (ROAD - 1.5) * scale / 2 - 2, 6);
      }
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// A facade texture: window grid on a pale wall. The material colour tints it.
function makeFacadeTexture(litRatio) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#e8e2d8';
  g.fillRect(0, 0, 128, 256);
  for (let y = 12; y < 248; y += 18) {
    for (let x = 10; x < 120; x += 18) {
      const lit = Math.random() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#3a4a5a';
      g.fillRect(x, y, 11, 13);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeBillboardTexture(lines, bg, fg) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = fg;
  g.font = 'bold 64px system-ui, sans-serif';
  g.textAlign = 'center';
  lines.forEach((line, i) => {
    g.fillText(line, 256, 100 + i * 72);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
function makePalm(rng) {
  const group = new THREE.Group();
  const h = range(rng, 4.5, 7);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.24, h, 6),
    new THREE.MeshStandardMaterial({ color: CONFIG.palette.palmTrunk, roughness: 1 }),
  );
  trunk.position.y = h / 2;
  trunk.rotation.z = range(rng, -0.08, 0.08);
  group.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: CONFIG.palette.palmLeaf, roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.9, h + 0.35, Math.sin(a) * 0.9);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    leaf.scale.set(1, 1, 0.28);
    group.add(leaf);
  }
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), leafMat);
  crown.position.y = h + 0.4;
  crown.scale.y = 0.7;
  group.add(crown);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

function makeLamp() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.4, 6), mat);
  pole.position.y = 3.2;
  group.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), mat);
  arm.position.set(0.7, 6.3, 0);
  group.add(arm);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc860, emissiveIntensity: 1.6 }),
  );
  head.position.set(1.4, 6.2, 0);
  group.add(head);
  return group;
}

// One intersection's signal: two faces, NS green while EW red, then swapped.
function makeTrafficLight() {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x222528, roughness: 0.6, metalness: 0.5 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 5.4, 6), poleMat);
  pole.position.y = 2.7;
  group.add(pole);
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.5 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.5), boxMat);
  box.position.y = 5.4;
  group.add(box);
  const mkLamp = (color, y) => {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 10),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15 }),
    );
    m.position.set(0, y, 0.26);
    group.add(m);
    return m.material;
  };
  const red = mkLamp(0xff2a22, 5.78);
  const amber = mkLamp(0xffb020, 5.4);
  const green = mkLamp(0x2aff66, 5.02);
  return { group, red, amber, green };
}

function makeWaterTower(rng) {
  const group = new THREE.Group();
  const legs = new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 5), legs);
    leg.position.set((i % 2 ? 0.7 : -0.7), 1.1, (i < 2 ? 0.7 : -0.7));
    group.add(leg);
  }
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.0, 1.8, 10),
    new THREE.MeshStandardMaterial({ color: 0x9a8a72, roughness: 0.9 }),
  );
  tank.position.y = 3.1;
  group.add(tank);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.05, 0.8, 10),
    new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 0.9 }),
  );
  roof.position.y = 4.4;
  group.add(roof);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------
function addBuilding(scene, colliders, facadeTex, cx, cz, w, d, h, color, glass = false) {
  const group = new THREE.Group();
  // Clone the facade per building: each tower repeats the window grid to
  // its own size, and the shared texture must never be mutated in place.
  const tex = glass ? null : facadeTex.clone();
  if (tex) {
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 22)));
  }
  const mat = new THREE.MeshStandardMaterial({
    color,
    map: tex,
    roughness: glass ? 0.15 : 0.85,
    metalness: glass ? 0.55 : 0.05,
  });
  if (glass) {
    mat.envMapIntensity = 0.8;
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4),
    new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 1 }),
  );
  roof.position.y = h + 0.25;
  group.add(roof);
  // Rooftop clutter: AC boxes and the odd water tower.
  const rng = createRng(Math.floor(cx * 13 + cz * 7 + h));
  const acCount = int(rng, 1, 3);
  for (let i = 0; i < acCount; i++) {
    const ac = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.7, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.9 }),
    );
    ac.position.set(range(rng, -w / 4, w / 4), h + 0.85, range(rng, -d / 4, d / 4));
    group.add(ac);
  }
  group.position.set(cx, 0, cz);
  scene.add(group);
  colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  return group;
}

// ---------------------------------------------------------------------------
// Road graph: intersections are nodes; every pair of neighbours is joined by
// two one-way edges, one per lane, so traffic never meets head-on.
// ---------------------------------------------------------------------------
function buildRoadGraph() {
  const nodes = [];
  const nodeId = (ix, iz) => `${ix},${iz}`;
  const edges = [];
  for (let ix = 0; ix < LINES.length; ix++) {
    for (let iz = 0; iz < LINES.length; iz++) {
      nodes.push({ id: nodeId(ix, iz), x: LINES[ix], z: LINES[iz], ix, iz });
    }
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const addEdge = (a, b, lane) => {
    edges.push({ from: a.id, to: b.id, ax: a.x, az: a.z, bx: b.x, bz: b.z, lane });
  };
  for (let ix = 0; ix < LINES.length; ix++) {
    for (let iz = 0; iz < LINES.length; iz++) {
      const n = byId.get(nodeId(ix, iz));
      if (ix + 1 < LINES.length) {
        const e = byId.get(nodeId(ix + 1, iz));
        addEdge(n, e, +2.8); // eastbound keeps right on the south side
        addEdge(e, n, -2.8);
      }
      if (iz + 1 < LINES.length) {
        const s = byId.get(nodeId(ix, iz + 1));
        addEdge(n, s, -2.8); // southbound keeps right on the west side
        addEdge(s, n, +2.8);
      }
    }
  }
  return { nodes, edges, byId };
}

// Circle (player, car, ped) vs building AABBs, pushed out to the nearest face.
export function resolveCircleVsBuildings(x, z, r, colliders) {
  let px = x, pz = z;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(px, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pz, c.maxZ));
    const dx = px - nx, dz = pz - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        px = nx + (dx / d) * r;
        pz = nz + (dz / d) * r;
      } else {
        // Centre inside the box: shove out along the smallest penetration.
        const pl = px - c.minX, pr = c.maxX - px, pt = pz - c.minZ, pb = c.maxZ - pz;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) px = c.minX - r;
        else if (m === pr) px = c.maxX + r;
        else if (m === pt) pz = c.minZ - r;
        else pz = c.maxZ + r;
      }
    }
  }
  return { x: px, z: pz };
}

export function pointInBuildings(x, z, colliders) {
  for (const c of colliders) {
    if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// The whole city, built once from the seed.
// ---------------------------------------------------------------------------
export function buildCity(scene, seed = CONFIG.seed) {
  const rng = createRng(seed);
  const colliders = [];
  const boats = [];
  const trafficLights = [];
  const facadeTex = makeFacadeTexture(0.35);
  const glassTex = makeFacadeTexture(0.55);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.world.groundSize, CONFIG.world.groundSize),
    new THREE.MeshStandardMaterial({ map: paintGroundTexture(rng), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // The bay: water, docks and moored boats along the south edge.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 130),
    new THREE.MeshStandardMaterial({ color: 0x2a7a9a, roughness: 0.2, metalness: 0.35 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.05, 158 + 65);
  scene.add(water);
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 1 });
  for (const dx of [-60, -20, 20, 60]) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 26), dockMat);
    dock.position.set(dx, 0.35, 168);
    dock.castShadow = true;
    scene.add(dock);
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.1, 9),
      new THREE.MeshStandardMaterial({ color: pick(rng, [0xe8e8e8, 0x3a6ea5, 0xc0392b]), roughness: 0.5 }),
    );
    hull.position.y = 0.4;
    boat.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.4, 3.4),
      new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.6 }),
    );
    cabin.position.set(0, 1.5, -0.8);
    boat.add(cabin);
    boat.position.set(dx + 4.5, 0.1, 176 + rng() * 18);
    boat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(boat);
    boats.push(boat);
  }

  // The harbor: concrete apron, container stacks and two gantry cranes.
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(110, 300),
    new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 1 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(158 + 55, 0.02, 0);
  apron.receiveShadow = true;
  scene.add(apron);
  const containerColors = [0xc0392b, 0x2980b9, 0x27ae60, 0xe67e22, 0x8e44ad];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      const stack = int(rng, 1, 3);
      for (let s = 0; s < stack; s++) {
        const c = new THREE.Mesh(
          new THREE.BoxGeometry(6, 2.6, 12),
          new THREE.MeshStandardMaterial({ color: pick(rng, containerColors), roughness: 0.8 }),
        );
        c.position.set(176 + col * 16, 1.3 + s * 2.6, -100 + row * 62 + range(rng, -4, 4));
        c.castShadow = true;
        scene.add(c);
        if (s === 0) {
          colliders.push({ minX: c.position.x - 3.2, maxX: c.position.x + 3.2, minZ: c.position.z - 6.2, maxZ: c.position.z + 6.2 });
        }
      }
    }
  }
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xe8a020, roughness: 0.6, metalness: 0.4 });
  for (const cz of [-60, 60]) {
    const crane = new THREE.Group();
    for (const [lx, lz] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 22, 1.2), craneMat);
      leg.position.set(lx, 11, lz);
      crane.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 3), craneMat);
    beam.position.set(0, 22.5, 0);
    crane.add(beam);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 9, 4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    cable.position.set(8, 18, 0);
    crane.add(cable);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 2), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    hook.position.set(8, 13, 0);
    crane.add(hook);
    crane.position.set(166, 0, cz);
    crane.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(crane);
    colliders.push({ minX: 158, maxX: 174, minZ: cz - 6, maxZ: cz + 6 });
  }

  // Landmark blocks, keyed by block centre.
  const landmarkAt = (cx, cz) => {
    if (cx === 23 && cz === -23) return 'bank';
    if (cx === -69 && cz === 69) return 'safehouse';
    if (cx === 69 && cz === 23) return 'garage';
    if (cx === -23 && cz === -69) return 'police';
    if (cx === 69 && cz === -69) return 'hospital';
    if (cx === 23 && cz === 23) return 'plaza';
    return null;
  };

  // Blocks: towers, parks and parking lots.
  const centers = blockCenters();
  const billboards = [
    { lines: ['PALMERA BAY', 'SUNSET HEAT'], bg: '#ff7a3d', fg: '#fff6e8' },
    { lines: ['SUNSET COLA', 'TASTE THE HEAT'], bg: '#1d6f8f', fg: '#ffe9a8' },
    { lines: ['CORAL QUARTER', 'EAT · DANCE · LIVE'], bg: '#7a3d8f', fg: '#ffffff' },
  ];
  let billboardIndex = 0;
  for (const cx of centers) {
    for (const cz of centers) {
      const kind = landmarkAt(cx, cz);
      const h = hash2(cx, cz, 7);
      if (kind === 'plaza') {
        // Sunset Plaza: open park with palms, benches and a fountain ring.
        const fountain = new THREE.Mesh(
          new THREE.CylinderGeometry(5, 5.4, 0.9, 16),
          new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.9 }),
        );
        fountain.position.set(cx, 0.45, cz);
        fountain.castShadow = true;
        scene.add(fountain);
        const waterDisc = new THREE.Mesh(
          new THREE.CylinderGeometry(4.4, 4.4, 0.2, 16),
          new THREE.MeshStandardMaterial({ color: 0x3a9ab8, roughness: 0.15, metalness: 0.3 }),
        );
        waterDisc.position.set(cx, 0.85, cz);
        scene.add(waterDisc);
        colliders.push({ minX: cx - 5.4, maxX: cx + 5.4, minZ: cz - 5.4, maxZ: cz + 5.4 });
        for (let i = 0; i < 8; i++) {
          const palm = makePalm(rng);
          const a = (i / 8) * Math.PI * 2;
          palm.position.set(cx + Math.cos(a) * 13, 0, cz + Math.sin(a) * 13);
          scene.add(palm);
        }
        continue;
      }
      if (kind === 'bank') {
        const tower = addBuilding(scene, colliders, glassTex, cx, cz, 24, 24, 58, pick(rng, CONFIG.palette.glass), true);
        tower.children[0].material.map = null;
        const sign = new THREE.Mesh(
          new THREE.BoxGeometry(16, 3, 0.6),
          new THREE.MeshStandardMaterial({ color: 0x1d3a5f, emissive: 0x2a6ea5, emissiveIntensity: 0.7 }),
        );
        sign.position.set(cx, 52, cz - 12.4);
        scene.add(sign);
        continue;
      }
      if (kind === 'safehouse') {
        addBuilding(scene, colliders, facadeTex, cx, cz, 16, 12, 7, 0xe8b48f);
        const porch = new THREE.Mesh(
          new THREE.BoxGeometry(6, 0.4, 4),
          new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 1 }),
        );
        porch.position.set(cx, 0.2, cz - 8);
        scene.add(porch);
        continue;
      }
      if (kind === 'garage') {
        const g = addBuilding(scene, colliders, facadeTex, cx, cz, 22, 14, 8, 0xd95f3d);
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(18, 3),
          new THREE.MeshStandardMaterial({ map: makeBillboardTexture(['SPRAY & SAVE', 'REPAIR · RESPRAY'], '#d95f3d', '#fff6e8'), emissive: 0xffffff, emissiveIntensity: 0.25 }),
        );
        sign.position.set(cx, 6.5, cz - 7.3);
        scene.add(sign);
        continue;
      }
      if (kind === 'police') {
        addBuilding(scene, colliders, facadeTex, cx, cz, 20, 16, 12, 0x5a7a94);
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(12, 2.4),
          new THREE.MeshStandardMaterial({ map: makeBillboardTexture(['PBPD', 'PALMERA BAY POLICE'], '#1d3a5f', '#ffffff'), emissive: 0xffffff, emissiveIntensity: 0.25 }),
        );
        sign.position.set(cx, 9, cz - 8.3);
        scene.add(sign);
        continue;
      }
      if (kind === 'hospital') {
        addBuilding(scene, colliders, facadeTex, cx, cz, 22, 16, 16, 0xf0ead8);
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(10, 2.4),
          new THREE.MeshStandardMaterial({ map: makeBillboardTexture(['ST. CORAL', 'HOSPITAL'], '#e8e8e8', '#c0392b'), emissive: 0xffffff, emissiveIntensity: 0.25 }),
        );
        sign.position.set(cx, 11, cz - 8.3);
        scene.add(sign);
        continue;
      }
      if (h < 0.16) {
        // Pocket park.
        for (let i = 0; i < 6; i++) {
          const palm = makePalm(rng);
          palm.position.set(cx + range(rng, -13, 13), 0, cz + range(rng, -13, 13));
          scene.add(palm);
        }
        const bench = new THREE.Mesh(
          new THREE.BoxGeometry(3, 0.5, 1),
          new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 1 }),
        );
        bench.position.set(cx, 0.5, cz);
        scene.add(bench);
        continue;
      }
      if (h < 0.3) {
        // Open parking lot: a few parked cars live here (spawned by vehicles).
        continue;
      }
      // Ordinary towers: one or two per block, taller near the centre.
      const distCenter = Math.abs(cx) + Math.abs(cz);
      const maxH = distCenter < 60 ? 52 : distCenter < 120 ? 34 : 20;
      const count = hash2(cx, cz, 11) < 0.45 ? 2 : 1;
      for (let b = 0; b < count; b++) {
        const w = range(rng, 13, 24);
        const d = range(rng, 13, 24);
        const ox = count === 2 ? (b === 0 ? -8 : 8) : 0;
        const oz = count === 2 ? (b === 0 ? -8 : 8) : 0;
        const height = range(rng, 9, maxH);
        const g = addBuilding(
          scene, colliders, facadeTex, cx + ox, cz + oz, w, d, height,
          pick(rng, CONFIG.palette.building),
        );
        if (billboardIndex < billboards.length && height > 26 && hash2(cx, cz, 23) < 0.5) {
          const bb = billboards[billboardIndex++];
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(16, 8),
            new THREE.MeshStandardMaterial({ map: makeBillboardTexture(bb.lines, bb.bg, bb.fg), emissive: 0xffffff, emissiveIntensity: 0.3 }),
          );
          sign.position.set(cx + ox, height - 4, cz + oz - d / 2 - 0.4);
          sign.rotation.y = Math.PI;
          scene.add(sign);
        }
        if (hash2(cx, cz, 31) < 0.3) {
          const tower = makeWaterTower(rng);
          tower.position.set(cx + ox + w / 4, height + 0.5, cz + oz - d / 4);
          scene.add(tower);
        }
      }
    }
  }

  // Palms and lamps along the sidewalks.
  for (const line of LINES) {
    for (let d = -HALF + 12; d < HALF - 8; d += 23) {
      if (Math.abs(d % PITCH) < 8) continue; // keep intersections clear
      const palm = makePalm(rng);
      palm.position.set(line + 8.2, 0, d);
      scene.add(palm);
      const palm2 = makePalm(rng);
      palm2.position.set(d, 0, line + 8.2);
      scene.add(palm2);
    }
  }
  for (const ax of LINES) {
    for (const az of LINES) {
      const lamp = makeLamp();
      lamp.position.set(ax + 7.4, 0, az + 7.4);
      lamp.rotation.y = Math.PI / 4;
      scene.add(lamp);
      const tl = makeTrafficLight();
      tl.group.position.set(ax - 7.2, 0, az - 7.2);
      tl.group.rotation.y = Math.PI / 4;
      scene.add(tl);
      trafficLights.push({ ...tl, x: ax, z: az });
    }
  }

  // Traffic lights cycle: NS green for 12 s, then EW green for 12 s.
  let lightPhase = 0;
  const updateTrafficLights = (t) => {
    const phase = trafficPhase(t);
    if (phase === lightPhase) return;
    lightPhase = phase;
    for (const tl of trafficLights) {
      const nsGreen = phase === 0;
      tl.green.emissiveIntensity = nsGreen ? 2.2 : 0.15;
      tl.red.emissiveIntensity = nsGreen ? 0.15 : 2.2;
      tl.amber.emissiveIntensity = 0.15;
    }
  };

  return {
    colliders,
    boats,
    trafficLights,
    updateTrafficLights,
    roadGraph: buildRoadGraph(),
    trafficPhase,
  };
}

// 0 = north-south green, 1 = east-west green. Shared by the city lights
// and the traffic AI so both read the same cycle.
export function trafficPhase(t) {
  return Math.floor(t / 12) % 2;
}
