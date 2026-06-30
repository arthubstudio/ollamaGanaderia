import { test, expect } from "@playwright/test";

test("La IA responde correctamente", async ({ page }) => {

  // Esperar un poco más porque Ollama puede tardar
  test.setTimeout(120000);

  // Login
  await page.goto("http://localhost:3000/login");

  await page.getByPlaceholder("tu@email.com")
    .fill("coco@gmail.com");

  await page.getByPlaceholder("••••••••")
    .fill("123");

  await page.getByRole("button", {
    name: /login/i
  }).click();

  // Esperar a que aparezca el panel principal
  await expect(
    page.getByRole("heading", {
      name: /inicio/i
    })
  ).toBeVisible();

  // Ir al asistente IA
  await page.goto("http://localhost:3000/ia");

  await expect(page).toHaveURL(/.*\/ia/);

  // Esperar el textarea
  const textarea = page.locator("textarea");

  await expect(textarea).toBeVisible();

  // Preguntar
  await textarea.fill("¿Qué puedes hacer?");

  // Enviar
  await page.getByRole("button", {
    name: /preguntar|enviar/i
  }).click();

  // Esperar que aparezca alguna respuesta
  const respuesta = page.locator("text=IA").locator("..");

  await expect(respuesta)
    .toBeVisible({
      timeout: 60000
    });

  // Validar que exista texto suficiente
  await expect(
    page.locator("body")
  ).toContainText(
    /puedo|ayudar|bovino|vacuna|peso|ganadero/i,
    {
      timeout: 60000
    }
  );

});