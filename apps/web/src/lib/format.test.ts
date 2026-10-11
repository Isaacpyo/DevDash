import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatDay,
  formatHours,
  formatMonthLong,
  formatMonthShort,
  formatPercent,
  formatRelative,
  plural,
} from "./format";

describe("format helpers", () => {
  it("formats counts, compacting from 10k", () => {
    expect(formatCount(1284)).toBe("1,284");
    expect(formatCount(12_900)).toBe("12.9K");
    expect(formatCount(4_200_000)).toBe("4.2M");
  });

  it("formats durations from hours", () => {
    expect(formatHours(0.004)).toBe("1m");
    expect(formatHours(0.75)).toBe("45m");
    expect(formatHours(3.5)).toBe("3.5h");
    expect(formatHours(12.2)).toBe("12h");
    expect(formatHours(30)).toBe("1.3d");
    expect(formatHours(24 * 20)).toBe("2.9w");
  });

  it("formats dates in UTC", () => {
    expect(formatDay("2026-03-04")).toBe("Mar 4");
    expect(formatMonthShort("2026-03")).toBe("Mar");
    expect(formatMonthLong("2026-03")).toBe("March 2026");
  });

  it("formats relative times", () => {
    const now = Date.parse("2026-10-10T12:00:00Z");
    expect(formatRelative(now - 30_000, now)).toBe("just now");
    expect(formatRelative(now - 5 * 60_000, now)).toBe("5 minutes ago");
    expect(formatRelative(now - 26 * 3_600_000, now)).toBe("yesterday");
    expect(formatRelative(now + 2 * 3_600_000, now)).toBe("in 2 hours");
  });

  it("formats percents and plurals", () => {
    expect(formatPercent(0.756)).toBe("76%");
    expect(formatPercent(0.756, 1)).toBe("75.6%");
    expect(plural(1, "repo")).toBe("1 repo");
    expect(plural(3, "repo")).toBe("3 repos");
    expect(plural(2, "day", "days")).toBe("2 days");
  });
});
