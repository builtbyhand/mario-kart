import test from "node:test";
import assert from "node:assert/strict";

// Setup mock browser globals for Node.js test environment
globalThis.window = globalThis;
if (typeof globalThis.document === "undefined") {
  globalThis.document = {
    createElement(tag) {
      return {
        width: 512,
        height: 512,
        getContext() {
          return {
            createImageData(w, h) {
              return { data: new Uint8ClampedArray(w * h * 4) };
            },
            putImageData() {},
          };
        },
      };
    },
  };
}

import * as THREE from "three";
import {
  TextureCache,
  MaterialCache,
  textureCache,
  materialCache,
  createKartPaintMaterial,
  createKartMetalMaterial,
  createKartRubberMaterial,
  createBarrierMaterial,
  createGrassMaterial,
  pavementMaps,
  setMaterialCapabilities,
  getMaterialCapabilities,
} from "../app/src/main/assets/game/materials.js";

test("TextureCache manages lifecycle and disposal cleanly", () => {
  const cache = new TextureCache();
  let disposed = false;
  const mockTexture = {
    id: "tex1",
    dispose() { disposed = true; },
  };

  cache.register("t1", mockTexture);
  assert.equal(cache.get("t1"), mockTexture);

  cache.disposeAll();
  assert.equal(disposed, true);
  assert.equal(cache.textures.size, 0);
});

test("MaterialCache manages materials and prevents memory leaks", () => {
  const cache = new MaterialCache();
  let disposed = false;
  const mockMaterial = {
    id: "mat1",
    dispose() { disposed = true; },
  };

  cache.register("m1", mockMaterial);
  assert.equal(cache.get("m1"), mockMaterial);

  cache.disposeAll();
  assert.equal(disposed, true);
  assert.equal(cache.materials.size, 0);
});

test("createKartPaintMaterial returns stylized physical material", () => {
  const mat = createKartPaintMaterial({ color: "#e52521", clearcoat: 0.85 });
  assert.ok(mat);
  assert.equal(mat.type, "MeshPhysicalMaterial");
  assert.equal(mat.clearcoat, 0.85);
  assert.ok(mat.roughness > 0);
  assert.ok(mat.metalness > 0);
});

test("createKartMetalMaterial returns standard metallic material", () => {
  const mat = createKartMetalMaterial({ color: "#cccccc" });
  assert.ok(mat);
  assert.equal(mat.type, "MeshStandardMaterial");
  assert.ok(mat.metalness >= 0.8);
});

test("createKartRubberMaterial returns low-reflectance tire material", () => {
  const mat = createKartRubberMaterial({ color: "#191c20" });
  assert.ok(mat);
  assert.equal(mat.type, "MeshStandardMaterial");
  assert.ok(mat.roughness >= 0.8);
  assert.ok(mat.metalness <= 0.1);
});

test("createBarrierMaterial and createGrassMaterial construct valid materials", () => {
  const barrier = createBarrierMaterial({ primaryColor: "#e02626" });
  assert.ok(barrier);
  assert.equal(barrier.type, "MeshStandardMaterial");

  const grass = createGrassMaterial({ color: "#3d852a" });
  assert.ok(grass);
  assert.equal(grass.type, "MeshStandardMaterial");
});

test("pavementMaps generates textures with proper color spaces", () => {
  const maps = pavementMaps({ size: 64, anisotropy: 4 });
  assert.ok(maps.map);
  assert.ok(maps.normalMap);
  assert.ok(maps.roughnessMap);
  assert.equal(maps.map.colorSpace, THREE.SRGBColorSpace);
  assert.equal(maps.normalMap.colorSpace, THREE.NoColorSpace);
});

test("pavementMaps respects hardware limits and ensures simulated 4x device never receives anisotropy above 4x", () => {
  textureCache.disposeAll();
  const simulated4xCaps = {
    maxAnisotropy: 4,
    maxTextureSize: 2048,
    clampAnisotropy: (req) => Math.max(1, Math.min(req || 1, 4)),
    clampTextureSize: (sz) => Math.min(sz || 512, 2048),
  };

  // 1. Explicit capabilities argument with 16x requested -> clamped to 4x
  const mapsExplicit = pavementMaps({ size: 64, anisotropy: 16 }, simulated4xCaps);
  assert.equal(mapsExplicit.map.anisotropy, 4);
  assert.equal(mapsExplicit.normalMap.anisotropy, 4);
  assert.equal(mapsExplicit.roughnessMap.anisotropy, 4);
  assert.ok(mapsExplicit.map.anisotropy <= 4);

  // 2. Monitored texture property assignment proving simulated 4x device never receives an anisotropy request above 4x
  textureCache.disposeAll();
  let maxAssignedAnisotropy = 0;
  const originalAnisotropyDesc = Object.getOwnPropertyDescriptor(THREE.Texture.prototype, "anisotropy");

  try {
    Object.defineProperty(THREE.Texture.prototype, "anisotropy", {
      set(val) {
        if (val > maxAssignedAnisotropy) maxAssignedAnisotropy = val;
        this._anisoVal = val;
      },
      get() {
        return this._anisoVal ?? 1;
      },
      configurable: true,
    });

    // Request 16x anisotropy
    const trackedMaps = pavementMaps({ size: 64, anisotropy: 16 }, simulated4xCaps);
    assert.equal(maxAssignedAnisotropy, 4, "Max assigned anisotropy must be exactly 4x");
    assert.ok(maxAssignedAnisotropy <= 4, "Simulated 4x device never receives an anisotropy request above 4x");
    assert.equal(trackedMaps.map.anisotropy, 4);
  } finally {
    if (originalAnisotropyDesc) {
      Object.defineProperty(THREE.Texture.prototype, "anisotropy", originalAnisotropyDesc);
    } else {
      delete THREE.Texture.prototype.anisotropy;
    }
  }

  // 3. Global material capabilities path (setMaterialCapabilities)
  textureCache.disposeAll();
  setMaterialCapabilities(simulated4xCaps);
  try {
    const mapsGlobal = pavementMaps({ size: 64, anisotropy: 16 });
    assert.equal(mapsGlobal.map.anisotropy, 4);
    assert.ok(mapsGlobal.map.anisotropy <= 4);
  } finally {
    setMaterialCapabilities(null);
  }
});
