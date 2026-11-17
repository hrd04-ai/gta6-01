// All sound is synthesized with WebAudio: no audio files, nothing fetched.
// Engine drone, police siren, gunshots, punches, crashes, pickups, jingles
// and a looping bass-line groove, all built from oscillators and noise.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.musicTimer = null;
    this.musicOn = false;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngine();
      this.startSiren();
      return true;
    } catch {
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  noiseBuffer(seconds = 0.5) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  blip(freq, dur, type = 'sine', vol = 0.25, slideTo = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  burst(dur = 0.2, vol = 0.4, lowpass = 3000) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur + 0.1);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  startEngine() {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start();
    this.engineOsc = osc;
    this.engineGain = gain;
  }

  setEngine(speed01, inCar) {
    if (!this.ctx || !this.engineOsc) return;
    const target = inCar ? 0.05 + speed01 * 0.1 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.08);
  }

  startSiren() {
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 720;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0;
    osc.connect(gain).connect(this.master);
    osc.start();
    this.sirenOsc = osc;
    this.sirenGain = gain;
    let high = false;
    this.sirenTimer = window.setInterval(() => {
      if (!this.ctx) return;
      high = !high;
      this.sirenOsc.frequency.setTargetAtTime(high ? 960 : 720, this.ctx.currentTime, 0.03);
    }, 420);
  }

  setSiren(on) {
    if (!this.ctx || !this.sirenGain) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0.0, this.ctx.currentTime, 0.15);
  }

  shot() { this.burst(0.16, 0.5, 5200); this.blip(180, 0.08, 'square', 0.2, 60); }
  punch() { this.burst(0.09, 0.3, 900); this.blip(120, 0.09, 'sine', 0.3, 55); }
  crash() { this.burst(0.35, 0.5, 1200); this.blip(90, 0.25, 'sawtooth', 0.2, 40); }
  pickup() { this.blip(660, 0.12, 'sine', 0.25); window.setTimeout(() => this.blip(990, 0.16, 'sine', 0.25), 90); }
  click() { this.blip(1200, 0.04, 'square', 0.12); }
  denied() { this.blip(160, 0.18, 'square', 0.2, 110); }
  reload() { this.blip(500, 0.05, 'square', 0.15); window.setTimeout(() => this.blip(700, 0.05, 'square', 0.15), 120); }

  jingle() {
    if (!this.ctx) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => window.setTimeout(() => this.blip(f, 0.22, 'triangle', 0.28), i * 110));
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    // A slow sunset groove: root notes with a syncopated bass figure.
    const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
    let step = 0;
    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.ctx) return;
      const f = bass[step % bass.length];
      this.blip(f, 0.32, 'triangle', 0.11);
      if (step % 4 === 2) this.blip(f * 2, 0.14, 'sine', 0.05);
      step++;
    }, 240);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}
