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
  env: { ...process.env, DATABASE_URL: url },
});
process.exit(r.status ?? 1);
