import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

// Polyfill window/globalThis for test environment
if (typeof globalThis.window === "undefined") {
  globalThis.window = globalThis;
}
if (typeof globalThis.self === "undefined") {
  globalThis.self = globalThis;
}

import { Race, turboTier, topSpeed } from "../app/src/main/assets/game/logic.js";
import { WheelInput } from "../app/src/main/assets/game/input.js";
import { chasePose } from "../app/src/main/assets/game/visual-frame.js";
import { raceEffects } from "../app/src/main/assets/game/race-effects.js";
import { updateDriverAnimation } from "../app/src/main/assets/game/models.js";
import { KartAudio, engineFrequency } from "../app/src/main/assets/game/audio.js";

test("Kart handling: low-speed torque curve and high-speed acceleration", () => {
  const race = new Race({ character: "mario", laps: 1, seed: 101 });
  race.start();
  // Bypass countdown
  race.time = 3.5;
  race.state = "racing";
  const r = race.player;

  // Initial step from standstill
  r.speed = 0;
  race.update(1 / 60, { gas: true, steer: 0 });
  const lowSpeedAccel = r.speed / (1 / 60);

  // Near top speed
  const max = topSpeed(0);
  r.speed = max * 0.9;
  const speedBefore = r.speed;
  race.update(1 / 60, { gas: true, steer: 0 });
  const highSpeedAccel = (r.speed - speedBefore) / (1 / 60);

  assert.ok(lowSpeedAccel > highSpeedAccel, "Low-speed acceleration must provide higher torque than near top speed");
  assert.ok(lowSpeedAccel >= 16, "Standing start acceleration should be punchy and responsive");
});

test("Kart handling: high-speed braking vs standstill reverse", () => {
  const race = new Race({ character: "luigi", laps: 1, seed: 102 });
  race.time = 3.5;
  race.state = "racing";
  const r = race.player;

  // 1. High speed braking
  r.speed = 30;
  race.update(1 / 60, { brake: true });
  assert.ok(r.speed < 30, "Braking at high speed must decelerate the kart rapidly");
  assert.ok(r.speed > 0, "Braking for one frame at 30 m/s should not instantly reverse");

  // 2. Standstill reverse
  r.speed = 0;
  race.update(1 / 60, { brake: true });
  assert.ok(r.speed < 0, "Braking from standstill must smoothly enter reverse");
  assert.ok(r.speed >= -10, "Reverse speed must remain clamped within safe limits");
});

test("Kart handling: buffered hop-to-drift latching and counter-steer line modulation", () => {
  const race = new Race({ character: "toad", laps: 1, seed: 103 });
  race.time = 3.5;
  race.state = "racing";
  const r = race.player;
  r.speed = 25;

  // Hop initiated while steering slightly below threshold
  race.update(1 / 60, { drift: true, steer: 0.05 });
  assert.ok(r.hop > 0, "Drift press must trigger hop");
  assert.equal(r.drift, 0, "Should not latch drift yet if steer is very low");

  // While hop is active, steer increases to the right -> drift should latch right (+1)
  race.update(1 / 60, { drift: true, steer: 0.6 });
  assert.equal(r.drift, 1, "Buffered hop must latch into right drift (+1)");

  // Counter-steer test: player steers left (counter-steer) while drifting right
  const chargeBefore = r.charge;
  race.update(1 / 60, { drift: true, steer: -0.5 });
  assert.equal(r.drift, 1, "Drift state must stay latched during counter-steering");
  assert.ok(r.charge > chargeBefore, "Drift charge must continue accumulating during counter-steer");

  // Inward steer builds charge faster than counter-steer
  const counterSteerDelta = r.charge - chargeBefore;
  const chargeBeforeInward = r.charge;
  race.update(1 / 60, { drift: true, steer: 0.8 });
  const inwardSteerDelta = r.charge - chargeBeforeInward;
  assert.ok(inwardSteerDelta > counterSteerDelta, "Inward steering must accumulate drift charge faster than counter-steer");

  // Release drift with charge >= 0.8 -> Mini-turbo surge
  r.charge = 1.0;
  const speedBeforeTurbo = r.speed;
  race.update(1 / 60, { drift: false, steer: 0 });
  assert.equal(r.drift, 0);
  assert.ok(r.boost > 0, "Releasing charged drift must award boost");
  assert.ok(r.speed > speedBeforeTurbo, "Turbo release must impart an instant speed surge");
});

test("Kart handling: suspension pitch (squat/dive) and roll dynamics", () => {
  const race = new Race({ character: "peach", laps: 1, seed: 104 });
  race.time = 3.5;
  race.state = "racing";
  const r = race.player;

  // Acceleration squat (front rises, pitch tilts back)
  r.speed = 10;
  race.update(1 / 60, { gas: true });
  assert.ok(r.pitchSuspension < 0, "Acceleration must produce negative pitch (squat)");

  // Hard braking dive (nose drops, pitch tilts forward)
  r.speed = 25;
  race.update(1 / 60, { brake: true });
  assert.ok(r.pitchSuspension > 0, "Braking must produce positive pitch (dive)");

  // Cornering roll
  race.update(1 / 60, { gas: true, steer: 0.8 });
  assert.ok(r.rollSuspension !== 0, "Hard steering must engage roll suspension");
});

test("Touch controls: analog steering ranges and multi-button release safety", () => {
  const input = new WheelInput();

  // Test analog steering ranges
  input.setTouchSteer(-0.45);
  let state = input.read(0);
  assert.equal(state.steer, -0.45);

  input.setTouchSteer(0.72);
  state = input.read(16);
  assert.equal(state.steer, 0.72);

  // Multi-button press
  input.setTouchButton("gas", true);
  input.setTouchButton("drift", true);
  input.setTouchButton("item", true);
  state = input.read(32);
  assert.equal(state.gas, true);
  assert.equal(state.drift, true);
  assert.equal(state.item, true);

  // Release clears everything cleanly
  input.release();
  state = input.read(48);
  assert.equal(state.steer, 0);
  assert.equal(state.gas, false);
  assert.equal(state.drift, false);
  assert.equal(state.item, false);
});

test("Camera response: speed pull-back, drift framing lead, and landing shock", () => {
  const racer = {
    x: 0, y: 10, z: 0, s: 100, lateral: 0, heading: 0,
    speed: 0, boost: 0, drift: 0, landing: 0, gliding: false,
    surfaceForward: null, surfaceNormal: null,
  };

  // Base stationary chase pose
  const basePose = chasePose(racer);

  // At top speed (45 m/s) with boost
  racer.speed = 45;
  racer.boost = 1.0;
  const fastPose = chasePose(racer);

  // Camera must be pulled back further along -Z when traveling forward (heading 0 -> forward is -Z)
  const baseDist = Math.hypot(basePose.eye.x - racer.x, basePose.eye.z - racer.z);
  const fastDist = Math.hypot(fastPose.eye.x - racer.x, fastPose.eye.z - racer.z);
  assert.ok(fastDist > baseDist, "Camera must pull back further at high speed / boost for forward visibility");

  // Drift framing lead
  racer.drift = 1; // Drifting right
  const driftPose = chasePose(racer);
  assert.ok(driftPose.aim.x !== basePose.aim.x, "Drifting right must angle the camera aim towards the apex");

  // Landing shock absorption
  racer.landing = 0.12; // Mid-landing compression
  const landPose = chasePose(racer);
  assert.ok(landPose.eye.y < fastPose.eye.y, "Landing must produce vertical shock absorption compression");
});

test("Visual effects: raceEffects exposes complete racing VFX API and handles particle pool", () => {
  const scene = new THREE.Scene();
  const effects = raceEffects(scene, Math.random, { initialBudget: 300 });

  assert.equal(typeof effects.box, "function");
  assert.equal(typeof effects.tire, "function");
  assert.equal(typeof effects.brakeSmoke, "function");
  assert.equal(typeof effects.burnoutPuff, "function");
  assert.equal(typeof effects.offroadDust, "function");
  assert.equal(typeof effects.wallSparks, "function");
  assert.equal(typeof effects.landingPuff, "function");

  const mockRacer = {
    x: 10, y: 0, z: 20, s: 50, lateral: 0, heading: 0, speed: 25,
    drift: 1, tier: 2, charge: 2.2, gliding: false, jump: null,
  };
  const mockFrame = {
    forward: { x: 0, y: 0, z: -1 },
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
  };

  // Calling each effect must succeed without errors
  effects.tire(mockRacer, mockFrame, 0.016);
  effects.brakeSmoke(mockRacer, mockFrame, 0.016);
  effects.burnoutPuff(mockRacer, mockFrame);
  effects.offroadDust(mockRacer, mockFrame, 0.016);
  effects.wallSparks(mockRacer, mockFrame, 1);
  effects.landingPuff(mockRacer, mockFrame);

  // Update simulation
  effects.update(0.016, 720);

  // Budget clamping
  assert.equal(effects.setParticleLimit(150), 150);
  assert.equal(effects.getParticleLimit(), 150);

  effects.dispose();
});

test("Driver animation: updateDriverAnimation blends actions according to race and racer state", () => {
  const actions = {
    drive: { name: "drive", reset() { return this; }, fadeIn() { return this; }, fadeOut() { return this; }, play() { return this; } },
    jump: { name: "jump", reset() { return this; }, fadeIn() { return this; }, fadeOut() { return this; }, play() { return this; } },
    crouch: { name: "crouch", reset() { return this; }, fadeIn() { return this; }, fadeOut() { return this; }, play() { return this; } },
    "emote-no": { name: "emote-no", reset() { return this; }, fadeIn() { return this; }, fadeOut() { return this; }, play() { return this; } },
    "emote-yes": { name: "emote-yes", reset() { return this; }, fadeIn() { return this; }, fadeOut() { return this; }, play() { return this; } },
  };

  const driverScene = new THREE.Group();
  Object.defineProperties(driverScene.userData, {
    actions: { value: actions, enumerable: false, writable: true },
    currentAction: { value: actions.drive, enumerable: false, writable: true },
    currentClipName: { value: "drive", enumerable: true, writable: true },
  });

  const kart = { driver: driverScene };
  const racer = { spin: 0, jump: null, gliding: false, landing: 0 };

  // 1. Normal racing -> drive
  updateDriverAnimation(kart, racer, "racing", 0.016);
  assert.equal(driverScene.userData.currentClipName, "drive");

  // Verify userData is safely serializable (no circular AnimationAction structures during clone)
  assert.doesNotThrow(() => {
    JSON.stringify(driverScene.userData);
    driverScene.clone(true);
  });

  // 2. Spin out -> emote-no
  racer.spin = 1.0;
  updateDriverAnimation(kart, racer, "racing", 0.016);
  assert.equal(driverScene.userData.currentClipName, "emote-no");
  racer.spin = 0;

  // 3. Jump -> jump
  racer.jump = { velocity: 8, age: 0.1 };
  updateDriverAnimation(kart, racer, "racing", 0.016);
  assert.equal(driverScene.userData.currentClipName, "jump");
  racer.jump = null;

  // 4. Landing -> crouch
  racer.landing = 0.2;
  updateDriverAnimation(kart, racer, "racing", 0.016);
  assert.equal(driverScene.userData.currentClipName, "crouch");
  racer.landing = 0;

  // 5. Finishing -> emote-yes (celebration)
  updateDriverAnimation(kart, racer, "finishing", 0.016);
  assert.equal(driverScene.userData.currentClipName, "emote-yes");
});

test("Audio: engine pitch and screech modulation responds to racing dynamics", async () => {
  class MockGain {
    constructor() {
      this.gain = {
        value: 1,
        setValueAtTime(v) { this.value = v; },
        setTargetAtTime(v) { this.value = v; },
        exponentialRampToValueAtTime(v) { this.value = v; },
      };
    }
    connect() { return this; }
    disconnect() {}
  }
  class MockAudioContext {
    constructor() {
      this.state = "running";
      this.currentTime = 0;
      this.sampleRate = 44100;
      this.destination = {};
    }
    suspend() { this.state = "suspended"; }
    resume() { this.state = "running"; }
    createGain() { return new MockGain(); }
    createOscillator() {
      return {
        type: "sine",
        frequency: {
          value: 440,
          setValueAtTime(v) { this.value = v; },
          setTargetAtTime(v) { this.value = v; },
          exponentialRampToValueAtTime(v) { this.value = v; },
        },
        connect() { return this; },
        start() {},
        stop() {},
        disconnect() {},
      };
    }
    createBiquadFilter() {
      return {
        type: "lowpass",
        frequency: { value: 550, setValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; } },
        Q: { value: 1 },
        connect() { return this; },
        disconnect() {},
      };
    }
    createBuffer() { return { duration: 1, getChannelData() { return new Float32Array(10); } }; }
  }

  globalThis.AudioContext = MockAudioContext;
  globalThis.webkitAudioContext = MockAudioContext;

  const audio = new KartAudio();
  await audio.unlock();

  assert.ok(audio.motor, "Motor synthesizer must be initialized upon unlock");
  assert.ok(audio.screech, "Tire screech synthesizer must be initialized upon unlock");

  const race = new Race({ character: "bowser", laps: 1, seed: 105 });
  race.time = 3.5;
  race.state = "racing";
  const r = race.player;
  r.speed = 28;
  r.lastInput = { gas: true, brake: false };

  // Update audio with throttle active
  audio.update(race);
  assert.ok(audio.motor.osc.frequency.value > 0);

  // Update audio with drift active -> screech gain must engage
  r.drift = 1;
  r.charge = 2.0;
  audio.update(race);
  assert.ok(audio.screech.g.gain.value > 0, "Drifting at speed must engage screech synthesizer gain");

  // Neutral state -> screech gain goes to 0
  r.drift = 0;
  r.charge = 0;
  r.lastInput = { gas: false, brake: false };
  audio.update(race);
  assert.equal(audio.screech.g.gain.value, 0, "Screech gain must be 0 when not drifting or braking");

  audio.stop();
  assert.equal(audio.motor, null);
  assert.equal(audio.screech, null);
});
