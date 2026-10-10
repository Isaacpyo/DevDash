import { describe, expect, it } from "vitest";
import { repo } from "@/test/factories";
import { aggregateLanguages, OTHER_LANGUAGE } from "./languages";

describe("aggregateLanguages", () => {
  it("returns an empty list when there is no code", () => {
    expect(aggregateLanguages([])).toEqual([]);
    expect(aggregateLanguages([repo({ languages: [{ name: "Go", color: null, bytes: 0 }] })])).toEqual([]);
  });

  it("sums bytes across repos, computes shares and repo counts", () => {
    const result = aggregateLanguages([
      repo({
        name: "a",
        languages: [
          { name: "TypeScript", color: "#3178c6", bytes: 600 },
          { name: "CSS", color: "#663399", bytes: 100 },
        ],
      }),
      repo({ name: "b", languages: [{ name: "TypeScript", color: "#3178c6", bytes: 300 }] }),
    ]);

    expect(result).toEqual([
      { name: "TypeScript", color: "#3178c6", bytes: 900, share: 0.9, repoCount: 2 },
      { name: "CSS", color: "#663399", bytes: 100, share: 0.1, repoCount: 1 },
    ]);
  });

  it("folds the tail into Other so there are at most maxEntries rows", () => {
    const languages = ["A", "B", "C", "D", "E"].map((name, i) => ({
      name,
      color: null,
      bytes: 100 - i * 10,
    }));
    const result = aggregateLanguages(
      [repo({ name: "x", languages: languages.slice(0, 3) }), repo({ name: "y", languages: languages.slice(3) })],
      3,
    );

    expect(result.map((l) => l.name)).toEqual(["A", "B", OTHER_LANGUAGE]);
    expect(result[2]).toMatchObject({ bytes: 80 + 70 + 60, repoCount: 2 });
    expect(result.reduce((sum, l) => sum + l.share, 0)).toBeCloseTo(1);
  });

  it("breaks byte ties alphabetically for stable output", () => {
    const result = aggregateLanguages([
      repo({
        languages: [
          { name: "Rust", color: null, bytes: 10 },
          { name: "Go", color: null, bytes: 10 },
        ],
      }),
    ]);
    expect(result.map((l) => l.name)).toEqual(["Go", "Rust"]);
  });
});
