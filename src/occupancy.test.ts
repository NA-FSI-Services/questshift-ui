import { describe, expect, it } from "vitest";
import {
  ALIAS_FONT,
  ALIAS_INK,
  ALIAS_TEXT_STYLE,
  OFFSET_STEP,
  aliasLabelOffset,
  layerId,
  occupantsByRoom,
  occupancySlot,
  overlapOffset,
  placeWalkers,
  sameLayer,
  type Occupant,
} from "./occupancy";

const ada: Occupant = {
  name: "Ada",
  seatId: "guardian",
  mapX: 120,
  mapY: 276,
  viewedRoomId: "",
};

const briar: Occupant = {
  name: "Briar",
  seatId: "guardian",
  mapX: 120,
  mapY: 276,
  viewedRoomId: "",
};

const linus: Occupant = {
  name: "Linus",
  seatId: "automancer",
  mapX: 450,
  mapY: 360,
  viewedRoomId: "room-01-broken-shell",
};

describe("layer contract", () => {
  it("treats empty viewedRoomId as the overworld and matches interiors by id", () => {
    expect(layerId(undefined)).toBe("");
    expect(layerId("  ")).toBe("");
    expect(sameLayer("", undefined)).toBe(true);
    expect(sameLayer("room-01-broken-shell", "room-01-broken-shell")).toBe(true);
    expect(sameLayer("", "room-01-broken-shell")).toBe(false);
    expect(sameLayer("room-01-broken-shell", "room-02-playbook-of-binding")).toBe(false);
  });
});

describe("placeWalkers", () => {
  it("labels stacked Guardians as distinct walkers with an offset", () => {
    const placed = placeWalkers([ada, briar], "", "Ada");
    expect(placed).toHaveLength(2);
    expect(placed[0]).toMatchObject({ name: "Ada", x: 120, y: 276, self: true });
    expect(placed[1]).toMatchObject({
      name: "Briar",
      x: 120 + OFFSET_STEP,
      y: 276,
      self: false,
    });
  });

  it("keeps the local sprite unshifted when a later joiner is you", () => {
    const placed = placeWalkers([ada, briar], "", "Briar");
    const mine = placed.find((walker) => walker.name === "Briar");
    const other = placed.find((walker) => walker.name === "Ada");
    expect(mine).toMatchObject({ x: 120, y: 276, self: true });
    expect(other).toMatchObject({ x: 120 - OFFSET_STEP, y: 276, self: false });
  });

  it("does not draw an interior teammate as a walker on the overworld", () => {
    const placed = placeWalkers([ada, linus], "", "Ada");
    expect(placed.map((walker) => walker.name)).toEqual(["Ada"]);
  });

  it("draws only walkers who share the interior", () => {
    const ember: Occupant = {
      name: "Ember",
      seatId: "automancer",
      mapX: 460,
      mapY: 360,
      viewedRoomId: "room-02-playbook-of-binding",
    };
    const placed = placeWalkers([ada, linus, ember], "room-01-broken-shell", "Linus");
    expect(placed.map((walker) => walker.name)).toEqual(["Linus"]);
  });

  it("leaves distant walkers unshifted and still offsets when you are not on the layer", () => {
    const moss: Occupant = {
      name: "Moss",
      seatId: "ranger",
      mapX: 400,
      mapY: 140,
      viewedRoomId: "",
    };
    const far = placeWalkers([ada, moss], "", "Ada");
    expect(far.find((walker) => walker.name === "Moss")).toMatchObject({ x: 400, y: 140 });
    const stacked = placeWalkers([ada, briar], "", "");
    expect(stacked[1]).toMatchObject({ x: 120 + OFFSET_STEP, y: 276, self: false });
  });

  it("wraps the fifth stacked sprite onto the next row", () => {
    const stacked = Array.from({ length: 5 }, (_, index) => ({
      name: `P${index}`,
      seatId: "guardian",
      mapX: 120,
      mapY: 276,
      viewedRoomId: "",
    }));
    const placed = placeWalkers(stacked, "", "P0");
    expect(overlapOffset(4)).toEqual({ x: 0, y: OFFSET_STEP });
    expect(placed[4]).toMatchObject({ x: 120, y: 276 + OFFSET_STEP });
  });
});

describe("occupantsByRoom", () => {
  it("marks Linus on The Broken Shell while you stay on the overworld", () => {
    expect(occupantsByRoom([ada, linus], "")).toEqual([
      { roomId: "room-01-broken-shell", occupants: [linus] },
    ]);
  });

  it("hides overworld occupancy while you are inside a room", () => {
    expect(occupantsByRoom([ada, linus], "room-01-broken-shell")).toEqual([]);
  });

  it("keeps every alias when more than three people share a room", () => {
    const occupants = ["Linus", "Ember", "Forge", "Glyph"].map((name) => ({
      name,
      seatId: "automancer",
      mapX: 450,
      mapY: 360,
      viewedRoomId: "room-01-broken-shell",
    }));
    const groups = occupantsByRoom(occupants, "");
    expect(groups[0]?.occupants.map((item) => item.name)).toEqual([
      "Linus",
      "Ember",
      "Forge",
      "Glyph",
    ]);
    expect(occupancySlot(120, 220, 0, 4)).toEqual({ x: 100, y: 132 });
    expect(occupancySlot(120, 220, 3, 4).y).toBeLessThan(occupancySlot(120, 220, 0, 4).y);
  });
});

describe("alias labels", () => {
  it("uses IBM Plex Mono ink with a dark stroke, not seat color alone", () => {
    expect(ALIAS_TEXT_STYLE.fontFamily).toBe(ALIAS_FONT);
    expect(ALIAS_TEXT_STYLE.color).toBe(ALIAS_INK);
    expect(ALIAS_TEXT_STYLE.stroke).toBe("#070a09");
    expect(aliasLabelOffset().y).toBeLessThan(0);
  });
});
