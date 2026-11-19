import test from "node:test";
import assert from "node:assert/strict";
import { WheelInput } from "../app/src/main/assets/game/input.js";
import { setupTouchControls } from "../app/src/main/assets/game/touch-controls.js";

// Lightweight DOM & PointerEvent mock environment using Node.js built-in EventTarget & Event
class MockElement extends EventTarget {
  constructor(id = "", className = "") {
    super();
    this.id = id;
    this.className = className;
    const classes = new Set(className.split(" ").filter(Boolean));
    this.classList = {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, force) => {
        const state = force !== undefined ? Boolean(force) : !classes.has(c);
        if (state) classes.add(c);
        else classes.delete(c);
        return state;
      },
      toString: () => Array.from(classes).join(" "),
    };
    this.capturedPointers = new Set();
    this.bounds = { left: 0, top: 0, width: 200, height: 60 };
  }

  setPointerCapture(id) {
    this.capturedPointers.add(id);
  }

  releasePointerCapture(id) {
    this.capturedPointers.delete(id);
  }

  hasPointerCapture(id) {
    return this.capturedPointers.has(id);
  }

  getBoundingClientRect() {
    return this.bounds;
  }
}

class MockPointerEvent extends Event {
  constructor(type, init = {}) {
    super(type, { bubbles: true, cancelable: true, ...init });
    this.pointerId = init.pointerId ?? 1;
    this.clientX = init.clientX ?? 0;
    this.clientY = init.clientY ?? 0;
  }
}

function createDOMEnvironment() {
  const windowObj = new EventTarget();
  windowObj.PointerEvent = MockPointerEvent;

  const doc = new EventTarget();
  doc.hidden = false;

  const elements = new Map();
  const registerEl = (id, className = "touch-btn") => {
    const el = new MockElement(id, className);
    elements.set(id, el);
    return el;
  };

  const steerRow = registerEl("steer-row", "steer-row");
  steerRow.bounds = { left: 0, top: 0, width: 200, height: 60 };
  const steerLeft = registerEl("touch-steer-left", "touch-btn steer-btn");
  const steerRight = registerEl("touch-steer-right", "touch-btn steer-btn");
  const gas = registerEl("touch-gas", "touch-btn action-btn");
  const brake = registerEl("touch-brake", "touch-btn action-btn");
  const drift = registerEl("touch-drift", "touch-btn action-btn");
  const item = registerEl("touch-item", "touch-btn action-btn");
  const tilt = registerEl("touch-tilt-toggle", "touch-sub-btn");
  const pause = registerEl("pause-btn", "hud-btn");

  doc.getElementById = (id) => elements.get(id) || null;
  doc.querySelector = (sel) => {
    if (sel === ".steer-row") return steerRow;
    if (sel.startsWith("#")) return doc.getElementById(sel.slice(1));
    return null;
  };
  doc.querySelectorAll = (sel) => {
    if (sel === ".touch-btn") {
      return [steerLeft, steerRight, gas, brake, drift, item];
    }
    return [];
  };

  return { windowObj, doc, elements };
}

// -----------------------------------------------------------------------------
// Test 1: Normal press and release
// -----------------------------------------------------------------------------
test("1. Normal press and release registers correctly and cleans up", () => {
  const { windowObj, doc, elements } = createDOMEnvironment();
  const wheel = new WheelInput();
  const controls = setupTouchControls({ wheel, root: doc, windowObj });

  const gasEl = elements.get("touch-gas");
  const downEv = new MockPointerEvent("pointerdown", { pointerId: 10 });
  gasEl.dispatchEvent(downEv);

  assert.equal(wheel.read(0).gas, true);
  assert.equal(gasEl.classList.contains("active"), true);
  assert.equal(gasEl.hasPointerCapture(10), true);

  const upEv = new MockPointerEvent("pointerup", { pointerId: 10 });
  gasEl.dispatchEvent(upEv);

  assert.equal(wheel.read(16).gas, false);
  assert.equal(gasEl.classList.contains("active"), false);
  assert.equal(gasEl.hasPointerCapture(10), false);
});

// -----------------------------------------------------------------------------
// Test 2: Press -> window blur -> press again (Bug reproduction & verification)
// -----------------------------------------------------------------------------
test("2. Press -> window blur -> press again recovers cleanly without frozen state", () => {
  const { windowObj, doc, elements } = createDOMEnvironment();
  const wheel = new WheelInput();
  setupTouchControls({ wheel, root: doc, windowObj });

  const gasEl = elements.get("touch-gas");

  // Initial press
  gasEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 1 }));
  assert.equal(wheel.read(0).gas, true);
  assert.equal(gasEl.classList.contains("active"), true);

  // App loses focus (blur)
  windowObj.dispatchEvent(new Event("blur"));
  assert.equal(wheel.read(16).gas, false, "Input must release on blur");
  assert.equal(gasEl.classList.contains("active"), false, "Active visual state must clear on blur");

  // Press again after focus returns with a new touch
  gasEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 2 }));
  assert.equal(
    wheel.read(32).gas,
    true,
    "Second press must register normally; must not be ignored due to stale isPressed"
  );
  assert.equal(gasEl.classList.contains("active"), true);

  // Normal release
  gasEl.dispatchEvent(new MockPointerEvent("pointerup", { pointerId: 2 }));
  assert.equal(wheel.read(48).gas, false);
});

// -----------------------------------------------------------------------------
// Test 3: Press -> document becomes hidden -> press again
// -----------------------------------------------------------------------------
test("3. Press -> document becomes hidden -> press again recovers properly", () => {
  const { windowObj, doc, elements } = createDOMEnvironment();
  const wheel = new WheelInput();
  setupTouchControls({ wheel, root: doc, windowObj });

  const driftEl = elements.get("touch-drift");

  // Press DRIFT
  driftEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 1 }));
  assert.equal(wheel.read(0).drift, true);

  // Tab hidden
  doc.hidden = true;
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(wheel.read(16).drift, false, "Drift must release when tab is hidden");

  // Tab restored
  doc.hidden = false;
  doc.dispatchEvent(new Event("visibilitychange"));

  // Press DRIFT again
  driftEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 3 }));
  assert.equal(wheel.read(32).drift, true, "Drift must register upon user touch after restore");

  driftEl.dispatchEvent(new MockPointerEvent("pointerup", { pointerId: 3 }));
  assert.equal(wheel.read(48).drift, false);
});

// -----------------------------------------------------------------------------
// Test 4: Press -> pointer cancellation -> press again
// -----------------------------------------------------------------------------
test("4. Press -> pointer cancellation -> press again recovers without stuck inputs", () => {
  const { windowObj, doc, elements } = createDOMEnvironment();
  const wheel = new WheelInput();
  setupTouchControls({ wheel, root: doc, windowObj });

  const brakeEl = elements.get("touch-brake");

  // Press BRAKE
  brakeEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 5 }));
  assert.equal(wheel.read(0).brake, true);

  // OS pointer cancellation
  brakeEl.dispatchEvent(new MockPointerEvent("pointercancel", { pointerId: 5 }));
  assert.equal(wheel.read(16).brake, false);
  assert.equal(brakeEl.classList.contains("active"), false);

  // Press BRAKE again
  brakeEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 6 }));
  assert.equal(wheel.read(32).brake, true, "Brake must register after previous pointercancel");

  brakeEl.dispatchEvent(new MockPointerEvent("pointerup", { pointerId: 6 }));
  assert.equal(wheel.read(48).brake, false);
});

// -----------------------------------------------------------------------------
// Test 5: Press -> lost pointer capture -> press again
// -----------------------------------------------------------------------------
test("5. Press -> lost pointer capture -> press again recovers cleanly", () => {
  const { windowObj, doc, elements } = createDOMEnvironment();
  const wheel = new WheelInput();
  setupTouchControls({ wheel, root: doc, windowObj });

  const itemEl = elements.get("touch-item");

  // Press ITEM
  itemEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 7 }));
  assert.equal(wheel.read(0).item, true);

  // Lost pointer capture event
  itemEl.dispatchEvent(new MockPointerEvent("lostpointercapture", { pointerId: 7 }));
  assert.equal(wheel.read(16).item, false);

  // Press ITEM again
  itemEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 8 }));
  assert.equal(wheel.read(32).item, true);

  itemEl.dispatchEvent(new MockPointerEvent("pointerup", { pointerId: 8 }));
  assert.equal(wheel.read(48).item, false);
});

// -----------------------------------------------------------------------------
// Test 6: Repeated global cleanup is safe and idempotent
// -----------------------------------------------------------------------------
test("6. Repeated global cleanup calls are safe and do not corrupt state", () => {
  const { windowObj, doc, elements } = createDOMEnvironment();
  const wheel = new WheelInput();
  const controls = setupTouchControls({ wheel, root: doc, windowObj });

  // Call releaseAllTouch 5 times consecutively
  for (let i = 0; i < 5; i++) {
    assert.doesNotThrow(() => controls.releaseAllTouch());
  }

  const gasEl = elements.get("touch-gas");
  gasEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 1 }));
  assert.equal(wheel.read(0).gas, true);

  // Multiple cleanups while pressed
  controls.releaseAllTouch();
  controls.releaseAllTouch();
  controls.releaseAllTouch();

  assert.equal(wheel.read(16).gas, false);

  // Subsequent press still works
  gasEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 2 }));
  assert.equal(wheel.read(32).gas, true);
});

// -----------------------------------------------------------------------------
// Test 7: Multiple simultaneous touch controls (multi-touch)
// -----------------------------------------------------------------------------
test("7. Multiple simultaneous touch controls operate independently without clobbering", () => {
  const { windowObj, doc, elements } = createDOMEnvironment();
  const wheel = new WheelInput();
  setupTouchControls({ wheel, root: doc, windowObj });

  const steerRow = elements.get("steer-row");
  const gasEl = elements.get("touch-gas");
  const driftEl = elements.get("touch-drift");
  const leftBtn = elements.get("touch-steer-left");

  // 1. Finger 1 holds GAS (pointerId 1)
  gasEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 1 }));
  assert.equal(wheel.read(0).gas, true);

  // 2. Finger 2 steers LEFT (pointerId 2, clientX = 20 on 200px width -> norm = (20-100)/100 = -0.8)
  steerRow.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 2, clientX: 20 }));
  let state = wheel.read(16);
  assert.equal(state.gas, true, "GAS must remain pressed while steering");
  assert.ok(state.steer <= -0.7, "Steer left must register");
  assert.equal(leftBtn.classList.contains("active"), true);

  // 3. Finger 3 holds DRIFT (pointerId 3)
  driftEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 3 }));
  state = wheel.read(32);
  assert.equal(state.gas, true);
  assert.equal(state.drift, true);
  assert.ok(state.steer <= -0.7);

  // 4. Finger 2 releases steering while GAS and DRIFT continue
  steerRow.dispatchEvent(new MockPointerEvent("pointerup", { pointerId: 2 }));
  state = wheel.read(48);
  assert.equal(state.steer, 0, "Steer must return to center");
  assert.equal(state.gas, true, "GAS must still be pressed");
  assert.equal(state.drift, true, "DRIFT must still be pressed");

  // 5. Finger 1 releases GAS
  gasEl.dispatchEvent(new MockPointerEvent("pointerup", { pointerId: 1 }));
  state = wheel.read(64);
  assert.equal(state.gas, false);
  assert.equal(state.drift, true, "DRIFT must still be held");

  // 6. Finger 3 releases DRIFT
  driftEl.dispatchEvent(new MockPointerEvent("pointerup", { pointerId: 3 }));
  state = wheel.read(80);
  assert.equal(state.gas, false);
  assert.equal(state.drift, false);
  assert.equal(state.steer, 0);
});

// -----------------------------------------------------------------------------
// Test 8: A stale pointer-up or pointer-cancel event does not release a newer pointer
// -----------------------------------------------------------------------------
test("8. A stale pointer-up or pointer-cancel event does not release a newer active pointer", () => {
  const { windowObj, doc, elements } = createDOMEnvironment();
  const wheel = new WheelInput();
  setupTouchControls({ wheel, root: doc, windowObj });

  const gasEl = elements.get("touch-gas");

  // Active touch is pointerId 100
  gasEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 100 }));
  assert.equal(wheel.read(0).gas, true);

  // Stale pointerup with old pointerId 50 arrives
  gasEl.dispatchEvent(new MockPointerEvent("pointerup", { pointerId: 50 }));
  assert.equal(wheel.read(16).gas, true, "Stale pointerup (id 50) must NOT release active pointer (id 100)");

  // Stale pointercancel with another pointerId arrives
  gasEl.dispatchEvent(new MockPointerEvent("pointercancel", { pointerId: 75 }));
  assert.equal(wheel.read(32).gas, true, "Stale pointercancel must NOT release active pointer");

  // Real pointerup with active pointerId 100 arrives
  gasEl.dispatchEvent(new MockPointerEvent("pointerup", { pointerId: 100 }));
  assert.equal(wheel.read(48).gas, false, "Matching pointerup must release");
});

// -----------------------------------------------------------------------------
// Test 9: Steering resets correctly after interruption
// -----------------------------------------------------------------------------
test("9. Steering resets correctly after interruption (blur/cancel)", () => {
  const { windowObj, doc, elements } = createDOMEnvironment();
  const wheel = new WheelInput();
  setupTouchControls({ wheel, root: doc, windowObj });

  const steerRow = elements.get("steer-row");
  const leftBtn = elements.get("touch-steer-left");
  const rightBtn = elements.get("touch-steer-right");

  // Steer left
  steerRow.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 1, clientX: 10 }));
  assert.ok(wheel.read(0).steer < -0.5);
  assert.equal(leftBtn.classList.contains("active"), true);

  // App blurs
  windowObj.dispatchEvent(new Event("blur"));
  assert.equal(wheel.read(16).steer, 0, "Steering must reset to 0 on blur");
  assert.equal(leftBtn.classList.contains("active"), false, "Left active visual must clear");
  assert.equal(rightBtn.classList.contains("active"), false);

  // Touch steer again with new pointer
  steerRow.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 2, clientX: 180 }));
  assert.ok(wheel.read(32).steer > 0.5, "Steer must respond to subsequent touch");
  assert.equal(rightBtn.classList.contains("active"), true);

  steerRow.dispatchEvent(new MockPointerEvent("pointerup", { pointerId: 2 }));
  assert.equal(wheel.read(48).steer, 0);
  assert.equal(rightBtn.classList.contains("active"), false);
});

// -----------------------------------------------------------------------------
// Test 10: GAS, BRAKE, DRIFT and ITEM all recover after cleanup
// -----------------------------------------------------------------------------
test("10. GAS, BRAKE, DRIFT and ITEM all recover independently after cleanup", () => {
  const { windowObj, doc, elements } = createDOMEnvironment();
  const wheel = new WheelInput();
  const controls = setupTouchControls({ wheel, root: doc, windowObj });

  const gasEl = elements.get("touch-gas");
  const brakeEl = elements.get("touch-brake");
  const driftEl = elements.get("touch-drift");
  const itemEl = elements.get("touch-item");

  // Press all 4 buttons at once
  gasEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 10 }));
  brakeEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 11 }));
  driftEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 12 }));
  itemEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 13 }));

  let state = wheel.read(0);
  assert.equal(state.gas, true);
  assert.equal(state.brake, true);
  assert.equal(state.drift, true);
  assert.equal(state.item, true);

  // Global cleanup (e.g. pagehide or visibility loss)
  controls.releaseAllTouch();

  state = wheel.read(16);
  assert.equal(state.gas, false);
  assert.equal(state.brake, false);
  assert.equal(state.drift, false);
  assert.equal(state.item, false);

  // Verify all 4 recover independently on subsequent presses
  gasEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 20 }));
  assert.equal(wheel.read(32).gas, true);
  gasEl.dispatchEvent(new MockPointerEvent("pointerup", { pointerId: 20 }));
  assert.equal(wheel.read(48).gas, false);

  brakeEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 21 }));
  assert.equal(wheel.read(64).brake, true);
  brakeEl.dispatchEvent(new MockPointerEvent("pointerup", { pointerId: 21 }));
  assert.equal(wheel.read(80).brake, false);

  driftEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 22 }));
  assert.equal(wheel.read(96).drift, true);
  driftEl.dispatchEvent(new MockPointerEvent("pointerup", { pointerId: 22 }));
  assert.equal(wheel.read(112).drift, false);

  itemEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 23 }));
  assert.equal(wheel.read(128).item, true);
  itemEl.dispatchEvent(new MockPointerEvent("pointerup", { pointerId: 23 }));
  assert.equal(wheel.read(144).item, false);
});

// -----------------------------------------------------------------------------
// Test 11: Direct bug reproduction proof (demonstrates legacy failure vs fix success)
// -----------------------------------------------------------------------------
test("11. Direct bug reproduction: unreset local isPressed causes failure, while lifecycle fix succeeds", () => {
  // Legacy buggy implementation simulation:
  let legacyIsPressed = false;
  let legacyActivePointerId = null;
  let legacyGasRegistered = false;

  const legacyPress = (e) => {
    if (legacyIsPressed) return;
    legacyIsPressed = true;
    legacyActivePointerId = e.pointerId;
    legacyGasRegistered = true;
  };
  const legacyBrokenReleaseAll = () => {
    // The bug: resets wheel but leaves local variables legacyIsPressed=true!
    legacyGasRegistered = false;
  };

  // Step 1: User presses gas
  legacyPress({ pointerId: 1 });
  assert.equal(legacyGasRegistered, true);

  // Step 2: Global cleanup occurs on blur/hidden without resetting local variables
  legacyBrokenReleaseAll();
  assert.equal(legacyGasRegistered, false);

  // Step 3: User touches again -> BUG: ignored because legacyIsPressed was never cleared!
  legacyPress({ pointerId: 2 });
  assert.equal(legacyGasRegistered, false, "Demonstrates legacy bug: input is completely ignored!");

  // Contrast with setupTouchControls (fixed implementation):
  const { windowObj, doc, elements } = createDOMEnvironment();
  const wheel = new WheelInput();
  setupTouchControls({ wheel, root: doc, windowObj });
  const gasEl = elements.get("touch-gas");

  gasEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 1 }));
  assert.equal(wheel.read(0).gas, true);

  // Global blur cleanup
  windowObj.dispatchEvent(new Event("blur"));
  assert.equal(wheel.read(16).gas, false);

  // Subsequent press registers properly
  gasEl.dispatchEvent(new MockPointerEvent("pointerdown", { pointerId: 2 }));
  assert.equal(wheel.read(32).gas, true, "Fixed implementation properly registers subsequent press!");
});
