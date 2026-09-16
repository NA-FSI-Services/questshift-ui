import { describe, expect, it, vi } from "vitest";
import { bindPresence, type EventBus } from "./presenceBind";

function bus(): EventBus & { handlers: Record<string, Array<(...args: never[]) => void>> } {
  const handlers: Record<string, Array<(...args: never[]) => void>> = {};
  return {
    handlers,
    on(event, handler) {
      handlers[event] = [...(handlers[event] ?? []), handler];
    },
    off(event, handler) {
      handlers[event] = (handlers[event] ?? []).filter((item) => item !== handler);
    },
  };
}

describe("bindPresence", () => {
  it("listens on the game bus when the dungeon scene is still missing", () => {
    const events = bus();
    const handler = vi.fn();
    const unbind = bindPresence({ events, scene: { getScene: () => null } }, handler);
    events.handlers.presence[0]({ mapX: 200, mapY: 250, viewedRoomId: "" } as never);
    expect(handler).toHaveBeenCalledWith({ mapX: 200, mapY: 250, viewedRoomId: "" });
    unbind();
    expect(events.handlers.presence).toEqual([]);
  });

  it("falls back to the scene bus when the game has no events", () => {
    const sceneEvents = bus();
    const handler = vi.fn();
    bindPresence({ scene: { getScene: () => ({ events: sceneEvents }) } }, handler);
    sceneEvents.handlers.presence[0]({
      mapX: 1,
      mapY: 2,
      viewedRoomId: "room-01-broken-shell",
    } as never);
    expect(handler).toHaveBeenCalledWith({
      mapX: 1,
      mapY: 2,
      viewedRoomId: "room-01-broken-shell",
    });
  });
});
