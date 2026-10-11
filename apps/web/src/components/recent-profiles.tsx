"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearRecentProfiles, readRecentProfiles, rememberProfile } from "@/lib/recent-profiles";

export function RecentProfiles() {
  const [profiles, setProfiles] = useState<string[]>([]);

  useEffect(() => {
    // Reading localStorage must wait until after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfiles(readRecentProfiles());
  }, []);

  if (profiles.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-ink-muted">Recently viewed:</span>
      {profiles.map((login) => (
        <Link
          key={login}
          href={`/u/${encodeURIComponent(login)}`}
          className="rounded-full border border-line bg-surface px-3 py-1 text-ink-secondary hover:border-accent hover:text-ink"
        >
          {login}
        </Link>
      ))}
      <button
        type="button"
        onClick={() => {
          clearRecentProfiles();
          setProfiles([]);
        }}
        className="rounded px-1 text-ink-muted underline-offset-2 hover:text-ink hover:underline"
      >
        Clear
      </button>
    </div>
  );
}

/** Records a profile view so it shows up in "Recently viewed" on the home page. */
export function RememberProfile({ login }: { login: string }) {
  useEffect(() => rememberProfile(login), [login]);
  return null;
}
