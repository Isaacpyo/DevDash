import type { RawPullRequests } from "@/lib/github/types";
import type { MergeTimeBucket, PullRequestStats } from "./types";

const HOUR_MS = 3_600_000;

export const MERGE_TIME_BUCKETS: ReadonlyArray<Omit<MergeTimeBucket, "count">> = [
  { label: "< 1h", maxHours: 1 },
  { label: "1–6h", maxHours: 6 },
  { label: "6–24h", maxHours: 24 },
  { label: "1–3d", maxHours: 72 },
  { label: "3–7d", maxHours: 168 },
  { label: "1–4w", maxHours: 672 },
  { label: "> 4w", maxHours: null },
];

/** Linear-interpolated percentile (the "R-7" method used by Excel and NumPy). */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) throw new RangeError("percentile of empty array");
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

export function bucketMergeTimes(hours: number[]): MergeTimeBucket[] {
  const buckets = MERGE_TIME_BUCKETS.map((bucket) => ({ ...bucket, count: 0 }));
  for (const value of hours) {
    const bucket = buckets.find((b) => b.maxHours === null || value < b.maxHours)!;
    bucket.count++;
  }
  return buckets;
}

export function computePullRequestStats(prs: RawPullRequests): PullRequestStats {
  const hours = prs.recentMerged
    .map((pr) => (Date.parse(pr.mergedAt) - Date.parse(pr.createdAt)) / HOUR_MS)
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);

  const sizes = prs.recentMerged
    .map((pr) => pr.additions + pr.deletions)
    .sort((a, b) => a - b);

  const finished = prs.merged + prs.closed;

  return {
    merged: prs.merged,
    open: prs.open,
    closed: prs.closed,
    mergeRate: finished > 0 ? prs.merged / finished : null,
    sampleSize: hours.length,
    medianHours: hours.length ? percentile(hours, 0.5) : null,
    p90Hours: hours.length ? percentile(hours, 0.9) : null,
    meanHours: hours.length ? hours.reduce((sum, h) => sum + h, 0) / hours.length : null,
    medianLinesChanged: sizes.length ? Math.round(percentile(sizes, 0.5)) : null,
    buckets: bucketMergeTimes(hours),
  };
}
