// The city of Palmera Bay: Sunset Heat.
// A procedural grid city on a sunset waterfront: roads on a regular
// lattice, blocks filled with buildings, parks and plazas, a beach and
// sea along the south edge, and a pier and lighthouse as landmarks.
// Everything is generated from a seed, and the module answers the
// questions the rest of the game asks: "is this point road?", "is this
// point blocked by a building?", "where is the nearest road?".

import { WORLD, PALETTE } from './config.js';
import { makeRng, clamp } from './random.js';

const ROOFS = [PALETTE.buildingRoof, PALETTE.buildingRoof2, PALETTE.buildingRoof3];
const NEONS = [PALETTE.neonPink, PALETTE.neonCyan, PALETTE.neonGold];

export class City {
  constructor(seed = 20261119) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.buildings = [];
    this.parks = [];
    this.plazas = [];
    this.palms = [];
    this.landmarks = [];
    this.generate();
  }

  generate() {
    const { width, height, block, roadWidth } = WORLD;
    const half = roadWidth / 2;
    // Road centre lines run every `block` px, offset by half a block so
    // the map edges are blocks, not roads.
    this.vRoads = [];
    this.hRoads = [];
    for (let x = block / 2; x < width; x += block) this.vRoads.push(x);
    for (let y = block / 2; y < height - 200; y += block) this.hRoads.push(y);

    const rng = this.rng;
    // One building (sometimes two) per block, with a margin from the road.
    for (let bx = 0; bx < this.vRoads.length - 1; bx++) {
      for (let by = 0; by < this.hRoads.length - 1; by++) {
        const x0 = this.vRoads[bx] + half + 26;
        const x1 = this.vRoads[bx + 1] - half - 26;
        const y0 = this.hRoads[by] + half + 26;
        const y1 = this.hRoads[by + 1] - half - 26;
        if (x1 - x0 < 90 || y1 - y0 < 90) continue;
        if (y0 > WORLD.beachY) continue; // beach blocks stay open
        const roll = rng.next();
        if (roll < 0.14) {
          this.parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: rng.int(4, 9) });
          continue;
        }
        if (roll < 0.2) {
          this.plazas.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
          continue;
        }
        const split = rng.chance(0.35) && x1 - x0 > 260;
        if (split) {
          const mid = x0 + (x1 - x0) * rng.range(0.42, 0.58);
          this.addBuilding(x0, y0, mid - 14, y1, rng);
          this.addBuilding(mid + 14, y0, x1, y1, rng);
        } else {
          this.addBuilding(x0, y0, x1, y1, rng);
        }
      }
    }

    // Landmarks: pier, lighthouse, bank, garage, chop shop, safehouse.
    this.landmarks = [
      { id: 'pier', name: 'Old Pier', x: 3300, y: 2520, r: 60 },
      { id: 'lighthouse', name: 'Lighthouse', x: 3400, y: 2350, r: 46 },
      { id: 'bank', name: 'Bay Bank', x: 2310, y: 1050, r: 70 },
      { id: 'garage', name: 'Vera\u2019s Garage', x: 630, y: 630, r: 56 },
      { id: 'chopshop', name: 'Chop Shop', x: 2730, y: 1890, r: 56 },
      { id: 'safehouse', name: 'Safehouse', x: 420, y: 2100, r: 56 },
      { id: 'northgate', name: 'North Gate', x: 1890, y: 210, r: 50 },
    ];

    // Palm trees along the beachfront and the boardwalk.
    for (let x = 120; x < width - 80; x += 90) {
      this.palms.push({ x: x + rng.range(-18, 18), y: WORLD.beachY + 34 + rng.range(-8, 8), s: rng.range(0.8, 1.25) });
      if (rng.chance(0.5)) this.palms.push({ x: x + 44, y: WORLD.beachY + 84, s: rng.range(0.7, 1.1) });
    }
    for (const park of this.parks) {
      for (let i = 0; i < park.trees; i++) {
        this.palms.push({
          x: park.x + rng.range(20, park.w - 20),
          y: park.y + rng.range(20, park.h - 20),
          s: rng.range(0.8, 1.3),
        });
      }
    }
  }

  addBuilding(x0, y0, x1, y1, rng) {
    const w = x1 - x0;
    const h = y1 - y0;
    const floors = Math.max(1, Math.round(rng.range(1, 6) + (w * h) / 26000));
    this.buildings.push({
      x: x0,
      y: y0,
      w,
      h,
      floors,
      roof: ROOFS[rng.int(0, ROOFS.length - 1)],
      neon: rng.chance(0.4) ? NEONS[rng.int(0, NEONS.length - 1)] : null,
      windows: rng.int(2, 5),
    });
  }

  isRoad(x, y) {
    const { roadWidth } = WORLD;
    const half = roadWidth / 2;
    for (const rx of this.vRoads) if (Math.abs(x - rx) <= half) return true;
    for (const ry of this.hRoads) if (Math.abs(y - ry) <= half) return true;
    return false;
  }

  isBeach(x, y) {
    return y >= WORLD.beachY && y < WORLD.seaY;
  }

  isSea(x, y) {
    return y >= WORLD.seaY;
  }

  isWalkable(x, y) {
    if (x < 20 || y < 20 || x > WORLD.width - 20 || y > WORLD.height - 20) return false;
    if (this.isSea(x, y)) return false;
    return !this.buildingAt(x, y);
  }

  buildingAt(x, y) {
    for (const b of this.buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  // Push a circle out of any building it overlaps; returns true if moved.
  resolveBuildingCollision(p, radius) {
    const b = this.buildingAt(p.x, p.y);
    if (!b) return false;
    const cx = clamp(p.x, b.x, b.x + b.w);
    const cy = clamp(p.y, b.y, b.y + b.h);
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d = Math.hypot(dx, dy);
    if (d >= radius) return false;
    if (d > 0.001) {
      p.x = cx + (dx / d) * radius;
      p.y = cy + (dy / d) * radius;
    } else {
      // Dead centre: push out through the nearest face.
      const left = p.x - b.x;
      const right = b.x + b.w - p.x;
      const top = p.y - b.y;
      const bottom = b.y + b.h - p.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) p.x = b.x - radius;
      else if (m === right) p.x = b.x + b.w + radius;
      else if (m === top) p.y = b.y - radius;
      else p.y = b.y + b.h + radius;
    }
    return true;
  }

  nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const rx of this.vRoads) {
      const d = Math.abs(x - rx);
      if (d < bestD) {
        bestD = d;
        best = { x: rx, y: clamp(y, 60, WORLD.height - 60) };
      }
    }
    for (const ry of this.hRoads) {
      const d = Math.abs(y - ry);
      if (d < bestD) {
        bestD = d;
        best = { x: clamp(x, 60, WORLD.width - 60), y: ry };
      }
    }
    return best;
  }

  randomRoadPoint(rng) {
    const vertical = rng.chance(0.5);
    if (vertical) {
      return { x: rng.pick(this.vRoads), y: rng.range(80, WORLD.height - 320) };
    }
    return { x: rng.range(80, WORLD.width - 80), y: rng.pick(this.hRoads) };
  }

  draw(ctx, cam) {
    const { width, height } = WORLD;
    const x0 = Math.max(0, cam.x - cam.w / 2 - 60);
    const y0 = Math.max(0, cam.y - cam.h / 2 - 60);
    const x1 = Math.min(width, cam.x + cam.w / 2 + 60);
    const y1 = Math.min(height, cam.y + cam.h / 2 + 60);

    // Ground: grass city, sand beach, sea.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (y1 > WORLD.beachY) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(x0, Math.max(y0, WORLD.beachY), x1 - x0, Math.min(y1, WORLD.seaY) - Math.max(y0, WORLD.beachY));
    }
    if (y1 > WORLD.seaY) {
      ctx.fillStyle = PALETTE.sea;
      ctx.fillRect(x0, Math.max(y0, WORLD.seaY), x1 - x0, y1 - Math.max(y0, WORLD.seaY));
      ctx.fillStyle = PALETTE.seaDeep;
      for (let i = 0; i < 5; i++) {
        const wy = WORLD.seaY + 40 + i * 46;
        if (wy < y0 || wy > y1) continue;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(x0, wy, x1 - x0, 3);
        ctx.globalAlpha = 1;
      }
    }

    // Sidewalks: pale border around each road.
    ctx.fillStyle = PALETTE.sidewalk;
    const half = WORLD.roadWidth / 2 + 12;
    for (const rx of this.vRoads) {
      if (rx < x0 - half || rx > x1 + half) continue;
      ctx.fillRect(rx - half, y0, half * 2, y1 - y0);
    }
    for (const ry of this.hRoads) {
      if (ry < y0 - half || ry > y1 + half) continue;
      ctx.fillRect(x0, ry - half, x1 - x0, half * 2);
    }

    // Asphalt + centre dashes.
    ctx.fillStyle = PALETTE.asphalt;
    const ah = WORLD.roadWidth / 2;
    for (const rx of this.vRoads) {
      if (rx < x0 - ah || rx > x1 + ah) continue;
      ctx.fillRect(rx - ah, y0, ah * 2, y1 - y0);
    }
    for (const ry of this.hRoads) {
      if (ry < y0 - ah || ry > y1 + ah) continue;
      ctx.fillRect(x0, ry - ah, x1 - x0, ah * 2);
    }
    ctx.fillStyle = PALETTE.laneDash;
    for (const rx of this.vRoads) {
      if (rx < x0 - ah || rx > x1 + ah) continue;
      for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) ctx.fillRect(rx - 2, y, 4, 22);
    }
    for (const ry of this.hRoads) {
      if (ry < y0 - ah || ry > y1 + ah) continue;
      for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) ctx.fillRect(x, ry - 2, 22, 4);
    }

    // Parks and plazas.
    for (const p of this.parks) {
      if (p.x > x1 || p.x + p.w < x0 || p.y > y1 || p.y + p.h < y0) continue;
      ctx.fillStyle = '#2f6b3c';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#57a86b';
      ctx.lineWidth = 3;
      ctx.strokeRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8);
    }
    for (const p of this.plazas) {
      if (p.x > x1 || p.x + p.w < x0 || p.y > y1 || p.y + p.h < y0) continue;
      ctx.fillStyle = '#b9a58f';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#8f7d68';
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    // Buildings: roof, edge shade, windows, neon strip.
    for (const b of this.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      ctx.fillStyle = 'rgba(255, 220, 140, 0.85)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i * 7 + j * 3 + b.floors) % 3 === 0) continue;
          ctx.fillRect(b.x + 10 + i * 34, b.y + 10 + j * 34, 12, 14);
        }
      }
      if (b.neon) {
        ctx.fillStyle = b.neon;
        ctx.fillRect(b.x, b.y + b.h - 5, b.w, 4);
      }
    }

    // Palms.
    for (const palm of this.palms) {
      if (palm.x < x0 - 30 || palm.x > x1 + 30 || palm.y < y0 - 30 || palm.y > y1 + 30) continue;
      const s = palm.s;
      ctx.strokeStyle = '#7a5230';
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y);
      ctx.lineTo(palm.x + 3 * s, palm.y - 20 * s);
      ctx.stroke();
      ctx.fillStyle = '#2f8f4e';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(
          palm.x + 3 * s + Math.cos(a) * 13 * s,
          palm.y - 20 * s + Math.sin(a) * 8 * s,
          12 * s,
          4.5 * s,
          a,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }

    // Landmark labels and the pier.
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    for (const lm of this.landmarks) {
      if (lm.x < x0 - 120 || lm.x > x1 + 120 || lm.y < y0 - 60 || lm.y > y1 + 60) continue;
      ctx.fillStyle = 'rgba(12, 8, 24, 0.6)';
      const w = ctx.measureText(lm.name).width + 18;
      ctx.fillRect(lm.x - w / 2, lm.y - lm.r - 26, w, 20);
      ctx.fillStyle = '#ffe9b0';
      ctx.fillText(lm.name, lm.x, lm.y - lm.r - 11);
    }
    // The pier juts into the sea.
    ctx.fillStyle = '#8a6a48';
    ctx.fillRect(3260, WORLD.seaY - 8, 80, 190);
    ctx.fillStyle = '#a8845c';
    for (let y = WORLD.seaY + 6; y < WORLD.seaY + 180; y += 22) ctx.fillRect(3260, y, 80, 4);
  }

  drawMinimap(ctx, px, py, pw, ph, markers) {
    const sx = pw / WORLD.width;
    const sy = ph / WORLD.height;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 8, 22, 0.85)';
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = '#2e2a33';
    for (const rx of this.vRoads) ctx.fillRect(px + rx * sx - 1.5, py, 3, ph);
    for (const ry of this.hRoads) ctx.fillRect(px, py + ry * sy, pw, 3);
    ctx.fillStyle = '#e8c98a';
    ctx.fillRect(px, py + WORLD.beachY * sy, pw, (WORLD.seaY - WORLD.beachY) * sy);
    ctx.fillStyle = '#1d6f8e';
    ctx.fillRect(px, py + WORLD.seaY * sy, pw, ph - WORLD.seaY * sy);
    for (const m of markers) {
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(px + m.x * sx, py + m.y * sy, m.r ?? 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
