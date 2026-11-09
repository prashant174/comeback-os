# Development Status

_Last updated: 2026-11-09_

Test results: backend **60/60** (real MongoDB), frontend **8/8**, both production builds clean, every page checked end-to-end in a browser (light, dark, mobile) with realistic data.

## Phase 1 — Foundation ✅
Auth (rotation + reuse detection), settings, dashboard, habits, water, theme, responsive layout, Swagger, Docker/PM2/Nginx configs.

## Phase 2 — Daily life tracking ✅
| Feature | Status |
|---|---|
| Daily routine: Mon–Fri / Sat / Sun routines, priorities, done / skipped / auto-missed, daily note | ✅ |
| Routine editor with drag-and-drop (drop one activity on another to swap time slots), week calendar view | ✅ |
| Fitness: seeded home plan + 15-exercise library with instructions & video links, editable weekly plan | ✅ |
| Workout logger with rest timer, workout history, personal records, strength progression chart | ✅ |
| Body measurements (latest weight syncs to profile), weight chart, 8-week consistency chart | ✅ |
| Progress photos + profile photo (private, owner-only, 5 MB image limit) | ✅ |
| Nutrition: 22 Indian foods (marked *estimate*), custom foods, verified flag, per-100 g macros | ✅ |
| Meal logging by grams or units (egg, roti…), daily macro totals vs protein target | ✅ |
| Weekly veg + egg meal plan, "log today's plan", grocery list, 7/30-day trends | ✅ |

## Phase 3 — Learning, finance, wellbeing ✅
| Feature | Status |
|---|---|
| Learning: 90-day roadmap (3 paths), topics, resources, proficiency, Pomodoro / stopwatch, manual log, projects | ✅ |
| Finance: expenses, ₹2,500 budget template, category progress, alerts → notifications, recurring copy, savings history | ✅ |
| Grooming: daily / weekly / every-N-days tasks, weekly view, wardrobe, wishlist, outfit planner, history, clothing budget | ✅ |
| Sleep: manual log (crosses midnight), self-rated quality, averages, bedtime consistency | ✅ |
| Goals: 30/60/90 days, milestones drive progress, priorities, deadlines | ✅ |
| Journal: mood, wins, challenges, reflection, ideas, tags, search, mood calendar | ✅ |

## Phase 4 — Analytics, reminders ✅
| Feature | Status |
|---|---|
| Analytics: week / month / 90-day report, 8 KPIs, 6 charts, spending by category, goals | ✅ |
| CSV export for 9 data types (formula-injection safe) | ✅ |
| PDF via browser print ("Save as PDF") with print stylesheet | ✅ |
| Reminders (server job, timezone-aware, once per day) → in-app notification bell | ✅ |
| Optional browser notifications (only while the app is open) | ✅ |
| Dashboard: 12 configurable widgets; score from habits, water, protein, workout, study, sleep | ✅ |
| Mobile: bottom nav + "More" sheet with all modules | ✅ |

### Known limitations
- No email provider: password-reset link goes to the server log (and the UI in dev).
- Notifications need the app open/recently used; true background push (VAPID) not built.
- PDF export uses the browser's print dialog, not a server-generated PDF.
- Food values are approximate until you verify them.
- Docker setup written and updated, but not run in the build environment.

## Mobile + free hosting ✅
| Feature | Status |
|---|---|
| Installable PWA: manifest, app icons (incl. maskable + iOS), standalone mode, shortcuts | ✅ |
| Service worker: offline app shell, cached hashed assets, API never cached | ✅ |
| Install button (Android/Chrome) + iOS instructions in Settings | ✅ |
| Single-origin deploy: API serves the built app (first-party cookies work on iPhone Safari) | ✅ |
| Strict Content-Security-Policy (no inline scripts), verified 0 violations in browser | ✅ |
| Photos in MongoDB GridFS (survive free hosts' ephemeral disk), client-side compression | ✅ |
| "Waking up the server" banner + longer timeouts for free-tier cold starts | ✅ |
| Reminder catch-up window 30 min | ✅ |
| render.yaml blueprint + docs/FREE_HOSTING.md (Atlas M0, Render free, keep-alive, phone install) | ✅ written, ⚠️ not deployed from the build environment |

## Admin panel + leave days ✅
| Feature | Status |
|---|---|
| Separate admin account from ADMIN_EMAIL / ADMIN_PASSWORD (created/rotated at startup, 12+ char rule) | ✅ |
| Admin can't use trackers; users can't reach /admin (API + UI); admin role re-checked in DB per request | ✅ |
| Overview: users, 7-day active/new, daily active users chart, DB usage vs 512 MB, server stats | ✅ |
| Users: search/filter, last seen, activity, entries, photo storage — metadata only, no personal content | ✅ |
| Add friend (temp password), reset password, log out everywhere, disable (revokes sessions), delete with all data + photos | ✅ |
| Runtime sign-up toggle, announcement banner, broadcast notification, CSV export, audit log | ✅ |
| Leave / holiday / sick / WFH / travel days, single day or range (≤60), chosen routine or free day | ✅ |
| "Leave day" on-demand routine (seeded, also for existing users), reminders with "stay quiet on leave" | ✅ |
| Leave banner + undo on Routine page, upcoming leaves list, "On leave today?" on dashboard | ✅ |

## Phase 5 — AI & hardening ⏳ next
- [ ] Comeback AI (OpenAI / Gemini / Claude configurable, server-side keys, uses recorded data, graceful fallback, no medical advice)
- [ ] Weekly AI summary
- [ ] Security audit, load test, deployment verification
