import { z } from "zod";
import { ConfigurationError } from "@/lib/github/errors";

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blankToUndefined, schema.optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  GITHUB_TOKEN: optional(z.string()),
  DATA_PROVIDER: optional(z.enum(["github", "mock"])),
  MOCK_LATENCY_MS: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(0).max(10_000).default(0),
  ),
  OAUTH_PROVIDER: optional(z.enum(["github", "mock"])),
  GITHUB_OAUTH_CLIENT_ID: optional(z.string()),
  GITHUB_OAUTH_CLIENT_SECRET: optional(z.string()),
  SESSION_SECRET: optional(z.string().min(32, "SESSION_SECRET must be at least 32 characters")),
  REDIS_URL: optional(
    z.string().regex(/^rediss?:\/\//, "REDIS_URL must start with redis:// or rediss://"),
  ),
  CACHE_TTL_SECONDS: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().positive().default(600),
  ),
  CACHE_STALE_SECONDS: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(0).default(86_400),
  ),
  LOOKUP_LIMIT: z.preprocess(blankToUndefined, z.coerce.number().int().min(0).default(20)),
  LOOKUP_WINDOW_SECONDS: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().positive().default(600),
  ),
  SITE_URL: optional(z.url()),
  /** Set automatically by Netlify to the site's main URL. */
  URL: optional(z.url()),
});

/** Only for local development and tests; production must set SESSION_SECRET. */
const DEV_SESSION_SECRET = "devdash-insecure-development-secret-do-not-use";

export interface AppConfig {
  isProduction: boolean;
  dataProvider: "github" | "mock";
  githubToken: string | null;
  mockLatencyMs: number;
  oauth:
    | { provider: "github"; clientId: string; clientSecret: string }
    | { provider: "mock" }
    | { provider: "disabled" };
  /** Null when auth can't work (production without SESSION_SECRET). */
  sessionSecret: string | null;
  redisUrl: string | null;
  cache: { freshMs: number; staleMs: number };
  /** Uncached lookups each visitor may trigger per window; limit 0 disables. */
  lookups: { limit: number; windowSeconds: number };
  siteUrl: string;
}

export function loadConfig(source: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new ConfigurationError(`Invalid environment: ${details}`);
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === "production";

  const dataProvider = env.DATA_PROVIDER ?? (env.GITHUB_TOKEN ? "github" : "mock");
  if (dataProvider === "github" && !env.GITHUB_TOKEN) {
    throw new ConfigurationError("DATA_PROVIDER=github requires GITHUB_TOKEN");
  }

  let oauth: AppConfig["oauth"];
  if (env.OAUTH_PROVIDER === "mock") {
    oauth = { provider: "mock" };
  } else if (env.GITHUB_OAUTH_CLIENT_ID && env.GITHUB_OAUTH_CLIENT_SECRET) {
    oauth = {
      provider: "github",
      clientId: env.GITHUB_OAUTH_CLIENT_ID,
      clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET,
    };
  } else if (env.OAUTH_PROVIDER === "github") {
    throw new ConfigurationError(
      "OAUTH_PROVIDER=github requires GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET",
    );
  } else {
    oauth = { provider: "disabled" };
  }

  return {
    isProduction,
    dataProvider,
    githubToken: env.GITHUB_TOKEN ?? null,
    mockLatencyMs: env.MOCK_LATENCY_MS,
    oauth,
    sessionSecret: env.SESSION_SECRET ?? (isProduction ? null : DEV_SESSION_SECRET),
    redisUrl: env.REDIS_URL ?? null,
    cache: { freshMs: env.CACHE_TTL_SECONDS * 1000, staleMs: env.CACHE_STALE_SECONDS * 1000 },
    lookups: { limit: env.LOOKUP_LIMIT, windowSeconds: env.LOOKUP_WINDOW_SECONDS },
    siteUrl: (env.SITE_URL ?? env.URL ?? "http://localhost:3000").replace(/\/$/, ""),
  };
}

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  cached ??= loadConfig();
  return cached;
}
