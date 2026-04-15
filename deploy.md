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
