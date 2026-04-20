import { expect, test } from "@playwright/test";
import { SLIDES } from "../../src/app/slides/config";

test("root redirects to title slide", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/slides\/title$/);
});

for (const slide of SLIDES) {
  test(`slide ${slide.number}: /slides/${slide.slug} renders`, async ({
    page,
  }) => {
    await page.goto(`/slides/${slide.slug}`);

    await expect(page).toHaveURL(new RegExp(`/slides/${slide.slug}$`));
    await expect(
      page.getByText(`${slide.number} / ${SLIDES.length}`, { exact: true }),
    ).toBeVisible();
  });
}
