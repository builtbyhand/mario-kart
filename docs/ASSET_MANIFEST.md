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

| Asset File | Creator | Source URL | License | Original Format | Processed Format | Skeleton / Clips | File Size | In-Game Assignment (`KART_SPECS`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `character-male-a.glb` | Kenney | [kenney.nl/assets/mini-characters](https://kenney.nl/assets/mini-characters) | CC0 1.0 | glTF 2.0 / GLB | Rigged GLB | 8 bones, 32 anims | 255 KB | Racer 1 (`mario` / Red Speedster) |
| `character-male-b.glb` | Kenney | [kenney.nl/assets/mini-characters](https://kenney.nl/assets/mini-characters) | CC0 1.0 | glTF 2.0 / GLB | Rigged GLB | 8 bones, 32 anims | 255 KB | Racer 2 (`luigi` / Green Aero) |
| `character-female-a.glb` | Kenney | [kenney.nl/assets/mini-characters](https://kenney.nl/assets/mini-characters) | CC0 1.0 | glTF 2.0 / GLB | Rigged GLB | 8 bones, 32 anims | 281 KB | Racer 3 (`peach` / Pink Sport) |
| `character-female-b.glb` | Kenney | [kenney.nl/assets/mini-characters](https://kenney.nl/assets/mini-characters) | CC0 1.0 | glTF 2.0 / GLB | Rigged GLB | 8 bones, 32 anims | 260 KB | Racer 4 (`yoshi` / Lime Turbo) |
| `character-male-c.glb` | Kenney | [kenney.nl/assets/mini-characters](https://kenney.nl/assets/mini-characters) | CC0 1.0 | glTF 2.0 / GLB | Rigged GLB | 8 bones, 32 anims | 270 KB | Racer 5 (`toad` / Blue Comet) |
| `character-male-d.glb` | Kenney | [kenney.nl/assets/mini-characters](https://kenney.nl/assets/mini-characters) | CC0 1.0 | glTF 2.0 / GLB | Rigged GLB | 8 bones, 32 anims | 253 KB | Racer 6 (`bowser`) & Racer 7 (`donkey-kong`) |
| `character-female-c.glb` | Kenney | [kenney.nl/assets/mini-characters](https://kenney.nl/assets/mini-characters) | CC0 1.0 | glTF 2.0 / GLB | Rigged GLB | 8 bones, 32 anims | 260 KB | Racer 8 (`koopa` / Yellow Sprint) |
| `character-female-d.glb` | Kenney | [kenney.nl/assets/mini-characters](https://kenney.nl/assets/mini-characters) | CC0 1.0 | glTF 2.0 / GLB | Rigged GLB | 8 bones, 32 anims | 266 KB | *Intentionally Unused / Reserved Asset* (stored locally in `models/` for future roster expansion) |

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
   - Scaled appropriately: 2.2x for the 5 compact karts (`kart-oobi` through `oozi`) and 1.25x for the 3 larger vehicles (`race`, `race-future`, `sedan-sports`), ensuring all vehicles have length ~3.14m – 3.32m, wheelbase ~1.63m – 1.90m, and track width ~1.25m – 1.68m.
3. **Decoupled Unscaled Attachment Hierarchy & Seating Calibration:**
   - Sourced GLB assets lack dedicated separate `steering-wheel` and `seat` submesh nodes in their hierarchies (the 5 standard karts feature an integrated static driver reference mesh, while the 3 car models feature solid chassis bodies).
   - The engine establishes documented geometric cockpit seat references ($Y \approx 0.60\text{m}$ for open-cockpit karts, $0.44\text{m} - 0.55\text{m}$ for race cars) and steering wheel reference locations.
   - The driver character is attached directly to the root kart group in an unscaled attachment hierarchy, rather than as a child of the scaled kart scene.
   - Skinned animated driver geometry is evaluated in the `'drive'` pose: the pelvis contact surface rests on the cockpit seat plane ($|Y_{\text{pelvis}} - Y_{\text{seat\_ref}}| < 0.12\text{m}$), clears the underbody floor ($Y_{\text{pelvis}} > Y_{\text{underbody}} + 0.15\text{m}$), and hands extend forward into the cockpit steering area with anatomically realistic reach and grip width ($0.38\text{m} - 0.79\text{m}$). Head top sits between $1.35\text{m} - 1.70\text{m}$ with natural upward sightlines.
4. **Wheel Articulation & Mathematical Axle Centering:**
   - Sourced GLB files contain four separate wheel meshes (`wheel-front-left`, `wheel-front-right`, `wheel-back-left`, `wheel-back-right`).
   - The engine automatically calculates each wheel's geometric axle center and axle direction from the complete source GLTF hierarchy and its updated `matrixWorld`.
   - Wheel reparenting uses exact coordinate transformation mathematics without mutating geometry vertices:
     $$\mathbf{M}_{\text{local}} = (\mathbf{M}_{\text{rolling}}^{\text{world}})^{-1} \cdot \mathbf{M}_{\text{orig}}^{\text{world}}$$
   - The unscaled `wheelPivot` is placed at the exact geometric axle center in world space, and the child `rolling` group is oriented so that its local rolling axis ($+X$) corresponds to the actual transformed axle line.
   - Pitch rotation around local $X$ produces symmetrical rolling around the true geometric axle with zero wobble, validated across multiple rotation angles against independent Rodrigues vector rotations ($< 10^{-4}\text{ m}$ error).
   - Steer rotation is applied to front pivots around vertical $Y$ in world coordinates (`w.rotation.y = -r.steer * 0.32`).
   - Tire rolling is applied to the rolling child on $X$ (`rolling.rotation.x -= (r.speed * dt) / radius`).
   - Anti-gravity cyan glow rings and hub caps are dynamically generated and parented to each wheel pivot, toggled during hover sections (`w.userData.glow.visible = r.anti`).
5. **Skeletal Animation Integration:**
   - Humanoid driver models feature an 8-bone hierarchy (`root`, `torso`, `head`, `arm-left`, `arm-right`, `leg-left`, `leg-right`).
   - Three.js `AnimationMixer` plays the bundled `'drive'` clip during racing and pauses when the game is paused.
   - The driver's `head` bone is named `"driver-head"` with rest quaternion caching, allowing `updateDriverLook` to smoothly turn the driver's head toward rival karts during overtaking maneuvers.
   - When steering, the driver torso banks into the turn (`driver.rotation.z = -r.steer * 0.12`).
6. **Resource Ownership & Instance Isolation:**
   - Geometries and materials are cloned per racer instance when instantiated from the master cached GLTF.
   - Master assets registered in `assetCache` are marked in `masterCachedGeometries`, `masterCachedMaterials`, and `masterCachedTextures`, protected from disposal during race teardown (`disposeModel(k.root)`).
   - Active instances are tracked in `activeInstances`. `clearAssetCache()` strictly refuses to clear master cached assets while active racer instances exist, releasing only when all instances have been cleanly disposed.
   - This ensures multiple consecutive races can be constructed and torn down repeatedly without corrupting or invalidating GPU resources.
7. **Visual Validation & Verification Gallery:**
   - 32 high-definition visual validation screenshots ($1280 \times 720$) are recorded under `docs/screenshots/verification/` capturing all eight racer combinations from four calibrated perspectives: `three_quarter`, `side`, `rear`, and `cockpit`.
   - Verified driver pelvis contact at seat cushion, steering wheel grip clearance, head clearance, and wheel axle alignment under full studio lighting and shadow mapping.
   - *Benchmark & Tooling Note:* SwiftShader headless screenshots are software-rendered visual and geometric validation checks executed in CI, not Android GPU benchmarks. Quality presets configure dynamic engine parameters rather than guaranteeing unmeasured 60 FPS hardware performance.
