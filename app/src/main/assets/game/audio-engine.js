/**
 * Pure Web Audio synthesizer engine for Mario Kart on Android.
 * Fully self-contained, offline, hardware-accelerated sound generation.
 */
export class AudioEngine {
  constructor({ volume = 0.55 } = {}) {
    this.volume = volume;
    this.enabled = true;
    this.ctx = null;
    this.master = null;
    this.registry = new Map();
    this.overrides = new Map();
  }

  ensureCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  async unlock() {
    this.ensureCtx();
    if (this.ctx && this.ctx.state === "suspended") {
      try {
        await Promise.race([
          this.ctx.resume(),
          new Promise((r) => setTimeout(r, 120))
        ]);
      } catch (e) {}
    }
  }

  register(name, fn) {
    this.registry.set(name, fn);
  }

  play(name, opts = {}) {
    if (!this.enabled) return;
    this.ensureCtx();
    if (!this.ctx) return;
    const handler = this.registry.get(name);
    if (handler) {
      handler(this, opts);
    }
  }

  async loadOverride(name) {
    return this.overrides.get(name) || null;
  }

  tone({
    freq = 440,
    dur = 0.2,
    type = "sine",
    gain = 0.1,
    slideTo = null,
    delay = 0,
  } = {}) {
    if (!this.enabled) return;
    this.ensureCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + dur);
    }
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  noise({
    dur = 0.2,
    gain = 0.1,
    freq = 1000,
    sweepTo = null,
    delay = 0,
  } = {}) {
    if (!this.enabled) return;
    this.ensureCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const bufferSize = Math.floor(this.ctx.sampleRate * Math.min(dur, 2));
    if (bufferSize <= 0) return;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq, now);
    if (sweepTo !== null) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(10, sweepTo),
        now + dur
      );
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    noise.connect(filter).connect(g).connect(this.master);
    noise.start(now);
    noise.stop(now + dur + 0.05);
  }
}
