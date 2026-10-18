# Deployment

Not yet deployed: no hosting or database credentials were available when this was built. These are the intended steps.

## Option A — Vercel + Supabase

This project's `prisma/schema.prisma` already declares `directUrl = env("DIRECT_URL")`, and `vercel.json` pins functions to `pdx1` (Portland, Oregon) so they run in the same region as a Supabase database hosted in `us-west-2` — set both env vars below, and host the database in `us-west-2` (or repick the region to match wherever yours actually lives).

1. **Database connection strings.** Supabase gives you two poolers for the same database; use both, for different jobs:
   - transaction pooler (port 6543) → `DATABASE_URL`, with `?pgbouncer=true&connection_limit=1` — short-lived connections for serverless function invocations;
   - session pooler (port 5432) → `DIRECT_URL` — migrations and seeding need a session-level connection, which a transaction pooler can't give them.
2. **Migrate and seed** from your machine against the production database (once, and after every schema change). Prisma CLI commands read `DIRECT_URL`, not `DATABASE_URL` (see the warning below) — set both to the session pooler URL:
   ```powershell
   $env:DATABASE_URL="<session pooler url>"; $env:DIRECT_URL="<session pooler url>"; npm run db:deploy; npm run db:seed; Remove-Item Env:DATABASE_URL; Remove-Item Env:DIRECT_URL
   ```
   (bash: `DATABASE_URL="<session pooler url>" DIRECT_URL="<session pooler url>" npm run db:deploy && DATABASE_URL="<session pooler url>" DIRECT_URL="<session pooler url>" npm run db:seed`). Alternatively set the Vercel build command to `npm run db:deploy && npm run build` so every deploy applies pending migrations first — in that case give the build step both `DATABASE_URL` and `DIRECT_URL` set to the session pooler.

   > **`DIRECT_URL` trap.** `migrate deploy`, `migrate dev`, `migrate reset` and `db push` all use `directUrl` from the datasource block, which maps to `DIRECT_URL` — not `DATABASE_URL`. Overriding `DATABASE_URL` alone to point Prisma at a different database (local, test, or a different environment) still leaves the CLI reading whatever `DIRECT_URL` is set to elsewhere (e.g. `.env`'s Supabase value) and running there instead. Always override **both** together.
3. **Vercel project.** Import the Git repository. Framework preset: Next.js. Build command: `npm run build`. Environment variables (Production and Preview):
   - `DATABASE_URL` — Supabase transaction pooler, port 6543, `?pgbouncer=true&connection_limit=1`
   - `DIRECT_URL` — Supabase session pooler, port 5432
   - `AUTH_SECRET` — a new random value, not your local one
   - `AUTH_TRUST_HOST=true`
   - optional: `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_AUTO_PUBLISH`, `AI_GENERATION_HOURLY_LIMIT`
4. **Deploy**, then check `https://<your-app>/api/health` returns `{"status":"ok","database":"up"}`.
5. **Smoke test in production:** register, sign in, flashcard review, resume, a quiz in each mode, results, interview, admin login and an import dry run.
6. **Change the seeded admin password** in Settings.

### Serverless caveats

- In-memory rate limits are per function instance (best-effort). For strict limits, back `SlidingWindowLimiter` with Redis (e.g. Upstash). The AI quota is database-backed and already exact.
- `vercel.json`'s `regions` pins functions to one region — keep it matched to wherever the database actually lives, since every request round-trips to it.

## Option B — Docker

```bash
docker build -t full-stack-academy .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/full_stack_academy" \
  -e AUTH_SECRET="<random>" -e AUTH_TRUST_HOST=true \
  full-stack-academy
```

The image is multi-stage, runs as a non-root user, uses Next.js standalone output, applies pending migrations on start (`prisma migrate deploy`) and exposes a HEALTHCHECK on `/api/health`. With several replicas, run migrations as a separate release job instead of on container start. Seed once with `npm run db:seed` from a machine that can reach the database.

## Rollbacks

Migrations are forward-only. Make schema changes backward compatible (add → backfill → switch reads → remove later) so you can roll the app back to the previous release without touching the database.
