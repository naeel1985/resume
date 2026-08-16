# Deploying to cPanel — naeel.ai-technology.ae

Deployment is **git-based**: push to GitHub, pull on cPanel with *Git Version
Control*, then `npm install` and `npm run build` on the server.

Nothing is uploaded by hand. `node_modules` and `.next` are **not** in the
repo — cPanel's Node Selector symlinks `node_modules` into the app's Node
virtualenv, which is why installing on the server is the right move rather
than shipping a folder.

---

## One-time: create the GitHub repository

The local repo is already initialised and committed. Create an empty repo on
GitHub (no README, no .gitignore — the first commit already exists), then:

```bash
cd c:/dev/resume
git remote add origin https://github.com/naeel1985/<repo-name>.git
git push -u origin main
```

Check `git log --stat -1` before pushing if you want to confirm `.env` is not
in the commit. It is gitignored, along with `.next/`, `node_modules/` and
`.sessions/`.

---

## One-time: set up the app on cPanel

### 1. Create the subdomain

cPanel → **Domains** → **Create A New Domain**

| Field | Value |
| --- | --- |
| Domain | `naeel.ai-technology.ae` |
| Document root | `/home/<user>/naeel.ai-technology.ae` |

Untick "Share document root".

### 2. Clone the repository

cPanel → **Git Version Control** → **Create**

| Field | Value |
| --- | --- |
| Clone a Repository | on |
| Clone URL | your GitHub HTTPS or SSH URL |
| Repository Path | `/home/<user>/naeel.ai-technology.ae` |

For a **private** repo, add the server's SSH key (cPanel → *SSH Access* →
*Manage SSH Keys*) to GitHub under **Settings → Deploy keys**, and clone with
the `git@github.com:...` URL.

### 3. Register the Node.js application

cPanel → **Software** → **Setup Node.js App** → **Create Application**

| Field | Value |
| --- | --- |
| Node.js version | **20 or 22** |
| Application mode | **Production** |
| Application root | `naeel.ai-technology.ae` |
| Application URL | `naeel.ai-technology.ae` |
| Application startup file | `server.js` |

> Create the app **after** cloning. cPanel writes its Passenger directives into
> `.htaccess` in the app root; doing it in this order avoids a collision with
> the clone.

### 4. Add the environment variables

In the app's *Environment variables* section. This is the only place
credentials should live — `.env` is never committed or uploaded.

| Variable | Value |
| --- | --- |
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | `eng.naeel.zuriek@gmail.com` |
| `SMTP_PASS` | the Gmail **app password** (16 chars, no spaces) |
| `MAIL_FROM` | `Naeel Zuriek Site <eng.naeel.zuriek@gmail.com>` |
| `MAIL_TO` | `eng.naeel.zuriek@gmail.com` |
| `ALLOWED_ORIGINS` | `https://naeel.ai-technology.ae` |
| `TRANSCRIPT_IDLE_MINUTES` | `60` |
| `QUOTA_COOKIE_SECRET` | long random string — see below |
| `NODE_ENV` | `production` |

`QUOTA_COOKIE_SECRET` signs the visitor cookie the 30-question limit is tracked
against. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Leave it unset and the app still runs, but it generates a random key at boot —
so every restart hands locked-out visitors a fresh allowance.

Optional: `SWEEP_TOKEN` (see step 7 of the deploy loop below).

### 5. First build

Open **Terminal** (or use the *Run JS script* box in the Node.js App UI). The
panel shows the exact activate command; it looks like:

```bash
source /home/<user>/nodevenv/naeel.ai-technology.ae/20/bin/activate
cd ~/naeel.ai-technology.ae
npm install
npm run build
```

Then **Restart** in the Node.js App UI.

Open `https://naeel.ai-technology.ae` — you should get the CV page with the
copper "ASK" launcher bottom-right.

---

## Every deploy after that

```bash
# locally
npm run lint && npm run typecheck && npm run build   # catch it here, not on the server
git add -A && git commit -m "..." && git push
```

Then on cPanel:

1. **Git Version Control** → **Manage** → **Update from Remote** (does `git pull`)
2. **Terminal**:
   ```bash
   source /home/<user>/nodevenv/naeel.ai-technology.ae/20/bin/activate
   cd ~/naeel.ai-technology.ae
   npm install        # only needed when package.json changed
   npm run build
   ```
3. **Setup Node.js App** → **Restart**

Restarting without the UI:

```bash
mkdir -p ~/naeel.ai-technology.ae/tmp
touch ~/naeel.ai-technology.ae/tmp/restart.txt
```

---

## Why the build works on cPanel

Three things about this repo exist specifically for CloudLinux/cPanel:

- **The build never uses Turbopack.** cPanel symlinks `node_modules` into the
  Node virtualenv, which lives *outside* the app root. Turbopack refuses to
  follow a symlink that leaves the filesystem root and panics. Webpack resolves
  it normally, and Next 15's `next build` is webpack by default — so never add
  `--turbopack` to any script.
- **Build-time packages are in `dependencies`, not `devDependencies`.** In
  Production mode cPanel sets `NODE_ENV=production`, so `npm install` omits
  devDependencies entirely. Tailwind, PostCSS, TypeScript and the `@types/*`
  packages are therefore listed as regular dependencies. ESLint is not — the
  build skips linting via `eslint.ignoreDuringBuilds` in `next.config.ts`, so
  run `npm run lint` locally instead.
- **`.npmrc` pins `workspaces=false`.** cPanel's per-app npmrc can carry a stale
  `workspaces=true` and then fail with "No workspaces found!" on a repo that has
  none. Harmless to remove if you never see that error.

---

## Optional: keep the idle transcript sweep running

Transcripts are emailed immediately when the visitor closes the chat or the
page. The one-hour idle rule runs on a timer *inside* the Node process, so it
only fires while the process is alive — and Passenger idles apps out on quiet
sites. An abandoned conversation would then wait for the next visitor.

If that matters, set `SWEEP_TOKEN` and add a cron job (cPanel → **Cron Jobs**,
every 15 minutes):

```
*/15 * * * * curl -fsS -H "x-sweep-token: YOUR_TOKEN" https://naeel.ai-technology.ae/api/transcripts/sweep > /dev/null 2>&1
```

This keeps the process warm and forces a sweep. Without `SWEEP_TOKEN`, the
endpoint returns 404 and is disabled.

---

## Troubleshooting

**Changes don't show after a pull + build + restart**
Check this **first**, before debugging anything else. Many cPanel hosts run
LiteSpeed with LSCache on by default, and it can keep serving the old build.
cPanel → **LiteSpeed Web Cache Manager** → **Purge All**. (If it becomes a
recurring nuisance, add an `.htaccess` with `<IfModule LiteSpeed>CacheDisable
public /</IfModule>` — merged with cPanel's Passenger directives, not
replacing them.)

**503 / "something went wrong"**
Passenger could not boot. Check `stderr.log` in the app root. Usual causes:
Node below 20, a missing `ANTHROPIC_API_KEY`, or `npm run build` never having
been run after the first clone (there is no `.next` to serve).

**`npm install` fails with "No workspaces found!"**
The stale-npmrc problem `.npmrc` guards against. Confirm `.npmrc` made it into
the clone.

**"Cloudlinux NodeJS Selector demands to store node modules ... symlink called
node_modules"** — and `next: command not found` when you build

Something replaced the `node_modules` **symlink** with a real directory. The
usual cause is `npm audit fix --force` (never run it here — see below), which
tries to rebuild the tree in place and fails partway with
`ENOTEMPTY: directory not empty, rmdir '.../node_modules'`.

Recover:

```bash
cd ~/naeel.ai-technology.ae
rm -rf node_modules            # the stray REAL directory in the app root
git checkout -- package.json package-lock.json   # undo any rewritten versions
```

Then in cPanel → **Setup Node.js App** → your app → click **Run NPM Install**.
That button is what recreates the virtualenv symlink; a plain `npm install`
from the shell does not. Afterwards:

```bash
source /home/<user>/nodevenv/naeel.ai-technology.ae/<node-ver>/bin/activate
cd ~/naeel.ai-technology.ae
npm run build
```

`next: command not found` is just the symptom of `node_modules` being broken —
it resolves itself once the symlink is back.

**Never run `npm audit fix --force`**
It "fixes" the remaining advisories by upgrading Next to 16, whose build
defaults to Turbopack — which cannot follow cPanel's symlinked `node_modules`.
It would break the deploy even if the install succeeded. Use plain
`npm audit` to review, and upgrade individual packages deliberately.

**Build killed / out of memory**
Shared plans cap memory per process. Try again on a quieter moment, or ask the
host to raise the limit. As a fallback you can build locally and copy the
`.next` folder up, but then the local Node version should match the server's.

**Chat returns 403**
`ALLOWED_ORIGINS` must contain the exact scheme + host, e.g.
`https://naeel.ai-technology.ae`.

**Transcripts never arrive**
Look for `[transcript] delivery failed` in the app log. Almost always the Gmail
app password (must be a 16-character App Password with 2-Step Verification on,
entered without spaces). If the host blocks outbound 465, switch to
`SMTP_PORT=587` with `SMTP_SECURE=false`.

**Images 404 or fail to optimise**
`next/image` needs `sharp`, which npm installs automatically as an optional
dependency of Next. If the host cannot install its native binary, set
`images: { unoptimized: true }` in `next.config.ts` and rebuild.
