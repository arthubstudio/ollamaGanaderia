import { expect, request as playwrightRequest, test } from "@playwright/test";

const REQUIRED_VACCINES = [
  "brucelosis",
  "rabia paralitica bovina",
  "carbon sintomatico (pierna negra) y edema maligno"
];

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function apiMessage(payload: any) {
  return payload?.data?.message ?? payload?.statusMessage ?? payload?.message ?? "";
}

test.describe("mejoras de IA, vacunacion, venta y relaciones", () => {
  test("respeta las reglas de negocio y las relaciones multiples", async ({ baseURL }) => {
    const stamp = Date.now();
    const sourceEmail = `mejoras.${stamp}@ganaderia.test`;
    const friendEmail = `amigo.${stamp}@ganaderia.test`;
    const friendUsername = `amigo${stamp}`;
    const password = "Prueba123456";
    const stampHex = stamp.toString(16).padStart(12, "0").slice(-12);
    const requestOptions = {
      baseURL,
      extraHTTPHeaders: {
        Origin: String(baseURL),
        "CF-Connecting-IP": `2001:db8:12:${stampHex.slice(0, 4)}:${stampHex.slice(4, 8)}:${stampHex.slice(8, 12)}::1`
      }
    };
    const source = await playwrightRequest.newContext(requestOptions);
    const friend = await playwrightRequest.newContext(requestOptions);

    try {
      expect((await source.post("/api/auth/register", {
        data: { nombre: `Ganadero ${stamp}`, email: sourceEmail, password }
      })).ok()).toBeTruthy();
      expect((await friend.post("/api/auth/register", {
        data: { nombre: friendUsername, email: friendEmail, password }
      })).ok()).toBeTruthy();
      expect((await source.post("/api/auth/login", {
        data: { email: sourceEmail, password }
      })).ok()).toBeTruthy();
      expect((await friend.post("/api/auth/login", {
        data: { email: friendEmail, password }
      })).ok()).toBeTruthy();

      const ownerOneResponse = await source.post("/api/duenos", {
        data: { nombre: `Propietario Uno ${stamp}` }
      });
      const ownerTwoResponse = await source.post("/api/duenos", {
        data: { nombre: `Propietario Dos ${stamp}` }
      });
      expect(ownerOneResponse.ok()).toBeTruthy();
      expect(ownerTwoResponse.ok()).toBeTruthy();
      const ownerOne = await ownerOneResponse.json();
      const ownerTwo = await ownerTwoResponse.json();
      const ownerIds = [Number(ownerOne.id), Number(ownerTwo.id)].sort((a, b) => a - b);

      const ranchResponse = await source.post("/api/ranchos", {
        data: {
          nombre: `Rancho Multiple ${stamp}`,
          ubicacion: "Jalisco",
          dueno_ids: ownerIds
        }
      });
      expect(ranchResponse.ok()).toBeTruthy();
      const ranch = await ranchResponse.json();

      const breedResponse = await source.post("/api/breeds", {
        data: { nombre: `Raza Mejoras ${stamp}`, tipo: "carne", pais_origen: "Mexico" }
      });
      expect(breedResponse.ok()).toBeTruthy();
      const breed = (await breedResponse.json()).breed;

      const bovinoResponse = await source.post("/api/bovinos", {
        data: {
          nombre: `Carlota${stamp}`,
          raza: breed.nombre,
          breed_id: breed.id,
          sexo: "Hembra",
          rancho_id: ranch.id,
          dueno_ids: ownerIds
        }
      });
      expect(bovinoResponse.ok()).toBeTruthy();
      const bovino = await bovinoResponse.json();

      const ranchDetail = await (await source.get(`/api/ranchos/${ranch.id}`)).json();
      const bovinoDetail = await (await source.get(`/api/bovinos/${bovino.id}`)).json();
      expect(ranchDetail.duenos.map((item: any) => Number(item.id)).sort((a: number, b: number) => a - b)).toEqual(ownerIds);
      expect(bovinoDetail.duenos.map((item: any) => Number(item.id)).sort((a: number, b: number) => a - b)).toEqual(ownerIds);
      expect(Number(bovinoDetail.rancho_id)).toBe(Number(ranch.id));

      const vaccines = await (await source.get("/api/vacunas")).json();
      const requiredVaccines = REQUIRED_VACCINES.map((requiredName) => {
        const vaccine = vaccines.find((item: any) => normalize(item.nombre) === requiredName);
        expect(vaccine, `No se encontro la vacuna requerida: ${requiredName}`).toBeTruthy();
        return vaccine;
      });

      const firstApplication = await source.post("/api/vacunas-aplicadas", {
        data: {
          bovino_id: bovino.id,
          vacuna_id: requiredVaccines[0].id,
          fecha_aplicacion: "2026-01-15"
        }
      });
      expect(firstApplication.ok()).toBeTruthy();
      expect((await firstApplication.json()).proxima_fecha_permitida).toContain("2026-07-15");

      const tooSoon = await source.post("/api/vacunas-aplicadas", {
        data: {
          bovino_id: bovino.id,
          vacuna_id: requiredVaccines[0].id,
          fecha_aplicacion: "2026-07-14"
        }
      });
      expect(tooSoon.status()).toBe(409);
      const tooSoonPayload = await tooSoon.json();
      expect(tooSoonPayload.code ?? tooSoonPayload.data?.code).toBe("VACCINE_INTERVAL_NOT_REACHED");
      expect(apiMessage(tooSoonPayload)).toMatch(/ya fue aplicada.*2026-01-15.*2026-07-15/i);

      const sixMonthsLater = await source.post("/api/vacunas-aplicadas", {
        data: {
          bovino_id: bovino.id,
          vacuna_id: requiredVaccines[0].id,
          fecha_aplicacion: "2026-07-15"
        }
      });
      expect(sixMonthsLater.ok()).toBeTruthy();

      for (const vaccine of requiredVaccines.slice(1)) {
        const application = await source.post("/api/vacunas-aplicadas", {
          data: {
            bovino_id: bovino.id,
            vacuna_id: vaccine.id,
            fecha_aplicacion: "2026-01-15"
          }
        });
        expect(application.ok()).toBeTruthy();
      }

      expect((await source.post("/api/pesos", {
        data: { bovino_id: bovino.id, peso: 380, fecha: "2026-07-15" }
      })).ok()).toBeTruthy();
      const saleReadiness = await source.post("/api/ia/venta", {
        data: { nombre: bovino.nombre }
      });
      expect(saleReadiness.ok()).toBeTruthy();
      const salePayload = await saleReadiness.json();
      expect(salePayload.lista).toBe(true);
      expect(Number(salePayload.peso)).toBe(380);
      expect(salePayload.vacunasFaltantes).toEqual([]);
      expect(salePayload.answer).toMatch(/list[oa] para la venta/i);

      const conversationResponse = await source.post("/api/conversations/create");
      expect(conversationResponse.ok()).toBeTruthy();
      const conversationId = (await conversationResponse.json()).conversation_id;

      const incompleteAction = await source.post("/api/ia/router", {
        data: {
          pregunta: "Registra una vaca llamada Pendiente",
          conversation_id: conversationId,
          stream: false
        }
      });
      expect((await incompleteAction.json()).answer).toMatch(/falta.*raza/i);

      const breedsQuery = await source.post("/api/ia/router", {
        data: {
          pregunta: "Dame las razas disponibles",
          conversation_id: conversationId,
          stream: false
        }
      });
      expect((await breedsQuery.json()).answer).toMatch(/catalogo de razas/i);

      const staleConfirmation = await source.post("/api/ia/router", {
        data: { pregunta: "Si", conversation_id: conversationId, stream: false }
      });
      expect((await staleConfirmation.json()).answer).toMatch(/no hay una accion pendiente/i);

      const friendshipPrompt = await source.post("/api/ia/router", {
        data: {
          pregunta: `Agrega a ${friendUsername} como amigo`,
          conversation_id: conversationId,
          stream: false
        }
      });
      expect((await friendshipPrompt.json()).answer).toMatch(/confirmas/i);

      const friendshipConfirmation = await source.post("/api/ia/router", {
        data: { pregunta: "Si", conversation_id: conversationId, stream: false }
      });
      expect(friendshipConfirmation.ok()).toBeTruthy();
      const friendshipPayload = await friendshipConfirmation.json();
      expect(friendshipPayload.answer).toMatch(/solicitud.*(?:amistad|contacto).*enviada/i);

      const receivedRequests = await (await friend.get("/api/community/friends/requests?direction=received&status=PENDING")).json();
      expect(receivedRequests.some((item: any) =>
        item.direction === "received" && item.status === "PENDING" && Number(item.sender_user_id) > 0
      )).toBe(true);
    } finally {
      await source.dispose();
      await friend.dispose();
    }
  });

  test("muestra los tres puntos y bloquea envios duplicados mientras procesa", async ({ page }) => {
    const stamp = Date.now();
    const email = `loading.${stamp}@ganaderia.test`;
    const password = "Prueba123456";
    const stampHex = stamp.toString(16).padStart(12, "0").slice(-12);

    const register = await page.request.post("/api/auth/register", {
      headers: {
        "CF-Connecting-IP": `2001:db8:13:${stampHex.slice(0, 4)}:${stampHex.slice(4, 8)}:${stampHex.slice(8, 12)}::1`
      },
      data: { nombre: `Loading ${stamp}`, email, password }
    });
    expect(register.ok()).toBeTruthy();

    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder("tu@email.com").fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/ia");

    const input = page.getByPlaceholder("Escribe tu pregunta...");
    await expect(input).toHaveAttribute("data-chat-ready", "true");
    await page.route("**/api/ia/router", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const answer = "Operacion de prueba completada correctamente.";
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body: [
          "event: answer",
          `data: ${JSON.stringify({ answer, respuesta: answer, final: true })}`,
          "",
          "event: end",
          "data: done",
          ""
        ].join("\n")
      });
    });

    await input.fill("Consulta con demora controlada");
    await page.getByTitle("Enviar").click();
    await expect(page.getByRole("status", { name: "Procesando solicitud" })).toBeVisible();
    await expect(page.getByTitle("Enviar")).toBeDisabled();
    await expect(page.getByTitle("Detener")).toBeVisible();
    await expect(page.getByText("Operacion de prueba completada correctamente.", { exact: true })).toBeVisible();
    await expect(page.getByRole("status", { name: "Procesando solicitud" })).toHaveCount(0);
    await expect(page.getByTitle("Enviar")).toBeDisabled();
  });
});
