type RealtimeState = Map<string, number>;

const STATE_KEY = Symbol.for("ganaderia-ai.realtime-connections");
const globalState = globalThis as Record<PropertyKey, unknown>;
const connections = (globalState[STATE_KEY] as RealtimeState | undefined) ?? new Map();
globalState[STATE_KEY] = connections;

export function tryAcquireRealtimeConnection(key: string, limit: number) {
  const current = connections.get(key) ?? 0;
  if (current >= limit) return false;
  connections.set(key, current + 1);
  return true;
}

export function releaseRealtimeConnection(key: string) {
  const current = connections.get(key) ?? 0;
  if (current <= 1) connections.delete(key);
  else connections.set(key, current - 1);
}

export function resetRealtimeConnections() {
  connections.clear();
}
