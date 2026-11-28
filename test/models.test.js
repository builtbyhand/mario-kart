import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Setup browser globals for Node test environment
globalThis.window = globalThis;
globalThis.self = globalThis;
if (typeof globalThis.document === "undefined") {
  globalThis.document = {
    getElementById(id) {
      return null;
    },
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
            fillRect() {},
            fillText() {},
            beginPath() {},
            arc() {},
            fill() {},
            stroke() {},
            save() {},
            restore() {},
            translate() {},
            scale() {},
            moveTo() {},
            lineTo() {},
            setLineDash() {},
          };
        },
      };
    },
  };
}

import * as THREE from "three";
import {
  KART_SPECS,
  loadGLB,
  buildGLBKart,
  rigWheels,
  loadKartPack,
  proceduralKart,
  disposeModel,
  assetCache,
  masterCachedGeometries,
  masterCachedMaterials,
  masterCachedTextures,
  clearAssetCache,
} from "../app/src/main/assets/game/models.js";

test("loadKartPack upgrades procedural karts to high-definition GLB models", async () => {
  const root = new THREE.Group();
  const procedural = proceduralKart("mario");
  root.add(procedural);

  const kartObject = {
    id: "mario",
    root,
    model: procedural,
    wheels: rigWheels(procedural),
    source: "procedural",
  };

  const karts = [kartObject];
  let progressCalled = false;

  const status = await loadKartPack(karts, (p) => {
    progressCalled = true;
    assert.equal(p.total, 1);
  });

  assert.ok(progressCalled, "Progress callback must be invoked");
  assert.equal(status.loaded, 1, "Must report 1 loaded model");
  assert.equal(status.fallback, 0, "Must report 0 fallbacks");
  assert.equal(kartObject.source, "glb", "Kart source must be updated to 'glb'");
  assert.notEqual(kartObject.model, procedural, "Procedural model must be replaced");
  assert.equal(kartObject.wheels.length, 4, "Must have 4 rigged wheels");
  assert.ok(kartObject.driver?.userData?.isSourceDriver, "Source driver must be present on kart");
  disposeModel(kartObject.root);
});

test("loadKartPack gracefully falls back when an asset cannot be loaded", async () => {
  const root = new THREE.Group();
  const procedural = proceduralKart("luigi");
  root.add(procedural);

  const kartObject = {
    id: "non-existent-racer-999",
    root,
    model: procedural,
    wheels: rigWheels(procedural),
    source: "procedural",
  };

  // Temporarily map to non-existent file
  KART_SPECS["non-existent-racer-999"] = {
    sourceKart: "models/does-not-exist.glb",
    scale: 2.2,
    driverOffset: [0, 0, 0],
    driverScale: 1.0,
  };

  try {
    const status = await loadKartPack([kartObject]);
    assert.equal(status.loaded, 0, "No models should load for missing files");
    assert.equal(status.fallback, 1, "Must report 1 fallback");
    assert.equal(kartObject.source, "procedural", "Source must remain 'procedural'");
    assert.equal(kartObject.model, procedural, "Procedural model must be kept as fallback");
  } finally {
    delete KART_SPECS["non-existent-racer-999"];
  }
});

test("Repeated GLB loading uses assetCache correctly", async () => {
  const gltf1 = await loadGLB(KART_SPECS.mario.sourceKart);
  const gltf2 = await loadGLB(KART_SPECS.mario.sourceKart);
  assert.strictEqual(gltf1, gltf2, "Subsequent calls to loadGLB must return identical cached GLTF instance");
  assert.ok(assetCache.has(KART_SPECS.mario.sourceKart), "Asset cache must contain the entry");
});

test("Rebuilding and disposing races does not invalidate cached master assets", async () => {
  // Pre-load mario kart
  const kartGltf = await loadGLB(KART_SPECS.mario.sourceKart);
  const charGltf = null;

  // Record master geometry and material references
  const masterGeos = [];
  const masterMats = [];
  kartGltf.scene.traverse((o) => {
    if (o.isMesh) {
      masterGeos.push(o.geometry);
      masterMats.push(o.material);
    }
  });

  // Build race 1
  const race1Kart = buildGLBKart("mario", kartGltf, charGltf);
  assert.ok(race1Kart.model, "Race 1 kart built");

  // Teardown race 1 (simulating constructRace() teardown)
  disposeModel(race1Kart.model);

  // Verify master geometries and materials in assetCache are still intact
  for (const g of masterGeos) {
    assert.ok(g.attributes.position, "Master geometry attributes must remain intact");
    assert.ok(g.attributes.position.count > 0, "Master vertex count must remain > 0");
  }

  // Build race 2 using the same cached GLTF
  const race2Kart = buildGLBKart("mario", kartGltf, charGltf);
  assert.ok(race2Kart.model, "Race 2 kart must build cleanly from cached asset");
  assert.equal(race2Kart.wheels.length, 4, "Race 2 kart must have all 4 wheels");
  assert.ok(race2Kart.driver, "Race 2 kart must have driver");
  assert.ok(race2Kart.driver?.userData?.isSourceDriver, "Race 2 kart must have a source driver");

  // Clean up race 2
  disposeModel(race2Kart.model);
});

test("GPU resources are released only when ownership permits (master assets protected)", async () => {
  const kartGltf = await loadGLB(KART_SPECS.luigi.sourceKart);
  const charGltf = null;

  let masterGeoDisposed = false;
  kartGltf.scene.traverse((o) => {
    if (o.isMesh && o.geometry) {
      const orig = o.geometry.dispose.bind(o.geometry);
      o.geometry.dispose = () => {
        masterGeoDisposed = true;
        orig();
      };
    }
  });

  const built = buildGLBKart("luigi", kartGltf, charGltf);

  let instanceGeoDisposed = 0;
  built.model.traverse((o) => {
    if (o.isMesh && o.geometry) {
      const orig = o.geometry.dispose.bind(o.geometry);
      o.geometry.dispose = () => {
        instanceGeoDisposed++;
        orig();
      };
    }
  });

  disposeModel(built.model);

  assert.ok(instanceGeoDisposed > 0, "Instance geometries must be disposed");
  assert.equal(masterGeoDisposed, false, "Master cached geometry must NEVER be disposed by instance teardown");
});

test("clearAssetCache refuses to clear while active kart instances exist and succeeds when disposed", async () => {
  const kGltf = await loadGLB(KART_SPECS.mario.sourceKart);
  const cGltf = null;

  const kart = buildGLBKart("mario", kGltf, cGltf);

  // Attempt to clear while active instance is alive - must be refused
  const clearResultBlocked = clearAssetCache();
  assert.equal(clearResultBlocked, false, "clearAssetCache must return false while active instances exist");
  assert.ok(assetCache.size > 0, "assetCache must not be emptied while active instances exist");

  // Dispose active instance
  disposeModel(kart.model);

  // Now clear should succeed
  const clearResultSuccess = clearAssetCache();
  assert.equal(clearResultSuccess, true, "clearAssetCache must succeed once all instances are disposed");
  assert.equal(assetCache.size, 0, "assetCache must be empty after successful clear");
});

test("Multiple simultaneous kart instances maintain independent transforms and do not collide", async () => {
  const k1 = await loadGLB(KART_SPECS.mario.sourceKart);
  const c1 = null;
  const k2 = await loadGLB(KART_SPECS.luigi.sourceKart);
  const c2 = null;

  const kart1 = buildGLBKart("mario", k1, c1);
  const kart2 = buildGLBKart("luigi", k2, c2);

  kart1.model.position.set(-2, 0, 5);
  kart2.model.position.set(2, 0, -5);

  kart1.model.updateMatrixWorld(true);
  kart2.model.updateMatrixWorld(true);

  const pos1 = new THREE.Vector3();
  const pos2 = new THREE.Vector3();
  kart1.wheels[0].getWorldPosition(pos1);
  kart2.wheels[0].getWorldPosition(pos2);

  assert.notEqual(pos1.x, pos2.x, "Instances must have independent world positions");
  assert.ok(pos1.distanceTo(pos2) > 5.0, "Instances must be spaced according to their root positions");

  disposeModel(kart1.model);
  disposeModel(kart2.model);
});

test("Repeated race construction and teardown cycles leave master cached assets intact and reusable", async () => {
  const kGltf = await loadGLB(KART_SPECS.peach.sourceKart);
  const cGltf = null;

  for (let cycle = 1; cycle <= 5; cycle++) {
    const built = buildGLBKart("peach", kGltf, cGltf);
    assert.ok(built.model, `Cycle ${cycle}: model built`);
    assert.equal(built.wheels.length, 4, `Cycle ${cycle}: 4 wheels`);
    assert.ok(built.driver, `Cycle ${cycle}: driver attached`);
    disposeModel(built.model);
  }

  // Verify master asset still valid
  assert.ok(kGltf.scene, "Master kart scene still exists");
  assert.ok(kGltf.scene, "Master kart scene still exists");
});
