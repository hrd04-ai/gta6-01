// Palmera Bay itself: ground, roads, ~360 procedural buildings, palms, lamps,
// billboards, the southern bay with docks and boats, the eastern container
// harbor, six landmarks and four working traffic lights. All geometry is
// generated from one seeded rng so the city is identical every run.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng } from './random.js';

function facadeTexture(rng, litRatio) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const base = ['#d8c8b0', '#cbb89e', '#c2b094', '#d2c2a8', '#c0b098'][Math.floor(rng.next() * 5)];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  // Window grid, some lit warm for the sunset hour.
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 5; col++) {
      const x = 10 + col * 23;
      const y = 12 + row * 24;
      const lit = rng.next() < litRatio;
      ctx.fillStyle = lit ? '#ffd98a' : '#2e3a4a';
      ctx.fillRect(x, y, 14, 15);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x, y, 14, 3);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function groundTexture() {
  const S = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  const world = CFG.worldHalf * 2;
  const toPx = (v) => ((v + CFG.worldHalf) / world) * S;
  // Base: warm sand/asphalt mix.
  ctx.fillStyle = '#b59a72';
  ctx.fillRect(0, 0, S, S);
  // City blocks: pale pavement.
  ctx.fillStyle = '#cbb795';
  const roadHalfPx = (CFG.roadHalf / world) * S;
  const spacingPx = (CFG.roadSpacing / world) * S;
  for (let i = 0; i < CFG.roadCount; i++) {
    for (let j = 0; j < CFG.roadCount; j++) {
      const cx = toPx((i - 3) * CFG.roadSpacing);
      const cz = toPx((j - 3) * CFG.roadSpacing);
      ctx.fillRect(cx - spacingPx / 2 + roadHalfPx, cz - spacingPx / 2 + roadHalfPx, spacingPx - roadHalfPx * 2, spacingPx - roadHalfPx * 2);
    }
  }
  // Roads: dark strips both ways.
  ctx.fillStyle = '#3d3a38';
  for (let k = -3; k <= 3; k++) {
    const c = toPx(k * CFG.roadSpacing);
    ctx.fillRect(0, c - roadHalfPx, S, roadHalfPx * 2);
    ctx.fillRect(c - roadHalfPx, 0, roadHalfPx * 2, S);
  }
  // Lane dashes.
  ctx.fillStyle = '#e8d24a';
  for (let k = -3; k <= 3; k++) {
    const c = toPx(k * CFG.roadSpacing);
    for (let d = 8; d < S; d += 34) {
      ctx.fillRect(d, c - 1.5, 16, 3);
      ctx.fillRect(c - 1.5, d, 3, 16);
    }
  }
  // Beach strip along the bay (south edge, +z).
  ctx.fillStyle = '#e3cd9a';
  ctx.fillRect(0, toPx(CFG.bayEdge - 14), S, S - toPx(CFG.bayEdge - 14));
  // Harbor concrete (east edge, +x).
  ctx.fillStyle = '#8f8a80';
  ctx.fillRect(toPx(CFG.harborEdge - 12), 0, S - toPx(CFG.harborEdge - 12), toPx(CFG.bayEdge));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function billboardTexture(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = fg;
  ctx.font = 'bold 44px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 52);
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText('PALMERA BAY', 128, 100);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene) {
  const rng = makeRng(CFG.shotSeed * 101 + 13);
  const colliders = [];
  const lights = [];
  const landmarks = {};

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.worldHalf * 2, CFG.worldHalf * 2),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Bay water (south) with a slow swell.
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2a7fa8, roughness: 0.25, metalness: 0.55, transparent: true, opacity: 0.92,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(420, 90), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.15, CFG.bayEdge + 32);
  scene.add(water);

  // Buildings: instanced boxes with a shared facade texture.
  const facade = facadeTexture(rng, 0.55);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const boxMat = new THREE.MeshStandardMaterial({ map: facade, roughness: 0.85, metalness: 0.05 });
  const placements = [];
  const roadLines = [];
  for (let k = -3; k <= 3; k++) roadLines.push(k * CFG.roadSpacing);
  for (let i = -3; i <= 2; i++) {
    for (let j = -3; j <= 2; j++) {
      const cx = (i + 0.5) * CFG.roadSpacing;
      const cz = (j + 0.5) * CFG.roadSpacing;
      // Skip the plaza block and the landmark blocks.
      if (i === -1 && j === -1) continue; // plaza
      if (i === 1 && j === -2) continue; // bank block
      if (i === -2 && j === 1) continue; // safehouse block
      if (i === 1 && j === 0) continue; // garage block
      if (i === -2 && j === -1) continue; // police station block
      if (i === -1 && j === 1) continue; // hospital block
      for (let bx = -1; bx <= 1; bx++) {
        for (let bz = -1; bz <= 1; bz++) {
          if (bx === 0 && bz === 0 && rng.chance(0.5)) continue; // courtyard gaps
          const w = rng.range(9, 14);
          const d = rng.range(9, 14);
          const downtown = Math.abs(cx) < 70 && Math.abs(cz) < 70;
          const h = downtown ? rng.range(14, 42) : rng.range(7, 20);
          const x = cx + bx * 11 + rng.range(-1.5, 1.5);
          const z = cz + bz * 11 + rng.range(-1.5, 1.5);
          placements.push({ x, z, w, d, h });
          colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        }
      }
    }
  }
  const inst = new THREE.InstancedMesh(boxGeo, boxMat, placements.length);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  placements.forEach((p, idx) => {
    dummy.position.set(p.x, p.h / 2, p.z);
    dummy.scale.set(p.w, p.h, p.d);
    dummy.updateMatrix();
    inst.setMatrixAt(idx, dummy.matrix);
    tint.setHSL(0.08 + rng.next() * 0.06, 0.25 + rng.next() * 0.2, 0.55 + rng.next() * 0.25);
    inst.setColorAt(idx, tint);
  });
  inst.castShadow = true;
  inst.receiveShadow = true;
  scene.add(inst);

  // Landmarks.
  const landmarkMat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...opts });
  function landmarkBox(name, x, z, w, h, d, color, opts) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), landmarkMat(color, opts));
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    scene.add(mesh);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    landmarks[name] = { mesh, x, z, w, h, d };
    return mesh;
  }
  // Bay Bank: glass tower on the (1,-2) block, faced with lit windows so it
  // reads as a building instead of a flat navy slab.
  const bank = landmarkBox('bank', 66, -66, 26, 58, 22, 0xbfd9e8, { roughness: 0.4, metalness: 0.25 });
  bank.material.map = facade;
  bank.material.emissive = new THREE.Color(0x1a2a3a);
  bank.material.emissiveIntensity = 0.25;
  bank.material.needsUpdate = true;
  // Safehouse: small warm house.
  landmarkBox('safehouse', -66, 66, 16, 9, 13, 0xd8a05a);
  // Garage: wide low workshop with a striped awning.
  const garage = landmarkBox('garage', 66, 22, 24, 8, 16, 0x4a6b8a);
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(26, 1, 6),
    new THREE.MeshStandardMaterial({ color: 0xd84b4b, roughness: 0.8 }),
  );
  awning.position.set(66, 8.6, 12);
  scene.add(awning);
  // Police station: blue-white block with a mast.
  landmarkBox('police', -66, -22, 20, 14, 16, 0x3a5a9e);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 12, 6),
    new THREE.MeshStandardMaterial({ color: 0xdddddd }),
  );
  mast.position.set(-66, 20, -22);
  scene.add(mast);
  // Hospital: white block with a red cross board.
  landmarkBox('hospital', -22, 66, 22, 16, 16, 0xe8e8e2);
  const cross = new THREE.Mesh(
    new THREE.BoxGeometry(8, 8, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xc22e2e, emissive: 0x881111, emissiveIntensity: 0.5 }),
  );
  cross.position.set(-22, 12, 57.5);
  scene.add(cross);
  // Central plaza: fountain + benches on the (-1,-1) block.
  const plaza = new THREE.Group();
  plaza.position.set(-22, 0, -22);
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 7.5, 1.2, 24),
    new THREE.MeshStandardMaterial({ color: 0xb0a894, roughness: 0.9 }),
  );
  basin.position.y = 0.6;
  plaza.add(basin);
  const pool = new THREE.Mesh(
    new THREE.CylinderGeometry(6.2, 6.2, 0.4, 24),
    new THREE.MeshStandardMaterial({ color: 0x3a9ec2, roughness: 0.2, metalness: 0.4 }),
  );
  pool.position.y = 1.1;
  plaza.add(pool);
  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.9, 3.4, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.8 }),
  );
  spout.position.y = 2.2;
  plaza.add(spout);
  scene.add(plaza);
  colliders.push({ minX: -29.5, maxX: -14.5, minZ: -29.5, maxZ: -14.5 });
  landmarks.plaza = { mesh: plaza, x: -22, z: -22, w: 15, h: 3, d: 15 };
  landmarks.garage = landmarks.garage || { x: 66, z: 22 };
  void garage;

  // Palms along the roads.
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 7, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.95 });
  const frondGeo = new THREE.ConeGeometry(2.6, 1.6, 7);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e8e4a, roughness: 0.9 });
  const palmCount = 130;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmCount);
  let pi = 0;
  for (let k = -3; k <= 3 && pi < palmCount; k++) {
    for (let s = -150; s <= 150 && pi < palmCount; s += 24) {
      if (rng.chance(0.35)) continue;
      const alongRoad = rng.chance(0.5);
      const x = alongRoad ? s : k * CFG.roadSpacing + 9.5 * rng.sign();
      const z = alongRoad ? k * CFG.roadSpacing + 9.5 * rng.sign() : s;
      if (Math.abs(x) > 158 || Math.abs(z) > 150) continue;
      dummy.position.set(x, 3.5, z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, rng.next() * Math.PI, 0);
      dummy.updateMatrix();
      trunks.setMatrixAt(pi, dummy.matrix);
      dummy.position.set(x, 7.6, z);
      dummy.updateMatrix();
      fronds.setMatrixAt(pi, dummy.matrix);
      pi++;
    }
  }
  trunks.count = pi;
  fronds.count = pi;
  scene.add(trunks);
  scene.add(fronds);

  // Street lamps (emissive heads glow at sunset).
  const lampPoleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6.5, 6);
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x333a40, roughness: 0.6, metalness: 0.5 });
  const lampHeadGeo = new THREE.SphereGeometry(0.45, 8, 6);
  const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc860, emissiveIntensity: 1.4 });
  const lampSpots = [];
  for (let k = -3; k <= 3; k++) {
    for (let s = -132; s <= 132; s += 44) {
      lampSpots.push([k * CFG.roadSpacing + 8.5, s]);
      lampSpots.push([s, k * CFG.roadSpacing + 8.5]);
    }
  }
  const poles = new THREE.InstancedMesh(lampPoleGeo, lampPoleMat, lampSpots.length);
  const heads = new THREE.InstancedMesh(lampHeadGeo, lampHeadMat, lampSpots.length);
  lampSpots.forEach(([x, z], idx) => {
    dummy.position.set(x, 3.25, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poles.setMatrixAt(idx, dummy.matrix);
    dummy.position.set(x, 6.6, z);
    dummy.updateMatrix();
    heads.setMatrixAt(idx, dummy.matrix);
  });
  scene.add(poles);
  scene.add(heads);

  // Billboards with the city's own names.
  const boards = [
    { text: 'PALMERA BAY', bg: '#1e5f8a', fg: '#ffe9a8', x: -88, z: -140, ry: 0 },
    { text: 'SUNSET HEAT', bg: '#8a2e1e', fg: '#ffffff', x: 110, z: -88, ry: Math.PI / 2 },
    { text: 'MARINA', bg: '#2e6f4a', fg: '#ffffff', x: -110, z: 88, ry: -Math.PI / 2 },
    { text: 'TACOS 24H', bg: '#d8a02e', fg: '#3a2a10', x: 88, z: 132, ry: Math.PI },
  ];
  boards.forEach((b) => {
    const tex = billboardTexture(b.text, b.bg, b.fg);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(18, 9, 0.8),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }),
    );
    board.position.set(b.x, 16, b.z);
    board.rotation.y = b.ry;
    scene.add(board);
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(1, 12, 1),
      new THREE.MeshStandardMaterial({ color: 0x444444 }),
    );
    leg.position.set(b.x, 6, b.z);
    scene.add(leg);
  });

  // Docks + boats on the bay.
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.9 });
  for (let dx = -120; dx <= 120; dx += 40) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(18, 0.8, 5), dockMat);
    dock.position.set(dx, 0.6, CFG.bayEdge + 8);
    scene.add(dock);
  }
  const boatHullMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 });
  const boatTopMat = new THREE.MeshStandardMaterial({ color: 0x2e6f8e, roughness: 0.5 });
  const boats = [];
  for (let b = 0; b < 6; b++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 8), boatHullMat);
    hull.position.y = 0.6;
    boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 3.4), boatTopMat);
    cabin.position.set(0, 1.8, -0.6);
    boat.add(cabin);
    boat.position.set(-110 + b * 44 + rng.range(-6, 6), 0, CFG.bayEdge + 22 + rng.range(-4, 10));
    boat.rotation.y = rng.range(-0.3, 0.3);
    scene.add(boat);
    boats.push(boat);
  }

  // Eastern harbor: container stacks + cranes.
  const containerColors = [0xc22e2e, 0x2e5ec2, 0xd8a02e, 0x2e8e4a, 0x8a5ac2];
  for (let cx = 0; cx < 4; cx++) {
    for (let cz = 0; cz < 5; cz++) {
      const stack = 1 + Math.floor(rng.next() * 3);
      for (let s = 0; s < stack; s++) {
        const cont = new THREE.Mesh(
          new THREE.BoxGeometry(12, 2.6, 2.6),
          new THREE.MeshStandardMaterial({ color: containerColors[Math.floor(rng.next() * containerColors.length)], roughness: 0.8 }),
        );
        const x = CFG.harborEdge + 12 + cx * 14;
        const z = -110 + cz * 44;
        cont.position.set(x, 1.3 + s * 2.6, z);
        cont.castShadow = true;
        scene.add(cont);
        if (s === 0) colliders.push({ minX: x - 6, maxX: x + 6, minZ: z - 1.3, maxZ: z + 1.3 });
      }
    }
  }
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xd8a02e, roughness: 0.6, metalness: 0.3 });
  [[168, -66], [168, 22], [168, 110]].forEach(([x, z]) => {
    const legA = new THREE.Mesh(new THREE.BoxGeometry(1.4, 26, 1.4), craneMat);
    legA.position.set(x - 4, 13, z);
    scene.add(legA);
    const legB = new THREE.Mesh(new THREE.BoxGeometry(1.4, 26, 1.4), craneMat);
    legB.position.set(x + 4, 13, z);
    scene.add(legB);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 34), craneMat);
    beam.position.set(x, 26, z);
    scene.add(beam);
    colliders.push({ minX: x - 5, maxX: x + 5, minZ: z - 2, maxZ: z + 2 });
  });

  // Traffic lights at the four central intersections.
  const lightPositions = [
    { x: -44, z: -44 }, { x: 44, z: -44 }, { x: -44, z: 44 }, { x: 44, z: 44 },
  ];
  lightPositions.forEach(({ x, z }) => {
    const group = new THREE.Group();
    group.position.set(x + 8.5, 0, z + 8.5);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }),
    );
    pole.position.y = 3;
    group.add(pole);
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(1, 2.6, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 }),
    );
    housing.position.y = 6.4;
    group.add(housing);
    const lampGeo = new THREE.SphereGeometry(0.28, 8, 6);
    const red = new THREE.Mesh(lampGeo, new THREE.MeshStandardMaterial({ color: 0x661111, emissive: 0xff2222, emissiveIntensity: 0 }));
    red.position.set(0, 7.2, 0.4);
    group.add(red);
    const yellow = new THREE.Mesh(lampGeo, new THREE.MeshStandardMaterial({ color: 0x665511, emissive: 0xffcc22, emissiveIntensity: 0 }));
    yellow.position.set(0, 6.4, 0.4);
    group.add(yellow);
    const green = new THREE.Mesh(lampGeo, new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x22ff44, emissiveIntensity: 0 }));
    green.position.set(0, 5.6, 0.4);
    group.add(green);
    scene.add(group);
    lights.push({ x, z, red, yellow, green, axis: 'ns' });
  });

  return {
    colliders, lights, landmarks, boats, water,
    buildingCount: placements.length,
    update(dt, time) {
      // 12 s cycle: 0-5 NS green, 5-6 NS yellow, 6-11 EW green, 11-12 EW yellow.
      const phase = time % 12;
      const nsGreen = phase < 5;
      const nsYellow = phase >= 5 && phase < 6;
      const ewYellow = phase >= 11;
      for (const l of lights) {
        l.red.material.emissiveIntensity = phase >= 6 ? 1.6 : 0;
        l.yellow.material.emissiveIntensity = (nsYellow || ewYellow) ? 1.6 : 0;
        l.green.material.emissiveIntensity = nsGreen ? 1.6 : 0;
        l.axis = nsGreen || nsYellow ? 'ns' : 'ew';
      }
      for (const boat of boats) {
        boat.position.y = Math.sin(time * 0.7 + boat.position.x) * 0.18;
        boat.rotation.z = Math.sin(time * 0.5 + boat.position.x) * 0.02;
      }
      water.position.y = 0.15 + Math.sin(time * 0.4) * 0.08;
    },
    // Is the given road point stopped by a red light for travel along axis?
    lightStateAt(x, z, axis) {
      for (const l of lights) {
        if (Math.abs(x - l.x) < 10 && Math.abs(z - l.z) < 10) return l.axis === axis ? 'green' : 'red';
      }
      return 'green';
    },
  };
}
