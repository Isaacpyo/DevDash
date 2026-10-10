import { describe, expect, it } from "vitest";
import { generateMockData } from "@/lib/github/mock-provider";
import { buildReport } from "./report";
import { REPORT_SCHEMA_VERSION } from "./types";

const NOW = new Date("2026-10-10T12:00:00Z");

describe("buildReport", () => {
  it("assembles every section from raw data", () => {
    const raw = generateMockData("octocat", NOW);
    const report = buildReport(raw, { source: "mock", now: NOW });

    expect(report.schemaVersion).toBe(REPORT_SCHEMA_VERSION);
    expect(report.source).toBe("mock");
    expect(report.generatedAt).toBe(NOW.toISOString());
    expect(report.calendar.to).toBe("2026-10-10");
    expect(report.calendar.total).toBe(raw.calendar.total);
    expect(report.activity).toHaveLength(12);
    expect(report.repoCount).toBe(raw.repos.length);
    expect(report.topRepos.length).toBeLessThanOrEqual(6);
    expect(report.languages.length).toBeLessThanOrEqual(8);
    expect(report.recentActivity.length).toBeLessThanOrEqual(10);
  });

  it("survives a JSON round trip unchanged (it is cached as JSON)", () => {
    const report = buildReport(generateMockData("octocat", NOW), { source: "mock", now: NOW });
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });

  it("handles a user with no activity at all", () => {
    const report = buildReport(generateMockData("mock-empty", NOW), { source: "mock", now: NOW });
    expect(report.calendar.total).toBe(0);
    expect(report.languages).toEqual([]);
    expect(report.topRepos).toEqual([]);
    expect(report.pullRequests.medianHours).toBeNull();
    expect(report.highlights.bestDay).toBeNull();
    expect(report.recentActivity).toEqual([]);
  });
});
