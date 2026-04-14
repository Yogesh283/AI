# Server deploy (Git → production)

This repo is a **monorepo**: `backend/` (FastAPI), `web/` (Next.js), `mobile/` (Expo).  
Below: **Ubuntu-style VPS** (Nginx + Node + Python). Adjust paths/users for your OS.

---

## 1. Server prerequisites

- **Git**, **Node.js 20+**, **Python 3.11+**, **Nginx**
- Optional: **MySQL 8** (chat/memory for logged-in users)
- A domain with DNS pointing to the server (for HTTPS)

```bash
sudo apt update && sudo apt install -y git nginx python3 python3-venv
# Node: use NodeSource or nvm — https://github.com/nvm-sh/nvm
```

Create a deploy user (optional but recommended):

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
```

---

## 2. Clone from GitHub

```bash
cd /var/www   # or /home/deploy/apps
sudo git clone https://github.com/Yogesh283/AI.git neoxai
sudo chown -R deploy:deploy neoxai
cd neoxai
```

Updates later:

```bash
cd /var/www/neoxai && git pull origin main
```

---

## 3. Backend (FastAPI) — port **8010**

### 3.1 Virtualenv and dependencies

```bash
cd /var/www/neoxai/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3.2 Environment

```bash
cp .env.example .env
nano .env   # never commit this file
```

Set at least:

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key |
| `JWT_SECRET` | Long random string for JWT |
| `CORS_ORIGINS` | `https://yourdomain.com` (comma-separated if multiple) |
| `GOOGLE_CLIENT_IDS` | If using Google sign-in |
| `MYSQL_*` | If using MySQL (uncomment and fill) |

Import DB schema (if using MySQL):

```bash
mysql -u root -p < sql/init_ai_users.sql
# Migrations if upgrading:
# mysql -u root -p ai < sql/migration_chat_messages_source.sql
# mysql -u root -p ai < sql/migration_users_voice_persona.sql
```

### 3.3 Production process (systemd)

Backend should listen on **127.0.0.1:8010** (only Nginx/Next talk to it from outside).

`/etc/systemd/system/neoxai-api.service`:

```ini
[Unit]
Description=NeoXAI FastAPI (uvicorn)
After=network.target

[Service]
User=deploy
Group=deploy
WorkingDirectory=/var/www/neoxai/backend
Environment="PATH=/var/www/neoxai/backend/.venv/bin"
ExecStart=/var/www/neoxai/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8010
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now neoxai-api
curl -s http://127.0.0.1:8010/health
```

---

## 4. Web (Next.js) — port **3000**

### 4.1 Build

```bash
cd /var/www/neoxai/web
npm ci
npm run build
```

### 4.2 Environment for the Node process

The browser calls **`/neo-api`** on the same domain. Next.js **proxies** to FastAPI using:

- **`NEO_API_INTERNAL_URL`** — where the Next server forwards `/neo-api/*` (default `http://127.0.0.1:8010`).

Create `web/.env.production` (or set in systemd `Environment=`):

```env
NEO_API_INTERNAL_URL=http://127.0.0.1:8010
```

**Important (Nginx):** Route **`/neo-api`** to **Next (3000)**, not directly to 8010. The Next app’s route handler forwards to the backend internally.

### 4.3 systemd for Next

`/etc/systemd/system/neoxai-web.service`:

```ini
[Unit]
Description=NeoXAI Next.js
After=network.target neoxai-api.service

[Service]
User=deploy
Group=deploy
WorkingDirectory=/var/www/neoxai/web
Environment=NODE_ENV=production
Environment=NEO_API_INTERNAL_URL=http://127.0.0.1:8010
ExecStart=/usr/bin/npm run start -- -p 3000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

(Adjust `npm` path if you use `nvm` — use full path to `node`/`npm`.)

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now neoxai-web
curl -sI http://127.0.0.1:3000 | head -1
```

---

## 5. Nginx (HTTPS + reverse proxy)

Example: HTTPS on `443`, HTTP → HTTPS redirect.

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # /neo-api goes to Next — Next proxies to FastAPI (see web/src/app/neo-api/...)
    location /neo-api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

TLS with **Certbot**:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 7. Deploy flow after code changes

```bash
cd /var/www/neoxai
git pull origin main

# Backend
sudo systemctl restart neoxai-api

# Web
cd web && npm ci && npm run build && cd ..
sudo systemctl restart neoxai-web
```

---

## 8. Mobile (Expo) — optional

Build APK/IPA with EAS; set **`EXPO_PUBLIC_API_URL`** to your public API URL (e.g. `https://yourdomain.com` if you expose API via same host, or a dedicated API subdomain — must match CORS and HTTPS rules).

---

## 9. Checklist

- [ ] `backend/.env` on server with real secrets (never in Git)
- [ ] `CORS_ORIGINS` includes `https://yourdomain.com`
- [ ] MySQL imported if you use DB features
- [ ] `neoxai-api` running on `127.0.0.1:8010`
- [ ] `neoxai-web` on `3000`, `NEO_API_INTERNAL_URL` points to 8010
- [ ] Nginx: `/` and `/neo-api` → port **3000** (not 8010)
- [ ] HTTPS working, `curl https://yourdomain.com/neo-api/health` (via Next proxy) returns JSON

---

## 10. Troubleshooting

| Issue | What to check |
|-------|----------------|
| 502 Bad Gateway | `neoxai-web` / `neoxai-api` running? `journalctl -u neoxai-web -f` |
| API errors from browser | `NEO_API_INTERNAL_URL` on Next service; Nginx sends `/neo-api` to **3000** |
| CORS errors | `CORS_ORIGINS` in `backend/.env` includes your site URL |
| DB errors | MySQL running, `MYSQL_*` correct, migrations applied |

For local parity, dev uses `backend/run_dev.ps1` (port 8010) and `web` with `npm run dev` (port 3000).

---

## 11. CloudPanel (jab `/var/www/neoxai` / systemd units kaam na karein)

CloudPanel sites often live under **`/home/SITEUSER/htdocs/DOMAIN/`**. Agar tumne sirf **`web`** ka content clone kiya hai, to **`backend/` yahan hota hi nahi** — API deploy nahi hoti, isliye site “adhi” lagti hai.

### 11.1 Ek hi jagah poora repo (recommended)

**Site user** se login (example: `myneoxai`), root se mat pull karo (Git “dubious ownership” error aata hai).

```bash
# root se site user par switch (optional)
su - myneoxai

mkdir -p ~/apps
cd ~/apps
git clone https://github.com/Yogesh283/AI.git neoxai
cd neoxai
```

Agar pehle se alag jagah clone hai aur Git block kare:

```bash
git config --global --add safe.directory /home/myneoxai/apps/neoxai
```

### 11.2 Backend (FastAPI) — zaroori

```bash
cd ~/apps/neoxai/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
nano .env
```

`.env` mein kam se kam: `OPENAI_API_KEY`, `JWT_SECRET`, **`CORS_ORIGINS=https://myneoxai.com`** (apna domain), optional MySQL.

API ko **localhost par** chalao (bahar se seedha 8010 expose mat karo):

```bash
# test
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8010
# Ctrl+C ke baad production ke liye PM2 ya systemd neeche
```

**PM2 example** (site user):

```bash
npm install -g pm2   # agar nahi hai
cd ~/apps/neoxai/backend
source .venv/bin/activate
pm2 start "`which uvicorn`" --name neoxai-api --interpreter none -- app.main:app --host 127.0.0.1 --port 8010
pm2 save
```

### 11.3 Web (Next.js)

```bash
cd ~/apps/neoxai/web
nano .env.production
```

Daalo:

```env
NEO_API_INTERNAL_URL=http://127.0.0.1:8010
```

Phir:

```bash
npm ci
npm run build
pm2 start npm --name neoxai-web -- start -- -p 3000
pm2 save
```

CloudPanel **Nginx** ko is tarah samjho: **`https://myneoxai.com`** → **port 3000** (Next). **`/neo-api`** bhi **3000** par jana chahiye (Next proxy backend ko andar forward karta hai) — **8010 seedha public mat kholo**.

Agar CloudPanel mein site abhi **`htdocs/.../web`** par point karti hai, to **Site settings** mein document root / Node app path badh kar **`~/apps/neoxai/web`** par lao, ya panel ke “Reverse proxy” se **3000** par bhejo — panel version ke hisaab se UI alag ho sakta hai ([CloudPanel docs](https://www.cloudpanel.io/docs/v2/)).

### 11.4 Purana folder `htdocs/.../web`

- Ya to **band** karke naya path (`~/apps/neoxai/web`) use karo,
- Ya **symlink** (sirf jab tum jaante ho kya kar rahe ho):

  `ln -sfn /home/myneoxai/apps/neoxai/web /home/myneoxai/htdocs/myneoxai.com/web` — pehle backup le lo.

### 11.5 Deploy dubara (har update)

**PC:** `git push`  
**Server (`myneoxai` user):**

```bash
cd ~/apps/neoxai && git pull origin main
cd backend && source .venv/bin/activate && pip install -r requirements.txt && deactivate
cd ../web && npm ci && npm run build
pm2 restart neoxai-api neoxai-web
```

### 11.6 Check

```bash
curl -s http://127.0.0.1:8010/health
curl -sI http://127.0.0.1:3000 | head -1
```

Browser: `https://myneoxai.com/neo-api/health` — JSON aana chahiye (Next proxy ke through).

---

**Short:** Deploy “nahi hua” isliye lagta hai kyunki **sirf frontend build** tha, **backend + PM2 + sahi URL path** complete nahi tha. Poora repo `~/apps/neoxai`, **API 8010**, **Next 3000**, **CloudPanel/Nginx → 3000** — tab end‑to‑end chalega.
