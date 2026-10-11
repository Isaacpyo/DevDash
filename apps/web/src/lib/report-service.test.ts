import { describe, expect, it, vi } from "vitest";
import { RateLimitBreaker } from "@/lib/cache/breaker";
import { LookupLimiter } from "@/lib/cache/lookup-limiter";
import { MemoryStore } from "@/lib/cache/store";
import { SwrCache } from "@/lib/cache/swr";
import {
  BadCredentialsError,
  LookupLimitError,
  NotFoundError,
  RateLimitError,
} from "@/lib/github/errors";
import { createMockProvider, generateMockData } from "@/lib/github/mock-provider";
import type { DataProvider, FetchOptions } from "@/lib/github/types";
import { DEMO_LOGIN } from "@/lib/github/username";
import { ReportService } from "./report-service";

const START = new Date("2026-10-10T12:00:00Z").getTime();

function setup(
  provider: DataProvider,
  serverToken: string | null = "server-token",
  lookupLimit = 0,
) {
  let now = START;
  const tasks: Array<() => Promise<void>> = [];
  const store = new MemoryStore(100, () => now);
  const cache = new SwrCache({
    store,
    freshMs: 600_000,
    staleMs: 86_400_000,
    now: () => now,
    schedule: (task) => tasks.push(task),
  });
  const breaker = new RateLimitBreaker(store, () => now);
  const limiter = new LookupLimiter(store, { limit: lookupLimit, windowSeconds: 600 }, () => now);
  const service = new ReportService({
    provider,
    cache,
    breaker,
    limiter,
    serverToken,
    now: () => new Date(now),
    refreshCooldownMs: 60_000,
  });
  return {
    service,
    breaker,
    advance: (ms: number) => (now += ms),
    runTasks: () => Promise.all(tasks.splice(0).map((t) => t())),
  };
}

/** A fake "github" provider whose behaviour depends on the token used. */
function githubProvider(byToken: (token: string | undefined, login: string) => void) {
  const fetchProfile = vi.fn(async (login: string, { token }: FetchOptions = {}) => {
    byToken(token, login);
    return generateMockData(login, new Date(START));
  });
  return { kind: "github" as const, fetchProfile };
}

describe("ReportService", () => {
  it("builds and caches reports from the mock provider", async () => {
    const provider = createMockProvider({ now: () => new Date(START) });
    const spy = vi.spyOn(provider, "fetchProfile");
    const { service } = setup(provider);

    const first = await service.getReport("octocat");
    expect(first.report).toMatchObject({ source: "mock", profile: { login: "octocat" } });
    expect(first.cache.status).toBe("miss");

    const second = await service.getReport("OctoCat");
    expect(second.cache.status).toBe("hit");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("serves the demo account from the seeded fixture regardless of provider", async () => {
    const provider = githubProvider(() => {
      throw new Error("should not be called");
    });
    const { service } = setup(provider);
    const { report } = await service.getReport(DEMO_LOGIN);
    expect(report.source).toBe("demo");
    expect(report.profile.name).toBe("Demo Developer");
    expect(provider.fetchProfile).not.toHaveBeenCalled();
  });

  it("uses different cache keys per provider and for the demo", () => {
    const { service } = setup(createMockProvider());
    expect(service.cacheKey("OctoCat")).toBe("report:v1:mock:octocat");
    expect(service.cacheKey(DEMO_LOGIN)).toBe("report:v1:demo:devdash_demo");
  });

  it("prefers the viewer's token and falls back to the server token when it is rate limited", async () => {
    const provider = githubProvider((token) => {
      if (token === "viewer-token") throw new RateLimitError(START + 3_600_000);
    });
    const { service, breaker } = setup(provider);

    const { report } = await service.getReport("octocat", { viewerToken: "viewer-token" });
    expect(report.source).toBe("github");
    expect(provider.fetchProfile.mock.calls.map(([, opts]) => opts?.token)).toEqual([
      "viewer-token",
      "server-token",
    ]);
    expect(await breaker.openUntil(`user:${RateLimitBreaker.tokenId("viewer-token")}`)).toBe(
      START + 3_600_000,
    );
  });

  it("falls back to the server token when the viewer token was revoked", async () => {
    const provider = githubProvider((token) => {
      if (token === "revoked") throw new BadCredentialsError("bad");
    });
    const { service } = setup(provider);
    await expect(service.getReport("octocat", { viewerToken: "revoked" })).resolves.toBeTruthy();
  });

  it("stops calling GitHub while the breaker is open and reports the reset time", async () => {
    const resetAt = START + 900_000;
    const provider = githubProvider(() => {
      throw new RateLimitError(resetAt);
    });
    const { service } = setup(provider);

    await expect(service.getReport("octocat")).rejects.toMatchObject({
      name: "RateLimitError",
      resetAt,
    });
    await expect(service.getReport("someone-else")).rejects.toMatchObject({ resetAt });
    expect(provider.fetchProfile).toHaveBeenCalledTimes(1);
  });

  it("serves stale data with rateLimitedUntil when GitHub is limiting us", async () => {
    let limited = false;
    const provider = githubProvider(() => {
      if (limited) throw new RateLimitError(START + 2 * 86_400_000);
    });
    const { service, advance, runTasks } = setup(provider);

    await service.getReport("octocat");
    limited = true;
    advance(700_000); // past the fresh window

    const stale = await service.getReport("octocat");
    expect(stale.cache.status).toBe("stale");
    expect(stale.rateLimitedUntil).toBeNull(); // breaker not tripped yet
    await runTasks(); // background revalidation hits the limit and trips the breaker

    const again = await service.getReport("octocat");
    expect(again.cache.status).toBe("stale");
    expect(again.rateLimitedUntil).toBe(START + 2 * 86_400_000);
  });

  it("propagates not-found errors without caching them", async () => {
    const provider = githubProvider((_, login) => {
      throw new NotFoundError(login);
    });
    const { service } = setup(provider);
    await expect(service.getReport("ghost")).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getReport("ghost")).rejects.toBeInstanceOf(NotFoundError);
    expect(provider.fetchProfile).toHaveBeenCalledTimes(2);
  });

  it("throttles manual refreshes", async () => {
    const provider = githubProvider(() => {});
    const { service, advance } = setup(provider);

    await service.getReport("octocat");
    const tooSoon = await service.refreshReport("octocat");
    expect(tooSoon.refreshed).toBe(false);
    expect(provider.fetchProfile).toHaveBeenCalledTimes(1);

    advance(61_000);
    expect(tooSoon.throttled).toBe(true);
    const refreshed = await service.refreshReport("octocat");
    expect(refreshed.refreshed).toBe(true);
    expect(refreshed.throttled).toBe(false);
    expect(refreshed.cache.status).toBe("miss");
    expect(provider.fetchProfile).toHaveBeenCalledTimes(2);
  });

  it("requires a token for the GitHub provider", async () => {
    const { service } = setup(
      githubProvider(() => {}),
      null,
    );
    await expect(service.getReport("octocat")).rejects.toThrow(/No GitHub token/);
  });
  describe("per-visitor lookup limit", () => {
    const visitor = { subject: "ip:203.0.113.7" };

    it("counts only lookups that call GitHub, not cache hits", async () => {
      const provider = githubProvider(() => {});
      const { service } = setup(provider, "server-token", 2);

      await service.getReport("alice", visitor);
      await service.getReport("alice", visitor); // cache hit
      await service.getReport("alice", visitor); // cache hit
      await service.getReport("bob", visitor);
      await expect(service.getReport("carol", visitor)).rejects.toBeInstanceOf(LookupLimitError);
      expect(provider.fetchProfile).toHaveBeenCalledTimes(2);

      // Cached profiles still load for the limited visitor, and other visitors are unaffected.
      await expect(service.getReport("alice", visitor)).resolves.toBeTruthy();
      await expect(
        service.getReport("carol", { subject: "ip:198.51.100.1" }),
      ).resolves.toBeTruthy();
    });

    it("resets after the window", async () => {
      const { service, advance } = setup(
        githubProvider(() => {}),
        "server-token",
        1,
      );
      await service.getReport("alice", visitor);
      await expect(service.getReport("bob", visitor)).rejects.toBeInstanceOf(LookupLimitError);
      advance(600_000);
      await expect(service.getReport("bob", visitor)).resolves.toBeTruthy();
    });

    it("never limits the demo account or mock mode, which don't use GitHub", async () => {
      const { service } = setup(createMockProvider({ now: () => new Date(START) }), null, 1);
      await service.getReport("alice", visitor);
      await expect(service.getReport("bob", visitor)).resolves.toBeTruthy();

      const github = setup(
        githubProvider(() => {}),
        "server-token",
        1,
      );
      await github.service.getReport("alice", visitor);
      await expect(github.service.getReport(DEMO_LOGIN, visitor)).resolves.toBeTruthy();
    });

    it("reports a blocked forced refresh as not refreshed rather than throttled", async () => {
      const { service, advance } = setup(
        githubProvider(() => {}),
        "server-token",
        1,
      );
      await service.getReport("alice", visitor);
      advance(61_000);
      const result = await service.refreshReport("alice", visitor);
      expect(result).toMatchObject({ refreshed: false, throttled: false });
      expect(result.report.profile.login).toBe("alice");
    });
  });
});
