// Capture high-definition environment verification screenshots in headless Chrome
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
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

    const ss = await send("Page.captureScreenshot", { format: "png" });
    const imgBuf = Buffer.from(ss.data, "base64");

    const outPath = path.join(OUT_DIR, view.filename);
    fs.writeFileSync(outPath, imgBuf);
    const sizeKB = (imgBuf.length / 1024).toFixed(1);
    console.log(`[${++totalCaptured}/${VIEWS.length}] Captured ${view.filename} (${sizeKB} KB, 1280x720) - ${view.description}`);
  }

  ws.close();
  chrome.kill();
  server.close();

  console.log(`\n=========================================`);
  console.log(`Environment Screenshots: ${totalCaptured}/${VIEWS.length} captured to ${OUT_DIR}`);
  console.log(`=========================================\n`);

  if (totalCaptured !== VIEWS.length) {
    process.exit(1);
  }
  process.exit(0);
});
