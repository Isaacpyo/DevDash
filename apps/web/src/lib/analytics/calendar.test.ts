import { describe, expect, it } from "vitest";
import type { CalendarDay } from "@/lib/github/types";
import { assignLevels, computeHighlights, weekdayOf } from "./calendar";

/** Builds consecutive days starting at `start` with the given counts, chunked into weeks of 7. */
function calendar(start: string, counts: number[]): CalendarDay[][] {
  const base = new Date(`${start}T00:00:00Z`).getTime();
  const days = counts.map((count, i) => ({
    date: new Date(base + i * 86_400_000).toISOString().slice(0, 10),
    count,
    level: (count > 0 ? 1 : 0) as CalendarDay["level"],
  }));
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

describe("computeHighlights", () => {
  it("returns zeros for an empty calendar", () => {
    expect(computeHighlights([])).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      longestStreakRange: null,
      bestDay: null,
      activeDays: 0,
      busiestWeekday: null,
    });
  });

  it("returns no busiest weekday when every day is zero", () => {
    const result = computeHighlights(calendar("2026-01-04", [0, 0, 0, 0, 0, 0, 0]));
    expect(result.busiestWeekday).toBeNull();
    expect(result.bestDay).toBeNull();
  });

  it("counts the current streak through today", () => {
    const result = computeHighlights(calendar("2026-01-01", [1, 0, 2, 3, 4]));
    expect(result.currentStreak).toBe(3);
  });

  it("keeps the current streak alive when today has no contributions yet", () => {
    const result = computeHighlights(calendar("2026-01-01", [0, 5, 5, 0]));
    expect(result.currentStreak).toBe(2);
  });

  it("breaks the current streak after a full missed day", () => {
    const result = computeHighlights(calendar("2026-01-01", [5, 5, 0, 0]));
    expect(result.currentStreak).toBe(0);
  });

  it("finds the longest streak and its range", () => {
    const result = computeHighlights(calendar("2026-03-01", [1, 1, 0, 2, 2, 2, 0, 1]));
    expect(result.longestStreak).toBe(3);
    expect(result.longestStreakRange).toEqual({ start: "2026-03-04", end: "2026-03-06" });
  });

  it("orders days by date even when weeks arrive shuffled", () => {
    const weeks = calendar("2026-03-01", [1, 1, 1, 0, 0, 0, 0, 1, 1]);
    const result = computeHighlights([...weeks].reverse());
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(3);
  });

  it("picks the most recent best day on ties and counts active days", () => {
    const result = computeHighlights(calendar("2026-03-01", [9, 0, 3, 9, 1]));
    expect(result.bestDay).toEqual({ date: "2026-03-04", count: 9 });
    expect(result.activeDays).toBe(4);
  });

  it("finds the busiest weekday by average", () => {
    // 2026-01-04 is a Sunday. Two weeks: Tuesdays have 10 each, everything else 1.
    const week = [1, 1, 10, 1, 1, 1, 1];
    const result = computeHighlights(calendar("2026-01-04", [...week, ...week]));
    expect(result.busiestWeekday).toEqual({ weekday: 2, average: 10 });
  });
});

describe("weekdayOf", () => {
  it("uses UTC so results don't depend on the server timezone", () => {
    expect(weekdayOf("2026-01-04")).toBe(0);
    expect(weekdayOf("2026-01-10")).toBe(6);
  });
});

describe("assignLevels", () => {
  it("maps zero to level 0 and splits non-zero days into quartiles", () => {
    expect(assignLevels([0, 1, 2, 3, 4, 5, 6, 7, 8])).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it("handles all-zero input", () => {
    expect(assignLevels([0, 0])).toEqual([0, 0]);
  });
});
