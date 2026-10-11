"use client";

import "./globals.css";

/** Last-resort boundary for errors thrown by the root layout itself (e.g. invalid configuration). */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center p-6 antialiased">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold text-ink">DevDash is temporarily unavailable</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Something went wrong while loading the app.
            {error.digest && (
              <span className="mt-1 block text-xs text-ink-muted">Reference: {error.digest}</span>
            )}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-strong"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
