import type { GameSession } from "./api/client";

export type LocationLike = Pick<Location, "protocol" | "host">;

export function sessionSocketUrl(sessionId: string, loc: LocationLike = window.location): string {
  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${loc.host}/ws/sessions/${encodeURIComponent(sessionId)}`;
}

export function applySessionSnapshot(raw: string): GameSession | null {
  try {
    const parsed = JSON.parse(raw) as GameSession;
    if (!parsed || typeof parsed.id !== "string" || parsed.id.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function openSessionSocket(
  sessionId: string,
  onSnapshot: (session: GameSession) => void,
  socketFactory: (url: string) => WebSocket = (url) => new WebSocket(url),
): () => void {
  const socket = socketFactory(sessionSocketUrl(sessionId));
  const onMessage = (event: Event) => {
    const data = "data" in event ? String((event as MessageEvent).data ?? "") : "";
    const live = applySessionSnapshot(data);
    if (live) {
      onSnapshot(live);
    }
  };
  socket.addEventListener("message", onMessage);
  return () => {
    socket.removeEventListener("message", onMessage);
    socket.close();
  };
}
