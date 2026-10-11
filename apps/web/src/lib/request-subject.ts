import type { Session } from "@/lib/auth/session";

/**
 * Best-effort client IP. Netlify's own header comes first because Netlify sets
 * it and clients can't spoof it there; the others are for Docker or other proxies.
 */
export function clientIp(headers: Pick<Headers, "get">): string | null {
  const candidates = [
    headers.get("x-nf-client-connection-ip"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }
  return null;
}

/** Who a lookup is counted against: the GitHub account when signed in with OAuth, otherwise the IP. */
export function requestSubject(headers: Pick<Headers, "get">, session: Session | null): string {
  if (session?.kind === "github") return `user:${session.login.toLowerCase()}`;
  return `ip:${clientIp(headers) ?? "unknown"}`;
}
