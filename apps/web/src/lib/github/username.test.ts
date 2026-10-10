import { describe, expect, it } from "vitest";
import { DEMO_LOGIN, isValidLogin, loginSchema, normalizeLoginInput } from "./username";

describe("isValidLogin", () => {
  it.each(["octocat", "a", "torvalds", "user-name", "A1-b2-C3", "x".repeat(39)])(
    "accepts %s",
    (login) => expect(isValidLogin(login)).toBe(true),
  );

  it.each([
    "",
    "-leading",
    "trailing-",
    "double--hyphen",
    "has space",
    "x".repeat(40),
    "a/b",
    "o'neil",
  ])("rejects %j", (login) => expect(isValidLogin(login)).toBe(false));

  it("accepts the demo login even though it has an underscore", () => {
    expect(isValidLogin(DEMO_LOGIN)).toBe(true);
    expect(isValidLogin("some_user")).toBe(false);
  });
});

describe("normalizeLoginInput", () => {
  it.each([
    ["  octocat  ", "octocat"],
    ["@octocat", "octocat"],
    ["https://github.com/octocat", "octocat"],
    ["github.com/octocat?tab=repositories", "octocat"],
    ["https://www.github.com/octocat/hello-world", "octocat"],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeLoginInput(input)).toBe(expected);
  });
});

describe("loginSchema", () => {
  it("returns the normalized login on success", () => {
    expect(loginSchema.parse("@gaearon")).toBe("gaearon");
  });

  it("fails with a readable message", () => {
    const result = loginSchema.safeParse("not valid!");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/1–39/);
  });
});
