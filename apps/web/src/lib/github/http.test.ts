import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { BadCredentialsError, NotFoundError, RateLimitError, UpstreamError } from "./errors";
import { GitHubClient, parseRateLimitHeaders, rateLimitErrorFrom } from "./http";

const NOW = Date.parse("2026-10-10T12:00:00Z");

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function client(fetchImpl: typeof fetch) {
  return new GitHubClient({ token: "t0ken", fetchImpl, retryDelayMs: 0, now: () => NOW });
}

const userSchema = z.object({ login: z.string() });

describe("parseRateLimitHeaders", () => {
  it("parses the x-ratelimit headers", () => {
    const headers = new Headers({
      "x-ratelimit-limit": "5000",
      "x-ratelimit-remaining": "42",
      "x-ratelimit-reset": "1760097600",
    });
    expect(parseRateLimitHeaders(headers)).toEqual({
      limit: 5000,
      remaining: 42,
      resetAt: 1760097600_000,
    });
  });

  it("returns null when headers are missing", () => {
    expect(parseRateLimitHeaders(new Headers())).toBeNull();
  });
});

describe("rateLimitErrorFrom", () => {
  it("detects the primary limit from remaining=0", () => {
    const error = rateLimitErrorFrom(
      403,
      new Headers({
        "x-ratelimit-limit": "60",
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "1760100000",
      }),
      "",
      NOW,
    );
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error).toMatchObject({ kind: "primary", resetAt: 1760100000_000 });
  });

  it("detects secondary limits from retry-after", () => {
    const error = rateLimitErrorFrom(429, new Headers({ "retry-after": "30" }), "", NOW);
    expect(error).toMatchObject({ kind: "secondary", resetAt: NOW + 30_000 });
  });

  it("falls back to a one-minute wait when only the message mentions it", () => {
    const error = rateLimitErrorFrom(
      403,
      new Headers(),
      '{"message":"You have exceeded a secondary rate limit"}',
      NOW,
    );
    expect(error).toMatchObject({ kind: "secondary", resetAt: NOW + 60_000 });
  });

  it("ignores other 403s and non-403 statuses", () => {
    expect(
      rateLimitErrorFrom(403, new Headers(), '{"message":"Resource not accessible"}', NOW),
    ).toBeNull();
    expect(rateLimitErrorFrom(500, new Headers({ "retry-after": "5" }), "", NOW)).toBeNull();
  });
});

describe("GitHubClient.rest", () => {
  it("sends auth and API version headers and validates the body", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json({ login: "octocat", extra: true }));
    const result = await client(fetchImpl).rest("/users/octocat", userSchema);

    expect(result).toEqual({ login: "octocat" });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.github.com/users/octocat");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer t0ken",
      "X-GitHub-Api-Version": "2022-11-28",
    });
  });

  it("maps 404 to NotFoundError", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json({ message: "Not Found" }, { status: 404 }),
    );
    await expect(client(fetchImpl).rest("/users/nope", userSchema, "nope")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("maps 401 to BadCredentialsError", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json({ message: "Bad credentials" }, { status: 401 }),
    );
    await expect(client(fetchImpl).rest("/user", userSchema)).rejects.toBeInstanceOf(
      BadCredentialsError,
    );
  });

  it("throws RateLimitError without retrying", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json(
        { message: "API rate limit exceeded" },
        {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-limit": "5000",
            "x-ratelimit-reset": "1760100000",
          },
        },
      ),
    );
    await expect(client(fetchImpl).rest("/users/x", userSchema)).rejects.toBeInstanceOf(
      RateLimitError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries a 5xx once and then succeeds", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
      .mockResolvedValueOnce(json({ login: "octocat" }));
    await expect(client(fetchImpl).rest("/users/octocat", userSchema)).resolves.toEqual({
      login: "octocat",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retry and reports an upstream error", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("unavailable", { status: 503 }));
    await expect(client(fetchImpl).rest("/users/octocat", userSchema)).rejects.toMatchObject({
      name: "UpstreamError",
      status: 503,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("treats network failures as retryable upstream errors", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(client(fetchImpl).rest("/users/x", userSchema)).rejects.toBeInstanceOf(
      UpstreamError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry timeouts, which already used the request budget", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    await expect(client(fetchImpl).rest("/users/x", userSchema)).rejects.toThrow(
      /did not respond in time/,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects bodies that don't match the schema", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json({ nope: 1 }));
    await expect(client(fetchImpl).rest("/users/x", userSchema)).rejects.toThrow(
      /Unexpected response shape/,
    );
  });

  it("records the latest rate limit snapshot", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json(
        { login: "a" },
        {
          headers: {
            "x-ratelimit-limit": "5000",
            "x-ratelimit-remaining": "4999",
            "x-ratelimit-reset": "1760100000",
          },
        },
      ),
    );
    const c = client(fetchImpl);
    await c.rest("/users/a", userSchema);
    expect(c.lastRateLimit).toMatchObject({ remaining: 4999 });
  });
});

describe("GitHubClient.graphql", () => {
  const schema = z.object({ user: z.object({ login: z.string() }).nullable() });

  it("posts the query and variables", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json({ data: { user: { login: "octocat" } } }),
    );
    await client(fetchImpl).graphql("query { x }", { login: "octocat" }, schema);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.github.com/graphql");
    expect(JSON.parse(String(init?.body))).toEqual({
      query: "query { x }",
      variables: { login: "octocat" },
    });
  });

  it("returns data alongside NOT_FOUND errors so callers can inspect it", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json({ data: { user: null }, errors: [{ type: "NOT_FOUND", message: "Could not resolve" }] }),
    );
    await expect(client(fetchImpl).graphql("q", {}, schema)).resolves.toEqual({ user: null });
  });

  it("maps RATE_LIMITED errors to RateLimitError using the reset header", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json(
        { errors: [{ type: "RATE_LIMITED", message: "API rate limit exceeded" }] },
        {
          headers: {
            "x-ratelimit-limit": "5000",
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": "1760100000",
          },
        },
      ),
    );
    await expect(client(fetchImpl).graphql("q", {}, schema)).rejects.toMatchObject({
      name: "RateLimitError",
      resetAt: 1760100000_000,
    });
  });

  it("throws when there is no data at all", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json({ errors: [{ message: "Something went wrong" }] }),
    );
    await expect(client(fetchImpl).graphql("q", {}, schema)).rejects.toThrow(
      /Something went wrong/,
    );
  });
});
