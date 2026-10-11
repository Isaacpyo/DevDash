import { hashString } from "@/lib/random";

/** A self-contained SVG avatar so mock mode never depends on the network. */
export function initialsAvatar(login: string, name: string): string {
  const hue = hashString(login) % 360;
  const initials =
    name
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="hsl(${hue} 55% 42%)"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui,sans-serif" font-size="84" font-weight="600" fill="#fff">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
