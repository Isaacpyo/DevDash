import { type NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/github/username";

/** No-JS fallback for the search form: validate, then redirect to the profile. */
export function GET(request: NextRequest) {
  const parsed = loginSchema.safeParse(request.nextUrl.searchParams.get("q") ?? "");
  const destination = parsed.success
    ? `/u/${encodeURIComponent(parsed.data)}`
    : "/?error=invalid-username";
  return NextResponse.redirect(new URL(destination, request.url), 303);
}
