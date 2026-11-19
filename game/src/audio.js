// Synthesised sound for Palmera Bay: Sunset Heat.
// No audio files: every effect is built from WebAudio oscillators and
// noise, and a small sunset-drive music loop runs on a scheduler. The
// audio context is created lazily on the first user gesture, so the
// game never autoplay-blocks in the browser.

const MUSIC_NOTES = [
  // A lazy sunset-drive progression: Am — F — C — G, two bars each.
  [220.0, 261.63, 329.63], [174.61, 220.0, 261.63],
  [130.81, 196.0, 261.63], [196.0, 246.94, 293.66],
];
const BASS_NOTES = [55.0, 43.65, 65.41, 49.0];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.musicOn = true;
    this._musicTimer = null;
    this._step = 0;
    this._engineOsc = null;
    this._engineGain = null;
    this._sirenOsc = null;
    this._sirenGain = null;
    this._sirenLfo = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);
    } catch {
      return false;
    }
    return true;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.55;
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (!this.musicOn) this.stopMusic();
    else this.startMusic();
    return this.musicOn;
  }

  _noiseBuffer(seconds = 0.5) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _tone({ freq = 440, freqEnd = null, type = 'sine', dur = 0.2, vol = 0.3, when = 0, dest = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(dest ?? this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  _noise({ dur = 0.2, vol = 0.3, filterFreq = 1200, type = 'lowpass', when = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur + 0.1);
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  shot() {
    this._noise({ dur: 0.14, vol: 0.5, filterFreq: 2400, type: 'bandpass' });
    this._tone({ freq: 180, freqEnd: 60, type: 'square', dur: 0.09, vol: 0.25 });
  }

  punch() {
    this._noise({ dur: 0.08, vol: 0.35, filterFreq: 500 });
  }

  pickup() {
    this._tone({ freq: 660, dur: 0.09, vol: 0.28 });
    this._tone({ freq: 990, dur: 0.14, vol: 0.28, when: 0.08 });
  }

  cash() {
    this._tone({ freq: 880, dur: 0.1, vol: 0.25 });
    this._tone({ freq: 1174, dur: 0.1, vol: 0.25, when: 0.09 });
    this._tone({ freq: 1568, dur: 0.22, vol: 0.25, when: 0.18 });
  }

  missionStart() {
    [523, 659, 784].forEach((f, i) => this._tone({ freq: f, dur: 0.16, vol: 0.26, when: i * 0.1 }));
  }

  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => this._tone({ freq: f, dur: 0.2, vol: 0.28, when: i * 0.11 }));
  }

  missionFail() {
    [392, 330, 262].forEach((f, i) => this._tone({ freq: f, dur: 0.25, vol: 0.26, when: i * 0.14, type: 'triangle' }));
  }

  crash() {
    this._noise({ dur: 0.3, vol: 0.5, filterFreq: 700 });
    this._tone({ freq: 90, freqEnd: 40, type: 'sawtooth', dur: 0.25, vol: 0.3 });
  }

  explosion() {
    this._noise({ dur: 0.8, vol: 0.7, filterFreq: 400 });
    this._tone({ freq: 120, freqEnd: 28, type: 'sawtooth', dur: 0.7, vol: 0.4 });
  }

  sirenBlip() {
    this._tone({ freq: 980, freqEnd: 1240, type: 'sine', dur: 0.18, vol: 0.2 });
  }

  doorSlam() {
    this._noise({ dur: 0.1, vol: 0.4, filterFreq: 300 });
  }

  busted() {
    [660, 520, 390].forEach((f, i) => this._tone({ freq: f, dur: 0.3, vol: 0.25, when: i * 0.18, type: 'triangle' }));
  }

  // Continuous engine hum whose pitch follows the car's speed (0..1).
  setEngine(speedNorm, driving) {
    if (!this.ctx) return;
    if (!driving) {
      if (this._engineOsc) {
        this._engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
      return;
    }
    if (!this._engineOsc) {
      this._engineOsc = this.ctx.createOscillator();
      this._engineOsc.type = 'sawtooth';
      this._engineGain = this.ctx.createGain();
      this._engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      this._engineOsc.connect(filter);
      filter.connect(this._engineGain);
      this._engineGain.connect(this.sfxGain);
      this._engineOsc.start();
    }
    const t = this.ctx.currentTime;
    this._engineOsc.frequency.setTargetAtTime(55 + speedNorm * 165, t, 0.06);
    this._engineGain.gain.setTargetAtTime(0.05 + speedNorm * 0.06, t, 0.08);
  }

  // A two-tone police siren that follows the player while wanted.
  setSiren(active) {
    if (!this.ctx) return;
    if (!active) {
      if (this._sirenGain) this._sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      return;
    }
    if (!this._sirenOsc) {
      this._sirenOsc = this.ctx.createOscillator();
      this._sirenOsc.type = 'triangle';
      this._sirenOsc.frequency.value = 750;
      this._sirenLfo = this.ctx.createOscillator();
      this._sirenLfo.type = 'square';
      this._sirenLfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 260;
      this._sirenLfo.connect(lfoGain);
      lfoGain.connect(this._sirenOsc.frequency);
      this._sirenGain = this.ctx.createGain();
      this._sirenGain.gain.value = 0;
      this._sirenOsc.connect(this._sirenGain);
      this._sirenGain.connect(this.sfxGain);
      this._sirenOsc.start();
      this._sirenLfo.start();
    }
    this._sirenGain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.3);
  }

  startMusic() {
    if (!this.ctx || this._musicTimer || !this.musicOn) return;
    const stepDur = 0.31; // eighth notes at ~96 bpm
    this._musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicOn) return;
      const chord = MUSIC_NOTES[Math.floor(this._step / 8) % MUSIC_NOTES.length];
      const bass = BASS_NOTES[Math.floor(this._step / 8) % BASS_NOTES.length];
      const note = chord[this._step % 3];
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = this._step % 8 === 0 ? note * 2 : note;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 1.8);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + stepDur * 2);
      if (this._step % 4 === 0) {
        const b = this.ctx.createOscillator();
        b.type = 'sine';
        b.frequency.value = bass;
        const bg = this.ctx.createGain();
        bg.gain.setValueAtTime(0.0001, t);
        bg.gain.exponentialRampToValueAtTime(0.7, t + 0.03);
        bg.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 3.5);
        b.connect(bg);
        bg.connect(this.musicGain);
        b.start(t);
        b.stop(t + stepDur * 4);
      }
      this._step++;
    }, stepDur * 1000);
  }

  stopMusic() {
    if (this._musicTimer) {
      window.clearInterval(this._musicTimer);
      this._musicTimer = null;
    }
  }
}
