# Mario Kart (Android)

[![Release](https://img.shields.io/github/v/release/mizan989/mario-kart?color=brightgreen&label=Release)](https://github.com/mizan989/mario-kart/releases)
[![Android](https://img.shields.io/badge/Platform-Android%20Mobile%20%7C%20Tablet%20%7C%20TV-blue.svg)](https://github.com/mizan989/mario-kart)
[![Min SDK](https://img.shields.io/badge/Min%20SDK-26%20(Android%208.0)-orange.svg)](https://developer.android.com/about/versions/oreo)
[![Target SDK](https://img.shields.io/badge/Target%20SDK-36%20(Android%2016)-green.svg)](https://developer.android.com)

A high-performance 3D Mario Kart racing game engineered specifically for Android devices, including mobile phones, tablets, Chromebooks, and Android TVs.

- **Game Name:** Mario Kart
- **Package Name:** `com.mizan.mariokart`
- **Orientation:** Sensor Landscape (Horizontal form factor)
- **Minimum SDK:** 26 (Android 8.0 Oreo)
- **Target SDK:** 36 (Android 16)

---

## 📥 Download & Install

Download the latest signed APK directly from the [GitHub Releases](https://github.com/mizan989/mario-kart/releases):

- **[Download Mario Kart APK (v0.1)](https://github.com/mizan989/mario-kart/releases/download/v0.1/MarioKart-v0.1.apk)**

Or install via ADB:
```bash
adb install -r MarioKart-v0.1.apk
```

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

- **Offline Procedural Audio:**
  - 100% offline procedural Web Audio synthesizer (no large audio downloads or missing codecs).
  - Dynamic multi-oscillator engine synthesizer with real-time speed and RPM pitch modulation.
  - Sound effects for drift sparks, turbo release whoosh, shell ricochets, explosions, item roulette chime, and victory fanfares.

- **Native Android Hardware Integration:**
  - **Haptic Vibration Feedback:** Native haptics via Android `Vibrator` / `VibratorManager` on kart collisions, rocket starts, drift boosts, and shell impacts.
  - **Sticky Immersive Fullscreen:** Automatically hides Android system navigation and status bars for uninterrupted gameplay.
  - **Android TV & Leanback Support:** Declares Android TV leanback launcher banners (`tv_banner.png`) and fully maps Android TV remote D-pads and gamepad controllers.
  - **Intelligent Touch Controls:** On-screen controls automatically appear **only** when the race starts and hide during menus, pauses, or when a physical gamepad is detected.

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

## 🛠️ Building from Source

### Prerequisites
- JDK 17 or higher
- Android SDK with Build-Tools `36.0.0` and API Level `36`

### Build Commands
```bash
# Clone the repository
git clone https://github.com/mizan989/mario-kart.git
cd mario-kart

# Build signed Release APK
./gradlew assembleRelease

# Build Debug APK
./gradlew assembleDebug
```

Outputs:
- **Release APK:** `app/build/outputs/apk/release/app-release.apk`
- **Debug APK:** `app/build/outputs/apk/debug/app-debug.apk`

---

## 🚀 Automated GitHub Releases

This repository includes a GitHub Actions workflow (`.github/workflows/release.yml`) configured to automatically build and release the APK whenever a version tag is pushed:

```bash
git tag v0.1
git push origin v0.1
```
The workflow will compile the release APK, sign it, create a new GitHub Release with changelog notes, and attach the APK file.

---

## 📄 License
This project is for educational and personal portfolio purposes. All character names and likenesses are copyright and trademarks of Nintendo.
