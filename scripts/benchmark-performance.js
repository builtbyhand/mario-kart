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

    // Start race and benchmark racing performance
    await send("Runtime.evaluate", {
      expression: "if (typeof window.__begin === 'function') window.__begin();",
    });

    // Run race simulation for 6 seconds under SwiftShader
    await new Promise((r) => setTimeout(r, 6000));

    const racePerfRes = await send("Runtime.evaluate", {
      expression: "window.__getPerfMetrics()",
      returnByValue: true,
    });
    const racePerf = racePerfRes?.result?.value || menuPerf;

    results.push({
      preset,
      loadTimeMs,
      menu: menuPerf,
      racing: racePerf,
    });

    console.log(`    - Menu:   ${menuPerf.fps} FPS (${menuPerf.meanMs} ms) | Draws: ${menuPerf.drawCalls} | Tris: ${menuPerf.triangles.toLocaleString()}`);
    console.log(`    - Racing: ${racePerf.fps} FPS (Mean: ${racePerf.meanMs} ms, P95: ${racePerf.p95Ms} ms, Min: ${racePerf.minMs} ms, Max: ${racePerf.maxMs} ms) | Draws: ${racePerf.drawCalls} | Tris: ${racePerf.triangles.toLocaleString()}`);
  }

  ws.close();
  chrome.kill();
  server.close();

  // Print Summary Table
  console.log("\n==========================================================================================================");
  console.log(" FINAL PERFORMANCE BENCHMARK SUMMARY TABLE (Measured via SwiftShader Headless)");
  console.log("==========================================================================================================");
  console.log(
    "Preset".padEnd(8) +
    " | " + "Load Time".padStart(9) +
    " | " + "Menu FPS".padStart(8) +
    " | " + "Race FPS".padStart(8) +
    " | " + "Mean ms".padStart(8) +
    " | " + "P95 ms".padStart(7) +
    " | " + "P99 ms".padStart(7) +
    " | " + "Draw Calls".padStart(10) +
    " | " + "Triangles".padStart(10) +
    " | " + "Target Budget".padEnd(16)
  );
  console.log("-".repeat(106));

  for (const r of results) {
    const budgetStatus = r.racing.p95Ms <= 16.67 ? "60 FPS Target OK" : r.racing.p95Ms <= 33.33 ? "30 FPS Fallback OK" : "Needs Tuning";
    console.log(
      r.preset.toUpperCase().padEnd(8) +
      " | " + `${r.loadTimeMs} ms`.padStart(9) +
      " | " + `${r.menu.fps}`.padStart(8) +
      " | " + `${r.racing.fps}`.padStart(8) +
      " | " + `${r.racing.meanMs}`.padStart(8) +
      " | " + `${r.racing.p95Ms}`.padStart(7) +
      " | " + `${r.racing.p99Ms}`.padStart(7) +
      " | " + `${r.racing.drawCalls}`.padStart(10) +
      " | " + `${r.racing.triangles.toLocaleString()}`.padStart(10) +
      " | " + budgetStatus.padEnd(16)
    );
  }
  console.log("==========================================================================================================\n");

  // Output markdown report file
  const reportPath = path.join(ROOT_DIR, "docs/BENCHMARK_RESULTS.md");
  let md = "# Phase 7 — Performance Benchmark Results\n\n";
  md += `**Date:** ${new Date().toISOString()}\n`;
  md += `**Environment:** Linux x86_64 Headless Chrome (SwiftShader ANGLE WebGL2)\n`;
  md += `**Screen Resolution:** 1280x720 (Landscape)\n\n`;
  md += "## Preset Measurements\n\n";
  md += "| Preset | Load Time | Menu FPS | Racing FPS | Mean Frame Time | P95 Frame Time | P99 Frame Time | Draw Calls | Triangles | Target Budget Status |\n";
  md += "| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |\n";
  for (const r of results) {
    const budgetStatus = r.racing.p95Ms <= 16.67 ? "60 FPS Budget (<= 16.67ms)" : r.racing.p95Ms <= 33.33 ? "30 FPS Fallback (<= 33.33ms)" : "Over budget";
    md += `| **${r.preset.toUpperCase()}** | ${r.loadTimeMs} ms | ${r.menu.fps} | ${r.racing.fps} | ${r.racing.meanMs} ms | ${r.racing.p95Ms} ms | ${r.racing.p99Ms} ms | ${r.racing.drawCalls} | ${r.racing.triangles.toLocaleString()} | ${budgetStatus} |\n`;
  }
  md += "\n## Memory and Texture Profiles\n\n";
  for (const r of results) {
    md += `### ${r.preset.toUpperCase()}\n`;
    md += `- **Resolution Scale:** ${r.racing.resolutionScale}\n`;
    md += `- **Max Pixel Ratio:** ${r.racing.maxPixelRatio}\n`;
    md += `- **Shadows:** ${r.racing.shadows ? "Enabled (PCF)" : "Disabled"}\n`;
    md += `- **Particle Budget:** ${r.racing.particleLimit}\n`;
    md += `- **Active Geometries:** ${r.racing.geometries}\n`;
    md += `- **Active Textures:** ${r.racing.textures}\n\n`;
  }
  fs.writeFileSync(reportPath, md, "utf8");
  console.log(`Wrote benchmark report to: ${reportPath}`);
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
