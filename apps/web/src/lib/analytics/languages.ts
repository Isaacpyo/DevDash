import type { RawRepo } from "@/lib/github/types";
import type { LanguageShare } from "./types";

export const OTHER_LANGUAGE = "Other";

/**
 * Sums language bytes across repos. Anything past `maxEntries - 1` languages is
 * folded into a single "Other" row so the chart never needs more than
 * `maxEntries` rows.
 */
export function aggregateLanguages(repos: RawRepo[], maxEntries = 8): LanguageShare[] {
  const byName = new Map<string, { color: string | null; bytes: number; repos: Set<string> }>();

  for (const repo of repos) {
    for (const language of repo.languages) {
      if (language.bytes <= 0) continue;
      const entry = byName.get(language.name) ?? {
        color: language.color,
        bytes: 0,
        repos: new Set<string>(),
      };
      entry.bytes += language.bytes;
      entry.repos.add(repo.nameWithOwner);
      byName.set(language.name, entry);
    }
  }

  const total = [...byName.values()].reduce((sum, entry) => sum + entry.bytes, 0);
  if (total === 0) return [];

  const sorted = [...byName.entries()].sort(
    ([nameA, a], [nameB, b]) => b.bytes - a.bytes || nameA.localeCompare(nameB),
  );

  const toShare = (name: string, color: string | null, bytes: number, repoCount: number) => ({
    name,
    color,
    bytes,
    share: bytes / total,
    repoCount,
  });

  if (sorted.length <= maxEntries) {
    return sorted.map(([name, e]) => toShare(name, e.color, e.bytes, e.repos.size));
  }

  const head = sorted.slice(0, maxEntries - 1);
  const tail = sorted.slice(maxEntries - 1);
  const tailRepos = new Set(tail.flatMap(([, e]) => [...e.repos]));
  const tailBytes = tail.reduce((sum, [, e]) => sum + e.bytes, 0);

  return [
    ...head.map(([name, e]) => toShare(name, e.color, e.bytes, e.repos.size)),
    toShare(OTHER_LANGUAGE, null, tailBytes, tailRepos.size),
  ];
}
