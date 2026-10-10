"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyContributions } from "@/lib/github/types";
import {
  formatCompact,
  formatCount,
  formatMonthLong,
  formatMonthShort,
  plural,
} from "@/lib/format";
import { ChartTable } from "../ui";
import { axisTick, ChartTooltip } from "./chart-tooltip";

type Metric = "commits" | "pullRequests" | "reviews" | "issues";

const METRICS: Array<{ key: Metric; title: string; unit: string }> = [
  { key: "commits", title: "Commits", unit: "commit" },
  { key: "pullRequests", title: "Pull requests", unit: "pull request" },
  { key: "reviews", title: "Code reviews", unit: "review" },
  { key: "issues", title: "Issues", unit: "issue" },
];

/**
 * Small multiples rather than one stacked chart: commits usually dwarf the other
 * series, which would flatten PRs and issues to nothing. Each panel is a single
 * series on its own axis, titled, so no legend is needed.
 */
export function ActivityCharts({ activity }: { activity: MonthlyContributions[] }) {
  return (
    <div>
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        {METRICS.map(({ key, title, unit }) => {
          const total = activity.reduce((sum, month) => sum + month[key], 0);
          return (
            <figure key={key} className="min-w-0">
              <figcaption className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-ink">{title}</span>
                <span className="text-ink-muted">{formatCount(total)} in 12 months</span>
              </figcaption>
              <div
                className="mt-2 h-36"
                role="img"
                aria-label={`${title} per month: ${plural(total, unit)} over the last 12 months`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activity} margin={{ top: 4, right: 0, bottom: 0, left: -12 }}>
                    <CartesianGrid vertical={false} stroke="var(--gridline)" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={formatMonthShort}
                      tick={axisTick}
                      tickLine={false}
                      axisLine={{ stroke: "var(--axis)" }}
                      interval="preserveStartEnd"
                      minTickGap={6}
                    />
                    <YAxis
                      tickFormatter={(value: number) => formatCompact(value)}
                      tick={axisTick}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={40}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--accent-wash)" }}
                      content={
                        <ChartTooltip
                          formatLabel={formatMonthLong}
                          formatValue={(v) => plural(v, unit)}
                        />
                      }
                    />
                    <Bar
                      dataKey={key}
                      fill="var(--accent)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </figure>
          );
        })}
      </div>
      <ChartTable
        caption="Contributions per month by type"
        headers={["Month", "Commits", "PRs", "Reviews", "Issues"]}
        rows={activity.map((m) => [
          formatMonthLong(m.month),
          formatCount(m.commits),
          formatCount(m.pullRequests),
          formatCount(m.reviews),
          formatCount(m.issues),
        ])}
      />
    </div>
  );
}
