import type { RawRepo } from "@/lib/github/types";
import type { TopRepo } from "./types";

export function topRepositories(repos: RawRepo[], limit = 6): TopRepo[] {
  return [...repos]
    .sort(
      (a, b) =>
        b.stars - a.stars ||
        b.forks - a.forks ||
        (b.pushedAt ?? "").localeCompare(a.pushedAt ?? "") ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit)
    .map((repo) => ({
      name: repo.name,
      nameWithOwner: repo.nameWithOwner,
      url: repo.url,
      description: repo.description,
      stars: repo.stars,
      forks: repo.forks,
      isArchived: repo.isArchived,
      pushedAt: repo.pushedAt,
      language: repo.primaryLanguage,
    }));
}

export function totalStars(repos: RawRepo[]): number {
  return repos.reduce((sum, repo) => sum + repo.stars, 0);
}
