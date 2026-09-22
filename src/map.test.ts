import { describe, expect, it } from "vitest";
import {
  atInteriorChallengeDoor,
  atInteriorDoor,
  challengeDoorLocked,
  clampPosition,
  clueInReach,
  INTERIOR_CHALLENGE_DOOR,
  INTERIOR_DOOR,
  INTERIOR_GUARDIAN,
  INTERIOR_SPAWN,
  nearestUnlockedRoom,
  nextChallengeRoom,
  nextRoomThroughChallengeDoor,
  overworldSpawn,
  roomUnlocked,
  STEP,
  stepToward,
} from "./map";

const nodes = [
  { id: "room-01-broken-shell", x: 120, y: 220, order: 1 },
  { id: "room-02-playbook-of-binding", x: 280, y: 140, order: 2 },
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

  it("picks a clue in reach even after it was opened", () => {
    const clues = [
      { id: "shell-log", x: 280, y: 220 },
      { id: "shell-tree", x: 520, y: 200 },
    ];
    expect(clueInReach(280, 220, clues)?.id).toBe("shell-log");
    expect(clueInReach(520, 200, clues)?.id).toBe("shell-tree");
    expect(clueInReach(10, 10, clues)).toBeUndefined();
  });

  it("detects the south lobby door and keeps a spawn inside the canvas", () => {
    expect(atInteriorDoor(INTERIOR_DOOR.x, INTERIOR_DOOR.y)).toBe(true);
    expect(atInteriorDoor(INTERIOR_SPAWN.x, INTERIOR_SPAWN.y)).toBe(false);
    expect(atInteriorChallengeDoor(INTERIOR_CHALLENGE_DOOR.x, INTERIOR_CHALLENGE_DOOR.y)).toBe(
      true,
    );
    expect(atInteriorChallengeDoor(INTERIOR_DOOR.x, INTERIOR_DOOR.y)).toBe(false);
    expect(INTERIOR_GUARDIAN.x).toBe(INTERIOR_CHALLENGE_DOOR.x);
    expect(INTERIOR_GUARDIAN.y).toBeGreaterThan(INTERIOR_CHALLENGE_DOOR.y);
    expect(INTERIOR_GUARDIAN.y).toBeLessThan(INTERIOR_SPAWN.y);
    const stepped = stepToward(100, 100, STEP, 0);
    expect(stepped.x).toBeGreaterThan(100);
    expect(clampPosition(-40, 999).x).toBeGreaterThan(0);
    expect(clampPosition(-40, 999).y).toBeLessThan(520);
    expect(overworldSpawn({ id: "room-01-broken-shell", x: 120, y: 220 })).toEqual({
      x: 120,
      y: 276,
    });
  });

  it("locks the north challenge door until that room is solved", () => {
    expect(challengeDoorLocked("room-01-broken-shell", {})).toBe(true);
    expect(challengeDoorLocked("room-02-playbook-of-binding", {})).toBe(true);
    expect(challengeDoorLocked("room-01-broken-shell", { "room-01-broken-shell": true })).toBe(
      false,
    );
    expect(challengeDoorLocked("", {})).toBe(false);
  });

  it("walks YAML order through the open north door after a pass", () => {
    const throne = { id: "room-05-operators-throne", x: 760, y: 180, order: 5 };
    expect(nextChallengeRoom("room-01-broken-shell", nodes)?.id).toBe(
      "room-02-playbook-of-binding",
    );
    expect(nextChallengeRoom("room-02-playbook-of-binding", nodes)).toBeUndefined();
    expect(nextChallengeRoom("room-05-operators-throne", [...nodes, throne])).toBeUndefined();
    expect(nextChallengeRoom("missing", nodes)).toBeUndefined();
    expect(
      nextRoomThroughChallengeDoor("room-01-broken-shell", nodes, "room-01-broken-shell", {}),
    ).toBeUndefined();
    expect(
      nextRoomThroughChallengeDoor("room-01-broken-shell", nodes, "room-02-playbook-of-binding", {
        "room-01-broken-shell": true,
      }),
    ).toBe("room-02-playbook-of-binding");
    expect(
      nextRoomThroughChallengeDoor(
        "room-05-operators-throne",
        [...nodes, throne],
        "room-05-operators-throne",
        { "room-05-operators-throne": true },
      ),
    ).toBeUndefined();
  });
});
