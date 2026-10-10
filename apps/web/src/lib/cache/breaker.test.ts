import { describe, expect, it } from "vitest";
import { RateLimitBreaker } from "./breaker";
import { MemoryStore } from "./store";

describe("RateLimitBreaker", () => {
  it("is closed by default, opens until the reset time, then closes", async () => {
    let now = 1_000;
    const breaker = new RateLimitBreaker(new MemoryStore(10, () => now), () => now);

    expect(await breaker.openUntil("server")).toBeNull();
    await breaker.trip("server", 61_000);
    expect(await breaker.openUntil("server")).toBe(61_000);
    expect(await breaker.openUntil("other")).toBeNull();

    now = 61_000;
    expect(await breaker.openUntil("server")).toBeNull();
  });

  it("ignores reset times in the past", async () => {
    const breaker = new RateLimitBreaker(new MemoryStore(), () => 5_000);
    await breaker.trip("server", 4_000);
    expect(await breaker.openUntil("server")).toBeNull();
  });

  it("hashes tokens into short opaque ids", () => {
    const id = RateLimitBreaker.tokenId("ghp_secret");
    expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(id).not.toContain("secret");
    expect(RateLimitBreaker.tokenId("ghp_secret")).toBe(id);
  });
});
