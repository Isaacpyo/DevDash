"use client";

/** Shared Recharts tooltip: the value leads, the label follows (secondary ink). */
export function ChartTooltip({
  active,
  payload,
  label,
  formatLabel,
  formatValue,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown }>;
  label?: string | number;
  formatLabel: (label: string) => string;
  formatValue: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-ink">{formatValue(value)}</div>
      <div className="text-ink-muted">{formatLabel(String(label ?? ""))}</div>
    </div>
  );
}

export const axisTick = { fill: "var(--ink-muted)", fontSize: 11 };
