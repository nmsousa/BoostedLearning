# Boostionary feedback worker

A tiny Cloudflare Worker that receives in-app "report a problem" payloads and
opens a **GitHub issue** on this repo. The GitHub token lives only here (as a
Worker secret) — never in the app.

```
App  →  POST https://<your-worker>.workers.dev/  →  Worker  →  GitHub issue
```

## One-time setup

### 1. Create a GitHub token (fine-grained, least privilege)
1. GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate new token.
2. **Resource owner:** your account. **Repository access:** *Only select repositories* → `nmsousa/BoostedLearning`.
3. **Permissions:** Repository permissions → **Issues: Read and write** (nothing else).
4. Generate and copy the token (starts with `github_pat_...`).

### 2. Install tooling and log in
```bash
cd worker
npm install
npx wrangler login          # opens the browser to authorize your Cloudflare account
```

### 3. Store the token as a secret and deploy
```bash
npx wrangler secret put GITHUB_TOKEN   # paste the github_pat_... token when prompted
npx wrangler deploy
```
Deploy prints your Worker URL, e.g. `https://boostionary-feedback.<subdomain>.workers.dev`.

### 4. Point the app at the Worker
Put that URL in BOTH env files, in the `feedbackEndpoint` field:
- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

Rebuild the app. Done — reports now become GitHub issues (label `feedback`).
If `feedbackEndpoint` is left empty, the app falls back to a `mailto:` report.

## Config
- `wrangler.toml` → `[vars] GITHUB_REPO` (which repo gets the issues) and
  `ALLOWED_ORIGIN` (CORS; `*` is fine for a mobile WebView).
- `GITHUB_TOKEN` is a **secret**, set via `wrangler secret put` (never commit it).

## Test it
```bash
curl -X POST https://<your-worker>.workers.dev/ \
  -H 'Content-Type: application/json' \
  -d '{"reasons":["translationWrong"],"word":"parfait","correctAnswer":"perfect","modeName":"Quiz","diagnostics":{"platform":"test"}}'
```
Expect `{"ok":true,"issue":"https://github.com/.../issues/N"}` and a new issue.

## Notes
- **Rate limiting** is a simple in-memory per-IP cap (5/min). For stronger
  protection add Cloudflare **Turnstile** or a KV/Durable Object counter.
- **Images (phase 2):** the worker only handles text today. To attach a
  screenshot, upload it to Cloudflare **R2** (or GitHub) and include the link.
- Free tier: 100k requests/day — effectively free for this use.
```
