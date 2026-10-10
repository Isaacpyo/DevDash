import { describe, expect, it } from "vitest";
import type { RawMergedPullRequest } from "@/lib/github/types";
import { bucketMergeTimes, computePullRequestStats, percentile } from "./pull-requests";

function mergedAfter(hours: number, lines = 10): RawMergedPullRequest {
  const created = Date.parse("2026-01-01T00:00:00Z");
  return {
    createdAt: new Date(created).toISOString(),
    mergedAt: new Date(created + hours * 3_600_000).toISOString(),
    additions: lines,
    deletions: 0,
  };
}

describe("percentile", () => {
  it("interpolates between ranks", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBeCloseTo(9.1);
    expect(percentile([7], 0.9)).toBe(7);
  });

  it("throws on empty input", () => {
    expect(() => percentile([], 0.5)).toThrow(RangeError);
  });
});

describe("bucketMergeTimes", () => {
  it("puts each value in the first bucket whose bound it is below", () => {
    const buckets = bucketMergeTimes([0.5, 1, 5.9, 23, 24, 100, 200, 5000]);
    expect(buckets.map((b) => [b.label, b.count])).toEqual([
      ["< 1h", 1],
      ["1–6h", 2],
      ["6–24h", 1],
      ["1–3d", 1],
      ["3–7d", 1],
      ["1–4w", 1],
      ["> 4w", 1],
    ]);
  });

  it("keeps the open-ended bucket JSON-safe", () => {
    expect(JSON.parse(JSON.stringify(bucketMergeTimes([])))[6].maxHours).toBeNull();
  });
});

describe("computePullRequestStats", () => {
  it("computes merge rate, timing and size stats", () => {
    const stats = computePullRequestStats({
      merged: 30,
      open: 2,
      closed: 10,
      recentMerged: [mergedAfter(1, 10), mergedAfter(2, 20), mergedAfter(3, 30), mergedAfter(10, 40)],
    });

    expect(stats.mergeRate).toBe(0.75);
    expect(stats.sampleSize).toBe(4);
    expect(stats.medianHours).toBe(2.5);
    expect(stats.meanHours).toBe(4);
    expect(stats.p90Hours).toBeCloseTo(7.9);
    expect(stats.medianLinesChanged).toBe(25);
    expect(stats.buckets.reduce((sum, b) => sum + b.count, 0)).toBe(4);
  });

  it("returns nulls when nothing has been merged", () => {
    const stats = computePullRequestStats({ merged: 0, open: 1, closed: 0, recentMerged: [] });
    expect(stats).toMatchObject({
      mergeRate: null,
      medianHours: null,
      p90Hours: null,
      meanHours: null,
      medianLinesChanged: null,
      sampleSize: 0,
    });
  });

  it("ignores PRs with impossible timestamps", () => {
    const stats = computePullRequestStats({
      merged: 2,
      open: 0,
      closed: 0,
      recentMerged: [mergedAfter(-5), { ...mergedAfter(1), mergedAt: "not a date" }, mergedAfter(4)],
    });
    expect(stats.sampleSize).toBe(1);
    expect(stats.medianHours).toBe(4);
  });
});
