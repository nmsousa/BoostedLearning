/**
 * Re-encode the copied app icons to TRUE PNG. The icon-pack generator saved
 * JPEG bytes inside .png files; Android/aapt prefers real PNGs. This reads
 * each file into memory first (releasing the handle), decodes it, then writes
 * proper PNG bytes back.
 */
import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const targets = [];
for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  const dir = `android/app/src/main/res/mipmap-${d}`;
  targets.push(join(dir, 'ic_launcher.png'), join(dir, 'ic_launcher_round.png'));
}
const webDir = 'src/assets/icon';
for (const f of readdirSync(webDir)) {
  if (f.endsWith('.png')) targets.push(join(webDir, f));
}

for (const file of targets) {
  const input = readFileSync(file);                 // read + close handle
  const out = await sharp(input).png().toBuffer();  // decode from buffer -> PNG
  writeFileSync(file, out);
  console.log('re-encoded', file);
}
console.log('done:', targets.length, 'files');
