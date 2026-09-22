import { CANVAS_HEIGHT, CANVAS_WIDTH, TILE_DISPLAY } from "./sprites";

export const STEP = 8;

export const ENTER_RADIUS = 64;

export const CLUE_RADIUS = 40;

export const INTERIOR_DOOR = { x: 450, y: 470 };

export const INTERIOR_CHALLENGE_DOOR = { x: 450, y: 70 };

export const INTERIOR_GUARDIAN = { x: 450, y: 118 };

export const INTERIOR_SPAWN = { x: 450, y: 360 };

export const SPAWN_SOUTH = 56;

export type MapNode = { id: string; x: number; y: number; order?: number };

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

function roomOrder(nodes: { id: string; order?: number }[], index: number): number {
  return nodes[index].order ?? index + 1;
}

/** Next YAML room (`order + 1`). Last room and unknown ids have no successor. */
export function nextChallengeRoom<T extends { id: string; order?: number }>(
  fromId: string,
  nodes: T[],
): T | undefined {
  const fromIndex = nodes.findIndex((node) => node.id === fromId);
  if (fromIndex < 0) {
    return undefined;
  }
  const nextOrder = roomOrder(nodes, fromIndex) + 1;
  return nodes.find((_, index) => roomOrder(nodes, index) === nextOrder);
}

/**
 * After this room is solved, the north door leads to the next unlocked challenge.
 * Locked doors, the throne (no successor), and still-sealed next rooms return undefined.
 */
export function nextRoomThroughChallengeDoor(
  fromId: string,
  nodes: { id: string; order?: number }[],
  currentRoomId: string,
  completed: Record<string, boolean>,
): string | undefined {
  if (challengeDoorLocked(fromId, completed)) {
    return undefined;
  }
  const next = nextChallengeRoom(fromId, nodes);
  if (!next || !roomUnlocked(next.id, currentRoomId, completed)) {
    return undefined;
  }
  return next.id;
}
