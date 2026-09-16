/** Panel A party occupancy. Keep in sync with docs/UX.md. Phaser stays coverage-excluded. */

export const OVERLAP_PX = 24;

export const OFFSET_STEP = 16;

export const OFFSET_WRAP = 4;

export const OCCUPANCY_NORTH = 58;

export const OCCUPANCY_COL = 20;

export const OCCUPANCY_ROW = 16;

export const OCCUPANCY_PER_ROW = 3;

export const ALIAS_INK = "#d7eadb";

export const ALIAS_STROKE = "#070a09";

export const ALIAS_FONT = "IBM Plex Mono";

export const ALIAS_TEXT_STYLE = {
  fontFamily: ALIAS_FONT,
  fontSize: "11px",
  color: ALIAS_INK,
  stroke: ALIAS_STROKE,
  strokeThickness: 3,
  align: "center" as const,
};

export type Occupant = {
  name: string;
  seatId: string;
  mapX: number;
  mapY: number;
  viewedRoomId?: string;
};

export type PlacedWalker = Occupant & {
  x: number;
  y: number;
  self: boolean;
};

export type RoomOccupancy = {
  roomId: string;
  occupants: Occupant[];
};

export function layerId(viewedRoomId?: string | null): string {
  return (viewedRoomId ?? "").trim();
}

export function sameLayer(a?: string | null, b?: string | null): boolean {
  return layerId(a) === layerId(b);
}

export function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function overlapOffset(index: number): { x: number; y: number } {
  const i = Math.max(0, index);
  return {
    x: (i % OFFSET_WRAP) * OFFSET_STEP,
    y: Math.floor(i / OFFSET_WRAP) * OFFSET_STEP,
  };
}

export function aliasLabelOffset(): { x: number; y: number } {
  return { x: 0, y: -22 };
}

export function occupancySlot(
  roomX: number,
  roomY: number,
  index: number,
  count: number,
): { x: number; y: number } {
  const row = Math.floor(index / OCCUPANCY_PER_ROW);
  const col = index % OCCUPANCY_PER_ROW;
  const inRow = Math.min(OCCUPANCY_PER_ROW, Math.max(1, count - row * OCCUPANCY_PER_ROW));
  return {
    x: roomX + (col - (inRow - 1) / 2) * OCCUPANCY_COL,
    y: roomY - OCCUPANCY_NORTH - row * OCCUPANCY_ROW,
  };
}

export function placeWalkers(
  members: Occupant[],
  localViewed: string,
  meName: string,
): PlacedWalker[] {
  const onLayer = members.filter((member) => sameLayer(member.viewedRoomId, localViewed));
  const meKey = meName.trim().toLowerCase();
  return onLayer.map((member) => {
    const cluster = onLayer.filter(
      (other) => Math.hypot(other.mapX - member.mapX, other.mapY - member.mapY) < OVERLAP_PX,
    );
    const index = cluster.findIndex((other) => namesMatch(other.name, member.name));
    const selfIndex = cluster.findIndex((other) => other.name.trim().toLowerCase() === meKey);
    const raw = overlapOffset(Math.max(0, index));
    const selfOff = selfIndex >= 0 ? overlapOffset(selfIndex) : { x: 0, y: 0 };
    const self = Boolean(meKey) && member.name.trim().toLowerCase() === meKey;
    return {
      ...member,
      viewedRoomId: layerId(member.viewedRoomId),
      self,
      x: member.mapX + (self ? 0 : raw.x - selfOff.x),
      y: member.mapY + (self ? 0 : raw.y - selfOff.y),
    };
  });
}

export function occupantsByRoom(members: Occupant[], localViewed: string): RoomOccupancy[] {
  if (layerId(localViewed)) {
    return [];
  }
  const byRoom = new Map<string, Occupant[]>();
  members.forEach((member) => {
    const roomId = layerId(member.viewedRoomId);
    if (!roomId) {
      return;
    }
    const list = byRoom.get(roomId) ?? [];
    list.push(member);
    byRoom.set(roomId, list);
  });
  return [...byRoom.entries()].map(([roomId, occupants]) => ({ roomId, occupants }));
}
