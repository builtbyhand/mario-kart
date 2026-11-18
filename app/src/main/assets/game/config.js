/**
 * Centralized Game Configuration and Architecture Foundation for Mario Kart Android.
 *
 * Operational Status (Phase 1 Baseline):
 * - Active / Wired: Device profiling, RENDER_CONFIG (pixelRatio clamping, antialias, powerPreference,
 *   toneMappingExposure, clearColor, fog parameters, camera FOV/clipping, shadowMap toggle).
 * - Architectural Targets (Deferred to later visual/asset phases): particleLimit (Phase 6 VFX),
 *   dynamic bloom pass activation (Phase 6), per-preset shadowMap resolution (Phase 6),
 *   and ASSET_REGISTRY external asset loading (Phases 2-4).
 */

// Device profiling
export const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
export const isTv = typeof window !== "undefined" && Boolean(window.AndroidBridge?.isTv?.());
export const isMobile = (typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) || (typeof window !== "undefined" && Boolean(window.AndroidBridge));

/**
 * Quality Presets.
 * Note: Clamping pixelRatio and disabling dynamic shadow maps reduces GPU shading
 * and fillrate pressure on mobile SoCs, but does not guarantee a fixed 60 FPS across
 * all Android hardware variants (which depends on GPU capabilities, WebView rendering
 * overhead, and thermal throttling).
 */
export const QUALITY_PRESETS = {
  low: {
    name: "low",
    maxPixelRatio: 1.0,
    shadows: false,
    shadowMapSize: 512,       // Architectural target: to be wired into directional light in VFX phase
    antialias: false,
    useBloom: false,          // Architectural target: to be wired to post-processing pipeline
    particleLimit: 300,       // Architectural target: to be wired to race-effects pool
    anisotropy: 1,            // Architectural target: to be wired to texture loader
  },
  medium: {
    name: "medium",
    maxPixelRatio: 1.3,
    shadows: false,
    shadowMapSize: 1024,
    antialias: true,
    useBloom: false,
    particleLimit: 600,
    anisotropy: 4,
  },
  high: {
    name: "high",
    maxPixelRatio: 1.6,
    shadows: true,
    shadowMapSize: 1024,
    antialias: true,
    useBloom: false,
    particleLimit: 1200,
    anisotropy: 8,
  },
  ultra: {
    name: "ultra",
    maxPixelRatio: 2.0,
    shadows: true,
    shadowMapSize: 2048,
    antialias: true,
    useBloom: true,
    particleLimit: 1800,
    anisotropy: 16,
  },
};

/**
 * Determine default quality preset based on device environment.
 * Mobile phones and Android TV default to medium to prioritize rendering stability.
 */
export function getDefaultQualityPreset() {
  if (isTv) return QUALITY_PRESETS.medium;
  if (isMobile) return QUALITY_PRESETS.medium;
  return QUALITY_PRESETS.high;
}

export const activeQuality = getDefaultQualityPreset();

// Centralized Renderer Configuration (Wired & Operational in Phase 1)
export const RENDER_CONFIG = {
  get pixelRatio() {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    return Math.min(dpr, activeQuality.maxPixelRatio);
  },
  antialias: activeQuality.antialias,
  powerPreference: "high-performance",
  toneMappingExposure: 1.05,
  fog: {
    color: "#111c30",
    density: 0.0011,
  },
  camera: {
    fov: 59,
    near: 0.2,
    far: 1100,
  },
  clearColor: "#081325",
};

// Centralized Input Configuration (Baseline values)
export const INPUT_CONFIG = {
  tilt: {
    maxDegrees: 45,
    fullSteerDegrees: 28,
    deadzone: 0.08,
    defaultInvert: false,
  },
  gamepad: {
    steerDeadzone: 0.15,
    triggerThreshold: 0.2,
  },
};

// Centralized Audio Configuration
export const AUDIO_CONFIG = {
  defaultMasterVolume: 0.55,
  defaultBgmVolume: 0.72,
  defaultSfxVolume: 1.0,
};

// Asset Provenance and Offline Package Registry Structure
// Architectural foundation for external GLB/glTF model packs in Phases 2-4
export const ASSET_REGISTRY = {
  models: {},
  textures: {
    turf: {
      path: "art/turf-v1.png",
      source: "procedural/in-repo",
      license: "MIT",
    },
  },
  audio: {},
  registerModel(id, meta) {
    this.models[id] = {
      id,
      ...meta,
      registeredAt: Date.now(),
    };
  },
  registerTexture(id, meta) {
    this.textures[id] = {
      id,
      ...meta,
      registeredAt: Date.now(),
    };
  },
};

// Structured Logging for Native Bridge and Web Console
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

export class Logger {
  constructor(tag = "MarioKart", level = LogLevel.INFO) {
    this.tag = tag;
    this.level = level;
  }

  debug(...args) {
    if (this.level <= LogLevel.DEBUG) console.debug(`[${this.tag}]`, ...args);
  }

  info(...args) {
    if (this.level <= LogLevel.INFO) console.info(`[${this.tag}]`, ...args);
  }

  warn(...args) {
    if (this.level <= LogLevel.WARN) console.warn(`[${this.tag}]`, ...args);
  }

  error(...args) {
    if (this.level <= LogLevel.ERROR) console.error(`[${this.tag}]`, ...args);
  }
}

export const logger = new Logger("MarioKartGame");
