// Capture high-definition environment verification screenshots in headless Chrome
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawn } from "node:child_process";

const VIEWS = [
  { id: "overview", filename: "track_overview.png", description: "Full track panoramic overview showing complete circuit, stadium bowl, and skyline" },
  { id: "surface", filename: "track_surface_curbs.png", description: "Track surface close-up showing pavement texture, curbs, edge lines, and apex pylon" },
  { id: "details", filename: "environment_details.png", description: "Trackside details showing grandstands, barriers, safety fencing, and pit buildings" },
  { id: "skyline", filename: "stadium_skyline.png", description: "Stadium backdrop showing commercial skyscrapers, floodlight pylons, and night sky" },
  { id: "elevation", filename: "track_elevation_hairpin.png", description: "Track elevation climb showing anti-gravity banked road, piers, and mountain pines" },
  { id: "action", filename: "kart_racing_action.png", description: "Kart driving through the environment with driver, dynamic lighting, and start gantry" },
];

const OUT_DIR = path.resolve("docs/screenshots/environment");
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// PNG scanline reconstruction & verification
function paethPredictor(a, b, c) {
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
      const c = (y > 0 && i >= bytesPerPixel) ? reconstructed[prevRowOffset + i - bytesPerPixel] : 0;

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

function validateEnvironmentPNG(buffer, expectedWidth = 1280, expectedHeight = 720) {
  if (!buffer || buffer.length < 50000) {
    return { valid: false, reason: `File size too small (${buffer?.length || 0} bytes)` };
  }

  // 1. PNG Header Signature
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < pngSig.length; i++) {
    if (buffer[i] !== pngSig[i]) {
      return { valid: false, reason: "Invalid PNG signature header" };
    }
  }

  // 2. Parse chunks for IHDR dimensions and IDAT
  let offset = 8;
  const idatChunks = [];
  let width = 0, height = 0, colorType = 0;

  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) break;
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);

    if (type === "IHDR") {
      width = buffer.readUInt32BE(offset + 8);
      height = buffer.readUInt32BE(offset + 12);
      colorType = buffer.readUInt8(offset + 17);
    } else if (type === "IDAT") {
      idatChunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  if (width !== expectedWidth || height !== expectedHeight) {
    return { valid: false, reason: `Dimensions ${width}x${height} != expected ${expectedWidth}x${expectedHeight}` };
  }

  // 3. Decompress and reconstruct scanlines
  try {
    const uncompressed = zlib.inflateSync(Buffer.concat(idatChunks));
    const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 4;
    const stride = 1 + width * bytesPerPixel;
    const expectedUncompressedLength = height * stride;

    if (uncompressed.length !== expectedUncompressedLength) {
      return { valid: false, reason: `Corrupted scanline data: expected ${expectedUncompressedLength}, got ${uncompressed.length}` };
    }

    const pixels = reconstructPNGScanlines(uncompressed, width, height, bytesPerPixel);
    const totalPixels = width * height;
    let nonBgCount = 0;
    const colorBuckets = new Set();
    let rSum = 0, gSum = 0, bSum = 0;

    for (let p = 0; p < totalPixels; p++) {
      const idx = p * bytesPerPixel;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      rSum += r;
      gSum += g;
      bSum += b;

      // Background is night sky #0c1420 (~12, 20, 32)
      const isBg = Math.hypot(r - 12, g - 20, b - 32) < 12;
      if (!isBg) nonBgCount++;

      // Quantize to 5-bit color buckets
      const bucket = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      colorBuckets.add(bucket);
    }

    const nonBgRatio = nonBgCount / totalPixels;
    const rMean = rSum / totalPixels;
    const gMean = gSum / totalPixels;
    const bMean = bSum / totalPixels;

    // Check color complexity
    if (colorBuckets.size < 250) {
      return { valid: false, reason: `Insufficient color complexity (${colorBuckets.size} unique 15-bit colors)` };
    }
    if (nonBgRatio < 0.10) {
      return { valid: false, reason: `Image appears mostly blank/background (${(nonBgRatio * 100).toFixed(1)}% non-background pixels)` };
    }

    return {
      valid: true,
      nonBgPercent: (nonBgRatio * 100).toFixed(1),
      uniqueColors: colorBuckets.size,
      avgRgb: `(${rMean.toFixed(0)}, ${gMean.toFixed(0)}, ${bMean.toFixed(0)})`,
    };
  } catch (err) {
    return { valid: false, reason: "Decompression error: " + err.message };
  }
}

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split("?")[0];
  if (reqPath === "/") reqPath = "/verify-environment.html";
  const filePath = path.join("app/src/main/assets/game", reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end("Not Found: " + reqPath);
  }
});

server.listen(8889, "127.0.0.1", async () => {
  console.log("Local HTTP server running on http://127.0.0.1:8889 for environment verification");

  const chromeFlags = [
    "--headless=new",
    "--remote-debugging-port=9223",
    "--no-sandbox",
    "--disable-gpu-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--window-size=1280,720",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--disable-translate",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
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
      const res = await fetch("http://127.0.0.1:9223/json");
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
    console.error("Could not connect to Chrome debugging port 9223");
    chrome.kill();
    server.close();
    process.exit(1);
  }

  console.log("Connected to Chrome via WebSocket:", wsUrl);
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

  let totalCaptured = 0;
  for (const view of VIEWS) {
    const url = `http://127.0.0.1:8889/verify-environment.html?view=${view.id}`;
    await send("Page.navigate", { url });

    let rendered = false;
    let renderError = null;

    for (let attempt = 0; attempt < 50; attempt++) {
      await new Promise((r) => setTimeout(r, 200));

      const errRes = await send("Runtime.evaluate", { expression: "window.__RENDER_ERROR" });
      if (errRes?.result?.value) {
        renderError = errRes.result.value;
        break;
      }

      const doneRes = await send("Runtime.evaluate", { expression: "window.__RENDER_DONE" });
      if (doneRes?.result?.value === true) {
        rendered = true;
        break;
      }
    }

    if (renderError || !rendered) {
      console.error(`[FAIL] Environment view ${view.id}: ${renderError || "Rendering timed out"}`);
      continue;
    }

    const metaRes = await send("Runtime.evaluate", {
      expression: "window.__RENDER_METADATA",
      returnByValue: true,
    });
    const metadata = metaRes?.result?.value || {};

    const ss = await send("Page.captureScreenshot", { format: "png" });
    const imgBuf = Buffer.from(ss.data, "base64");

    // Validate PNG data integrity and visual non-blank content
    const val = validateEnvironmentPNG(imgBuf, 1280, 720);
    if (!val.valid) {
      console.error(`[FAIL] Screenshot validation failed for ${view.filename}: ${val.reason}`);
      chrome.kill();
      server.close();
      process.exit(1);
    }

    const outPath = path.join(OUT_DIR, view.filename);
    fs.writeFileSync(outPath, imgBuf);
    const sizeKB = (imgBuf.length / 1024).toFixed(1);
    console.log(
      `[${++totalCaptured}/${VIEWS.length}] Captured & Verified ${view.filename} (${sizeKB} KB, 1280x720) | ` +
      `Non-Bg: ${val.nonBgPercent}% | Colors: ${val.uniqueColors} | ` +
      `Draw Calls: ${metadata.drawCalls || 'N/A'}, Triangles: ${metadata.triangles || 'N/A'}`
    );
  }

  ws.close();
  chrome.kill();
  server.close();

  console.log(`\n=========================================`);
  console.log(`Environment Screenshots: ${totalCaptured}/${VIEWS.length} verified and captured to ${OUT_DIR}`);
  console.log(`*Note: SwiftShader headless captures validate visual scene geometry in CI, not Android GPU performance.*`);
  console.log(`=========================================\n`);

  if (totalCaptured !== VIEWS.length) {
    process.exit(1);
  }
  process.exit(0);
});
