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

test("Verify barrier and collision alignment: instance matrices, geometry transforms, both sides, representative track sections, and zero gaps", async () => {
  const scene = new THREE.Scene();
  const worldResult = await buildWorld(scene);
  const world = worldResult.world;

  let redIM = null;
  let whiteIM = null;
  world.traverse((o) => {
    if (o.name === "instanced-barrierRed") redIM = o.children[0];
    if (o.name === "instanced-barrierWhite") whiteIM = o.children[0];
  });

  assert.ok(redIM && redIM.isInstancedMesh, "Must find instanced red barrier mesh");
  assert.ok(whiteIM && whiteIM.isInstancedMesh, "Must find instanced white barrier mesh");
  assert.ok(redIM.count > 400, `Red barrier instance count must be substantial, got ${redIM.count}`);
  assert.ok(whiteIM.count > 400, `White barrier instance count must be substantial, got ${whiteIM.count}`);

  const posAttr = redIM.geometry.attributes.position;
  assert.ok(posAttr && posAttr.count > 0, "Barrier mesh geometry must contain vertices");

  const mat = new THREE.Matrix4();
  const v = new THREE.Vector3();

  // Test representative positions across straightaways, curves, and climbing elevation
  // Straight 1: s = 0..100
  // Turn 1 curve: s = 150..220
  // Chicane curve: s = 300..380
  // Mountain climb & anti-gravity elevation: s = 550..750
  // Banked hairpin: s = 850..950
  // Pre-finish straight: s = 1200..1350
  const representativeSValues = [0, 50, 180, 210, 340, 600, 720, 890, 930, 1250, 1380];

  for (const s of representativeSValues) {
    for (const side of [-1, 1]) {
      const sideName = side === -1 ? "left" : "right";
      const q = surfaceAt(s, side * WALL_HALF);
      const qf = roadFrame(s, side * WALL_HALF, q.heading);

      // Expected barrier geometric center in world space:
      // Barrier is 0.9m tall, grounded at surface elevation q.y, extending along road normal qf.up
      const expectedCenter = new THREE.Vector3(q.x, q.y, q.z).add(
        new THREE.Vector3(qf.up.x, qf.up.y, qf.up.z).multiplyScalar(0.45)
      );

      // Find the closest instance in the actual InstancedMeshes
      let closestDist = Infinity;
      let closestInstanceCenter = null;

      for (const im of [redIM, whiteIM]) {
        for (let i = 0; i < im.count; i++) {
          im.getMatrixAt(i, mat);

          // Calculate actual transformed geometry center from vertex positions
          const box = new THREE.Box3();
          for (let j = 0; j < posAttr.count; j++) {
            v.fromBufferAttribute(posAttr, j).applyMatrix4(mat);
            box.expandByPoint(v);
          }
          const center = box.getCenter(new THREE.Vector3());
          const d = center.distanceTo(expectedCenter);
          if (d < closestDist) {
            closestDist = d;
            closestInstanceCenter = center;
          }
        }
      }

      // Verify that an actual visual barrier geometry exists right at the collision wall position
      // Spacing between consecutive centers is <= 2.75m, so closest barrier center is within 1.4m of test s
      assert.ok(
        closestDist <= 1.45,
        `Visual barrier must coincide with collision boundary at s=${s}, ${sideName} side. Closest deviation: ${closestDist.toFixed(3)}m`
      );

      // Verify that the lateral distance from track centerline coincides with WALL_HALF (14.5m)
      const centerlineQ = surfaceAt(s, 0);
      const horizDistFromCenterline = Math.hypot(
        closestInstanceCenter.x - centerlineQ.x,
        closestInstanceCenter.z - centerlineQ.z
      );
      assert.ok(
        Math.abs(horizDistFromCenterline - WALL_HALF) <= 1.6,
        `Visual barrier lateral position (${horizDistFromCenterline.toFixed(2)}m) must match WALL_HALF (${WALL_HALF}m) within tolerance at s=${s}, ${sideName} side`
      );
    }
  }

  // Continuity verification: Verify that visual barriers do NOT create gaps on curves or straights
  // Traverses consecutive instances in their exact placement order along each wall curve
  const counts = worldResult.barrierCounts || {
    left: Math.floor((redIM.count + whiteIM.count) / 2),
    right: Math.ceil((redIM.count + whiteIM.count) / 2),
    leftRed: Math.floor(redIM.count / 2),
    leftWhite: Math.floor(whiteIM.count / 2),
    rightRed: Math.ceil(redIM.count / 2),
    rightWhite: Math.ceil(whiteIM.count / 2),
  };

  for (const side of [-1, 1]) {
    const sideName = side === -1 ? "left" : "right";
    const totalCount = side === -1 ? counts.left : counts.right;
    const redOffset = side === -1 ? 0 : counts.leftRed;
    const whiteOffset = side === -1 ? 0 : counts.leftWhite;

    let detectedGaps = 0;
    let prevCenter = null;

    for (let i = 0; i < totalCount; i++) {
      const isRed = (i % 2 === 0);
      const im = isRed ? redIM : whiteIM;
      const instanceIdx = isRed
        ? redOffset + Math.floor(i / 2)
        : whiteOffset + Math.floor(i / 2);

      im.getMatrixAt(instanceIdx, mat);
      const box = new THREE.Box3();
      for (let j = 0; j < posAttr.count; j++) {
        v.fromBufferAttribute(posAttr, j).applyMatrix4(mat);
        box.expandByPoint(v);
      }
      const currCenter = box.getCenter(new THREE.Vector3());

      if (prevCenter) {
        const centerDistance = prevCenter.distanceTo(currCenter);
        // Exclude the glider flight gap where the track is open air (gap > 15m)
        if (centerDistance < 15.0) {
          // Since each barrier is 3.05m long, center distance must be <= 2.9m to ensure overlap and zero gaps
          if (centerDistance > 2.95) {
            detectedGaps++;
          }
        }
      }
      prevCenter = currCenter;
    }

    assert.equal(
      detectedGaps,
      0,
      `Continuous visual barrier wall on ${sideName} must have 0 gaps across all straights and curves, got ${detectedGaps}`
    );
  }
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
