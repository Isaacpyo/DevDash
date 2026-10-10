# DevDash — build plan

## What we're building

A GitHub developer analytics dashboard. Type any GitHub username (or sign in with
GitHub) and get a shareable profile page at `/u/<login>` with:

- contribution heatmap for the last year, streaks, busiest weekday
- language breakdown across the user's own public repos
- monthly commits / PRs / reviews / issues for the last 12 months
- top repositories
- pull request merge-time stats (median, p90, distribution, merge rate)
- recent public activity

## Architecture

```
Browser ──> Next.js App Router (apps/web, Netlify)
              ├─ Server components render /u/[login]
              ├─ Route handlers: /api/profile/[login], /api/health, /api/auth/github/*
              ├─ Server actions: demo login, logout, refresh
              └─ lib/
                  ├─ github/      provider interface: real (REST + GraphQL) | mock
                  ├─ analytics/   pure functions: raw GitHub data -> ProfileReport
                  ├─ cache/       stale-while-revalidate cache over Redis | memory
                  │               + rate-limit circuit breaker
                  └─ auth/        GitHub OAuth (or mock), encrypted session cookie
```

- **No separate backend.** The PROJECT stack is Next.js App Router, which is a
  full-stack framework. Server components and route handlers hold the GitHub token
  and run as Netlify Functions. A separate API on Render would add a 30–50 s cold
  start for no gain, so there is no `apps/api` and no `render.yaml`.
- **Data flow.** `report-service` → cache (`report:v1:<login>`) → provider →
  `buildReport()` (pure, unit-tested). The cache stores the computed report, not
  raw API payloads.
- **Caching.** Entries are fresh for 10 min, then served stale for up to 24 h while
  a background revalidation runs (`after()`). Concurrent misses for the same key
  share one upstream request.
- **Rate limits.** GitHub REST and GraphQL rate-limit responses map to one
  `RateLimitError` that carries the reset time. A circuit breaker stores
  "limited until" per token so we stop calling GitHub until the reset. If a stale
  copy exists we serve it with a banner. Otherwise the page explains the limit,
  counts down to the reset, and points to sign-in (which uses the viewer's own
  quota) or the demo.
- **Providers.** `DATA_PROVIDER=github|mock`. Defaults to `github` when
  `GITHUB_TOKEN` is set, otherwise `mock`. The mock generates deterministic data
  per username, so the app, CI and e2e tests work without keys. The demo account
  (`devdash_demo`) always uses a seeded fixture. The underscore makes it an invalid
  GitHub login, so it can't collide with a real user.
- **Auth.** Hand-rolled GitHub OAuth (state cookie, timing-safe compare, no scopes
  requested, so every fetched field is public and safe to cache globally). The
  session is an encrypted JWT (JWE, A256GCM, key from `SESSION_SECRET` via HKDF) in
  an httpOnly cookie. `OAUTH_PROVIDER=mock` runs the same flow against a local fake
  for dev/e2e. "Try the demo" is a server action that signs into the demo account.
- **Persistence.** Redis (Upstash in prod, a container locally) holds the report
  cache and breaker state. Without `REDIS_URL`, an in-memory LRU is used.

## Repo layout

```
apps/web/             Next.js app (the only deployable)
  src/app/            routes
  src/components/     UI + charts (Recharts, custom SVG heatmap)
  src/lib/            github, analytics, cache, auth, env
  e2e/                Playwright smoke test
docker-compose.yml    web + redis
netlify.toml          base = apps/web
.github/workflows/    CI: lint, typecheck, unit, build, e2e, docker build
```

## Milestones (one or more commits each)

1. Scaffold Next.js + Tailwind + tooling (ESLint, Prettier, Vitest, Playwright)
2. Domain types + analytics functions + unit tests
3. GitHub HTTP client, error mapping, real provider, mock provider + demo fixture
4. Cache layer (memory/Redis), SWR, circuit breaker + tests
5. Report service + JSON API + health route
6. UI: home, profile page, charts, loading/empty/error/rate-limit states
7. Auth: OAuth (real + mock), demo login, session
8. OG image, share link
9. Docker, docker-compose, netlify.toml, CI
10. README, e2e, final verification
