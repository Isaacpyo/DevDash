import type { MonthlyContributions } from "@/lib/github/types";

export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** The last `count` calendar months (UTC) ending with the month containing `now`, oldest first. */
export function lastMonths(now: Date, count = 12): string[] {
  const months: string[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    months.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))));
  }
  return months;
}

/** Ensures exactly `count` months in order, filling gaps with zeros and dropping anything outside. */
export function normalizeMonthlyActivity(
  monthly: MonthlyContributions[],
  now: Date,
  count = 12,
): MonthlyContributions[] {
  const byMonth = new Map(monthly.map((entry) => [entry.month, entry]));
  return lastMonths(now, count).map(
    (month) =>
      byMonth.get(month) ?? { month, commits: 0, pullRequests: 0, issues: 0, reviews: 0 },
  );
}
