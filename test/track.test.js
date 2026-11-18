import test from "node:test";
import assert from "node:assert/strict";
import {
  TRACK_LENGTH,
  wrap,
  clamp,
  angle,
  trackAt,
  surfaceAt,
  CONTROL_POINTS,
  SECTIONS,
} from "../app/src/main/assets/game/track.js";

test("Track constants and control points are valid", () => {
  assert.ok(TRACK_LENGTH > 500, "Track length should be substantial");
  assert.ok(CONTROL_POINTS.length >= 20, "Should have sufficient control points");
  assert.ok(SECTIONS.glideStart < SECTIONS.glideEnd, "Glide section should have positive length");
});

test("Math utilities wrap, clamp, angle behave as expected", () => {
  // Wrap
  assert.equal(wrap(10, 100), 10);
  assert.equal(wrap(110, 100), 10);
  assert.equal(wrap(-10, 100), 90);

  // Clamp
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);

  // Angle: normalizes to [-pi, pi]
  assert.equal(angle(0), 0);
  assert.ok(Math.abs(angle(Math.PI * 3) - Math.PI) < 1e-6);
  assert.ok(Math.abs(angle(-Math.PI * 3) - (-Math.PI)) < 1e-6);
});

test("Surface sampling returns continuous 3D points with valid coordinates", () => {
  const p0 = surfaceAt(0, 0);
  assert.ok(Number.isFinite(p0.x));
  assert.ok(Number.isFinite(p0.y));
  assert.ok(Number.isFinite(p0.z));

  const pHalf = surfaceAt(TRACK_LENGTH / 2, 0);
  assert.ok(Number.isFinite(pHalf.x));
  assert.ok(Number.isFinite(pHalf.y));
  assert.ok(Number.isFinite(pHalf.z));
});
