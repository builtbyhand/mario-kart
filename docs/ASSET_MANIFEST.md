# Asset Manifest — Phase 3 Character & Kart Models

All 3D models integrated in Phase 3 are 100% original, legally distributable, and provided under the **Creative Commons Zero (CC0 1.0 Universal)** public domain dedication. No proprietary, ripped, or copyrighted assets from Nintendo or Mario Kart are used.

---

## 1. Kart Vehicle Models

| Asset File | Creator | Source URL | License | Original Format | Processed Format | Polygon Count | File Size | Role & Vehicle Assignment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `kart-oobi.glb` | Kenney | [kenney.nl/assets/car-kit](https://kenney.nl/assets/car-kit) | CC0 1.0 | glTF 2.0 / GLB | Self-contained GLB | 3,126 tris | 258 KB | Racer 1 (Red Speedster) |
| `kart-oodi.glb` | Kenney | [kenney.nl/assets/car-kit](https://kenney.nl/assets/car-kit) | CC0 1.0 | glTF 2.0 / GLB | Self-contained GLB | 2,890 tris | 238 KB | Racer 2 (Green Aero) |
| `kart-ooli.glb` | Kenney | [kenney.nl/assets/car-kit](https://kenney.nl/assets/car-kit) | CC0 1.0 | glTF 2.0 / GLB | Self-contained GLB | 2,914 tris | 240 KB | Racer 3 (Pink Sport) |
| `kart-oopi.glb` | Kenney | [kenney.nl/assets/car-kit](https://kenney.nl/assets/car-kit) | CC0 1.0 | glTF 2.0 / GLB | Self-contained GLB | 2,950 tris | 243 KB | Racer 4 (Lime Turbo) |
| `kart-oozi.glb` | Kenney | [kenney.nl/assets/car-kit](https://kenney.nl/assets/car-kit) | CC0 1.0 | glTF 2.0 / GLB | Self-contained GLB | 3,010 tris | 248 KB | Racer 5 (Blue Comet) |
| `race-future.glb` | Kenney | [kenney.nl/assets/car-kit](https://kenney.nl/assets/car-kit) | CC0 1.0 | glTF 2.0 / GLB | Self-contained GLB | 2,140 tris | 179 KB | Racer 6 (Cyber Beast) |
| `race.glb` | Kenney | [kenney.nl/assets/car-kit](https://kenney.nl/assets/car-kit) | CC0 1.0 | glTF 2.0 / GLB | Self-contained GLB | 2,080 tris | 173 KB | Racer 7 (Classic GT) |
| `sedan-sports.glb` | Kenney | [kenney.nl/assets/car-kit](https://kenney.nl/assets/car-kit) | CC0 1.0 | glTF 2.0 / GLB | Self-contained GLB | 2,210 tris | 183 KB | Racer 8 (Yellow Sprint) |

---

## 2. Driver Character Models

| Asset File | Creator | Source URL | License | Original Format | Processed Format | Skeleton / Clips | File Size | Assigned Driver |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `character-male-a.glb` | Kenney | [kenney.nl/assets/mini-characters](https://kenney.nl/assets/mini-characters) | CC0 1.0 | glTF 2.0 / GLB | Rigged GLB | 8 bones, 32 anims | 255 KB | Male Driver A (Red Suit) |
| `character-male-b.glb` | Kenney | [kenney.nl/assets/mini-characters](https://kenney.nl/assets/mini-characters) | CC0 1.0 | glTF 2.0 / GLB | Rigged GLB | 8 bones, 32 anims | 255 KB | Male Driver B (Green Suit) |
| `character-male-c.glb` | Kenney | [kenney.nl/assets/mini-characters](https://kenney.nl/assets/mini-characters) | CC0 1.0 | glTF 2.0 / GLB | Rigged GLB | 8 bones, 32 anims | 270 KB | Male Driver C (Blue Suit) |
| `character-male-d.glb` | Kenney | [kenney.nl/assets/mini-characters](https://kenney.nl/assets/mini-characters) | CC0 1.0 | glTF 2.0 / GLB | Rigged GLB | 8 bones, 32 anims | 253 KB | Male Driver D (Heavy Suit) |
| `character-female-a.glb` | Kenney | [kenney.nl/assets/mini-characters](https://kenney.nl/assets/mini-characters) | CC0 1.0 | glTF 2.0 / GLB | Rigged GLB | 8 bones, 32 anims | 281 KB | Female Driver A (Pink Suit) |
| `character-female-b.glb` | Kenney | [kenney.nl/assets/mini-characters](https://kenney.nl/assets/mini-characters) | CC0 1.0 | glTF 2.0 / GLB | Rigged GLB | 8 bones, 32 anims | 260 KB | Female Driver B (Lime Suit) |
| `character-female-c.glb` | Kenney | [kenney.nl/assets/mini-characters](https://kenney.nl/assets/mini-characters) | CC0 1.0 | glTF 2.0 / GLB | Rigged GLB | 8 bones, 32 anims | 260 KB | Female Driver C (Yellow Suit) |
| `character-female-d.glb` | Kenney | [kenney.nl/assets/mini-characters](https://kenney.nl/assets/mini-characters) | CC0 1.0 | glTF 2.0 / GLB | Rigged GLB | 8 bones, 32 anims | 266 KB | Female Driver D (Sport Suit) |

---

## 3. Textures & Shared Materials

| Asset File | Creator | Source URL | License | Dimensions | Format | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `Textures/colormap.png` | Kenney | [kenney.nl](https://kenney.nl) | CC0 1.0 | 256x256 | PNG (13 KB) | Shared palette map; embedded inside all binary GLB containers and available externally for Three.js material fallbacks |

---

## 4. Processing & Modifications Performed

1. **Self-Contained GLB Binary Packaging:**
   - Texture `colormap.png` was merged into the binary buffer chunk (`BIN`) of each GLB file with a corresponding `bufferView` image entry.
   - Eliminates secondary HTTP/file fetches in Android WebView and guarantees offline availability.
2. **Coordinate & Scale Correction:**
   - Sourced assets are oriented along +Z. During runtime instantiation, each kart is rotated by 180° (`Math.PI` around Y) so the nose faces -Z, matching the engine's physics and camera convention.
   - Scaled uniformly by ~2.0 - 2.2x so the wheelbase (~1.63m) and track width (~1.55m) align with the physics collider envelope.
3. **Wheel Articulation Hierarchy:**
   - Sourced GLB files contain four separate wheel meshes (`wheel-front-left`, `wheel-front-right`, `wheel-back-left`, `wheel-back-right`).
   - The engine automatically parses the geometric center of each wheel and wraps it in a parent pivot group (`wheel-0` to `wheel-3`) with an internal `rolling` child group.
   - Steer rotation is applied to the front wheel pivots on Y (`w.rotation.y = -r.steer * 0.32`).
   - Tire rolling is applied to the rolling child on X (`rolling.rotation.x -= (r.speed * dt) / radius`).
   - Anti-gravity cyan glow rings and hub caps are dynamically generated and parented to each wheel pivot, toggled during hover sections (`w.userData.glow.visible = r.anti`).
4. **Skeletal Animation Integration:**
   - Humanoid driver models feature an 8-bone hierarchy (`root`, `torso`, `head`, `arm-left`, `arm-right`, `leg-left`, `leg-right`).
   - Three.js `AnimationMixer` plays the bundled `'drive'` clip during racing and `'idle'` during countdown.
   - The driver's `head` bone is named `"driver-head"` with rest quaternion caching, allowing `updateDriverLook` to smoothly turn the driver's head toward rival karts during overtaking maneuvers.
   - When steering, the driver torso banks into the turn (`driver.rotation.z = -r.steer * 0.12`).
