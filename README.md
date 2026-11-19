# Mario Kart (Android)

[![Release](https://img.shields.io/github/v/release/mizan989/mario-kart?color=brightgreen&label=Release)](https://github.com/mizan989/mario-kart/releases)
[![Android](https://img.shields.io/badge/Platform-Android%20Mobile%20%7C%20Tablet%20%7C%20TV-blue.svg)](https://github.com/mizan989/mario-kart)
[![Min SDK](https://img.shields.io/badge/Min%20SDK-26%20(Android%208.0)-orange.svg)](https://developer.android.com/about/versions/oreo)
[![Target SDK](https://img.shields.io/badge/Target%20SDK-35%20(Android%2015)-green.svg)](https://developer.android.com)
[![Offline](https://img.shields.io/badge/Network-100%25%20Offline-success.svg)](https://github.com/mizan989/mario-kart)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)](https://github.com/mizan989/mario-kart/actions)

A high-performance 3D Mario Kart racing game engineered specifically for Android devices, including mobile phones, tablets, foldables, Chromebooks, and Android TVs.

- **Game Name:** Mario Kart
- **Package Name:** `com.mizan.mariokart`
- **Version:** `1.0.0` (versionCode `3`)
- **Orientation:** Sensor Landscape (Horizontal form factor)
- **Minimum SDK:** 26 (Android 8.0 Oreo)
- **Target SDK:** 35 (Android 15)
- **Compile SDK:** 36 (Android 16)
- **Release APK Size:** 6.3 MB (Self-contained offline package)
- **Release APK SHA-256 (Local Test Build):** `c62b8a0a628271ff53b31fd2a73317813b77e630bcecf25cc19e435aec1d3c91`

---

## 📸 Headless Visual Regression Captures (1280 × 720 HD Landscape)

> [!NOTE]
> The screenshots below are headless visual regression captures rendered at 1280 × 720 via Chromium SwiftShader using the project's automated capture tool (`scripts/capture-release-screenshots.js`). They validate visual presentation, shaders, PBR materials, responsive UI overlays, and HUD styling. Gameplay mechanics (touch lifecycle, physics, barrier collision, loop closure) are verified separately by automated unit and integration suites.

| 1. High-Definition 3D Main Menu | 2. Character Showcase Pedestal |
| :---: | :---: |
| ![Main Menu](docs/screenshots/release/01_main_menu.png) | ![Character Showcase](docs/screenshots/release/02_character_showcase.png) |
| **3. Kart Customization Showcase** | **4. Scalable Graphics Settings** |
| ![Kart Showcase](docs/screenshots/release/03_kart_showcase.png) | ![Graphics Settings](docs/screenshots/release/04_graphics_settings.png) |
| **5. Racing Gameplay & Drift Action** | **6. Third-Person Chase Camera** |
| ![Gameplay Action](docs/screenshots/release/05_gameplay_action.png) | ![Camera Chase](docs/screenshots/release/06_camera_chase.png) |
| **7. Touch HUD Overlay** | **8. Race Completion Standings** |
| ![HUD and Controls](docs/screenshots/release/07_hud_and_controls.png) | ![Race Results](docs/screenshots/release/08_race_finish_results.png) |

---

## 📥 Download & Installation

### Official Releases
Tagged release builds are published on [GitHub Releases](https://github.com/mizan989/mario-kart/releases):
- Existing release: [Mario Kart APK v0.2](https://github.com/mizan989/mario-kart/releases/tag/v0.2)
- Version 1.0.0 releases: Tagged releases are built and published by `.github/workflows/release.yml` once production signing credentials are authenticated.

### Installing a Local Release Build via ADB
You can build and install the release APK directly to a connected Android device or emulator:
```bash
./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

---

## 🔐 Release Signing Configuration

The project implements a dedicated release signing configuration in `app/build.gradle.kts` and does **not** depend on the Android debug certificate for release builds:

1. **Production Signing:**
   Configured via environment variables or Gradle properties:
   - `RELEASE_STORE_FILE` (path to production `.jks` / `.keystore`)
   - `RELEASE_STORE_PASSWORD`
   - `RELEASE_KEY_ALIAS`
   - `RELEASE_KEY_PASSWORD`
   In GitHub Actions (`.github/workflows/release.yml`), the release workflow checks for these secrets, decodes `RELEASE_KEYSTORE_BASE64`, builds the release variant, verifies the signature with `apksigner`, and aborts if production credentials are missing.

2. **Local Test-Release Signing:**
   When production signing credentials are not present locally, Gradle automatically creates and uses an uncommitted local test-release keystore (`CN=Mario Kart Local Test Release, OU=QA Test, O=Mario Kart Project, C=US`, alias `mariokart-test-release`) stored in `build/signing/`. This produces an installable test APK for developers without claiming production signing or relying on the debug key.

3. **Signature Verification (`apksigner`):**
   ```bash
   apksigner verify --verbose --print-certs app/build/outputs/apk/release/app-release.apk
   ```
   - Scheme: Verified using APK Signature Scheme v2.
   - Debug Certificate Status: Confirmed **not** signed with the Android debug certificate (`CN=Android Debug`).

---

## 🎮 Game Features

- **Real-Time 3D Engine & Physics:**
  - Built with custom hardware-rasterized Three.js WebGL rendering optimized for 60 FPS on mobile GPUs.
  - **8 Playable Racers:** Mario, Luigi, Peach, Yoshi, Bowser, Donkey Kong, Toad, and Koopa Troopa.
  - **Mario Kart Stadium:** Complete 3D track featuring anti-gravity banked curves, glider flight zones, jump ramps, boost pads, coins, and mystery item boxes.
  - **Authentic Drift System:** Charge mini-turbo sparks while cornering through 3 tiers:
    - 🔵 **Mini-Turbo (Blue sparks)**
    - 🟠 **Super Mini-Turbo (Orange sparks)**
    - 🟣 **Ultra Mini-Turbo (Purple sparks)**
  - **Full Item Arsenal:** Green Shell (ricochet), Red Shell (homing), Spiny Blue Shell (1st-place tracker), Banana Peel (rear hazard), Dash Mushroom (burst boost), and Super Star (invincibility & rainbow aura).
  - **Competitive AI:** 8-racer field with rubber-banding, racing line intelligence, and strategic weapon deployment.

- **High-Definition 3D Starting Screen & Showcase:**
  - Interactive real-time 3D menu scene with orbital camera, stadium spotlights, and particle dust motes.
  - Character and Kart selection drawers with real-time 3D model hot-swapping and persistence.
  - Direct audio controls for Master, Music, and SFX volume sliders.

- **Offline Procedural Audio:**
  - 100% offline procedural Web Audio synthesizer (no large audio downloads or missing codecs).
  - Dynamic multi-oscillator engine synthesizer with real-time speed and RPM pitch modulation.
  - Sound effects for drift sparks, turbo release whoosh, shell ricochets, explosions, item roulette chime, and victory fanfares.

- **Native Android Hardware Integration:**
  - **Haptic Vibration Feedback:** Native haptics via Android `Vibrator` / `VibratorManager` on kart collisions, rocket starts, drift boosts, and shell impacts.
  - **Sticky Immersive Fullscreen:** Automatically hides Android system navigation and status bars for uninterrupted gameplay.
  - **Android TV & Leanback Support:** Declares Android TV leanback launcher banners (`tv_banner.png`) and fully maps Android TV remote D-pads and gamepad controllers.
  - **Hardened Touch Control Lifecycle:** Pointer capture, touch cancellation, window blur handling, and auto-hiding when a physical gamepad is connected.
  - **Robust Android Back Navigation:** Full lifecycle handling for Android physical/gesture back button across drivers, karts, settings, active racing, pause modal, and results screens.

---

## ⚙️ Graphics Settings & Scalability

The game includes automatic WebGL GPU capability detection and 4 selectable quality presets in the Settings menu:

| Preset | Resolution Scale | Shadows | Max Lights | Antialiasing | Anisotropic | Target Hardware |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Low** | 0.85x | Disabled | 2 | None | 1x | Older devices, entry-level phones |
| **Medium** | 1.0x | 1024px | 4 | FXAA | 2x | Mid-range devices |
| **High** | 1.0x | 2048px | 6 | FXAA | 4x | Flagship phones, modern tablets |
| **Ultra** | 1.25x | 2048px | All (8+) | FXAA | 8x | High-end gaming devices, Apple Silicon / Snapdragons |

---

## 🕹️ Controls Guide

### 1. Android Mobile & Tablets (Touchscreen)
Touch controls automatically activate when racing on a touchscreen device:
- **Steer Left / Right (`◀` / `▶`):** Pedals on the bottom left.
- **Gas / Accelerate (`GAS`):** Large green pedal on the bottom right.
- **Brake / Reverse (`BRAKE`):** Red pedal on the bottom right.
- **Drift (`DRIFT`):** Blue button on the bottom right (hold into turns to charge sparks, release for turbo boost).
- **Use Item (`ITEM`):** Glowing orange button on the bottom right.
- **Tilt Steering (`TILT`):** Toggle tilt steering on/off to steer by rotating your device like a steering wheel.
- **Pause (`⏸ PAUSE`):** Top bar button to pause and resume.

### 2. Android TV Remote & Gamepads (Bluetooth / USB)
The game detects connected gamepads and TV remotes, hiding on-screen touch pedals automatically:

| Action | Gamepad (Xbox / PlayStation / Generic) | Android TV Remote |
| :--- | :--- | :--- |
| **Steer** | Left Analog Stick / D-Pad Left & Right | D-Pad Left / Right |
| **Accelerate (Gas)** | **A** (South) / Right Trigger (**RT / R2**) | D-Pad Center / Enter |
| **Brake / Reverse** | **B** (East) / Left Trigger (**LT / L2**) | D-Pad Down |
| **Drift (Mini-Turbo)** | Right Bumper (**RB / R1**) / **X** (West) | — |
| **Use Item** | Left Bumper (**LB / L1**) / **Y** (North) | D-Pad Up |
| **Pause Game** | **Start** / Menu button | Back button |
| **Menu Confirm** | D-Pad + **A** button | D-Pad + Center / Enter |

### 3. Keyboard (Chromebook / Emulator / Debug)
- **Steer:** `←` / `→` or `A` / `D`
- **Gas:** `Z` or `↑` or `W`
- **Brake / Reverse:** `X` or `↓` or `S`
- **Drift:** `Shift` (Left or Right)
- **Item:** `Space`
- **Pause:** `Escape` or `P`

---

## 🧪 Testing Matrix & Verification

### Automated Test Suites
1. **JavaScript Unit Tests (`npm test`):**
   - 91 tests verifying track mathematics, 3D barrier Euclidean seams, quaternion SLERP frame, kart acceleration curves, counter-steer line modulation, suspension squat/dive dynamics, touch input pointer capture/blur recovery, GLB asset parsing, bone rigs, animations, post-processing lifecycle, and GPU capability detection.
2. **JavaScript Syntax Check (`npm run check`):**
   - Full AST syntax validation of all runtime game scripts.
3. **Kotlin Unit Tests (`./gradlew test`):**
   - Android native bridge, WebAppInterface, activity lifecycle, and input dispatching tests.
4. **Visual Regression Verification (`npm run verify`, `scripts/capture-release-screenshots.js`):**
   - Headless Chromium verification across 48 asset captures (karts, tracks, menus, HUD).
5. **Android 17 / API 37 AVD Navigation Suite (`scripts/verify-back-navigation-avd.js`):**
   - Automated testing of physical/gesture back button handling across all 7 UI navigation states.

### Physical-Device Testing (Requires Physical Hardware)
The following requirements cannot be reliably validated inside headless CI or CPU-emulated Android AVDs and require verification on physical Android devices:
- Sustained 60 FPS frame rate on physical mobile GPUs (e.g. Snapdragon Adreno, ARM Mali, Google Tensor).
- Multi-touch responsiveness and capacitive touch latency.
- Physical device gyroscope and accelerometer tilt steering calibration across diverse form factors.

---

## 🛠️ Building & Testing from Source

### Prerequisites
- JDK 17 or higher
- Android SDK with Build-Tools `36.0.0`, `compileSdk = 36`, and `targetSdk = 35`
- Node.js 18+ (for running JS unit test suites)

### Build Commands
```bash
# Clone the repository
git clone https://github.com/mizan989/mario-kart.git
cd mario-kart

# Build signed Release APK
./gradlew assembleRelease

# Build Debug APK
./gradlew assembleDebug

# Output APKs:
# app/build/outputs/apk/release/app-release.apk (Release)
# app/build/outputs/apk/debug/app-debug.apk (Debug)
```

### Verification & Test Suite
```bash
# Run JS unit tests (track math, geometry, camera, physics, menus)
npm test

# Run JS syntax check
npm run check

# Run full visual regression and asset verification
npm run verify

# Run Kotlin unit tests
./gradlew test
```

---

## 📄 License & Attribution

This project is developed for educational and portfolio demonstration purposes.
- All 3D models, textures, animations, and shaders are custom procedural/authored assets.
- All audio is generated procedurally via the Web Audio API.
- Mario Kart and associated character names and likenesses are copyright and registered trademarks of Nintendo Co., Ltd.

For detailed release history and technical milestones across all development phases, consult [RELEASE_NOTES.md](RELEASE_NOTES.md).
