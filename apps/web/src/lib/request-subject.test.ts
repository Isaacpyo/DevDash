import { describe, expect, it } from "vitest";
import type { Session } from "@/lib/auth/session";
import { clientIp, requestSubject } from "./request-subject";

const h = (values: Record<string, string>) => new Headers(values);

describe("clientIp", () => {
  it("prefers Netlify's client IP header over forwarded headers", () => {
    expect(
      clientIp(
        h({
          "x-nf-client-connection-ip": "203.0.113.7",
          "x-real-ip": "10.0.0.1",
          "x-forwarded-for": "198.51.100.1",
        }),
      ),
    ).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then the first x-forwarded-for entry", () => {
    expect(clientIp(h({ "x-real-ip": "10.0.0.1", "x-forwarded-for": "198.51.100.1" }))).toBe(
      "10.0.0.1",
    );
    expect(clientIp(h({ "x-forwarded-for": " 198.51.100.1 , 10.0.0.2" }))).toBe("198.51.100.1");
  });

  it("returns null without any usable header", () => {
    expect(clientIp(h({}))).toBeNull();
    expect(clientIp(h({ "x-forwarded-for": " " }))).toBeNull();
  });
});

describe("requestSubject", () => {
  const github: Session = {
    kind: "github",
    login: "OctoCat",
    name: null,
    avatarUrl: null,
    accessToken: "t",
  };
  const demo: Session = { kind: "demo", login: "devdash_demo", name: null, avatarUrl: null };

  it("uses the GitHub account for OAuth sessions so shared IPs aren't penalised", () => {
    expect(requestSubject(h({ "x-real-ip": "10.0.0.1" }), github)).toBe("user:octocat");
  });

  it("uses the IP otherwise, including for the demo account", () => {
    expect(requestSubject(h({ "x-real-ip": "10.0.0.1" }), demo)).toBe("ip:10.0.0.1");
    expect(requestSubject(h({}), null)).toBe("ip:unknown");
  });
});
