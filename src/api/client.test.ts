import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  exportSession,
  getSession,
  importSession,
  listCampaigns,
  startSession,
  submitCommand,
} from "./client";

const session = {
  id: "s1",
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

  it("submits a command", async () => {
    const result = { passed: true, message: "ok", command: "ls", session };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => result,
    } as Response);
    await expect(submitCommand("s1", "ls", "shared")).resolves.toEqual(result);
  });

  it("throws when the engine rejects a command", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    await expect(submitCommand("s1", "ls", "shared")).rejects.toThrow("Command rejected by engine");
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

  it("throws when get session fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    await expect(getSession("s1")).rejects.toThrow("Could not load session");
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
