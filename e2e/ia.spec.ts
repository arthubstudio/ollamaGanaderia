import { expect, test } from "@playwright/test";

test("La IA responde correctamente", async ({ page, request }) => {
  const stamp = Date.now();
  const email = `ia.e2e.${stamp}@ganaderia.test`;
  const password = "PruebaIA123456";

  const registration = await request.post("/api/auth/register", {
    data: { nombre: `IA E2E ${stamp}`, email, password }
  });
  expect(registration.ok()).toBeTruthy();

  await page.goto("/login");

  await page
    .getByPlaceholder("tu@email.com")
    .fill(email);

  await page
    .locator('input[type="password"]')
    .fill(password);

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

  await textarea.fill("Que puedes hacer?");
  await page.getByTitle("Enviar").click();

  await expect(page.locator("body")).toContainText(
    /Ganader|puedo ayudarte|bovinos|vacunas|pesos/i
  );
});
