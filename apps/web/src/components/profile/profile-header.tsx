import type { ProfileReport } from "@/lib/analytics/types";
import { formatCount, formatDate } from "@/lib/format";
import { Avatar } from "../avatar";
import { BuildingIcon, CalendarIcon, LinkIcon, PinIcon, UsersIcon } from "../icons";
import { Badge } from "../ui";

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function ProfileHeader({
  report,
  isOwnProfile,
}: {
  report: ProfileReport;
  isOwnProfile: boolean;
}) {
  const { profile, source } = report;
  const website = profile.websiteUrl
    ? profile.websiteUrl.startsWith("http")
      ? profile.websiteUrl
      : `https://${profile.websiteUrl}`
    : null;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <Avatar
        src={profile.avatarUrl}
        login={profile.login}
        name={profile.name}
        size={88}
        className="size-20 sm:size-22"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight break-words text-ink">
            {profile.name ?? profile.login}
          </h1>
          {source === "demo" && <Badge tone="accent">Demo account</Badge>}
          {source === "mock" && (
            <Badge
              tone="warning"
              title="No GitHub token configured; this data is generated from the username."
            >
              Sample data
            </Badge>
          )}
          {isOwnProfile && <Badge>You</Badge>}
        </div>
        <a
          href={profile.htmlUrl}
          className="text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          rel="noopener noreferrer"
        >
          @{profile.login}
        </a>
        {profile.bio && (
          <p className="mt-2 max-w-2xl text-sm text-pretty text-ink-secondary">{profile.bio}</p>
        )}

        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-secondary">
          <li className="flex items-center gap-1.5">
            <UsersIcon className="text-ink-muted" />
            <span>
              <strong className="font-semibold text-ink">{formatCount(profile.followers)}</strong>{" "}
              followers ·{" "}
              <strong className="font-semibold text-ink">{formatCount(profile.following)}</strong>{" "}
              following
            </span>
          </li>
          {profile.company && (
            <li className="flex items-center gap-1.5">
              <BuildingIcon className="text-ink-muted" />
              {profile.company}
            </li>
          )}
          {profile.location && (
            <li className="flex items-center gap-1.5">
              <PinIcon className="text-ink-muted" />
              {profile.location}
            </li>
          )}
          {website && (
            <li className="flex min-w-0 items-center gap-1.5">
              <LinkIcon className="shrink-0 text-ink-muted" />
              <a
                href={website}
                rel="noopener noreferrer nofollow"
                className="truncate text-accent-ink underline-offset-2 hover:underline"
              >
                {displayUrl(website)}
              </a>
            </li>
          )}
          <li className="flex items-center gap-1.5">
            <CalendarIcon className="text-ink-muted" />
            Joined {formatDate(profile.createdAt)}
          </li>
        </ul>
      </div>
    </div>
  );
}
