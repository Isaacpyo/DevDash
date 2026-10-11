import type { RawEvent } from "@/lib/github/types";
import type { ActivityItem } from "./types";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function withTitle(base: string, title: string | undefined): string {
  return title ? `${base}: ${title}` : base;
}

/**
 * Turns a GitHub REST event into a one-line summary. Payload fields are read
 * defensively because GitHub has trimmed several event payloads over time
 * (e.g. PushEvent no longer always includes commit counts).
 * Returns null for event types that are noise on a profile (branch deletes etc.).
 */
export function summarizeEvent(event: RawEvent): ActivityItem | null {
  const repoUrl = `https://github.com/${event.repo.name}`;
  const { payload } = event;
  let summary: string;
  let url = repoUrl;

  switch (event.type) {
    case "PushEvent": {
      const branch = payload.ref?.replace(/^refs\/heads\//, "") ?? "a branch";
      const size = payload.size ?? payload.commits?.length;
      summary = size ? `Pushed ${plural(size, "commit")} to ${branch}` : `Pushed to ${branch}`;
      url = `${repoUrl}/commits/${encodeURIComponent(branch)}`;
      break;
    }
    case "PullRequestEvent": {
      const number = payload.pull_request?.number ?? payload.number;
      const label = number ? `pull request #${number}` : "a pull request";
      const verb =
        payload.action === "closed"
          ? payload.pull_request?.merged
            ? "Merged"
            : "Closed"
          : payload.action === "reopened"
            ? "Reopened"
            : "Opened";
      summary = withTitle(`${verb} ${label}`, payload.pull_request?.title);
      url = payload.pull_request?.html_url ?? (number ? `${repoUrl}/pull/${number}` : repoUrl);
      break;
    }
    case "PullRequestReviewEvent": {
      const number = payload.pull_request?.number;
      const verb = payload.review?.state === "approved" ? "Approved" : "Reviewed";
      summary = withTitle(
        `${verb} ${number ? `pull request #${number}` : "a pull request"}`,
        payload.pull_request?.title,
      );
      url = payload.review?.html_url ?? payload.pull_request?.html_url ?? repoUrl;
      break;
    }
    case "IssuesEvent": {
      const number = payload.issue?.number;
      const verb =
        payload.action === "closed"
          ? "Closed"
          : payload.action === "reopened"
            ? "Reopened"
            : "Opened";
      summary = withTitle(`${verb} issue${number ? ` #${number}` : ""}`, payload.issue?.title);
      url = payload.issue?.html_url ?? repoUrl;
      break;
    }
    case "IssueCommentEvent": {
      const number = payload.issue?.number;
      summary = withTitle(
        `Commented on${number ? ` #${number}` : " an issue"}`,
        payload.issue?.title,
      );
      url = payload.issue?.html_url ?? repoUrl;
      break;
    }
    case "CreateEvent": {
      if (payload.ref_type === "repository") summary = "Created repository";
      else if (payload.ref_type === "tag") summary = `Tagged ${payload.ref ?? "a release"}`;
      else summary = `Created branch ${payload.ref ?? ""}`.trim();
      break;
    }
    case "WatchEvent":
      summary = "Starred";
      break;
    case "ForkEvent":
      summary = payload.forkee?.full_name ? `Forked to ${payload.forkee.full_name}` : "Forked";
      url = payload.forkee?.html_url ?? repoUrl;
      break;
    case "ReleaseEvent":
      summary =
        `Published release ${payload.release?.name || payload.release?.tag_name || ""}`.trim();
      url = payload.release?.html_url ?? repoUrl;
      break;
    case "PublicEvent":
      summary = "Made repository public";
      break;
    default:
      return null;
  }

  return {
    id: event.id,
    type: event.type,
    summary,
    repo: event.repo.name,
    url,
    createdAt: event.created_at,
  };
}

export function summarizeEvents(events: RawEvent[], limit = 10): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const event of events) {
    const item = summarizeEvent(event);
    if (item) items.push(item);
    if (items.length === limit) break;
  }
  return items;
}
