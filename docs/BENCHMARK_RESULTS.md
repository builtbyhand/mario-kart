# Phase 7 — Performance Benchmark Results

**Date:** 2026-11-19T05:49:21.476Z
**Environment:** Linux x86_64 Headless Chrome (SwiftShader ANGLE WebGL2)
**Screen Resolution:** 1280x720 (Landscape)

## Preset Measurements

| Preset | Load Time | Menu FPS | Racing FPS | Mean Frame Time | P95 Frame Time | P99 Frame Time | Draw Calls | Triangles | Target Budget Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **LOW** | 17104 ms | 0.4 | 0.4 | 2429.9 ms | 8066.4 ms | 8066.4 ms | 349 | 9,71,304 | Over budget |
| **MEDIUM** | 19103 ms | 0.3 | 0.3 | 3587.38 ms | 9749.6 ms | 9749.6 ms | 597 | 23,35,776 | Over budget |
| **HIGH** | 16040 ms | 0.3 | 0.3 | 3404.03 ms | 9799.6 ms | 9799.6 ms | 612 | 23,35,791 | Over budget |
| **ULTRA** | 25457 ms | 0.3 | 0.3 | 3526.04 ms | 10866.2 ms | 10866.2 ms | 612 | 23,35,791 | Over budget |

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
- **Active Geometries:** 440
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
- **Active Geometries:** 444
- **Active Textures:** 118

## Android Emulator Device Testing Record

*Tested on available local Android Virtual Device (AVD).*

- **Device Profile:** Medium Phone (`Medium_Phone_API_37.0`)
- **OS Version:** Android 17 (API Level 37)
- **Architecture:** x86_64 with KVM hardware acceleration
- **Display Resolution:** 2400 x 1080 (Landscape), 420 dpi
- **WebView Provider:** Google Android WebView 145.0.7632.218 (multiprocess enabled)
- **Asset Serving Pipeline:** `androidx.webkit.WebViewAssetLoader` with HTTPS origin (`https://appassets.androidplatform.net/assets/...`)
- **Verification Findings:**
  1. **ES Module & Asset Loading:** Eliminated Android 14+ `file:///` CORS blocking by serving local assets through `WebViewAssetLoader.AssetsPathHandler`. Models, textures (`turf-v1.png`), and audio load cleanly.
  2. **Modern Back Navigation:** `OnBackPressedCallback` via `onBackPressedDispatcher` verified on API 37 gesture/back navigation. Successfully triggers in-game pause modal without exiting or crashing.
  3. **App Lifecycle & Battery Preservation:** `onPause` invokes `webView.pauseTimers()` and dispatches blur events, stopping animation loops and background CPU draw calls. `onResume` restores timers seamlessly.
  4. **Device Screencap:** Captured full-screen 2400x1080 rendered scene at `docs/screenshots/emulator_screen.png`.


