import { describe, expect, it, vi } from "vitest";
import { MemoryStore, type RedisLike, RedisStore } from "./store";

describe("MemoryStore", () => {
  it("expires entries after their TTL", async () => {
    let now = 0;
    const store = new MemoryStore(10, () => now);
    await store.set("k", "v", 10);
    now = 9_999;
    expect(await store.get("k")).toBe("v");
    now = 10_000;
    expect(await store.get("k")).toBeNull();
  });

  it("evicts the least recently used entry when full", async () => {
    const store = new MemoryStore(2);
    await store.set("a", "1", 60);
    await store.set("b", "2", 60);
    await store.get("a");
    await store.set("c", "3", 60);
    expect(await store.get("a")).toBe("1");
    expect(await store.get("b")).toBeNull();
    expect(store.size).toBe(2);
  });

  it("deletes entries", async () => {
    const store = new MemoryStore();
    await store.set("a", "1", 60);
    await store.delete("a");
    expect(await store.get("a")).toBeNull();
  });
});

describe("RedisStore", () => {
  it("passes TTLs to Redis as whole seconds", async () => {
    const redis = { get: vi.fn(), set: vi.fn(async () => "OK"), del: vi.fn() } satisfies RedisLike;
    await new RedisStore(redis).set("k", "v", 1.2);
    expect(redis.set).toHaveBeenCalledWith("k", "v", "EX", 2);
  });

  it("falls back to memory when Redis fails, logging once", async () => {
    const failing: RedisLike = {
      get: async () => {
        throw new Error("ECONNREFUSED");
      },
      set: async () => {
        throw new Error("ECONNREFUSED");
      },
      del: async () => {
        throw new Error("ECONNREFUSED");
      },
    };
    const log = vi.fn();
    const store = new RedisStore(failing, new MemoryStore(), log);
    await store.set("k", "v", 60);
    expect(await store.get("k")).toBe("v");
    await store.delete("k");
    expect(await store.get("k")).toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
  });
});
