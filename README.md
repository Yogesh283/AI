# NeoXAI / AI

Monorepo: **backend** (FastAPI), **web** (Next.js), **mobile** (Expo).

Clone, then copy `backend/.env.example` → `backend/.env` and set your keys locally (never commit `.env`).

**Production:** [deploy.md](./deploy.md) — local `git push`, server `git pull` + build + `pm2 restart`.

**Local dev (Windows):** [LOCAL.md](./LOCAL.md) — backend `8010` + `npm run dev` in `web/`, ya `run_local.ps1`.
