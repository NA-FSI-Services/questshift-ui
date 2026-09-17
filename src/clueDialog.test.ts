import { describe, expect, it } from "vitest";
import {
  CLUE_DIALOG,
  clueDialogBounds,
  clueDialogVisible,
  floorChests,
  foundCluesFor,
  ROOM_TITLE,
  roomTitleWell,
} from "./clueDialog";

describe("private chest dialogs", () => {
  it("reads found clues only from the local alias", () => {
    const members = [
      { name: "Ada", foundClues: ["shell-tree"] },
      { name: "Linus", foundClues: ["shell-log"] },
    ];
    expect(foundCluesFor(members, "Ada")).toEqual(["shell-tree"]);
    expect(foundCluesFor(members, "linus")).toEqual(["shell-log"]);
    expect(foundCluesFor(members, "Moss")).toEqual([]);
  });

  it("keeps every room chest on the floor after pickup", () => {
    const clues = [
      { id: "shell-tree", roomId: "room-01-broken-shell" },
      { id: "shell-log", roomId: "room-01-broken-shell" },
      { id: "bind-hosts", roomId: "room-02-playbook-of-binding" },
    ];
    expect(floorChests(clues, "room-01-broken-shell").map((clue) => clue.id)).toEqual([
      "shell-tree",
      "shell-log",
    ]);
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

  it("puts a dark well behind the interior room name", () => {
    const well = roomTitleWell(220, 18);
    expect(well.y).toBe(ROOM_TITLE.y - ROOM_TITLE.padY);
    expect(well.width).toBe(220 + ROOM_TITLE.padX * 2);
    expect(well.height).toBe(18 + ROOM_TITLE.padY * 2);
    expect(well.x).toBeGreaterThan(0);
    expect(well.x + well.width).toBeLessThanOrEqual(900);
    expect(well.y + well.height).toBeLessThan(70);
    expect(ROOM_TITLE.fill).toBe(0x070a09);
  });
});
