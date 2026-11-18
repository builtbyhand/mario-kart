import test from "node:test";
import assert from "node:assert/strict";
import { Race, CHARACTERS, ITEMS, topSpeed, turboTier, seeded } from "../app/src/main/assets/game/logic.js";

test("Race initializes with correct defaults and characters", () => {
  const race = new Race({ character: "mario", laps: 3, seed: 100 });
  assert.equal(race.racers.length, 8);
  assert.equal(race.player.character.id, "mario");
  assert.equal(race.laps, 3);
  assert.equal(race.state, "ready");
});

test("Top speed scales with collected coins", () => {
  const speed0 = topSpeed(0);
  const speed10 = topSpeed(10);
  assert.ok(speed10 > speed0, "10 coins should increase top speed over 0 coins");
  assert.equal(topSpeed(20), speed10, "Coins should cap at 10 for speed bonus");
});

test("Turbo tier resolves mini-turbo levels accurately", () => {
  assert.equal(turboTier(0), 0);
  assert.equal(turboTier(0.5), 0);
  assert.equal(turboTier(0.8), 1); // Mini-turbo
  assert.equal(turboTier(1.9), 1);
  assert.equal(turboTier(2.0), 2); // Super mini-turbo
  assert.equal(turboTier(3.3), 2);
  assert.equal(turboTier(3.4), 3); // Ultra mini-turbo
});

test("Race updates fixed-step accumulator and advances race state", () => {
  const race = new Race({ character: "yoshi", laps: 1, seed: 42 });
  race.start();
  assert.equal(race.state, "countdown");

  // Advance 3 seconds without gas to avoid burnout
  for (let i = 0; i < 185; i++) {
    race.update(1 / 60, { gas: false, steer: 0 });
  }
  assert.equal(race.state, "racing");

  // Now accelerate
  for (let i = 0; i < 60; i++) {
    race.update(1 / 60, { gas: true, steer: 0 });
  }
  assert.ok(race.player.speed > 0, "Player should be moving after accelerating in race state");
});

test("Seeded random number generator is deterministic", () => {
  const rng1 = seeded(777);
  const rng2 = seeded(777);
  for (let i = 0; i < 10; i++) {
    assert.equal(rng1(), rng2());
  }
});
