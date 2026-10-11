import Link from "next/link";
import { signInAsDemo } from "@/app/actions";
import { GitHubMark } from "@/components/icons";
import { RecentProfiles } from "@/components/recent-profiles";
import { SearchForm } from "@/components/search-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonStyles, cx } from "@/components/ui";
import { authAvailable, getSession } from "@/lib/auth/current-session";
import { MOCK_LOGINS } from "@/lib/github/mock-provider";
import { getServices } from "@/lib/services";

const EXAMPLES = ["torvalds", "gaearon", "sindresorhus", "yyx990803", "tj"];

const AUTH_MESSAGES: Record<string, string> = {
  failed: "GitHub sign-in didn't complete. Please try again.",
  denied: "Sign-in was cancelled on GitHub.",
  unavailable: "Sign-in isn't configured on this deployment. The demo still works.",
};

const FEATURES = [
  ["Contribution heatmap", "A year of activity with streaks, best day and busiest weekday."],
  ["Language mix", "Bytes of code per language across a user's own public repos."],
  ["Activity over time", "Monthly commits, pull requests, reviews and issues."],
  ["PR merge times", "Median and p90 time-to-merge, distribution and merge rate."],
  ["Top repositories", "Most-starred work with language, forks and last push."],
  [
    "Shareable and cached",
    "Every profile has its own URL. Data is cached and survives rate limits.",
  ],
] as const;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const auth = authAvailable();
  const mockMode = getServices().reportService.providerKind === "mock";
  const authMessage = params.auth ? AUTH_MESSAGES[params.auth] : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="mx-auto max-w-2xl pt-14 pb-10 text-center sm:pt-20">
        <h1 className="text-4xl font-semibold tracking-tight text-balance text-ink sm:text-5xl">
          See how any developer ships.
        </h1>
        <p className="mt-4 text-lg text-pretty text-ink-secondary">
          Contribution heatmaps, language mix, activity trends and pull request merge times for any
          GitHub user.
        </p>

        {authMessage && (
          <p
            role="status"
            className="mt-6 rounded-lg bg-warning-wash px-4 py-3 text-sm text-warning-ink"
          >
            {authMessage}
          </p>
        )}

        <div className="mt-8 text-left">
          <SearchForm initialError={params.error === "invalid-username"} />
        </div>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {session ? (
            <Link href={`/u/${session.login}`} className={buttonStyles.secondary}>
              Go to my dashboard
            </Link>
          ) : (
            <>
              {auth.demo && (
                <form action={signInAsDemo}>
                  <SubmitButton
                    pendingLabel="Signing in…"
                    className={cx(buttonStyles.secondary, "w-full sm:w-auto")}
                  >
                    Try the demo
                  </SubmitButton>
                </form>
              )}
              {auth.github && (
                <a href="/api/auth/github" className={buttonStyles.secondary}>
                  <GitHubMark />
                  Sign in with GitHub
                </a>
              )}
            </>
          )}
        </div>
        {!session && auth.demo && (
          <p className="mt-2 text-xs text-ink-muted">
            The demo signs you into a seeded sample account. No sign-up.
          </p>
        )}
      </section>

      <section aria-labelledby="examples" className="mx-auto flex max-w-2xl flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <h2 id="examples" className="text-ink-muted">
            Try:
          </h2>
          {EXAMPLES.map((login) => (
            <Link
              key={login}
              href={`/u/${login}`}
              className="rounded-full border border-line bg-surface px-3 py-1 text-ink-secondary hover:border-accent hover:text-ink"
            >
              {login}
            </Link>
          ))}
        </div>
        <RecentProfiles />
        {mockMode && (
          <div className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-secondary">
            <p>
              <strong className="font-semibold text-ink">Sample data mode.</strong> No GitHub token
              is configured, so profiles are generated deterministically from the username. Set{" "}
              <code>GITHUB_TOKEN</code> for live data.
            </p>
            <p className="mt-2">
              Preview the edge states:{" "}
              {Object.values(MOCK_LOGINS).map((login, i) => (
                <span key={login}>
                  {i > 0 && ", "}
                  <Link
                    href={`/u/${login}`}
                    className="text-accent-ink underline underline-offset-2"
                  >
                    {login}
                  </Link>
                </span>
              ))}
              .
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="features" className="mt-16">
        <h2 id="features" className="sr-only">
          Features
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([title, text]) => (
            <li key={title} className="rounded-2xl border border-line bg-surface p-5">
              <h3 className="font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-sm text-ink-secondary">{text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
