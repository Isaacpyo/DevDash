import { describe, expect, it } from "vitest";
import { type Session, SESSION_MAX_AGE_SECONDS, sealSession, unsealSession } from "./session";

const SECRET = "a-test-secret-that-is-long-enough-123";
const session: Session = {
  kind: "github",
  login: "octocat",
  name: "The Octocat",
  avatarUrl: "https://avatars.githubusercontent.com/u/1",
  accessToken: "gho_secret_token",
};

describe("session sealing", () => {
  it("round-trips a session", async () => {
    const token = await sealSession(session, SECRET);
    expect(await unsealSession(token, SECRET)).toEqual(session);
  });

  it("encrypts the payload so the access token isn't readable", async () => {
    const token = await sealSession(session, SECRET);
    const decoded = token
      .split(".")
      .map((part) => Buffer.from(part, "base64url").toString("utf8"))
      .join("");
    expect(decoded).not.toContain("gho_secret_token");
    expect(decoded).not.toContain("octocat");
  });

  it("rejects tokens sealed with another secret", async () => {
    const token = await sealSession(session, SECRET);
    expect(await unsealSession(token, "another-secret-that-is-long-enough-456")).toBeNull();
  });

  it("rejects expired and tampered tokens", async () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const token = await sealSession(session, SECRET, now);
    expect(
      await unsealSession(token, SECRET, now + (SESSION_MAX_AGE_SECONDS + 60) * 1000),
    ).toBeNull();

    const parts = token.split(".");
    parts[3] = parts[3]!.slice(0, -2) + (parts[3]!.endsWith("A") ? "BB" : "AA");
    expect(await unsealSession(parts.join("."), SECRET)).toBeNull();
    expect(await unsealSession("garbage", SECRET)).toBeNull();
  });
});
