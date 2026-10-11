import type { z } from "zod";
import { BadCredentialsError, NotFoundError, RateLimitError, UpstreamError } from "./errors";

export const GITHUB_API_URL = "https://api.github.com";
const USER_AGENT = "DevDash (+https://github.com/isaacpyo/devdash)";

export interface RateLimitSnapshot {
  limit: number;
  remaining: number;
  /** Epoch milliseconds */
  resetAt: number;
}

export function parseRateLimitHeaders(headers: Headers): RateLimitSnapshot | null {
  const limit = Number(headers.get("x-ratelimit-limit"));
  const remaining = Number(headers.get("x-ratelimit-remaining"));
  const reset = Number(headers.get("x-ratelimit-reset"));
  if (!headers.has("x-ratelimit-remaining") || [limit, remaining, reset].some(Number.isNaN)) {
    return null;
  }
  return { limit, remaining, resetAt: reset * 1000 };
}

/**
 * Detects both of GitHub's rate limits from a 403/429 response:
 * - primary: x-ratelimit-remaining is 0, reset time in x-ratelimit-reset
 * - secondary (abuse): retry-after header, or a "secondary rate limit" message
 */
export function rateLimitErrorFrom(
  status: number,
  headers: Headers,
  body: string,
  now: number,
): RateLimitError | null {
  if (status !== 403 && status !== 429) return null;

  const retryAfter = Number(headers.get("retry-after"));
  if (headers.has("retry-after") && Number.isFinite(retryAfter)) {
    return new RateLimitError(now + retryAfter * 1000, "secondary");
  }

  const snapshot = parseRateLimitHeaders(headers);
  if (snapshot && snapshot.remaining === 0) {
    return new RateLimitError(snapshot.resetAt, "primary");
  }

  if (/rate limit/i.test(body)) {
    // GitHub's docs: without retry-after, wait at least a minute.
    return new RateLimitError(now + 60_000, "secondary");
  }
  return null;
}

export interface GitHubClientOptions {
  token?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  /** Delay before the single retry of a transient failure. */
  retryDelayMs?: number;
  now?: () => number;
}

interface GraphQLErrorItem {
  type?: string;
  message?: string;
}

export class GitHubClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly now: () => number;
  /** Rate limit headers from the most recent response. */
  lastRateLimit: RateLimitSnapshot | null = null;

  constructor(private readonly options: GitHubClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? GITHUB_API_URL;
    // Netlify's free functions stop at ~10 s, so one attempt must fit well inside that.
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.retryDelayMs = options.retryDelayMs ?? 400;
    this.now = options.now ?? Date.now;
  }

  /** GET a REST endpoint and validate the JSON body. 404 becomes NotFoundError(login). */
  async rest<S extends z.ZodType>(path: string, schema: S, login = ""): Promise<z.output<S>> {
    const response = await this.send(`${this.baseUrl}${path}`, { method: "GET" });
    if (response.status === 404) throw new NotFoundError(login);
    return this.parse(schema, await this.readJson(response), path);
  }

  /**
   * POST a GraphQL query. Throws for transport errors, rate limits and responses
   * without data. Partial errors next to data (e.g. NOT_FOUND for a null user)
   * are left for the caller to interpret.
   */
  async graphql<S extends z.ZodType>(
    query: string,
    variables: Record<string, unknown>,
    schema: S,
  ): Promise<z.output<S>> {
    const response = await this.send(`${this.baseUrl}/graphql`, {
      method: "POST",
      body: JSON.stringify({ query, variables }),
    });
    const body = (await this.readJson(response)) as { data?: unknown; errors?: GraphQLErrorItem[] };

    if (body.errors?.some((error) => error.type === "RATE_LIMITED")) {
      const resetAt = this.lastRateLimit?.resetAt ?? this.now() + 60_000;
      throw new RateLimitError(resetAt, "primary");
    }
    if (body.data == null) {
      const message = body.errors?.map((e) => e.message).join("; ") || "empty response";
      throw new UpstreamError(`GitHub GraphQL error: ${message}`, response.status);
    }
    return this.parse(schema, body.data, "graphql");
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.attempt(url, init);
    } catch (error) {
      if (error instanceof UpstreamError && error.retryable) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelayMs * (1 + Math.random() * 0.5)),
        );
        return this.attempt(url, init);
      }
      throw error;
    }
  }

  private async attempt(url: string, init: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (init.body) headers["Content-Type"] = "application/json";
    if (this.options.token) headers.Authorization = `Bearer ${this.options.token}`;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        ...init,
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      // A timeout already used most of the request budget, so only fast failures are retried.
      throw new UpstreamError(
        timedOut ? "GitHub did not respond in time" : "Could not reach GitHub",
        undefined,
        !timedOut,
      );
    }

    this.lastRateLimit = parseRateLimitHeaders(response.headers) ?? this.lastRateLimit;
    if (response.ok || response.status === 404) return response;

    const text = await response.text().catch(() => "");
    const rateLimit = rateLimitErrorFrom(response.status, response.headers, text, this.now());
    if (rateLimit) throw rateLimit;
    if (response.status === 401) throw new BadCredentialsError("GitHub rejected the access token");
    throw new UpstreamError(
      `GitHub responded with ${response.status}`,
      response.status,
      response.status >= 500,
    );
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new UpstreamError("GitHub returned invalid JSON", response.status);
    }
  }

  private parse<S extends z.ZodType>(schema: S, data: unknown, where: string): z.output<S> {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new UpstreamError(`Unexpected response shape from GitHub (${where})`);
    }
    return result.data;
  }
}
