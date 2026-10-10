"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { refreshProfile, type RefreshState } from "@/app/actions";
import { RefreshIcon } from "../icons";
import { buttonStyles, cx } from "../ui";

const INITIAL: RefreshState = { status: "idle", message: "" };

export function RefreshButton({ login }: { login: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(refreshProfile.bind(null, login), INITIAL);

  useEffect(() => {
    if (state.status === "refreshed") router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="contents">
      <button
        type="submit"
        className={cx(buttonStyles.secondary, "px-3 py-1.5")}
        disabled={pending}
      >
        <RefreshIcon className={pending ? "animate-spin" : undefined} />
        {pending ? "Refreshing…" : "Refresh"}
      </button>
      <p
        role="status"
        aria-live="polite"
        className={cx(
          "w-full text-xs sm:order-last",
          state.status === "error" ? "text-critical" : "text-ink-muted",
          !state.message && "sr-only",
        )}
      >
        {state.message}
      </p>
    </form>
  );
}
