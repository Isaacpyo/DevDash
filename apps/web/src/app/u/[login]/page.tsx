import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { OrganizationNotice } from "@/components/profile/notices";
import { ProfileDashboard } from "@/components/profile/profile-dashboard";
import { RateLimitNotice } from "@/components/profile/rate-limit-notice";
import { authAvailable, getSession } from "@/lib/auth/current-session";
import {
  LookupLimitError,
  NotAUserError,
  NotFoundError,
  RateLimitError,
} from "@/lib/github/errors";
import { loginSchema } from "@/lib/github/username";
import type { ReportEnvelope } from "@/lib/report-service";
import { requestSubject } from "@/lib/request-subject";
import { getServices } from "@/lib/services";

type Props = { params: Promise<{ login: string }> };

function parseLogin(raw: string): string | null {
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // Malformed escape sequence; validation below rejects it.
  }
  const parsed = loginSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const login = parseLogin((await params).login);
  if (!login) return { title: "Not found" };
  return {
    title: `${login} on GitHub`,
    description: `Contribution heatmap, languages, activity and pull request stats for ${login}.`,
    alternates: { canonical: `/u/${login}` },
  };
}

export default async function ProfilePage({ params }: Props) {
  const login = parseLogin((await params).login);
  if (!login) notFound();

  const session = await getSession();
  let envelope: ReportEnvelope;
  try {
    envelope = await getServices().reportService.getReport(login, {
      viewerToken: session?.accessToken,
      subject: requestSubject(await headers(), session),
    });
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    if (error instanceof NotAUserError) {
      return (
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <OrganizationNotice login={login} />
        </div>
      );
    }
    if (error instanceof RateLimitError || error instanceof LookupLimitError) {
      const auth = authAvailable();
      const visitor = error instanceof LookupLimitError;
      return (
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <RateLimitNotice
            login={login}
            reason={visitor ? "visitor" : "github"}
            resetAt={visitor ? error.retryAt : error.resetAt}
            // Signing in moves a visitor to their own per-account allowance.
            canSignIn={auth.github && session?.kind !== "github"}
            canUseDemo={auth.demo && !session}
          />
        </div>
      );
    }
    throw error;
  }

  // GitHub logins are case-insensitive; keep one canonical URL per profile.
  const canonical = envelope.report.profile.login;
  if (canonical !== login) redirect(`/u/${canonical}`);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <ProfileDashboard
        envelope={envelope}
        isOwnProfile={session?.login.toLowerCase() === canonical.toLowerCase()}
      />
    </div>
  );
}
