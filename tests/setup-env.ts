/**
 * Loads .env and .env.test (without a dotenv dependency) and points Prisma at the TEST database.
 * Integration tests are skipped when DATABASE_URL_TEST is not set.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const file of [".env", ".env.test"]) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    const value = m[2]!.replace(/^["']|["']$/g, "");
    if (process.env[m[1]!] === undefined || file === ".env.test") process.env[m[1]!] = value;
  }
}

if (process.env.DATABASE_URL_TEST) {
  if (process.env.DATABASE_URL_TEST === process.env.DATABASE_URL && !process.env.CI) {
    throw new Error("DATABASE_URL_TEST must differ from DATABASE_URL — integration tests delete data.");
  }
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}
// Never call a real AI provider from tests.
delete process.env.AI_API_KEY;
