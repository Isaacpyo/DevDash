"use client";

import { useState } from "react";
import { ShareIcon } from "../icons";
import { buttonStyles, cx } from "../ui";

export function ShareButton({ path }: { path: string }) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied("copied");
    } catch {
      // Clipboard can be blocked (permissions, insecure context); fall back to a prompt.
      window.prompt("Copy this link:", url);
      setCopied("failed");
    }
    window.setTimeout(() => setCopied("idle"), 2_000);
  }

  return (
    <button type="button" onClick={copy} className={cx(buttonStyles.secondary, "px-3 py-1.5")}>
      <ShareIcon />
      <span aria-live="polite">{copied === "copied" ? "Link copied" : "Copy link"}</span>
    </button>
  );
}
