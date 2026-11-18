// Note: SwiftShader headless screenshots are software-rendered visual and geometric validation checks in CI, not Android GPU benchmarks.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
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

// Helper functions to reconstruct PNG scanlines and validate rendered visual content
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

function isEnvironmentPixel(r, g, b) {
  // Clear sky (#141e2e -> ~20, ~30, ~46)
  if (Math.hypot(r - 20, g - 30, b - 46) < 14) return true;
  // Slate ground floor & grid lines under studio lighting:
  // Characterized by blue-dominant slate grey where B is highest channel and saturation is low
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const sat = maxC - minC;
  if (r < 85 && g < 95 && b < 125 && b > r + 10 && b >= g && sat < 60) {
    return true;
  }
  return false;
}

function validatePNGImage(buffer, expectedWidth = 1280, expectedHeight = 720, viewType = "three_quarter") {
  if (!buffer || buffer.length < 50000) {
    return { valid: false, reason: `File size too small (${buffer?.length || 0} bytes)` };
  }

  // 1. Check PNG signature
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < pngSig.length; i++) {
    if (buffer[i] !== pngSig[i]) {
      return { valid: false, reason: "Invalid PNG signature header" };
    }
  }

  // 2. Parse chunks to extract dimensions and image data
  let offset = 8;
  const idatChunks = [];
  let width = 0;
  let height = 0;
  let colorType = 0;

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
    return {
      valid: false,
      reason: `Dimension mismatch: got ${width}x${height}, expected ${expectedWidth}x${expectedHeight}`,
    };
  }

  // 3. Decompress IDAT chunks and de-filter scanlines to reconstruct true RGB pixel buffer
  try {
    const uncompressed = zlib.inflateSync(Buffer.concat(idatChunks));
    const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 4;
    const stride = 1 + width * bytesPerPixel;
    const expectedUncompressedLength = height * stride;

    if (uncompressed.length !== expectedUncompressedLength) {
      return {
        valid: false,
        reason: `Corrupted scanline data: expected ${expectedUncompressedLength} bytes, got ${uncompressed.length}`,
      };
    }

    const pixels = reconstructPNGScanlines(uncompressed, width, height, bytesPerPixel);
    const isCockpit = viewType === "cockpit";

    // 4. Background clear color verification in sky margins
    // For exterior views, top corners must match scene clear background (#141e2e -> ~20, ~30, ~46)
    if (!isCockpit) {
      const tlDiff = Math.hypot(pixels[0] - 20, pixels[1] - 30, pixels[2] - 46);
      const trIdx = (width - 1) * bytesPerPixel;
      const trDiff = Math.hypot(pixels[trIdx] - 20, pixels[trIdx + 1] - 30, pixels[trIdx + 2] - 46);
      if (tlDiff > 12 || trDiff > 12) {
        return {
          valid: false,
          reason: `Exterior background corners do not match scene clear color (#141e2e)`,
        };
      }

      // Upper sky margins (x < 150 or x > 1130, y < 150) must remain clear background
      let marginArtifacts = 0;
      for (let y = 0; y < 150; y += 4) {
        for (const x of [10, 50, 100, 1180, 1230, 1270]) {
          const idx = (y * width + x) * bytesPerPixel;
          if (Math.hypot(pixels[idx] - 20, pixels[idx + 1] - 30, pixels[idx + 2] - 46) > 10) {
            marginArtifacts++;
          }
        }
      }
      if (marginArtifacts > 0) {
        return { valid: false, reason: `Sky margins contain unexpected render artifacts` };
      }
    }

    // 5. Detect actual 3D kart chassis and driver character geometry
    // Distinguishes the model from both the background sky and the slate ground floor / grid lines
    let totalModelPixels = 0;
    let driverRegionPixels = 0;
    let chassisRegionPixels = 0;
    const colorSet = new Set();

    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width; x += 4) {
        const idx = (y * width + x) * bytesPerPixel;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        if (!isEnvironmentPixel(r, g, b)) {
          totalModelPixels++;
          colorSet.add((r << 16) | (g << 8) | b);
          // Upper-center where the driver character (head, cap, shoulders, face) is positioned
          if (x >= 350 && x <= 930 && y >= 120 && y <= 420) {
            driverRegionPixels++;
          }
          // Lower-center where the kart chassis (bodywork, bumper, side pods, wheels) is positioned
          if (x >= 250 && x <= 1050 && y >= 350 && y <= 620) {
            chassisRegionPixels++;
          }
        }
      }
    }

    if (colorSet.size < 400) {
      return {
        valid: false,
        reason: `Render content lacks visual depth (only ${colorSet.size} distinct colors; expected >= 400)`,
      };
    }

    if (totalModelPixels < 12000) {
      return {
        valid: false,
        reason: `Actual 3D vehicle/driver model not detected (only ${totalModelPixels} non-environment model pixels detected; expected >= 12000)`,
      };
    }

    if (!isCockpit) {
      if (driverRegionPixels < 3500) {
        return {
          valid: false,
          reason: `Driver character not detected in upper cockpit region (only ${driverRegionPixels} driver pixels; expected >= 3500)`,
        };
      }
      if (chassisRegionPixels < 3500) {
        return {
          valid: false,
          reason: `Kart chassis not detected in vehicle body region (only ${chassisRegionPixels} chassis pixels; expected >= 3500)`,
        };
      }
    } else {
      if (driverRegionPixels < 8000 || chassisRegionPixels < 10000) {
        return {
          valid: false,
          reason: `Cockpit view does not contain expected driver and cockpit interior geometry (driver=${driverRegionPixels}, chassis=${chassisRegionPixels})`,
        };
      }
    }
  } catch (err) {
    return { valid: false, reason: `Failed to decompress and inspect PNG image data: ${err.message}` };
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

  const chromeBin =
    process.env.CHROME_BIN ||
    (fs.existsSync("/usr/bin/google-chrome")
      ? "/usr/bin/google-chrome"
      : fs.existsSync("/usr/bin/chromium-browser")
      ? "/usr/bin/chromium-browser"
      : "google-chrome");

  const chrome = spawn(chromeBin, [
    "--headless=new",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-gpu-sandbox",
    "--disable-dev-shm-usage",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--enable-webgl",
    "--window-size=1280,720",
    "--remote-debugging-port=9222",
  ]);

  chrome.on("error", (err) => {
    console.error("[Chrome Process Error]", err);
  });

  chrome.stderr.on("data", (d) => {
    const s = d.toString();
    if (s.includes("ERROR:") || s.includes("FATAL:")) {
      console.error("[Chrome STDERR]", s.trim());
    }
  });

  let page = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const resp = await fetch("http://127.0.0.1:9222/json/list");
      if (resp.ok) {
        const pages = await resp.json();
        page = pages.find((p) => p.type === "page");
        if (page) break;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 250));
  }

  if (!page) {
    console.error("Could not connect to Chrome debugging port 9222 after waiting");
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
      const validation = validatePNGImage(imgBuf, 1280, 720, view);
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
