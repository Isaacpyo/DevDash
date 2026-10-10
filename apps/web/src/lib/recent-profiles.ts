const KEY = "devdash:recent-profiles";
const LIMIT = 6;

/** Browser-only convenience list; failures (private mode, blocked storage) are ignored. */
export function readRecentProfiles(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string").slice(0, LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function rememberProfile(login: string): void {
  try {
    const next = [
      login,
      ...readRecentProfiles().filter((l) => l.toLowerCase() !== login.toLowerCase()),
    ];
    window.localStorage.setItem(KEY, JSON.stringify(next.slice(0, LIMIT)));
  } catch {
    // Storage unavailable; nothing to do.
  }
}

export function clearRecentProfiles(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable; nothing to do.
  }
}
