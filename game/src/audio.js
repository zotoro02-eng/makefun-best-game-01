// Lumen Harvest — all sound is synthesized with WebAudio: no audio files,
// no network, just oscillators and filtered noise. The SoundBank is created
// on the first user gesture (browsers block audio before one) and stays
// muted until then. M toggles mute.

export class SoundBank {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.padNodes = null;
    this.padTimer = null;
  }

  // Call from a user gesture (click / keydown). Safe to call repeatedly.
  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.context.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.context.currentTime, 0.02);
    }
  }

  // One short oscillator blip with a pitch glide and an exponential fade.
  tone({ type = 'sine', from = 440, to = null, duration = 0.12, volume = 0.2, delay = 0 }) {
    if (!this.context || this.muted) return;
    const t0 = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  // A burst of filtered white noise (whooshes, pops, thuds).
  noise({ duration = 0.2, volume = 0.25, filterFrom = 1200, filterTo = 200, type = 'bandpass', delay = 0 }) {
    if (!this.context || this.muted) return;
    const t0 = this.context.currentTime + delay;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(filterFrom, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterTo), t0 + duration);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t0);
    source.stop(t0 + duration);
  }

  shoot() {
    this.tone({ type: 'square', from: 880, to: 320, duration: 0.07, volume: 0.07 });
  }

  // The mote chime climbs with the combo: the better you play, the brighter it sounds.
  collect(combo) {
    const step = Math.min(combo, 24);
    const base = 523 * Math.pow(2, step / 12);
    this.tone({ type: 'sine', from: base, duration: 0.16, volume: 0.16 });
    this.tone({ type: 'sine', from: base * 1.5, duration: 0.2, volume: 0.08, delay: 0.03 });
  }

  enemyPop() {
    this.noise({ duration: 0.16, volume: 0.22, filterFrom: 900, filterTo: 120 });
    this.tone({ type: 'triangle', from: 220, to: 60, duration: 0.14, volume: 0.14 });
  }

  hurt() {
    this.noise({ duration: 0.3, volume: 0.35, filterFrom: 500, filterTo: 60, type: 'lowpass' });
    this.tone({ type: 'sawtooth', from: 160, to: 40, duration: 0.3, volume: 0.2 });
  }

  dash() {
    this.noise({ duration: 0.18, volume: 0.14, filterFrom: 2400, filterTo: 400 });
  }

  pickup() {
    this.tone({ type: 'sine', from: 660, to: 990, duration: 0.14, volume: 0.16 });
    this.tone({ type: 'sine', from: 990, to: 1320, duration: 0.18, volume: 0.12, delay: 0.07 });
  }

  waveHorn() {
    this.tone({ type: 'triangle', from: 196, duration: 0.5, volume: 0.18 });
    this.tone({ type: 'triangle', from: 294, duration: 0.5, volume: 0.16, delay: 0.08 });
    this.tone({ type: 'triangle', from: 392, duration: 0.6, volume: 0.16, delay: 0.16 });
  }

  bossRoar() {
    this.tone({ type: 'sawtooth', from: 90, to: 45, duration: 0.8, volume: 0.22 });
    this.noise({ duration: 0.7, volume: 0.2, filterFrom: 300, filterTo: 60, type: 'lowpass' });
  }

  victory() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => {
      this.tone({ type: 'triangle', from: freq, duration: 0.5, volume: 0.18, delay: i * 0.13 });
    });
  }

  gameOver() {
    const notes = [392, 330, 262, 196];
    notes.forEach((freq, i) => {
      this.tone({ type: 'triangle', from: freq, duration: 0.55, volume: 0.16, delay: i * 0.2 });
    });
  }

  // A slow two-oscillator pad that drifts under the game, plus a soft
  // bell every few bars so the menu never sits in silence.
  startPad() {
    if (!this.context || this.padNodes) return;
    const ctx = this.context;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.045;
    padGain.connect(this.master);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.connect(padGain);
    const oscA = ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 110;
    const oscB = ctx.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.value = 164.81;
    oscB.detune.value = 4;
    oscA.connect(filter);
    oscB.connect(filter);
    oscA.start();
    oscB.start();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 280;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    this.padNodes = { oscA, oscB, lfo, padGain };
    const bellNotes = [440, 554.37, 659.25, 880];
    let bellIndex = 0;
    this.padTimer = window.setInterval(() => {
      if (this.muted) return;
      const freq = bellNotes[bellIndex % bellNotes.length];
      bellIndex++;
      this.tone({ type: 'sine', from: freq, duration: 1.6, volume: 0.035 });
    }, 5200);
  }

  stopPad() {
    if (this.padTimer !== null) {
      window.clearInterval(this.padTimer);
      this.padTimer = null;
    }
    if (this.padNodes) {
      const { oscA, oscB, lfo } = this.padNodes;
      try {
        oscA.stop();
        oscB.stop();
        lfo.stop();
      } catch {
        // Already stopped; nothing to do.
      }
      this.padNodes = null;
    }
  }
}
