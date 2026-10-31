/**
 * Generate an Android ADAPTIVE launcher icon (API 26+).
 *
 * Problem: the plain square PNG launcher icon shows a white border because
 * modern launchers mask icons into a circle/squircle — the artwork's white/gray
 * card corners get cropped, leaving a white ring.
 *
 * Fix: a proper adaptive icon with two layers:
 *   - BACKGROUND: a solid brand colour that fills the whole 108dp tile, so the
 *     launcher mask shows a full coloured circle (no white border).
 *   - FOREGROUND: just the artwork (transparent background), scaled into the
 *     adaptive "safe zone" (the centre ~66dp of the 108dp canvas; launchers may
 *     crop up to ~1/3 on each side), so nothing important is clipped.
 *
 * We also refresh the legacy square mipmap PNGs (for pre-26 devices) using the
 * same background colour instead of white, so those corners aren't white either.
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';

// Highest-detail source we have (the iOS 1024 master) on its original card.
const SOURCE = 'C:/Development/BoostedLearning/iconikai-icon-pack (1)/ios/AppIcon-1024.png';
const BG = '#00b4db';              // brand teal fills the adaptive background
const FG_SCALE = 0.62;             // artwork occupies 62% of the tile (safe zone)

// Adaptive foreground canvas size per density (108dp tile).
const FG = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
// Legacy square launcher size per density.
const LEGACY = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

const RES = 'android/app/src/main/res';

/** Cut the solid card/background off the source, leaving just the artwork on
 *  transparency, using the silhouette approach (keep pixels inside the ink
 *  span; clear the gray card + outer white). Returns a sharp PNG pipeline. */
async function artworkTransparent() {
  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const buf = Buffer.from(data);
  const idx = (x, y) => (y * width + x) * 4;

  const isInk = (x, y) => {
    const p = idx(x, y);
    const r = buf[p], g = buf[p + 1], b = buf[p + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const dark = luma < 140;                         // navy cover / outline
    const gold = r > 150 && r - b > 45 && g > 90;    // warm arrow
    return dark || gold;
  };

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
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const insideRow = rowMax[y] >= 0 && x >= rowMin[y] && x <= rowMax[y];
      const insideCol = colMax[x] >= 0 && y >= colMin[x] && y <= colMax[x];
      if (!(insideRow && insideCol)) buf[idx(x, y) + 3] = 0;
    }
  }

  // Trim fully-transparent margins so FG_SCALE is applied to the artwork itself.
  return sharp(buf, { raw: { width, height, channels: 4 } }).png().trim();
}

const art = await artworkTransparent();
const artBuf = await art.toBuffer();

for (const [density, tile] of Object.entries(FG)) {
  const dir = `${RES}/mipmap-${density}`;
  mkdirSync(dir, { recursive: true });

  // --- Foreground: artwork centred on a transparent 108dp tile ---
  const inner = Math.round(tile * FG_SCALE);
  const art1 = await sharp(artBuf).resize(inner, inner, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  const fg = await sharp({ create: { width: tile, height: tile, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: art1, gravity: 'center' }]).png().toBuffer();
  writeFileSync(`${dir}/ic_launcher_foreground.png`, fg);

  // --- Legacy square icon: artwork on the solid brand colour, for pre-API-26 ---
  const legacy = LEGACY[density];
  const legacyInner = Math.round(legacy * 0.72);
  const artL = await sharp(artBuf).resize(legacyInner, legacyInner, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  const sq = await sharp({ create: { width: legacy, height: legacy, channels: 4, background: BG } })
    .composite([{ input: artL, gravity: 'center' }]).png().toBuffer();
  writeFileSync(`${dir}/ic_launcher.png`, sq);
  writeFileSync(`${dir}/ic_launcher_round.png`, sq);

  console.log('density', density, 'fg', tile, 'legacy', legacy);
}

console.log('adaptive foreground + legacy icons written');
