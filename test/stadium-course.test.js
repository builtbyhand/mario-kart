import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadGLB } from "../app/src/main/assets/game/models.js";
import { createSurfaceTrack } from "../app/src/main/assets/game/surface-track.js";

test("Optimized stadium-source.glb loads cleanly and stays compact for mobile GPU memory", async () => {
  const glbPath = path.resolve("app/src/main/assets/game/models/stadium-source.glb");
  assert.ok(fs.existsSync(glbPath), "stadium-source.glb must exist");
  const sizeMb = fs.statSync(glbPath).size / (1024 * 1024);
  assert.ok(sizeMb < 15, `Optimized stadium-source.glb should be < 15 MB (got ${sizeMb.toFixed(2)} MB)`);

  const gltf = await loadGLB("models/stadium-source.glb");
  let meshes = 0;
  gltf.scene.traverse((o) => {
    if (o.isMesh) meshes++;
  });
  assert.ok(meshes >= 60, `Expected stadium-source.glb to have >= 60 meshes (got ${meshes})`);
});

test("stadium-route.json forms a valid closed 3D surface track with anti-gravity and glide zones", () => {
  const routePath = path.resolve("app/src/main/assets/game/stadium-route.json");
  assert.ok(fs.existsSync(routePath), "stadium-route.json must exist");
  const route = JSON.parse(fs.readFileSync(routePath, "utf8"));
  const track = createSurfaceTrack(route);

  assert.ok(track.hasRoadMesh, "stadium-route must include roadMesh");
  assert.ok(track.length > 1000, "stadium-route length must exceed 1000m");
  assert.ok(track.sections.antiStart > 0 && track.sections.antiEnd > track.sections.antiStart);
  assert.ok(track.sections.glideStart > track.sections.antiStart && track.sections.glideEnd > track.sections.glideStart);

  for (let s = 0; s < track.length; s += 8) {
    const pt = track.at(s);
    assert.ok(Number.isFinite(pt.x) && Number.isFinite(pt.y) && Number.isFinite(pt.z));
    if (!pt.glide) {
      assert.equal(track.onRoad(s, 0), true, `Centerline at s=${s} must be drivable road`);
      const b = track.bounds(s, 0);
      assert.ok(b.max - b.min >= 10, `Road width at s=${s} must be >= 10m (got ${b.max - b.min})`);
    }
  }
});
