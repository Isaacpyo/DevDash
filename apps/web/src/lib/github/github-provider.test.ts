import { describe, expect, it, vi } from "vitest";
import { ConfigurationError, NotAUserError, NotFoundError, RateLimitError } from "./errors";
import { createGitHubProvider } from "./github-provider";

const NOW = new Date("2026-10-10T12:00:00Z");

const profileUser = {
  login: "octocat",
  name: "The Octocat",
  avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
  bio: "",
  company: "@github",
  location: "San Francisco",
  websiteUrl: null,
  twitterUsername: null,
  url: "https://github.com/octocat",
  createdAt: "2011-01-25T18:44:36Z",
  followers: { totalCount: 100 },
  following: { totalCount: 9 },
  publicRepos: { totalCount: 8 },
  contributionsCollection: {
    totalCommitContributions: 10,
    totalIssueContributions: 2,
    totalPullRequestContributions: 3,
    totalPullRequestReviewContributions: 4,
    restrictedContributionsCount: 1,
    contributionCalendar: {
      totalContributions: 7,
      weeks: [
        {
          contributionDays: [
            { date: "2026-10-04", contributionCount: 0, contributionLevel: "NONE" },
            { date: "2026-10-05", contributionCount: 7, contributionLevel: "FOURTH_QUARTILE" },
          ],
        },
      ],
    },
  },
  repositories: {
    nodes: [
      {
        name: "hello-world",
        nameWithOwner: "octocat/hello-world",
        url: "https://github.com/octocat/hello-world",
        description: "My first repo",
        stargazerCount: 2500,
        forkCount: 2000,
        isArchived: false,
        pushedAt: "2026-01-01T00:00:00Z",
        primaryLanguage: { name: "Ruby", color: "#701516" },
        languages: { edges: [{ size: 1234, node: { name: "Ruby", color: "#701516" } }] },
      },
      null,
    ],
  },
};

function activityUser() {
  const months = Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [
      `m${i}`,
      {
        totalCommitContributions: i,
        totalIssueContributions: 0,
        totalPullRequestContributions: 1,
        totalPullRequestReviewContributions: 0,
      },
    ]),
  );
  return {
    ...months,
    mergedPullRequests: {
      totalCount: 5,
      nodes: [
        { createdAt: "2026-09-01T00:00:00Z", mergedAt: "2026-09-01T05:00:00Z", additions: 10, deletions: 2 },
        { createdAt: "2026-09-02T00:00:00Z", mergedAt: null, additions: 1, deletions: 1 },
      ],
    },
    openPullRequests: { totalCount: 1 },
    closedPullRequests: { totalCount: 2 },
  };
}

const events = [
  {
    id: "e1",
    type: "PushEvent",
    repo: { name: "octocat/hello-world" },
    created_at: "2026-10-09T10:00:00Z",
    payload: { ref: "refs/heads/main", size: 2 },
  },
  { malformed: true },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

type Routes = {
  profile?: () => Response;
  activity?: () => Response;
  events?: () => Response;
  user?: () => Response;
};

function fakeGitHub(routes: Routes = {}) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/graphql")) {
      const { query } = JSON.parse(String(init?.body)) as { query: string };
      if (query.includes("DevDashProfile")) {
        return routes.profile?.() ?? json({ data: { user: profileUser } });
      }
      return routes.activity?.() ?? json({ data: { user: activityUser() } });
    }
    if (url.includes("/events/public")) return routes.events?.() ?? json(events);
    if (url.includes("/users/")) return routes.user?.() ?? json({ login: "octocat", type: "User" });
    throw new Error(`unexpected request ${url}`);
  });
}

function provider(fetchImpl: typeof fetch) {
  return createGitHubProvider({ fetchImpl, now: () => NOW, retryDelayMs: 0 });
}

describe("createGitHubProvider", () => {
  it("requires a token", async () => {
    await expect(provider(fakeGitHub()).fetchProfile("octocat")).rejects.toBeInstanceOf(ConfigurationError);
  });

  it("maps GraphQL and REST responses into raw data", async () => {
    const data = await provider(fakeGitHub()).fetchProfile("octocat", { token: "t" });

    expect(data.profile).toMatchObject({
      login: "octocat",
      name: "The Octocat",
      bio: null,
      followers: 100,
      publicRepos: 8,
      htmlUrl: "https://github.com/octocat",
    });
    expect(data.calendar.weeks[0]).toEqual([
      { date: "2026-10-04", count: 0, level: 0 },
      { date: "2026-10-05", count: 7, level: 4 },
    ]);
    expect(data.totals).toEqual({ commits: 10, pullRequests: 3, issues: 2, reviews: 4, restricted: 1 });
    expect(data.monthly).toHaveLength(12);
    expect(data.monthly[0]).toMatchObject({ month: "2025-11", commits: 0 });
    expect(data.monthly[11]).toMatchObject({ month: "2026-10", commits: 11 });
    expect(data.repos).toHaveLength(1);
    expect(data.repos[0]).toMatchObject({ stars: 2500, languages: [{ name: "Ruby", bytes: 1234 }] });
    expect(data.pullRequests).toEqual({
      merged: 5,
      open: 1,
      closed: 2,
      recentMerged: [{ createdAt: "2026-09-01T00:00:00Z", mergedAt: "2026-09-01T05:00:00Z", additions: 10, deletions: 2 }],
    });
    expect(data.events.map((e) => e.id)).toEqual(["e1"]);
  });

  it("sends month ranges as variables, not interpolated strings", async () => {
    const fetchImpl = fakeGitHub();
    await provider(fetchImpl).fetchProfile("octocat", { token: "t" });
    const activityCall = fetchImpl.mock.calls.find(([, init]) => String(init?.body).includes("DevDashActivity"));
    const body = JSON.parse(String(activityCall?.[1]?.body)) as { query: string; variables: Record<string, string> };
    expect(body.query).not.toContain("2026-");
    expect(body.variables).toMatchObject({
      login: "octocat",
      m0from: "2025-11-01T00:00:00.000Z",
      m11to: NOW.toISOString(),
    });
  });

  it("still returns data when the events feed fails", async () => {
    const data = await provider(fakeGitHub({ events: () => json({ message: "boom" }, 500) })).fetchProfile(
      "octocat",
      { token: "t" },
    );
    expect(data.events).toEqual([]);
  });

  it("reports unknown users as NotFoundError", async () => {
    const fetchImpl = fakeGitHub({
      profile: () => json({ data: { user: null }, errors: [{ type: "NOT_FOUND" }] }),
      activity: () => json({ data: { user: null }, errors: [{ type: "NOT_FOUND" }] }),
      user: () => json({ message: "Not Found" }, 404),
    });
    await expect(provider(fetchImpl).fetchProfile("ghost-user", { token: "t" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("reports organizations as NotAUserError", async () => {
    const fetchImpl = fakeGitHub({
      profile: () => json({ data: { user: null }, errors: [{ type: "NOT_FOUND" }] }),
      activity: () => json({ data: { user: null } }),
      user: () => json({ login: "github", type: "Organization" }),
    });
    await expect(provider(fetchImpl).fetchProfile("github", { token: "t" })).rejects.toBeInstanceOf(NotAUserError);
  });

  it("propagates rate limits", async () => {
    const fetchImpl = fakeGitHub({
      profile: () => json({ errors: [{ type: "RATE_LIMITED", message: "limit" }] }),
    });
    await expect(provider(fetchImpl).fetchProfile("octocat", { token: "t" })).rejects.toBeInstanceOf(RateLimitError);
  });
});
