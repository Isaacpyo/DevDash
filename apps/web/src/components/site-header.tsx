import Link from "next/link";
import { signOut } from "@/app/actions";
import { authAvailable, getSession } from "@/lib/auth/current-session";
import { Avatar } from "./avatar";
import { GitHubMark, Logo } from "./icons";
import { SubmitButton } from "./submit-button";
import { buttonStyles, cx } from "./ui";

export async function SiteHeader() {
  const session = await getSession();
  const auth = authAvailable();

  return (
    <header className="border-b border-line bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded font-semibold text-ink">
          <Logo />
          <span>DevDash</span>
        </Link>

        <nav aria-label="Account" className="flex items-center gap-2">
          {session ? (
            <>
              <Link
                href={`/u/${session.login}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-ink hover:bg-sunken"
              >
                <Avatar
                  src={session.avatarUrl}
                  login={session.login}
                  name={session.name}
                  size={24}
                />
                <span className="hidden sm:inline">My dashboard</span>
                <span className="sr-only sm:hidden">My dashboard</span>
              </Link>
              <form action={signOut}>
                <SubmitButton
                  pendingLabel="Signing out…"
                  className={cx(buttonStyles.ghost, "px-3 py-1.5")}
                >
                  Sign out
                </SubmitButton>
              </form>
            </>
          ) : (
            auth.github && (
              // A plain anchor: this route redirects to GitHub and must not be prefetched.
              <a href="/api/auth/github" className={cx(buttonStyles.secondary, "px-3 py-1.5")}>
                <GitHubMark />
                Sign in<span className="hidden sm:inline"> with GitHub</span>
              </a>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
