# Phase 7 — Performance Benchmark & Complexity Profile

**Date:** 2026-11-19T06:47:55.699Z
**Environment:** Linux x86_64 Headless Chrome (SwiftShader ANGLE WebGL2 Software Rasterizer)
**Screen Resolution:** 1280x720 (Landscape)

> **IMPORTANT METHODOLOGY & INTERPRETATION NOTE:**
> SwiftShader is a CPU software rasterizer utilized for automated headless CI verification and scene validation. Its frame times represent CPU-bound software emulation throughput and **must NOT be interpreted as physical Android GPU frame rates** or proof of 30/60 FPS achievement. Because the sample count in headless software emulation is insufficient (< 10 frames), racing FPS/frame times are explicitly withheld as non-meaningful performance numbers. The empirical metrics below validate scene complexity scaling (draw calls, triangles, active geometries, and texture allocations) across presets.

## Preset Scene Complexity Observations

| Preset | Race Entered | Load Time | Samples | Draw Calls | Triangles | Active Geometries | Active Textures | Complexity Tier | Racing FPS / Frame Time |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| **LOW** | **true** | 20535 ms | 1 | 349 | 9,71,304 | 393 | 78 | Low-end GPU Fallback (No Shadows) | N/A (insufficient sample count: 1 frames; CPU rasterizer) |
| **MEDIUM** | **true** | 30913 ms | 1 | 597 | 23,35,776 | 443 | 105 | Balanced Mobile/TV (1024 PCF Shadows) | N/A (insufficient sample count: 1 frames; CPU rasterizer) |
| **HIGH** | **true** | 34033 ms | 1 | 612 | 23,35,791 | 444 | 118 | Full Desktop/HD (Post-Processing & FX) | N/A (insufficient sample count: 1 frames; CPU rasterizer) |
| **ULTRA** | **true** | 28177 ms | 1 | 612 | 23,35,791 | 443 | 118 | Full Desktop/HD (Post-Processing & FX) | N/A (insufficient sample count: 1 frames; CPU rasterizer) |

## Memory and Texture Profiles

### LOW
- **Race Entered:** true (verified countdown/racing)
- **Resolution Scale:** 0.85
- **Max Pixel Ratio:** 1
- **Shadows:** Disabled
- **Particle Budget:** 300
- **Active Geometries:** 393
- **Active Textures:** 78

### MEDIUM
- **Race Entered:** true (verified countdown/racing)
- **Resolution Scale:** 1
- **Max Pixel Ratio:** 1.3
- **Shadows:** Enabled (PCF)
- **Particle Budget:** 600
- **Active Geometries:** 443
- **Active Textures:** 105

### HIGH
- **Race Entered:** true (verified countdown/racing)
- **Resolution Scale:** 1
- **Max Pixel Ratio:** 1.6
- **Shadows:** Enabled (PCF)
- **Particle Budget:** 1200
- **Active Geometries:** 444
- **Active Textures:** 118

### ULTRA
- **Race Entered:** true (verified countdown/racing)
- **Resolution Scale:** 1
- **Max Pixel Ratio:** 2
- **Shadows:** Enabled (PCF)
- **Particle Budget:** 1800
- **Active Geometries:** 443
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
