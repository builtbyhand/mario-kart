/**
 * Automated Verification Script for Android Back Navigation on live AVD.
 * Uses reactive polling to accommodate SwiftShader CPU rasterizer frame times.
 */

import http from "http";
import { execSync } from "child_process";

const DEVTOOLS_PORT = 9222;

function getPages() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${DEVTOOLS_PORT}/json`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

function adbBack() {
  execSync("adb shell input keyevent 4");
}

function getTopResumedActivity() {
  try {
    return execSync("adb shell dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity'").toString();
  } catch (_) {
    return "";
  }
}

async function triggerBack(evaluate) {
  await evaluate("if (window.AndroidBridge && window.AndroidBridge.triggerBack) { window.AndroidBridge.triggerBack(); } else if (window.__handleBackNavigation) { window.__handleBackNavigation(); }");
}

async function waitFor(checkFn, timeoutMs = 15000, intervalMs = 500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ok = await checkFn();
      if (ok) return true;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function main() {
  console.log("===============================================================================");
  console.log(" Android 17 AVD Back-Navigation Verification Suite");
  console.log("===============================================================================\n");

  const pages = await getPages();
  const gamePage = pages.find((p) => p.url && p.url.includes("appassets.androidplatform.net"));
  if (!gamePage || !gamePage.webSocketDebuggerUrl) {
    throw new Error(`Game page not found in DevTools endpoints: ${JSON.stringify(pages)}`);
  }

  console.log(`Connected to Android WebView: ${gamePage.title} (${gamePage.url})`);

  const ws = new WebSocket(gamePage.webSocketDebuggerUrl);
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
    } catch (e) {
      console.error("WS error:", e);
    }
  };

  await new Promise((r) => (ws.onopen = r));
  await send("Runtime.enable");

  async function evaluate(expr) {
    const res = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
    return res?.result?.value;
  }

  const results = [];

  // Wait for game ready
  const gameReady = await waitFor(() => evaluate("Boolean(window.__menuScene && window.__handleBackNavigation)"));
  if (!gameReady) {
    throw new Error("Game failed to reach ready state in time.");
  }

  console.log("\n[TEST 1] Back from Drivers Drawer");
  await evaluate("document.getElementById('nav-btn-drivers')?.click();");
  const t1Before = await waitFor(() => evaluate("!document.getElementById('drawer-drivers')?.hidden"));
  console.log(`  - Drivers drawer opened: ${t1Before}`);
  await triggerBack(evaluate);
  const t1Closed = await waitFor(() => evaluate("document.getElementById('drawer-drivers')?.hidden === true && window.__menuCamera?.mode === 'hub'"));
  const t1Pass = t1Before && t1Closed;
  console.log(`  - Drivers drawer closed & camera at hub: ${t1Closed} => ${t1Pass ? "PASS" : "FAIL"}`);
  results.push({ test: "1. Back from Drivers Drawer", pass: t1Pass, details: `drawer hidden, camera: hub (${t1Closed})` });

  console.log("\n[TEST 2] Back from Karts Drawer");
  await evaluate("document.getElementById('nav-btn-karts')?.click();");
  const t2Before = await waitFor(() => evaluate("!document.getElementById('drawer-karts')?.hidden"));
  console.log(`  - Karts drawer opened: ${t2Before}`);
  await triggerBack(evaluate);
  const t2Closed = await waitFor(() => evaluate("document.getElementById('drawer-karts')?.hidden === true && window.__menuCamera?.mode === 'hub'"));
  const t2Pass = t2Before && t2Closed;
  console.log(`  - Karts drawer closed & camera at hub: ${t2Closed} => ${t2Pass ? "PASS" : "FAIL"}`);
  results.push({ test: "2. Back from Karts Drawer", pass: t2Pass, details: `drawer hidden, camera: hub (${t2Closed})` });

  console.log("\n[TEST 3] Back from Settings Modal");
  await evaluate("document.getElementById('nav-btn-settings')?.click();");
  const t3Before = await waitFor(() => evaluate("!document.getElementById('modal-settings')?.hidden"));
  console.log(`  - Settings modal opened: ${t3Before}`);
  await triggerBack(evaluate);
  const t3Closed = await waitFor(() => evaluate("document.getElementById('modal-settings')?.hidden === true && window.__menuCamera?.mode === 'hub'"));
  const t3Pass = t3Before && t3Closed;
  console.log(`  - Settings modal closed & camera at hub: ${t3Closed} => ${t3Pass ? "PASS" : "FAIL"}`);
  results.push({ test: "3. Back from Settings Modal", pass: t3Pass, details: `modal hidden, camera: hub (${t3Closed})` });

  console.log("\n[TEST 4] Back During Active Race");
  await evaluate("window.__begin();");
  const t4Racing = await waitFor(() => evaluate("window.__race?.state === 'racing' || window.__race?.state === 'countdown'"));
  console.log(`  - Active race started: ${t4Racing} (state: ${await evaluate("window.__race?.state")})`);
  await triggerBack(evaluate);
  const t4Paused = await waitFor(() => evaluate("!document.getElementById('pause')?.hidden && document.body.classList.contains('paused')"));
  const t4Pass = t4Racing && t4Paused;
  console.log(`  - Pause dialog visible & body paused: ${t4Paused} => ${t4Pass ? "PASS" : "FAIL"}`);
  results.push({ test: "4. Back During Active Race", pass: t4Pass, details: `pause dialog visible, paused (${t4Paused})` });

  console.log("\n[TEST 5] Back While Race is Paused");
  const t5WasPaused = await evaluate("!document.getElementById('pause')?.hidden");
  console.log(`  - Initial paused state confirmed: ${t5WasPaused}`);
  await triggerBack(evaluate);
  const t5Resumed = await waitFor(() => evaluate("document.getElementById('pause')?.hidden === true && !document.body.classList.contains('paused')"));
  const t5Pass = t5WasPaused && t5Resumed;
  console.log(`  - Pause dialog dismissed & race resumed: ${t5Resumed} => ${t5Pass ? "PASS" : "FAIL"}`);
  results.push({ test: "5. Back While Race Paused", pass: t5Pass, details: `dialog dismissed, resumed (${t5Resumed})` });

  console.log("\n[TEST 6] Back from Results Screen");
  await evaluate(`
    if (window.__race) window.__race.state = 'results';
    document.body.classList.remove('racing');
    document.body.classList.remove('paused');
    document.body.classList.add('results-screen');
    document.getElementById('results').hidden = false;
  `);
  const t6ResultsOpen = await waitFor(() => evaluate("!document.getElementById('results')?.hidden"));
  console.log(`  - Results screen visible: ${t6ResultsOpen}`);
  await triggerBack(evaluate);
  const t6BackToHub = await waitFor(() => evaluate("document.getElementById('results')?.hidden === true && document.body.classList.contains('in-menu') === true && document.getElementById('intro')?.hidden === false"));
  const t6Pass = t6ResultsOpen && t6BackToHub;
  console.log(`  - Results dismissed & returned to hub: ${t6BackToHub} => ${t6Pass ? "PASS" : "FAIL"}`);
  results.push({ test: "6. Back from Results Screen", pass: t6Pass, details: `results dismissed, returned to hub (${t6BackToHub})` });

  console.log("\n[TEST 7] Back from Root Menu Hub (Exit to Launcher)");
  const topBefore = getTopResumedActivity();
  const onHub = await evaluate("document.body.classList.contains('in-menu') && document.getElementById('drawer-drivers')?.hidden !== false && document.getElementById('drawer-karts')?.hidden !== false && document.getElementById('modal-settings')?.hidden !== false");
  console.log(`  - On root hub with no overlays: ${onHub}`);
  await triggerBack(evaluate);
  const exitedToLauncher = await waitFor(() => !getTopResumedActivity().includes("com.mizan.mariokart/.MainActivity"), 12000, 500);
  const topAfter = getTopResumedActivity();
  const t7Pass = onHub && exitedToLauncher;
  console.log(`  - Top activity before: ${topBefore.trim()}`);
  console.log(`  - Top activity after:  ${topAfter.trim()}`);
  console.log(`  - Exited cleanly to launcher without crash or trap: ${exitedToLauncher} => ${t7Pass ? "PASS" : "FAIL"}`);
  results.push({ test: "7. Back from Root Menu Hub", pass: t7Pass, details: `exited to launcher: ${exitedToLauncher}` });

  ws.close();

  console.log("\n===============================================================================");
  console.log(" BACK NAVIGATION VERIFICATION SUMMARY");
  console.log("===============================================================================");
  let allPass = true;
  for (const r of results) {
    console.log(`  [${r.pass ? "PASS" : "FAIL"}] ${r.test} - ${r.details}`);
    if (!r.pass) allPass = false;
  }
  console.log("===============================================================================");
  if (!allPass) {
    throw new Error("One or more back navigation verification checks failed.");
  }
  console.log("ALL 7 ANDROID BACK NAVIGATION TRANSITIONS VERIFIED SUCCESSFULLY ON AVD!\n");
}

main().catch((err) => {
  console.error("Back navigation verification failed:", err);
  process.exit(1);
});
