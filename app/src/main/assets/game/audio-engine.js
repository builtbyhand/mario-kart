/**
 * Pure Web Audio synthesizer engine for Mario Kart on Android.
 * Fully self-contained, offline, hardware-accelerated sound generation.
 */
export class AudioEngine {
  constructor({ volume = 0.55, musicVolume = 0.75, sfxVolume = 0.85 } = {}) {
    this.volume = volume;
    this.musicVolume = musicVolume;
    this.sfxVolume = sfxVolume;
    this.enabled = true;
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.registry = new Map();
    this.overrides = new Map();
  }

  ensureCtx() {
    if (!this.ctx) {
      const AudioCtx = (typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : null) || globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicVolume;
      this.musicBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVolume;
      this.sfxBus.connect(this.master);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMasterVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime);
    }
  }

  setMusicVolume(val) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
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

      async playTrack(url, { loop = true, gain = 0.8, fade = 0.6 } = {}) {
    if (!this.ctx) return;
    this._trackToken = (this._trackToken || 0) + 1;
    const token = this._trackToken;
    let buf = this._trackBuf && this._trackBuf.url === url ? this._trackBuf.buf : null;
    if (!buf) {
      const res = await fetch(url);
      if (!res.ok) return;
      buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      if (token !== this._trackToken) return;
      this._trackBuf = { url, buf };
    }
    this._fadeOutTrack(fade);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    src.buffer = buf;
    src.loop = loop;
    g.gain.setValueAtTime(0, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + fade);
    src.connect(g).connect(this.musicBus || this.master);
    src.start();
    this._track = { src, g };
  }

  _fadeOutTrack(fade = 0.4) {
    const t = this._track;
    this._track = null;
    if (!t || !this.ctx) return;
    const now = this.ctx.currentTime;
    t.g.gain.cancelScheduledValues(now);
    t.g.gain.setValueAtTime(t.g.gain.value, now);
    t.g.gain.linearRampToValueAtTime(0, now + fade);
    try { t.src.stop(now + fade + 0.05); } catch (e) {}
  }

  stopTrack(fade = 0.4) {
    this._trackToken = (this._trackToken || 0) + 1;
    this._fadeOutTrack(fade);
    this._trackBuf = null;
  }

  async loadFiles(manifestUrl = "audio/manifest.json") {
    if (!this.ctx) return;
    if (this._filesLoading) return this._filesLoading;
    this._filesLoading = (async () => {
      let manifest;
      try {
        const res = await fetch(manifestUrl);
        if (!res.ok) return;
        manifest = await res.json();
      } catch (e) {
        return;
      }
      this.sfxFiles = this.sfxFiles || new Map();
      await Promise.all(
        Object.entries(manifest).map(async ([name, url]) => {
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("HTTP " + res.status);
            const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
            if (name === "mk-music" || name === "mk-engine") this.overrides.set(name, buf);
            else this.sfxFiles.set(name, buf);
          } catch (e) {
            console.warn("[audio] failed to load", name, url, e);
          }
        })
      );
    })();
    return this._filesLoading;
  }

  register(name, fn) {
    this.registry.set(name, fn);
  }

  play(name, opts = {}) {
    if (!this.enabled) return;
    this.ensureCtx();
    if (!this.ctx) return;
        const file = this.sfxFiles && this.sfxFiles.get(name);
    if (file) {
      const src = this.ctx.createBufferSource();
      src.buffer = file;
      src.connect(this.sfxBus || this.master);
      src.start();
      return;
    }
    
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
    bus = "sfx",
  } = {}) {
    if (!this.enabled) return;
    this.ensureCtx();
    if (!this.ctx) return;
    const targetBus = bus === "music" ? (this.musicBus || this.master) : (this.sfxBus || this.master);
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
    osc.connect(g).connect(targetBus);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  noise({
    dur = 0.2,
    gain = 0.1,
    freq = 1000,
    sweepTo = null,
    delay = 0,
    bus = "sfx",
  } = {}) {
    if (!this.enabled) return;
    this.ensureCtx();
    if (!this.ctx) return;
    const targetBus = bus === "music" ? (this.musicBus || this.master) : (this.sfxBus || this.master);
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
    noise.connect(filter).connect(g).connect(targetBus);
    noise.start(now);
    noise.stop(now + dur + 0.05);
  }
}
