import { CANVAS_HEIGHT, CANVAS_WIDTH, TILE_DISPLAY } from "./sprites";

export const STEP = 8;

export const ENTER_RADIUS = 64;

export const CLUE_RADIUS = 40;

export const INTERIOR_DOOR = { x: 450, y: 470 };

export const INTERIOR_CHALLENGE_DOOR = { x: 450, y: 70 };

export const INTERIOR_GUARDIAN = { x: 450, y: 118 };

export const INTERIOR_SPAWN = { x: 450, y: 360 };

export const SPAWN_SOUTH = 56;

export type MapNode = { id: string; x: number; y: number };

export function overworldSpawn(node: MapNode): { x: number; y: number } {
  return clampPosition(node.x, node.y + SPAWN_SOUTH);
}

export type MapClue = { id: string; x: number; y: number };

export function clampPosition(x: number, y: number): { x: number; y: number } {
  const pad = TILE_DISPLAY;
  return {
    x: Math.min(CANVAS_WIDTH - pad, Math.max(pad, x)),
    y: Math.min(CANVAS_HEIGHT - pad, Math.max(pad, y)),
  };
}

export function stepToward(x: number, y: number, dx: number, dy: number): { x: number; y: number } {
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return { x, y };
  }
  return clampPosition(x + (dx / length) * STEP, y + (dy / length) * STEP);
}

export function roomUnlocked(
  roomId: string,
  currentRoomId: string,
  completed: Record<string, boolean>,
): boolean {
  return roomId === currentRoomId || Boolean(completed[roomId]);
}

export function nearestUnlockedRoom(
  x: number,
  y: number,
  nodes: MapNode[],
  currentRoomId: string,
  completed: Record<string, boolean>,
): MapNode | undefined {
  return nodes.find(
    (node) =>
      roomUnlocked(node.id, currentRoomId, completed) &&
      Math.hypot(node.x - x, node.y - y) <= ENTER_RADIUS,
  );
}

export function clueInReach(x: number, y: number, clues: MapClue[]): MapClue | undefined {
  return clues.find((clue) => Math.hypot(clue.x - x, clue.y - y) <= CLUE_RADIUS);
}

export function atInteriorDoor(x: number, y: number): boolean {
  return Math.hypot(INTERIOR_DOOR.x - x, INTERIOR_DOOR.y - y) <= ENTER_RADIUS;
}

export function atInteriorChallengeDoor(x: number, y: number): boolean {
  return Math.hypot(INTERIOR_CHALLENGE_DOOR.x - x, INTERIOR_CHALLENGE_DOOR.y - y) <= ENTER_RADIUS;
}

export function challengeDoorLocked(roomId: string, completed: Record<string, boolean>): boolean {
  return Boolean(roomId) && !completed[roomId];
}

export type PathCell = { col: number; row: number };

export function tileCell(x: number, y: number): PathCell {
  return {
    col: Math.round(x / TILE_DISPLAY),
    row: Math.round(y / TILE_DISPLAY),
  };
}

function manhattanCells(from: PathCell, to: PathCell, verticalFirst: boolean): PathCell[] {
  const cells: PathCell[] = [{ col: from.col, row: from.row }];
  let col = from.col;
  let row = from.row;
  const walk = (horizontal: boolean) => {
    const target = horizontal ? to.col : to.row;
    let cursor = horizontal ? col : row;
    const step = Math.sign(target - cursor);
    while (cursor !== target) {
      cursor += step;
      if (horizontal) {
        col = cursor;
      } else {
        row = cursor;
      }
      cells.push({ col, row });
    }
  };
  if (verticalFirst) {
    walk(false);
    walk(true);
  } else {
    walk(true);
    walk(false);
  }
  return cells;
}

/** Cosmetic overworld trail in campaign order. Does not gate walking or scoring. */
export function lobbyPathCells(nodes: { x: number; y: number }[]): PathCell[] {
  const seen = new Set<string>();
  const cells: PathCell[] = [];
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const from = tileCell(nodes[index].x, nodes[index].y);
    const to = tileCell(nodes[index + 1].x, nodes[index + 1].y);
    manhattanCells(from, to, index % 2 === 1).forEach((cell) => {
      const key = `${cell.col},${cell.row}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      cells.push(cell);
    });
  }
  return cells;
}
