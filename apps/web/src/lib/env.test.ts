import { describe, expect, it } from "vitest";
import { ConfigurationError } from "@/lib/github/errors";
import { loadConfig } from "./env";

describe("loadConfig", () => {
  it("defaults to the mock provider without a token", () => {
    const config = loadConfig({});
    expect(config).toMatchObject({
      dataProvider: "mock",
      githubToken: null,
      oauth: { provider: "disabled" },
      redisUrl: null,
      cache: { freshMs: 600_000, staleMs: 86_400_000 },
      siteUrl: "http://localhost:3000",
    });
  });

  it("uses GitHub when a token is set and treats blank values as unset", () => {
    expect(loadConfig({ GITHUB_TOKEN: "ghp_x" }).dataProvider).toBe("github");
    expect(loadConfig({ GITHUB_TOKEN: "  " }).dataProvider).toBe("mock");
  });

  it("lets DATA_PROVIDER force the mock even with a token", () => {
    expect(loadConfig({ GITHUB_TOKEN: "ghp_x", DATA_PROVIDER: "mock" }).dataProvider).toBe("mock");
  });

  it("rejects DATA_PROVIDER=github without a token", () => {
    expect(() => loadConfig({ DATA_PROVIDER: "github" })).toThrow(ConfigurationError);
  });

  it("enables GitHub OAuth only when both credentials are present", () => {
    expect(loadConfig({ GITHUB_OAUTH_CLIENT_ID: "id" }).oauth.provider).toBe("disabled");
    expect(
      loadConfig({ GITHUB_OAUTH_CLIENT_ID: "id", GITHUB_OAUTH_CLIENT_SECRET: "secret" }).oauth,
    ).toEqual({ provider: "github", clientId: "id", clientSecret: "secret" });
    expect(() => loadConfig({ OAUTH_PROVIDER: "github" })).toThrow(/GITHUB_OAUTH_CLIENT_ID/);
    expect(loadConfig({ OAUTH_PROVIDER: "mock" }).oauth.provider).toBe("mock");
  });

  it("only falls back to a development session secret outside production", () => {
    expect(loadConfig({ NODE_ENV: "development" }).sessionSecret).toBeTruthy();
    expect(loadConfig({ NODE_ENV: "production" }).sessionSecret).toBeNull();
    const secret = "x".repeat(32);
    expect(loadConfig({ NODE_ENV: "production", SESSION_SECRET: secret }).sessionSecret).toBe(
      secret,
    );
  });

  it("validates values with readable messages", () => {
    expect(() => loadConfig({ SESSION_SECRET: "short" })).toThrow(/at least 32 characters/);
    expect(() => loadConfig({ REDIS_URL: "http://nope" })).toThrow(/redis:\/\//);
    expect(() => loadConfig({ CACHE_TTL_SECONDS: "-1" })).toThrow(ConfigurationError);
  });

  it("parses cache durations and the site URL (SITE_URL beats Netlify's URL)", () => {
    const config = loadConfig({
      CACHE_TTL_SECONDS: "60",
      CACHE_STALE_SECONDS: "0",
      URL: "https://site.netlify.app",
      SITE_URL: "https://devdash.example.com/",
    });
    expect(config.cache).toEqual({ freshMs: 60_000, staleMs: 0 });
    expect(config.siteUrl).toBe("https://devdash.example.com");
    expect(loadConfig({ URL: "https://site.netlify.app" }).siteUrl).toBe(
      "https://site.netlify.app",
    );
  });
});
