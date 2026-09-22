/** Named Kenney Tiny Dungeon keys from UX.md. DungeonScene must not hard-code frames. */

export const TINY_DUNGEON_SHEET = "tiny-dungeon";

export const TINY_DUNGEON_PATH = "/assets/kenney/tiny-dungeon/tilemap_packed.png";

export const TILE_SIZE = 16;

export const SHEET_SPACING = 0;

export const SPRITE_SCALE = 3;

export const TILE_DISPLAY = TILE_SIZE * SPRITE_SCALE;

export const CANVAS_WIDTH = 900;

export const CANVAS_HEIGHT = 520;

export const SPRITESHEET_LOAD = {
  key: TINY_DUNGEON_SHEET,
  url: TINY_DUNGEON_PATH,
  frameConfig: {
    frameWidth: TILE_SIZE,
    frameHeight: TILE_SIZE,
    spacing: SHEET_SPACING,
  },
} as const;

export const SPRITE_FRAMES = {
  floor: 48,
  wall: 28,
  focus: 60,
  seat_automancer: 84,
  seat_artificer: 86,
  seat_ranger: 87,
  seat_guardian: 96,
  gem_locked: 113,
  gem_current: 115,
  gem_complete: 114,
  gem_hint: 116,
  loot_thorn: 29,
  loot_ash: 113,
  loot_oak: 114,
  loot_iron: 116,
  clue: 89,
  door: 45,
  door_locked: 21,
  lobby_gate: 9,
  guardian_shell: 97,
  guardian_playbook: 98,
  guardian_pod: 100,
  guardian_servlet: 108,
  guardian_throne: 121,
} as const;

export type SpriteKey = keyof typeof SPRITE_FRAMES;

export const SEAT_SPRITE_KEYS: Record<string, SpriteKey> = {
  automancer: "seat_automancer",
  artificer: "seat_artificer",
  ranger: "seat_ranger",
  guardian: "seat_guardian",
};

export const LOOT_SPRITE_KEYS: Record<string, SpriteKey> = {
  "rune-thorn": "loot_thorn",
  "rune-ash": "loot_ash",
  "rune-oak": "loot_oak",
  "rune-iron": "loot_iron",
};

export const LOOT_ORDER = ["rune-thorn", "rune-ash", "rune-oak", "rune-iron"] as const;

export const GUARDIAN_SPRITE_KEYS: Record<string, SpriteKey> = {
  "room-01-broken-shell": "guardian_shell",
  "room-02-playbook-of-binding": "guardian_playbook",
  "room-03-pod-that-would-not-wake": "guardian_pod",
  "room-04-cursed-servlet": "guardian_servlet",
  "room-05-operators-throne": "guardian_throne",
};

export function frameFor(key: SpriteKey): number {
  return SPRITE_FRAMES[key];
}

export function guardianSpriteKey(roomId: string, authored?: string): SpriteKey {
  if (authored && authored in SPRITE_FRAMES) {
    return authored as SpriteKey;
  }
  return GUARDIAN_SPRITE_KEYS[roomId] ?? "guardian_shell";
}

export function seatSpriteKey(seatId: string): SpriteKey | undefined {
  return SEAT_SPRITE_KEYS[seatId];
}

export function lootSpriteKey(itemId: string): SpriteKey | undefined {
  return LOOT_SPRITE_KEYS[itemId];
}

/** Every overworld gate uses the closed wooden door, including the current scoring room. */
export function lobbyDoorKey(): SpriteKey {
  return "lobby_gate";
}

export function gemKeyFor(opts: {
  roomId: string;
  currentRoomId: string;
  completed: Record<string, boolean>;
  missed: boolean;
}): SpriteKey {
  if (opts.completed[opts.roomId]) {
    return "gem_complete";
  }
  if (opts.currentRoomId && opts.roomId === opts.currentRoomId) {
    return opts.missed ? "gem_hint" : "gem_current";
  }
  return "gem_locked";
}
