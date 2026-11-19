// The HUD for Palmera Bay: Sunset Heat.
// Canvas-drawn interface: cash and health top right, wanted stars top
// centre, the mission objective under them, a live minimap bottom left,
// speed and controls bottom right, and the start, pause, busted and
// wasted screens. The DOM overlay in index.html only holds the menus;
// everything in play is drawn here.

import { PALETTE, PLAYER, POLICE } from './config.js';

export class Hud {
  constructor() {
    this.toasts = [];
    this.message = null;
    this.messageTimer = 0;
  }

  toast(text, color = '#fff3e0') {
    this.toasts.push({ text, color, life: 3.2, maxLife: 3.2 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  showMessage(text, seconds = 3) {
    this.message = text;
    this.messageTimer = seconds;
  }

  update(dt) {
    for (const t of this.toasts) t.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);
    if (this.messageTimer > 0) this.messageTimer -= dt;
  }

  drawStars(ctx, stars, cx, y) {
    const outer = 15;
    const inner = 6.5;
    const gap = 34;
    const x0 = cx - ((POLICE.maxStars - 1) * gap) / 2;
    for (let i = 0; i < POLICE.maxStars; i++) {
      const lit = i < stars;
      ctx.save();
      ctx.translate(x0 + i * gap, y);
      ctx.fillStyle = lit ? '#ffd166' : 'rgba(255,255,255,0.16)';
      ctx.strokeStyle = lit ? '#ff8c42' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // A proper five-point star: ten vertices, outer and inner radii
      // alternating, stepped by 36 degrees from the top point.
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const r = k % 2 === 0 ? outer : inner;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  drawBar(ctx, x, y, w, h, frac, fill, label) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    if (label) {
      ctx.fillStyle = '#fff3e0';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 4, y + h - 4);
    }
    ctx.restore();
  }

  draw(ctx, state, time) {
    const { width, height } = ctx.canvas;
    const { save, player, wanted, missions, city, police, cars, peds } = state;

    // Wanted stars, top centre.
    this.drawStars(ctx, wanted.stars, width / 2, 34);

    // Cash + health, top right.
    ctx.save();
    ctx.fillStyle = PALETTE.hudBg;
    ctx.fillRect(width - 230, 12, 218, 64);
    ctx.fillStyle = '#5ec962';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`$${save.cash.toLocaleString('en-US')}`, width - 24, 40);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`Missions ${save.missionsDone}/5`, width - 24, 58);
    ctx.restore();
    this.drawBar(ctx, width - 218, 84, 194, 12, player.health / PLAYER.maxHealth, player.health > 30 ? '#5ec962' : '#ff2d55', 'HEALTH');
    if (player.inCar) {
      this.drawBar(ctx, width - 218, 102, 194, 12, player.inCar.health / 100, '#37e0d8', 'CAR');
    }

    // Mission objective, under the stars.
    const step = missions.currentStep();
    if (step) {
      ctx.save();
      ctx.fillStyle = PALETTE.hudBg;
      const label = `${missions.active.def.name} — ${step.label}`;
      ctx.font = 'bold 14px system-ui, sans-serif';
      const w = ctx.measureText(label).width + 28;
      ctx.fillRect(width / 2 - w / 2, 62, w, 30);
      ctx.fillStyle = '#37e0d8';
      ctx.textAlign = 'center';
      ctx.fillText(label, width / 2, 82);
      if (missions.active.timer !== null) {
        ctx.fillStyle = missions.active.timer < 30 ? '#ff2d55' : '#ffd166';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText(`${Math.ceil(missions.active.timer)}s`, width / 2, 108);
      }
      ctx.restore();
    } else if (missions.allDone()) {
      ctx.save();
      ctx.fillStyle = PALETTE.hudBg;
      ctx.fillRect(width / 2 - 150, 62, 300, 30);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ALL MISSIONS COMPLETE — PALMERA BAY IS YOURS', width / 2, 82);
      ctx.restore();
    }

    // Minimap, bottom left.
    const mapW = 220;
    const mapH = 172;
    const mapX = 14;
    const mapY = height - mapH - 14;
    city.drawMinimap(ctx, mapX, mapY, mapW, mapH, this.minimapMarkers(state));
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(mapX, mapY, mapW, mapH);
    ctx.fillStyle = '#fff3e0';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('PALMERA BAY', mapX + 6, mapY + 14);
    ctx.restore();

    // Speed + context hint, bottom right.
    ctx.save();
    ctx.textAlign = 'right';
    if (player.inCar) {
      const kmh = Math.round(Math.abs(player.inCar.speed) * 0.36);
      ctx.fillStyle = PALETTE.hudBg;
      ctx.fillRect(width - 150, height - 92, 136, 78);
      ctx.fillStyle = '#fff3e0';
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText(`${kmh}`, width - 44, height - 44);
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('km/h', width - 24, height - 44);
      ctx.fillStyle = PALETTE.hudAccent;
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(player.inCar.model, width - 24, height - 24);
    } else {
      ctx.fillStyle = PALETTE.hudBg;
      ctx.fillRect(width - 260, height - 92, 246, 78);
      ctx.fillStyle = PALETTE.hudText;
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('WASD move · Shift run · Click shoot', width - 24, height - 62);
      ctx.fillText('F punch · E enter car · M mute · P pause', width - 24, height - 42);
      ctx.fillText(`Ammo ${player.ammo}`, width - 24, height - 24);
    }
    ctx.restore();

    // Steal progress ring.
    if (player.stealTarget && player.stealProgress > 0) {
      ctx.save();
      ctx.translate(player.x, player.y - 34);
      ctx.fillStyle = 'rgba(12,8,24,0.8)';
      ctx.fillRect(-70, -12, 140, 18);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-68, -10, 136 * player.stealProgress, 14);
      ctx.fillStyle = '#fff3e0';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STEALING…', 0, 22);
      ctx.restore();
    }

    // Toasts, lower centre.
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    let ty = height - 130;
    for (const t of this.toasts) {
      ctx.globalAlpha = Math.min(1, t.life / 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, width / 2, ty);
      ty -= 22;
    }
    ctx.restore();

    // Centre message.
    if (this.messageTimer > 0 && this.message) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.messageTimer);
      ctx.fillStyle = 'rgba(12,8,24,0.8)';
      ctx.font = 'bold 22px system-ui, sans-serif';
      const w = ctx.measureText(this.message).width + 40;
      ctx.fillRect(width / 2 - w / 2, height / 2 - 110, w, 44);
      ctx.fillStyle = '#ffd166';
      ctx.textAlign = 'center';
      ctx.fillText(this.message, width / 2, height / 2 - 80);
      ctx.restore();
    }

    // Hurt vignette.
    if (player.hurtFlash > 0) {
      ctx.save();
      ctx.globalAlpha = player.hurtFlash * 0.9;
      const g = ctx.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.3,
        width / 2, height / 2, Math.max(width, height) * 0.7,
      );
      g.addColorStop(0, 'rgba(255,45,85,0)');
      g.addColorStop(1, 'rgba(255,45,85,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
    void time;
    void police;
    void cars;
    void peds;
  }

  minimapMarkers(state) {
    const markers = [];
    const { player, missions, police } = state;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    const m = missions.marker();
    if (m) markers.push({ x: m.x, y: m.y, color: m.color, r: 5 });
    for (const u of police.units) {
      if (!u.dead) markers.push({ x: u.x, y: u.y, color: '#2d7bff', r: 3 });
    }
    markers.push({ x: px, y: py, color: '#ffffff', r: 4 });
    return markers;
  }

  drawScreen(ctx, title, subtitle, lines) {
    const { width, height } = ctx.canvas;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 6, 22, 0.82)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText(title, width / 2, height / 2 - 120);
    ctx.fillStyle = '#ff5da2';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(subtitle, width / 2, height / 2 - 82);
    ctx.fillStyle = '#fff3e0';
    ctx.font = '16px system-ui, sans-serif';
    let y = height / 2 - 30;
    for (const line of lines) {
      ctx.fillText(line, width / 2, y);
      y += 26;
    }
    ctx.restore();
  }
}
