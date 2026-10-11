import "server-only";
import Redis from "ioredis";
import { after } from "next/server";
import { RateLimitBreaker } from "@/lib/cache/breaker";
import { type CacheStore, MemoryStore, RedisStore } from "@/lib/cache/store";
import { SwrCache } from "@/lib/cache/swr";
import { type AppConfig, getConfig } from "@/lib/env";
import { createGitHubProvider } from "@/lib/github/github-provider";
import { createMockProvider } from "@/lib/github/mock-provider";
import { ReportService } from "@/lib/report-service";

export interface Services {
  config: AppConfig;
  store: CacheStore;
  reportService: ReportService;
}

/** Background work after the response is sent; falls back to fire-and-forget outside a request. */
function scheduleAfterResponse(task: () => Promise<void>) {
  try {
    after(task);
  } catch {
    void task();
  }
}

function createStore(config: AppConfig): CacheStore {
  if (!config.redisUrl) return new MemoryStore();
  const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    commandTimeout: 1_500,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5_000),
  });
  // Errors surface through RedisStore's fallback; this keeps ioredis from throwing unhandled events.
  redis.on("error", () => {});
  return new RedisStore(redis);
}

// Next bundles pages and route handlers separately, so a module-level variable
// would give each bundle its own cache and Redis connection. Share one per process.
const globalForServices = globalThis as typeof globalThis & { __devdashServices?: Services };

export function getServices(): Services {
  if (globalForServices.__devdashServices) return globalForServices.__devdashServices;

  const config = getConfig();
  if (config.isProduction && !config.sessionSecret) {
    console.warn("[auth] SESSION_SECRET is not set: sign-in and the demo login are disabled.");
  }
  const store = createStore(config);
  const provider =
    config.dataProvider === "github"
      ? createGitHubProvider()
      : createMockProvider({ latencyMs: config.mockLatencyMs });

  const cache = new SwrCache({
    store,
    freshMs: config.cache.freshMs,
    staleMs: config.cache.staleMs,
    schedule: scheduleAfterResponse,
    onBackgroundError: (key, error) =>
      console.warn(`[cache] background refresh of ${key} failed: ${String(error)}`),
  });

  const services: Services = {
    config,
    store,
    reportService: new ReportService({
      provider,
      cache,
      breaker: new RateLimitBreaker(store),
      serverToken: config.githubToken,
    }),
  };
  globalForServices.__devdashServices = services;
  return services;
}
