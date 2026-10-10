import { z } from "zod";

/**
 * The demo account. Underscores are not allowed in GitHub logins, so this can
 * never collide with a real user.
 */
export const DEMO_LOGIN = "devdash_demo";

// GitHub rules: 1-39 chars, alphanumeric or single hyphens, no leading/trailing hyphen.
const GITHUB_LOGIN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function isDemoLogin(login: string): boolean {
  return login.toLowerCase() === DEMO_LOGIN;
}

export function isValidLogin(login: string): boolean {
  return GITHUB_LOGIN.test(login) || isDemoLogin(login);
}

/** Accepts "octocat", "@octocat" or a github.com profile URL and returns the bare login. */
export function normalizeLoginInput(input: string): string {
  let value = input.trim();
  const url = value.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#\s]+)/i);
  if (url?.[1]) value = url[1];
  return value.replace(/^@/, "");
}

export const loginSchema = z.string().transform(normalizeLoginInput).refine(isValidLogin, {
  message: "GitHub usernames are 1–39 letters, numbers or single hyphens.",
});

export function cacheKeyForLogin(login: string): string {
  return login.toLowerCase();
}
