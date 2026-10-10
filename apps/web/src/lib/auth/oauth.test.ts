import { describe, expect, it, vi } from "vitest";
import {
  createGitHubOAuthClient,
  createMockOAuthClient,
  createOAuthState,
  MOCK_OAUTH_CODE,
  OAuthError,
  safeReturnTo,
  statesMatch,
} from "./oauth";

describe("createGitHubOAuthClient", () => {
  it("builds an authorize URL without scopes", () => {
    const client = createGitHubOAuthClient({ clientId: "abc", clientSecret: "s" });
    const url = new URL(client.authorizeUrl({ state: "xyz", redirectUri: "https://app.test/cb" }));
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "abc",
      redirect_uri: "https://app.test/cb",
      state: "xyz",
      scope: "",
    });
  });

  it("exchanges a code for a token", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ access_token: "gho_123" }));
    const client = createGitHubOAuthClient({ clientId: "abc", clientSecret: "s", fetchImpl });
    await expect(client.exchangeCode("code", "https://app.test/cb")).resolves.toBe("gho_123");
    expect(JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body))).toMatchObject({
      client_id: "abc",
      client_secret: "s",
      code: "code",
    });
  });

  it("surfaces GitHub's OAuth errors", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ error: "bad_verification_code", error_description: "The code is incorrect" }),
    );
    const client = createGitHubOAuthClient({ clientId: "abc", clientSecret: "s", fetchImpl });
    await expect(client.exchangeCode("old", "x")).rejects.toThrow(
      new OAuthError("The code is incorrect"),
    );
  });

  it("fetches the signed-in user", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ login: "octocat", name: null, avatar_url: "https://a.test/1" }),
    );
    const client = createGitHubOAuthClient({ clientId: "abc", clientSecret: "s", fetchImpl });
    await expect(client.fetchUser("gho_123")).resolves.toEqual({
      login: "octocat",
      name: null,
      avatarUrl: "https://a.test/1",
    });
  });
});

describe("createMockOAuthClient", () => {
  it("redirects straight back with a code that it accepts", async () => {
    const client = createMockOAuthClient();
    const url = new URL(
      client.authorizeUrl({ state: "s1", redirectUri: "http://localhost:3000/cb" }),
    );
    expect(url.searchParams.get("state")).toBe("s1");
    expect(url.searchParams.get("code")).toBe(MOCK_OAUTH_CODE);
    await expect(client.exchangeCode(MOCK_OAUTH_CODE, "")).resolves.toBeTruthy();
    await expect(client.exchangeCode("forged", "")).rejects.toBeInstanceOf(OAuthError);
  });
});

describe("OAuth state", () => {
  it("creates unguessable, unique states", () => {
    const a = createOAuthState();
    expect(a).toMatch(/^[\w-]{43}$/);
    expect(createOAuthState()).not.toBe(a);
  });

  it("compares states safely", () => {
    expect(statesMatch("abc", "abc")).toBe(true);
    expect(statesMatch("abc", "abd")).toBe(false);
    expect(statesMatch("abc", "abcd")).toBe(false);
    expect(statesMatch(undefined, "abc")).toBe(false);
    expect(statesMatch("abc", null)).toBe(false);
  });
});

describe("safeReturnTo", () => {
  it.each([
    ["/u/octocat", "/u/octocat"],
    ["/", "/"],
    ["//evil.com", null],
    ["/\\evil.com", null],
    ["https://evil.com", null],
    ["javascript:alert(1)", null],
    [null, null],
    ["/" + "a".repeat(300), null],
  ])("%j -> %j", (input, expected) => {
    expect(safeReturnTo(input)).toBe(expected);
  });
});
