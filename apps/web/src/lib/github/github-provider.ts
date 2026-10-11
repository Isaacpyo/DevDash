import type { z } from "zod";
import { ConfigurationError, GitHubError, NotAUserError, NotFoundError } from "./errors";
import { GitHubClient } from "./http";
import { activityVariables, buildActivityQuery, monthRanges, PROFILE_QUERY } from "./queries";
import {
  activityQuerySchema,
  LEVELS,
  profileQuerySchema,
  restEventsSchema,
  restUserSchema,
} from "./schemas";
import type { DataProvider, FetchOptions, GitHubRawData, RawEvent } from "./types";

const MONTHS = 12;

export interface GitHubProviderOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  retryDelayMs?: number;
  now?: () => Date;
}

type ProfileUser = NonNullable<z.output<typeof profileQuerySchema>["user"]>;
type ActivityUser = NonNullable<z.output<ReturnType<typeof activityQuerySchema>>["user"]>;

/**
 * Fetches everything for one user with two GraphQL queries and one REST call,
 * issued in parallel. GraphQL is used for the heavy aggregates; REST covers the
 * public events feed (no GraphQL equivalent) and the org-vs-missing check.
 */
export function createGitHubProvider(options: GitHubProviderOptions = {}): DataProvider {
  return {
    kind: "github",
    async fetchProfile(login: string, { token }: FetchOptions = {}): Promise<GitHubRawData> {
      if (!token) {
        throw new ConfigurationError("The GitHub provider needs a token (set GITHUB_TOKEN)");
      }
      const client = new GitHubClient({
        token,
        fetchImpl: options.fetchImpl,
        baseUrl: options.baseUrl,
        timeoutMs: options.timeoutMs,
        retryDelayMs: options.retryDelayMs,
      });
      const now = options.now?.() ?? new Date();
      const months = monthRanges(now, MONTHS);

      const [profileResult, activityResult, eventsResult] = await Promise.allSettled([
        client.graphql(PROFILE_QUERY, { login }, profileQuerySchema),
        client.graphql(
          buildActivityQuery(MONTHS),
          activityVariables(login, months),
          activityQuerySchema(MONTHS),
        ),
        client.rest(
          `/users/${encodeURIComponent(login)}/events/public?per_page=50`,
          restEventsSchema,
          login,
        ),
      ]);

      if (profileResult.status === "rejected") throw profileResult.reason;
      const user = profileResult.value.user;
      if (!user) throw await explainMissingUser(client, login);

      if (activityResult.status === "rejected") throw activityResult.reason;
      const activity = activityResult.value.user;
      if (!activity) throw new NotFoundError(login);

      // The events feed is a nice-to-have; never fail the whole page for it.
      const events: RawEvent[] = eventsResult.status === "fulfilled" ? eventsResult.value : [];

      return mapRawData(user, activity, months, events);
    },
  };
}

/** GraphQL's user(login:) is null for both unknown logins and organizations. REST tells them apart. */
async function explainMissingUser(client: GitHubClient, login: string): Promise<GitHubError> {
  try {
    const restUser = await client.rest(
      `/users/${encodeURIComponent(login)}`,
      restUserSchema,
      login,
    );
    return restUser.type === "Organization"
      ? new NotAUserError(restUser.login)
      : new NotFoundError(login);
  } catch (error) {
    if (error instanceof GitHubError) return error;
    throw error;
  }
}

function mapRawData(
  user: ProfileUser,
  activity: ActivityUser,
  months: ReturnType<typeof monthRanges>,
  events: RawEvent[],
): GitHubRawData {
  const collection = user.contributionsCollection;
  const activityByAlias = activity as unknown as Record<
    string,
    {
      totalCommitContributions: number;
      totalIssueContributions: number;
      totalPullRequestContributions: number;
      totalPullRequestReviewContributions: number;
    }
  >;

  return {
    profile: {
      login: user.login,
      name: user.name || null,
      avatarUrl: user.avatarUrl,
      bio: user.bio || null,
      company: user.company || null,
      location: user.location || null,
      websiteUrl: user.websiteUrl || null,
      twitterUsername: user.twitterUsername || null,
      htmlUrl: user.url,
      createdAt: user.createdAt,
      followers: user.followers.totalCount,
      following: user.following.totalCount,
      publicRepos: user.publicRepos.totalCount,
    },
    calendar: {
      total: collection.contributionCalendar.totalContributions,
      weeks: collection.contributionCalendar.weeks.map((week) =>
        week.contributionDays.map((day) => ({
          date: day.date,
          count: day.contributionCount,
          level: LEVELS[day.contributionLevel],
        })),
      ),
    },
    totals: {
      commits: collection.totalCommitContributions,
      pullRequests: collection.totalPullRequestContributions,
      issues: collection.totalIssueContributions,
      reviews: collection.totalPullRequestReviewContributions,
      restricted: collection.restrictedContributionsCount,
    },
    monthly: months.map((range, i) => {
      const totals = activityByAlias[`m${i}`];
      return {
        month: range.month,
        commits: totals?.totalCommitContributions ?? 0,
        pullRequests: totals?.totalPullRequestContributions ?? 0,
        issues: totals?.totalIssueContributions ?? 0,
        reviews: totals?.totalPullRequestReviewContributions ?? 0,
      };
    }),
    repos: user.repositories.nodes.flatMap((repo) =>
      repo
        ? [
            {
              name: repo.name,
              nameWithOwner: repo.nameWithOwner,
              url: repo.url,
              description: repo.description,
              stars: repo.stargazerCount,
              forks: repo.forkCount,
              isArchived: repo.isArchived,
              pushedAt: repo.pushedAt,
              primaryLanguage: repo.primaryLanguage,
              languages: repo.languages.edges.map((edge) => ({
                name: edge.node.name,
                color: edge.node.color,
                bytes: edge.size,
              })),
            },
          ]
        : [],
    ),
    pullRequests: {
      merged: activity.mergedPullRequests.totalCount,
      open: activity.openPullRequests.totalCount,
      closed: activity.closedPullRequests.totalCount,
      recentMerged: activity.mergedPullRequests.nodes.flatMap((pr) =>
        pr?.mergedAt
          ? [
              {
                createdAt: pr.createdAt,
                mergedAt: pr.mergedAt,
                additions: pr.additions,
                deletions: pr.deletions,
              },
            ]
          : [],
      ),
    },
    events,
  };
}
