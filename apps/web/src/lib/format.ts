const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en");
const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const shortDate = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const monthShort = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const timeFormat = new Intl.DateTimeFormat("en", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** 1,284 below 10k; 12.9K / 4.2M above. */
export function formatCount(value: number): string {
  return Math.abs(value) < 10_000 ? whole.format(value) : compact.format(value);
}

export function formatCompact(value: number): string {
  return compact.format(value);
}

export function formatPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Human duration from hours: 45m, 3.5h, 2.1d, 3.4w. */
export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) return `${trim(hours)}h`;
  const days = hours / 24;
  if (days < 14) return `${trim(days)}d`;
  return `${trim(days / 7)}w`;
}

function trim(value: number): string {
  return value >= 10 ? Math.round(value).toString() : value.toFixed(1).replace(/\.0$/, "");
}

export function formatDate(value: string | number | Date): string {
  return dateFormat.format(new Date(value));
}

/** "Mar 4" for a YYYY-MM-DD calendar date. */
export function formatDay(date: string): string {
  return shortDate.format(new Date(`${date}T00:00:00Z`));
}

/** "Mar" for YYYY-MM. */
export function formatMonthShort(month: string): string {
  return monthShort.format(new Date(`${month}-01T00:00:00Z`));
}

/** "March 2026" for YYYY-MM. */
export function formatMonthLong(month: string): string {
  return monthLong.format(new Date(`${month}-01T00:00:00Z`));
}

export function formatTime(value: number): string {
  return timeFormat.format(new Date(value));
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 86_400_000],
  ["month", 30 * 86_400_000],
  ["week", 7 * 86_400_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelative(value: string | number, now: number = Date.now()): string {
  const diff = new Date(value).getTime() - now;
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return relative.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;
}
