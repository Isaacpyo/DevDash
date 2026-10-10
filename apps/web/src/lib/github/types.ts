/**
 * Provider-neutral shape of everything DevDash fetches for one user. Both the
 * real GitHub provider and the mock provider produce this; the analytics layer
 * turns it into a ProfileReport.
 */

export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

export interface CalendarDay {
  /** YYYY-MM-DD */
  date: string;
  count: number;
  level: ContributionLevel;
}

export interface RawProfile {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  websiteUrl: string | null;
  twitterUsername: string | null;
  htmlUrl: string;
  createdAt: string;
  followers: number;
  following: number;
  publicRepos: number;
}

export interface ContributionTotals {
  commits: number;
  pullRequests: number;
  issues: number;
  reviews: number;
  /** Private contributions the user chose to show as anonymous counts. */
  restricted: number;
}

export interface MonthlyContributions {
  /** YYYY-MM */
  month: string;
  commits: number;
  pullRequests: number;
  issues: number;
  reviews: number;
}

export interface RawLanguage {
  name: string;
  color: string | null;
  bytes: number;
}

export interface RawRepo {
  name: string;
  nameWithOwner: string;
  url: string;
  description: string | null;
  stars: number;
  forks: number;
  isArchived: boolean;
  pushedAt: string | null;
  primaryLanguage: { name: string; color: string | null } | null;
  languages: RawLanguage[];
}

export interface RawMergedPullRequest {
  createdAt: string;
  mergedAt: string;
  additions: number;
  deletions: number;
}

export interface RawPullRequests {
  merged: number;
  open: number;
  /** Closed without merging. */
  closed: number;
  /** Most recent merged PRs (up to 100), newest first. */
  recentMerged: RawMergedPullRequest[];
}

/** Subset of a GitHub REST event (GET /users/{user}/events/public) we rely on. */
export interface RawEvent {
  id: string;
  type: string;
  repo: { name: string };
  created_at: string;
  payload: {
    action?: string;
    ref?: string | null;
    ref_type?: string;
    size?: number;
    commits?: unknown[];
    number?: number;
    pull_request?: { number?: number; title?: string; merged?: boolean; html_url?: string };
    issue?: { number?: number; title?: string; html_url?: string };
    release?: { name?: string | null; tag_name?: string; html_url?: string };
    review?: { state?: string; html_url?: string };
    forkee?: { full_name?: string; html_url?: string };
  };
}

export interface GitHubRawData {
  profile: RawProfile;
  calendar: { total: number; weeks: CalendarDay[][] };
  totals: ContributionTotals;
  monthly: MonthlyContributions[];
  repos: RawRepo[];
  pullRequests: RawPullRequests;
  events: RawEvent[];
}

export type DataSource = "github" | "mock" | "demo";

export interface FetchOptions {
  /** OAuth or personal access token to call GitHub with. */
  token?: string;
}

export interface DataProvider {
  readonly kind: "github" | "mock";
  fetchProfile(login: string, options?: FetchOptions): Promise<GitHubRawData>;
}
