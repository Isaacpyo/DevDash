const BRAND = Symbol.for("devdash.GitHubError");

/**
 * Base class so callers can tell GitHub failures apart from programming errors.
 *
 * Next bundles pages and route handlers separately, so one process can hold two
 * copies of these classes while sharing the services singleton. `instanceof`
 * therefore matches on a global brand plus the error name, not prototype identity.
 */
export class GitHubError extends Error {
  static readonly errorName: string = "GitHubError";
  override name = "GitHubError";
  readonly [BRAND] = true;

  static override [Symbol.hasInstance](value: unknown): boolean {
    if (typeof value !== "object" || value === null || !(BRAND in value)) return false;
    return (
      this.errorName === "GitHubError" || (value as { name?: unknown }).name === this.errorName
    );
  }
}

export class NotFoundError extends GitHubError {
  static override readonly errorName = "NotFoundError";
  override name = "NotFoundError";
  constructor(readonly login: string) {
    super(`GitHub user "${login}" was not found`);
  }
}

/** The login exists but belongs to an organization, which has no contribution graph. */
export class NotAUserError extends GitHubError {
  static override readonly errorName = "NotAUserError";
  override name = "NotAUserError";
  constructor(readonly login: string) {
    super(`"${login}" is an organization, not a user`);
  }
}

export type RateLimitKind = "primary" | "secondary";

export class RateLimitError extends GitHubError {
  static override readonly errorName = "RateLimitError";
  override name = "RateLimitError";
  constructor(
    /** Epoch milliseconds when it is safe to call GitHub again. */
    readonly resetAt: number,
    readonly kind: RateLimitKind = "primary",
  ) {
    super(`GitHub rate limit reached (${kind}); resets at ${new Date(resetAt).toISOString()}`);
  }
}

/** Network failures, timeouts, 5xx and malformed responses. */
export class UpstreamError extends GitHubError {
  static override readonly errorName = "UpstreamError";
  override name = "UpstreamError";
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
  }
}

/** The server is misconfigured, e.g. DATA_PROVIDER=github without a token. */
export class ConfigurationError extends GitHubError {
  static override readonly errorName = "ConfigurationError";
  override name = "ConfigurationError";
}

/** GitHub rejected the token (expired, revoked or wrong). */
export class BadCredentialsError extends GitHubError {
  static override readonly errorName = "BadCredentialsError";
  override name = "BadCredentialsError";
}
