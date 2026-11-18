import * as THREE from "three";
import { activeQuality } from "./config.js";

/**
 * Texture and Resource Cache
 * Tracks GPU textures and materials to prevent memory leaks and support clean WebGL context restoration.
 */
export class TextureCache {
  constructor() {
    this.textures = new Map();
  }

  get(id, factory) {
    if (this.textures.has(id)) {
      return this.textures.get(id);
    }
    if (typeof factory === "function") {
      const tex = factory();
      if (tex) this.textures.set(id, tex);
      return tex;
    }
    return null;
  }

  register(id, texture) {
    if (this.textures.has(id) && this.textures.get(id) !== texture) {
      this.textures.get(id).dispose();
    }
    this.textures.set(id, texture);
    return texture;
  }

  disposeAll() {
    for (const tex of this.textures.values()) {
      if (tex && typeof tex.dispose === "function") {
        tex.dispose();
      }
    }
    this.textures.clear();
  }
}

export class MaterialCache {
  constructor() {
    this.materials = new Map();
  }

  get(id, factory) {
    if (this.materials.has(id)) {
      return this.materials.get(id);
    }
    if (typeof factory === "function") {
      const mat = factory();
      if (mat) this.materials.set(id, mat);
      return mat;
    }
    return null;
  }

  register(id, material) {
    if (this.materials.has(id) && this.materials.get(id) !== material) {
      this.materials.get(id).dispose();
    }
    this.materials.set(id, material);
    return material;
  }

  disposeAll() {
    for (const mat of this.materials.values()) {
      if (mat && typeof mat.dispose === "function") {
        mat.dispose();
      }
    }
    this.materials.clear();
  }
}

export const textureCache = new TextureCache();
export const materialCache = new MaterialCache();

/**
 * Deterministic, local pavement maps with accurate sRGB color-space configuration.
 * Enhanced for crisp surface micro-details, clamped against device capabilities.
 */
export function pavementMaps(options = {}, capabilities = null) {
  const maxSize = capabilities?.maxTextureSize || 4096;
  const maxAniso = capabilities?.maxAnisotropy || 16;
  const size = Math.min(options.size || 512, maxSize);
  const requestedAniso = options.anisotropy || activeQuality?.anisotropy || 8;
  const anisotropy = Math.max(1, Math.min(requestedAniso, maxAniso));
  const cacheKey = `pavement_${size}_${anisotropy}`;

  if (textureCache.textures.has(cacheKey + "_diffuse")) {
    return {
      map: textureCache.textures.get(cacheKey + "_diffuse"),
      normalMap: textureCache.textures.get(cacheKey + "_normal"),
      roughnessMap: textureCache.textures.get(cacheKey + "_roughness"),
    };
  }

  const height = new Float32Array(size * size);
  let seed = 28971;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const diffuse = document.createElement("canvas"),
    normal = document.createElement("canvas"),
    rough = document.createElement("canvas");
  for (const c of [diffuse, normal, rough]) c.width = c.height = size;
  const dc = diffuse.getContext("2d"),
    nc = normal.getContext("2d"),
    rc = rough.getContext("2d");
  const di = dc.createImageData(size, size),
    ni = nc.createImageData(size, size),
    ri = rc.createImageData(size, size);
  // Periodic cellular aggregate: neighbouring pixels belong to the same stone.
  const cells = 256,
    cell = size / cells,
    stones = Array.from({ length: cells * cells }, () => ({
      x: random(),
      y: random(),
      v: random(),
    }));
  const pigment = new Float32Array(size * size),
    edgeShade = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / cell),
        cy = Math.floor(y / cell);
      let nearest = Infinity,
        second = Infinity,
        stone = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const sx = cx + dx,
            sy = cy + dy,
            data =
              stones[((sy + cells) % cells) * cells + ((sx + cells) % cells)];
          const d = Math.hypot(
            x - (sx + 0.15 + data.x * 0.7) * cell,
            y - (sy + 0.15 + data.y * 0.7) * cell,
          );
          if (d < nearest) {
            second = nearest;
            nearest = d;
            stone = data.v;
          } else if (d < second) second = d;
        }
      const i = y * size + x,
        edge = Math.min(1, (second - nearest) / 0.65),
        noise = random();
      pigment[i] = stone;
      edgeShade[i] = edge;
      height[i] = 0.12 + edge * 0.22 + stone * 0.12 + noise * 0.2;
    }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x,
        j = i * 4,
        v = height[i],
        large =
          (Math.sin(x * 0.08) +
            Math.cos(y * 0.09) +
            Math.sin((x + y) * 0.022)) *
          0.8;
      const grain = 91 + pigment[i] * 45 + edgeShade[i] * 10 + v * 19 + large;
      di.data.set([grain * 0.96, grain * 0.98, grain, 255], j);
      const dx =
          height[y * size + ((x + 1) % size)] -
          height[y * size + ((x + size - 1) % size)],
        dy =
          height[((y + 1) % size) * size + x] -
          height[((y + size - 1) % size) * size + x];
      const len = Math.hypot(dx * 0.9, dy * 0.9, 1);
      ni.data.set(
        [128 + (dx / len) * 100, 128 + (dy / len) * 100, 128 + 127 / len, 255],
        j,
      );
      const rv = 205 + edgeShade[i] * 22 - pigment[i] * 18;
      ri.data.set([rv, rv, rv, 255], j);
    }
  dc.putImageData(di, 0, 0);
  nc.putImageData(ni, 0, 0);
  rc.putImageData(ri, 0, 0);

  const map = new THREE.CanvasTexture(diffuse),
    normalMap = new THREE.CanvasTexture(normal),
    roughnessMap = new THREE.CanvasTexture(rough);

  // Set explicit color spaces for physically accurate rendering
  map.colorSpace = THREE.SRGBColorSpace;
  normalMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.colorSpace = THREE.NoColorSpace;

  for (const t of [map, normalMap, roughnessMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = anisotropy;
    t.repeat.set(3, 1.5);
  }

  textureCache.register(cacheKey + "_diffuse", map);
  textureCache.register(cacheKey + "_normal", normalMap);
  textureCache.register(cacheKey + "_roughness", roughnessMap);

  return { map, normalMap, roughnessMap };
}

export function roadMaterial(maps, color = "#838482", paint = false) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    ...maps,
    normalScale: new THREE.Vector2(paint ? 0.23 : 0.5, paint ? 0.23 : 0.5),
    roughness: paint ? 0.54 : 0.68,
    metalness: paint ? 0.08 : 0.06,
  });
  // Wear along the racing line, subtle resurfacing patches and edge dirt use
  // physical ribbon UVs. Details survive a video encode without a noisy overlay.
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
    float lane = vMapUv.x / 3.0;
    float tyre = pow(abs(sin(lane*19.0)),26.0);
    float roadWear = (1.0-smoothstep(0.32,0.5,abs(lane-.5)));
    float wearPatch = sin(vMapUv.y*.6)*sin(vMapUv.y*.13);
    diffuseColor.rgb *= 1.0 - roadWear*tyre*.1 - wearPatch*.028;
  `,
    );
  };
  return mat;
}

/**
 * PBR Material Pipeline
 * Stylized automotive, metallic, rubber, and racetrack barrier materials inspired by Mario Kart Tour.
 */

export function createKartPaintMaterial(options = {}) {
  const {
    color = "#e52521",
    roughness = 0.32,
    metalness = 0.25,
    clearcoat = 0.8,
    clearcoatRoughness = 0.12,
  } = options;

  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness,
    clearcoat,
    clearcoatRoughness,
    reflectivity: 0.85,
  });
}

export function createKartMetalMaterial(options = {}) {
  const {
    color = "#d6dbe0",
    roughness = 0.28,
    metalness = 0.88,
  } = options;

  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
}

export function createKartRubberMaterial(options = {}) {
  const {
    color = "#191c20",
    roughness = 0.82,
    metalness = 0.04,
  } = options;

  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
}

export function createBarrierMaterial(options = {}) {
  const {
    primaryColor = "#e02626",
    secondaryColor = "#ffffff",
    roughness = 0.45,
    metalness = 0.15,
  } = options;

  return new THREE.MeshStandardMaterial({
    color: primaryColor,
    roughness,
    metalness,
  });
}

export function createGrassMaterial(options = {}) {
  const {
    color = "#3d852a",
    roughness = 0.92,
    metalness = 0.0,
    map = null,
  } = options;

  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
  if (map) mat.map = map;
  return mat;
}
