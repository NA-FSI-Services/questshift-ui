import { describe, expect, it } from "vitest";
import {
  CLUE_DIALOG,
  GOLEM_ROOM_ID,
  INTERIOR_GOLEM,
  clueDialogBounds,
  clueDialogVisible,
  foundCluesFor,
  golemBlocksExit,
} from "./clueDialog";
import { INTERIOR_DOOR } from "./map";

describe("private chest dialogs and the shell golem", () => {
  it("reads found clues only from the local alias", () => {
    const members = [
      { name: "Ada", foundClues: ["shell-tree"] },
      { name: "Linus", foundClues: ["shell-log"] },
    ];
    expect(foundCluesFor(members, "Ada")).toEqual(["shell-tree"]);
    expect(foundCluesFor(members, "linus")).toEqual(["shell-log"]);
    expect(foundCluesFor(members, "Moss")).toEqual([]);
  });

  it("blocks the Broken Shell door until that room is solved", () => {
    expect(golemBlocksExit(GOLEM_ROOM_ID, {})).toBe(true);
    expect(golemBlocksExit(GOLEM_ROOM_ID, { "room-01-broken-shell": true })).toBe(false);
    expect(golemBlocksExit("room-02-playbook-of-binding", {})).toBe(false);
    expect(INTERIOR_GOLEM.x).toBe(INTERIOR_DOOR.x);
    expect(INTERIOR_GOLEM.y).toBeLessThan(INTERIOR_DOOR.y);
  });

  it("places a readable dialog well on the canvas", () => {
    const box = clueDialogBounds();
    expect(box.width).toBe(CLUE_DIALOG.width);
    expect(box.x + box.width).toBeLessThanOrEqual(900);
    expect(box.y + box.height).toBeLessThanOrEqual(520);
    expect(clueDialogVisible({ id: "shell-log", label: "log", text: "/var/log/quest.log" })).toBe(
      true,
    );
    expect(clueDialogVisible(null)).toBe(false);
  });
});
