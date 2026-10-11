import type { RawEvent, RawRepo } from "@/lib/github/types";

export function repo(overrides: Partial<RawRepo> = {}): RawRepo {
  const name = overrides.name ?? "repo";
  return {
    name,
    nameWithOwner: `octocat/${name}`,
    url: `https://github.com/octocat/${name}`,
    description: null,
    stars: 0,
    forks: 0,
    isArchived: false,
    pushedAt: "2026-01-01T00:00:00Z",
    primaryLanguage: null,
    languages: [],
    ...overrides,
  };
}

export function event(overrides: Partial<RawEvent> & Pick<RawEvent, "type">): RawEvent {
  return {
    id: "1",
    repo: { name: "octocat/hello" },
    created_at: "2026-10-01T12:00:00Z",
    payload: {},
    ...overrides,
  };
}
