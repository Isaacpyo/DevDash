import type { ProfileReport } from "@/lib/analytics/types";
import { formatPercent, plural } from "@/lib/format";
import { Card, EmptyState } from "../ui";

/**
 * Horizontal bars, one series, one colour. Every bar carries its value as a
 * label, so no tooltip or legend is needed.
 */
export function LanguageBreakdown({ report }: { report: ProfileReport }) {
  const { languages, languageRepoCount } = report;
  const max = languages[0]?.share ?? 1;

  return (
    <Card
      title="Languages"
      description={
        languages.length
          ? `By bytes of code across ${plural(languageRepoCount, "public repo")} (forks excluded).`
          : undefined
      }
    >
      {languages.length === 0 ? (
        <EmptyState title="No language data yet">
          This user has no public, non-fork repositories with detectable code.
        </EmptyState>
      ) : (
        <ol className="space-y-3">
          {languages.map((language) => (
            <li key={language.name} title={`${plural(language.repoCount, "repo")}`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-ink">
                  {language.color && (
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: language.color }}
                    />
                  )}
                  <span className="truncate">{language.name}</span>
                </span>
                <span className="tabular shrink-0 text-ink-secondary">
                  {formatPercent(language.share, 1)}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-sunken" aria-hidden>
                <div
                  className="h-2 rounded-full bg-accent"
                  style={{ width: `${Math.max(1, (language.share / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
