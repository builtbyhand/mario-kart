import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  KART_SPECS,
  loadGLB,
  buildGLBKart,
  loadKartPack,
  updateDriverAnimation,
  disposeModel,
} from "../app/src/main/assets/game/models.js";

test("All 8 *-source.glb models build with 4 articulated wheels, driver-head, and procedural sway", async () => {
  for (const [id, spec] of Object.entries(KART_SPECS)) {
    assert.ok(spec.sourceKart, `${id} must define sourceKart`);
    const sourceGltf = await loadGLB(spec.sourceKart);
    const built = buildGLBKart(id, sourceGltf, null, 1.0, null);

    assert.equal(built.wheels.length, 4, `${id} source kart must have 4 wheels`);
    for (let i = 0; i < 4; i++) {
      assert.ok(built.wheels[i], `${id} wheel-${i} must be articulated`);
      assert.ok(built.wheels[i].userData.hubRadius > 0.2, `${id} wheel-${i} hubRadius must be valid`);
    }
    assert.ok(built.driver?.userData?.isSourceDriver, `${id} must tag isSourceDriver`);
    assert.ok(built.driverHead?.userData?.lookRestQuaternion, `${id} must capture driverHead lookRestQuaternion`);

    const restRotZ = built.driver.rotation.z;
    const racer = { speed: 40, steer: 0.8, drift: 1, jump: 0, landing: 0, spin: 0, boost: 0 };
    updateDriverAnimation(built, racer, "racing", 0.05);
    assert.notEqual(built.driver.rotation.z, restRotZ, `${id} driver must sway procedurally while steering`);

    disposeModel(built.model);
  }
});

test("loadKartPack upgrades kart with useSourcePack: true to source GLB", async () => {
  const root = new THREE.Group();
  const placeholder = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  root.add(placeholder);

  const kartObj = {
    id: "mario",
    useSourcePack: true,
    root,
    model: placeholder,
    wheels: [],
    source: "procedural",
  };

  const res = await loadKartPack([kartObj]);
  assert.equal(res.loaded, 1);
  assert.equal(res.fallback, 0);
  assert.equal(kartObj.source, "glb");
  assert.equal(kartObj.wheels.length, 4);
  assert.ok(kartObj.driver?.userData?.isSourceDriver);

  disposeModel(kartObj.model);
});
