import * as THREE from "three";
import { EffectComposer } from "./vendor/three-examples/postprocessing/EffectComposer.js";
import { RenderPass } from "./vendor/three-examples/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "./vendor/three-examples/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "./vendor/three-examples/postprocessing/OutputPass.js";
import { FXAAPass } from "./vendor/three-examples/postprocessing/FXAAPass.js";
import { GTAOPass } from "./vendor/three-examples/postprocessing/GTAOPass.js";

/**
 * Modular Post-Processing Pipeline
 * Manages EffectComposer lifecycle, dynamic pass activation/teardown,
 * and graceful fallback for mobile devices and unsupported GPU capabilities.
 */
export class PostProcessingPipeline {
  constructor(renderer, scene, camera, capabilities = null) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.capabilities = capabilities;
    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.fxaaPass = null;
    this.outputPass = null;
    this.gtaoPass = null;
    this.width = 0;
    this.height = 0;
  }

  isSupported() {
    if (!this.capabilities) return true;
    return Boolean(this.capabilities.halfFloatRenderTargets || this.capabilities.webgl2);
  }

  reconfigure(quality, width, height, options = {}) {
    this.width = width;
    this.height = height;
    const forcePost = options.forcePost || (typeof location !== "undefined" && new URLSearchParams(location.search).get("post") === "1");
    const wantsBloom = quality.useBloom || forcePost;
    const wantsFXAA = quality.useFXAA;
    const wantsGTAO = typeof location !== "undefined" && new URLSearchParams(location.search).get("gtao") === "1";
    const wantsPost = wantsBloom || wantsFXAA || wantsGTAO || forcePost;

    if (!wantsPost || !this.isSupported()) {
      this.teardown();
      return null;
    }

    const targetType = (this.capabilities && this.capabilities.halfFloatRenderTargets)
      ? THREE.HalfFloatType
      : THREE.UnsignedByteType;

    if (!this.composer) {
      const renderTarget = new THREE.WebGLRenderTarget(width, height, {
        type: targetType,
        samples: 0,
      });
      this.composer = new EffectComposer(this.renderer, renderTarget);
      this.renderPass = new RenderPass(this.scene, this.camera);
    } else {
      this.composer.setSize(width, height);
    }

    // Configure Bloom Pass
    if (wantsBloom) {
      if (!this.bloomPass) {
        this.bloomPass = new UnrealBloomPass(
          new THREE.Vector2(width, height),
          0.22,
          0.45,
          1.95,
        );
      } else {
        this.bloomPass.setSize(width, height);
      }
      this.bloomPass.enabled = true;
    } else if (this.bloomPass) {
      this.bloomPass.enabled = false;
    }

    // Configure FXAA Pass
    if (wantsFXAA) {
      if (!this.fxaaPass) {
        this.fxaaPass = new FXAAPass();
      }
      this.fxaaPass.setSize(width, height);
      this.fxaaPass.enabled = true;
    } else if (this.fxaaPass) {
      this.fxaaPass.enabled = false;
    }

    // Configure GTAO Pass if requested
    if (wantsGTAO) {
      if (!this.gtaoPass) {
        this.gtaoPass = new GTAOPass(this.scene, this.camera, width, height);
        this.gtaoPass.updateGtaoMaterial({
          radius: 2.2,
          thickness: 1.1,
          distanceExponent: 1.5,
          samples: 8,
        });
        this.gtaoPass.updatePdMaterial({
          radius: 4,
          samples: 8,
          depthPhi: 3,
          normalPhi: 3,
        });
        this.gtaoPass.blendIntensity = 0.6;
      } else {
        this.gtaoPass.setSize(width, height);
      }
      this.gtaoPass.enabled = true;
    } else if (this.gtaoPass) {
      this.gtaoPass.enabled = false;
    }

    // Output Pass
    if (!this.outputPass) {
      this.outputPass = new OutputPass();
      this.outputPass.material.fragmentShader = this.outputPass.material.fragmentShader.replace(
        "gl_FragColor = texture2D( tDiffuse, vUv );",
        "gl_FragColor = vec4(texture2D( tDiffuse, vUv ).rgb, 1.0);",
      );
    }

    // Reconstruct composer passes cleanly without duplicate accumulation
    this.composer.passes = [this.renderPass];
    if (this.gtaoPass && this.gtaoPass.enabled) this.composer.addPass(this.gtaoPass);
    if (this.bloomPass && this.bloomPass.enabled) this.composer.addPass(this.bloomPass);
    if (this.fxaaPass && this.fxaaPass.enabled) this.composer.addPass(this.fxaaPass);
    this.composer.addPass(this.outputPass);

    return this.composer;
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    if (this.composer) {
      this.composer.setSize(width, height);
      if (this.bloomPass) this.bloomPass.setSize(width, height);
      if (this.fxaaPass) this.fxaaPass.setSize(width, height);
      if (this.gtaoPass) this.gtaoPass.setSize(width, height);
    }
  }

  render() {
    if (this.composer) {
      this.composer.render();
      return true;
    }
    return false;
  }

  teardown() {
    if (this.composer) {
      if (this.composer.renderTarget1) this.composer.renderTarget1.dispose();
      if (this.composer.renderTarget2) this.composer.renderTarget2.dispose();
      if (this.bloomPass) {
        if (typeof this.bloomPass.dispose === "function") this.bloomPass.dispose();
        this.bloomPass = null;
      }
      if (this.fxaaPass) {
        if (typeof this.fxaaPass.dispose === "function") this.fxaaPass.dispose();
        this.fxaaPass = null;
      }
      if (this.gtaoPass) {
        if (typeof this.gtaoPass.dispose === "function") this.gtaoPass.dispose();
        this.gtaoPass = null;
      }
      this.composer = null;
      this.renderPass = null;
      this.outputPass = null;
    }
  }
}
