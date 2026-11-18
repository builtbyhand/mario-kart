import test from "node:test";
import assert from "node:assert/strict";

// Setup mock window for node environment
globalThis.window = globalThis;

import { WheelInput } from "../app/src/main/assets/game/input.js";

test("WheelInput initializes in a clean neutral state", () => {
  const wheel = new WheelInput();
  const state = wheel.read(0);

  assert.equal(state.steer, 0);
  assert.equal(state.gas, false);
  assert.equal(state.brake, false);
  assert.equal(state.drift, false);
  assert.equal(state.item, false);
});

test("Touch inputs update and release cleanly without getting stuck", () => {
  const wheel = new WheelInput();

  wheel.setTouchSteer(-0.8);
  wheel.setTouchButton("gas", true);
  wheel.setTouchButton("drift", true);

  let state = wheel.read(10);
  assert.equal(state.steer, -0.8);
  assert.equal(state.gas, true);
  assert.equal(state.drift, true);
  assert.equal(state.brake, false);

  // Release touch inputs
  wheel.setTouchSteer(0);
  wheel.setTouchButton("gas", false);
  wheel.setTouchButton("drift", false);

  state = wheel.read(20);
  assert.equal(state.steer, 0);
  assert.equal(state.gas, false);
  assert.equal(state.drift, false);
});

test("Gamepad button polling clears upon release (no stuck buttons)", () => {
  const wheel = new WheelInput();

  // Mock navigator.getGamepads
  const mockGamepad = {
    connected: true,
    axes: [0],
    buttons: [
      { pressed: true, value: 1.0 }, // Gas (Button A)
      { pressed: false, value: 0 },
      { pressed: false, value: 0 },
      { pressed: false, value: 0 },
      { pressed: false, value: 0 },
      { pressed: true, value: 1.0 },  // Drift (Button 5)
    ],
  };

  // Mock navigator.getGamepads compatible with both Node 20 (navigator is undefined) and Node 21+ (global navigator object)
  const hasGlobalNav = typeof globalThis.navigator !== "undefined" && globalThis.navigator !== null;
  if (hasGlobalNav) {
    Object.defineProperty(globalThis.navigator, "getGamepads", {
      value: () => [mockGamepad],
      configurable: true,
    });
  } else {
    Object.defineProperty(globalThis, "navigator", {
      value: { getGamepads: () => [mockGamepad] },
      configurable: true,
      writable: true,
    });
  }

  try {
    let state = wheel.read(0);
    assert.equal(state.gas, true);
    assert.equal(state.drift, true);

    // Release gamepad buttons
    mockGamepad.buttons[0] = { pressed: false, value: 0 };
    mockGamepad.buttons[5] = { pressed: false, value: 0 };

    state = wheel.read(16);
    assert.equal(state.gas, false, "Gas should be false after releasing button");
    assert.equal(state.drift, false, "Drift should be false after releasing button");
  } finally {
    if (hasGlobalNav) {
      delete globalThis.navigator.getGamepads;
    } else {
      delete globalThis.navigator;
    }
  }
});

test("Native bridge inputs integrate with composite state", () => {
  const wheel = new WheelInput();

  // Simulate native Android bridge dispatch
  window.onNativeGamepadInput({
    steer: 0.5,
    gas: true,
    brake: false,
    drift: false,
    item: true,
  });

  const state = wheel.read(100);
  assert.equal(state.steer, 0.5);
  assert.equal(state.gas, true);
  assert.equal(state.item, true);

  // Release via bridge
  window.onNativeGamepadInput({
    steer: 0,
    gas: false,
    item: false,
  });

  const stateReleased = wheel.read(120);
  assert.equal(stateReleased.steer, 0);
  assert.equal(stateReleased.gas, false);
  assert.equal(stateReleased.item, false);
});

test("Reset resets all input sources cleanly", () => {
  const wheel = new WheelInput();
  wheel.setTouchSteer(0.9);
  wheel.setTouchButton("gas", true);
  wheel.reset();

  const state = wheel.read(0);
  assert.equal(state.steer, 0);
  assert.equal(state.gas, false);
});
