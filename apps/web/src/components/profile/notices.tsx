import Link from "next/link";
import { formatRelative, formatTime } from "@/lib/format";
import { AlertIcon } from "../icons";
import { buttonStyles } from "../ui";

/** Banner above the dashboard when the data shown is cached because of a rate limit. */
export function StaleDataBanner({
  storedAt,
  resetAt,
  now,
}: {
  storedAt: number;
  resetAt: number;
  now: number;
}) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl bg-warning-wash px-4 py-3 text-sm text-warning-ink"
    >
      <AlertIcon className="mt-0.5 shrink-0" />
      <p>
        GitHub is rate limiting DevDash right now, so this is cached data from{" "}
        {formatRelative(storedAt, now)}. It will refresh automatically after {formatTime(resetAt)}.
      </p>
    </div>
  );
}

export function OrganizationNotice({ login }: { login: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-line bg-surface p-6 text-center sm:p-8">
      <h1 className="text-xl font-semibold text-ink">{login} is an organization</h1>
      <p className="mt-2 text-sm text-ink-secondary">
        Organizations don&apos;t have contribution graphs, so DevDash only analyses personal
        accounts. Try one of its members instead.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/" className={buttonStyles.primary}>
          Search another user
        </Link>
        <a
          href={`https://github.com/orgs/${login}/people`}
          rel="noopener noreferrer"
          className={buttonStyles.secondary}
        >
          See members on GitHub
        </a>
      </div>
    </div>
  );
}
