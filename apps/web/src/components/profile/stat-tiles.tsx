import type { ProfileReport } from "@/lib/analytics/types";
import { formatCount, formatHours, plural } from "@/lib/format";

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</dd>
      {detail && <dd className="mt-0.5 text-xs text-ink-muted">{detail}</dd>}
    </div>
  );
}

export function StatTiles({ report }: { report: ProfileReport }) {
  const { highlights, pullRequests, calendar } = report;
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Tile label="Contributions" value={formatCount(calendar.total)} detail="last 12 months" />
      <Tile label="Current streak" value={plural(highlights.currentStreak, "day")} />
      <Tile
        label="Longest streak"
        value={plural(highlights.longestStreak, "day")}
        detail="last 12 months"
      />
      <Tile
        label="Stars earned"
        value={formatCount(report.totalStars)}
        detail={`across ${plural(report.repoCount, "repo")}`}
      />
      <Tile label="Merged PRs" value={formatCount(pullRequests.merged)} detail="all time" />
      <Tile
        label="Median time to merge"
        value={pullRequests.medianHours === null ? "—" : formatHours(pullRequests.medianHours)}
        detail={
          pullRequests.sampleSize
            ? `last ${plural(pullRequests.sampleSize, "merged PR")}`
            : "no merged PRs"
        }
      />
    </dl>
  );
}
