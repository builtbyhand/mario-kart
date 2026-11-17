import { clamp } from "./track.js";

/**
 * High quality Android Input Manager for Mario Kart.
 * Handles:
 * 1. Mobile on-screen touch controls (horizontal / landscape)
 * 2. Mobile device tilt / accelerometer steering (optional gyro wheel mode)
 * 3. Android TV remote / D-Pad controls
 * 4. Gamepad / Controller (Xbox, PlayStation, Android Gamepad)
 * 5. Keyboard input (Chromebooks, emulators, debug)
 */
export class WheelInput {
  constructor({ invert = false } = {}) {
    this.invert = invert;
    this.tiltEnabled = false;
    this.steer = 0;
    this.buttons = {
      gas: false,
      brake: false,
      drift: false,
      item: false,
    };
    this.touchSteer = 0;
    this.tiltSteer = 0;
    this.keySteer = 0;
    this.gamepadSteer = 0;
    this.armed = true;
    this.status = "Touch or tilt to steer";
    this.lastItemTrigger = false;

    // Listen to native bridge events if available
    if (typeof window !== "undefined") {
      window.onNativeGamepadInput = (data) => {
        if (!data) return;
        if (typeof data.steer === "number") this.gamepadSteer = clamp(data.steer, -1, 1);
        if (typeof data.gas === "boolean") this.buttons.gas = data.gas;
        if (typeof data.brake === "boolean") this.buttons.brake = data.brake;
        if (typeof data.drift === "boolean") this.buttons.drift = data.drift;
        if (typeof data.item === "boolean") this.buttons.item = data.item;
      };

      window.onNativeSensorOrientation = (gamma, beta) => {
        // In landscape, gamma is roll / tilt (-90 to +90)
        if (!this.tiltEnabled) return;
        const angle = clamp(gamma || 0, -45, 45);
        const normalized = angle / 28; // reaches full steer around 28 degrees
        const deadzone = 0.08;
        if (Math.abs(normalized) < deadzone) {
          this.tiltSteer = 0;
        } else {
          this.tiltSteer = clamp(
            (normalized > 0 ? normalized - deadzone : normalized + deadzone) / (1 - deadzone),
            -1,
            1
          ) * (this.invert ? -1 : 1);
        }
      };
    }
  }

  reset() {
    this.steer = 0;
    this.touchSteer = 0;
    this.tiltSteer = 0;
    this.keySteer = 0;
    this.gamepadSteer = 0;
    this.buttons = { gas: false, brake: false, drift: false, item: false };
    this.armed = true;
    this.status = "Ready";
  }

  release() {
    this.reset();
  }

  setTouchSteer(val) {
    this.touchSteer = clamp(val, -1, 1);
  }

  setTouchButton(name, pressed) {
    if (this.buttons.hasOwnProperty(name)) {
      this.buttons[name] = Boolean(pressed);
    }
  }

  pollGamepad() {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (!gp || !gp.connected) continue;

      // Analog stick X
      let steer = 0;
      if (gp.axes && gp.axes.length > 0) {
        const ax = gp.axes[0];
        if (Math.abs(ax) > 0.15) {
          steer = ax;
        }
      }

      // D-pad Left (button 14) / Right (button 15)
      if (gp.buttons) {
        if (gp.buttons[14]?.pressed) steer = -1;
        if (gp.buttons[15]?.pressed) steer = 1;

        // Accelerate: Button A (0) or RT / R2 (7)
        const gasPressed = Boolean(gp.buttons[0]?.pressed || (gp.buttons[7]?.value > 0.2));
        // Brake / Reverse: Button B (1) or LT / L2 (6)
        const brakePressed = Boolean(gp.buttons[1]?.pressed || (gp.buttons[6]?.value > 0.2));
        // Drift: RB / R1 (5) or Button X (2)
        const driftPressed = Boolean(gp.buttons[5]?.pressed || gp.buttons[2]?.pressed);
        // Item: LB / L1 (4) or Button Y (3)
        const itemPressed = Boolean(gp.buttons[4]?.pressed || gp.buttons[3]?.pressed);

        this.gamepadSteer = steer;
        if (gasPressed) this.buttons.gas = true;
        if (brakePressed) this.buttons.brake = true;
        if (driftPressed) this.buttons.drift = true;
        if (itemPressed) this.buttons.item = true;
      }
      break;
    }
  }

  read(now) {
    this.pollGamepad();

    // Composite steering from gamepad, tilt, touch buttons, and keys
    let combinedSteer = this.touchSteer;
    if (Math.abs(this.gamepadSteer) > 0.05) {
      combinedSteer = this.gamepadSteer;
    } else if (this.tiltEnabled && Math.abs(this.tiltSteer) > 0.05) {
      combinedSteer = this.tiltSteer;
    } else if (Math.abs(this.keySteer) > 0.05) {
      combinedSteer = this.keySteer;
    }

    this.steer = clamp(combinedSteer, -1, 1);

    const itemTriggered = this.buttons.item;
    const pulseItem = itemTriggered && !this.lastItemTrigger;
    this.lastItemTrigger = itemTriggered;

    return {
      steer: this.steer,
      gas: this.buttons.gas,
      brake: this.buttons.brake,
      drift: this.buttons.drift,
      item: pulseItem || itemTriggered,
      live: true,
      status: this.status,
    };
  }
}
