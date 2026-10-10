"use client";

import { useEffect } from "react";
import { buttonStyles } from "@/components/ui";

export default function RootError({
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
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-semibold text-ink">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-secondary">
        An unexpected error occurred. Please try again.
      </p>
      <button type="button" onClick={reset} className={`${buttonStyles.primary} mt-6`}>
        Try again
      </button>
    </div>
  );
}
