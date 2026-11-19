/**
 * Automated Capture Script for Phase 8 Production Release Visual Evidence.
 * Headless Visual Regression Captures (1280 × 720 HD Landscape, Chromium SwiftShader).
 * Captures all 8 required categories directly from live game rendering:
 * 1. Main menu
 * 2. Character showcase pedestal
 * 3. Kart customization showcase
 * 4. Scalable graphics & audio settings
 * 5. Racing gameplay & track environment
 * 6. Third-person chase camera behavior
 * 7. Touch HUD and control overlay layout
 * 8. Race completion and standings results screen
 *
 * NOTE: These screenshots validate visual layout, shaders, asset presentation,
 * and HUD styling. Gameplay mechanics (touch lifecycle, physics, barrier seams,
 * loop closure) are verified separately by automated unit and integration suites.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawn } from "node:child_process";

const OUT_DIR = path.resolve("docs/screenshots/release");
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

export function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function reconstructPNGScanlines(rawBuffer, width, height, bytesPerPixel) {
  const stride = 1 + width * bytesPerPixel;
  const reconstructed = Buffer.alloc(width * height * bytesPerPixel);

  for (let y = 0; y < height; y++) {
    const filter = rawBuffer[y * stride];
    const prevRowOffset = (y - 1) * width * bytesPerPixel;
    const currRowOffset = y * width * bytesPerPixel;
    const rawLineOffset = y * stride + 1;

    for (let i = 0; i < width * bytesPerPixel; i++) {
      const rawVal = rawBuffer[rawLineOffset + i];
      const a = i >= bytesPerPixel ? reconstructed[currRowOffset + i - bytesPerPixel] : 0;
      const b = y > 0 ? reconstructed[prevRowOffset + i] : 0;
      const c = y > 0 && i >= bytesPerPixel ? reconstructed[prevRowOffset + i - bytesPerPixel] : 0;

      let val;
      if (filter === 0) val = rawVal;
      else if (filter === 1) val = (rawVal + a) & 0xff;
      else if (filter === 2) val = (rawVal + b) & 0xff;
      else if (filter === 3) val = (rawVal + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) val = (rawVal + paethPredictor(a, b, c)) & 0xff;
      else throw new Error("Unsupported PNG filter type: " + filter);

      reconstructed[currRowOffset + i] = val;
    }
  }
  return reconstructed;
}

function validatePNG(buffer, expectedWidth, expectedHeight) {
  if (!buffer || buffer.length < 20000) {
    return { valid: false, reason: `File size too small (${buffer?.length || 0} bytes)` };
  }
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < pngSig.length; i++) {
    if (buffer[i] !== pngSig[i]) {
      return { valid: false, reason: "Invalid PNG signature header" };
    }
  }
  let offset = 8;
  const idatChunks = [];
  let width = 0;
  let height = 0;
  let colorType = 6;

  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) break;
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data.readUInt8(9);
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  if (width !== expectedWidth || height !== expectedHeight) {
    return { valid: false, reason: `Dimension mismatch: expected ${expectedWidth}x${expectedHeight}, got ${width}x${height}` };
  }

  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 4;
  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
  const pixels = reconstructPNGScanlines(decompressed, width, height, bytesPerPixel);
  let nonBgPixels = 0;
  const colorSet = new Set();

  for (let i = 0; i < pixels.length; i += bytesPerPixel) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = bytesPerPixel === 4 ? pixels[i + 3] : 255;
    if (a > 10 && !(r < 15 && g < 15 && b < 15)) {
      nonBgPixels++;
    }
    const colorKey = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    colorSet.add(colorKey);
  }

  const totalPixels = width * height;
  const visibleFraction = nonBgPixels / totalPixels;
  if (visibleFraction < 0.05) {
    return { valid: false, reason: `Under-rendered or empty screen (${(visibleFraction * 100).toFixed(1)}% visible)` };
  }
  if (colorSet.size < 100) {
    return { valid: false, reason: `Insufficient color complexity (${colorSet.size} unique colors)` };
  }

  return { valid: true, width, height, visibleFraction, colors: colorSet.size };
}

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".glb": "model/gltf-binary",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
};

const PORT = 8896;
const CDP_PORT = 9226;
const GAME_DIR = path.resolve("app/src/main/assets/game");

const server = http.createServer((req, res) => {
  const urlPath = req.url.split("?")[0];
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(GAME_DIR, safePath === "/" ? "index.html" : safePath);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    "Access-Control-Allow-Origin": "*",
  });
  fs.createReadStream(filePath).pipe(res);
});

async function main() {
  console.log("===============================================================================");
  console.log(" Phase 8 Production Release Visual Evidence Capture");
  console.log("===============================================================================\n");

  await new Promise((r) => server.listen(PORT, r));
  console.log(`HTTP Server running at http://127.0.0.1:${PORT}`);

  const chrome = spawn("/usr/bin/google-chrome-stable", [
    "--headless=new",
    "--disable-gpu",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    `--remote-debugging-port=${CDP_PORT}`,
    "--window-size=1280,720",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "about:blank",
  ]);

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
      const tabs = await res.json();
      if (tabs[0]?.webSocketDebuggerUrl) {
        wsUrl = tabs[0].webSocketDebuggerUrl;
        break;
      }
    } catch (_) {}
  }

  if (!wsUrl) {
    throw new Error(`Failed to connect to headless Chrome on port ${CDP_PORT}`);
  }

  const ws = new WebSocket(wsUrl);
  let id = 1;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const curId = id++;
      pending.set(curId, resolve);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.id && pending.has(msg.id)) {
        const resolve = pending.get(msg.id);
        pending.delete(msg.id);
        resolve(msg.result);
      }
    } catch (_) {}
  };

  await new Promise((r) => (ws.onopen = r));
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });

  async function evaluate(expr) {
    const res = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
    return res?.result?.value;
  }

  async function captureScreenshot(filename) {
    const shot = await send("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(shot.data, "base64");
    const val = validatePNG(buffer, 1280, 720);
    if (!val.valid) {
      throw new Error(`Validation failed for ${filename}: ${val.reason}`);
    }
    const filePath = path.join(OUT_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    console.log(`  [CAPTURED] ${filename} (${(buffer.length / 1024).toFixed(1)} KB, Colors: ${val.colors})`);
    return { filename, bytes: buffer.length, colors: val.colors };
  }

  // Load game with evidence harness enabled
  console.log("Loading Mario Kart (1280x720 Headless SwiftShader)...");
  await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html?quality=high&evidence=1` });

  // Wait for 3D menu scene ready
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 400));
    const ready = await evaluate("Boolean(window.__menuScene && window.__menuCamera)");
    if (ready) break;
  }
  await new Promise((r) => setTimeout(r, 2000));

  const captures = [];

  // 1. Main Menu
  console.log("\n1. Capturing Main Menu (1280x720)...");
  captures.push(await captureScreenshot("01_main_menu.png"));

  // 2. Character Showcase
  console.log("\n2. Capturing Character Showcase (1280x720)...");
  await evaluate("document.getElementById('nav-btn-drivers')?.click();");
  await new Promise((r) => setTimeout(r, 1200));
  captures.push(await captureScreenshot("02_character_showcase.png"));

  // 3. Kart Showcase
  console.log("\n3. Capturing Kart Showcase (1280x720)...");
  await evaluate("document.getElementById('nav-btn-karts')?.click();");
  await new Promise((r) => setTimeout(r, 1200));
  captures.push(await captureScreenshot("03_kart_showcase.png"));

  // 4. Graphics Settings
  console.log("\n4. Capturing Graphics Settings (1280x720)...");
  await evaluate("document.getElementById('nav-btn-settings')?.click();");
  await new Promise((r) => setTimeout(r, 800));
  captures.push(await captureScreenshot("04_graphics_settings.png"));

  // Close modal, return to hub
  await evaluate("document.getElementById('btn-close-settings')?.click();");
  await new Promise((r) => setTimeout(r, 600));

  // 5. Active Gameplay & Racing Environment
  console.log("\n5. Capturing Active Gameplay & Racing Action (1280x720)...");
  await evaluate("window.__begin();");
  await new Promise((r) => setTimeout(r, 3500));
  captures.push(await captureScreenshot("05_gameplay_action.png"));

  // 6. Camera Behavior (Chase camera)
  console.log("\n6. Capturing Camera Behavior (1280x720)...");
  await new Promise((r) => setTimeout(r, 1500));
  captures.push(await captureScreenshot("06_camera_chase.png"));

  // 7. HUD and Controls (touch controls naturally visible during active race on non-TV)
  console.log("\n7. Capturing HUD and Controls Layout (1280x720)...");
  await new Promise((r) => setTimeout(r, 500));
  captures.push(await captureScreenshot("07_hud_and_controls.png"));

  // 8. Race Finish / Results Screen (natural CPU completion via evidence harness)
  console.log("\n8. Capturing Genuine Race Finish Results Screen (1280x720)...");
  await evaluate("if (window.__kart && window.__kart.capture) window.__kart.capture('results');");
  // Allow presentation animation and standings population to finish
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const done = await evaluate("Boolean(document.getElementById('again') && !document.getElementById('again').disabled)");
    if (done) break;
  }
  await new Promise((r) => setTimeout(r, 600));
  captures.push(await captureScreenshot("08_race_finish_results.png"));

  ws.close();
  chrome.kill();
  server.close();

  console.log("\n===============================================================================");
  console.log(` Successfully captured and verified ${captures.length}/8 release screenshots!`);
  console.log(` Saved to: ${OUT_DIR}`);
  console.log("===============================================================================\n");
}

main().catch((err) => {
  console.error("Release screenshot capture failed:", err);
  process.exit(1);
});
