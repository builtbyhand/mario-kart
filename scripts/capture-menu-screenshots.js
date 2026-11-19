// Capture high-definition 3D main menu verification screenshots in headless Chrome
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawn } from "node:child_process";

const OUT_DIR = path.resolve("docs/screenshots/menu");
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
  if (pb <= pb && pb <= pc) return b;
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

function validateMenuPNG(buffer, expectedWidth, expectedHeight) {
  if (!buffer || buffer.length < 30000) {
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

      // Check non-pure black background
      const isBlack = r < 5 && g < 5 && b < 5;
      if (!isBlack) nonBgCount++;

      // Quantize to 5-bit color buckets
      const bucket = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      colorBuckets.add(bucket);
    }

    const nonBgRatio = nonBgCount / totalPixels;
    const rMean = rSum / totalPixels;
    const gMean = gSum / totalPixels;
    const bMean = bSum / totalPixels;

    // Check color complexity
    if (colorBuckets.size < 200) {
      return { valid: false, reason: `Insufficient color complexity (${colorBuckets.size} unique 15-bit colors)` };
    }
    if (nonBgRatio < 0.20) {
      return { valid: false, reason: `Image appears mostly blank (${(nonBgRatio * 100).toFixed(1)}% visible pixels)` };
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
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split("?")[0];
  if (reqPath === "/") reqPath = "/index.html";
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

const HTTP_PORT = 8892;
const CDP_PORT = 9225;

server.listen(HTTP_PORT, "127.0.0.1", async () => {
  console.log(`Local HTTP server running on http://127.0.0.1:${HTTP_PORT} for 3D Menu verification`);

  const chromeFlags = [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
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
      if (msg.method === "Runtime.exceptionThrown") {
        console.error("Browser Exception:", JSON.stringify(msg.params.exceptionDetails));
      }
      if (msg.method === "Runtime.consoleAPICalled") {
        console.log("Browser Console:", msg.params.args.map(a => a.value || a.description).join(" "));
      }
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
  await send("Log.enable");

  async function evalCode(expression) {
    const res = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res?.result?.value;
  }

  // Navigate to main game index
  console.log("Navigating to http://127.0.0.1:" + HTTP_PORT + "/index.html ...");
  await send("Page.navigate", { url: `http://127.0.0.1:${HTTP_PORT}/index.html` });

  // Wait for 3D Menu Scene and models to be loaded and ready
  let isReady = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    await new Promise((r) => setTimeout(r, 300));
    const readyState = await evalCode(
      `Boolean(window.__race && window.__menuScene && window.__menuScene.showcaseModel)`
    );
    if (readyState) {
      isReady = true;
      break;
    }
  }

  if (!isReady) {
    console.error("[FAIL] 3D Menu Scene failed to initialize in time.");
    chrome.kill();
    server.close();
    process.exit(1);
  }
  console.log("3D Menu Scene successfully initialized and active.");

  // Allow frames for animation and shader warmup
  await new Promise((r) => setTimeout(r, 800));

  const CAPTURES = [
    {
      id: "hub",
      filename: "menu_01_main_hub.png",
      width: 1280,
      height: 720,
      description: "Main HD 3D menu hub with Mario in Red Speedster, stadium lighting, motes, and HUD overlay",
      setup: async () => {
        await evalCode(`
          window.__menuCamera.setMode('hub');
          document.getElementById('drawer-drivers').hidden = true;
          document.getElementById('drawer-karts').hidden = true;
          document.getElementById('modal-settings').hidden = true;
          document.getElementById('intro').classList.remove('menu-hidden');
        `);
      },
    },
    {
      id: "driver_showcase",
      filename: "menu_02_character_showcase.png",
      width: 1280,
      height: 720,
      description: "Driver selection drawer opened with close-up driver framing and character cards",
      setup: async () => {
        await evalCode(`
          window.__menuCamera.setMode('driver');
          document.getElementById('drawer-drivers').hidden = false;
          document.getElementById('drawer-karts').hidden = true;
          document.getElementById('modal-settings').hidden = true;
        `);
      },
    },
    {
      id: "kart_showcase",
      filename: "menu_03_kart_showcase.png",
      width: 1280,
      height: 720,
      description: "Kart selection drawer with live 3D kart swap (Cyber Beast sports racer) and kart stats",
      setup: async () => {
        await evalCode(`
          window.__chooseKart('cyber-beast');
          window.__menuCamera.setMode('kart');
          document.getElementById('drawer-drivers').hidden = true;
          document.getElementById('drawer-karts').hidden = false;
          document.getElementById('modal-settings').hidden = true;
        `);
      },
    },
    {
      id: "settings_graphics",
      filename: "menu_04_settings_graphics.png",
      width: 1280,
      height: 720,
      description: "Settings modal displaying Graphics quality presets, bloom and shadow toggles",
      setup: async () => {
        await evalCode(`
          document.getElementById('drawer-drivers').hidden = true;
          document.getElementById('drawer-karts').hidden = true;
          document.getElementById('modal-settings').hidden = false;
          document.getElementById('tab-btn-graphics').classList.add('active');
          document.getElementById('tab-btn-audio').classList.remove('active');
          document.getElementById('settings-graphics-panel').hidden = false;
          document.getElementById('settings-audio-panel').hidden = true;
          window.__menuCamera.setMode('settings');
        `);
      },
    },
    {
      id: "settings_audio",
      filename: "menu_05_settings_audio.png",
      width: 1280,
      height: 720,
      description: "Settings modal displaying Audio volume controls and mute toggles",
      setup: async () => {
        await evalCode(`
          document.getElementById('tab-btn-audio').classList.add('active');
          document.getElementById('tab-btn-graphics').classList.remove('active');
          document.getElementById('settings-audio-panel').hidden = false;
          document.getElementById('settings-graphics-panel').hidden = true;
        `);
      },
    },
    {
      id: "camera_orbit",
      filename: "menu_06_camera_orbit.png",
      width: 1280,
      height: 720,
      description: "360-degree interactive camera orbit inspection showing rear 3/4 dramatic angle",
      setup: async () => {
        await evalCode(`
          document.getElementById('modal-settings').hidden = true;
          window.__menuCamera.setMode('hub');
          window.__menuCamera.theta = 2.45;
          window.__menuCamera.phi = 1.35;
          window.__menuCamera.radius = 4.2;
        `);
      },
    },
    {
      id: "transition_gameplay",
      filename: "menu_07_transition_gameplay.png",
      width: 1280,
      height: 720,
      description: "Cinematic camera swoop mid-transition from 3D menu turntable to race starting grid",
      setup: async () => {
        await evalCode(`
          window.__chooseKart('kart-oobi');
          window.__chooseDriver('mario');
          const p = window.__race.player;
          const eye = new THREE.Vector3(p.x - 12, p.y + 6, p.z + 8);
          const aim = new THREE.Vector3(p.x, p.y + 0.5, p.z);
          window.__menuCamera.startTransitionToGameplay(eye, aim, 1.5, () => {});
          window.__menuCamera.transitionProgress = 0.55;
          document.getElementById('intro').classList.add('menu-hidden');
        `);
      },
    },
    {
      id: "mobile_landscape",
      filename: "menu_08_landscape_mobile_1280x720.png",
      width: 1280,
      height: 720,
      description: "Standard mobile landscape layout (1280x720) with full HUD and responsive framing",
      setup: async () => {
        await evalCode(`
          window.__menuCamera.isTransitioning = false;
          window.__menuCamera.setMode('hub');
          document.getElementById('intro').classList.remove('menu-hidden');
          document.getElementById('drawer-drivers').hidden = true;
          document.getElementById('drawer-karts').hidden = true;
          document.getElementById('modal-settings').hidden = true;
        `);
      },
    },
    {
      id: "compact_landscape",
      filename: "menu_09_landscape_compact_800x480.png",
      width: 800,
      height: 480,
      description: "Compact phone landscape layout (800x480) demonstrating responsive UI scaling",
      setup: async () => {
        await evalCode(`
          window.__menuCamera.setMode('hub');
          document.getElementById('intro').classList.remove('menu-hidden');
          window.dispatchEvent(new Event('resize'));
        `);
      },
    },
    {
      id: "tablet_landscape",
      filename: "menu_10_tablet_1024x768.png",
      width: 1024,
      height: 768,
      description: "Tablet 4:3 landscape layout (1024x768) with expansive view of the 3D stadium",
      setup: async () => {
        await evalCode(`
          window.__menuCamera.setMode('hub');
          document.getElementById('intro').classList.remove('menu-hidden');
          window.dispatchEvent(new Event('resize'));
        `);
      },
    },
  ];

  let totalCaptured = 0;

  for (const cap of CAPTURES) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: cap.width,
      height: cap.height,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await cap.setup();
    // Allow animation step and render update
    await new Promise((r) => setTimeout(r, 400));

    const ss = await send("Page.captureScreenshot", { format: "png" });
    const imgBuf = Buffer.from(ss.data, "base64");

    const val = validateMenuPNG(imgBuf, cap.width, cap.height);
    if (!val.valid) {
      console.error(`[FAIL] Validation failed for ${cap.filename}: ${val.reason}`);
      chrome.kill();
      server.close();
      process.exit(1);
    }

    const outPath = path.join(OUT_DIR, cap.filename);
    fs.writeFileSync(outPath, imgBuf);
    const sizeKB = (imgBuf.length / 1024).toFixed(1);

    console.log(
      `[${++totalCaptured}/${CAPTURES.length}] Captured & Verified ${cap.filename} (${sizeKB} KB, ${cap.width}x${cap.height}) | ` +
      `Visible: ${val.nonBgPercent}% | Colors: ${val.uniqueColors} | RGB: ${val.avgRgb}`
    );
  }

  ws.close();
  chrome.kill();
  server.close();

  console.log(`\n=========================================`);
  console.log(`Menu Screenshots: ${totalCaptured}/${CAPTURES.length} captured and verified to ${OUT_DIR}`);
  console.log(`*Note: SwiftShader headless captures validate visual scene geometry and UI in CI, not Android GPU performance.*`);
  console.log(`=========================================\n`);

  if (totalCaptured !== CAPTURES.length) {
    process.exit(1);
  }
  process.exit(0);
});
