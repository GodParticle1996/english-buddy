# EnglishBuddy — Web Deployment Implementation Plan

A detailed, step-by-step plan to take EnglishBuddy from an Expo/React-Native mobile app to a
self-hosted **web app** running on a Raspberry Pi 5, exposed on a custom domain — building on
[SETUP.md](./SETUP.md) but filling in the gaps that guide leaves out.

> This is the "note down everything" master plan. Each phase has **tasks**, **exact changes**,
> and **verification**. The Master Checklist at the end is the single source of truth.

---

## 0. Current state (verified)

| Item | Status | Impact |
|------|--------|--------|
| App source in `english-buddy/` | ✅ Present (Lookup, Daily, Saved, Cards, Play, History) | Ready to build |
| Docker / compose / nginx / SETUP.md | ✅ Already scaffolded | Reuse, with fixes below |
| `react-dom`, `react-native-web` | 🔴 **MISSING** | `expo export --platform web` **fails** until installed |
| `app.json` web block | ⚠️ Only `favicon` | Need `bundler`/`output` set |
| API keys (`EXPO_PUBLIC_*`) | 🔴 Inlined into JS bundle | **Exposed publicly** on the web |
| CORS on TokenMix / Groq | ✅ Both allow browser calls | No proxy needed *for function*, but keys still exposed |
| Voice (`MicButton` + `transcribe.ts`) | ⚠️ RN-only APIs | **Won't work in a browser** without a web path |
| `.dockerignore` excludes `.env` | ⚠️ | Web build would inline **empty** keys |
| Expo SDK | 54.0.35 (pinned) | Keep — do **not** bump |

---

## 1. Decisions to make first

These change what you build. Decide before Phase 1.

1. **Who can access the site?**
   - **A. Private (just you / a few people)** → lock the whole site behind **Cloudflare Access**
     (email login). Client-side keys are acceptable because only you can load the bundle. *Simplest.*
   - **B. Public (anyone)** → you **must** hide the keys behind a **server-side proxy** (Phase 3B).
     Otherwise your TokenMix/Groq credits are free for the internet.
   - **Recommendation:** Start with **A** (private + Cloudflare Access). Move to **B** if you ever
     go public.

2. **Voice search on web?**
   - **v1:** Disable the mic button on web (Platform check). Everything else works.
   - **later:** Implement a browser recording path (`MediaRecorder` → `Blob` → transcription).
   - **Recommendation:** Ship v1 without web voice; add later.

3. **How many app containers?** SETUP.md uses 2 + nginx load balancer. For a Pi 5 personal app,
   **1 container is plenty**; keep 2 only if you specifically want to demo load balancing.

4. **Where to build the static site?** Building `expo export` **inside** Docker on the Pi is slow
   and RAM-hungry (it OOM'd at 2 GB locally). Prefer **building `dist/` on your dev machine (WSL)**
   and shipping a tiny "serve static files" image. (Both options detailed in Phase 4.)

5. **Domain / exposure:** Cloudflare Tunnel (free HTTPS + custom domain) is the recommended path.

---

## 2. Phase 1 — Make the app web-buildable

**Goal:** `npm run build:web` produces a working `dist/` you can open in a browser.

### 2.1 Install the web runtime deps (the missing piece)
```bash
cd ~/projects/english-buddy   # or wherever english-buddy/ lives
npx expo install react-dom react-native-web
```
> `expo install` picks SDK-54-compatible versions. Do **not** `npm install react-dom@latest`.

### 2.2 Configure the web target in `app.json`
Under `expo`, set the web block:
```json
"web": {
  "favicon": "./assets/favicon.png",
  "bundler": "metro",
  "output": "single"
}
```
- `bundler: "metro"` — required for RN web in SDK 54.
- `output: "single"` — a single-page app (one `index.html`), which `serve` and nginx can host
  with a simple SPA fallback.

### 2.3 Build and test locally (in WSL)
```bash
npm run build:web            # -> creates dist/
npx serve dist -p 8081
# open http://localhost:8081  (or http://<wsl-ip>:8081 from Windows)
```

### 2.4 Verify
- [ ] App loads, tabs switch, a **lookup returns a card** (TokenMix/Groq work from browser — CORS OK).
- [ ] Saved words / history / Play persist across refresh (AsyncStorage → `localStorage` on web).
- [ ] Note any red console errors (missing polyfills) and fix before moving on.

> Expect the **mic button** to error or do nothing on web — that's handled in Phase 2.

---

## 3. Phase 2 — Handle web feature gaps (code changes)

**Goal:** the app degrades gracefully in a browser.

### 3.1 Gate voice input off on web
`expo-audio` recording and the RN `FormData` file shape (`{uri,name,type}`) don't work in browsers.
Hide the mic on web so it can't be tapped.

In `src/screens/LookupScreen.tsx`, guard the `<MicButton />`:
```tsx
import { Platform } from 'react-native';
// ...
{Platform.OS !== 'web' && (
  <MicButton disabled={loading} onResult={(t) => { setQuery(t); onSearch(t); }} />
)}
```
- [ ] Confirm the search row still lays out correctly without the mic on web.

### 3.2 Verify the other native modules degrade safely
| Module | Web behavior | Action |
|--------|--------------|--------|
| `expo-haptics` | No-ops; already wrapped in `.catch(()=>{})` | None |
| `expo-speech` (TTS) | Works via Web Speech API in Chrome/Edge/Safari | Verify "tap to hear" |
| `AsyncStorage` | Backed by `localStorage` (~5 MB) | Fine for our cache/saved data |
| `Animated` / navigation | Work on web | None |

- [ ] Tap-to-hear pronunciation works in the browser.
- [ ] (Optional) Add a small "voice search is available in the mobile app" hint on web.

### 3.3 (Optional, later) Real web voice
If you want voice on web later: record with `MediaRecorder`, get a `Blob`, and send it to the
transcription endpoint as a real `Blob` (not the RN `{uri,...}` shape). Requires **HTTPS** for mic
permission. Track as a follow-up; not needed for v1.

---

## 4. Phase 3 — Secure the API keys

Pick **3A** or **3B** based on Decision #1.

### 3A. Private site (recommended first) — keep client keys, lock the door
- Keys stay in the bundle, but the entire site sits behind **Cloudflare Access** (Phase 6), so only
  authenticated users (you) can load the JS at all.
- **Build-time env gotcha:** `EXPO_PUBLIC_*` values are inlined when `expo export` runs. The build
  must see `.env`. Since `.dockerignore` excludes `.env`, either:
  - **build `dist/` outside Docker** (Phase 4, Option 1 — recommended), where `.env` is present, or
  - pass keys as Docker **build args** (Phase 4, Option 2).
- [ ] Decide build location so keys are present at export time.

### 3B. Public site — server-side proxy (hide keys entirely)
Move the keys off the client. The browser calls **same-origin** `/api/...`; the proxy injects the
real key server-side. This also means the web bundle ships with **no real keys**.

**Design:** nginx (already in the stack) proxies to the providers and adds the `Authorization`
header from a server-side env var (using the `nginx:alpine` `envsubst` template mechanism).

1. Client config — on web, point at the proxy and stop sending real keys.
   In `src/config.ts`, branch by platform:
   ```ts
   import { Platform } from 'react-native';
   const web = Platform.OS === 'web';
   export const config = {
     apiKey: web ? 'via-proxy' : (process.env.EXPO_PUBLIC_TOKENMIX_API_KEY ?? ''),
     baseUrl: web ? '/api/tokenmix' : (process.env.EXPO_PUBLIC_TOKENMIX_BASE_URL ?? 'https://api.tokenmix.ai/v1'),
     // ...same pattern for groqApiKey / groqBaseUrl -> '/api/groq'
   };
   ```
   (`'via-proxy'` is a non-empty dummy so `hasAnyProvider()` still passes; nginx overrides the real
   `Authorization` header anyway.)

2. nginx template `nginx.conf.template` (rendered at container start):
   ```nginx
   location /api/tokenmix/ {
     proxy_pass https://api.tokenmix.ai/v1/;
     proxy_ssl_server_name on;
     proxy_set_header Host api.tokenmix.ai;
     proxy_set_header Authorization "Bearer ${TOKENMIX_KEY}";
   }
   location /api/groq/ {
     proxy_pass https://api.groq.com/openai/v1/;
     proxy_ssl_server_name on;
     proxy_set_header Host api.groq.com;
     proxy_set_header Authorization "Bearer ${GROQ_KEY}";
   }
   ```
   Mount it as `/etc/nginx/templates/default.conf.template` and pass `TOKENMIX_KEY` / `GROQ_KEY`
   as container env (from a **non-committed** `.env` on the Pi). `nginx:alpine` runs `envsubst`
   on templates automatically.

3. - [ ] Rebuild the web bundle (now key-free) and confirm lookups work through `/api/...`.
   - [ ] Confirm keys are **absent** from `dist/` (`grep -r "sk-tm" dist/` returns nothing).

> Note: a tiny Node/Express proxy is an alternative to nginx `envsubst` and is easier if you later
> need request logging or rate limiting. Either works.

**In both cases:** rotate the TokenMix and Groq keys now — they were shared in chat earlier.

---

## 5. Phase 4 — Containerize (fix the existing Docker setup)

### Option 1 (recommended): prebuild `dist/`, ship a static image
Build the heavy web export on WSL; the image only serves files.

`Dockerfile.web`:
```dockerfile
FROM node:22-bookworm-slim
WORKDIR /app
RUN npm install -g serve
COPY dist ./dist
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "serve -s dist -l ${PORT}"]
```
- `serve -s` = SPA mode (routes fall back to `index.html`).
- Build `dist/` first (`npm run build:web`), then `docker build`. `dist/` must **not** be in
  `.dockerignore` for this option.

### Option 2: build inside Docker (matches current Dockerfile)
Keep the existing multi-stage `Dockerfile`, but:
- [ ] Add memory headroom to the export step:
  `RUN NODE_OPTIONS="--max-old-space-size=4096" npx expo export --platform web`
- [ ] For client-side keys (3A), pass them as build args so they're inlined:
  ```dockerfile
  ARG EXPO_PUBLIC_TOKENMIX_API_KEY
  ARG EXPO_PUBLIC_GROQ_API_KEY
  ENV EXPO_PUBLIC_TOKENMIX_API_KEY=$EXPO_PUBLIC_TOKENMIX_API_KEY
  ENV EXPO_PUBLIC_GROQ_API_KEY=$EXPO_PUBLIC_GROQ_API_KEY
  ```
  and `docker build --build-arg EXPO_PUBLIC_TOKENMIX_API_KEY=... .`
- ⚠️ Pi build is slow/RAM-heavy — Option 1 is preferred.

### 5.1 `.dockerignore`
- [ ] For Option 1: **remove `dist`** from `.dockerignore` (you're copying it in).
- [ ] Keep `.env` ignored (Option 1 needs no `.env` in image; Option 2 uses build args).

### 5.2 `docker-compose.yml`
- [ ] Drop the obsolete `version: "3.9"` line (Compose v2 warns on it).
- [ ] If going single-container, delete `english-buddy-2` and simplify the nginx upstream.
- [ ] For proxy mode (3B), add `env_file: ./.env.server` (holding `TOKENMIX_KEY`/`GROQ_KEY`) to the
  nginx service and mount the template.

### 5.3 Verify
```bash
npm run build:web            # Option 1
docker compose up --build -d
docker ps && curl -s http://localhost | head
```
- [ ] `curl http://localhost` returns EnglishBuddy HTML.

---

## 6. Phase 5 — Nginx (load balancer / SPA host)

Reuse the provided `nginx.conf`, with two additions:
- [ ] **SPA fallback** so client routes don't 404:
  ```nginx
  location / {
      proxy_pass http://english_buddy_app;
      # ...existing proxy headers...
  }
  ```
  (When each app container runs `serve -s dist`, `serve` already does SPA fallback, so the LB just
  proxies. If you serve files from nginx directly instead, add `try_files $uri /index.html;`.)
- [ ] If using proxy mode (3B), add the `/api/tokenmix/` and `/api/groq/` blocks from Phase 3B.
- [ ] Keep `least_conn;` (or default round-robin) if you keep 2 containers.

Verify load balancing (if 2 containers):
```bash
for i in {1..6}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost; done
docker logs english-buddy-1 --tail 5; docker logs english-buddy-2 --tail 5
```

---

## 7. Phase 6 — Raspberry Pi 5 provisioning

Follow SETUP.md §4, with this checklist:
- [ ] Flash Raspberry Pi OS Lite 64-bit (or Ubuntu Server 24.04 ARM); enable SSH in Imager.
- [ ] First boot: `ssh`, `passwd`, `sudo apt update && sudo apt upgrade -y`.
- [ ] Create `deploy` user; add to `sudo`.
- [ ] Install Docker + compose plugin (SETUP.md §4.5); `usermod -aG docker deploy`.
- [ ] (Node.js on the Pi is **only** needed for Option 2 in-Docker builds; Option 1 doesn't need it.)
- [ ] `sudo apt install -y ufw`; allow `22`, `80`, `443`; `ufw enable` (see Phase 9 hardening).
- [ ] Confirm arch is `arm64` (`uname -m` → `aarch64`) so images match.

---

## 8. Phase 7 — Deploy to the Pi

### 8.1 Ship the code (and `dist/` if Option 1)
```bash
# From WSL, in english-buddy/
npm run build:web    # Option 1 only
rsync -avz --exclude=node_modules --exclude=.git \
  ./ deploy@raspberrypi.local:/home/deploy/english-buddy/
```
- [ ] For proxy mode, also copy a **server-side** `.env.server` with `TOKENMIX_KEY`/`GROQ_KEY`
  (never commit it).

### 8.2 Run
```bash
ssh deploy@raspberrypi.local
cd /home/deploy/english-buddy
docker compose up --build -d
docker compose logs -f
```
- [ ] `curl http://localhost` on the Pi returns the app.

---

## 9. Phase 8 — Expose to the internet (Cloudflare Tunnel)

Follow SETUP.md §6 Option A:
- [ ] Own a domain; move its nameservers to Cloudflare.
- [ ] Install `cloudflared` on the Pi; `cloudflared tunnel login`.
- [ ] `cloudflared tunnel create english-buddy-tunnel`.
- [ ] `cloudflared tunnel route dns english-buddy-tunnel englishbuddy.<domain>`.
- [ ] `~/.cloudflared/config.yml` ingress → `http://localhost:80`.
- [ ] Install as a service: `sudo cloudflared service install && sudo systemctl enable --now cloudflared`.
- [ ] Visit `https://englishbuddy.<domain>` — HTTPS is automatic (also satisfies mic-needs-HTTPS if
  you add web voice later).

**If Decision #1 = Private:** add a **Cloudflare Access** application on that hostname (email OTP or
Google login). This is what protects client-side keys.

---

## 10. Phase 9 — Verification & smoke tests

Run against the **public URL**:
- [ ] App loads over HTTPS; favicon shows.
- [ ] Lookup (type a word) returns a full card; synonyms tap → new lookup.
- [ ] TokenMix→Groq fallback still works (temporarily break the TokenMix key to confirm).
- [ ] Save a word; refresh; it persists. Play tab builds a quiz from saved words; XP/streak update.
- [ ] Mic button is absent on web (v1) and no console errors.
- [ ] (Proxy mode) `grep -r "sk-tm\|gsk_" dist/` → **no matches**; network tab shows `/api/...` calls.
- [ ] (Private mode) Incognito visit is challenged by Cloudflare Access.

---

## 11. Phase 10 — Hardening & ops

- [ ] **Rotate** TokenMix + Groq keys (shared earlier).
- [ ] `ufw` enabled; only 22/80/443 open; consider closing 80/443 entirely if using Tunnel (Tunnel
  makes outbound connections, so inbound ports can stay closed — more secure).
- [ ] `docker compose` `restart: unless-stopped` on all services (already set).
- [ ] Log rotation for containers (`--log-opt max-size=10m`).
- [ ] Auto-updates: `unattended-upgrades` on the Pi.
- [ ] Backups: the app state lives in the **browser** (localStorage), so nothing to back up
  server-side; note this to users (clearing browser data wipes progress). Optional future: a
  server-side sync/export.
- [ ] Monitoring: `docker stats`, `htop`; optional uptime check on the public URL.
- [ ] Redeploy flow: `npm run build:web` → `rsync` → `docker compose up -d --build`.

---

## 12. Risk register / gotchas

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Keys extracted from public bundle | High if public + client keys | Proxy (3B) or private + Cloudflare Access (3A) |
| `.env` excluded from Docker → empty keys in bundle | High (current `.dockerignore`) | Build `dist/` outside Docker, or pass build args |
| Voice broken on web | Certain | Gate off on web (3.1); optional `MediaRecorder` path later |
| Expo web build OOM on Pi | Medium | Prebuild on WSL (Option 1) or raise `--max-old-space-size` |
| SPA deep-link 404 | Medium | `serve -s` / nginx `try_files … /index.html` |
| SDK drift breaks Expo Go | Medium | **Stay on SDK 54**; use `expo install --fix` if deps drift |
| Provider free-tier limits hit under public traffic | Medium | Proxy + rate-limit; keep TokenMix→Groq fallback |
| localStorage ~5 MB cap | Low | Cache is LRU-capped (300); fine |

---

## 13. Master checklist (everything to do)

**Phase 1 — Web build**
- [ ] `npx expo install react-dom react-native-web`
- [ ] Add `web.bundler` + `web.output` to `app.json`
- [ ] `npm run build:web` → `dist/`
- [ ] `npx serve dist` and smoke-test in browser

**Phase 2 — Web gaps**
- [ ] Gate `<MicButton />` behind `Platform.OS !== 'web'`
- [ ] Verify TTS, storage, animations on web
- [ ] (Optional) web "use mobile app for voice" hint

**Phase 3 — Keys**
- [ ] Choose Private (3A) or Public+Proxy (3B)
- [ ] 3A: ensure `.env` present at export time
- [ ] 3B: platform-branch `config.ts` to `/api/...`; nginx `envsubst` template with `Authorization`
- [ ] Rotate both API keys

**Phase 4 — Docker**
- [ ] Choose prebuild (Option 1) vs in-Docker (Option 2)
- [ ] Write `Dockerfile.web` (Option 1) or add build args + `NODE_OPTIONS` (Option 2)
- [ ] Fix `.dockerignore` (`dist` handling), keep `.env` ignored
- [ ] Trim `docker-compose.yml` (drop `version:`, single container if desired, proxy env for nginx)
- [ ] `docker compose up --build -d`; `curl localhost`

**Phase 5 — Nginx**
- [ ] SPA fallback confirmed
- [ ] (3B) `/api/tokenmix` + `/api/groq` proxy blocks
- [ ] (2 containers) verify load balancing

**Phase 6 — Pi**
- [ ] Flash OS + SSH; update; `deploy` user; Docker; `ufw`; confirm arm64

**Phase 7 — Deploy**
- [ ] `rsync` project (+`dist/` for Option 1, +`.env.server` for 3B)
- [ ] `docker compose up --build -d`; `curl localhost`

**Phase 8 — Expose**
- [ ] Cloudflare Tunnel create/route/config/service
- [ ] (Private) Cloudflare Access app on the hostname
- [ ] Visit public HTTPS URL

**Phase 9 — Verify**
- [ ] Full smoke test on public URL (lookups, fallback, save/persist, Play, no key leak)

**Phase 10 — Harden**
- [ ] Keys rotated; firewall; log rotation; auto-updates; monitoring; documented redeploy flow

---

## 14. Recommended fastest path (opinionated)

For a personal deployment, do the minimum that's safe:
1. Phase 1 (install web deps, build).
2. Phase 2 (gate mic on web).
3. Phase 3**A** (private) — keep client keys, build `dist/` on WSL so keys inline.
4. Phase 4 **Option 1** — single static container serving `dist/`.
5. Phase 6/7 — Pi + one container.
6. Phase 8 — Cloudflare Tunnel **+ Cloudflare Access** (this is what makes client keys safe).
7. Rotate keys.

That gets you a private, HTTPS, custom-domain EnglishBuddy on your Pi without standing up a proxy.
Upgrade to Phase 3B if you later open it to the public.
