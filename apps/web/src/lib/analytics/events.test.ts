import { describe, expect, it } from "vitest";
import { event } from "@/test/factories";
import { summarizeEvent, summarizeEvents } from "./events";

describe("summarizeEvent", () => {
  it("summarizes pushes with and without commit counts", () => {
    expect(
      summarizeEvent(event({ type: "PushEvent", payload: { ref: "refs/heads/main", size: 3 } }))?.summary,
    ).toBe("Pushed 3 commits to main");
    expect(
      summarizeEvent(event({ type: "PushEvent", payload: { ref: "refs/heads/feat/x" } })),
    ).toMatchObject({
      summary: "Pushed to feat/x",
      url: "https://github.com/octocat/hello/commits/feat%2Fx",
    });
  });

  it("distinguishes merged from closed pull requests", () => {
    const merged = summarizeEvent(
      event({
        type: "PullRequestEvent",
        payload: { action: "closed", pull_request: { number: 7, title: "Add cache", merged: true } },
      }),
    );
    expect(merged).toMatchObject({
      summary: "Merged pull request #7: Add cache",
      url: "https://github.com/octocat/hello/pull/7",
    });

    const closed = summarizeEvent(
      event({ type: "PullRequestEvent", payload: { action: "closed", number: 8, pull_request: {} } }),
    );
    expect(closed?.summary).toBe("Closed pull request #8");
  });

  it("summarizes reviews, issues, comments, releases and forks", () => {
    expect(
      summarizeEvent(
        event({
          type: "PullRequestReviewEvent",
          payload: { review: { state: "approved" }, pull_request: { number: 2 } },
        }),
      )?.summary,
    ).toBe("Approved pull request #2");
    expect(
      summarizeEvent(event({ type: "IssuesEvent", payload: { action: "opened", issue: { number: 4, title: "Bug" } } }))
        ?.summary,
    ).toBe("Opened issue #4: Bug");
    expect(
      summarizeEvent(event({ type: "IssueCommentEvent", payload: { issue: { number: 4 } } }))?.summary,
    ).toBe("Commented on #4");
    expect(
      summarizeEvent(event({ type: "ReleaseEvent", payload: { release: { name: null, tag_name: "v1.2.0" } } }))
        ?.summary,
    ).toBe("Published release v1.2.0");
    expect(
      summarizeEvent(event({ type: "ForkEvent", payload: { forkee: { full_name: "me/hello" } } }))?.summary,
    ).toBe("Forked to me/hello");
    expect(summarizeEvent(event({ type: "CreateEvent", payload: { ref_type: "repository" } }))?.summary).toBe(
      "Created repository",
    );
  });

  it("drops noisy or unknown events", () => {
    expect(summarizeEvent(event({ type: "DeleteEvent" }))).toBeNull();
    expect(summarizeEvent(event({ type: "SomethingNew" }))).toBeNull();
  });
});

describe("summarizeEvents", () => {
  it("skips unknown events and respects the limit", () => {
    const events = [
      event({ id: "a", type: "DeleteEvent" }),
      event({ id: "b", type: "WatchEvent" }),
      event({ id: "c", type: "WatchEvent" }),
      event({ id: "d", type: "WatchEvent" }),
    ];
    expect(summarizeEvents(events, 2).map((e) => e.id)).toEqual(["b", "c"]);
  });
});
