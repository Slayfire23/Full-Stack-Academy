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
