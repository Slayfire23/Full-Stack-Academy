import { NextResponse } from "next/server";
import type { z } from "zod";
import { fieldErrors } from "@/lib/validation/schemas";
import { GradingError } from "@/lib/adaptive/grading";
import { log } from "./log";

/**
 * Consistent API error handling.
 *
 * Every route handler is wrapped in `route()`. Errors become JSON of the shape
 *   { error: { message, code, details? }, requestId }
 * with the right status code. Unexpected errors are logged with the request id and the
 * client only sees a generic message.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string = "error",
    readonly details?: unknown,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const http = {
  badRequest: (msg = "Bad request", details?: unknown) => new HttpError(400, msg, "bad_request", details),
  unauthorized: (msg = "Sign in to continue") => new HttpError(401, msg, "unauthorized"),
  forbidden: (msg = "You do not have permission to do that") => new HttpError(403, msg, "forbidden"),
  notFound: (what = "Resource") => new HttpError(404, `${what} not found`, "not_found"),
  conflict: (msg: string, details?: unknown) => new HttpError(409, msg, "conflict", details),
  unprocessable: (msg: string, details?: unknown) => new HttpError(422, msg, "invalid", details),
  tooMany: (retryAfterSeconds: number) =>
    new HttpError(429, "Too many requests — please slow down", "rate_limited", { retryAfterSeconds }, {
      "Retry-After": String(retryAfterSeconds),
    }),
  unavailable: (msg: string) => new HttpError(503, msg, "unavailable"),
};

type Params = Record<string, string | string[]>;
export interface RouteContext<P extends Params> {
  params: P;
  requestId: string;
}

export function route<P extends Params = Record<string, never>>(
  handler: (req: Request, ctx: RouteContext<P>) => Promise<unknown>,
) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    const requestId = sanitizeRequestId(req.headers.get("x-request-id")) ?? crypto.randomUUID();
    const started = Date.now();
    try {
      const params = ((await ctx.params) ?? {}) as P;
      const result = await handler(req, { params, requestId });
      const res = result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
      res.headers.set("x-request-id", requestId);
      return res;
    } catch (err) {
      return toErrorResponse(err, requestId, req, started);
    }
  };
}

function sanitizeRequestId(v: string | null) {
  return v && /^[A-Za-z0-9-]{8,64}$/.test(v) ? v : null;
}

function isZodError(err: unknown): err is { issues: { path: PropertyKey[]; message: string }[] } {
  return typeof err === "object" && err !== null && (err as { name?: string }).name === "ZodError" && Array.isArray((err as { issues?: unknown }).issues);
}

function prismaCode(err: unknown): string | undefined {
  const code = (err as { code?: unknown })?.code;
  return typeof code === "string" && /^P\d{4}$/.test(code) ? code : undefined;
}

export function toErrorResponse(err: unknown, requestId: string, req?: Request, started?: number): Response {
  let status = 500;
  let body: { message: string; code: string; details?: unknown } = { message: "Something went wrong", code: "internal" };
  let headers: Record<string, string> | undefined;

  if (err instanceof HttpError) {
    status = err.status;
    body = { message: err.message, code: err.code, details: err.details };
    headers = err.headers;
  } else if (isZodError(err)) {
    status = 422;
    body = { message: "Some fields are invalid", code: "invalid", details: fieldErrors(err.issues) };
  } else if (err instanceof GradingError) {
    status = 422;
    body = { message: err.message, code: "invalid_answer" };
  } else if (prismaCode(err) === "P2002") {
    status = 409;
    body = { message: "That already exists", code: "conflict" };
  } else if (prismaCode(err) === "P2025") {
    status = 404;
    body = { message: "Not found", code: "not_found" };
  }

  if (status >= 500) {
    log.error("request_failed", {
      requestId,
      method: req?.method,
      path: req ? new URL(req.url).pathname : undefined,
      durationMs: started ? Date.now() - started : undefined,
      error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
    });
  }

  const res = NextResponse.json({ error: body, requestId }, { status });
  res.headers.set("x-request-id", requestId);
  for (const [k, v] of Object.entries(headers ?? {})) res.headers.set(k, v);
  return res;
}

const MAX_BODY_BYTES = 1_000_000;

/** Parse and validate a JSON body: 415/413/400 for transport problems, 422 for invalid content. */
export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S, maxBytes = MAX_BODY_BYTES): Promise<z.output<S>> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Send JSON with Content-Type: application/json", "unsupported_media_type");
  }
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new HttpError(413, "Request body too large", "payload_too_large");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request body too large", "payload_too_large");
  let json: unknown;
  try {
    json = text.length === 0 ? {} : JSON.parse(text);
  } catch {
    throw http.badRequest("Malformed JSON body");
  }
  return schema.parse(json); // ZodError → 422 via toErrorResponse
}

export function parseQuery<S extends z.ZodTypeAny>(req: Request, schema: S): z.output<S> {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  return schema.parse(params);
}

export function clientIp(req: Request): string {
  // Only trustworthy when set by your own proxy / platform (Vercel, a load balancer). See ARCHITECTURE.md.
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown").slice(0, 64);
}
