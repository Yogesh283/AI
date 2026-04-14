# NeoXAI / AI

Monorepo: **backend** (FastAPI), **web** (Next.js), **mobile** (Expo).

Clone, then copy `backend/.env.example` → `backend/.env` and set your keys locally (never commit `.env`).

**Production:** [deploy.md](./deploy.md)

**Server (GitHub → live):** clone full repo on the server → `backend/.env` → run API on **8010** → `web/` build + **NEO_API_INTERNAL_URL** → run Next on **3000** → Nginx/CloudPanel sends **HTTPS → 3000** (including `/neo-api`). Details + CloudPanel: **deploy.md §11**.
