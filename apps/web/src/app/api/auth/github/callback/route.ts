import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOAuthClient, oauthRedirectUri, startSession } from "@/lib/auth/current-session";
import { OAUTH_STATE_COOKIE, safeReturnTo, statesMatch } from "@/lib/auth/oauth";

const stateCookie = z.object({ state: z.string(), returnTo: z.string().nullable() });

function fail(request: NextRequest, reason: "denied" | "failed") {
  const response = NextResponse.redirect(new URL(`/?auth=${reason}`, request.url));
  response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth" });
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return fail(request, "denied");

  const client = getOAuthClient();
  const code = params.get("code");
  let saved: z.infer<typeof stateCookie> | null = null;
  try {
    saved = stateCookie.parse(JSON.parse(request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? ""));
  } catch {
    saved = null;
  }

  // Missing or mismatched state means this callback wasn't started by us (CSRF) or expired.
  if (!client || !code || !saved || !statesMatch(saved.state, params.get("state"))) {
    return fail(request, "failed");
  }

  try {
    const accessToken = await client.exchangeCode(code, oauthRedirectUri());
    const user = await client.fetchUser(accessToken);
    const started = await startSession({
      kind: client.kind,
      login: user.login,
      name: user.name,
      avatarUrl: user.avatarUrl,
      // The mock token is meaningless, so it isn't stored.
      ...(client.kind === "github" ? { accessToken } : {}),
    });
    if (!started) return fail(request, "failed");

    const destination = safeReturnTo(saved.returnTo) ?? `/u/${encodeURIComponent(user.login)}`;
    const response = NextResponse.redirect(new URL(destination, request.url));
    response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth" });
    return response;
  } catch (error) {
    console.warn(`[auth] GitHub sign-in failed: ${String(error)}`);
    return fail(request, "failed");
  }
}
