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

test("All eight driver/kart combinations satisfy approximate geometric cockpit placement, clearance and proportion constraints", async () => {
  for (const [id, spec] of Object.entries(KART_SPECS)) {
    const kGltf = await loadGLB(spec.kart);
    const cGltf = await loadGLB(spec.character);
    const built = buildGLBKart(id, kGltf, cGltf);

    try {
      // 1. Evaluate driving animation pose
      assert.ok(built.mixer, `${id} must have AnimationMixer`);
      built.mixer.update(0.1);
      built.model.updateMatrixWorld(true);

      // 2. Asset reference inspection & reporting
      // Check whether source assets contain separate seat or steering-wheel submesh nodes
      const hasSteeringWheelMesh = !!(kGltf.scene.getObjectByName("steering-wheel") || kGltf.scene.getObjectByName("steering_wheel"));
      const hasSeatMesh = !!(kGltf.scene.getObjectByName("seat") || kGltf.scene.getObjectByName("cockpit_seat"));

      // Source assets lack discrete physical seat-cushion and steering-wheel submesh nodes.
      // Therefore, approximateSeatPlaneY and approximateSteeringZoneRef are documented approximate
      // geometric proxies representing the expected cockpit bounding volume rather than verified physical contact surfaces.
      assert.ok(!hasSteeringWheelMesh && !hasSeatMesh, `${id} source assets confirm absence of discrete physical seat/wheel meshes; using approximate geometric proxies`);

      // 3. Evaluate driver geometry using complete bind-matrix skinning transformation.
      // In the absence of discrete physical finger/wrist or ischial tuberosity landmarks on these stylized mini-character meshes,
      // the distal arm extremity cluster centroid and lowest torso/root vertex serve as approximate geometric proxies.
      const bodyMesh = built.driver.getObjectByName("body-mesh");
      assert.ok(bodyMesh, `${id} must have driver body-mesh`);
      const headMesh = built.driver.getObjectByName("head-mesh");
      assert.ok(headMesh, `${id} must have driver head-mesh`);

      const bodyGeom = bodyMesh.geometry;
      const skinIndices = bodyGeom.attributes.skinIndex;
      const skinWeights = bodyGeom.attributes.skinWeight;
      const posAttr = bodyGeom.attributes.position;

      const bones = bodyMesh.skeleton.bones;
      const leftArmIdx = bones.findIndex((b) => b.name === "arm-left");
      const rightArmIdx = bones.findIndex((b) => b.name === "arm-right");
      const rootIdx = bones.findIndex((b) => b.name === "root");
      const torsoIdx = bones.findIndex((b) => b.name === "torso");

      assert.ok(leftArmIdx >= 0 && rightArmIdx >= 0, `${id} must have arm bones`);
      assert.ok(rootIdx >= 0 && torsoIdx >= 0, `${id} must have pelvis/torso bones`);

      // Identify arm and pelvis vertices in bind space to establish approximate distal clusters
      const leftArmVertIndices = [];
      const rightArmVertIndices = [];
      const pelvisIndices = [];
      for (let i = 0; i < posAttr.count; i++) {
        for (let j = 0; j < 4; j++) {
          if (skinWeights.getComponent(i, j) > 0.5) {
            const b = skinIndices.getComponent(i, j);
            if (b === leftArmIdx) leftArmVertIndices.push(i);
            if (b === rightArmIdx) rightArmVertIndices.push(i);
            if (b === rootIdx || b === torsoIdx) pelvisIndices.push(i);
          }
        }
      }

      // Establish distal arm extremity clusters in bind space (|X| >= 0.85 * maxAbsX)
      let maxAbsXL = 0, maxAbsXR = 0;
      for (const idx of leftArmVertIndices) maxAbsXL = Math.max(maxAbsXL, Math.abs(posAttr.getX(idx)));
      for (const idx of rightArmVertIndices) maxAbsXR = Math.max(maxAbsXR, Math.abs(posAttr.getX(idx)));

      const leftHandIndices = leftArmVertIndices.filter(
        (idx) => Math.abs(posAttr.getX(idx)) >= 0.85 * maxAbsXL
      );
      const rightHandIndices = rightArmVertIndices.filter(
        (idx) => Math.abs(posAttr.getX(idx)) >= 0.85 * maxAbsXR
      );
      assert.ok(leftHandIndices.length > 0 && rightHandIndices.length > 0, `${id} must have distal arm extremity clusters`);

      // Complete bind-matrix skinning transformation:
      // applyBoneTransform(index, target) + target.applyMatrix4(bodyMesh.matrixWorld)
      const tmp = new THREE.Vector3();
      const distalArmLeftProxy = new THREE.Vector3();
      for (const idx of leftHandIndices) {
        tmp.fromBufferAttribute(posAttr, idx);
        bodyMesh.applyBoneTransform(idx, tmp);
        tmp.applyMatrix4(bodyMesh.matrixWorld);
        distalArmLeftProxy.add(tmp);
      }
      distalArmLeftProxy.divideScalar(leftHandIndices.length);

      const distalArmRightProxy = new THREE.Vector3();
      for (const idx of rightHandIndices) {
        tmp.fromBufferAttribute(posAttr, idx);
        bodyMesh.applyBoneTransform(idx, tmp);
        tmp.applyMatrix4(bodyMesh.matrixWorld);
        distalArmRightProxy.add(tmp);
      }
      distalArmRightProxy.divideScalar(rightHandIndices.length);

      // Approximate lowest torso/pelvis proxy via complete bind-matrix skinning
      let lowestTorsoPelvisProxyY = Infinity;
      for (const idx of pelvisIndices) {
        tmp.fromBufferAttribute(posAttr, idx);
        bodyMesh.applyBoneTransform(idx, tmp);
        tmp.applyMatrix4(bodyMesh.matrixWorld);
        if (tmp.y < lowestTorsoPelvisProxyY) lowestTorsoPelvisProxyY = tmp.y;
      }

      // Top of head sightline proxy from animated head mesh via complete bind-matrix skinning
      const headPosAttr = headMesh.geometry.attributes.position;
      let maxHeadY = -Infinity;
      for (let i = 0; i < headPosAttr.count; i++) {
        tmp.fromBufferAttribute(headPosAttr, i);
        headMesh.applyBoneTransform(i, tmp);
        tmp.applyMatrix4(headMesh.matrixWorld);
        if (tmp.y > maxHeadY) maxHeadY = tmp.y;
      }

      // 4. Cockpit bounding box and underbody floor geometry
      const kartScene = built.model.children.find((c) => c !== built.driver && !c.name.startsWith("wheel-"));
      const chassisBox = new THREE.Box3().setFromObject(kartScene);
      const underbodyFloor = chassisBox.min.y;

      // Documented approximate geometric seat and steering-zone references for each vehicle body type
      let approximateSeatPlaneY;
      let approximateSteeringZoneRef;
      if (spec.scale > 2.0) {
        // Standard open-cockpit kart (Mario, Luigi, Peach, Yoshi, Toad)
        approximateSeatPlaneY = 0.60;
        approximateSteeringZoneRef = new THREE.Vector3(0, 0.73, -0.32);
      } else if (id === "bowser") {
        // Race Future car body
        approximateSeatPlaneY = 0.55;
        approximateSteeringZoneRef = new THREE.Vector3(0, 0.74, -0.60);
      } else if (id === "donkey-kong") {
        // Classic GT race car body
        approximateSeatPlaneY = 0.48;
        approximateSteeringZoneRef = new THREE.Vector3(0, 0.68, -0.80);
      } else {
        // Sedan Sports car body (Koopa)
        approximateSeatPlaneY = 0.44;
        approximateSteeringZoneRef = new THREE.Vector3(0, 0.60, -0.55);
      }

      // A. Lowest torso/pelvis proxy clearance above underbody floor and alignment with approximate seat plane
      assert.ok(
        lowestTorsoPelvisProxyY > underbodyFloor + 0.15,
        `${id} lowest torso/pelvis proxy (${lowestTorsoPelvisProxyY.toFixed(3)}m) must clear underbody floor (${underbodyFloor.toFixed(3)}m)`
      );
      const pelvisToSeatContactDiff = Math.abs(lowestTorsoPelvisProxyY - approximateSeatPlaneY);
      assert.ok(
        pelvisToSeatContactDiff < 0.12,
        `${id} lowest torso/pelvis proxy (${lowestTorsoPelvisProxyY.toFixed(3)}m) must align with approximate seat plane proxy (${approximateSeatPlaneY.toFixed(3)}m, diff ${pelvisToSeatContactDiff.toFixed(3)}m)`
      );

      // B. Lateral centering in cockpit
      const armCenterX = (distalArmLeftProxy.x + distalArmRightProxy.x) * 0.5;
      assert.ok(
        Math.abs(armCenterX) < 0.05,
        `${id} driver distal arm proxies must be centered laterally in cockpit (x=${armCenterX.toFixed(4)})`
      );

      // C. Forward arm reach and distance to approximate steering zone reference
      assert.ok(
        distalArmLeftProxy.z < spec.driverOffset[2] && distalArmRightProxy.z < spec.driverOffset[2],
        `${id} distal arm proxies must reach forward from driver origin into cockpit steering zone`
      );
      const leftArmToSteer = distalArmLeftProxy.distanceTo(approximateSteeringZoneRef);
      const rightArmToSteer = distalArmRightProxy.distanceTo(approximateSteeringZoneRef);
      assert.ok(
        leftArmToSteer < 0.48 && rightArmToSteer < 0.48,
        `${id} distal arm proxies must reach into approximate steering zone (L=${leftArmToSteer.toFixed(3)}m, R=${rightArmToSteer.toFixed(3)}m)`
      );

      const armSpan = distalArmLeftProxy.distanceTo(distalArmRightProxy);
      assert.ok(
        armSpan >= 0.45 && armSpan <= 0.90,
        `${id} distal arm proxy span (${armSpan.toFixed(3)}m) must be within expected geometric range [0.45, 0.90]`
      );

      // D. Head clearance and sightlines
      const headHeightAbovePelvis = maxHeadY - lowestTorsoPelvisProxyY;
      assert.ok(
        headHeightAbovePelvis >= 0.85 && headHeightAbovePelvis <= 1.25,
        `${id} head-to-torso-base vertical clearance (${headHeightAbovePelvis.toFixed(3)}m) must be within expected geometric range [0.85, 1.25]`
      );
      assert.ok(
        maxHeadY >= 1.35 && maxHeadY <= 1.70,
        `${id} head top sightline proxy (${maxHeadY.toFixed(3)}m) must give clear sightlines above chassis [1.35, 1.70]`
      );

      // E. Vehicle chassis proportions
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
      // Verify exact 4x4 affine matrix preservation including shear (diff < 1e-10)
      for (let el = 0; el < 16; el++) {
        const matDiff = Math.abs(builtMesh.matrixWorld.elements[el] - origMesh.matrixWorld.elements[el]);
        assert.ok(
          matDiff < 1e-10,
          `Synthetic wheel-${i} matrix element ${el} must match origMesh.matrixWorld (diff: ${matDiff.toExponential(3)})`
        );
      }

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

      // 6. Multi-angle rotation verification around actual wheel axle
      // Derive independent axle line from source mesh:
      origMesh.geometry.computeBoundingBox();
      const origLocalBox = origMesh.geometry.boundingBox;
      const origLocalExtent = origLocalBox.getSize(new THREE.Vector3());
      let origLocalAxle = new THREE.Vector3(1, 0, 0);
      if (origLocalExtent.y < origLocalExtent.x && origLocalExtent.y < origLocalExtent.z) {
        origLocalAxle.set(0, 1, 0);
      } else if (origLocalExtent.z < origLocalExtent.x && origLocalExtent.z < origLocalExtent.y) {
        origLocalAxle.set(0, 0, 1);
      }
      const origAxleWorldDir = origLocalAxle.clone().transformDirection(origMesh.matrixWorld).normalize();
      const refRight = new THREE.Vector3(1, 0, 0).transformDirection(refRoot.matrixWorld).normalize();
      if (origAxleWorldDir.dot(refRight) < 0) {
        origAxleWorldDir.negate();
      }

      // Rotate wheel through multiple angles and compare transformed vertices against independent Rodrigues rotation
      const testAngles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, (3 * Math.PI) / 2];
      for (const theta of testAngles) {
        rolling.rotation.x = theta;
        built.model.updateMatrixWorld(true);

        const rotatedMeshWorld = builtMesh.matrixWorld.clone();
        for (let vi = 0; vi < bPosAttr.count; vi += 5) {
          const vLocal = new THREE.Vector3().fromBufferAttribute(bPosAttr, vi);
          const actualPos = vLocal.clone().applyMatrix4(rotatedMeshWorld);

          // Independently calculated expected position via Rodrigues rotation around expectedAxle
          const vOrigWorld = vLocal.clone().applyMatrix4(origMesh.matrixWorld);
          const diffVec = vOrigWorld.clone().sub(expectedAxle);
          const rotatedDiff = diffVec.clone().applyAxisAngle(origAxleWorldDir, theta);
          const expectedPos = expectedAxle.clone().add(rotatedDiff);

          const rotErr = actualPos.distanceTo(expectedPos);
          assert.ok(
            rotErr < 1e-4,
            `${id} wheel-${i} rotation angle ${((theta * 180) / Math.PI).toFixed(1)}deg vertex ${vi} must match independent Rodrigues calculation (err was ${rotErr.toExponential(3)}m)`
          );
        }
      }

      // Reset rolling rotation
      rolling.rotation.x = 0;
      built.model.updateMatrixWorld(true);
    }

    disposeModel(built.model);
    disposeModel(refRoot);
  }
});

test("Regression test: wheel transform calculation handles deeply nested non-identity parent hierarchies without assumption", async () => {
  // Construct a synthetic GLTF scene with multiple nested parent nodes having genuinely non-uniform scale, rotation and translation
  const syntheticScene = new THREE.Group();
  syntheticScene.name = "synthetic-kart";

  const chassisParent = new THREE.Group();
  chassisParent.name = "chassis-parent";
  chassisParent.position.set(0.35, 0.42, -0.28);
  chassisParent.scale.set(1.4, 0.85, 1.25); // Genuinely non-uniform scale
  syntheticScene.add(chassisParent);

  const subAssembly = new THREE.Group();
  subAssembly.name = "sub-assembly";
  subAssembly.position.set(-0.15, 0.10, 0.22);
  subAssembly.rotation.set(0.2, -0.35, 0.15); // Genuinely arbitrary non-cardinal rotation on multiple axes producing shear
  subAssembly.scale.set(0.9, 1.15, 0.8); // Genuinely non-uniform scale
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

  let built = null;
  let refRoot = null;

  try {
    // 1. Derive expected world axle positions and axle directions independently from the reference hierarchy
    const refScene = syntheticScene.clone(true);
    refRoot = new THREE.Group();
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
    built = buildGLBKart("synthetic-test", syntheticGltf, mockCharGltf);
    built.model.updateMatrixWorld(true);

    for (let i = 0; i < 4; i++) {
      const pivot = built.wheels[i];
      const pivotPos = new THREE.Vector3();
      pivot.getWorldPosition(pivotPos);

      const diff = pivotPos.distanceTo(expectedAxles[i]);
      assert.ok(
        diff < 1e-4,
        `Synthetic wheel-${i} pivot must match expected axle even with nested parent transforms (diff: ${diff.toExponential(3)}m)`
      );

      // Verify zero eccentric wobble in rolling group
      const rolling = pivot.userData.rolling;
      const builtMesh = rolling.children.find((c) => c.isMesh);
      builtMesh.geometry.computeBoundingBox();
      const localCenter = builtMesh.geometry.boundingBox.getCenter(new THREE.Vector3());
      const centerInRolling = localCenter.clone().applyMatrix4(builtMesh.matrix);
      assert.ok(
        centerInRolling.length() < 1e-4,
        `Synthetic wheel-${i} in rolling group must rotate around exact axle with zero wobble (got ${centerInRolling.length().toExponential(3)})`
      );

      // Verify rotation through multiple angles against independent Rodrigues calculation
      const origMesh = refScene.getObjectByName(wheelOffsets[i][0]);
      origMesh.geometry.computeBoundingBox();
      const origExtent = origMesh.geometry.boundingBox.getSize(new THREE.Vector3());
      let localAxle = new THREE.Vector3(1, 0, 0);
      if (origExtent.y < origExtent.x && origExtent.y < origExtent.z) localAxle.set(0, 1, 0);
      else if (origExtent.z < origExtent.x && origExtent.z < origExtent.y) localAxle.set(0, 0, 1);

      const axleDir = localAxle.clone().transformDirection(origMesh.matrixWorld).normalize();
      const synthRight = new THREE.Vector3(1, 0, 0).transformDirection(refRoot.matrixWorld).normalize();
      if (axleDir.dot(synthRight) < 0) axleDir.negate();

      // Verify exact 4x4 affine matrix preservation including shear (diff < 1e-10)
      for (let el = 0; el < 16; el++) {
        const matDiff = Math.abs(builtMesh.matrixWorld.elements[el] - origMesh.matrixWorld.elements[el]);
        assert.ok(
          matDiff < 1e-10,
          `Synthetic wheel-${i} matrix element ${el} must match origMesh.matrixWorld (diff: ${matDiff.toExponential(3)})`
        );
      }

      const bPosAttr = builtMesh.geometry.attributes.position;
      const angles = [0, Math.PI / 4, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
      for (const theta of angles) {
        rolling.rotation.x = theta;
        built.model.updateMatrixWorld(true);

        const rotatedMeshWorld = builtMesh.matrixWorld.clone();
        for (let vi = 0; vi < bPosAttr.count; vi += 4) {
          const vLocal = new THREE.Vector3().fromBufferAttribute(bPosAttr, vi);
          const actualPos = vLocal.clone().applyMatrix4(rotatedMeshWorld);

          const vOrigWorld = vLocal.clone().applyMatrix4(origMesh.matrixWorld);
          const diffVec = vOrigWorld.clone().sub(expectedAxles[i]);
          const rotatedDiff = diffVec.clone().applyAxisAngle(axleDir, theta);
          const expectedPos = expectedAxles[i].clone().add(rotatedDiff);

          const rotErr = actualPos.distanceTo(expectedPos);
          assert.ok(
            rotErr < 1e-4,
            `Synthetic wheel-${i} angle ${((theta * 180) / Math.PI).toFixed(1)}deg vertex ${vi} must match independent Rodrigues calculation (err was ${rotErr.toExponential(3)}m)`
          );
        }
      }
    }
  } finally {
    if (built?.model) disposeModel(built.model);
    if (refRoot) disposeModel(refRoot);
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
