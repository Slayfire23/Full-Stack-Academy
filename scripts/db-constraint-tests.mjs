// Runs tests/db/constraints.sql against the test database.
// Uses the Docker Compose database by default; set PSQL=local to use a psql on your PATH.
//   npm run test:db
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { loadEnv } from "./env.mjs";

loadEnv();
// constraints.sql inserts fixtures with fixed ids ('u1', 't1', ...) inside one rolled-back
// transaction, which only works against an empty database — leftover rows (e.g. from a test
// run that crashed before vitest's afterAll cleanup ran) collide with those ids instead of
// failing cleanly. Guard for that first, read-only, before the real test transaction begins.
const guard = `
DO $$
DECLARE r record; total bigint := 0; cnt bigint;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('SELECT count(*) FROM %I', r.tablename) INTO cnt;
    total := total + cnt;
  END LOOP;
  IF total > 0 THEN
    RAISE EXCEPTION 'test DB not empty (% row(s) across public tables) — run npm test once (it resets the DB when it finishes) or npm run db:test:migrate after dropping the schema, then re-run npm run test:db', total;
  END IF;
END $$;
`;
const sql = guard + readFileSync("tests/db/constraints.sql", "utf8");
// psql's URI parser rejects Prisma-only query params (e.g. ?schema=public) with
// "invalid URI query parameter", so they're stripped before being passed to a real psql.
const localUrl = (process.env.DATABASE_URL_TEST ?? "").replace(/\?.*$/, "");
const args =
  process.env.PSQL === "local"
    ? ["psql", [localUrl, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"]]
    : ["docker", ["compose", "exec", "-T", "db", "psql", "-U", "postgres", "-d", "full_stack_academy_test", "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"]];
const r = spawnSync(args[0], args[1], { input: sql, encoding: "utf8", shell: process.platform === "win32" });
const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
const passed = (out.match(/ok {3}/g) ?? []).length;
for (const line of out.split(/\r?\n/)) if (/ok {3}|FAIL|ERROR/.test(line)) console.log(line.replace(/^.*NOTICE:\s*/, ""));
console.log(r.status === 0 ? `\n${passed} database constraint checks passed.` : "\nDatabase constraint tests FAILED.");
process.exit(r.status ?? 1);
