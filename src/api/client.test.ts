import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addPartyMember,
  reportPresence,
  exportSession,
  getSession,
  importSession,
  listCampaigns,
  reportPresence,
  startSession,
  submitCommand,
} from "./client";

const session = {
  id: "s1",
  joinCode: "thorn-golem",
  campaignId: "devops-dungeon",
  status: "active",
  currentRoomId: "room-01-broken-shell",
  elapsedSeconds: 12,
  partyMembers: [],
  inventory: [],
  skills: [],
  puzzleCompletion: {},
};

describe("engine client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists campaigns", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [{ metadata: { id: "devops-dungeon" } }],
    } as Response);
    await expect(listCampaigns()).resolves.toEqual([{ metadata: { id: "devops-dungeon" } }]);
  });

  it("throws when campaigns fail", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    await expect(listCampaigns()).rejects.toThrow("Could not load campaigns");
  });

  it("starts a session for devops-dungeon", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => session,
    } as Response);
    const party = [{ name: "Ada", seatId: "guardian" }];
    await expect(startSession(party)).resolves.toEqual(session);
    expect(fetch).toHaveBeenCalledWith("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: "devops-dungeon", party }),
    });
  });

  it("throws when start fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    await expect(startSession([])).rejects.toThrow("Could not start session");
  });

  it("surfaces a 409 join code when a party is already running", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: "party_active",
        message: "A party is already running. Join with thorn-golem.",
        joinCode: "thorn-golem",
      }),
    } as Response);
    await expect(startSession([])).rejects.toMatchObject({
      message: "A party is already running. Join with thorn-golem.",
      joinCode: "thorn-golem",
    });
  });

  it("submits a command", async () => {
    const result = { passed: true, message: "ok", command: "ls", session };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => result,
    } as Response);
    await expect(submitCommand("s1", "ls", "shared", "Ada")).resolves.toEqual(result);
    expect(fetch).toHaveBeenCalledWith("/api/sessions/s1/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "ls", seatId: "shared", name: "Ada" }),
    });
  });

  it("throws when the engine rejects a command", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    await expect(submitCommand("s1", "ls", "shared", "Ada")).rejects.toThrow(
      "Command rejected by engine",
    );
  });

  it("exports yaml", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => "id: s1\n",
    } as Response);
    await expect(exportSession("s1")).resolves.toBe("id: s1\n");
  });

  it("throws when export fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    await expect(exportSession("s1")).rejects.toThrow("Export failed");
  });

  it("loads a session snapshot", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => session,
    } as Response);
    await expect(getSession("s1")).resolves.toEqual(session);
  });

  it("adds a party member", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => session,
    } as Response);
    const member = { name: "Linus", seatId: "automancer" };
    await expect(addPartyMember("s1", member)).resolves.toEqual(session);
    expect(fetch).toHaveBeenCalledWith("/api/sessions/s1/party", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(member),
    });
  });

  it("reports presence and clue pickup", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => session,
    } as Response);
    const body = {
      name: "Ada",
      mapX: 450,
      mapY: 360,
      viewedRoomId: "room-01-broken-shell",
      pickupClueId: "shell-log",
    };
    await expect(reportPresence("s1", body)).resolves.toEqual(session);
    expect(fetch).toHaveBeenCalledWith("/api/sessions/s1/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  });

  it("throws when presence fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    await expect(
      reportPresence("s1", { name: "Ada", mapX: 1, mapY: 1, viewedRoomId: "" }),
    ).rejects.toThrow("Could not update presence");
  });

  it("throws when get session fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    await expect(getSession("s1")).rejects.toThrow("Could not load session");
  });

  it("maps a missing session to an unknown join code", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404 } as Response);
    await expect(getSession("nope")).rejects.toThrow("Unknown join code");
  });

  it("imports json when the body starts with a brace", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => session,
    } as Response);
    await importSession('  {"id":"s1"}');
    expect(fetch).toHaveBeenCalledWith("/api/sessions/import?format=json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '  {"id":"s1"}',
    });
  });

  it("imports yaml otherwise", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => session,
    } as Response);
    await importSession("id: s1\n");
    expect(fetch).toHaveBeenCalledWith("/api/sessions/import?format=yaml", {
      method: "POST",
      headers: { "Content-Type": "application/yaml" },
      body: "id: s1\n",
    });
  });

  it("throws when import fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    await expect(importSession("id: s1\n")).rejects.toThrow("Import failed");
  });
});
