import { describe, expect, it } from "vitest";
import { repo } from "@/test/factories";
import { topRepositories, totalStars } from "./repos";

describe("topRepositories", () => {
  it("sorts by stars, then forks, then most recently pushed", () => {
    const result = topRepositories([
      repo({ name: "few-stars", stars: 1 }),
      repo({ name: "popular", stars: 50 }),
      repo({ name: "tie-more-forks", stars: 10, forks: 5 }),
      repo({ name: "tie-older", stars: 10, forks: 1, pushedAt: "2025-01-01T00:00:00Z" }),
      repo({ name: "tie-newer", stars: 10, forks: 1, pushedAt: "2026-05-01T00:00:00Z" }),
    ]);
    expect(result.map((r) => r.name)).toEqual([
      "popular",
      "tie-more-forks",
      "tie-newer",
      "tie-older",
      "few-stars",
    ]);
  });

  it("limits the result and maps the primary language", () => {
    const repos = Array.from({ length: 10 }, (_, i) =>
      repo({ name: `r${i}`, stars: i, primaryLanguage: { name: "Go", color: "#00ADD8" } }),
    );
    const result = topRepositories(repos, 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ name: "r9", language: { name: "Go", color: "#00ADD8" } });
  });
});

describe("totalStars", () => {
  it("sums stars", () => {
    expect(totalStars([repo({ stars: 3 }), repo({ stars: 4 })])).toBe(7);
    expect(totalStars([])).toBe(0);
  });
});
