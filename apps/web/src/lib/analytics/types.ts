import type {
  CalendarDay,
  ContributionTotals,
  DataSource,
  MonthlyContributions,
  RawProfile,
} from "@/lib/github/types";

export const REPORT_SCHEMA_VERSION = 1;

export interface CalendarHighlights {
  currentStreak: number;
  longestStreak: number;
  longestStreakRange: { start: string; end: string } | null;
  bestDay: { date: string; count: number } | null;
  activeDays: number;
  /** 0 = Sunday. Null when there is no activity. */
  busiestWeekday: { weekday: number; average: number } | null;
}

export interface LanguageShare {
  name: string;
  color: string | null;
  bytes: number;
  /** 0..1 of total bytes */
  share: number;
  repoCount: number;
}

export interface TopRepo {
  name: string;
  nameWithOwner: string;
  url: string;
  description: string | null;
  stars: number;
  forks: number;
  isArchived: boolean;
  pushedAt: string | null;
  language: { name: string; color: string | null } | null;
}

export interface MergeTimeBucket {
  label: string;
  /** Upper bound in hours (exclusive); null for the open-ended last bucket. */
  maxHours: number | null;
  count: number;
}

export interface PullRequestStats {
  merged: number;
  open: number;
  closed: number;
  /** merged / (merged + closed), null when there are no finished PRs. */
  mergeRate: number | null;
  /** Number of merged PRs the timing stats are based on. */
  sampleSize: number;
  medianHours: number | null;
  p90Hours: number | null;
  meanHours: number | null;
  medianLinesChanged: number | null;
  buckets: MergeTimeBucket[];
}

export interface ActivityItem {
  id: string;
  type: string;
  summary: string;
  repo: string;
  url: string;
  createdAt: string;
}

export interface ProfileReport {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  source: DataSource;
  generatedAt: string;
  profile: RawProfile;
  calendar: { total: number; weeks: CalendarDay[][]; from: string | null; to: string | null };
  highlights: CalendarHighlights;
  totals: ContributionTotals;
  activity: MonthlyContributions[];
  languages: LanguageShare[];
  /** How many repos the language breakdown covers. */
  languageRepoCount: number;
  topRepos: TopRepo[];
  totalStars: number;
  pullRequests: PullRequestStats;
  recentActivity: ActivityItem[];
}
