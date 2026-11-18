# Asset Provenance & Legal Compliance Register

**Project:** Mario Kart Android  
**Objective:** Maintain 100% legal distributability, original branding, and complete documentation of all 3D models, textures, audio, and visual assets.

---

## 1. Compliance Guidelines

1. **Originality & Licensing:**
   - Do NOT use Nintendo proprietary assets, ripped character models, copyright logos, or official soundtrack recordings.
   - All assets must be either:
     - Custom-authored original assets.
     - Licensed under permissive open-source licenses (CC0, CC-BY, MIT, Apache 2.0).
     - Procedurally generated in code.
2. **Offline Bundling:**
   - All game assets must be self-contained in `app/src/main/assets/game/` for offline functionality.
3. **No Local 3D DCC Work:**
   - The developer's laptop must not be used for local Blender or 3D rendering. All external 3D assets must be retrieved from online sources or cloud processing pipelines.

---

## 2. Current Asset Inventory (Phase 1 Baseline)

| Asset Name | Path | Type | Source / Origin | License | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Vendor Three.js** | `vendor/three/` | JavaScript Library | Three.js (r186) | MIT | Validated |
| **Procedural Karts** | `models.js`, `model-spec.js` | 3D Geometry | Procedural Three.js code | MIT / Original | Validated |
| **Procedural Audio** | `audio-engine.js`, `audio.js` | Web Audio Synth | Procedural Web Audio API | MIT / Original | Validated |
| **Track Turf Texture** | `art/turf-v1.png` | 2D Texture | Procedural / in-repo | MIT | Validated |
| **Item Icons** | `icons.js` | Vector SVG | Procedural inline SVG | MIT / Original | Validated |
| **Menu Logo** | `menu-logo.svg` | Vector Graphic | Stylized vector logo | Original | Validated |
| **Item Art Textures** | `item-art/*.png` | 2D Textures | In-repo vector render | Original | Validated |

---

## 3. Future Asset Acquisition Register (Template for Phases 2–8)

Whenever a new 3D model (GLB), texture, or audio file is introduced, the following schema must be completed:

```markdown
### [Asset Identifier]
- **File Path:** app/src/main/assets/game/models/<filename>.glb
- **Description:** Stylized 3D kart / racer model
- **Source URL:** <URL from Sketchfab / Poly Pizza / OpenGameArt / Kenney>
- **Author:** <Author Name or Handle>
- **License Type:** <CC0 / CC-BY 4.0 / MIT>
- **Modifications Made:** <Cloud optimization, Draco compression, texture downsampling>
- **Offline File Size:** <Size in KB/MB>
- **Verification Hash:** <SHA-256 Checksum>
```
