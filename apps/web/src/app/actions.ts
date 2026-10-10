"use server";

import { redirect } from "next/navigation";
import { endSession, getSession, startSession } from "@/lib/auth/current-session";
import { RateLimitError } from "@/lib/github/errors";
import { DEMO_LOGIN, loginSchema } from "@/lib/github/username";
import { formatTime } from "@/lib/format";
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
    });
    if (result.rateLimitedUntil) {
      return {
        status: "error",
        message: `GitHub is rate limiting us until ${formatTime(result.rateLimitedUntil)}. Showing cached data.`,
      };
    }
    return result.refreshed
      ? { status: "refreshed", message: "Updated with the latest data from GitHub." }
      : { status: "throttled", message: "Already up to date. You can refresh again in a minute." };
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        status: "error",
        message: `GitHub rate limit reached. Try again after ${formatTime(error.resetAt)}.`,
      };
    }
    return { status: "error", message: "Couldn't reach GitHub. Please try again shortly." };
  }
}
