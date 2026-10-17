import { prisma } from "@/server/db";
import { route, http } from "@/server/http";

/** Liveness + database connectivity. Used by Docker HEALTHCHECK and uptime monitors. */
export const dynamic = "force-dynamic";
export const GET = route(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    throw http.unavailable("Database unreachable");
  }
  return { status: "ok", database: "up", time: new Date().toISOString() };
});
