import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Campaign, GameSession } from "./api/client";

const listCampaigns = vi.fn();
const startSession = vi.fn();
const submitCommand = vi.fn();
const exportSession = vi.fn();
const getSession = vi.fn();
const importSession = vi.fn();
const addPartyMember = vi.fn();
const reportPresence = vi.fn();
const destroy = vi.fn();
const emit = vi.fn();
const on = vi.fn();
const off = vi.fn();
const createDungeonGame = vi.fn(() => ({
  destroy,
  scene: { getScene: () => ({ events: { emit, on, off } }) },
}));

vi.mock("./api/client", () => ({
  listCampaigns: (...args: unknown[]) => listCampaigns(...args),
  startSession: (...args: unknown[]) => startSession(...args),
  submitCommand: (...args: unknown[]) => submitCommand(...args),
  exportSession: (...args: unknown[]) => exportSession(...args),
  getSession: (...args: unknown[]) => getSession(...args),
  importSession: (...args: unknown[]) => importSession(...args),
  addPartyMember: (...args: unknown[]) => addPartyMember(...args),
  reportPresence: (...args: unknown[]) => reportPresence(...args),
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
  seats: [
    { id: "guardian", title: "Guardian", color: "#3d7a4a" },
    { id: "automancer", title: "Automancer", color: "#c45c26" },
  ],
  rooms: [
    {
      id: "room-01-broken-shell",
      title: "The Broken Shell",
      mapX: 120,
      mapY: 220,
      puzzle_type: "linux",
      narrative: "A shell golem blocks the gate.",
      clues: [
        {
          id: "shell-log",
          label: "plaque",
          text: "/var/log/quest.log",
          x: 280,
          y: 220,
        },
      ],
    },
  ],
};

const session: GameSession = {
  id: "s1",
  joinCode: "thorn-golem",
  campaignId: "devops-dungeon",
  status: "active",
  currentRoomId: "room-01-broken-shell",
  elapsedSeconds: 3,
  partyMembers: [{ name: "Ada", seatId: "guardian" }],
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
    sessionStorage.clear();
    vi.resetAllMocks();
    createDungeonGame.mockReturnValue({
      destroy,
      scene: { getScene: () => ({ events: { emit, on, off } }) },
    });
    listCampaigns.mockResolvedValue([campaign]);
    getSession.mockResolvedValue(session);
    addPartyMember.mockResolvedValue(session);
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
  });

  it("loads the campaign title and starts a run", async () => {
    startSession.mockResolvedValue(session);
    const { default: App } = await import("./App");
    render(<App />);
    expect(
      await screen.findByText("The Cluster That Forgot Its Name"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "start 60-minute run" }),
    );
    expect(
      await screen.findByText(/inventory: rune-thorn/),
    ).toBeInTheDocument();
    expect(startSession).toHaveBeenCalledWith([
      { name: "Ada", seatId: "guardian" },
    ]);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("party code thorn-golem")).toBeInTheDocument();
  });

  it("joins an existing party by share code", async () => {
    const { default: App } = await import("./App");
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Join code"), {
      target: { value: "THORN-GOLEM" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Alias")).toHaveValue("Briar"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(
      await screen.findByText(/inventory: rune-thorn/),
    ).toBeInTheDocument();
    expect(getSession).toHaveBeenCalledWith("THORN-GOLEM");
    expect(addPartyMember).toHaveBeenCalledWith("s1", {
      name: "Briar",
      seatId: "guardian",
    });
    expect(screen.getByText("party code thorn-golem")).toBeInTheDocument();
  });

  it("shows the live join code when Start is refused", async () => {
    startSession.mockRejectedValue(
      Object.assign(
        new Error("A party is already running. Join with thorn-golem."),
        {
          joinCode: "thorn-golem",
        },
      ),
    );
    const { default: App } = await import("./App");
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "start 60-minute run" }),
    );
    expect(
      await screen.findByText(
        "A party is already running. Join with thorn-golem.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Join code")).toHaveValue("thorn-golem");
  });

  it("shows a Game Master offline chip when the engine reports YAML fallback", async () => {
    startSession.mockResolvedValue({ ...session, yamlFallback: true });
    const { default: App } = await import("./App");
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "start 60-minute run" }),
    );
    expect(
      await screen.findByRole("status", {
        name: "YAML fallback — Game Master unreachable",
      }),
    ).toBeInTheDocument();
  });

  it("shows a banner when campaigns fail to load", async () => {
    listCampaigns.mockRejectedValue(new Error("Could not load campaigns"));
    const { default: App } = await import("./App");
    render(<App />);
    expect(
      await screen.findByText("Could not load campaigns"),
    ).toBeInTheDocument();
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
    fireEvent.click(
      await screen.findByRole("button", { name: "start 60-minute run" }),
    );
    await screen.findByText(/inventory: rune-thorn/);
    fireEvent.change(screen.getByLabelText("Command"), {
      target: { value: "grep rune" },
    });
    fireEvent.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() =>
      expect(submitCommand).toHaveBeenCalledWith(
        "s1",
        "grep rune",
        "guardian",
        "Ada",
      ),
    );
    expect(await screen.findByText(/rune-ash/)).toBeInTheDocument();
    expect(emit).toHaveBeenCalledWith(
      "board",
      expect.objectContaining({
        inventory: ["rune-thorn", "rune-ash"],
        missed: false,
      }),
    );
  });

  it("marks the current room as missed after a failed command", async () => {
    startSession.mockResolvedValue(session);
    submitCommand.mockResolvedValue({
      passed: false,
      message: "nope",
      command: "cat",
      session,
    });
    const { default: App } = await import("./App");
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "start 60-minute run" }),
    );
    await screen.findByText(/inventory: rune-thorn/);
    fireEvent.change(screen.getByLabelText("Command"), {
      target: { value: "cat" },
    });
    fireEvent.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() =>
      expect(emit).toHaveBeenCalledWith(
        "board",
        expect.objectContaining({ missed: true, inventory: ["rune-thorn"] }),
      ),
    );
  });

  it("exports yaml through a download link", async () => {
    startSession.mockResolvedValue(session);
    exportSession.mockResolvedValue("id: s1\n");
    const { default: App } = await import("./App");
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "start 60-minute run" }),
    );
    await screen.findByText(/inventory: rune-thorn/);
    const click = vi.fn();
    const realCreate = document.createElement.bind(document);
    const spy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag: string) => {
        if (tag === "a") {
          return {
            click,
            href: "",
            download: "",
          } as unknown as HTMLAnchorElement;
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
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["id: s1\n"], "run.yaml", {
      type: "application/yaml",
    });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(importSession).toHaveBeenCalled());
    expect(
      await screen.findByText(/inventory: rune-thorn/),
    ).toBeInTheDocument();
  });

  it("starts with the picked character and typed alias", async () => {
    startSession.mockResolvedValue({
      ...session,
      partyMembers: [{ name: "Forge", seatId: "automancer" }],
    });
    const { default: App } = await import("./App");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Automancer" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Alias")).toHaveValue("Linus"),
    );
    fireEvent.change(screen.getByLabelText("Alias"), {
      target: { value: "Forge" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "start 60-minute run" }),
    );
    expect(
      await screen.findByText(/inventory: rune-thorn/),
    ).toBeInTheDocument();
    expect(startSession).toHaveBeenCalledWith([
      { name: "Forge", seatId: "automancer" },
    ]);
  });

  it("copies the live join code", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    startSession.mockResolvedValue(session);
    const { default: App } = await import("./App");
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "start 60-minute run" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Copy code" }));
    expect(writeText).toHaveBeenCalledWith("thorn-golem");
  });

  it("shows who is inside a named room on the roster and board", async () => {
    startSession.mockResolvedValue({
      ...session,
      partyMembers: [
        {
          name: "Ada",
          seatId: "guardian",
          mapX: 120,
          mapY: 276,
          viewedRoomId: "",
        },
        {
          name: "Linus",
          seatId: "automancer",
          mapX: 450,
          mapY: 360,
          viewedRoomId: "room-01-broken-shell",
        },
      ],
    });
    const { default: App } = await import("./App");
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "start 60-minute run" }),
    );
    expect(
      await screen.findByText(/Linus · Automancer · in The Broken Shell/),
    ).toBeInTheDocument();
    expect(emit).toHaveBeenCalledWith(
      "board",
      expect.objectContaining({
        members: expect.arrayContaining([
          expect.objectContaining({
            name: "Linus",
            viewedRoomId: "room-01-broken-shell",
          }),
        ]),
      }),
    );
  });
});
