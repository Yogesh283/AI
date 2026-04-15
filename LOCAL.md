# Local run (Windows / PowerShell)

## Do cheezein ek saath

1. **Backend** (FastAPI, port `8010`):

```powershell
Set-Location D:\AI\backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

2. **Web** (Next.js, port `3000`) — **alag terminal**:

```powershell
Set-Location D:\AI\web
npm run dev
```

Browser: **http://localhost:3000**

- API browser se **`/neo-api/...`** jaati hai (Next proxy → `http://127.0.0.1:8010`). Backend band ho to chat / auth fail hoga.
- Check: http://127.0.0.1:8010/health

## Common fixes

- **`&&` error** — purane PowerShell mein `&&` mat use karo; line alag karo ya `;` use karo (`Set-Location ...; python ...`).
- **`Another next dev server is already running`** — pehla band karo:

```powershell
netstat -ano | findstr ":3000"
taskkill /PID <PID> /F
```

- **Page load nahi / hang** — upar wala `taskkill` karke `npm run dev` dubara.
- **`run_dev.ps1` blocked** — `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (ek baar), ya seedha `python -m uvicorn ...` command use karo.

## Ek-click (do nayi windows)

Repo root (`D:\AI`) se:

```powershell
powershell -ExecutionPolicy Bypass -File .\run_local.ps1
```

Ye `run_local.ps1` backend + web alag windows mein khol deta hai.
