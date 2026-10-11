import { describe, expect, it } from "vitest";
import { lastMonths, normalizeMonthlyActivity } from "./activity";

describe("lastMonths", () => {
  it("returns months oldest first, crossing year boundaries", () => {
    expect(lastMonths(new Date("2026-02-15T00:00:00Z"), 4)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("does not skip short months (e.g. from the 31st)", () => {
    expect(lastMonths(new Date("2026-03-31T00:00:00Z"), 2)).toEqual(["2026-02", "2026-03"]);
  });
});

describe("normalizeMonthlyActivity", () => {
  it("fills gaps with zeros, orders months and drops out-of-range entries", () => {
    const result = normalizeMonthlyActivity(
      [
        { month: "2026-03", commits: 5, pullRequests: 1, issues: 0, reviews: 2 },
        { month: "2025-01", commits: 99, pullRequests: 0, issues: 0, reviews: 0 },
        { month: "2026-01", commits: 1, pullRequests: 0, issues: 1, reviews: 0 },
      ],
      new Date("2026-03-10T00:00:00Z"),
      3,
    );
    expect(result).toEqual([
      { month: "2026-01", commits: 1, pullRequests: 0, issues: 1, reviews: 0 },
      { month: "2026-02", commits: 0, pullRequests: 0, issues: 0, reviews: 0 },
      { month: "2026-03", commits: 5, pullRequests: 1, issues: 0, reviews: 2 },
    ]);
  });
});
