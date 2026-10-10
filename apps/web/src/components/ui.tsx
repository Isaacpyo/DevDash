import type { ComponentProps, ReactNode } from "react";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export const buttonStyles = {
  primary: cx(buttonBase, "bg-accent text-on-accent hover:bg-accent-strong"),
  secondary: cx(buttonBase, "border border-line bg-surface text-ink hover:bg-sunken"),
  ghost: cx(buttonBase, "text-ink-secondary hover:bg-sunken hover:text-ink"),
};

export function Card({
  title,
  description,
  action,
  children,
  className,
  headingId,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headingId?: string;
}) {
  const id = headingId ?? `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className={cx("rounded-2xl border border-line bg-surface p-4 sm:p-6", className)}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={id} className="text-base font-semibold text-ink">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
  ...props
}: ComponentProps<"span"> & { tone?: "neutral" | "accent" | "warning" }) {
  const tones = {
    neutral: "bg-sunken text-ink-secondary",
    accent: "bg-accent-wash text-accent-ink",
    warning: "bg-warning-wash text-warning-ink",
  };
  return (
    <span
      {...props}
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        props.className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <p className="mt-1 text-sm text-ink-muted">{children}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-lg bg-sunken", className)} />;
}

/** "View as table" twin for a chart, so no value is only reachable by hovering. */
export function ChartTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <details className="group mt-3 text-sm">
      <summary className="cursor-pointer rounded text-ink-muted select-none hover:text-ink">
        View as table
      </summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-line">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-sunken text-ink-secondary">
            <tr>
              {headers.map((header, i) => (
                <th
                  key={header}
                  scope="col"
                  className={cx("px-3 py-2 font-medium", i > 0 && "text-right")}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map((row) => (
              <tr key={String(row[0])} className="border-t border-line">
                {row.map((cell, i) =>
                  i === 0 ? (
                    <th key={i} scope="row" className="px-3 py-1.5 font-normal text-ink">
                      {cell}
                    </th>
                  ) : (
                    <td key={i} className="px-3 py-1.5 text-right text-ink-secondary">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
