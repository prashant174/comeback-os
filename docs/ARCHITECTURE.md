# Comeback OS — Architecture

## 1. System architecture

```
 Browser (React SPA)                     Server                              Data
┌───────────────────────┐   HTTPS   ┌──────────────────────────┐        ┌──────────────┐
│ React + TS + Vite     │──────────▶│ Nginx                    │        │ MongoDB      │
│ TanStack Query cache  │  /api/*   │  ├ serves SPA (dist/)    │        │  per-user    │
│ access token (memory) │◀──────────│  └ proxies /api → :5000  │        │  collections │
│ refresh cookie (http- │           ├──────────────────────────┤ Mongoose│              │
│   Only, path=/api/auth│           │ Express API (TypeScript) │───────▶│              │
└───────────────────────┘           │  helmet · cors · rate-   │        └──────────────┘
                                    │  limit · sanitize · zod  │
                                    │  routes → controllers →  │──────▶ LLM provider
                                    │  services → models       │        (phase 5, optional)
                                    └──────────────────────────┘
```

Request flow: `route → validate(zod) → requireAuth → controller → service → model`.
Controllers stay thin; business rules (streaks, scoring, rotation) live in services so they are unit-testable.

### Auth design
- **Access token**: JWT, 15 min, held in JS memory only (never localStorage).
- **Refresh token**: 48 random bytes, stored **sha256-hashed** in `refreshtokens`, sent as an httpOnly `SameSite=Lax` cookie scoped to `/api/auth`.
- **Rotation**: every `/auth/refresh` revokes the presented token and issues a new one in the same *family*. Presenting a revoked token = theft signal → whole family revoked.
- Password change / reset revokes all sessions.
- First registered user becomes `admin`; `ALLOW_REGISTRATION=false` closes signup afterwards.

### Time & days
All daily logs are keyed by `date: "YYYY-MM-DD"` computed in the **user's timezone** (`userprofiles.personal.timezone`, default Asia/Kolkata). This avoids 11:30 PM IST logs landing on the wrong UTC day and makes per-day aggregation a cheap indexed equality match.

### Response envelope
```json
{ "success": true, "data": { }, "meta": { } }
{ "success": false, "error": { "message": "Validation failed", "details": { } } }
```

## 2. Database schema

Rules: every collection has `user` (ObjectId, indexed) except `users`; `timestamps: true`; soft delete via `deletedAt` where history matters; no giant per-user document.

### Built (Phase 1)
| Collection | Key fields | Indexes |
|---|---|---|
| users | name, email (unique), passwordHash (select:false), role, avatarUrl, resetTokenHash, resetTokenExpires, lastLoginAt, isActive | email unique |
| refreshtokens | user, tokenHash, family, expiresAt, revokedAt, replacedBy, userAgent, ip | tokenHash unique, family, TTL on expiresAt |
| userprofiles | user (unique), personal{heightCm, currentWeightKg, fitnessGoal, dietType, timezone, monthlyBudget…}, targets{proteinMinG, proteinMaxG, waterMl, sleepHours, studyMinutesPerDay, workoutMinutesPerDay}, schedule{wakeUp, sleep, blocks[]}, careerGoals[] | user unique |
| userpreferences | user (unique), theme, dashboardWidgets[{key, visible, size}], waterQuickAdd[], weekStartsOn | user unique |
| habits | user, name, category, icon, frequency (daily/weekly), daysOfWeek[], order, archived, deletedAt | {user, archived, deletedAt, order} |
| habitlogs | user, habit, date, completed, note | {habit, date} unique, {user, date} |
| waterlogs | user, date, amountMl, loggedAt | {user, date} |

### Built (Phases 2–4)
Routines embed their activities (small, edited together); `routinedays` holds one status map + note per day. Workout plans and meal plans are one document per weekday. Learning paths embed topics and resources. Seeding is tracked per module in `userpreferences.seededModules` and claimed atomically so parallel requests never duplicate it.

### Original plan (now implemented, names as built)
| Collection | Key fields |
|---|---|
| routines | user, name, appliesTo (weekdays/saturday/sunday/custom days[]), isActive |
| routineactivities | user, routine, title, start, end, priority, recurrence, order, category |
| routinelogs | user, activity, date, status (done/missed/skipped), note |
| exercises | user (null = library), name, muscleGroups[], type (reps/time), instructions, mediaUrl, difficulty |
| workouts | user, name, dayOfWeek[], items[{exercise, sets, reps, durationSec, restSec}] |
| workoutlogs | user, workout, date, durationMin, sets[{exercise, reps, weightKg, durationSec}], completed |
| bodymeasurements | user, date, weightKg, waistCm, chestCm, armCm, photoUrl |
| foods | user (null = shared DB), name, per100g{kcal, protein, carbs, fat, fiber}, servingG, source, **verified** (bool), notes |
| meals / mealentries | user, date, mealType, food, quantityG, computed macros snapshot |
| sleeprecords | user, date, bedtime, wakeTime, durationMin, qualitySelfRated (1–5), notes |
| learningpaths / learningtopics | user, title, order, parent, status, resources[], startDate, targetDate |
| studysessions | user, topic, date, minutes, mode (pomodoro/free), notes |
| projects | user, name, techStack[], status, repoUrl, milestones[] |
| expenses | user, date, amount (paise int), category, note, recurring |
| budgets | user, month (YYYY-MM), categories[{name, limit}] |
| goals / milestones | user, title, horizon (30/60/90), deadline, priority, status, progress |
| journals | user, date, mood (1–5), achievements, challenges, body, tags[] |
| reminders / notifications | user, type, time, days[], channel, readAt |

Money is stored in rupees rounded to 2 decimals at the API boundary; displayed with `en-IN` formatting (₹1,25,000).

## 3. Folder structure
```
comeback-os/
  backend/src/
    config/       env (zod-validated), db, defaults (seed values only)
    models/       Mongoose schemas
    validators/   zod request schemas
    middleware/   auth, validate, error, rateLimit
    services/     business logic (auth, token, habit, water, dashboard, userSetup)
    controllers/  thin HTTP handlers
    routes/       per-module routers + index
    docs/         OpenAPI spec
    utils/        ApiError, response, date, logger, asyncHandler
  backend/tests/  vitest + supertest against real MongoDB
  frontend/src/
    components/ui       Button, Input/Select/Field, Dialog/Confirm, Switch, Skeleton…
    components/layout   AppLayout (sidebar, header, mobile nav), nav config
    features/<module>/  pages + module components
    context/            Auth, Theme
    hooks/queries.ts    TanStack Query hooks + optimistic mutations
    services/           API clients
    lib/                api (axios + refresh), utils, date
    types/
  docs/  docker-compose.yml  README.md  DEVELOPMENT_STATUS.md
```

## 4. API design

Phase 1 endpoints are documented at `/api/docs`. Module resources follow one generic pattern (`backend/src/utils/crud.ts`): `GET /` (page, limit, q, from, to, filters), `GET/PATCH/DELETE /:id`, `POST /`. Full surface:

| Base | Phase | Purpose |
|---|---|---|
| /api/auth | 1 ✅ | register, login, refresh, logout, me, change/forgot/reset password, config |
| /api/settings | 1 ✅ | GET; PATCH profile / preferences; POST reset |
| /api/dashboard | 1 ✅ | today summary, score, weekly series |
| /api/habits | 1 ✅ | CRUD, `/:id/log`, `/reorder`, `/heatmap` |
| /api/water | 1 ✅ | day, add, delete, history |
| /api/routines | 2 ✅ | routines, `/day`, `/day/:date/status`, `/day/:date/note`, `/week` |
| /api/fitness | 2 ✅ | `/exercises`, `/plans`, `/today`, `/logs`, `/records`, `/history`, `/measurements`, `/photos` |
| /api/nutrition | 2 ✅ | `/foods`, `/entries`, `/day`, `/series`, `/plan`, `/plan/:dow/apply`, `/grocery` |
| /api/sleep, /api/learning | 3 ✅ | sleep CRUD + `/summary`; learning `/paths`, `/sessions`, `/projects`, `/summary` |
| /api/finance, /api/grooming | 3 ✅ | `/expenses`, `/budget`, `/summary`, `/recurring/apply`; grooming `/tasks`, `/today`, `/clothing`, `/outfits`, `/history` |
| /api/goals, /api/journal | 3 ✅ | CRUD; journal `/tags`, search via `?q=` |
| /api/analytics, /api/reminders, /api/notifications | 4 ✅ | `?days=`, `/export?module=` (CSV) |
| /api/ai | 5 | summaries & suggestions from recorded data |

Conventions: plural nouns, PATCH for partial updates, `?page&limit` pagination with `meta.total`, `date` query param as `YYYY-MM-DD`, 400 validation / 401 auth / 403 forbidden / 404 not-owned-or-missing / 409 conflict.
Ownership is enforced in every query (`{ _id, user: req.user.id }`), so another user's id returns 404, not 403 (no existence leak).

## 5. UI page structure
| Route | Status | Contents |
|---|---|---|
| /login, /register, /forgot-password, /reset-password | ✅ | auth |
| / | ✅ | greeting, score ring, today's habits, water, plan timeline, targets, 7-day chart — widgets configurable |
| /habits | ✅ | list, check-off, streaks, last-7 dots, reorder, archive, 13-week heatmap |
| /water | ✅ | glass, quick-add, custom, 14-day chart with target line, today's log |
| /settings | ✅ | account, personal & body, targets, schedule, career focus, dashboard widgets, appearance, reset |
| /routine, /fitness, /nutrition | P2 | |
| /learning, /finance, /grooming, /sleep, /goals, /journal | P3 | |
| /analytics, notifications | P4 | |
| AI assistant panel | P5 | |

## 6. Roadmap
See `DEVELOPMENT_STATUS.md` for the live checklist.
1. **Phase 1** — architecture, auth, settings, dashboard, habits, water ✅
2. **Phase 2** — routine planner (weekday/Sat/Sun, drag-drop), fitness (library, plan, logs, measurements, charts), nutrition (Indian food DB with verified/estimated flag, meals, macros, grocery list)
3. **Phase 3** — learning (90-day roadmap, pomodoro), finance, grooming, sleep, goals, journal
4. **Phase 4** — analytics & exports, notifications/reminders, deeper customisation
5. **Phase 5** — Comeback AI, security audit, deployment hardening
