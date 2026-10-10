import { expect, type Page, test } from "@playwright/test";

async function expectDashboard(page: Page) {
  for (const heading of [
    "Contributions",
    "Activity over time",
    "Languages",
    "Pull request merge time",
    "Top repositories",
    "Recent activity",
  ]) {
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  // A year of heatmap cells and the Recharts bars rendered client-side.
  expect(await page.locator('svg[role="img"] rect[data-index]').count()).toBeGreaterThan(360);
  await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible();
}

test("search a username and see the full dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "See how any developer ships." })).toBeVisible();

  const input = page.getByLabel("GitHub username");
  await input.fill("not a valid name!");
  await page.getByRole("button", { name: "Analyze" }).click();
  await expect(page.getByText(/^Enter a GitHub username:/)).toBeVisible();
  await expect(page).toHaveURL("/");

  await input.fill("https://github.com/torvalds");
  await page.getByRole("button", { name: "Analyze" }).click();
  await expect(page).toHaveURL("/u/torvalds");
  await expect(page.getByRole("heading", { level: 1, name: "Torvalds" })).toBeVisible();
  await expect(page.getByText("Sample data", { exact: true })).toBeVisible();
  await expectDashboard(page);

  // The data table twin exposes chart values without hovering.
  await page.getByText("View as table").nth(1).click();
  await expect(page.getByRole("table", { name: "Contributions per month by type" })).toBeVisible();

  // The profile is remembered on the home page.
  await page.goto("/");
  await expect(page.getByRole("link", { name: "torvalds" }).last()).toBeVisible();
});

test("try the demo signs into the seeded account, then signs out", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();

  await expect(page).toHaveURL("/u/devdash_demo");
  await expect(page.getByRole("heading", { level: 1, name: "Demo Developer" })).toBeVisible();
  await expect(page.getByText("Demo account", { exact: true })).toBeVisible();
  await expect(page.getByText("You", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "tiny-queue" })).toBeVisible();
  await expectDashboard(page);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Try the demo" })).toBeVisible();
});

test("sign in with GitHub (mock OAuth) lands on your own dashboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in with GitHub" }).first().click();
  await expect(page).toHaveURL("/u/octocat");
  await expect(page.getByText("You", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "My dashboard" })).toBeVisible();
});

test("rejects an OAuth callback without a matching state", async ({ page }) => {
  await page.goto("/api/auth/github/callback?code=mock-oauth-code&state=forged");
  await expect(page).toHaveURL("/?auth=failed");
  await expect(page.getByRole("status")).toContainText("didn't complete");
});

test("shows friendly states for errors and empty profiles", async ({ page }) => {
  await page.goto("/u/mock-rate-limited");
  await expect(page.getByRole("heading", { name: "GitHub needs a breather" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Try again in/ })).toBeDisabled();

  await page.goto("/u/mock-not-found");
  await expect(
    page.getByRole("heading", { name: "We couldn't find that GitHub user" }),
  ).toBeVisible();

  await page.goto("/u/mock-org");
  await expect(page.getByRole("heading", { name: "mock-org is an organization" })).toBeVisible();

  await page.goto("/u/mock-empty");
  await expect(page.getByText("No public contributions in the last year.")).toBeVisible();
  await expect(page.getByText("No public repositories yet")).toBeVisible();
  await expect(page.getByText("No merged pull requests yet")).toBeVisible();
});

test("JSON API returns the report and cache status", async ({ request }) => {
  const first = await request.get("/api/profile/gaearon");
  expect(first.ok()).toBe(true);
  const body = await first.json();
  expect(body.report.profile.login).toBe("gaearon");
  expect(body.report.activity).toHaveLength(12);

  const second = await request.get("/api/profile/gaearon");
  expect(second.headers()["x-cache"]).toBe("HIT");

  const limited = await request.get("/api/profile/mock-rate-limited");
  expect(limited.status()).toBe(429);
  expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);

  expect((await request.get("/api/profile/bad_name!")).status()).toBe(400);
});

test("profile page fits a 375px viewport without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/u/devdash_demo");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
});
