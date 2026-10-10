import type { ReportEnvelope } from "@/lib/report-service";
import { formatDay, plural, WEEKDAYS } from "@/lib/format";
import { RememberProfile } from "../recent-profiles";
import { Card } from "../ui";
import { ActivityCharts } from "./activity-charts";
import { ContributionHeatmap } from "./contribution-heatmap";
import { FreshnessBar } from "./freshness-bar";
import { LanguageBreakdown } from "./language-breakdown";
import { MergeTimeCard } from "./merge-time-card";
import { StaleDataBanner } from "./notices";
import { ProfileHeader } from "./profile-header";
import { RecentActivity } from "./recent-activity";
import { StatTiles } from "./stat-tiles";
import { TopRepos } from "./top-repos";

export function ProfileDashboard({
  envelope,
  isOwnProfile,
}: {
  envelope: ReportEnvelope;
  isOwnProfile: boolean;
}) {
  const { report } = envelope;
  const { highlights } = report;
  // One reference time so every relative time on the page agrees.
  const now = envelope.servedAt;

  return (
    <div className="space-y-6">
      <RememberProfile login={report.profile.login} />
      <ProfileHeader report={report} isOwnProfile={isOwnProfile} />
      <FreshnessBar envelope={envelope} now={now} />
      {envelope.rateLimitedUntil && (
        <StaleDataBanner
          storedAt={envelope.cache.storedAt}
          resetAt={envelope.rateLimitedUntil}
          now={now}
        />
      )}
      <StatTiles report={report} />

      <Card
        title="Contributions"
        description={
          report.calendar.total > 0
            ? `${plural(report.calendar.total, "contribution")} in the last year${
                report.totals.restricted > 0
                  ? `, including ${plural(report.totals.restricted, "private contribution")}`
                  : ""
              }.`
            : "No public contributions in the last year."
        }
      >
        <ContributionHeatmap weeks={report.calendar.weeks} total={report.calendar.total} />
        {highlights.activeDays > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-ink-muted">Best day</dt>
              <dd className="font-medium text-ink">
                {highlights.bestDay
                  ? `${plural(highlights.bestDay.count, "contribution")} on ${formatDay(highlights.bestDay.date)}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Active days</dt>
              <dd className="font-medium text-ink">{plural(highlights.activeDays, "day")}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Busiest weekday</dt>
              <dd className="font-medium text-ink">
                {highlights.busiestWeekday
                  ? `${WEEKDAYS[highlights.busiestWeekday.weekday]} (${highlights.busiestWeekday.average.toFixed(1)}/day)`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Longest streak</dt>
              <dd className="font-medium text-ink">
                {highlights.longestStreakRange
                  ? `${formatDay(highlights.longestStreakRange.start)} – ${formatDay(highlights.longestStreakRange.end)}`
                  : "—"}
              </dd>
            </div>
          </dl>
        )}
      </Card>

      <Card
        title="Activity over time"
        description="Contributions per month for the last 12 months."
      >
        <ActivityCharts activity={report.activity} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <LanguageBreakdown report={report} />
        <MergeTimeCard report={report} />
      </div>

      <TopRepos report={report} now={now} />
      <RecentActivity report={report} now={now} />
    </div>
  );
}
