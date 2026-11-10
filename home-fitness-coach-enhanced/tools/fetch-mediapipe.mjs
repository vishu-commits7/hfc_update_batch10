// Downloads the MediaPipe pose files into public/mediapipe so the app counts reps offline.
// Run once on a computer with internet:  npm run fetch:mediapipe
// Then:  npm run build  &&  npx cap sync android
import { mkdirSync, createWriteStream, existsSync, statSync, renameSync } from "node:fs";
import { get } from "node:https";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "0.10.14";
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "mediapipe");

// [url, file name inside public/mediapipe]. The bundle is saved as .js so every WebView serves it as JavaScript.
const FILES = [
  [`${CDN}/vision_bundle.mjs`, "vision_bundle.js"],
  [`${CDN}/wasm/vision_wasm_internal.js`, "wasm/vision_wasm_internal.js"],
  [`${CDN}/wasm/vision_wasm_internal.wasm`, "wasm/vision_wasm_internal.wasm"],
  [`${CDN}/wasm/vision_wasm_nosimd_internal.js`, "wasm/vision_wasm_nosimd_internal.js"],
  [`${CDN}/wasm/vision_wasm_nosimd_internal.wasm`, "wasm/vision_wasm_nosimd_internal.wasm"],
  [MODEL, "pose_landmarker_lite.task"],
];

function download(url, dest, hops = 0) {
  return new Promise((resolve, reject) => {
    get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 5) {
        res.resume();
        return resolve(download(new URL(res.headers.location, url).toString(), dest, hops + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`${res.statusCode} for ${url}`)); }
      const tmp = dest + ".part";
      const f = createWriteStream(tmp);
      res.pipe(f);
      f.on("finish", () => f.close(() => { renameSync(tmp, dest); resolve(); }));
      f.on("error", reject);
    }).on("error", reject);
  });
}

let failed = 0;
for (const [url, name] of FILES) {
  const dest = join(OUT, name);
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest) && statSync(dest).size > 1000) { console.log("have", name); continue; }
  try { await download(url, dest); console.log("saved", name, Math.round(statSync(dest).size / 1024) + " KB"); }
  catch (e) { failed++; console.error("FAILED", name, String(e.message || e)); }
}
if (failed) { console.error(`\n${failed} file(s) failed. Check your internet connection and run again.`); process.exit(1); }
console.log("\nDone. Now run: npm run build && npx cap sync android");
