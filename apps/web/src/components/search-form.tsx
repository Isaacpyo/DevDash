"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { isValidLogin, normalizeLoginInput } from "@/lib/github/username";
import { rememberProfile } from "@/lib/recent-profiles";
import { SearchIcon } from "./icons";
import { buttonStyles, cx } from "./ui";

const INVALID_MESSAGE =
  "Enter a GitHub username: letters, numbers or single hyphens, up to 39 characters.";

/**
 * Validates on the client for instant feedback; without JavaScript the form
 * submits to /search, which validates again on the server.
 */
export function SearchForm({
  initialError = false,
  size = "lg",
}: {
  initialError?: boolean;
  size?: "lg" | "sm";
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(initialError ? INVALID_MESSAGE : null);
  const [pending, startTransition] = useTransition();
  const id = useId();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const login = normalizeLoginInput(inputRef.current?.value ?? "");
    if (!isValidLogin(login)) {
      setError(login ? INVALID_MESSAGE : "Enter a GitHub username to analyze.");
      inputRef.current?.focus();
      return;
    }
    setError(null);
    rememberProfile(login);
    startTransition(() => router.push(`/u/${encodeURIComponent(login)}`));
  }

  const describedBy = error ? `${id}-error` : `${id}-hint`;

  return (
    <form
      action="/search"
      method="get"
      role="search"
      onSubmit={onSubmit}
      noValidate
      className="w-full"
    >
      <label
        htmlFor={`${id}-input`}
        className={cx("mb-2 block text-sm font-medium text-ink", size === "sm" && "sr-only")}
      >
        GitHub username
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" />
          <input
            ref={inputRef}
            id={`${id}-input`}
            name="q"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={100}
            placeholder="e.g. torvalds"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onChange={() => error && setError(null)}
            className={cx(
              "w-full rounded-lg border bg-surface py-2.5 pr-3 pl-9 text-base text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-offset-0 focus:outline-accent sm:text-sm",
              error ? "border-critical" : "border-line",
            )}
          />
        </div>
        <button type="submit" className={buttonStyles.primary} disabled={pending}>
          {pending ? "Loading…" : "Analyze"}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-critical">
          {error}
        </p>
      ) : (
        <p
          id={`${id}-hint`}
          className={cx("mt-2 text-sm text-ink-muted", size === "sm" && "sr-only")}
        >
          Pasting a github.com profile URL works too.
        </p>
      )}
    </form>
  );
}
