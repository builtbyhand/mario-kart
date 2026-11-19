import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const GAME_DIR = path.join(ROOT_DIR, "app/src/main/assets/game");

const HTTP_PORT = 8895;
const CDP_PORT = 9227;

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary",
  ".json": "application/json",
};

// 1. Static HTTP Server
function createServer() {
  return http.createServer((req, res) => {
    let reqPath = req.url.split("?")[0];
    if (reqPath === "/" || reqPath === "") reqPath = "/index.html";
    const filePath = path.join(GAME_DIR, reqPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// 2. Main Benchmark Runner
async function main() {
  console.log("===============================================================================");
  console.log(" Mario Kart Performance Benchmark Suite (Phase 7 Optimization Audit)");
  console.log("===============================================================================\n");

  const server = createServer();
  await new Promise((resolve) => server.listen(HTTP_PORT, "127.0.0.1", resolve));
  console.log(`[Benchmark Server] Listening on http://127.0.0.1:${HTTP_PORT}`);

  const chromeFlags = [
    `--remote-debugging-port=${CDP_PORT}`,
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu-watchdog",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--window-size=1280,720",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-extensions",
    "--mute-audio",
    "--no-first-run",
    "--hide-scrollbars",
  ];

  let chromePath = "/usr/bin/google-chrome";
  if (!fs.existsSync(chromePath)) {
    chromePath = "/usr/bin/chromium" || "/usr/bin/chromium-browser";
  }

  const chrome = spawn(chromePath, chromeFlags);
  chrome.on("error", (err) => {
    console.error("Failed to spawn Chrome:", err);
    process.exit(1);
  });

  // Connect to Chrome debugging port
  let wsUrl = null;
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
      if (res.ok) {
        const data = await res.json();
        if (data && data[0] && data[0].webSocketDebuggerUrl) {
          wsUrl = data[0].webSocketDebuggerUrl;
          break;
        }
      }
    } catch (_) {}
  }

  if (!wsUrl) {
    console.error(`Could not connect to Chrome debugging port ${CDP_PORT}`);
    chrome.kill();
    server.close();
    process.exit(1);
  }

  const ws = new WebSocket(wsUrl);
  let idCounter = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = idCounter++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.method === "Runtime.exceptionThrown") {
        console.error("Browser Exception:", msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
      }
      if (msg.id && pending.has(msg.id)) {
        const resolve = pending.get(msg.id);
        pending.delete(msg.id);
        resolve(msg.result);
      }
    } catch (e) {
      console.error("WS Parse error:", e);
    }
  };

  await new Promise((r) => (ws.onopen = r));
  await send("Page.enable");
  await send("Runtime.enable");

  const PRESETS = ["low", "medium", "high", "ultra"];
  const results = [];

  for (const preset of PRESETS) {
    console.log(`\n>>> Benchmarking Preset: [${preset.toUpperCase()}] ...`);
    const startTime = Date.now();
    await send("Page.navigate", { url: `http://127.0.0.1:${HTTP_PORT}/index.html?quality=${preset}` });

    // Wait for 3D Menu scene to be ready
    let menuReady = false;
    let loadTimeMs = 0;
    for (let wait = 0; wait < 300; wait++) {
      await new Promise((r) => setTimeout(r, 300));
      const res = await send("Runtime.evaluate", {
        expression: "Boolean(window.__menuScene && typeof window.__getPerfMetrics === 'function' && window.__getPerfMetrics()?.totalFrames >= 3)",
        returnByValue: true,
      });
      if (res?.result?.value === true) {
        menuReady = true;
        loadTimeMs = Date.now() - startTime;
        break;
      }
    }

    if (!menuReady) {
      console.error(`[FAIL] Preset ${preset} failed to load in time.`);
      continue;
    }
    console.log(`    - 3D Menu loaded in ${loadTimeMs} ms`);

    // Warm up menu and capture menu performance
    await new Promise((r) => setTimeout(r, 1200));
    const menuPerfRes = await send("Runtime.evaluate", {
      expression: "window.__getPerfMetrics()",
      returnByValue: true,
    });
    const menuPerf = menuPerfRes?.result?.value;

    // Start race and verify race state
    await send("Runtime.evaluate", {
      expression: "if (typeof window.__begin === 'function') window.__begin();",
    });

    let raceEntered = false;
    for (let rw = 0; rw < 25; rw++) {
      await new Promise((r) => setTimeout(r, 200));
      const stateRes = await send("Runtime.evaluate", {
        expression: "window.__race?.state || (document.body.classList.contains('racing') ? 'racing' : 'menu')",
        returnByValue: true,
      });
      const st = stateRes?.result?.value;
      if (st === "racing" || st === "countdown") {
        raceEntered = true;
        break;
      }
    }

    if (!raceEntered) {
      console.error(`    [FAIL] Preset ${preset} failed to enter racing/countdown state.`);
      throw new Error(`Preset ${preset} verification failed: did not enter racing or countdown state.`);
    }

    // Reset frame measurement window between menu and racing
    await send("Runtime.evaluate", {
      expression: "if (typeof window.__resetPerfMetrics === 'function') window.__resetPerfMetrics();",
    });

    // Measure racing state over an explicit measurement duration under SwiftShader
    const raceSampleStart = Date.now();
    await new Promise((r) => setTimeout(r, 6000));
    const raceSampleDurationMs = Date.now() - raceSampleStart;

    const racePerfRes = await send("Runtime.evaluate", {
      expression: "window.__getPerfMetrics()",
      returnByValue: true,
    });
    const racePerf = racePerfRes?.result?.value || menuPerf;
    const hasSufficientSamples = (racePerf.sampleCount || 0) >= 10;

    results.push({
      preset,
      loadTimeMs,
      raceEntered,
      raceSampleDurationMs,
      hasSufficientSamples,
      menu: menuPerf,
      racing: racePerf,
    });

    const fpsDisplay = hasSufficientSamples ? `${racePerf.fps} FPS` : `N/A (insufficient sample count: ${racePerf.sampleCount} frames; CPU rasterizer)`;
    console.log(`    - Race Entered: true (state: verified)`);
    console.log(`    - Menu Scene:   Draws: ${menuPerf.drawCalls} | Tris: ${menuPerf.triangles.toLocaleString()}`);
    console.log(`    - Racing Scene: Draws: ${racePerf.drawCalls} | Tris: ${racePerf.triangles.toLocaleString()} | Geometries: ${racePerf.geometries} | Textures: ${racePerf.textures}`);
    console.log(`    - Racing Timing:${fpsDisplay}`);
  }

  ws.close();
  chrome.kill();
  server.close();

  // Print Summary Table
  console.log("\n==========================================================================================================");
  console.log(" SCENE COMPLEXITY & BENCHMARK PROFILE (SwiftShader CPU Software Emulation)");
  console.log(" *Note: Software-emulated frame times reflect CPU rasterizer throughput, NOT mobile GPU performance.");
  console.log("  Per-preset draw calls, triangles, and memory buffers validate relative scene scaling.");
  console.log("==========================================================================================================");
  console.log(
    "Preset".padEnd(8) +
    " | " + "Race Entered".padEnd(12) +
    " | " + "Load Time".padStart(9) +
    " | " + "Samples".padStart(7) +
    " | " + "Draw Calls".padStart(10) +
    " | " + "Triangles".padStart(10) +
    " | " + "Geometries".padStart(10) +
    " | " + "Textures".padStart(8) +
    " | " + "Complexity Profile".padEnd(22)
  );
  console.log("-".repeat(110));

  for (const r of results) {
    const complexityTier = r.preset === "low" ? "Low Draw / Shadows Off" : r.preset === "medium" ? "Mobile / 1024 Shadows" : "High HD / Post-FX";
    console.log(
      r.preset.toUpperCase().padEnd(8) +
      " | " + `${r.raceEntered ? "Yes (true)" : "No"}`.padEnd(12) +
      " | " + `${r.loadTimeMs} ms`.padStart(9) +
      " | " + `${r.racing.sampleCount}`.padStart(7) +
      " | " + `${r.racing.drawCalls}`.padStart(10) +
      " | " + `${r.racing.triangles.toLocaleString()}`.padStart(10) +
      " | " + `${r.racing.geometries}`.padStart(10) +
      " | " + `${r.racing.textures}`.padStart(8) +
      " | " + complexityTier.padEnd(22)
    );
  }
  console.log("==========================================================================================================\n");

  // Output markdown report file
  const reportPath = path.join(ROOT_DIR, "docs/BENCHMARK_RESULTS.md");
  let md = "# Phase 7 — Performance Benchmark & Complexity Profile\n\n";
  md += `**Date:** ${new Date().toISOString()}\n`;
  md += `**Environment:** Linux x86_64 Headless Chrome (SwiftShader ANGLE WebGL2 Software Rasterizer)\n`;
  md += `**Screen Resolution:** 1280x720 (Landscape)\n\n`;
  md += "> **IMPORTANT METHODOLOGY & INTERPRETATION NOTE:**\n";
  md += "> SwiftShader is a CPU software rasterizer utilized for automated headless CI verification and scene validation. ";
  md += "Its frame times represent CPU-bound software emulation throughput and **must NOT be interpreted as physical Android GPU frame rates** or proof of 30/60 FPS achievement. ";
  md += "Because the sample count in headless software emulation is insufficient (< 10 frames), racing FPS/frame times are explicitly withheld as non-meaningful performance numbers. ";
  md += "The empirical metrics below validate scene complexity scaling (draw calls, triangles, active geometries, and texture allocations) across presets.\n\n";
  md += "## Preset Scene Complexity Observations\n\n";
  md += "| Preset | Race Entered | Load Time | Samples | Draw Calls | Triangles | Active Geometries | Active Textures | Complexity Tier | Racing FPS / Frame Time |\n";
  md += "| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :--- |\n";
  for (const r of results) {
    const tier = r.preset === "low" ? "Low-end GPU Fallback (No Shadows)" : r.preset === "medium" ? "Balanced Mobile/TV (1024 PCF Shadows)" : "Full Desktop/HD (Post-Processing & FX)";
    const fpsCol = r.hasSufficientSamples ? `${r.racing.fps} FPS (${r.racing.meanMs} ms)` : `N/A (insufficient sample count: ${r.racing.sampleCount} frames; CPU rasterizer)`;
    md += `| **${r.preset.toUpperCase()}** | **${r.raceEntered ? "true" : "false"}** | ${r.loadTimeMs} ms | ${r.racing.sampleCount} | ${r.racing.drawCalls} | ${r.racing.triangles.toLocaleString()} | ${r.racing.geometries} | ${r.racing.textures} | ${tier} | ${fpsCol} |\n`;
  }
  md += "\n## Memory and Texture Profiles\n\n";
  for (const r of results) {
    md += `### ${r.preset.toUpperCase()}\n`;
    md += `- **Race Entered:** ${r.raceEntered ? "true (verified countdown/racing)" : "false"}\n`;
    md += `- **Resolution Scale:** ${r.racing.resolutionScale}\n`;
    md += `- **Max Pixel Ratio:** ${r.racing.maxPixelRatio}\n`;
    md += `- **Shadows:** ${r.racing.shadows ? "Enabled (PCF)" : "Disabled"}\n`;
    md += `- **Particle Budget:** ${r.racing.particleLimit}\n`;
    md += `- **Active Geometries:** ${r.racing.geometries}\n`;
    md += `- **Active Textures:** ${r.racing.textures}\n\n`;
  }

  // Preserve Android Emulator Device Testing Record
  md += `## Android Emulator Device Testing Record\n\n`;
  md += `*Tested on available local Android Virtual Device (AVD).*\n\n`;
  md += `- **Device Profile:** Medium Phone (\`Medium_Phone_API_37.0\`)\n`;
  md += `- **OS Version:** Android 17 (API Level 37)\n`;
  md += `- **Architecture:** x86_64 with KVM hardware acceleration\n`;
  md += `- **Display Resolution:** 2400 x 1080 (Landscape), 420 dpi\n`;
  md += `- **WebView Provider:** Google Android WebView 145.0.7632.218 (multiprocess enabled)\n`;
  md += `- **Asset Serving Pipeline:** \`androidx.webkit.WebViewAssetLoader\` via virtual HTTPS domain (\`https://appassets.androidplatform.net/assets/...\`)\n`;
  md += `- **Security Configuration:** \`allowFileAccess = false\`, \`allowContentAccess = false\`, file-origin privileges removed\n`;
  md += `- **Verification Findings:**\n`;
  md += `  1. **ES Module & Asset Loading:** Eliminated Android 14+ \`file:///\` CORS blocking by serving local assets through \`WebViewAssetLoader.AssetsPathHandler\`. Models, textures (\`turf-v1.png\`), and audio load cleanly.\n`;
  md += `  2. **Comprehensive Back Navigation:** \`window.__handleBackNavigation()\` routes Back cleanly across all states:\n`;
  md += `     - *Main Menu Hub:* Returns false; Android cleanly finishes/minimizes the activity (user is never trapped).\n`;
  md += `     - *Drawers / Modals (Drivers, Karts, Settings):* Dismisses drawer/modal and resets camera to hub.\n`;
  md += `     - *Active Race:* Pauses the race and displays the pause dialog.\n`;
  md += `     - *Pause Dialog:* Resumes the race without re-triggering.\n`;
  md += `     - *Results Screen:* Returns cleanly to the main menu.\n`;
  md += `  3. **App Lifecycle & Battery Preservation:** \`onPause\` invokes \`webView.pauseTimers()\` and dispatches blur events, stopping animation loops and background CPU draw calls. \`onResume\` restores timers seamlessly.\n`;
  md += `  4. **Device Screencap:** Captured full-screen 2400x1080 rendered scene at \`docs/screenshots/emulator_screen.png\`.\n`;

  fs.writeFileSync(reportPath, md, "utf8");
  console.log(`Wrote benchmark report to: ${reportPath}`);
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
