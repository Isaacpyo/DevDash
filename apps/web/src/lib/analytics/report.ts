import type { DataSource, GitHubRawData } from "@/lib/github/types";
import { normalizeMonthlyActivity } from "./activity";
import { computeHighlights, flattenCalendar } from "./calendar";
import { summarizeEvents } from "./events";
import { aggregateLanguages } from "./languages";
import { computePullRequestStats } from "./pull-requests";
import { topRepositories, totalStars } from "./repos";
import { type ProfileReport, REPORT_SCHEMA_VERSION } from "./types";

export interface BuildReportOptions {
  source: DataSource;
  now: Date;
}

/** Pure: turns raw provider data into everything the dashboard renders. */
export function buildReport(
  raw: GitHubRawData,
  { source, now }: BuildReportOptions,
): ProfileReport {
  const days = flattenCalendar(raw.calendar.weeks);
  const languageRepos = raw.repos.filter((repo) => repo.languages.length > 0);

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    source,
    generatedAt: now.toISOString(),
    profile: raw.profile,
    calendar: {
      total: raw.calendar.total,
      weeks: raw.calendar.weeks,
      from: days[0]?.date ?? null,
      to: days.at(-1)?.date ?? null,
    },
    highlights: computeHighlights(raw.calendar.weeks),
    totals: raw.totals,
    activity: normalizeMonthlyActivity(raw.monthly, now),
    languages: aggregateLanguages(raw.repos),
    languageRepoCount: languageRepos.length,
    topRepos: topRepositories(raw.repos),
    repoCount: raw.repos.length,
    totalStars: totalStars(raw.repos),
    pullRequests: computePullRequestStats(raw.pullRequests),
    recentActivity: summarizeEvents(raw.events),
  };
}
