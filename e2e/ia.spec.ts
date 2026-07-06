import { expect, test } from "@playwright/test";

test("La IA responde correctamente", async ({ page }) => {
  await page.goto("/login");

  await page
    .getByPlaceholder("tu@email.com")
    .fill("pedro@gmail.com");

  await page
    .locator('input[type="password"]')
    .fill("123456");

  await page
    .getByRole("button", { name: /login/i })
    .click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      name: /tu rancho en un vistazo/i
    })
  ).toBeVisible();

  await page.goto("/ia");

  await expect(page).toHaveURL(/.*\/ia/);

  const textarea = page.getByPlaceholder("Escribe tu pregunta...");
  await expect(textarea).toBeVisible();

  await textarea.fill("¿Qué puedes hacer?");
  await page.getByTitle("Enviar").click();

  await expect(page.locator("body")).toContainText(
    /Ganader|puedo ayudarte|bovinos|vacunas|pesos/i
  );
});
