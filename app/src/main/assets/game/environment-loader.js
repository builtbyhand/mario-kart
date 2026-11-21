if (typeof globalThis.self === "undefined") {
  globalThis.self = globalThis;
}

import * as THREE from "three";
import { GLTFLoader } from "./vendor/three-examples/loaders/GLTFLoader.js";

const gltfLoader = new GLTFLoader();

export const ENVIRONMENT_ASSETS = {
  // Trackside barriers & markers
  barrierRed: "models/environment/barrierRed.glb",
  barrierWhite: "models/environment/barrierWhite.glb",
  fenceStraight: "models/environment/fenceStraight.glb",
  pylon: "models/environment/pylon.glb",
  // Spectator grandstands & structures
  grandStand: "models/environment/grandStand.glb",
  grandStandCovered: "models/environment/grandStandCovered.glb",
  grandStandRound: "models/environment/grandStandRound.glb",
  // Trackside signage & overhead
  overheadLights: "models/environment/overheadLights.glb",
  overhead: "models/environment/overhead.glb",
  billboard: "models/environment/billboard.glb",
  billboardLow: "models/environment/billboardLow.glb",
  bannerTowerRed: "models/environment/bannerTowerRed.glb",
  flagCheckers: "models/environment/flagCheckers.glb",
  flagRed: "models/environment/flagRed.glb",
  // Paddock & pitlane
  pitsGarage: "models/environment/pitsGarage.glb",
  pitsOffice: "models/environment/pitsOffice.glb",
  tent: "models/environment/tent.glb",
  lightPostModern: "models/environment/lightPostModern.glb",
  // Trees & roadside vegetation
  treeLarge: "models/environment/treeLarge.glb",
  treeSmall: "models/environment/treeSmall.glb",
  tree_default: "models/environment/tree_default.glb",
  tree_oak: "models/environment/tree_oak.glb",
  tree_pineRoundA: "models/environment/tree_pineRoundA.glb",
  tree_pineTallA: "models/environment/tree_pineTallA.glb",
  rock_largeA: "models/nature/rock_largeA.glb",
  rock_largeC: "models/nature/rock_largeC.glb",
  rock_tallA: "models/nature/rock_tallA.glb",
  rock_smallA: "models/nature/rock_smallA.glb",
  rock_smallC: "models/nature/rock_smallC.glb",
  plant_bush: "models/nature/plant_bush.glb",
  plant_bushLarge: "models/nature/plant_bushLarge.glb",
  flower_redA: "models/nature/flower_redA.glb",
  flower_yellowA: "models/nature/flower_yellowA.glb",
  flower_purpleA: "models/nature/flower_purpleA.glb",
  tree_fat: "models/nature/tree_fat.glb",
  tree_simple: "models/nature/tree_simple.glb",
  // Surrounding cityscape skyscrapers
  skyscraperA: "models/environment/building-skyscraper-a.glb",
  skyscraperB: "models/environment/building-skyscraper-b.glb",
  skyscraperC: "models/environment/building-skyscraper-c.glb",
  skyscraperD: "models/environment/building-skyscraper-d.glb",
};

export const environmentCache = new Map();
export const masterGeometries = new Set();
export const masterMaterials = new Set();

/**
 * Computes a normalization transform matrix that centers the GLTF scene on X/Z,
 * aligns the bottom ground surface to Y=0, optionally rotates around Y,
 * and scales to target physical dimensions (width X, height Y, length Z).
 */
export function getNormalizedLocalTransform(gltfScene, targetSize, options = {}) {
  const box = new THREE.Box3().setFromObject(gltfScene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  const centerT = new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z);
  const rotY = options.rotateY ? new THREE.Matrix4().makeRotationY(options.rotateY) : new THREE.Matrix4();

  const isSwapped = options.rotateY && Math.abs(Math.sin(options.rotateY)) > 0.5;
  const currentX = isSwapped ? size.z : size.x;
  const currentY = size.y;
  const currentZ = isSwapped ? size.x : size.z;

  const sx = targetSize.x / (currentX || 1);
  const sy = targetSize.y / (currentY || 1);
  const sz = targetSize.z / (currentZ || 1);
  const scaleM = options.keepProportions
  ? new THREE.Matrix4().makeScale(sy, sy, sy)
  : new THREE.Matrix4().makeScale(sx, sy, sz);

  return new THREE.Matrix4().multiply(scaleM).multiply(rotY).multiply(centerT);
}

/**
 * Loads a single environment GLB asset from local assets.
 * Supports both Node.js (filesystem) and browser/WebView (loadAsync).
 * Caches loaded GLTFs to avoid redundant parsing.
 */
export async function loadEnvironmentAsset(assetKey) {
  const assetPath = ENVIRONMENT_ASSETS[assetKey] || assetKey;

  if (environmentCache.has(assetKey)) {
    return environmentCache.get(assetKey);
  }

  let gltfPromise;
  const isNode =
    typeof process !== "undefined" &&
    Boolean(process.versions?.node) &&
    !globalThis.location?.href;

  try {
    if (isNode) {
      const fs = await import("fs");
      const path = await import("path");
      const fullPath = path.resolve(
        assetPath.startsWith("./") || assetPath.startsWith("/")
          ? assetPath
          : path.join("app/src/main/assets/game", assetPath)
      );
      const buf = fs.readFileSync(fullPath);
      gltfPromise = new Promise((resolve, reject) => {
        gltfLoader.parse(
          buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
          "",
          resolve,
          reject
        );
      });
    } else {
      gltfPromise = gltfLoader.loadAsync(assetPath);
    }

        const gltf = await gltfPromise;

    gltf.scene?.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const swap = (m) => {
        if (!m || !m.isMeshBasicMaterial) return m;
        const lit = new THREE.MeshLambertMaterial({
          color: m.color,
          map: m.map,
          vertexColors: m.vertexColors,
          side: m.side,
          transparent: m.transparent,
          opacity: m.opacity,
          alphaTest: m.alphaTest,
        });
        lit.name = m.name;
        return lit;
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });

    // Register master cached resources to protect from disposal
    gltf.scene?.traverse((o) => {
      if (o.geometry) masterGeometries.add(o.geometry);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m) {
          masterMaterials.add(m);
          if (m.map) masterMaterials.add(m.map);
        }
      }
    });

    environmentCache.set(assetKey, gltf);
    return gltf;
  } catch (error) {
    console.warn(`[environment-loader] Failed to load ${assetKey} (${assetPath}):`, error.message);
    return null;
  }
}

/**
 * Preload all registered environment assets with progress reporting.
 */
export async function preloadEnvironmentPack(onProgress = null) {
  const keys = Object.keys(ENVIRONMENT_ASSETS);
  let loaded = 0;
  const results = {};

  for (const key of keys) {
    const gltf = await loadEnvironmentAsset(key);
    results[key] = gltf;
    loaded++;
    if (typeof onProgress === "function") {
      onProgress(loaded, keys.length, key);
    }
  }

  return results;
}

/**
 * Creates a cloned instance of an environment model for placement.
 */
export function instantiateEnvironmentModel(assetKey, options = {}, fallbackFn = null) {
  const gltf = environmentCache.get(assetKey);
  if (!gltf || !gltf.scene) {
    if (typeof fallbackFn === "function") return fallbackFn();
    return new THREE.Group();
  }

  const clone = gltf.scene.clone(true);
  clone.userData.isEnvironmentModel = true;
  clone.userData.assetKey = assetKey;

  if (options.targetSize) {
    const normM = getNormalizedLocalTransform(clone, options.targetSize, options);
    clone.applyMatrix4(normM);
  }

  return clone;
}

/**
 * Efficiently creates instanced meshes from a model across multiple transform matrices.
 * Enables hundreds of barriers, trees, or pylons in 1-2 draw calls.
 */
export function createInstancedModel(assetKey, matrices, options = {}, fallbackFn = null) {
  if (!matrices || matrices.length === 0) return new THREE.Group();

  const gltf = environmentCache.get(assetKey);
  if (!gltf || !gltf.scene) {
    if (typeof fallbackFn === "function") return fallbackFn(matrices);
    return new THREE.Group();
  }

  const meshes = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });

  if (meshes.length === 0) {
    if (typeof fallbackFn === "function") return fallbackFn(matrices);
    return new THREE.Group();
  }

  const normTransform = options.targetSize
    ? getNormalizedLocalTransform(gltf.scene, options.targetSize, options)
    : options.localTransform || new THREE.Matrix4();

  const group = new THREE.Group();
  group.name = `instanced-${assetKey}`;
  const count = matrices.length;

  for (const origMesh of meshes) {
    const im = new THREE.InstancedMesh(origMesh.geometry, origMesh.material, count);
    im.castShadow = true;
    im.receiveShadow = true;

    const baseMeshMatrix = normTransform.clone().multiply(origMesh.matrixWorld);

    for (let i = 0; i < count; i++) {
      const finalM = matrices[i].clone().multiply(baseMeshMatrix);
      im.setMatrixAt(i, finalM);
    }
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
  }

  return group;
}

/**
 * Clear cached environment assets.
 */
export function clearEnvironmentCache() {
  environmentCache.clear();
  masterGeometries.clear();
  masterMaterials.clear();
}
