// Applies migrations to DATABASE_URL_TEST. Works the same in PowerShell, cmd and bash:
//   npm run db:test:migrate
import { spawnSync } from "node:child_process";
import { loadEnv } from "./env.mjs";

loadEnv();
const url = process.env.DATABASE_URL_TEST;
if (!url) {
  console.error("DATABASE_URL_TEST is not set (add it to .env).");
  process.exit(1);
}
const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  // Prisma CLI commands read DIRECT_URL (see prisma/schema.prisma's datasource block), not just
  // DATABASE_URL — leaving it unset here would fall through to .env's DIRECT_URL and migrate Supabase.
  env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
});
process.exit(r.status ?? 1);
