import type { PresencePayload } from "./game/DungeonScene";

export type EventBus = {
  on: (event: string, handler: (...args: never[]) => void) => void;
  off: (event: string, handler: (...args: never[]) => void) => void;
};

export type PresenceGame = {
  events?: EventBus;
  scene?: {
    getScene: (key: string) => { events?: EventBus } | null | undefined;
  };
};

/**
 * Phaser.Game exists immediately; `scene.getScene("dungeon")` often does not.
 * Prefer the game bus so walks POST even when the scene is still booting.
 */
export function bindPresence(
  game: PresenceGame,
  handler: (payload: PresencePayload) => void,
): () => void {
  const attached: Array<{ bus: EventBus; event: string; fn: (...args: never[]) => void }> = [];
  const typed = handler as (...args: never[]) => void;

  const listen = (bus: EventBus | undefined, event: string, fn: (...args: never[]) => void) => {
    if (!bus?.on) {
      return false;
    }
    bus.on(event, fn);
    attached.push({ bus, event, fn });
    return true;
  };

  if (!listen(game.events, "presence", typed)) {
    listen(game.scene?.getScene("dungeon")?.events, "presence", typed);
  }

  return () => {
    attached.forEach(({ bus, event, fn }) => bus.off(event, fn));
  };
}
