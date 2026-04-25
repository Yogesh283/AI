# Deploy - only Local -> Git -> Server

**Repo:** `https://github.com/Yogesh283/AI.git`  
**Server path:** `/home/myneoxai/apps/neoxai`  
**PM2 names:** `neo-api` (backend), `neo-web` (Next.js)

---

## 1) Local PC -> GitHub

```bash
cd /d/AI
git add -A
git commit -m "update"
git push origin main
```

---

## 2) Server deploy (Git pull + build + restart)

```bash
export APP_ROOT=/home/myneoxai/apps/neoxai

cd "$APP_ROOT" && git pull origin main

cd "$APP_ROOT/web" && rm -rf .next && npm ci && npm run build

cd "$APP_ROOT/backend" && . .venv/bin/activate && pip install -r requirements.txt

pm2 restart neo-api neo-web
```

---

## 3) Verify (optional)

```bash
git -C /home/myneoxai/apps/neoxai log -1 --oneline
curl -sS http://127.0.0.1:8010/health
curl -sI http://127.0.0.1:3000 | head -5
```

Browser hard refresh: `Ctrl+Shift+R` (or Incognito).
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

## G2) Chat: `ConnectError` / “All connection attempts failed” — **Nginx (permanent fix)**

Yeh error aksar **OpenAI key missing** se kam aur **galat reverse-proxy** se zyada hota hai.

**Architecture (yaad rakho):**

| Layer | Port | Kaam |
|--------|------|------|
| **Browser / APK** | HTTPS 443 | Sirf **domain** — kabhi seedha `8010` expose mat karo. |
| **Nginx** | 443 → **3000** | Saari site + **`/neo-api`** → **Next.js (`neo-web`)**. |
| **Next.js** | 3000 | `app/neo-api/...` se andar se FastAPI ko proxy (`127.0.0.1:8010`). |
| **FastAPI** | **8010** sirf `127.0.0.1` | `neo-api` — yahi par `OPENAI_API_KEY` use hoti hai. |

**Galat:** Nginx mein `location /neo-api` → `http://127.0.0.1:8010` (browser ko seedha backend / galat TLS / ConnectError).

**Sahi:** **`/` aur `/neo-api` dono** → `http://127.0.0.1:3000` (Next).

Nginx `server { ... }` ke andar (apni `server_name` + SSL paths adjust karo):

```nginx
location /neo-api {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400s;
    proxy_buffering off;
}

location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Phir:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Verify (domain se):**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://myneoxai.com/neo-api/health
```

`200` ya **401** (JWT required) theek hai — matlab Next tak request pahunch rahi hai. **`000` / connection refused** = abhi bhi galat upstream.

---

## G3) OpenAI API — **server par permanently** (`neo-api`)

Chat + voice ke liye **FastAPI** ko valid key chahiye; yeh file **server** par rehti hai, build mein nahi.

```bash
nano /home/myneoxai/apps/neoxai/backend/.env
```

Ek strong line (example):

```bash
OPENAI_API_KEY=sk-...your-real-secret-key...
```

Save ke baad:

```bash
pm2 restart neo-api --update-env
```

Check:

```bash
curl -sS http://127.0.0.1:8010/health
pm2 logs neo-api --lines 25
```

Agar **G2 (Nginx → 3000)** + **G3 (`OPENAI_API_KEY`)** + **`pm2 restart neo-api neo-web`** teeno theek hon, to wohi “Chat failed: ConnectError…” routing wala message dubara nahi aana chahiye.

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
# Sideload (separate package; installs beside Play): app-sideload-release.apk
.\gradlew.bat assembleSideloadRelease
# Play / same package id as store: app-play-release.apk
.\gradlew.bat assemblePlayRelease

---

## Android Studio + USB — local PC par test (localhost)

Phone ko USB se PC se jodo, **USB debugging** on. WebView ko **`http://localhost:3000`** chahiye — phone par “localhost” PC ka hi hota hai, isliye **port reverse** zaroori hai.

1. **Backend** (ek terminal): FastAPI `127.0.0.1:8010` par (Neo API). Next.js `/neo-api` isi ko proxy karta hai.
2. **Next dev** (doosra terminal):
   ```powershell
   cd D:\AI\web
   npm run dev
   ```
3. **Capacitor local URL + port reverse:** `npm run cap:sync:android:local` ab **khud `adb reverse tcp:3000`** try karta hai (agar `Android\Sdk\platform-tools\adb.exe` mile). Cable replug par ye script dubara chalao.
   - Agar sirf **Next** se sab chal raha hai ( `/neo-api` proxy), bas yahi kaafi.
   - Agar phone **seedha 8010** bhi chuye: `npm run cap:sync:android:local:api` (3000 + 8010 reverse).
   - Manual: `adb reverse tcp:3000 tcp:3000` (aur zarurat ho to `8010`).
4. **Android Studio**: `D:\AI\web\android` open karo → USB device select → **Run** ▶ (debug build phone par seedha live WebView kholta hai).
   - **Build Variants** (left edge / View → Tool Windows): `app` ke liye **`playDebug`** (ya **`sideloadDebug`**) select karo — plain `debug` variant nahi hai.
   - Agar Android Studio phir bhi `apk_ide_redirect_file\debug\...\redirect.txt` maange: `app/build.gradle` ab Gradle se **playDebug/sideloadDebug redirect ko `debug/...` par mirror** karta hai; **Sync Gradle** karke **Run** dubara chalao. Phir bhi ho to **Build → Clean / Rebuild**.

**Check:** `adb devices` mein device `device` dikhna chahiye (unauthorized ho to phone par allow karo).

**Live site test** (USB ke bina): `npm run cap:sync:android:prod` phir Gradle build — WebView `https://myneoxai.com` load karega.

### APK release signing & permissions (production)

1. **Release keystore:** `web/android/keystore.properties.example` ko copy karke `web/android/keystore.properties` banao (ye file gitignored hai). `storeFile` path `web/android/app/` se relative hai (example me `../neo-release.jks` = `web/android/neo-release.jks`).
2. **Script:** `web/scripts/build-release-apk.ps1` production ke liye **`keystore.properties` zaroori** maangta hai. Sirf local test ke liye `-AllowDebugSigning` do — warna release **debug key** se sign ho sakti hai (Play Protect / install-over-Play zyada problem).
3. **SHA-1 (Google Sign-In Android client):** `cd D:\AI\web\android` → `.\gradlew.bat signingReport` → **sideloadRelease** / **playRelease** variant ka SHA-1 (jo keystore use ho rahi ho). **Sideload** package name: `com.neo.assistant.sideload`. **Play** flavor: `com.neo.assistant`.
4. **Declared permissions (high level):** `INTERNET`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` (sirf volume voice commands), foreground service + `microphone` type, `POST_NOTIFICATIONS`, `WAKE_LOCK`. **No** `CALL_PHONE`, SMS, contacts read, or broad storage. **Dial:** voice “call” commands sirf **`ACTION_DIAL`** (system dialer) kholte hain. **Play flavor:** optional **notification listener** service manifest me hai (user system settings me enable kare tabhi). **Sideload flavor (`NeoAssistant-sideload-install.apk`):** merge manifest se ye service **hata di** gayi hai taake Play Protect / sideload heuristic kam trigger ho (WhatsApp preview feature sideload me nahi rahega).

In-app copy for permission text lives in `web/android/app/src/main/res/values/strings.xml` (`neo_perm_*`).

### “App not installed” / ऐप इंस्टॉल नहीं हो रहा (`NeoAssistant-release-install.apk`)

Ye file **Play flavor** hai: package **`com.neo.assistant`** (Play Store listing jaisa). Android **alag signing key** wali nayi APK ko purane app ke **upar update** nahi karne deta — sirf generic **“App not installed”** dikhata hai.

1. **Sabse common fix:** **Settings → Apps → NeoAssistant** (jo bhi naam dikh raha ho) → **Uninstall** → phir APK dubara install karo. (Pehle se Play Store se install hai aur tum debug/local APK se update kar rahe ho — uninstall zaroori.)
2. **Play ke saath test bina uninstall:** `NeoAssistant-sideload-install.apk` use karo — package **`com.neo.assistant.sideload`**, Play wale ke **saath** install ho sakta hai.
3. **CPU:** Is build me sirf **ARM** (`arm64-v8a`, `armeabi-v7a`) hai. **x86 emulator / kuch purane x86 tablet** par install fail ho sakta hai — real ARM phone par try karo.
4. **ADB se exact error:** PC par `adb install -r D:\AI\NeoAssistant-release-install.apk` — message me `INSTALL_FAILED_*` code aayega (signature / ABI / storage).

**`npm run apk:release`** ab **release keystore** maangta hai (`web/android/keystore.properties`). Bina keystore local test: **`npm run apk:dev`** (debug-signed; production phone par Play ke saath clash ho sakta hai).

### Google Play Protect — “App blocked to protect your device”

Jab APK **Play Store se nahi** aati (WhatsApp / Files / Drive se sideload), **Google Play Protect** aksar **install rok deta hai** — message me “sensitive data” / “identity theft” jaisa generic text hota hai. NeoAssistant me **mic**, foreground notification, Google Sign-In / WebView, aur (purane sideload par) notification listener jaise signals heuristic ko **strict** bana sakte hain. **Latest sideload build** notification listener service **manifest se strip** karta hai; phir bhi kabhi-kabhi sirf **OK** wala block aa sakta hai — **koi 100% sideload guarantee nahi**.

**Kya karein (order me try karo):**

1. **WhatsApp ke andar direct install mat karo.** APK ko **Downloads** me save karo, phir **Files / My Files** app khol kar wahi `.apk` par tap karke **Install** chalao. Kai ROMs par WhatsApp installer par sirf **OK** dikhta hai, “Install anyway” nahi milta.
2. Install screen par agar **“Install anyway”**, **“More details”**, ya **“Learn more”** ho to use follow karo (label device ke hisaab se alag ho sakta hai).
3. Phir bhi block ho to: **Settings → Security** (kabhi **Privacy** / **Google** ke andar) → **Google Play Protect** → **⚙ Settings** → temporary **“Scan apps with Play Protect”** / **“Improve harmful app detection”** **band** karo → APK install karo → baad me dubara **on** kar lena.
4. **Unknown apps:** **Settings → Apps → Special app access → Install unknown apps** → **Files** (ya jis app se APK kholi) par **Allow** hona chahiye.

**Permanent / commercial tareeka:** App ko **Google Play Console** (Internal testing / Closed testing / Production) par chala do — Play-distributed builds par Play Protect aise block nahi karta (Play App Signing + listing).

### APK: Login / Register — Continue with Google

1. **WebView (native):** `MainActivity` में third-party cookies + DOM storage on hai taake `accounts.google.com` iframe / OAuth state kaam kare; **user-agent se `; wv` hata** diya hai taake Google Identity “Sign in with Google” button WebView mein render ho (warna blank / FedCM bina iframe).
2. **Google Cloud Console → OAuth 2.0 Client IDs → Web client** (jo ID `NEXT_PUBLIC_GOOGLE_CLIENT_ID` / API se milta hai):
   - **Authorized JavaScript origins** mein wohi **HTTPS origin** add karo jahan se APK WebView page load hota hai (e.g. `https://myneoxai.com`). Local APK + `adb reverse` par `http://localhost:3000` bhi add kar sakte ho agar wahi client ID use ho.
3. **Backend:** `.env` mein `GOOGLE_CLIENT_IDS` (comma-separated) mein **usi Web client** ka ID hona chahiye jo frontend token ke liye use ho.
4. **Build:** Web bundle mein client ID empty na ho — prod build se pehle env verify karo.
5. **Android OAuth (APK / Credential Manager — zaroori):** Sirf “Web client” kaafi nahi. Google Cloud → **Credentials → Create credentials → OAuth client ID → Application type: Android**:
   - **Package name:** `assemblePlayRelease` ke liye `com.neo.assistant`. **Sideload APK** (`NeoAssistant-sideload-install.apk` / `assembleSideloadRelease`) ke liye `com.neo.assistant.sideload` — alag Android OAuth client (ya extra fingerprint policy ke hisaab se) add karo.
   - **SHA-1 certificate fingerprint:** `.\gradlew.bat signingReport` se **usi variant / signing config** ka SHA-1 lo jo user install karega (**release** keystore, debug nahi agar production ho). Google multiple fingerprints allow karta hai.
     ```powershell
     cd D:\AI\web\android
     .\gradlew.bat signingReport
     ```
   - Save ke baad **5–15 minute** wait, phir APK dubara install / try karo.

### Chat / Voice — OpenAI `ConnectError` ya TTS 503

Neo **server** se `https://api.openai.com` HTTPS nikalna zaroori hai (chat + Whisper + TTS). VPS par check: `curl -sI https://api.openai.com | head -1` → `HTTP/2 401` ya `403` theek hai (auth); **connection timeout / failed** = firewall / DNS / IPv6 / provider block. Proxy ho to backend env: `HTTPS_PROXY=...` (code `trust_env=True` use karta hai). `OPENAI_HTTP_MAX_RETRIES` (default 3) `.env` se badal sakte ho.

### Android APK — background voice assistant (wake word, commands, mic)

This answers the common product spec: **wake phrase** (e.g. “Hello Neo”) → **short command window** (“open WhatsApp”, “read messages”, “call contact”, “open YouTube”) → **spoken reply in the user’s language** → **do not leave the mic “hunting” forever** (fewer system beeps / battery).

#### What Neo ships today (this repo)

| Piece | Role | Where |
|--------|------|--------|
| Foreground service | Android 10+ needs a **visible notification** while using the mic; type `microphone` is declared on the wake service. | `WakeWordForegroundService.java`, `AndroidManifest.xml` |
| Speech → text | **`SpeechRecognizer`** + `RecognizerIntent` (Google on-device / OEM), not Python. One-shot utterances; silence timeouts (`EXTRA_SPEECH_INPUT_*_SILENCE_LENGTH_MILLIS`) end each capture. | `WakeWordForegroundService.java` |
| Wake + command | **Keyword in transcript**: “hello neo”, “neo”, “नियो”, “हेलो नियो” — then **rest of same string** is routed as the command (so wake + command can be one recognition pass). After each pass the service waits **~1.8–5.5s** before listening again (longer after a real command or wake-only) so the mic is not immediately hot again. | `extractWakeCommand()` + `pendingRelistenMs` in `WakeWordForegroundService.java` |
| App integration | **Intents / URIs**: WhatsApp (`whatsapp://`), Telegram (`tg://`), YouTube search, contacts, `tel:` digits, volume, time. Short **TTS** then open (so the user hears the next step). | `NeoCommandRouter.java` |
| Mic when screen off | Default: **stop** listening on `ACTION_SCREEN_OFF` to reduce pocket noise. Optional **listen while locked** via prefs / Profile (see `NeoPrefs.KEY_WAKE_SCREEN_OFF`, `MainActivity.onPause`). | `WakeWordForegroundService.java`, `MainActivity.java` |
| Boot | Wake **does not** auto-start on boot; user starts it from the app. Boot receiver entry was removed so no unused `RECEIVE_BOOT_COMPLETED` permission. | `AndroidManifest.xml` |

**Important limitation:** `SpeechRecognizer` is **not** a true always-on, low-power **wake word** engine (unlike dedicated SDKs). It runs **recognition sessions** in a loop with small delays after each result/error. For a stricter “mic only after wake” product, consider **Picovoice Porcupine**, **Snowboy** (deprecated), or **on-device hotword** APIs, then open the mic for a **second** `SpeechRecognizer` pass for the command only.

#### Libraries / APIs (suggested stack)

| Need | Practical options | Neo today |
|------|-------------------|-----------|
| Voice → text (command) | `SpeechRecognizer` (built-in), or **Google Cloud Speech-to-Text** / **Azure** for higher accuracy | `SpeechRecognizer` |
| Wake word (low power) | **Porcupine**, vendor hotword, or always-on assistant pipeline | Wake substring match on **full** `SpeechRecognizer` text |
| Language (Hindi vs English) | **ML Kit Language ID**, `Locale` + user setting, or **multilingual** cloud STT | `EXTRA_LANGUAGE` uses **`Locale.getDefault()`** — improve with explicit Hindi/English or ML Kit if you need auto-detect |
| Spoken reply | **Android `TextToSpeech`** | `NeoCommandRouter` + `TextToSpeech` |
| Open WhatsApp / Telegram / YouTube | **`Intent`**, `PackageManager.getLaunchIntentForPackage`, custom URI schemes | `NeoCommandRouter.java` |
| Web UI same commands | TypeScript intent layer (regex EN + HI) | `web/src/lib/neoVoiceCommands.ts`, `whatsappOpenCommand.ts`, `telegramOpenCommand.ts` |

#### Mic “on only for wake, then off” (pattern)

1. **Phase A — hotword:** tiny model always listening **without** full cloud STT, or aggressive **VAD + local** model.  
2. **Phase B — command:** start `SpeechRecognizer` once; on `onResults` / timeout, **stop** and run the command.  
3. **Phase C — TTS:** speak acknowledgment / next step (`TextToSpeech` or in-app audio).  
4. **Phase D:** delay (e.g. 300–800 ms) before returning to Phase A so the assistant does not **immediately** re-open the mic and clip the end of TTS.

Neo’s service already **stops** each recognition when the engine ends the session and **restarts** after a short delay for the next wake/command cycle; tightening Phase D or splitting **wake** vs **command** recognizers is the main upgrade path for “no repeated mic toggling sound.”

#### Server git hard-reset (emergency only)

Yeh snippet **saari local changes hata** kar repo ko `origin/main` jaisa kar deta hai. Sirf tab chalao jab tum samajh rahe ho kya delete ho raha hai.

```bash
export APP_ROOT=/home/myneoxai/apps/neoxai
cd "$APP_ROOT"

cp backend/.env /root/backend.env.backup-$(date +%Y%m%d%H%M) 2>/dev/null || true

mkdir -p /root/neo-android-java-backup
mv web/android/app/src/main/java/com/neo/assistant/NeoCommandRouter.java /root/neo-android-java-backup/ 2>/dev/null || true
mv web/android/app/src/main/java/com/neo/assistant/WakeWordForegroundService.java /root/neo-android-java-backup/ 2>/dev/null || true

git fetch origin
git reset --hard origin/main
git clean -fd

git log -1 --oneline

cd "$APP_ROOT/web" && rm -rf .next && npm ci && npm run build
cd "$APP_ROOT/backend" && . .venv/bin/activate && pip install -r requirements.txt
pm2 restart neo-api neo-web
```



















cd /home/myneoxai/apps/neoxai && git pull origin main
export APP_ROOT=/home/myneoxai/apps/neoxai
cd "$APP_ROOT" && git pull origin main