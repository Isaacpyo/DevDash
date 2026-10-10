import type { CacheStore } from "./store";

export type CacheStatus = "hit" | "stale" | "miss";

export interface CacheResult<T> {
  value: T;
  status: CacheStatus;
  /** Epoch ms when the value was fetched from upstream. */
  storedAt: number;
}

interface Envelope<T> {
  value: T;
  storedAt: number;
}

export interface SwrOptions {
  store: CacheStore;
  /** How long a value is served without revalidating. */
  freshMs: number;
  /** How long after that a stale value may still be served while revalidating. */
  staleMs: number;
  now?: () => number;
  /** Runs work after the response is sent (Next's `after`). Defaults to fire-and-forget. */
  schedule?: (task: () => Promise<void>) => void;
  onBackgroundError?: (key: string, error: unknown) => void;
}

export interface GetOptions {
  /** Skip the fresh window and fetch now; still falls back to stale data on failure. */
  force?: boolean;
}

/**
 * Stale-while-revalidate cache:
 *  - fresh: return cached value
 *  - stale: return cached value now, refresh in the background
 *  - missing/expired: fetch, store, return
 * Concurrent loads of the same key share one upstream request (per instance).
 */
export class SwrCache {
  private readonly inflight = new Map<string, Promise<CacheResult<unknown>>>();
  private readonly now: () => number;
  private readonly schedule: (task: () => Promise<void>) => void;

  constructor(private readonly options: SwrOptions) {
    this.now = options.now ?? Date.now;
    this.schedule = options.schedule ?? ((task) => void task());
  }

  async get<T>(
    key: string,
    loader: () => Promise<T>,
    { force = false }: GetOptions = {},
  ): Promise<CacheResult<T>> {
    const entry = await this.read<T>(key);
    const age = entry ? this.now() - entry.storedAt : Infinity;

    if (entry && !force && age < this.options.freshMs) {
      return { value: entry.value, status: "hit", storedAt: entry.storedAt };
    }

    const usable = entry && age < this.options.freshMs + this.options.staleMs;

    if (usable && !force) {
      this.schedule(async () => {
        try {
          await this.load(key, loader);
        } catch (error) {
          this.options.onBackgroundError?.(key, error);
        }
      });
      return { value: entry.value, status: "stale", storedAt: entry.storedAt };
    }

    try {
      return await this.load(key, loader);
    } catch (error) {
      // A forced refresh that fails still has the old value to fall back on.
      if (usable) return { value: entry.value, status: "stale", storedAt: entry.storedAt };
      throw error;
    }
  }

  /** Reads the cached value without loading. */
  async peek<T>(key: string): Promise<CacheResult<T> | null> {
    const entry = await this.read<T>(key);
    if (!entry) return null;
    const fresh = this.now() - entry.storedAt < this.options.freshMs;
    return { value: entry.value, status: fresh ? "hit" : "stale", storedAt: entry.storedAt };
  }

  private load<T>(key: string, loader: () => Promise<T>): Promise<CacheResult<T>> {
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<CacheResult<T>>;

    const promise = (async () => {
      const value = await loader();
      const storedAt = this.now();
      const ttlSeconds = Math.ceil((this.options.freshMs + this.options.staleMs) / 1000);
      await this.options.store.set(
        key,
        JSON.stringify({ value, storedAt } satisfies Envelope<T>),
        ttlSeconds,
      );
      return { value, status: "miss" as const, storedAt };
    })().finally(() => this.inflight.delete(key));

    this.inflight.set(key, promise);
    return promise;
  }

  private async read<T>(key: string): Promise<Envelope<T> | null> {
    const raw = await this.options.store.get(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Envelope<T>;
      return typeof parsed.storedAt === "number" ? parsed : null;
    } catch {
      return null;
    }
  }
}
