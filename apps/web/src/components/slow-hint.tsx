"use client";

import { useEffect, useState } from "react";

/**
 * Appears only if loading takes a while, e.g. a cold serverless start plus a
 * large profile on GitHub's GraphQL API.
 */
export function SlowHint() {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    const first = window.setTimeout(() => setStage(1), 3_000);
    const second = window.setTimeout(() => setStage(2), 10_000);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, []);

  return (
    <p role="status" aria-live="polite" className="min-h-5 text-center text-sm text-ink-muted">
      {stage === 1 && "Waking the server and crunching GitHub data…"}
      {stage === 2 &&
        "Still working. Busy profiles can take a few more seconds the first time; after that they're cached."}
    </p>
  );
}
