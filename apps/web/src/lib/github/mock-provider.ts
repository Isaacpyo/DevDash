import { lastMonths } from "@/lib/analytics/activity";
import { assignLevels } from "@/lib/analytics/calendar";
import { hashString, Rng } from "@/lib/random";
import { initialsAvatar } from "@/lib/avatar";
import { NotAUserError, NotFoundError, RateLimitError } from "./errors";
import { LANGUAGE_COLORS } from "./language-colors";
import type {
  CalendarDay,
  DataProvider,
  GitHubRawData,
  RawEvent,
  RawMergedPullRequest,
  RawProfile,
  RawRepo,
} from "./types";

/**
 * Logins with special behaviour in mock mode, so every UI state can be seen
 * (and tested) without a GitHub token.
 */
export const MOCK_LOGINS = {
  rateLimited: "mock-rate-limited",
  notFound: "mock-not-found",
  organization: "mock-org",
  empty: "mock-empty",
} as const;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

interface Persona {
  dailyRate: number;
  weekdayActive: number;
  weekendActive: number;
  vacationChance: number;
  stack: keyof typeof STACKS;
  repoCount: [number, number];
  starScale: number;
  prMedianHours: number;
  followers: [number, number];
}

const STACKS = {
  web: {
    primary: ["TypeScript", "JavaScript"],
    secondary: ["CSS", "HTML", "SCSS", "MDX", "Shell", "Vue", "Svelte"],
  },
  systems: {
    primary: ["Rust", "Go", "C", "C++", "Zig"],
    secondary: ["Shell", "Dockerfile", "Python", "HCL"],
  },
  data: {
    primary: ["Python", "Jupyter Notebook"],
    secondary: ["Shell", "Dockerfile", "HTML", "TypeScript"],
  },
  mobile: {
    primary: ["Swift", "Kotlin", "Dart"],
    secondary: ["Ruby", "Shell", "Java", "TypeScript"],
  },
  backend: {
    primary: ["Go", "Java", "C#", "Ruby", "PHP", "Elixir"],
    secondary: ["Shell", "Dockerfile", "HCL", "TypeScript", "Python"],
  },
} as const;

const PERSONAS: Persona[] = [
  {
    dailyRate: 2,
    weekdayActive: 0.35,
    weekendActive: 0.15,
    vacationChance: 0.12,
    stack: "data",
    repoCount: [3, 10],
    starScale: 3,
    prMedianHours: 30,
    followers: [2, 60],
  },
  {
    dailyRate: 3,
    weekdayActive: 0.3,
    weekendActive: 0.75,
    vacationChance: 0.08,
    stack: "web",
    repoCount: [8, 24],
    starScale: 5,
    prMedianHours: 6,
    followers: [20, 400],
  },
  {
    dailyRate: 4,
    weekdayActive: 0.82,
    weekendActive: 0.2,
    vacationChance: 0.06,
    stack: "backend",
    repoCount: [6, 20],
    starScale: 5,
    prMedianHours: 14,
    followers: [30, 700],
  },
  {
    dailyRate: 7,
    weekdayActive: 0.92,
    weekendActive: 0.6,
    vacationChance: 0.04,
    stack: "systems",
    repoCount: [15, 40],
    starScale: 8.5,
    prMedianHours: 4,
    followers: [500, 25_000],
  },
  {
    dailyRate: 3,
    weekdayActive: 0.7,
    weekendActive: 0.25,
    vacationChance: 0.07,
    stack: "mobile",
    repoCount: [5, 16],
    starScale: 4.5,
    prMedianHours: 20,
    followers: [10, 300],
  },
];

const ADJECTIVES = [
  "tiny",
  "rusty",
  "swift",
  "quiet",
  "lazy",
  "bright",
  "atomic",
  "fuzzy",
  "lucid",
  "nimble",
  "brisk",
  "plain",
];
const NOUNS = [
  "queue",
  "cache",
  "router",
  "parser",
  "notes",
  "cli",
  "kit",
  "graph",
  "lint",
  "sync",
  "store",
  "proxy",
  "scheduler",
  "forms",
];
const BIOS = [
  "Building developer tools and the occasional side project.",
  "Open source contributor. Coffee-driven development.",
  "Software engineer. I like small libraries and fast tests.",
  "Making the web a little faster, one PR at a time.",
  "Backend engineer. Distributed systems, databases and good docs.",
  null,
];
const COMPANIES = ["@acme", "Initech", "@open-source", "Globex", null, null];
const LOCATIONS = [
  "Berlin, Germany",
  "Lagos, Nigeria",
  "Toronto, Canada",
  "Bengaluru, India",
  "London, UK",
  "Remote",
  null,
];
const EXTERNAL_REPOS = [
  "vercel/next.js",
  "facebook/react",
  "nodejs/node",
  "rust-lang/rust",
  "golang/go",
  "tailwindlabs/tailwindcss",
];

export interface MockOverrides {
  profile?: Partial<RawProfile>;
  repos?: Array<
    Pick<RawRepo, "name" | "description" | "stars" | "forks"> & {
      languages: Array<[string, number]>;
    }
  >;
  persona?: number;
}

function titleCase(login: string): string {
  return login
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * GitHub's calendar: ~53 weeks ending today, each week starting on Sunday.
 * Each day's count depends only on (login, date), so the graph stays stable
 * as days pass instead of reshuffling every day.
 */
function generateCalendar(seed: string, persona: Persona, now: Date, empty: boolean) {
  const end = startOfUtcDay(now);
  let start = end - 364 * DAY_MS;
  start -= new Date(start).getUTCDay() * DAY_MS;
  const phase = (hashString(seed) % 628) / 100;

  const dates: string[] = [];
  const counts: number[] = [];
  for (let t = start; t <= end; t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    const weekday = new Date(t).getUTCDay();
    const onVacation = new Rng(`${seed}:week:${Math.floor(t / DAY_MS / 7)}`).chance(
      persona.vacationChance,
    );
    const day = new Rng(`${seed}:${date}`);
    const activeChance =
      weekday === 0 || weekday === 6 ? persona.weekendActive : persona.weekdayActive;
    const seasonal = 1 + 0.35 * Math.sin((2 * Math.PI * t) / (365 * DAY_MS) + phase);
    const active = !empty && !onVacation && day.chance(activeChance);
    dates.push(date);
    counts.push(
      active ? Math.max(1, Math.round(day.logNormal(persona.dailyRate * seasonal, 0.6))) : 0,
    );
  }

  const levels = assignLevels(counts);
  const days: CalendarDay[] = dates.map((date, i) => ({
    date,
    count: counts[i]!,
    level: levels[i]!,
  }));
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return { total: counts.reduce((sum, c) => sum + c, 0), weeks, days };
}

function splitContributions(total: number, rng: Rng) {
  const commits = Math.round(total * (0.6 + rng.next() * 0.2));
  const pullRequests = Math.round(total * (0.07 + rng.next() * 0.08));
  const reviews = Math.round(total * (0.04 + rng.next() * 0.1));
  const issues = Math.max(0, total - commits - pullRequests - reviews);
  return { commits, pullRequests, reviews, issues };
}

function generateRepos(
  login: string,
  persona: Persona,
  rng: Rng,
  now: Date,
  overrides?: MockOverrides["repos"],
): RawRepo[] {
  const stack = STACKS[persona.stack];
  const toRepo = (
    name: string,
    description: string | null,
    stars: number,
    forks: number,
    languages: Array<[string, number]>,
    isArchived = rng.chance(0.05),
  ): RawRepo => ({
    name,
    nameWithOwner: `${login}/${name}`,
    url: `https://github.com/${login}/${name}`,
    description,
    stars,
    forks,
    isArchived,
    pushedAt: new Date(now.getTime() - rng.int(0, 600) * DAY_MS).toISOString(),
    primaryLanguage: languages[0]
      ? { name: languages[0][0], color: LANGUAGE_COLORS[languages[0][0]] ?? null }
      : null,
    languages: languages.map(([language, bytes]) => ({
      name: language,
      color: LANGUAGE_COLORS[language] ?? null,
      bytes,
    })),
  });

  if (overrides) {
    return overrides.map((repo) =>
      toRepo(repo.name, repo.description, repo.stars, repo.forks, repo.languages),
    );
  }

  const names = new Set<string>();
  const count = rng.int(...persona.repoCount);
  while (names.size < count) names.add(`${rng.pick(ADJECTIVES)}-${rng.pick(NOUNS)}`);

  return [...names].map((name) => {
    const primary = rng.chance(0.75) ? rng.pick(stack.primary) : rng.pick(stack.secondary);
    const primaryBytes = Math.round(rng.logNormal(60_000, 1.1));
    const languages: Array<[string, number]> = [[primary, primaryBytes]];
    for (const secondary of rng.shuffle(stack.secondary).slice(0, rng.int(0, 3))) {
      if (secondary !== primary) {
        languages.push([secondary, Math.round(primaryBytes * (0.02 + rng.next() * 0.3))]);
      }
    }
    languages.sort((a, b) => b[1] - a[1]);
    const stars = Math.max(0, Math.floor(Math.exp(rng.next() ** 3 * persona.starScale)) - 1);
    const noun = name.split("-")[1] ?? "tool";
    return toRepo(
      name,
      rng.chance(0.85) ? `A ${name.split("-")[0]} ${noun} for everyday projects` : null,
      stars,
      Math.floor(stars * (0.05 + rng.next() * 0.25)),
      languages,
    );
  });
}

function generateMergedPullRequests(
  count: number,
  persona: Persona,
  rng: Rng,
  now: Date,
): RawMergedPullRequest[] {
  const prs: RawMergedPullRequest[] = [];
  let created = now.getTime() - rng.int(2, 48) * HOUR_MS;
  for (let i = 0; i < count; i++) {
    const hours = rng.logNormal(persona.prMedianHours, 1.3);
    const mergedAt = Math.min(now.getTime(), created + hours * HOUR_MS);
    prs.push({
      createdAt: new Date(created).toISOString(),
      mergedAt: new Date(mergedAt).toISOString(),
      additions: Math.round(rng.logNormal(80, 1.2)),
      deletions: Math.round(rng.logNormal(25, 1.2)),
    });
    created -= rng.logNormal(60, 0.8) * HOUR_MS;
  }
  return prs;
}

function generateEvents(
  login: string,
  repos: RawRepo[],
  rng: Rng,
  now: Date,
  count: number,
): RawEvent[] {
  if (count === 0) return [];
  const own = repos.length ? repos.map((r) => r.nameWithOwner) : [`${login}/${login}`];
  const events: RawEvent[] = [];
  let time = now.getTime() - rng.int(1, 6) * HOUR_MS;
  let prNumber = rng.int(20, 200);

  for (let i = 0; i < count; i++) {
    const roll = rng.next();
    const repo = { name: rng.pick(own) };
    const base = {
      id: String(hashString(`${login}:${i}`)),
      repo,
      created_at: new Date(time).toISOString(),
    };

    if (roll < 0.45) {
      events.push({
        ...base,
        type: "PushEvent",
        payload: { ref: "refs/heads/main", size: rng.int(1, 6) },
      });
    } else if (roll < 0.6) {
      const merged = rng.chance(0.6);
      events.push({
        ...base,
        type: "PullRequestEvent",
        payload: {
          action: merged ? "closed" : "opened",
          number: ++prNumber,
          pull_request: {
            number: prNumber,
            title: rng.pick([
              "Fix flaky test",
              "Add caching layer",
              "Refactor config loading",
              "Improve error messages",
              "Bump dependencies",
            ]),
            merged,
          },
        },
      });
    } else if (roll < 0.7) {
      events.push({
        ...base,
        repo: { name: rng.pick(EXTERNAL_REPOS) },
        type: "PullRequestReviewEvent",
        payload: {
          review: { state: rng.chance(0.5) ? "approved" : "commented" },
          pull_request: { number: rng.int(1000, 9000) },
        },
      });
    } else if (roll < 0.8) {
      events.push({
        ...base,
        type: "IssuesEvent",
        payload: {
          action: rng.chance(0.5) ? "opened" : "closed",
          issue: {
            number: rng.int(1, 300),
            title: rng.pick([
              "Docs are out of date",
              "Crash on empty input",
              "Support Node 22",
              "Feature request: dark mode",
            ]),
          },
        },
      });
    } else if (roll < 0.88) {
      events.push({
        ...base,
        type: "IssueCommentEvent",
        payload: { action: "created", issue: { number: rng.int(1, 300) } },
      });
    } else if (roll < 0.94) {
      events.push({
        ...base,
        repo: { name: rng.pick(EXTERNAL_REPOS) },
        type: "WatchEvent",
        payload: { action: "started" },
      });
    } else {
      events.push({
        ...base,
        type: "ReleaseEvent",
        payload: {
          action: "published",
          release: { tag_name: `v${rng.int(0, 3)}.${rng.int(0, 12)}.${rng.int(0, 9)}` },
        },
      });
    }
    time -= rng.logNormal(20, 0.9) * HOUR_MS;
  }
  return events;
}

/** Deterministic, realistic-looking data for any login. */
export function generateMockData(
  login: string,
  now: Date,
  overrides: MockOverrides = {},
): GitHubRawData {
  const seed = login.toLowerCase();
  const rng = new Rng(seed);
  const empty = seed === MOCK_LOGINS.empty;
  const persona = PERSONAS[overrides.persona ?? hashString(seed) % PERSONAS.length]!;

  const calendar = generateCalendar(seed, persona, now, empty);
  const totals = splitContributions(calendar.total, new Rng(`${seed}:totals`));

  const monthTotals = new Map<string, number>();
  for (const day of calendar.days) {
    const month = day.date.slice(0, 7);
    monthTotals.set(month, (monthTotals.get(month) ?? 0) + day.count);
  }
  const monthly = lastMonths(now).map((month) => ({
    month,
    ...splitContributions(monthTotals.get(month) ?? 0, new Rng(`${seed}:${month}`)),
  }));

  const name = overrides.profile?.name ?? titleCase(login);
  const repos = empty ? [] : generateRepos(login, persona, rng, now, overrides.repos);
  const merged = empty ? 0 : Math.round(totals.pullRequests * (1.5 + rng.next() * 3));
  const createdYear = empty ? now.getUTCFullYear() : rng.int(2010, 2022);

  const profile: RawProfile = {
    login,
    name,
    avatarUrl: initialsAvatar(login, name),
    bio: empty ? null : rng.pick(BIOS),
    company: empty ? null : rng.pick(COMPANIES),
    location: empty ? null : rng.pick(LOCATIONS),
    websiteUrl: null,
    twitterUsername: null,
    htmlUrl: `https://github.com/${login}`,
    createdAt: new Date(Date.UTC(createdYear, rng.int(0, 11), rng.int(1, 28))).toISOString(),
    followers: empty ? 0 : rng.int(...persona.followers),
    following: empty ? 0 : rng.int(0, 120),
    publicRepos: repos.length,
    ...overrides.profile,
  };

  return {
    profile,
    calendar: { total: calendar.total, weeks: calendar.weeks },
    totals: { ...totals, restricted: 0 },
    monthly,
    repos,
    pullRequests: {
      merged,
      open: empty ? 0 : rng.int(0, 6),
      closed: Math.round(merged * (0.1 + rng.next() * 0.25)),
      recentMerged: generateMergedPullRequests(Math.min(100, merged), persona, rng, now),
    },
    events: generateEvents(login, repos, rng, now, empty ? 0 : 18),
  };
}

export interface MockProviderOptions {
  now?: () => Date;
  /** Artificial delay so loading states can be seen locally. */
  latencyMs?: number;
}

export function createMockProvider({
  now = () => new Date(),
  latencyMs = 0,
}: MockProviderOptions = {}): DataProvider {
  return {
    kind: "mock",
    async fetchProfile(login: string): Promise<GitHubRawData> {
      if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
      const key = login.toLowerCase();
      const current = now();
      if (key === MOCK_LOGINS.rateLimited) {
        throw new RateLimitError(Math.ceil((current.getTime() + 15 * 60_000) / 60_000) * 60_000);
      }
      if (key === MOCK_LOGINS.notFound) throw new NotFoundError(login);
      if (key === MOCK_LOGINS.organization) throw new NotAUserError(login);
      return generateMockData(login, current);
    },
  };
}
