 # Server deployment

Run the interactive control installer on a server or local machine:

```bash
sudo bash install.sh
```

On Linux, native mode installs a `systemd` service. On macOS, native mode
installs a `launchd` service. Docker mode works on both Linux and macOS when
Docker Desktop or OrbStack is running. If Nginx is missing on macOS and you
choose the reverse-proxy option, the installer installs and configures the
Homebrew `nginx` package.

It opens a menu with:

- native localhost/server install,
- Docker localhost/server install,
- native update,
- Docker update/rebuild,
- native reset,
- Docker reset,
- native uninstall,
- Docker uninstall,
- status,
- build the clean GitHub package + clean Docker image.

## CMS admin password

The installer **asks for the CMS admin password** during every install that
creates a `.env` (leave empty to accept the documented default `admin123`).
For automation pass `P00RIJA_ADMIN_PASSWORD` in the environment instead.
The default is a PUBLIC, DOCUMENTED value — see `DEFAULT-CMS-PASSWORD.txt`
in the package and the `CMS-PASSWORD.txt` notice the container writes next
to the database when booted without `ADMIN_PASSWORD`. Change it immediately
after the first login (CMS settings) or via `-e ADMIN_PASSWORD="…"`.

## Zero-config Docker boot

The published image contains **no secrets**. On the first boot the container
entrypoint:

1. generates an `AUTH_SECRET` for its lifetime when none is provided,
2. falls back to the documented default CMS password when
   `ADMIN_PASSWORD` is unset, and writes a `CMS-PASSWORD.txt` warning file
   into the db volume.

So `docker load` + `docker compose -f docker-compose.hub.yml up -d` (full
app) or `docker-compose.null.yml` (Null mode) is enough to get a running
site. Explicit env vars always win.

## Distribution artifacts (GitHub package + clean image)

```bash
bash scripts/make-clean-package.sh --image
# or from the installer menu: option 14 / sudo bash install.sh --package
```

Produces in `dist/`:

- `p00rija-portfolio-clean-v<version>.tar.gz` / `.zip` — source-only package
  (no `.env`, no db, no uploads, no build output; sanity-checked), including
  `DEFAULT-CMS-PASSWORD.txt`, `.env.example`, and the installer.
- `p00rija-portfolio-image-v<version>.tar.gz` — clean production image built
  FROM the staged clean directory, ready for `docker load` or
  `docker push p00rija/portfolio:v<version>`.

## Shipping updates to the production server

The production server (1 CPU / 512 MB) never builds. Ship the prebuilt image:

```bash
bash scripts/deploy-image.sh user@server 22
# env overrides: P00RIJA_DEPLOY_HOST, P00RIJA_SSH_PORT, P00RIJA_DEPLOY_DIR,
#                P00RIJA_IMAGE_TAR, P00RIJA_COMPOSE_FILE
```

The script copies the archive, runs `docker load`, retags
`p00rija/portfolio:local`, and restarts the existing compose stack with
`--no-build`, then waits for the health endpoint. The server database volume
is untouched.

## Install modes

For a real public server, choose **Deploy web (Docker + Nginx + SSL)**. This
stack keeps the app on an internal Docker network and publishes only HTTP `80`
and HTTPS `443` (or the selected HTTPS port) through Nginx.

Direct actions are also available:

```bash
sudo bash install.sh --local
sudo bash install.sh --docker
sudo bash install.sh --update
sudo bash install.sh --update-docker
sudo bash install.sh --reset
sudo bash install.sh --reset-docker
sudo bash install.sh --uninstall
sudo bash install.sh --uninstall-docker
sudo bash install.sh --status
sudo bash install.sh --web
```

## Public HTTPS deployment

The web deployment supports:

- Let's Encrypt for a public DNS name. DNS is checked before deployment.
- Automatic Certbot renewal checks every 12 hours. Certbot renews only when the
  certificate is near expiry, then Nginx reloads the new certificate without
  dropping active connections.
- Existing certificate files or Cloudflare Origin CA.
- Self-signed certificates for localhost, LAN IPs, and testing.
- Forced HTTP-to-HTTPS redirect. Port `80` remains published because the
  Let's Encrypt HTTP-01 challenge uses it for issuance and renewal.
- Default public HTTPS port `443`.

Non-interactive deployment is available for migration automation:

```bash
sudo env \
  P00RIJA_DOMAIN=portfolio.example.com \
  P00RIJA_PUBLIC_PORT=443 \
  P00RIJA_SSL_MODE=le \
  P00RIJA_LE_EMAIL=admin@example.com \
  bash install.sh --web-auto
```

For a local self-signed deployment use `P00RIJA_DOMAIN=localhost` and
`P00RIJA_SSL_MODE=self-signed`. Browsers will warn until the generated local CA
certificate is trusted on the client device.

Do not mount `/var/run/docker.sock` into the CMS container. Host deployment,
SSH, and sudo run from the operator terminal, so host passwords never enter the
web application or database.

## Backup, restore, and migration

Open **CMS → Migration & Backup**:

1. Download a `.p00backup.gz` archive. It includes CMS content, custom sections,
   uploaded assets, users/posts, password hash, and 2FA settings.
2. Keep the archive encrypted. It contains security state and is intentionally
   returned with `Cache-Control: no-store`.
3. Restore it from the same screen. The API validates archive format, size, and
   SHA-256 checksum before a single database transaction replaces current data.
4. For local-to-host or host-to-host migration, copy the generated command and
   run it in the source checkout. Optionally provide the downloaded backup path.

Manual migration command:

```bash
P00RIJA_TARGET_HOST=203.0.113.10 \
P00RIJA_TARGET_USER=deploy \
P00RIJA_SSH_PORT=22 \
P00RIJA_DOMAIN=portfolio.example.com \
P00RIJA_PUBLIC_PORT=443 \
P00RIJA_SSL_MODE=le \
P00RIJA_LE_EMAIL=admin@example.com \
P00RIJA_BACKUP_PATH=/path/to/portfolio.p00backup.gz \
bash scripts/migrate.sh
```

SSH and sudo request passwords through the terminal TTY. The script verifies
root/sudo access, transfers a source bundle, deploys the Docker web stack,
obtains the certificate, restores the backup inside the app container, restarts
the app, and prints the final HTTPS URL.

### Complete migration runbook

1. **Create a fresh backup:** In CMS open **Migration & Backup**, download the
   `.p00backup.gz` archive, and store it encrypted. Keep the source deployment
   available until the destination has passed every check.
2. **Prepare the destination:** Use a Linux host reachable over SSH with a root
   account or a user that can run `sudo`. Recommended minimum is 1 CPU core,
   1 GB RAM, and enough disk space for the Docker image plus the backup.
3. **Open network access:** Permit the selected SSH port and public ports `80`
   and `443` in the host firewall, cloud firewall, router, and NAT rules. Port
   `80` is required for Let's Encrypt HTTP-01 issuance and renewal.
4. **Configure DNS:** Before requesting Let's Encrypt, point the domain A/AAAA
   record to the destination IP. Use self-signed mode for localhost, LAN, or a
   raw IP. Lower DNS TTL before a planned host-to-host cutover.
5. **Generate the command:** Fill in target host, SSH user/port, public domain,
   HTTPS port, certificate mode, email, and the absolute source-side backup
   path in CMS. Copy the generated command.
6. **Run from the source checkout:** Execute the command from the repository
   root. SSH and sudo prompts stay in the terminal; no remote password is sent
   to or stored by CMS.
7. **Verify the destination:** Confirm HTTP redirects to HTTPS, HTTPS and `/api`
   respond, the app container reports healthy, CMS login works, and an uploaded
   asset loads. For Let's Encrypt, inspect that the issuer is not self-signed.
8. **Create a destination backup:** Download a new archive after verification.
   Only then retire the old deployment and remove its data.

Useful checks:

```bash
dig +short portfolio.example.com
curl -I http://portfolio.example.com
curl -I https://portfolio.example.com
curl -fsS https://portfolio.example.com/api
ssh root@SERVER_IP \
  'cd /opt/p00rija-portfolio && docker compose -f docker-compose.web.yml ps'
```

Troubleshooting and rollback:

- DNS/SSL failure: verify A/AAAA records, DNS propagation, and inbound ports
  `80/443` before rerunning migration.
- SSH failure: verify target user, SSH port, key/password, and `sudo -v`.
- Restore failure: verify the archive extension/checksum and free disk space.
- Application failure: inspect `app` and `nginx` logs on the destination.
- Cutover failure: keep the source online and point DNS back to its previous IP;
  fix the destination and repeat the migration. Never delete source data before
  destination HTTPS, CMS, assets, and backup are confirmed.

Each install can run directly on localhost or behind Nginx:

- Direct localhost mode asks for local host/IP and app port, for example
  `127.0.0.1:3000`.
- Nginx mode asks for public host/IP/domain, public port, internal app port,
  and SSL settings.

The Nginx installer asks for:

- Public host: IP address or domain.
- Public port: default is `443`.
- Internal app port behind Nginx: default is `3000`.
- SSL mode:
  - existing certificate files: enter the `fullchain.pem`/certificate path and private key path,
  - Let's Encrypt with certbot for real public domains: the installer asks for an email and rejects localhost/IP installs,
  - local self-signed certificate.

When SSL is enabled, Nginx redirects HTTP port `80` to HTTPS and proxies traffic to the internal Next.js app.

Native Linux mode runs as a systemd service:

```bash
systemctl status p00rija-portfolio
journalctl -u p00rija-portfolio -f
```

Native macOS mode runs as a launchd service:

```bash
sudo launchctl print system/com.p00rija.portfolio
tail -f server.log
```

Docker mode builds the local `Dockerfile`, starts `p00rija-portfolio`, and binds
it to the host/port you selected. In Nginx mode it binds privately to
`127.0.0.1:<internal-port>` and exposes the app publicly through Nginx.

Docker commands:

```bash
docker logs -f p00rija-portfolio
docker ps -a --filter name=p00rija-portfolio
```

Persistent Docker data is stored under:

```bash
/var/lib/p00rija-portfolio
```

## Debug indicator

The small Next.js/Node debug indicator is a development-only overlay. It appears in `next dev` and is not included in the production standalone server.

Controls:

- Production install: hidden automatically because the installer runs `NODE_ENV=production`.
- Development mode: run `./run.sh --hide-dev-indicator`, or set `HIDE_NEXT_DEV_INDICATOR=1`.
- The mechanism is in `next.config.ts`: when `HIDE_NEXT_DEV_INDICATOR=1` or `NEXT_DEV_INDICATOR=0`, `devIndicators` is set to `false`.

## Hot-reload development container

For development there is a dedicated compose stack that reflects every local
file edit into the running app instantly — no container restart, no rebuild:

```bash
docker compose -f docker-compose.dev.yml up --build
```

- The app runs with `next dev` at <http://127.0.0.1:7890>.
- The repository is bind-mounted into the container, so saving any file in
  your editor hot-reloads the page (Fast Refresh).
- `WATCH_POLL_INTERVAL_MS=300` enables file-watcher polling — required on
  macOS/Windows because Docker bind mounts do not propagate native
  filesystem events into the Linux VM. It is wired through
  `watchOptions.pollIntervalMs` in `next.config.ts` and only activates when
  the variable is set.
- `node_modules` and `.next` live in named volumes so the host folders never
  shadow the container's dependencies/build cache.
- `./db` is bind-mounted, so CMS edits persist in the repository database.
- Prisma client is regenerated and the schema pushed on container start, so
  `prisma/schema.prisma` edits apply without rebuilding the image.

The production stack (`docker-compose.server.yml`) is unchanged: it still
builds a self-contained standalone image.

## Contact form delivery — no mail server needed

Configure from **CMS → فرم‌ساز و ایمیل / Forms → Delivery**:

| Provider | How it works | Setup |
| --- | --- | --- |
| `whatsapp-link` | On submit the visitor's WhatsApp opens with the composed message addressed to your number — they just press send | Enter your number in international format (e.g. `98912…`) |
| `telegram-link` | Message is copied to the clipboard and your Telegram chat (`t.me/<username>`) opens — visitor pastes and sends | Enter your @username (without `@`) |
| `mailto` | The visitor's own mail app opens pre-filled with subject/body — no server involved | Set the recipient in the `To` field |
| `smtp` / `gmail` / `microsoft` / `custom` | Classic server-side email | Host/user in CMS, password in `.env` as `SMTP_PASS` (or the env name set in `passwordEnv`) |

The first three providers run **entirely in the visitor's browser** — zero
server load, no tokens, no third-party account, works on the cheapest
hosting. `none` accepts and logs messages server-side without delivering.

> Server-side Bot API / Cloud API push was evaluated and intentionally not
> shipped: the repo's security scanner (SSRF protection) blocks outbound
> server fetches to configurable URLs. The link-based providers deliver the
> same outcome (message arrives in your WhatsApp/Telegram) without that
> attack surface.
