import * as THREE from "three";

/**
 * Dedicated Cinematic Menu Camera System.
 *
 * Operational Capabilities:
 * - Spherical orbital coordinate system with gentle cinematic drift.
 * - Interactive pointer/touch orbit inspection (360-degree rotation around kart/character).
 * - Automatic inertia damping and seamless resumption of slow cinematic tracking.
 * - Dynamic view framing presets tailored to showcase mode (Hub, Driver Close-Up, Kart Details, Settings).
 * - Smooth cinematic transition swooping from showcase camera pose directly into the gameplay chase camera.
 */
export class MenuCamera {
  constructor(camera, canvas = null) {
    this.camera = camera;
    this.canvas = canvas;

    // Center of the showcase turntable
    this.center = new THREE.Vector3(0, 0, 0);
    this.target = new THREE.Vector3(0, 0.85, 0);
    this.currentAim = new THREE.Vector3(0, 0.85, 0);

    // Spherical coordinates
    // radius: distance from target
    // phi: polar angle from +Y zenith (pi/2 is horizontal)
    // theta: azimuthal angle around Y axis
    this.radius = 4.8;
    this.targetRadius = 4.8;

    this.phi = 1.25; // ~71.6 degrees from up (gentle high-angle heroic view)
    this.targetPhi = 1.25;

    this.theta = -0.65; // ~37 degrees front-right 3/4 heroic view
    this.driftSpeed = 0.08; // Radians per second for slow cinematic orbit

    this.targetHeight = 0.85;

    // Interaction state
    this.isDragging = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.dragVelocityTheta = 0;
    this.dragVelocityPhi = 0;
    this.lastInteractionTime = 0;
    this.activePointerId = null;

    // View framing mode
    this.mode = "hub";

    // Gameplay transition state
    this.isTransitioning = false;
    this.transitionStart = 0;
    this.transitionDuration = 1.2;
    this.transitionFromEye = new THREE.Vector3();
    this.transitionFromAim = new THREE.Vector3();
    this.transitionToEye = new THREE.Vector3();
    this.transitionToAim = new THREE.Vector3();
    this.transitionCallback = null;

    if (canvas) {
      this.bindInputs(canvas);
    }
  }

  setTurntableCenter(x, y, z) {
    this.center.set(x, y, z);
    this.target.set(x, y + this.targetHeight, z);
    this.currentAim.copy(this.target);
  }

  setMode(mode) {
    this.mode = mode;
    switch (mode) {
      case "driver":
        // Close-up on driver torso and helmet
        this.targetRadius = 3.6;
        this.targetPhi = 1.32;
        this.targetHeight = 0.1;
        break;
      case "kart":
        // Lower angle showcasing chassis lines, wheels, and spoilers
        this.targetRadius = 4.2;
        this.targetPhi = 1.38;
        this.targetHeight = -0.35;
        break;
      case "settings":
        // Slightly pulled-back cinematic overview
        this.targetRadius = 5.2;
        this.targetPhi = 1.22;
        this.targetHeight = 0.90;
        break;
      case "hub":
      default:
        // Balanced 3/4 heroic view
        this.targetRadius = 4.8;
        this.targetPhi = 1.25;
        this.targetHeight = 0.85;
        break;
    }
  }

  bindInputs(canvas) {
    const onPointerDown = (e) => {
      // Ignore clicks on UI overlays
      if (e.target !== canvas && e.target.id !== "game") return;
      this.isDragging = true;
      this.activePointerId = e.pointerId ?? null;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.dragVelocityTheta = 0;
      this.dragVelocityPhi = 0;
      this.lastInteractionTime = performance.now();
      if (e.target.setPointerCapture && e.pointerId !== undefined) {
        try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
      }
    };

    const onPointerMove = (e) => {
      if (!this.isDragging) return;
      if (this.activePointerId !== null && e.pointerId !== undefined && e.pointerId !== this.activePointerId) return;

      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      // Inverse X drag rotates around kart
      const dTheta = -dx * 0.0065;
      const dPhi = -dy * 0.0045;

      this.theta += dTheta;
      this.phi = THREE.MathUtils.clamp(this.phi + dPhi, 0.92, 1.48);

      this.dragVelocityTheta = dTheta;
      this.dragVelocityPhi = dPhi;
      this.lastInteractionTime = performance.now();
    };

    const onPointerUp = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.activePointerId = null;
      this.lastInteractionTime = performance.now();
      if (e.target.releasePointerCapture && e.pointerId !== undefined) {
        try {
          if (e.target.hasPointerCapture?.(e.pointerId)) {
            e.target.releasePointerCapture(e.pointerId);
          }
        } catch (err) {}
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
  }

  /**
   * Initiates smooth cinematic transition swooping from menu showcase into gameplay grid.
   */
  startTransitionToGameplay(gridEye, gridAim, duration = 1.2, onComplete = null) {
    this.isTransitioning = true;
    this.transitionStart = performance.now();
    this.transitionDuration = duration;
    this.transitionFromEye.copy(this.camera.position);
    this.transitionFromAim.copy(this.currentAim);
    this.transitionToEye.copy(gridEye);
    this.transitionToAim.copy(gridAim);
    this.transitionCallback = onComplete;
  }

  resetToHub() {
    this.isTransitioning = false;
    this.transitionCallback = null;
    this.setMode("hub");
  }

  update(dt, now = performance.now()) {
    if (this.isTransitioning) {
      const elapsed = (now - this.transitionStart) / 1000;
      const rawT = THREE.MathUtils.clamp(elapsed / this.transitionDuration, 0, 1);
      // Smooth cubic ease-in-out curve
      const t = THREE.MathUtils.smoothstep(rawT, 0, 1);

      // Arc lift in the middle of the transition for cinematic sweep feel
      const arcLift = Math.sin(t * Math.PI) * 1.5;

      this.camera.position.lerpVectors(this.transitionFromEye, this.transitionToEye, t);
      this.camera.position.y += arcLift;

      this.currentAim.lerpVectors(this.transitionFromAim, this.transitionToAim, t);
      this.camera.lookAt(this.currentAim);

      if (rawT >= 1) {
        this.isTransitioning = false;
        if (typeof this.transitionCallback === "function") {
          const cb = this.transitionCallback;
          this.transitionCallback = null;
          cb();
        }
      }
      return;
    }

    const step = Math.min(dt, 0.1);

    // Apply inertia or automatic slow cinematic orbit
    if (this.isDragging) {
      // User is actively moving
    } else {
      // Apply remaining drag velocity with exponential decay
      if (Math.abs(this.dragVelocityTheta) > 0.0001) {
        this.theta += this.dragVelocityTheta;
        this.dragVelocityTheta *= Math.exp(-step * 8);
      }
      if (Math.abs(this.dragVelocityPhi) > 0.0001) {
        this.phi = THREE.MathUtils.clamp(this.phi + this.dragVelocityPhi, 0.92, 1.48);
        this.dragVelocityPhi *= Math.exp(-step * 8);
      }

      // Resume subtle orbital drift if inactive for more than 1.5 seconds
      const idleTime = (now - this.lastInteractionTime) / 1000;
      if (idleTime > 1.5) {
        const driftBlend = THREE.MathUtils.clamp((idleTime - 1.5) / 1.0, 0, 1);
        this.theta += this.driftSpeed * step * driftBlend;
      }
    }

    // Smoothly damp radius, polar elevation, and target height toward framing goals
    this.radius += (this.targetRadius - this.radius) * (1 - Math.exp(-step * 6));
    this.phi += (this.targetPhi - this.phi) * (1 - Math.exp(-step * 6));

    const desiredAimY = this.center.y + this.targetHeight;
    this.target.y += (desiredAimY - this.target.y) * (1 - Math.exp(-step * 6));
    this.currentAim.lerp(this.target, 1 - Math.exp(-step * 10));

    // Calculate spherical position relative to center
    const sinPhi = Math.sin(this.phi);
    const cosPhi = Math.cos(this.phi);
    const sinTheta = Math.sin(this.theta);
    const cosTheta = Math.cos(this.theta);

    const eyeX = this.center.x + this.radius * sinPhi * cosTheta;
    const eyeY = this.center.y + this.radius * cosPhi;
    const eyeZ = this.center.z + this.radius * sinPhi * sinTheta;

    this.camera.position.set(eyeX, eyeY, eyeZ);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.currentAim);
  }
}
