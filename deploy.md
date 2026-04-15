# Deploy commands

Repo: `https://github.com/Yogesh283/AI.git`  
Server path (example): `/home/myneoxai/apps/neoxai` — apne path / PM2 names se badal lena.

**Note:** Sirf local par project chalana (dev server, backend, browser test) se **koi automatic push / deploy nahi hota**. Remote tabhi update hota hai jab tum neeche wale `git add` → `commit` → `push` khud chalao.

---

## 1) Local → Git (4 commands)

Git Bash / terminal:

```bash
cd /d/AI
git add -A
git commit -m "update"
git push origin main
```

---

## 2) Server → Git pull + live (4 commands)

### Pehle: `fatal: detected dubious ownership` (bahut common)

Repo folder **dusre user** (jaise `myneoxai`) ka ho aur tum **`root`** se `git pull` chalao — to Git pull **block** kar deta hai. Bina iske **naya code server par aata hi nahi**; sirf purana code build hota rahega.

**Ek baar yeh chalao (root SSH par):**

```bash
git config --global --add safe.directory /home/myneoxai/apps/neoxai
```

Phir `git pull` dubara try karo. Verify: `git log -1 --oneline` GitHub jaisa latest commit dikhaye.

---

SSH ke baad:

```bash
cd /home/myneoxai/apps/neoxai && git pull origin main
cd /home/myneoxai/apps/neoxai/web && npm ci && npm run build
cd /home/myneoxai/apps/neoxai/backend && source .venv/bin/activate && pip install -r requirements.txt
```

```bash
pm2 restart neo-api neo-web
```

*(Pehli baar PM2 setup na ho to `deploy` alag se; `neo-api` / `neo-web` ke jagah apne PM2 process names.)*

**Order:** hamesha pehle `git pull`, phir `web` mein `npm run build`, phir backend `pip`, phir `pm2 restart`. Agar pull ke bina build chala diya to purana code build ho sakta hai.

---

## 3) Live pe update nahi dikh raha — checklist

### A) Server par sahi commit hai ya nahi

```bash
cd /home/myneoxai/apps/neoxai && git fetch origin && git log -1 --oneline && git status
```

Latest commit GitHub jaisa hona chahiye. Agar `behind` / merge issue ho to pehle `git pull origin main` fix karo.

### B) Next.js — clean build (purana `.next` hata kar)

```bash
cd /home/myneoxai/apps/neoxai/web
rm -rf .next
npm ci
npm run build
pm2 restart neo-web
```

### C) PM2 `neo-web` galat folder se to nahi chal raha

```bash
pm2 describe neo-web
```

Dekho: **`exec cwd`** (ya script path) **`.../neoxai/web`** hona chahiye jahan `npm run build` chala. Agar cwd alag hai to process purana `next start` serve kar sakta hai.

Sahi cwd se dubara start (example — apne path se):

```bash
cd /home/myneoxai/apps/neoxai/web
pm2 delete neo-web
pm2 start npm --name neo-web --cwd /home/myneoxai/apps/neoxai/web -- start
pm2 save
```

(Backend alag se: `neo-api` pehle jaisa hi.)

### D) Browser / CDN cache

- Hard refresh: `Ctrl+Shift+R` (Windows) ya Incognito window.
- Agar Cloudflare / proxy ho to **Development mode** ya cache purge** try karo.

### E) Logs

```bash
pm2 logs neo-web --lines 40
```

Build ke baad bhi purana UI ho to almost hamesha **(B)** ya **(C)** fix karta hai.

### F) Nginx sahi port par hai? (site purani lagti hai lekin build naya hai)

Server par:

```bash
curl -sI http://127.0.0.1:3000 | head -5
pm2 logs neo-web --lines 15
```

`next start` default **3000** par sunta hai. CloudPanel / Nginx mein jo **reverse proxy** domain → `127.0.0.1:XXXX` hai, wahi port hona chahiye jahan `neo-web` bind ho raha hai (often `3000`). Agar Nginx 3001 ko point kar raha ho aur PM2 3000 par ho, to purana process / galat site dikh sakti hai.

---

## 4) `git pull` → GitHub `port 443` / connection failed

Server se **bahar** HTTPS band ho to `git pull` kabhi kaam nahi karega — naya code GitHub se aayega hi nahi.

**Check:**

```bash
curl -sI --connect-timeout 5 https://github.com | head -3
```

- Agar yeh fail ho → hosting **outbound firewall**, DNS, ya network policy. CloudPanel / Hetzner / provider panel se **outbound HTTPS (443)** allow karo, ya support se puchho.
- **Workaround (jab tak Git fix na ho):** apne **PC** se repo zip / `rsync` / `scp` karke server par `/home/myneoxai/apps/neoxai` mein copy karo, phir `web` mein `npm run build` + `pm2 restart`.

---

## 5) `ECONNREFUSED 127.0.0.1:8010` (login / API fail)

Next.js **`/neo-api/*`** ko andar se **FastAPI** par bhejta hai (`NEO_API_INTERNAL_URL`, default `http://127.0.0.1:8010`). Agar port **8010** par koi process sun na raha ho to yeh error aayegi.

**Check:**

```bash
curl -sS http://127.0.0.1:8010/health
# ya
curl -sS http://127.0.0.1:8010/docs | head -5
ss -tlnp | grep 8010
pm2 logs neo-api --lines 40
```

**Fix (typical):** backend folder se API dubara start — repo mein `backend/start-neo-api.sh` **127.0.0.1:8010** par uvicorn chalata hai. PM2 mein `neo-api` is script / `uvicorn` ko point kare, phir:

```bash
pm2 restart neo-api
```

Agar `curl` ab bhi fail ho → `pm2 describe neo-api` se dekho **script path / cwd** sahi `.../neoxai/backend` hai ya nahi, aur `.venv` exists hai. Python error ke liye `pm2 logs neo-api` dekho.

**Order:** pehle **neo-api** healthy (`8010` OK), phir **neo-web** — warna login/chat proxy fail rahega.
