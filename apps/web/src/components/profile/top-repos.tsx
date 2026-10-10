import type { ProfileReport } from "@/lib/analytics/types";
import { formatCount, formatRelative } from "@/lib/format";
import { ForkIcon, StarIcon } from "../icons";
import { Badge, Card, EmptyState } from "../ui";

export function TopRepos({ report, now }: { report: ProfileReport; now: number }) {
  return (
    <Card
      title="Top repositories"
      description="Most-starred public repositories owned by this user."
    >
      {report.topRepos.length === 0 ? (
        <EmptyState title="No public repositories yet" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {report.topRepos.map((repo) => (
            <li
              key={repo.nameWithOwner}
              className="flex flex-col rounded-xl border border-line p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <a
                  href={repo.url}
                  rel="noopener noreferrer"
                  className="font-medium break-all text-accent-ink underline-offset-2 hover:underline"
                >
                  {repo.name}
                </a>
                {repo.isArchived && <Badge>Archived</Badge>}
              </div>
              <p className="mt-1 line-clamp-2 flex-1 text-sm text-ink-secondary">
                {repo.description ?? <span className="text-ink-muted">No description</span>}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                {repo.language && (
                  <span className="flex items-center gap-1.5">
                    {repo.language.color && (
                      <span
                        aria-hidden
                        className="size-2.5 rounded-full"
                        style={{ background: repo.language.color }}
                      />
                    )}
                    {repo.language.name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <StarIcon width={14} height={14} />
                  <span className="sr-only">Stars:</span>
                  {formatCount(repo.stars)}
                </span>
                <span className="flex items-center gap-1">
                  <ForkIcon width={14} height={14} />
                  <span className="sr-only">Forks:</span>
                  {formatCount(repo.forks)}
                </span>
                {repo.pushedAt && <span>Updated {formatRelative(repo.pushedAt, now)}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
