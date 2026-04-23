/**
 * PM2 ecosystem (repo root).
 *
 * Server (default paths match deploy.md):
 *   export APP_ROOT=/home/myneoxai/apps/neoxai   # optional
 *   pm2 restart "$APP_ROOT/ecosystem.config.cjs" --update-env
 *
 * First-time from this file (replaces manual `pm2 start` if you want one source of truth):
 *   pm2 delete neo-api neo-web 2>/dev/null || true
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *
 * Ensure backend script is executable: chmod +x backend/start-neo-api.sh
 */
const APP_ROOT = process.env.APP_ROOT || "/home/myneoxai/apps/neoxai";

module.exports = {
  apps: [
    {
      name: "neo-api",
      cwd: `${APP_ROOT}/backend`,
      script: "./start-neo-api.sh",
      interpreter: "bash",
      watch: false,
      max_memory_restart: "512M",
    },
    {
      name: "neo-web",
      cwd: `${APP_ROOT}/web`,
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      watch: false,
      max_memory_restart: "1G",
    },
  ],
};
