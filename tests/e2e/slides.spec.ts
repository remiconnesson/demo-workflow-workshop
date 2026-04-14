import { expect, test } from "@playwright/test";
import { SLIDES } from "../../src/app/slides/config";

test("main demo renders the primary controls", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Triangle Donuts").first()).toBeVisible();
  await expect(page.getByText("Current run", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Place order/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Slides/i })).toBeVisible();
});

for (const slide of SLIDES) {
  test(`slide ${slide.number}: /slides/${slide.slug} renders`, async ({
    page,
  }) => {
    await page.goto(`/slides/${slide.slug}`);

    await expect(page).toHaveURL(new RegExp(`/slides/${slide.slug}$`));
    await expect(page.getByText(slide.title, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`${slide.number} / ${SLIDES.length}`, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Demo" })).toBeVisible();
  });
}
