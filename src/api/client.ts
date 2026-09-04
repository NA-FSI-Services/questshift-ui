export type PartyMember = {
  name: string;
  seatId: string;
};

export type GameSession = {
  id: string;
  campaignId: string;
  status: string;
  currentRoomId: string;
  elapsedSeconds: number;
  partyMembers: PartyMember[];
  inventory: string[];
  skills: string[];
  puzzleCompletion: Record<string, boolean>;
  lastNarrative?: string;
  lastHint?: string;
  lastCanvasEvent?: string;
};

export type CommandResult = {
  passed: boolean;
  message: string;
  command: string;
  seatId?: string;
  session: GameSession;
};

export type CampaignRoom = {
  id: string;
  title: string;
  mapX: number;
  mapY: number;
  puzzle_type: string;
};

export type Campaign = {
  metadata: { id: string; title: string; durationMinutes: number };
  seats: { id: string; title: string; color: string }[];
  rooms: CampaignRoom[];
};

const jsonHeaders = { "Content-Type": "application/json" };

export async function listCampaigns(): Promise<Campaign[]> {
  const res = await fetch("/api/campaigns");
  if (!res.ok) {
    throw new Error("Could not load campaigns");
  }
  return res.json();
}

export async function startSession(party: PartyMember[]): Promise<GameSession> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ campaignId: "devops-dungeon", party }),
  });
  if (!res.ok) {
    throw new Error("Could not start session");
  }
  return res.json();
}

export async function submitCommand(
  sessionId: string,
  command: string,
  seatId: string,
): Promise<CommandResult> {
  const res = await fetch(`/api/sessions/${sessionId}/commands`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ command, seatId }),
  });
  if (!res.ok) {
    throw new Error("Command rejected by engine");
  }
  return res.json();
}

export async function exportSession(sessionId: string): Promise<string> {
  const res = await fetch(`/api/sessions/${sessionId}/export?format=yaml`);
  if (!res.ok) {
    throw new Error("Export failed");
  }
  return res.text();
}
