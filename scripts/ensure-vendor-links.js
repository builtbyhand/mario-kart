import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const vendorThreeDir = path.resolve(rootDir, "app/src/main/assets/game/vendor/three");
const targetDir = path.resolve(rootDir, "node_modules/three");

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  try {
    fs.symlinkSync(vendorThreeDir, targetDir, "junction");
  } catch (err) {
    fs.cpSync(vendorThreeDir, targetDir, { recursive: true });
  }
}
