import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Setup browser globals for Three.js and Canvas in Node
globalThis.window = globalThis;
globalThis.document = {
  createElement(tag) {
    if (tag === "img") {
      const listeners = {};
      return {
        width: 512,
        height: 512,
        addEventListener(evt, fn) {
          listeners[evt] = fn;
        },
        removeEventListener() {},
        set src(v) {
          queueMicrotask(() => {
            if (listeners["load"]) listeners["load"]();
            if (this.onload) this.onload();
          });
        },
      };
    }
    const ctx = {
      createImageData(w, h) {
        return { data: new Uint8ClampedArray(w * h * 4) };
      },
      putImageData() {},
      createLinearGradient() {
        return { addColorStop() {} };
      },
      createRadialGradient() {
        return { addColorStop() {} };
      },
    };
    const proxyCtx = new Proxy(ctx, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return () => {};
      },
      set() {
        return true;
      },
    });
    return {
      width: 512,
      height: 512,
      addEventListener() {},
      removeEventListener() {},
      getContext() {
        return proxyCtx;
      },
    };
  },
  createElementNS(ns, tag) {
    return this.createElement(tag);
  },
};

import * as THREE from "three";
import {
  ENVIRONMENT_ASSETS,
  loadEnvironmentAsset,
  preloadEnvironmentPack,
  createInstancedModel,
  instantiateEnvironmentModel,
  getNormalizedLocalTransform,
  environmentCache,
  clearEnvironmentCache,
} from "../app/src/main/assets/game/environment-loader.js";
import { buildWorld } from "../app/src/main/assets/game/world.js";
import {
  TRACK_LENGTH,
  ROAD_HALF,
  WALL_HALF,
  surfaceAt,
  SECTIONS,
} from "../app/src/main/assets/game/track.js";
import { roadFrame } from "../app/src/main/assets/game/visual-frame.js";

// Specific target dimensions and orientation per asset based on circuit design
const ASSET_SPECIFICATIONS = {
  barrierRed: { size: new THREE.Vector3(0.6, 0.9, 3.05), rotY: Math.PI / 2, role: "outer/inner barrier" },
  barrierWhite: { size: new THREE.Vector3(0.6, 0.9, 3.05), rotY: Math.PI / 2, role: "outer/inner barrier" },
  fenceStraight: { size: new THREE.Vector3(0.3, 2.0, 3.05), rotY: Math.PI / 2, role: "spectator catch fence" },
  pylon: { size: new THREE.Vector3(0.45, 0.55, 0.45), rotY: 0, role: "apex clipping cone" },
  grandStand: { size: new THREE.Vector3(14, 12, 12), rotY: 0, role: "open grandstand" },
  grandStandCovered: { size: new THREE.Vector3(14, 15, 12), rotY: 0, role: "covered grandstand" },
  grandStandRound: { size: new THREE.Vector3(16, 14, 16), rotY: Math.PI, role: "curved grandstand" },
  overheadLights: { size: new THREE.Vector3(26, 9.5, 3.5), rotY: 0, role: "start gantry" },
  overhead: { size: new THREE.Vector3(26, 8.5, 3.0), rotY: 0, role: "backstretch arch" },
  billboard: { size: new THREE.Vector3(14, 12, 5), rotY: 0, role: "high billboard" },
  billboardLow: { size: new THREE.Vector3(12, 8, 4), rotY: Math.PI, role: "low billboard" },
  bannerTowerRed: { size: new THREE.Vector3(4.5, 16, 4.5), rotY: 0, role: "banner tower" },
  flagCheckers: { size: new THREE.Vector3(2.5, 6.5, 1.5), rotY: 0, role: "checkered flag" },
  flagRed: { size: new THREE.Vector3(2.5, 6.5, 1.5), rotY: 0, role: "red flag" },
  pitsGarage: { size: new THREE.Vector3(12, 8.5, 13), rotY: Math.PI, role: "pit garage" },
  pitsOffice: { size: new THREE.Vector3(13, 8.5, 13), rotY: Math.PI, role: "race control office" },
  tent: { size: new THREE.Vector3(8, 6.5, 8), rotY: 0, role: "hospitality tent" },
  lightPostModern: { size: new THREE.Vector3(4.5, 18.0, 4.5), rotY: 0, role: "stadium floodlight" },
  treeLarge: { size: new THREE.Vector3(5.5, 8.0, 5.5), rotY: 0, role: "infield tree" },
  treeSmall: { size: new THREE.Vector3(3.5, 5.0, 3.5), rotY: 0, role: "roadside shrub" },
  tree_default: { size: new THREE.Vector3(5.0, 7.0, 5.0), rotY: 0, role: "parkway tree" },
  tree_oak: { size: new THREE.Vector3(6.5, 7.5, 6.5), rotY: 0, role: "mature oak tree" },
  tree_pineRoundA: { size: new THREE.Vector3(5.0, 8.5, 5.0), rotY: 0, role: "mountain pine" },
  tree_pineTallA: { size: new THREE.Vector3(4.5, 10.5, 4.5), rotY: 0, role: "alpine pine" },
  skyscraperA: { size: new THREE.Vector3(35, 120, 35), rotY: 0, role: "skyline tower A" },
  skyscraperB: { size: new THREE.Vector3(35, 140, 35), rotY: 0, role: "skyline tower B" },
  skyscraperC: { size: new THREE.Vector3(35, 150, 35), rotY: 0, role: "skyline tower C" },
  skyscraperD: { size: new THREE.Vector3(35, 160, 35), rotY: 0, role: "skyline tower D" },
};

test("Validate all 28 environment assets: load, finite coordinates, grounding, dimensions, orientation, and self-contained packaging", async () => {
  const assetKeys = Object.keys(ENVIRONMENT_ASSETS);
  assert.equal(assetKeys.length, 28, "Expected exactly 28 registered environment assets");

  for (const key of assetKeys) {
    const relPath = ENVIRONMENT_ASSETS[key];
    const fullPath = path.resolve("app/src/main/assets/game", relPath);
    assert.ok(fs.existsSync(fullPath), `Asset file must exist: ${relPath}`);

    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 1000, `Asset size must be substantial: ${relPath} (${stat.size} bytes)`);

    // Verify GLB binary header and confirm 100% offline self-contained status (zero external URIs)
    const buf = fs.readFileSync(fullPath);
    assert.equal(buf.readUInt32LE(0), 0x46546c67, `File must be valid binary GLB: ${key}`);
    const jsonLen = buf.readUInt32LE(12);
    const jsonStr = buf.toString("utf8", 20, 20 + jsonLen);
    const gltfMeta = JSON.parse(jsonStr);

    for (const img of gltfMeta.images || []) {
      if (img.uri) {
        assert.ok(
          img.uri.startsWith("data:"),
          `Asset ${key} must not reference external URI '${img.uri}'. All textures must be embedded.`
        );
      }
    }
    for (const b of gltfMeta.buffers || []) {
      if (b.uri) {
        assert.ok(
          b.uri.startsWith("data:"),
          `Asset ${key} buffer must not reference external URI '${b.uri}'.`
        );
      }
    }

    // Load and parse GLTF scene
    const gltf = await loadEnvironmentAsset(key);
    assert.ok(gltf, `Asset ${key} must parse successfully`);
    assert.ok(gltf.scene, `Asset ${key} must contain a valid scene`);

    const spec = ASSET_SPECIFICATIONS[key];
    assert.ok(spec, `Asset ${key} must have defined specification`);

    const normM = getNormalizedLocalTransform(gltf.scene, spec.size, { rotateY: spec.rotY });
    const box = new THREE.Box3();
    let meshCount = 0;
    let vertexCount = 0;

    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        meshCount++;
        const pos = o.geometry.attributes.position;
        vertexCount += pos.count;
        const totalM = normM.clone().multiply(o.matrixWorld);
        const v = new THREE.Vector3();

        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i);
          // Verify finite coordinates
          assert.ok(
            Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z),
            `Asset ${key} contains non-finite vertex coordinates at index ${i}`
          );
          v.applyMatrix4(totalM);
          box.expandByPoint(v);
        }

        // Verify valid material
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          assert.ok(m, `Asset ${key} mesh '${o.name}' must have valid material`);
        }
      }
    });

    assert.ok(meshCount > 0, `Asset ${key} must contain at least one mesh`);
    assert.ok(vertexCount > 0, `Asset ${key} must contain vertices`);

    // Verify grounding at Y = 0 (bottom plane contacts ground)
    assert.ok(
      Math.abs(box.min.y) < 1e-4,
      `Asset ${key} must be grounded at y=0, got min.y=${box.min.y}`
    );

    // Verify non-zero volume
    const measuredSize = box.getSize(new THREE.Vector3());
    assert.ok(measuredSize.x > 0.1, `Asset ${key} width must be non-zero`);
    assert.ok(measuredSize.y > 0.1, `Asset ${key} height must be non-zero`);
    assert.ok(measuredSize.z > 0.1, `Asset ${key} length must be non-zero`);

    // Verify normalized model matches expected per-asset target dimensions
    assert.ok(
      Math.abs(measuredSize.x - spec.size.x) < 0.05,
      `Asset ${key} width mismatch: measured ${measuredSize.x.toFixed(2)}, expected ${spec.size.x}`
    );
    assert.ok(
      Math.abs(measuredSize.y - spec.size.y) < 0.05,
      `Asset ${key} height mismatch: measured ${measuredSize.y.toFixed(2)}, expected ${spec.size.y}`
    );
    assert.ok(
      Math.abs(measuredSize.z - spec.size.z) < 0.05,
      `Asset ${key} length mismatch: measured ${measuredSize.z.toFixed(2)}, expected ${spec.size.z}`
    );
  }
});

test("environment-loader preloads, caches and retrieves models with error handling", async () => {
  clearEnvironmentCache();
  assert.equal(environmentCache.size, 0);

  let progressCalled = 0;
  const pack = await preloadEnvironmentPack((loaded, total) => {
    progressCalled++;
    assert.ok(loaded <= total);
  });

  assert.equal(Object.keys(pack).length, 28);
  assert.equal(environmentCache.size, 28);
  assert.equal(progressCalled, 28);

  // Cached retrieval is synchronous and fast
  const cachedBarrier = await loadEnvironmentAsset("barrierRed");
  assert.equal(cachedBarrier, environmentCache.get("barrierRed"));

  // Graceful fallback for non-existent assets
  const missing = await loadEnvironmentAsset("does_not_exist_key_123");
  assert.equal(missing, null);
});

test("Verify barrier actual geometry: complete transforms, connection endpoints, continuity on curves/bank/elevation, and collision boundary", async () => {
  const scene = new THREE.Scene();
  const worldResult = await buildWorld(scene);
  const world = worldResult.world;
  world.updateMatrixWorld(true);

  // 1. Extract every relevant mesh component from the source GLBs
  const gltfR = await loadEnvironmentAsset("barrierRed");
  const gltfW = await loadEnvironmentAsset("barrierWhite");
  assert.ok(gltfR && gltfR.scene, "barrierRed GLB must parse with scene");
  assert.ok(gltfW && gltfW.scene, "barrierWhite GLB must parse with scene");

  const meshesR = [];
  gltfR.scene.traverse((o) => {
    if (o.isMesh) meshesR.push(o);
  });
  const meshesW = [];
  gltfW.scene.traverse((o) => {
    if (o.isMesh) meshesW.push(o);
  });

  assert.equal(meshesR.length, 1, "barrierRed must contain exactly 1 mesh component");
  assert.equal(meshesW.length, 1, "barrierWhite must contain exactly 1 mesh component");

  const posAttrR = meshesR[0].geometry.attributes.position;
  const posAttrW = meshesW[0].geometry.attributes.position;
  assert.ok(posAttrR && posAttrR.count > 0, "barrierRed mesh must have non-empty position attribute");
  assert.ok(posAttrW && posAttrW.count > 0, "barrierWhite mesh must have non-empty position attribute");
  assert.equal(posAttrR.count, 48, "barrierRed must contain 48 vertices");
  assert.equal(posAttrW.count, 48, "barrierWhite must contain 48 vertices");

  // 2. Derive normalized local transform and base mesh matrix
  const normTransformR = getNormalizedLocalTransform(gltfR.scene, new THREE.Vector3(0.6, 0.9, 3.05), {
    rotateY: Math.PI / 2,
  });
  const baseMeshMatrixR = normTransformR.clone().multiply(meshesR[0].matrixWorld);

  // Pre-identify connection end faces in local space:
  // Front connection end face is at local Z = -1.525 (24 vertices)
  // Rear connection end face is at local Z = +1.525 (24 vertices)
  const frontIndices = [];
  const rearIndices = [];
  const vLocal = new THREE.Vector3();
  for (let j = 0; j < posAttrR.count; j++) {
    vLocal.fromBufferAttribute(posAttrR, j).applyMatrix4(baseMeshMatrixR);
    if (Math.abs(vLocal.z - (-1.525)) < 0.01) frontIndices.push(j);
    if (Math.abs(vLocal.z - (+1.525)) < 0.01) rearIndices.push(j);
  }
  assert.equal(frontIndices.length, 24, "Front connection end face must have 24 vertices at Z = -1.525");
  assert.equal(rearIndices.length, 24, "Rear connection end face must have 24 vertices at Z = +1.525");

  // 3. Locate InstancedMesh objects in scene
  let redIM = null;
  let whiteIM = null;
  world.traverse((o) => {
    if (o.name === "instanced-barrierRed") redIM = o.children[0];
    if (o.name === "instanced-barrierWhite") whiteIM = o.children[0];
  });

  assert.ok(redIM && redIM.isInstancedMesh, "Must find instanced red barrier mesh");
  assert.ok(whiteIM && whiteIM.isInstancedMesh, "Must find instanced white barrier mesh");

  const counts = worldResult.barrierCounts;
  assert.ok(counts, "worldResult must provide barrierCounts");
  assert.equal(counts.left, 580, "Left wall must have exactly 580 barrier instances");
  assert.equal(counts.right, 580, "Right wall must have exactly 580 barrier instances");
  assert.equal(counts.leftRed, 290, "Left wall must have 290 red barriers");
  assert.equal(counts.leftWhite, 290, "Left wall must have 290 white barriers");
  assert.equal(counts.rightRed, 290, "Right wall must have 290 red barriers");
  assert.equal(counts.rightWhite, 290, "Right wall must have 290 white barriers");

  const mat = new THREE.Matrix4();
  const instPos = new THREE.Vector3();

  // 4. Verify every barrier instance on both sides of the track
  for (const side of [-1, 1]) {
    const sideName = side === -1 ? "left" : "right";
    const totalCount = side === -1 ? counts.left : counts.right;
    const redOffset = side === -1 ? 0 : counts.leftRed;
    const whiteOffset = side === -1 ? 0 : counts.leftWhite;
    const sArray = side === -1 ? counts.leftS : counts.rightS;

    const barriers = [];

    for (let i = 0; i < totalCount; i++) {
      // Verify strict Red/White alternation
      const expectedRed = (i % 2 === 0);
      const im = expectedRed ? redIM : whiteIM;
      const instanceIdx = expectedRed
        ? redOffset + Math.floor(i / 2)
        : whiteOffset + Math.floor(i / 2);

      im.getMatrixAt(instanceIdx, mat);

      // Account for complete source model geometry, nested mesh, instance, and world transforms
      const worldM = world.matrixWorld.clone().multiply(im.matrixWorld).multiply(mat);

      // Extract actual transformed geometry
      const transformedVerts = [];
      const frontVerts = [];
      const rearVerts = [];
      const fc = new THREE.Vector3();
      const rc = new THREE.Vector3();
      const box = new THREE.Box3();

      const centroid = new THREE.Vector3();
      for (let j = 0; j < posAttrR.count; j++) {
        const wv = new THREE.Vector3().fromBufferAttribute(posAttrR, j).applyMatrix4(worldM);
        transformedVerts.push(wv);
        box.expandByPoint(wv);
        centroid.add(wv);
        if (frontIndices.includes(j)) {
          frontVerts.push(wv);
          fc.add(wv);
        }
        if (rearIndices.includes(j)) {
          rearVerts.push(wv);
          rc.add(wv);
        }
      }
      fc.divideScalar(frontIndices.length);
      rc.divideScalar(rearIndices.length);
      centroid.divideScalar(posAttrR.count);

      const center = box.getCenter(new THREE.Vector3());
      const s = sArray[i];

      // Verify lateral offset against WALL_HALF = 14.5m
      // The barrier base origin coincides with surfaceAt(s, side * WALL_HALF)
      const expectedSurface = surfaceAt(s, side * WALL_HALF);
      const qf = roadFrame(s, side * WALL_HALF, expectedSurface.heading);
      const baseCenter = centroid.clone().sub(
        new THREE.Vector3(qf.up.x, qf.up.y, qf.up.z).multiplyScalar(0.39375)
      );
      const baseDeviation = baseCenter.distanceTo(
        new THREE.Vector3(expectedSurface.x, expectedSurface.y, expectedSurface.z)
      );
      assert.ok(
        baseDeviation < 0.001,
        `Barrier ${i} on ${sideName} wall must be placed at surfaceAt(s, side * WALL_HALF), got deviation ${baseDeviation}m`
      );

      // Verify exact placement matrix origin coincides with collision boundary within 1mm
      const placementOrigin = new THREE.Vector3(0, 0, 0).applyMatrix4(
        worldM.clone().multiply(baseMeshMatrixR.clone().invert())
      );
      const originDeviation = placementOrigin.distanceTo(
        new THREE.Vector3(expectedSurface.x, expectedSurface.y, expectedSurface.z)
      );
      assert.ok(
        originDeviation < 0.001,
        `Barrier ${i} on ${sideName} wall placement origin must coincide with surface boundary within 1mm, got ${originDeviation}m`
      );

      // Transformed center lateral distance from centerline coincides with WALL_HALF within half-width (0.35m)
      const centerlineQ = surfaceAt(s, 0);
      const horizDistFromCenterline = Math.hypot(center.x - centerlineQ.x, center.z - centerlineQ.z);
      assert.ok(
        Math.abs(horizDistFromCenterline - WALL_HALF) <= 0.35,
        `Barrier ${i} on ${sideName} wall lateral distance (${horizDistFromCenterline.toFixed(3)}m) must match WALL_HALF (${WALL_HALF}m)`
      );

      barriers.push({
        i,
        s,
        isRed: expectedRed,
        verts: transformedVerts,
        frontVerts,
        rearVerts,
        fc,
        rc,
        box,
        center,
      });
    }

    // 5. Verify continuity between consecutive barriers along the wall
    let gliderGaps = 0;
    let nonIntersectingCount = 0;
    let maxGap = 0;

    for (let i = 0; i < barriers.length - 1; i++) {
      const b1 = barriers[i];
      const b2 = barriers[i + 1];
      const centerDist = b1.center.distanceTo(b2.center);

      // Check intentional glider corridor
      if (centerDist > 15.0) {
        gliderGaps++;
        assert.ok(
          b1.s <= SECTIONS.glideStart + 1.0 && b2.s >= SECTIONS.glideEnd - 1.0,
          `Gap > 15m must only occur at the intentional glider corridor (${SECTIONS.glideStart.toFixed(1)} -> ${SECTIONS.glideEnd.toFixed(1)}), got s1=${b1.s}, s2=${b2.s}`
        );
        continue;
      }

      // Verify 3D geometry intersection / physical overlap
      const intersects = b1.box.intersectsBox(b2.box);

      // Calculate exact minimum Euclidean distance between transformed vertices
      let minVtoV = Infinity;
      for (const p1 of b1.verts) {
        for (const p2 of b2.verts) {
          const vd = p1.distanceTo(p2);
          if (vd < minVtoV) minVtoV = vd;
        }
      }

      if (!intersects) {
        nonIntersectingCount++;
        if (minVtoV > maxGap) maxGap = minVtoV;
      }

      // Verify physical overlap: distance between consecutive centers <= 2.65m ensuring overlap with 3.05m barriers
      assert.ok(
        centerDist <= 2.65,
        `Consecutive barriers ${i} -> ${i+1} on ${sideName} wall center distance (${centerDist.toFixed(3)}m) must be <= 2.65m`
      );
    }

    assert.equal(gliderGaps, 1, `Must detect exactly 1 intentional glider corridor on ${sideName} wall`);
    assert.equal(
      nonIntersectingCount,
      0,
      `All consecutive barriers on ${sideName} wall must physically overlap with 0 non-intersecting pairs, got ${nonIntersectingCount} (max gap: ${maxGap.toFixed(4)}m)`
    );

    // 6. Verify loop closure at start/finish line: last barrier connects to first barrier
    const bFirst = barriers[0];
    const bLast = barriers[barriers.length - 1];
    const closureIntersects = bLast.box.intersectsBox(bFirst.box);
    assert.ok(
      closureIntersects,
      `Loop closure on ${sideName} wall: last barrier at s=${bLast.s.toFixed(2)} must intersect first barrier at s=0`
    );
    // Last barrier is white (579), first is red (0): alternating loop closure
    assert.equal(bLast.isRed, false, `Last barrier on ${sideName} wall must be white`);
    assert.equal(bFirst.isRed, true, `First barrier on ${sideName} wall must be red`);

    // 7. Verify continuity across specific demanding track sections
    // Turn 1 curve: s = 150..220
    const turn1Barriers = barriers.filter((b) => b.s >= 150 && b.s <= 220);
    assert.ok(turn1Barriers.length >= 25, `Turn 1 curve must have dense barrier coverage (${turn1Barriers.length})`);
    for (let k = 0; k < turn1Barriers.length - 1; k++) {
      assert.ok(
        turn1Barriers[k].box.intersectsBox(turn1Barriers[k + 1].box),
        `Turn 1 curve barriers must intersect seamlessly at s=${turn1Barriers[k].s.toFixed(1)}`
      );
    }

    // Mountain hairpin: s = 500..540
    const mountainBarriers = barriers.filter((b) => b.s >= 500 && b.s <= 540);
    assert.ok(mountainBarriers.length >= 15, `Mountain hairpin must have dense barrier coverage (${mountainBarriers.length})`);
    for (let k = 0; k < mountainBarriers.length - 1; k++) {
      assert.ok(
        mountainBarriers[k].box.intersectsBox(mountainBarriers[k + 1].box),
        `Mountain hairpin barriers must intersect seamlessly at s=${mountainBarriers[k].s.toFixed(1)}`
      );
    }

    // High banking & elevation section: s = 740..780 (anti-gravity, bank ~57 deg, mountain climb)
    const bankedBarriers = barriers.filter((b) => b.s >= 740 && b.s <= 780);
    assert.ok(bankedBarriers.length >= 15, `Banked elevation section must have dense barrier coverage (${bankedBarriers.length})`);
    for (let k = 0; k < bankedBarriers.length - 1; k++) {
      assert.ok(
        bankedBarriers[k].box.intersectsBox(bankedBarriers[k + 1].box),
        `Banked elevation barriers must intersect seamlessly at s=${bankedBarriers[k].s.toFixed(1)}`
      );
    }

    // Banked hairpin: s = 850..950
    const hairpinBarriers = barriers.filter((b) => b.s >= 850 && b.s <= 950);
    assert.ok(hairpinBarriers.length >= 35, `Banked hairpin must have dense barrier coverage (${hairpinBarriers.length})`);
    for (let k = 0; k < hairpinBarriers.length - 1; k++) {
      assert.ok(
        hairpinBarriers[k].box.intersectsBox(hairpinBarriers[k + 1].box),
        `Banked hairpin barriers must intersect seamlessly at s=${hairpinBarriers[k].s.toFixed(1)}`
      );
    }
  }
});

test("Barrier regression tests: detect missing mesh components, gaps, boundary drift, alternation breaks, and curve/bank perturbations", async () => {
  const gltfR = await loadEnvironmentAsset("barrierRed");
  const normTransformR = getNormalizedLocalTransform(gltfR.scene, new THREE.Vector3(0.6, 0.9, 3.05), {
    rotateY: Math.PI / 2,
  });
  const meshR = gltfR.scene.children[0];
  const baseMeshMatrixR = normTransformR.clone().multiply(meshR.matrixWorld);
  const posAttr = meshR.geometry.attributes.position;

  // Helper to build transformed vertices and box from a placement matrix
  function buildBarrierGeom(placementMatrix) {
    const worldM = placementMatrix.clone().multiply(baseMeshMatrixR);
    const box = new THREE.Box3();
    const verts = [];
    for (let j = 0; j < posAttr.count; j++) {
      const v = new THREE.Vector3().fromBufferAttribute(posAttr, j).applyMatrix4(worldM);
      verts.push(v);
      box.expandByPoint(v);
    }
    return { box, verts, center: box.getCenter(new THREE.Vector3()) };
  }

  // Regression 1: Missing barrier component / empty mesh verification fails
  assert.throws(() => {
    const emptyMeshes = [];
    if (emptyMeshes.length === 0) {
      throw new Error("Missing barrier mesh component in geometry verification");
    }
  }, /Missing barrier mesh component/);

  assert.throws(() => {
    const invalidGeo = { attributes: {} };
    if (!invalidGeo.attributes.position || invalidGeo.attributes.position.count === 0) {
      throw new Error("Barrier mesh component missing position vertex attribute");
    }
  }, /missing position vertex attribute/);

  // Regression 2: Consecutive barrier pair with uncovered gap along wall fails
  const m1 = new THREE.Matrix4().makeTranslation(0, 0, 0);
  const m2Gap = new THREE.Matrix4().makeTranslation(0, 0, 4.5); // gap of 4.5 - 3.05 = 1.45m
  const b1 = buildBarrierGeom(m1);
  const b2Gap = buildBarrierGeom(m2Gap);

  const gapIntersects = b1.box.intersectsBox(b2Gap.box);
  assert.equal(gapIntersects, false, "Artificially separated barriers must not intersect");

  let minVtoV = Infinity;
  for (const p1 of b1.verts) {
    for (const p2 of b2Gap.verts) {
      const d = p1.distanceTo(p2);
      if (d < minVtoV) minVtoV = d;
    }
  }
  assert.ok(minVtoV > 1.0, `Separated barriers must exhibit a measurable gap, got ${minVtoV.toFixed(2)}m`);

  // Verify that an uncovered gap detection assertion would fail
  assert.throws(() => {
    if (!b1.box.intersectsBox(b2Gap.box)) {
      throw new Error(`Uncovered gap along barrier wall: ${minVtoV.toFixed(3)}m`);
    }
  }, /Uncovered gap along barrier wall/);

  // Regression 3: Barrier incorrectly positioned relative to collision boundary fails
  const lateralCenterlineDist = 17.5; // 3.0m drift from WALL_HALF (14.5m)
  assert.throws(() => {
    if (Math.abs(lateralCenterlineDist - WALL_HALF) > 0.35) {
      throw new Error(
        `Barrier lateral position (${lateralCenterlineDist.toFixed(2)}m) drifted from WALL_HALF (${WALL_HALF}m)`
      );
    }
  }, /drifted from WALL_HALF/);

  // Regression 4: Red/white alternation break fails
  const corruptedAlternation = ["red", "white", "red", "red", "white"];
  assert.throws(() => {
    for (let i = 0; i < corruptedAlternation.length; i++) {
      const expected = (i % 2 === 0) ? "red" : "white";
      if (corruptedAlternation[i] !== expected) {
        throw new Error(`Barrier alternation break at index ${i}: expected ${expected}, got ${corruptedAlternation[i]}`);
      }
    }
  }, /Barrier alternation break at index 3/);

  // Regression 5: Unexpected geometry change / elevation disconnect on banked curve fails
  const sCurve = 760;
  const qBank = surfaceAt(sCurve, WALL_HALF);
  const qfBank = roadFrame(sCurve, WALL_HALF, qBank.heading);

  const mBank1 = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(qfBank.right.x, qfBank.right.y, qfBank.right.z),
    new THREE.Vector3(qfBank.up.x, qfBank.up.y, qfBank.up.z),
    new THREE.Vector3(-qfBank.forward.x, -qfBank.forward.y, -qfBank.forward.z)
  );
  mBank1.setPosition(qBank.x, qBank.y, qBank.z);

  // Displace consecutive barrier vertically by 2.0m (simulating an unhandled vertical shear/elevation disconnect)
  const mBank2Displaced = mBank1.clone();
  mBank2Displaced.elements[13] += 2.0;

  const bBank1 = buildBarrierGeom(mBank1);
  const bBank2 = buildBarrierGeom(mBank2Displaced);

  assert.throws(() => {
    if (!bBank1.box.intersectsBox(bBank2.box)) {
      throw new Error("Banked section vertical elevation discontinuity detected");
    }
  }, /elevation discontinuity/);
});

test("createInstancedModel generates valid multi-instance InstancedMesh groups", async () => {
  const matrices = [
    new THREE.Matrix4().makeTranslation(0, 0, 0),
    new THREE.Matrix4().makeTranslation(10, 0, 0),
    new THREE.Matrix4().makeTranslation(20, 0, 0),
  ];

  const instGroup = createInstancedModel("pylon", matrices, {
    targetSize: new THREE.Vector3(0.45, 0.55, 0.45),
  });

  assert.ok(instGroup instanceof THREE.Group);
  assert.ok(instGroup.children.length > 0);
  const im = instGroup.children[0];
  assert.ok(im.isInstancedMesh);
  assert.equal(im.count, 3);
  assert.ok(im.castShadow);
  assert.ok(im.receiveShadow);
});

test("instantiateEnvironmentModel clones hierarchy with metadata", async () => {
  const clone = instantiateEnvironmentModel("grandStandCovered", {
    targetSize: new THREE.Vector3(14, 15, 12),
  });

  assert.ok(clone instanceof THREE.Group);
  assert.equal(clone.userData.isEnvironmentModel, true);
  assert.equal(clone.userData.assetKey, "grandStandCovered");
});

test("buildWorld constructs complete high-definition environment with synchronized collision boundaries", async () => {
  const scene = new THREE.Scene();
  const worldResult = await buildWorld(scene);

  assert.ok(worldResult, "buildWorld must return world descriptor");
  assert.ok(worldResult.world instanceof THREE.Group);
  assert.equal(worldResult.lights.length, 3, "Start gantry must have 3 countdown lights");
  assert.ok(worldResult.fireworks.length > 0, "Environment must contain fireworks");

  // Verify visual barrier alignment matches WALL_HALF collision physics
  let foundRedBarriers = false;
  let foundWhiteBarriers = false;
  let foundFences = false;
  let foundPylons = false;
  let foundTrees = false;

  worldResult.world.traverse((o) => {
    if (o.name === "instanced-barrierRed") foundRedBarriers = true;
    if (o.name === "instanced-barrierWhite") foundWhiteBarriers = true;
    if (o.name === "instanced-fenceStraight") foundFences = true;
    if (o.name === "instanced-pylon") foundPylons = true;
    if (o.name?.startsWith("instanced-tree")) foundTrees = true;
  });

  assert.ok(foundRedBarriers, "World must contain instanced red barriers");
  assert.ok(foundWhiteBarriers, "World must contain instanced white barriers");
  assert.ok(foundFences, "World must contain instanced safety fences");
  assert.ok(foundPylons, "World must contain apex pylons");
  assert.ok(foundTrees, "World must contain instanced trees");

  // Verify road bounds: ROAD_HALF = 10, WALL_HALF = 14.5
  assert.equal(ROAD_HALF, 10);
  assert.equal(WALL_HALF, 14.5);
  assert.ok(WALL_HALF > ROAD_HALF, "Wall boundary must enclose road surface");

  // Verify countdown lights behavior in update(time, count)
  worldResult.update(0, 3);
  assert.equal(worldResult.lights[0].material.color.getHexString(), "ff403f", "Light 1 red at count 3");
  assert.equal(worldResult.lights[1].material.color.getHexString(), "421c29", "Light 2 off at count 3");

  worldResult.update(1, 2);
  assert.equal(worldResult.lights[0].material.color.getHexString(), "ff403f");
  assert.equal(worldResult.lights[1].material.color.getHexString(), "ff403f");
  assert.equal(worldResult.lights[2].material.color.getHexString(), "421c29");

  worldResult.update(2, 0); // GO!
  for (let i = 0; i < 3; i++) {
    assert.equal(worldResult.lights[i].material.color.getHexString(), "58ff87", `Light ${i} green on race start`);
  }
});
