import { describe, expect, it, vi } from "vitest";
import type * as errors from "./errors";
import { GitHubError, NotFoundError, RateLimitError, UpstreamError } from "./errors";

describe("GitHub errors", () => {
  it("supports instanceof for the class and the base class", () => {
    const error = new RateLimitError(1_000, "secondary");
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error).toBeInstanceOf(GitHubError);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(NotFoundError);
    expect(error.resetAt).toBe(1_000);
  });

  it("recognises errors created by a duplicated copy of the module", async () => {
    // Simulates Next loading errors.ts once per bundle: a query suffix gives a fresh module instance.
    vi.resetModules();
    const specifier = "./errors?duplicate";
    const duplicate = (await import(/* @vite-ignore */ specifier)) as typeof errors;
    const foreign = new duplicate.RateLimitError(5_000);

    expect(duplicate.RateLimitError).not.toBe(RateLimitError);
    expect(foreign).toBeInstanceOf(RateLimitError);
    expect(foreign).toBeInstanceOf(GitHubError);
    expect(foreign).not.toBeInstanceOf(UpstreamError);
  });

  it("doesn't match plain errors that happen to share a name", () => {
    const impostor = Object.assign(new Error("x"), { name: "RateLimitError" });
    expect(impostor).not.toBeInstanceOf(RateLimitError);
    expect({}).not.toBeInstanceOf(GitHubError);
    expect(null).not.toBeInstanceOf(GitHubError);
  });
});
