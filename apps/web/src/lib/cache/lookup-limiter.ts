import { createHash } from "node:crypto";
import { LookupLimitError } from "@/lib/github/errors";
import type { CacheStore } from "./store";

export interface LookupLimitOptions {
  /** Lookups allowed per window; 0 disables the limiter. */
  limit: number;
  windowSeconds: number;
}

/**
 * Fixed-window counter per visitor for lookups that have to call GitHub
 * (cache misses). Cached profiles never count. Subjects are hashed so raw IPs
 * are never written to the store.
 */
export class LookupLimiter {
  constructor(
    private readonly store: CacheStore,
    private readonly options: LookupLimitOptions,
    private readonly now: () => number = Date.now,
  ) {}

  get enabled(): boolean {
    return this.options.limit > 0;
  }

  /** Records one lookup for `subject`, or throws LookupLimitError if the window is used up. */
  async consume(subject: string): Promise<void> {
    if (!this.enabled) return;
    const windowMs = this.options.windowSeconds * 1000;
    const window = Math.floor(this.now() / windowMs);
    const id = createHash("sha256").update(subject).digest("hex").slice(0, 16);
    const count = await this.store.increment(`lookups:${id}:${window}`, this.options.windowSeconds);
    if (count > this.options.limit) throw new LookupLimitError((window + 1) * windowMs);
  }
}
