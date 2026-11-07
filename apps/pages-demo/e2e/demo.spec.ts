import { expect, test } from "@playwright/test";

test("static sample supports preview, filters, scenarios, and analytics", async ({ page }) => {
  const apiCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) apiCalls.push(request.url());
  });
  await page.goto("/Watchdog-/#/");
  await expect(page.getByTestId("demo-badge")).toHaveText("DEMO • SIMULATED DATA");
  await expect(page.getByText("Role preview only")).toBeVisible();
  await expect(page.getByTestId("mosaic")).toHaveAttribute("data-host-count", "500");
  await expect(page.getByTestId("sim-live")).toHaveText("Simulated live");
  await page.screenshot({ path: "/opt/cursor/artifacts/pages-demo-user.png" });

  await page.getByTestId("filter-hostname").fill("api-017");
  await expect(page.getByTestId("visible-count")).toHaveText("Showing 1 of 500");
  await page.getByTestId("view-list").click();
  await expect(page.getByTestId("list")).toContainText("api-017");
  await page.getByTestId("view-cards").click();
  await expect(page.getByTestId("cards")).toContainText("api-017");
  await page.getByTestId("view-mosaic").click();
  for (const density of [10, 20, 100, 500]) await page.getByTestId(`density-${density}`).click();

  await page.getByTestId("mosaic").getByRole("link", { name: "api-017" }).click();
  await expect(page.getByRole("heading", { name: "api-017" })).toBeVisible();
  await expect(page.getByText("app-api.service")).toBeVisible();
  await page.goto("/Watchdog-/#/incident/api-017");
  await expect(page.getByRole("heading", { name: "Incident workspace" })).toBeVisible();
  await expect(page.getByText("Not a Tailscale session")).toBeVisible();

  await page.goto("/Watchdog-/#/");
  await page.getByTestId("scenario-host").selectOption("api-002");
  await page.getByTestId("scenario-app").click();
  await expect(page.getByTestId("scenario-log")).toContainText("Simulated app_failure on api-002");
  await page.getByTestId("filter-hostname").fill("api-002");
  await expect(page.getByTestId("list").or(page.getByTestId("mosaic"))).toBeVisible();
  await page.getByTestId("scenario-reset").click();
  await expect(page.getByTestId("scenario-log")).toContainText("Public sample reset");
  await page.getByTestId("filter-hostname").fill("");
  await expect(page.getByTestId("mosaic")).toHaveAttribute("data-host-count", "500");

  await page.evaluate(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error("fullscreen blocked in this check"));
  });
  await page.getByTestId("fullscreen").click();
  await expect(page.locator(".wall")).toBeVisible();
  await page.screenshot({ path: "/opt/cursor/artifacts/pages-demo-wallboard.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator(".wall")).toHaveCount(0);

  await page.goto("/Watchdog-/#/");
  await page.getByRole("button", { name: "Preview as admin" }).click();
  await page.goto("/Watchdog-/#/admin");
  await expect(page.getByRole("heading", { name: "Admin preview" })).toBeVisible();
  await expect(page.getByText("Automatic recovery OFF")).toBeVisible();
  await page.screenshot({ path: "/opt/cursor/artifacts/pages-demo-admin.png" });
  await page.getByRole("button", { name: "Preview as user" }).click();
  await expect(page.getByText("does not create a session").or(page.getByText("User preview"))).toBeVisible();

  await page.goto("/Watchdog-/#/intelligence");
  await page.getByRole("button", { name: "Service restarts this month" }).click();
  await expect(page.getByTestId("analytics")).toContainText("api-017");
  await expect(page.getByTestId("analytics")).toContainText("not measurements");
  expect(apiCalls).toEqual([]);
});

test("command center is a scripted fullscreen sample", async ({ page }) => {
  const apiCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) apiCalls.push(request.url());
  });
  await page.goto("/Watchdog-/#/command");
  await expect(page.getByTestId("command-center")).toBeVisible();
  await expect(page.getByTestId("demo-badge")).toHaveText("DEMO • SIMULATED DATA");
  await expect(page.getByTestId("rack").locator(".tile")).toHaveCount(40);
  await expect(page.getByTestId("network")).toContainText("simulated");
  await expect(page.getByTestId("wall-view")).toHaveText(/Infra health|Application outage|Network loss|Disk risk|Recovery/);
  await expect(page.getByTestId("wall-pause")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("wall-pause")).toBeVisible();
  expect(apiCalls).toEqual([]);
});
