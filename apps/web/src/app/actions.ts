"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { endSession, getSession, startSession } from "@/lib/auth/current-session";
import { LookupLimitError, RateLimitError } from "@/lib/github/errors";
import { DEMO_LOGIN, loginSchema } from "@/lib/github/username";
import { formatTime } from "@/lib/format";
import { requestSubject } from "@/lib/request-subject";
import { getServices } from "@/lib/services";

export async function signInAsDemo(): Promise<void> {
  const started = await startSession({
    kind: "demo",
    login: DEMO_LOGIN,
    name: "Demo Developer",
    avatarUrl: null,
  });
  redirect(started ? `/u/${DEMO_LOGIN}` : "/?auth=unavailable");
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/");
}

export interface RefreshState {
  status: "idle" | "refreshed" | "throttled" | "error";
  message: string;
}

export async function refreshProfile(
  login: string,
  _previous: RefreshState,
): Promise<RefreshState> {
  const parsed = loginSchema.safeParse(login);
  if (!parsed.success) return { status: "error", message: "That isn't a valid GitHub username." };

  const session = await getSession();
  try {
    const result = await getServices().reportService.refreshReport(parsed.data, {
      viewerToken: session?.accessToken,
      subject: requestSubject(await headers(), session),
    });
    if (result.rateLimitedUntil) {
      return {
        status: "error",
        message: `GitHub is rate limiting us until ${formatTime(result.rateLimitedUntil)}. Showing cached data.`,
      };
    }
    if (result.refreshed) {
      return { status: "refreshed", message: "Updated with the latest data from GitHub." };
    }
    return result.throttled
      ? { status: "throttled", message: "Already up to date. You can refresh again in a minute." }
      : { status: "error", message: "Couldn't refresh right now. Showing the cached data." };
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        status: "error",
        message: `GitHub rate limit reached. Try again after ${formatTime(error.resetAt)}.`,
      };
    }
    if (error instanceof LookupLimitError) {
      return {
        status: "error",
        message: `You've looked up a lot of new profiles. Try again after ${formatTime(error.retryAt)}.`,
      };
    }
    return { status: "error", message: "Couldn't reach GitHub. Please try again shortly." };
  }
}
