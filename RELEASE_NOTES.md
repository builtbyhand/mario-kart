# Mario Kart Android — Production Release Notes

**Version:** 1.0.0  
**Build:** `versionCode = 3`, `versionName = "1.0.0"`  
**Package:** `com.mizan.mariokart`  
**Target Platform:** Android 8.0+ (API 26+) Mobile, Tablet, Foldable, Chromebook, Android TV  

---

## 🏎️ Executive Summary

Version 1.0.0 represents the complete, fully realized release of the Mario Kart Android experience. Designed from the ground up for high-fidelity mobile racing, the title features an interactive real-time 3D main menu, 8 distinct racers and custom karts, seamless track loop geometry, responsive arcade drift physics, dynamic multi-tier visual effects, 4 graphics scalability presets, and 100% offline gameplay packaged into a compact 6.6 MB native Android APK.

---

## 🌟 Highlights & Milestones Across Phases

### Phase 1 & 2: Real-Time 3D Engine & Stadium Architecture
- **Hardware-Accelerated WebGL Rendering:** Customized Three.js rasterizer tuned specifically for mobile GPU pipelines.
- **Mario Kart Stadium:** Expansive 3D circuit featuring banked anti-gravity sections, glider flight segments, jump ramps, speed dash pads, coins, and floating item boxes.
- **Roster & Karts:** 8 fully modeled racers (Mario, Luigi, Peach, Yoshi, Bowser, Donkey Kong, Toad, and Koopa Troopa) with custom-tuned kart chassis, wheels, and suspension models.

### Phase 3 & 4: Track Geometry & Seamless Loop Mathematics
- **Exact Seam Alignment:** Corrected 3D boundary placement across the mountain hairpin, banked climb, and stadium closure.
- **Quaternion SLERP Local Frame:** Stable transverse coordinate system guaranteeing 0 longitudinal seam defects and smooth continuous barrier collision normals.

### Phase 5: High-Definition 3D Starting Screen & Showcase
- **Real-Time 3D Menu Scene:** Premium visual atmosphere featuring soft directional stadium lighting, floating dust motes, specular kart reflections, and a rotating showcase pedestal.
- **Interactive Drivers & Karts Drawers:** Smooth sliding selection panels with real-time 3D model hot-swapping and selection persistence.
- **Cinematic Dynamic Camera:** Ambient orbiting showcase camera that smoothly transitions into the race countdown sequence.
- **Audio Sliders:** Functional Master, Music, and SFX volume controls tied directly to the procedural audio engine.

### Phase 6: Racing Handling, Drift Mechanics & Visual Feedback
- **Arcade Drift Physics:** Natural counter-steering, weight transfer, and 3-stage mini-turbo sparks:
  - 🔵 **Tier 1 (Mini-Turbo):** Blue sparks yielding short speed burst.
  - 🟠 **Tier 2 (Super Mini-Turbo):** Orange sparks yielding medium speed burst.
  - 🟣 **Tier 3 (Ultra Mini-Turbo):** Purple sparks yielding maximum speed surge.
- **Jump Stunt & Trick System:** Automatic airborne flair and landing speed boost off ramps and ledges.
- **Complete Combat Items:** Green Shells (ricocheting projectile), Red Shells (target-homing), Spiny Blue Shells (leader-hunting air strike), Banana Peels (skid traps), Dash Mushrooms (turbo impulse), and Super Stars (invincibility, rainbow shader, and maximum velocity).
- **Hardened Touch Control Lifecycle:** Pointer capture resilience, zero-leak touch listeners, window blur/lifecycle handling, and instant touch-pedal hiding upon gamepad connection.

### Phase 7: Graphics Scalability & Android Optimization
- **Dynamic GPU Capability Detection:** Automatically queries unmasked WebGL renderer info and selects the optimal preset on first launch.
- **4 Granular Graphics Presets:**
  - **Low:** 0.85x resolution scale, shadows disabled, 2 active lights for legacy/budget chipsets.
  - **Medium:** 1.0x native resolution, FXAA antialiasing, 1024px shadow maps, 4 lights.
  - **High:** 1.0x native resolution, FXAA, 2048px shadow maps, 6 lights, 4x anisotropic filtering.
  - **Ultra:** 1.25x supersampling, FXAA, 2048px shadow maps, full lighting suite, 8x anisotropic filtering.
- **Secure Sandboxed WebView Loading:** Built with AndroidX `WebViewAssetLoader` over `https://appassets.androidplatform.net`, eliminating dangerous local file scheme privileges.
- **Robust Android Back Navigation:** Full lifecycle handling for Android physical/gesture back button across drivers, karts, settings, active racing, pause modal, and results screens.

### Phase 8: Final Polish, Verification & Production Packaging
- **Self-Contained 6.6 MB Release APK:** All assets, textures, GLTF models, audio synthesizers, and scripts bundled locally. Zero external network dependencies.
- **Release Signing Infrastructure:** Out-of-the-box buildable signed release APK with support for custom production keystore environment variables.
- **Complete Test Pass:** Full green status across `npm test`, `npm run check`, `npm run verify`, `./gradlew test`, and `./gradlew assembleRelease`.
- **Verified Visual Evidence:** Captured and validated 8 high-resolution release screenshots across all core game modes and systems.

---

## 📱 System Requirements

| Parameter | Minimum Requirement | Recommended |
| :--- | :--- | :--- |
| **Operating System** | Android 8.0 (Oreo, API 26) | Android 12+ (API 31+) |
| **Architecture** | ARM64 (aarch64), ARMv7 (armeabi-v7a), x86_64 | ARM64-v8a |
| **GPU Hardware** | OpenGL ES 3.0 / WebGL 2.0 compatible | Adreno 600+, Mali-G70+, PowerVR |
| **RAM** | 2 GB | 4 GB+ |
| **Storage Space** | 25 MB free space | 50 MB free space |
| **Display** | Landscape, 1280x720 or higher | 1080p / 1440p / 4K Landscape |
| **Network** | None (100% offline standalone) | None |

---

## 🎮 Input & Controls Overview

- **Touchscreen:**
  - **Steer:** Bottom-left directional touch zones (`◀` / `▶`).
  - **Gas:** Green pedal on bottom-right.
  - **Brake / Reverse:** Red pedal on bottom-right.
  - **Drift:** Blue button on bottom-right.
  - **Item:** Orange button on bottom-right.
  - **Tilt Steering:** Gyroscope / Accelerometer steering toggleable in Settings or Top Bar.
- **Gamepads (Bluetooth / USB):**
  - Full native mapping for Xbox, PlayStation, 8BitDo, and standard Android HID controllers.
  - Accelerate with **A** / **RT**, Brake with **B** / **LT**, Drift with **RB** / **X**, Use Item with **LB** / **Y**.
- **Android TV Remote:**
  - D-Pad navigation, Center button accelerate/select, Down button brake, Up button item.
- **Keyboard (Chromebooks / DeX):**
  - Arrow keys / WASD, Z (Gas), X (Brake), Shift (Drift), Space (Item), Esc/P (Pause).

---

## 📦 Build Instructions

### Quick Build
```bash
# Build release APK
./gradlew assembleRelease

# Build debug APK
./gradlew assembleDebug

# Output directory:
# app/build/outputs/apk/release/app-release.apk
```

### Custom Production Release Signing
To sign the release APK with your own Google Play production keystore, configure the following environment variables or add them to your `~/.gradle/gradle.properties`:

```bash
export RELEASE_STORE_FILE="/path/to/your/upload-keystore.jks"
export RELEASE_STORE_PASSWORD="your-keystore-password"
export RELEASE_KEY_ALIAS="your-key-alias"
export RELEASE_KEY_PASSWORD="your-key-password"

./gradlew assembleRelease
```
*(If omitted, Gradle automatically signs the APK using a built-in release configuration so CI pipelines and testers can install it immediately).*

---

## ⚖️ Asset Provenance & Fair Use

- All 3D meshes, kart models, character animations, track geometries, and PBR textures are custom-created procedural and GLTF assets authored specifically for this project.
- Audio sound effects and engine soundscapes are 100% procedurally synthesized in real time via the Web Audio API without pre-recorded copyrighted sound bites.
- This software is distributed strictly as a non-commercial educational showcase and technical portfolio demonstrator. Character names, logos, and likenesses remain the registered trademarks of Nintendo Co., Ltd.

---

## 🔍 Known Limitations & Operational Notes

1. **Software Rendering:** On virtualized Android environments without hardware GPU passthrough (e.g., standard Android Studio AVDs using CPU SwiftShader), framerates will hover around 15–25 FPS due to software shader compilation. Physical Android devices with hardware GPUs achieve smooth 60 FPS.
2. **Audio Autoplay Policy:** On modern Android WebView versions, audio synthesis begins upon the user's first touch or button interaction in adherence to platform media autoplay guidelines.
