/**
 * Centralized Game Configuration and Architecture Foundation for Mario Kart Android.
 *
 * Operational Status (Phase 2 Visual Foundation):
 * - Active / Wired: Device profiling, WebGL capability detection, scalable QUALITY_PRESETS
 *   (low, medium, high, ultra) with resolution scaling, soft shadow map resolution,
 *   texture anisotropy, AgX tone mapping & exposure, and post-processing flags (Bloom + FXAA).
 * - Centralized LIGHTING_PRESETS (stadium_night, sunset_gold, sunny_day) coordinating key light,
 *   fill light, hemisphere ambient, fog density/color, clear color, and sky dome uniforms.
 * - Dynamic quality switching with graceful degradation and WebGL context safety.
 */

// Device profiling
export const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
export const isTv = typeof window !== "undefined" && Boolean(window.AndroidBridge?.isTv?.());
export const isMobile = (typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) || (typeof window !== "undefined" && Boolean(window.AndroidBridge));

/**
 * WebGL Capability Detection
 * Probes hardware limits to validate preset applicability without crashing.
 * Distinguishes float texture sampling from floating-point render-target capabilities.
 */
export function detectCapabilities(gl) {
  if (!gl) {
    return {
      webgl2: false,
      maxTextureSize: 2048,
      maxAnisotropy: 1,
      floatTextures: false,
      halfFloatTextures: false,
      floatRenderTargets: false,
      halfFloatRenderTargets: false,
      canPostprocess: false,
      rendererName: "unknown",
      clampAnisotropy: (requested) => Math.max(1, Math.min(requested || 1, 1)),
      clampTextureSize: (size) => Math.min(size || 512, 2048),
    };
  }

  const isWebGL2 = (typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext) ||
                   typeof gl.texImage3D === "function";
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;

  const extAniso = gl.getExtension("EXT_texture_filter_anisotropic") ||
                   gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic") ||
                   gl.getExtension("MOZ_EXT_texture_filter_anisotropic");
  const maxAnisotropy = extAniso ? (gl.getParameter(extAniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1) : 1;

  // Float & Half-Float Texture sampling support
  const floatTextures = isWebGL2 || Boolean(gl.getExtension("OES_texture_float"));
  const halfFloatTextures = isWebGL2 || Boolean(gl.getExtension("OES_texture_half_float"));

  // Floating-point render target capability (needed for HalfFloatType HDR render targets in EffectComposer)
  const extColorBufferFloat = gl.getExtension("EXT_color_buffer_float");
  const extColorBufferHalfFloat = gl.getExtension("EXT_color_buffer_half_float");
  const webglColorBufferFloat = gl.getExtension("WEBGL_color_buffer_float");

  const floatRenderTargets = isWebGL2
    ? Boolean(extColorBufferFloat)
    : Boolean(webglColorBufferFloat);

  const halfFloatRenderTargets = isWebGL2
    ? Boolean(extColorBufferFloat || extColorBufferHalfFloat)
    : Boolean(extColorBufferHalfFloat);

  // Can we run EffectComposer with floating point buffers or fallback to byte buffers?
  const canPostprocess = halfFloatRenderTargets || isWebGL2;

  let rendererName = "unknown";
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  if (debugInfo) {
    rendererName = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "unknown";
  }

  return {
    webgl2: isWebGL2,
    maxTextureSize,
    maxAnisotropy,
    floatTextures,
    halfFloatTextures,
    floatRenderTargets,
    halfFloatRenderTargets,
    canPostprocess,
    rendererName,
    clampAnisotropy(requested) {
      return Math.max(1, Math.min(requested || 1, maxAnisotropy));
    },
    clampTextureSize(size) {
      return Math.min(size || 512, maxTextureSize);
    },
  };
}

/**
 * Quality Presets.
 * Clamping pixelRatio, resolutionScale, and shadowMapSize balances fillrate and geometry
 * throughput across diverse Android chipsets.
 */
export const QUALITY_PRESETS = {
  low: {
    name: "low",
    displayName: "Low (Performance)",
    maxPixelRatio: 1.0,
    resolutionScale: 0.85,
    shadows: false,
    shadowMapSize: 512,
    shadowMapType: "basic",
    antialias: false,
    useBloom: false,
    useFXAA: false,
    particleLimit: 300,
    anisotropy: 1,
    toneMapping: "agx",
    toneMappingExposure: 1.10,
  },
  medium: {
    name: "medium",
    displayName: "Medium (Balanced Mobile/TV)",
    maxPixelRatio: 1.3,
    resolutionScale: 1.0,
    shadows: true,
    shadowMapSize: 1024,
    shadowMapType: "pcf",
    antialias: true,
    useBloom: false,
    useFXAA: false,
    particleLimit: 600,
    anisotropy: 4,
    toneMapping: "agx",
    toneMappingExposure: 1.15,
  },
  high: {
    name: "high",
    displayName: "High (High Definition)",
    maxPixelRatio: 1.6,
    resolutionScale: 1.0,
    shadows: true,
    shadowMapSize: 1024,
    shadowMapType: "pcf",
    antialias: true,
    useBloom: true,
    useFXAA: true,
    particleLimit: 1200,
    anisotropy: 8,
    toneMapping: "agx",
    toneMappingExposure: 1.18,
  },
  ultra: {
    name: "ultra",
    displayName: "Ultra (Maximum Quality)",
    maxPixelRatio: 2.0,
    resolutionScale: 1.0,
    shadows: true,
    shadowMapSize: 2048,
    shadowMapType: "pcf",
    antialias: true,
    useBloom: true,
    useFXAA: true,
    particleLimit: 1800,
    anisotropy: 16,
    toneMapping: "agx",
    toneMappingExposure: 1.20,
  },
};

/**
 * Atmospheric & Environmental Lighting Presets
 * Reusable lighting setups for stadium night, warm sunset gold, and bright sunny daytime.
 */
export const LIGHTING_PRESETS = {
  stadium_night: {
    name: "stadium_night",
    displayName: "Stadium Night",
    keyColor: "#fff3dd",
    keyIntensity: 1.8,
    fillColor: "#77baff",
    fillIntensity: 0.35,
    hemiSkyColor: "#a5c8f4",
    hemiGroundColor: "#34384a",
    hemiIntensity: 0.32,
    fogColor: "#111c30",
    fogDensity: 0.0011,
    clearColor: "#081325",
    skyTop: [0.002, 0.004, 0.012],
    skyBottom: [0.008, 0.018, 0.030],
    cloudColor: [0.030, 0.036, 0.045],
    beamIntensity: 0.065,
    beamColor: [0.55, 0.8, 1.0],
  },
  sunset_gold: {
    name: "sunset_gold",
    displayName: "Sunset Gold",
    keyColor: "#ffaa55",
    keyIntensity: 2.1,
    fillColor: "#9a52cc",
    fillIntensity: 0.45,
    hemiSkyColor: "#ffb88c",
    hemiGroundColor: "#3b1e2e",
    hemiIntensity: 0.45,
    fogColor: "#381a2b",
    fogDensity: 0.0009,
    clearColor: "#220d1c",
    skyTop: [0.15, 0.04, 0.16],
    skyBottom: [0.85, 0.38, 0.14],
    cloudColor: [0.95, 0.52, 0.22],
    beamIntensity: 0.04,
    beamColor: [1.0, 0.7, 0.4],
  },
  sunny_day: {
    name: "sunny_day",
    displayName: "Sunny Day",
    keyColor: "#fffbf2",
    keyIntensity: 2.3,
    fillColor: "#7ec8f8",
    fillIntensity: 0.55,
    hemiSkyColor: "#9be2ff",
    hemiGroundColor: "#3e5234",
    hemiIntensity: 0.55,
    fogColor: "#76bbe8",
    fogDensity: 0.0006,
    clearColor: "#58a5dc",
    skyTop: [0.12, 0.46, 0.86],
    skyBottom: [0.55, 0.82, 0.98],
    cloudColor: [0.98, 0.98, 1.0],
    beamIntensity: 0.01,
    beamColor: [0.8, 0.95, 1.0],
  },
};

/**
 * Resolve quality preset from URL query override or device environment.
 */
export function getDefaultQualityPreset(capabilities = null) {
  if (typeof location !== "undefined") {
    const param = new URLSearchParams(location.search).get("quality")?.toLowerCase();
    if (param && QUALITY_PRESETS[param]) {
      return QUALITY_PRESETS[param];
    }
  }
  // Automatic profile detection based on GPU capabilities
  if (capabilities) {
    if (!capabilities.webgl2 || capabilities.maxTextureSize < 4096 || capabilities.maxAnisotropy <= 1) {
      return QUALITY_PRESETS.low;
    }
    const renderer = (capabilities.rendererName || "").toLowerCase();
    if (/mali-4|mali-t|adreno 3|adreno 505|adreno 506|powervr/i.test(renderer)) {
      return QUALITY_PRESETS.low;
    }
  }
  if (isTv) return QUALITY_PRESETS.medium;
  if (isMobile) return QUALITY_PRESETS.medium;
  return QUALITY_PRESETS.high;
}

/**
 * Resolve lighting preset from URL query override or default to stadium_night.
 */
export function getDefaultLightingPreset() {
  if (typeof location !== "undefined") {
    const param = new URLSearchParams(location.search).get("lighting")?.toLowerCase();
    if (param) {
      if (LIGHTING_PRESETS[param]) return LIGHTING_PRESETS[param];
      if (param === "night") return LIGHTING_PRESETS.stadium_night;
      if (param === "sunset") return LIGHTING_PRESETS.sunset_gold;
      if (param === "day") return LIGHTING_PRESETS.sunny_day;
    }
  }
  return LIGHTING_PRESETS.stadium_night;
}

export const activeQuality = { ...getDefaultQualityPreset() };
export const activeLightingPreset = { ...getDefaultLightingPreset() };

/**
 * Dynamically updates the active quality preset and reconfigures active engine subsystems.
 *
 * Operational scope:
 * - DPR, resolution scale, exposure, and soft shadows are dynamically updated.
 * - Post-processing pipeline (UnrealBloomPass + FXAAPass via postPipeline) is created,
 *   reconfigured, or safely torn down with full GPU resource disposal.
 * - Particle system (effects) budget is clamped and updated via setParticleLimit.
 * - Hardware MSAA note: Per WebGL specification, hardware MSAA (antialias flag) is an
 *   immutable context-creation parameter that cannot be toggled on an active WebGL context.
 *   Dynamic anti-aliasing during runtime preset switching is handled by post-processing FXAA.
 */
export function setQualityPreset(presetKey, engine = {}) {
  const target = QUALITY_PRESETS[presetKey?.toLowerCase()];
  if (!target) {
    logger.warn(`Unknown quality preset "${presetKey}". Ignoring.`);
    return activeQuality;
  }
  Object.assign(activeQuality, target);

  const { renderer, camera, canvas, keyLight, postPipeline, effects } = engine;

  if (renderer) {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const pixelRatio = Math.min(dpr, activeQuality.maxPixelRatio);
    renderer.setPixelRatio(pixelRatio);

    const winWidth = typeof innerWidth !== "undefined" ? innerWidth : 1280;
    const winHeight = typeof innerHeight !== "undefined" ? innerHeight : 720;
    const renderWidth = Math.floor(winWidth * (activeQuality.resolutionScale || 1.0));
    const renderHeight = Math.floor(winHeight * (activeQuality.resolutionScale || 1.0));

    renderer.setSize(renderWidth, renderHeight, false);

    if (canvas?.style) {
      canvas.style.width = winWidth + "px";
      canvas.style.height = winHeight + "px";
    }

    if (camera) {
      camera.aspect = winWidth / winHeight;
      camera.updateProjectionMatrix();
    }

    renderer.toneMappingExposure = activeQuality.toneMappingExposure;

    if (activeQuality.shadows) {
      renderer.shadowMap.enabled = true;
      if (keyLight) {
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(activeQuality.shadowMapSize, activeQuality.shadowMapSize);
        if (keyLight.shadow.map) {
          keyLight.shadow.map.dispose();
          keyLight.shadow.map = null;
        }
      }
    } else {
      renderer.shadowMap.enabled = false;
      if (keyLight) {
        keyLight.castShadow = false;
        if (keyLight.shadow.map) {
          keyLight.shadow.map.dispose();
          keyLight.shadow.map = null;
        }
      }
    }

    if (postPipeline && typeof postPipeline.reconfigure === "function") {
      postPipeline.reconfigure(activeQuality, renderWidth, renderHeight);
    }
  }

  if (effects && typeof effects.setParticleLimit === "function") {
    effects.setParticleLimit(activeQuality.particleLimit);
  }

  logger.info(`Quality preset switched to: ${activeQuality.displayName}`);
  return activeQuality;
}

// Centralized Renderer Configuration (Wired & Operational in Phase 2)
export const RENDER_CONFIG = {
  get pixelRatio() {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    return Math.min(dpr, activeQuality.maxPixelRatio);
  },
  get resolutionScale() {
    return activeQuality.resolutionScale;
  },
  antialias: activeQuality.antialias,
  powerPreference: "high-performance",
  toneMappingExposure: activeQuality.toneMappingExposure,
  fog: {
    color: activeLightingPreset.fogColor,
    density: activeLightingPreset.fogDensity,
  },
  camera: {
    fov: 59,
    near: 0.2,
    far: 1100,
  },
  clearColor: activeLightingPreset.clearColor,
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
