/**
 * Tiny zero-dependency .env loader for the build scripts.
 *
 * Reads KEY=VALUE lines from the project-root .env (if present) and copies any
 * keys NOT already set in process.env into it. Real environment variables
 * therefore win over the file, so you can still override with:
 *   $env:GOOGLE_TTS_API_KEY = '...'; node scripts/gen-audio.mjs
 *
 * Supported syntax: `KEY=value`, `# comments`, blank lines, and surrounding
 * single/double quotes on the value. No variable expansion, no multiline.
 *
 * Import this for its side effect at the TOP of a script:
 *   import './load-env.mjs';
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const ENV_FILE = path.join(ROOT, '.env');

if (fs.existsSync(ENV_FILE)) {
  const text = fs.readFileSync(ENV_FILE, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue; // real env wins
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
