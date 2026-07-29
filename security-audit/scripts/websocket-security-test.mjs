import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import WebSocket from "ws";

const APP_ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUTPUT = path.join(APP_ROOT, "security-audit", "test-results", "websocket-security-test.json");
const BASE = "http://127.0.0.1:3201";
const WS_URL = "ws://127.0.0.1:3201/_ws/community";

class ApiClient {
  constructor() {
    this.cookie = "";
  }

  async request(route, method = "GET", body = undefined) {
    const headers = { Origin: BASE };
    if (this.cookie) headers.Cookie = this.cookie;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(`${BASE}${route}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";", 1)[0];
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: response.status, data };
  }
}

class SocketCollector {
  constructor(cookie, after = 0) {
    this.messages = [];
    this.waiters = [];
    this.socket = new WebSocket(`${WS_URL}?after=${after}`, {
      headers: { Cookie: cookie, Origin: BASE }
    });
    this.socket.on("message", (raw) => {
      let message;
      try { message = JSON.parse(String(raw)); } catch { return; }
      this.messages.push(message);
      for (const waiter of [...this.waiters]) {
        if (!waiter.predicate(message)) continue;
        clearTimeout(waiter.timer);
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        waiter.resolve(message);
      }
    });
  }

  waitFor(predicate, timeoutMs = 15000) {
    const existing = this.messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        reject(new Error("Timed out waiting for WebSocket event."));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  send(payload) {
    this.socket.send(JSON.stringify(payload));
  }

  close() {
    this.socket.close();
  }
}

function addTest(report, id, pass, evidence) {
  report.tests.push({ id, status: pass ? "PASS" : "FAIL", evidence });
}

const report = {
  title: "Local WebSocket security and reliability test",
  generated_at: new Date().toISOString(),
  target: "ws://127.0.0.1:3201/_ws/community",
  tests: []
};

const stamp = Date.now();
const password = randomBytes(24).toString("base64url");
const users = [
  { nombre: `WS Auditor A ${stamp}`, email: `ws-a-${stamp}@example.test` },
  { nombre: `WS Auditor B ${stamp}`, email: `ws-b-${stamp}@example.test` },
  { nombre: `WS Auditor C ${stamp}`, email: `ws-c-${stamp}@example.test` }
];
const clients = users.map(() => new ApiClient());

try {
  const loginData = [];
  for (let index = 0; index < users.length; index += 1) {
    const registration = await clients[index].request("/api/auth/register", "POST", {
      ...users[index],
      password
    });
    if (registration.status !== 202) throw new Error(`Registration ${index} failed with ${registration.status}.`);
    const login = await clients[index].request("/api/auth/login", "POST", {
      email: users[index].email,
      password
    });
    if (login.status !== 200) throw new Error(`Login ${index} failed with ${login.status}.`);
    loginData.push(login.data);
  }

  const friendRequest = await clients[0].request("/api/community/friends/requests", "POST", {
    usuario_destino: users[1].email
  });
  const friendRequestId = friendRequest.data?.request?.id;
  const accepted = await clients[1].request(
    `/api/community/friends/requests/${friendRequestId}/accept`,
    "POST",
    {}
  );
  const conversation = await clients[0].request("/api/community/conversations", "POST", {
    contact_user_id: loginData[1].id
  });
  const conversationId = String(conversation.data?.id || "");
  if (!conversationId || accepted.status !== 200) throw new Error("Could not prepare authorized conversation.");

  const socketA = new SocketCollector(clients[0].cookie);
  const socketB = new SocketCollector(clients[1].cookie);
  const socketC = new SocketCollector(clients[2].cookie);
  await Promise.all([
    socketA.waitFor((event) => event.type === "ready"),
    socketB.waitFor((event) => event.type === "ready"),
    socketC.waitFor((event) => event.type === "ready")
  ]);
  addTest(report, "WS-001", true, { all_authenticated_connections_ready: true });

  const firstClientId = randomUUID();
  const firstContent = `Mensaje local WebSocket ${stamp}`;
  socketA.send({
    type: "send",
    conversation_id: conversationId,
    content: firstContent,
    client_message_id: firstClientId
  });
  const [messageA, messageB] = await Promise.all([
    socketA.waitFor((event) => event.type === "message" && event.message?.client_message_id === firstClientId),
    socketB.waitFor((event) => event.type === "message" && event.message?.client_message_id === firstClientId)
  ]);
  const firstMessageId = Number(messageA.message.id);
  addTest(report, "WS-002", messageA.message.is_mine === true && messageB.message.is_mine === false, {
    sender_received_immediately: Boolean(messageA),
    receiver_received_without_reload: Boolean(messageB),
    same_message_id: Number(messageB.message.id) === firstMessageId
  });

  const deliveredStatus = await socketA.waitFor((event) =>
    event.type === "status" && event.updates?.some((item) => Number(item.id) === firstMessageId && item.delivered_at)
  );
  addTest(report, "WS-003", Boolean(deliveredStatus), { delivery_status_received: Boolean(deliveredStatus) });

  socketA.send({
    type: "send",
    conversation_id: conversationId,
    content: firstContent,
    client_message_id: firstClientId
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const storedAfterDuplicate = await clients[0].request(`/api/community/conversations/${conversationId}/messages`);
  const duplicateCount = storedAfterDuplicate.data.filter((item) => item.client_message_id === firstClientId).length;
  addTest(report, "WS-004", duplicateCount === 1, { persisted_rows_for_client_message_id: duplicateCount });

  const outsiderClientId = randomUUID();
  socketC.send({
    type: "send",
    conversation_id: conversationId,
    content: "Mensaje ajeno que no debe persistir",
    client_message_id: outsiderClientId
  });
  const outsiderError = await socketC.waitFor((event) =>
    event.type === "error" && event.client_message_id === outsiderClientId
  );
  const storedAfterOutsider = await clients[0].request(`/api/community/conversations/${conversationId}/messages`);
  const outsiderPersisted = storedAfterOutsider.data.some((item) => item.client_message_id === outsiderClientId);
  addTest(report, "WS-005", Boolean(outsiderError) && !outsiderPersisted, {
    outsider_received_error: Boolean(outsiderError),
    outsider_message_persisted: outsiderPersisted,
    public_error_code: outsiderError.code
  });

  socketB.send({ type: "read", conversation_id: conversationId, message_id: firstMessageId });
  const readStatus = await socketA.waitFor((event) =>
    event.type === "status" && event.updates?.some((item) => Number(item.id) === firstMessageId && item.read_at)
  );
  addTest(report, "WS-006", Boolean(readStatus), { read_status_received_by_sender: Boolean(readStatus) });

  socketB.close();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const missedClientId = randomUUID();
  socketA.send({
    type: "send",
    conversation_id: conversationId,
    content: `Mensaje perdido local ${stamp}`,
    client_message_id: missedClientId
  });
  const missedByA = await socketA.waitFor((event) =>
    event.type === "message" && event.message?.client_message_id === missedClientId
  );
  const reconnectB = new SocketCollector(clients[1].cookie, firstMessageId);
  const synchronized = await reconnectB.waitFor((event) =>
    event.type === "sync" && event.messages?.some((item) => item.client_message_id === missedClientId)
  );
  addTest(report, "WS-007", Boolean(missedByA) && Boolean(synchronized), {
    sender_received_offline_message: Boolean(missedByA),
    receiver_recovered_after_reconnect: Boolean(synchronized)
  });

  socketA.close();
  socketC.close();
  reconnectB.close();
} catch (error) {
  report.fatal_error = { name: error?.name || "Error", message: String(error?.message || error) };
  process.exitCode = 1;
}

report.totals = {
  executed: report.tests.length,
  pass: report.tests.filter((item) => item.status === "PASS").length,
  fail: report.tests.filter((item) => item.status === "FAIL").length
};
await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report.totals)}\n`);
