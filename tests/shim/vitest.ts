/**
 * Minimal stand-in for the `vitest` API, backed by node:test + node:assert.
 *
 * Only used by `npm run test:core` (tsconfig.core.json maps "vitest" here) so the pure engine
 * tests can run with nothing but Node + tsx. `npm test` runs the very same files under real Vitest.
 * Supports the subset of matchers the unit tests use.
 */
import { describe as nDescribe, it as nIt, beforeEach as nBeforeEach } from "node:test";
import assert from "node:assert/strict";

export const describe = nDescribe;
export const it = nIt;
export const test = nIt;
export const beforeEach = nBeforeEach;

type Matchers = {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toStrictEqual(expected: unknown): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  toBeGreaterThan(n: number): void;
  toBeGreaterThanOrEqual(n: number): void;
  toBeLessThan(n: number): void;
  toBeLessThanOrEqual(n: number): void;
  toBeCloseTo(n: number, digits?: number): void;
  toContain(item: unknown): void;
  toHaveLength(n: number): void;
  toMatch(re: RegExp | string): void;
  toThrow(match?: RegExp | string | (new (...args: never[]) => Error)): void;
};

function build(actual: unknown, negate: boolean): Matchers {
  const check = (pass: boolean, message: string) => {
    if (pass === negate) assert.fail(`${negate ? "NOT " : ""}${message}`);
  };
  const fmt = (v: unknown) => {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };
  const deepEq = (a: unknown, b: unknown) => {
    try {
      assert.deepStrictEqual(a, b);
      return true;
    } catch {
      return false;
    }
  };
  return {
    toBe: (e) => check(Object.is(actual, e), `expected ${fmt(actual)} to be ${fmt(e)}`),
    toEqual: (e) => check(deepEq(actual, e), `expected ${fmt(actual)} to equal ${fmt(e)}`),
    toStrictEqual: (e) => check(deepEq(actual, e), `expected ${fmt(actual)} to strictly equal ${fmt(e)}`),
    toBeTruthy: () => check(Boolean(actual), `expected ${fmt(actual)} to be truthy`),
    toBeFalsy: () => check(!actual, `expected ${fmt(actual)} to be falsy`),
    toBeNull: () => check(actual === null, `expected ${fmt(actual)} to be null`),
    toBeUndefined: () => check(actual === undefined, `expected ${fmt(actual)} to be undefined`),
    toBeDefined: () => check(actual !== undefined, `expected value to be defined`),
    toBeGreaterThan: (n) => check((actual as number) > n, `expected ${fmt(actual)} > ${n}`),
    toBeGreaterThanOrEqual: (n) => check((actual as number) >= n, `expected ${fmt(actual)} >= ${n}`),
    toBeLessThan: (n) => check((actual as number) < n, `expected ${fmt(actual)} < ${n}`),
    toBeLessThanOrEqual: (n) => check((actual as number) <= n, `expected ${fmt(actual)} <= ${n}`),
    toBeCloseTo: (n, digits = 2) =>
      check(Math.abs((actual as number) - n) < Math.pow(10, -digits) / 2, `expected ${fmt(actual)} ≈ ${n}`),
    toContain: (item) =>
      check(
        typeof actual === "string"
          ? actual.includes(String(item))
          : Array.isArray(actual) && actual.some((x) => Object.is(x, item) || deepEq(x, item)),
        `expected ${fmt(actual)} to contain ${fmt(item)}`,
      ),
    toHaveLength: (n) => check((actual as { length: number })?.length === n, `expected length ${(actual as { length?: number })?.length} to be ${n}`),
    toMatch: (re) => check(typeof actual === "string" && new RegExp(re).test(actual), `expected ${fmt(actual)} to match ${re}`),
    toThrow: (match) => {
      let threw = false;
      let err: unknown;
      try {
        (actual as () => unknown)();
      } catch (e) {
        threw = true;
        err = e;
      }
      const msg = (err as Error)?.message ?? String(err);
      const ok =
        threw &&
        (match === undefined ||
          (typeof match === "function" ? err instanceof match : new RegExp(match).test(msg)));
      check(ok, `expected function to throw${match ? ` matching ${typeof match === "function" ? match.name : match}` : ""}${threw ? ` (threw: ${msg})` : ""}`);
    },
  };
}

type Expect = Matchers & { not: Matchers; rejects: { toThrow(match?: RegExp | string): Promise<void> } };

export function expect(actual: unknown): Expect {
  return Object.assign(build(actual, false), {
    not: build(actual, true),
    rejects: {
      async toThrow(match?: RegExp | string) {
        try {
          await (actual as Promise<unknown>);
        } catch (e) {
          const msg = (e as Error)?.message ?? String(e);
          if (match !== undefined && !new RegExp(match).test(msg))
            assert.fail(`expected rejection matching ${match}, got: ${msg}`);
          return;
        }
        assert.fail("expected promise to reject");
      },
    },
  });
}
