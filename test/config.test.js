import test from "node:test";
import assert from "node:assert/strict";
import {
  QUALITY_PRESETS,
  getDefaultQualityPreset,
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
    assert.ok(preset.particleLimit > 0);
    assert.ok(typeof preset.shadows === "boolean");
  }
});

test("Default quality preset returns a valid preset object", () => {
  const preset = getDefaultQualityPreset();
  assert.ok(preset);
  assert.ok(QUALITY_PRESETS[preset.name]);
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
  // Info is below warn, should not log
  logger.info("Should be silenced");
  logger.warn("Warning test message");
  logger.error("Error test message");
  assert.equal(logger.level, LogLevel.WARN);
});
