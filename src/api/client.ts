export type PartyMember = {
  name: string;
  seatId: string;
  mapX?: number;
  mapY?: number;
  viewedRoomId?: string;
  foundClues?: string[];
};

export type CampaignClue = {
  id: string;
  label: string;
  text: string;
  x: number;
  y: number;
};

export type CommandLogEntry = {
  roomId: string;
  name: string;
  seatId: string;
  command: string;
  passed: boolean;
  message?: string;
  /** Game Master prose answering this attempt. `name` is the addressee. */
  narrative?: string;
};

export type GmLogEntry = {
  roomId: string;
  narrative?: string;
  /** Scene beats omit this. A name would mean the line is not room-addressed. */
  name?: string | null;
};

export type StageClear = {
  roomId: string;
  roomTitle: string;
  name: string;
};

export type AdventureSummary = {
  mostQuestions?: string;
  mostQuestionsCount?: number;
  mostCommands?: string;
  mostCommandsCount?: number;
  stages?: StageClear[];
  prose?: string;
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
  /** Alias who may type. Engine-owned floor. */
  turnName?: string;
  yamlFallback?: boolean;
  commandLog?: CommandLogEntry[];
  gmLog?: GmLogEntry[];
  foundClues?: string[];
  adventureSummary?: AdventureSummary;
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
  order?: number;
  puzzle_type: string;
  narrative?: string;
  prompt?: string;
  clues?: CampaignClue[];
  guardian?: { id: string; title: string; sprite: string };
};

export type Campaign = {
  metadata: { id: string; title: string; subtitle?: string; durationMinutes: number };
  story?: { premise?: string; opening?: string; clues?: CampaignClue[] };
  seats: { id: string; title: string; color: string }[];
  rooms: CampaignRoom[];
};

const jsonHeaders = { "Content-Type": "application/json" };

type EngineError = Error & { joinCode?: string; status?: number; error?: string };

async function engineError(res: Response, fallback: string): Promise<EngineError> {
  const err = new Error(fallback) as EngineError;
  err.status = res.status;
  try {
    const body = (await res.json()) as { message?: string; joinCode?: string; error?: string };
    if (typeof body.message === "string" && body.message.length > 0) {
      err.message = body.message;
    } else if (res.status === 404) {
      err.message = "Unknown join code";
    }
    if (typeof body.joinCode === "string" && body.joinCode.length > 0) {
      err.joinCode = body.joinCode;
    }
    if (typeof body.error === "string" && body.error.length > 0) {
      err.error = body.error;
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

export async function startSession(
  party: PartyMember[],
  campaignId = "devops-dungeon",
): Promise<GameSession> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ campaignId, party }),
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
  name: string,
): Promise<CommandResult> {
  const res = await fetch(`/api/sessions/${sessionId}/commands`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ command, seatId, name }),
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

export async function leaveParty(sessionId: string, name: string): Promise<GameSession> {
  const res = await fetch(`/api/sessions/${sessionId}/party?name=${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw await engineError(res, "Could not leave party");
  }
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw await engineError(res, "Could not delete party");
  }
}

export type PresenceUpdate = {
  name: string;
  mapX: number;
  mapY: number;
  viewedRoomId: string;
  pickupClueId?: string;
};

export async function reportPresence(
  sessionId: string,
  body: PresenceUpdate,
): Promise<GameSession> {
  const res = await fetch(`/api/sessions/${sessionId}/presence`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw await engineError(res, "Could not update presence");
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
