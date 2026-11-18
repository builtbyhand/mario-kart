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
