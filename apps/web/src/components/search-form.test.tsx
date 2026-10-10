// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchForm } from "./search-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("SearchForm", () => {
  beforeEach(() => {
    push.mockReset();
    window.localStorage.clear();
  });

  it("shows an accessible error for invalid usernames and doesn't navigate", async () => {
    render(<SearchForm />);
    const input = screen.getByLabelText("GitHub username");
    await userEvent.type(input, "bad name!");
    await userEvent.click(screen.getByRole("button", { name: "Analyze" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a GitHub username");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveFocus();
    expect(push).not.toHaveBeenCalled();
  });

  it("asks for a username when submitted empty", async () => {
    render(<SearchForm />);
    await userEvent.click(screen.getByRole("button", { name: "Analyze" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a GitHub username to analyze.");
  });

  it("normalizes URLs, navigates and remembers the profile", async () => {
    render(<SearchForm />);
    await userEvent.type(screen.getByLabelText("GitHub username"), "https://github.com/gaearon");
    await userEvent.click(screen.getByRole("button", { name: "Analyze" }));

    expect(push).toHaveBeenCalledWith("/u/gaearon");
    expect(JSON.parse(window.localStorage.getItem("devdash:recent-profiles")!)).toEqual([
      "gaearon",
    ]);
  });

  it("can start with a server-side validation error", () => {
    render(<SearchForm initialError />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
