import { createHash } from "node:crypto";
import type { CacheStore } from "./store";

/**
 * Remembers "rate limited until T" per token so we stop calling GitHub until the
 * limit resets. Hammering GitHub while limited can escalate secondary limits,
 * and every doomed call adds latency for the user.
 */
export class RateLimitBreaker {
  constructor(
    private readonly store: CacheStore,
    private readonly now: () => number = Date.now,
  ) {}

  /** A stable, non-reversible id for a token so it never appears in cache keys. */
  static tokenId(token: string): string {
    return createHash("sha256").update(token).digest("hex").slice(0, 16);
  }

  async openUntil(tokenId: string): Promise<number | null> {
    const raw = await this.store.get(this.key(tokenId));
    const until = raw ? Number(raw) : NaN;
    return Number.isFinite(until) && until > this.now() ? until : null;
  }

  async trip(tokenId: string, until: number): Promise<void> {
    const ttlSeconds = Math.ceil((until - this.now()) / 1000);
    if (ttlSeconds <= 0) return;
    await this.store.set(this.key(tokenId), String(until), ttlSeconds);
  }

  private key(tokenId: string) {
    return `ratelimit:${tokenId}`;
  }
}
