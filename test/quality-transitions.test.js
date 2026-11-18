import test from "node:test";
import assert from "node:assert/strict";

// Setup browser globals for Node test environment
globalThis.window = globalThis;
globalThis.innerWidth = 1920;
globalThis.innerHeight = 1080;

import * as THREE from "three";
import {
  QUALITY_PRESETS,
  setQualityPreset,
  detectCapabilities,
  activeQuality,
} from "../app/src/main/assets/game/config.js";
import { PostProcessingPipeline } from "../app/src/main/assets/game/postprocessing.js";
import { raceEffects } from "../app/src/main/assets/game/race-effects.js";

test("detectCapabilities accurately identifies float textures vs float render targets", () => {
  // Device A: Modern WebGL 2 with full float support
  const modernGl = {
    MAX_TEXTURE_SIZE: 3379,
    texImage3D: () => {}, // WebGL2 signature
    getParameter(param) {
      if (param === 3379) return 8192;
      return 16;
    },
    getExtension(name) {
      if (name.includes("texture_filter_anisotropic")) return { MAX_TEXTURE_MAX_ANISOTROPY_EXT: 34047 };
      if (name === "EXT_color_buffer_float") return {};
      return null;
    },
  };

  const capsModern = detectCapabilities(modernGl);
  assert.equal(capsModern.webgl2, true);
  assert.equal(capsModern.maxTextureSize, 8192);
  assert.equal(capsModern.maxAnisotropy, 16);
  assert.equal(capsModern.floatTextures, true);
  assert.equal(capsModern.floatRenderTargets, true);
  assert.equal(capsModern.halfFloatRenderTargets, true);
  assert.equal(capsModern.canPostprocess, true);

  // Device B: WebGL 1 that can sample float textures but CANNOT render to float framebuffers
  const limitedGl = {
    MAX_TEXTURE_SIZE: 3379,
    getParameter(param) {
      if (param === 3379) return 2048;
      return 4;
    },
    getExtension(name) {
      if (name.includes("texture_filter_anisotropic")) return { MAX_TEXTURE_MAX_ANISOTROPY_EXT: 34047 };
      if (name === "OES_texture_float") return {};
      // No EXT_color_buffer_float or EXT_color_buffer_half_float
      return null;
    },
  };
  const capsLimited = detectCapabilities(limitedGl);
  assert.equal(capsLimited.maxTextureSize, 2048);
  assert.equal(capsLimited.maxAnisotropy, 4);
  assert.equal(capsLimited.floatTextures, true);
  assert.equal(capsLimited.floatRenderTargets, false);
  assert.equal(capsLimited.halfFloatRenderTargets, false);
  assert.equal(capsLimited.canPostprocess, false);
});

test("Anisotropy and texture dimensions clamp against device maximums", () => {
  const mockGl = {
    MAX_TEXTURE_SIZE: 3379,
    getParameter(param) {
      if (param === 3379) return 2048;
      return 4; // Max anisotropy = 4
    },
    getExtension(name) {
      if (name.includes("texture_filter_anisotropic")) return { MAX_TEXTURE_MAX_ANISOTROPY_EXT: 34047 };
      return null;
    },
  };
  const caps = detectCapabilities(mockGl);

  // Requested 16x anisotropy on a device supporting at most 4x -> clamped to 4x
  assert.equal(caps.clampAnisotropy(16), 4);
  assert.equal(caps.clampAnisotropy(2), 2);
  assert.equal(caps.clampAnisotropy(0), 1);

  // Requested 4096 texture on a device supporting at most 2048 -> clamped to 2048
  assert.equal(caps.clampTextureSize(4096), 2048);
  assert.equal(caps.clampTextureSize(512), 512);
});

test("PostProcessingPipeline gracefully falls back when capabilities are unsupported", () => {
  const unsupportedCaps = {
    halfFloatRenderTargets: false,
    webgl2: false,
    canPostprocess: false,
  };
  const mockRenderer = {};
  const mockScene = new THREE.Scene();
  const mockCamera = new THREE.PerspectiveCamera();

  const pipeline = new PostProcessingPipeline(mockRenderer, mockScene, mockCamera, unsupportedCaps);
  assert.equal(pipeline.isSupported(), false);

  const result = pipeline.reconfigure(QUALITY_PRESETS.high, 1280, 720);
  assert.equal(result, null);
  assert.equal(pipeline.composer, null);
  assert.equal(pipeline.render(), false);
});

test("PostProcessingPipeline manages lifecycle: Medium -> High -> Low -> Ultra", () => {
  const caps = {
    halfFloatRenderTargets: true,
    webgl2: true,
    canPostprocess: true,
  };
  let renderCalls = 0;
  const mockRenderer = {
    capabilities: { isWebGL2: true },
    getPixelRatio: () => 1,
    setPixelRatio: () => {},
    getSize: (target) => target ? target.set(1280, 720) : new THREE.Vector2(1280, 720),
    setSize: () => {},
    getClearColor: (target) => target ? target.set(0x000000) : new THREE.Color(0x000000),
    getClearAlpha: () => 1,
    setRenderTarget: () => {},
    render: () => { renderCalls++; },
    clear: () => {},
  };
  const mockScene = new THREE.Scene();
  const mockCamera = new THREE.PerspectiveCamera();

  const pipeline = new PostProcessingPipeline(mockRenderer, mockScene, mockCamera, caps);

  // 1. Initial Medium: No postprocessing, composer is null
  pipeline.reconfigure(QUALITY_PRESETS.medium, 1280, 720);
  assert.equal(pipeline.composer, null);
  assert.equal(pipeline.render(), false);

  // 2. Switch to High: Composer created, Bloom + FXAA enabled
  pipeline.reconfigure(QUALITY_PRESETS.high, 1280, 720);
  assert.ok(pipeline.composer);
  assert.ok(pipeline.bloomPass);
  assert.equal(pipeline.bloomPass.enabled, true);
  assert.ok(pipeline.fxaaPass);
  assert.equal(pipeline.fxaaPass.enabled, true);

  // 3. Switch to Low: Pipeline safely torn down, resources released
  let rtDisposed = false;
  pipeline.composer.renderTarget1.dispose = () => { rtDisposed = true; };
  pipeline.reconfigure(QUALITY_PRESETS.low, 1088, 612);
  assert.equal(pipeline.composer, null);
  assert.equal(pipeline.bloomPass, null);
  assert.equal(pipeline.fxaaPass, null);
  assert.equal(rtDisposed, true);
  assert.equal(pipeline.render(), false);

  // 4. Switch to Ultra: Composer re-created cleanly without duplicate passes
  pipeline.reconfigure(QUALITY_PRESETS.ultra, 1280, 720);
  assert.ok(pipeline.composer);
  assert.equal(pipeline.bloomPass.enabled, true);
  assert.equal(pipeline.fxaaPass.enabled, true);
  // Pass list: RenderPass, BloomPass, FXAAPass, OutputPass = 4
  assert.equal(pipeline.composer.passes.length, 4);

  // Teardown
  pipeline.teardown();
  assert.equal(pipeline.composer, null);
});

test("setQualityPreset performs full pipeline transitions: Medium -> High -> Low -> Ultra", () => {
  const mockRenderer = {
    pixelRatio: 1,
    size: { w: 0, h: 0 },
    toneMappingExposure: 1,
    shadowMap: { enabled: false },
    setPixelRatio(pr) { this.pixelRatio = pr; },
    setSize(w, h) { this.size = { w, h }; },
  };
  let shadowMapDisposed = false;
  const mockKeyLight = {
    castShadow: false,
    shadow: {
      map: {
        dispose() { shadowMapDisposed = true; },
      },
      mapSize: {
        w: 0,
        h: 0,
        set(w, h) { this.w = w; this.h = h; },
      },
    },
  };
  const mockCamera = {
    aspect: 1,
    updateProjectionMatrix() { this.updated = true; },
  };
  const mockCanvas = {
    style: { width: "", height: "" },
  };

  let reconfiguredQuality = null;
  const mockPostPipeline = {
    reconfigure(q, w, h) {
      reconfiguredQuality = q;
      this.width = w;
      this.height = h;
    },
  };

  let activeParticleLimit = 0;
  const mockEffects = {
    setParticleLimit(lim) {
      activeParticleLimit = lim;
    },
  };

  const engine = {
    renderer: mockRenderer,
    camera: mockCamera,
    canvas: mockCanvas,
    keyLight: mockKeyLight,
    postPipeline: mockPostPipeline,
    effects: mockEffects,
  };

  // 1. Medium
  setQualityPreset("medium", engine);
  assert.equal(activeQuality.name, "medium");
  assert.equal(activeQuality.maxPixelRatio, 1.3);
  assert.equal(mockRenderer.shadowMap.enabled, true);
  assert.equal(mockKeyLight.castShadow, true);
  assert.equal(mockKeyLight.shadow.mapSize.w, 1024);
  assert.equal(activeParticleLimit, 600);
  assert.equal(reconfiguredQuality.name, "medium");

  // 2. High
  setQualityPreset("high", engine);
  assert.equal(activeQuality.name, "high");
  assert.equal(activeQuality.maxPixelRatio, 1.6);
  assert.equal(activeParticleLimit, 1200);
  assert.equal(reconfiguredQuality.name, "high");
  assert.equal(reconfiguredQuality.useBloom, true);
  assert.equal(reconfiguredQuality.useFXAA, true);

  // 3. Low
  mockKeyLight.shadow.map = { dispose() { shadowMapDisposed = true; } };
  shadowMapDisposed = false;
  setQualityPreset("low", engine);
  assert.equal(activeQuality.name, "low");
  assert.equal(activeQuality.maxPixelRatio, 1.0);
  assert.equal(mockRenderer.shadowMap.enabled, false);
  assert.equal(mockKeyLight.castShadow, false);
  assert.equal(shadowMapDisposed, true, "Shadow map must be disposed when shadows are disabled");
  assert.equal(mockKeyLight.shadow.map, null);
  assert.equal(activeParticleLimit, 300);
  assert.equal(reconfiguredQuality.name, "low");
  assert.equal(reconfiguredQuality.useBloom, false);

  // 4. Ultra
  setQualityPreset("ultra", engine);
  assert.equal(activeQuality.name, "ultra");
  assert.equal(activeQuality.maxPixelRatio, 2.0);
  assert.equal(mockKeyLight.shadow.mapSize.w, 2048);
  assert.equal(activeParticleLimit, 1800);
  assert.equal(reconfiguredQuality.name, "ultra");
});

test("raceEffects particle pool connects to quality budget and resizes safely", () => {
  const scene = new THREE.Scene();
  const effects = raceEffects(scene, Math.random, { initialBudget: 600 });

  assert.equal(effects.getParticleLimit(), 600);

  // Update budget to Ultra (1800)
  effects.setParticleLimit(1800);
  assert.equal(effects.getParticleLimit(), 1800);

  // Update budget to Low (300)
  effects.setParticleLimit(300);
  assert.equal(effects.getParticleLimit(), 300);

  // Over-budget request is clamped to max capacity (1800)
  effects.setParticleLimit(5000);
  assert.equal(effects.getParticleLimit(), 1800);

  // Simulation step operates on the active budget
  effects.update(1 / 60, 720);

  // Clean disposal
  effects.dispose();
  assert.equal(scene.children.length, 0);
});
