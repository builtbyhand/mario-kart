/**
 * High quality Android Touch Controls Manager for Mario Kart.
 * Handles lifecycle-safe on-screen touch steering, action buttons,
 * multi-touch coordination, and reliable recovery on focus loss / visibility changes.
 */

export function addTapListener(el, handler) {
  if (!el) return;
  let lastTrigger = 0;
  const trigger = (e) => {
    const now = Date.now();
    if (now - lastTrigger < 280) return;
    lastTrigger = now;
    if (e && e.cancelable) e.preventDefault();
    handler(e);
  };
  el.addEventListener("pointerdown", trigger);
  el.addEventListener("click", trigger);
}

export function setupTouchControls({
  wheel,
  root = (typeof document !== "undefined" ? document : null),
  windowObj = (typeof window !== "undefined" ? window : null),
  onItemPulse,
  onPauseToggle,
  onRestart,
  onMenuReturn,
  onResultsMenu,
} = {}) {
  if (!wheel && windowObj && windowObj.wheel) {
    wheel = windowObj.wheel;
  }

  const $ = (id) => (root ? (root.getElementById ? root.getElementById(id) : root.querySelector ? root.querySelector("#" + id) : null) : null);
  const buttonControllers = new Map();

  // 1. Steering Row Analog & Button Handler
  const steerRow = root?.querySelector ? root.querySelector(".steer-row") : null;
  const leftBtn = $("touch-steer-left");
  const rightBtn = $("touch-steer-right");
  let steerPointerId = null;

  const updateSteerFromPoint = (clientX) => {
    if (!steerRow || !wheel) return;
    const rect = steerRow.getBoundingClientRect ? steerRow.getBoundingClientRect() : { left: 0, width: 200 };
    const centerX = rect.left + rect.width / 2;
    const halfWidth = rect.width / 2 || 1;
    const norm = (clientX - centerX) / halfWidth;
    const deadzone = 0.1;
    if (Math.abs(norm) < deadzone) {
      wheel.setTouchSteer(0);
      leftBtn?.classList?.remove("active");
      rightBtn?.classList?.remove("active");
    } else if (norm < 0) {
      wheel.setTouchSteer(Math.max(-1, norm));
      leftBtn?.classList?.add("active");
      rightBtn?.classList?.remove("active");
    } else {
      wheel.setTouchSteer(Math.min(1, norm));
      leftBtn?.classList?.remove("active");
      rightBtn?.classList?.add("active");
    }
  };

  const resetSteer = () => {
    if (steerPointerId !== null && steerRow) {
      try {
        if (steerRow.releasePointerCapture && steerRow.hasPointerCapture?.(steerPointerId)) {
          steerRow.releasePointerCapture(steerPointerId);
        }
      } catch (_) {}
    }
    steerPointerId = null;
    if (wheel) wheel.setTouchSteer(0);
    leftBtn?.classList?.remove("active");
    rightBtn?.classList?.remove("active");
  };

  if (steerRow) {
    const onSteerDown = (e) => {
      if (e && e.cancelable) e.preventDefault();
      // Ignore secondary pointers if already steering
      if (steerPointerId !== null && e && e.pointerId !== undefined && e.pointerId !== steerPointerId) {
        return;
      }
      steerPointerId = e && e.pointerId !== undefined ? e.pointerId : null;
      if (steerPointerId !== null) {
        try { steerRow.setPointerCapture(steerPointerId); } catch (_) {}
      }
      updateSteerFromPoint(e ? e.clientX : 0);
    };

    const onSteerMove = (e) => {
      if (steerPointerId !== null && (e.pointerId === undefined || e.pointerId === steerPointerId)) {
        if (e && e.cancelable) e.preventDefault();
        updateSteerFromPoint(e ? e.clientX : 0);
      }
    };

    const onSteerUp = (e) => {
      // Stale pointer event from another finger must not release active steering
      if (e && e.pointerId !== undefined && steerPointerId !== null && e.pointerId !== steerPointerId) {
        return;
      }
      if (e && e.cancelable) e.preventDefault();
      resetSteer();
    };

    steerRow.addEventListener("pointerdown", onSteerDown);
    steerRow.addEventListener("pointermove", onSteerMove);
    steerRow.addEventListener("pointerup", onSteerUp);
    steerRow.addEventListener("pointercancel", onSteerUp);
    steerRow.addEventListener("lostpointercapture", onSteerUp);
  }

  // 2. Action Button Binder with Shared Lifecycle Reset
  const bindTouch = (id, onDown, onUp) => {
    const el = $(id);
    if (!el) return null;
    let isPressed = false;
    let activePointerId = null;

    const press = (e) => {
      if (e && e.cancelable) e.preventDefault();
      // If already pressed, ignore secondary touches on this same button
      if (isPressed) return;

      const pid = e && e.pointerId !== undefined ? e.pointerId : null;
      isPressed = true;
      activePointerId = pid;
      if (pid !== null) {
        try {
          if (el.setPointerCapture) el.setPointerCapture(pid);
        } catch (_) {}
      }
      el.classList?.add("active");
      onDown();
    };

    const release = (e) => {
      if (e && e.cancelable) e.preventDefault();
      // Stale pointer-up or cancel event from another pointer must not release active button
      if (e && e.pointerId !== undefined && activePointerId !== null && e.pointerId !== activePointerId) {
        return;
      }

      if (isPressed) {
        const pid = activePointerId;
        isPressed = false;
        activePointerId = null;
        el.classList?.remove("active");
        if (pid !== null) {
          try {
            if (el.releasePointerCapture && el.hasPointerCapture?.(pid)) {
              el.releasePointerCapture(pid);
            }
          } catch (_) {}
        }
        onUp();
      } else if (activePointerId !== null) {
        // Safe cleanup if unpressed but pointer capture remained
        try {
          if (el.releasePointerCapture && el.hasPointerCapture?.(activePointerId)) {
            el.releasePointerCapture(activePointerId);
          }
        } catch (_) {}
        activePointerId = null;
      }
    };

    const reset = () => {
      if (activePointerId !== null) {
        try {
          if (el.releasePointerCapture && el.hasPointerCapture?.(activePointerId)) {
            el.releasePointerCapture(activePointerId);
          }
        } catch (_) {}
      }
      activePointerId = null;
      const wasPressed = isPressed;
      isPressed = false;
      el.classList?.remove("active");
      if (wasPressed) {
        try { onUp(); } catch (_) {}
      }
    };

    if (windowObj && windowObj.PointerEvent) {
      el.addEventListener("pointerdown", press);
      el.addEventListener("pointerup", release);
      el.addEventListener("pointercancel", release);
      el.addEventListener("lostpointercapture", release);
    } else {
      el.addEventListener("touchstart", press, { passive: false });
      el.addEventListener("touchend", release, { passive: false });
      el.addEventListener("touchcancel", release, { passive: false });
      el.addEventListener("mousedown", press);
      el.addEventListener("mouseup", release);
    }

    const controller = {
      id,
      el,
      isPressed: () => isPressed,
      activePointerId: () => activePointerId,
      press,
      release,
      reset,
    };
    buttonControllers.set(id, controller);
    return controller;
  };

  bindTouch("touch-gas", () => wheel?.setTouchButton("gas", true), () => wheel?.setTouchButton("gas", false));
  bindTouch("touch-brake", () => wheel?.setTouchButton("brake", true), () => wheel?.setTouchButton("brake", false));
  bindTouch("touch-drift", () => wheel?.setTouchButton("drift", true), () => wheel?.setTouchButton("drift", false));
  bindTouch("touch-item", () => {
    wheel?.setTouchButton("item", true);
    if (onItemPulse) onItemPulse();
  }, () => wheel?.setTouchButton("item", false));

  // 3. Global Touch Cleanup: Safely Resets Steering and All Registered Button Local States
  const releaseAllTouch = () => {
    try { resetSteer(); } catch (_) {}
    for (const ctrl of buttonControllers.values()) {
      try { ctrl.reset(); } catch (_) {}
    }
    if (wheel) {
      wheel.setTouchSteer(0);
      wheel.setTouchButton("gas", false);
      wheel.setTouchButton("brake", false);
      wheel.setTouchButton("drift", false);
      wheel.setTouchButton("item", false);
    }
    if (root?.querySelectorAll) {
      try {
        root.querySelectorAll(".touch-btn").forEach((b) => b.classList?.remove("active"));
      } catch (_) {}
    }
  };

  // 4. Attach Global Interruption Listeners
  if (windowObj) {
    windowObj.addEventListener("pointercancel", releaseAllTouch);
    windowObj.addEventListener("blur", releaseAllTouch);
    windowObj.addEventListener("pagehide", releaseAllTouch);
  }
  if (root) {
    root.addEventListener("visibilitychange", () => {
      if (root.hidden) releaseAllTouch();
    });
  }

  // 5. Secondary Tap Controls
  const tiltToggle = $("touch-tilt-toggle");
  if (tiltToggle && wheel) {
    addTapListener(tiltToggle, () => {
      wheel.tiltEnabled = !wheel.tiltEnabled;
      tiltToggle.textContent = wheel.tiltEnabled ? "TILT: ON" : "TILT: OFF";
      tiltToggle.classList?.toggle("active", wheel.tiltEnabled);
    });
  }

  const pauseBtn = $("pause-btn");
  if (pauseBtn && onPauseToggle) {
    addTapListener(pauseBtn, onPauseToggle);
  }

  const restartBtn = $("restart");
  if (restartBtn && onRestart) {
    addTapListener(restartBtn, onRestart);
  }

  const menuReturnBtn = $("menu-return");
  if (menuReturnBtn && onMenuReturn) {
    addTapListener(menuReturnBtn, onMenuReturn);
  }

  const resultsMenuBtn = $("results-menu");
  if (resultsMenuBtn && onResultsMenu) {
    addTapListener(resultsMenuBtn, onResultsMenu);
  }

  const manager = {
    releaseAllTouch,
    resetSteer,
    getButton: (id) => buttonControllers.get(id),
    getSteerPointerId: () => steerPointerId,
  };

  if (windowObj) {
    windowObj.__touchControls = manager;
  }

  return manager;
}
