# Deployment

Not yet deployed: no hosting or database credentials were available when this was built. These are the intended steps.

## Option A — Vercel + managed PostgreSQL

1. **Database.** Create a PostgreSQL 15+ database with any Prisma-compatible provider (Neon, Supabase, AWS RDS, Railway, Render…). Copy two connection strings if the provider offers a pooler:
   - pooled URL (PgBouncer / pooler) → `DATABASE_URL`, with `?pgbouncer=true&connection_limit=1` for serverless functions;
   - direct URL → `DIRECT_URL`, for migrations. When you use a pooler, add `directUrl = env("DIRECT_URL")` to the `datasource` block in `prisma/schema.prisma` and commit.
2. **Migrate and seed** from your machine against the production database (once, and after every schema change):
   ```powershell
   $env:DATABASE_URL="<direct production url>"; npm run db:deploy; npm run db:seed; Remove-Item Env:DATABASE_URL
   ```
   (bash: `DATABASE_URL="<url>" npm run db:deploy && DATABASE_URL="<url>" npm run db:seed`). Alternatively set the Vercel build command to `npm run db:deploy && npm run build` so every deploy applies pending migrations first.
3. **Vercel project.** Import the Git repository. Framework preset: Next.js. Build command: `npm run build`. Environment variables (Production and Preview):
   - `DATABASE_URL` (and `DIRECT_URL` if used)
   - `AUTH_SECRET` — a new random value, not your local one
   - `AUTH_TRUST_HOST=true`
   - optional: `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_AUTO_PUBLISH`, `AI_GENERATION_HOURLY_LIMIT`
4. **Deploy**, then check `https://<your-app>/api/health` returns `{"status":"ok","database":"up"}`.
5. **Smoke test in production:** register, sign in, flashcard review, resume, a quiz in each mode, results, interview, admin login and an import dry run.
6. **Change the seeded admin password** in Settings.

### Serverless caveats

- In-memory rate limits are per function instance (best-effort). For strict limits, back `SlidingWindowLimiter` with Redis (e.g. Upstash). The AI quota is database-backed and already exact.
- Keep the database in the same region as the functions.

## Option B — Docker

```bash
docker build -t backend-academy .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/backend_academy" \
  -e AUTH_SECRET="<random>" -e AUTH_TRUST_HOST=true \
  backend-academy
```

The image is multi-stage, runs as a non-root user, uses Next.js standalone output, applies pending migrations on start (`prisma migrate deploy`) and exposes a HEALTHCHECK on `/api/health`. With several replicas, run migrations as a separate release job instead of on container start. Seed once with `npm run db:seed` from a machine that can reach the database.

## Rollbacks

Migrations are forward-only. Make schema changes backward compatible (add → backfill → switch reads → remove later) so you can roll the app back to the previous release without touching the database.
