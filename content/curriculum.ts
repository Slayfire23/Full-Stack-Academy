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
