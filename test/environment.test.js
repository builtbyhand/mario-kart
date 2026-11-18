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

// Independently justified expectations for raw source assets (unnormalized GLB)
const RAW_ASSET_EXPECTATIONS = {
  barrierRed: { size: [0.250, 0.131, 0.123], meshCount: 1, minVerts: 48 },
  barrierWhite: { size: [0.250, 0.131, 0.123], meshCount: 1, minVerts: 48 },
  fenceStraight: { size: [1.000, 0.500, 0.034], meshCount: 2, minVerts: 24 },
  pylon: { size: [0.120, 0.132, 0.120], meshCount: 1, minVerts: 60 },
  grandStand: { size: [1.000, 0.896, 1.000], meshCount: 4, minVerts: 80 },
  grandStandCovered: { size: [1.000, 1.186, 1.020], meshCount: 5, minVerts: 100 },
  grandStandRound: { size: [1.637, 0.896, 1.637], meshCount: 4, minVerts: 500 },
  overheadLights: { size: [1.260, 0.694, 0.190], meshCount: 3, minVerts: 200 },
  overhead: { size: [1.260, 0.668, 0.190], meshCount: 1, minVerts: 60 },
  billboard: { size: [1.000, 1.000, 0.476], meshCount: 4, minVerts: 80 },
  billboardLow: { size: [1.000, 0.690, 0.476], meshCount: 4, minVerts: 80 },
  bannerTowerRed: { size: [0.385, 1.246, 0.385], meshCount: 3, minVerts: 200 },
  flagCheckers: { size: [0.197, 1.250, 0.035], meshCount: 4, minVerts: 90 },
  flagRed: { size: [0.197, 1.250, 0.035], meshCount: 4, minVerts: 90 },
  pitsGarage: { size: [1.000, 0.700, 1.090], meshCount: 4, minVerts: 50 },
  pitsOffice: { size: [1.000, 0.510, 1.040], meshCount: 4, minVerts: 50 },
  tent: { size: [1.000, 0.700, 1.000], meshCount: 2, minVerts: 40 },
  lightPostModern: { size: [0.049, 0.781, 0.178], meshCount: 2, minVerts: 100 },
  treeLarge: { size: [0.357, 1.507, 0.412], meshCount: 2, minVerts: 40 },
  treeSmall: { size: [0.253, 1.070, 0.292], meshCount: 2, minVerts: 40 },
  tree_default: { size: [0.755, 1.708, 0.654], meshCount: 2, minVerts: 60 },
  tree_oak: { size: [0.641, 1.226, 0.740], meshCount: 2, minVerts: 100 },
  tree_pineRoundA: { size: [0.617, 1.366, 0.712], meshCount: 2, minVerts: 100 },
  tree_pineTallA: { size: [0.386, 1.530, 0.392], meshCount: 2, minVerts: 40 },
  skyscraperA: { size: [1.360, 2.880, 1.360], meshCount: 1, minVerts: 600 },
  skyscraperB: { size: [1.360, 4.480, 1.360], meshCount: 1, minVerts: 700 },
  skyscraperC: { size: [1.280, 4.080, 1.388], meshCount: 1, minVerts: 800 },
  skyscraperD: { size: [1.280, 5.470, 1.388], meshCount: 1, minVerts: 900 },
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

    const rawSpec = RAW_ASSET_EXPECTATIONS[key];
    assert.ok(rawSpec, `Asset ${key} must have defined raw source expectations`);

    const spec = ASSET_SPECIFICATIONS[key];
    assert.ok(spec, `Asset ${key} must have defined normalized specification`);

    // =========================================================================
    // 1. INDEPENDENT RAW SOURCE ASSET VALIDATION (Before any normalization)
    // =========================================================================
    gltf.scene.updateMatrixWorld(true);
    const rawBox = new THREE.Box3().setFromObject(gltf.scene);
    const rawSize = rawBox.getSize(new THREE.Vector3());

    let rawMeshCount = 0;
    let rawVertexCount = 0;

    gltf.scene.traverse((o) => {
      // Verify node transform elements are all finite
      for (let e = 0; e < 16; e++) {
        assert.ok(
          Number.isFinite(o.matrix.elements[e]),
          `Asset ${key} node '${o.name}' matrix element ${e} must be finite`
        );
      }

      if (o.isMesh) {
        rawMeshCount++;
        const pos = o.geometry?.attributes?.position;
        assert.ok(pos && pos.count > 0, `Asset ${key} mesh '${o.name}' must have non-empty position attribute`);
        rawVertexCount += pos.count;

        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i);
          assert.ok(
            Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z),
            `Asset ${key} raw vertex at ${i} has non-finite coordinates`
          );
        }

        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          assert.ok(m, `Asset ${key} mesh '${o.name}' must have valid material`);
        }
      }
    });

    assert.equal(
      rawMeshCount,
      rawSpec.meshCount,
      `Asset ${key} raw mesh count mismatch: expected ${rawSpec.meshCount}, got ${rawMeshCount}`
    );
    assert.ok(
      rawVertexCount >= rawSpec.minVerts,
      `Asset ${key} vertex count too low: expected >= ${rawSpec.minVerts}, got ${rawVertexCount}`
    );

    // Verify non-zero raw source volume
    assert.ok(rawSize.x > 0.01, `Asset ${key} raw width must be > 0.01`);
    assert.ok(rawSize.y > 0.01, `Asset ${key} raw height must be > 0.01`);
    assert.ok(rawSize.z > 0.01, `Asset ${key} raw depth must be > 0.01`);

    // Verify raw source dimensions match independently derived expected source bounds within 3cm
    assert.ok(
      Math.abs(rawSize.x - rawSpec.size[0]) < 0.03,
      `Asset ${key} raw width mismatch: got ${rawSize.x.toFixed(3)}, expected ${rawSpec.size[0]}`
    );
    assert.ok(
      Math.abs(rawSize.y - rawSpec.size[1]) < 0.03,
      `Asset ${key} raw height mismatch: got ${rawSize.y.toFixed(3)}, expected ${rawSpec.size[1]}`
    );
    assert.ok(
      Math.abs(rawSize.z - rawSpec.size[2]) < 0.03,
      `Asset ${key} raw depth mismatch: got ${rawSize.z.toFixed(3)}, expected ${rawSpec.size[2]}`
    );

    // =========================================================================
    // 2. NORMALIZED OUTPUT TRANSFORMATION VALIDATION (Grounding & In-Game Target)
    // =========================================================================
    const normM = getNormalizedLocalTransform(gltf.scene, spec.size, { rotateY: spec.rotY });
    const normBox = new THREE.Box3();

    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        const pos = o.geometry.attributes.position;
        const totalM = normM.clone().multiply(o.matrixWorld);
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(totalM);
          normBox.expandByPoint(v);
        }
      }
    });

    // Verify grounding at Y = 0 (bottom plane contacts ground)
    assert.ok(
      Math.abs(normBox.min.y) < 1e-4,
      `Asset ${key} must be grounded at y=0, got min.y=${normBox.min.y}`
    );

    // Verify normalized model matches circuit design target specifications
    const measuredSize = normBox.getSize(new THREE.Vector3());
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

// Exact 3D OBB Separating Axis Theorem (SAT) Overlap Test
function testOBBOverlap(obbA, obbB) {
  const axes = [
    obbA.u[0], obbA.u[1], obbA.u[2],
    obbB.u[0], obbB.u[1], obbB.u[2],
  ];

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const cross = new THREE.Vector3().crossVectors(obbA.u[i], obbB.u[j]);
      if (cross.lengthSq() > 1e-6) {
        axes.push(cross.normalize());
      }
    }
  }

  const T = new THREE.Vector3().subVectors(obbB.c, obbA.c);
  let minOverlap = Infinity;
  let maxGap = 0;
  let hasGap = false;

  for (const axis of axes) {
    const dist = Math.abs(T.dot(axis));
    const rA =
      obbA.e.x * Math.abs(obbA.u[0].dot(axis)) +
      obbA.e.y * Math.abs(obbA.u[1].dot(axis)) +
      obbA.e.z * Math.abs(obbA.u[2].dot(axis));
    const rB =
      obbB.e.x * Math.abs(obbB.u[0].dot(axis)) +
      obbB.e.y * Math.abs(obbB.u[1].dot(axis)) +
      obbB.e.z * Math.abs(obbB.u[2].dot(axis));
    const overlap = rA + rB - dist;

    if (overlap < 0) {
      hasGap = true;
      const gap = -overlap;
      if (gap > maxGap) maxGap = gap;
    } else {
      if (overlap < minOverlap) minOverlap = overlap;
    }
  }

  return {
    intersects: !hasGap,
    overlap: hasGap ? 0 : minOverlap,
    gap: hasGap ? maxGap : 0,
  };
}

/**
 * Validates actual 3D barrier geometry, complete transforms, connection endpoints,
 * continuity across curves/banking/elevation, and collision boundary synchronization.
 */
async function validateBarrierGeometry(worldResult, options = {}) {
  const world = worldResult.world;
  world.updateMatrixWorld(true);

  // 1. Independent red and white asset loading and extraction
  const gltfR = options.gltfRed || (await loadEnvironmentAsset("barrierRed"));
  const gltfW = options.gltfWhite || (await loadEnvironmentAsset("barrierWhite"));
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

  if (meshesR.length === 0) {
    throw new Error("Missing barrierRed mesh component in geometry verification");
  }
  if (meshesW.length === 0) {
    throw new Error("Missing barrierWhite mesh component in geometry verification");
  }

  const meshR = meshesR[0];
  const meshW = meshesW[0];
  const posAttrR = meshR.geometry?.attributes?.position;
  const posAttrW = meshW.geometry?.attributes?.position;

  if (!posAttrR || posAttrR.count === 0) {
    throw new Error("barrierRed mesh component missing position vertex attribute");
  }
  if (!posAttrW || posAttrW.count === 0) {
    throw new Error("barrierWhite mesh component missing position vertex attribute");
  }

  assert.equal(posAttrR.count, 48, "barrierRed must contain 48 vertices");
  assert.equal(posAttrW.count, 48, "barrierWhite must contain 48 vertices");

  // 2. Derive independent normalized local transform and base mesh matrix for each asset
  const normTransformR = getNormalizedLocalTransform(gltfR.scene, new THREE.Vector3(0.6, 0.9, 3.05), {
    rotateY: Math.PI / 2,
  });
  meshR.updateMatrixWorld(true);
  const baseMeshMatrixR = normTransformR.clone().multiply(meshR.matrixWorld);

  const normTransformW = getNormalizedLocalTransform(gltfW.scene, new THREE.Vector3(0.6, 0.9, 3.05), {
    rotateY: Math.PI / 2,
  });
  meshW.updateMatrixWorld(true);
  const baseMeshMatrixW = normTransformW.clone().multiply(meshW.matrixWorld);

  // Independent endpoint connection face detection
  function findConnectionFaces(posAttr, baseM) {
    const frontIndices = [];
    const rearIndices = [];
    const vLocal = new THREE.Vector3();
    for (let j = 0; j < posAttr.count; j++) {
      vLocal.fromBufferAttribute(posAttr, j).applyMatrix4(baseM);
      if (Math.abs(vLocal.z - (-1.525)) < 0.02) frontIndices.push(j);
      if (Math.abs(vLocal.z - 1.525) < 0.02) rearIndices.push(j);
    }
    return { frontIndices, rearIndices };
  }

  const facesR = findConnectionFaces(posAttrR, baseMeshMatrixR);
  const facesW = findConnectionFaces(posAttrW, baseMeshMatrixW);

  assert.equal(facesR.frontIndices.length, 24, "Front connection end face of barrierRed must have 24 vertices");
  assert.equal(facesR.rearIndices.length, 24, "Rear connection end face of barrierRed must have 24 vertices");
  assert.equal(facesW.frontIndices.length, 24, "Front connection end face of barrierWhite must have 24 vertices");
  assert.equal(facesW.rearIndices.length, 24, "Rear connection end face of barrierWhite must have 24 vertices");

  // 3. Dynamically derive exact enclosing OBB dimensions and local centers from transformed source geometry
  function deriveEnclosingOBB(posAttr, baseM) {
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let j = 0; j < posAttr.count; j++) {
      v.fromBufferAttribute(posAttr, j).applyMatrix4(baseM);
      box.expandByPoint(v);
    }
    const size = box.getSize(new THREE.Vector3());
    const halfExtents = size.clone().multiplyScalar(0.5);
    const localCenter = box.getCenter(new THREE.Vector3());
    return { halfExtents, localCenter, min: box.min, max: box.max };
  }

  const obbSpecR = deriveEnclosingOBB(posAttrR, baseMeshMatrixR);
  const obbSpecW = deriveEnclosingOBB(posAttrW, baseMeshMatrixW);

  // Validate that derived half-extents tightly and accurately enclose the source meshes within 1e-4m
  assert.ok(Math.abs(obbSpecR.halfExtents.x - 0.30) < 1e-4, "barrierRed derived half-extent X must be 0.30m");
  assert.ok(Math.abs(obbSpecR.halfExtents.y - 0.45) < 1e-4, "barrierRed derived half-extent Y must be 0.45m");
  assert.ok(Math.abs(obbSpecR.halfExtents.z - 1.525) < 1e-4, "barrierRed derived half-extent Z must be 1.525m");
  assert.ok(Math.abs(obbSpecW.halfExtents.x - 0.30) < 1e-4, "barrierWhite derived half-extent X must be 0.30m");
  assert.ok(Math.abs(obbSpecW.halfExtents.y - 0.45) < 1e-4, "barrierWhite derived half-extent Y must be 0.45m");
  assert.ok(Math.abs(obbSpecW.halfExtents.z - 1.525) < 1e-4, "barrierWhite derived half-extent Z must be 1.525m");

  // 4. Locate InstancedMesh objects in scene
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

  const report = {
    totalInstances: 0,
    totalPairsChecked: 0,
    consecutiveNonGliderPairs: 0,
    gliderCorridorPairs: 0,
    loopClosurePairs: 0,
    minOverlap: Infinity,
    maxOverlap: -Infinity,
    maxSeamSeparation: 0,
    maxBoundaryDeviation: 0,
  };

  // 5. Verify every barrier instance on both sides of the track
  for (const side of [-1, 1]) {
    const sideName = side === -1 ? "left" : "right";
    const totalCount = side === -1 ? counts.left : counts.right;
    const redOffset = side === -1 ? 0 : counts.leftRed;
    const whiteOffset = side === -1 ? 0 : counts.leftWhite;
    const sArray = side === -1 ? counts.leftS : counts.rightS;

    const barriers = [];

    for (let i = 0; i < totalCount; i++) {
      const isRed = (i % 2 === 0);
      const im = isRed ? redIM : whiteIM;
      const instanceIdx = isRed
        ? redOffset + Math.floor(i / 2)
        : whiteOffset + Math.floor(i / 2);

      im.getMatrixAt(instanceIdx, mat);

      const baseM = isRed ? baseMeshMatrixR : baseMeshMatrixW;
      const posAttr = isRed ? posAttrR : posAttrW;
      const faces = isRed ? facesR : facesW;
      const obbSpec = isRed ? obbSpecR : obbSpecW;

      // Complete mesh world transform (instance matrix incorporates baseMeshMatrix = normTransform * origMesh.matrixWorld)
      const worldM = world.matrixWorld.clone().multiply(im.matrixWorld).multiply(mat);
      const placementMatrix = worldM.clone().multiply(baseM.clone().invert());

      // Extract actual transformed geometry independently for each asset
      const transformedVerts = [];
      const frontVerts = [];
      const rearVerts = [];
      const fc = new THREE.Vector3();
      const rc = new THREE.Vector3();
      const box = new THREE.Box3();
      const centroid = new THREE.Vector3();

      for (let j = 0; j < posAttr.count; j++) {
        const wv = new THREE.Vector3().fromBufferAttribute(posAttr, j).applyMatrix4(worldM);
        transformedVerts.push(wv);
        box.expandByPoint(wv);
        centroid.add(wv);

        if (faces.frontIndices.includes(j)) {
          frontVerts.push(wv);
          fc.add(wv);
        }
        if (faces.rearIndices.includes(j)) {
          rearVerts.push(wv);
          rc.add(wv);
        }
      }
      fc.divideScalar(faces.frontIndices.length);
      rc.divideScalar(faces.rearIndices.length);
      centroid.divideScalar(posAttr.count);

      // 3D OBB with derived half-extents and center
      const ux = new THREE.Vector3(placementMatrix.elements[0], placementMatrix.elements[1], placementMatrix.elements[2]).normalize();
      const uy = new THREE.Vector3(placementMatrix.elements[4], placementMatrix.elements[5], placementMatrix.elements[6]).normalize();
      const uz = new THREE.Vector3(placementMatrix.elements[8], placementMatrix.elements[9], placementMatrix.elements[10]).normalize();
      const origin = new THREE.Vector3().setFromMatrixPosition(placementMatrix);
      const obbCenter = origin.clone().addScaledVector(uy, obbSpec.localCenter.y);

      const obb = {
        c: obbCenter,
        u: [ux, uy, uz],
        e: obbSpec.halfExtents.clone(),
      };

      barriers.push({
        i,
        s: sArray[i],
        isRed,
        origin,
        placementMatrix,
        worldM,
        verts: transformedVerts,
        frontVerts,
        rearVerts,
        fc,
        rc,
        centroid,
        box,
        center: box.getCenter(new THREE.Vector3()),
        obb,
      });
    }

    report.totalInstances += barriers.length;

    // Optional corruption injection hook for regression testing
    if (options.corruptBarriers) {
      options.corruptBarriers(barriers, sideName);
    }

    // Boundary alignment and alternation verification
    for (let i = 0; i < barriers.length; i++) {
      const b = barriers[i];
      const expectedRed = (i % 2 === 0);
      if (b.isRed !== expectedRed) {
        throw new Error(
          `Barrier alternation break on ${sideName} wall at index ${i}: expected ${expectedRed ? "red" : "white"}, got ${b.isRed ? "red" : "white"}`
        );
      }

      // Verify lateral offset against WALL_HALF = 14.5m
      const expectedSurface = surfaceAt(b.s, side * WALL_HALF);
      const qf = roadFrame(b.s, side * WALL_HALF, expectedSurface.heading);
      const baseCenter = b.centroid.clone().sub(
        new THREE.Vector3(qf.up.x, qf.up.y, qf.up.z).multiplyScalar(0.39375)
      );
      const dev = baseCenter.distanceTo(
        new THREE.Vector3(expectedSurface.x, expectedSurface.y, expectedSurface.z)
      );
      if (dev > report.maxBoundaryDeviation) report.maxBoundaryDeviation = dev;
      if (dev > 0.001) {
        throw new Error(
          `Barrier ${i} on ${sideName} wall drifted from collision boundary: ${dev.toFixed(6)}m > 0.001m`
        );
      }

      const centerlineQ = surfaceAt(b.s, 0);
      const horizDistFromCenterline = Math.hypot(b.center.x - centerlineQ.x, b.center.z - centerlineQ.z);
      if (Math.abs(horizDistFromCenterline - WALL_HALF) > 0.35) {
        throw new Error(
          `Barrier ${i} on ${sideName} wall lateral distance (${horizDistFromCenterline.toFixed(3)}m) must match WALL_HALF (${WALL_HALF}m)`
        );
      }
    }

    // 5. Verify continuity between consecutive barriers along the wall
    for (let i = 0; i < barriers.length - 1; i++) {
      const b1 = barriers[i];
      const b2 = barriers[i + 1];
      const centerDist = b1.center.distanceTo(b2.center);

      report.totalPairsChecked++;

      // Check intentional glider corridor
      if (centerDist > 15.0) {
        report.gliderCorridorPairs++;
        if (!(b1.s <= SECTIONS.glideStart + 1.0 && b2.s >= SECTIONS.glideEnd - 1.0)) {
          throw new Error(
            `Unexpected large gap ${centerDist.toFixed(2)}m on ${sideName} wall outside glider corridor at s=${b1.s.toFixed(2)}`
          );
        }
        continue;
      }

      report.consecutiveNonGliderPairs++;

      // Exact 3D OBB SAT overlap test
      const sat = testOBBOverlap(b1.obb, b2.obb);
      if (!sat.intersects) {
        throw new Error(
          `Uncovered gap along ${sideName} wall between barrier ${i} (s=${b1.s.toFixed(2)}) and ${i+1} (s=${b2.s.toFixed(2)}): gap=${sat.gap.toFixed(4)}m`
        );
      }

      const physicalOverlap = sat.overlap;
      if (physicalOverlap < report.minOverlap) report.minOverlap = physicalOverlap;
      if (physicalOverlap > report.maxOverlap) report.maxOverlap = physicalOverlap;
      if (sat.gap > report.maxSeamSeparation) report.maxSeamSeparation = sat.gap;
    }

    // 6. Verify loop closure at start/finish line: last barrier connects to first barrier
    report.totalPairsChecked++;
    report.loopClosurePairs++;
    const bLast = barriers[barriers.length - 1];
    const bFirst = barriers[0];
    const closureSat = testOBBOverlap(bLast.obb, bFirst.obb);
    if (!closureSat.intersects) {
      throw new Error(
        `Loop closure gap along ${sideName} wall between last barrier (s=${bLast.s.toFixed(2)}) and first barrier (s=${bFirst.s.toFixed(2)}): gap=${closureSat.gap.toFixed(4)}m`
      );
    }
    if (bLast.isRed !== false || bFirst.isRed !== true) {
      throw new Error(`Loop closure alternation error on ${sideName} wall: last must be white, first must be red`);
    }

    // 7. Verify continuity across demanding track sections
    // Turn 1 curve: s = 150..220
    const turn1Barriers = barriers.filter((b) => b.s >= 150 && b.s <= 220);
    assert.ok(turn1Barriers.length >= 25, `Turn 1 curve must have dense barrier coverage (${turn1Barriers.length})`);
    for (let k = 0; k < turn1Barriers.length - 1; k++) {
      assert.ok(
        testOBBOverlap(turn1Barriers[k].obb, turn1Barriers[k + 1].obb).intersects,
        `Turn 1 curve barriers must intersect seamlessly at s=${turn1Barriers[k].s.toFixed(1)}`
      );
    }

    // Mountain hairpin: s = 500..540
    const mountainBarriers = barriers.filter((b) => b.s >= 500 && b.s <= 540);
    assert.ok(mountainBarriers.length >= 15, `Mountain hairpin must have dense barrier coverage (${mountainBarriers.length})`);
    for (let k = 0; k < mountainBarriers.length - 1; k++) {
      assert.ok(
        testOBBOverlap(mountainBarriers[k].obb, mountainBarriers[k + 1].obb).intersects,
        `Mountain hairpin barriers must intersect seamlessly at s=${mountainBarriers[k].s.toFixed(1)}`
      );
    }

    // High banking & elevation section: s = 740..780
    const bankedBarriers = barriers.filter((b) => b.s >= 740 && b.s <= 780);
    assert.ok(bankedBarriers.length >= 15, `Banked elevation section must have dense barrier coverage (${bankedBarriers.length})`);
    for (let k = 0; k < bankedBarriers.length - 1; k++) {
      assert.ok(
        testOBBOverlap(bankedBarriers[k].obb, bankedBarriers[k + 1].obb).intersects,
        `Banked elevation barriers must intersect seamlessly at s=${bankedBarriers[k].s.toFixed(1)}`
      );
    }

    // Banked hairpin: s = 850..950
    const hairpinBarriers = barriers.filter((b) => b.s >= 850 && b.s <= 950);
    assert.ok(hairpinBarriers.length >= 35, `Banked hairpin must have dense barrier coverage (${hairpinBarriers.length})`);
    for (let k = 0; k < hairpinBarriers.length - 1; k++) {
      assert.ok(
        testOBBOverlap(hairpinBarriers[k].obb, hairpinBarriers[k + 1].obb).intersects,
        `Banked hairpin barriers must intersect seamlessly at s=${hairpinBarriers[k].s.toFixed(1)}`
      );
    }
  }

  return report;
}

test("Verify barrier actual geometry: complete transforms, connection endpoints, continuity on curves/bank/elevation, and collision boundary", async () => {
  const scene = new THREE.Scene();
  const worldResult = await buildWorld(scene);
  const report = await validateBarrierGeometry(worldResult);

  // Exact pair count arithmetic verification:
  // 580 barriers per side => 578 consecutive non-glider pairs per side (1 intentional glider corridor excluded)
  // => 1,156 consecutive non-glider pairs + 2 glider pairs + 2 loop closure pairs = 1,160 pairs total
  assert.equal(report.totalInstances, 1160, "Must have exactly 1,160 barrier instances (580 left, 580 right)");
  assert.equal(report.totalPairsChecked, 1160, "Must check exactly 1,160 barrier pairs total");
  assert.equal(report.consecutiveNonGliderPairs, 1156, "Must verify exactly 1,156 consecutive non-glider pairs");
  assert.equal(report.gliderCorridorPairs, 2, "Must detect exactly 2 intentional glider corridor pairs (1 per side)");
  assert.equal(report.loopClosurePairs, 2, "Must verify exactly 2 loop closure pairs (1 per side)");

  // Measurable zero-gap claim verification
  assert.equal(report.maxSeamSeparation, 0, "Maximum seam separation must be exactly 0.0000m (zero uncovered gap)");
  assert.ok(report.minOverlap > 0.30, `Minimum physical overlap must be > 0.30m, got ${report.minOverlap.toFixed(4)}m`);
  assert.ok(report.maxOverlap < 0.90, `Maximum physical overlap must be < 0.90m, got ${report.maxOverlap.toFixed(4)}m`);
  assert.ok(
    report.maxBoundaryDeviation < 0.001,
    `Maximum collision boundary deviation must be < 0.001m (1mm), got ${report.maxBoundaryDeviation.toFixed(6)}m`
  );
});

test("Barrier regression tests: detect missing mesh components, gaps, boundary drift, alternation breaks, and curve/bank perturbations", async () => {
  const scene = new THREE.Scene();
  const worldResult = await buildWorld(scene);

  // Regression 1: Missing barrier component / empty mesh verification fails in real validator
  await assert.rejects(async () => {
    const dummyGltf = { scene: new THREE.Group() };
    await validateBarrierGeometry(worldResult, { gltfRed: dummyGltf });
  }, /Missing barrierRed mesh component/);

  await assert.rejects(async () => {
    const dummyMesh = new THREE.Mesh(new THREE.BufferGeometry());
    const dummyGltf = { scene: new THREE.Group() };
    dummyGltf.scene.add(dummyMesh);
    await validateBarrierGeometry(worldResult, { gltfRed: dummyGltf });
  }, /barrierRed mesh component missing position vertex attribute/);

  // Regression 2: Consecutive barrier pair with uncovered gap along wall fails in real validator
  await assert.rejects(async () => {
    await validateBarrierGeometry(worldResult, {
      corruptBarriers(barriers, sideName) {
        if (sideName === "left") {
          // Displace barrier 50 OBB and transformed vertices along track tangent by 3.5m creating an uncovered gap
          const shift = barriers[50].obb.u[2].clone().multiplyScalar(3.5);
          barriers[50].obb.c.add(shift);
          for (const v of barriers[50].verts) v.add(shift);
          barriers[50].fc.add(shift);
          barriers[50].rc.add(shift);
        }
      },
    });
  }, /Uncovered gap along left wall/);

  // Regression 3: Barrier incorrectly positioned relative to collision boundary fails in real validator
  await assert.rejects(async () => {
    await validateBarrierGeometry(worldResult, {
      corruptBarriers(barriers, sideName) {
        if (sideName === "left") {
          // Displace barrier 20 centroid and vertices laterally by 1.5m
          const shift = new THREE.Vector3(1.5, 0, 0);
          barriers[20].centroid.add(shift);
          for (const v of barriers[20].verts) v.add(shift);
          barriers[20].obb.c.add(shift);
          barriers[20].center.add(shift);
        }
      },
    });
  }, /drifted from collision boundary/);

  // Regression 4: Red/white alternation break fails in real validator
  await assert.rejects(async () => {
    await validateBarrierGeometry(worldResult, {
      corruptBarriers(barriers, sideName) {
        if (sideName === "left") {
          // Break alternation at barrier 5 (make it red instead of white)
          barriers[5].isRed = true;
        }
      },
    });
  }, /Barrier alternation break on left wall at index 5/);

  // Regression 5: Unexpected geometry change / elevation disconnect on banked curve fails in real validator
  await assert.rejects(async () => {
    await validateBarrierGeometry(worldResult, {
      corruptBarriers(barriers, sideName) {
        if (sideName === "left") {
          // Displace banked barrier vertically by 2.0m along local up vector (around s=760)
          const idx = barriers.findIndex((b) => b.s >= 758 && b.s <= 765);
          if (idx !== -1) {
            const shift = barriers[idx].obb.u[1].clone().multiplyScalar(2.0);
            barriers[idx].obb.c.add(shift);
            for (const v of barriers[idx].verts) v.add(shift);
            barriers[idx].fc.add(shift);
            barriers[idx].rc.add(shift);
          }
        }
      },
    });
  }, /Uncovered gap along left wall/);
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
