"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signInAsDemo } from "@/app/actions";
import { formatTime } from "@/lib/format";
import { AlertIcon, GitHubMark } from "../icons";
import { SubmitButton } from "../submit-button";
import { buttonStyles } from "../ui";

function useCountdown(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = Math.max(0, until - now);
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return { done: remaining === 0, label: `${minutes}:${String(seconds).padStart(2, "0")}` };
}

/**
 * Shown instead of the dashboard when a lookup can't call GitHub and nothing is cached:
 * either GitHub's quota is used up ("github") or this visitor hit DevDash's own
 * per-visitor lookup limit ("visitor").
 */
export function RateLimitNotice({
  login,
  reason,
  resetAt,
  canSignIn,
  canUseDemo,
}: {
  login: string;
  reason: "github" | "visitor";
  resetAt: number;
  canSignIn: boolean;
  canUseDemo: boolean;
}) {
  const router = useRouter();
  const { done, label } = useCountdown(resetAt);

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-line bg-surface p-6 text-center sm:p-8">
      <AlertIcon width={28} height={28} className="mx-auto text-warning-ink" />
      <h1 className="mt-3 text-xl font-semibold text-ink">
        {reason === "github" ? "GitHub needs a breather" : "Slow down a little"}
      </h1>
      <p className="mt-2 text-sm text-ink-secondary">
        {reason === "github" ? (
          <>
            DevDash has used its GitHub API quota for now, and there&apos;s no cached copy of{" "}
            <strong>{login}</strong> yet. The quota resets at {formatTime(resetAt)}
          </>
        ) : (
          <>
            You&apos;ve looked up a lot of new profiles in a short time, and{" "}
            <strong>{login}</strong> isn&apos;t cached yet. Profiles that are already cached still
            load. New lookups unlock at {formatTime(resetAt)}
          </>
        )}
        {!done && (
          <>
            {" "}
            (in <span className="tabular">{label}</span>)
          </>
        )}
        .
      </p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <button
          type="button"
          className={buttonStyles.primary}
          disabled={!done}
          onClick={() => router.refresh()}
        >
          {done ? "Try again" : `Try again in ${label}`}
        </button>
        {canSignIn && (
          <a
            href={`/api/auth/github?returnTo=${encodeURIComponent(`/u/${login}`)}`}
            className={buttonStyles.secondary}
          >
            <GitHubMark />
            {reason === "github" ? "Sign in to use your own quota" : "Sign in with GitHub"}
          </a>
        )}
        {canUseDemo && (
          <form action={signInAsDemo}>
            <SubmitButton pendingLabel="Signing in…" className={buttonStyles.secondary}>
              Try the demo
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
