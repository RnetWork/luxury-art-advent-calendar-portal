import { expect, test, type Page } from "@playwright/test";

// Runs against the demo seed (pnpm run setup) in DEMO_MODE.

async function signIn(page: Page, name: string) {
  await page.goto("/login/dev");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function travelTo(page: Page, label: string) {
  await page.getByRole("button", { name: /Demo clock|Dec \d+, 12:00 AM|Nov 30/ }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
}

test("collector opens the calendar, reveals today's work, and cannot see tomorrow's", async ({ page, request }) => {
  await signIn(page, "Eleanor Whitfield");
  await expect(page).toHaveURL(/\/calendar/);
  await travelTo(page, "Dec 12");
  await expect(page.getByText("12 of 24 works revealed")).toBeVisible();

  await page.goto("/reveal/12?instant=1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gilded Tide");
  const src = await page.getByRole("img", { name: /Gilded Tide/ }).first().getAttribute("src");
  expect(src).toMatch(/^\/api\/artworks\/[0-9a-f-]{36}\/image/);
  const ok = await page.request.get(src!);
  expect(ok.status()).toBe(200);
  expect(ok.headers()["cache-control"]).toContain("private");

  // Without a session the same file is refused.
  expect((await request.get(src!)).status()).toBe(401);

  await page.goto("/reveal/13");
  await expect(page.getByRole("heading", { name: "This door is still closed" })).toBeVisible();
  await expect(page.locator("img[src^='/api/artworks']")).toHaveCount(0);

  await page.goto("/certificate");
  await expect(page.getByRole("article", { name: "Certificate" }).getByText("No. 001")).toBeVisible();
  await page.goto("/shipping");
  await expect(page.getByText("Your 24 prints")).toBeVisible();
});

test("refunded buyer has no access", async ({ page }) => {
  await signIn(page, "Margaret Chen");
  await expect(page).toHaveURL(/\/no-access/);
  await expect(page.getByRole("heading", { name: "This collection is no longer active" })).toBeVisible();
  await page.goto("/calendar");
  await expect(page).toHaveURL(/\/no-access/);
});

test("collectors cannot open the admin", async ({ page }) => {
  await signIn(page, "James Okafor");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/calendar/);
});

test("admin sees the release overview", async ({ page }) => {
  await signIn(page, "The Curator");
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByText("Editions sold")).toBeVisible();
  await page.goto("/admin/fulfillment");
  await expect(page.getByRole("heading", { name: "Print orders" })).toBeVisible();
});
