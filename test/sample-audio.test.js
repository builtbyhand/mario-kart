import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SampledKartAudio } from "../app/src/main/assets/game/sample-audio.js";
import { KartAudio } from "../app/src/main/assets/game/audio.js";

function createMockAudioContext() {
  const makeNode = () => ({
    gain: { value: 1, setValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; }, cancelScheduledValues() {} },
    playbackRate: { value: 1, setTargetAtTime(v) { this.value = v; } },
    pan: { value: 0 },
    threshold: { value: 0 },
    knee: { value: 0 },
    ratio: { value: 0 },
    attack: { value: 0 },
    release: { value: 0 },
    connect() { return makeNode(); },
    disconnect() {},
    start() {},
    stop() {},
  });
  return {
    state: "running",
    currentTime: 1.0,
    destination: {},
    createGain: makeNode,
    createDynamicsCompressor: makeNode,
    createStereoPanner: makeNode,
    createBufferSource: makeNode,
    createMediaStreamDestination: () => ({ stream: {} }),
    async decodeAudioData(buf) {
      return { duration: 1.5, byteLength: buf.byteLength };
    },
  };
}

test("SampledKartAudio.prepare loads sampled manifest and OGG cues", async () => {
  const originalFetch = globalThis.fetch;
  const sampledDir = path.resolve("app/src/main/assets/game/audio/sampled");
  globalThis.fetch = async (url) => {
    const file = url.replace(/^audio\/sampled\//, "");
    const full = path.join(sampledDir, file);
    if (!fs.existsSync(full)) return { ok: false, status: 404 };
    const data = fs.readFileSync(full);
    return {
      ok: true,
      status: 200,
      async json() { return JSON.parse(data.toString("utf8")); },
      async arrayBuffer() { return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength); },
    };
  };

  try {
    const engine = { ctx: createMockAudioContext(), master: { connect() {} }, musicVolume: 0.6, sfxVolume: 0.8 };
    const sampled = new SampledKartAudio(engine);
    const ok = await sampled.prepare();
    assert.equal(ok, true, "prepare() should succeed when manifest and OGG files exist");
    assert.equal(sampled.ready, true);
    assert.equal(sampled.failures.length, 0, "No cues should fail to load");
    assert.equal(sampled.buffers.size, 104, "All 104 cues from manifest should be decoded");
    assert.ok(sampled.buffers.has("race"), "race music cue should be loaded");
    assert.ok(sampled.buffers.has("voice-mario-jump-0"), "character voice cue should be loaded");

    // Calling prepare() again returns true immediately without reloading
    assert.equal(await sampled.prepare(), true);

    // playTrack in KartAudio should skip legacy synth track when SampledKartAudio is ready
    const kartAudio = new KartAudio();
    kartAudio.original = sampled;
    kartAudio.engine.ctx = engine.ctx;
    kartAudio.engine.stopTrack = () => {};
    let legacyTrackCalled = false;
    kartAudio.engine.playTrack = async () => { legacyTrackCalled = true; };
    await kartAudio.playTrack("audio/music/menu.ogg");
    assert.equal(legacyTrackCalled, false, "Legacy AudioEngine.playTrack must be skipped when sampled pack is ready");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("SampledKartAudio.prepare returns false cleanly when manifest is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  try {
    const engine = { ctx: createMockAudioContext(), master: { connect() {} }, musicVolume: 1, sfxVolume: 1 };
    const sampled = new SampledKartAudio(engine);
    const ok = await sampled.prepare();
    assert.equal(ok, false);
    assert.equal(sampled.ready, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
