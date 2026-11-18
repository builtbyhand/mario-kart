/**
 * Centralized Game Configuration and Architecture Foundation for Mario Kart Android.
 * Phase 1: Baseline settings, rendering quality presets, asset registry, and lifecycle management.
 */

// Device profiling
export const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
export const isTv = typeof window !== "undefined" && Boolean(window.AndroidBridge?.isTv?.());
export const isMobile = (typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) || (typeof window !== "undefined" && Boolean(window.AndroidBridge));

// Quality Presets
export const QUALITY_PRESETS = {
  low: {
    name: "low",
    maxPixelRatio: 1.0,
    shadows: false,
    shadowMapSize: 512,
    antialias: false,
    useBloom: false,
    particleLimit: 300,
    anisotropy: 1,
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
 * Android mobile and TV default to medium for guaranteed smooth 60 FPS performance.
 */
export function getDefaultQualityPreset() {
  if (isTv) return QUALITY_PRESETS.medium;
  if (isMobile) return QUALITY_PRESETS.medium;
  return QUALITY_PRESETS.high;
}

export const activeQuality = getDefaultQualityPreset();

// Centralized Renderer Configuration
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

// Centralized Input Configuration
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
