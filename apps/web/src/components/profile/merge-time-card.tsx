import type { ProfileReport } from "@/lib/analytics/types";
import { formatCount, formatHours, formatPercent, plural } from "@/lib/format";
import { Card, ChartTable, EmptyState } from "../ui";
import { MergeTimeChart } from "./merge-time-chart";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-lg font-semibold text-ink">{value}</dd>
    </div>
  );
}

export function MergeTimeCard({ report }: { report: ProfileReport }) {
  const prs = report.pullRequests;
  const hasTimings = prs.sampleSize > 0;

  return (
    <Card
      title="Pull request merge time"
      description={
        hasTimings
          ? `Time from opening to merge for the last ${plural(prs.sampleSize, "merged PR")}.`
          : undefined
      }
    >
      {!hasTimings ? (
        <EmptyState title="No merged pull requests yet">
          {prs.open > 0
            ? `${plural(prs.open, "pull request")} still open.`
            : "Merge times appear once PRs are merged."}
        </EmptyState>
      ) : (
        <>
          <dl className="mb-4 grid grid-cols-3 gap-3">
            <Stat label="Median" value={formatHours(prs.medianHours!)} />
            <Stat label="90th percentile" value={formatHours(prs.p90Hours!)} />
            <Stat
              label="Merge rate"
              value={prs.mergeRate === null ? "—" : formatPercent(prs.mergeRate)}
            />
          </dl>
          <div role="img" aria-label="Distribution of time to merge; values are in the table below">
            <MergeTimeChart buckets={prs.buckets} />
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            {formatCount(prs.merged)} merged · {formatCount(prs.closed)} closed without merging ·{" "}
            {formatCount(prs.open)} open
            {prs.medianLinesChanged !== null &&
              ` · median size ${formatCount(prs.medianLinesChanged)} lines`}
          </p>
          <ChartTable
            caption="Merged pull requests by time to merge"
            headers={["Time to merge", "Pull requests"]}
            rows={prs.buckets.map((bucket) => [bucket.label, bucket.count])}
          />
        </>
      )}
    </Card>
  );
}
