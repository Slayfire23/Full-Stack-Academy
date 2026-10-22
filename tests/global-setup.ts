/**
 * Vitest globalSetup: `setup` runs once in the main process before any test file starts, and
 * `teardown` runs once after every test file has finished — unlike tests/setup-env.ts, a
 * `setupFiles` entry that reloads per test file. Used here only for final test-DB cleanup, so a
 * run whose last file leaves rows behind doesn't surprise `npm run test:db` afterwards.
 *
 * This runs in the main process, separate from the worker(s) that run the actual tests, so it
 * loads .env/.env.test itself rather than relying on anything tests/setup-env.ts has set.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(file: string) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    const value = m[2]!.replace(/^["']|["']$/g, "");
    if (process.env[m[1]!] === undefined || file === ".env.test") process.env[m[1]!] = value;
  }
}

export async function setup() {
  loadEnvFile(".env");
  loadEnvFile(".env.test");
}

export async function teardown() {
  if (!process.env.DATABASE_URL_TEST) return;
  // Same guard as tests/setup-env.ts: refuse to touch anything if DATABASE_URL_TEST isn't
  // actually a separate database from DATABASE_URL.
  if (process.env.DATABASE_URL_TEST === process.env.DATABASE_URL && !process.env.CI) {
    throw new Error("DATABASE_URL_TEST must differ from DATABASE_URL — integration tests delete data.");
  }
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  process.env.DIRECT_URL = process.env.DATABASE_URL_TEST;

  const { resetDb } = await import("./integration/helpers");
  await resetDb();
}
