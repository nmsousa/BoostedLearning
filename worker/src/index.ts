/**
 * Boostionary feedback Worker
 * ----------------------------------------------------------------------------
 * Receives a "report a problem" payload from the app and opens a GitHub issue
 * on the configured repository. The GitHub token lives ONLY here (as a Worker
 * secret), never in the app.
 *
 * Endpoint: POST /  (JSON body, see `FeedbackPayload`)
 * Response: 200 { ok: true, issue: <url> } | 4xx/5xx { ok: false, error }
 *
 * Secrets / vars (set with `wrangler secret put` or in wrangler.toml [vars]):
 *   GITHUB_TOKEN  (secret)  fine-grained PAT with "Issues: write" on the repo
 *   GITHUB_REPO   (var)     e.g. "nmsousa/BoostedLearning"
 *   ALLOWED_ORIGIN(var)     optional CORS origin allow-list (comma-separated);
 *                           defaults to "*" (fine for a mobile WebView)
 */

export interface Env {
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  ALLOWED_ORIGIN?: string;
  /** Where the OTA manifest lives. Defaults to this repo's latest release. */
  OTA_MANIFEST_URL?: string;
}

interface Diagnostics {
  appVersion?: string;
  buildDate?: string;
  platform?: string;
  osVersion?: string;
  androidSdk?: number;
  model?: string;
  manufacturer?: string;
  webViewVersion?: string;
  screen?: string;
  dpr?: number;
  baseLanguage?: string;
  learningLanguage?: string;
  theme?: string;
  colorTheme?: string;
}

interface FeedbackPayload {
  reasons?: string[];
  word?: string | null;
  correctAnswer?: string | null;
  modeName?: string | null;
  learningLanguage?: string | null;
  note?: string | null;
  diagnostics?: Diagnostics;
}

// --- Simple in-memory rate limit (per isolate). Not bulletproof, but enough
// to blunt accidental loops / casual abuse. For stronger limits add a KV or
// Durable Object, or Cloudflare Turnstile in front. ---
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5; // max reports per IP per window
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_MAX;
}

function cors(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN?.split(',')[0]?.trim() || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(body: unknown, status: number, env: Env): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(env) },
  });
}

function clamp(s: unknown, max: number): string {
  return String(s ?? '').slice(0, max);
}

function buildIssue(p: FeedbackPayload): { title: string; body: string } {
  const word = clamp(p.word, 120);
  const mode = clamp(p.modeName, 40);
  const reasons = Array.isArray(p.reasons) ? p.reasons.map(r => clamp(r, 40)) : [];
  const d = p.diagnostics ?? {};

  // Title context: the word if there is one, else the screen/mode it came
  // from (e.g. "Homepage"), else a generic placeholder.
  const context = word || (mode ? `(${mode})` : '(no word)');
  const title = `Feedback: ${context}${reasons.length ? ` — ${reasons[0]}` : ''}`;

  const note = clamp(p.note, 1000);
  const body = [
    `**Word:** ${word || '-'}`,
    `**Expected answer:** ${clamp(p.correctAnswer, 200) || '-'}`,
    `**Mode:** ${clamp(p.modeName, 40) || '-'}`,
    `**Reasons:** ${reasons.join(', ') || '-'}`,
    `**Note:** ${note || '-'}`,
    '',
    '<details><summary>Diagnostics</summary>',
    '',
    '```',
    `App:       ${clamp(d.appVersion, 40)} (${clamp(d.buildDate, 40)})`,
    `Platform:  ${clamp(d.platform, 20)} ${clamp(d.osVersion, 20)}${d.androidSdk ? ' / SDK ' + d.androidSdk : ''}`,
    `Device:    ${clamp(d.manufacturer, 40)} ${clamp(d.model, 60)}`,
    `WebView:   ${clamp(d.webViewVersion, 40)}`,
    `Screen:    ${clamp(d.screen, 20)} @${d.dpr ?? 1}x`,
    `Languages: learning ${clamp(d.learningLanguage, 10)}, base ${clamp(d.baseLanguage, 10)}`,
    `Theme:     ${clamp(d.theme, 20)} / ${clamp(d.colorTheme, 20)}`,
    '```',
    '</details>',
  ].join('\n');

  return { title, body };
}

// ===========================================================================
// OTA update endpoint (Capgo capacitor-updater, self-hosted "auto-update")
// ---------------------------------------------------------------------------
// The Capgo plugin POSTs an AppInfos body to its `updateUrl` on each launch and
// expects the SERVER to decide whether an update is due and, if so, return
// { version, url, checksum }. A static file can't do that (GitHub even rejects
// the POST with 422), so this endpoint:
//   1. reads the device's current bundle version from the POST body,
//   2. fetches the published manifest (GitHub latest-release updates.json),
//   3. returns the bundle only when the manifest version is strictly newer,
//      else returns a { message } so the plugin stays on the current bundle.
// Docs: https://capgo.app/docs/plugins/updater/self-hosted/auto-update/
// ===========================================================================

/** The POST body Capgo sends (only the fields we use are typed). */
interface CapgoAppInfos {
  platform?: string;
  /** The bundle currently running: a semver, or "builtin" for the APK's own. */
  version_name?: string;
  /** The native app version (from build.gradle) — fallback for "builtin". */
  version_build?: string;
}

/** Published manifest shape (what publish-ota.ps1 writes to the release). */
interface OtaManifest {
  version: string;
  url: string;
  checksum: string;
}

/** Parse a semver "a.b.c" into [a,b,c]; non-numeric parts become 0. */
function parseSemver(v: string): [number, number, number] {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(v ?? '');
  if (!m) return [0, 0, 0];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** True when `a` is strictly greater than `b` (semver, major.minor.patch). */
function semverGreater(a: string, b: string): boolean {
  const pa = parseSemver(a), pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return true;
    if (pa[i] < pb[i]) return false;
  }
  return false;
}

async function handleOta(request: Request, env: Env): Promise<Response> {
  const manifestUrl =
    env.OTA_MANIFEST_URL ||
    `https://github.com/${env.GITHUB_REPO}/releases/latest/download/updates.json`;

  // The current running version. On POST it's in the body; allow GET (with an
  // optional ?current=x.y.z) for easy browser debugging.
  let current = 'builtin';
  if (request.method === 'POST') {
    try {
      const info = (await request.json()) as CapgoAppInfos;
      current = info.version_name || info.version_build || 'builtin';
    } catch {
      /* tolerate an empty/invalid body — treat as builtin */
    }
  } else {
    current = new URL(request.url).searchParams.get('current') || 'builtin';
  }

  // Fetch the published manifest (static GET works fine on GitHub releases).
  let manifest: OtaManifest;
  try {
    const res = await fetch(manifestUrl, {
      headers: { 'User-Agent': 'boostionary-ota-worker' },
      // Follow GitHub's redirect to the asset.
      redirect: 'follow',
    });
    if (!res.ok) {
      return json({ message: `manifest fetch failed (${res.status})` }, 200, env);
    }
    // Read as text and strip a leading UTF-8 BOM before parsing: PowerShell's
    // Set-Content -Encoding UTF8 writes a BOM, which res.json() chokes on.
    const raw = (await res.text()).replace(/^\uFEFF/, '');
    manifest = JSON.parse(raw) as OtaManifest;
  } catch (e) {
    return json({ message: `manifest unavailable: ${String(e)}` }, 200, env);
  }

  // "builtin" (or anything we can't parse) is treated as oldest, so a device on
  // the APK's bundled version always gets the first OTA.
  const isNewer =
    current === 'builtin' ? semverGreater(manifest.version, '0.0.0')
                          : semverGreater(manifest.version, current);

  if (!isNewer) {
    // No update: the plugin keeps the current bundle. A `message` key (per the
    // Capgo spec) means "don't set a version".
    return json({ message: 'up-to-date', version: manifest.version }, 200, env);
  }

  // Update available: returning `url` triggers the download.
  return json(
    { version: manifest.version, url: manifest.url, checksum: manifest.checksum },
    200,
    env,
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(env) });
    }

    // Route by path: /ota = OTA update check, everything else = feedback.
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    if (path === '/ota') {
      if (request.method !== 'POST' && request.method !== 'GET') {
        return json({ message: 'method not allowed' }, 405, env);
      }
      return handleOta(request, env);
    }

    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405, env);
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (rateLimited(ip)) {
      return json({ ok: false, error: 'Too many reports, try again later.' }, 429, env);
    }

    let payload: FeedbackPayload;
    try {
      payload = (await request.json()) as FeedbackPayload;
    } catch {
      return json({ ok: false, error: 'Invalid JSON' }, 400, env);
    }

    // Minimal validation: must have at least one reason, a note, or a word.
    const hasReason = Array.isArray(payload.reasons) && payload.reasons.length > 0;
    const hasNote = typeof payload.note === 'string' && payload.note.trim().length > 0;
    if (!hasReason && !hasNote && !payload.word) {
      return json({ ok: false, error: 'Empty report' }, 422, env);
    }

    const { title, body } = buildIssue(payload);

    const ghRes = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'boostionary-feedback-worker',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, labels: ['feedback'] }),
    });

    if (!ghRes.ok) {
      const detail = await ghRes.text();
      return json({ ok: false, error: `GitHub error ${ghRes.status}`, detail }, 502, env);
    }

    const issue = (await ghRes.json()) as { html_url?: string };
    return json({ ok: true, issue: issue.html_url }, 200, env);
  },
};
