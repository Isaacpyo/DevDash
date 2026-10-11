// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { generateMockData } from "@/lib/github/mock-provider";
import { ContributionHeatmap } from "./contribution-heatmap";

const { calendar } = generateMockData("octocat", new Date("2026-10-10T12:00:00Z"));

describe("ContributionHeatmap", () => {
  it("draws one cell per day with a sequential level colour", () => {
    const { container } = render(
      <ContributionHeatmap weeks={calendar.weeks} total={calendar.total} />,
    );
    const cells = container.querySelectorAll("rect[data-index]");
    expect(cells).toHaveLength(calendar.weeks.flat().length);
    const levels = new Set([...cells].map((cell) => cell.getAttribute("fill")));
    expect([...levels].every((fill) => /^var\(--heat-[0-4]\)$/.test(fill ?? ""))).toBe(true);
  });

  it("describes itself for screen readers", () => {
    render(<ContributionHeatmap weeks={calendar.weeks} total={calendar.total} />);
    expect(
      screen.getByRole("img", { name: /Contribution heatmap: .* contributions from/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /scrollable/ })).toHaveAttribute("tabindex", "0");
  });

  it("shows a tooltip for the hovered day", () => {
    const { container } = render(
      <ContributionHeatmap weeks={calendar.weeks} total={calendar.total} />,
    );
    const last = [...container.querySelectorAll("rect[data-index]")].at(-1)!;
    fireEvent.pointerOver(last);
    expect(screen.getByText(/on Oct 10/)).toBeInTheDocument();
  });
});
