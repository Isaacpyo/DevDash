import type { CalendarDay } from "@/lib/github/types";
import type { CalendarHighlights } from "./types";

export function flattenCalendar(weeks: CalendarDay[][]): CalendarDay[] {
  return weeks.flat().sort((a, b) => a.date.localeCompare(b.date));
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/**
 * Streaks follow GitHub's convention: a streak is still "current" if the last
 * day in the calendar (today) has no contributions yet, because the day isn't over.
 */
export function computeHighlights(weeks: CalendarDay[][]): CalendarHighlights {
  const days = flattenCalendar(weeks);

  let index = days.length - 1;
  if (index >= 0 && days[index]!.count === 0) index--;
  let currentStreak = 0;
  while (index >= 0 && days[index]!.count > 0) {
    currentStreak++;
    index--;
  }

  let longestStreak = 0;
  let longestStreakRange: CalendarHighlights["longestStreakRange"] = null;
  let run = 0;
  let runStart = "";
  let bestDay: CalendarHighlights["bestDay"] = null;
  let activeDays = 0;
  const weekdaySums = Array.from({ length: 7 }, () => 0);
  const weekdayCounts = Array.from({ length: 7 }, () => 0);

  for (const day of days) {
    const weekday = weekdayOf(day.date);
    weekdaySums[weekday]! += day.count;
    weekdayCounts[weekday]! += 1;

    if (day.count > 0) {
      activeDays++;
      run++;
      if (run === 1) runStart = day.date;
      if (run > longestStreak) {
        longestStreak = run;
        longestStreakRange = { start: runStart, end: day.date };
      }
      // >= so ties resolve to the most recent day.
      if (!bestDay || day.count >= bestDay.count) bestDay = { date: day.date, count: day.count };
    } else {
      run = 0;
    }
  }

  let busiestWeekday: CalendarHighlights["busiestWeekday"] = null;
  if (activeDays > 0) {
    for (let weekday = 0; weekday < 7; weekday++) {
      const count = weekdayCounts[weekday]!;
      if (count === 0) continue;
      const average = weekdaySums[weekday]! / count;
      if (!busiestWeekday || average > busiestWeekday.average) {
        busiestWeekday = { weekday, average };
      }
    }
  }

  return {
    currentStreak,
    longestStreak,
    longestStreakRange,
    bestDay,
    activeDays,
    busiestWeekday,
  };
}

/**
 * Assigns GitHub-style levels: 0 for no contributions, then quartiles of the
 * non-zero days. Used by the mock provider; the real API returns levels itself.
 */
export function assignLevels(counts: number[]): Array<0 | 1 | 2 | 3 | 4> {
  const nonZero = counts.filter((c) => c > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return counts.map(() => 0);
  const q = (p: number) => nonZero[Math.max(0, Math.ceil(p * nonZero.length) - 1)]!;
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
  return counts.map((count) => {
    if (count <= 0) return 0;
    if (count <= q1) return 1;
    if (count <= q2) return 2;
    if (count <= q3) return 3;
    return 4;
  });
}
