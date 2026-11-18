# Mario Kart Android — Architecture Overview & Technical Baseline

**Version:** 0.2 (Phase 1 Baseline & Review Correction)  
**Platform:** Android (Min SDK 26, Target SDK 35, Compile SDK 36)  
**Orientation:** Sensor Landscape  
**Architecture:** Three.js / WebGL hardware-rasterized engine hosted within an Android `WebView`, bound to native Kotlin via `AndroidBridge`.

---

## 1. Game Initialization & Startup Flow

```
[Android App Launch]
        │
        ▼
[MainActivity.onCreate] ──► Configure cutout (short edges), fullscreen immersive, keep-screen-on
        │
        ▼
[Hardware-Accelerated WebView Setup]
        │
        ├─► JavaScript enabled, DomStorage, Hardware layer type
        ├─► Register JavascriptInterface ("AndroidBridge")
        ├─► Enforce MIXED_CONTENT_NEVER_ALLOW security setting
        └─► Load "file:///android_asset/game/index.html"
                │
                ▼
        [index.html Execution]
                ├─► Inline early error listener catches bootstrapping failures
                ├─► Importmap resolves three.js bundle & vendor extensions
                └─► Imports and executes "game.js" (ES Module)
                        │
                        ▼
                [game.js Setup]
                        ├─► Registers unhandled rejection & global error logging
                        ├─► Initializes Centralized Config (RENDER_CONFIG, QUALITY_PRESETS)
                        ├─► Sets up WebGLRenderer, Scene, Fog, PMREM RoomEnvironment
                        ├─► Sets up Camera, Directional & Track Spotlight rigs
                        ├─► Loads UI icon portraits & roulette reels
                        ├─► Instantiates Race (Logic) & constructs procedural karts
                        ├─► Sets up Touch / Gamepad / Sensor Input (WheelInput)
                        ├─► Enters Ready Menu State (showing driver selection & lap selector)
                        └─► Starts requestAnimationFrame render/update loop
```

---

## 2. Rendering Pipeline & Quality Preset Mapping

- **Engine:** Three.js r186 (bundled offline in `app/src/main/assets/game/vendor/three/three.module.js`).
- **Surface:** Hardware-accelerated `<canvas id="game">` with WebGL 2.0 context.
- **Tone Mapping:** `THREE.NeutralToneMapping` with exposure 1.05 for natural color reproduction.
- **Lighting & Atmosphere:**
  - Ambient Hemisphere light (`#a5c8f4` sky / `#34384a` ground).
  - Main Key Directional light with PCF soft shadows (toggled conditionally by quality preset).
  - Fill light (`#77baff`) and 5 bank spotlights tracking key track curvatures.
  - Custom atmospheric shader sky dome (`atmosphere.js`) with dynamic searchlight beams.

### Quality Configuration: Operational vs. Architectural Targets

The `QUALITY_PRESETS` in `config.js` (`low`, `medium`, `high`, `ultra`) serve two distinct roles:

1. **Wired & Operational in Phase 1:**
   - `maxPixelRatio`: Clamps `renderer.setPixelRatio(...)` (e.g., 1.3 on mobile/TV, 1.6 on high/desktop). This mitigates excessive fillrate overhead on high-DPI smartphone displays, though actual frame rate depends on device GPU performance, thermal state, and browser process overhead (presets do not guarantee an unconditional 60 FPS).
   - `shadows`: Controls `renderer.shadowMap.enabled` and directional light shadow casting (`key.castShadow`). Disabled on mobile by default.
   - `antialias`: Configures WebGL anti-aliasing on the canvas context.
   - `toneMappingExposure`, `fog`, `camera`, and `clearColor`: Directly applied to Three.js scene parameters.
2. **Architectural Targets (Deferred to Later Phases):**
   - `particleLimit`: Defined in presets (300 to 1800) as the target budget for Phase 6 particle scaling. In Phase 1, `raceEffects.js` operates with a fixed internal buffer pool (1200 particles).
   - `shadowMapSize`: Defined in presets (512 to 2048). Directional light shadow map currently defaults to 1024 when shadows are enabled.
   - `useBloom`: Post-processing bloom is currently gated via URL parameter `?post=1`; dynamic pass injection belongs to Phase 6 visual polish.
   - `anisotropy`: Defined in presets (1 to 16); texture loader currently uses baseline anisotropy 8.
   - `ASSET_REGISTRY`: Establishes the registration and provenance tracking schema for external GLB/glTF asset packages in Phases 2–4; in Phase 1, all karts are generated via procedural meshes.

---

## 3. Game Physics & Simulation Loop

- **Decoupled Architecture:** `logic.js` is pure ECMAScript with zero DOM, WebGL, or browser dependencies, allowing deterministic unit testing on local JVM and Node.js.
- **Fixed Timestep Accumulator:**
  - Simulation runs at fixed `FIXED_DT = 1 / 120` second (120 Hz) for consistent physics, collision resolution, and draft slipstreaming.
  - Variable frame delta `dt` is accumulated in `Race.prototype.update(dt, input)`:
    ```javascript
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator >= FIXED_DT) {
      this.step(FIXED_DT, input);
      this.accumulator -= FIXED_DT;
    }
    ```
- **Racer Field:** 8 concurrent karts (1 human player + 7 autonomous CPU racers).
- **AI Behavior:** Pure pursuit steering with look-ahead projection along track surface ribbons, lane wandering, dynamic rubber-banding, and strategic weapon deployment.
- **Drift Mechanics:** 3-tier mini-turbo spark system (Blue Mini-Turbo, Orange Super Mini-Turbo, Purple Ultra Mini-Turbo) accumulating charge during sustained counter-steering.

---

## 4. Track Construction & Surface Mathematics

- **Coordinate System:** Traced 3D spline loop with continuous Catmull-Rom curvature interpolation in `track.js`.
- **Measured Surface Ribbon (`surface-track.js` & `surface-mesh.js`):**
  - Generates 3D frames with tangent vectors, surface normal vectors, right-vector cross products, and localized track banking angles.
  - Tracks specific racing zones: Anti-gravity sections (vertical bank angles) and Glider launch ramps / flight envelopes.
- **Pickup Pools:** Resettable coin and mystery item box arrays anchored to track geometry normals. In Phase 1, `syncPickupPools()` is tied into `constructRace()` to ensure visual meshes synchronize cleanly across race restarts.

---

## 5. Kart Models & Visuals

- **Model System (`models.js` & `model-spec.js`):**
  - Procedural stylized kart assembly combining lathe geometries for tires, torus rims, chassis rounded boxes, exhausts, steering columns, and driver silhouettes.
  - Rigged steering wheel rotations, wheel-spin rolling rotations, and anti-gravity wheel hover animations.
  - Procedural delta-wing glider (`makeGlider`) deploying on flight ramp jumps.
- **Asset Pack Extensibility (`loadKartPack`):**
  - Designed for GLTF/GLB asset loading in subsequent development phases, with automatic procedural fallback.

---

## 6. Camera System

- **Third-Person Chase Camera:**
  - Evaluated in `visual-frame.js`, `driver-camera-anchor.js`, and `chase-clearance.js`.
  - Dynamically anchors behind player kart along the surface tangent and normal vectors.
  - Dynamic pitch, roll, and elevation smoothing with look-ahead targeting.
- **Scenery Occlusion & Collision:**
  - `camera-collision.js` performs raycasted boundary tests against scenery bounding volumes to prevent camera clipping through walls, archways, and underpasses.

---

## 7. Input Architecture & Control Schemes

Managed through `input.js` (`WheelInput`) and `MainActivity.kt` with discrete state slices (`touchButtons`, `nativeButtons`, `gamepadButtons`):

1. **Touch Controls (Landscape Mobile):**
   - Left cluster: Left/Right directional steering pedals + Gyro/Tilt toggle.
   - Right cluster: Gas pedal (accelerate), Brake pedal (reverse), Drift button, Item trigger.
   - Handled via Pointer Events (`pointerdown`, `pointerup`, `pointercancel`, `lostpointercapture`) with pointer capture and release-on-blur safety.
2. **Device Gyro / Accelerometer (Tilt Steering):**
   - Native Android `SensorEventListener` reads `Sensor.TYPE_ACCELEROMETER`.
   - Dispatches sideways roll to JavaScript `window.onNativeSensorOrientation(roll, pitch)`.
   - Normalized in `WheelInput` with deadzone (0.08) and 28° full lock sensitivity.
3. **Gamepad & Android TV Remote:**
   - Native Android `dispatchGenericMotionEvent` & `dispatchKeyEvent` dispatch state to `window.onNativeGamepadInput(json)`.
   - Browser Gamepad API (`navigator.getGamepads()`) polled as a secondary source.
   - Button press and release events update dedicated state slices, preventing stuck inputs across controller disconnects or trigger releases.

---

## 8. Android-to-JavaScript Bridge API

- **Production Utilities:** `InputBridgeUtils` companion object in `MainActivity.kt` provides testable, verified JSON serialization (`formatGamepadJson`), sensor math (`computeRollDegrees`, `computePitchDegrees`), and waveform parsing (`parseVibrationPattern`).
- **Namespace:** `window.AndroidBridge`
  - `isTv(): Boolean` — Returns `true` if executed on Android TV / Leanback environment.
  - `vibrate(durationMs: Long)` — Triggers single-shot haptic rumble.
  - `vibratePattern(patternJson: String)` — Triggers multi-cadence haptic waveforms.
  - `exitGame()` — Gracefully closes the host Activity.
- **Downstream Callbacks:**
  - `window.onNativeGamepadInput(data)` — High-frequency gamepad axis & button updates.
  - `window.onNativeSensorOrientation(roll, pitch)` — Real-time accelerometer steering.
  - `window.onAndroidConfirm()` — Controller "A" / TV "Enter" menu confirmations.

---

## 9. Audio Engine

- **Architecture:** Offline procedural Web Audio Synthesizer in `audio-engine.js` and `audio.js`.
- **Zero Remote Dependencies:** Does not require external audio downloads or network access.
- **Dynamic Synthesizers:**
  - Dynamic oscillator engine pitch-shifted in real time according to kart speed and acceleration.
  - Real-time synthesized audio cues for countdown beeps, item roulette chime, drift mini-turbos, rocket starts, spinouts, and race fanfares.

---

## 10. WebView Security Configuration & Asset Loading Risks

### 10.1 Existing Configuration & Risk Analysis
- **File Access (`allowFileAccess = true`):**
  - *Risk:* Historically enabled to allow `WebView` to load assets via `file:///android_asset/`. However, `allowFileAccess = true` permits access to the underlying filesystem if user-supplied URLs or redirect vulnerabilities are introduced.
  - *Mitigation in Phase 1:* The WebView is strictly locked to load only `file:///android_asset/game/index.html`. External URL navigation is disabled in `WebViewClient`.
- **Mixed Content (`MIXED_CONTENT_NEVER_ALLOW`):**
  - *Correction:* Previously set to `MIXED_CONTENT_ALWAYS_ALLOW`, which allowed insecure HTTP content. In Phase 1 this has been hardened to `MIXED_CONTENT_NEVER_ALLOW`. Because the game is 100% offline and packaged locally, no mixed content is permitted.
- **WebSQL Deprecation (`databaseEnabled`):**
  - *Correction:* Removed deprecated `databaseEnabled = true` setting, which was obsolete and flagged as deprecated in modern Android SDKs.

### 10.2 Recommended Safe Approach for Bundled Assets
For subsequent development phases where remote/cloud asset fetching may be explored, the recommended Android architecture is:
- **`androidx.webkit.WebViewAssetLoader`:**
  - Intercepts requests using standard, secure HTTPS virtual domains (e.g. `https://appassets.androidplatform.net/assets/game/index.html`).
  - Allows disabling `allowFileAccess = false` and `allowContentAccess = false` completely.
  - Enforces Same-Origin Policy (SOP) and CORS standards identical to modern web browsers, eliminating `file://` origin isolation caveats.
  - *Note on Scope:* To prevent breaking existing working relative imports and path mappings during Phase 1 stabilization, `file:///android_asset/` is retained with hardened settings; migration to `WebViewAssetLoader` is cataloged for subsequent asset pipeline phases.

---

## 11. Identified Architectural Limitations & Future Roadmap

1. **Procedural Geometry vs. Stylized 3D Assets:** Current karts and drivers are assembled from basic procedural Three.js primitives. Phase 2–4 will introduce high-definition, legally clean stylized GLB models sourced online or processed via cloud.
2. **Dynamic Lighting:** Real-time shadow maps are disabled on mobile by default to preserve battery and frame rate; future phases can leverage optimized baked lightmaps and mobile-friendly vertex lighting.
3. **Track Variety:** Currently hosts "Mario Kart Stadium" surface track; the modular `surface-track.js` foundation is ready for multi-track extensions.
