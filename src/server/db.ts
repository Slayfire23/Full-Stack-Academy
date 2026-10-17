import { PrismaClient } from "@prisma/client";

/**
 * One PrismaClient per process. In development, Next.js hot reloading re-imports modules,
 * so the instance is cached on globalThis to avoid opening a new connection pool each time.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
