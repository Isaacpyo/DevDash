"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { weekdayOf } from "@/lib/analytics/calendar";
import type { CalendarDay } from "@/lib/github/types";
import { formatCount, formatDay, formatMonthLong, formatMonthShort, plural } from "@/lib/format";
import { ChartTable } from "../ui";

const CELL = 11;
const STEP = 14;
const LEFT = 30;
const TOP = 20;
const WEEKDAY_LABELS: Array<[number, string]> = [
  [1, "Mon"],
  [3, "Wed"],
  [5, "Fri"],
];

interface Tooltip {
  day: CalendarDay;
  x: number;
  y: number;
}

/** GitHub-style year calendar drawn as SVG, with a one-hue sequential scale. */
export function ContributionHeatmap({ weeks, total }: { weeks: CalendarDay[][]; total: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const cells = useMemo(() => {
    let index = 0;
    return weeks.flatMap((week, weekIndex) =>
      week.map((day) => ({ day, weekIndex, index: index++ })),
    );
  }, [weeks]);
  const days = useMemo(() => cells.map((cell) => cell.day), [cells]);
  const width = LEFT + weeks.length * STEP;
  const height = TOP + 7 * STEP;

  const monthLabels = useMemo(() => {
    const labels: Array<{ x: number; label: string }> = [];
    let previous = "";
    weeks.forEach((week, index) => {
      const month = week[0]?.date.slice(0, 7);
      if (!month || month === previous) return;
      previous = month;
      const x = LEFT + index * STEP;
      // Skip a label that would collide with the previous one (partial first month).
      if (labels.length && x - labels.at(-1)!.x < STEP * 3) labels.pop();
      labels.push({ x, label: formatMonthShort(month) });
    });
    return labels;
  }, [weeks]);

  const monthlyRows = useMemo(() => {
    const totals = new Map<string, number>();
    for (const day of days)
      totals.set(day.date.slice(0, 7), (totals.get(day.date.slice(0, 7)) ?? 0) + day.count);
    return [...totals.entries()].map(([month, count]) => [
      formatMonthLong(month),
      formatCount(count),
    ]);
  }, [days]);

  // Start scrolled to the most recent weeks on narrow screens.
  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, []);

  const first = days[0]?.date;
  const last = days.at(-1)?.date;
  const label =
    first && last
      ? `Contribution heatmap: ${plural(total, "contribution")} from ${formatDay(first)} to ${formatDay(last)}. Monthly totals are in the table below.`
      : "Contribution heatmap: no data";

  function showTooltip(target: EventTarget) {
    const element = target as SVGElement;
    const index = Number(element.dataset?.index);
    const day = days[index];
    const container = scrollRef.current;
    if (!day || !container) return;
    const rect = element.getBoundingClientRect();
    const box = container.getBoundingClientRect();
    setTooltip({
      day,
      x: rect.left - box.left + container.scrollLeft + CELL / 2,
      y: rect.top - box.top,
    });
  }

  return (
    <div>
      <div
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label="Contribution heatmap, scrollable"
        className="relative overflow-x-auto pb-2"
        onPointerLeave={() => setTooltip(null)}
      >
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={label}
          // Natural size on small screens (the region scrolls); scales up to fill wide cards.
          style={{ minWidth: width, maxWidth: width * 1.45 }}
          className="block h-auto"
          onPointerOver={(event) => showTooltip(event.target)}
        >
          {monthLabels.map(({ x, label: text }) => (
            <text key={`${x}-${text}`} x={x} y={12} fontSize={11} fill="var(--ink-muted)">
              {text}
            </text>
          ))}
          {WEEKDAY_LABELS.map(([row, text]) => (
            <text
              key={text}
              x={0}
              y={TOP + row * STEP + CELL - 1}
              fontSize={11}
              fill="var(--ink-muted)"
            >
              {text}
            </text>
          ))}
          {cells.map(({ day, weekIndex, index }) => (
            <rect
              key={day.date}
              data-index={index}
              x={LEFT + weekIndex * STEP}
              y={TOP + weekdayOf(day.date) * STEP}
              width={CELL}
              height={CELL}
              rx={2}
              fill={`var(--heat-${day.level})`}
              className="transition-opacity hover:opacity-80"
            />
          ))}
        </svg>
        {tooltip && (
          <div
            role="presentation"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-3 py-2 text-xs whitespace-nowrap shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y - 6 }}
          >
            <span className="font-semibold text-ink">
              {plural(tooltip.day.count, "contribution")}
            </span>
            <span className="text-ink-muted"> on {formatDay(tooltip.day.date)}</span>
          </div>
        )}
      </div>

      <div
        className="mt-2 flex items-center justify-end gap-1.5 text-xs text-ink-muted"
        aria-hidden
      >
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className="size-[11px] rounded-[2px]"
            style={{ background: `var(--heat-${level})` }}
          />
        ))}
        <span>More</span>
      </div>

      <ChartTable
        caption="Contributions per month"
        headers={["Month", "Contributions"]}
        rows={monthlyRows}
      />
    </div>
  );
}
