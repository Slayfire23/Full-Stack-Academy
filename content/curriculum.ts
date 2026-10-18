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

const topics: SeedTopic[] = [
  httpTopic,
  restTopic,
  jsTsTopic,
  nodeAsyncTopic,
  authTopic,
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
