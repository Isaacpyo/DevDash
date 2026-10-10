import { describe, expect, it } from "vitest";
import { buildReport } from "@/lib/analytics/report";
import { generateDemoData } from "./demo-fixture";
import { NotAUserError, NotFoundError, RateLimitError } from "./errors";
import { createMockProvider, generateMockData, MOCK_LOGINS } from "./mock-provider";
import { DEMO_LOGIN } from "./username";

const NOW = new Date("2026-10-10T12:00:00Z");

describe("generateMockData", () => {
  it("is deterministic for the same login and day", () => {
    expect(generateMockData("octocat", NOW)).toEqual(generateMockData("octocat", NOW));
  });

  it("treats logins case-insensitively but keeps the requested casing", () => {
    const a = generateMockData("OctoCat", NOW);
    const b = generateMockData("octocat", NOW);
    expect(a.calendar).toEqual(b.calendar);
    expect(a.profile.login).toBe("OctoCat");
  });

  it("produces different data for different logins", () => {
    expect(generateMockData("alice", NOW).calendar.total).not.toBe(
      generateMockData("bob", NOW).calendar.total,
    );
  });

  it("keeps past days stable as time moves forward", () => {
    const today = generateMockData("octocat", NOW).calendar.weeks.flat();
    const tomorrow = generateMockData(
      "octocat",
      new Date(NOW.getTime() + 86_400_000),
    ).calendar.weeks.flat();
    const sample = today.slice(-30, -1);
    for (const day of sample) {
      expect(tomorrow.find((d) => d.date === day.date)?.count).toBe(day.count);
    }
  });

  it("builds a GitHub-shaped calendar: Sunday-first weeks ending today", () => {
    const { calendar } = generateMockData("octocat", NOW);
    const days = calendar.weeks.flat();
    expect(new Date(`${days[0]!.date}T00:00:00Z`).getUTCDay()).toBe(0);
    expect(days.at(-1)!.date).toBe("2026-10-10");
    expect(calendar.weeks.length).toBeGreaterThanOrEqual(52);
    expect(calendar.total).toBe(days.reduce((sum, d) => sum + d.count, 0));
  });

  it("produces internally consistent data that builds into a report", () => {
    const raw = generateMockData("octocat", NOW);
    const report = buildReport(raw, { source: "mock", now: NOW });
    expect(report.activity).toHaveLength(12);
    expect(raw.pullRequests.recentMerged.length).toBeLessThanOrEqual(100);
    for (const pr of raw.pullRequests.recentMerged) {
      expect(Date.parse(pr.mergedAt)).toBeGreaterThanOrEqual(Date.parse(pr.createdAt));
    }
    const { commits, pullRequests, issues, reviews } = raw.totals;
    expect(commits + pullRequests + issues + reviews).toBe(raw.calendar.total);
  });

  it("returns an empty profile for the empty mock login", () => {
    const raw = generateMockData(MOCK_LOGINS.empty, NOW);
    expect(raw.calendar.total).toBe(0);
    expect(raw.repos).toEqual([]);
    expect(raw.events).toEqual([]);
    expect(raw.pullRequests.merged).toBe(0);
  });
});

describe("generateDemoData", () => {
  it("uses the seeded profile and repos", () => {
    const raw = generateDemoData(NOW);
    expect(raw.profile).toMatchObject({
      login: DEMO_LOGIN,
      name: "Demo Developer",
      followers: 1284,
    });
    expect(raw.repos.map((r) => r.name)).toContain("tiny-queue");
    expect(raw.repos.every((r) => r.nameWithOwner.startsWith(`${DEMO_LOGIN}/`))).toBe(true);
    expect(raw.calendar.total).toBeGreaterThan(500);
  });
});

describe("createMockProvider", () => {
  const provider = createMockProvider({ now: () => NOW });

  it("returns generated data", async () => {
    await expect(provider.fetchProfile("octocat")).resolves.toMatchObject({
      profile: { login: "octocat" },
    });
  });

  it("simulates the error states", async () => {
    await expect(provider.fetchProfile(MOCK_LOGINS.notFound)).rejects.toBeInstanceOf(NotFoundError);
    await expect(provider.fetchProfile(MOCK_LOGINS.organization)).rejects.toBeInstanceOf(
      NotAUserError,
    );
    const error = await provider.fetchProfile(MOCK_LOGINS.rateLimited).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).resetAt).toBeGreaterThan(NOW.getTime());
  });
});
