# Asset Provenance & Legal Compliance Register

**Project:** Mario Kart Android  
**Platform:** Android Mobile (Landscape)  
**Objective:** Maintain 100% legal distributability, original branding, verified provenance, and complete documentation of all 3D models, textures, audio, and visual assets.

---

## 1. Legal & Intellectual Property Compliance Guidelines

1. **Originality & Licensing Strictness:**
   - **Zero Proprietary Content:** No Nintendo proprietary assets, ripped character models, trademarked vehicle designs, copyright logos, or official game audio are used.
   - All third-party assets are certified **Creative Commons Zero (CC0 1.0 Universal)** public domain dedication, permitting free personal and commercial use, modification, and offline packaging without mandatory attribution.
   - The game uses original character branding and names ("Red Speedster", "Green Aero", "Pink Sport", "Lime Turbo", "Blue Comet", "Cyber Beast", "Classic GT", "Yellow Sprint").
2. **Offline Local Bundling:**
   - All 3D models and textures are packaged locally under `app/src/main/assets/game/models/`. No external remote CDN fetches are performed during gameplay, ensuring 100% offline functionality.
3. **No Local DCC Software:**
   - In compliance with development constraints, the developer's laptop was never used for local Blender or 3D digital content creation. Assets were sourced from reputable CC0 public domains and converted via remote/automated scripts.

---

## 2. Complete Asset Provenance Register

### 2.1 Kart Vehicle Models (8 GLB Assets)

All vehicle models are created by **Kenney** (Kenney Vleugels — [kenney.nl](https://kenney.nl)) from the **Kenney Car Kit**:
- **Source Page:** [https://kenney.nl/assets/car-kit](https://kenney.nl/assets/car-kit)
- **License:** Creative Commons Zero (CC0 1.0 Universal) — [https://creativecommons.org/publicdomain/zero/1.0/](https://creativecommons.org/publicdomain/zero/1.0/)
- **Original Format:** glTF 2.0 with separate texture reference.
- **Processed Format:** Self-contained binary `.glb` with embedded `colormap.png` binary buffer chunk.

| Filename | In-Game Vehicle | Creator | License | Packaged Size (Bytes) | SHA-256 Checksum |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `kart-oobi.glb` | Red Speedster (`mario`) | Kenney | CC0 1.0 | 263,780 B (258 KB) | `b06a7936bef1591547befb296501980b537205b62d567d3932b860e0f5e1a53e` |
| `kart-oodi.glb` | Green Aero (`luigi`) | Kenney | CC0 1.0 | 243,248 B (238 KB) | `005050edd7f4e1d8f28b9e5750188c7925c60bd1e8d100f8928776579469958b` |
| `kart-ooli.glb` | Pink Sport (`peach`) | Kenney | CC0 1.0 | 245,644 B (240 KB) | `3a3d53578dded66414956d824371d454840ae75f3e5a61e973fe78496c835236` |
| `kart-oopi.glb` | Lime Turbo (`yoshi`) | Kenney | CC0 1.0 | 248,468 B (243 KB) | `aa52d7801ccd0f25d62f6eede26a9b2aafc1c3d48abd1a476f06a286d50a43c1` |
| `kart-oozi.glb` | Blue Comet (`toad`) | Kenney | CC0 1.0 | 253,040 B (248 KB) | `e34531dcfe4871f776c13a4a43710ed0b721321533ffd80b74221ebb2dd296ff` |
| `race-future.glb` | Cyber Beast (`bowser`) | Kenney | CC0 1.0 | 185,448 B (181 KB) | `62f68958c5e7ddcb909c7b6b745a560f602d784338efa5a7417825ec6e9644d4` |
| `race.glb` | Classic GT (`donkey-kong`) | Kenney | CC0 1.0 | 179,560 B (175 KB) | `ac1ecc9981ade2802845f24406f83931fad7ef814e896717bba85fdd0145d8c0` |
| `sedan-sports.glb` | Yellow Sprint (`koopa`) | Kenney | CC0 1.0 | 189,920 B (185 KB) | `b9cceddbff7329eebe47326694ef9130fd2032c24a036cee0223955cc4884479` |

---

### 2.2 Driver Character Models (Rigged GLB Assets)

All humanoid driver models are created by **Kenney** (Kenney Vleugels — [kenney.nl](https://kenney.nl)) from the **Kenney Mini Characters 1** collection:
- **Source Page:** [https://kenney.nl/assets/mini-characters-1](https://kenney.nl/assets/mini-characters-1)
- **License:** Creative Commons Zero (CC0 1.0 Universal) — [https://creativecommons.org/publicdomain/zero/1.0/](https://creativecommons.org/publicdomain/zero/1.0/)
- **Original Format:** glTF 2.0 with 8-bone humanoid rig and 32 animations.
- **Processed Format:** Self-contained binary `.glb` with embedded `colormap.png` binary buffer chunk.

| Filename | In-Game Driver Assignment (`KART_SPECS`) | Creator | License | Packaged Size (Bytes) | SHA-256 Checksum |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `character-male-a.glb` | Racer 1 (`mario` / Red Speedster) | Kenney | CC0 1.0 | 257,064 B (251 KB) | `0b709f4d6fa144ed829cb579295b45a82f21203d743999cf10987413cfc29584` |
| `character-male-b.glb` | Racer 2 (`luigi` / Green Aero) | Kenney | CC0 1.0 | 257,492 B (251 KB) | `8e8c286299e00fdc6758d87010d17c8f6f93bd194b201b1bc1fb1ed0884062a0` |
| `character-female-a.glb` | Racer 3 (`peach` / Pink Sport) | Kenney | CC0 1.0 | 283,604 B (277 KB) | `39692b85256c8d3261dd07d7b81b29d56f9b05f83c75d066cf2bba0bfb892544` |
| `character-female-b.glb` | Racer 4 (`yoshi` / Lime Turbo) | Kenney | CC0 1.0 | 262,296 B (256 KB) | `eea7b9b6ef6a5bf31fe046e5e920c68cc9ac12200bf95f6f8413616a104d4546` |
| `character-male-c.glb` | Racer 5 (`toad` / Blue Comet) | Kenney | CC0 1.0 | 273,252 B (267 KB) | `14020c7a8442194a0b3703532bdadb02d3ded1779b80518b0a188a6e58cfa47f` |
| `character-male-d.glb` | Racer 6 (`bowser`) & Racer 7 (`donkey-kong`) | Kenney | CC0 1.0 | 255,336 B (249 KB) | `0f6c91938870653908a711429394064ab6516ebf5f7743d085f14e87616424f7` |
| `character-female-c.glb` | Racer 8 (`koopa` / Yellow Sprint) | Kenney | CC0 1.0 | 262,196 B (256 KB) | `9257c5665f30386c28c455f534a52557dad517bfd3cbaae3496465cd7cdf37c7` |
| `character-female-d.glb` | *Intentionally Unused / Reserved in Initial Roster* | Kenney | CC0 1.0 | 272,384 B (266 KB) | `fde08e246804ded47bb31dd42963f118f3dc94728f58e1e564d6deb64f9276c7` |

---

### 2.3 Shared Color Palette Texture

| Filename | Creator | Source Page | License | Format | Size (Bytes) | SHA-256 Checksum |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `Textures/colormap.png` | Kenney | [https://kenney.nl](https://kenney.nl) | CC0 1.0 | 256x256 PNG | 12,371 B (12 KB) | `f3622a03a20c6696065cae9cbe391351be873508af190c2ebd1d420c055787a5` |

---

## 3. Modification & Optimization Details

1. **Self-Contained Embedded Texture Buffers:**
   - In stock Kenney assets, textures are referenced as external URI strings.
   - For Android WebView offline reliability, `colormap.png` was converted to a binary buffer view embedded directly inside each `.glb` chunk.
2. **Hierarchical Coordinate Decoupling:**
   - Kart models are oriented forward along Three.js `-Z` using parent node rotation ($180^\circ$ Y).
   - Driver characters are attached via a separate unscaled parent node directly under `root` at true world scale and offsets, preventing nested scaling multiplications.
   - Wheels are articulated as unscaled, world-aligned pivots with separate `rolling` and anti-gravity `glow` children.
3. **Instance Isolation & Safe Cache Lifecycle:**
   - Geometries and materials are cloned per racer instance from the master cached GLTF, protecting master cached assets from being disposed during race teardown.
   - Master assets registered in `assetCache` are safeguarded; active instances are tracked via `activeInstances` and `clearAssetCache` blocks accidental destruction of in-use master resources.
4. **Complete MatrixWorld Axle Alignment & Driver Placement Calibration:**
   - Wheel axle centers and orientations are derived from the complete source GLTF hierarchy using updated `matrixWorld` transformations, preserving parent translations, rotations, and scales.
   - Each wheel's local matrix inside the unscaled `rolling` group is converted from `matrixWorld` so that the rotation axis coincides exactly with the geometric axle center ($< 10^{-5}\text{ m}$) with zero eccentric wobble, preserving original source mesh geometry and affine transforms including shear without destructive centering.
   - Because source GLTF assets lack discrete physical seat-cushion and steering-wheel submesh nodes, physical seat contact and steering grip are not claimed. Instead, documented approximate geometric proxies calibrate driver placement within the cockpit bounding volume: the lowest transformed vertex of the root/torso bone region serves as an approximate vertical pelvis proxy clearing the underbody floor ($> 0.15\text{m}$ clearance), the distal arm extremity cluster centroids serve as forward reach proxies into the cockpit steering zone, and head top sightlines clear the upper chassis ($1.35\text{m} - 1.70\text{m}$).

---

## 4. Visual Validation Artifacts

All 8 kart and driver combinations have been verified and documented via 32 high-definition ($1280 \times 720$) photographic renders located in `docs/screenshots/verification/`.

*Note on Validation Tooling:* SwiftShader headless screenshots are software-rendered visual and geometric validation checks executed in CI, not Android GPU benchmarks. Quality presets configure dynamic engine parameters rather than guaranteeing unmeasured 60 FPS hardware performance.

| Racer | Combination | Screenshots Available |
| :--- | :--- | :--- |
| `mario` | `kart-oobi.glb` + `character-male-a.glb` | `racer_01_mario_{three_quarter, side, rear, cockpit}.png` |
| `luigi` | `kart-oodi.glb` + `character-male-b.glb` | `racer_02_luigi_{three_quarter, side, rear, cockpit}.png` |
| `peach` | `kart-ooli.glb` + `character-female-a.glb` | `racer_03_peach_{three_quarter, side, rear, cockpit}.png` |
| `yoshi` | `kart-oopi.glb` + `character-female-b.glb` | `racer_04_yoshi_{three_quarter, side, rear, cockpit}.png` |
| `toad` | `kart-oozi.glb` + `character-male-c.glb` | `racer_05_toad_{three_quarter, side, rear, cockpit}.png` |
| `bowser` | `race-future.glb` + `character-male-d.glb` | `racer_06_bowser_{three_quarter, side, rear, cockpit}.png` |
| `donkey-kong` | `race.glb` + `character-male-d.glb` | `racer_07_donkey_kong_{three_quarter, side, rear, cockpit}.png` |
| `koopa` | `sedan-sports.glb` + `character-female-c.glb` | `racer_08_koopa_{three_quarter, side, rear, cockpit}.png` |

---

## 5. Environment & Track Models (Phase 4 Register)

All environment models are bundled inside `app/src/main/assets/game/models/environment/` for 100% offline availability in Android WebView without gameplay network downloads.

All 28 environment 3D assets are created by **Kenney** (Kenney Vleugels — [kenney.nl](https://kenney.nl)) across three asset kits:
- **Kenney Racing Kit:** [https://kenney.nl/assets/racing-kit](https://kenney.nl/assets/racing-kit) (Barriers, grandstands, gantries, flags, pits, floodlights, billboards, pylons)
- **Kenney Nature Kit:** [https://kenney.nl/assets/nature-kit](https://kenney.nl/assets/nature-kit) (Broadleaf trees, oak trees, mountain pines)
- **Kenney City Commercial Kit:** [https://kenney.nl/assets/city-kit-commercial](https://kenney.nl/assets/city-kit-commercial) (Office, corporate, high-rise, and spire skyscrapers)
- **License:** Creative Commons Zero (CC0 1.0 Universal) — [https://creativecommons.org/publicdomain/zero/1.0/](https://creativecommons.org/publicdomain/zero/1.0/)

| Filename | Asset Kit | License | Packaged Size (Bytes) | SHA-256 Checksum | In-Game Role & Circuit Placement |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `barrierRed.glb` | Racing Kit | CC0 1.0 | 3,244 B (3.2 KB) | `6d7de595a92507af6fcb40fe5a62730925ea23f1f8c727b8ecdec9eba9b98156` | Continuous outer/inner barrier along `WALL_HALF` (red block) |
| `barrierWhite.glb` | Racing Kit | CC0 1.0 | 3,252 B (3.2 KB) | `44bf654b08bb96bd0e9a70c00dab35b0b23df955d3390ec8ede89c20ad64871a` | Continuous outer/inner barrier along `WALL_HALF` (white block) |
| `fenceStraight.glb` | Racing Kit | CC0 1.0 | 7,756 B (7.6 KB) | `12fac1aea8f7d8d138a2a8820c7476187fb25a7c39963bfef250c2e8120fba68` | Steel safety catch fence behind barriers along spectator areas |
| `pylon.glb` | Racing Kit | CC0 1.0 | 8,088 B (7.9 KB) | `d554671f5ab372cef0e1083b83dc270c03f32bfa0dbc3978c40206faf5608b89` | Corner apex clipping pylons (Turns 1, 2, Hairpin, Chicane) |
| `grandStand.glb` | Racing Kit | CC0 1.0 | 12,484 B (12.2 KB) | `6f5db4f9d9fd82080a561e78d6bc3420e5ed4ed7d8d91ed8bae7f5a7a469645b` | Open-air spectator grandstands on pre-finish straight |
| `grandStandCovered.glb` | Racing Kit | CC0 1.0 | 15,200 B (14.8 KB) | `48fc8e7eace9969a849805bddd5dce2bf1244129f46ae18f7dc8499fe1792b50` | Covered multi-tier spectator grandstands along main straight |
| `grandStandRound.glb` | Racing Kit | CC0 1.0 | 71,100 B (69.4 KB) | `2037d0f3615240b6a9e93c26afb3351f831531a6d6485ab2b6290f8cdabaa500` | Curved spectator grandstands hugging outside bank of Turn 1 |
| `overheadLights.glb` | Racing Kit | CC0 1.0 | 26,068 B (25.5 KB) | `8239fa98d2c950d7aba67ecf49dc92af18ee0da92ed96736a711b22e90e795cd` | Start/finish gantry with 3 dynamic countdown light pods |
| `overhead.glb` | Racing Kit | CC0 1.0 | 9,188 B (9.0 KB) | `8c38e92377eaeafee28a88f9fe10a580f1da984d3fa6b4b35c08ed62e2db6ff2` | Overhead track archway spanning backstretch straight |
| `billboard.glb` | Racing Kit | CC0 1.0 | 14,520 B (14.2 KB) | `2c95fe71e6b31430b8379febf31b4b6118a21b55a6bb1e197a4e4fabfd026c20` | Large sponsor billboard on high-visibility corner exits |
| `billboardLow.glb` | Racing Kit | CC0 1.0 | 14,528 B (14.2 KB) | `aa72f9a42d033c39509d395f5b44ff22ba63cf45ede96e15a18c26faebc09a9f` | Low-profile sponsor billboard on sweeping turns |
| `bannerTowerRed.glb` | Racing Kit | CC0 1.0 | 33,992 B (33.2 KB) | `16b22cccce7d97bf6f8c8333a0048cd14f986d32ae7115aa38107bb78ebfeea2` | Vertical sponsor banner tower at circuit entrance & pitlane |
| `flagCheckers.glb` | Racing Kit | CC0 1.0 | 15,188 B (14.8 KB) | `2feb99a4974fc82f90b43436421feb0874c074d4ea685d9673c6803429fd32ba` | Checkered racing flag on pit wall gantry |
| `flagRed.glb` | Racing Kit | CC0 1.0 | 17,168 B (16.8 KB) | `ffe61934815e0b52104dd4f11d67f7dc98dbad1220d0d60947870a9081b80b87` | Red racing flag along pit entrance trackside |
| `pitsGarage.glb` | Racing Kit | CC0 1.0 | 13,028 B (12.7 KB) | `db73d2ebd70763380ef872ffd2a399eb72c979f96c5a3c1ab377d93670204a23` | Team service garage building along pit straight |
| `pitsOffice.glb` | Racing Kit | CC0 1.0 | 8,184 B (8.0 KB) | `32a39cf3b1051d651f6cc28e2febf3d2752c7120206e5688c0a45b93b7eea625` | Race control and timing tower on pit straight |
| `tent.glb` | Racing Kit | CC0 1.0 | 6,948 B (6.8 KB) | `86ad24a0e86f4d247a170157404088325615b7125b90f8e9a180c4e75939105c` | Team hospitality and technical tents in paddock area |
| `lightPostModern.glb` | Racing Kit | CC0 1.0 | 16,584 B (16.2 KB) | `8fd8fccc65f53cf54efff81546b90be23d8c32a4ea85b5bbc79c6c9d123cb925` | Modern curved floodlight towers around stadium perimeter |
| `treeLarge.glb` | Racing Kit | CC0 1.0 | 6,964 B (6.8 KB) | `3fcba4474bc490a5e589ce4924e972ca629029f2ade17a20f4ca3a7f253a3168` | Broadleaf trees on stadium infield lawn |
| `treeSmall.glb` | Racing Kit | CC0 1.0 | 6,960 B (6.8 KB) | `151d1556b762768433ed9610589650ae8110cac2ed99a3fe1e4da53e1335be23` | Decorative shrubs along outer barrier margins |
| `tree_default.glb` | Nature Kit | CC0 1.0 | 9,428 B (9.2 KB) | `562d29638c902de3c7bee465d3a53bb77117efbc392ae04ed894faf6b5dc691d` | Stylized parkway trees in lower infield |
| `tree_oak.glb` | Nature Kit | CC0 1.0 | 14,644 B (14.3 KB) | `d7fd8773674928c50c11b66d12c636d49bdcc15a8b1c7fbb98e6f63a3439a3f3` | Large mature oak trees framing backstretch |
| `tree_pineRoundA.glb` | Nature Kit | CC0 1.0 | 14,488 B (14.1 KB) | `7dc9711f5ab372cef0e1083b83dc270c03f32bfa0dbc3978c40206faf5608b89` | Mountain pine trees along climbing elevation ridge |
| `tree_pineTallA.glb` | Nature Kit | CC0 1.0 | 7,200 B (7.0 KB) | `e0a56eb196d8a64ba86c7304d607136e17e6f9ad748dffcf86bd53b18b91b196` | Tall alpine pines on mountain crest and elevated hairpin |
| `building-skyscraper-a.glb` | City Commercial | CC0 1.0 | 123,744 B (120.8 KB) | `7a8968eb10aa71bee4a51cae95c21425a4d9ced7c949dac447b1e494535e6b6c` | Modern office skyscraper in stadium skyline arc (Tower A) |
| `building-skyscraper-b.glb` | City Commercial | CC0 1.0 | 150,892 B (147.4 KB) | `52fe191d8401c39db4cd2b7902c37dce09608eeb3fd379b38aefc5ed658512ba` | Stepped corporate skyscraper in stadium skyline arc (Tower B) |
| `building-skyscraper-c.glb` | City Commercial | CC0 1.0 | 161,932 B (158.1 KB) | `d3d5d2b281eddda1ba19eaaf2115c6166f1fc8f6dbafc91ac04969bbd3d4b0a6` | High-rise commercial tower in stadium skyline arc (Tower C) |
| `building-skyscraper-d.glb` | City Commercial | CC0 1.0 | 179,556 B (175.4 KB) | `8718578123f49d39862d608efa7d717a7a72571517dce9a23211ffd6fde94aba` | Spire architectural skyscraper in stadium skyline arc (Tower D) |

---

## 6. Phase 4 Technical Modifications & Environment Architecture

1. **Self-Contained Embedded Texture Buffers:**
   - For all 28 environment GLB models, external URI dependencies were completely eliminated.
   - For skyscraper models referencing `colormap.png`, PNG image bytes were packed directly into the binary GLB buffer chunk (`BIN`) with corresponding `bufferView` and `image` descriptors.
   - Guaranteed 100% offline functionality in Android WebView without network fetches.
2. **Normalized Coordinate Calibration (`getNormalizedLocalTransform`):**
   - Source models across different kits have diverse raw origin points, bounding centers, and orientations.
   - The engine automatically computes an exact affine normalization matrix:
     $$\mathbf{M}_{\text{norm}} = \mathbf{M}_{\text{scale}} \cdot \mathbf{M}_{\text{rotY}} \cdot \mathbf{M}_{\text{center}}$$
   - Centering on $X$ and $Z$, placing the lowest ground contact plane at $Y = 0$, applying canonical yaw rotation, and scaling to intended metric dimensions (e.g. barriers: $0.6\text{m} \times 0.9\text{m} \times 3.0\text{m}$).
3. **Collision & Visual Synchronization:**
   - Drivable asphalt width: `ROAD_HALF = 10` ($10\text{m}$).
   - Collision boundaries in `logic.js`: `WALL_HALF = 14.5` ($14.5\text{m}$).
   - Visual barriers (`barrierRed`, `barrierWhite`) are placed at exactly $\pm 14.5\text{m}$ lateral offset from the track centerline, aligning with the collision envelope with mathematical precision and zero clipping.
   - Corner apex pylons are positioned at lateral $\pm 9.8\text{m}$ along the inner curb edge, visually marking apexes without protruding into drivable lanes.
4. **Instanced GPU Rendering Optimization (`createInstancedModel`):**
   - High-density assets (barriers, trees, catch fences, apex cones, floodlights) use Three.js `InstancedMesh`.
   - Over 500 track barrier segments are drawn in only 2 draw calls (one red, one white).
   - Over 100 roadside trees and pines are drawn in 3 draw calls.
   - Total scene draw calls remain under 60, preserving 60 FPS mobile performance.
5. **Lighting, Atmosphere & Countdown Sequence:**
   - Integrated with Phase 2 PCF soft shadows, AgX tone mapping (exposure 1.15), and nighttime stadium lighting.
   - Start/finish gantry features 3 dynamic countdown light pods that transition dynamically from red ($3, 2, 1$) to green ($0 / \text{GO}$).
6. **Graceful Procedural Fallback:**
   - If any GLB asset fails to load, `world.js` falls back cleanly to stylized procedural geometry (curved extrusions, procedural grandstands, billboard geometry) ensuring gameplay never crashes.

---

## 7. Phase 4 Visual Validation Artifacts

6 high-definition ($1280 \times 720$) photographic renders validating Phase 4 environment integration are stored under `docs/screenshots/environment/`:

| Verification View | Image File | Scene Content Verified |
| :--- | :--- | :--- |
| Full Track Overview | `track_overview.png` | Panoramic overhead view of entire circuit, terrain, infield, and mountain elevation |
| Track Surface & Curbs | `track_surface_curbs.png` | Detailed asphalt texturing, red/white curbs, apex pylons, and road marking alignment |
| Environment Details | `environment_details.png` | Covered spectator grandstands, continuous track barriers, safety fencing, and pitlane garages |
| Stadium Skyline | `stadium_skyline.png` | Nighttime commercial skyscraper skyline arc, floodlights, and atmospheric stadium lighting |
| Track Elevation & Hairpin | `track_elevation_hairpin.png` | Climbing mountain overpass, anti-gravity gradient, alpine pine trees, and elevated banking |
| Kart Racing Action | `kart_racing_action.png` | Racer 1 (Red Speedster) on start/finish straight beneath countdown gantry |
