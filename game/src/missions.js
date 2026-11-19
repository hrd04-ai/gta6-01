// Story missions for Palmera Bay: Sunset Heat.
// Five jobs from Vera Solano and Tommy Waves, each a short chain of
// steps: go somewhere, pick something up, steal a car, lose the cops,
// hold up the bank. The manager owns the active mission, its timer and
// its markers; main.js feeds it the world and reads its events.

import { MISSIONS } from './config.js';

export class MissionManager {
  constructor() {
    this.defs = MISSIONS;
    this.active = null; // { def, stepIndex, timer, robTimer, startedAt }
    this.completed = new Set();
    this.events = []; // consumed by main.js each frame
    this.missionCar = null;
  }

  loadCompleted(ids) {
    this.completed = new Set(ids ?? []);
  }

  available() {
    return this.defs.filter((d) => !this.completed.has(d.id));
  }

  next() {
    return this.available()[0] ?? null;
  }

  allDone() {
    return this.available().length === 0;
  }

  start(def, ctx) {
    if (this.active) return false;
    this.active = {
      def,
      stepIndex: 0,
      timer: def.timeLimit ?? null,
      robTimer: 0,
      evadeArmed: false,
    };
    this.events.push({ type: 'mission-start', mission: def });
    ctx.audio.missionStart();
    if (def.id === 'hot-wheels') this.spawnMissionCar(ctx);
    if (def.id === 'heat-wave') {
      ctx.police.crime(3, 'heat-wave');
      this.active.evadeArmed = true;
    }
    return true;
  }

  spawnMissionCar(ctx) {
    const { Car } = ctx.vehicleModule;
    const car = new Car(1470, 1050, Math.PI / 2, {
      color: '#ffd166',
      model: 'Sunset GT',
      kind: 'parked',
      driver: 'none',
    });
    car.isMissionCar = true;
    ctx.cars.push(car);
    this.missionCar = car;
  }

  abort(reason) {
    if (!this.active) return;
    this.events.push({ type: 'mission-fail', mission: this.active.def, reason });
    if (this.missionCar) {
      this.missionCar.isMissionCar = false;
      this.missionCar = null;
    }
    this.active = null;
  }

  completeStep(ctx) {
    const m = this.active;
    m.stepIndex += 1;
    ctx.audio.pickup();
    ctx.effects.floatText(ctx.player.x, ctx.player.y - 30, 'Objective complete', '#ffd166');
    if (m.stepIndex >= m.def.steps.length) this.finishMission(ctx);
  }

  finishMission(ctx) {
    const m = this.active;
    const payout = m.def.payout;
    this.completed.add(m.def.id);
    this.events.push({ type: 'mission-done', mission: m.def, payout });
    ctx.audio.missionDone();
    ctx.effects.floatText(ctx.player.x, ctx.player.y - 40, `+$${payout}`, '#5ec962');
    if (this.missionCar) {
      this.missionCar.isMissionCar = false;
      this.missionCar = null;
    }
    this.active = null;
  }

  currentStep() {
    return this.active ? this.active.def.steps[this.active.stepIndex] : null;
  }

  objectiveText() {
    const step = this.currentStep();
    if (!step) return null;
    return step.label;
  }

  marker() {
    const step = this.currentStep();
    if (!step) return null;
    if (step.kind === 'steal' && this.missionCar) {
      return { x: this.missionCar.x, y: this.missionCar.y, color: '#ffd166' };
    }
    if (step.kind === 'evade') return null;
    if (step.x === 0 && step.y === 0) return null;
    return { x: step.x, y: step.y, color: '#37e0d8' };
  }

  update(dt, ctx) {
    if (!this.active) return;
    const m = this.active;
    const step = this.currentStep();
    if (!step) return;
    const p = ctx.player;

    if (m.timer !== null) {
      m.timer -= dt;
      if (m.timer <= 0) {
        this.abort('Out of time.');
        ctx.audio.missionFail();
        return;
      }
    }

    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;

    switch (step.kind) {
      case 'goto': {
        if (Math.hypot(step.x - px, step.y - py) < 64) this.completeStep(ctx);
        break;
      }
      case 'pickup': {
        if (!p.inCar && Math.hypot(step.x - p.x, step.y - p.y) < 52) this.completeStep(ctx);
        break;
      }
      case 'steal': {
        if (this.missionCar && p.inCar === this.missionCar) {
          ctx.police.crime(1, 'car-theft');
          this.completeStep(ctx);
        }
        break;
      }
      case 'deliver-car': {
        if (p.inCar && p.inCar.isMissionCar && Math.hypot(step.x - px, step.y - py) < 80) {
          this.completeStep(ctx);
        }
        break;
      }
      case 'evade': {
        if (ctx.police.wanted.stars === 0) this.completeStep(ctx);
        break;
      }
      case 'rob': {
        const d = Math.hypot(step.x - px, step.y - py);
        if (d < 70) {
          m.robTimer += dt;
          if (m.robTimer > 0.6 && Math.floor(m.robTimer * 2) !== Math.floor((m.robTimer - dt) * 2)) {
            ctx.effects.floatText(px + 30, py - 30, '$', '#5ec962');
          }
          if (m.robTimer >= 6) {
            ctx.police.crime(4, 'bank-robbery');
            this.completeStep(ctx);
          }
        } else {
          m.robTimer = Math.max(0, m.robTimer - dt * 2);
        }
        break;
      }
      default:
        break;
    }
  }

  drawMarker(ctx, time) {
    const m = this.marker();
    if (!m) return;
    const pulse = 1 + Math.sin(time * 4) * 0.18;
    ctx.save();
    ctx.strokeStyle = m.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 46 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y - 34 * pulse);
    ctx.lineTo(m.x - 10, m.y - 52 * pulse);
    ctx.lineTo(m.x + 10, m.y - 52 * pulse);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawRobProgress(ctx) {
    if (!this.active) return;
    const step = this.currentStep();
    if (!step || step.kind !== 'rob') return;
    const p = this.active.robTimer / 6;
    ctx.save();
    ctx.fillStyle = 'rgba(12,8,24,0.75)';
    ctx.fillRect(step.x - 90, step.y - 84, 180, 16);
    ctx.fillStyle = '#5ec962';
    ctx.fillRect(step.x - 88, step.y - 82, 176 * Math.min(1, p), 12);
    ctx.fillStyle = '#fff3e0';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EMPTYING THE VAULT…', step.x, step.y - 92);
    ctx.restore();
  }
}
