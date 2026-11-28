import * as THREE from "three";
import { loadGLB, buildGLBKart, disposeModel, KART_SPECS } from "./models.js";
import { instantiateEnvironmentModel } from "./environment-loader.js";

/**
 * Articulated Karts with distinct visual profiles, chassis geometry, and driving stats.
 */
export const KART_TYPES = [
  {
    id: "classic-source",
    name: "Classic Kart",
    glb: "models/mario-source.glb",
    isSourcePack: true,
    scale: 1.0,
    stats: { speed: 86, accel: 84, weight: 74, drift: 84 },
    category: "Classic",
    desc: "Original Mario Kart character & standard kart model with signature styling.",
  },
];

/**
 * Driver character profiles with racing traits and attributes.
 */
export const DRIVER_PROFILES = {
  mario: {
    name: "Mario",
    class: "All-Rounder",
    color: "#ed303b",
    defaultKart: "classic-source",
    stats: { speed: 85, accel: 85, handling: 85, weight: 80 },
    desc: "The iconic champion with flawless balance across all track zones.",
  },
  luigi: {
    name: "Luigi",
    class: "Aero Specialist",
    color: "#31bf5a",
    defaultKart: "classic-source",
    stats: { speed: 82, accel: 88, handling: 88, weight: 78 },
    desc: "Nimble driving style with sharp cornering and quick turbo recovery.",
  },
  peach: {
    name: "Peach",
    class: "Drift Master",
    color: "#ff8abe",
    defaultKart: "classic-source",
    stats: { speed: 78, accel: 92, handling: 92, weight: 70 },
    desc: "Lightweight and agile, generating super mini-turbos effortlessly.",
  },
  yoshi: {
    name: "Yoshi",
    class: "High Traction",
    color: "#83dc38",
    defaultKart: "classic-source",
    stats: { speed: 84, accel: 86, handling: 90, weight: 75 },
    desc: "Exceptional grip and rapid acceleration on both asphalt and kerbs.",
  },
  toad: {
    name: "Toad",
    class: "Turbo Sprinter",
    color: "#428cfa",
    defaultKart: "classic-source",
    stats: { speed: 80, accel: 95, handling: 90, weight: 65 },
    desc: "Pocket-rocket acceleration with lightning off-the-line launch.",
  },
  bowser: {
    name: "Bowser",
    class: "Heavy Powerhouse",
    color: "#ffae26",
    defaultKart: "classic-source",
    stats: { speed: 96, accel: 70, handling: 72, weight: 98 },
    desc: "Immense top speed and physical weight that knocks rivals aside.",
  },
  "donkey-kong": {
    name: "Donkey Kong",
    class: "Heavy Brawler",
    color: "#a86335",
    defaultKart: "classic-source",
    stats: { speed: 92, accel: 74, handling: 75, weight: 95 },
    desc: "Colossal momentum and rugged track dominance on open straights.",
  },
  koopa: {
    name: "Koopa",
    class: "Agile Technician",
    color: "#f0d449",
    defaultKart: "classic-source",
    stats: { speed: 82, accel: 90, handling: 94, weight: 68 },
    desc: "Razor-sharp trajectory control that glides through tight hairpins.",
  },
};

/**
 * Dedicated Real-Time 3D Main Menu Scene.
 *
 * Visual Components:
 * - High-definition circular showcase podium with carbon finish and championship trim.
 * - Concentric glowing neon LED ring with soft pulsing illumination.
 * - Sourced environment models (banner towers, overhead floodlights, checkered flags, barriers).
 * - Sourced cityscape skyscrapers in the atmospheric stadium background.
 * - Dedicated studio key light, cool cyan rim light, warm fill, and soft contact shadows.
 * - Shimmering floating celebration motes and dual sweeping sky beams.
 * - Detailed 3D kart centerpiece with active idle suspension breathing.
 * - Animated driver character with natural eye contact / head tracking.
 */
export class MenuScene {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;

    // Showcase placement location: Mario Kart Stadium starting straight plaza
    this.origin = new THREE.Vector3(-21.22, 0, 105.57);

    // Root group for all menu-specific 3D objects
    this.root = new THREE.Group();
    this.root.name = "menu-showcase-scene";
    this.root.position.copy(this.origin);

    // Active showcase kart state
    this.showcaseKart = null;
    this.showcaseModel = null;
    this.showcaseDriver = null;
    this.showcaseHead = null;
    this.showcaseMixer = null;
    this.showcaseWheels = [];
    this.characterId = "mario";
    this.kartId = "classic-source";

    // Build subcomponents
    this.buildShowcaseTurntable();
    this.buildSurroundingScenery();
    this.buildCelebrationMotes();
    this.buildMenuLighting();

    this.scene.add(this.root);

    // Initial state is active
    this.isActive = true;
  }

  buildShowcaseTurntable() {
    this.turntableGroup = new THREE.Group();
    this.turntableGroup.name = "menu-turntable";

    // 1. Main Podium Disc: Dark carbon/asphalt material
    const discGeo = new THREE.CylinderGeometry(3.6, 3.85, 0.16, 64);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x181e26,
      roughness: 0.38,
      metalness: 0.25,
    });
    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.position.y = 0.08;
    discMesh.receiveShadow = true;
    this.turntableGroup.add(discMesh);

    // 2. Championship Outer Rim (Gold / Checkered Accent)
    const rimGeo = new THREE.TorusGeometry(3.68, 0.05, 12, 64);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.22,
      metalness: 0.85,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.155;
    this.turntableGroup.add(rimMesh);

    // 3. Glowing Cyan Neon LED Ring (Concentric Accent)
    const ledGeo = new THREE.RingGeometry(2.6, 2.72, 64);
    this.ledMaterial = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const ledMesh = new THREE.Mesh(ledGeo, this.ledMaterial);
    ledMesh.rotation.x = -Math.PI / 2;
    ledMesh.position.y = 0.162;
    this.turntableGroup.add(ledMesh);

    // 4. Soft Contact Shadow Plane directly under kart chassis
    const shadowGeo = new THREE.PlaneGeometry(3.8, 4.4);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x020610,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.165;
    this.turntableGroup.add(shadowMesh);

    this.root.add(this.turntableGroup);
  }

  buildSurroundingScenery() {
    this.sceneryGroup = new THREE.Group();
    this.sceneryGroup.name = "menu-scenery";

    // 1. Two Sourced Banner Towers flanking the rear of the stage
    const towerL = instantiateEnvironmentModel("bannerTowerRed");
    if (towerL) {
      towerL.position.set(-6.2, 0, -4.8);
      towerL.rotation.y = 0.35;
      towerL.scale.setScalar(1.15);
      this.sceneryGroup.add(towerL);
    }

    const towerR = instantiateEnvironmentModel("bannerTowerRed");
    if (towerR) {
      towerR.position.set(6.2, 0, -4.8);
      towerR.rotation.y = -0.35;
      towerR.scale.setScalar(1.15);
      this.sceneryGroup.add(towerR);
    }

    // 2. Dual Overhead / Modern Floodlight posts framing the side illumination
    const lightL = instantiateEnvironmentModel("overheadLights");
    if (lightL) {
      lightL.position.set(-6.8, 0, 1.2);
      lightL.rotation.y = Math.PI * 0.45;
      lightL.scale.setScalar(1.1);
      this.sceneryGroup.add(lightL);
    }

    const lightR = instantiateEnvironmentModel("overheadLights");
    if (lightR) {
      lightR.position.set(6.8, 0, 1.2);
      lightR.rotation.y = -Math.PI * 0.45;
      lightR.scale.setScalar(1.1);
      this.sceneryGroup.add(lightR);
    }

    // 3. Celebratory Checkered & Red Flags
    this.flags = [];
    const flagCheckers = instantiateEnvironmentModel("flagCheckers");
    if (flagCheckers) {
      flagCheckers.position.set(-4.5, 0, -2.8);
      flagCheckers.rotation.y = 0.5;
      flagCheckers.scale.setScalar(1.2);
      this.sceneryGroup.add(flagCheckers);
      this.flags.push(flagCheckers);
    }

    const flagRed = instantiateEnvironmentModel("flagRed");
    if (flagRed) {
      flagRed.position.set(4.5, 0, -2.8);
      flagRed.rotation.y = -0.5;
      flagRed.scale.setScalar(1.2);
      this.sceneryGroup.add(flagRed);
      this.flags.push(flagRed);
    }

    // 4. Curved Stadium Barrier perimeter behind the podium
    const barrierPositions = [
      { x: -5.0, z: -3.8, rot: 0.25 },
      { x: -2.5, z: -4.8, rot: 0.10 },
      { x: 0.0, z: -5.2, rot: 0.00 },
      { x: 2.5, z: -4.8, rot: -0.10 },
      { x: 5.0, z: -3.8, rot: -0.25 },
    ];
    for (let i = 0; i < barrierPositions.length; i++) {
      const bKey = i % 2 === 0 ? "barrierRed" : "barrierWhite";
      const b = instantiateEnvironmentModel(bKey);
      if (b) {
        b.position.set(barrierPositions[i].x, 0, barrierPositions[i].z);
        b.rotation.y = barrierPositions[i].rot;
        this.sceneryGroup.add(b);
      }
    }

    // 5. Stylized Cityscape Skyscrapers in scenic atmospheric background
    const skyA = instantiateEnvironmentModel("skyscraperA");
    if (skyA) {
      skyA.position.set(-18, 0, -32);
      skyA.scale.setScalar(1.4);
      this.sceneryGroup.add(skyA);
    }

    const skyC = instantiateEnvironmentModel("skyscraperC");
    if (skyC) {
      skyC.position.set(18, 0, -35);
      skyC.scale.setScalar(1.4);
      this.sceneryGroup.add(skyC);
    }

    // 6. Lush green trees softening the flanks
    const treeL = instantiateEnvironmentModel("treeLarge");
    if (treeL) {
      treeL.position.set(-9.5, 0, -6.5);
      this.sceneryGroup.add(treeL);
    }

    const treeR = instantiateEnvironmentModel("tree_oak");
    if (treeR) {
      treeR.position.set(9.5, 0, -6.5);
      this.sceneryGroup.add(treeR);
    }

    this.root.add(this.sceneryGroup);
  }

  buildCelebrationMotes() {
    const moteCount = 60;
    const positions = new Float32Array(moteCount * 3);
    const colors = new Float32Array(moteCount * 3);

    this.moteSpeeds = [];

    const goldColor = new THREE.Color(0xffd54f);
    const cyanColor = new THREE.Color(0x38bdf8);

    for (let i = 0; i < moteCount; i++) {
      // Cylinder distribution around turntable
      const radius = 0.8 + Math.random() * 3.2;
      const angle = Math.random() * Math.PI * 2;
      const y = 0.2 + Math.random() * 3.5;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      const c = Math.random() > 0.4 ? goldColor : cyanColor;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      this.moteSpeeds.push({
        yRate: 0.25 + Math.random() * 0.45,
        wobbleRate: 1.5 + Math.random() * 2.5,
        wobbleDist: 0.08 + Math.random() * 0.12,
        initialAngle: angle,
        initialRadius: radius,
      });
    }

    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    moteGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const moteMat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.motePoints = new THREE.Points(moteGeo, moteMat);
    this.motePoints.name = "menu-celebration-motes";
    this.root.add(this.motePoints);
  }

  buildMenuLighting() {
    this.lightsGroup = new THREE.Group();
    this.lightsGroup.name = "menu-lights";

    // 1. Studio Key Spotlight with soft contact shadows
    this.keyLight = new THREE.SpotLight(0xfff5ea, 2.5, 30, Math.PI / 3.8, 0.42, 1.1);
    this.keyLight.position.set(-2.8, 6.2, 4.2);
    this.keyLight.target.position.set(0, 0.6, 0);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.bias = -0.0004;
    this.lightsGroup.add(this.keyLight);
    this.lightsGroup.add(this.keyLight.target);

    // 2. High-Definition Cyan Rim Light creating razor-sharp silhouette highlights
    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 1.85);
    this.rimLight.position.set(2.4, 4.5, -4.2);
    this.lightsGroup.add(this.rimLight);

    // 3. Warm Ambient Fill eliminating pitch-black harsh contrast
    this.fillLight = new THREE.DirectionalLight(0xfef08a, 0.65);
    this.fillLight.position.set(3.5, 3.2, 3.2);
    this.lightsGroup.add(this.fillLight);

    // 4. Subtle Ground Bounce Light
    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e1b4b, 0.45);
    this.lightsGroup.add(this.hemiLight);

    this.root.add(this.lightsGroup);
  }

  async setShowcaseRacer(characterId, kartId = null) {
    this.showcaseRequestId = (this.showcaseRequestId || 0) + 1;
    const currentRequestId = this.showcaseRequestId;

    this.characterId = characterId;
    const charSpec = KART_SPECS[characterId] || KART_SPECS.mario;

    // Resolve target kart ID
    if (!kartId) {
      kartId = DRIVER_PROFILES[characterId]?.defaultKart || "classic-source";
    }
    this.kartId = kartId;

    const kartConfig = KART_TYPES.find((k) => k.id === kartId) || KART_TYPES[0];

    try {
      // Load the character-matched Classic Kart (cached after first load)
      const kartGltf = await loadGLB(charSpec.sourceKart);

      // Guard: If another racer selection was made while awaiting assets, discard outdated load
      if (currentRequestId !== this.showcaseRequestId) {
        return null;
      }

      // Build articulated GLB kart with driver sitting in cockpit
      const built = buildGLBKart(characterId, kartGltf, null, 1.0, null);

      // Guard: Ensure still latest before attaching to scene graph
      if (currentRequestId !== this.showcaseRequestId) {
        disposeModel(built.model);
        return null;
      }

      // Remove existing showcase kart model if present
      if (this.showcaseModel) {
        this.root.remove(this.showcaseModel);
        disposeModel(this.showcaseModel);
        this.showcaseModel = null;
      }

      this.showcaseModel = built.model;
      this.showcaseWheels = built.wheels || [];
      this.showcaseMixer = built.mixer;
      this.showcaseDriver = built.driver;
      this.showcaseHead = built.driverHead;

      // Position kart on top of showcase turntable
      this.showcaseModel.position.set(0, 0.16, 0);
      {
        const fit = new THREE.Box3().setFromObject(this.showcaseModel).getSize(new THREE.Vector3());
        if (this.onModelFit) this.onModelFit(Math.max(fit.x, fit.z));
      }

      // Initial orientation: angled slightly towards camera
      this.showcaseModel.rotation.y = 0.25;

      this.root.add(this.showcaseModel);
      return this.showcaseModel;
    } catch (err) {
      if (currentRequestId === this.showcaseRequestId) {
        console.warn("[MenuScene] Failed to load showcase racer:", err);
      }
    }
  }

  activate() {
    this.isActive = true;
    this.root.visible = true;
    if (this.keyLight) this.keyLight.intensity = 2.5;
    if (this.rimLight) this.rimLight.intensity = 1.85;
    if (this.fillLight) this.fillLight.intensity = 0.65;
  }

  deactivate() {
    this.isActive = false;
    this.root.visible = false;
    if (this.keyLight) this.keyLight.intensity = 0;
    if (this.rimLight) this.rimLight.intensity = 0;
    if (this.fillLight) this.fillLight.intensity = 0;
  }

  update(dt, now = performance.now(), camera = null) {
    if (!this.isActive) return;

    const time = now / 1000;
    const step = Math.min(dt, 0.1);

    // 1. Update Driver Animation Mixer (smooth looped idle breathing)
    if (this.showcaseMixer) {
      this.showcaseMixer.update(step);
    }

    // 2. Kart Suspension Idle Movement (subtle mechanical engine idle vibration)
    if (this.showcaseModel) {
      const chassisBob = Math.sin(time * 3.2) * 0.007;
      const chassisRoll = Math.sin(time * 1.8) * 0.003;
      const chassisPitch = Math.cos(time * 2.4) * 0.003;

      this.showcaseModel.position.y = 0.16 + chassisBob;
      this.showcaseModel.rotation.z = chassisRoll;
      this.showcaseModel.rotation.x = chassisPitch;

      // 3. Subtle Front Wheel Idle Steering Twitch
      const steerTwitch = Math.sin(time * 0.85) * 0.045;
      if (this.showcaseWheels[0]) this.showcaseWheels[0].rotation.y = steerTwitch;
      if (this.showcaseWheels[1]) this.showcaseWheels[1].rotation.y = steerTwitch;

      // 4. Driver Head Tracking: Naturally makes eye contact with camera
      if (this.showcaseHead && camera) {
        // Compute camera direction in kart local coordinate frame
        const headWorld = new THREE.Vector3();
        this.showcaseHead.getWorldPosition(headWorld);

        const toCam = new THREE.Vector3().subVectors(camera.position, headWorld);
        const invKart = this.showcaseModel.quaternion.clone().invert();
        toCam.applyQuaternion(invKart);

        // Yaw angle relative to kart forward
        const targetYaw = THREE.MathUtils.clamp(
          Math.atan2(-toCam.x, -toCam.z),
          -0.78, // -45 deg
          0.78   // +45 deg
        );

        if (!this.headYaw) this.headYaw = 0;
        this.headYaw += (targetYaw - this.headYaw) * (1 - Math.exp(-step * 6));

        if (this.showcaseHead.userData?.lookRestQuaternion) {
          const restQ = new THREE.Quaternion().fromArray(this.showcaseHead.userData.lookRestQuaternion);
          const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.headYaw);
          this.showcaseHead.quaternion.copy(restQ).multiply(yawQ);
        } else {
          this.showcaseHead.rotation.y = this.headYaw;
        }
      }

      if (this.showcaseDriver?.userData?.isSourceDriver) {
        const restPos = this.showcaseDriver.userData.restPosition || [0, 0, 0];
        const restRot = this.showcaseDriver.userData.restRotation || [0, 0, 0];
        this.showcaseDriver.position.set(
          restPos[0],
          restPos[1] + Math.sin(time * 2.4) * 0.008,
          restPos[2],
        );
        this.showcaseDriver.rotation.set(
          restRot[0] + Math.sin(time * 1.6) * 0.025,
          restRot[1] + Math.sin(time * 1.1) * 0.03,
          restRot[2],
        );
      }
    }

    // 5. Pulsing LED Neon Glow Ring
    if (this.ledMaterial) {
      this.ledMaterial.opacity = 0.75 + Math.sin(time * 2.2) * 0.22;
    }

    // 6. Fluttering Checkered & Red Flags
    if (this.flags) {
      for (let i = 0; i < this.flags.length; i++) {
        const flag = this.flags[i];
        flag.rotation.z = Math.sin(time * 3.5 + i * 1.5) * 0.06;
      }
    }

    // 7. Shimmering Floating Celebration Motes
    if (this.motePoints) {
      const posAttr = this.motePoints.geometry.attributes.position;
      const positions = posAttr.array;
      const count = this.moteSpeeds.length;

      for (let i = 0; i < count; i++) {
        const sp = this.moteSpeeds[i];
        let y = positions[i * 3 + 1] + sp.yRate * step;
        if (y > 3.8) {
          y = 0.2;
        }
        positions[i * 3 + 1] = y;

        // Subtle horizontal circular wobble
        const wobbleAngle = sp.initialAngle + Math.sin(time * sp.wobbleRate) * sp.wobbleDist;
        positions[i * 3] = Math.cos(wobbleAngle) * sp.initialRadius;
        positions[i * 3 + 2] = Math.sin(wobbleAngle) * sp.initialRadius;
      }
      posAttr.needsUpdate = true;
    }
  }

  dispose() {
    this.deactivate();
    if (this.showcaseModel) {
      this.root.remove(this.showcaseModel);
      disposeModel(this.showcaseModel);
      this.showcaseModel = null;
    }
    this.scene.remove(this.root);
  }
}
