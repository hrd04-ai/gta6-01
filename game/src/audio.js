// Procedural sound for Palmera Bay: every effect is synthesized with
// WebAudio, so the game ships no audio files. The engine hums with speed,
// sirens wail in two tones, and a lazy bass line keeps the sunset mood.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineNodes = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.sirenOn = false;
    this.sirenNodes = null;
  }

  // Must be called from a user gesture (the start button).
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startMusic();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // A short burst of filtered noise, the base of gunshots, punches and crashes.
  noiseBurst(duration, filterFreq, gain, type = 'lowpass') {
    if (!this.ctx) return;
    const t = this.now();
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t);
    src.stop(t + duration);
  }

  // A pitched blip with an attack/decay envelope, the base of pickups and UI.
  blip(freqA, freqB, duration, gain, type = 'sine') {
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g); g.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  gunshot() { this.noiseBurst(0.16, 1800, 0.5, 'bandpass'); this.blip(160, 50, 0.12, 0.25, 'square'); }
  punch() { this.noiseBurst(0.09, 500, 0.4); }
  crash(intensity = 1) { this.noiseBurst(0.3, 300, 0.4 * intensity); this.blip(90, 35, 0.25, 0.3, 'sawtooth'); }
  pickup() { this.blip(660, 990, 0.12, 0.25); this.blip(990, 1320, 0.14, 0.2); }
  click() { this.blip(800, 700, 0.05, 0.15, 'square'); }
  denied() { this.blip(220, 140, 0.18, 0.2, 'square'); }
  sirenBlip() { this.blip(950, 700, 0.4, 0.06, 'sine'); }

  missionJingle() {
    if (!this.ctx) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => this.blip(f, f, 0.22, 0.22, 'triangle'), i * 110);
    });
  }

  failSting() {
    if (!this.ctx) return;
    [392, 311, 233].forEach((f, i) => {
      setTimeout(() => this.blip(f, f * 0.94, 0.3, 0.2, 'triangle'), i * 160);
    });
  }

  // Continuous engine drone while driving; pitch and loudness follow speed.
  startEngine() {
    if (!this.ctx || this.engineNodes) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 28;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const g = this.ctx.createGain();
    g.gain.value = 0.0;
    osc.connect(filter); osc2.connect(filter);
    filter.connect(g); g.connect(this.master);
    osc.start(); osc2.start();
    this.engineNodes = { osc, osc2, filter, g };
  }

  setEngine(speedRatio, on) {
    if (!this.engineNodes) return;
    const t = this.now();
    const target = on ? 0.05 + speedRatio * 0.09 : 0.0;
    this.engineNodes.g.gain.setTargetAtTime(target, t, 0.08);
    this.engineNodes.osc.frequency.setTargetAtTime(50 + speedRatio * 130, t, 0.06);
    this.engineNodes.osc2.frequency.setTargetAtTime(25 + speedRatio * 65, t, 0.06);
    this.engineNodes.filter.frequency.setTargetAtTime(380 + speedRatio * 900, t, 0.1);
  }

  stopEngine() {
    if (!this.engineNodes) return;
    const n = this.engineNodes;
    this.engineNodes = null;
    n.g.gain.setTargetAtTime(0, this.now(), 0.05);
    setTimeout(() => { try { n.osc.stop(); n.osc2.stop(); } catch { /* already stopped */ } }, 400);
  }

  // Two-tone police siren, looping while any police car is close.
  startSiren() {
    if (!this.ctx || this.sirenNodes) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 750;
    const g = this.ctx.createGain();
    g.gain.value = 0.045;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 0.7;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
    osc.connect(g); g.connect(this.master);
    osc.start(); lfo.start();
    this.sirenNodes = { osc, lfo, g };
    this.sirenOn = true;
  }

  stopSiren() {
    if (!this.sirenNodes) return;
    const n = this.sirenNodes;
    this.sirenNodes = null;
    this.sirenOn = false;
    n.g.gain.setTargetAtTime(0, this.now(), 0.1);
    setTimeout(() => { try { n.osc.stop(); n.lfo.stop(); } catch { /* already stopped */ } }, 500);
  }

  // A lazy sunset groove: soft bass notes and a brushed hat, scheduled
  // ahead so it never stutters while the game renders.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bassLine = [55, 0, 65.4, 0, 49, 0, 58.3, 0, 55, 0, 65.4, 0, 73.4, 65.4, 58.3, 49];
    const stepMs = 240;
    const playStep = () => {
      if (!this.ctx) return;
      const f = bassLine[this.musicStep % bassLine.length];
      if (f > 0) {
        const t = this.now();
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, t + stepMs / 1000 * 0.95);
        osc.connect(g); g.connect(this.master);
        osc.start(t); osc.stop(t + stepMs / 1000);
      }
      if (this.musicStep % 2 === 0) this.noiseBurst(0.03, 8000, 0.03, 'highpass');
      this.musicStep++;
    };
    playStep();
    this.musicTimer = setInterval(playStep, stepMs);
  }
}
