import { layerId, namesMatch } from "./occupancy";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./sprites";

export const CLUE_DIALOG = {
  width: 640,
  height: 340,
  padding: 20,
};

export const ROOM_TITLE = {
  y: 28,
  padX: 14,
  padY: 6,
  fill: 0x070a09,
  fillAlpha: 0.94,
  radius: 4,
};

export const ROOM_TITLE_STYLE = {
  fontFamily: "IBM Plex Mono",
  fontSize: "16px",
  color: "#e0b25a",
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

export type LayerClue = {
  id: string;
  x: number;
  y: number;
  roomId: string;
  label: string;
  text: string;
};

export type CampaignClueSource = {
  story?: {
    clues?: Array<{ id: string; x: number; y: number; label: string; text: string }>;
  };
  rooms?: Array<{
    id: string;
    clues?: Array<{ id: string; x: number; y: number; label: string; text: string }>;
  }>;
};

/** Empty `viewedRoomId` is the in-run overworld lobby. */
export const LOBBY_LAYER = "";

export function foundCluesFor(members: PartyClueHolder[], meName: string): string[] {
  const mine = members.find((member) => namesMatch(member.name, meName));
  return mine?.foundClues ?? [];
}

export function layerClues(campaign: CampaignClueSource | null | undefined): LayerClue[] {
  const lobby = (campaign?.story?.clues ?? []).map((clue) => ({
    id: clue.id,
    x: clue.x,
    y: clue.y,
    roomId: LOBBY_LAYER,
    label: clue.label,
    text: clue.text,
  }));
  const rooms = (campaign?.rooms ?? []).flatMap((room) =>
    (room.clues ?? []).map((clue) => ({
      id: clue.id,
      x: clue.x,
      y: clue.y,
      roomId: room.id,
      label: clue.label,
      text: clue.text,
    })),
  );
  return [...lobby, ...rooms];
}

export function floorChests<T extends { roomId: string }>(clues: T[], viewedRoomId: string): T[] {
  const layer = layerId(viewedRoomId);
  return clues.filter((clue) => layerId(clue.roomId) === layer);
}

export function mayOpenClue<T extends { roomId: string }>(
  clue: T | undefined,
  viewedRoomId: string,
): clue is T {
  return Boolean(clue && layerId(clue.roomId) === layerId(viewedRoomId));
}

export function clueDialogBounds(): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round((CANVAS_WIDTH - CLUE_DIALOG.width) / 2),
    y: Math.round((CANVAS_HEIGHT - CLUE_DIALOG.height) / 2) - 16,
    width: CLUE_DIALOG.width,
    height: CLUE_DIALOG.height,
  };
}

export function roomTitleWell(
  textWidth: number,
  textHeight: number,
): { x: number; y: number; width: number; height: number } {
  const width = Math.ceil(textWidth) + ROOM_TITLE.padX * 2;
  const height = Math.ceil(textHeight) + ROOM_TITLE.padY * 2;
  return {
    x: Math.round((CANVAS_WIDTH - width) / 2),
    y: ROOM_TITLE.y - ROOM_TITLE.padY,
    width,
    height,
  };
}

export function clueDialogVisible(open: ClueDialogCopy | null | undefined): boolean {
  return Boolean(open?.text);
}
