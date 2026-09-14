import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Campaign, GameSession } from "./api/client";

const listCampaigns = vi.fn();
const startSession = vi.fn();
const submitCommand = vi.fn();
const exportSession = vi.fn();
const getSession = vi.fn();
const importSession = vi.fn();
const destroy = vi.fn();
const emit = vi.fn();
const createDungeonGame = vi.fn(() => ({
  destroy,
  scene: { getScene: () => ({ events: { emit } }) },
}));

vi.mock("./api/client", () => ({
  listCampaigns: (...args: unknown[]) => listCampaigns(...args),
  startSession: (...args: unknown[]) => startSession(...args),
  submitCommand: (...args: unknown[]) => submitCommand(...args),
  exportSession: (...args: unknown[]) => exportSession(...args),
  getSession: (...args: unknown[]) => getSession(...args),
  importSession: (...args: unknown[]) => importSession(...args),
}));

vi.mock("./game/DungeonScene", () => ({
  createDungeonGame: (...args: unknown[]) => createDungeonGame(...args),
  DungeonScene: class {},
}));

const campaign: Campaign = {
  metadata: {
    id: "devops-dungeon",
    title: "The Cluster That Forgot Its Name",
    durationMinutes: 60,
  },
  seats: [{ id: "guardian", title: "Guardian", color: "#3d7a4a" }],
  rooms: [
    {
      id: "room-01-broken-shell",
      title: "The Broken Shell",
      mapX: 120,
      mapY: 220,
      puzzle_type: "linux",
    },
  ],
};

const session: GameSession = {
  id: "s1",
  campaignId: "devops-dungeon",
  status: "active",
  currentRoomId: "room-01-broken-shell",
  elapsedSeconds: 3,
  partyMembers: [],
  inventory: ["rune-thorn"],
  skills: [],
  puzzleCompletion: { "room-01-broken-shell": false },
  lastNarrative: "Torchlight.",
  lastHint: "pipe",
  lastCanvasEvent: "focus_room",
};

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    createDungeonGame.mockReturnValue({
      destroy,
      scene: { getScene: () => ({ events: { emit } }) },
    });
    listCampaigns.mockResolvedValue([campaign]);
    getSession.mockResolvedValue(session);
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
  });

  it("loads the campaign title and starts a run", async () => {
    startSession.mockResolvedValue(session);
    const { default: App } = await import("./App");
    render(<App />);
    expect(await screen.findByText("The Cluster That Forgot Its Name")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "start 60-minute run" }));
    expect(await screen.findByText(/inventory: rune-thorn/)).toBeInTheDocument();
    expect(startSession).toHaveBeenCalled();
  });

  it("shows a banner when campaigns fail to load", async () => {
    listCampaigns.mockRejectedValue(new Error("Could not load campaigns"));
    const { default: App } = await import("./App");
    render(<App />);
    expect(await screen.findByText("Could not load campaigns")).toBeInTheDocument();
  });

  it("submits a terminal command to the engine", async () => {
    startSession.mockResolvedValue(session);
    submitCommand.mockResolvedValue({
      passed: true,
      message: "ok",
      command: "grep",
      session: { ...session, inventory: ["rune-thorn", "rune-ash"] },
    });
    const { default: App } = await import("./App");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "start 60-minute run" }));
    await screen.findByText(/inventory: rune-thorn/);
    fireEvent.change(screen.getByLabelText("Command"), { target: { value: "grep rune" } });
    fireEvent.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() => expect(submitCommand).toHaveBeenCalledWith("s1", "grep rune", "shared"));
    expect(await screen.findByText(/rune-ash/)).toBeInTheDocument();
  });

  it("exports yaml through a download link", async () => {
    startSession.mockResolvedValue(session);
    exportSession.mockResolvedValue("id: s1\n");
    const { default: App } = await import("./App");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "start 60-minute run" }));
    await screen.findByText(/inventory: rune-thorn/);
    const click = vi.fn();
    const realCreate = document.createElement.bind(document);
    const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        return { click, href: "", download: "" } as unknown as HTMLAnchorElement;
      }
      return realCreate(tag);
    });
    fireEvent.click(screen.getByRole("button", { name: "export.yaml" }));
    await waitFor(() => expect(exportSession).toHaveBeenCalledWith("s1"));
    expect(click).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("restores a session from import.yaml", async () => {
    importSession.mockResolvedValue(session);
    const { default: App } = await import("./App");
    render(<App />);
    await screen.findByText("The Cluster That Forgot Its Name");
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["id: s1\n"], "run.yaml", { type: "application/yaml" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(importSession).toHaveBeenCalled());
    expect(await screen.findByText(/inventory: rune-thorn/)).toBeInTheDocument();
  });
});
