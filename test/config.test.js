import test from "node:test";
import assert from "node:assert/strict";
import {
  QUALITY_PRESETS,
  LIGHTING_PRESETS,
  getDefaultQualityPreset,
  getDefaultLightingPreset,
  activeQuality,
  activeLightingPreset,
  setQualityPreset,
  detectCapabilities,
  RENDER_CONFIG,
  INPUT_CONFIG,
  AUDIO_CONFIG,
  ASSET_REGISTRY,
  Logger,
  LogLevel,
} from "../app/src/main/assets/game/config.js";

test("Quality presets contain valid configuration parameters", () => {
  for (const [name, preset] of Object.entries(QUALITY_PRESETS)) {
    assert.equal(preset.name, name);
    assert.ok(preset.maxPixelRatio >= 1.0);
    assert.ok(preset.resolutionScale > 0.5 && preset.resolutionScale <= 1.0);
    assert.ok(preset.particleLimit > 0);
    assert.ok(typeof preset.shadows === "boolean");
    assert.ok(preset.shadowMapSize >= 512);
    assert.ok(preset.anisotropy >= 1);
    assert.equal(preset.toneMapping, "agx");
    assert.ok(preset.toneMappingExposure >= 1.0);
  }
});

test("Lighting presets contain valid atmospheric and light values", () => {
  for (const [name, preset] of Object.entries(LIGHTING_PRESETS)) {
    assert.equal(preset.name, name);
    assert.ok(preset.keyColor);
    assert.ok(preset.keyIntensity > 0);
    assert.ok(preset.fillColor);
    assert.ok(preset.fillIntensity > 0);
    assert.ok(preset.hemiSkyColor);
    assert.ok(preset.hemiGroundColor);
    assert.ok(preset.hemiIntensity > 0);
    assert.ok(preset.fogColor);
    assert.ok(preset.fogDensity > 0);
    assert.ok(preset.clearColor);
    assert.equal(preset.skyTop.length, 3);
    assert.equal(preset.skyBottom.length, 3);
    assert.equal(preset.cloudColor.length, 3);
  }
});

test("Default quality preset returns a valid preset object", () => {
  const preset = getDefaultQualityPreset();
  assert.ok(preset);
  assert.ok(QUALITY_PRESETS[preset.name]);
});

test("Default lighting preset returns a valid preset object", () => {
  const preset = getDefaultLightingPreset();
  assert.ok(preset);
  assert.ok(LIGHTING_PRESETS[preset.name]);
});

test("detectCapabilities handles null and mock contexts cleanly", () => {
  const nullCaps = detectCapabilities(null);
  assert.equal(nullCaps.webgl2, false);
  assert.equal(nullCaps.maxTextureSize, 2048);
  assert.equal(nullCaps.maxAnisotropy, 1);

  const mockGl = {
    MAX_TEXTURE_SIZE: 3379,
    getParameter(param) {
      if (param === 3379) return 4096; // MAX_TEXTURE_SIZE
      return 16;
    },
    getExtension(name) {
      if (name.includes("texture_filter_anisotropic")) {
        return { MAX_TEXTURE_MAX_ANISOTROPY_EXT: 34047 };
      }
      return null;
    },
  };
  const mockCaps = detectCapabilities(mockGl);
  assert.equal(mockCaps.maxTextureSize, 4096);
  assert.equal(mockCaps.maxAnisotropy, 16);
});

test("setQualityPreset dynamically switches preset parameters", () => {
  const mockRenderer = {
    pixelRatio: 1,
    size: { w: 0, h: 0 },
    toneMappingExposure: 1,
    shadowMap: { enabled: false },
    setPixelRatio(pr) { this.pixelRatio = pr; },
    setSize(w, h) { this.size = { w, h }; },
  };
  const mockKeyLight = {
    castShadow: false,
    shadow: {
      mapSize: {
        w: 0,
        h: 0,
        set(w, h) { this.w = w; this.h = h; },
      },
    },
  };

  setQualityPreset("ultra", { renderer: mockRenderer, keyLight: mockKeyLight });
  assert.equal(activeQuality.name, "ultra");
  assert.equal(activeQuality.maxPixelRatio, 2.0);
  assert.equal(mockRenderer.shadowMap.enabled, true);
  assert.equal(mockKeyLight.castShadow, true);
  assert.equal(mockKeyLight.shadow.mapSize.w, 2048);

  setQualityPreset("low", { renderer: mockRenderer, keyLight: mockKeyLight });
  assert.equal(activeQuality.name, "low");
  assert.equal(mockRenderer.shadowMap.enabled, false);
  assert.equal(mockKeyLight.castShadow, false);
});

test("Render config exposes proper camera and fog properties", () => {
  assert.equal(RENDER_CONFIG.camera.fov, 59);
  assert.ok(RENDER_CONFIG.camera.near < RENDER_CONFIG.camera.far);
  assert.ok(RENDER_CONFIG.fog.density > 0);
  assert.ok(RENDER_CONFIG.pixelRatio >= 1.0);
});

test("Asset registry supports registering models and textures with metadata", () => {
  ASSET_REGISTRY.registerModel("test_kart", {
    source: "https://example.com/kart.glb",
    license: "CC-BY",
    author: "TestAuthor",
  });

  assert.ok(ASSET_REGISTRY.models["test_kart"]);
  assert.equal(ASSET_REGISTRY.models["test_kart"].license, "CC-BY");
});

test("Logger handles log levels without throwing", () => {
  const logger = new Logger("TestTag", LogLevel.WARN);
  logger.info("Should be silenced");
  logger.warn("Warning test message");
  logger.error("Error test message");
  assert.equal(logger.level, LogLevel.WARN);
});

test("Capability-based preset selection correctly routes device profiles", () => {
  // 1. Low-end GPU chipsets should resolve to low preset
  const adreno506Caps = {
    webgl2: true,
    rendererName: "Adreno (TM) 506",
    maxTextureSize: 4096,
    maxAnisotropy: 4,
    floatTextures: true,
    floatRenderTargets: true,
  };
  assert.equal(getDefaultQualityPreset(adreno506Caps).name, "low");

  const mali400Caps = {
    webgl2: false,
    rendererName: "Mali-400 MP",
    maxTextureSize: 2048,
    maxAnisotropy: 1,
    floatTextures: false,
    floatRenderTargets: false,
  };
  assert.equal(getDefaultQualityPreset(mali400Caps).name, "low");

  // 2. Devices lacking WebGL 2 or severe texture constraints fall to low
  const noWebGl2Caps = {
    webgl2: false,
    rendererName: "Generic OpenGL ES 2.0",
    maxTextureSize: 2048,
    maxAnisotropy: 2,
    floatTextures: false,
    floatRenderTargets: false,
  };
  assert.equal(getDefaultQualityPreset(noWebGl2Caps).name, "low");

  // 3. Devices lacking anisotropic filtering extension (maxAnisotropy = 1)
  // MUST NOT be classified as low-end solely because of missing AF
  const noAfCaps = {
    webgl2: true,
    rendererName: "Mali-G78",
    maxTextureSize: 8192,
    maxAnisotropy: 1, // No EXT_texture_filter_anisotropic
    floatTextures: true,
    floatRenderTargets: true,
  };
  const noAfPreset = getDefaultQualityPreset(noAfCaps);
  assert.notEqual(noAfPreset.name, "low", "Device with WebGL 2 and 8K textures should not be forced to low solely due to missing AF");

  // 4. Capable desktop GPU resolves to high
  const capableDesktopCaps = {
    webgl2: true,
    rendererName: "NVIDIA GeForce RTX 3070",
    maxTextureSize: 16384,
    maxAnisotropy: 16,
    floatTextures: true,
    floatRenderTargets: true,
  };
  assert.equal(getDefaultQualityPreset(capableDesktopCaps).name, "high");

  // 5. Explicit user preference in localStorage overrides capability detection
  const previousStored = globalThis.localStorage?.getItem("mariokart.quality");
  try {
    globalThis.localStorage = {
      getItem: (key) => (key === "mariokart.quality" ? "ultra" : null),
      setItem: () => {},
    };
    assert.equal(getDefaultQualityPreset(adreno506Caps).name, "ultra", "Explicit user setting must override automatic capability detection");
  } finally {
    if (previousStored !== undefined) {
      globalThis.localStorage.setItem("mariokart.quality", previousStored);
    } else {
      delete globalThis.localStorage;
    }
  }
});
