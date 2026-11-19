if (typeof globalThis.self === "undefined") {
  globalThis.self = globalThis;
}

import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { MenuCamera } from "../app/src/main/assets/game/menu-camera.js";
import {
  MenuScene,
  KART_TYPES,
  DRIVER_PROFILES,
} from "../app/src/main/assets/game/menu-scene.js";
import { loadGLB, buildGLBKart, KART_SPECS } from "../app/src/main/assets/game/models.js";

test("MenuCamera initializes with valid spherical coordinates and target framing", () => {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const menuCam = new MenuCamera(camera);

  assert.equal(menuCam.mode, "hub");
  assert.equal(menuCam.radius, 4.8);
  assert.equal(menuCam.targetRadius, 4.8);
  assert.equal(menuCam.targetHeight, 0.85);
  assert.ok(menuCam.phi >= 0.92 && menuCam.phi <= 1.48);

  menuCam.setTurntableCenter(10, 2, -5);
  assert.equal(menuCam.center.x, 10);
  assert.equal(menuCam.center.y, 2);
  assert.equal(menuCam.center.z, -5);
  assert.equal(menuCam.target.y, 2.85);
});

test("MenuCamera view framing modes configure distinct inspection targets", () => {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const menuCam = new MenuCamera(camera);

  // Driver mode: zoomed in on driver head & torso
  menuCam.setMode("driver");
  assert.equal(menuCam.mode, "driver");
  assert.equal(menuCam.targetRadius, 3.6);
  assert.equal(menuCam.targetHeight, 1.15);

  // Kart mode: lower angle showcasing wheels and chassis
  menuCam.setMode("kart");
  assert.equal(menuCam.mode, "kart");
  assert.equal(menuCam.targetRadius, 4.2);
  assert.equal(menuCam.targetHeight, 0.65);

  // Settings mode: pulled-back backdrop view
  menuCam.setMode("settings");
  assert.equal(menuCam.mode, "settings");
  assert.equal(menuCam.targetRadius, 5.2);
  assert.equal(menuCam.targetHeight, 0.90);

  // Hub mode: balanced 3/4 heroic angle
  menuCam.setMode("hub");
  assert.equal(menuCam.mode, "hub");
  assert.equal(menuCam.targetRadius, 4.8);
  assert.equal(menuCam.targetHeight, 0.85);
});

test("MenuCamera updates spherical coordinates with slow cinematic orbit", () => {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const menuCam = new MenuCamera(camera);
  menuCam.setTurntableCenter(0, 0, 0);

  const initialTheta = menuCam.theta;
  // Advance time by 2.0s with inactive user to trigger slow cinematic orbit
  menuCam.lastInteractionTime = performance.now() - 3000;
  menuCam.update(0.5, performance.now());

  assert.ok(
    menuCam.theta > initialTheta,
    `Expected theta to advance clockwise, initial=${initialTheta}, current=${menuCam.theta}`
  );
  assert.ok(Number.isFinite(camera.position.x));
  assert.ok(Number.isFinite(camera.position.y));
  assert.ok(Number.isFinite(camera.position.z));
});

test("MenuCamera executes smooth cinematic transition to gameplay grid", () => {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const menuCam = new MenuCamera(camera);
  menuCam.setTurntableCenter(0, 0, 0);
  menuCam.update(0.016, 1000);

  const gridEye = new THREE.Vector3(-25, 3.5, 115);
  const gridAim = new THREE.Vector3(-15, 1.5, 95);
  let transitionCompleted = false;

  menuCam.startTransitionToGameplay(gridEye, gridAim, 0.5, () => {
    transitionCompleted = true;
  });

  assert.equal(menuCam.isTransitioning, true);

  // Step halfway through transition (250ms)
  menuCam.update(0.25, menuCam.transitionStart + 250);
  assert.equal(menuCam.isTransitioning, true);
  assert.equal(transitionCompleted, false);
  // Midpoint should exhibit arc lift
  assert.ok(camera.position.y > 0);

  // Complete transition (550ms)
  menuCam.update(0.30, menuCam.transitionStart + 550);
  assert.equal(menuCam.isTransitioning, false);
  assert.equal(transitionCompleted, true);
  assert.ok(camera.position.distanceTo(gridEye) < 0.05);
});

test("KART_TYPES and DRIVER_PROFILES define all 8 vehicles and characters with complete metadata", () => {
  assert.equal(KART_TYPES.length, 8);
  for (const kart of KART_TYPES) {
    assert.ok(kart.id, "Kart must have id");
    assert.ok(kart.name, "Kart must have name");
    assert.ok(kart.glb.endsWith(".glb"), "Kart must point to valid .glb");
    assert.ok(kart.scale > 0, "Kart scale must be positive");
    assert.ok(kart.category, "Kart must have category");
    assert.ok(kart.desc, "Kart must have description");
    assert.ok(kart.stats.speed >= 50 && kart.stats.speed <= 100);
    assert.ok(kart.stats.accel >= 50 && kart.stats.accel <= 100);
    assert.ok(kart.stats.weight >= 50 && kart.stats.weight <= 100);
    assert.ok(kart.stats.drift >= 50 && kart.stats.drift <= 100);
  }

  const driverKeys = Object.keys(DRIVER_PROFILES);
  assert.equal(driverKeys.length, 8);
  for (const id of driverKeys) {
    const d = DRIVER_PROFILES[id];
    assert.ok(d.name, "Driver must have name");
    assert.ok(d.class, "Driver must have class");
    assert.ok(d.color.startsWith("#"), "Driver must have hex color");
    assert.ok(d.defaultKart, "Driver must have default kart");
    assert.ok(d.stats.speed >= 50 && d.stats.speed <= 100);
    assert.ok(d.stats.accel >= 50 && d.stats.accel <= 100);
    assert.ok(d.stats.handling >= 50 && d.stats.handling <= 100);
    assert.ok(d.stats.weight >= 50 && d.stats.weight <= 100);
  }
});

test("MenuScene constructs 3D turntable, lights, scenery, and particles", () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const renderer = { shadowMap: { enabled: true } };

  const menuScene = new MenuScene({ scene, renderer, camera });

  assert.ok(menuScene.root, "MenuScene must have root group");
  assert.ok(scene.children.includes(menuScene.root), "Root group must be added to scene");

  // Verify turntable components
  assert.ok(menuScene.turntableGroup, "Turntable group must exist");
  assert.ok(menuScene.ledMaterial, "Glowing LED material must exist");

  // Verify dedicated menu studio lights
  assert.ok(menuScene.keyLight, "Key spotlight must exist");
  assert.ok(menuScene.keyLight.castShadow, "Key spotlight must cast shadows");
  assert.ok(menuScene.rimLight, "Rim directional light must exist");
  assert.ok(menuScene.fillLight, "Fill light must exist");
  assert.ok(menuScene.hemiLight, "Hemisphere bounce light must exist");

  // Verify celebration motes particle system
  assert.ok(menuScene.motePoints, "Celebration motes points mesh must exist");
  assert.equal(menuScene.moteSpeeds.length, 60, "Must have 60 celebration motes");

  menuScene.dispose();
  assert.ok(!scene.children.includes(menuScene.root), "Root group must be removed on dispose");
});

test("MenuScene loads and swaps showcase racer with idle animations", async () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const renderer = { shadowMap: { enabled: true } };

  const menuScene = new MenuScene({ scene, renderer, camera });

  // 1. Load Mario in Red Speedster
  await menuScene.setShowcaseRacer("mario", "kart-oobi");
  assert.ok(menuScene.showcaseModel, "Showcase model must be loaded");
  assert.equal(menuScene.characterId, "mario");
  assert.equal(menuScene.kartId, "kart-oobi");
  assert.equal(menuScene.showcaseWheels.filter(Boolean).length, 4, "Must articulate 4 wheels");

  // 2. Perform frame update with idle suspension breathing and head look
  camera.position.set(0, 1.5, 4);
  menuScene.update(0.016, 1000, camera);

  // Check suspension bob within realistic tolerances
  assert.ok(menuScene.showcaseModel.position.y > 0.14 && menuScene.showcaseModel.position.y < 0.18);
  assert.ok(Number.isFinite(menuScene.showcaseModel.rotation.z));
  assert.ok(Number.isFinite(menuScene.showcaseModel.rotation.x));

  // 3. Swap to Peach in Cyber Beast (different kart and character GLB)
  await menuScene.setShowcaseRacer("peach", "race-future");
  assert.equal(menuScene.characterId, "peach");
  assert.equal(menuScene.kartId, "race-future");
  assert.ok(menuScene.showcaseModel, "Showcase model must swap cleanly");
  assert.equal(menuScene.showcaseWheels.filter(Boolean).length, 4);

  // 4. Test activate & deactivate
  menuScene.deactivate();
  assert.equal(menuScene.isActive, false);
  assert.equal(menuScene.root.visible, false);
  assert.equal(menuScene.keyLight.intensity, 0);

  menuScene.activate();
  assert.equal(menuScene.isActive, true);
  assert.equal(menuScene.root.visible, true);
  assert.ok(menuScene.keyLight.intensity > 0);

  menuScene.dispose();
});
