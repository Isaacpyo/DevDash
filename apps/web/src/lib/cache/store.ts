export interface CacheStore {
  readonly name: "memory" | "redis";
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  /**
   * Atomically adds 1 to a counter and returns the new value. The TTL is set
   * only when the counter is created, so a window always expires on schedule.
   */
  increment(key: string, ttlSeconds: number): Promise<number>;
  /** True when the backing store answers; used by the health check. */
  ping(): Promise<boolean>;
}

/**
 * In-process LRU with per-entry expiry. Used when REDIS_URL isn't set, and as
 * the fallback when Redis is unreachable. Each serverless instance has its own
 * copy, so it's a best-effort cache in production.
 */
export class MemoryStore implements CacheStore {
  readonly name = "memory";
  private readonly entries = new Map<string, { value: string; expiresAt: number }>();

  constructor(
    private readonly maxEntries = 500,
    private readonly now: () => number = Date.now,
  ) {}

  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }
    // Re-insert to mark as most recently used.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= this.now()) {
      await this.set(key, "1", ttlSeconds);
      return 1;
    }
    const next = Number(entry.value) + 1;
    entry.value = String(next);
    return next;
  }

  async ping(): Promise<boolean> {
    return true;
  }

  get size(): number {
    return this.entries.size;
  }
}

/** The subset of ioredis we use; lets tests pass a fake. */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", seconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>;
  ping(): Promise<string>;
}

/** INCR and set the expiry on first use in one atomic step, so a counter can't outlive its window. */
const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count`;

/**
 * Redis-backed store that never takes the page down: any Redis error is logged
 * and the operation falls through to an in-memory store.
 */
export class RedisStore implements CacheStore {
  readonly name = "redis";
  private lastErrorLog = 0;

  constructor(
    private readonly redis: RedisLike,
    private readonly fallback: CacheStore = new MemoryStore(),
    private readonly log: (message: string) => void = (m) => console.warn(m),
  ) {}

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.report(error);
      return this.fallback.get(key);
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, value, "EX", Math.max(1, Math.ceil(ttlSeconds)));
    } catch (error) {
      this.report(error);
      await this.fallback.set(key, value, ttlSeconds);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.report(error);
    }
    await this.fallback.delete(key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    try {
      const ttl = Math.max(1, Math.ceil(ttlSeconds));
      return Number(await this.redis.eval(INCREMENT_SCRIPT, 1, key, ttl));
    } catch (error) {
      this.report(error);
      return this.fallback.increment(key, ttlSeconds);
    }
  }

  /** Reports Redis itself, not the fallback, so a broken connection is visible. */
  async ping(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === "PONG";
    } catch {
      return false;
    }
  }

  private report(error: unknown) {
    // Rate-limit the log line so an outage doesn't flood the logs.
    if (Date.now() - this.lastErrorLog < 30_000) return;
    this.lastErrorLog = Date.now();
    this.log(`[cache] Redis unavailable, using memory fallback: ${String(error)}`);
  }
}
