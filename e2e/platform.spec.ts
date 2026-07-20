import { expect, request as playwrightRequest, test } from "@playwright/test";

test.describe("plataforma ganadera entre cuentas", () => {
  test("conserva datos, aplica permisos y habilita comunidad", async ({ baseURL, browser, page }) => {
    const stamp = Date.now();
    const emailA = `origen.${stamp}@ganaderia.test`;
    const emailB = `destino.${stamp}@ganaderia.test`;
    const emailC = `destino.duplicado.${stamp}@ganaderia.test`;
    const emailD = `user2.${stamp}@ganaderia.test`;
    const uniqueUsername = `user2${stamp}`;
    const password = "Prueba123456";
    const source = await playwrightRequest.newContext({ baseURL });
    const destination = await playwrightRequest.newContext({ baseURL });
    const duplicateDestination = await playwrightRequest.newContext({ baseURL });
    const uniqueDestination = await playwrightRequest.newContext({ baseURL });

    const registerA = await source.post("/api/auth/register", { data: { nombre: `Origen ${stamp}`, email: emailA, password } });
    const registerB = await destination.post("/api/auth/register", { data: { nombre: `Destino ${stamp}`, email: emailB, password } });
    const registerC = await duplicateDestination.post("/api/auth/register", { data: { nombre: `Destino ${stamp}`, email: emailC, password } });
    const registerD = await uniqueDestination.post("/api/auth/register", { data: { nombre: uniqueUsername, email: emailD, password } });
    expect(registerA.ok()).toBeTruthy();
    expect(registerB.ok()).toBeTruthy();
    expect(registerC.ok()).toBeTruthy();
    expect(registerD.ok()).toBeTruthy();
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
    const initialHistory = await (await source.get(`/api/historial-propiedad?bovino_id=${bovino.id}`)).json();
    expect(initialHistory).toHaveLength(1);
    expect(Number(initialHistory[0].propietario_usuario_id)).toBe(Number(userA.id));
    expect(initialHistory[0].fecha_fin).toBeNull();

    const pesoResponse = await source.post("/api/pesos", {
      data: { bovino_id: bovino.id, peso: 375, fecha: "2026-07-19" }
    });
    expect(pesoResponse.ok()).toBeTruthy();

    const vacunaResponse = await source.post("/api/vacunas", {
      data: { nombre: `Vacuna E2E ${stamp}` }
    });
    expect(vacunaResponse.ok()).toBeTruthy();
    const vacuna = await vacunaResponse.json();
    expect((await source.post("/api/vacunas-aplicadas", {
      data: { bovino_id: bovino.id, vacuna_id: vacuna.id, fecha_aplicacion: "2026-07-19" }
    })).ok()).toBeTruthy();
    expect((await source.post("/api/enfermedades", {
      data: { bovino_id: bovino.id, nombre: `Revision E2E ${stamp}`, fecha: "2026-07-19" }
    })).ok()).toBeTruthy();

    const iaMissingRecipientResponse = await source.post("/api/ia/function-calling", {
      data: { pregunta: `Transfiere la vaca ${bovino.nombre} a zzqvusuarioimposible` }
    });
    expect(iaMissingRecipientResponse.ok()).toBeTruthy();
    const iaMissingRecipient = await iaMissingRecipientResponse.json();
    expect(iaMissingRecipient.tool).toBe("crearSolicitudTransferencia");
    expect(iaMissingRecipient.resultado).toMatchObject({ ok: false, reason: "user_not_found" });
    expect(iaMissingRecipient.answer).toMatch(/usuario destino no encontrado/i);

    const iaAmbiguousRecipientResponse = await source.post("/api/ia/function-calling", {
      data: { pregunta: `Transfiere la vaca ${bovino.nombre} al usuario Destino ${stamp}` }
    });
    expect(iaAmbiguousRecipientResponse.ok()).toBeTruthy();
    const iaAmbiguousRecipient = await iaAmbiguousRecipientResponse.json();
    expect(iaAmbiguousRecipient.tool).toBe("crearSolicitudTransferencia");
    expect(iaAmbiguousRecipient.resultado).toMatchObject({ ok: false, reason: "ambiguous_user" });
    expect(iaAmbiguousRecipient.answer).toMatch(/correo electronico.*correcto/i);

    const iaSelfTransferResponse = await source.post("/api/ia/function-calling", {
      data: { pregunta: `Quiero que transfiera el bovino ${bovino.nombre} a ${emailA}` }
    });
    const iaSelfTransfer = await iaSelfTransferResponse.json();
    expect(iaSelfTransfer.resultado).toMatchObject({ ok: false, reason: "self_transfer" });
    expect(iaSelfTransfer.answer).toMatch(/tu propia cuenta/i);

    const iaMissingBovinoResponse = await source.post("/api/ia/function-calling", {
      data: { pregunta: `Quiero que transfiera el bovino Inexistente${stamp} a ${emailD}` }
    });
    const iaMissingBovino = await iaMissingBovinoResponse.json();
    expect(iaMissingBovino.resultado).toMatchObject({ ok: false, reason: "bovino_not_found" });
    expect(iaMissingBovino.answer).toMatch(/bovino no encontrado/i);

    const usernameTransferResponse = await source.post("/api/ia/function-calling", {
      data: { pregunta: `Quiero que transfiera el bovino ${bovino.nombre} a ${uniqueUsername}` }
    });
    expect(usernameTransferResponse.ok()).toBeTruthy();
    const usernameTransfer = await usernameTransferResponse.json();
    expect(usernameTransfer.tool).toBe("crearSolicitudTransferencia");
    expect(usernameTransfer.resultado).toMatchObject({ ok: true });
    expect(usernameTransfer.answer).toMatch(/solicitud de transferencia enviada/i);
    expect((await source.post(`/api/transfers/${usernameTransfer.resultado.transfer.id}/cancel`)).ok()).toBeTruthy();

    const aiConversationResponse = await source.post("/api/conversations/create");
    expect(aiConversationResponse.ok()).toBeTruthy();
    const aiConversation = await aiConversationResponse.json();
    const transferConfirmationResponse = await source.post("/api/ia/router", {
      data: {
        pregunta: `Quiero que transfiera el bovino ${bovino.nombre} a ${emailB}`,
        conversation_id: aiConversation.conversation_id,
        stream: false
      }
    });
    const transferConfirmation = await transferConfirmationResponse.json();
    expect(transferConfirmation.answer).toMatch(/confirmas.*solicitud de transferencia/i);

    const confirmedTransferResponse = await source.post("/api/ia/router", {
      data: {
        pregunta: "Si",
        conversation_id: aiConversation.conversation_id,
        stream: false
      }
    });
    const confirmedTransfer = await confirmedTransferResponse.json();
    expect(confirmedTransfer.answer).toMatch(/solicitud de transferencia enviada/i);
    expect(confirmedTransfer.answer).toContain(bovino.nombre);
    expect(confirmedTransfer.answer).toContain(emailB);

    const pendingTransfers = await (await source.get("/api/transfers?direction=sent&status=PENDING")).json();
    const transfer = pendingTransfers.find((item: any) => Number(item.bovino_id) === Number(bovino.id));
    expect(transfer).toBeTruthy();
    const transferResult = { transfer };

    const duplicatePendingResponse = await source.post("/api/ia/function-calling", {
      data: { pregunta: `Quiero que transfiera el bovino ${bovino.nombre} a ${emailB}` }
    });
    const duplicatePending = await duplicatePendingResponse.json();
    expect(duplicatePending.resultado).toMatchObject({ ok: false, reason: "pending_exists" });
    expect(duplicatePending.answer).toMatch(/solicitud pendiente/i);

    const sourceBovinosWhilePending = await (await source.get("/api/bovinos")).json();
    expect(sourceBovinosWhilePending.some((item: any) => Number(item.id) === Number(bovino.id))).toBe(true);

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
    const transferredVaccines = await (await destination.get(`/api/vacunas-aplicadas?bovino_id=${bovino.id}`)).json();
    expect(transferredVaccines.some((item: any) => Number(item.bovino_id) === Number(bovino.id))).toBe(true);
    const transferredDiseases = await (await destination.get(`/api/enfermedades?bovino_id=${bovino.id}`)).json();
    expect(transferredDiseases.some((item: any) => item.nombre === `Revision E2E ${stamp}`)).toBe(true);
    const transferredHistory = await (await destination.get(`/api/historial-propiedad?bovino_id=${bovino.id}`)).json();
    expect(transferredHistory.some((item: any) =>
      Number(item.propietario_usuario_id) === Number(userA.id) && item.fecha_fin
    )).toBe(true);
    expect(transferredHistory.some((item: any) =>
      Number(item.propietario_usuario_id) === Number(userB.id) && !item.fecha_fin
    )).toBe(true);

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

    const destinationBrowser = await browser.newContext();
    const destinationPage = await destinationBrowser.newPage();
    await destinationPage.goto("/login");
    await destinationPage.waitForLoadState("networkidle");
    const destinationEmail = destinationPage.getByPlaceholder("tu@email.com");
    const destinationPassword = destinationPage.locator('input[type="password"]');
    await destinationEmail.fill(emailB);
    await destinationPassword.fill(password);
    await expect(destinationEmail).toHaveValue(emailB);
    await expect(destinationPassword).toHaveValue(password);
    await destinationPage.getByRole("button", { name: "Login" }).click();
    await expect(destinationPage).toHaveURL(/\/$/);
    await destinationPage.goto("/mensajes");

    const realtimeText = `Mensaje en tiempo real ${stamp}`;
    expect((await source.post(`/api/community/conversations/${conversation.id}/messages`, {
      data: { content: realtimeText, client_message_id: `e2e-${stamp}` }
    })).ok()).toBeTruthy();

    const conversationButton = destinationPage.getByRole("button").filter({ hasText: `Origen ${stamp}` });
    await expect(conversationButton.getByText(realtimeText, { exact: true })).toBeVisible();
    await expect(conversationButton.locator("span")).toHaveCount(1);
    await conversationButton.click();
    await expect(destinationPage.getByRole("main").getByText(realtimeText, { exact: true })).toBeVisible();
    await expect(conversationButton.locator("span")).toHaveCount(0);

    await destinationPage.goto("/ia");
    const iaInput = destinationPage.getByPlaceholder("Escribe tu pregunta...");
    await expect(iaInput).toHaveAttribute("data-chat-ready", "true");
    await iaInput.fill(`Registra 412 kg a ${bovino.nombre}`);
    await expect(destinationPage.getByTitle("Enviar")).toBeEnabled();
    await destinationPage.getByTitle("Enviar").click();
    await expect(destinationPage.getByTitle("Enviar")).toBeVisible();

    const finalWeightAnswer = destinationPage.getByText(
      new RegExp(`Peso de ${bovino.nombre} registrado: 412(?:\\.00)? kg`, "i")
    );
    if (await finalWeightAnswer.count() === 0) {
      await expect(destinationPage.getByText(/confirmas/i).last()).toBeVisible();
      await iaInput.fill("Si");
      await destinationPage.getByTitle("Enviar").click();
      await expect(destinationPage.getByTitle("Enviar")).toBeVisible();
    }
    await expect(finalWeightAnswer.last()).toBeVisible();
    const finalWeightText = await finalWeightAnswer.last().textContent();
    await destinationPage.reload();
    await expect(destinationPage.getByText(finalWeightText ?? "", { exact: true })).toHaveCount(1);

    const notifications = await (await destination.get("/api/notifications")).json();
    expect(notifications.items.some((item: any) => item.type === "BOVINO_TRANSFER_REQUEST")).toBe(true);

    const iaResponse = await destination.post("/api/ia/router", { data: { pregunta: "Que razas tienes?", stream: false } });
    expect(iaResponse.ok()).toBeTruthy();
    const iaPayload = await iaResponse.json();
    expect(iaPayload.answer).toContain("Catalogo de Razas");
    expect(iaPayload.respuesta).toBe(iaPayload.answer);

    const streamedIa = await destination.post("/api/ia/router", {
      data: { pregunta: `Registra 410 kg a ${bovino.nombre}`, stream: true }
    });
    expect(streamedIa.ok()).toBeTruthy();
    const streamedBody = await streamedIa.text();
    expect(streamedBody).toContain("event: answer");
    expect(streamedBody).toContain('"answer":');
    expect(streamedBody).toContain('"final":true');

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
    await duplicateDestination.dispose();
    await uniqueDestination.dispose();
    await destinationBrowser.close();
  });
});
