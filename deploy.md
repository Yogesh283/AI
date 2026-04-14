# Deploy commands

Repo: `https://github.com/Yogesh283/AI.git`  
Server path (example): `/home/myneoxai/apps/neoxai` — apne path / PM2 names se badal lena.

---

## 1) Local → Git (4 commands)

Git Bash / terminal:

```bash
cd /d/AI
```

```bash
git add -A
```

```bash
git commit -m "update"
```

```bash
git push origin main
```

---

## 2) Server → Git pull + live (4 commands)

SSH ke baad:

```bash
cd /home/myneoxai/apps/neoxai && git pull origin main
```

```bash
cd /home/myneoxai/apps/neoxai/web && npm ci && npm run build
```

```bash
cd /home/myneoxai/apps/neoxai/backend && source .venv/bin/activate && pip install -r requirements.txt
```

```bash
pm2 restart neo-api neo-web
```

*(Pehli baar PM2 setup na ho to `deploy` alag se; `neo-api` / `neo-web` ke jagah apne PM2 process names.)*
