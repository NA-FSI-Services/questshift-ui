import { describe, expect, it } from "vitest";
import {
  gemKeyFor,
  frameFor,
  guardianSpriteKey,
  GUARDIAN_SPRITE_KEYS,
  lobbyDoorKey,
  lootSpriteKey,
  LOOT_ORDER,
  LOOT_SPRITE_KEYS,
  SEAT_SPRITE_KEYS,
  seatSpriteKey,
  SHEET_SPACING,
  SPRITE_FRAMES,
  SPRITE_SCALE,
  SPRITESHEET_LOAD,
  TILE_SIZE,
  TINY_DUNGEON_PATH,
  TINY_DUNGEON_SHEET,
} from "./sprites";

const UX_FRAMES: Record<string, number> = {
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
};

describe("Kenney sprite keys", () => {
  it("loads the packed sheet at 16×16 with spacing 0", () => {
    expect(SPRITESHEET_LOAD).toEqual({
      key: TINY_DUNGEON_SHEET,
      url: TINY_DUNGEON_PATH,
      frameConfig: { frameWidth: 16, frameHeight: 16, spacing: 0 },
    });
    expect(TILE_SIZE).toBe(16);
    expect(SHEET_SPACING).toBe(0);
    expect(SPRITE_SCALE).toBe(3);
    expect(TINY_DUNGEON_PATH).toContain("tilemap_packed.png");
  });

  it("maps every UX.md named key to the Kenney frame index", () => {
    expect(Object.keys(SPRITE_FRAMES).sort()).toEqual(Object.keys(UX_FRAMES).sort());
    for (const [key, frame] of Object.entries(UX_FRAMES)) {
      expect(frameFor(key as keyof typeof SPRITE_FRAMES)).toBe(frame);
    }
  });

  it("maps campaign seat ids to named keys", () => {
    expect(SEAT_SPRITE_KEYS.guardian).toBe("seat_guardian");
    expect(seatSpriteKey("automancer")).toBe("seat_automancer");
    expect(seatSpriteKey("missing")).toBeUndefined();
  });

  it("uses the same closed lobby gate for current, locked, and resolved rooms", () => {
    expect(lobbyDoorKey()).toBe("lobby_gate");
    expect(frameFor("lobby_gate")).toBe(9);
    expect(frameFor("door_locked")).toBe(21);
    expect(frameFor("door")).toBe(45);
  });

  it("maps each challenge room to a distinct Kenney guardian", () => {
    expect(GUARDIAN_SPRITE_KEYS["room-01-broken-shell"]).toBe("guardian_shell");
    expect(guardianSpriteKey("room-02-playbook-of-binding")).toBe("guardian_playbook");
    expect(guardianSpriteKey("room-03-pod-that-would-not-wake")).toBe("guardian_pod");
    expect(guardianSpriteKey("room-04-cursed-servlet")).toBe("guardian_servlet");
    expect(guardianSpriteKey("room-05-operators-throne")).toBe("guardian_throne");
    expect(guardianSpriteKey("room-01-broken-shell", "guardian_pod")).toBe("guardian_pod");
    expect(guardianSpriteKey("unknown-room")).toBe("guardian_shell");
    expect(new Set(Object.values(GUARDIAN_SPRITE_KEYS)).size).toBe(5);
  });

  it("maps inventory runes to loot keys and ignores trophy ids", () => {
    expect(LOOT_ORDER).toEqual(["rune-thorn", "rune-ash", "rune-oak", "rune-iron"]);
    expect(lootSpriteKey("rune-thorn")).toBe("loot_thorn");
    expect(LOOT_SPRITE_KEYS["rune-iron"]).toBe("loot_iron");
    expect(lootSpriteKey("cluster-name")).toBeUndefined();
  });

  it("picks gem keys from completion, current room, and miss", () => {
    const completed = { "room-01-broken-shell": true };
    expect(
      gemKeyFor({
        roomId: "room-01-broken-shell",
        currentRoomId: "room-02-playbook-of-binding",
        completed,
        missed: true,
      }),
    ).toBe("gem_complete");
    expect(
      gemKeyFor({
        roomId: "room-02-playbook-of-binding",
        currentRoomId: "room-02-playbook-of-binding",
        completed,
        missed: false,
      }),
    ).toBe("gem_current");
    expect(
      gemKeyFor({
        roomId: "room-02-playbook-of-binding",
        currentRoomId: "room-02-playbook-of-binding",
        completed,
        missed: true,
      }),
    ).toBe("gem_hint");
    expect(
      gemKeyFor({
        roomId: "room-03-pod-that-would-not-wake",
        currentRoomId: "room-02-playbook-of-binding",
        completed,
        missed: true,
      }),
    ).toBe("gem_locked");
    expect(
      gemKeyFor({
        roomId: "room-01-broken-shell",
        currentRoomId: "",
        completed: {},
        missed: false,
      }),
    ).toBe("gem_locked");
  });
});
