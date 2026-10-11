import { describe, expect, it } from "vitest";
import { LookupLimitError } from "@/lib/github/errors";
import { LookupLimiter } from "./lookup-limiter";
import { MemoryStore } from "./store";

function setup(limit: number, windowSeconds = 600) {
  let now = 1_800_000_000_000;
  const store = new MemoryStore(100, () => now);
  const limiter = new LookupLimiter(store, { limit, windowSeconds }, () => now);
  return { limiter, store, advance: (ms: number) => (now += ms), now: () => now };
}

describe("LookupLimiter", () => {
  it("allows up to the limit, then throws with the window's reset time", async () => {
    const { limiter, now } = setup(3);
    for (let i = 0; i < 3; i++) await limiter.consume("ip:1.2.3.4");

    const error = await limiter.consume("ip:1.2.3.4").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LookupLimitError);
    const windowMs = 600_000;
    expect((error as LookupLimitError).retryAt).toBe((Math.floor(now() / windowMs) + 1) * windowMs);
  });

  it("counts each visitor separately", async () => {
    const { limiter } = setup(1);
    await limiter.consume("ip:1.1.1.1");
    await expect(limiter.consume("ip:2.2.2.2")).resolves.toBeUndefined();
    await expect(limiter.consume("ip:1.1.1.1")).rejects.toBeInstanceOf(LookupLimitError);
  });

  it("starts fresh in the next window", async () => {
    const { limiter, advance } = setup(1, 60);
    await limiter.consume("ip:1.1.1.1");
    await expect(limiter.consume("ip:1.1.1.1")).rejects.toBeInstanceOf(LookupLimitError);
    advance(60_000);
    await expect(limiter.consume("ip:1.1.1.1")).resolves.toBeUndefined();
  });

  it("is disabled when the limit is 0", async () => {
    const { limiter } = setup(0);
    expect(limiter.enabled).toBe(false);
    for (let i = 0; i < 50; i++) await limiter.consume("ip:1.1.1.1");
  });

  it("never stores the raw subject", async () => {
    const keys: string[] = [];
    const store = new MemoryStore();
    const original = store.increment.bind(store);
    store.increment = (key, ttl) => {
      keys.push(key);
      return original(key, ttl);
    };
    await new LookupLimiter(store, { limit: 5, windowSeconds: 60 }).consume("ip:203.0.113.7");
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^lookups:[0-9a-f]{16}:\d+$/);
    expect(keys[0]).not.toContain("203.0.113.7");
  });
});
