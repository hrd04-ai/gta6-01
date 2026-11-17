// The HUD: wanted stars, cash, health, speed and weapon readouts, the
// mission objective, a live minimap, and the toasts that carry the story.
// Everything is plain DOM over the canvas — cheap, crisp and readable.

import { CONFIG } from './config.js';

export class HUD {
  constructor(doc) {
    this.doc = doc;
    this.el = {};
    for (const id of [
      'stars', 'cash', 'healthFill', 'healthText', 'speed', 'speedNum', 'weapon',
      'objective', 'objectiveTitle', 'objectiveText', 'objectiveMeta', 'toasts',
      'minimap', 'crosshair', 'damageFlash', 'clock', 'menu', 'pauseMenu',
      'wasted', 'busted', 'helpPanel', 'storyTag',
    ]) {
      this.el[id] = doc.getElementById(id);
    }
    this.minimapCtx = this.el.minimap ? this.el.minimap.getContext('2d') : null;
    this.toastQueue = [];
    this.cashValue = 0;
  }

  setCash(n) {
    this.cashValue = n;
    if (this.el.cash) this.el.cash.textContent = `$${Math.floor(n).toLocaleString('en-US')}`;
  }

  setHealth(h, max) {
    const pct = Math.max(0, (h / max) * 100);
    if (this.el.healthFill) this.el.healthFill.style.width = `${pct}%`;
    if (this.el.healthText) this.el.healthText.textContent = `${Math.ceil(h)}`;
    if (this.el.healthFill) {
      this.el.healthFill.style.background = pct > 50 ? '#6fbf5a' : pct > 25 ? '#f39c12' : '#d64545';
    }
  }

  setStars(n) {
    if (!this.el.stars) return;
    let html = '';
    for (let i = 0; i < 5; i++) {
      html += `<span class="${i < n ? 'on' : ''}">★</span>`;
    }
    this.el.stars.innerHTML = html;
    this.el.stars.classList.toggle('hot', n >= 3);
  }

  setSpeed(kmh, driving) {
    if (!this.el.speed) return;
    this.el.speed.style.display = driving ? 'block' : 'none';
    if (driving && this.el.speedNum) this.el.speedNum.textContent = Math.round(kmh);
  }

  setWeapon(text) {
    if (this.el.weapon) this.el.weapon.textContent = text;
  }

  setClock(minutes) {
    if (!this.el.clock) return;
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    this.el.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  setObjective(title, text, timer, dist) {
    if (this.el.objectiveTitle) this.el.objectiveTitle.textContent = title;
    if (this.el.objectiveText) this.el.objectiveText.textContent = text;
    if (this.el.objectiveMeta) {
      const parts = [];
      if (timer !== null && timer !== undefined) parts.push(`⏱ ${Math.ceil(timer)}s`);
      if (dist !== null && dist !== undefined) parts.push(`${Math.round(dist)} m`);
      this.el.objectiveMeta.textContent = parts.join(' · ');
    }
  }

  toast(text, seconds = 3) {
    if (!this.el.toasts) return;
    const div = this.doc.createElement('div');
    div.className = 'toast';
    div.textContent = text;
    this.el.toasts.appendChild(div);
    while (this.el.toasts.children.length > 3) {
      this.el.toasts.removeChild(this.el.toasts.firstChild);
    }
    setTimeout(() => {
      div.classList.add('fade');
      setTimeout(() => div.remove(), 600);
    }, seconds * 1000);
  }

  damageFlash() {
    if (!this.el.damageFlash) return;
    this.el.damageFlash.classList.remove('hit');
    // Force a reflow so the animation restarts.
    void this.el.damageFlash.offsetWidth;
    this.el.damageFlash.classList.add('hit');
  }

  setCrosshair(show) {
    if (this.el.crosshair) this.el.crosshair.style.display = show ? 'block' : 'none';
  }

  showTitle() {
    if (this.el.menu) this.el.menu.style.display = 'flex';
    if (this.el.pauseMenu) this.el.pauseMenu.style.display = 'none';
    if (this.el.wasted) this.el.wasted.style.display = 'none';
    if (this.el.busted) this.el.busted.style.display = 'none';
  }

  hideMenus() {
    if (this.el.menu) this.el.menu.style.display = 'none';
    if (this.el.pauseMenu) this.el.pauseMenu.style.display = 'none';
    if (this.el.wasted) this.el.wasted.style.display = 'none';
    if (this.el.busted) this.el.busted.style.display = 'none';
  }

  showPause(show) {
    if (this.el.pauseMenu) this.el.pauseMenu.style.display = show ? 'flex' : 'none';
  }

  showWasted(show) {
    if (this.el.wasted) this.el.wasted.style.display = show ? 'flex' : 'none';
  }

  showBusted(show) {
    if (this.el.busted) this.el.busted.style.display = show ? 'flex' : 'none';
  }

  setStoryTag(text) {
    if (this.el.storyTag) this.el.storyTag.textContent = text;
  }

  // Top-down map: roads, water, the player arrow, police, traffic and the
  // gold objective marker. North is up; the player arrow rotates.
  drawMinimap(state) {
    const ctx = this.minimapCtx;
    if (!ctx) return;
    const S = 180;
    const toMap = (v) => ((v + 180) / 360) * S;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(12, 18, 24, 0.88)';
    ctx.fillRect(0, 0, S, S);
    // Water (south) and harbor (east).
    ctx.fillStyle = '#2a7a9a';
    ctx.fillRect(0, toMap(158), S, S - toMap(158));
    ctx.fillStyle = '#8a8378';
    ctx.fillRect(toMap(158), 0, S - toMap(158), S);
    // Roads.
    ctx.strokeStyle = '#8f9aa3';
    ctx.lineWidth = 2.5;
    for (const line of CONFIG.world.lines) {
      ctx.beginPath(); ctx.moveTo(0, toMap(line)); ctx.lineTo(S, toMap(line)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(toMap(line), 0); ctx.lineTo(toMap(line), S); ctx.stroke();
    }
    // Objective marker.
    if (state.objective) {
      ctx.fillStyle = '#ffc23c';
      const ox = toMap(state.objective.x), oz = toMap(state.objective.z);
      ctx.beginPath();
      ctx.moveTo(ox, oz - 6); ctx.lineTo(ox + 5, oz); ctx.lineTo(ox, oz + 6); ctx.lineTo(ox - 5, oz);
      ctx.closePath(); ctx.fill();
    }
    // Traffic (white) and police (red).
    ctx.fillStyle = '#e8e8e8';
    for (const c of state.traffic || []) {
      ctx.fillRect(toMap(c.x) - 1.5, toMap(c.z) - 1.5, 3, 3);
    }
    ctx.fillStyle = '#ff3b30';
    for (const c of state.police || []) {
      ctx.beginPath(); ctx.arc(toMap(c.x), toMap(c.z), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // The player: a white arrow that turns with the heading.
    const px = toMap(state.x), pz = toMap(state.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-state.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // Wanted pulse: a red ring while the heat is on.
    if (state.stars > 0) {
      ctx.strokeStyle = 'rgba(255, 59, 48, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, pz, 10 + Math.sin(state.time * 5) * 2, 0, Math.PI * 2); ctx.stroke();
    }
  }
}
