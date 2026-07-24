import { expect, request as playwrightRequest, test } from "@playwright/test";

test.describe("chat comunitario por WebSocket", () => {
  test("sincroniza dos usuarios, evita duplicados y confirma entrega y lectura", async ({
    baseURL,
    browser
  }) => {
    const stamp = Date.now();
    const password = "Prueba123456";
    const sourceName = `Chat Origen ${stamp}`;
    const destinationName = `Chat Destino ${stamp}`;
    const sourceEmail = `chat.origen.${stamp}@ganaderia.test`;
    const destinationEmail = `chat.destino.${stamp}@ganaderia.test`;
    const outsiderEmail = `chat.ajeno.${stamp}@ganaderia.test`;
    const source = await playwrightRequest.newContext({ baseURL });
    const destination = await playwrightRequest.newContext({ baseURL });
    const outsider = await playwrightRequest.newContext({ baseURL });

    const register = async (api: typeof source, nombre: string, email: string) => {
      const response = await api.post("/api/auth/register", {
        data: { nombre, email, password }
      });
      expect(response.ok()).toBeTruthy();
      const user = await response.json();
      const login = await api.post("/api/auth/login", {
        data: { email, password }
      });
      expect(login.ok()).toBeTruthy();
      return user;
    };

    const sourceUser = await register(source, sourceName, sourceEmail);
    const destinationUser = await register(destination, destinationName, destinationEmail);
    await register(outsider, `Chat Ajeno ${stamp}`, outsiderEmail);

    const friendRequestResponse = await source.post("/api/community/friends/requests", {
      data: { usuario_destino: destinationEmail }
    });
    expect(friendRequestResponse.ok()).toBeTruthy();
    const friendRequest = await friendRequestResponse.json();
    expect((await destination.post(
      `/api/community/friends/requests/${friendRequest.request.id}/accept`
    )).ok()).toBeTruthy();

    const conversationResponse = await source.post("/api/community/conversations", {
      data: { contact_user_id: destinationUser.id }
    });
    expect(conversationResponse.ok()).toBeTruthy();
    const conversation = await conversationResponse.json();
    const conversationId = String(conversation.id);

    expect((await outsider.get(
      `/api/community/conversations/${conversationId}/messages`
    )).status()).toBe(404);
    expect((await outsider.post(
      `/api/community/conversations/${conversationId}/messages`,
      { data: { content: "Mensaje no autorizado" } }
    )).status()).toBe(404);

    const sourceBrowser = await browser.newContext({
      storageState: await source.storageState()
    });
    const destinationBrowser = await browser.newContext({
      storageState: await destination.storageState()
    });
    const sourcePage = await sourceBrowser.newPage();
    const destinationPage = await destinationBrowser.newPage();

    try {
      await Promise.all([
        sourcePage.goto(`/mensajes?conversation=${conversationId}`),
        destinationPage.goto("/mensajes")
      ]);
      await expect(sourcePage.locator('[data-realtime-state="connected"]')).toBeVisible();
      await expect(destinationPage.locator('[data-realtime-state="connected"]')).toBeVisible();
      const sourceMessages = sourcePage.getByTestId("message-list");

      const firstMessage = `Mensaje WebSocket ${stamp}`;
      await sourcePage.getByPlaceholder("Escribe un mensaje...").fill(firstMessage);
      await sourcePage.getByTitle("Enviar").click();
      await expect(sourceMessages.getByText(firstMessage, { exact: true })).toBeVisible({
        timeout: 1000
      });

      const destinationConversation = destinationPage
        .getByRole("button")
        .filter({ hasText: sourceName });
      await expect(destinationConversation.getByText(firstMessage, { exact: true })).toBeVisible();
      await expect(destinationConversation.locator("span")).toHaveCount(1);

      const sourceBubble = sourceMessages
        .getByText(firstMessage, { exact: true })
        .locator("..");
      await expect(sourceBubble.getByText("Entregado", { exact: true })).toBeVisible();
      await destinationConversation.click();
      const destinationMessages = destinationPage.getByTestId("message-list");
      await expect(destinationMessages.getByText(firstMessage, { exact: true })).toHaveCount(1);
      await expect(destinationConversation.locator("span")).toHaveCount(0);
      await expect(sourceBubble.getByText("Leido", { exact: true })).toBeVisible();

      const storedAfterRead = await (
        await source.get(`/api/community/conversations/${conversationId}/messages`)
      ).json();
      const persistedFirst = storedAfterRead.filter(
        (message: any) => message.content === firstMessage
      );
      expect(persistedFirst).toHaveLength(1);
      expect(persistedFirst[0].client_message_id).toBeTruthy();
      expect(persistedFirst[0].delivered_at).toBeTruthy();
      expect(persistedFirst[0].read_at).toBeTruthy();

      const duplicateResponse = await source.post(
        `/api/community/conversations/${conversationId}/messages`,
        {
          data: {
            content: firstMessage,
            client_message_id: persistedFirst[0].client_message_id
          }
        }
      );
      expect(duplicateResponse.ok()).toBeTruthy();
      expect((await duplicateResponse.json()).duplicate).toBe(true);
      await expect(sourceMessages.getByText(firstMessage, { exact: true })).toHaveCount(1);
      await expect(destinationMessages.getByText(firstMessage, { exact: true })).toHaveCount(1);

      await destinationBrowser.setOffline(true);
      await expect(destinationPage.locator('[data-realtime-state="connecting"]')).toBeVisible();

      const missedMessage = `Mensaje recuperado ${stamp}`;
      await sourcePage.getByPlaceholder("Escribe un mensaje...").fill(missedMessage);
      await sourcePage.getByTitle("Enviar").click();
      await expect(sourceMessages.getByText(missedMessage, { exact: true })).toBeVisible();
      await expect(destinationMessages.getByText(missedMessage, { exact: true })).toHaveCount(0);

      await destinationBrowser.setOffline(false);
      await expect(destinationPage.locator('[data-realtime-state="connected"]')).toBeVisible();
      await expect(destinationMessages.getByText(missedMessage, { exact: true })).toHaveCount(1);
      const missedBubble = sourceMessages
        .getByText(missedMessage, { exact: true })
        .locator("..");
      await expect(missedBubble.getByText("Leido", { exact: true })).toBeVisible();

      const finalMessages = await (
        await destination.get(`/api/community/conversations/${conversationId}/messages`)
      ).json();
      expect(finalMessages.filter((message: any) => message.content === firstMessage)).toHaveLength(1);
      expect(finalMessages.filter((message: any) => message.content === missedMessage)).toHaveLength(1);
      expect(Number(sourceUser.id)).toBeGreaterThan(0);
    } finally {
      await sourceBrowser.close();
      await destinationBrowser.close();
      await source.dispose();
      await destination.dispose();
      await outsider.dispose();
    }
  });
});
