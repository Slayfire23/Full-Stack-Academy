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
  /** Other topic slugs whose lesson should be completed before this one, enforced by the seed. */
  prerequisiteSlugs?: string[];
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

const restTopic: SeedTopic = {
  slug: "rest",
  title: "REST APIs and CRUD operations",
  description: "Resource modelling, method semantics, status codes and API design conventions.",
  prerequisiteSlugs: ["http"],
  lesson: {
    slug: "essentials",
    title: "REST APIs and CRUD operations: essentials",
    level: "BEGINNER",
    estimatedMinutes: 15,
    summary:
      "REST models everything as resources manipulated with HTTP's existing methods and status codes — once you know those, API design is mostly naming and consistency.",
    content: `
REST models a system as **resources** identified by URLs and manipulated with standard HTTP methods.

- Nouns, not verbs: \`/orders\`, \`/orders/42\`, \`/orders/42/items\`.
- CRUD mapping: POST (create, 201), GET (read, 200), PUT/PATCH (update, 200/204), DELETE (204).
- State transitions that are not plain CRUD (cancel, refund) become sub-resources: \`POST /orders/42/cancellation\`.
- Validate input at the boundary: 400 for malformed syntax, 422 for semantically invalid data, 409 for conflicts with current state.
- Lists are paginated and filterable; never return unbounded collections.
- Enforce ownership on every resource lookup — authentication alone is not authorization.
`.trim(),
    explanation: `
## Resources, not actions

REST (Representational State Transfer) models a system as **resources** — nouns — identified by URLs, manipulated with the small set of HTTP methods you already know. Instead of inventing a new verb for every operation (\`/getOrder\`, \`/cancelOrder\`), you expose a resource (\`/orders/42\`) and let the HTTP method say what to do to it.

- \`GET /orders\` — list orders (query parameters filter and page them)
- \`GET /orders/42\` — read one order
- \`POST /orders\` — create an order (**201 Created**, with a \`Location\` header)
- \`PUT /orders/42\` — replace it wholesale
- \`PATCH /orders/42\` — modify part of it
- \`DELETE /orders/42\` — remove it (**204 No Content**, usually)

## Naming resources

- Use plural nouns: \`/orders\`, not \`/order\`.
- Nest only to express real ownership: \`/orders/42/items\`, not many levels of nested ids.
- An action that is not plain CRUD still gets a noun: cancelling an order is \`POST /orders/42/cancellation\`, not \`POST /orders/42/cancel\`.

## Status codes, applied to CRUD

The same status-code families from HTTP Fundamentals, mapped onto CRUD specifically:

- **201 Created** for a successful POST, with \`Location\` pointing at the new resource.
- **200 OK** for a read, or a PUT/PATCH that returns the updated resource.
- **204 No Content** for a PUT/PATCH/DELETE that returns nothing.
- **404 Not Found** for an id that does not exist, *or belongs to someone else* — never reveal which.
- **409 Conflict** when the request conflicts with the resource's *current state* (a stale version, a duplicate unique value, cancelling an order that has already shipped).
- **422 Unprocessable Content** when the body is well-formed JSON but fails a validation or business rule.
- **400 Bad Request** is still for syntactically broken input (malformed JSON) — a step earlier than either 409 or 422.

## Pagination and filtering

Never return an entire table. List endpoints accept filters (\`?status=draft\`) and are paginated. Cursor-based pagination (\`?cursor=...&limit=20\`) scales better than offset/page numbers once a table is large and being written to concurrently, because an offset shifts under you as rows are inserted or deleted between pages, while a cursor (a pointer to the last-seen row) does not. The Pagination, filtering, and sorting topic goes deeper into offset vs cursor pagination and stable ordering.

## Idempotency and retries

GET, PUT and DELETE are idempotent (RFC 9110): repeating them has the same effect as doing them once, so a client can safely retry them after a timeout. POST and PATCH are not — retrying a timed-out "create order" POST can create two orders. For actions that must not double-apply, accept a client-generated \`Idempotency-Key\` header and store it: a replay with the same key returns the original result instead of creating a second one.

## Versioning

A public API is a promise to its callers. Changing a field's type or removing a field is a breaking change. Evolve additively where you can (add a new field alongside the old one); reach for a new version (\`/v2\`, or a version header) only when you must, and remove the old behaviour only after usage data shows it is safe.
`.trim(),
    realWorldExample: `
Consider an order-processing API.

**Listing, paginated:**
\`\`\`http
GET /orders?status=draft&limit=20 HTTP/1.1
Authorization: Bearer <token>
\`\`\`
\`\`\`http
HTTP/1.1 200 OK
Content-Type: application/json

{"items": [{"id": "42", "status": "draft"}], "nextCursor": "42"}
\`\`\`

**Creating, safe to retry:**
\`\`\`http
POST /orders HTTP/1.1
Idempotency-Key: 6f1c2a3e-9b7d-4e2a-9c1a-2f3e4d5c6b7a
Content-Type: application/json

{"productId": "sku_42", "quantity": 2}
\`\`\`
\`\`\`http
HTTP/1.1 201 Created
Location: /orders/42
\`\`\`
A retry of that exact request (same \`Idempotency-Key\`, after a dropped response) returns the same \`201\` and the same order — not a second one.

**Cancelling, state-checked:**
\`\`\`http
POST /orders/42/cancellation HTTP/1.1
\`\`\`
If the order already shipped, the state itself is what's wrong, not the request's syntax:
\`\`\`http
HTTP/1.1 409 Conflict
Content-Type: application/json

{"error": {"message": "Order has already shipped", "code": "conflict"}}
\`\`\`
`.trim(),
    codeExample: `
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

// GET /api/orders?cursor=...&limit=20 — paginated, and scoped to the caller.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);
  const cursor = searchParams.get("cursor") ?? undefined;
  const userId = await requireUserId(req);

  const orders = await db.order.findMany({
    where: { userId }, // ownership: "not found" and "not yours" must look the same
    orderBy: { id: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = orders.length > limit;
  const items = orders.slice(0, limit);
  return NextResponse.json({ items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null });
}

// POST /api/orders — not idempotent by default, so a retried request needs a key.
export async function POST(req: Request) {
  const userId = await requireUserId(req);
  const idempotencyKey = req.headers.get("idempotency-key");
  const body = await req.json();

  try {
    const order = await db.order.create({
      data: { userId, productId: body.productId, quantity: body.quantity, idempotencyKey },
    });
    return NextResponse.json(order, { status: 201, headers: { Location: \`/orders/\${order.id}\` } });
  } catch (err) {
    // A unique constraint on (userId, idempotencyKey) — not a check-then-create read — is what
    // actually prevents a duplicate: two concurrent retries can both pass a "does this key
    // exist?" check before either has written, but only one INSERT can win the constraint.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && idempotencyKey) {
      const existing = await db.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
      if (existing) return NextResponse.json(existing, { status: 201 }); // the winner's result, not an error
    }
    throw err;
  }
}
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Verbs in the URL.** \`/getOrder\`, \`/cancelOrder\` fight the protocol — the HTTP method already says what to do; keep the path a noun.
- **Returning everything from a list endpoint.** An unpaginated \`/orders\` is fine with 10 rows and a production incident with 10 million.
- **Trusting the client for ownership.** Checking that a token is valid is authentication; separately checking \`WHERE user_id = $1\` is authorization — see the Authentication and Authorization lesson.
- **Picking 409 vs 422 vs 400 by feel.** 400 is for syntax, 422 is for a validatable body that breaks a rule, 409 is for conflicting with the resource's current state. Mixing these up makes client error-handling guesswork.
- **Treating POST as safe to retry.** Without an idempotency key, a network retry of a timed-out "create" can create a duplicate.
- **Breaking public clients to "clean up" a field.** Changing a field's type or meaning in place breaks every caller that can't upgrade on your schedule; add alongside, version, deprecate, then remove.
`.trim(),
  },
};

const jsTsTopic: SeedTopic = {
  slug: "js-ts",
  title: "JavaScript and TypeScript backend fundamentals",
  description: "Runtime vs compile-time guarantees, numbers, immutability and safe typing of untrusted data.",
  lesson: {
    slug: "essentials",
    title: "JavaScript and TypeScript backend fundamentals: essentials",
    level: "BEGINNER",
    estimatedMinutes: 15,
    summary:
      "TypeScript's types vanish at compile time, so anything crossing a trust boundary needs real runtime validation — plus a few JavaScript quirks (numbers, mutability, sorting) that bite backend code specifically.",
    content: `
TypeScript adds a static type system that is **erased** at compile time. Everything that crosses a trust boundary — request bodies, environment variables, database JSON, third-party responses — must be validated at runtime.

\`\`\`ts
const CreateOrder = z.object({ productId: z.string(), quantity: z.number().int().positive() });
type CreateOrder = z.infer<typeof CreateOrder>; // one source of truth
const parsed = CreateOrder.safeParse(await req.json());
\`\`\`

Other essentials: prefer \`unknown\` over \`any\` for untrusted values; \`const\` prevents rebinding, not mutation; numbers are IEEE 754 doubles, so store money as integer cents or a decimal type; and \`Array.prototype.sort\` compares strings unless you pass a comparator.
`.trim(),
    explanation: `
## Types are a compile-time promise, not a runtime guard

TypeScript's type system is **erased** when compiled to JavaScript — none of it exists at runtime. \`function handler(body: CreateOrder)\` does not check anything about the actual value passed in; it is a note to the compiler and to other programmers. A request body, a database JSON column, an environment variable, or a third-party API response can be anything at runtime, no matter what you have typed it as.

\`\`\`ts
const body = req.body as CreateOrder; // compiles — proves nothing
\`\`\`

This \`as\` is a *cast*: you are telling the compiler to trust you, not validating anything. Whatever the real JSON contains reaches your code unchanged.

## Validate at the boundary

Any value crossing a trust boundary (HTTP body, query string, environment variable, webhook payload) should be parsed with a runtime validator — this project uses Zod — and the *static* type should be inferred from that same schema, so the two can never drift apart:

\`\`\`ts
const CreateOrder = z.object({ productId: z.string(), quantity: z.number().int().positive() });
type CreateOrder = z.infer<typeof CreateOrder>; // one source of truth
const parsed = CreateOrder.safeParse(await req.json());
\`\`\`

\`safeParse\` also strips unknown keys by default, which blocks **mass assignment** — a client sneaking in \`role: "admin"\` on a profile-update request.

## \`unknown\` vs \`any\`

\`any\` turns off type-checking for a value and lets that unsafety spread to everything it touches. \`unknown\` accepts anything but forces you to narrow it (a \`typeof\` check, a schema parse) before you can use it. Prefer \`unknown\` for anything untrusted — parsed JSON, a caught error in a \`catch\` block — so the compiler makes you prove the shape before you rely on it.

## \`const\` is not immutability

\`const\` only prevents *reassigning the binding* — it says nothing about the value itself:

\`\`\`ts
const order = { status: "new" };
order.status = "paid"; // perfectly legal
\`\`\`

TypeScript's \`readonly\` and \`as const\` are compile-time-only annotations; plain JavaScript (or a cast) can still write the property. \`Object.freeze\` is the one that actually stops a write at runtime — and only shallowly. Whether a write to a frozen object's property raises an error depends on strict mode: in strict mode it throws a \`TypeError\`; otherwise the assignment is silently ignored, and execution continues as if it had succeeded. Backend code is strict by default — every ES module and every \`class\` body is always strict — so this is usually the \`TypeError\` case, but it's worth knowing the silent-failure mode exists.

## Numbers are IEEE 754 doubles

\`0.1 + 0.2 === 0.3\` is \`false\` because neither 0.1 nor 0.2 has an exact binary floating-point representation; the real sum is \`0.30000000000000004\`. That is irrelevant for most values, but fatal for money: never store currency as a JavaScript \`number\`. Store integer minor units (cents) or use a decimal type/library, and let PostgreSQL's \`NUMERIC\` (not \`FLOAT\`) hold the authoritative value.

## \`Array.prototype.sort\` compares strings by default

Without a comparator, \`sort\` converts elements to strings and compares them in UTF-16 code-unit order — so numbers sort like text (\`"10"\` before \`"9"\`). Always pass a comparator for anything other than plain strings: \`(a, b) => a - b\` for ascending numbers.
`.trim(),
    realWorldExample: `
Consider a \`PATCH /api/profile\` endpoint that lets a signed-in user update their own name and email.

**The unsafe version:**
\`\`\`ts
export async function PATCH(req: Request) {
  const body = (await req.json()) as { name?: string; email?: string; role?: string };
  const user = await requireSession(req);
  return db.user.update({ where: { id: user.id }, data: body }); // body.role sneaks through
}
\`\`\`
The cast makes TypeScript happy and checks nothing. A crafted request body with \`{"name": "Ada", "role": "ADMIN"}\` writes \`role\` straight to the database — the server never decided to grant admin, the client did.

**Validated:**
\`\`\`ts
const UpdateProfile = z.object({ name: z.string().min(1).max(80).optional(), email: z.string().email().optional() });

export async function PATCH(req: Request) {
  const user = await requireSession(req);
  const parsed = UpdateProfile.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  return NextResponse.json(await db.user.update({ where: { id: user.id }, data: parsed.data }));
}
\`\`\`
\`role\` is not in the schema, so \`safeParse\` drops it even if a client sends it — the only way to become an admin is through a path the server itself controls.

**Money, in the same codebase:**
\`\`\`ts
// Wrong: floats accumulate error.
const total = 19.99 + 5.0; // 24.990000000000002 after enough of these

// Right: integer cents.
const totalCents = 1999 + 500; // 2499, exact every time
\`\`\`
`.trim(),
    codeExample: `
import { z } from "zod";

function parseEnv<S extends z.ZodTypeAny>(schema: S, raw: Record<string, string | undefined>): z.output<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(\`Invalid environment: \${JSON.stringify(parsed.error.flatten().fieldErrors)}\`);
  }
  return parsed.data;
}

// process.env is typed as Record<string, string | undefined>, but nothing stops a deploy
// that forgot to set AUTH_SECRET — the type alone does not catch a missing value.
const Env = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(3000),
});
export const env = parseEnv(Env, process.env);
// Fails fast at startup with a clear error, instead of a confusing crash deep in a request handler.
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Casting instead of validating.** \`req.body as CreateOrder\` satisfies the compiler and nothing else; always parse with a schema at the boundary.
- **Reaching for \`any\` to make an error go away.** \`any\` does not just skip checking that one value — the unsafety spreads to everything derived from it. Use \`unknown\` and narrow instead.
- **Assuming \`const\`/\`readonly\` protects an object.** Both are compile-time only; a cast or plain JavaScript can still mutate the value. Use \`Object.freeze\` for an actual runtime guarantee (and remember it is shallow).
- **Storing money as a JavaScript \`number\`.** Floating-point rounding will eventually produce a total that is a cent off. Use integer cents or a decimal type end to end, including in the database.
- **Sorting numbers without a comparator.** \`[10, 9, 1].sort()\` is \`[1, 10, 9]\`, not \`[1, 9, 10]\` — \`sort\` defaults to string comparison.
`.trim(),
  },
};

const nodeAsyncTopic: SeedTopic = {
  slug: "node-async",
  title: "Node.js and asynchronous programming",
  description: "The event loop, promises, concurrency and keeping the main thread free.",
  prerequisiteSlugs: ["js-ts"],
  lesson: {
    slug: "essentials",
    title: "Node.js and asynchronous programming: essentials",
    level: "INTERMEDIATE",
    estimatedMinutes: 18,
    summary:
      "Node runs your JavaScript on one thread; the event loop keeps that thread free by handing I/O to the operating system and resuming your code when it's ready — understanding that one fact explains most Node.js performance bugs.",
    content: `
Node.js runs JavaScript on **one main thread**. I/O is handed to the operating system and completes via callbacks, so a single process can serve many concurrent requests — as long as nothing blocks the event loop.

- CPU-heavy work (large parsing, compression, password hashing in tight loops) blocks every request: move it to a worker or background job.
- \`await\` in a loop is sequential; use \`Promise.all\` (with a concurrency cap) for independent work.
- \`Promise.all\` fails fast; \`Promise.allSettled\` reports every outcome.
- Unhandled promise rejections crash the process in modern Node — always await or catch.
- Microtasks (promise callbacks, \`process.nextTick\`) run before the next timer or I/O callback.
`.trim(),
    explanation: `
## One thread, non-blocking I/O

Node.js runs your JavaScript on a **single main thread**. When you call a database query, read a file or make an HTTP request, Node hands that work to the operating system (or a background thread pool, for some APIs) and moves on; your callback or \`await\` resumes once the result is ready. This is why one Node process can serve many concurrent requests — as long as nothing holds the main thread hostage.

## What actually blocks the event loop

I/O does not block it. **Synchronous CPU work does**: parsing a huge JSON payload, a tight hashing loop, image resizing, a large synchronous regular expression. While that code runs, nothing else does — no other request's callback, no timer, nothing — until it returns. Move CPU-bound work off the main thread (\`worker_threads\`, a separate worker process, or a job queue) instead of doing it inline in a request handler.

## Promises and \`async\`/\`await\`

\`async\`/\`await\` is syntax over promises, not a different mechanism. Two things worth being precise about:

- **\`Promise.all\`** runs its inputs concurrently and rejects as soon as the *first* one rejects — the others keep running, but their results are discarded. Use it when every result is required and any single failure should fail the whole operation.
- **\`Promise.allSettled\`** waits for all of them and reports each as fulfilled or rejected. Use it for independent work (for example, sending three notifications) where a partial failure should be reported, not treated as total failure.

\`await\` inside a loop runs sequentially — each iteration waits for the previous one to finish. That is correct when a step genuinely depends on the last one's result, but for independent work it means N round trips instead of one concurrent batch: map to an array of promises and \`Promise.all\` them instead (with a concurrency cap for very large N — unlimited concurrency can exhaust a database connection pool, below).

## Unhandled rejections are fatal

Since Node.js 15, an unhandled promise rejection is treated like an uncaught exception by default: it crashes the process. A forgotten \`await\`, or a \`.then()\` with no \`.catch\`, can take the whole server down. Always await or return promises, and catch at your boundaries (a route wrapper, a top-level handler).

## Microtasks, macrotasks and \`process.nextTick\`

Within one pass of synchronous code, Node drains its \`process.nextTick\` queue, then the promise microtask queue, before moving on to the next event-loop phase (timers, I/O callbacks). In practice: promise callbacks and \`nextTick\` callbacks always run before a \`setTimeout(() => ..., 0)\` callback does, even one scheduled first. The exact ordering between \`nextTick\` and promise microtasks is an implementation detail you should not depend on — what matters is that *both* run before timers and I/O.
`.trim(),
    realWorldExample: `
An admin uploads a 50,000-row CSV to import products. The naive handler:

\`\`\`ts
export async function POST(req: Request) {
  const text = await req.text();
  const rows = parseCsv(text); // 50,000 rows, fully in memory
  for (const row of rows) {
    await db.product.create({ data: row }); // one request at a time, serially
  }
  return new Response("done");
}
\`\`\`
This blocks the event loop while parsing the whole file synchronously, then makes 50,000 *sequential* database round trips — every other request on this server waits behind it, for minutes.

**Accepted immediately, done in the background, in batches:**
\`\`\`ts
export async function POST(req: Request) {
  const file = await req.blob();
  const job = await db.importJob.create({ data: { status: "PENDING" } });
  await queue.enqueue("import-csv", { jobId: job.id, fileKey: await storeFile(file) });
  return NextResponse.json({ jobId: job.id }, { status: 202 }); // Accepted — work continues elsewhere
}

// In the worker, off the request path:
async function processImport(jobId: string, fileKey: string) {
  const BATCH = 500;
  let batch: ProductRow[] = [];
  for await (const row of streamCsvRows(fileKey)) { // stream, never load 50,000 rows into memory at once
    batch.push(row);
    if (batch.length === BATCH) {
      await db.product.createMany({ data: batch, skipDuplicates: true }); // one round trip per batch
      batch = [];
    }
  }
  if (batch.length) await db.product.createMany({ data: batch, skipDuplicates: true });
  await db.importJob.update({ where: { id: jobId }, data: { status: "DONE" } });
}
\`\`\`
Streaming avoids loading the whole file into memory, batching turns 50,000 round trips into 100, and a unique constraint plus \`skipDuplicates\` (or an upsert) makes a retried job safe to run twice.
`.trim(),
    codeExample: `
// Unbounded concurrency can exhaust a database connection pool or overwhelm an API.
async function saveAllUnsafe(rows: Row[]) {
  await Promise.all(rows.map((r) => db.row.create({ data: r }))); // all 10,000 start at once
}

// A small concurrency limit keeps a bounded number of operations in flight.
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function saveAllSafely(rows: Row[]) {
  return mapWithConcurrency(rows, 10, (r) => db.row.create({ data: r })); // at most 10 in flight
}

// Independent work where a partial failure should be reported, not treated as total failure:
async function notifyAll(userIds: string[]) {
  const outcomes = await Promise.allSettled(userIds.map((id) => sendNotification(id)));
  const failed = outcomes.filter((o) => o.status === "rejected").length;
  if (failed > 0) log.warn(\`\${failed} of \${userIds.length} notifications failed\`);
}
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Doing CPU-heavy work inline in a request handler.** It blocks the event loop for everyone, not just the caller — move it to a worker or background job.
- **Unbounded \`Promise.all\` over a large array.** \`Promise.all(rows.map(saveRow))\` for 10,000 rows starts 10,000 database operations at once; cap concurrency or batch instead.
- **Awaiting independent work sequentially in a loop.** Correct when each step depends on the last, but a serial loop over independent operations is N round trips when one concurrent batch would do.
- **Forgetting to catch a promise.** An unhandled rejection crashes the process in modern Node — always await/catch, especially at a handler's top level.
- **Relying on exact \`nextTick\`-vs-microtask ordering.** Both run before timers and I/O, but the relative order between them is an implementation detail, not a contract.
`.trim(),
  },
};

const authTopic: SeedTopic = {
  slug: "auth",
  title: "Authentication and authorization",
  description: "Passwords, sessions vs tokens, cookies and object-level access control.",
  prerequisiteSlugs: ["rest"],
  lesson: {
    slug: "essentials",
    title: "Authentication and authorization: essentials",
    level: "INTERMEDIATE",
    estimatedMinutes: 18,
    summary:
      "Authentication proves who someone is; authorization decides what they can do — conflating the two, or checking only the first, is the single most common way APIs leak other people's data.",
    content: `
**Authentication** proves identity; **authorization** decides access.

- Store passwords with Argon2id, scrypt or bcrypt — slow, salted, designed for passwords.
- Sessions: a random id in an HttpOnly, Secure, SameSite cookie that maps to server-side state. Easy to revoke.
- JWTs: signed, readable claims. Stateless and scalable, but valid until expiry unless you add revocation. Keep them short-lived and pair them with rotating refresh tokens.
- Authorize **every object access**: \`WHERE id = $1 AND owner_id = $2\`. Never trust ids from the client to decide ownership.
- Protect login with throttling, generic errors (no account enumeration) and MFA.
`.trim(),
    explanation: `
## Two different questions

**Authentication** answers "who is this?" — usually a password check, resulting in a session or token. **Authorization** answers "is this identity allowed to do *this*, to *this* resource?" — checked on every single request, for every single resource. A system can authenticate flawlessly and still leak everyone's data if it forgets the second question on just one endpoint.

## Storing passwords

Hash passwords with a slow, salted, password-specific algorithm — Argon2id, scrypt or bcrypt. Never store them in plain text, never "encrypt" them reversibly, and never use a fast general-purpose hash like SHA-256 alone: those are built for speed, which is exactly wrong for passwords, since it makes offline brute-forcing a leaked database cheap. Verify with the library's own compare function (it handles timing safely) and re-hash on a successful login when you raise the cost factor.

## Sessions vs tokens

- **Sessions**: the cookie holds a random, unguessable id; the actual state (user id, roles) lives server-side (database, Redis). Revoking access is a single delete. The cookie should be \`HttpOnly\` (JavaScript cannot read it, limiting what a successful XSS can steal), \`Secure\` (HTTPS only) and \`SameSite=Lax\` or \`Strict\` (not sent on most cross-site requests, reducing CSRF).
- **JWTs**: a signed token carrying its own claims, verified without a database lookup — stateless and cheap to scale. The trade-off is revocation: a valid JWT stays valid until it expires, because nothing is looked up. The payload is also only **base64url-encoded, not encrypted** — anyone holding the token can read the claims, so never put secrets or sensitive personal data in them. Keep access tokens short-lived (minutes), pair them with a rotating refresh token, and if you need to revoke before expiry, reintroduce a small amount of server state (a token version or denylist checked on each request).

## Authorization: check it on every resource, every time

Authenticating a request tells you who is asking. It says nothing about whether they may see order 42. The classic failure (broken object-level authorization, or IDOR) looks like this: a logged-in user changes \`/api/orders/123\` to \`/api/orders/124\` in the URL and sees someone else's order, because the endpoint checked "is there a valid session?" and stopped — it never checked that order 124 belongs to this caller. Scope every lookup explicitly: \`WHERE id = $1 AND user_id = $2\`, and return 404 (not 403) when the row does not match, so a caller cannot tell "does not exist" apart from "exists, but is not yours."

In a multi-tenant system the same idea applies one level up: every tenant-owned row carries a \`tenant_id\` derived from the authenticated session (never from a request parameter), and ideally every query is scoped centrally (a repository layer, or PostgreSQL row-level security as defence in depth) so an individual endpoint cannot forget the filter.

## Protecting the login endpoint itself

Login is a target in its own right. Rate-limit by account *and* by IP, with backoff rather than a permanent lockout (a hard lockout lets an attacker deny service to a real user just by trying their account repeatedly). Return the same error and similar timing for "no such account" and "wrong password," so failed attempts cannot be used to enumerate which emails have accounts. Password resets need single-use, short-lived, randomly generated tokens, stored hashed like passwords — never derived from guessable data like a user id and timestamp — with the same account-enumeration-safe response either way.
`.trim(),
    realWorldExample: `
A simple login and protected-resource flow.

**Logging in** sets an HttpOnly session cookie:
\`\`\`http
POST /api/login HTTP/1.1
Content-Type: application/json

{"email": "ada@example.com", "password": "correct horse battery staple"}
\`\`\`
\`\`\`http
HTTP/1.1 200 OK
Set-Cookie: session=9f1c2a3e...; HttpOnly; Secure; SameSite=Lax; Path=/
\`\`\`

**Reading your own order** — the session proves who is asking, but the query still scopes by owner:
\`\`\`http
GET /api/orders/42 HTTP/1.1
Cookie: session=9f1c2a3e...
\`\`\`
If order 42 belongs to a different user, the correct response is the same as if it did not exist at all:
\`\`\`http
HTTP/1.1 404 Not Found
\`\`\`
not a 403 — a 403 would confirm that *something* is at that id, which is itself information leakage.

**The vulnerable version** of that handler only checks that a session exists:
\`\`\`ts
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession(req); // proves *who*, not *what they can see*
  const order = await db.order.findUnique({ where: { id } }); // missing owner filter
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(order); // leaks any user's order to any logged-in user
}
\`\`\`

**The fixed version** folds ownership into the query itself, so there is no separate step to forget:
\`\`\`ts
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession(req);
  const order = await db.order.findFirst({ where: { id, userId: user.id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 }); // same 404 either way
  return NextResponse.json(order);
}
\`\`\`
`.trim(),
    codeExample: `
import bcrypt from "bcryptjs";

export async function registerUser(email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12); // cost factor 12: slow by design
  return db.user.create({ data: { email, passwordHash } });
}

export async function login(email: string, password: string, ip: string) {
  // Rate-limit by account *and* IP, before touching the database.
  if (!loginLimiter.check(\`\${email}|\${ip}\`).allowed) throw new HttpError(429, "Too many attempts");

  const user = await db.user.findUnique({ where: { email } });
  // Compare against a dummy hash for unknown emails too, so response time does not itself
  // reveal whether the account exists.
  const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
  const valid = await bcrypt.compare(password, hashToCheck);
  if (!user || !valid) throw new HttpError(401, "Invalid email or password"); // identical message either way

  return createSession(user.id); // random session id; server holds the real state
}
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Checking authentication and calling it done.** A valid session or token only proves *who*; every resource lookup still needs its own ownership/authorization check.
- **Returning 403 instead of 404 for someone else's resource.** A 403 confirms the resource exists; a 404 reveals nothing. Make "not yours" look identical to "does not exist."
- **Treating a JWT's payload as private.** It is signed, not encrypted — anyone holding the token can read the claims. Never put secrets in it.
- **Hard-locking accounts after failed logins.** It becomes a denial-of-service tool against real users. Use rate limiting with backoff instead.
- **Letting "forgot password" or login responses reveal whether an email is registered.** Return the same response and similar timing either way.
- **Deriving a password-reset token from guessable data** (a user id and timestamp) instead of a long random value stored hashed.
`.trim(),
  },
};

const postgresTopic: SeedTopic = {
  slug: "postgres",
  title: "PostgreSQL and relational databases",
  description: "Tables, keys, constraints, NULL semantics, ACID and reading query plans.",
  lesson: {
    slug: "essentials",
    title: "PostgreSQL and relational databases: essentials",
    level: "BEGINNER",
    estimatedMinutes: 15,
    summary:
      "A relational database's real job is enforcing invariants — primary keys, foreign keys, NOT NULL and CHECK constraints apply to every writer, not just the one you remembered to validate in application code.",
    content: `
Relational databases enforce structure and **invariants**. Push rules into the schema wherever possible: primary keys, foreign keys, UNIQUE, NOT NULL and CHECK constraints are enforced for every writer, including scripts and future services.

- ACID: atomicity, consistency, isolation, durability.
- NULL means *unknown*: use \`IS NULL\`, and beware \`NOT IN\` with NULLs.
- Money: NUMERIC or integer cents, never floating point.
- Normalize to store each fact once; denormalize deliberately for read performance or historical snapshots (an order's price at purchase time).
- \`EXPLAIN ANALYZE\` shows what the planner actually did.
`.trim(),
    explanation: `
## Tables, keys and relationships

A table is a typed set of rows. The **primary key** uniquely identifies each row; a **foreign key** points at another table's primary key and is how relationships are expressed — an \`orderId\` column on \`order_items\` pointing at \`orders.id\`. PostgreSQL enforces both: you cannot insert an \`order_items\` row whose \`orderId\` does not exist in \`orders\`, and you cannot insert two rows with the same primary key.

## Constraints enforce invariants, not just intentions

Application code that "always validates before inserting" is not a substitute for a database constraint: a second service, a one-off script, a future contributor, or a bug anywhere upstream can all skip that validation, and the invariant only actually holds if the database itself refuses to store a row that violates it.

- **PRIMARY KEY** — unique and not null, one per table, usually the thing foreign keys point at.
- **UNIQUE** — no two rows share this value (or combination of values), but unlike a primary key a table can have several, and NULLs are allowed to repeat (two rows can both have a NULL in a UNIQUE column).
- **NOT NULL** — this column must always have a value.
- **CHECK** — an arbitrary boolean condition every row must satisfy, e.g. \`CHECK (quantity > 0)\`.
- **FOREIGN KEY** — this column's value must exist as a primary key (or unique value) in the referenced table.

## NULL means "unknown," not "empty" or "zero"

NULL is not a value — it is the *absence* of one, and it propagates through comparisons in ways that surprise people coming from general-purpose programming languages. \`NULL = NULL\` is not true, it is \`NULL\` (unknown) — which is why you write \`WHERE deleted_at IS NULL\`, not \`WHERE deleted_at = NULL\` (the latter matches nothing, ever, silently). \`NOT IN\` is the sharper trap: \`WHERE id NOT IN (SELECT user_id FROM banned_users)\` returns **zero rows** — not "everyone except banned users" — the moment \`banned_users.user_id\` contains even one NULL, because the whole \`IN\` list becomes unknown. Prefer \`NOT EXISTS\` for this kind of "excluding" query; it does not have this problem.

## ACID, briefly

- **Atomicity** — a transaction's statements all commit, or none do.
- **Consistency** — every committed state satisfies the schema's constraints.
- **Isolation** — concurrent transactions do not see each other's uncommitted work (how much isolation exactly is a tunable level — see the Database isolation and locking topic).
- **Durability** — once committed, a crash immediately after cannot lose the write.

## Money, and other precision-sensitive values

Never store money as \`FLOAT\`/\`DOUBLE\` — binary floating point cannot represent most decimal fractions exactly, and the rounding error compounds across enough additions to produce a ledger that does not balance. Use \`NUMERIC(precision, scale)\` (exact decimal arithmetic) or store integer cents/the smallest currency unit.

## Normalization, and denormalizing on purpose

Normalizing means storing each fact once, so an update cannot leave two copies disagreeing — a customer's name lives in \`customers\`, not copied onto every one of their orders. Denormalization (storing a fact more than once) is sometimes the right deliberate trade-off for read performance or for a historical snapshot that must *not* change later — an order row storing the product's price **at the time of purchase**, which should stay fixed even after the product's current price changes.

## Reading EXPLAIN ANALYZE

\`EXPLAIN\` shows the planner's intended plan; \`EXPLAIN ANALYZE\` actually runs the query and reports real timings and row counts alongside it. Read it bottom-up: the innermost nodes run first. A \`Seq Scan\` reads every row in the table — fine for a small table, a red flag on a large one filtered by a selective condition; an \`Index Scan\` or \`Index Only Scan\` uses an index instead. Compare "rows" (the planner's estimate) against "actual rows" — a wildly wrong estimate usually means statistics are stale (\`ANALYZE tablename\`) and the planner may be choosing a bad plan because of it.
`.trim(),
    realWorldExample: `
An inventory system needs products, warehouses and per-warehouse stock that must never go negative:

\`\`\`sql
CREATE TABLE products (
  id          bigserial PRIMARY KEY,
  sku         text NOT NULL UNIQUE,
  name        text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0)
);

CREATE TABLE warehouses (
  id   bigserial PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE stock (
  product_id   bigint NOT NULL REFERENCES products(id),
  warehouse_id bigint NOT NULL REFERENCES warehouses(id),
  quantity     integer NOT NULL CHECK (quantity >= 0),
  PRIMARY KEY (product_id, warehouse_id)
);
\`\`\`

\`quantity >= 0\` means the database itself refuses a write that would take stock negative — no application code, anywhere, can accidentally bypass it. The composite primary key \`(product_id, warehouse_id)\` makes "one stock row per product per warehouse" an invariant too, not just a convention.

**A query the primary key can't help with.** The composite primary key \`(product_id, warehouse_id)\` already indexes \`product_id\` — as its *leading* column. "Which products are low on stock in warehouse 7?" filters on \`warehouse_id\` instead:

\`\`\`sql
EXPLAIN ANALYZE
SELECT product_id, quantity FROM stock WHERE warehouse_id = 7 AND quantity < 10;
\`\`\`
\`\`\`
Seq Scan on stock (actual time=0.018..41.223 rows=812 loops=1)
  Filter: (warehouse_id = 7 AND quantity < 10)
\`\`\`
The primary key's index is sorted by \`product_id\` first, so a query that doesn't filter on \`product_id\` has no sorted prefix to jump to, and PostgreSQL falls back to scanning every row — a preview of the **leftmost-prefix rule**, which the joins and indexes topic covers in depth. Adding an index with \`warehouse_id\` as its own leading column fixes exactly this query:

\`\`\`sql
CREATE INDEX stock_warehouse_id_idx ON stock (warehouse_id);
\`\`\`
`.trim(),
    codeExample: `
-- Schema-level invariants: enforced for every writer, not just this app's code.
CREATE TABLE accounts (
  id             bigserial PRIMARY KEY,
  owner_user_id  text NOT NULL,
  balance_cents  bigint NOT NULL CHECK (balance_cents >= 0),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- NULL semantics: "no deletion date yet" is unknown, not empty — use IS NULL.
SELECT * FROM accounts WHERE owner_user_id = $1; -- fine, no NULL involved here
-- A column that CAN be NULL needs IS NULL / IS NOT NULL, never "= NULL":
-- SELECT * FROM sessions WHERE revoked_at IS NULL;   -- correct: still active
-- SELECT * FROM sessions WHERE revoked_at = NULL;    -- always zero rows, silently

-- Money as an exact integer type, never FLOAT/DOUBLE. Scoped by owner, not just id — the same
-- "fold ownership into the mutation itself" habit the Prisma ORM topic covers for updateMany:
UPDATE accounts
SET balance_cents = balance_cents - $1, updated_at = now()
WHERE id = $2 AND owner_user_id = $3 AND balance_cents >= $1; -- CHECK is the second line of defense

CREATE INDEX accounts_owner_user_id_idx ON accounts (owner_user_id);

-- EXPLAIN ANALYZE: did the planner use an index, and did its row estimate match reality?
EXPLAIN ANALYZE
SELECT * FROM accounts WHERE owner_user_id = 'user_123';
-- Index Scan using accounts_owner_user_id_idx on accounts
--   (actual time=0.028..0.031 rows=1 loops=1)
-- "rows" close to "actual rows" means the planner's statistics are current and trustworthy.
`.trim(),
    codeLanguage: "SQL",
    commonMistakes: `
- **\`WHERE column = NULL\`.** This matches nothing, ever — NULL is "unknown," and nothing is known to equal unknown. Use \`IS NULL\` / \`IS NOT NULL\`.
- **\`NOT IN\` against a column that can contain NULL.** One NULL in the subquery's results makes the entire \`NOT IN\` comparison unknown for every row, silently returning zero matches. Use \`NOT EXISTS\` for "exclude rows matching this" logic instead.
- **Storing money as FLOAT or DOUBLE.** Binary floating point cannot represent most decimal fractions exactly; the rounding error compounds. Use \`NUMERIC\` or integer cents.
- **Validating an invariant only in application code.** A constraint the database does not enforce is a suggestion, not a guarantee — the next script, migration, or service to touch that table can violate it.
- **Treating EXPLAIN's estimated "rows" as ground truth without running ANALYZE.** Stale table statistics (after a large bulk load, for instance) can make the planner choose a bad plan; \`ANALYZE tablename\` refreshes them.
- **Over-normalizing a value that must not change retroactively.** A snapshot like "the price the customer actually paid" belongs stored on the order row itself — looking it up live from the current product price is wrong the moment the product's price changes later.
`.trim(),
  },
};

const prismaTopic: SeedTopic = {
  slug: "prisma",
  title: "Prisma ORM",
  description: "Schema, migrations, querying relations, transactions and common pitfalls.",
  prerequisiteSlugs: ["postgres"],
  lesson: {
    slug: "essentials",
    title: "Prisma ORM: essentials",
    level: "INTERMEDIATE",
    estimatedMinutes: 18,
    summary:
      "Prisma generates a type-safe client from schema.prisma, but the type safety stops at the database boundary — N+1 queries, unscoped updates and a new client per request are all still possible mistakes it won't catch for you.",
    content: `
Prisma generates a type-safe client from \`schema.prisma\`.

- \`prisma migrate dev\` creates and applies migrations in development; \`prisma migrate deploy\` applies committed migrations in CI/production without generating new ones.
- \`select\` picks fields; \`include\` loads relations. Avoid N+1 loops — load related data in one query.
- \`findUnique\` returns \`null\` when nothing matches; \`update\` and \`delete\` throw (error code P2025).
- \`$transaction([...])\` runs independent operations atomically; interactive \`$transaction(async (tx) => ...)\` rolls back if the callback throws.
- In Next.js development, keep a single PrismaClient on \`globalThis\` so hot reloads do not exhaust connections.
`.trim(),
    explanation: `
## schema.prisma and migrations

\`schema.prisma\` is the single source of truth for your tables, generating both the SQL migrations and the TypeScript client. \`prisma migrate dev\` is a **development** command: it compares the schema against the database, generates a new migration file for the difference, and applies it — never run it against a database with real user data, since it can prompt to reset the database when it can't resolve drift. \`prisma migrate deploy\` only **applies already-committed migration files**, generating nothing new; it is the one safe to run in CI and production.

## Querying relations: select, include, and N+1

\`include\` loads a relation alongside the base row, in one additional query (or a JOIN, for some relations) — the fix for the classic **N+1 problem**: querying a list of orders, then looping over them and querying each order's items separately, is 1 + N queries instead of 2. \`select\` instead picks exactly which fields to return, including nested relation fields — \`select\` and \`include\` cannot both be used at the top level of the same query, but \`select\` can nest a relation's own \`select\`/\`include\` inside it when you need both field-trimming and a relation.

## Errors: null vs thrown

\`findUnique\` and \`findFirst\` return \`null\` when nothing matches — an expected, ordinary outcome you check with an \`if\`. \`update\` and \`delete\` instead **throw** (Prisma error code \`P2025\`) when their \`where\` matches no row, because they assume the row exists; code that calls \`update\`/\`delete\` on an id the caller supplied needs to either catch \`P2025\` or use \`updateMany\`/\`deleteMany\`, which match zero rows silently and return a \`count\` instead of throwing — often the better choice precisely because it lets you fold an ownership check into the \`where\` clause without needing a separate catch block.

## Transactions, briefly

\`prisma.$transaction([...])\` (the array form) runs a fixed, pre-built list of independent operations atomically. \`prisma.$transaction(async (tx) => { ... })\` (the interactive form) lets later operations depend on earlier results within the same callback, and rolls back automatically if the callback throws. The Transactions and rollback topic goes deeper into when you need one and how to keep it safe.

## One PrismaClient per process

Creating a \`new PrismaClient()\` per request opens a new connection pool each time; under load (or during Next.js's development hot-reloading, which re-runs module code on every save) this exhausts the database's connection limit. Create one instance and reuse it — in development, cached on \`globalThis\` so a hot reload finds the existing one instead of creating another.
`.trim(),
    realWorldExample: `
A user's "My Orders" page needs each order with its line items — a textbook N+1 opportunity if written carelessly.

**The N+1 version** (one query for orders, then one more *per order*):
\`\`\`ts
const orders = await db.order.findMany({ where: { userId } });
for (const order of orders) {
  order.items = await db.orderItem.findMany({ where: { orderId: order.id } }); // N extra queries
}
\`\`\`
50 orders means 51 round trips to the database for one page load.

**The fixed version** loads everything in one query with \`include\`, and scopes the whole thing to the signed-in user at the same time:
\`\`\`ts
const orders = await db.order.findMany({
  where: { userId }, // ownership, not just existence
  include: { items: true },
  orderBy: { createdAt: "desc" },
});
\`\`\`
Two queries in total, however many orders there are — one for the orders, one batched query for all of their items (\`include\` does not compile this into a SQL JOIN by default) — and \`db.order.findMany\` only ever returns rows that already belong to \`userId\`, so there is no separate "is this mine?" step to forget.
`.trim(),
    codeExample: `
import { NextResponse } from "next/server";

// GET /api/orders — one query for the list and its items, scoped to the caller.
export async function GET(req: Request) {
  const userId = await requireUserId(req);
  const orders = await db.order.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}

// DELETE /api/orders/[id] — Next.js 15: params is a Promise.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId(req);

  // deleteMany, not delete: folds the ownership check into the WHERE clause itself, so there is
  // no separate "does this exist, and is it mine?" read to race against — and it returns a count
  // (0 or 1) instead of throwing P2025 when the row doesn't exist or belongs to someone else.
  const { count } = await db.order.deleteMany({ where: { id, userId } });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **A new \`PrismaClient\` per request.** Each instance opens its own connection pool; under load (or Next.js dev hot-reload) this exhausts the database's connection limit. Create one instance and reuse it.
- **N+1 queries from looping over a list to fetch each row's relation.** Use \`include\` (or a nested \`select\`) to load it in one query instead.
- **Calling \`update\`/\`delete\` with just \`{ id }\` in \`where\`, trusting a separate check earlier to have confirmed ownership.** That separate check can race with a concurrent request, or simply be missing on some code path. Fold the ownership condition into the same \`where\` (or use \`updateMany\`/\`deleteMany\`) so there is nothing to forget.
- **Assuming \`update\`/\`delete\` return \`null\` for a missing row, like \`findUnique\` does.** They throw \`P2025\` instead — catch it, or switch to the \`*Many\` form, which returns a count.
- **Running \`prisma migrate dev\` against a database with real data.** It is a development command that can decide to reset the database to resolve drift it can't express as a migration. Production and CI use \`prisma migrate deploy\`, which only applies already-committed migrations.
- **Mixing \`select\` and \`include\` at the same level.** Prisma rejects that combination; nest the relation inside \`select\` instead if you also need to trim fields.
`.trim(),
  },
};

const joinsIndexesTopic: SeedTopic = {
  slug: "joins-indexes",
  title: "Database joins, indexes, and constraints",
  description: "Join types, B-tree indexes, composite index order and constraint trade-offs.",
  prerequisiteSlugs: ["postgres"],
  lesson: {
    slug: "essentials",
    title: "Database joins, indexes, and constraints: essentials",
    level: "INTERMEDIATE",
    estimatedMinutes: 18,
    summary:
      "An index only helps the queries whose filtering and ordering match its leading columns — and the join type you pick decides whether rows with no match disappear or show up as NULLs.",
    content: `
- **INNER JOIN** keeps matching rows only; **LEFT JOIN** keeps every left row and fills missing right columns with NULL.
- A B-tree index speeds up equality, range and ORDER BY on its leading columns, at the cost of extra writes and storage.
- Composite index \`("customerId", "createdAt")\` serves \`WHERE "customerId" = ?\` and \`WHERE "customerId" = ? ORDER BY "createdAt"\` well; a filter on a column outside the index cannot use it.
- Wrapping an indexed column in a function (\`lower(email)\`) needs an **expression index**.
- Foreign keys choose what happens on delete: the default NO ACTION/RESTRICT pairing (refuse), CASCADE (delete too), or SET NULL — pick deliberately.
`.trim(),
    explanation: `
## Join types

- **INNER JOIN** keeps only rows that match on both sides — a customer with zero orders disappears from the result entirely.
- **LEFT JOIN** keeps every row from the left table, filling the right side's columns with NULL where there is no match — the customer with zero orders still appears, with NULL order columns.
- **RIGHT JOIN** is the mirror image (keep every right-table row); in practice most people just swap table order and use LEFT JOIN instead.
- **FULL JOIN** keeps every row from both sides, matched where possible.

Picking INNER where you meant LEFT is one of the most common correctness bugs in reporting queries — "customers with no orders" silently vanishes, and the bug is invisible until someone asks why the count looks low.

## How a B-tree index actually helps

PostgreSQL's default index type, B-tree, keeps values in sorted order, so it can jump straight to a range instead of scanning every row. That makes it useful for **equality** (\`WHERE id = $1\`), **range** (\`WHERE created_at > $1\`) and **ORDER BY** on its columns — but it does not help \`!=\`, and it generally does not help \`LIKE '%term%'\` (a leading wildcard), since there is no sorted prefix to jump to.

Every index also has a cost: it must be updated on every INSERT/UPDATE/DELETE that touches its columns, and it takes disk space. An index that no query's WHERE/ORDER BY ever uses is pure overhead.

## Composite indexes and the leftmost-prefix rule

A composite index \`("customerId", "createdAt")\` is really one sorted structure, sorted first by \`"customerId"\`, then by \`"createdAt"\` within each \`"customerId"\`. It serves:
- \`WHERE "customerId" = ?\` — uses the first column alone.
- \`WHERE "customerId" = ? ORDER BY "createdAt"\` — uses both, in order: it can jump to the right \`"customerId"\` and the rows are already sorted by \`"createdAt"\` from there.

It does **not** help \`WHERE "createdAt" > ?\` alone — skipping the leading column breaks the "sorted prefix" the index relies on, the same way you cannot usefully binary-search a phone book by first name when it is sorted by last name. This is the leftmost-prefix rule: a composite index helps a query only if that query filters (or sorts) on a prefix of the index's column list, left to right.

## Expression indexes

Wrapping an indexed column in a function — \`WHERE lower(email) = lower($1)\`, to do a case-insensitive lookup — defeats a plain index on \`email\`, because the index is sorted by the *raw* column, not by \`lower(email)\`. An **expression index**, \`CREATE INDEX ON users (lower(email))\`, indexes the function's output instead, and a query using that exact expression can use it again.

## Constraints: picking ON DELETE deliberately

A foreign key's \`ON DELETE\` behavior decides what happens to dependent rows when the referenced row is deleted:
- **NO ACTION** (the actual default if you write nothing) — refuse the delete while dependent rows exist, checked at the end of the statement (or the whole transaction, if the constraint is declared \`DEFERRABLE INITIALLY DEFERRED\`). Undeferred, this behaves identically to RESTRICT.
- **RESTRICT** — the same refusal, checked immediately, and it cannot be deferred even if you wanted it to be.
- **CASCADE** — delete the dependent rows too.
- **SET NULL** — keep the dependent rows, but null out the foreign key column (the column must allow NULL).

Each is a real product decision, not a default to accept unthinkingly: CASCADE on \`orders\` referencing \`users\` would silently destroy a customer's order history the moment an admin deletes their account.
`.trim(),
    realWorldExample: `
A "my orders" page joins \`orders\` to \`customers\`, filtered to one customer and sorted newest-first. Without the right index:

\`\`\`sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE "customerId" = 42 ORDER BY "createdAt" DESC LIMIT 20;
\`\`\`
\`\`\`
Limit (actual time=812.447..812.451 rows=20 loops=1)
  -> Sort (actual time=812.440..812.449 rows=20 loops=1)
       Sort Key: "createdAt" DESC
       -> Seq Scan on orders (actual time=0.015..801.223 rows=14022 loops=1)
            Filter: ("customerId" = 42)
\`\`\`
At 20 million rows, that sequential scan dominates the response time. Adding the composite index that matches exactly this query's filter-then-sort shape:

\`\`\`sql
CREATE INDEX orders_customerId_createdAt_idx ON orders ("customerId", "createdAt" DESC);
\`\`\`

turns the plan into an \`Index Scan\` that jumps straight to \`"customerId" = 42\`'s rows, already sorted — milliseconds instead of hundreds of them, and the improvement gets *larger*, not smaller, as the table grows.

**A join that changes the answer, not just the speed.** "List every customer with their order count, including customers who haven't ordered yet" needs LEFT JOIN, not INNER JOIN:
\`\`\`sql
SELECT c.id, c.name, count(o.id) AS "orderCount"
FROM customers c
LEFT JOIN orders o ON o."customerId" = c.id
GROUP BY c.id, c.name;
\`\`\`
Switching this to INNER JOIN would make every zero-order customer vanish from the report instead of showing \`"orderCount" = 0\`.
`.trim(),
    codeExample: `
-- Composite index matching a real per-user, time-ordered query (leftmost-prefix rule):
CREATE INDEX orders_userId_createdAt_idx ON orders ("userId", "createdAt" DESC);
-- Serves: WHERE "userId" = $1                           (leading column alone)
-- Serves: WHERE "userId" = $1 ORDER BY "createdAt" DESC  (both columns, in order)
-- Does NOT serve: WHERE "createdAt" > $1 alone — skips the leading column.

-- Case-insensitive lookup needs an expression index, not a plain one:
CREATE INDEX users_email_lower_idx ON users (lower(email));
SELECT * FROM users WHERE lower(email) = lower($1); -- now uses the expression index

-- INNER vs LEFT changes the answer, not just the plan:
SELECT c.id, c.name, count(o.id) AS "orderCount"   -- LEFT: zero-order customers appear, count 0
FROM customers c
LEFT JOIN orders o ON o."customerId" = c.id
GROUP BY c.id, c.name;

-- Foreign key ON DELETE is a product decision, not a default to accept blindly:
ALTER TABLE orders
  ADD CONSTRAINT orders_customerId_fkey
  FOREIGN KEY ("customerId") REFERENCES customers(id)
  ON DELETE RESTRICT; -- refuse to delete a customer who still has orders (same as the NO ACTION default here)
`.trim(),
    codeLanguage: "SQL",
    commonMistakes: `
- **Assuming a composite index helps any query that mentions its columns.** The leftmost-prefix rule means \`(a, b)\` helps \`WHERE a = ?\` and \`WHERE a = ? AND b = ?\`, but not \`WHERE b = ?\` alone — the leading column must be in the filter for the index to be usable at all.
- **Wrapping an indexed column in a function and expecting the plain index to still apply.** \`lower(email)\`, \`date(created_at)\` and similar need a matching expression index.
- **Adding an index for every column that ever appears in a WHERE clause.** Each index slows down every write that touches it and takes storage; index the queries that actually run often or run slow, not every theoretical filter.
- **Using INNER JOIN where the question is "...including ones with none."** It silently drops the non-matching side instead of raising an error, so the bug shows up as "the count looks low," not a crash.
- **Not indexing foreign key columns.** PostgreSQL does not automatically index the referencing column of a foreign key (only the referenced primary key on the other side) — joins and ON DELETE CASCADE checks on an un-indexed FK column scan the whole table.
- **Picking CASCADE for "convenience" without thinking through what it destroys.** A CASCADE from \`users\` to \`orders\` means deleting a user silently deletes their entire order history; sticking with the NO ACTION/RESTRICT default, or SET NULL, is often the safer choice.
`.trim(),
  },
};

const transactionsTopic: SeedTopic = {
  slug: "transactions",
  title: "Transactions and rollback",
  description: "Atomic multi-step writes, rollback, savepoints and keeping transactions short.",
  prerequisiteSlugs: ["postgres", "prisma"],
  lesson: {
    slug: "essentials",
    title: "Transactions and rollback: essentials",
    level: "INTERMEDIATE",
    estimatedMinutes: 20,
    summary:
      "A transaction guarantees several statements commit together or not at all — it does not, by itself, make a check-then-act sequence race-safe; that still needs an atomic condition or a lock.",
    content: `
A transaction groups statements so they all commit or none do.

- Use one whenever several writes must stay consistent (debit + credit, order + stock movement).
- After an error inside a PostgreSQL transaction block, every further statement fails until you ROLLBACK (or roll back to a savepoint).
- Keep transactions short: no network calls to payment providers or email services inside them — they hold locks and connections while waiting.
- For "write to DB and then notify another system", use the **transactional outbox**: insert an event row in the same transaction and publish it afterwards.
`.trim(),
    explanation: `
## What a transaction guarantees

A transaction groups statements so that either all of them commit, or none do — the "A" in ACID. Use one whenever several writes must stay consistent with each other: debiting one account and crediting another, or creating an order alongside the stock movement that reserves it. Without a transaction, a crash or an error between the two writes leaves the database in a state that should have been impossible.

## Aborted transactions: nothing works until ROLLBACK

In PostgreSQL, once *any* statement inside a transaction block fails, the whole transaction enters an **aborted** state: every further statement — even an unrelated \`SELECT\` — fails with "current transaction is aborted, commands ignored until end of transaction block," until you issue \`ROLLBACK\`. A \`SAVEPOINT\` creates a point you can roll back to without abandoning the whole transaction, useful when one sub-step is allowed to fail without discarding everything before it.

## Keep transactions short

A transaction holds locks and a database connection for its entire duration. Never make a network call — a payment provider, an email send, any external API — from inside one: a slow or hanging upstream call now holds those locks open for however long it takes to time out, which can stall or deadlock every other transaction waiting on the same rows.

## The transactional outbox, for side effects you can't put in the transaction

"Write to the database, then notify another system" has an inherent gap: if the write commits and the notification fails (or vice versa), the two are now out of sync. The **transactional outbox** pattern closes it: insert an event row in the *same* transaction as the write, then have a separate process read unpublished rows and send them, retrying until it marks them sent. The notification can now only be "sent for a write that really committed" or "not yet sent" — never "sent for a write that got rolled back."

## Prisma's two forms

\`prisma.$transaction([...])\` (the array form) takes a fixed list of already-built operations and runs them atomically — useful when there is no decision to make between them. \`prisma.$transaction(async (tx) => { ... })\` (the interactive form) runs a callback that can read a result and use it to decide the next write, and rolls back automatically the moment the callback throws — there is no separate commit/rollback call to remember. It also **times out after 5 seconds by default** (configurable via a \`timeout\` option): long enough for database work, not for a network call it should never contain anyway.

Catching the thrown error *inside* the callback doesn't behave the same way every time — it depends on what actually failed. If it was your own business-logic throw (like \`OutOfStockError\` below) and no SQL statement before it had failed, catching it there and returning normally does cancel the rollback: Prisma commits whatever writes already ran in the callback, which is rarely what you want. But if the error came from a failed *SQL statement* — a constraint violation, for instance — PostgreSQL has already put the transaction into its aborted state (see above): every later statement, including the implicit commit, fails too, so catching it inside the callback doesn't rescue anything either. Either way, the safe habit is the same: let the callback's error propagate, and handle it in the \`try\`/\`catch\` around the \`$transaction\` call itself, not inside the callback.

## A transaction is not, by itself, a fix for a race condition

Wrapping a "read the current value, decide in application code, then write" sequence in a transaction does not make it safe under concurrency on its own. PostgreSQL's default isolation level, READ COMMITTED, lets another committed transaction's write land in the gap between your read and your write — two concurrent "reserve the last unit of stock" transactions can each read \`quantity: 1\`, each decide "that's enough," and both commit a decrement, taking stock negative. The fix is to make the *write itself* enforce the condition — \`UPDATE stock SET quantity = quantity - 1 WHERE id = $1 AND quantity >= 1\` and checking the affected row count — or to take a row lock with \`SELECT ... FOR UPDATE\` first. The Concurrency and race conditions topic covers this check-then-act failure mode in depth, and Database isolation and locking covers the isolation levels and locking primitives behind it.
`.trim(),
    realWorldExample: `
Placing an order must create the order and decrement stock together, and must not oversell when two customers race for the last unit.

**Unsafe:** reading stock, deciding in application code, then writing — a classic check-then-act race:
\`\`\`ts
const stock = await db.stock.findUnique({ where: { productId } });
if (stock.quantity < quantity) throw new Error("Out of stock");
// Another request can run this exact sequence in the gap right here.
await db.stock.update({ where: { productId }, data: { quantity: stock.quantity - quantity } });
\`\`\`
Two requests can both pass the \`if\`, both read the same \`quantity\`, and both commit a decrement — stock goes negative even though every individual check looked correct.

**Safe:** one interactive transaction whose UPDATE enforces the invariant in its own WHERE clause, so there is no separate decision step to race against:
\`\`\`ts
const order = await db.$transaction(async (tx) => {
  const reserved = await tx.stock.updateMany({
    where: { productId, quantity: { gte: quantity } }, // the condition IS the write
    data: { quantity: { decrement: quantity } },
  });
  if (reserved.count === 0) throw new Error("Out of stock"); // rolls the transaction back
  return tx.order.create({ data: { userId, productId, quantity } });
});
\`\`\`
If the \`WHERE\` clause doesn't match (not enough stock left), \`updateMany\` updates zero rows, the thrown error rolls back the whole transaction, and no order is created for stock that was never actually reserved.
`.trim(),
    codeExample: `
import { NextResponse } from "next/server";
import { z } from "zod";

const placeOrderSchema = z.object({
  productId: z.string().min(1),
  // Positive, with a cap: a negative quantity would turn "decrement: quantity" into an
  // increment, manufacturing stock instead of reserving it, and an absurdly large one would
  // let a single request drain the whole warehouse.
  quantity: z.number().int().positive().max(100),
});

class OutOfStockError extends Error {}

// POST /api/orders — reserve stock and create the order atomically; the WHERE clause on the
// stock update, not a prior read, is what actually prevents overselling under concurrency.
export async function POST(req: Request) {
  const userId = await requireUserId(req);
  const parsed = placeOrderSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { productId, quantity } = parsed.data;

  try {
    const order = await db.$transaction(async (tx) => {
      const reserved = await tx.stock.updateMany({
        where: { productId, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      });
      if (reserved.count === 0) throw new OutOfStockError();
      return tx.order.create({ data: { userId, productId, quantity } }); // scoped to the caller
    });
    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    if (err instanceof OutOfStockError) return NextResponse.json({ error: "Out of stock" }, { status: 409 });
    throw err; // never swallowed: a real failure must still surface as one
  }
}
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Calling an external service — payment, email, any network call — from inside a transaction.** It holds locks and a connection for however long that call takes, including a hang or timeout, blocking every other transaction waiting on the same rows. Commit first, then act, or use a transactional outbox.
- **Wrapping a check-then-act read-decide-write sequence in a transaction and assuming that alone makes it race-safe.** It doesn't — READ COMMITTED still lets another transaction's write land between your read and your write. Make the write's own WHERE clause enforce the condition, or take a row lock first.
- **Catching an error inside Prisma's interactive \`$transaction(async (tx) => ...)\` callback and returning normally.** If it was your own thrown business-logic error, this commits whatever writes already ran instead of rolling them back. If it came from a failed SQL statement, PostgreSQL has already aborted the transaction — every later statement, including the commit, still fails, so catching it there doesn't rescue anything either. Let it propagate and handle it outside the callback.
- **Not knowing that one failed statement aborts the whole transaction.** Every later statement — even an unrelated read — fails until \`ROLLBACK\`, or until you roll back to a \`SAVEPOINT\` taken before the failure.
- **Keeping a transaction open while waiting on something unrelated** (user input, a slow computation). Long-held locks increase the odds of blocking, or deadlocking, another transaction — and Prisma's interactive \`$transaction\` only tolerates this for 5 seconds by default before timing out on its own.
- **Reaching for the sequential \`$transaction([...])\` array form when a later step depends on an earlier result.** It runs a fixed list of pre-built operations — it cannot express "decide the next query from this query's result." Use the interactive callback form instead.
`.trim(),
  },
};

const paginationTopic: SeedTopic = {
  slug: "pagination",
  title: "Pagination, filtering, and sorting",
  description: "Offset vs cursor pagination, stable ordering and safe query parameters.",
  prerequisiteSlugs: ["rest", "joins-indexes"],
  lesson: {
    slug: "essentials",
    title: "Pagination, filtering, and sorting: essentials",
    level: "INTERMEDIATE",
    estimatedMinutes: 18,
    summary:
      "Offset pagination re-walks and discards rows on every deep page; cursor pagination resumes from an index position instead — and both still need a unique tiebreaker, or ties make the order, and the pages, nondeterministic.",
    content: `
- **Offset** (\`LIMIT 20 OFFSET 400\`) is simple and supports page numbers, but deep pages get slower and concurrent inserts shift rows (duplicates or skipped items).
- **Cursor/keyset** (\`WHERE ("createdAt", id) < ($1, $2) ORDER BY "createdAt" DESC, id DESC LIMIT 20\`) stays fast at any depth and is stable under inserts.
- Always sort by a unique tiebreaker (usually id) so order is deterministic.
- Whitelist sortable/filterable fields and cap the page size.
`.trim(),
    explanation: `
## Offset pagination, and why deep pages get slow

\`LIMIT 20 OFFSET 400\` is simple to implement and lets a UI jump straight to "page 21" — but PostgreSQL still has to walk past and discard the first 400 matching rows before it can return the next 20. On a small table this is free; on a large one, \`OFFSET 400000\` means stepping past 400,000 rows every single time that page is requested, and the cost keeps growing the deeper a user pages.

## Cursor (keyset) pagination

Cursor pagination carries forward the sort key of the last row the client saw, and asks for rows strictly after it:
\`\`\`sql
WHERE ("createdAt", id) < ($1, $2)
ORDER BY "createdAt" DESC, id DESC
LIMIT 20;
\`\`\`
With a matching index on \`("createdAt", id)\`, this is an index scan that jumps straight to the right position — page 1 and page 5,000 cost the same, because there is no "walk past N rows" step at all. The trade-off is real: a cursor can only move forward or backward from where it is, not jump to an arbitrary page number.

## The tiebreaker: why ORDER BY needs more than one column

Rows are not stored in any guaranteed order; \`ORDER BY "createdAt"\` alone leaves ties — two rows with an identical timestamp — in an order PostgreSQL does not promise to keep stable between queries. Appending a unique column, usually \`id\`, as a second sort key (\`ORDER BY "createdAt" DESC, id DESC\`) makes the order total and deterministic — both offset and cursor pagination need this for the same reason: without it, a row can silently repeat on one page and vanish from another just because two timestamps tied.

## Keeping pages stable under concurrent writes

Offset pagination has a second problem cursor pagination doesn't: rows inserted or deleted between two page requests shift every row after them. A new row inserted at the top before the user loads page 2 pushes page 1's last row into page 2's results — the user sees it twice. A row deleted has the opposite effect: one row is silently never shown. Cursor pagination is immune to this — "everything after this exact key" doesn't shift just because something was inserted or deleted elsewhere in the list.

## Validating and whitelisting query parameters

A sort or filter field taken directly from the query string is a double risk: a field name an attacker controls is an injection vector the moment it's concatenated rather than parameterized, and an unindexed sort column an attacker picks turns an ordinary request into an expensive one. Accept only a fixed whitelist of sort fields (each mapped to a known column and a supporting index, never the raw string), validate filter values against a schema, and cap the page size server-side — a client-supplied \`limit=50000\` should be clamped, not honored.

## The cursor itself: opaque by convention, not a security boundary

Base64 (or any similar encoding) is **encoding, not protection** — a client can decode it, read the last row's sort key and id in plain text, change them, and re-encode a cursor of its own choosing. Treating the cursor as opaque (the client echoes it back unchanged rather than constructing one) is still worth doing, but for a different reason: it keeps the internal format free to change later, not because it stops tampering. Authorization never comes from the cursor — it comes from the \`userId\` condition in the query's own \`WHERE\` clause, which applies identically no matter what a forged cursor claims, so a client that can forge any cursor value still can't see anyone else's rows. If tampering with a cursor's *contents* would matter for some other reason, sign it — an HMAC over the encoded value, verified before it's ever decoded — rather than relying on encoding alone.
`.trim(),
    realWorldExample: `
A customer's "my orders" page used \`GET /api/orders?page=21\` → \`LIMIT 20 OFFSET 400\`. A payment webhook inserted three new orders for that same customer between the customer loading page 1 and page 21 — webhooks can land at any time. Page 21 now starts three rows earlier than it should, and three orders the customer already saw on an earlier page show up again.

Switching to a cursor fixes the shifting-page problem, and scoping it by \`"userId"\` means it can never return another customer's orders either:
\`\`\`sql
SELECT id, total, "createdAt"
FROM orders
WHERE "userId" = $1 AND ("createdAt", id) < ($2, $3)
ORDER BY "createdAt" DESC, id DESC
LIMIT 20;
\`\`\`
This needs a composite index with \`"userId"\` leading — the leftmost-prefix rule from the joins and indexes topic:
\`\`\`sql
CREATE INDEX orders_userId_createdAt_id_idx ON orders ("userId", "createdAt" DESC, id DESC);
\`\`\`
Without it, PostgreSQL has to scan every order in the table and filter by \`"userId"\` before it can even start applying the cursor condition.
`.trim(),
    codeExample: `
import { NextResponse } from "next/server";
import { z } from "zod";

const listOrdersSchema = z.object({
  cursor: z.string().optional(), // opaque by convention — the client echoes it back, never builds one
  limit: z.coerce.number().int().positive().max(50).default(20), // never trust a client-supplied limit uncapped
});

// Decoding is reversible (it's base64, not encryption), so a client can hand back anything —
// validate the decoded shape before it ever reaches Prisma, or a malformed cursor becomes an
// Invalid Date silently passed into the query instead of a clean 400.
const cursorSchema = z.object({ createdAt: z.string().datetime(), id: z.string().min(1) });

function decodeCursor(cursor: string) {
  const [createdAt, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const parsed = cursorSchema.safeParse({ createdAt, id });
  return parsed.success ? { createdAt: new Date(parsed.data.createdAt), id: parsed.data.id } : null;
}
function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(\`\${createdAt.toISOString()}|\${id}\`).toString("base64url");
}

// GET /api/orders?cursor=...&limit=20 — cursor-paginated, scoped to the caller.
export async function GET(req: Request) {
  const userId = await requireUserId(req);
  const { searchParams } = new URL(req.url);
  const parsed = listOrdersSchema.safeParse({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { cursor, limit } = parsed.data;
  const after = cursor ? decodeCursor(cursor) : null;
  if (cursor && !after) return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });

  const orders = await db.order.findMany({
    where: {
      userId, // ownership folded into the query, not checked afterwards
      ...(after
        ? { OR: [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } }] }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1, // one extra row, only to learn whether another page exists
  });

  const hasMore = orders.length > limit;
  const items = orders.slice(0, limit);
  const last = items.at(-1);
  return NextResponse.json({ items, nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null });
}
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Assuming offset pagination is "fine" because it's simple** — until page depth or write concurrency makes it slow, or outright wrong, with rows repeating or vanishing as data shifts underneath an \`OFFSET\`.
- **\`ORDER BY\` with no unique tiebreaker.** Ties leave row order — and therefore page contents — nondeterministic across requests.
- **Trusting a client-supplied \`limit\` without capping it.** An unbounded value turns one request into "return the whole table."
- **Letting a client pick the sort column from an unvalidated string.** An unindexed choice makes an ordinary request expensive, and interpolating it directly into raw SQL is an injection path.
- **Treating a cursor's opacity as a security control.** Base64 (or similar) is encoding, not protection — a client can decode and forge one. That's fine as long as the query's own ownership condition (e.g. \`userId = $1\`) is unconditional and never depends on anything the cursor claims; if cursor tampering would matter on its own, sign it (HMAC) instead of just encoding it.
- **Passing a decoded cursor straight into a query without validating its shape.** A malformed or tampered cursor can decode into an Invalid Date or a garbage id — validate it and return 400, rather than letting it reach the database as a confusing runtime error.
- **Forgetting to fold ownership into the paginated query's own \`WHERE\` clause.** Checking it once, somewhere earlier, risks a later page silently returning rows that were never the caller's.
`.trim(),
  },
};

const cachingTopic: SeedTopic = {
  slug: "caching",
  title: "Caching and Redis concepts",
  description: "Cache-aside, TTLs, invalidation, stampedes and Redis data structures.",
  prerequisiteSlugs: ["http"],
  lesson: {
    slug: "essentials",
    title: "Caching and Redis concepts: essentials",
    level: "INTERMEDIATE",
    estimatedMinutes: 18,
    summary:
      "Cache-aside buys read speed by risking staleness — every value needs both a TTL (the safety net) and an explicit invalidation path (the fast path), and a hot key's expiry can turn into a database-collapsing stampede if nothing coalesces the requests that miss at the same moment.",
    content: `
- **Cache-aside**: read from cache; on miss, read the database and populate the cache with a TTL. On writes, update the database and delete (or update) the cache entry.
- Every cached value needs an expiry and an invalidation story; stale data is the main cost of caching.
- **Stampede**: when a hot key expires, many requests hit the database at once. Mitigate with request coalescing/locks, early refresh and jittered TTLs.
- Cache keys must include everything that changes the result — especially the user id for per-user data.
- Redis offers strings, hashes, lists, sets and sorted sets (great for leaderboards and rate limiting).
`.trim(),
    explanation: `
## Cache-aside: the default pattern

Cache-aside (lazy loading) puts the application in charge of the cache, one key at a time: on a read, check the cache first; on a miss, read the database, write the result into the cache with a TTL, and return it. On a write, update the database, then remove (or update) the cached entry so the next read repopulates it. Redis never talks to the database directly in this pattern — the app always mediates.

## TTL is the safety net, invalidation is the fast path

Every cached value should carry a TTL even when you also invalidate explicitly on writes: invalidation can be missed — a write path you forgot about, a bug, a failed delete that never got retried — and a TTL bounds how long a miss like that can serve wrong data, instead of forever. Pick the TTL from how stale the data may acceptably be: seconds for a price, much longer for configuration that rarely changes.

## A race invalidation alone can't close

Even with invalidation wired up correctly on every write path, one race slips through it: a reader that already missed the cache and read the *old* value from the database — but hasn't written it into the cache yet — can have that write land *after* a concurrent writer's \`DEL\`, repopulating the cache with the exact stale value the writer just tried to clear. Nothing in cache-aside itself closes this gap; it's precisely why the TTL from the previous section still matters even when every invalidation path is correct — the value this race reintroduces still expires on its own, instead of lingering indefinitely.

## Cache stampedes

Cache-aside has a real failure mode of its own: when a hot key expires (or the whole cache restarts empty), every concurrent request misses at the same moment, and all of them hit the database to rebuild the same value — a stampede that can look just like an outage, because a database sized for cache-hit traffic was never meant to serve that volume of reads at once. Mitigate it with request coalescing (a short lock, or an in-process promise cache, so only one request per key rebuilds it while others wait for that result), a proactive refresh before the TTL actually expires, and jittered TTLs so many keys don't expire in the same instant.

## Cache keys must encode everything that changes the result

A cache key has to include every input that affects what gets returned — most importantly the user id for anything personal. A key like \`"me"\` for a \`GET /api/me\` response is wrong the moment a second user's request hits it: whoever populated the key first is served to everyone else until it expires, which is a data leak, not just a performance bug. The safe shape folds every distinguishing input into the key itself, e.g. \`user:\${userId}:profile\`.

## Redis data structures, briefly

Redis is not just a key-value string store: sorted sets (\`ZADD\`/\`ZRANGE\`) keep members ordered by score, the natural fit for a leaderboard; plain sets (\`SADD\`) track unique membership; lists (\`LPUSH\`/\`BRPOP\`) or streams back a simple queue. Picking the structure that matches the access pattern lets Redis do the ordering or deduplication on the server, instead of pulling everything into the app to sort or dedupe in memory.

## Caching personal data

A value cached in Redis for your own app's use is a different layer from HTTP-level caching (\`Cache-Control\`, covered in the HTTP fundamentals topic) — but the same rule applies to both: personal data must never end up somewhere a different user's request could read it, whether that's a shared \`Cache-Control: public\` response or a Redis key that forgot to include the user id.
`.trim(),
    realWorldExample: `
A product page caches each product's price to avoid hitting PostgreSQL on every view:
\`\`\`ts
async function getProductPrice(productId: string) {
  const cached = await redis.get(\`product:\${productId}:price\`);
  if (cached !== null) return Number(cached);

  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) return null; // a missing product is a 404 for the caller to return, not a 500

  await redis.set(\`product:\${productId}:price\`, product.priceCents, { EX: 300 }); // TTL: the safety net
  return product.priceCents;
}
\`\`\`
Updating the price must also invalidate the cache, in the same code path, after the write commits:
\`\`\`ts
async function updateProductPrice(productId: string, priceCents: number) {
  await db.product.update({ where: { id: productId }, data: { priceCents } });
  await redis.del(\`product:\${productId}:price\`); // after the commit, not before
}
\`\`\`
Without that \`del\`, the cached price is only ever corrected by its 300-second TTL — a customer can see a stale price for up to five minutes after an admin changes it. There's a subtler race here too: a request that missed the cache moments earlier, read the *old* price, and is only now finishing its own \`redis.set\` can have that write land *after* this \`del\` — reintroducing the stale price right after it was cleared. That race is why the 300-second TTL still matters even with invalidation done correctly: the reintroduced value expires on its own instead of lingering. And even setting that aside, **checkout must still re-read the price from the database**, never from the cache: a cache is a performance optimization for reads a slightly-stale answer doesn't hurt; a charge is not one of those reads.

**A key that's wrong for a different reason.** Caching a personalized response under a key that doesn't vary per user — \`redis.set("me", JSON.stringify(profile))\` for \`GET /api/me\` — serves the first caller's profile to every other caller until the key expires. The fix is folding the user id into the key itself: \`user:\${userId}:profile\`.
`.trim(),
    codeExample: `
import { NextResponse } from "next/server";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().min(1) });

// Per-instance only: a multi-instance deployment needs a shared lock (e.g. Redis SETNX),
// not a local Map, to actually coalesce requests landing on different instances.
const pending = new Map<string, Promise<number | null>>();

// GET /api/products/[id] — cache-aside, with single-flight coalescing so a hot key's expiry
// triggers one rebuild per instance, not a stampede of concurrent database reads for it.
async function getPriceCoalesced(productId: string) {
  const key = \`product:\${productId}:price\`;
  const cached = await redis.get(key);
  if (cached !== null) return Number(cached);

  const inFlight = pending.get(key);
  if (inFlight) return inFlight; // another request on this instance is already rebuilding this key

  const rebuild = (async () => {
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) return null; // a missing product is a 404 for the route handler, not a 500
    await redis.set(key, product.priceCents, { EX: 300 });
    return product.priceCents;
  })().finally(() => pending.delete(key));

  pending.set(key, rebuild);
  return rebuild;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid product id" }, { status: 400 });

  const priceCents = await getPriceCoalesced(parsed.data.id);
  if (priceCents === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ priceCents });
}
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Treating cache-aside as handling writes on its own.** The pattern is a convention your code has to apply at every write path; miss one, and that corner silently serves stale data until its TTL (if any) expires.
- **Caching a personalized response under a key that doesn't vary per caller.** A fast way to serve one user's private data to another.
- **Setting no TTL at all because "we invalidate everywhere."** Invalidation gets missed in practice; a TTL is the backstop for exactly that.
- **Treating the cache as the source of truth for something that must be exactly right.** A cached price is fine for display, never for the amount actually charged.
- **Letting a hot key's expiry hit the database with every concurrent request at once.** A stampede that looks like a database outage, with no coalescing, early refresh, or jitter to spread it out.
- **Assuming a single-process, in-memory stampede guard protects a multi-instance deployment.** Each instance still has its own gap; only a shared lock (e.g. Redis) closes it across all of them.
`.trim(),
  },
};

const rateLimitingTopic: SeedTopic = {
  slug: "rate-limiting",
  title: "Rate limiting",
  description: "Algorithms, keys, distributed counters and client signalling.",
  prerequisiteSlugs: ["caching"],
  lesson: {
    slug: "essentials",
    title: "Rate limiting: essentials",
    level: "INTERMEDIATE",
    estimatedMinutes: 18,
    summary:
      "A rate limiter is only as correct as its counter update is atomic — INCR then a separate EXPIRE call leaves a gap a crash or a race can land in, which is exactly the kind of two-call \"atomic enough\" mistake worth being suspicious of in general.",
    content: `
- **Fixed window**: simple, but allows bursts of up to twice the limit around window boundaries.
- **Sliding window** and **token bucket**: smoother; token bucket allows controlled bursts.
- Choose the key carefully: API key or user id for authenticated traffic, IP as a coarse fallback (many users can share one IP).
- With several app instances, counters must live in a shared store such as Redis, or each instance enforces its own limit.
- Respond with **429 Too Many Requests** and **Retry-After**.
`.trim(),
    explanation: `
## Algorithms: fixed window, sliding window, token bucket

- **Fixed window** counts requests in a clock-aligned window (e.g. "100 per calendar minute"). Simple, but it allows a burst of up to twice the limit right at a window boundary — 100 requests at 12:00:59 and another 100 at 12:01:00 both pass.
- **Sliding window** counts requests in the last N seconds from *now*, not from a clock boundary, which removes the boundary-burst problem at the cost of a slightly more expensive count.
- **Token bucket** refills tokens at a steady rate up to a capacity, and each request spends one; it allows a controlled burst (spending saved-up tokens) while still enforcing a long-run average rate, which tends to match how real clients actually behave.

## Choosing what to limit by

Key the limit on the most specific identity you can trust: a user id or API key for authenticated traffic. IP address is a necessary fallback for anonymous traffic, but it's coarse — many real users can share one IP (an office network, a mobile carrier's NAT), and a determined attacker can rotate IPs freely. A login endpoint is usually limited on *both* the account being targeted and the source IP, since either alone misses a real attack shape.

## Why limits need a shared store across instances

An in-memory counter is only exact within the one process holding it. The moment there's more than one instance (several app servers, or serverless functions that come and go), a client's requests spread across them each see only their own slice of traffic — N instances means a client can get roughly N times the intended limit before any single counter trips. A correct limit across instances needs a store every instance shares, typically Redis.

## INCR + EXPIRE is two calls, not one — and that gap matters

A tempting first implementation of a fixed window is: \`INCR\` the key, and if the result is 1 (the first increment), \`EXPIRE\` it so the window resets. That's **two separate round trips, not one atomic operation** — but another request's \`INCR\` landing in between them is harmless; \`INCR\` is itself atomic, so exactly one caller ever sees \`count === 1\` and only that caller calls \`EXPIRE\`. The real risk is that same caller never reaching the \`EXPIRE\` at all: if its process crashes, or the connection times out, right after the \`INCR\`, that key is left with no expiry and counts up forever, permanently rate-limiting whoever it's keyed to. The fix is still to make the whole check-and-increment one atomic unit — a single Lua script (\`EVAL\`) that does both, or \`SET key 0 NX EX seconds\` followed by \`INCR\` (which leaves the key's existing TTL untouched) — so there is no window where the key can exist without one.

## Signalling the limit to the client

Respond with **429 Too Many Requests** and a **Retry-After** header (seconds, or an HTTP date) so a well-behaved client knows how long to back off, rather than retrying immediately and adding to the load that caused the 429 in the first place. Many APIs also expose remaining quota via \`RateLimit-*\` response headers on every request, limited or not, so clients can throttle themselves before ever hitting 429.
`.trim(),
    realWorldExample: `
A login endpoint limits attempts per account to slow down credential stuffing. A first attempt at this looks atomic but isn't:
\`\`\`ts
const key = \`login_attempts:\${email}\`;
const count = await redis.incr(key);
if (count === 1) {
  await redis.expire(key, 60); // a separate call — survives concurrent INCRs fine; a crash or timeout right here is the real risk
}
if (count > 5) throw new TooManyAttemptsError();
\`\`\`
If the process crashes between the two calls — or a deploy restarts it, or the Redis connection just times out — \`key\` is left with no expiry at all. It keeps counting forever, and that account is locked out of logging in for good, not for 60 seconds. (Another request's \`INCR\` landing in that same gap is not the problem — \`INCR\` is atomic, so only the one caller that saw \`count === 1\` is ever responsible for the \`EXPIRE\`.) The fix moves both steps into one atomic Lua script, evaluated by Redis itself in a single round trip:
\`\`\`ts
const LIMIT_SCRIPT = \`
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return count
\`;
const count = await redis.eval(LIMIT_SCRIPT, { keys: [key], arguments: ["60"] });
if (count > 5) throw new TooManyAttemptsError();
\`\`\`
Redis runs the whole script as one indivisible step — no other command for that key can interleave between the \`INCR\` and the \`EXPIRE\`, and if the script runs at all, it runs all the way to the end.
`.trim(),
    codeExample: `
import { NextResponse } from "next/server";
import { z } from "zod";
import { ipAddress } from "@vercel/functions"; // the IP Vercel's own edge network attached, not a client-set header

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200), // bound the length — hostile input shouldn't buy unbounded hashing work
});

// Returns the new count AND the key's remaining TTL, so the caller can report a real wait time
// instead of always repeating the configured window length, which overstates it once the window
// is already partway through.
const LIMIT_SCRIPT = \`
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return { count, ttl }
\`;

async function checkLimit(key: string, max: number, windowSeconds: number) {
  const [count, ttl] = (await redis.eval(LIMIT_SCRIPT, { keys: [key], arguments: [String(windowSeconds)] })) as [
    number,
    number,
  ];
  return { allowed: count <= max, retryAfterSeconds: ttl };
}

// POST /api/login — limited per account AND per IP; either alone misses a real attack shape.
export async function POST(req: Request) {
  const parsed = loginSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  // Normalized so "Foo@Example.com" and " foo@example.com " share one limiter bucket, not two.
  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;

  // A client can set its own X-Forwarded-For header; reading it directly lets an attacker pick
  // whatever IP bucket they like and bypass the per-IP limit entirely. ipAddress() instead reads
  // the IP Vercel's own edge network attached to the request, which the client cannot override.
  const ip = ipAddress(req) ?? "unknown";
  const [byAccount, byIp] = await Promise.all([
    checkLimit(\`login:account:\${email}\`, 5, 60),
    checkLimit(\`login:ip:\${ip}\`, 20, 60),
  ]);
  if (!byAccount.allowed || !byIp.allowed) {
    const retryAfter = Math.max(byAccount.retryAfterSeconds, byIp.retryAfterSeconds);
    return NextResponse.json({ error: "Too many attempts" }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }

  const user = await authenticate(email, password); // identical response and timing whether the email exists or not
  if (!user) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Implementing a fixed window as a separate \`INCR\` then \`EXPIRE\` call and calling it done.** That's two round trips, not an atomic operation — the real risk is a crash or timeout before the caller reaches \`EXPIRE\`, not another request's \`INCR\` landing in between (that part is harmless, since \`INCR\` is itself atomic).
- **Limiting only by IP address.** Many real users can share one IP, and an attacker can rotate IPs; prefer account/API-key identity when the request is authenticated.
- **Reading a client-settable header (like a raw \`X-Forwarded-For\`) as "the" client IP.** A client can set that header itself unless a trusted proxy normalizes it first; use the IP your platform's own edge attaches (e.g. Vercel's \`ipAddress()\`), not whatever arrived in the request.
- **Running an in-memory counter across multiple instances and expecting one global limit.** Each instance only ever sees its own slice of traffic.
- **Retrying a 429 immediately instead of honoring \`Retry-After\`.** That just adds to the load that caused it.
- **Picking a fixed window without accounting for its boundary-burst behavior**, in a context where that burst actually matters (strict per-second limits, expensive endpoints).
- **Rate-limiting a login endpoint only by account, with no per-IP limit (or vice versa).** One covers credential stuffing from many IPs against one account; the other covers one IP hammering many accounts. Neither alone catches both shapes.
- **A pure per-account limit is itself an attack vector.** Anyone who knows (or guesses) a victim's email can deliberately trip it and lock the real user out of their own account — denial of service through the rate limiter. Limiting on the (account, IP) pair raises the cost of that (an attacker now needs many IPs, not just attempts), and progressive delays or a CAPTCHA challenge instead of a hard lockout mean a legitimate user under attack can still get through.
`.trim(),
  },
};

const jobsQueuesTopic: SeedTopic = {
  slug: "jobs-queues",
  title: "Background jobs and queues",
  description: "Offloading work, at-least-once delivery, retries, backoff and dead-letter queues.",
  prerequisiteSlugs: ["transactions"],
  lesson: {
    slug: "essentials",
    title: "Background jobs and queues: essentials",
    level: "INTERMEDIATE",
    estimatedMinutes: 20,
    summary:
      "Most queues only promise at-least-once delivery, so a handler that isn't idempotent will eventually run twice for the same job — and reliably getting a job onto the queue at all uses the same transactional outbox pattern as any other dual-write gap.",
    content: `
Anything slow or failure-prone that the user does not need to wait for — emails, imports, webhooks out, reports — belongs in a background job.

- Most queues deliver **at least once**: handlers must be idempotent.
- Retry with **exponential backoff and jitter**; cap attempts and move poison messages to a **dead-letter queue** for inspection.
- Enqueue reliably with the **transactional outbox** so a job is never lost or sent for a rolled-back change.
- PostgreSQL can act as a simple queue using \`SELECT ... FOR UPDATE SKIP LOCKED\`.
`.trim(),
    explanation: `
## Why background jobs exist

Anything slow, unreliable, or that the caller doesn't need to wait for — sending an email, calling a third-party API, generating a report, processing an uploaded file — belongs outside the request/response cycle. Moving it into a background job keeps the request fast and lets the work be retried independently of whether the original request's connection is even still open.

## At-least-once delivery means idempotent handlers

Almost every real queue (a cloud queue, a Redis-backed one, a PostgreSQL-backed one) promises **at-least-once** delivery, not exactly-once: a worker can crash after completing the real work but before acknowledging the message, so the system redelivers it, and the same job runs again.

For a side effect that's entirely inside your own database — inserting a row, updating a balance — idempotency is straightforward: do the write and record that it happened in the same transaction, and skip work whose id is already recorded. A side effect that leaves your database, like sending an email, doesn't have that luxury: there's no transaction spanning your database and the email provider, so "send the email" and "record that it was sent" are two separate steps with no way to make them atomic with each other. Recording *before* sending risks marking something done that a crash then prevents from ever actually happening; recording *after* sending risks a crash in the gap between the two, where redelivery runs the handler again with no record that the first send happened. Exactly-once delivery of the email itself isn't achievable this way — the practical fix is to make the *external call* idempotent: pass a deterministic key (the job's own id is a natural choice) to the provider, if it supports one, so the provider's own dedupe catches a retried call even when your bookkeeping couldn't. Recording after a successful send is still worth doing, as a fast-path skip and for monitoring — just don't mistake it for the guarantee; the idempotency key is what actually prevents the duplicate. That key only protects *retries*, though, not a replay days later — providers keep idempotency keys for a limited window (often around 24 hours), so it dedupes the crash-and-redeliver case this section is about, not a job that somehow re-runs long after the fact.

## Enqueueing reliably: the transactional outbox, again

Getting a job onto the queue has the same "two systems, one write" problem the transactions topic's outbox pattern solves: committing a business write and then separately calling the queue leaves a crash in between to either lose the job (write committed, no job) or create one for a change that never happened (job enqueued, then the write's transaction rolls back). Insert the job as a row in the *same* database transaction as the business write it belongs to, and have a separate relay or poller move outbox rows onto the real queue — the job can now only be "for a write that really committed" or "not sent yet."

## Retries: exponential backoff with jitter, and a dead-letter queue

A transient failure (a downstream timeout, a momentary outage) deserves a retry, but not an immediate one — exponential backoff (1s, 2s, 4s, 8s…) gives the dependency time to recover, and jitter (randomizing each delay slightly) stops thousands of simultaneously-failed jobs from retrying in synchronized waves that re-create the outage they're recovering from. Cap the delay itself too (an hour is a common ceiling) — otherwise a job that's been failing for a while waits longer between attempts than anyone actually wants, long before it's useful. Cap the number of attempts as well: a job that keeps failing past that cap moves to a **dead-letter queue** instead of retrying forever or silently vanishing, so it's visible, inspectable, and can be fixed and replayed once the real problem is understood. Not every failure deserves a retry at all — a validation error fails exactly the same way every time, so retrying it just delays finding out it needs a human.

## PostgreSQL as a simple queue: claim, commit, then process

For modest volume, a plain table can be a serviceable queue, claimed in one short transaction: \`SELECT ... WHERE status = 'PENDING' ... FOR UPDATE SKIP LOCKED\` to pick an unclaimed row, then \`UPDATE\` that same row to \`PROCESSING\` before committing. \`FOR UPDATE\` locks the row a worker selects; \`SKIP LOCKED\` tells other concurrent workers to pass over rows someone else already has locked rather than block on them — many workers can claim different rows at once, with no two ever claiming the same one.

The row lock itself only lasts for the transaction: \`FOR UPDATE\` run outside of one (or whose transaction has already ended) releases the lock the instant that single statement finishes. That's why the claim has to commit the \`PROCESSING\` status *before* the lock goes away — it's the status, not the lock, that stops a second worker from picking up this job once this transaction ends. And the actual work — the send, the API call, anything slow or failure-prone — has to happen **after** this claim transaction commits, never inside it: the transactions topic's "keep it short, no network calls inside it" rule applies here too, and a long-held lock on the queue table would stall every other worker trying to claim a job.

Marking a row \`PROCESSING\` creates one more failure mode worth planning for: a worker that claims a job and then crashes (or is killed) leaves it stuck \`PROCESSING\` forever, invisible to new claims, which only look at \`PENDING\`. The fix is a \`lockedUntil\` timestamp set during the claim, and a periodic recovery sweep that resets any row still \`PROCESSING\` past its \`lockedUntil\` back to \`PENDING\`, so another worker can pick it up.

## Validate job payloads like any other untrusted input

A job's payload crossed a trust boundary the moment it was created from a request — by the time a worker (possibly a different process, possibly days later, possibly after a schema change) reads it back, it's untrusted input again, not a value you can assume is still well-formed. Validate it with the same rigor as a request body, and prefer passing ids in the payload (loading current data when the job actually runs) over embedding a full snapshot, which can go stale between enqueue and execution.
`.trim(),
    realWorldExample: `
Placing an order must reliably queue a confirmation email — not lose it if the process crashes, and not send it twice on redelivery.

**Enqueueing, in the same transaction as the order:**
\`\`\`ts
const order = await db.$transaction(async (tx) => {
  const created = await tx.order.create({ data: { userId, productId, quantity } });
  await tx.outboxJob.create({
    data: {
      kind: "SEND_ORDER_CONFIRMATION",
      payload: { orderId: created.id },
      status: "PENDING",
      nextAttemptAt: new Date(),
    },
  });
  return created;
});
\`\`\`
If this transaction rolls back for any reason, neither the order nor the job exists — there is no window where one was created without the other.

**Claiming a job, in one short transaction:**
\`\`\`sql
SELECT id FROM "OutboxJob"
WHERE status = 'PENDING' AND "nextAttemptAt" <= now()
ORDER BY "createdAt"
LIMIT 1
FOR UPDATE SKIP LOCKED;

UPDATE "OutboxJob" SET status = 'PROCESSING', "lockedUntil" = now() + interval '5 minutes' WHERE id = $1;
COMMIT;
\`\`\`
Whichever worker's \`SELECT\` runs first locks that row; every other worker's identical query skips straight past it. The transaction commits the \`PROCESSING\` status before the worker does anything else — the row's lock disappears the instant this transaction ends, so it's that committed status, not the lock, that stops a second worker from re-claiming it. The actual send happens after this commits, never inside the transaction.

**Sending is where ordering matters.** Recording "sent" before calling the email provider would mark the job done even if the process then crashes before the call ever goes out — the confirmation would never arrive, with nothing to show anything went wrong. Instead, the handler passes the job's own id as an idempotency key to the provider, and only records a \`sentOrderConfirmation\` row *after* the call succeeds. A crash between the send and that record is still survivable: redelivery runs the handler again, and the provider's own idempotency key makes the repeated call a safe no-op rather than a second email — delivery itself can't be made exactly-once from this side, only safe to retry.
`.trim(),
    codeExample: `
import { z } from "zod";
import { Prisma } from "@prisma/client";

const confirmationPayloadSchema = z.object({ orderId: z.string().min(1) });

class PermanentJobError extends Error {} // retrying this would never help

const LOCK_DURATION_MS = 5 * 60_000;
const MAX_BACKOFF_MS = 60 * 60_000; // cap at 1 hour — otherwise a long-failing job waits longer

// Claims one job in a short transaction: the row lock itself releases the instant the transaction
// ends, so committing PROCESSING here — not the lock — is what stops another worker re-claiming it.
async function claimNextJob() {
  return db.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ id: string }[]>\`
      SELECT id FROM "OutboxJob"
      WHERE status = 'PENDING' AND "nextAttemptAt" <= now()
      ORDER BY "createdAt"
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    \`;
    if (!row) return null;
    return tx.outboxJob.update({
      where: { id: row.id },
      data: { status: "PROCESSING", lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) },
    });
  });
}

// A separate, periodic sweep: a worker that claimed a job and then crashed leaves it stuck
// PROCESSING forever, invisible to claimNextJob's PENDING-only WHERE clause.
async function recoverStuckJobs() {
  await db.outboxJob.updateMany({
    where: { status: "PROCESSING", lockedUntil: { lt: new Date() } },
    data: { status: "PENDING" },
  });
}

// Runs after claimNextJob's transaction has already committed — never inside it.
async function processJob(job: { id: string; kind: string; payload: unknown }) {
  if (job.kind !== "SEND_ORDER_CONFIRMATION") throw new PermanentJobError(\`Unknown job kind: \${job.kind}\`);

  // Untrusted again by the time a worker reads it back — validate, don't assume.
  const parsed = confirmationPayloadSchema.safeParse(job.payload);
  if (!parsed.success) throw new PermanentJobError("Malformed job payload");
  const { orderId } = parsed.data;

  // Fast path: a previous attempt at this exact job already sent and recorded it.
  const already = await db.sentOrderConfirmation.findUnique({ where: { orderId } });
  if (already) return;

  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } }); // fresh data, not a stale snapshot

  // The idempotency key — not the record below — is what actually prevents a duplicate send: the
  // provider dedupes retried calls sharing one key, so a crash between the send and the record
  // still can't produce two emails, only at worst a provider call that is a safe no-op.
  await sendEmail(order.userEmail, "order-confirmation", { orderId }, { idempotencyKey: job.id });

  try {
    await db.sentOrderConfirmation.create({ data: { orderId } });
  } catch (err) {
    // A duplicate here means the send and the record both already happened — the fast-path check
    // above just didn't see it in time (e.g. a racing redelivery). Treating this as a failure would
    // retry, and eventually dead-letter, a job that actually finished; it never got marked DONE.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
}

async function runWithRetry(job: { id: string; kind: string; payload: unknown; attempts: number }, maxAttempts = 5) {
  try {
    await processJob(job);
    await db.outboxJob.update({ where: { id: job.id }, data: { status: "DONE" } });
  } catch (err) {
    if (err instanceof PermanentJobError || job.attempts + 1 >= maxAttempts) {
      await db.outboxJob.update({ where: { id: job.id }, data: { status: "DEAD_LETTER", lastError: String(err) } });
      return;
    }
    const delayMs = Math.min(2 ** job.attempts * 1000 + Math.random() * 1000, MAX_BACKOFF_MS); // backoff + jitter, capped
    await db.outboxJob.update({
      where: { id: job.id },
      data: { status: "PENDING", attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + delayMs) },
    });
  }
}
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Writing a handler that assumes it will only ever run once per job.** At-least-once delivery means redelivery is normal, not an edge case; without an idempotency check, a retried or redelivered job doubles the side effect.
- **Recording an external side effect as "done" before actually doing it.** A crash right after the record, before the real call goes out, marks something done that never happened. Record after a successful call instead, and make the call itself idempotent (a key tied to the job id) for the gap that ordering still leaves open.
- **Relying on a \`SELECT ... FOR UPDATE\` row lock, by itself, to stop two workers claiming the same job.** The lock releases the instant its transaction ends; without committing a status change (e.g. to \`PROCESSING\`) before that happens, nothing stops a second worker from claiming the same row right after.
- **Leaving no way to recover a job stuck \`PROCESSING\` after the worker that claimed it crashes.** A \`lockedUntil\` timestamp and a periodic sweep that resets expired claims back to \`PENDING\` is what makes that recoverable instead of permanent.
- **Enqueueing a job with a separate call after (or before) committing the business write.** A crash in between either loses the job or creates one for a change that never happened. Use the same transactional outbox pattern as any other "write here, then notify there" gap.
- **Retrying every failure the same way.** A permanent error (a bad payload, a business rule that will never pass) just wastes every retry attempt and delays finding out it needs a human; only retry errors that are plausibly transient.
- **Retrying immediately, with no backoff or jitter — or with backoff that is never capped.** Synchronized immediate retries can re-create the very outage they're recovering from, and an uncapped exponential delay can grow to hours or days between attempts long before that's useful; cap it.
- **Embedding a full data snapshot in the job payload instead of just the id.** The snapshot can be stale by the time the job actually runs; load current data at execution time instead.
- **Trusting a job's payload because your own code enqueued it.** It crossed a trust boundary once already and can be read back by a different process, after a schema change, or much later; validate it like any other untrusted input.
`.trim(),
  },
};

const idempotencyTopic: SeedTopic = {
  slug: "idempotency",
  title: "Idempotency",
  description: "Designing operations that are safe to retry.",
  prerequisiteSlugs: ["postgres", "prisma"],
  lesson: {
    slug: "essentials",
    title: "Idempotency: essentials",
    level: "INTERMEDIATE",
    estimatedMinutes: 18,
    summary:
      "Idempotent means doing it twice is the same as doing it once — but that guarantee has to live in storage (a unique constraint, an idempotency key record), not in the client's good behavior, because the client genuinely cannot tell whether a timed-out request already succeeded.",
    content: `
An operation is idempotent when doing it twice has the same effect as doing it once. Networks time out, clients retry, and queues redeliver — so side-effecting operations must be safe to repeat.

- **Idempotency keys**: the client sends a unique key (e.g. \`Idempotency-Key\` header); the server stores key + request fingerprint + result, and returns the stored result on retry.
- Reject reuse of a key with a different payload.
- Natural idempotency: unique constraints and upserts ("insert if not exists") make duplicates impossible at the database level.
- Make the key record and the side effect commit together, or handle the "in progress" state explicitly.
`.trim(),
    explanation: `
## Why idempotency matters: the client can't tell what happened

A client that sent a POST and then got a timeout, a dropped connection, or a 502 from a proxy in the middle has no way to know whether the request reached the server and succeeded, failed outright, or is still being processed. The only safe thing it can do is retry — which means every side-effecting operation a client might retry has to be safe to run more than once. "Idempotent" doesn't mean "read-only"; it means doing it N times has the same observable effect as doing it once.

## Idempotency keys: store the request's fingerprint and the result

The client generates a unique key per logical operation (not per HTTP attempt) — typically a UUID — and sends it, commonly as an \`Idempotency-Key\` header. The server's first job on seeing a new key is to atomically record it, along with a fingerprint of the request (a hash of its meaningful fields) and, once known, the result. A retry with the same key doesn't repeat the side effect; it looks up the stored result and returns it. Keys are scoped to the caller (see below) and usually expire after a retention window — long enough to cover realistic retries, not forever.

## The concurrent-duplicate problem: a retry that arrives while the first is still running

A client's retry doesn't always arrive after the first attempt has finished — a slow request and an impatient retry can be in flight at the same time. If the key record is only written *after* the side effect completes, both requests can see "no record yet," both proceed, and the side effect runs twice. The fix is to insert the key record *before* doing the side effect, under a unique constraint, with a status like \`IN_PROGRESS\`: the first request's insert succeeds and it proceeds; the second request's insert hits the constraint, finds the row already there, and responds with "still processing, retry shortly" instead of racing ahead. Only once the real operation finishes does the row update to \`COMPLETED\` with the response and the original status code to return on future retries.

That leaves one gap: what if the first attempt never finishes at all — a crash, a worker killed mid-request — and leaves the row stuck \`IN_PROGRESS\` forever? Two things close it. If the side effect itself throws, delete the row (or mark it \`FAILED\`) before letting that error propagate, so the *next* retry starts clean instead of piling up behind a row that will never reach \`COMPLETED\`. And separately, treat an \`IN_PROGRESS\` row older than a short timeout (a minute is plenty for an HTTP request) as abandoned, and let a new attempt take it over rather than block on it indefinitely. Taking it over is safe even in the worst case — the original attempt having actually reached the provider and then crashed before recording it — because the charge itself is made with the *same* idempotency key passed on to the provider; the provider's own dedupe, not this row, is the thing that actually prevents a double charge.

## Rejecting key reuse with a different body

A stored key only means "this exact operation has already been attempted" if the server also checks that the retry's request actually matches what the key was first used for. Comparing the stored fingerprint against the incoming request catches a client bug (or a deliberate attempt) to reuse a key for a different operation — reject it outright rather than either replaying the wrong stored result or quietly performing the new, different request under an old key.

## Natural idempotency via constraints — treat a duplicate as success, not failure

Sometimes a separate key-tracking table isn't even needed: if the operation already has a natural unique identity — one shipment per order, one processed event per webhook event id — a UNIQUE constraint on that identity makes a second attempt fail to insert rather than insert a duplicate. The crucial part is how the caller treats that failure: a unique-constraint violation here means "this already happened," which is success, not an error to retry — catching it (Prisma's \`P2002\`) and returning the existing row is the correct response, never re-raising it as a retryable failure, which would just loop forever re-attempting something that already succeeded.

## Scope keys to the caller

An idempotency key is only unique *within one caller's own operations* — the uniqueness constraint should be on \`(userId, key)\`, not \`key\` alone, so one user's key choice can never collide with (or be replayed against) another user's request.
`.trim(),
    realWorldExample: `
A checkout endpoint must survive a double-click or a client retry without charging the customer twice.

**The record comes first, under a unique constraint on \`(userId, key)\` — before any charge happens:**
\`\`\`sql
CREATE TABLE idempotency_keys (
  "userId"      text NOT NULL,
  key           text NOT NULL,
  "requestHash" text NOT NULL,
  status        text NOT NULL, -- 'IN_PROGRESS' | 'COMPLETED'
  "statusCode"  integer, -- the original response's status, replayed as-is (201, not always 200)
  response      jsonb,
  "createdAt"   timestamptz NOT NULL DEFAULT now(), -- also used to detect an abandoned IN_PROGRESS row
  PRIMARY KEY ("userId", key)
);
\`\`\`
A concurrent retry's insert fails this primary key immediately — it never gets to start a second charge while the first is still running. A client that reuses the same key with a different checkout body is caught by comparing \`requestHash\`, not by trusting the client.
`.trim(),
    codeExample: `
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

const idempotencyKeySchema = z.string().min(1).max(255); // most providers' own limit — not necessarily a UUID
const paymentSchema = z.object({ orderId: z.string().min(1) }); // amount is never client-supplied — see below

const ABANDONED_AFTER_MS = 60_000; // generous for one HTTP request; tune to your real p99

function fingerprint(body: unknown) {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

export async function POST(req: Request) {
  const userId = await requireUserId(req);
  const keyParsed = idempotencyKeySchema.safeParse(req.headers.get("idempotency-key"));
  if (!keyParsed.success) return NextResponse.json({ error: "Idempotency-Key header is required (1-255 chars)" }, { status: 400 });
  const idempotencyKey = keyParsed.data;

  const parsed = paymentSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const requestHash = fingerprint(parsed.data);

  // The amount charged comes from the order record, scoped to the caller — never from the
  // request body. A client that could supply its own amount could charge itself one cent.
  const order = await db.order.findFirst({ where: { id: parsed.data.orderId, userId } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    // Inserted before the charge, status IN_PROGRESS — never record a side effect as done
    // before it happens, but a concurrent duplicate still has to be caught before it starts.
    await db.idempotencyKey.create({ data: { userId, key: idempotencyKey, requestHash, status: "IN_PROGRESS" } });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;

    // A record already exists for (userId, key). Try to take over an abandoned attempt
    // atomically: this WHERE only matches a row that's still IN_PROGRESS and older than the
    // timeout, so it can't steal a key a healthy in-flight request still owns.
    const takeover = await db.idempotencyKey.updateMany({
      where: { userId, key: idempotencyKey, requestHash, status: "IN_PROGRESS", createdAt: { lt: new Date(Date.now() - ABANDONED_AFTER_MS) } },
      data: { createdAt: new Date() }, // reset the clock — this attempt now owns the key
    });

    if (takeover.count === 0) {
      const existing = await db.idempotencyKey.findUniqueOrThrow({ where: { userId_key: { userId, key: idempotencyKey } } });
      if (existing.requestHash !== requestHash) {
        return NextResponse.json({ error: "Idempotency-Key reused with a different request" }, { status: 409 });
      }
      if (existing.status === "COMPLETED") {
        return NextResponse.json(existing.response, { status: existing.statusCode ?? 200 }); // replay as-is, no re-charge
      }
      return NextResponse.json({ error: "Request still processing, retry shortly" }, { status: 409 });
    }
    // takeover.count === 1: this request now owns the (previously abandoned) key and proceeds
    // to charge below. Safe even if the original attempt did reach the provider, because the
    // charge reuses the SAME idempotencyKey — the provider's own dedupe prevents a double charge.
  }

  let charge: unknown;
  try {
    // The real side effect, with its own idempotency key passed to the provider as a second layer.
    charge = await chargeCard(order.id, order.amountCents, { idempotencyKey });
  } catch (err) {
    // The attempt failed outright — delete the row so a retry starts clean instead of piling
    // up behind a row that will now never reach COMPLETED.
    await db.idempotencyKey.delete({ where: { userId_key: { userId, key: idempotencyKey } } });
    throw err;
  }

  await db.idempotencyKey.update({
    where: { userId_key: { userId, key: idempotencyKey } },
    data: { status: "COMPLETED", statusCode: 201, response: charge },
  });
  return NextResponse.json(charge, { status: 201 });
}
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Writing the key record as "done" before the side effect actually runs.** If the side effect never happens — a crash, the provider is down — a later legitimate retry wrongly replays a "success" that never occurred. Record \`IN_PROGRESS\` first, \`COMPLETED\` only after.
- **Checking for an existing key with a plain \`SELECT\` before inserting, instead of relying on the \`INSERT\`'s own unique constraint.** That's check-then-act all over again — two concurrent retries can both pass the \`SELECT\` before either inserts.
- **Not handling a retry that arrives while the first attempt is still \`IN_PROGRESS\`.** Without it, a fast-enough retry can run the side effect concurrently with the original, defeating the whole mechanism.
- **Leaving a key stuck \`IN_PROGRESS\` forever after the side effect fails, or the process crashes before finishing it.** Delete the row (or mark it \`FAILED\`) on failure so a client can retry, and treat an \`IN_PROGRESS\` row older than a short timeout as abandoned rather than blocking retries indefinitely — a new attempt can safely take it over, because the provider's own idempotency key, not this row, is what actually prevents a double charge if the original attempt somehow still completes.
- **Accepting a reused key without comparing the request to what it was first used for.** A mismatched body under a known key either replays the wrong result or performs a different operation under false pretenses.
- **Scoping a key's uniqueness globally instead of per caller.** A constraint on \`key\` alone, not \`(userId, key)\`, lets one user's key collide with another user's operation.
- **Treating a unique-constraint violation on a naturally idempotent operation as a failure to retry, instead of success.** It means the operation already happened.
`.trim(),
  },
};

const webhooksTopic: SeedTopic = {
  slug: "webhooks",
  title: "Webhooks and polling",
  description: "Push vs pull integration, signature verification and robust receivers.",
  prerequisiteSlugs: ["idempotency", "jobs-queues"],
  lesson: {
    slug: "essentials",
    title: "Webhooks and polling: essentials",
    level: "INTERMEDIATE",
    estimatedMinutes: 20,
    summary:
      "A webhook endpoint is a public URL anyone can POST to — every request has to prove it actually came from the provider before anything in the body is trusted, and that proof depends on verifying the exact bytes the provider signed, not a reparsed copy of them.",
    content: `
- **Polling** asks repeatedly ("anything new?"); simple but wasteful and delayed. **Webhooks** push events to your endpoint as they happen.
- Verify every webhook: compute an HMAC over the **raw** request body with the shared secret, compare in constant time, and reject old timestamps to stop replays.
- Acknowledge fast (2xx), then process asynchronously.
- Expect duplicates and out-of-order delivery: store processed event ids with a unique constraint and re-fetch current state when order matters.
- Keep a reconciliation poll as a safety net for missed events.
`.trim(),
    explanation: `
## Push vs pull

**Polling** asks a provider "anything new?" on a schedule — simple, works through any firewall, but wastes requests when nothing changed and delays discovery by up to the polling interval. **Webhooks** flip the direction: the provider pushes an HTTP request to your endpoint the moment something happens — near-real-time, but now your endpoint is a public URL that has to defend itself, and the provider's own delivery guarantees (retries, ordering, uniqueness) become your problem too.

## Verifying a signature: HMAC over the raw body

A webhook request is, from your server's point of view, indistinguishable from anyone else's POST to that URL unless you verify it. Providers sign the request by computing an HMAC (commonly HMAC-SHA256) over the **exact bytes** of the request body using a shared secret, and send that signature in a header. Your endpoint recomputes the same HMAC over the bytes it received and compares. The critical word is *exact*: if you parse the body into an object and later re-serialize it to verify, whitespace, key order, or number formatting can all change, and the recomputed HMAC won't match something that was, in fact, a legitimate request — which is exactly why signature verification has to happen on the **raw body**, before any parsing.

## Why Next.js needs the raw body before any parsing

A Next.js route handler's \`Request\` only lets you consume its body once. Calling \`req.json()\` first both parses it *and* consumes the stream — there's no getting the original bytes back afterwards to verify against. Read the body as raw bytes first — \`await req.arrayBuffer()\` — verify the signature against those exact bytes, and only decode and \`JSON.parse\` once verification passes. Preferring the raw bytes over \`req.text()\` for the HMAC step avoids even the small risk of a lossy decode changing what gets hashed; well-formed UTF-8 would hash identically either way, but there's no reason to rely on that when the bytes are right there.

## Comparing signatures safely — and what \`timingSafeEqual\` doesn't do for you

A plain \`===\` comparison on two strings returns as soon as it finds the first differing character, and that timing difference is, in principle, information an attacker can measure and exploit to guess a valid signature one byte at a time. Node's \`crypto.timingSafeEqual\` compares two buffers in constant time regardless of where they first differ — but it has a sharp edge: it **throws** if the two buffers aren't the same length, rather than safely returning \`false\`. An attacker who sends a signature header of the wrong length can trigger that throw; if it isn't caught, the endpoint can crash — or worse, a careless \`try { ... } catch { /* treat as ok */ }\` wrapped around it can accidentally treat the thrown error as "verified." Check that the lengths match first (an HMAC-SHA256 digest is always the same length, so a shorter header is already proof of forgery) and only call \`timingSafeEqual\` once both buffers are known to be the same size.

## Rejecting stale timestamps — the delivery timestamp, not the event's own

A captured, validly-signed request can still be replayed later if nothing checks *when it was signed*. Providers include a timestamp and sign it along with the body — typically the HMAC is computed over \`\${timestamp}.\${rawBody}\` — and reject anything older than a short window (a few minutes is typical) even if the signature itself is perfectly valid. The timestamp that matters here is *when this specific delivery attempt was signed*, not when the underlying event originally happened: a provider that retries a failed delivery for hours or days re-signs the same event fresh on every attempt, with a new delivery timestamp each time. Checking the event's own (unchanging) creation time against a short window would reject every one of those legitimate retries — it's the delivery timestamp's freshness that bounds how long a captured request stays useful to a replayer, not the event's.

## Deduping and ordering: at-least-once, with no guaranteed order

Treat every webhook delivery as **at-least-once and unordered**. Store each event by its provider-assigned event id under a unique constraint, so a redelivered event is a safe no-op rather than a repeated side effect — the same natural-idempotency pattern the idempotency topic covers in depth. Ordering needs separate handling: a \`payment.refunded\` event can reach your endpoint before an earlier \`payment.succeeded\` event for the same payment, depending on the provider's own retry timing. Either re-fetch the object's current state from the provider's API before acting, or only apply transitions that move state forward, so an out-of-order delivery can't walk something backwards.

## Acknowledge fast, process after

Respond 2xx as soon as the event is durably recorded — not after whatever processing it triggers has finished. A provider that doesn't hear back quickly will time out and retry, multiplying the exact duplicate-delivery problem the previous section just solved. The jobs-queues topic's claim-then-process pattern is the right shape here: record the event (the "enqueue"), return 2xx, and let a worker do the real processing afterward.
`.trim(),
    realWorldExample: `
A payment provider posts to \`/api/webhooks/payments\` on every payment event. The raw bytes have to survive untouched until after verification:
\`\`\`ts
const rawBytes = Buffer.from(await req.arrayBuffer()); // not req.json() — verification needs the exact bytes
\`\`\`
The signed payload is \`\${timestamp}.\${rawBody}\`, using the **delivery** timestamp from its own header — not anything embedded in the event — so a retried delivery of an old event is still signed fresh:
\`\`\`ts
const timestamp = req.headers.get("x-signature-timestamp") ?? "";
const signedPayload = Buffer.concat([Buffer.from(\`\${timestamp}.\`), rawBytes]);
const expected = createHmac("sha256", secret).update(signedPayload).digest();
const received = Buffer.from(req.headers.get("x-signature") ?? "", "hex");
const valid = expected.length === received.length && timingSafeEqual(expected, received);
\`\`\`
A forged signature of the wrong length now fails the length check and short-circuits *before* \`timingSafeEqual\` ever runs, instead of throwing. Only once verification passes is the body decoded and parsed, with its own try/catch for malformed JSON:
\`\`\`ts
let payload: unknown;
try {
  payload = JSON.parse(rawBytes.toString("utf8"));
} catch {
  return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
}
\`\`\`

Recording the event is what makes redelivery safe, and it's also what lets the endpoint return fast:
\`\`\`ts
try {
  // The full parsed JSON, not the zod-validated event object — a plain z.object() strips any
  // key the schema didn't declare, and this is a durable record, not just a control-flow check.
  await db.webhookEvent.create({ data: { eventId: event.id, kind: event.type, payload } });
} catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return NextResponse.json({ ok: true }, { status: 200 }); // already recorded — redelivery, not new work
  }
  throw err;
}
\`\`\`
Only after this commits does the handler enqueue the real processing and return 2xx — the provider's retry clock stops the moment this response goes out, long before anything downstream has actually run.
`.trim(),
    codeExample: `
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET!;
const MAX_REPLAY_WINDOW_SECONDS = 5 * 60;

// Only the fields this handler actually relies on — the full parsed JSON is what gets stored.
const eventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
});

function verifySignature(timestamp: string, rawBytes: Buffer, signatureHeader: string | null) {
  if (!signatureHeader) return false;
  // Signed over timestamp + body together — see "Rejecting stale timestamps" for why the
  // delivery timestamp, not anything in the event's own data, is what has to be fresh here.
  const signedPayload = Buffer.concat([Buffer.from(\`\${timestamp}.\`, "utf8"), rawBytes]);
  const expected = createHmac("sha256", WEBHOOK_SECRET).update(signedPayload).digest();
  const received = Buffer.from(signatureHeader, "hex");
  // Length check first: mismatched lengths are already proof of forgery, and calling
  // timingSafeEqual on buffers of different lengths throws instead of returning false.
  return expected.length === received.length && timingSafeEqual(expected, received);
}

// POST /api/webhooks/payments — verify, dedupe, acknowledge fast; process asynchronously.
export async function POST(req: Request) {
  const timestamp = req.headers.get("x-signature-timestamp");
  // Exact bytes, not a decoded string — req.arrayBuffer() can't be lossy the way a UTF-8
  // round trip through req.text() theoretically could be, before verification has even run.
  const rawBytes = Buffer.from(await req.arrayBuffer());

  if (!timestamp || !verifySignature(timestamp, rawBytes, req.headers.get("x-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const deliveredAt = Number(timestamp);
  if (!Number.isFinite(deliveredAt) || Math.abs(Date.now() / 1000 - deliveredAt) > MAX_REPLAY_WINDOW_SECONDS) {
    return NextResponse.json({ error: "Stale request" }, { status: 400 }); // signed, but too old to trust
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBytes.toString("utf8")); // decode and parse only now, after verification
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  const event = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      // The full parsed payload, not the "event" variable above — a plain z.object() strips any key the schema
      // didn't declare, and this is a durable record of what arrived, not a control-flow check.
      await tx.webhookEvent.create({ data: { eventId: event.id, kind: event.type, payload } });
      await tx.outboxJob.create({
        data: { kind: "PROCESS_PAYMENT_EVENT", payload: { eventId: event.id }, status: "PENDING", nextAttemptAt: new Date() },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: true }, { status: 200 }); // already recorded — a safe no-op, not an error
    }
    throw err;
  }

  return NextResponse.json({ ok: true }, { status: 200 }); // ack now; a worker does the real processing later
}
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Verifying against a re-parsed or re-serialized body instead of the exact raw bytes.** Whitespace, key order, or number formatting can differ just enough to make a legitimate request fail verification.
- **Calling \`req.json()\` (or anything that consumes the body) before reading the raw bytes for verification.** There's no getting the original bytes back afterwards.
- **Comparing signatures with a plain string or buffer equality check.** Timing differences in where the comparison first fails can leak information; use a constant-time comparison instead.
- **Calling a constant-time comparison on two buffers without checking their lengths match first.** \`crypto.timingSafeEqual\` throws on a length mismatch instead of returning \`false\` — an uncaught throw (or worse, a catch that treats it as "verified") can turn a malformed signature into a crash or a bypass.
- **Checking the event's own embedded timestamp against the replay window, instead of the delivery timestamp.** A provider retries a failed delivery for hours or days, re-signing the same event fresh each time — checking the event's original time would reject every one of those legitimate retries.
- **Calling \`JSON.parse\` on the verified body without a try/catch.** A verified signature only proves the bytes weren't tampered with, not that they're valid JSON; a malformed body should be a clean 400, not an unhandled exception.
- **Storing (or acting on) only the zod-validated subset of a webhook's payload.** A plain \`z.object()\` strips any key the schema didn't declare, so storing the validated object instead of the original parsed JSON silently discards every field the schema didn't name. Validate only the fields the handler relies on; persist the full payload.
- **Doing the real processing inline before acknowledging.** A provider that times out waiting for 2xx will retry, multiplying exactly the duplicate-delivery problem dedup-by-event-id exists to solve.
- **Assuming webhook events arrive in the order they happened.** They don't; re-fetch current state or only apply forward-moving transitions.
`.trim(),
  },
};

const concurrencyTopic: SeedTopic = {
  slug: "concurrency",
  title: "Concurrency and race conditions",
  description: "Check-then-act bugs, lost updates and how to make updates atomic.",
  prerequisiteSlugs: ["transactions"],
  lesson: {
    slug: "essentials",
    title: "Concurrency and race conditions: essentials",
    level: "INTERMEDIATE",
    estimatedMinutes: 18,
    summary:
      "A race condition needs shared state, concurrency, and a write — and the fix is never \"add a lock variable in your own process\"; it's making the database's own write enforce the invariant, or taking a lock it actually honors across every process that touches the row.",
    content: `
A race condition happens when the result depends on the timing of concurrent operations.

- **Check-then-act**: reading stock, checking it in code, then writing lets two requests both pass the check.
- **Lost update**: two read-modify-write cycles overwrite each other.
- Fixes: atomic conditional updates (\`UPDATE ... SET stock = stock - 1 WHERE id = $1 AND stock >= 1\`), row locks (\`SELECT ... FOR UPDATE\`), optimistic concurrency (version column), unique constraints, or serializable transactions with retries.
- A single Node process is single-threaded, but await points still interleave requests — and production runs several processes.
`.trim(),
    explanation: `
## What makes a race condition — briefly

A race condition needs three things: shared state, more than one concurrent operation touching it, and at least one write. The transactions topic already walked through the canonical check-then-act bug in depth — read a value, decide in application code, write back — and its fix, an atomic conditional \`UPDATE ... WHERE\` that makes the condition part of the write itself. This topic goes past that one example into the general toolkit.

## Lost updates

A **lost update** is check-then-act's quieter cousin: two concurrent read-modify-write cycles each read the same starting value, each compute a new value in application code, and whichever writes second overwrites the first's result entirely — not a crash, just silently wrong data (a like counter that gains one instead of two). The fix is the same shape as before: let the database do the arithmetic in one atomic statement (\`likes = likes + 1\`), so there's no "read, compute in JS, write back" round trip to race inside.

## Pessimistic vs optimistic concurrency control

- **Pessimistic**: lock the row before touching it (\`SELECT ... FOR UPDATE\`, covered in depth in the database isolation and locking topic) so a second transaction simply waits. Right for hot rows where conflicts are common and waiting briefly is cheaper than retrying.
- **Optimistic**: don't lock anything up front; instead, detect at write time whether the row changed since you read it, and treat a conflict as something to retry or report, not prevent. Right for low-contention data where most operations never actually collide, and paying for a lock on every read would be wasted work.

## Optimistic concurrency with a version column

Not every update has a numeric threshold to fold into a \`WHERE\` clause the way stock does. Updating a user's profile, a document's content, or any arbitrary field still needs "nobody else changed this since I read it," without a \`quantity >=\` condition to express it. A version column (or an \`updatedAt\` timestamp) does the same job generically:
\`\`\`sql
UPDATE documents
SET content = $1, version = version + 1
WHERE id = $2 AND version = $3; -- the version you read, not whatever it is now
\`\`\`
If another writer updated the row in between your read and this write, \`version\` no longer matches, zero rows update, and your code must treat that as a conflict — report it to the user, or re-read the current version and retry, depending on whether the two writes could be merged automatically.

## A lock inside your own process doesn't fix a database race

An in-process lock — a \`Map\` used as a mutex, a locking library, an await-based queue — only ever serializes requests inside the one process holding it. The moment there's more than one server instance (and there almost always is in production), two requests landing on different instances see no lock at all between them; the database is still the only thing both instances share, so it's still the only place a real fix can live — an atomic statement, a row lock the database itself grants, or an advisory lock (see database isolation and locking) if what's actually needed is "only one of these running anywhere," not a row to lock.

## Choosing between the two

Default to making the database's write atomic (the transactions topic's pattern) whenever the condition can be expressed in a \`WHERE\` clause. Reach for a version column when it can't. Reach for \`FOR UPDATE\` when several related rows need to move together under one decision. All three put the actual guarantee in the database, which is the one thing every instance and every process genuinely shares.
`.trim(),
    realWorldExample: `
Two browser tabs open the same user's profile settings and both submit an edit a few seconds apart. Without a version check, whichever write lands second silently wins, discarding the first edit with no indication anything was lost:
\`\`\`ts
await db.userSettings.update({ where: { userId }, data: { bio } }); // last write wins, silently
\`\`\`
Adding the version the client last saw to the \`WHERE\` clause turns a silent overwrite into a detectable conflict:
\`\`\`ts
const { count } = await db.userSettings.updateMany({
  where: { userId, version: clientVersion },
  data: { bio, version: { increment: 1 } },
});
if (count === 0) throw new StaleVersionError(); // someone else changed it since this client last read it
\`\`\`
**The fix that doesn't work:** reaching for a process-local lock instead —
\`\`\`ts
const locks = new Map<string, boolean>();
if (locks.get(userId)) throw new Error("Try again"); // only blocks requests on THIS instance
locks.set(userId, true);
\`\`\`
With two server instances behind a load balancer, the two tabs' requests can land on different instances; each sees its own empty \`locks\` map and neither ever sees the other's lock. The version check above works regardless of how many instances exist, because the conflict is detected by the database itself, not by anything living in one process's memory.
`.trim(),
    codeExample: `
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSettingsSchema = z.object({
  bio: z.string().max(500),
  version: z.number().int().nonnegative(), // the version this client last read
});

// PATCH /api/settings — optimistic concurrency: the WHERE clause's version check is the lock.
export async function PATCH(req: Request) {
  const userId = await requireUserId(req);
  const parsed = updateSettingsSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { bio, version } = parsed.data;

  const { count } = await db.userSettings.updateMany({
    where: { userId, version }, // scoped to the caller AND to the version they actually read
    data: { bio, version: { increment: 1 } },
  });

  if (count === 0) {
    // count === 0 means either a stale version or no row at all — tell those apart instead of
    // letting a missing row surface as an uncaught throw.
    const current = await db.userSettings.findUnique({ where: { userId } });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      { error: "Someone else updated this since you loaded it", current },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, version: version + 1 });
}
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Reading a value, deciding in application code, then writing it back.** Across an \`await\`, this is check-then-act no matter how fast it looks — see the transactions topic for the atomic-\`WHERE\` fix.
- **A lost update from two read-modify-write cycles.** Let the database do the arithmetic (increment/decrement) instead of computing the new value in application code.
- **Reaching for a process-local lock (a \`Map\`, a mutex library) to "fix" a database race.** It only serializes requests on the one instance holding it; a second instance sees no lock at all.
- **Using optimistic concurrency but not checking the update's affected row count.** An \`updateMany\` whose \`WHERE\` didn't match still "succeeds" with zero rows changed unless the caller checks for that.
- **Picking pessimistic locking (\`FOR UPDATE\`) for low-contention data.** Most writers never collide, so every write pays for a lock nothing was ever going to contend over.
- **Treating a version conflict as a bug to suppress** (retrying blindly without re-reading) **instead of a real signal** that another writer's change needs to be seen before this one proceeds.
`.trim(),
  },
};

const isolationLockingTopic: SeedTopic = {
  slug: "isolation-locking",
  title: "Database isolation and locking",
  description: "Isolation levels, anomalies, row locks and deadlocks in PostgreSQL.",
  prerequisiteSlugs: ["transactions", "concurrency"],
  lesson: {
    slug: "essentials",
    title: "Database isolation and locking: essentials",
    level: "ADVANCED",
    estimatedMinutes: 22,
    summary:
      "PostgreSQL's isolation levels promise different things — READ COMMITTED stops dirty reads only; REPEATABLE READ adds a stable snapshot and blocks phantoms, but a concurrent update to a row it's also writing still aborts it with a serialization failure to retry; and SERIALIZABLE goes further still, catching write skew too, which neither weaker level does.",
    content: `
- PostgreSQL's default isolation level is **READ COMMITTED**: each statement sees data committed before it began.
- REPEATABLE READ gives a snapshot for the whole transaction; SERIALIZABLE additionally prevents serialization anomalies and may abort transactions with SQLSTATE 40001 — callers must retry.
- \`SELECT ... FOR UPDATE\` locks selected rows until commit; \`SKIP LOCKED\` lets workers grab different rows.
- Deadlocks happen when transactions wait on each other's locks; PostgreSQL aborts one. Lock rows in a consistent order and keep transactions short.
`.trim(),
    explanation: `
## The three isolation levels PostgreSQL actually has

The SQL standard defines four; PostgreSQL implements three, because it never allows dirty reads even at the weakest setting — \`READ UNCOMMITTED\` behaves exactly like \`READ COMMITTED\`.

- **READ COMMITTED** (the default). Each *statement* sees a fresh snapshot of whatever was committed as of the moment that statement began — not the moment the transaction began. Two \`SELECT\`s in the same transaction, moments apart, can see different data if something else committed in between.
- **REPEATABLE READ**. The whole *transaction* sees one snapshot, taken at its first statement — every read for the rest of the transaction sees that same point in time, however long the transaction runs.
- **SERIALIZABLE**. Everything REPEATABLE READ gives, plus active detection of anomalies that would only be possible if transactions ran concurrently — if it finds one, it aborts a transaction rather than let the anomaly stand.

## Anomalies, precisely: what each level stops and what it doesn't

- **Dirty read** (reading another transaction's uncommitted change): impossible at every level in PostgreSQL, always.
- **Non-repeatable read** (re-reading the same row within one transaction and getting a different answer): possible under READ COMMITTED, impossible from REPEATABLE READ up — that's exactly what "repeatable read" names.
- **Phantom read** (re-running the same query and getting different *rows*, not just different values): possible under READ COMMITTED, impossible from REPEATABLE READ up, for the same reason — one snapshot for the whole transaction.
- **Write skew**: possible under *both* READ COMMITTED and REPEATABLE READ. This is the one worth being precise about, because "REPEATABLE READ prevents phantoms" is easy to over-generalize into "REPEATABLE READ prevents concurrency bugs" — it doesn't close this one.

## Write skew: the anomaly REPEATABLE READ doesn't catch

Two on-call doctors, a rule that at least one must always be reachable. Both transactions, under REPEATABLE READ, read the same snapshot — each sees *the other* doctor as on call — and each decides, correctly according to what it read, that taking themselves off call is fine. Both commit. Now nobody is on call, and no single statement did anything wrong: each transaction only ever wrote to its *own* row, so there's no write-write conflict for REPEATABLE READ's snapshot isolation to catch — the invariant that broke spanned two rows, and each transaction only looked at (and never re-checked) the other one. SERIALIZABLE is specifically built to catch this shape of anomaly: it tracks the dependency between what one transaction read and what another wrote, and aborts one of the two with a serialization failure rather than let them both commit.

A fix that doesn't require SERIALIZABLE at all: lock the rows the decision actually depends on before deciding. Locking *both* doctors' rows together, in one statement, in a consistent order (the same shape as the deadlock fix below) makes the second transaction block on that \`SELECT ... FOR UPDATE\` until the first commits — and when it resumes, it re-reads the row's now-current, already-updated state, correctly sees the other doctor already off call, and refuses. Locking only the row being written (and not the row the decision reads) doesn't fix this — and locking each row in a different order across the two transactions trades the anomaly for a deadlock instead, which is exactly why the lock has to cover every row the decision depends on, acquired in one consistent order.

## SERIALIZABLE: correctness by aborting, not by blocking

SERIALIZABLE doesn't achieve "as if transactions ran one at a time" by making transactions wait for each other — it lets them proceed concurrently and, after the fact, detects when the result couldn't have arisen from *any* one-at-a-time ordering. A transaction on the losing end of that detection gets aborted with SQLSTATE \`40001\`, not a result. That means application code using SERIALIZABLE **must** be written to retry: wrap the transaction in a bounded retry loop with a small jittered delay between attempts (so the same two transactions retrying in lockstep don't just collide again), and treat \`40001\` as "run it again," not as a failure to surface to the user. This is the trade SERIALIZABLE makes — the strongest correctness guarantee, paid for in retries instead of locks.

## REPEATABLE READ needs retries too

SERIALIZABLE isn't the only level that can abort a transaction and demand a retry. Under REPEATABLE READ, if another transaction commits an update to a row sometime after your snapshot was taken, and your transaction then tries to \`UPDATE\` (or \`DELETE\`) that same row, PostgreSQL can't apply your write against data your snapshot no longer reflects — it raises that same SQLSTATE \`40001\`, "could not serialize access due to concurrent update," and your transaction must retry just the same. REPEATABLE READ's snapshot protects what you *read*; it doesn't extend to a write that collides with someone else's already-committed write to the exact same row. Write skew, above, is the gap *beyond* this one: two transactions each writing a *different* row, which this same-row check can't catch at all, but SERIALIZABLE does.

## Row locks: FOR UPDATE, and how long a lock actually lasts

\`SELECT ... FOR UPDATE\` locks the rows it selects until the current transaction ends — commit or rollback, either one releases it. That duration is the whole point and the whole risk: a lock held across a slow network call (the jobs-queues topic's claim-then-release-immediately pattern exists precisely because of this) blocks every other transaction waiting on that row for exactly as long as the slow call takes. \`FOR UPDATE NOWAIT\` fails immediately instead of waiting if the row is already locked; \`FOR UPDATE SKIP LOCKED\` — covered in depth in the jobs-queues topic for claiming queue rows — skips locked rows instead of waiting *or* failing, a completely different tool for a completely different job: claiming any available row, not waiting for one specific one.

## Deadlocks: cause and the fix

A deadlock is two transactions each holding a lock the other is waiting for — transaction 1 has locked row A and wants row B; transaction 2 has locked row B and wants row A. Neither can proceed, and PostgreSQL detects the cycle and aborts one of them (SQLSTATE \`40P01\`) so the other can continue. The fix isn't to avoid locking — it's to always lock the same rows in the same order, regardless of which transaction got there first: a money transfer should always lock the lower account id before the higher one, never "sender then receiver," which can be either order depending on who's paying whom.

## Advisory locks: locking something that isn't a row

Sometimes the thing that needs mutual exclusion isn't a row at all — "only one instance of this scheduled job should run at a time" has nothing to lock with \`FOR UPDATE\`. PostgreSQL's **advisory locks** lock an arbitrary application-chosen integer key instead of a row — exactly the "distributed mutex" a multi-instance deployment needs for this kind of job, with no Redis required if you're already talking to PostgreSQL. Pick that key as a fixed, manually chosen integer constant for each distinct lock purpose, rather than hashing a name with \`hashtext()\` — it's convenient, but it's an *internal* PostgreSQL function, not a documented, stable part of the public SQL surface, and isn't guaranteed to keep producing the same value across major versions.

## Advisory locks and connection pooling — the trap

The session-level functions (\`pg_advisory_lock\`, \`pg_try_advisory_lock\`, \`pg_advisory_unlock\`) tie the lock to the *database session* — the underlying server connection — not to a transaction. That's a real problem the moment anything sits between your code and PostgreSQL: Prisma, like most clients, manages a pool of connections, and two separate queries — one to lock, a later one to unlock — aren't guaranteed to run on the *same* pooled connection. An unlock issued on the wrong connection does nothing (no error, just silently fails), leaving the lock held by a session your code has already stopped tracking — it leaks until that specific connection happens to close. A transaction-mode connection pooler in front of PostgreSQL (PgBouncer in transaction mode, or Supabase's transaction pooler) makes this worse, not just occasionally wrong: it hands out a different server-side connection per transaction, so a session-level lock can fail to even survive past the statement that acquired it.

The fix is to stop relying on session scope at all. \`pg_try_advisory_xact_lock\` (and the blocking \`pg_advisory_xact_lock\`) ties the lock to the *current transaction* instead — acquired and automatically released at commit or rollback, with no separate unlock call to risk running on a different connection. Run it inside a short \`$transaction\`, which pins one connection for that transaction's whole duration, so the lock's lifetime lines up exactly with the connection holding it — but that also means it only suits a short, DB-only critical section, since a transaction (and the lock with it) shouldn't be held open across a slow network call. For a job whose real work *is* slow, a plain lease row — an ordinary table with a \`lockedUntil\` column, read and written like any other row — sidesteps the whole session/transaction question entirely, at the cost of being one more table to manage.
`.trim(),
    realWorldExample: `
Two on-call doctors, under REPEATABLE READ, each check that the other is on call and then take themselves off:
\`\`\`sql
-- Doctor A's transaction
SELECT on_call FROM doctors WHERE id = 'B'; -- true, from A's snapshot
UPDATE doctors SET on_call = false WHERE id = 'A';
COMMIT;
\`\`\`
\`\`\`sql
-- Doctor B's transaction, running concurrently
SELECT on_call FROM doctors WHERE id = 'A'; -- true, from B's snapshot
UPDATE doctors SET on_call = false WHERE id = 'B';
COMMIT;
\`\`\`
Both commit. REPEATABLE READ gave each transaction a stable snapshot, which is exactly why neither one ever saw the other's write — they touched different rows, so there was no write-write conflict to detect, and the invariant ("at least one doctor on call") broke anyway. Rerunning the same two transactions under SERIALIZABLE, PostgreSQL detects the dependency between what each one read and what the other wrote, and aborts one with a serialization failure — only the surviving transaction's commit happens, and the aborted one must be retried by the application. Locking both doctors' rows together with \`FOR UPDATE\` before deciding fixes the same anomaly without SERIALIZABLE: the second transaction blocks on the lock instead of deciding from a stale snapshot, and re-reads the already-updated row once it resumes.

**A different kind of mutual exclusion.** A nightly reconciliation job must never run twice concurrently — but there's no row representing "is the job running," so \`FOR UPDATE\` has nothing to lock. Tying the lock to the transaction, not the session, avoids the connection-pooling trap above:
\`\`\`sql
SELECT pg_try_advisory_xact_lock(482910337); -- a fixed key, not hashtext() — see above
\`\`\`
A \`false\` result means another instance already holds it this transaction; skip this run rather than wait. Because the lock only lasts as long as the transaction, this fits a short, DB-only critical section — a job whose real work is slow (a network call, a long scan, like the reconciliation itself) needs the lease-row approach instead, claimed with an ordinary conditional update rather than any lock tied to a session or a transaction.
`.trim(),
    codeExample: `
import { Prisma } from "@prisma/client";

async function withSerializableRetry<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      // P2034: Prisma's code for a serialization failure or deadlock (PostgreSQL SQLSTATE 40001/40P01).
      // SERIALIZABLE's whole correctness model depends on the caller retrying this, not surfacing it.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034" && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 80)); // jitter — the
        // same two transactions retrying in lockstep, with no delay, would likely just collide again.
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

// The on-call anomaly: under anything weaker than SERIALIZABLE, each transaction's read of the
// OTHER doctor's status comes from a snapshot that never notices the other's concurrent write.
async function takeOffCall(doctorId: string, otherDoctorId: string) {
  return withSerializableRetry(async (tx) => {
    const other = await tx.doctor.findUniqueOrThrow({ where: { id: otherDoctorId } });
    if (!other.onCall) throw new Error("At least one doctor must remain on call");
    return tx.doctor.update({ where: { id: doctorId }, data: { onCall: false } });
  });
}

// The same fix without SERIALIZABLE: lock both rows together, in a consistent order, before
// deciding — the second caller blocks on FOR UPDATE and re-reads the already-updated row once
// it resumes, instead of deciding from a stale snapshot. Locking only one row (or both, but in
// a different order in each caller) either misses the fix or trades it for a deadlock.
async function takeOffCallWithRowLock(doctorId: string, otherDoctorId: string) {
  return db.$transaction(async (tx) => {
    const [idA, idB] = [doctorId, otherDoctorId].sort();
    await tx.$queryRaw\`SELECT id FROM "Doctor" WHERE id IN (\${idA}, \${idB}) ORDER BY id FOR UPDATE\`;

    const other = await tx.doctor.findUniqueOrThrow({ where: { id: otherDoctorId } });
    if (!other.onCall) throw new Error("At least one doctor must remain on call");
    return tx.doctor.update({ where: { id: doctorId }, data: { onCall: false } });
  });
}

// A fixed, manually chosen key per lock purpose — not hashtext(), an internal function with no
// stability guarantee across PostgreSQL versions.
const RECONCILIATION_LOCK_KEY = 482_910_337;

// A short, DB-only critical section. pg_try_advisory_xact_lock ties the lock to this transaction,
// not a session, so it's safe through a connection pool (and a transaction-mode pooler such as
// PgBouncer or Supabase's transaction pooler) — unlike the session-level pg_try_advisory_lock /
// pg_advisory_unlock pair, whose separate lock and unlock calls aren't guaranteed to land on the
// same underlying connection and can silently leak the lock.
async function runShortExclusiveTask() {
  return db.$transaction(async (tx) => {
    const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>\`
      SELECT pg_try_advisory_xact_lock(\${RECONCILIATION_LOCK_KEY}) AS locked
    \`;
    if (!locked) return; // another instance already holds it — skip, don't wait
    await doShortDbOnlyWork(tx);
  }); // commit releases the lock automatically — no separate unlock call to get wrong
}

// A long-running job (network calls, slow scans) can't hold a transaction open for its whole
// duration — a lease row sidesteps the session/pooling question entirely, since it's just data.
async function runNightlyReconciliationOnce() {
  const now = new Date();
  const { count } = await db.jobLease.updateMany({
    where: { name: "nightly-reconciliation", lockedUntil: { lt: now } },
    data: { lockedUntil: new Date(now.getTime() + 30 * 60_000) }, // claim for 30 minutes
  });
  if (count === 0) return; // another instance already holds an unexpired lease

  await runReconciliation(); // the real, possibly slow work — no transaction held open for it
}
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Assuming REPEATABLE READ prevents all concurrency anomalies because it prevents phantoms.** It does not catch write skew, where two transactions each read a stable snapshot and each write to a different row, breaking an invariant that spans both.
- **Assuming only SERIALIZABLE ever produces a serialization failure to retry.** REPEATABLE READ raises the same SQLSTATE 40001 when a transaction tries to update a row that another, already-committed transaction updated after its snapshot was taken — both levels need an application-side retry loop, not just SERIALIZABLE.
- **Treating a serialization failure (SQLSTATE 40001) as an application error to surface to the user.** It's a signal to retry the whole transaction, which the application must be written to do — ideally with a small jittered delay, so the same two transactions don't just collide again immediately.
- **Holding a \`FOR UPDATE\` row lock across a network call.** The jobs-queues topic's claim-then-process pattern exists precisely to avoid this; the lock lasts exactly as long as the transaction, so a slow call inside one blocks everyone else waiting on that row for just as long.
- **Locking the same set of rows in different orders in different code paths.** That's exactly what produces a deadlock; always lock in one consistent order (e.g. by id) — and for a write-skew-style decision, lock every row the decision depends on, not just the row being written.
- **Using the session-level advisory lock functions (\`pg_advisory_lock\`, \`pg_advisory_unlock\`) through a connection pool.** The lock and its unlock aren't guaranteed to run on the same pooled connection — an unlock on the wrong one silently does nothing, leaking the lock — and a transaction-mode pooler (PgBouncer, Supabase's transaction pooler) can break session-level locks even worse. Use \`pg_try_advisory_xact_lock\` in a short transaction, or a lease row, instead.
- **Hashing a name with \`hashtext()\` to get an advisory lock key.** It's an internal PostgreSQL function with no guarantee of producing the same value across versions; use a fixed, manually chosen integer constant per lock purpose instead.
- **Reaching for \`SKIP LOCKED\` when the goal is "wait for this specific row," or \`FOR UPDATE\` alone when the goal is "claim any available row."** They solve different problems; the jobs-queues topic covers the \`SKIP LOCKED\` claiming case in depth.
`.trim(),
  },
};

const observabilityTopic: SeedTopic = {
  slug: "observability",
  title: "Logging, monitoring, and error handling",
  description: "Structured logs, metrics, traces, alerting and safe error responses.",
  prerequisiteSlugs: ["rest"],
  lesson: {
    slug: "essentials",
    title: "Logging, monitoring, and error handling: essentials",
    level: "INTERMEDIATE",
    estimatedMinutes: 18,
    summary:
      "Logs, metrics and traces answer different questions — what happened, is something trending wrong, and where in the request did it happen — and none of them are worth collecting if a label choice makes the metrics backend fall over or a log line hands out a session token.",
    content: `
- **Logs** explain individual events; **metrics** show trends and trigger alerts; **traces** follow one request across services.
- Log structured JSON with a request/correlation id; never log passwords, tokens or full card numbers.
- Watch the golden signals: latency, traffic, errors, saturation.
- Clients get a generic error and a request id; the logs get the details.
- Alert on symptoms users feel (error rate, latency SLOs), not on every internal blip.
`.trim(),
    explanation: `
## Logs, metrics, traces — three different questions

**Logs** record individual events with full detail — one request, one error, one state change. **Metrics** are numeric time series — a request count, an error rate, a latency percentile — cheap to store and alert on, because they're already aggregated. **Traces** follow one request as it crosses services, as a tree of timed spans. A rough way to remember the split: metrics tell you *something* is wrong, traces tell you *where*, logs tell you *why*.

## Structured logging, and what never belongs in a log line

Log structured JSON (level, message, timestamp, a request/correlation id, and whatever fields the event needs) instead of free text — a log platform can filter and aggregate "every error for request abc123" or "p95 duration for this route" against structured fields, but has to fall back to fragile regexes against prose. A correlation id, generated once at the edge of the system and passed through every service call and log line for that one request, is what ties a user's bug report back to the exact chain of log lines that explain it.

What never goes in, structured or not: passwords, session tokens, API keys, full card numbers, or anything else you're not allowed to retain. Logs are copied into log platforms, backups, and sometimes third-party tools, and kept for a long time — a secret that leaks into a log line is a breach the moment it's written, not a hypothetical one. Redact sensitive fields in the logger's own configuration (a deny-list of field names, or structured redaction) so it doesn't depend on every call site remembering not to log the wrong thing.

## The golden signals

Latency, traffic, errors, and saturation — a sensible default set of things to put on a dashboard and alert on for almost any service. Latency separates successful and failed requests (a fast error is not the same signal as a fast success); traffic is demand; errors is the failure rate; saturation is how full your most constrained resource is (CPU, memory, a connection pool, an event loop).

## Cardinality: why a metric label can be more dangerous than a log field

A log line can safely include a user id or a full URL — a log is just a stored event, as many distinct values as actually occurred. A **metric label** is different: most metrics backends create a separate time series for every distinct combination of label values, so a label with high cardinality — a raw user id, a URL with its query string, anything with effectively unbounded distinct values — multiplies the number of time series the backend has to store and query, often enough to measurably slow it down or blow through its cost or storage limits. Label metrics by bounded things instead: a route *template* (\`/orders/:id\`, not \`/orders/42\`), a status code class, a method — fields with a small, known number of possible values — and put the high-cardinality detail (the actual user id, the actual URL) in a log line or a trace span instead, where it belongs.

## Safe error responses: generic to the client, detailed on the server

An unhandled exception should turn into a generic error message, an appropriate status code, and a request id for the client — never a stack trace, a SQL query, or any other internal detail, all of which are a gift to anyone probing the API. The same request id lets you find the full, detailed error — stack trace included — in the server-side logs, where only your own team can read it. This is the same shape as the identical-response-either-way pattern the authentication and authorization topic teaches for login failures: the information a response reveals is a design decision, not an accident.

## Alerting on symptoms, not every cause

Page a human for things users actually feel — an elevated error rate, a latency SLO burning through its error budget — not for every internal blip that could, in theory, be a precursor to one. A dashboard can show cause-level signals (CPU, a single slow dependency) for someone to look at during business hours; what pages someone at 2 a.m. should be the symptom a customer would notice, with a runbook attached, so the alert is actually actionable and rare enough to stay trusted.
`.trim(),
    realWorldExample: `
A request-logging wrapper generates (or forwards) a correlation id and attaches it to every log line for that request:
\`\`\`ts
const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
logger.info({ requestId, method: req.method, route }, "request started");
\`\`\`
Every downstream log call for this request includes the same \`requestId\`, so a support ticket referencing it finds every line that explains what happened.

**A metrics mistake that looks harmless until it isn't.** Recording request duration with the raw path as a label:
\`\`\`ts
histogram.observe({ route: req.url }, durationMs); // every distinct URL becomes its own time series
\`\`\`
\`/orders/42\`, \`/orders/43\`, \`/orders/44\`... each creates a new time series, forever, as new orders are created — the metrics backend's storage grows without bound. Labeling by the route's *template* instead keeps the label space fixed no matter how many orders exist:
\`\`\`ts
histogram.observe({ route: "/orders/:id" }, durationMs); // one time series, regardless of order id
\`\`\`

**A safe error response**, with the real detail only in the log:
\`\`\`ts
} catch (err) {
  logger.error({ requestId, err }, "unhandled error"); // full stack trace, server-side only
  return NextResponse.json({ error: "Something went wrong", requestId }, { status: 500 });
}
\`\`\`
`.trim(),
    codeExample: `
import { NextResponse } from "next/server";

const REDACTED_FIELDS = new Set(["password", "token", "authorization", "idempotencykey", "cookie"]);

// Recurses into nested objects and arrays — a secret buried under { body: { password } } would
// survive a top-level-only redaction.
function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        REDACTED_FIELDS.has(k.toLowerCase()) ? "[redacted]" : redactValue(v),
      ]),
    );
  }
  return value;
}
function redact(fields: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, REDACTED_FIELDS.has(key.toLowerCase()) ? "[redacted]" : redactValue(value)]),
  );
}

function logStructured(level: "info" | "error", fields: Record<string, unknown>, message: string) {
  console[level === "error" ? "error" : "log"](JSON.stringify({ level, message, ...redact(fields) }));
}

// A request-id header is client-supplied — accepting it unchecked lets a caller inject control
// characters (fake log lines) or an unbounded string into every log line for this request.
// Validate its shape, or generate a fresh one; never trust it blindly into structured logs.
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
function resolveRequestId(header: string | null) {
  return header && REQUEST_ID_PATTERN.test(header) ? header : crypto.randomUUID();
}

// Wraps a route handler with a correlation id, structured request/error logs, and a metric
// labeled by the route's fixed template — never the raw, unbounded path — to keep cardinality
// bounded regardless of how many distinct resources exist. Threads Next.js 15's params (a
// Promise) straight through, rather than re-deriving a dynamic segment from the raw request.
function withObservability<Params>(
  routeTemplate: string,
  handler: (req: Request, ctx: { params: Params; requestId: string }) => Promise<Response>,
) {
  return async (req: Request, { params }: { params: Params }) => {
    const requestId = resolveRequestId(req.headers.get("x-request-id"));
    const startedAt = Date.now();
    logStructured("info", { requestId, method: req.method, route: routeTemplate }, "request started");

    try {
      const res = await handler(req, { params, requestId });
      recordLatency(routeTemplate, res.status, Date.now() - startedAt); // bounded labels: template + status
      return res;
    } catch (err) {
      // Full detail — stack trace included — goes to the server-side log only.
      logStructured("error", { requestId, route: routeTemplate, err: err instanceof Error ? err.stack : String(err) }, "unhandled error");
      recordLatency(routeTemplate, 500, Date.now() - startedAt);
      // The client gets a generic message, a 500, and the same request id — enough to report
      // the problem, never enough to learn anything about the server's internals.
      return NextResponse.json({ error: "Something went wrong", requestId }, { status: 500 });
    }
  };
}

export const GET = withObservability<Promise<{ id: string }>>("/api/orders/:id", async (req, { params, requestId }) => {
  const { id } = await params;
  const userId = await requireUserId(req);
  const order = await db.order.findFirst({ where: { id, userId } }); // ownership folded in
  if (!order) return NextResponse.json({ error: "Not found", requestId }, { status: 404 });
  return NextResponse.json(order);
});
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Logging free text instead of structured fields.** Impossible to filter or aggregate reliably, and it quietly encourages writing a secret into a format string without noticing.
- **Logging (or otherwise storing) a password, token, API key, or full card number anywhere, even temporarily "for debugging."** Logs are copied widely and kept a long time; redact at the logger's own configuration level, not by hoping every call site remembers.
- **Labeling a metric with a raw, effectively unbounded value** (a user id, a full URL, a raw path). Each distinct value becomes a new time series, and the backend's storage and cost grow without bound. Label by a fixed template or category instead, and put the specific value in a log or trace.
- **Returning a stack trace, a SQL error, or other internal detail to the client.** It's free reconnaissance for an attacker and useless to a legitimate caller; return a generic message and a request id, and log the detail server-side.
- **No correlation id, or one that doesn't survive a hop to another service.** Without it, reconstructing one request's path across several services means guessing from timestamps.
- **Paging a human for every internal signal that *might* precede a problem**, instead of the symptom a customer would actually feel. Alert fatigue makes every page — including the real ones — easier to ignore.
- **Putting a dependency's health check in a liveness probe (restarts the instance) when a readiness probe (routes around it) is what's needed.** Covered in depth in the load balancing and scalability topic.
`.trim(),
  },
};

const scalabilityTopic: SeedTopic = {
  slug: "scalability",
  title: "Load balancing and scalability",
  description: "Horizontal scaling, stateless services, health checks and read replicas.",
  prerequisiteSlugs: ["caching"],
  lesson: {
    slug: "essentials",
    title: "Load balancing and scalability: essentials",
    level: "INTERMEDIATE",
    estimatedMinutes: 20,
    summary:
      "Horizontal scaling only works if any instance can handle any request — which means sessions, uploads and caches move out of an instance's own memory into something every instance shares, and \"just add a read replica\" trades write-path simplicity for a lag window every read has to account for.",
    content: `
- **Vertical** scaling buys a bigger machine; **horizontal** scaling adds machines behind a load balancer.
- Horizontal scaling requires **stateless** app servers: sessions, uploads and caches live in shared stores.
- Load balancers distribute traffic (round robin, least connections) and use **health checks** to stop routing to unhealthy instances.
- Databases scale reads with replicas (beware replication lag), and writes with partitioning/sharding — a much bigger step.
- Measure first: find the actual bottleneck before scaling anything.
`.trim(),
    explanation: `
## Vertical vs horizontal scaling

**Vertical** scaling buys a bigger machine — more CPU, memory, faster disks. Simple, but it has a ceiling, and the bigger machine is still a single point of failure. **Horizontal** scaling adds more machines and spreads load across them — more resilient, and it can keep growing past where any single machine could, but it demands more of the architecture: anything that assumed "one process, one place" now has to work across many.

## Statelessness: the precondition for horizontal scaling

Horizontal scaling only works if any instance can handle any request. The moment per-user state — a session, an uploaded file still sitting on local disk, an in-memory cache that has to stay consistent — lives on one instance's own memory or disk, a user routed to a different instance loses it, and an instance that restarts or scales down loses it for everyone. Sessions move to a shared store (the database, Redis); uploads move to object storage; anything cached in memory either moves to a shared cache (the caching topic) or has to tolerate being wrong on some fraction of instances.

## Load balancers: layer 4 vs layer 7, and health checks

A **layer 4** load balancer works at the TCP/UDP level — fast, protocol-agnostic, routing by address and port without reading HTTP. A **layer 7** load balancer understands HTTP, so it can route by path or header, terminate TLS, and retry a failed request against a different instance. Either way, it needs **health checks** to know which instances can actually take traffic — routing to one that's up but broken is worse than routing to one fewer instance.

## Liveness vs readiness — getting this backwards costs more than it saves

A **liveness** check asks "is this process alive, or should it be restarted?" A **readiness** check asks "can this instance serve traffic right now?" — dependencies reachable, warmed up, not mid-shutdown. Failing liveness restarts the instance; failing readiness just stops new traffic from reaching it, without restarting anything. Putting a database check in the *liveness* probe is the classic way to get this backwards: a database blip now restarts every instance at once, turning a small, recoverable outage into a bigger one than the database blip itself ever was. A database check belongs in readiness, where the fix for "the database is unreachable" is "stop sending this instance traffic," not "kill the process and start a new one with the exact same problem."

## Scaling reads: caching, then replicas, and the lag they bring

Before adding infrastructure, find out what's actually slow — the right fix for one bad query is an index, not a fleet of new servers. Once reads genuinely outgrow one database, caching (its own topic) absorbs the hottest, most repeated reads first, cheaply. **Read replicas** come next: copies of the primary that serve read-only queries, so read load spreads across more than one machine. The cost is **replication lag** — a replica's data is always some small, variable amount of time behind the primary, because replication is asynchronous. A user who just wrote something and immediately reads it back can see their own change missing if that read lands on a replica that hasn't caught up yet — the **read-your-writes** problem. The usual fix is routing reads that must be fresh (anything right after that same user's own write) back to the primary for a short window, and sending everything else to replicas.

## Serverless and the connection problem

A traditional app server opens a modest, fixed-size pool of database connections once and reuses it for every request it ever handles. A serverless function doesn't get that luxury: each invocation can be a fresh process, and under real traffic, many invocations run concurrently — each one potentially opening its own connection, with no shared pool between them, because there's no long-lived process for a pool to live in. PostgreSQL's own connection limit is modest — \`max_connections\` defaults to 100, and many managed plans set it lower still — and a traffic spike that spins up even a few dozen concurrent serverless invocations can exhaust it in seconds, well before CPU or memory ever becomes the bottleneck. The fix is a **connection pooler** sitting in front of the database — PgBouncer, or a managed equivalent like Supabase's transaction pooler (what this project's own production deployment uses) — which holds the real, limited set of database connections itself and multiplexes many short-lived client connections onto them, so a thousand serverless invocations can share a handful of actual database connections instead of each claiming its own.

## Measure first; sharding is a last resort, not a first step

Partitioning or sharding — splitting different subsets of the *data itself* across multiple databases — scales writes past what a single primary can handle, but it's a much bigger step than anything above: it needs a shard key that spreads load evenly, a story for queries that need to cross shards, and a rebalancing plan for when one shard outgrows the others. Exhaust the simpler options first — indexes, caching, read replicas, a bigger primary — and reach for sharding only once writes themselves, not reads, are the actual, measured bottleneck.
`.trim(),
    realWorldExample: `
A read-heavy product API starts timing out under load. Checking first, not guessing: query stats show one query — filtering products by category, sorted by recency — accounts for most of the database's time, with no supporting index. Adding the matching composite index fixes most of it immediately, for the cost of one migration, not a single new server.

Once reads genuinely outgrow the primary even with that index, a replica takes read traffic, with its lag handled explicitly:
\`\`\`ts
async function getProduct(id: string) {
  return readReplica.product.findUnique({ where: { id } }); // fine to be a few hundred ms stale
}
async function getMyRecentOrder(userId: string, orderId: string) {
  return primaryDb.order.findFirst({ where: { id: orderId, userId } }); // read-your-writes: use the primary
}
\`\`\`

**Health checks, the right way round.** A readiness probe, not a liveness probe, depends on the database:
\`\`\`ts
// /api/health/ready — database down? Stop routing here. Don't restart this process.
export async function GET() {
  try {
    await db.$queryRaw\`SELECT 1\`;
    return NextResponse.json({ status: "ready" });
  } catch {
    return NextResponse.json({ status: "not ready" }, { status: 503 });
  }
}
// /api/health/live — only checks that the process itself can respond at all.
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
\`\`\`
`.trim(),
    codeExample: `
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

// One PrismaClient per process still matters in serverless (the Prisma ORM topic covers why) —
// the actual fix for connection exhaustion under many concurrent invocations is DATABASE_URL
// itself pointing at a transaction pooler (PgBouncer, or Supabase's transaction pooler in
// production), which multiplexes many short-lived client connections onto a small, fixed pool
// of real database connections. No client-side setting here substitutes for that.
const primary = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const replica = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_REPLICA ?? process.env.DATABASE_URL });

// Reads that can tolerate being a little stale go to the replica; anything that must reflect
// the caller's own just-made write goes to the primary — the read-your-writes fix for
// replication lag.
async function getProductForCatalog(id: string) {
  return replica.product.findUnique({ where: { id } });
}
async function getMyOrderAfterCreating(userId: string, orderId: string) {
  return primary.order.findFirst({ where: { id: orderId, userId } }); // folded ownership, and the primary
}

// GET /api/health/ready — a dependency check belongs here, not in a liveness probe: failing
// readiness removes this instance from the load balancer without restarting it, so a database
// blip doesn't turn into every instance restarting at once.
export async function GET() {
  try {
    await primary.$queryRaw\`SELECT 1\`;
    return NextResponse.json({ status: "ready" });
  } catch {
    return NextResponse.json({ status: "not ready" }, { status: 503 });
  }
}
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Scaling vertically or horizontally before measuring what's actually slow.** An index or a cache fixes most "add more servers" problems for a fraction of the cost.
- **Keeping per-user state (sessions, uploads, an in-memory cache) on one instance.** Any instance may get any request; state has to live somewhere every instance shares.
- **Putting a dependency check in a liveness probe.** A database blip then restarts every instance at once instead of just routing around the ones affected.
- **Reading a just-written row from a replica and treating missing data as a bug in the write.** It's replication lag; route read-your-writes cases back to the primary.
- **Running serverless functions against a database with no connection pooler in front of it.** Many concurrent invocations each opening their own connection can exhaust PostgreSQL's connection limit long before CPU or memory becomes the bottleneck.
- **Reaching for sharding as a first step.** It's a much bigger commitment (a shard key, cross-shard queries, rebalancing) than the simpler options — indexes, caching, replicas — that usually solve the actual problem.
- **Relying on sticky sessions instead of a shared session store.** It unevenly loads instances and loses the session the moment the pinned instance dies or is scaled down.
`.trim(),
  },
};

const devopsTopic: SeedTopic = {
  slug: "devops",
  title: "Docker, CI/CD, and cloud deployment",
  description: "Containers, pipelines, configuration and safe database migrations.",
  prerequisiteSlugs: ["postgres"],
  lesson: {
    slug: "essentials",
    title: "Docker, CI/CD, and cloud deployment: essentials",
    level: "INTERMEDIATE",
    estimatedMinutes: 20,
    summary:
      "A multi-stage Dockerfile and a green CI pipeline only earn their keep at the one moment that matters — the migration step — where the usual rollback safety net stops applying, because rolling back code is instant but a migration that already changed real data often can't be undone the same way.",
    content: `
- Containers package an app with its dependencies and share the host kernel; VMs virtualize a whole machine.
- Multi-stage Dockerfiles build in one stage and copy only the output into a small runtime image; run as a non-root user.
- CI runs type checks, lint, tests and builds on every change; CD deploys passing builds automatically.
- Configuration and secrets come from the environment, never baked into images or committed to git.
- Run migrations as an explicit release step, and make schema changes backward compatible (**expand → migrate → contract**) so old and new code can run side by side.
`.trim(),
    explanation: `
## Containers vs VMs

A **container** packages an application with its dependencies and runs as an isolated process sharing the host's kernel — fast to start, lightweight, good for many small services. A **virtual machine** virtualizes a whole machine, including its own kernel — stronger isolation, but heavier and slower to start. Most backend deployments today are containers for the app, often running on a platform that handles the VM layer underneath.

## Multi-stage Dockerfiles

Build in one stage — with dev dependencies, a compiler, everything the build needs — then copy only the build output into a slim final stage. The shipped image ends up smaller, starts faster, and has less attack surface than if the build tools came along for the ride. Next.js's own standalone output already traces and copies exactly the \`node_modules\` the app needs into that output, so there's no separate step required to assemble a production-only dependency set. Order layers so dependency installs are cached (copy package files and install before copying source), exclude what doesn't belong with a \`.dockerignore\` (never \`.env\`, never \`.git\`), and run the final container as a non-root user so a compromised app process has less it can do.

Docker's own \`HEALTHCHECK\` should check **liveness**, not readiness: an orchestrator restarts a container that fails it, so a check that depends on the database reproduces exactly the liveness/readiness mistake the load balancing and scalability topic warns about — a database blip now restarts every container at once. A readiness check (can this instance serve traffic right now?) belongs in the orchestrator's own readiness probe configuration, which removes an instance from traffic without restarting it, not in Docker's \`HEALTHCHECK\`.

## CI vs CD, and what blocks a merge

**Continuous integration**: every change is merged frequently and automatically built and tested, so integration problems surface in minutes, not weeks. **Continuous delivery**: every build that passes CI is releasable — a human still presses the button. **Continuous deployment**: that button press happens automatically too. Either way, the gate before merge is the same: type-check, lint, run the test suite (including integration tests against a real database, not just unit tests), and build — catching a mistake in CI costs minutes; catching it in production costs an incident.

## Secrets and config: from the environment, never the repo

Configuration and secrets come from the environment (or a secrets manager) at deploy or runtime — never hardcoded, never committed, never baked into the image itself. The same built image then gets promoted from staging to production unchanged, with only its configuration differing. A secret that does leak into git history is compromised the moment it's pushed, not just if someone notices; rotating it is the only real fix, and deleting the commit afterward is not one.

## Zero-downtime schema changes: expand, migrate, contract

A rolling deploy means old and new code run side by side for a window — which means the database schema has to work for both versions at once, not just the one being deployed. **Expand**: add the new column or table alongside the old one, without touching it. **Migrate**: have the new code write to both, backfill existing rows, and once everything is populated, switch reads over. **Contract**: only once nothing refers to the old shape anymore — often a release or more later — remove it. Renaming a column in one step, or dropping one the same release a new feature needs it gone, breaks whichever version of the code is still running the old query.

## Migrations in the pipeline: migrate deploy, never migrate dev

\`prisma migrate dev\` is a development command — it can generate new migrations from schema drift, and it can decide to reset the database to resolve drift it can't express as a migration. \`prisma migrate deploy\` only applies migrations that are already committed to the repository, generating nothing new — the only one safe to run against a database with real data, and the one CI/CD pipelines should run as an explicit release step, before the new code takes traffic.

## Why a bad migration is harder to walk back than a bad code deploy

Rolling back a bad *code* deploy is close to free: redeploy the previous build, and the old code runs again exactly as it did before. Rolling back a bad *migration* usually isn't, because a migration doesn't just change what code runs — it can change the data itself. Dropping a column, deleting rows, or backfilling a value destructively isn't undone by redeploying old code; the data the old code expected may simply be gone. Expand/contract exists specifically to make this safe: code rollbacks stay free because the expand step never removes anything the previous version needed, and only the final contract step — which should ship well after confidence in the migration is already high — is allowed to be destructive, by which point rolling back isn't really the plan anyway.
`.trim(),
    realWorldExample: `
A pull request triggers CI: install with a lockfile, type-check, lint, run tests against a real Postgres service container (migrated first), build. Merging to main runs the release:
\`\`\`bash
npx prisma migrate deploy   # applies only already-committed migrations — never migrate dev
npm run build
./deploy.sh
./smoke-test.sh || ./rollback.sh
\`\`\`
If the smoke test fails, \`rollback.sh\` redeploys the previous build — instantly safe, *because* the migration that already ran was written expand-first: nothing the previous code needed was removed.

**The expand/contract "migrate" step, in application code**, renaming \`orders.total\` to \`orders.amount\` across a rollout: both columns exist, and the code writes both while some instances are still running code that reads the old one:
\`\`\`ts
await db.order.update({
  where: { id, userId },
  data: { total: amountCents, amount: amountCents }, // write both during the transition
});
\`\`\`
Only once every instance runs code that reads \`amount\` does a later release switch reads over, and a release after *that* drops \`total\` — the destructive step, by which point nothing needs it anymore.
`.trim(),
    codeExample: `
# ---- build: npm ci installs ALL dependencies, including devDependencies — prisma generate
# runs from a postinstall hook, and prisma itself is a devDependency, so --omit=dev would
# break it here. ----
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ---- runtime: Next.js's standalone output already traced and copied exactly the node_modules
# it needs — there's no separate dependency-install step, or node_modules copy, required here. ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Prisma's query engine links against OpenSSL, which the slim base image doesn't include.
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER app
EXPOSE 3000
# Liveness only: "is this process responding at all?" A database-dependent check here would
# make the orchestrator restart every container on a single database blip — the exact
# liveness/readiness mistake the scalability topic warns about. The DB-dependent readiness
# check belongs in the orchestrator's own readiness probe, never in Docker's HEALTHCHECK.
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:3000/api/health/live').then(r=>{if(!r.ok)process.exit(1)})"
CMD ["node", "server.js"]
`.trim(),
    codeLanguage: "BASH",
    commonMistakes: `
- **Running \`prisma migrate dev\` (or any migration-generating command) against a database with real data.** It can decide to reset the database to resolve drift it can't express as a migration.
- **Renaming or dropping a column in the same release that needs the new shape.** A rolling deploy means old code is still querying the old shape while new code expects the new one.
- **Baking secrets or environment-specific config into a container image.** Anyone who can pull the image can read them, and the same image can no longer be promoted unchanged across environments.
- **Skipping the lockfile in CI.** Different dependency versions between CI and anyone's local run undermines the entire point of running tests before merging.
- **Treating a migration rollback like a code rollback.** Redeploying old code doesn't restore a column that already got dropped or data that already got deleted.
- **Putting build-only tooling (the Prisma CLI's dev dependencies, a compiler) in the final runtime image.** It bloats the image and expands what an attacker who compromises the container can do.
- **No smoke test or health check gating a deploy.** A release that's actually broken takes real traffic before anyone notices, instead of being caught and rolled back automatically.
`.trim(),
  },
};

const securityTopic: SeedTopic = {
  slug: "security",
  title: "Backend security",
  description: "Injection, XSS, CSRF, SSRF, secrets and least privilege.",
  prerequisiteSlugs: ["auth"],
  lesson: {
    slug: "essentials",
    title: "Backend security: essentials",
    level: "ADVANCED",
    estimatedMinutes: 22,
    summary:
      "Most backend vulnerabilities are the same shape: trusting something that crossed a boundary — a query built from user input, an id taken at face value, a URL the server is told to fetch — without the one check that would have caught it.",
    content: `
- **SQL injection**: never concatenate input into SQL; use parameterized queries (Prisma does this by default; be careful with raw queries).
- **XSS**: encode output for its context; React escapes by default, so avoid injecting raw HTML. Add a Content Security Policy.
- **CSRF**: SameSite cookies plus CSRF tokens or origin checks for cookie-authenticated state changes.
- **SSRF**: do not let users make your server fetch arbitrary URLs; allowlist destinations and block internal address ranges.
- **Secrets**: keep them out of git, rotate on exposure, and grant each service the least privilege it needs.
`.trim(),
    explanation: `
## SQL injection: parameterized queries, and how Prisma can still reintroduce it

SQL injection happens when user input is concatenated directly into a query's text, letting an attacker's input change the query's *structure*, not just its values. The fix is to never build SQL as a string from untrusted input: parameterized queries (or an ORM's normal query builder) send the values separately from the SQL text, so a value can never become a new clause. Prisma's ordinary methods (\`findMany\`, \`create\`, and so on) are parameterized by default, and so is its tagged-template \`$queryRaw\` — but \`$queryRawUnsafe\`, or any raw SQL built by string interpolation, reintroduces exactly the same vulnerability Prisma otherwise protects against. The one thing that genuinely can't be parameterized — a column name used for dynamic sorting, say — has to be validated against a fixed whitelist instead (the pagination topic covers this for sort fields specifically).

## IDOR: the vulnerability this entire curriculum has been preventing

Insecure Direct Object Reference — accepting an id from the request and looking the row up by that id alone, with no check that the caller actually owns it — is one of the most common real-world vulnerabilities, and also the one this curriculum has been building the instinct against since the authentication and authorization topic: fold ownership into the query itself (\`WHERE id = $1 AND userId = $2\`), return 404 rather than 403 for someone else's resource so existence itself isn't revealed, and never trust an id's unguessability as a substitute for an actual check. Every lesson since that used \`db.order.findFirst({ where: { id, userId } })\` instead of \`findUnique({ where: { id } })\` was practicing the fix for exactly this vulnerability.

## XSS: encoding output for its context

Cross-site scripting gets an attacker's script to run in another user's browser, usually by storing or reflecting unescaped input into a page. React escapes values by default when you render them in JSX — \`{userInput}\` is always safe — but \`dangerouslySetInnerHTML\` is named that way because it bypasses exactly that protection, rendering a string as raw HTML, scripts included, if it ever carries attacker-controlled content. Sanitize anything that genuinely needs to render as HTML (a rich-text editor's output, say) with a dedicated library, never by just trusting the source, and add a Content Security Policy as a second layer that limits what injected script could do even if some output slipped through unescaped.

## CSRF: SameSite cookies help, but aren't the whole story

Cross-site request forgery tricks a logged-in user's browser into sending a state-changing request to your site, with their cookies attached automatically — the attacker's page never needs to read the response, only to make the browser send the request. \`SameSite=Lax\` or \`Strict\` cookies close off a large share of this, but have specific, real gaps worth knowing precisely, not just a vague caveat:

- \`SameSite=Lax\` (the modern default for a cookie that doesn't set the attribute explicitly) still attaches cookies to a **top-level GET navigation** — clicking a link, or an attacker's page redirecting the browser to your site — even though it blocks them on a cross-site POST. This is exactly why a GET must never change state: under \`Lax\`, a state-changing GET is still forgeable.
- \`SameSite\` is defined by **site** (the registrable domain — roughly the effective TLD plus one label), not **origin** (scheme, host and port together). Two different subdomains of the same site — \`a.example.com\` and \`b.example.com\` — are *same-site* to each other, so a vulnerability that lets an attacker run code on one subdomain can still forge a request against a cookie-protected endpoint on the other, with \`SameSite\` offering no protection between them at all.
- Not every client enforces \`SameSite\` the same way — older browsers predate it entirely, and a cookie's effective default can vary by browser and version.

A CSRF token (a value the page must read and echo back, which a forged cross-site request can't do) or an Origin/Referer check on state-changing requests closes these gaps, independent of what any particular browser's cookie policy happens to enforce. None of this applies to APIs authenticated with a bearer token sent in a header instead of a cookie — there's nothing for the browser to attach automatically, so CSRF isn't the same threat there.

## SSRF: letting the server fetch a URL you don't control

Any feature where the server fetches a URL supplied by the user — "import from this link," "fetch this image" — hands the request-maker's network position to whoever controls that URL. Server-side request forgery abuses this to reach internal services, cloud metadata endpoints, or anything else the server can reach but the public internet can't. Mitigate with an allowlist of destinations, resolving DNS and rejecting private/loopback/link-local address ranges (re-checked *after* any redirect, since a redirect can point somewhere the original URL didn't), restricting the allowed protocols, and running the fetch itself with minimal network access.

## CORS is a browser-enforced read restriction, not server-side access control

CORS governs what a browser allows a *different origin's* JavaScript to do with a response — not, in general, what reaches the server. For a "simple" request (a plain GET, or a POST with a basic form content type and no custom headers), the browser sends it and the server processes it exactly as normal; CORS only decides afterward whether the calling page's own script is allowed to *read* the response, hiding it from that script without un-sending the request. For a "non-simple" request — a JSON body (\`Content-Type: application/json\`), a custom header, or a method like PUT/DELETE/PATCH, which covers most real JSON APIs — the browser first sends a preflight \`OPTIONS\` request, and if the server's preflight response doesn't permit the actual method, headers and origin, the browser never sends the real request at all. So CORS *can*, in that specific case, stop a cross-origin browser request from ever reaching the server — but it still isn't access control: a non-browser client (curl, a server-to-server call, Postman) never performs a preflight and never consults a CORS header at all, so CORS stops nothing for any caller that isn't a browser enforcing a policy on itself. The actual access control — authentication, and folding ownership into every query — has to happen on the server regardless of what CORS headers are set.

## Least privilege, and secrets as liabilities

Grant each service, database user, and credential only the permission it actually needs — a database role that can't \`DROP TABLE\`, an API key scoped to one action, a container that doesn't run as root — so a single bug or leaked credential has a limited blast radius instead of an unlimited one. Treat any secret that reaches a public place (committed to git, logged, pasted somewhere public) as compromised the instant it's exposed, not just if misuse is later detected: rotate it immediately, check for signs it was already used, and only then worry about scrubbing the exposure itself.
`.trim(),
    realWorldExample: `
A "download invoice" endpoint originally looked the invoice up by id alone:
\`\`\`ts
// vulnerable: any authenticated user can read any invoice by guessing or incrementing the id
const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
\`\`\`
Folding ownership into the query — the authentication and authorization topic's fix for exactly this — closes it without a separate check to forget:
\`\`\`ts
const invoice = await db.invoice.findFirst({ where: { id: invoiceId, userId } });
if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 }); // not 403 — don't confirm it exists
\`\`\`

**A sort parameter that looks safe until someone builds the query by hand:**
\`\`\`ts
// vulnerable: sortField comes straight from the query string into raw SQL
const rows = await db.$queryRawUnsafe(\`SELECT * FROM invoices ORDER BY \${sortField}\`);
\`\`\`
A fixed map from each allowed value to its own \`Prisma.sql\` fragment closes the injection without ever letting anything user-supplied reach raw SQL text, even after validation:
\`\`\`ts
const SORT_FRAGMENTS = {
  createdAt: Prisma.sql\`"createdAt" DESC\`,
  amountCents: Prisma.sql\`"amountCents" DESC\`,
} as const;
const sort = z.enum(["createdAt", "amountCents"]).catch("createdAt").parse(sortParam);
const rows = await db.$queryRaw\`SELECT * FROM invoices ORDER BY \${SORT_FRAGMENTS[sort]}\`;
\`\`\`

**What CORS does and doesn't do.** A plain GET to \`/api/invoices/42\` from a different user's browser session is a "simple" request — the browser sends it, the server processes it, and \`Access-Control-Allow-Origin: https://app.example.com\` only decides afterward whether a *different* site's own JavaScript would be allowed to *read* the response. A JSON POST to the same endpoint from another origin is "non-simple" — the browser preflights it first, and a mismatched origin means the browser never sends the real request at all. Either way, curl, Postman, or any server-to-server call was never subject to CORS in the first place. The actual access control still has to be the \`userId\` check above; CORS was never going to provide it.
`.trim(),
    codeExample: `
// app/api/invoices/[id]/route.ts
// A route file may only export HTTP method handlers (GET, POST, ...) — a differently-named
// export like listInvoices would break the build, which is why the list endpoint below lives
// in its own route file instead of a second export here.
import { NextResponse } from "next/server";

// GET /api/invoices/[id] — ownership folded into the lookup; IDOR has nothing to exploit here.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId(req);

  const invoice = await db.invoice.findFirst({ where: { id, userId } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 }); // not 403
  return NextResponse.json(invoice);
}

// app/api/invoices/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

// A fixed map from each allowed sort value to its own SQL fragment — not a validated string
// handed to Prisma.raw. Nothing user-supplied ever reaches raw SQL text, not even after
// validation, because the only values that can appear here are the ones written on this map.
const SORT_FRAGMENTS = {
  createdAt: Prisma.sql\`"createdAt" DESC\`,
  amountCents: Prisma.sql\`"amountCents" DESC\`,
} as const;
const listInvoicesSchema = z.object({ sort: z.enum(["createdAt", "amountCents"]).default("createdAt") });

// GET /api/invoices?sort=createdAt
export async function GET(req: Request) {
  const userId = await requireUserId(req);
  const { searchParams } = new URL(req.url);
  const parsed = listInvoicesSchema.safeParse({ sort: searchParams.get("sort") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const rows = await db.$queryRaw\`
    SELECT * FROM invoices WHERE "userId" = \${userId} ORDER BY \${SORT_FRAGMENTS[parsed.data.sort]}
  \`;
  return NextResponse.json(rows);
}
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Building SQL by concatenating or interpolating user input**, including via Prisma's \`$queryRawUnsafe\` or \`Prisma.raw\` on an unvalidated value. The exact mechanism changes; the vulnerability doesn't.
- **Looking a resource up by id alone and trusting that an id is unguessable instead of actually checking ownership.** IDOR — an id being hard to guess is not a security control.
- **Returning 403 instead of 404 for someone else's resource.** A 403 confirms the resource exists; a 404 doesn't.
- **Rendering untrusted content with \`dangerouslySetInnerHTML\` (or any raw-HTML sink) without sanitizing it first.** React's default escaping doesn't apply once you've explicitly opted out of it.
- **Changing state on a GET request, or treating \`SameSite\` alone as a complete CSRF defense.** \`Lax\` still attaches cookies to a top-level GET navigation, and \`SameSite\` is scoped to *site*, not *origin* — sibling subdomains are unprotected from each other. Add a token or an origin check too.
- **Letting a server fetch an arbitrary user-supplied URL with no allowlist or address-range check.** SSRF — and a check before the first request doesn't cover where a redirect leads.
- **Treating a permissive CORS header as if it were a general access-control mechanism.** It can stop a non-simple cross-origin browser request (JSON body, custom headers) at the preflight — but a simple request still reaches the server either way, and any non-browser client never consults CORS at all.
- **Hashing passwords with a fast, general-purpose hash (SHA-256, MD5) instead of a slow password-hashing algorithm.** Covered in depth — bcrypt, Argon2id, and why speed is the wrong property to optimize for here — in the authentication and authorization topic.
`.trim(),
  },
};

const systemDesignTopic: SeedTopic = {
  slug: "system-design",
  title: "System design fundamentals",
  description: "Requirements, estimation, trade-offs and the building blocks of large systems.",
  prerequisiteSlugs: ["scalability", "observability"],
  lesson: {
    slug: "essentials",
    title: "System design fundamentals: essentials",
    level: "ADVANCED",
    estimatedMinutes: 25,
    summary:
      "A system-design answer isn't a lucky guess at the right architecture — it's a structured walk from requirements to a design to its weakest point, in that order, reusing the patterns (caching, queues, replicas, idempotency) the rest of this curriculum already built rather than inventing new ones.",
    content: `
A good system-design answer is a structured conversation:

1. Clarify functional and non-functional requirements (scale, latency, consistency, availability).
2. Estimate load: requests per second, storage growth, read/write ratio.
3. Sketch the high-level design: clients, load balancer, stateless services, databases, caches, queues.
4. Dive into the hardest parts: data model, hot spots, failure modes.
5. Discuss trade-offs explicitly — consistency vs availability during partitions, cost vs latency, simplicity vs flexibility.

Know the vocabulary: SLI/SLO/SLA, replication vs sharding, CAP, idempotency, back-pressure.
`.trim(),
    explanation: `
## The structure: requirements → estimates → API → data model → bottlenecks → trade-offs

A system-design answer is a structured conversation, not a monologue about a remembered architecture diagram. Work through, roughly in order: clarify what's actually being asked for; estimate the load; sketch the API and the data it implies; find where that design would actually struggle; and discuss the trade-offs the design makes, explicitly, rather than presenting one option as if it had none. Skipping straight to a diagram tends to produce a design for a system that was never actually specified.

## Functional vs non-functional requirements

Functional requirements are what the system does: a user can shorten a URL, follow a short link, see analytics. Non-functional requirements are the constraints that shape *how*: how many requests per second, how much latency is acceptable, how consistent does it need to be, what happens during a partition, how available does it need to be. Two systems with identical functional requirements can need completely different architectures once the non-functional ones differ — ask about scale and consistency needs before designing anything.

## Back-of-the-envelope estimates, done correctly

Rough numbers decide which problems actually matter. 10 million daily active users, each making 20 requests a day, is 200 million requests per day; divided by roughly 86,400 seconds in a day, that's a little over 2,300 requests per second on average — and real traffic isn't flat, so peak load is usually several times the average, not the same number. Getting the arithmetic right matters more than the specific numbers: an estimate that's internally inconsistent undermines everything built on it, while a rough-but-correct one tells you right away whether one database is plausible or whether caching, replicas, or more are already necessary before writing a line of code.

## Sketching the API and data model

A handful of endpoints and the tables or documents behind them usually says more than a paragraph of prose — what does the client actually call, and what does the data look like at rest? This is also where earlier topics' patterns show up concretely: pagination's cursor shape for a list endpoint, idempotency keys on anything that creates a resource, ownership folded into every lookup from the start rather than bolted on later.

## Finding the bottleneck, and reusing patterns instead of inventing them

Every design has a part that will struggle first under real load — a hot row, a fan-out write, a query that gets slower as a table grows. Naming it, and explaining the fix, is the part of the conversation that actually differentiates answers — and the fixes themselves are rarely novel: caching absorbs read load, a queue absorbs write bursts and decouples producers from slow consumers, a read replica spreads read traffic (with its lag handled explicitly), an idempotency key makes a retried write safe, an index turns a table scan into a lookup. Reaching for these familiar tools, applied to the specific bottleneck just identified, reads as stronger than inventing something new mid-conversation.

## Trade-offs, stated explicitly, not glossed over

Every real design choice trades something for something else: consistency for availability during a partition (CAP), latency for durability (how many replicas must confirm a write before it's acknowledged), simplicity for flexibility (one big table vs. several normalized ones), cost for performance (a cache vs. recomputing). Naming the trade-off explicitly — "this means a reader might see stale data for up to N seconds, which is acceptable here because..." — is a stronger answer than presenting the choice as though it had no downside.

## The vocabulary interviewers expect

SLI/SLO/SLA (what's measured, the target for it, and the contractual consequence of missing it); replication vs. sharding (copying the same data for availability and read scaling, versus splitting different data across nodes for write scaling); CAP (consistency vs. availability, only during an actual partition); back-pressure (a slow consumer making a producer slow down or buffer, rather than being overwhelmed). Using the right word for a concept signals an actual mental model, not a memorized diagram.
`.trim(),
    realWorldExample: `
A URL shortener: users submit a URL and get a short code back; anyone following the code is redirected, with low latency, at a much higher read volume than writes.

**Requirements.** Functional: create a short link, optionally with a custom alias; follow it and get redirected; see click counts. Non-functional: reads vastly outnumber writes, redirects need to be fast, and losing a few minutes of click analytics during an incident is fine — strong consistency on clicks isn't worth the cost here.

**Estimate.** 100 million clicks a day is roughly 1,150 per second on average (100,000,000 ÷ 86,400), several times that at peak — comfortably cacheable, nowhere near needing to shard reads across multiple databases yet.

**API and data model.** \`POST /links { url, alias? }\` → \`{ code }\`; \`GET /{code}\` → a redirect. The data model is almost exactly one table:
\`\`\`sql
CREATE TABLE links (
  id                bigserial PRIMARY KEY,
  code              text NOT NULL UNIQUE,
  "destinationUrl"  text NOT NULL,
  "ownerId"         text NOT NULL,
  "createdAt"       timestamptz NOT NULL DEFAULT now()
);
-- "My links, newest first" — the pagination topic's leftmost-prefix composite index.
CREATE INDEX links_ownerId_createdAt_idx ON links ("ownerId", "createdAt" DESC);
\`\`\`
Every one of this curriculum's earlier lessons about folding ownership into a query applies the moment "see my own links" becomes a requirement.

**Bottleneck.** Reads, not writes — every redirect is a read. The pagination topic's composite-index reasoning applies directly to "list my links, newest first"; the caching topic's cache-aside pattern applies directly to "look up a code's destination," since a code's destination essentially never changes once created; the rate-limiting topic applies directly to "stop one client from creating links faster than legitimate use would."

**Trade-off: exact clicks vs a fast redirect.** Recording a click is a write on every single read-path request, which would make the redirect's hot path exactly as slow as the one thing meant to be fast. Decoupling it — publish a click event onto a queue (the background jobs topic) and aggregate counts asynchronously — trades exact, immediate click counts for a redirect that stays fast, which is the right trade for this feature specifically: nobody is making a financial decision based on a click count being accurate to the second.

**Trade-off: 301 vs 302.** A 301 (permanent) redirect gets cached by the browser itself, so a repeat visit to the same short link never even reaches the server again — faster for the user, but every one of those repeat clicks is invisible to click analytics and to a link the owner later wants to repoint. A 302 (temporary) keeps every click passing through the service, at the cost of one more request each time.
`.trim(),
    codeExample: `
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const createLinkSchema = z.object({
  url: z.string().url().refine((u) => ["http:", "https:"].includes(new URL(u).protocol), {
    message: "Only http and https URLs are allowed",
  }),
});

function generateShortCode() {
  return Math.random().toString(36).slice(2, 8); // illustrative — a real generator wants more entropy
}

const MAX_CODE_ATTEMPTS = 5;

// POST /api/links — ownerId comes from the session, never the request body.
export async function POST(req: Request) {
  const ownerId = await requireUserId(req);
  const parsed = createLinkSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    try {
      const link = await db.link.create({
        data: { code: generateShortCode(), destinationUrl: parsed.data.url, ownerId },
      });
      return NextResponse.json({ code: link.code }, { status: 201 });
    } catch (err) {
      // A random code colliding with an existing one is rare but expected eventually — retry
      // with a fresh code a bounded number of times rather than failing the whole request.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  return NextResponse.json({ error: "Could not generate a unique code, try again" }, { status: 503 });
}
`.trim(),
    codeLanguage: "TYPESCRIPT",
    commonMistakes: `
- **Jumping straight to a detailed architecture without clarifying requirements first.** A design for 1,000 users and one for 100 million users look nothing alike, and guessing which one was asked for wastes the rest of the conversation.
- **Back-of-envelope arithmetic that doesn't actually check out.** The specific numbers matter less than whether they're internally consistent — bad arithmetic undermines every conclusion built on it.
- **Treating peak load as equal to the average.** Real traffic has peaks several times the average, and a design sized only for the average falls over exactly when it matters.
- **Reaching for sharding, a new database technology, or a novel algorithm before exhausting the familiar tools.** Caching, queues, indexes and replicas solve most real bottlenecks and are far better understood than something invented on the spot.
- **Presenting a design choice as if it had no downside.** Every real trade-off costs something; naming the cost is what makes an answer credible instead of a sales pitch for one option.
- **Skipping the data model and jumping to infrastructure.** The hardest and most revealing part of most designs is what the data actually looks like and how it's queried, not which cloud service hosts it.
- **Using "idempotency," "replication," "sharding" and similar words as decoration instead of precisely.** This curriculum's own topics on each cover exactly what the words mean and when each applies.
`.trim(),
  },
};

const topics: SeedTopic[] = [
  httpTopic,
  restTopic,
  jsTsTopic,
  nodeAsyncTopic,
  authTopic,
  postgresTopic,
  prismaTopic,
  joinsIndexesTopic,
  transactionsTopic,
  paginationTopic,
  cachingTopic,
  rateLimitingTopic,
  jobsQueuesTopic,
  idempotencyTopic,
  webhooksTopic,
  concurrencyTopic,
  isolationLockingTopic,
  observabilityTopic,
  scalabilityTopic,
  devopsTopic,
  securityTopic,
  systemDesignTopic,
];

export const curriculum = { track: tracks[0]!, topics };
