import { describe, expect, it, vi } from "vitest";
import { applySessionSnapshot, openSessionSocket, sessionSocketUrl } from "./sessionSocket";

describe("session socket", () => {
  it("builds a ws URL for the existing /ws/sessions path", () => {
    expect(sessionSocketUrl("s1", { protocol: "http:", host: "localhost:5173" })).toBe(
      "ws://localhost:5173/ws/sessions/s1",
    );
    expect(sessionSocketUrl("s1", { protocol: "https:", host: "play.example" })).toBe(
      "wss://play.example/ws/sessions/s1",
    );
  });

  it("accepts a GameSession snapshot and ignores junk", () => {
    expect(applySessionSnapshot(`{"id":"s1","campaignId":"devops-dungeon"}`)?.id).toBe("s1");
    expect(applySessionSnapshot("{")).toBeNull();
    expect(applySessionSnapshot("[]")).toBeNull();
    expect(applySessionSnapshot("{}")).toBeNull();
  });

  it("pushes teammate snapshots until closed", () => {
    const listeners = new Map<string, EventListener>();
    const socket = {
      addEventListener: vi.fn((event: string, handler: EventListener) => {
        listeners.set(event, handler);
      }),
      removeEventListener: vi.fn(),
      close: vi.fn(),
    };
    const onSnapshot = vi.fn();
    const stop = openSessionSocket("s1", onSnapshot, () => socket as unknown as WebSocket);
    listeners.get("message")?.(
      new MessageEvent("message", {
        data: JSON.stringify({
          id: "s1",
          commandLog: [
            {
              roomId: "room-01-broken-shell",
              name: "Linus",
              seatId: "automancer",
              command: "cat /var/log/quest.log",
              passed: false,
            },
          ],
          lastNarrative: "The golem rumbles.",
        }),
      }),
    );
    expect(onSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "s1",
        lastNarrative: "The golem rumbles.",
        commandLog: [expect.objectContaining({ name: "Linus", command: "cat /var/log/quest.log" })],
      }),
    );
    listeners.get("message")?.(new MessageEvent("message", { data: "not-json" }));
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    stop();
    expect(socket.close).toHaveBeenCalled();
    expect(socket.removeEventListener).toHaveBeenCalled();
  });
});
