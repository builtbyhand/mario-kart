import { AudioEngine } from "./audio-engine.js";
import { SampledKartAudio } from "./sample-audio.js";
import { EVENT_TYPES } from "./logic.js";
export const AUDIO_SLOTS = [
  ...EVENT_TYPES.map((t) => "mk-" + t),
  "mk-engine",
  "mk-music",
];
export function engineFrequency(speed) {
  return 48 + Math.min(60, Math.abs(Number.isFinite(speed) ? speed : 0)) * 3.1;
}
export class KartAudio {
  constructor() {
    let savedMaster = 0.8, savedMusic = 0.75, savedSfx = 0.85;
    try {
      if (typeof localStorage !== "undefined") {
        const m = localStorage.getItem("mariokart.volume.master");
        const mu = localStorage.getItem("mariokart.volume.music");
        const s = localStorage.getItem("mariokart.volume.sfx");
        if (m !== null) savedMaster = Number(m) / 100;
        if (mu !== null) savedMusic = Number(mu) / 100;
        if (s !== null) savedSfx = Number(s) / 100;
      }
    } catch (_) {}

    this.engine = new AudioEngine({
      volume: isNaN(savedMaster) ? 0.8 : savedMaster,
      musicVolume: isNaN(savedMusic) ? 0.75 : savedMusic,
      sfxVolume: isNaN(savedSfx) ? 0.85 : savedSfx,
    });
    this.musicVolume = this.engine.musicVolume;
    this.sfxVolume = this.engine.sfxVolume;
    this.original = new SampledKartAudio(this.engine);
    this.motor = null;
    this.screech = null;
    this.music = null;
    this.musicGain = null;
    this.stopped = false;
    this.beat = 0;
    this.nextBeat = 0;
    for (const [i, type] of EVENT_TYPES.entries())
      this.engine.register("mk-" + type, (a, opts = {}) => {
        if (type === "wall") {
          a.noise({ dur: 0.22, gain: 0.16, freq: 2400, sweepTo: 600 });
          a.tone({ freq: 110, slideTo: 65, dur: 0.2, type: "triangle", gain: 0.08 });
        } else if (["hit", "burnout", "bump"].includes(type)) {
          a.noise({ dur: 0.3, gain: 0.23, freq: 500, sweepTo: 90 });
          a.tone({
            freq: 145,
            slideTo: 48,
            dur: 0.35,
            type: "sawtooth",
            gain: 0.09,
          });
        } else if (type === "hop") {
          a.tone({ freq: 220, slideTo: 360, dur: 0.08, gain: 0.06, type: "sine" });
        } else if (type === "drift") {
          const tier = opts.tier || 1;
          const chimeNotes = [
            [],
            [880, 1174],
            [1046, 1318, 1568],
            [1318, 1568, 1760, 2093]
          ][Math.min(3, tier)] || [880, 1174];
          chimeNotes.forEach((freq, ci) => {
            a.tone({ freq, delay: ci * 0.045, dur: 0.18, gain: 0.09, type: "triangle" });
          });
        } else if (
          ["boost", "turbo", "rocket", "glider", "antigrav"].includes(type)
        ) {
          a.noise({ dur: 0.35, gain: 0.13, freq: 500, sweepTo: 4000 });
          a.tone({
            freq: 260,
            slideTo: 1100,
            dur: 0.3,
            type: "triangle",
            gain: 0.13,
          });
        } else if (["finish", "results", "finalLap"].includes(type)) {
          [523, 659, 784, 1047].forEach((freq, j) =>
            a.tone({
              freq,
              delay: j * 0.1,
              dur: 0.3,
              gain: 0.15,
              type: "triangle",
            }),
          );
        } else if (type === "countdown" || type === "go")
          a.tone({
            freq: type === "go" ? 1047 : 523,
            dur: type === "go" ? 0.35 : 0.15,
            type: "square",
            gain: 0.09,
          });
        else {
          a.tone({
            freq: type === "coin" ? 1318 : 440 + (i % 8) * 90,
            dur: 0.13,
            gain: 0.12,
            type: "triangle",
          });
          if (type === "coin")
            a.tone({ freq: 1760, dur: 0.16, delay: 0.065, gain: 0.1 });
        }
      });
  }
    async playTrack(url, opts) {
    try {
      await this.unlock();
      if (this.original?.ready) {
        this._pendingTrack = null;
        this.engine.stopTrack(0.1);
        return;
      }
      const ctx = this.engine.ctx;
      if (!ctx || ctx.state !== "running") { this._pendingTrack = [url, opts]; return; }
      this._pendingTrack = null;
      await this.engine.playTrack(url, opts);
    } catch (e) {}
  }
  stopTrack(fade) {
    this._pendingTrack = null;
    this.engine.stopTrack(fade);
  }
  prepare() { return this.original.prepare(); }
  async unlock() {
    await this.engine.unlock();
        if (!this.engine.ctx) return;
    await this.engine.loadFiles();
    if (await this.prepare()) {
      this.engine.master.gain.setValueAtTime(this.engine.enabled ? this.engine.volume : 0, this.engine.ctx.currentTime);
      return;
    }
    this.stopped = false;
    this.engine.master.gain.setValueAtTime(
      this.engine.enabled ? this.engine.volume : 0,
      this.engine.ctx.currentTime,
    );
    if (!this.motor) {
      const ctx = this.engine.ctx,
        g = ctx.createGain(),
        filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 550;
      g.gain.value = 0;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 48;
      osc.connect(filter).connect(g).connect(this.engine.sfxBus || this.engine.master);
      osc.start();
      this.motor = { osc, g, filter, override: null };

      // Tire screech & brake squeal synthesizer
      const screechG = ctx.createGain();
      screechG.gain.value = 0;
      const screechFilter = ctx.createBiquadFilter();
      screechFilter.type = "bandpass";
      screechFilter.frequency.value = 850;
      if (screechFilter.Q) screechFilter.Q.value = 3.0;
      const screechOsc = ctx.createOscillator();
      screechOsc.type = "sawtooth";
      screechOsc.frequency.value = 700;
      screechOsc.connect(screechFilter).connect(screechG).connect(this.engine.sfxBus || this.engine.master);
      screechOsc.start();
      this.screech = { osc: screechOsc, filter: screechFilter, g: screechG };
      this.engine.loadOverride("mk-engine").then((buffer) => {
        if (!buffer || !this.motor) return;
        const s = ctx.createBufferSource();
        s.buffer = buffer;
        s.loop = true;
        s.connect(g);
        s.start();
        this.motor.override = s;
        osc.disconnect();
      });
      this.engine.loadOverride("mk-music").then((buffer) => {
        if (!buffer || this.music || this.stopped) return;
        const src = ctx.createBufferSource(),
          gain = ctx.createGain();
        src.buffer = buffer;
        src.loop = true;
        gain.gain.value = 0;
        src.connect(gain).connect(this.engine.musicBus || this.engine.master);
        src.start();
        this.music = src;
        this.musicGain = gain;
      });
    }
  }

  setMasterVolume(val) {
    this.engine.setMasterVolume(val);
  }

  setMusicVolume(val) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    this.engine.setMusicVolume(this.musicVolume);
    if (this.original?.buses?.music && this.engine.ctx) {
      this.original.buses.music.gain.setValueAtTime(0.72 * this.musicVolume, this.engine.ctx.currentTime);
    }
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    this.engine.setSfxVolume(this.sfxVolume);
    if (this.original?.buses && this.engine.ctx) {
      for (const [key, base] of Object.entries({stinger:1, ui:1, effects:1, engine:0.8, voice:0.9, ambience:0.6})) {
        if (this.original.buses[key]) {
          this.original.buses[key].gain.setValueAtTime(base * this.sfxVolume, this.engine.ctx.currentTime);
        }
      }
    }
  }
  get resultsReady(){return this.original.ready ? this.original.resultsReady : !this.engine.ctx || this.engine.ctx.state !== 'running' || this.engine.ctx.currentTime >= (this.fallbackFinishUntil || 0);}
  presentResults(race,duration){this.original.presentResults(race,duration);}
  async ui(kind='confirm') {
    try {
      await this.unlock();
            if (this._pendingTrack && this.engine.ctx && this.engine.ctx.state === "running") {
        const p = this._pendingTrack;
        this._pendingTrack = null;
        this.playTrack(p[0], p[1]);
      }
      if (!this.engine.enabled) return;
      const key={cursor:'uiCursor',confirm:'uiConfirm',cancel:'uiCancel',start:'uiStart'}[kind];
      if(this.original.ready&&this.original.buffers.has(key))this.original.play(key,{bus:'ui'});
            else if (this.engine.sfxFiles?.has('ui-' + kind)) this.engine.play('ui-' + kind);
      else this.engine.tone({freq:kind==='cursor'?880:660,dur:.055,gain:.06,type:'sine'});
    } catch (e) {}
  }
  event(e, race) {
    if (race && this.original.event(e, race)) return;
    if (e.racer !== 0) return;
    if (e.type === 'finish') this.fallbackFinishUntil = (this.engine.ctx?.currentTime || 0) + .6;
    this.engine.play("mk-" + e.type, e);
  }
  update(race) {
    if (this.original.ready) { this.original.update(race); return; }
    const ctx = this.engine.ctx;
    if (!ctx || !this.motor) return;
    const r = race.player,
      active = !["ready", "results"].includes(race.state);
    const isGas = Boolean(r.lastInput?.gas);
    const isBrake = Boolean(r.lastInput?.brake);

    if (this.motor.filter) {
      this.motor.filter.frequency.setTargetAtTime(
        isGas ? 720 : 460,
        ctx.currentTime,
        0.08
      );
    }
    this.motor.osc.frequency.setTargetAtTime(
      engineFrequency(r.speed) + (isGas ? 8 : 0),
      ctx.currentTime,
      0.045,
    );
    if (this.motor.override)
      this.motor.override.playbackRate.setTargetAtTime(
        0.7 + Math.abs(r.speed) / 36,
        ctx.currentTime,
        0.05,
      );
    if (this.musicGain)
      this.musicGain.gain.setTargetAtTime(
        active ? (0.6 * this.musicVolume) : 0,
        ctx.currentTime,
        0.25,
      );
    this.motor.g.gain.setTargetAtTime(
      active ? 0.028 + (Math.abs(r.speed) / 55) * 0.022 : 0,
      ctx.currentTime,
      0.15,
    );

    // Dynamic screech / squeal sound
    if (this.screech) {
      if (r.drift && active && r.speed > 8) {
        const targetFreq = 700 + ((r.charge || 0) / 3.4) * 450;
        this.screech.osc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.05);
        this.screech.filter.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.05);
        this.screech.g.gain.setTargetAtTime(0.04 * this.sfxVolume, ctx.currentTime, 0.05);
      } else if (isBrake && r.speed > 12 && active) {
        this.screech.osc.frequency.setTargetAtTime(1250, ctx.currentTime, 0.05);
        this.screech.filter.frequency.setTargetAtTime(1250, ctx.currentTime, 0.05);
        this.screech.g.gain.setTargetAtTime(0.03 * this.sfxVolume, ctx.currentTime, 0.05);
      } else {
        this.screech.g.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
      }
    }

    if (
      !this.music &&
      active &&
      ctx.state === "running" &&
      ctx.currentTime >= this.nextBeat
    ) {
      // Original syncopated stadium groove, never a Nintendo melody transcription.
      const notes = [196, 246.94, 293.66, 329.63, 220, 261.63, 329.63, 392];
      this.engine.tone({
        freq: notes[this.beat % 8],
        dur: 0.15,
        type: "triangle",
        gain: 0.045,
        bus: "music",
      });
      if (this.beat % 2 === 0)
        this.engine.tone({ freq: 73.42, slideTo: 40, dur: 0.12, gain: 0.07, bus: "music" });
      if (this.beat % 4 === 2)
        this.engine.noise({ dur: 0.08, freq: 1700, gain: 0.035, bus: "music" });
      this.nextBeat = ctx.currentTime + (race.laps > 1 && r.lap === race.laps ? 0.19 : 0.225);
      this.beat++;
    }
  }
  stop() {
    this.original.stop();
    this.stopped = true;
    if (this.music) {
      try {
        this.music.stop();
      } catch {}
    }
    if (this.screech) {
      try {
        this.screech.osc.stop();
      } catch {}
      this.screech = null;
    }
    if (this.motor) {
      this.motor.osc.stop();
      this.motor.override?.stop();
      this.motor = null;
    }
    this.engine.ctx?.suspend?.();
  }
}
