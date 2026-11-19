# Phase 7 — Performance Benchmark & Complexity Profile

**Date:** 2026-11-19T06:18:54.589Z
**Environment:** Linux x86_64 Headless Chrome (SwiftShader ANGLE WebGL2 Software Rasterizer)
**Screen Resolution:** 1280x720 (Landscape)

> **IMPORTANT METHODOLOGY & INTERPRETATION NOTE:**
> SwiftShader is a CPU software rasterizer utilized for automated headless CI verification and scene validation. Its frame times (~2000–3500 ms / ~0.3–0.5 FPS) represent CPU-bound software emulation throughput and **must NOT be interpreted as physical Android GPU frame rates** or proof of 30/60 FPS achievement. The empirical metrics below validate scene complexity scaling (draw calls, triangles, active geometries, and texture allocations) across presets.

## Preset Complexity Measurements

| Preset | Load Time | Menu FPS | Racing FPS | Samples | Measurement Window | Mean Frame Time | P95 Frame Time | Draw Calls | Triangles | Complexity Tier |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **LOW** | 20270 ms | 0.4 | 0.6 | 1 | 6002 ms | 1683.3 ms | 1683.3 ms | 349 | 9,71,304 | Low-end GPU Fallback (No Shadows) |
| **MEDIUM** | 16124 ms | 0.3 | 0.2 | 1 | 6003 ms | 4099.9 ms | 4099.9 ms | 597 | 23,35,776 | Balanced Mobile/TV (1024 PCF Shadows) |
| **HIGH** | 21573 ms | 0.3 | 0.3 | 1 | 6002 ms | 2949.9 ms | 2949.9 ms | 612 | 23,35,791 | Full Desktop/HD (Post-Processing & FX) |
| **ULTRA** | 23205 ms | 0.3 | 0.3 | 1 | 6003 ms | 3299.9 ms | 3299.9 ms | 612 | 23,35,791 | Full Desktop/HD (Post-Processing & FX) |

## Memory and Texture Profiles

### LOW
- **Resolution Scale:** 0.85
- **Max Pixel Ratio:** 1
- **Shadows:** Disabled
- **Particle Budget:** 300
- **Active Geometries:** 391
- **Active Textures:** 78

### MEDIUM
- **Resolution Scale:** 1
- **Max Pixel Ratio:** 1.3
- **Shadows:** Enabled (PCF)
- **Particle Budget:** 600
- **Active Geometries:** 441
- **Active Textures:** 105

### HIGH
- **Resolution Scale:** 1
- **Max Pixel Ratio:** 1.6
- **Shadows:** Enabled (PCF)
- **Particle Budget:** 1200
- **Active Geometries:** 442
- **Active Textures:** 118

### ULTRA
- **Resolution Scale:** 1
- **Max Pixel Ratio:** 2
- **Shadows:** Enabled (PCF)
- **Particle Budget:** 1800
- **Active Geometries:** 442
- **Active Textures:** 118

## Android Emulator Device Testing Record

*Tested on available local Android Virtual Device (AVD).*

- **Device Profile:** Medium Phone (`Medium_Phone_API_37.0`)
- **OS Version:** Android 17 (API Level 37)
- **Architecture:** x86_64 with KVM hardware acceleration
- **Display Resolution:** 2400 x 1080 (Landscape), 420 dpi
- **WebView Provider:** Google Android WebView 145.0.7632.218 (multiprocess enabled)
- **Asset Serving Pipeline:** `androidx.webkit.WebViewAssetLoader` via virtual HTTPS domain (`https://appassets.androidplatform.net/assets/...`)
- **Security Configuration:** `allowFileAccess = false`, `allowContentAccess = false`, file-origin privileges removed
- **Verification Findings:**
  1. **ES Module & Asset Loading:** Eliminated Android 14+ `file:///` CORS blocking by serving local assets through `WebViewAssetLoader.AssetsPathHandler`. Models, textures (`turf-v1.png`), and audio load cleanly.
  2. **Comprehensive Back Navigation:** `window.__handleBackNavigation()` routes Back cleanly across all states:
     - *Main Menu Hub:* Returns false; Android cleanly finishes/minimizes the activity (user is never trapped).
     - *Drawers / Modals (Drivers, Karts, Settings):* Dismisses drawer/modal and resets camera to hub.
     - *Active Race:* Pauses the race and displays the pause dialog.
     - *Pause Dialog:* Resumes the race without re-triggering.
     - *Results Screen:* Returns cleanly to the main menu.
  3. **App Lifecycle & Battery Preservation:** `onPause` invokes `webView.pauseTimers()` and dispatches blur events, stopping animation loops and background CPU draw calls. `onResume` restores timers seamlessly.
  4. **Device Screencap:** Captured full-screen 2400x1080 rendered scene at `docs/screenshots/emulator_screen.png`.
