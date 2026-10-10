import "server-only";
import { cookies } from "next/headers";
import { getConfig } from "@/lib/env";
import { createGitHubOAuthClient, createMockOAuthClient, type OAuthClient } from "./oauth";
import {
  type Session,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sealSession,
  unsealSession,
} from "./session";

export async function getSession(): Promise<Session | null> {
  const secret = getConfig().sessionSecret;
  if (!secret) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? unsealSession(token, secret) : null;
}

/** Returns false when sessions are unavailable (production without SESSION_SECRET). */
export async function startSession(session: Session): Promise<boolean> {
  const config = getConfig();
  if (!config.sessionSecret) return false;
  (await cookies()).set(SESSION_COOKIE, await sealSession(session, config.sessionSecret), {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return true;
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export function getOAuthClient(): OAuthClient | null {
  const { oauth } = getConfig();
  if (oauth.provider === "github") return createGitHubOAuthClient(oauth);
  if (oauth.provider === "mock") return createMockOAuthClient();
  return null;
}

export function authAvailable() {
  const config = getConfig();
  return {
    demo: config.sessionSecret !== null,
    github: config.sessionSecret !== null && config.oauth.provider !== "disabled",
  };
}

export function oauthRedirectUri(): string {
  return `${getConfig().siteUrl}/api/auth/github/callback`;
}
