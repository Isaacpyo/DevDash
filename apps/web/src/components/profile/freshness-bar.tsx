import type { ReportEnvelope } from "@/lib/report-service";
import { formatRelative } from "@/lib/format";
import { ClockIcon, ExternalIcon } from "../icons";
import { buttonStyles, cx } from "../ui";
import { RefreshButton } from "./refresh-button";
import { ShareButton } from "./share-button";

const STATUS_TEXT = {
  miss: "fetched just now",
  hit: "served from cache",
  stale: "refreshing in the background",
} as const;

export function FreshnessBar({ envelope, now }: { envelope: ReportEnvelope; now: number }) {
  const { report, cache } = envelope;
  const live = report.source === "github";
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <p className="flex items-center gap-1.5 text-sm text-ink-muted">
        <ClockIcon />
        <span>
          Updated {formatRelative(cache.storedAt, now)}
          {live && <> · {STATUS_TEXT[cache.status]}</>}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {live && <RefreshButton login={report.profile.login} />}
        <ShareButton path={`/u/${report.profile.login}`} />
        {report.source !== "demo" && (
          <a
            href={report.profile.htmlUrl}
            rel="noopener noreferrer"
            className={cx(buttonStyles.secondary, "px-3 py-1.5")}
          >
            <ExternalIcon />
            GitHub
          </a>
        )}
      </div>
    </div>
  );
}
