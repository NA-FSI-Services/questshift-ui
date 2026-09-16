export type PartyMember = {
  name: string;
  seatId: string;
};

export type GameSession = {
  id: string;
  joinCode?: string;
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
  yamlFallback?: boolean;
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

type EngineError = Error & { joinCode?: string };

async function engineError(res: Response, fallback: string): Promise<EngineError> {
  const err = new Error(fallback) as EngineError;
  try {
    const body = (await res.json()) as { message?: string; joinCode?: string };
    if (typeof body.message === "string" && body.message.length > 0) {
      err.message = body.message;
    } else if (res.status === 404) {
      err.message = "Unknown join code";
    }
    if (typeof body.joinCode === "string" && body.joinCode.length > 0) {
      err.joinCode = body.joinCode;
    }
  } catch {
    if (res.status === 404) {
      err.message = "Unknown join code";
    }
  }
  return err;
}

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
    throw await engineError(res, "Could not start session");
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
    throw await engineError(res, "Command rejected by engine");
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

export async function getSession(sessionId: string): Promise<GameSession> {
  const res = await fetch(`/api/sessions/${sessionId}`);
  if (!res.ok) {
    throw await engineError(res, "Could not load session");
  }
  return res.json();
}

export async function addPartyMember(sessionId: string, member: PartyMember): Promise<GameSession> {
  const res = await fetch(`/api/sessions/${sessionId}/party`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(member),
  });
  if (!res.ok) {
    throw await engineError(res, "Could not join party");
  }
  return res.json();
}

export async function importSession(body: string): Promise<GameSession> {
  const format = body.trimStart().startsWith("{") ? "json" : "yaml";
  const res = await fetch(`/api/sessions/import?format=${format}`, {
    method: "POST",
    headers: {
      "Content-Type": format === "json" ? "application/json" : "application/yaml",
    },
    body,
  });
  if (!res.ok) {
    throw await engineError(res, "Import failed");
  }
  return res.json();
}
