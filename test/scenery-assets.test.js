import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const GAME = "app/src/main/assets/game";
const loaderSrc = fs.readFileSync(path.join(GAME, "environment-loader.js"), "utf8");
const worldSrc = fs.readFileSync(path.join(GAME, "world.js"), "utf8");

const entries = [...loaderSrc.matchAll(/^\s{2}([A-Za-z_0-9]+):\s*"(models\/[^"]+\.glb)"/gm)].map((m) => [m[1], m[2]]);

function readGlbJson(file) {
  const buf = fs.readFileSync(file);
  assert.equal(buf.readUInt32LE(0), 0x46546c67, `valid GLB header: ${file}`);
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
}

test("environment registry has no duplicate keys", () => {
  const seen = new Set();
  for (const [key] of entries) {
    assert.ok(!seen.has(key), `Duplicate registry key: ${key}`);
    seen.add(key);
  }
  assert.ok(entries.length >= 28);
});

test("every registered model is a valid, self-contained, non-empty GLB with finite bounds", () => {
  for (const [key, rel] of entries) {
    const file = path.join(GAME, rel);
    assert.ok(fs.existsSync(file), `File exists for ${key}: ${rel}`);
    const json = readGlbJson(file);
    assert.ok(json.meshes && json.meshes.length > 0, `${key} has meshes`);
    for (const img of json.images || []) assert.ok(!img.uri, `${key} has no external image URI`);
    for (const buf of json.buffers || []) assert.ok(!buf.uri, `${key} has no external buffer URI`);
    let height = 0;
    for (const mesh of json.meshes) {
      for (const prim of mesh.primitives) {
        const acc = json.accessors[prim.attributes.POSITION];
        assert.ok(acc.min && acc.max, `${key} has position bounds`);
        for (const v of [...acc.min, ...acc.max]) assert.ok(Number.isFinite(v), `${key} bounds are finite`);
        height = Math.max(height, acc.max[1] - acc.min[1]);
      }
    }
    assert.ok(height > 0.01, `${key} has visible height`);
  }
});

test("every scatter() model used in world.js is registered", () => {
  const keys = new Set(entries.map((e) => e[0]));
  const used = [...worldSrc.matchAll(/^\s*scatter\("([A-Za-z_0-9]+)"/gm)].map((m) => m[1]);
  assert.ok(used.length > 0);
  for (const key of used) assert.ok(keys.has(key), `scatter model not registered: ${key}`);
});

test("every texture referenced by world.js exists", () => {
  const urls = [...worldSrc.matchAll(/"(textures\/[A-Za-z_0-9]+\/[A-Za-z_0-9]+\.jpg)"/g)].map((m) => m[1]);
  assert.ok(urls.length > 0);
  for (const rel of urls) assert.ok(fs.existsSync(path.join(GAME, rel)), `Texture exists: ${rel}`);
});
