"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertIcon } from "@/components/icons";
import { buttonStyles } from "@/components/ui";

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-surface p-6 text-center sm:p-8">
        <AlertIcon width={28} height={28} className="mx-auto text-critical" />
        <h1 className="mt-3 text-xl font-semibold text-ink">We couldn&apos;t load this profile</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          GitHub didn&apos;t respond as expected. This is usually temporary.
          {error.digest && (
            <span className="mt-1 block text-xs text-ink-muted">Reference: {error.digest}</span>
          )}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={reset} className={buttonStyles.primary}>
            Try again
          </button>
          <Link href="/" className={buttonStyles.secondary}>
            Back to search
          </Link>
        </div>
      </div>
    </div>
  );
}
