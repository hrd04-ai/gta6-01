// The HUD: stars, cash, health, speed and ammo, objective line with timer
// and distance, a live 2D minimap, toasts, dialogue from Mara, damage flash
// and the title / pause / wasted / busted menus. All DOM, no canvas text.
import { CFG } from './config.js';

export class HUD {
  constructor() {
    this.el = {
      stars: document.getElementById('hud-stars'),
      cash: document.getElementById('hud-cash'),
      healthFill: document.getElementById('hud-health-fill'),
      healthText: document.getElementById('hud-health-text'),
      speed: document.getElementById('hud-speed'),
      weapon: document.getElementById('hud-weapon'),
      objective: document.getElementById('hud-objective'),
      missionName: document.getElementById('hud-mission'),
      toasts: document.getElementById('toasts'),
      dialogue: document.getElementById('dialogue'),
      dialogueText: document.getElementById('dialogue-text'),
      damage: document.getElementById('damage-flash'),
      crosshair: document.getElementById('crosshair'),
      menu: document.getElementById('menu'),
      menuTitle: document.getElementById('menu-title'),
      menuText: document.getElementById('menu-text'),
      menuButtons: document.getElementById('menu-buttons'),
      minimap: document.getElementById('minimap'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.dialogueTimer = null;
    this.toastCount = 0;
  }

  showMenu(title, text, buttons) {
    this.el.menuTitle.textContent = title;
    this.el.menuText.textContent = text;
    this.el.menuButtons.innerHTML = '';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.className = 'menu-btn';
      btn.textContent = b.label;
      btn.addEventListener('click', () => { b.onClick(); });
      this.el.menuButtons.appendChild(btn);
    }
    this.el.menu.classList.remove('hidden');
  }

  hideMenu() {
    this.el.menu.classList.add('hidden');
  }

  toast(text, ms = 3600) {
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = text;
    this.el.toasts.appendChild(div);
    this.toastCount++;
    window.setTimeout(() => {
      div.classList.add('fade');
      window.setTimeout(() => div.remove(), 400);
    }, ms);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
  }

  showDialogue(text, ms = 5200) {
    this.el.dialogueText.textContent = text;
    this.el.dialogue.classList.remove('hidden');
    if (this.dialogueTimer) window.clearTimeout(this.dialogueTimer);
    this.dialogueTimer = window.setTimeout(() => this.el.dialogue.classList.add('hidden'), ms);
  }

  flashDamage() {
    this.el.damage.classList.remove('hit');
    void this.el.damage.offsetWidth;
    this.el.damage.classList.add('hit');
  }

  setCrosshair(on) {
    this.el.crosshair.classList.toggle('hidden', !on);
  }

  update(G) {
    const player = G.player;
    const wanted = G.police.wanted;
    let stars = '';
    for (let i = 0; i < CFG.maxWanted; i++) stars += i < wanted ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.classList.toggle('hot', wanted >= 3);
    this.el.cash.textContent = `$${Math.round(G.cash).toLocaleString('en-US')}`;
    this.el.healthFill.style.width = `${Math.max(0, player.health)}%`;
    this.el.healthFill.classList.toggle('low', player.health < 30);
    this.el.healthText.textContent = `HP ${Math.ceil(player.health)}`;
    const speed = player.inCar ? Math.abs(player.inCar.speed) * 3.6 : Math.abs(player.speed) * 3.6;
    this.el.speed.textContent = `${Math.round(speed)} km/h`;
    if (player.inCar) {
      this.el.weapon.textContent = `CAR HP ${Math.max(0, Math.ceil(player.inCar.hp))}`;
    } else if (player.armed) {
      this.el.weapon.textContent = `PISTOL ${player.ammo}/${CFG.pistolMag}${player.reloadTimer > 0 ? ' …' : ''}`;
    } else {
      this.el.weapon.textContent = 'FISTS — press 1 for pistol';
    }
    const obj = G.missions.objective();
    const pPos = player.inCar ? player.inCar.pos : player.pos;
    let objText = obj.text;
    if (obj.target) {
      const d = Math.round(Math.hypot(pPos.x - obj.target.x, pPos.z - obj.target.z));
      objText += `  ·  ${d}m`;
    }
    if (obj.timeLeft !== null && obj.timeLeft !== undefined) objText += `  ·  ${obj.timeLeft}s`;
    this.el.objective.textContent = objText;
    this.el.missionName.textContent = G.missions.done ? 'PALMERA BAY — FREE ROAM' : `MISSION ${G.missions.index + 1}/5 — ${G.missions.current.name}`;
    this.drawMinimap(G, pPos);
  }

  drawMinimap(G, pPos) {
    const ctx = this.mapCtx;
    const S = 168;
    const scale = S / (CFG.worldHalf * 2);
    const toMap = (x, z) => [(x + CFG.worldHalf) * scale, (z + CFG.worldHalf) * scale];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(12, 20, 30, 0.82)';
    ctx.fillRect(0, 0, S, S);
    // Bay water.
    ctx.fillStyle = '#2a7fa8';
    ctx.fillRect(0, (CFG.bayEdge + CFG.worldHalf) * scale, S, S);
    // Harbor.
    ctx.fillStyle = '#8f8a80';
    ctx.fillRect((CFG.harborEdge + CFG.worldHalf) * scale, 0, S, (CFG.bayEdge + CFG.worldHalf) * scale);
    // Roads.
    ctx.strokeStyle = '#5a5650';
    ctx.lineWidth = 4;
    for (let k = -3; k <= 3; k++) {
      const [x1, y1] = toMap(k * CFG.roadSpacing, -CFG.worldHalf);
      const [x2, y2] = toMap(k * CFG.roadSpacing, CFG.worldHalf);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [x3, y3] = toMap(-CFG.worldHalf, k * CFG.roadSpacing);
      const [x4, y4] = toMap(CFG.worldHalf, k * CFG.roadSpacing);
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
    }
    // Objective beacon.
    const obj = G.missions.objective();
    if (obj.target) {
      const [ox, oy] = toMap(obj.target.x, obj.target.z);
      ctx.fillStyle = '#ffc832';
      ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffc832';
      ctx.beginPath(); ctx.arc(ox, oy, 8 + Math.sin(G.time * 4) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    // Fare marker.
    if (G.missions.fare) {
      const f = G.missions.fare.aboard ? G.missions.fare.dest : G.missions.fare.pickup;
      const [fx, fy] = toMap(f.x, f.z);
      ctx.fillStyle = '#39d353';
      ctx.beginPath(); ctx.arc(fx, fy, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Police.
    ctx.fillStyle = '#5aa2ff';
    for (const car of G.police.pursuit) {
      const [cx, cy] = toMap(car.pos.x, car.pos.z);
      ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    for (const cop of G.police.cops) {
      const [cx, cy] = toMap(cop.pos.x, cop.pos.z);
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
    }
    // Player arrow.
    const [px, py] = toMap(pPos.x, pPos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-G.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
