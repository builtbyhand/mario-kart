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

  await new Promise((r) => (ws.onopen = r));
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });

  let totalCaptured = 0;

  for (const racer of RACERS) {
    for (const view of VIEWS) {
      const url = `http://127.0.0.1:8888/verify.html?racer=${racer.id}&view=${view}`;
      await send("Page.navigate", { url });

      // Poll until window.__RENDER_DONE is true
      let rendered = false;
      for (let attempt = 0; attempt < 25; attempt++) {
        await new Promise((r) => setTimeout(r, 150));
        const res = await send("Runtime.evaluate", {
          expression: "window.__RENDER_DONE",
        });
        if (res?.result?.value === true) {
          rendered = true;
          break;
        }
      }

      if (!rendered) {
        console.warn(`Timeout rendering ${racer.id} ${view}`);
      }

      const ss = await send("Page.captureScreenshot", { format: "png" });
      const filename = `${racer.prefix}_${view}.png`;
      const outPath = path.join(OUT_DIR, filename);
      fs.writeFileSync(outPath, Buffer.from(ss.data, "base64"));
      const sizeKB = (Buffer.from(ss.data, "base64").length / 1024).toFixed(1);
      console.log(`[${++totalCaptured}/32] Captured ${filename} (${sizeKB} KB)`);
    }
  }

  ws.close();
  chrome.kill();
  server.close();
  console.log(`\nAll 32 verification screenshots captured successfully into ${OUT_DIR}`);
  process.exit(0);
});
