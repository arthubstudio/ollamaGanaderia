import { expect, request as playwrightRequest, test } from "@playwright/test";

test.describe("plataforma ganadera entre cuentas", () => {
  test("conserva datos, aplica permisos y habilita comunidad", async ({ baseURL, page }) => {
    const stamp = Date.now();
    const emailA = `origen.${stamp}@ganaderia.test`;
    const emailB = `destino.${stamp}@ganaderia.test`;
    const password = "Prueba123456";
    const source = await playwrightRequest.newContext({ baseURL });
    const destination = await playwrightRequest.newContext({ baseURL });

    const registerA = await source.post("/api/auth/register", { data: { nombre: `Origen ${stamp}`, email: emailA, password } });
    const registerB = await destination.post("/api/auth/register", { data: { nombre: `Destino ${stamp}`, email: emailB, password } });
    expect(registerA.ok()).toBeTruthy();
    expect(registerB.ok()).toBeTruthy();
    const userA = await registerA.json();
    const userB = await registerB.json();
    expect((await source.post("/api/auth/login", { data: { email: emailA, password } })).ok()).toBeTruthy();
    expect((await destination.post("/api/auth/login", { data: { email: emailB, password } })).ok()).toBeTruthy();

    const breedResponse = await source.post("/api/breeds", {
      data: { nombre: `Raza Prueba ${stamp}`, tipo: "carne", pais_origen: "Mexico" }
    });
    expect(breedResponse.ok()).toBeTruthy();
    const breed = (await breedResponse.json()).breed;

    const bovinoResponse = await source.post("/api/bovinos", {
      data: { nombre: `Luna${stamp}`, raza: breed.nombre, breed_id: breed.id, sexo: "Hembra" }
    });
    expect(bovinoResponse.ok()).toBeTruthy();
    const bovino = await bovinoResponse.json();

    const pesoResponse = await source.post("/api/pesos", {
      data: { bovino_id: bovino.id, peso: 375, fecha: "2026-07-19" }
    });
    expect(pesoResponse.ok()).toBeTruthy();

    const transferResponse = await source.post("/api/transfers", {
      data: { bovino_id: bovino.id, usuario_destino: emailB, message: "Transferencia E2E" }
    });
    expect(transferResponse.ok()).toBeTruthy();
    const transferResult = await transferResponse.json();
    expect(transferResult.ok).toBe(true);

    const unauthorizedAccept = await source.post(`/api/transfers/${transferResult.transfer.id}/accept`, { data: {} });
    expect(unauthorizedAccept.status()).toBe(404);

    const accepted = await destination.post(`/api/transfers/${transferResult.transfer.id}/accept`, { data: {} });
    expect(accepted.ok()).toBeTruthy();
    const sourceBovinos = await (await source.get("/api/bovinos")).json();
    const destinationBovinos = await (await destination.get("/api/bovinos")).json();
    expect(sourceBovinos.some((item: any) => Number(item.id) === Number(bovino.id))).toBe(false);
    expect(destinationBovinos.some((item: any) => Number(item.id) === Number(bovino.id))).toBe(true);
    const transferredWeights = await (await destination.get(`/api/pesos?bovino_id=${bovino.id}`)).json();
    expect(transferredWeights.some((item: any) => Number(item.peso) === 375)).toBe(true);

    const deniedConversation = await source.post("/api/community/conversations", { data: { contact_user_id: userB.id } });
    expect(deniedConversation.status()).toBe(403);
    const friendRequest = await source.post("/api/community/friends/requests", { data: { usuario_destino: emailB } });
    expect(friendRequest.ok()).toBeTruthy();
    const friendResult = await friendRequest.json();
    const deniedFriendAccept = await source.post(`/api/community/friends/requests/${friendResult.request.id}/accept`);
    expect(deniedFriendAccept.status()).toBe(404);
    expect((await destination.post(`/api/community/friends/requests/${friendResult.request.id}/accept`)).ok()).toBeTruthy();

    const conversationResponse = await source.post("/api/community/conversations", { data: { contact_user_id: userB.id } });
    expect(conversationResponse.ok()).toBeTruthy();
    const conversation = await conversationResponse.json();
    expect((await source.post(`/api/community/conversations/${conversation.id}/messages`, { data: { content: "Recibiste el bovino?" } })).ok()).toBeTruthy();
    const messages = await (await destination.get(`/api/community/conversations/${conversation.id}/messages`)).json();
    expect(messages.some((item: any) => item.content === "Recibiste el bovino?")).toBe(true);

    const notifications = await (await destination.get("/api/notifications")).json();
    expect(notifications.items.some((item: any) => item.type === "BOVINO_TRANSFER_REQUEST")).toBe(true);

    const iaResponse = await destination.post("/api/ia/router", { data: { pregunta: "Que razas tienes?", stream: false } });
    expect(iaResponse.ok()).toBeTruthy();
    expect((await iaResponse.json()).respuesta).toContain("Catalogo de Razas");

    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    const emailInput = page.getByPlaceholder("tu@email.com");
    const passwordInput = page.locator('input[type="password"]');
    await emailInput.fill(emailA);
    await passwordInput.fill(password);
    await expect(emailInput).toHaveValue(emailA);
    await expect(passwordInput).toHaveValue(password);
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL(/\/$/);
    for (const [path, heading] of [
      ["/razas", "Catalogo de Razas"],
      ["/transferencias", "Transferencias"],
      ["/amigos", "Contactos"],
      ["/mensajes", "Mensajes"],
      ["/notificaciones", "Notificaciones"]
    ]) {
      await page.goto(path);
      await expect(page.getByRole("main").getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }

    await source.dispose();
    await destination.dispose();
  });
});
