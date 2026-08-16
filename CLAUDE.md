# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal CV / portfolio site for Naeel Zuriek (Infrastructure & ELV Specialist, Abu Dhabi), with an embedded AI assistant that answers as him using Claude Haiku 4.5. Deployed to cPanel under `naeel.ai-technology.ae` via Phusion Passenger.

Next.js 15 App Router · React 19 · Tailwind v4 · TypeScript strict · **webpack, not Turbopack** (cPanel compatibility — do not add `--turbopack` to any script).

## Commands

```bash
npm run dev        # next dev (webpack)
npm run build      # next build
npm run start      # node server.js (the Passenger entry point)
npm run lint       # eslint — NOT run by the build, run it before pushing
npm run typecheck  # tsc --noEmit
```

No test framework is configured. Deployment steps live in [DEPLOY.md](DEPLOY.md).

## Environment

`.env` is gitignored (all `.env*` except `.env.example`). Required at runtime: `ANTHROPIC_API_KEY`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`. See [.env.example](.env.example) for the full list.

[src/lib/env.ts](src/lib/env.ts) is `server-only` and uses lazy getters, so a missing variable throws on first access inside a request rather than at import time — a missing key surfaces as a 503 from `/api/chat`, not a boot failure. `env.mailEnabled` gates transcript delivery, so the site still runs with SMTP unconfigured.

## Architecture

### Rendering split

[src/app/page.tsx](src/app/page.tsx) composes server components from `src/components/site/` — all resume content ships as HTML with no client JS. Only two things hydrate: [nav.tsx](src/components/site/nav.tsx) (IntersectionObserver scroll-spy) and [chat-dock.tsx](src/components/chat/chat-dock.tsx). The chat panel itself is `dynamic(..., { ssr: false })` so react-markdown and remark-gfm stay off the critical path until someone opens the chat; hovering the launcher prefetches the chunk.

Server components cannot pass `onClick`, so sections trigger the chat by dispatching a window `CustomEvent` via [`OpenChatButton`](src/components/chat/open-chat-button.tsx); `ChatDock` listens for it. That indirection is what keeps the panel lazily loaded.

All page copy lives in [src/lib/content.ts](src/lib/content.ts) as typed constants — the single source of truth for the marketing page. It is **deliberately separate** from `public/me/*.txt`, which is what the assistant reads. Changing a role in one does not change the other; keep them in sync manually.

### Content Security Policy

[src/middleware.ts](src/middleware.ts) mints a per-request nonce and sets the CSP on **both** the request headers (Next.js reads it back out to stamp its own hydration scripts) and the response. `script-src` is nonce + `strict-dynamic`; `style-src` keeps `unsafe-inline` because `next/font` and Tailwind emit inline blocks.

**A nonce minted per request only works if the HTML is generated per request.** [layout.tsx](src/app/layout.tsx) therefore sets `export const dynamic = "force-dynamic"`, and `/` must show as `ƒ` in the build output. If it ever flips to `○` (Static), Next bakes its bootstrap scripts at build time with no nonce, `strict-dynamic` blocks every one of them, and the site serves inert HTML — no nav, no chat, no hydration, and *no error on the server*. Removing an incidental `headers()` call from the layout was enough to trigger exactly that.

The JSON-LD block in the layout deliberately carries **no** nonce. `application/ld+json` is a data block rather than executable script, so CSP does not gate it (verified in a real browser) — and adding a nonce actively breaks hydration, because the CSP spec requires browsers to blank the `nonce` content attribute after parsing, so React reads back `""` and reports a mismatch against its own server output.

Static headers that don't need the nonce live in `next.config.ts`.

### Chat pipeline

[src/app/api/chat/route.ts](src/app/api/chat/route.ts) is the whole backend. Order of operations: origin check → per-IP rate limit (burst + hourly) → payload validation → build system prompt → open/append session → stream.

The response is hand-rolled SSE with typed frames (`session` / `delta` / `error` / `done`), consumed by [use-chat.ts](src/components/chat/use-chat.ts). The client buffers on `\n\n` boundaries — SSE frames straddle network chunks, and the previous implementation lost tokens by splitting each chunk independently.

The route runs a manual turn loop capped at `MAX_TURNS`, handling both `stop_reason: "tool_use"` (execute tools, push **all** results in a single user message) and `stop_reason: "pause_turn"` (re-send to resume a server-side tool loop). The latter only matters when `ENABLE_WEB_SEARCH=true`.

[profile.ts](src/lib/profile.ts) memoises `public/me/*.txt` for the process lifetime. The old code re-read both files from disk on every request.

**Prompt caching note:** the `cache_control` breakpoint on the system prompt is currently a no-op — the combined profile is ~3.2k tokens and Haiku 4.5's minimum cacheable prefix is 4096. It is in place so caching engages automatically if the profile files grow.

### Question quota and lockout

[src/lib/quota.ts](src/lib/quota.ts) gives each visitor **30 questions, then a hard 1-hour lockout, then 30 again**. It is not a rolling window: exhausting the allowance sets `lockedUntil = now + 1h`, and the counter only resets once that passes.

Identity is two-layered. The primary key is a **signed httpOnly cookie** (`nz_visitor`, HMAC-SHA256 over a UUID) — per browser, so an office behind one NAT is not a single shared budget. Behind it sits a looser **per-IP ceiling** (`IP_LIMIT`, 120) that catches someone clearing cookies to reset their allowance. The visitor bucket is evaluated first and the IP bucket is only charged when the visitor is permitted, so a locked-out browser cannot keep burning down the shared IP ceiling for everyone else.

State is mirrored to `.sessions/quota.json` because Passenger idles apps out on quiet shared hosting — an in-memory lockout would evaporate on exactly the restart an abuser would wait for. Ordinary increments ride a 2s debounce, but the transition *into* a lockout is written through with `await persistNow()`: the debounce timer is `unref`'d, so a shutdown inside that window would otherwise hand the visitor a fresh allowance.

`QUOTA_COOKIE_SECRET` signs the cookie. It is deliberately **not** required: when unset, a random key is generated per process, so the app still boots but cookies stop verifying after a restart. Set it in production.

Two things to know when changing this:

- The burst limiter in the chat route (10/min per IP) sits *in front* of the quota, so 30 questions cannot be spent faster than about three minutes. Any test script has to pace itself.
- `quota.isFinalQuestion` is true on the question that exhausts the allowance. It appends a directive to the system prompt telling the assistant to answer normally and *then* ask for an email — so the visitor's last interaction is an invitation, not a wall. The lockout applies either way; supplying an email does not buy more questions.

`GET /api/session/quota` peeks at the allowance without spending one; the chat panel calls it on open to render the counter or the locked state.

### Transcript capture and email

This is the least obvious subsystem. [src/lib/transcript/store.ts](src/lib/transcript/store.ts) holds conversations in memory, mirrored to `.sessions/*.json`, and emails them on three triggers:

| Trigger | Path |
| --- | --- |
| Visitor closes the chat panel | `ChatPanel.close()` → `POST /api/session/close` |
| Visitor closes/leaves the page | `pagehide` + `visibilitychange` → `navigator.sendBeacon` → same route |
| Conversation idle past `TRANSCRIPT_IDLE_MINUTES` | in-process `setInterval` sweeper (5 min tick) |

Delivery is **immediate** — `closeSession` awaits the SMTP handoff rather than queueing it. There is no debounce; an earlier version had a 15s one and it was wrong twice over: it delayed a lead, and its timer was `unref`'d, so a Passenger restart inside the window dropped the send until the idle sweeper caught it up to an hour later.

`emailedCount` does two jobs: it is the duplicate guard (a send only happens when `messages.length` has moved past it) and the **slice point** — each email contains only the messages added since the last one, with a continuation banner. That is what makes the chat-close/page-close pair fired by closing a tab produce exactly one email. A failed send deliberately leaves `emailedCount` alone so the sweeper retries.

Because `emailedCount` indexes into `messages`, the `MAX_MESSAGES_PER_SESSION` trim in `appendMessage` has to decrement it by the number dropped, or the next incremental email slices from the wrong offset.

`closeSession` awaits store hydration before looking the session up. Reading the in-memory map directly (as the route used to) meant a `sendBeacon` arriving as the first request after a restart found nothing and silently returned 204.

`sendBeacon` cannot set headers, so `/api/session/close` reads `request.text()` and parses JSON itself rather than using `request.json()`.

Session IDs are **server-generated** (`crypto.randomUUID`) and returned via the `x-session-id` header and the first SSE frame. They are validated against a UUID pattern before being used in a filesystem path — never trust a client-supplied ID here.

The two chat tools (`record_contact`, `record_unanswered_question` in [tools.ts](src/lib/chat/tools.ts)) write into the session record, so captured leads surface at the top of the transcript email rather than needing a separate notification channel.

The sweeper is in-process, so on a quiet site an abandoned conversation waits until the next request wakes Passenger. `/api/transcripts/sweep` (gated on `SWEEP_TOKEN`, 404 when unset) exists for a cPanel cron to force it — see DEPLOY.md step 7.

### Deployment

Git-based: push to GitHub → cPanel *Git Version Control* pulls → `npm install` → `npm run build` → Passenger restart. Nothing is uploaded by hand, and there is no `output: "standalone"` — [server.js](server.js) is a plain Next custom server that Passenger boots and whose `.listen()` it intercepts.

Three things in this repo exist only because of CloudLinux/cPanel, and each one breaks the deploy if undone:

- **Never `--turbopack`.** cPanel symlinks `node_modules` into the Node virtualenv *outside* the app root; Turbopack panics on a symlink leaving the filesystem root. Next 15's `next build` is webpack by default, so just don't add the flag.
- **Build-time packages live in `dependencies`.** Production mode means cPanel's `npm install` omits devDependencies entirely, so Tailwind, PostCSS, TypeScript and `@types/*` are regular dependencies. ESLint deliberately is not — `eslint.ignoreDuringBuilds` in `next.config.ts` keeps the server build from needing it. Run `npm run lint` locally.
- **`.npmrc` pins `workspaces=false`**, guarding against a stale `workspaces=true` in cPanel's per-app npmrc that fails with "No workspaces found!".

`public/me/*.txt`, `.sessions/` and the quota file are all resolved from `process.cwd()`, which under Passenger is the app root.

`.next/` and `node_modules/` are gitignored — both are produced on the server.

## Dependencies and `npm audit`

**Never run `npm audit fix --force` on this repo.** It resolves the remaining advisories by upgrading Next to 16, which switches the build to Turbopack — the exact thing that cannot work with cPanel's symlinked `node_modules`. On the server it also destroys the CloudLinux `node_modules` symlink and leaves the app unbuildable until the symlink is recreated.

`next` and `eslint-config-next` are pinned to the same exact version on purpose; they must be bumped together.

Three high-severity advisories are knowingly accepted, all of them fixable only by Next 16:

| Advisory | Why it is accepted here |
| --- | --- |
| `postcss` (nested under `next`) | Exploits need attacker-controlled CSS or `sourceMappingURL`. All CSS is authored in this repo and compiled at build time. |
| `sharp` (nested under `next`, libvips CVEs) | Exploits need a malicious *input image*. `next/image` only ever processes `public/me.jpg`; the site accepts no uploads. |
| `next` itself | Flagged transitively for the two above. |

Adding a top-level `sharp` does **not** fix its advisory — Next declares `sharp: ^0.34.3`, so npm keeps a nested copy at 0.34.x and uses that. It only creates a duplicate.

`nodemailer` is different and was upgraded to 9.x: its advisories are CRLF/SMTP header injection, and this app mails content a visitor can influence. Our API surface is just `createTransport` + `sendMail`, so majors are cheap to take. `@types/nodemailer` must track the major (8.x for nodemailer 9) and lives in `dependencies`, not `devDependencies`, because the server build type-checks.

## Gotchas

- **Never add `--turbopack`.** The build must be webpack for cPanel.
- Anything importing `src/lib/env.ts` or another `server-only` module cannot be reached from a client component — that is the guardrail keeping secrets out of the browser bundle.
- The `web_search` tool is optional and off by default (`ENABLE_WEB_SEARCH`). The original codebase shipped a *fake* `web_search` that keyword-matched a handful of hardcoded project names while the UI advertised "real-time web search"; that has been removed. Enabling the real one bills at $10 per 1,000 searches.
- Rate limiting and the session store are per-process. Passenger runs a single process per app on cPanel, so this holds — it stops holding if the app is ever scaled out.
- Tailwind v4 has no config file: theme tokens are declared in `@theme` inside [globals.css](src/app/globals.css), alongside hand-written utilities (`.label`, `.ticked`, `.blueprint`, `.answer`) that the design leans on.
- `.sessions/` contains visitor PII before delivery and is gitignored.
