import { generateMockData } from "./mock-provider";
import type { GitHubRawData } from "./types";
import { DEMO_LOGIN } from "./username";

/**
 * Seeded data for the "Try the demo" account. The profile and repos are
 * hand-written; the contribution history comes from the deterministic mock
 * generator so it always ends today.
 */
export function generateDemoData(now: Date): GitHubRawData {
  return generateMockData(DEMO_LOGIN, now, {
    persona: 3,
    profile: {
      name: "Demo Developer",
      bio: "Full-stack engineer who likes fast feedback loops. This is DevDash's seeded demo account.",
      company: "DevDash",
      location: "London, UK",
      websiteUrl: "https://devdash.temitopeagbola.com",
      createdAt: "2016-03-14T09:00:00Z",
      followers: 1284,
      following: 75,
    },
    repos: [
      {
        name: "tiny-queue",
        description: "A 1 kB promise queue with concurrency limits and retries.",
        stars: 1180,
        forks: 96,
        languages: [
          ["TypeScript", 48_200],
          ["JavaScript", 3_100],
        ],
      },
      {
        name: "rusty-cache",
        description: "Sharded LRU cache with TTLs and zero unsafe code.",
        stars: 517,
        forks: 41,
        languages: [
          ["Rust", 91_400],
          ["Shell", 1_200],
        ],
      },
      {
        name: "devdash",
        description: "GitHub developer analytics: heatmaps, languages, PR merge times.",
        stars: 342,
        forks: 28,
        languages: [
          ["TypeScript", 120_500],
          ["CSS", 6_400],
          ["Dockerfile", 900],
        ],
      },
      {
        name: "pg-migrate-lite",
        description: "Zero-dependency Postgres migrations for Go services.",
        stars: 208,
        forks: 19,
        languages: [
          ["Go", 38_700],
          ["Shell", 2_400],
        ],
      },
      {
        name: "design-tokens",
        description: "Shared colour and spacing tokens for web and iOS.",
        stars: 88,
        forks: 7,
        languages: [
          ["TypeScript", 14_300],
          ["CSS", 9_800],
          ["Swift", 6_200],
        ],
      },
      {
        name: "dotfiles",
        description: "zsh, neovim and tmux config.",
        stars: 41,
        forks: 5,
        languages: [
          ["Shell", 12_000],
          ["Lua", 8_600],
        ],
      },
      {
        name: "notebook-lab",
        description: "Data experiments and write-ups.",
        stars: 23,
        forks: 2,
        languages: [
          ["Jupyter Notebook", 52_000],
          ["Python", 18_000],
        ],
      },
      {
        name: "k8s-playground",
        description: "Terraform + Helm for a hobby cluster.",
        stars: 12,
        forks: 1,
        languages: [
          ["HCL", 22_000],
          ["Shell", 3_000],
        ],
      },
    ],
  });
}
