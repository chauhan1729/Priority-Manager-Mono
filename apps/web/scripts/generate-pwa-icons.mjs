// Generates PWA icons from public/favicon.svg.
// Run: node apps/web/scripts/generate-pwa-icons.mjs
//
// Produces regular icons (logo padded on a white "paper" canvas) and maskable
// icons (extra safe-zone padding so platform masks don't clip the logo), plus an
// opaque Apple touch icon. Re-run if the favicon changes.

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "..", "public");
const iconsDir = resolve(publicDir, "icons");
const BG = { r: 255, g: 255, b: 255, alpha: 1 }; // paper-white canvas

const svg = await readFile(resolve(publicDir, "favicon.svg"));
await mkdir(iconsDir, { recursive: true });

/** Render the logo at `inner` px (high-density for crispness), centered on a `size` canvas. */
async function makeIcon(size, innerRatio, { flatten = false } = {}) {
  const inner = Math.round(size * innerRatio);
  const logo = await sharp(svg, { density: 600 })
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  let canvas = sharp({
    create: { width: size, height: size, channels: 4, background: flatten ? BG : { ...BG, alpha: flatten ? 1 : 1 } },
  }).composite([{ input: logo, gravity: "center" }]);

  if (flatten) canvas = canvas.flatten({ background: BG });
  return canvas.png().toBuffer();
}

const targets = [
  { file: "icon-192.png", size: 192, ratio: 0.78 },
  { file: "icon-512.png", size: 512, ratio: 0.78 },
  // Maskable: logo kept inside the ~80% safe zone, full-bleed background.
  { file: "icon-maskable-192.png", size: 192, ratio: 0.6 },
  { file: "icon-maskable-512.png", size: 512, ratio: 0.6 },
  // Apple touch icon: opaque, iOS rounds the corners itself.
  { file: "apple-touch-icon.png", size: 180, ratio: 0.74, flatten: true },
];

for (const t of targets) {
  const buf = await makeIcon(t.size, t.ratio, { flatten: t.flatten });
  await writeFile(resolve(iconsDir, t.file), buf);
  console.log(`✓ ${t.file} (${t.size}×${t.size})`);
}

console.log("Done.");
