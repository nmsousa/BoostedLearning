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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  const word = clamp(p.word, 120) || '(no word)';
  const reasons = Array.isArray(p.reasons) ? p.reasons.map(r => clamp(r, 40)) : [];
  const d = p.diagnostics ?? {};

  const title = `Feedback: ${word}${reasons.length ? ` — ${reasons[0]}` : ''}`;

  const body = [
    `**Word:** ${word}`,
    `**Expected answer:** ${clamp(p.correctAnswer, 200) || '-'}`,
    `**Mode:** ${clamp(p.modeName, 40) || '-'}`,
    `**Reasons:** ${reasons.join(', ') || '-'}`,
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(env) });
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

    // Minimal validation: must have at least one reason or a word.
    const hasReason = Array.isArray(payload.reasons) && payload.reasons.length > 0;
    if (!hasReason && !payload.word) {
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
