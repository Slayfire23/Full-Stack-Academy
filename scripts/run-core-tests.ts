/**
 * Runs tests/unit/*.test.ts with node:test (via the vitest shim), no npm install required.
 *   npx tsx --tsconfig tsconfig.core.json scripts/run-core-tests.ts
 * `npm test` runs the same files under real Vitest once dependencies are installed.
 */
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const dir = resolve(process.cwd(), "tests", "unit");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".test.ts"))
  .sort();

void (async () => {
  for (const f of files) {
    try {
      await import(pathToFileURL(join(dir, f)).href);
    } catch (e) {
      // Before `npm install`, files that need a real dependency (e.g. zod) are skipped, not failed.
      const code = (e as { code?: string }).code;
      if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
        console.warn(`# skipped ${f}: ${(e as Error).message.split("\n")[0]}`);
        continue;
      }
      throw e;
    }
  }
})();
