# P00RIJA Portfolio

Interactive bilingual portfolio + full CMS built with **Next.js 16** (App Router, standalone output), React 19, Tailwind 4, Prisma/SQLite, Three.js and Lenis. Sized to run comfortably on a **1-core / 512 MB** VPS.

Developer contact: `p00rija@tutamail.com` · License: **Proprietary Commercial (see [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md))** — the Software runs only with a valid, signed license file; see *Licensing* below.
نسخه‌ی فارسی: [README.fa.md](README.fa.md)

> The public distribution starts in **Null mode** (`docker-compose.null.yml` / `P00RIJA_DISTRIBUTION_MODE=null`): no portfolio identity or sample content is shown until the owner signs in; only the immutable Developer card remains.

## Highlights

- 🪐 **3D planetary navigation** across three worlds: Graphics · Security · AI
- 🎮 **Galaxy Arcade** — 26 built-in games in a console-style overlay (header button, `G`, or `Ctrl/⌘+K`), pause with `Esc`, per-game high scores, RTL-safe controls
- 💻 **Interactive security terminal** — ~70 commands, TAB completion, system/network/crypto tooling
- 📊 **First-party Visitor Analytics** (CMS): sessions, duration, IP & Geo-IP, browser/device, referrers, 30-day charts, live world map with connection arcs — cookie-free, Do-Not-Track aware, **nothing tracked before consent**
- 🛡 **Defense Center** — bot/scanner filtering, rate limiting, auto-bans, allow/block lists, live threat feed (Next 16 `proxy.ts`, zero dependencies)
- 🧩 **Full CMS** — every section, theme, gallery layouts, drag-drop forms (Telegram/WhatsApp/SMTP delivery), music player, 3D object factory, per-device content snapshots, SEO fields, media library with ffmpeg-backed editing
- 🔐 Hardened auth — PBKDF2 password hash, optional TOTP 2FA, 3-strike login lockout, HMAC sessions
- 🍪 **GDPR/CCPA consent gate** — external analytics (GA4, GTM, Hotjar, Plausible, Matomo, Cloudflare, HubSpot) load only after an explicit "analytics" consent
- 📦 **One-file installer**, clean GitHub package, and a **clean zero-config Docker image**

## Licensing (vendor guide)

The commercial build is **locked until a signed license file is activated**, and it checks in with the license server every 10 minutes — if the license is revoked/expired (or the server stays unreachable beyond the grace window), the whole site switches to a maintenance screen and automatically recovers when the license becomes valid again.

**One-time vendor setup** (on YOUR machine):

```bash
node scripts/license-cli.mjs keygen        # → LICENSE_AES_KEY, LICENSE_SIGN_PRIVKEY (secret), LICENSE_SIGN_PUBKEY
```

Bake `LICENSE_AES_KEY` + `LICENSE_SIGN_PUBKEY` into the SOLD image's env (never into the public image) — licensing is completely OFF when these are absent (dev/public builds stay unlocked).

**Run the license server** (your box; Docker-based so it never conflicts with other services; the container listens directly on the host's main network interface via `network_mode: host`, so customer installs on OTHER servers reach it at `http://<this-server>:<PORT>`):

```bash
# option A — prebuilt archive (no build on the server):
docker load -i p00rija-license-server-v<version>-amd64.tar.gz
# option B — build from source:
#   docker compose -f docker-compose.license.yml up -d --build
# set ADMIN_TOKEN + LICENSE_PORT (default 7800) in a .env next to the compose file:
echo 'LICENSE_ADMIN_TOKEN=a-long-random-token'  > .env
echo 'LICENSE_PORT=7800'                       >> .env
docker compose -f docker-compose.license.yml up -d
# graphical dashboard: http://<host>:7800/admin
```

**Issue a license** (everything — duration, slots, usage, server URL/port — is set by you; the license file carries the full server config inside):

```bash
export LICENSE_AES_KEY=… LICENSE_SIGN_PRIVKEY=… \
       LICENSE_ADMIN_URL=http://127.0.0.1:7800 LICENSE_ADMIN_TOKEN=…
node scripts/license-cli.mjs create --licensee "Acme" --plan annual \
  --devices 2 --uses 100000 --server-url http://licenses.acme-host --server-port 7800 \
  --out acme.lic          # also register it server-side (same id) via dashboard or CLI
node scripts/license-cli.mjs list|show|revoke|suspend|activate|extend|set|reset-devices --license-id P00-…
```

**Customer side:** the locked site serves only `/license` — upload the `.lic` file (or paste its content) and the site opens. Each install gets a unique UUID that the server counts against the license's slot limit; heartbeats every 10 minutes keep it alive.

Full legal text: [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md).

## Automatic installation

### Local Docker installation

```bash
curl -fsSL https://raw.githubusercontent.com/Poorija/P00RIJA-PORTFOLIO/main/scripts/install-from-github.sh | sudo -E bash
```

The bootstrap checks prerequisites, installs Docker when needed, clones the repo to `/opt/p00rija-portfolio`, creates persistent storage, detects CPU/RAM, and starts the app.

### Production domain with HTTPS

Point the domain's DNS A/AAAA record to the server, then:

```bash
curl -fsSL https://raw.githubusercontent.com/Poorija/P00RIJA-PORTFOLIO/main/scripts/install-from-github.sh -o /tmp/p00rija-install.sh
sudo env \
  P00RIJA_DOMAIN='portfolio.example.com' \
  P00RIJA_PUBLIC_PORT='443' \
  P00RIJA_SSL_MODE='le' \
  P00RIJA_LE_EMAIL='admin@example.com' \
  P00RIJA_ADMIN_PASSWORD='replace-this-password' \
  bash /tmp/p00rija-install.sh
```

This installs behind Nginx, redirects HTTP→HTTPS, issues a Let's Encrypt certificate and enables auto-renewal. For local testing use `P00RIJA_SSL_MODE=self-signed`.

## ⚠️ Default CMS password

The default CMS admin password is **`admin123`** — a public, documented default that exists only so the app boots with zero configuration. **Anyone can log into your CMS with it until you change it.**

- The interactive installer **asks** for a password during installation (leave empty = accept the default).
- Docker users: start the container with `-e ADMIN_PASSWORD="your-strong-password"`, or change the password from the CMS settings after the first login.
- On first boot a `CMS-PASSWORD.txt` notice is written next to the database.
- Reference: [`DEFAULT-CMS-PASSWORD.txt`](DEFAULT-CMS-PASSWORD.txt), [`.env.example`](.env.example).

## Manual installation

```bash
git clone https://github.com/Poorija/P00RIJA-PORTFOLIO.git
cd P00RIJA-PORTFOLIO
cp .env.example .env      # set ADMIN_PASSWORD + AUTH_SECRET (openssl rand -hex 32)
```

Then choose one:

**Prebuilt Null image (zero config):**

```bash
docker compose -f docker-compose.null.yml pull   # or: docker load -i <archive>
docker compose -f docker-compose.null.yml up -d
```

**Full clean image (zero config):**

```bash
docker load -i p00rija-portfolio-image-v<version>.tar.gz   # or: docker pull p00rija/portfolio:latest
docker compose -f docker-compose.hub.yml up -d
# → http://localhost:3000
```

**Build from source:**

```bash
npm ci
npx prisma generate && npx prisma db push
npm run build
sudo bash install.sh --docker     # or the interactive wizard: sudo bash install.sh --web
```

Development with hot reload: `docker compose -f docker-compose.dev.yml up --build` → `http://127.0.0.1:7890`.

## Configuration (environment)

| Variable | Default | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | `admin123` ⚠️ | CMS login — change immediately; a password set from the CMS (hash) takes precedence |
| `AUTH_SECRET` | auto in Docker / required natively | HMAC key for CMS sessions |
| `DATABASE_URL` | `file:/app/db/custom.db` | SQLite location |
| `PORT` | `3000` | HTTP port |
| `P00RIJA_DISTRIBUTION_MODE` | `null` (public installers) | `null` hides portfolio identity/content until the owner signs in |
| `P00RIJA_CPUS` / `P00RIJA_MEMORY_LIMIT` | host-detected | Container resource caps |
| `SMTP_PASS` | — | SMTP secret for the contact form's server-side delivery |

## CMS, Factory Reset, Backup

Open the CMS from the header and sign in. The visual builder supports movable/resizable/rotatable 3D objects, per-device (Automatic/Desktop/Tablet/Mobile) content snapshots with inheritance, a media & icon library (crop/resize/WebP/video-trim/GLB previews), drag-and-drop multi-step forms, named versions and undo/redo. **Factory Reset** returns the app to a blank Null canvas while preserving only the immutable Developer card.

**CMS → Migration & Backup** downloads a complete `.p00backup.gz` (content, uploads, password hash, 2FA) and restores it on any other instance; `scripts/migrate.sh` performs host-to-host migration.

## Building the distribution artifacts

```bash
bash scripts/make-clean-package.sh --image
```

Produces in `dist/`:

- `p00rija-portfolio-clean-v<version>.tar.gz` / `.zip` — **source-only package for GitHub**: no `.env`, no database, no uploads, no build output (verified by built-in sanity checks); ships with `DEFAULT-CMS-PASSWORD.txt` and the installer
- `p00rija-portfolio-image-v<version>.tar.gz` — **clean production image** for `docker load` / Docker Hub (`docker push p00rija/portfolio:v<version>`)

The image is built FROM the staged clean directory, so no secret can leak into any layer.

## Deploying updates to a small server

The production server never builds (1 core / 512 MB) — ship the prebuilt image:

```bash
bash scripts/deploy-image.sh user@server 22
```

## Updating and diagnostics

```bash
sudo bash install.sh --status
sudo bash install.sh --update-docker
docker logs --tail 200 p00rija-portfolio
```

Never commit `.env`, backups, database files, or private keys.

More docs: [DEPLOYMENT.md](DEPLOYMENT.md) · [PROJECT_DOCS.md](PROJECT_DOCS.md) (architecture, Persian)
