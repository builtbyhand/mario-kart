// Note: SwiftShader headless screenshots are software-rendered visual and geometric validation checks in CI, not Android GPU benchmarks.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const RACERS = [
  { id: "mario", prefix: "racer_01_mario" },
  { id: "luigi", prefix: "racer_02_luigi" },
  { id: "peach", prefix: "racer_03_peach" },
  { id: "yoshi", prefix: "racer_04_yoshi" },
  { id: "toad", prefix: "racer_05_toad" },
  { id: "bowser", prefix: "racer_06_bowser" },
  { id: "donkey-kong", prefix: "racer_07_donkey_kong" },
  { id: "koopa", prefix: "racer_08_koopa" },
];

const VIEWS = ["three_quarter", "side", "rear", "cockpit"];
const OUT_DIR = path.resolve("docs/screenshots/verification");

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Helper to validate PNG binary content
function validatePNGImage(buffer, expectedWidth = 1280, expectedHeight = 720) {
  if (!buffer || buffer.length < 50000) {
    return { valid: false, reason: `File size too small (${buffer?.length || 0} bytes)` };
  }
  // Check PNG signature
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < pngSig.length; i++) {
    if (buffer[i] !== pngSig[i]) {
      return { valid: false, reason: "Invalid PNG signature header" };
    }
  }
  // Read width and height from IHDR chunk (offset 16 and 20)
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width !== expectedWidth || height !== expectedHeight) {
    return { valid: false, reason: `Dimension mismatch: got ${width}x${height}, expected ${expectedWidth}x${expectedHeight}` };
  }
  return { valid: true, width, height };
}

// Static HTTP Server
const server = http.createServer((req, res) => {
  const file = path.join("app/src/main/assets/game", req.url.split("?")[0]);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    const ext = path.extname(file);
    const mime =
      ext === ".js"
        ? "application/javascript"
        : ext === ".html"
        ? "text/html"
        : ext === ".glb"
        ? "model/gltf-binary"
        : ext === ".png"
        ? "image/png"
        : "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    fs.createReadStream(file).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(8888, "127.0.0.1", async () => {
  console.log("Static verification server running on http://127.0.0.1:8888");

  const chrome = spawn("google-chrome", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-webgl",
    "--window-size=1280,720",
    "--remote-debugging-port=9222",
  ]);

  await new Promise((r) => setTimeout(r, 1200));

  const resp = await fetch("http://127.0.0.1:9222/json/list");
  const pages = await resp.json();
  const page = pages.find((p) => p.type === "page");
  if (!page) {
    console.error("Could not find chrome target page");
    chrome.kill();
    server.close();
    process.exit(1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let msgIdCounter = 1;
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const msgId = msgIdCounter++;
      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === msgId) {
          ws.removeEventListener("message", handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener("message", handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  let pageErrors = [];
  ws.addEventListener("message", (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.method === "Runtime.exceptionThrown") {
        pageErrors.push(msg.params.exceptionDetails?.text || "Runtime exception");
      }
    } catch (_) {}
  });

  await new Promise((r) => (ws.onopen = r));
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });

  let totalCaptured = 0;
  let failedCount = 0;
  const failureLog = [];

  for (const racer of RACERS) {
    for (const view of VIEWS) {
      pageErrors = [];
      const url = `http://127.0.0.1:8888/verify.html?racer=${racer.id}&view=${view}`;
      await send("Page.navigate", { url });

      let rendered = false;
      let renderError = null;
      let renderMetadata = null;

      // Poll up to 35 attempts (5.25 seconds)
      for (let attempt = 0; attempt < 35; attempt++) {
        await new Promise((r) => setTimeout(r, 150));

        const errRes = await send("Runtime.evaluate", { expression: "window.__RENDER_ERROR" });
        if (errRes?.result?.value) {
          renderError = errRes.result.value;
          break;
        }

        const doneRes = await send("Runtime.evaluate", { expression: "window.__RENDER_DONE" });
        if (doneRes?.result?.value === true) {
          const metaRes = await send("Runtime.evaluate", { expression: "JSON.stringify(window.__RENDER_METADATA || {})" });
          try {
            renderMetadata = JSON.parse(metaRes?.result?.value || "{}");
          } catch (_) {}
          rendered = true;
          break;
        }
      }

      // Check for errors or failure
      if (renderError || !rendered || pageErrors.length > 0) {
        const reason = renderError || (pageErrors.length > 0 ? pageErrors.join("; ") : "Rendering timed out");
        console.error(`[FAIL] ${racer.id} ${view}: ${reason}`);
        failedCount++;
        failureLog.push({ racer: racer.id, view, reason });
        continue; // Abort capture for failed combination
      }

      // Confirm association with correct racer and camera view
      if (renderMetadata?.racerId !== racer.id || renderMetadata?.viewType !== view) {
        const reason = `Metadata mismatch: expected ${racer.id}/${view}, got ${renderMetadata?.racerId}/${renderMetadata?.viewType}`;
        console.error(`[FAIL] ${racer.id} ${view}: ${reason}`);
        failedCount++;
        failureLog.push({ racer: racer.id, view, reason });
        continue;
      }

      // Capture screenshot
      const ss = await send("Page.captureScreenshot", { format: "png" });
      const imgBuf = Buffer.from(ss.data, "base64");

      // Verify dimensions and image content
      const validation = validatePNGImage(imgBuf, 1280, 720);
      if (!validation.valid) {
        console.error(`[FAIL] ${racer.id} ${view}: Invalid screenshot content (${validation.reason})`);
        failedCount++;
        failureLog.push({ racer: racer.id, view, reason: validation.reason });
        continue;
      }

      const filename = `${racer.prefix}_${view}.png`;
      const outPath = path.join(OUT_DIR, filename);
      fs.writeFileSync(outPath, imgBuf);
      const sizeKB = (imgBuf.length / 1024).toFixed(1);
      console.log(`[${++totalCaptured}/32] Verified & Captured ${filename} (${sizeKB} KB, 1280x720)`);
    }
  }

  ws.close();
  chrome.kill();
  server.close();

  console.log("\n=========================================");
  console.log(`Verification Summary: ${totalCaptured}/32 captured successfully. Failed renders: ${failedCount}`);
  console.log("=========================================\n");

  if (failedCount > 0 || totalCaptured !== 32) {
    console.error(`ERROR: Screenshot verification encountered ${failedCount} failures!`);
    for (const f of failureLog) {
      console.error(`  - ${f.racer} (${f.view}): ${f.reason}`);
    }
    process.exit(1);
  }

  console.log(`All 32 verification screenshots validated and saved to ${OUT_DIR}`);
  process.exit(0);
});
