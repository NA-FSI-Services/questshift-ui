import { namesMatch } from "./occupancy";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./sprites";

export const GOLEM_ROOM_ID = "room-01-broken-shell";

export const INTERIOR_GOLEM = { x: 450, y: 430 };

export const CLUE_DIALOG = {
  width: 640,
  height: 340,
  padding: 20,
};

export type PartyClueHolder = {
  name: string;
  foundClues?: string[];
};

export type ClueDialogCopy = {
  id: string;
  label: string;
  text: string;
};

export function foundCluesFor(members: PartyClueHolder[], meName: string): string[] {
  const mine = members.find((member) => namesMatch(member.name, meName));
  return mine?.foundClues ?? [];
}

export function golemBlocksExit(roomId: string, completed: Record<string, boolean>): boolean {
  return roomId === GOLEM_ROOM_ID && !completed[roomId];
}

export function clueDialogBounds(): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round((CANVAS_WIDTH - CLUE_DIALOG.width) / 2),
    y: Math.round((CANVAS_HEIGHT - CLUE_DIALOG.height) / 2) - 16,
    width: CLUE_DIALOG.width,
    height: CLUE_DIALOG.height,
  };
}

export function clueDialogVisible(open: ClueDialogCopy | null | undefined): boolean {
  return Boolean(open?.text);
}
