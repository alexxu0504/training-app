# Endurance — Personal Training Dashboard

A personal endurance-athlete command center for triathlon and marathon training.
Combines Strava and Garmin data into one dashboard built around your goal race
(default: **Philadelphia Marathon, November 22, 2026**).

## Stack

- **Next.js 16** (App Router, Turbopack) + **TypeScript** + **Tailwind CSS 4**
- **Prisma 6** ORM — SQLite for local dev, Postgres-compatible schema for Supabase
- Server actions for mutations; route handlers for OAuth and imports
- No chart/map dependencies — SVG-based mileage chart and route map

## Quick start

```bash
npm install
npx prisma migrate dev   # creates dev.db
npm run seed             # demo data: 20 weeks of training + goal race
npm run dev              # http://localhost:3000
```

## Strava setup

1. Create an API application at https://www.strava.com/settings/api
   - Authorization Callback Domain: `localhost`
   - Note your **Client ID** and **Client Secret**
2. Add to `.env`:

   ```
   STRAVA_CLIENT_ID=...
   STRAVA_CLIENT_SECRET=...
   ```

3. Open `/import` → **Connect Strava** → authorize → **Sync Strava now**.

The first sync imports full history (paginated, 100/page) and hydrates splits for
recent activities (capped at 40 detail fetches per sync to respect Strava's
100 req/15 min and 1000 req/day limits; remaining activities hydrate on later syncs).

## Garmin

Direct Garmin Connect API access requires Garmin developer-program approval
(Garmin Health API / Activity API — business use case, OAuth + push delivery).
That application takes time and isn't something you can self-serve today.

What ships now:

- `source = "garmin"` is a first-class value throughout the schema — an official
  API integration drops in without schema changes.
- **File import** at `/import`: upload `.fit`, `.tcx`, or `.gpx` exports from
  Garmin Connect (activity → gear icon → Export). Parsed into the same normalized
  activity model, including splits, HR, and GPS routes.
- No screen scraping / unofficial Connect libraries — they break on MFA and
  violate Garmin's ToS.

## Deduplication

The same Garmin workout synced to Strava must not double-count. On every sync or
import, `linkDuplicatesForUser` matches activities on:

- start time within ±3 minutes
- same sport family
- distance within 3%
- duration within 3%

The loser record is kept but linked via `duplicateOfId` and excluded from all
metrics. The winner is chosen by a richness score — GPS, heart rate, splits,
elevation, plus source priority (Garmin > file import > Strava).

## Database schema

| Model | Purpose |
| --- | --- |
| `User` | Single-user for now; isolated by `userId` everywhere |
| `ConnectedAccount` | OAuth tokens per provider (`strava`, `garmin`) |
| `Activity` | Normalized workout: sport, times, distance, HR, elevation, polyline, source, `duplicateOfId` |
| `ActivitySplit` | Per-mile/km/lap splits with pace + HR |
| `Race` | Goal races: name, date, distance, goal seconds, primary flag |
| `PersonalRecord` | Computed PRs (run distances, longest efforts, swim paces, weekly records, streaks) |
| `WeeklyMetric` | Materialized per-week rollup per sport + `all`, rebuilt on each sync |

**Switching to Supabase/Postgres:** set `provider = "postgresql"` in
`prisma/schema.prisma`, point `DATABASE_URL` at the Supabase connection string,
and run `npx prisma migrate dev`. The schema avoids SQLite/Postgres incompatibilities
(no enums, no `Json` columns — JSON payloads are stored as strings).

## Metrics & insights

`src/lib/metrics.ts` computes, from real activity data only:

- Weekly mileage/time per sport, % change vs prior week
- 4-week average mileage, change vs prior 4 weeks
- Long-run tracking (≥10 mi or ≥90 min): streak, days since, progression
- Consistency = share of the last 28 days with ≥1 workout
- Runs over 10 / 13 miles, highest-mileage week, avg pace & HR
- Insight sentences are only emitted when the underlying data supports them.

## Roadmap (per milestone plan)

- [x] M1 — app shell, DB, Strava OAuth, import, swim/bike/run dashboard
- [x] M2 — Philadelphia Marathon countdown, run-volume analytics, long-run tracking, consistency
- [x] M3 — Garmin pathway: file import now, official API slot reserved; dedup engine
- [x] M4 — PR calculations, trends, race readiness, activity detail pages
- [ ] M5 — AI training summaries (grounded in actual data only)
- [ ] Garmin Health API integration once developer approval is granted
- [ ] Strava webhooks for push sync
- [ ] Multi-user auth (currently single-user local app)
