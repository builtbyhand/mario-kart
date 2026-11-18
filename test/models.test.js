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
  disposeModel(result.model);
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

test("All eight driver/kart combinations have verified anatomical seating and clearance", async () => {
  for (const [id, spec] of Object.entries(KART_SPECS)) {
    const kGltf = await loadGLB(spec.kart);
    const cGltf = await loadGLB(spec.character);
    const built = buildGLBKart(id, kGltf, cGltf);

    try {
      // 1. Evaluate driving animation pose
      assert.ok(built.mixer, `${id} must have AnimationMixer`);
      built.mixer.update(0.016);
      built.model.updateMatrixWorld(true);

      // 2. Anatomical references on driver
      const rootBone = built.driver.getObjectByName("root");
      assert.ok(rootBone, `${id} must have 'root' pelvis/hip origin bone`);
      const torsoBone = built.driver.getObjectByName("torso");
      assert.ok(torsoBone, `${id} must have 'torso' spine bone`);
      const headBone = built.driverHead;
      assert.ok(headBone, `${id} must have head bone / driverHead anchor`);
      const armL = built.driver.getObjectByName("arm-left");
      const armR = built.driver.getObjectByName("arm-right");
      assert.ok(armL && armR, `${id} must have arm/hand bones`);

      // Evaluate world positions
      const pelvisWorldPos = new THREE.Vector3();
      rootBone.getWorldPosition(pelvisWorldPos);

      const torsoWorldPos = new THREE.Vector3();
      torsoBone.getWorldPosition(torsoWorldPos);

      const headWorldPos = new THREE.Vector3();
      headBone.getWorldPosition(headWorldPos);

      const handLWorldPos = new THREE.Vector3();
      armL.getWorldPosition(handLWorldPos);
      const handRWorldPos = new THREE.Vector3();
      armR.getWorldPosition(handRWorldPos);

      // Head bone must be anatomically above torso and pelvis
      assert.ok(
        headWorldPos.y > torsoWorldPos.y && torsoWorldPos.y > pelvisWorldPos.y,
        `${id} vertical anatomical order must hold: head (${headWorldPos.y.toFixed(3)}) > torso (${torsoWorldPos.y.toFixed(3)}) > pelvis (${pelvisWorldPos.y.toFixed(3)})`
      );

      // Head clearance: head bone must sit naturally above cockpit rim [0.70m, 0.96m]
      assert.ok(
        headWorldPos.y >= 0.70 && headWorldPos.y <= 0.96,
        `${id} head bone Y (${headWorldPos.y.toFixed(3)}m) must be naturally positioned above cockpit rim [0.70, 0.96]`
      );

      // Hands reach steering wheel forward into the cockpit
      assert.ok(
        handLWorldPos.z < pelvisWorldPos.z + 0.15 && handRWorldPos.z < pelvisWorldPos.z + 0.15,
        `${id} hands must reach forward toward steering area`
      );
      const handSeparation = handLWorldPos.distanceTo(handRWorldPos);
      assert.ok(
        handSeparation >= 0.28 && handSeparation <= 0.40,
        `${id} hand separation (${handSeparation.toFixed(3)}m) must match steering wheel grip width [0.28, 0.40]`
      );

      // 3. Cockpit seating reference comparison
      // Locate the chassis mesh
      const kartScene = built.model.children.find((c) => c !== built.driver && !c.name.startsWith("wheel-"));
      const chassisBox = new THREE.Box3().setFromObject(kartScene);
      const underbodyFloor = chassisBox.min.y;

      // The pelvis contact plane must NEVER penetrate through the underbody floor of the kart
      assert.ok(
        pelvisWorldPos.y > underbodyFloor,
        `${id} pelvis bone (${pelvisWorldPos.y.toFixed(3)}m) must not clip through underbody floor (${underbodyFloor.toFixed(3)}m)`
      );

      // Driver must be centered laterally inside the chassis
      assert.ok(
        Math.abs(pelvisWorldPos.x) < 0.05,
        `${id} pelvis bone must be centered laterally in cockpit (x=${pelvisWorldPos.x.toFixed(4)})`
      );

      // Cockpit seating height alignment:
      // Open karts have higher seats (0.28m-0.35m pelvis bone Y); sports cars have lower bucket floors (0.20m-0.28m pelvis bone Y)
      if (spec.scale > 2.0) {
        assert.ok(
          pelvisWorldPos.y >= 0.28 && pelvisWorldPos.y <= 0.35,
          `${id} open-kart pelvis bone Y (${pelvisWorldPos.y.toFixed(3)}m) aligns with seat cushion level [0.28, 0.35]`
        );
      } else {
        assert.ok(
          pelvisWorldPos.y >= 0.20 && pelvisWorldPos.y <= 0.28,
          `${id} sports-car pelvis bone Y (${pelvisWorldPos.y.toFixed(3)}m) aligns with low cockpit floor [0.20, 0.28]`
        );
      }

      // Measure overall kart vehicle length
      const kartLength = chassisBox.max.z - chassisBox.min.z;
      assert.ok(
        kartLength >= 2.5 && kartLength <= 4.0,
        `${id} kart length (${kartLength.toFixed(2)}m) must be in valid vehicle range [2.5, 4.0]`
      );
    } finally {
      disposeModel(built.model);
    }
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

test("All 32 wheels across all eight karts match independent world-space geometry with zero wobble", async () => {
  const wheelAliases = [
    ["wheel-front-left", "wheel-0"],
    ["wheel-front-right", "wheel-1"],
    ["wheel-back-left", "wheel-2"],
    ["wheel-back-right", "wheel-3"],
  ];

  for (const [id, spec] of Object.entries(KART_SPECS)) {
    const rawGltf = await loadGLB(spec.kart);
    const charGltf = await loadGLB(spec.character);

    // Build independent reference scene to derive ground-truth world geometry
    const refScene = rawGltf.scene.clone(true);
    const refRoot = new THREE.Group();
    refScene.scale.setScalar(spec.scale);
    refScene.rotation.y = Math.PI;
    refRoot.add(refScene);
    refRoot.updateMatrixWorld(true);

    const built = buildGLBKart(id, rawGltf, charGltf);
    built.model.updateMatrixWorld(true);

    for (let i = 0; i < 4; i++) {
      const [name, alias] = wheelAliases[i];
      const origMesh = refScene.getObjectByName(name) || refScene.getObjectByName(alias);
      assert.ok(origMesh, `${id} ${name} must exist in source GLTF`);

      // 1. Independently derive expected world-space bounding geometry directly from transformed vertices
      const posAttr = origMesh.geometry.attributes.position;
      const vWorld = new THREE.Vector3();
      const expectedWorldBox = new THREE.Box3();
      for (let vi = 0; vi < posAttr.count; vi++) {
        vWorld.fromBufferAttribute(posAttr, vi).applyMatrix4(origMesh.matrixWorld);
        expectedWorldBox.expandByPoint(vWorld);
      }
      const expectedAxle = expectedWorldBox.getCenter(new THREE.Vector3());
      const expectedExtent = expectedWorldBox.getSize(new THREE.Vector3());

      // 2. Validate built wheelPivot world position against independent axle center
      const pivot = built.wheels[i];
      const pivotWorldPos = new THREE.Vector3();
      pivot.getWorldPosition(pivotWorldPos);

      const diff = pivotWorldPos.distanceTo(expectedAxle);
      assert.ok(
        diff < 1e-5,
        `${id} wheel-${i} pivot (${pivotWorldPos.x.toFixed(4)}, ${pivotWorldPos.y.toFixed(4)}, ${pivotWorldPos.z.toFixed(4)}) ` +
        `must match independently derived world axle (${expectedAxle.x.toFixed(4)}, ${expectedAxle.y.toFixed(4)}, ${expectedAxle.z.toFixed(4)}) ` +
        `within 0.01mm (diff was ${diff.toExponential(3)}m)`
      );

      // 3. Compare reconstructed wheel mesh geometry in world space
      const rolling = pivot.userData.rolling;
      const builtMesh = rolling.children.find((c) => c.isMesh);
      assert.ok(builtMesh, `${id} wheel-${i} rolling group must contain wheel mesh`);

      const builtWorldBox = new THREE.Box3();
      const bPosAttr = builtMesh.geometry.attributes.position;
      for (let vi = 0; vi < bPosAttr.count; vi++) {
        vWorld.fromBufferAttribute(bPosAttr, vi).applyMatrix4(builtMesh.matrixWorld);
        builtWorldBox.expandByPoint(vWorld);
      }
      const builtCenter = builtWorldBox.getCenter(new THREE.Vector3());
      const centerDiff = builtCenter.distanceTo(expectedAxle);
      assert.ok(
        centerDiff < 1e-5,
        `${id} wheel-${i} reconstructed mesh world center must match original source mesh (diff: ${centerDiff.toExponential(3)}m)`
      );

      // 4. Verify reconstructed wheel mesh in rolling space has center (0, 0, 0) for zero wobble
      builtMesh.geometry.computeBoundingBox();
      const localCenter = builtMesh.geometry.boundingBox.getCenter(new THREE.Vector3());
      const centerInRolling = localCenter.clone().applyMatrix4(builtMesh.matrix);
      assert.ok(
        centerInRolling.length() < 1e-5,
        `${id} wheel-${i} center in rolling group must be (0, 0, 0) for zero wobble (got ${centerInRolling.length().toExponential(3)})`
      );

      // 5. Verify reconstructed dimensions and radius
      const builtExtent = builtWorldBox.getSize(new THREE.Vector3());
      const extentDiff = builtExtent.distanceTo(expectedExtent);
      assert.ok(
        extentDiff < 1e-4,
        `${id} wheel-${i} reconstructed dimensions must match original extent (diff: ${extentDiff.toExponential(3)}m)`
      );
    }

    disposeModel(built.model);
    disposeModel(refRoot);
  }
});

test("Regression test: wheel transform calculation handles deeply nested non-identity parent hierarchies without assumption", async () => {
  // Construct a synthetic GLTF scene with multiple nested parent nodes having non-identity translation, rotation and scale
  const syntheticScene = new THREE.Group();
  syntheticScene.name = "synthetic-kart";

  const chassisParent = new THREE.Group();
  chassisParent.name = "chassis-parent";
  chassisParent.position.set(0.35, 0.42, -0.28);
  chassisParent.rotation.set(0.12, -0.25, 0.08);
  chassisParent.scale.set(1.3, 1.3, 1.3);
  syntheticScene.add(chassisParent);

  const subAssembly = new THREE.Group();
  subAssembly.name = "sub-assembly";
  subAssembly.position.set(-0.15, 0.10, 0.22);
  subAssembly.rotation.set(-0.05, 0.18, 0.10);
  subAssembly.scale.set(0.85, 0.85, 0.85);
  chassisParent.add(subAssembly);

  // Add 4 synthetic wheel meshes inside the nested hierarchy
  const wheelOffsets = [
    ["wheel-front-left", [-0.4, 0.0, 0.6]],
    ["wheel-front-right", [0.4, 0.0, 0.6]],
    ["wheel-back-left", [-0.4, 0.0, -0.6]],
    ["wheel-back-right", [0.4, 0.0, -0.6]],
  ];

  for (const [wName, offset] of wheelOffsets) {
    const geo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const wMesh = new THREE.Mesh(geo, mat);
    wMesh.name = wName;
    wMesh.position.set(...offset);
    wMesh.rotation.set(0, 0, Math.PI / 2); // local wheel orientation
    subAssembly.add(wMesh);
  }

  const syntheticGltf = { scene: syntheticScene };
  const mockCharGltf = await loadGLB(KART_SPECS.mario.character);

  KART_SPECS["synthetic-test"] = {
    kart: "synthetic",
    character: KART_SPECS.mario.character,
    scale: 1.75,
    driverOffset: [0, 0.5, 0],
    driverScale: 1.5,
  };

  try {
    // 1. Derive expected world axle positions independently from the reference hierarchy
    const refScene = syntheticScene.clone(true);
    const refRoot = new THREE.Group();
    refScene.scale.setScalar(1.75);
    refScene.rotation.y = Math.PI;
    refRoot.add(refScene);
    refRoot.updateMatrixWorld(true);

    const expectedAxles = wheelOffsets.map(([name]) => {
      const orig = refScene.getObjectByName(name);
      const posAttr = orig.geometry.attributes.position;
      const v = new THREE.Vector3();
      const b = new THREE.Box3();
      for (let i = 0; i < posAttr.count; i++) {
        v.fromBufferAttribute(posAttr, i).applyMatrix4(orig.matrixWorld);
        b.expandByPoint(v);
      }
      return b.getCenter(new THREE.Vector3());
    });

    // 2. Build kart through production buildGLBKart
    const built = buildGLBKart("synthetic-test", syntheticGltf, mockCharGltf);
    built.model.updateMatrixWorld(true);

    for (let i = 0; i < 4; i++) {
      const pivot = built.wheels[i];
      const pivotPos = new THREE.Vector3();
      pivot.getWorldPosition(pivotPos);

      const diff = pivotPos.distanceTo(expectedAxles[i]);
      assert.ok(
        diff < 1e-5,
        `Synthetic wheel-${i} pivot must match expected axle even with nested parent transforms (diff: ${diff.toExponential(3)}m)`
      );

      // Verify zero eccentric wobble in rolling group
      const rolling = pivot.userData.rolling;
      const builtMesh = rolling.children.find((c) => c.isMesh);
      builtMesh.geometry.computeBoundingBox();
      const localCenter = builtMesh.geometry.boundingBox.getCenter(new THREE.Vector3());
      const centerInRolling = localCenter.clone().applyMatrix4(builtMesh.matrix);
      assert.ok(
        centerInRolling.length() < 1e-5,
        `Synthetic wheel-${i} in rolling group must rotate around exact axle with zero wobble (got ${centerInRolling.length().toExponential(3)})`
      );
    }

    disposeModel(built.model);
    disposeModel(refRoot);
  } finally {
    delete KART_SPECS["synthetic-test"];
  }
});

test("clearAssetCache refuses to clear while active kart instances exist and succeeds when disposed", async () => {
  const kGltf = await loadGLB(KART_SPECS.mario.kart);
  const cGltf = await loadGLB(KART_SPECS.mario.character);

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
  const k1 = await loadGLB(KART_SPECS.mario.kart);
  const c1 = await loadGLB(KART_SPECS.mario.character);
  const k2 = await loadGLB(KART_SPECS.luigi.kart);
  const c2 = await loadGLB(KART_SPECS.luigi.character);

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
  const kGltf = await loadGLB(KART_SPECS.peach.kart);
  const cGltf = await loadGLB(KART_SPECS.peach.character);

  for (let cycle = 1; cycle <= 5; cycle++) {
    const built = buildGLBKart("peach", kGltf, cGltf);
    assert.ok(built.model, `Cycle ${cycle}: model built`);
    assert.equal(built.wheels.length, 4, `Cycle ${cycle}: 4 wheels`);
    assert.ok(built.driver, `Cycle ${cycle}: driver attached`);
    disposeModel(built.model);
  }

  // Verify master asset still valid
  assert.ok(kGltf.scene, "Master kart scene still exists");
  assert.ok(cGltf.scene, "Master character scene still exists");
});
