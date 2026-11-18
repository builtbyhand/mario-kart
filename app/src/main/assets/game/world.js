import { buildLanding, landingLightMap } from "./stadium-landing.js";
import { buildPlanting } from "./stadium-planting.js";
import { buildLandingPylons } from "./stadium-pylons.js";
import { buildUnderpass } from "./stadium-underpass.js";
import { buildPitlane } from "./stadium-pitlane.js";
import { buildLandmark } from "./stadium-landmark.js";
import { buildPaddock } from "./stadium-paddock.js";
import { buildStadiumBowl } from "./stadium-bowl.js";
import * as THREE from "three";
import { mergeGeometries } from "./vendor/three-examples/utils/BufferGeometryUtils.js";
import {
  TRACK_LENGTH as L,
  trackAt,
  surfaceAt,
  ROAD_HALF,
  WALL_HALF,
  BOOST_PADS,
  SECTIONS,
  controlDistances,
} from "./track.js";
import { seeded } from "./logic.js";
import { proceduralKart } from "./models.js";
import { pavementMaps, roadMaterial } from "./materials.js";
import { roadFrame } from "./visual-frame.js";
import { buildArchitecture } from "./stadium-architecture.js";
import {
  preloadEnvironmentPack,
  createInstancedModel,
  instantiateEnvironmentModel,
  environmentCache,
} from "./environment-loader.js";

const rng = seeded(611),
  V = THREE.Vector3;
const materialCache = new Map();

const standard = (c, extra = {}) => {
  const key = Object.keys(extra).length ? null : "std" + c;
  if (key && materialCache.has(key)) return materialCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color: c,
    roughness: 0.65,
    ...extra,
  });
  if (key) materialCache.set(key, m);
  return m;
};

const basic = (c) => {
  if (!materialCache.has(c))
    materialCache.set(c, new THREE.MeshBasicMaterial({ color: c }));
  return materialCache.get(c);
};

export function canvasTexture(w, h, draw) {
  if (typeof document === "undefined" || !document.createElement) {
    const t = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function signTexture(
  text,
  bg = "#1252a0",
  fg = "#fff",
  sub = "MUSHROOM CUP",
) {
  return canvasTexture(1024, 256, (c, w, h) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#ffffff16";
    for (let i = -h; i < w; i += 50) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i + 110, 0);
      c.lineTo(i + 110 - h, h);
      c.lineTo(i - h, h);
      c.fill();
    }
    c.fillStyle = fg;
    c.textAlign = "center";
    c.font = "italic 900 105px Arial";
    c.fillText(text, w / 2, 142, w - 50);
    c.font = "700 30px Arial";
    c.fillText(sub, w / 2, 205);
    c.fillRect(0, 0, w, 5);
    c.fillRect(0, h - 5, w, 5);
  });
}

function mesh(geo, mat, parent, pos = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  parent.add(m);
  m.castShadow = geo.type !== "PlaneGeometry";
  m.receiveShadow = true;
  return m;
}

function box(parent, size, pos, mat) {
  return mesh(new THREE.BoxGeometry(...size), mat, parent, pos);
}

function ribbon(start, end, left, right, mat, height = 0.03, step = 2) {
  const pos = [],
    uv = [],
    indices = [];
  let n = 0;
  for (let s = start; s < end + step; s += step) {
    const at = Math.min(s, end);
    for (const l of [left, right]) {
      const p = surfaceAt(at, l);
      pos.push(p.x, p.y + height, p.z);
      uv.push((l - left) / (right - left), at / 8);
    }
    if (n) {
      const i = n * 2;
      indices.push(i - 2, i - 1, i, i, i - 1, i + 1);
    }
    n++;
    if (at === end) break;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

/**
 * Builds the high-definition racing environment.
 * Integrates ready-made CC0 3D models for barriers, grandstands, vegetation,
 * pit buildings, overhead gantries, and skyscrapers with clean procedural fallbacks.
 */
export async function buildWorld(scene, capabilities = null, envAssets = null) {
  // Preload local environment models if not already cached
  if (environmentCache.size === 0 && !envAssets) {
    try {
      await preloadEnvironmentPack();
    } catch (e) {
      console.warn("[buildWorld] Preload failed, proceeding with procedural fallbacks:", e.message);
    }
  }

  const world = new THREE.Group();
  world.name = "racing-world";
  scene.add(world);

  const pavement = pavementMaps({}, capabilities);
  const roadTex = pavement.map;
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;

  const grassTex = canvasTexture(256, 256, (c, w, h) => {
    const imgData = c.createImageData(w, h);
    const buf = new Uint32Array(imgData.data.buffer);
    buf.fill(0xff3c6529); // #29653c
    const colors = [0xff357d48, 0xff325128, 0xff306139];
    for (let i = 0; i < 4000; i++) {
      const idx = Math.floor(rng() * (w * h));
      buf[idx] = colors[i % 3];
    }
    c.putImageData(imgData, 0, 0);
  });
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(250, 250);

  const lawnMaterial = standard("#c6d4ad", { map: grassTex, roughness: 1 });
  const shoulderFallback = grassTex.clone();
  shoulderFallback.repeat.set(1.5, 8 / 3);
  const shoulderGrass = standard("#d1d9b9", {
    map: shoulderFallback,
    roughness: 1,
  });

  const isBrowser = typeof window !== "undefined" && typeof location !== "undefined" && Boolean(location.href);
  if (isBrowser) {
    new THREE.ImageLoader().load(
      "./art/turf-v1.png",
      (image) => {
        const turf = new THREE.Texture(image);
        turf.colorSpace = THREE.SRGBColorSpace;
        turf.wrapS = turf.wrapT = THREE.RepeatWrapping;
        turf.repeat.copy(grassTex.repeat);
        turf.anisotropy = capabilities?.clampAnisotropy
          ? capabilities.clampAnisotropy(16)
          : Math.min(16, capabilities?.maxAnisotropy || 16);
        turf.needsUpdate = true;
        lawnMaterial.map = turf;
        lawnMaterial.needsUpdate = true;
        const shoulderTurf = turf.clone();
        shoulderTurf.repeat.set(1.5, 8 / 3);
        shoulderTurf.needsUpdate = true;
        shoulderGrass.map = shoulderTurf;
        shoulderGrass.needsUpdate = true;
        shoulderFallback.dispose();
        grassTex.dispose();
      },
      undefined,
      () => {},
    );
  }

  grassTex.anisotropy = capabilities?.clampAnisotropy
    ? capabilities.clampAnisotropy(16)
    : Math.min(16, capabilities?.maxAnisotropy || 16);

  const lawn = mesh(
    new THREE.PlaneGeometry(760, 760),
    lawnMaterial,
    world,
    [0, -0.3, 0],
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.receiveShadow = true;

  const road = roadMaterial(pavement);
  const blue = roadMaterial(pavement, "#278cbd", true),
    yellow = roadMaterial(pavement, "#dcc555", true),
    red = roadMaterial(pavement, "#ba4250", true);

  // Continuous paved shoulders carry the barrier all the way to the road.
  for (const [a, b] of [
    [0, SECTIONS.glideStart],
    [SECTIONS.glideEnd, L],
  ]) {
    world.add(
      ribbon(
        a,
        b,
        -WALL_HALF,
        -ROAD_HALF,
        roadMaterial(pavement, "#407b70"),
        -0.02,
      ),
    );
    world.add(
      ribbon(
        a,
        b,
        ROAD_HALF,
        WALL_HALF,
        roadMaterial(pavement, "#407b70"),
        -0.02,
      ),
    );
    world.add(ribbon(a, b, -WALL_HALF, WALL_HALF, standard("#26384a"), -0.65));
  }

  // Planted shoulders between curb and blue rail on mountain climb
  for (const [left, right] of [
    [-WALL_HALF, -ROAD_HALF],
    [ROAD_HALF, WALL_HALF],
  ]) {
    world.add(
      ribbon(
        controlDistances[8],
        SECTIONS.glideStart,
        left,
        right,
        shoulderGrass,
        0.005,
      ),
    );
  }

  buildPlanting(world);

  const sandMap = canvasTexture(256, 256, (c, w, h) => {
    const imgData = c.createImageData(w, h);
    const buf = new Uint32Array(imgData.data.buffer);
    buf.fill(0xff75a7bb);
    for (let i = 0; i < 4000; i++) {
      const shade = Math.floor(145 + rng() * 75);
      const r = shade;
      const g = Math.floor(shade * 0.9);
      const b = Math.floor(shade * 0.65);
      const idx = Math.floor(rng() * (w * h));
      buf[idx] = (0xff << 24) | (b << 16) | (g << 8) | r;
    }
    c.putImageData(imgData, 0, 0);
  });
  sandMap.wrapS = sandMap.wrapT = THREE.RepeatWrapping;
  sandMap.repeat.set(2, 2);
  const landingSand = standard("#fff2ce", { map: sandMap, roughness: 1 });

  // Glider landing corridor
  for (const [left, right, material] of [
    [-10, 10, road],
    [-WALL_HALF, -ROAD_HALF, landingSand],
    [ROAD_HALF, WALL_HALF, landingSand],
  ]) {
    const lower = ribbon(
      SECTIONS.glideStart + 6,
      SECTIONS.glideEnd,
      left,
      right,
      material,
    );
    const positions = lower.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setY(i, 0.02);
    positions.needsUpdate = true;
    lower.geometry.computeVertexNormals();
    world.add(lower);
  }

  // Sand continues beyond the glider gap with illumination
  for (const [left, right] of [
    [-WALL_HALF, -ROAD_HALF],
    [ROAD_HALF, WALL_HALF],
  ]) {
    const illuminatedSand = landingSand.clone();
    illuminatedSand.emissive.set("#ffd58b");
    illuminatedSand.emissiveIntensity = 0.65;
    illuminatedSand.emissiveMap = landingLightMap(
      canvasTexture,
      Math.sign(left + right),
    );
    world.add(
      ribbon(
        SECTIONS.glideEnd,
        controlDistances[24],
        left,
        right,
        illuminatedSand,
        0.008,
      ),
    );
  }

  buildLanding(world, { mesh, box, standard, canvasTexture });
  buildLandingPylons(world, { mesh, box, standard, canvasTexture });

  // Main road surfaces
  world.add(ribbon(0, SECTIONS.glideStart, -ROAD_HALF, ROAD_HALF, road));
  world.add(ribbon(SECTIONS.glideEnd, L, -ROAD_HALF, ROAD_HALF, road));

  // Colored racing corner stripes
  for (const [start, end] of [
    [controlDistances[4], controlDistances[8]],
    [controlDistances[24], controlDistances[26]],
  ]) {
    world.add(ribbon(start, end, -10, -3.4, red, 0.055));
    world.add(ribbon(start, end, -3.4, 3.4, yellow, 0.055));
    world.add(ribbon(start, end, 3.4, 10, blue, 0.055));
  }

  // Curbs and High-Definition Barriers
  const railMat = standard("#163fac", { metalness: 0.25, roughness: 0.4 }),
    white = standard("#e9e9e1"),
    curbRed = standard("#d92c46");

  const curbGeo = [[], []],
    railGeo = [],
    supportGeo = [];

  const redBarrierMatrices = [];
  const whiteBarrierMatrices = [];
  const fenceMatrices = [];
  const barrierCounts = {
    left: 0,
    right: 0,
    leftRed: 0,
    leftWhite: 0,
    rightRed: 0,
    rightWhite: 0,
    leftS: [],
    rightS: [],
  };

  // 1. Rumble Curbs along road edge (lateral ±10.6m)
  for (let s = 0; s < L; s += 3) {
    if (s > SECTIONS.glideStart && s < SECTIONS.glideEnd) continue;

    for (const side of [-1, 1]) {
      const p = surfaceAt(s, side * 10.6),
        geo = new THREE.BoxGeometry(1.15, 0.16, 3.15);
      const cf = roadFrame(s, side * 10.6, p.heading),
        cm = new THREE.Matrix4().makeBasis(
          new V(cf.right.x, cf.right.y, cf.right.z),
          new V(cf.up.x, cf.up.y, cf.up.z),
          new V(-cf.forward.x, -cf.forward.y, -cf.forward.z),
        );
      geo.applyMatrix4(cm);
      geo.translate(p.x, p.y + 0.03, p.z);
      const planted = s >= controlDistances[8] && s < SECTIONS.glideStart;
      if (planted) geo.dispose();
      else curbGeo[Math.floor(s / 3) % 2].push(geo);
    }
  }

  // 2. High-Definition Continuous Barrier Placement with Zero Gaps on Curves
  // Dual-distance progression (3D Euclidean step and centerline arc parameterization at step=2.46m)
  // guarantees that consecutive barrier instances overlap physically in 3D geometry across all tight curves,
  // extreme banking (up to 57 deg), and rapid elevation changes, with zero uncovered gaps along the entire 1400m circuit.
  for (const side of [-1, 1]) {
    const fineDs = 0.05;
    const placementStep = 2.46;
    let lastPlacedS = 0;
    let lastPlacedPos = surfaceAt(0, side * WALL_HALF);
    let barrierCounter = 0;

    function placeBarrierInstance(s, q) {
      const qf = roadFrame(s, side * WALL_HALF, q.heading);
      const bMat = new THREE.Matrix4().makeBasis(
        new V(qf.right.x, qf.right.y, qf.right.z),
        new V(qf.up.x, qf.up.y, qf.up.z),
        new V(-qf.forward.x, -qf.forward.y, -qf.forward.z),
      );
      bMat.setPosition(q.x, q.y, q.z);

      if (barrierCounter % 2 === 0) {
        redBarrierMatrices.push(bMat);
      } else {
        whiteBarrierMatrices.push(bMat);
      }
      if (side === -1) {
        barrierCounts.leftS.push(s);
      } else {
        barrierCounts.rightS.push(s);
      }

      // 3. Safety Catch Fences behind barriers along spectator areas
      const isSpectatorStraight =
        (s < 120 || s > L - 120) || (s > 180 && s < 260) || (s > 900 && s < 1000);
      if (isSpectatorStraight) {
        const fenceM = bMat.clone();
        const offset = new V(qf.right.x, qf.right.y, qf.right.z).multiplyScalar(side * 0.45);
        fenceM.elements[12] += offset.x;
        fenceM.elements[13] += offset.y;
        fenceM.elements[14] += offset.z;
        fenceMatrices.push(fenceM);
      }

      // Procedural fallback rail geometry
      const g = new THREE.BoxGeometry(0.6, 0.85, 3.2);
      g.applyMatrix4(bMat);
      g.translate(0, 0.55, 0);
      railGeo.push(g);
      if (barrierCounter % 8 === 0) {
        const post = new THREE.BoxGeometry(0.5, 2, 0.5);
        post.applyMatrix4(bMat);
        post.translate(0, 0.8, 0);
        supportGeo.push(post);
      }

      barrierCounter++;
    }

    placeBarrierInstance(0, lastPlacedPos);

    for (let s = fineDs; s < L; s += fineDs) {
      if (s > SECTIONS.glideStart && s < SECTIONS.glideEnd) {
        lastPlacedS = s;
        lastPlacedPos = surfaceAt(s, side * WALL_HALF);
        continue;
      }
      const p = surfaceAt(s, side * WALL_HALF);
      const dist3D = Math.hypot(p.x - lastPlacedPos.x, p.y - lastPlacedPos.y, p.z - lastPlacedPos.z);
      const deltaS = s - lastPlacedS;

      if (dist3D >= placementStep || deltaS >= placementStep) {
        placeBarrierInstance(s, p);
        lastPlacedS = s;
        lastPlacedPos = p;
      }
    }

    if (side === -1) {
      barrierCounts.left = barrierCounter;
      barrierCounts.leftRed = redBarrierMatrices.length;
      barrierCounts.leftWhite = whiteBarrierMatrices.length;
    } else {
      barrierCounts.right = barrierCounter;
      barrierCounts.rightRed = redBarrierMatrices.length - barrierCounts.leftRed;
      barrierCounts.rightWhite = whiteBarrierMatrices.length - barrierCounts.leftWhite;
    }
  }

  // Merge and add rumble curbs
  for (const [i, geo] of curbGeo.entries()) {
    if (geo.length > 0) mesh(mergeGeometries(geo), i ? white : curbRed, world);
  }

  // Planted curb transitions
  for (const side of [-1, 1]) {
    world.add(
      ribbon(
        controlDistances[8],
        SECTIONS.glideStart,
        side * 10.6 - 0.575,
        side * 10.6 + 0.575,
        standard("#8f9691"),
        0.12,
        1,
      ),
    );
  }

  // Add High-Definition Barriers and Fences
  const hasBarriers = environmentCache.has("barrierRed") && environmentCache.has("barrierWhite");
  if (hasBarriers) {
    const hdRedBarriers = createInstancedModel("barrierRed", redBarrierMatrices, {
      targetSize: new THREE.Vector3(0.6, 0.9, 3.05),
      rotateY: Math.PI / 2,
    });
    const hdWhiteBarriers = createInstancedModel("barrierWhite", whiteBarrierMatrices, {
      targetSize: new THREE.Vector3(0.6, 0.9, 3.05),
      rotateY: Math.PI / 2,
    });
    world.add(hdRedBarriers);
    world.add(hdWhiteBarriers);

    if (environmentCache.has("fenceStraight") && fenceMatrices.length > 0) {
      const hdFences = createInstancedModel("fenceStraight", fenceMatrices, {
        targetSize: new THREE.Vector3(0.12, 1.8, 3.05),
        rotateY: Math.PI / 2,
      });
      world.add(hdFences);
    }
  } else {
    // Procedural fallback if GLBs are not preloaded
    mesh(mergeGeometries(railGeo), railMat, world);
    mesh(mergeGeometries(supportGeo), white, world);
  }

  // High-Definition Apex Pylons (Traffic cones) guiding the racing lines
  const apexStations = [
    { s: 92, side: -1 },
    { s: 98, side: -1 },
    { s: 104, side: -1 },
    { s: 205, side: 1 },
    { s: 211, side: 1 },
    { s: 217, side: 1 },
    { s: 480, side: -1 },
    { s: 486, side: -1 },
    { s: 548, side: -1 },
    { s: 554, side: -1 },
    { s: 920, side: 1 },
    { s: 926, side: 1 },
    { s: 1025, side: -1 },
    { s: 1031, side: -1 },
  ];
  const pylonMatrices = [];
  for (const { s, side } of apexStations) {
    const ap = surfaceAt(s, side * 9.8);
    const af = roadFrame(s, side * 9.8, ap.heading);
    const pMat = new THREE.Matrix4().makeBasis(
      new V(af.right.x, af.right.y, af.right.z),
      new V(af.up.x, af.up.y, af.up.z),
      new V(-af.forward.x, -af.forward.y, -af.forward.z),
    );
    pMat.setPosition(ap.x, ap.y, ap.z);
    pylonMatrices.push(pMat);
  }

  if (environmentCache.has("pylon")) {
    const hdPylons = createInstancedModel("pylon", pylonMatrices, {
      targetSize: new THREE.Vector3(0.45, 0.55, 0.45),
    });
    world.add(hdPylons);
  }

  // Anti-gravity neon track lighting & edge rails
  const neon = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#27cdff").multiplyScalar(2),
  });
  for (const side of [-1, 1]) {
    world.add(
      ribbon(
        SECTIONS.antiStart,
        SECTIONS.antiEnd,
        side * 14.2 - 0.12,
        side * 14.2 + 0.12,
        neon,
        0.87,
      ),
    );
  }

  const guide = new THREE.MeshStandardMaterial({
    color: "#94d8ee",
    emissive: "#148baa",
    emissiveIntensity: 0.7,
    roughness: 0.32,
    metalness: 0.25,
  });
  for (let s = SECTIONS.antiStart; s < SECTIONS.antiEnd; s += 4) {
    for (const side of [-1, 1]) {
      world.add(
        ribbon(s, s + 1.7, side * 8.9 - 0.16, side * 8.9 + 0.16, guide, 0.045),
      );
    }
  }

  // Road paint: twin white edge lines, dashed center checks
  for (const [start, end] of [
    [0, SECTIONS.glideStart],
    [SECTIONS.glideEnd, L],
  ]) {
    for (const side of [-1, 1]) {
      world.add(
        ribbon(
          start,
          end,
          side * 9.5 - 0.08,
          side * 9.5 + 0.08,
          basic("#ecf2ed"),
          0.07,
        ),
      );
    }
  }

  const checkerMap = canvasTexture(64, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#ececdf";
    c.fillRect(0, 0, w / 2, h / 2);
    c.fillRect(w / 2, h / 2, w / 2, h / 2);
    for (let i = 0; i < 250; i++) {
      c.clearRect((i * 31) % 64, (i * 47) % 128, 1, 2);
    }
  });
  checkerMap.wrapS = checkerMap.wrapT = THREE.RepeatWrapping;
  checkerMap.repeat.set(1, 8);
  checkerMap.anisotropy = capabilities?.clampAnisotropy
    ? capabilities.clampAnisotropy(16)
    : Math.min(16, capabilities?.maxAnisotropy || 16);

  for (const [a, b] of [
    [0, SECTIONS.antiStart],
    [SECTIONS.antiStart, SECTIONS.glideStart],
    [SECTIONS.glideEnd, L],
  ]) {
    const checkerMat = new THREE.MeshStandardMaterial({
      map: checkerMap,
      transparent: true,
      depthWrite: false,
      roughness: 0.75,
      color: a === SECTIONS.antiStart ? "#6ae3ff" : "#c0c2b8",
      opacity: a === SECTIONS.antiStart ? 1 : 0.62,
      emissive: a === SECTIONS.antiStart ? "#1373a9" : "#000000",
      emissiveIntensity: 0.4,
    });
    world.add(ribbon(a, b, -0.38, 0.38, checkerMat, 0.083));
  }

  const edgeChecks = new THREE.MeshStandardMaterial({
    map: checkerMap,
    transparent: true,
    depthWrite: false,
    color: "#c0c2b8",
    opacity: 0.6,
    roughness: 0.85,
  });
  for (const [a, b] of [
    [0, SECTIONS.antiStart],
    [SECTIONS.glideEnd, L],
  ]) {
    for (const side of [-1, 1]) {
      world.add(
        ribbon(a, b, side * 9.15 - 0.24, side * 9.15 + 0.24, edgeChecks, 0.084),
      );
      world.add(
        ribbon(
          a,
          b,
          side * 8.78 - 0.04,
          side * 8.78 + 0.04,
          roadMaterial(pavement, "#c5ad46", true),
          0.085,
        ),
      );
    }
  }

  // Boost pads with glowing arrows
  for (const pad of BOOST_PADS) {
    world.add(
      ribbon(
        pad.s - 3.5,
        pad.s + 3.5,
        pad.lateral - 2,
        pad.lateral + 2,
        basic("#ffb520"),
        0.12,
      ),
    );
    for (let j = 0; j < 3; j++) {
      world.add(
        ribbon(
          pad.s - 2 + j * 1.7,
          pad.s - 1.6 + j * 1.7,
          pad.lateral - 1.8,
          pad.lateral + 1.8,
          basic("#fff1ac"),
          0.14,
        ),
      );
    }
  }

  for (const [s, color] of [
    [SECTIONS.antiStart, "#40e3ff"],
    [SECTIONS.glideStart - 1, "#4399ff"],
  ]) {
    world.add(ribbon(s - 1.3, s + 0.05, -10, 10, basic(color), 0.14));
    for (let i = -9; i < 10; i += 1) {
      world.add(ribbon(s - 1, s, -0.15 + i, 0.15 + i, basic("#f4ffff"), 0.16));
    }
  }

  // Checkered start/finish line and starting grid boxes
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 3; j++) {
      world.add(
        ribbon(
          j * 0.65,
          j * 0.65 + 0.65,
          i - 10,
          i - 9,
          basic((i + j) % 2 ? "#111e35" : "#f5f9ed"),
          0.1,
        ),
      );
    }
  }
  for (let r = 0; r < 4; r++) {
    for (const lane of [-3, 3]) {
      const s = -8 - r * 6;
      for (const offset of [-1.4, 1.4]) {
        world.add(
          ribbon(
            L + s - 2,
            L + s + 2,
            lane + offset - 0.06,
            lane + offset + 0.06,
            basic("#e5dfca"),
            0.1,
          ),
        );
      }
      world.add(
        ribbon(
          L + s - 2,
          L + s - 1.85,
          lane - 1.4,
          lane + 1.4,
          basic("#e5dfca"),
          0.1,
        ),
      );
    }
  }

  // Elevated road support piers
  for (let s = SECTIONS.antiStart + 30; s < SECTIONS.antiEnd; s += 30) {
    const p = trackAt(s);
    if (p.y > 3) {
      let top = Infinity;
      for (const ds of [-3, 0, 3]) {
        for (const l of [-2, 0, 2]) {
          top = Math.min(top, surfaceAt(s + ds, l).y - 1.3);
        }
      }
      if (top > 0) {
        box(world, [2.2, top, 2.2], [p.x, top / 2, p.z], standard("#657c88"));
      }
    }
  }

  buildUnderpass(world, { box, standard });

  // Pitlane and Welcome Gantry
  const gate = buildPitlane(world, {
    mesh,
    box,
    standard,
    basic,
    canvasTexture,
    signTexture,
  });

  // High-Definition Start/Finish Overhead Gantry Integration
  if (environmentCache.has("overheadLights")) {
    const overheadInst = instantiateEnvironmentModel("overheadLights", {
      targetSize: new THREE.Vector3(33.0, 16.5, 3.2),
      rotateY: Math.PI / 2,
    });
    const pStart = trackAt(0);
    overheadInst.position.set(pStart.x, pStart.y, pStart.z);
    overheadInst.rotation.y = -pStart.heading;
    world.add(overheadInst);
  }

  // Countdown light pods beneath the start gantry
  const lights = [];
  for (let i = 0; i < 3; i++) {
    const housing = mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 0.4, 24),
      standard("#202735"),
      gate,
      [(i - 1) * 1.65, 7.4, 0],
    );
    housing.rotation.x = Math.PI / 2;
    const light = mesh(
      new THREE.CircleGeometry(0.48, 24),
      new THREE.MeshBasicMaterial({ color: "#451f32" }),
      gate,
      [(i - 1) * 1.65, 7.4, 0.24],
    );
    lights.push(light);
  }

  // High-Definition Spectator Grandstands
  const grandstandConfigs = [
    // Main straight covered grandstands (opposite pitlane)
    { type: "grandStandCovered", s: L - 90, lateral: -26, size: new THREE.Vector3(14, 15, 12), rotY: 0 },
    { type: "grandStandCovered", s: L - 50, lateral: -26, size: new THREE.Vector3(14, 15, 12), rotY: 0 },
    { type: "grandStandCovered", s: L - 10, lateral: -26, size: new THREE.Vector3(14, 15, 12), rotY: 0 },
    { type: "grandStandCovered", s: 30, lateral: -26, size: new THREE.Vector3(14, 15, 12), rotY: 0 },
    { type: "grandStandCovered", s: 70, lateral: -26, size: new THREE.Vector3(14, 15, 12), rotY: 0 },
    // Turn 1 curved grandstands
    { type: "grandStandRound", s: 175, lateral: 28, size: new THREE.Vector3(16, 14, 16), rotY: Math.PI },
    { type: "grandStandRound", s: 215, lateral: 28, size: new THREE.Vector3(16, 14, 16), rotY: Math.PI },
    // Landing straight open grandstands
    { type: "grandStand", s: 925, lateral: -27, size: new THREE.Vector3(14, 12, 12), rotY: 0 },
    { type: "grandStand", s: 965, lateral: -27, size: new THREE.Vector3(14, 12, 12), rotY: 0 },
  ];

  for (const gc of grandstandConfigs) {
    if (environmentCache.has(gc.type)) {
      const gs = instantiateEnvironmentModel(gc.type, {
        targetSize: gc.size,
        rotateY: gc.rotY,
      });
      const pos = surfaceAt(gc.s, gc.lateral);
      const frame = roadFrame(gc.s, gc.lateral, pos.heading);
      gs.position.set(pos.x, pos.y, pos.z);
      gs.rotation.y = -frame.heading + (gc.rotY || 0);
      world.add(gs);
    }
  }

  // High-Definition Pit Garages, Race Control & Hospitality Tents
  const pitAssetConfigs = [
    { type: "pitsGarage", s: L - 65, lateral: 25, size: new THREE.Vector3(12, 8.5, 13), rotY: Math.PI },
    { type: "pitsGarage", s: L - 25, lateral: 25, size: new THREE.Vector3(12, 8.5, 13), rotY: Math.PI },
    { type: "pitsOffice", s: 15, lateral: 25, size: new THREE.Vector3(13, 8.5, 13), rotY: Math.PI },
    { type: "pitsGarage", s: 55, lateral: 25, size: new THREE.Vector3(12, 8.5, 13), rotY: Math.PI },
    { type: "tent", s: L - 95, lateral: 28, size: new THREE.Vector3(8, 6.5, 8), rotY: 0 },
    { type: "tent", s: 85, lateral: 28, size: new THREE.Vector3(8, 6.5, 8), rotY: 0 },
    { type: "flagCheckers", s: 3, lateral: 16.5, size: new THREE.Vector3(2.5, 6.5, 1.5), rotY: 0 },
    { type: "flagRed", s: -3, lateral: 16.5, size: new THREE.Vector3(2.5, 6.5, 1.5), rotY: 0 },
  ];

  for (const pc of pitAssetConfigs) {
    if (environmentCache.has(pc.type)) {
      const pa = instantiateEnvironmentModel(pc.type, {
        targetSize: pc.size,
        rotateY: pc.rotY,
      });
      const pos = surfaceAt(pc.s, pc.lateral);
      const frame = roadFrame(pc.s, pc.lateral, pos.heading);
      pa.position.set(pos.x, pos.y, pos.z);
      pa.rotation.y = -frame.heading + (pc.rotY || 0);
      world.add(pa);
    }
  }

  // High-Definition Trackside Billboards and Sponsor Towers
  const billboardConfigs = [
    { type: "billboard", s: 145, lateral: -24, size: new THREE.Vector3(14, 12, 5), rotY: 0 },
    { type: "billboardLow", s: 310, lateral: 24, size: new THREE.Vector3(12, 8, 4), rotY: Math.PI },
    { type: "bannerTowerRed", s: 5, lateral: -22, size: new THREE.Vector3(4.5, 16, 4.5), rotY: 0 },
    { type: "billboard", s: 785, lateral: -25, size: new THREE.Vector3(14, 12, 5), rotY: 0 },
    { type: "billboardLow", s: 1010, lateral: 24, size: new THREE.Vector3(12, 8, 4), rotY: Math.PI },
  ];

  for (const bc of billboardConfigs) {
    if (environmentCache.has(bc.type)) {
      const bMesh = instantiateEnvironmentModel(bc.type, {
        targetSize: bc.size,
        rotateY: bc.rotY,
      });
      const pos = surfaceAt(bc.s, bc.lateral);
      const frame = roadFrame(bc.s, bc.lateral, pos.heading);
      bMesh.position.set(pos.x, pos.y, pos.z);
      bMesh.rotation.y = -frame.heading + (bc.rotY || 0);
      world.add(bMesh);
    }
  }

  // High-Definition Roadside Vegetation (Instanced broadleaf trees, oaks, and mountain pines)
  const oakMatrices = [];
  const pineMatrices = [];
  const largeTreeMatrices = [];

  // Infield and parkway trees (oak & large trees)
  for (let s = 30; s < 340; s += 22) {
    for (const lat of [-32, -45, 38, 52]) {
      const pos = surfaceAt(s, lat);
      const m4 = new THREE.Matrix4();
      const yaw = rng() * Math.PI * 2;
      const scale = 0.85 + rng() * 0.35;
      m4.makeRotationY(yaw);
      m4.scale(new V(scale, scale, scale));
      m4.setPosition(pos.x, pos.y, pos.z);
      if (Math.abs(lat) > 40) {
        oakMatrices.push(m4);
      } else {
        largeTreeMatrices.push(m4);
      }
    }
  }

  // Mountain climb section (pines clustered along the hill)
  for (let s = controlDistances[9]; s < SECTIONS.glideStart - 20; s += 16) {
    for (const side of [-1, 1]) {
      const lat = side * (26 + rng() * 18);
      const pos = surfaceAt(s, lat);
      const m4 = new THREE.Matrix4();
      const yaw = rng() * Math.PI * 2;
      const scale = 0.9 + rng() * 0.35;
      m4.makeRotationY(yaw);
      m4.scale(new V(scale, scale, scale));
      m4.setPosition(pos.x, pos.y, pos.z);
      pineMatrices.push(m4);
    }
  }

  if (environmentCache.has("tree_oak") && oakMatrices.length > 0) {
    world.add(
      createInstancedModel("tree_oak", oakMatrices, {
        targetSize: new THREE.Vector3(6.5, 7.5, 6.5),
      })
    );
  }
  if (environmentCache.has("tree_pineRoundA") && pineMatrices.length > 0) {
    world.add(
      createInstancedModel("tree_pineRoundA", pineMatrices, {
        targetSize: new THREE.Vector3(5.0, 8.5, 5.0),
      })
    );
  }
  if (environmentCache.has("treeLarge") && largeTreeMatrices.length > 0) {
    world.add(
      createInstancedModel("treeLarge", largeTreeMatrices, {
        targetSize: new THREE.Vector3(5.5, 8.0, 5.5),
      })
    );
  }

  // Stadium Bowl
  buildStadiumBowl(world, { mesh, box, standard, basic, canvasTexture });

  // Modern Floodlight Towers around stadium perimeter
  const floodlightMatrices = [];
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12,
      x = Math.cos(a) * 255,
      z = Math.sin(a) * 242;

    box(world, [0.9, 78, 0.9], [x, 39, z], standard("#7e93af"));
    const lamp = new THREE.Group();
    lamp.position.set(x, 77, z);
    lamp.lookAt(0, 0, 0);
    world.add(lamp);
    box(lamp, [12, 3, 0.7], [0, 0, 0], standard("#263049"));
    for (let k = 0; k < 12; k++) {
      box(
        lamp,
        [1.5, 0.75, 0.1],
        [((k % 6) - 2.5) * 1.85, Math.floor(k / 6) * 1.05 - 0.5, 0.4],
        new THREE.MeshBasicMaterial({
          color: new THREE.Color("#ceeeff").multiplyScalar(3),
        }),
      );
    }

    const m4 = new THREE.Matrix4();
    m4.makeRotationY(-a + Math.PI / 2);
    m4.setPosition(x, 0, z);
    floodlightMatrices.push(m4);
  }

  if (environmentCache.has("lightPostModern")) {
    world.add(
      createInstancedModel("lightPostModern", floodlightMatrices, {
        targetSize: new THREE.Vector3(4.5, 18.0, 4.5),
      })
    );
  }

  // High-Definition City Skyline Skyscrapers
  const hasSkyscrapers =
    environmentCache.has("skyscraperA") &&
    environmentCache.has("skyscraperB") &&
    environmentCache.has("skyscraperC") &&
    environmentCache.has("skyscraperD");

  const windowTex = canvasTexture(128, 512, (c, w, h) => {
    c.fillStyle = "#14243e";
    c.fillRect(0, 0, w, h);
    for (let y = 5; y < h; y += 9) {
      for (let x = 4; x < w; x += 8) {
        const lit = rng();
        c.fillStyle =
          lit > 0.58 ? "#bfcbd0" : lit > 0.25 ? "#b5a989" : "#18273b";
        c.fillRect(x, y, 4, 4);
      }
    }
  });

  const buildingMat = standard("#aab3cb", {
    map: windowTex,
    emissive: "#fff2cd",
    emissiveMap: windowTex,
    emissiveIntensity: 0.58,
  });

  const skyKeys = ["skyscraperA", "skyscraperB", "skyscraperC", "skyscraperD"];
  for (let i = 0; i < 56; i++) {
    const a = (i * Math.PI * 2) / 56,
      radius = 345 + rng() * 85,
      h = 75 + rng() * 110,
      w = 28 + rng() * 18;

    if (hasSkyscrapers) {
      const key = skyKeys[i % 4];
      const skyModel = instantiateEnvironmentModel(key, {
        targetSize: new THREE.Vector3(w, h, w),
      });
      skyModel.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
      skyModel.rotation.y = a + (rng() - 0.5) * 0.4;
      world.add(skyModel);
    } else {
      // Procedural fallback box buildings
      const b = box(
        world,
        [w, h, w],
        [Math.cos(a) * radius, h / 2 - 4, Math.sin(a) * radius],
        buildingMat,
      );
      b.rotation.y = a;
      const roof = box(
        world,
        [w + 1, 1.1, w + 1],
        [b.position.x, h - 3.3, b.position.z],
        standard("#29333d"),
      );
      roof.rotation.y = a;
    }
  }

  buildLandmark(world, { box, standard });
  buildPaddock(world, { mesh, box, standard, basic, canvasTexture });

  const architecture = buildArchitecture(world, {
    mesh,
    box,
    standard,
    basic,
    signTexture,
    canvasTexture,
  });

  // Starry sky
  const stars = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const a = rng() * Math.PI * 2,
      r = 450;
    stars.set([Math.cos(a) * r, 70 + rng() * 230, Math.sin(a) * r], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(stars, 3));
  world.add(
    new THREE.Points(
      sg,
      new THREE.PointsMaterial({
        color: "#b4d8ff",
        size: 0.6,
        sizeAttenuation: true,
      }),
    ),
  );

  // Animated Fireworks
  const fireworks = [];
  for (let k = 0; k < 4; k++) {
    const positions = new Float32Array(100 * 3),
      colors = new Float32Array(100 * 3),
      origin = new V(
        Math.cos(k * 1.5) * 310,
        95 + (k % 2) * 40,
        Math.sin(k * 1.5) * 310,
      );
    const color = new THREE.Color(
      ["#ffd27a", "#7bdcff", "#e28cff", "#ff899c"][k],
    );
    for (let i = 0; i < 100; i++) {
      const a = i * 2.399,
        el = Math.acos(1 - (2 * (i + 0.5)) / 100);
      positions.set(
        [Math.sin(el) * Math.cos(a), Math.cos(el), Math.sin(el) * Math.sin(a)],
        i * 3,
      );
      color.toArray(colors, i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 1.1,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    points.position.copy(origin);
    world.add(points);
    fireworks.push(points);
  }

  return {
    world,
    lights,
    fireworks,
    barrierCounts,
    statue: architecture.statue,
    screenMaterials: architecture.screenMaterials,
    pavement,
    update(time, count) {
      lights.forEach((l, i) =>
        l.material.color.set(
          count === 0 ? "#58ff87" : i < 4 - count ? "#ff403f" : "#421c29",
        ),
      );
      fireworks.forEach((f, i) => {
        const t = ((time + i * 1.3) % 5) / 5;
        f.scale.setScalar(5 + t * 24);
        f.material.opacity = Math.max(0, 1 - t) * 0.8;
      });
    },
  };
}
