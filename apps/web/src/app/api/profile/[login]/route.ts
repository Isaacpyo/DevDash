import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/current-session";
import { NotAUserError, NotFoundError, RateLimitError } from "@/lib/github/errors";
import { loginSchema } from "@/lib/github/username";
import { getServices } from "@/lib/services";

function problem(status: number, error: string, message: string, headers?: HeadersInit) {
  return NextResponse.json({ error, message }, { status, headers });
}

/** JSON version of a profile report, with the cache status exposed for debugging. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ login: string }> },
) {
  const parsed = loginSchema.safeParse((await params).login);
  if (!parsed.success) {
    return problem(400, "invalid_login", parsed.error.issues[0]?.message ?? "Invalid username");
  }

  const session = await getSession();
  try {
    const { report, cache, rateLimitedUntil } = await getServices().reportService.getReport(
      parsed.data,
      {
        viewerToken: session?.accessToken,
      },
    );
    return NextResponse.json(
      {
        report,
        cache: { ...cache, storedAt: new Date(cache.storedAt).toISOString() },
        rateLimitedUntil,
      },
      {
        headers: {
          "X-Cache": cache.status.toUpperCase(),
          // Reports contain only public data, but responses vary by viewer token, so keep them private.
          "Cache-Control": "private, max-age=60",
        },
      },
    );
  } catch (error) {
    if (error instanceof NotFoundError) return problem(404, "not_found", error.message);
    if (error instanceof NotAUserError) return problem(422, "not_a_user", error.message);
    if (error instanceof RateLimitError) {
      const retryAfter = Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000));
      return problem(429, "rate_limited", "GitHub's API rate limit was reached. Try again later.", {
        "Retry-After": String(retryAfter),
      });
    }
    console.error("[api/profile] unexpected error", error);
    return problem(502, "upstream_error", "Couldn't load data from GitHub.");
  }
}
