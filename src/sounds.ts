/** Named Kenney CC0 SFX from UX.md. DungeonScene must not hard-code file paths. */

export const SFX_DIR = "/assets/kenney/sfx";

export const ROOM_ENTER_DELAY_MS = 280;

export const SFX_EVENTS = {
  door_open: {
    key: "sfx_door_open",
    urls: [`${SFX_DIR}/door_open.ogg`, `${SFX_DIR}/door_open.wav`],
    pack: "RPG Audio",
    source: "doorOpen_1.ogg",
    volume: 0.55,
  },
  room_enter: {
    key: "sfx_room_enter",
    urls: [`${SFX_DIR}/room_enter.ogg`, `${SFX_DIR}/room_enter.wav`],
    pack: "RPG Audio",
    source: "footstep00.ogg",
    volume: 0.75,
  },
  quest_complete: {
    key: "sfx_quest_complete",
    urls: [`${SFX_DIR}/quest_complete.ogg`, `${SFX_DIR}/quest_complete.wav`],
    pack: "Music Jingles",
    source: "jingles_NES03.ogg",
    volume: 0.5,
  },
  chest_open: {
    key: "sfx_chest_open",
    urls: [`${SFX_DIR}/chest_open.ogg`, `${SFX_DIR}/chest_open.wav`],
    pack: "RPG Audio",
    source: "metalLatch.ogg",
    volume: 0.65,
  },
} as const;

export type SfxEvent = keyof typeof SFX_EVENTS;

export const SFX_LOAD = (Object.keys(SFX_EVENTS) as SfxEvent[]).map((event) => ({
  event,
  key: SFX_EVENTS[event].key,
  urls: [...SFX_EVENTS[event].urls],
}));

export type CompletionCue = {
  heard: Set<string>;
  primed: boolean;
  play: boolean;
};

/**
 * First live board remembers existing completions so restore does not replay.
 * Later boards cue once when a room flips to complete.
 */
export function completionsToCue(opts: {
  heard: ReadonlySet<string>;
  completed: Record<string, boolean>;
  primed: boolean;
  live: boolean;
}): CompletionCue {
  if (!opts.primed) {
    if (!opts.live) {
      return { heard: new Set(opts.heard), primed: false, play: false };
    }
    const heard = new Set(opts.heard);
    Object.entries(opts.completed).forEach(([id, done]) => {
      if (done) {
        heard.add(id);
      }
    });
    return { heard, primed: true, play: false };
  }
  const heard = new Set(opts.heard);
  let play = false;
  Object.entries(opts.completed).forEach(([id, done]) => {
    if (done && !heard.has(id)) {
      heard.add(id);
      play = true;
    }
  });
  return { heard, primed: true, play };
}
