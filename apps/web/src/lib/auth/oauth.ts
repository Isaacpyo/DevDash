import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { GitHubClient } from "@/lib/github/http";

export const OAUTH_STATE_COOKIE = "devdash_oauth";
export const MOCK_OAUTH_CODE = "mock-oauth-code";

export interface OAuthUser {
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface OAuthClient {
  readonly kind: "github" | "mock";
  authorizeUrl(params: { state: string; redirectUri: string }): string;
  exchangeCode(code: string, redirectUri: string): Promise<string>;
  fetchUser(accessToken: string): Promise<OAuthUser>;
}

export class OAuthError extends Error {
  override name = "OAuthError";
}

const tokenResponse = z.union([
  z.object({ access_token: z.string() }),
  z.object({ error: z.string(), error_description: z.string().optional() }),
]);

const userResponse = z.object({
  login: z.string(),
  name: z.string().nullable(),
  avatar_url: z.string().nullable(),
});

/**
 * GitHub OAuth app flow. No scopes are requested: the token can only read
 * public data, which is all DevDash needs and keeps cached reports safe to share.
 */
export function createGitHubOAuthClient(options: {
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): OAuthClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    kind: "github",
    authorizeUrl({ state, redirectUri }) {
      const url = new URL("https://github.com/login/oauth/authorize");
      url.searchParams.set("client_id", options.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
      url.searchParams.set("scope", "");
      url.searchParams.set("allow_signup", "true");
      return url.toString();
    },
    async exchangeCode(code, redirectUri) {
      const response = await fetchImpl("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: options.clientId,
          client_secret: options.clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const parsed = tokenResponse.safeParse(await response.json().catch(() => null));
      if (!response.ok || !parsed.success)
        throw new OAuthError("Unexpected token response from GitHub");
      if ("error" in parsed.data)
        throw new OAuthError(parsed.data.error_description ?? parsed.data.error);
      return parsed.data.access_token;
    },
    async fetchUser(accessToken) {
      const client = new GitHubClient({ token: accessToken, fetchImpl });
      const user = await client.rest("/user", userResponse);
      return { login: user.login, name: user.name, avatarUrl: user.avatar_url };
    },
  };
}

/**
 * Same flow without GitHub: "authorize" redirects straight back to our callback
 * with a fixed code. Used for local development and the e2e suite.
 */
export function createMockOAuthClient(): OAuthClient {
  return {
    kind: "mock",
    authorizeUrl({ state, redirectUri }) {
      const url = new URL(redirectUri);
      url.searchParams.set("code", MOCK_OAUTH_CODE);
      url.searchParams.set("state", state);
      return url.toString();
    },
    async exchangeCode(code) {
      if (code !== MOCK_OAUTH_CODE) throw new OAuthError("Invalid mock authorization code");
      return "mock-access-token";
    },
    async fetchUser() {
      return { login: "octocat", name: "Mock Octocat", avatarUrl: null };
    },
  };
}

export function createOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function statesMatch(expected: string | undefined, received: string | null): boolean {
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Only same-site relative paths, so the callback can't be turned into an open redirect. */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || value.length > 200) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}
