// `next.config.ts` sets `output: "standalone"`, which `next start` does not support (it warns
// and serves an incomplete app — static assets are missing). This mirrors what the Dockerfile
// does for the same build: copy the static assets next to the standalone server, then run it.
import { cpSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (!existsSync(".next/standalone/server.js")) {
  console.error("No standalone build found. Run `npm run build` first.");
  process.exit(1);
}
if (!existsSync(".next/standalone/.next/static")) {
  cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
}
if (existsSync("public") && !existsSync(".next/standalone/public")) {
  cpSync("public", ".next/standalone/public", { recursive: true });
}

const r = spawnSync(process.execPath, [".next/standalone/server.js"], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
