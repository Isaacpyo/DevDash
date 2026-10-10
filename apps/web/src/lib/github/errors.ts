/** Base class so callers can tell GitHub failures apart from programming errors. */
export class GitHubError extends Error {
  override name = "GitHubError";
}

export class NotFoundError extends GitHubError {
  override name = "NotFoundError";
  constructor(readonly login: string) {
    super(`GitHub user "${login}" was not found`);
  }
}

/** The login exists but belongs to an organization, which has no contribution graph. */
export class NotAUserError extends GitHubError {
  override name = "NotAUserError";
  constructor(readonly login: string) {
    super(`"${login}" is an organization, not a user`);
  }
}

export type RateLimitKind = "primary" | "secondary";

export class RateLimitError extends GitHubError {
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
  override name = "ConfigurationError";
}
