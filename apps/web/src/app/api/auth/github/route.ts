import { type NextRequest, NextResponse } from "next/server";
import { authAvailable, getOAuthClient, oauthRedirectUri } from "@/lib/auth/current-session";
import { createOAuthState, OAUTH_STATE_COOKIE, safeReturnTo } from "@/lib/auth/oauth";
import { getConfig } from "@/lib/env";

/** Starts the OAuth flow: remember a random state in a short-lived cookie, then redirect to GitHub. */
export async function GET(request: NextRequest) {
  const client = getOAuthClient();
  if (!client || !authAvailable().github) {
    return NextResponse.redirect(new URL("/?auth=unavailable", request.url));
  }

  const state = createOAuthState();
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const response = NextResponse.redirect(
    client.authorizeUrl({ state, redirectUri: oauthRedirectUri() }),
  );
  response.cookies.set(OAUTH_STATE_COOKIE, JSON.stringify({ state, returnTo }), {
    httpOnly: true,
    secure: getConfig().isProduction,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 600,
  });
  return response;
}
