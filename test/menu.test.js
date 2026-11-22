if (typeof globalThis.self === "undefined") {
  globalThis.self = globalThis;
}

import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { MenuCamera } from "../app/src/main/assets/game/menu-camera.js";
import {
  MenuScene,
  KART_TYPES,
  DRIVER_PROFILES,
} from "../app/src/main/assets/game/menu-scene.js";
import { loadGLB, buildGLBKart, KART_SPECS } from "../app/src/main/assets/game/models.js";
import { KartAudio } from "../app/src/main/assets/game/audio.js";
import { paethPredictor } from "../scripts/capture-menu-screenshots.js";

class MockGainNode {
  constructor() {
    this.gain = {
      value: 1,
      setValueAtTime(v) { this.value = v; },
      setTargetAtTime(v) { this.value = v; },
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
  createGain() { return new MockGainNode(); }
  createOscillator() {
    return {
      type: "sine",
      frequency: { setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() { return this; },
      start() {},
      stop() {},
      disconnect() {},
    };
  }
  createBiquadFilter() {
    return {
      type: "lowpass",
      frequency: { value: 350, setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {} },
      Q: { value: 1 },
      connect() { return this; },
      disconnect() {},
    };
  }
  createBuffer(channels, length, sampleRate) {
    return {
      duration: length / sampleRate,
      getChannelData() { return new Float32Array(length); },
    };
  }
  createBufferSource() {
    return {
      buffer: null,
      loop: false,
      connect() { return this; },
      start() {},
      stop() {},
      disconnect() {},
    };
  }
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
}

test("MenuCamera initializes with valid spherical coordinates and target framing", () => {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const menuCam = new MenuCamera(camera);

  assert.equal(menuCam.mode, "hub");
  assert.equal(menuCam.radius, 4.8);
  assert.equal(menuCam.targetRadius, 4.8);
  assert.equal(menuCam.targetHeight, 0.85);
  assert.ok(menuCam.phi >= 0.92 && menuCam.phi <= 1.48);

  menuCam.setTurntableCenter(10, 2, -5);
  assert.equal(menuCam.center.x, 10);
  assert.equal(menuCam.center.y, 2);
  assert.equal(menuCam.center.z, -5);
  assert.equal(menuCam.target.y, 2.85);
});

test("MenuCamera view framing modes configure distinct inspection targets", () => {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const menuCam = new MenuCamera(camera);

  // Driver mode: zoomed in on driver head & torso
  menuCam.setMode("driver");
  assert.equal(menuCam.mode, "driver");
  assert.equal(menuCam.targetRadius, 3.6);
  assert.equal(menuCam.targetHeight, 0.1);

  // Kart mode: lower angle showcasing wheels and chassis
  menuCam.setMode("kart");
  assert.equal(menuCam.mode, "kart");
  assert.equal(menuCam.targetRadius, 4.2);
  assert.equal(menuCam.targetHeight, -0.35);

  // Settings mode: pulled-back backdrop view
  menuCam.setMode("settings");
  assert.equal(menuCam.mode, "settings");
  assert.equal(menuCam.targetRadius, 5.2);
  assert.equal(menuCam.targetHeight, 0.90);

  // Hub mode: balanced 3/4 heroic angle
  menuCam.setMode("hub");
  assert.equal(menuCam.mode, "hub");
  assert.equal(menuCam.targetRadius, 4.8);
  assert.equal(menuCam.targetHeight, 0.85);
});

test("MenuCamera updates spherical coordinates with slow cinematic orbit", () => {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const menuCam = new MenuCamera(camera);
  menuCam.setTurntableCenter(0, 0, 0);

  const initialTheta = menuCam.theta;
  // Advance time by 2.0s with inactive user to trigger slow cinematic orbit
  menuCam.lastInteractionTime = performance.now() - 3000;
  menuCam.update(0.5, performance.now());

  assert.ok(
    menuCam.theta > initialTheta,
    `Expected theta to advance clockwise, initial=${initialTheta}, current=${menuCam.theta}`
  );
  assert.ok(Number.isFinite(camera.position.x));
  assert.ok(Number.isFinite(camera.position.y));
  assert.ok(Number.isFinite(camera.position.z));
});

test("MenuCamera executes smooth cinematic transition to gameplay grid", () => {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const menuCam = new MenuCamera(camera);
  menuCam.setTurntableCenter(0, 0, 0);
  menuCam.update(0.016, 1000);

  const gridEye = new THREE.Vector3(-25, 3.5, 115);
  const gridAim = new THREE.Vector3(-15, 1.5, 95);
  let transitionCompleted = false;

  menuCam.startTransitionToGameplay(gridEye, gridAim, 0.5, () => {
    transitionCompleted = true;
  });

  assert.equal(menuCam.isTransitioning, true);

  // Step halfway through transition (250ms)
  menuCam.update(0.25, menuCam.transitionStart + 250);
  assert.equal(menuCam.isTransitioning, true);
  assert.equal(transitionCompleted, false);
  // Midpoint should exhibit arc lift
  assert.ok(camera.position.y > 0);

  // Complete transition (550ms)
  menuCam.update(0.30, menuCam.transitionStart + 550);
  assert.equal(menuCam.isTransitioning, false);
  assert.equal(transitionCompleted, true);
  assert.ok(camera.position.distanceTo(gridEye) < 0.05);
});

test("KART_TYPES and DRIVER_PROFILES define all 8 vehicles and characters with complete metadata", () => {
  assert.equal(KART_TYPES.length, 8);
  for (const kart of KART_TYPES) {
    assert.ok(kart.id, "Kart must have id");
    assert.ok(kart.name, "Kart must have name");
    assert.ok(kart.glb.endsWith(".glb"), "Kart must point to valid .glb");
    assert.ok(kart.scale > 0, "Kart scale must be positive");
    assert.ok(kart.category, "Kart must have category");
    assert.ok(kart.desc, "Kart must have description");
    assert.ok(kart.stats.speed >= 50 && kart.stats.speed <= 100);
    assert.ok(kart.stats.accel >= 50 && kart.stats.accel <= 100);
    assert.ok(kart.stats.weight >= 50 && kart.stats.weight <= 100);
    assert.ok(kart.stats.drift >= 50 && kart.stats.drift <= 100);
  }

  const driverKeys = Object.keys(DRIVER_PROFILES);
  assert.equal(driverKeys.length, 8);
  for (const id of driverKeys) {
    const d = DRIVER_PROFILES[id];
    assert.ok(d.name, "Driver must have name");
    assert.ok(d.class, "Driver must have class");
    assert.ok(d.color.startsWith("#"), "Driver must have hex color");
    assert.ok(d.defaultKart, "Driver must have default kart");
    assert.ok(d.stats.speed >= 50 && d.stats.speed <= 100);
    assert.ok(d.stats.accel >= 50 && d.stats.accel <= 100);
    assert.ok(d.stats.handling >= 50 && d.stats.handling <= 100);
    assert.ok(d.stats.weight >= 50 && d.stats.weight <= 100);
  }
});

test("MenuScene constructs 3D turntable, lights, scenery, and particles", () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const renderer = { shadowMap: { enabled: true } };

  const menuScene = new MenuScene({ scene, renderer, camera });

  assert.ok(menuScene.root, "MenuScene must have root group");
  assert.ok(scene.children.includes(menuScene.root), "Root group must be added to scene");

  // Verify turntable components
  assert.ok(menuScene.turntableGroup, "Turntable group must exist");
  assert.ok(menuScene.ledMaterial, "Glowing LED material must exist");

  // Verify dedicated menu studio lights
  assert.ok(menuScene.keyLight, "Key spotlight must exist");
  assert.ok(menuScene.keyLight.castShadow, "Key spotlight must cast shadows");
  assert.ok(menuScene.rimLight, "Rim directional light must exist");
  assert.ok(menuScene.fillLight, "Fill light must exist");
  assert.ok(menuScene.hemiLight, "Hemisphere bounce light must exist");

  // Verify celebration motes particle system
  assert.ok(menuScene.motePoints, "Celebration motes points mesh must exist");
  assert.equal(menuScene.moteSpeeds.length, 60, "Must have 60 celebration motes");

  menuScene.dispose();
  assert.ok(!scene.children.includes(menuScene.root), "Root group must be removed on dispose");
});

test("MenuScene loads and swaps showcase racer with idle animations", async () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const renderer = { shadowMap: { enabled: true } };

  const menuScene = new MenuScene({ scene, renderer, camera });

  // 1. Load Mario in Red Speedster
  await menuScene.setShowcaseRacer("mario", "kart-oobi");
  assert.ok(menuScene.showcaseModel, "Showcase model must be loaded");
  assert.equal(menuScene.characterId, "mario");
  assert.equal(menuScene.kartId, "kart-oobi");
  assert.equal(menuScene.showcaseWheels.filter(Boolean).length, 4, "Must articulate 4 wheels");

  // 2. Perform frame update with idle suspension breathing and head look
  camera.position.set(0, 1.5, 4);
  menuScene.update(0.016, 1000, camera);

  // Check suspension bob within realistic tolerances
  assert.ok(menuScene.showcaseModel.position.y > 0.14 && menuScene.showcaseModel.position.y < 0.18);
  assert.ok(Number.isFinite(menuScene.showcaseModel.rotation.z));
  assert.ok(Number.isFinite(menuScene.showcaseModel.rotation.x));

  // 3. Swap to Peach in Cyber Beast (different kart and character GLB)
  await menuScene.setShowcaseRacer("peach", "race-future");
  assert.equal(menuScene.characterId, "peach");
  assert.equal(menuScene.kartId, "race-future");
  assert.ok(menuScene.showcaseModel, "Showcase model must swap cleanly");
  assert.equal(menuScene.showcaseWheels.filter(Boolean).length, 4);

  // 4. Test activate & deactivate
  menuScene.deactivate();
  assert.equal(menuScene.isActive, false);
  assert.equal(menuScene.root.visible, false);
  assert.equal(menuScene.keyLight.intensity, 0);

  menuScene.activate();
  assert.equal(menuScene.isActive, true);
  assert.equal(menuScene.root.visible, true);
  assert.ok(menuScene.keyLight.intensity > 0);

  menuScene.dispose();
});

test("Audio controls connect Music and SFX sliders to actual audio controls with accurate display values", async () => {
  globalThis.AudioContext = MockAudioContext;
  globalThis.webkitAudioContext = MockAudioContext;

  const audio = new KartAudio();
  await audio.unlock();

  // 1. Initial defaults
  assert.equal(audio.engine.volume, 0.8, "Default master volume should be 0.8 (80%)");
  assert.equal(audio.musicVolume, 0.75, "Default music volume should be 0.75 (75%)");
  assert.equal(audio.sfxVolume, 0.85, "Default SFX volume should be 0.85 (85%)");

  // Format display text checks
  assert.equal(Math.round(audio.engine.volume * 100) + "%", "80%");
  assert.equal(Math.round(audio.musicVolume * 100) + "%", "75%");
  assert.equal(Math.round(audio.sfxVolume * 100) + "%", "85%");

  // 2. Adjust Master Volume via control
  audio.setMasterVolume(0.42);
  assert.equal(audio.engine.volume, 0.42);
  assert.equal(audio.engine.master.gain.value, 0.42);
  assert.equal(Math.round(audio.engine.volume * 100) + "%", "42%");

  // 3. Adjust Music Volume via control
  audio.setMusicVolume(0.60);
  assert.equal(audio.musicVolume, 0.60);
  assert.equal(audio.engine.musicVolume, 0.60);
  assert.equal(audio.engine.musicBus.gain.value, 0.60);
  assert.equal(Math.round(audio.musicVolume * 100) + "%", "60%");

  // 4. Adjust SFX Volume via control
  audio.setSfxVolume(0.95);
  assert.equal(audio.sfxVolume, 0.95);
  assert.equal(audio.engine.sfxVolume, 0.95);
  assert.equal(audio.engine.sfxBus.gain.value, 0.95);
  assert.equal(Math.round(audio.sfxVolume * 100) + "%", "95%");

  // 5. Clamping and bounds check
  audio.setMusicVolume(1.5);
  assert.equal(audio.musicVolume, 1.0);
  assert.equal(Math.round(audio.musicVolume * 100) + "%", "100%");

  audio.setSfxVolume(-0.2);
  assert.equal(audio.sfxVolume, 0.0);
  assert.equal(Math.round(audio.sfxVolume * 100) + "%", "0%");
});

test("MenuScene prevents outdated asynchronous showcase loads from replacing latest driver/kart selection", async () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const renderer = { shadowMap: { enabled: true } };

  const menuScene = new MenuScene({ scene, renderer, camera });

  // Simulate an async race condition: Bowser is requested first, Peach is requested second.
  // The system must ensure Bowser does not overwrite Peach when it completes.
  const p1 = menuScene.setShowcaseRacer("bowser", "kart-oobi");
  const p2 = menuScene.setShowcaseRacer("peach", "race-future");

  const [res1, res2] = await Promise.all([p1, p2]);

  // Request 1 was superseded, so it must return null and not be applied to the scene
  assert.equal(res1, null, "Superseded load must resolve to null");
  assert.ok(res2, "Latest selection must resolve with showcase model");

  // The active showcase racer must strictly be Peach in race-future
  assert.equal(menuScene.characterId, "peach");
  assert.equal(menuScene.kartId, "race-future");
  assert.equal(menuScene.showcaseModel, res2);

  // Switch to Toad, then rapidly switch to Mario
  const pToad = menuScene.setShowcaseRacer("toad", "kart-oobi");
  const pMario = menuScene.setShowcaseRacer("mario", "kart-oobi");

  const [resToad, resMario] = await Promise.all([pToad, pMario]);
  assert.equal(resToad, null, "Toad must be discarded as superseded");
  assert.ok(resMario, "Mario must become active showcase model");
  assert.equal(menuScene.characterId, "mario");
  assert.equal(menuScene.showcaseModel, resMario);

  menuScene.dispose();
});

test("Paeth predictor condition strictly implements RFC 2083 logic across all octants and tie breaks", () => {
  // 1. Equal inputs
  assert.equal(paethPredictor(0, 0, 0), 0);
  assert.equal(paethPredictor(128, 128, 128), 128);

  // 2. Exact match with a (p closer to a)
  // a = 100, b = 20, c = 20 => p = 100, pa = 0, pb = 80, pc = 80 => a
  assert.equal(paethPredictor(100, 20, 20), 100);

  // 3. Exact match with b (p closer to b)
  // a = 20, b = 100, c = 20 => p = 100, pa = 80, pb = 0, pc = 80 => b
  assert.equal(paethPredictor(20, 100, 20), 100);

  // 4. Exact match with c (p closer to c)
  // a = 40, b = 60, c = 50 => p = 50, pa = 10, pb = 10, pc = 0 => c
  assert.equal(paethPredictor(40, 60, 50), 50);

  // 5. Tie breaking: pa == pb < pc -> RFC 2083 rule: return a
  // a = 10, b = 10, c = 0 => p = 20, pa = 10, pb = 10, pc = 20 => a
  assert.equal(paethPredictor(10, 10, 0), 10);

  // 6. Tie breaking: pb == pc < pa -> return b
  // a = 50, b = 20, c = 40 => p = 30, pa = 20, pb = 10, pc = 10 => b
  assert.equal(paethPredictor(50, 20, 40), 20);

  // 7. Tie breaking: pa == pb == pc -> return a
  assert.equal(paethPredictor(100, 100, 100), 100);

  // 8. Correctness check for pa > pb && pb <= pc -> return b
  assert.equal(paethPredictor(90, 50, 80), 50);

  // 9. Correctness check for pa > pb && pb > pc -> return c
  assert.equal(paethPredictor(10, 30, 20), 20);
});
