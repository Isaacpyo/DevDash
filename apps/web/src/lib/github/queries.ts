/** One round trip for the profile, the contribution calendar and up to 100 public repos. */
export const PROFILE_QUERY = /* GraphQL */ `
  query DevDashProfile($login: String!) {
    user(login: $login) {
      login
      name
      avatarUrl(size: 200)
      bio
      company
      location
      websiteUrl
      twitterUsername
      url
      createdAt
      followers {
        totalCount
      }
      following {
        totalCount
      }
      publicRepos: repositories(ownerAffiliations: OWNER, privacy: PUBLIC) {
        totalCount
      }
      contributionsCollection {
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
            }
          }
        }
      }
      repositories(
        first: 100
        ownerAffiliations: OWNER
        isFork: false
        privacy: PUBLIC
        orderBy: { field: STARGAZERS, direction: DESC }
      ) {
        nodes {
          name
          nameWithOwner
          url
          description
          stargazerCount
          forkCount
          isArchived
          pushedAt
          primaryLanguage {
            name
            color
          }
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
        }
      }
    }
  }
`;

export interface MonthRange {
  /** YYYY-MM */
  month: string;
  from: string;
  to: string;
}

/**
 * Monthly totals need one contributionsCollection per month. They are aliased
 * (m0..mN) and parameterised with variables so nothing is interpolated into the
 * query text.
 */
export function buildActivityQuery(monthCount: number): string {
  const indices = Array.from({ length: monthCount }, (_, i) => i);
  const variableDefs = indices.map((i) => `$m${i}from: DateTime!, $m${i}to: DateTime!`).join(", ");
  const collections = indices
    .map(
      (i) => `m${i}: contributionsCollection(from: $m${i}from, to: $m${i}to) {
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
      }`,
    )
    .join("\n      ");

  return /* GraphQL */ `
  query DevDashActivity($login: String!, ${variableDefs}) {
    user(login: $login) {
      ${collections}
      mergedPullRequests: pullRequests(
        first: 100
        states: MERGED
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        totalCount
        nodes {
          createdAt
          mergedAt
          additions
          deletions
        }
      }
      openPullRequests: pullRequests(states: OPEN) {
        totalCount
      }
      closedPullRequests: pullRequests(states: CLOSED) {
        totalCount
      }
    }
  }
`;
}

export function activityVariables(login: string, months: MonthRange[]): Record<string, string> {
  const variables: Record<string, string> = { login };
  months.forEach((range, i) => {
    variables[`m${i}from`] = range.from;
    variables[`m${i}to`] = range.to;
  });
  return variables;
}

/** Calendar-month ranges (UTC) for the last `count` months; the current month ends at `now`. */
export function monthRanges(now: Date, count = 12): MonthRange[] {
  const ranges: MonthRange[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const nextStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const end = offset === 0 ? now : new Date(nextStart.getTime() - 1000);
    ranges.push({
      month: start.toISOString().slice(0, 7),
      from: start.toISOString(),
      to: end.toISOString(),
    });
  }
  return ranges;
}
