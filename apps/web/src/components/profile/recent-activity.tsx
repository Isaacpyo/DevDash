import type { ProfileReport } from "@/lib/analytics/types";
import { formatRelative } from "@/lib/format";
import { Card, EmptyState } from "../ui";

export function RecentActivity({ report, now }: { report: ProfileReport; now: number }) {
  return (
    <Card title="Recent activity" description="Latest public events from the GitHub REST API.">
      {report.recentActivity.length === 0 ? (
        <EmptyState title="No recent public activity">
          GitHub only keeps public events for 90 days.
        </EmptyState>
      ) : (
        <ol className="divide-y divide-line">
          {report.recentActivity.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-3"
            >
              <div className="min-w-0 flex-1 text-sm">
                <a
                  href={item.url}
                  rel="noopener noreferrer"
                  className="text-ink underline-offset-2 hover:underline"
                >
                  {item.summary}
                </a>
                <span className="text-ink-muted"> in </span>
                <a
                  href={`https://github.com/${item.repo}`}
                  rel="noopener noreferrer"
                  className="break-all text-accent-ink underline-offset-2 hover:underline"
                >
                  {item.repo}
                </a>
              </div>
              <time dateTime={item.createdAt} className="shrink-0 text-xs text-ink-muted">
                {formatRelative(item.createdAt, now)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
