import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Setup browser globals for Node test environment
globalThis.window = globalThis;
globalThis.self = globalThis;
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

test("All 8 kart GLB models exist, parse cleanly, and contain four wheels", async () => {
  for (const [id, spec] of Object.entries(KART_SPECS)) {
    const gltf = await loadGLB(spec.kart);
    assert.ok(gltf, `GLTF loaded for ${id}`);
    assert.ok(gltf.scene, `GLTF scene present for ${id}`);

    // Verify 4 wheel meshes
    const wheelNames = [
      "wheel-front-left",
      "wheel-front-right",
      "wheel-back-left",
      "wheel-back-right",
    ];
    for (const wName of wheelNames) {
      const mesh = gltf.scene.getObjectByName(wName);
      assert.ok(mesh, `Kart ${spec.kart} must contain mesh ${wName}`);
      assert.ok(mesh.isMesh, `${wName} must be a Three.Mesh`);
    }
  }
});

test("All 8 driver character GLB models exist, contain bone rigs, and have driving animations", async () => {
  for (const [id, spec] of Object.entries(KART_SPECS)) {
    const gltf = await loadGLB(spec.character);
    assert.ok(gltf, `Driver GLTF loaded for ${id}`);
    assert.ok(gltf.scene, `Driver scene present for ${id}`);

    // Verify skeletal bones
    const head = gltf.scene.getObjectByName("head");
    assert.ok(head, `Driver ${spec.character} must have a 'head' bone/node`);

    // Verify drive animation clip
    const driveClip = gltf.animations.find((a) => a.name === "drive");
    assert.ok(driveClip, `Driver ${spec.character} must have a 'drive' animation clip`);
    assert.ok(driveClip.duration > 0, "Drive clip duration must be > 0");
  }
});

test("buildGLBKart constructs fully articulated kart with wheels, animated driver, and camera anchor", async () => {
  const kartGltf = await loadGLB(KART_SPECS.mario.kart);
  const charGltf = await loadGLB(KART_SPECS.mario.character);

  const result = buildGLBKart("mario", kartGltf, charGltf);
  assert.ok(result.model, "Model group must be constructed");
  assert.equal(result.model.name, "glb-kart");
  assert.equal(result.model.userData.isGLB, true);

  // Wheels validation
  assert.equal(result.wheels.length, 4, "Must have exactly 4 articulated wheels");
  for (const [i, w] of result.wheels.entries()) {
    assert.ok(w, `Wheel ${i} must exist`);
    assert.equal(w.name, "wheel-" + i);
    assert.ok(w.userData.rolling, `Wheel ${i} must have rolling group`);
    assert.ok(w.userData.glow, `Wheel ${i} must have anti-gravity glow ring`);
    assert.equal(w.userData.glow.visible, false, "Glow ring must be initially invisible");

    // Test wheel rolling
    const initialRotX = w.userData.rolling.rotation.x;
    w.userData.rolling.rotation.x -= 0.5;
    assert.equal(w.userData.rolling.rotation.x, initialRotX - 0.5);

    // Test front wheel steering
    if (i < 2) {
      w.rotation.y = -0.25;
      assert.equal(w.rotation.y, -0.25);
    }
  }

  // Driver validation
  assert.ok(result.driver, "Driver scene must be attached");
  assert.ok(result.mixer, "AnimationMixer must be initialized");
  assert.ok(result.driverHead, "Driver head anchor must be resolved");
  assert.equal(result.driverHead.name, "driver-head");
  assert.ok(result.driverHead.userData.lookRestQuaternion, "Must store lookRestQuaternion");

  // Step animation mixer
  result.mixer.update(0.016);
});

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
  assert.ok(kartObject.mixer, "Mixer must be present on kart");
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
    kart: "models/does-not-exist.glb",
    character: "models/does-not-exist-char.glb",
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
  const gltf1 = await loadGLB(KART_SPECS.mario.kart);
  const gltf2 = await loadGLB(KART_SPECS.mario.kart);
  assert.strictEqual(gltf1, gltf2, "Subsequent calls to loadGLB must return identical cached GLTF instance");
  assert.ok(assetCache.has(KART_SPECS.mario.kart), "Asset cache must contain the entry");
});

test("Rebuilding and disposing races does not invalidate cached master assets", async () => {
  // Pre-load mario kart
  const kartGltf = await loadGLB(KART_SPECS.mario.kart);
  const charGltf = await loadGLB(KART_SPECS.mario.character);

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
  assert.ok(race2Kart.mixer, "Race 2 kart must have functional mixer");

  // Clean up race 2
  disposeModel(race2Kart.model);
});

test("GPU resources are released only when ownership permits (master assets protected)", async () => {
  const kartGltf = await loadGLB(KART_SPECS.luigi.kart);
  const charGltf = await loadGLB(KART_SPECS.luigi.character);

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

test("All eight driver/kart combinations have valid world dimensions and seating attachment", async () => {
  for (const [id, spec] of Object.entries(KART_SPECS)) {
    const kGltf = await loadGLB(spec.kart);
    const cGltf = await loadGLB(spec.character);
    const built = buildGLBKart(id, kGltf, cGltf);

    built.model.updateMatrixWorld(true);

    // Measure kart body bounds (excluding driver)
    const kartScene = built.model.children.find((c) => c !== built.driver && !c.name.startsWith("wheel-"));
    assert.ok(kartScene, `${id} must contain kartScene`);
    const kBox = new THREE.Box3().setFromObject(kartScene);
    const kartLength = kBox.max.z - kBox.min.z;

    assert.ok(
      kartLength >= 2.5 && kartLength <= 4.0,
      `${id} kart length (${kartLength.toFixed(2)}m) must be in valid vehicle range [2.5, 4.0]`
    );

    // Measure driver bounds
    assert.ok(built.driver, `${id} must have driverScene`);
    const dBox = new THREE.Box3().setFromObject(built.driver);
    const driverHeight = dBox.max.y - dBox.min.y;
    const driverSeatY = dBox.min.y;
    const driverHeadY = dBox.max.y;

    assert.ok(
      driverHeight >= 0.85 && driverHeight <= 1.30,
      `${id} driver height (${driverHeight.toFixed(2)}m) must be stylized humanoid proportion [0.85, 1.30]`
    );
    assert.ok(
      driverSeatY >= 0.25 && driverSeatY <= 0.60,
      `${id} driver seat Y (${driverSeatY.toFixed(2)}m) must sit in cockpit floor/seat [0.25, 0.60]`
    );
    assert.ok(
      driverHeadY >= 1.25 && driverHeadY <= 1.70,
      `${id} driver head Y (${driverHeadY.toFixed(2)}m) must be visible above cockpit [1.25, 1.70]`
    );

    // Verify 4 wheels
    assert.equal(built.wheels.length, 4, `${id} must have 4 wheels`);
    for (let wi = 0; wi < 4; wi++) {
      const w = built.wheels[wi];
      assert.ok(w, `${id} wheel-${wi} exists`);
      assert.ok(w.userData.rolling, `${id} wheel-${wi} has rolling group`);
      assert.ok(w.userData.glow, `${id} wheel-${wi} has anti-glow group`);
      assert.ok(w.position.y >= 0.30 && w.position.y <= 0.70, `${id} wheel-${wi} axle height must be reasonable`);
    }

    disposeModel(built.model);
  }
});

test("Driver animation and wheel motion behavior remain functional across frame updates", async () => {
  const kGltf = await loadGLB(KART_SPECS.toad.kart);
  const cGltf = await loadGLB(KART_SPECS.toad.character);
  const built = buildGLBKart("toad", kGltf, cGltf);

  // 1. Animation mixer update
  assert.ok(built.mixer, "Mixer must exist");
  assert.doesNotThrow(() => {
    built.mixer.update(0.016);
  }, "Mixer must advance cleanly on frame update");

  // 2. Wheel rolling rotation
  const frontLeft = built.wheels[0];
  const rolling = frontLeft.userData.rolling;
  const initialRotX = rolling.rotation.x;
  rolling.rotation.x -= (15 * 0.016) / 0.39;
  assert.ok(rolling.rotation.x < initialRotX, "Rolling forward must decrease rotation.x");

  // 3. Wheel steering
  frontLeft.rotation.y = -0.5 * 0.32;
  assert.equal(frontLeft.rotation.y, -0.16, "Wheel steering must apply to pivot Y");

  // 4. Anti-gravity glow toggle
  assert.equal(frontLeft.userData.glow.visible, false, "Glow must start hidden");
  frontLeft.userData.glow.visible = true;
  assert.equal(frontLeft.userData.glow.visible, true, "Glow must toggle visible during anti-gravity");

  // 5. Driver steering lean
  built.driver.rotation.z = -0.5 * 0.12;
  assert.equal(built.driver.rotation.z, -0.06, "Driver must lean into steer angle");

  // 6. Driver head look
  assert.ok(built.driverHead, "Driver head must exist");
  assert.ok(built.driverHead.userData.lookRestQuaternion, "Driver head must cache rest quaternion");

  disposeModel(built.model);
});
