import { describe, expect, it, vi } from "vitest";
import { MemoryStore } from "./store";
import { SwrCache } from "./swr";

function setup() {
  let now = 1_000_000;
  const tasks: Array<() => Promise<void>> = [];
  const store = new MemoryStore(100, () => now);
  const cache = new SwrCache({
    store,
    freshMs: 10_000,
    staleMs: 60_000,
    now: () => now,
    schedule: (task) => tasks.push(task),
  });
  return {
    cache,
    store,
    tasks,
    advance: (ms: number) => {
      now += ms;
    },
    runTasks: () => Promise.all(tasks.splice(0).map((task) => task())),
  };
}

describe("SwrCache", () => {
  it("loads on miss, then serves hits without calling the loader", async () => {
    const { cache } = setup();
    const loader = vi.fn(async () => "v1");

    expect(await cache.get("k", loader)).toMatchObject({ value: "v1", status: "miss" });
    expect(await cache.get("k", loader)).toMatchObject({ value: "v1", status: "hit" });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("serves stale data immediately and revalidates in the background", async () => {
    const { cache, advance, tasks, runTasks } = setup();
    await cache.get("k", async () => "v1");
    advance(15_000);

    const loader = vi.fn(async () => "v2");
    expect(await cache.get("k", loader)).toMatchObject({ value: "v1", status: "stale" });
    expect(loader).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(1);

    await runTasks();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(await cache.get("k", loader)).toMatchObject({ value: "v2", status: "hit" });
  });

  it("keeps serving stale data when background revalidation fails", async () => {
    let now = 0;
    const onBackgroundError = vi.fn();
    const tasks: Array<() => Promise<void>> = [];
    const cache = new SwrCache({
      store: new MemoryStore(10, () => now),
      freshMs: 10,
      staleMs: 1_000,
      now: () => now,
      schedule: (task) => tasks.push(task),
      onBackgroundError,
    });
    await cache.get("k", async () => "v1");
    now = 50;
    await cache.get("k", async () => {
      throw new Error("rate limited");
    });
    await Promise.all(tasks.map((t) => t()));
    expect(onBackgroundError).toHaveBeenCalledWith("k", expect.any(Error));
    expect(await cache.get("k", async () => "never")).toMatchObject({
      value: "v1",
      status: "stale",
    });
  });

  it("reloads synchronously once the stale window has passed", async () => {
    const { cache, advance } = setup();
    await cache.get("k", async () => "v1");
    advance(71_000);
    expect(await cache.get("k", async () => "v2")).toMatchObject({ value: "v2", status: "miss" });
  });

  it("throws on miss when the loader fails and there's nothing cached", async () => {
    const { cache } = setup();
    await expect(
      cache.get("k", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  it("force-refreshes fresh entries", async () => {
    const { cache } = setup();
    await cache.get("k", async () => "v1");
    expect(await cache.get("k", async () => "v2", { force: true })).toMatchObject({
      value: "v2",
      status: "miss",
    });
  });

  it("falls back to the cached value when a forced refresh fails", async () => {
    const { cache } = setup();
    await cache.get("k", async () => "v1");
    const result = await cache.get(
      "k",
      async () => {
        throw new Error("rate limited");
      },
      { force: true },
    );
    expect(result).toMatchObject({ value: "v1", status: "stale" });
  });

  it("deduplicates concurrent loads of the same key", async () => {
    const { cache } = setup();
    let resolve!: (value: string) => void;
    const loader = vi.fn(() => new Promise<string>((r) => (resolve = r)));

    const first = cache.get("k", loader);
    const second = cache.get("k", loader);
    await vi.waitFor(() => expect(loader).toHaveBeenCalled());
    resolve("shared");

    expect((await first).value).toBe("shared");
    expect((await second).value).toBe("shared");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("ignores corrupt cache entries", async () => {
    const { cache, store } = setup();
    await store.set("k", "{not json", 60);
    expect(await cache.get("k", async () => "fresh")).toMatchObject({
      value: "fresh",
      status: "miss",
    });
  });

  it("peeks without loading", async () => {
    const { cache, advance } = setup();
    expect(await cache.peek("k")).toBeNull();
    await cache.get("k", async () => "v1");
    expect(await cache.peek("k")).toMatchObject({ status: "hit" });
    advance(20_000);
    expect(await cache.peek("k")).toMatchObject({ status: "stale" });
  });
});
