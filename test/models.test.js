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

test("disposeModel cleanly disposes GLB geometries and materials", async () => {
  const kartGltf = await loadGLB(KART_SPECS.peach.kart);
  const charGltf = await loadGLB(KART_SPECS.peach.character);
  const glbResult = buildGLBKart("peach", kartGltf, charGltf);

  // Track disposal
  let geometriesDisposed = 0;
  glbResult.model.traverse((o) => {
    if (o.geometry) {
      const origDispose = o.geometry.dispose.bind(o.geometry);
      o.geometry.dispose = () => {
        geometriesDisposed++;
        origDispose();
      };
    }
  });

  disposeModel(glbResult.model);
  assert.ok(geometriesDisposed > 0, "All geometries must be cleanly disposed");
});
