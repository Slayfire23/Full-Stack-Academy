/**
 * Curriculum: tracks → topics → lessons. Questions reference topics by slug.
 * Lesson content is Markdown (rendered as plain paragraphs, lists and code blocks).
 */

export type SeedCodeLanguage = "TYPESCRIPT" | "SQL" | "HTTP" | "BASH";
export type SeedDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface SeedLesson {
  slug: string;
  title: string;
  /** Legacy plain content. Kept non-empty even once the structured fields below are filled in. */
  content: string;
  summary?: string;
  explanation?: string;
  realWorldExample?: string;
  codeExample?: string;
  codeLanguage?: SeedCodeLanguage;
  commonMistakes?: string;
  level?: SeedDifficulty;
  estimatedMinutes?: number;
}

export interface SeedTopic {
  slug: string;
  title: string;
  description: string;
  lesson: SeedLesson;
}

export interface SeedTrack {
  slug: string;
  title: string;
  description: string;
  published: boolean;
  order: number;
}

export const tracks: SeedTrack[] = [
  { slug: "backend", title: "Backend Development", description: "HTTP, APIs, databases, reliability and the system-design fundamentals backend interviews test.", published: true, order: 1 },
  { slug: "frontend", title: "Frontend Development", description: "Coming soon: browsers, rendering, state management and accessibility.", published: false, order: 2 },
  { slug: "full-stack", title: "Full-Stack Development", description: "Coming soon: end-to-end feature delivery across client and server.", published: false, order: 3 },
  { slug: "devops-cloud", title: "DevOps and Cloud", description: "Coming soon: infrastructure as code, containers, observability and cloud platforms.", published: false, order: 4 },
  { slug: "system-design", title: "System Design", description: "Coming soon: large-scale architecture case studies.", published: false, order: 5 },
];

const t = (slug: string, title: string, description: string, content: string): SeedTopic => ({
  slug,
  title,
  description,
  lesson: { slug: "essentials", title: `${title}: essentials`, content: content.trim() },
});

const httpTopic: SeedTopic = {
  slug: "http",
  title: "HTTP fundamentals and status codes",
  description: "Methods, statelessness, headers and what each status code family tells the client.",
  lesson: {
    slug: "essentials",
    title: "HTTP fundamentals and status codes: essentials",
    level: "BEGINNER",
    estimatedMinutes: 15,
    summary:
      "Every request carries a method and headers; every response carries a status code that tells the caller exactly what happened and what to do next.",
    content: `
HTTP is a stateless request/response protocol. Every request carries a **method**, a **path**, **headers** and an optional **body**; every response carries a **status code**, headers and an optional body.

**Methods.** GET reads, POST creates or triggers processing, PUT replaces, PATCH partially updates, DELETE removes. *Safe* methods (GET, HEAD, OPTIONS) do not change state; *idempotent* methods (the safe ones plus PUT and DELETE) can be repeated with the same effect, which is why clients may retry them.

**Status code families.**
- 2xx success — 200 OK, 201 Created (with Location), 202 Accepted (queued), 204 No Content
- 3xx redirection — 301/308 permanent, 302/307 temporary, 304 Not Modified
- 4xx client error — 400 malformed, 401 not authenticated, 403 not allowed, 404 not found, 409 conflict, 422 invalid content, 429 too many requests
- 5xx server error — 500 unexpected, 502 bad upstream response, 503 unavailable, 504 upstream timeout

**Debugging habit.** Status codes tell you *where* to look: 4xx means the request (or the caller's permissions), 502/504 point past the proxy at your app, 500 points at your code.
`.trim(),
    explanation: `
## Requests and responses

Every HTTP exchange is one **request** (method, path, headers, optional body) answered by one **response** (status code, headers, optional body). HTTP itself is **stateless**: the server does not remember anything between requests just because they arrived on the same connection. Applications simulate "being logged in" by sending an identifier back on every request — a session cookie or a bearer token — which the server looks up each time.

## Methods: safe vs idempotent

- **Safe** methods (GET, HEAD, OPTIONS) never change server state, so they are safe to prefetch, cache and retry freely.
- **Idempotent** methods (the safe ones, plus PUT and DELETE) may change state, but repeating the exact same request has the same effect as doing it once — a client, or a retrying proxy, can safely resend them after a timeout.
- POST and PATCH are neither. Resending a timed-out POST can create a second order; a client that is not sure whether its request arrived should use an idempotency key rather than just retrying.

## Status code families

The first digit tells you which family applies, which narrows down where to look before you dig any further:

- **2xx — success.** 200 OK (a body is returned), 201 Created (a new resource now exists — include a \`Location\` header pointing at it), 204 No Content (succeeded, nothing to return — a typical DELETE response).
- **3xx — redirection.** 301/308 move permanently; 302/307 move temporarily; 304 Not Modified means "your cached copy is still good" (see ETags, below).
- **4xx — client error.** The request itself, or the caller's credentials or permissions, is the problem: 400 malformed syntax, 401 not authenticated, 403 authenticated but not allowed, 404 not found (or hidden on purpose, to avoid leaking that a resource exists), 409 conflicts with the resource's current state, 422 well-formed but semantically invalid, 429 too many requests.
- **5xx — server error.** The problem is on your side, or on an upstream you depend on: 500 unexpected/unhandled, 502 a bad response from an upstream server, 503 temporarily unavailable (overloaded or in maintenance), 504 an upstream took too long to respond.

This is also a debugging habit worth building: 4xx points at the request or the caller; 502/504 point *past* your app at something upstream (a proxy, another service, a timeout); 500 points at your own code.

## Caching with Cache-Control

\`Cache-Control\` tells caches — the browser, a CDN, a shared proxy — whether and how long they may reuse a response without asking again:

- \`max-age=600\` — reusable for 600 seconds.
- \`no-cache\` — may be cached, but must be revalidated with the origin before each reuse (not "don't cache", despite the name).
- \`no-store\` — never cache this at all, anywhere. Use it for anything containing personal data that passes through a cache other users might share.
- \`private\` — only a single user's own browser may cache it. \`public\` — shared caches (CDNs, proxies) may cache it too. **Never let personal data get \`public\` caching** — a shared cache serving it to the next visitor is a real data leak, not a hypothetical one.
- \`s-maxage\` — like \`max-age\`, but only for shared caches; lets a CDN cache a response longer than an individual browser would.

**ETags and revalidation.** A server can tag a response with an \`ETag\` (an opaque version identifier). Next time, the client sends it back as \`If-None-Match\`; if it still matches, the server replies \`304 Not Modified\` with no body, confirming the client's cached copy is still correct — cheaper than re-sending the whole response.

## 429 and rate limiting, briefly

\`429 Too Many Requests\` tells a client it has exceeded a quota, usually with a \`Retry-After\` header (seconds, or an HTTP date) saying how long to back off. Two common ways to enforce a limit: a **fixed window** (e.g. "100 per calendar minute" — simple, but allows a burst right at the boundary between two windows) and a **token bucket** (tokens refill steadily and each request spends one, smoothing bursts out). Limits are usually keyed **per user or API key**, not just per IP address — many legitimate users can share one IP (an office network, a mobile carrier's NAT), and one determined client can rotate IPs. Across more than one server instance, an in-memory counter is only exact per instance; a shared store (Redis, or a database row) is needed to enforce the limit correctly across all of them. (The "Rate limiting" topic goes deeper into choosing and implementing a strategy.)
`.trim(),
    realWorldExample: `
Consider a small orders API: \`POST /orders\` creates an order, \`GET /orders/:id\` reads one back.

**Creating an order:**
\`\`\`http
POST /orders HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer <token>

{"productId": "sku_42", "quantity": 2}
\`\`\`
A successful create returns 201 with a \`Location\` header and the new resource:
\`\`\`http
HTTP/1.1 201 Created
Location: /orders/9f1c2a
Content-Type: application/json

{"id": "9f1c2a", "productId": "sku_42", "quantity": 2, "status": "PENDING"}
\`\`\`

**Reading it back, with caching.** An order is personal data, so it is cached per-user at most, and revalidated cheaply:
\`\`\`http
GET /orders/9f1c2a HTTP/1.1
Authorization: Bearer <token>
If-None-Match: "a1b2c3"
\`\`\`
If nothing has changed since ETag \`"a1b2c3"\` was issued, the server does not resend the body:
\`\`\`http
HTTP/1.1 304 Not Modified
\`\`\`

**Ordering too fast.** If this user has placed too many orders this minute:
\`\`\`http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
\`\`\`
A well-behaved client waits at least 30 seconds before trying again — retrying immediately only adds to the load that triggered the 429.

**Something is wrong upstream.** If the orders API depends on a payments service that is down:
\`\`\`http
HTTP/1.1 502 Bad Gateway
\`\`\`
That status code alone tells you to go look at the payments service, not at the orders API's own code.
`.trim(),
    codeExample: `
import { NextResponse } from "next/server";

// POST /api/orders — create an order. POST is neither safe nor idempotent, so a client
// that is unsure whether its request arrived should retry with an idempotency key,
// not by resending blindly.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.productId !== "string" || typeof body.quantity !== "number") {
    return NextResponse.json({ error: "productId and quantity are required" }, { status: 400 });
  }
  if (body.quantity <= 0) {
    return NextResponse.json({ error: "quantity must be positive" }, { status: 422 });
  }

  const allowed = await checkRateLimit(req); // per user/API key, backed by a shared store
  if (!allowed.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(allowed.retryAfterSeconds) } },
    );
  }

  const order = await createOrder(body);
  return NextResponse.json(order, {
    status: 201,
    headers: { Location: \`/orders/\${order.id}\` },
  });
}

// GET /api/orders/:id — safe, idempotent, and cacheable per user only.
// Never "public": an order is personal data.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await findOrder(id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (req.headers.get("if-none-match") === order.etag) {
    return new NextResponse(null, { status: 304 });
  }
  return NextResponse.json(order, {
    headers: { "Cache-Control": "private, max-age=60", ETag: order.etag },
  });
}
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Returning 200 for everything, with the real result buried in the body.** Clients — and infrastructure like load balancers, monitoring and caches — rely on the status code; burying "actually it failed" inside a 200 body breaks all of that.
- **Caching personal data as \`public\`.** A shared cache (a CDN, a corporate proxy) that serves one user's cached order history to the next visitor is a real data leak, not a hypothetical one. Personal responses should be \`private\` at most, and often \`no-store\`.
- **Treating POST as safe to retry blindly.** POST is neither safe nor idempotent; retrying a timed-out POST without an idempotency key can create a duplicate order. Use an idempotency key — a client-generated id the server deduplicates on — for any POST that must not double-apply.
- **Confusing \`no-cache\` with \`no-store\`.** \`no-cache\` still allows caching — it just requires revalidation first. If the intent is "never store this anywhere", use \`no-store\` instead.
- **Ignoring \`Retry-After\` and retrying a 429 or 503 immediately.** That just adds to the load that caused the response in the first place; back off for at least the given duration.
- **Returning 500 for problems that are really 4xx.** A malformed request body or an unauthenticated caller is not a server bug — returning 500 for it hides real server errors in monitoring and wrongly suggests to the caller that retrying later might help.
`.trim(),
  },
};

const topics: SeedTopic[] = [
  httpTopic,
  t("rest", "REST APIs and CRUD operations", "Resource modelling, method semantics, status codes and API design conventions.", `
REST models a system as **resources** identified by URLs and manipulated with standard HTTP methods.

- Nouns, not verbs: \`/orders\`, \`/orders/42\`, \`/orders/42/items\`.
- CRUD mapping: POST (create, 201), GET (read, 200), PUT/PATCH (update, 200/204), DELETE (204).
- State transitions that are not plain CRUD (cancel, refund) become sub-resources: \`POST /orders/42/cancellation\`.
- Validate input at the boundary: 400 for malformed syntax, 422 for semantically invalid data, 409 for conflicts with current state.
- Lists are paginated and filterable; never return unbounded collections.
- Enforce ownership on every resource lookup — authentication alone is not authorization.
`),
  t("js-ts", "JavaScript and TypeScript backend fundamentals", "Runtime vs compile-time guarantees, numbers, immutability and safe typing of untrusted data.", `
TypeScript adds a static type system that is **erased** at compile time. Everything that crosses a trust boundary — request bodies, environment variables, database JSON, third-party responses — must be validated at runtime.

\`\`\`ts
const CreateOrder = z.object({ productId: z.string(), quantity: z.number().int().positive() });
type CreateOrder = z.infer<typeof CreateOrder>; // one source of truth
const parsed = CreateOrder.safeParse(await req.json());
\`\`\`

Other essentials: prefer \`unknown\` over \`any\` for untrusted values; \`const\` prevents rebinding, not mutation; numbers are IEEE 754 doubles, so store money as integer cents or a decimal type; and \`Array.prototype.sort\` compares strings unless you pass a comparator.
`),
  t("node-async", "Node.js and asynchronous programming", "The event loop, promises, concurrency and keeping the main thread free.", `
Node.js runs JavaScript on **one main thread**. I/O is handed to the operating system and completes via callbacks, so a single process can serve many concurrent requests — as long as nothing blocks the event loop.

- CPU-heavy work (large parsing, compression, password hashing in tight loops) blocks every request: move it to a worker or background job.
- \`await\` in a loop is sequential; use \`Promise.all\` (with a concurrency cap) for independent work.
- \`Promise.all\` fails fast; \`Promise.allSettled\` reports every outcome.
- Unhandled promise rejections crash the process in modern Node — always await or catch.
- Microtasks (promise callbacks, \`process.nextTick\`) run before the next timer or I/O callback.
`),
  t("auth", "Authentication and authorization", "Passwords, sessions vs tokens, cookies and object-level access control.", `
**Authentication** proves identity; **authorization** decides access.

- Store passwords with Argon2id, scrypt or bcrypt — slow, salted, designed for passwords.
- Sessions: a random id in an HttpOnly, Secure, SameSite cookie that maps to server-side state. Easy to revoke.
- JWTs: signed, readable claims. Stateless and scalable, but valid until expiry unless you add revocation. Keep them short-lived and pair them with rotating refresh tokens.
- Authorize **every object access**: \`WHERE id = $1 AND owner_id = $2\`. Never trust ids from the client to decide ownership.
- Protect login with throttling, generic errors (no account enumeration) and MFA.
`),
  t("postgres", "PostgreSQL and relational databases", "Tables, keys, constraints, NULL semantics, ACID and reading query plans.", `
Relational databases enforce structure and **invariants**. Push rules into the schema wherever possible: primary keys, foreign keys, UNIQUE, NOT NULL and CHECK constraints are enforced for every writer, including scripts and future services.

- ACID: atomicity, consistency, isolation, durability.
- NULL means *unknown*: use \`IS NULL\`, and beware \`NOT IN\` with NULLs.
- Money: NUMERIC or integer cents, never floating point.
- Normalize to store each fact once; denormalize deliberately for read performance or historical snapshots (an order's price at purchase time).
- \`EXPLAIN ANALYZE\` shows what the planner actually did.
`),
  t("prisma", "Prisma ORM", "Schema, migrations, querying relations, transactions and common pitfalls.", `
Prisma generates a type-safe client from \`schema.prisma\`.

- \`prisma migrate dev\` creates and applies migrations in development; \`prisma migrate deploy\` applies committed migrations in CI/production without generating new ones.
- \`select\` picks fields; \`include\` loads relations. Avoid N+1 loops — load related data in one query.
- \`findUnique\` returns \`null\` when nothing matches; \`update\` and \`delete\` throw (error code P2025).
- \`$transaction([...])\` runs independent operations atomically; interactive \`$transaction(async (tx) => ...)\` rolls back if the callback throws.
- In Next.js development, keep a single PrismaClient on \`globalThis\` so hot reloads do not exhaust connections.
`),
  t("joins-indexes", "Database joins, indexes, and constraints", "Join types, B-tree indexes, composite index order and constraint trade-offs.", `
- **INNER JOIN** keeps matching rows only; **LEFT JOIN** keeps every left row and fills missing right columns with NULL.
- A B-tree index speeds up equality, range and ORDER BY on its leading columns, at the cost of extra writes and storage.
- Composite index \`(customer_id, created_at)\` serves \`WHERE customer_id = ?\` and \`WHERE customer_id = ? ORDER BY created_at\` well; a filter on a column outside the index cannot use it.
- Wrapping an indexed column in a function (\`lower(email)\`) needs an **expression index**.
- Foreign keys choose what happens on delete: CASCADE, RESTRICT or SET NULL — pick deliberately.
`),
  t("transactions", "Transactions and rollback", "Atomic multi-step writes, rollback, savepoints and keeping transactions short.", `
A transaction groups statements so they all commit or none do.

- Use one whenever several writes must stay consistent (debit + credit, order + stock movement).
- After an error inside a PostgreSQL transaction block, every further statement fails until you ROLLBACK (or roll back to a savepoint).
- Keep transactions short: no network calls to payment providers or email services inside them — they hold locks and connections while waiting.
- For "write to DB and then notify another system", use the **transactional outbox**: insert an event row in the same transaction and publish it afterwards.
`),
  t("pagination", "Pagination, filtering, and sorting", "Offset vs cursor pagination, stable ordering and safe query parameters.", `
- **Offset** (\`LIMIT 20 OFFSET 400\`) is simple and supports page numbers, but deep pages get slower and concurrent inserts shift rows (duplicates or skipped items).
- **Cursor/keyset** (\`WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT 20\`) stays fast at any depth and is stable under inserts.
- Always sort by a unique tiebreaker (usually id) so order is deterministic.
- Whitelist sortable/filterable fields and cap the page size.
`),
  t("caching", "Caching and Redis concepts", "Cache-aside, TTLs, invalidation, stampedes and Redis data structures.", `
- **Cache-aside**: read from cache; on miss, read the database and populate the cache with a TTL. On writes, update the database and delete (or update) the cache entry.
- Every cached value needs an expiry and an invalidation story; stale data is the main cost of caching.
- **Stampede**: when a hot key expires, many requests hit the database at once. Mitigate with request coalescing/locks, early refresh and jittered TTLs.
- Cache keys must include everything that changes the result — especially the user id for per-user data.
- Redis offers strings, hashes, lists, sets and sorted sets (great for leaderboards and rate limiting).
`),
  t("rate-limiting", "Rate limiting", "Algorithms, keys, distributed counters and client signalling.", `
- **Fixed window**: simple, but allows bursts of up to twice the limit around window boundaries.
- **Sliding window** and **token bucket**: smoother; token bucket allows controlled bursts.
- Choose the key carefully: API key or user id for authenticated traffic, IP as a coarse fallback (many users can share one IP).
- With several app instances, counters must live in a shared store such as Redis, or each instance enforces its own limit.
- Respond with **429 Too Many Requests** and **Retry-After**.
`),
  t("jobs-queues", "Background jobs and queues", "Offloading work, at-least-once delivery, retries, backoff and dead-letter queues.", `
Anything slow or failure-prone that the user does not need to wait for — emails, imports, webhooks out, reports — belongs in a background job.

- Most queues deliver **at least once**: handlers must be idempotent.
- Retry with **exponential backoff and jitter**; cap attempts and move poison messages to a **dead-letter queue** for inspection.
- Enqueue reliably with the **transactional outbox** so a job is never lost or sent for a rolled-back change.
- PostgreSQL can act as a simple queue using \`SELECT ... FOR UPDATE SKIP LOCKED\`.
`),
  t("webhooks", "Webhooks and polling", "Push vs pull integration, signature verification and robust receivers.", `
- **Polling** asks repeatedly ("anything new?"); simple but wasteful and delayed. **Webhooks** push events to your endpoint as they happen.
- Verify every webhook: compute an HMAC over the **raw** request body with the shared secret, compare in constant time, and reject old timestamps to stop replays.
- Acknowledge fast (2xx), then process asynchronously.
- Expect duplicates and out-of-order delivery: store processed event ids with a unique constraint and re-fetch current state when order matters.
- Keep a reconciliation poll as a safety net for missed events.
`),
  t("idempotency", "Idempotency", "Designing operations that are safe to retry.", `
An operation is idempotent when doing it twice has the same effect as doing it once. Networks time out, clients retry, and queues redeliver — so side-effecting operations must be safe to repeat.

- **Idempotency keys**: the client sends a unique key (e.g. \`Idempotency-Key\` header); the server stores key + request fingerprint + result, and returns the stored result on retry.
- Reject reuse of a key with a different payload.
- Natural idempotency: unique constraints and upserts ("insert if not exists") make duplicates impossible at the database level.
- Make the key record and the side effect commit together, or handle the "in progress" state explicitly.
`),
  t("concurrency", "Concurrency and race conditions", "Check-then-act bugs, lost updates and how to make updates atomic.", `
A race condition happens when the result depends on the timing of concurrent operations.

- **Check-then-act**: reading stock, checking it in code, then writing lets two requests both pass the check.
- **Lost update**: two read-modify-write cycles overwrite each other.
- Fixes: atomic conditional updates (\`UPDATE ... SET stock = stock - 1 WHERE id = $1 AND stock >= 1\`), row locks (\`SELECT ... FOR UPDATE\`), optimistic concurrency (version column), unique constraints, or serializable transactions with retries.
- A single Node process is single-threaded, but await points still interleave requests — and production runs several processes.
`),
  t("isolation-locking", "Database isolation and locking", "Isolation levels, anomalies, row locks and deadlocks in PostgreSQL.", `
- PostgreSQL's default isolation level is **READ COMMITTED**: each statement sees data committed before it began.
- REPEATABLE READ gives a snapshot for the whole transaction; SERIALIZABLE additionally prevents serialization anomalies and may abort transactions with SQLSTATE 40001 — callers must retry.
- \`SELECT ... FOR UPDATE\` locks selected rows until commit; \`SKIP LOCKED\` lets workers grab different rows.
- Deadlocks happen when transactions wait on each other's locks; PostgreSQL aborts one. Lock rows in a consistent order and keep transactions short.
`),
  t("observability", "Logging, monitoring, and error handling", "Structured logs, metrics, traces, alerting and safe error responses.", `
- **Logs** explain individual events; **metrics** show trends and trigger alerts; **traces** follow one request across services.
- Log structured JSON with a request/correlation id; never log passwords, tokens or full card numbers.
- Watch the golden signals: latency, traffic, errors, saturation.
- Clients get a generic error and a request id; the logs get the details.
- Alert on symptoms users feel (error rate, latency SLOs), not on every internal blip.
`),
  t("scalability", "Load balancing and scalability", "Horizontal scaling, stateless services, health checks and read replicas.", `
- **Vertical** scaling buys a bigger machine; **horizontal** scaling adds machines behind a load balancer.
- Horizontal scaling requires **stateless** app servers: sessions, uploads and caches live in shared stores.
- Load balancers distribute traffic (round robin, least connections) and use **health checks** to stop routing to unhealthy instances.
- Databases scale reads with replicas (beware replication lag), and writes with partitioning/sharding — a much bigger step.
- Measure first: find the actual bottleneck before scaling anything.
`),
  t("devops", "Docker, CI/CD, and cloud deployment", "Containers, pipelines, configuration and safe database migrations.", `
- Containers package an app with its dependencies and share the host kernel; VMs virtualize a whole machine.
- Multi-stage Dockerfiles build in one stage and copy only the output into a small runtime image; run as a non-root user.
- CI runs type checks, lint, tests and builds on every change; CD deploys passing builds automatically.
- Configuration and secrets come from the environment, never baked into images or committed to git.
- Run migrations as an explicit release step, and make schema changes backward compatible (**expand → migrate → contract**) so old and new code can run side by side.
`),
  t("security", "Backend security", "Injection, XSS, CSRF, SSRF, secrets and least privilege.", `
- **SQL injection**: never concatenate input into SQL; use parameterized queries (Prisma does this by default; be careful with raw queries).
- **XSS**: encode output for its context; React escapes by default, so avoid injecting raw HTML. Add a Content Security Policy.
- **CSRF**: SameSite cookies plus CSRF tokens or origin checks for cookie-authenticated state changes.
- **SSRF**: do not let users make your server fetch arbitrary URLs; allowlist destinations and block internal address ranges.
- **Secrets**: keep them out of git, rotate on exposure, and grant each service the least privilege it needs.
`),
  t("system-design", "System design fundamentals", "Requirements, estimation, trade-offs and the building blocks of large systems.", `
A good system-design answer is a structured conversation:

1. Clarify functional and non-functional requirements (scale, latency, consistency, availability).
2. Estimate load: requests per second, storage growth, read/write ratio.
3. Sketch the high-level design: clients, load balancer, stateless services, databases, caches, queues.
4. Dive into the hardest parts: data model, hot spots, failure modes.
5. Discuss trade-offs explicitly — consistency vs availability during partitions, cost vs latency, simplicity vs flexibility.

Know the vocabulary: SLI/SLO/SLA, replication vs sharding, CAP, idempotency, back-pressure.
`),
];

export const curriculum = { track: tracks[0]!, topics };
