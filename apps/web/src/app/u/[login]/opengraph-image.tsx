import { headers } from "next/headers";
import { ImageResponse } from "next/og";
import type { ProfileReport } from "@/lib/analytics/types";
import { formatCount, formatHours } from "@/lib/format";
import { loginSchema } from "@/lib/github/username";
import { requestSubject } from "@/lib/request-subject";
import { getServices } from "@/lib/services";

export const alt = "DevDash GitHub analytics summary";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HEAT = ["#ebeae4", "#b7d3f6", "#6da7ec", "#2a78d6", "#184f95"];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 26, color: "#6b6a65" }}>{label}</div>
      <div style={{ fontSize: 52, fontWeight: 700, color: "#0b0b0b" }}>{value}</div>
    </div>
  );
}

/** Social card for shared profile links: name, headline stats and the last 26 weeks of activity. */
export default async function OpenGraphImage({ params }: { params: Promise<{ login: string }> }) {
  const parsed = loginSchema.safeParse((await params).login);
  let report: ProfileReport | null = null;
  if (parsed.success) {
    try {
      // Crawlers fetch these too, so they count against the requesting IP like any lookup.
      const subject = requestSubject(await headers(), null);
      report = (await getServices().reportService.getReport(parsed.data, { subject })).report;
    } catch {
      report = null;
    }
  }

  const weeks = report?.calendar.weeks.slice(-26) ?? [];
  const title = report ? (report.profile.name ?? report.profile.login) : "DevDash";
  const subtitle = report
    ? `@${report.profile.login} · GitHub analytics`
    : "GitHub developer analytics";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background: "#f9f9f7",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          color: "#2a78d6",
          fontSize: 30,
          fontWeight: 700,
        }}
      >
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#2a78d6" }} />
        DevDash
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 72, fontWeight: 700, color: "#0b0b0b", lineHeight: 1.1 }}>
          {title}
        </div>
        <div style={{ fontSize: 32, color: "#52514e", marginTop: 8 }}>{subtitle}</div>
      </div>
      {report ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 56 }}>
            <Stat label="Contributions" value={formatCount(report.calendar.total)} />
            <Stat label="Stars" value={formatCount(report.totalStars)} />
            <Stat
              label="Median merge"
              value={
                report.pullRequests.medianHours === null
                  ? "—"
                  : formatHours(report.pullRequests.medianHours)
              }
            />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {weeks.map((week, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {week.map((day) => (
                  <div
                    key={day.date}
                    style={{ width: 14, height: 14, borderRadius: 3, background: HEAT[day.level] }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 32, color: "#52514e" }}>
          Contribution heatmaps, languages and PR merge times.
        </div>
      )}
    </div>,
    size,
  );
}
