import { describe, expect, it } from "vitest";
import {
  atInteriorDoor,
  clampPosition,
  clueInReach,
  INTERIOR_DOOR,
  INTERIOR_SPAWN,
  nearestUnlockedRoom,
  overworldSpawn,
  roomUnlocked,
  STEP,
  stepToward,
} from "./map";

const nodes = [
  { id: "room-01-broken-shell", x: 120, y: 220 },
  { id: "room-02-playbook-of-binding", x: 280, y: 140 },
];

describe("walkable map contract", () => {
  it("unlocks the current room and completed rooms only", () => {
    expect(roomUnlocked("room-01-broken-shell", "room-01-broken-shell", {})).toBe(true);
    expect(roomUnlocked("room-02-playbook-of-binding", "room-01-broken-shell", {})).toBe(false);
    expect(
      roomUnlocked("room-01-broken-shell", "room-02-playbook-of-binding", {
        "room-01-broken-shell": true,
      }),
    ).toBe(true);
  });

  it("enters an unlocked node in reach and ignores locked ones", () => {
    expect(nearestUnlockedRoom(120, 220, nodes, "room-01-broken-shell", {})?.id).toBe(
      "room-01-broken-shell",
    );
    expect(nearestUnlockedRoom(120, 276, nodes, "room-01-broken-shell", {})?.id).toBe(
      "room-01-broken-shell",
    );
    expect(nearestUnlockedRoom(280, 140, nodes, "room-01-broken-shell", {})).toBeUndefined();
  });

  it("picks an unfound clue in reach", () => {
    const clues = [
      { id: "shell-log", x: 280, y: 220 },
      { id: "shell-grep", x: 520, y: 200 },
    ];
    expect(clueInReach(280, 220, clues, [])?.id).toBe("shell-log");
    expect(clueInReach(280, 220, clues, ["shell-log"])).toBeUndefined();
  });

  it("detects the interior door and keeps a spawn inside the canvas", () => {
    expect(atInteriorDoor(INTERIOR_DOOR.x, INTERIOR_DOOR.y)).toBe(true);
    expect(atInteriorDoor(INTERIOR_SPAWN.x, INTERIOR_SPAWN.y)).toBe(false);
    const stepped = stepToward(100, 100, STEP, 0);
    expect(stepped.x).toBeGreaterThan(100);
    expect(clampPosition(-40, 999).x).toBeGreaterThan(0);
    expect(clampPosition(-40, 999).y).toBeLessThan(520);
    expect(overworldSpawn({ id: "room-01-broken-shell", x: 120, y: 220 })).toEqual({
      x: 120,
      y: 276,
    });
  });
});
