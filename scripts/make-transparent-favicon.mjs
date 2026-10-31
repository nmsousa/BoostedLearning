/**
 * Build transparent-background web favicons from the app icon.
 *
 * The icon pack renders the artwork (navy book + gold growth arrow) on a solid
 * rounded square (a gray card on a white field). For the browser tab/bookmarks
 * we want JUST the artwork on a transparent background (like Duolingo's owl),
 * with no square around it.
 *
 * Why not a colour key or an edge flood fill? The book's PAGES are the same
 * near-white as the outer field AND they touch the outer white at the book's
 * open front edge, so both those methods leak into the pages and hollow out
 * the book.
 *
 * Instead we keep the artwork's SILHOUETTE. "Ink" = any pixel that is clearly
 * part of the drawing: the navy covers and the gold arrow (i.e. NOT near the
 * gray card colour and NOT a bright near-white that lies outside the ink
 * span). We compute, per row, the leftmost/rightmost ink x, and per column the
 * top/bottom ink y, then keep every pixel that falls inside BOTH spans. The
 * white pages sit between the navy covers, so they are inside the span and are
 * preserved; the outer white and the gray card are outside and get cleared.
 *
 * Android launcher + PWA maskable + apple-touch icons keep their background.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const SOURCE = 'src/assets/icon/icon-512.png';
const FEATHER = true;    // soften the cut edge by 1px for less aliasing

/** Load as RGBA raw, clear everything outside the artwork silhouette, and
 *  return { data, width, height }. */
async function cutBackground() {
  const { data, info } = await sharp(SOURCE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const buf = Buffer.from(data); // RGBA, 4 channels

  function idx(x, y) { return (y * width + x) * 4; }

  // --- Classify "ink" pixels: the navy book + the gold arrow. ---------------
  // Navy cover is dark (low luma). Gold arrow is saturated warm (R >> B).
  // Everything else (gray card ~167, outer white ~251, page white) is NOT ink.
  function isInk(x, y) {
    const p = idx(x, y);
    const r = buf[p], g = buf[p + 1], b = buf[p + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const dark = luma < 140;                 // navy cover / outline
    const gold = r > 150 && r - b > 45 && g > 90; // warm arrow
    return dark || gold;
  }

  // Per-row horizontal ink span and per-column vertical ink span.
  const rowMin = new Int32Array(height).fill(width);
  const rowMax = new Int32Array(height).fill(-1);
  const colMin = new Int32Array(width).fill(height);
  const colMax = new Int32Array(width).fill(-1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isInk(x, y)) continue;
      if (x < rowMin[y]) rowMin[y] = x;
      if (x > rowMax[y]) rowMax[y] = x;
      if (y < colMin[x]) colMin[x] = y;
      if (y > colMax[x]) colMax[x] = y;
    }
  }

  // Keep a pixel only if it lies inside the ink span both horizontally and
  // vertically (i.e. within the artwork silhouette). Clear the rest.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const insideRow = rowMax[y] >= 0 && x >= rowMin[y] && x <= rowMax[y];
      const insideCol = colMax[x] >= 0 && y >= colMin[x] && y <= colMax[x];
      if (!(insideRow && insideCol)) buf[idx(x, y) + 3] = 0;
    }
  }

  // Feather: opaque pixel next to a now-transparent one gets reduced alpha.
  if (FEATHER) {
    const copy = Buffer.from(buf);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const p = idx(x, y);
        if (copy[p + 3] === 0) continue;
        const neighbours = [idx(x + 1, y), idx(x - 1, y), idx(x, y + 1), idx(x, y - 1)];
        if (neighbours.some(n => copy[n + 3] === 0)) buf[p + 3] = 170;
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
