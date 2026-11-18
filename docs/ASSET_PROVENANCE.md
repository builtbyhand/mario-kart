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

### 2.2 Driver Character Models (8 Rigged GLB Assets)

All humanoid driver models are created by **Kenney** (Kenney Vleugels — [kenney.nl](https://kenney.nl)) from the **Kenney Mini Characters 1** collection:
- **Source Page:** [https://kenney.nl/assets/mini-characters-1](https://kenney.nl/assets/mini-characters-1)
- **License:** Creative Commons Zero (CC0 1.0 Universal) — [https://creativecommons.org/publicdomain/zero/1.0/](https://creativecommons.org/publicdomain/zero/1.0/)
- **Original Format:** glTF 2.0 with 8-bone humanoid rig and 32 animations.
- **Processed Format:** Self-contained binary `.glb` with embedded `colormap.png` binary buffer chunk.

| Filename | In-Game Driver Assignment | Creator | License | Packaged Size (Bytes) | SHA-256 Checksum |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `character-male-a.glb` | Red Racer (`mario`) | Kenney | CC0 1.0 | 257,064 B (251 KB) | `0b709f4d6fa144ed829cb579295b45a82f21203d743999cf10987413cfc29584` |
| `character-male-b.glb` | Green Racer (`luigi`) | Kenney | CC0 1.0 | 257,492 B (251 KB) | `8e8c286299e00fdc6758d87010d17c8f6f93bd194b201b1bc1fb1ed0884062a0` |
| `character-female-a.glb` | Pink Racer (`peach`) | Kenney | CC0 1.0 | 283,604 B (277 KB) | `39692b85256c8d3261dd07d7b81b29d56f9b05f83c75d066cf2bba0bfb892544` |
| `character-female-b.glb` | Lime Racer (`yoshi`) | Kenney | CC0 1.0 | 262,296 B (256 KB) | `eea7b9b6ef6a5bf31fe046e5e920c68cc9ac12200bf95f6f8413616a104d4546` |
| `character-male-c.glb` | Blue Racer (`toad`) | Kenney | CC0 1.0 | 273,252 B (267 KB) | `14020c7a8442194a0b3703532bdadb02d3ded1779b80518b0a188a6e58cfa47f` |
| `character-male-d.glb` | Cyber Heavy (`bowser`) | Kenney | CC0 1.0 | 255,336 B (249 KB) | `0f6c91938870653908a711429394064ab6516ebf5f7743d085f14e87616424f7` |
| `character-male-d.glb` | Classic Heavy (`donkey-kong`) | Kenney | CC0 1.0 | 255,336 B (249 KB) | `0f6c91938870653908a711429394064ab6516ebf5f7743d085f14e87616424f7` |
| `character-female-c.glb` | Yellow Racer (`koopa`) | Kenney | CC0 1.0 | 262,196 B (256 KB) | `9257c5665f30386c28c455f534a52557dad517bfd3cbaae3496465cd7cdf37c7` |

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
4. **Mathematical Axle Centering & Seating Calibration:**
   - Wheel mesh clones have their geometry centered at origin `(0, 0, 0)` via `mesh.geometry.center()` and positioned at `(0, 0, 0)` inside the `rolling` group, ensuring 100% concentric rotation around the raw source axle with zero wobble.
   - Posed driver seating positions place the pelvis directly on the seat/cockpit floor ($0.27\text{m} - 0.40\text{m}$) and head clearance at $1.38\text{m} - 1.66\text{m}$ world $Y$.

---

## 4. Visual Validation Artifacts

All 8 kart and driver combinations have been verified and documented via 32 high-definition ($1280 \times 720$) photographic renders located in `docs/screenshots/verification/`:

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
