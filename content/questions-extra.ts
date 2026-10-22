import { D, fc, mc, ms, sa, sc, type SeedQuestion } from "./helpers";

const { B, I, A } = D;

/** Additional objective and scenario questions, weighted toward advanced material. */
export const questionsExtra: SeedQuestion[] = [
  // ── Objective ──
  sa("http", "http-008", B, "Which HTTP response header tells browsers and proxies whether and for how long a response may be cached?",
    ["Cache-Control"],
    "Cache-Control carries directives such as max-age=600, no-store, private and public. Expires is an older header with a fixed date; when both are present, Cache-Control's max-age wins.",
    { tags: ["caching", "headers"] }),

  mc("http", "http-009", B, "A client sends `If-None-Match` with the ETag it was given on an earlier request for the same resource, and the resource has not changed. What should the server return?",
    ["304 Not Modified, with no body", "200 OK, with the full body again", "412 Precondition Failed", "204 No Content"], 0,
    "304 Not Modified tells the client its cached copy is still valid, so it can keep using it — saving the bandwidth and time of sending the body again. 412 is for conditional *writes* (If-Match) that fail; it does not apply to a matching If-None-Match on a read.",
    { tags: ["caching", "headers"] }),

  fc("prisma", "prisma-008", I, "What does `db.order.deleteMany({ where: { id, userId } })` give you over `db.order.delete({ where: { id } })` guarded by an earlier ownership check?",
    "The ownership condition is part of the same atomic statement as the mutation, so there is nothing to forget on any code path, and no gap for ownership to change between a check and the write. It also means \"not found\" and \"not yours\" both collapse to the same `count: 0`, which becomes one 404 without ever needing to tell them apart.",
    "A separate check-then-delete can be skipped by a code path that forgets it, or raced by something that changes ownership in between the check and the delete. Folding the condition into the WHERE clause removes both risks. Prisma 5+ also lets delete/update accept extra filters alongside a unique field, so `delete({ where: { id, userId } })` is valid directly too — that form still throws P2025, not a count, when nothing matches.",
    { tags: ["ownership", "race-conditions"] }),

  mc("node-async", "node-007", A, "A handler runs `await Promise.all(rows.map((r) => saveRow(r)))` for 10,000 rows, where each saveRow performs a database query. What is the likely problem?",
    ["All 10,000 queries start at once, exhausting the connection pool or overwhelming the database; process them with a concurrency limit or in batches", "Promise.all runs them one at a time, so it is slow", "Promise.all silently ignores rejected promises", "Node.js limits Promise.all to 1,000 promises"], 0,
    "Promise.all does not limit concurrency: every call starts immediately. Queries then queue for a small pool of connections, time out, or overload the database. Use batched inserts (createMany) or a small concurrency limit.",
    { tags: ["promises", "database-imports"] }),

  mc("isolation-locking", "iso-008", A, "In READ COMMITTED, two transactions concurrently run `UPDATE items SET stock = stock - 1 WHERE id = 1 AND stock >= 1` when stock is 1. What happens?",
    ["The first updates the row; the second waits for its lock, then re-checks the WHERE clause against the newly committed row (stock = 0) and updates nothing", "Both succeed and stock becomes -1", "The second fails with a deadlock error", "Both see stock = 1 from their snapshot and the database raises a serialization failure in READ COMMITTED"], 0,
    "When an UPDATE in READ COMMITTED waits for a row locked by another transaction, PostgreSQL re-evaluates its WHERE condition on the updated version of the row once that transaction commits. That is why a single conditional UPDATE is a safe way to decrement stock.",
    { tags: ["postgres", "concurrency", "inventory"] }),

  ms("caching", "cache-008", I, "An API response contains a user's personal account details. Which Cache-Control directives stop shared caches such as CDNs from storing it?",
    ["Cache-Control: private", "Cache-Control: no-store", "Cache-Control: public, max-age=3600", "Cache-Control: s-maxage=600"], [0, 1],
    "private allows only the user's own browser to cache the response, and no-store forbids storing it anywhere. public and s-maxage explicitly invite shared caches to store it, which could serve one user's data to another.",
    { tags: ["http", "security"] }),

  mc("security", "sec-008", A, "A service verifies JWTs using whatever algorithm the token's header specifies. What does this allow?",
    ["Algorithm-confusion attacks, such as forged tokens with alg \"none\" or HS256 signed with the public RSA key; the server must enforce the expected algorithm and key", "Nothing, because the signature is still checked", "Replay of expired tokens only", "SQL injection through the token"], 0,
    "If the attacker controls the algorithm, they can pick one the server will verify with material they know. Libraries should be configured with an explicit allowlist of algorithms and the matching key type.",
    { tags: ["jwt", "auth"] }),

  mc("system-design", "sd-009", A, "Why do distributed caches often place keys with consistent hashing instead of `hash(key) % numberOfNodes`?",
    ["Adding or removing a node remaps only about 1/N of the keys instead of nearly all of them", "Consistent hashing guarantees every node holds exactly the same number of keys", "It removes the need for replication", "It makes lookups O(1) where modulo hashing is O(n)"], 0,
    "With modulo placement, changing the node count changes almost every key's target, causing a cache-wide miss storm. Consistent hashing maps nodes and keys onto a ring; virtual nodes improve balance, but it does not guarantee perfect evenness.",
    { tags: ["distributed-systems", "caching"] }),

  // ── Scenarios ──
  sc("caching", "cache-009", A, "Your Redis cache cluster restarted and came back empty. Within seconds the PostgreSQL primary hit 100% CPU and the site went down. What happened, and how do you prevent it next time?",
    "A cold cache sent all reads to the database (a thundering herd). Use request coalescing, staggered warm-up, jittered TTLs, load shedding/circuit breaking and capacity planning for cache loss.",
    "With an empty cache every request missed at once and went to PostgreSQL, which was only sized for the cache-hit traffic — a thundering herd. To recover I would shed load (rate limit or temporarily serve a degraded page) while the cache refills. To prevent it: coalesce concurrent misses so only one request per key rebuilds it (single-flight or a short Redis lock), warm the most important keys before sending full traffic, add jitter to TTLs so keys do not expire together, and put a circuit breaker or concurrency limit in front of the database so it degrades instead of collapsing. Longer term, run Redis with replication and persistence so a restart does not lose everything, and capacity-test the database for a cold-cache scenario.",
    [
      ["herd", "Explain the thundering herd", ["thundering herd", "stampede", "all requests", "cold cache"]],
      ["coalesce", "Request coalescing", ["coalesc", "single-flight", "single flight", "lock"]],
      ["warm", "Cache warm-up", ["warm"]],
      ["jitter", "Jittered TTLs", ["jitter"]],
      ["protect", "Protect the database", ["load shedding", "circuit breaker", "rate limit", "concurrency limit"]],
      ["ha", "Make the cache resilient", ["replication", "persistence", "replica"]],
    ],
    "A cache that the database cannot survive losing is a single point of failure; design for the cold-cache case explicitly.",
    { tags: ["reliability", "redis"] }),

  sc("postgres", "pg-008", A, "You must add a required (NOT NULL) column and an index to a 500-million-row PostgreSQL table in production without downtime. How do you do it?",
    "Add the column in a way that avoids a rewrite, backfill in batches, enforce NOT NULL via a NOT VALID CHECK that is validated separately, and build the index with CREATE INDEX CONCURRENTLY, all with lock timeouts.",
    "Most ALTER TABLE forms take an ACCESS EXCLUSIVE lock, so each step must be short. Since PostgreSQL 11, adding a column with a constant default does not rewrite the table; otherwise I add it as nullable. I backfill existing rows in small batches (for example by id range) so no long transaction holds locks or bloats WAL. To make it required, I add CHECK (col IS NOT NULL) NOT VALID, then run VALIDATE CONSTRAINT, which scans without blocking writes; on PostgreSQL 12+, SET NOT NULL can then use that constraint and skip its own full-table scan. The index is built with CREATE INDEX CONCURRENTLY, which cannot run inside a transaction block and must be checked for an INVALID result if it fails. Every DDL statement runs with a lock_timeout so it gives up rather than queueing behind long queries and blocking everyone, and the app code is deployed to handle the column before it becomes required.",
    [
      ["locks", "Understand DDL locks", ["access exclusive", "lock"]],
      ["no-rewrite", "Avoid a table rewrite", ["rewrite", "nullable", "constant default"]],
      ["backfill", "Batched backfill", ["backfill", "batch"]],
      ["not-valid", "NOT VALID + VALIDATE for the constraint", ["not valid", "validate constraint", "check"]],
      ["concurrently", "CREATE INDEX CONCURRENTLY", ["concurrently"]],
      ["timeout", "Lock timeouts", ["lock_timeout", "lock timeout"]],
    ],
    "Interviewers look for awareness that DDL takes locks, and for the specific PostgreSQL techniques that keep each locking step short.",
    { tags: ["migrations", "zero-downtime"] }),

  sc("webhooks", "hook-008", I, "A shipping carrier offers no webhooks — only an API to fetch shipment status. Design how your system keeps thousands of order shipments up to date.",
    "Poll only active shipments on a schedule adapted to their state, use incremental or conditional requests, respect the carrier's rate limits with jitter and backoff, apply idempotent updates, and stop polling finished shipments.",
    "A scheduled job selects shipments that are not yet delivered and are due for a check, using a next_poll_at column so the work is spread over time. Polling frequency adapts to state: shipments in transit might be checked every 30 minutes, delayed ones more often near the expected delivery date, and delivered or cancelled shipments are no longer polled. If the carrier supports bulk lookups, an updated-since filter or ETags, I use them to reduce calls. Workers respect the carrier's rate limits with a token bucket, add jitter, and back off on 429 or 5xx. Updates are idempotent — only apply a status change that moves the shipment forward — and changes are published as internal events so the rest of the system behaves as if a webhook had arrived.",
    [
      ["active", "Poll only active items", ["active", "not yet delivered", "next_poll_at", "stop polling"]],
      ["adaptive", "Adaptive polling interval", ["adaptive", "frequency", "interval", "every"]],
      ["efficient", "Efficient requests", ["bulk", "etag", "updated since", "updated-since", "conditional"]],
      ["limits", "Respect rate limits with backoff", ["rate limit", "backoff", "429", "jitter"]],
      ["idempotent", "Idempotent state updates", ["idempotent", "forward"]],
      ["events", "Emit internal events", ["event"]],
    ],
    "Polling done well is targeted, adaptive and polite to the provider — and the rest of the system should not care whether data came from polling or webhooks.",
    { tags: ["integration", "background-jobs"] }),

  sc("observability", "obs-008", A, "Design the alerting strategy for a checkout service so the on-call engineer is paged for real customer impact but not woken up by noise.",
    "Define SLIs/SLOs for checkout success and latency, alert on error-budget burn rate (fast and slow windows), page only on symptoms, route cause-level signals to tickets/dashboards, and attach runbooks.",
    "I would start from what customers feel: checkout success rate and latency, measured as SLIs, with SLOs such as 99.9% of checkouts succeeding over 30 days. Instead of paging on single spikes, alerts fire on error-budget burn rate — a fast window (for example 5 minutes at 14x burn) pages immediately for severe outages, and a slower window (hours at a lower burn rate) catches gradual degradation. Cause-level signals such as high CPU, a full disk or one slow dependency go to dashboards or low-urgency tickets unless they directly threaten the SLO. Every page links to a runbook and relevant dashboards, alerts are deduplicated and grouped, and each noisy alert is tuned or deleted after review so pages stay rare and trusted. Synthetic checkout probes catch total outages even when there is no traffic.",
    [
      ["sli", "Customer-facing SLIs/SLOs", ["sli", "slo", "success rate"]],
      ["burn", "Burn-rate alerting", ["burn rate", "error budget"]],
      ["symptoms", "Page on symptoms, not causes", ["symptom", "customer impact", "not causes", "cause"]],
      ["runbook", "Runbooks and context", ["runbook", "dashboard"]],
      ["noise", "Reduce noise", ["noise", "noisy", "fatigue", "dedup", "tune"]],
      ["synthetic", "Synthetic monitoring", ["synthetic", "probe"]],
    ],
    "Good alerting is user-centric and budget-based; the goal is that every page is actionable.",
    { tags: ["monitoring", "sre"] }),

  sc("rest", "rest-008", A, "Mobile clients you cannot force to upgrade use your public API. You need to change the `price` field from a number to an object `{ amount, currency }`. How do you roll this out without breaking them?",
    "Avoid breaking the existing contract: add a new field (or a new API version), keep the old one working, communicate deprecation with headers and docs, monitor usage per client version, and remove only after usage drops.",
    "Changing a field's type is a breaking change, so I would not modify price in place. The least disruptive option is additive: keep price as a number and add priceDetails with amount and currency, which old clients ignore. If the redesign is broader, I would introduce a new version (for example /v2 or a version header) and run both versions from the same domain logic. Deprecation is communicated through documentation, changelogs and Deprecation/Sunset response headers, and I would track usage of the old field or version by client app version. Only after the old usage falls to an agreed threshold, and after the announced date, is the old field removed. Contract tests ensure older clients' expectations keep passing in CI.",
    [
      ["breaking", "Recognise the breaking change", ["breaking change", "breaking"]],
      ["additive", "Additive change or new version", ["additive", "new field", "v2", "version"]],
      ["deprecate", "Deprecation communication", ["deprecat", "sunset", "changelog"]],
      ["monitor", "Monitor old usage", ["monitor", "usage", "track"]],
      ["contract", "Contract tests", ["contract test", "compatibility test"]],
    ],
    "Public APIs are promises: evolve them additively, version when you must, and remove old behaviour only with data showing it is safe.",
    { tags: ["api-design", "versioning"] }),

  sc("auth", "auth-009", A, "You are building a multi-tenant B2B SaaS where each company's data must never be visible to another company. How do you enforce tenant isolation in the backend?",
    "Every tenant-owned row carries tenant_id; tenant comes from the authenticated session, never from client input; every query is scoped centrally; add PostgreSQL row-level security as defence in depth; enforce roles within the tenant; test isolation.",
    "Each tenant-owned table has a tenant_id column (part of unique constraints and indexes), and the tenant is derived from the authenticated user's membership on the server, never taken from a request parameter. Data access goes through a repository or Prisma extension that adds WHERE tenant_id = currentTenant to every query, so individual endpoints cannot forget it. As defence in depth, PostgreSQL row-level security policies filter rows by a tenant setting on the connection, so even a missed filter or raw query cannot cross tenants. Within a tenant, role-based access control decides what each member may do. Background jobs carry the tenant id explicitly, caches include it in keys, and automated tests create two tenants and assert that every endpoint returns 404 for the other tenant's resources.",
    [
      ["tenant-id", "tenant_id on every tenant-owned row", ["tenant_id", "tenant id"]],
      ["server-derived", "Tenant derived from the session", ["session", "authenticated", "never from", "membership"]],
      ["central", "Centralised query scoping", ["repository", "middleware", "extension", "every query", "central"]],
      ["rls", "Row-level security", ["row-level security", "row level security", "rls", "policy"]],
      ["rbac", "Roles within a tenant", ["role", "rbac", "permission"]],
      ["tests", "Isolation tests", ["test"]],
    ],
    "Multi-tenancy bugs are data breaches; the best answers make isolation the default path and add a database-level backstop.",
    { tags: ["authorization", "multi-tenancy", "security"] }),
];

