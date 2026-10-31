/**
 * Build transparent-background web favicons from the app icon.
 *
 * The icon pack renders the artwork (navy book + gold growth arrow) on a solid
 * rounded square. For the browser tab / bookmarks we want JUST the artwork on a
 * transparent background (like Duolingo's owl), with no square around it.
 *
 * We can't simply key out the background colour: the book's pages are nearly
 * the same near-white as the backdrop, so a global colour match would punch
 * holes in the pages. Instead we do an EDGE-CONNECTED flood fill: starting from
 * every border pixel, we clear pixels whose colour is within `TOL` of the
 * background and that are reachable from the edge without crossing the book's
 * dark outline. Interior white (the pages) is enclosed by that outline, so it
 * is preserved.
 *
 * Android launcher icons are intentionally left WITH their background — Android
 * expects a filled icon.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const SOURCE = 'src/assets/icon/icon-512.png';
const TOL = 42;          // colour distance (per-channel-ish) treated as background
const FEATHER = true;    // soften the cut edge by 1px for less aliasing

/** Load as RGBA raw at a working resolution, flood-fill the border background
 *  to transparent, and return { data, width, height }. */
async function cutBackground() {
  const { data, info } = await sharp(SOURCE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const buf = Buffer.from(data); // RGBA, 4 channels

  function idx(x, y) { return (y * width + x) * 4; }

  // Reference backgrounds to strip: the OUTER white field (corner) AND the
  // gray rounded card (sampled just inside the top edge, below the corner
  // radius). Both are edge-connected; the book's pages are enclosed by its
  // dark outline so the flood can't reach them.
  const sample = (x, y) => [buf[idx(x, y)], buf[idx(x, y) + 1], buf[idx(x, y) + 2]];
  const bgColors = [
    sample(2, 2),                       // outer white field
    sample(width >> 1, 8),              // gray card (top-middle, under corner)
  ];
  const near = (p, c) =>
    Math.abs(buf[p] - c[0]) <= TOL &&
    Math.abs(buf[p + 1] - c[1]) <= TOL &&
    Math.abs(buf[p + 2] - c[2]) <= TOL;
  function isBg(p) { return bgColors.some(c => near(p, c)); }

  // BFS flood fill from all border pixels.
  const visited = new Uint8Array(width * height);
  const stack = [];
  const pushIf = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const n = y * width + x;
    if (visited[n]) return;
    visited[n] = 1;
    if (isBg(idx(x, y))) stack.push(x, y);
  };
  for (let x = 0; x < width; x++) { pushIf(x, 0); pushIf(x, height - 1); }
  for (let y = 0; y < height; y++) { pushIf(0, y); pushIf(width - 1, y); }

  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    buf[idx(x, y) + 3] = 0; // transparent
    pushIf(x + 1, y); pushIf(x - 1, y); pushIf(x, y + 1); pushIf(x, y - 1);
  }

  // Feather: any opaque pixel that neighbours a now-transparent one gets a
  // slightly reduced alpha, to soften the hard edge.
  if (FEATHER) {
    const copy = Buffer.from(buf);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const p = idx(x, y);
        if (copy[p + 3] === 0) continue;
        const neighbours = [idx(x + 1, y), idx(x - 1, y), idx(x, y + 1), idx(x, y - 1)];
        if (neighbours.some(n => copy[n + 3] === 0)) buf[p + 3] = 150;
      }
    }
  }

  return { data: buf, width, height };
}

const cut = await cutBackground();
const master = sharp(cut.data, { raw: { width: cut.width, height: cut.height, channels: 4 } }).png();

// Output set: ONLY the browser-tab / bookmark favicons get the transparent
// treatment. The PWA maskable icons (icon-192 / icon-512) and the iOS
// apple-touch icon KEEP their solid background on purpose:
//  - maskable icons must fill the frame (transparent looks broken),
//  - iOS renders transparent apple-touch icons on a black backing.
const outputs = [
  ['src/assets/icon/favicon-32x32.png', 32],
  ['src/assets/icon/favicon-16x16.png', 16],
  ['src/assets/icon/favicon.png', 32],
];

for (const [file, size] of outputs) {
  const out = await master.clone().resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  writeFileSync(file, out);
  console.log('wrote', file, size + 'px');
}
console.log('done');
