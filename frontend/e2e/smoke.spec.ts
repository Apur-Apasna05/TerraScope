import { expect, test } from "@playwright/test";

test("TerraScope E2E smoke: Global -> India -> Telangana with live backend", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "TerraScope" })).toBeVisible();
  await expect(page.getByText("Global Place Inspector")).toBeVisible();
  await expect(page.getByTestId("cesium-globe-container")).toBeVisible();

  // Switch to India mode
  await page.getByTestId("mode-btn-india").click();
  await expect(page.getByText("India Geographic Inspector")).toBeVisible();
  await expect(page.getByText("India State Boundaries")).toBeVisible();

  // Switch to Telangana mode and verify live 33 districts + Risk/Flood tabs
  await page.getByTestId("mode-btn-telangana").click();
  await expect(page.getByText("Telangana District Intelligence")).toBeVisible();

  const districtSelect = page.getByLabel("Select Telangana district");
  await expect(districtSelect).toBeVisible();
  await expect(districtSelect.locator("option")).toHaveCount(34, { timeout: 20_000 }); // 1 placeholder + 33 districts

  await page.getByRole("tab", { name: "Risk" }).click();
  await expect(page.getByText(/Relative Risk Score/i)).toBeVisible({ timeout: 10_000 });

  await page.getByRole("tab", { name: "Flood" }).click();
  await expect(page.getByText(/Live Sentinel-1 SAR Inundation/i)).toBeVisible();
});
