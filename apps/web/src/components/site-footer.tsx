import { getServices } from "@/lib/services";

export function SiteFooter() {
  const { reportService } = getServices();
  const live = reportService.providerKind === "github";

  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          DevDash · Built with Next.js, the GitHub GraphQL &amp; REST APIs, Tailwind and Recharts.
        </p>
        <p className="flex items-center gap-2">
          <span
            aria-hidden
            className={live ? "size-2 rounded-full bg-good" : "size-2 rounded-full bg-warning-ink"}
          />
          {live ? "Live GitHub data" : "Sample data mode (no GitHub token configured)"}
          <span aria-hidden>·</span>
          <a
            href="https://github.com/temitopeagbola/DevDash"
            className="underline-offset-2 hover:text-ink hover:underline"
          >
            Source
          </a>
        </p>
      </div>
    </footer>
  );
}
