"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MergeTimeBucket } from "@/lib/analytics/types";
import { plural } from "@/lib/format";
import { axisTick, ChartTooltip } from "./chart-tooltip";

export function MergeTimeChart({ buckets }: { buckets: MergeTimeBucket[] }) {
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 4, right: 0, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--gridline)" />
          <XAxis
            dataKey="label"
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: "var(--axis)" }}
            interval={0}
          />
          <YAxis
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
                formatLabel={(label) => `Merged in ${label}`}
                formatValue={(v) => plural(v, "pull request")}
              />
            }
          />
          <Bar
            dataKey="count"
            fill="var(--accent)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
