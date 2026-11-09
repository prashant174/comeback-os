# Comeback OS

> Build Yourself. Track Your Progress. Become Better Every Day.

Personal life-management platform: habits, water, routine, fitness, nutrition, learning, finance and more — measured against targets you set. Full-stack: React + TypeScript frontend, Express + TypeScript API, MongoDB.

**Current state: Phases 1–4 complete** — auth, settings, dashboard, habits, water, daily routine, fitness, nutrition, learning, finance, grooming, sleep, goals, journal, analytics/exports, reminders & notifications. Phase 5 (AI assistant) is next. See [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Use it on your phone, from anywhere (free)
Comeback OS is an installable app (PWA). Host it free on Render + MongoDB Atlas and add it to your home screen — full guide: **[docs/FREE_HOSTING.md](docs/FREE_HOSTING.md)**.

## Quick start — local Windows (no Docker)

Requirements: Node.js 20+ (22 recommended), MongoDB Community 7+ running on `127.0.0.1:27017`.

```powershell
# 1. Backend
cd backend
npm install
copy .env.example .env
# Edit .env: paste two different secrets generated with
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm run dev            # → http://localhost:5000  (Swagger: /api/docs)

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev            # → http://localhost:5173
```

Open http://localhost:5173 → **Create the first account** (it becomes admin and is pre-filled with the default profile, targets, schedule and 10 habits). Then set `ALLOW_REGISTRATION=false` in `backend/.env` and restart the API to make the instance private.

## Quick start — Docker Compose

```bash
cp .env.example .env      # set both JWT secrets
docker compose up -d --build
# → http://localhost:8080
```
Services: `mongo` (volume `mongo_data`), `backend` (Node, port 5000 internal), `frontend` (Nginx serving the SPA and proxying `/api`).

## Environment variables (backend/.env)

| Variable | Default | Notes |
|---|---|---|
| NODE_ENV | development | `production` hides stack traces and dev reset links |
| PORT | 5000 | |
| MONGO_URI | mongodb://127.0.0.1:27017/comeback_os | |
| JWT_ACCESS_SECRET | — | **required**, ≥32 chars |
| JWT_REFRESH_SECRET | — | **required**, ≥32 chars, different from access |
| ACCESS_TOKEN_TTL | 15m | |
| REFRESH_TOKEN_TTL_DAYS | 30 | |
| CLIENT_URL | http://localhost:5173 | CORS allow-list, comma separated; also used in reset links |
| ALLOW_REGISTRATION | true | first user can always register |
| COOKIE_SECURE | false | set `true` behind HTTPS |
| TRUST_PROXY | 1 | proxies in front of the API (Render/Nginx = 1) |
| FRONTEND_DIST | — | path to `frontend/dist` to serve the app from the API (single-origin deploy; auto in production) |

The server refuses to start with missing/short secrets and prints which variable is wrong.

## Commands

| Where | Command | Does |
|---|---|---|
| backend | `npm run dev` | API with hot reload (tsx) |
| backend | `npm test` | 48 integration tests against real MongoDB (`comeback_os_test` db, dropped per test) |
| backend | `npm run typecheck` / `npm run build` / `npm start` | type check / compile to `dist/` / run compiled |
| frontend | `npm run dev` | Vite dev server, proxies `/api` → :5000 |
| frontend | `npm test` | 8 component + util tests (Vitest + Testing Library) |
| frontend | `npm run build` / `npm run preview` | production build / serve it locally |

Test DB override: `MONGO_URI_TEST=mongodb://host:27017/other_db npm test`.

## Password reset (no email yet)
Email delivery isn't wired up in Phase 1. When you request a reset, the link is written to the API log; in non-production it is also shown on the Forgot password screen. SMTP/Resend integration is on the roadmap.

## Starter data
Each module is seeded once per user with editable starter data: Mon–Fri / Saturday / Sunday routines, the home workout plan and 15 exercises, 22 common Indian foods and a weekly veg + egg meal plan, the 90-day learning roadmap, the ₹2,500 budget, grooming tasks, 7 goals and 10 reminders. Existing accounts get it automatically on their next request. Deleting starter data never re-seeds it.

**Food values are estimates.** Every seeded food is marked *Estimate* with its source note. Check pack labels or IFCT 2017, edit the numbers, and tick *verified*.

## Reminders & notifications
The API checks reminders every minute (in your timezone) and puts due ones in the bell. Browser notifications are optional (Settings → Reminders) and only appear **while a Comeback OS tab is open** — there is no push service yet. Budget alerts appear when a category crosses the alert threshold.

## Backup & restore (MongoDB)
```bash
# Backup (local)
mongodump --uri="mongodb://127.0.0.1:27017/comeback_os" --archive=backups/cbos-$(date +%F).gz --gzip
# Restore
mongorestore --uri="mongodb://127.0.0.1:27017/comeback_os" --archive=backups/cbos-2026-11-09.gz --gzip --drop

# Docker
docker compose exec -T mongo mongodump --db comeback_os --archive --gzip > cbos-backup.gz
docker compose exec -T mongo mongorestore --db comeback_os --archive --gzip --drop < cbos-backup.gz
```
Photos are stored inside MongoDB (GridFS), so a mongodump includes them.

Windows PowerShell: replace `$(date +%F)` with `$(Get-Date -Format yyyy-MM-dd)`. `mongodump` ships with MongoDB Database Tools (separate download on Windows).

Server deployment (VPS, Nginx, PM2, HTTPS): see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Troubleshooting

| Symptom | Fix |
|---|---|
| API exits with "Invalid environment variables" | Set both JWT secrets (≥32 chars) in `backend/.env` |
| `MongooseServerSelectionError` | MongoDB not running, or wrong `MONGO_URI`. On Windows check *Services → MongoDB Server* |
| UI says "Cannot reach the server" | Backend not running on :5000, or `VITE_API_PROXY` points elsewhere |
| Logged out on every refresh | Over plain HTTP keep `COOKIE_SECURE=false`; behind HTTPS set it `true`. Frontend and API must share the origin (proxy) for the cookie to be sent |
| CORS error | Add the exact frontend origin to `CLIENT_URL` |
| "Registration is disabled" | Intended once `ALLOW_REGISTRATION=false`; flip to `true` temporarily to add a user |
| 429 Too many attempts | Auth rate limit (30 / 15 min per IP). Wait or restart API in dev |
