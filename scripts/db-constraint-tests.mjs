// Runs tests/db/constraints.sql against the test database.
// Uses the Docker Compose database by default; set PSQL=local to use a psql on your PATH.
//   npm run test:db
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { loadEnv } from "./env.mjs";

loadEnv();
const sql = readFileSync("tests/db/constraints.sql");
const args =
  process.env.PSQL === "local"
    ? ["psql", [process.env.DATABASE_URL_TEST ?? "", "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"]]
    : ["docker", ["compose", "exec", "-T", "db", "psql", "-U", "postgres", "-d", "backend_academy_test", "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"]];
const r = spawnSync(args[0], args[1], { input: sql, encoding: "utf8", shell: process.platform === "win32" });
const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
const passed = (out.match(/ok {3}/g) ?? []).length;
for (const line of out.split(/\r?\n/)) if (/ok {3}|FAIL|ERROR/.test(line)) console.log(line.replace(/^.*NOTICE:\s*/, ""));
console.log(r.status === 0 ? `\n${passed} database constraint checks passed.` : "\nDatabase constraint tests FAILED.");
process.exit(r.status ?? 1);
