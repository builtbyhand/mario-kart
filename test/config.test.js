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
