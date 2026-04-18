# Deploy — sirf commands (copy-paste)

**Repo:** `https://github.com/Yogesh283/AI.git`  

**Server path (yahan se sab chalta hai):** `/home/myneoxai/apps/neoxai`  
Agar tumhara path alag ho to neeche `APP_ROOT` badal dena.

**PM2 names:** `neo-api` (backend), `neo-web` (Next.js). Alag hon to commands mein naam badalna.

---

## A) Local PC → GitHub (code upload)

Project folder mein (Windows example `D:\AI`):

```bash
cd /d/AI
git add -A
git commit -m "update"
git push origin main
```

---

## B) Server SSH — **poora live update (ek hi block)**

Root / SSH ke baad **poora neeche wala paste karo** (order fix hai: pehle code, phir web build, phir backend deps, phir PM2):

```bash
export APP_ROOT=/home/myneoxai/apps/neoxai

git config --global --add safe.directory "$APP_ROOT"

cd "$APP_ROOT" && git pull origin main

cd "$APP_ROOT/web" && rm -rf .next && npm ci && npm run build

cd "$APP_ROOT/backend" && . .venv/bin/activate && pip install -r requirements.txt

pm2 restart neo-api neo-web
```

**Verify (optional):**

```bash
curl -sS http://127.0.0.1:8010/health
curl -sI http://127.0.0.1:3000 | head -5
git -C /home/myneoxai/apps/neoxai log -1 --oneline
```

Browser: **Incognito** ya `Ctrl+Shift+R` (cache).

---

## B2) Login live par local jaisa (NeoXAI + Google button on)

Do cheezein alag ho sakti hain:

1. **Brand text** — `myneoxai.com` pe pehle domain se "Myneoxai" ban raha tha; code me ab override hai. Phir bhi custom naam chaho to `web/.env.production` mein daalo: `NEXT_PUBLIC_APP_NAME=NeoXAI`.
2. **Google button** — `NEXT_PUBLIC_GOOGLE_CLIENT_ID` sirf build time pe bundle mein jaata hai. Isko **`web/.env` ya `web/.env.production`** mein daal kar **dobara `npm run build`** zaroor chalao; sirf PM2 restart se kaam nahi chalega.

Example (`/home/myneoxai/apps/neoxai/web/.env.production`):

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
# optional:
# NEXT_PUBLIC_APP_NAME=NeoXAI
```

Backend mein pehle se `GOOGLE_CLIENT_IDS` (same client ID allowed) hona chahiye. Build:

```bash
cd /home/myneoxai/apps/neoxai/web && rm -rf .next && npm ci && npm run build -- --webpack && PORT=3000 pm2 restart neo-web
```

### Live error: `Google sign-in is not configured (set GOOGLE_CLIENT_IDS)`

Iska matlab **frontend** mein button on hai, lekin **backend** (`neo-api`) ko verify karne ke liye client ID nahi mil rahi.

Server par:

```bash
nano /home/myneoxai/apps/neoxai/backend/.env
```

Ye line add/update karo (**Web application** wala OAuth Client ID — wahi jo `NEXT_PUBLIC_GOOGLE_CLIENT_ID` hai):

```bash
GOOGLE_CLIENT_IDS=YOUR_CLIENT_ID.apps.googleusercontent.com
```

Ya single-ID shorthand:

```bash
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

Phir backend restart:

```bash
pm2 restart neo-api
# agar PM2 ecosystem mein env alag ho:
# pm2 restart neo-api --update-env
```

Check (optional): `grep GOOGLE /home/myneoxai/apps/neoxai/backend/.env`

**Duplicate / empty lines:** agar `grep` mein `GOOGLE_CLIENT_IDS=` (khali) bhi dikhe to hata do — warna kuch parsers pe value empty ho sakti hai. Sirf **ek** non-empty line rakho, ya code update ke baad last non-empty line auto pick ho jayegi.

```bash
sed -i '/^GOOGLE_CLIENT_IDS=$/d' /home/myneoxai/apps/neoxai/backend/.env
```

---

## C) Sirf **frontend** dubara build (backend same rakho)

```bash
cd /home/myneoxai/apps/neoxai/web && rm -rf .next && npm ci && npm run build && pm2 restart neo-web
```

---

## D) Sirf **backend** restart / deps

```bash
cd /home/myneoxai/apps/neoxai/backend && . .venv/bin/activate && pip install -r requirements.txt && pm2 restart neo-api
```

---

## E) `git pull` fail — PC se files upload ke **baad** (bina Git)

PC par zip / WinSCP se `neoxai` (ya `web` folder) server par copy karne ke **baad**:

```bash
cd /home/myneoxai/apps/neoxai/web && rm -rf .next && npm ci && npm run build && pm2 restart neo-web
```

---

## F) PM2 `neo-web` sahi folder se start (galat cwd ho to)

```bash
cd /home/myneoxai/apps/neoxai/web
pm2 delete neo-web
pm2 start npm --name neo-web --cwd /home/myneoxai/apps/neoxai/web -- start
pm2 save
```

---

## G) Problem ho to — chhote checks

**GitHub / HTTPS server par band hai?**

```bash
curl -sI --connect-timeout 8 https://github.com | head -3
```

Khali / fail → pehle hosting par **outbound 443** theek karo; tab **B** wala `git pull` kaam karega.

**API sun raha hai?**

```bash
curl -sS http://127.0.0.1:8010/health
ss -tlnp | grep 8010
pm2 restart neo-api
```

**Logs:**

```bash
pm2 logs neo-web --lines 30
pm2 logs neo-api --lines 30
```

---

*Local dev se automatic deploy nahi hota — `git push` + server par **B** (ya **E**) chalana zaroori hai.*


## cd /home/myneoxai/apps/neoxai && git pull origin main
 

cd /home/myneoxai/apps/neoxai
git pull origin main
git -C /home/myneoxai/apps/neoxai log -1 --oneline
Dikhna chahiye: 761bcfc fix: NeoXAI brand...

cd /home/myneoxai/apps/neoxai/web
rm -rf .next && npm run build -- --webpack
PORT=3000 pm2 restart neo-web
Optional check (code aaya ya nahi):









export APP_ROOT=/home/myneoxai/apps/neoxai

cd "$APP_ROOT" && git pull origin main

cd "$APP_ROOT/backend" && . .venv/bin/activate && pip install -r requirements.txt

pm2 restart neo-api

grep -n "HOST_BRAND_OVERRIDES" /home/myneoxai/apps/neoxai/web/src/lib/siteBrand











cd "D:\AI\web\android"
.\gradlew.bat assembleDebug




Set-Location "D:\AI\web\android"
.\gradlew.bat assembleRelease

---

## Android Studio + USB — local PC par test (localhost)

Phone ko USB se PC se jodo, **USB debugging** on. WebView ko **`http://localhost:3000`** chahiye — phone par “localhost” PC ka hi hota hai, isliye **port reverse** zaroori hai.

1. **Backend** (ek terminal): FastAPI `127.0.0.1:8010` par (Neo API). Next.js `/neo-api` isi ko proxy karta hai.
2. **Next dev** (doosra terminal):
   ```powershell
   cd D:\AI\web
   npm run dev
   ```
3. **ADB reverse** (teesra terminal, cable ke baad dubara chalao agar device reconnect ho):
   ```powershell
   adb reverse tcp:3000 tcp:3000
   ```
4. **Capacitor local URL** (Capacitor config mein `server.url` = localhost):
   ```powershell
   cd D:\AI\web
   npm run cap:sync:android:local
   ```
5. **Android Studio**: `D:\AI\web\android` open karo → USB device select → **Run** ▶.

**Check:** `adb devices` mein device `device` dikhna chahiye (unauthorized ho to phone par allow karo).

**Live site test** (USB ke bina): `npm run cap:sync:android:prod` phir Gradle build — WebView `https://myneoxai.com` load karega.








export APP_ROOT=/home/myneoxai/apps/neoxai
cd "$APP_ROOT"

# 1) Backend env backup (zaroori)
cp backend/.env /root/backend.env.backup-$(date +%Y%m%d%H%M) 2>/dev/null || true

# 2) Jo untracked Java files merge rok rahi thi — side pe rakh do (chaaho to baad mein dekho)
mkdir -p /root/neo-android-java-backup
mv web/android/app/src/main/java/com/neo/assistant/NeoBootReceiver.java /root/neo-android-java-backup/ 2>/dev/null || true
mv web/android/app/src/main/java/com/neo/assistant/NeoCommandRouter.java /root/neo-android-java-backup/ 2>/dev/null || true
mv web/android/app/src/main/java/com/neo/assistant/WakeWordForegroundService.java /root/neo-android-java-backup/ 2>/dev/null || true

# 3) Repo ko bilkul GitHub main jaisa karo (saari local file edits hata deta hai)
git fetch origin
git reset --hard origin/main
git clean -fd

# 4) Confirm same commit as GitHub
git log -1 --oneline

# 5) Phir deploy
cd "$APP_ROOT/web" && rm -rf .next && npm ci && npm run build
cd "$APP_ROOT/backend" && . .venv/bin/activate && pip install -r requirements.txt
pm2 restart neo-api neo-web