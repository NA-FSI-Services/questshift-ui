import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameSession } from "../api/client";
import { TerminalPanel } from "./TerminalPanel";

const session: GameSession = {
  id: "s1",
  campaignId: "devops-dungeon",
  status: "active",
  currentRoomId: "room-01-broken-shell",
  elapsedSeconds: 125,
  partyMembers: [],
  inventory: ["rune-thorn"],
  skills: [],
  puzzleCompletion: {},
  lastNarrative: "Torchlight.",
  lastHint: "pipe the log",
};

describe("TerminalPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("disables send until a session exists", () => {
    render(
      <TerminalPanel
        session={null}
        busy={false}
        onCommand={vi.fn()}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "send" })).toBeDisabled();
    expect(screen.getByText("--")).toBeInTheDocument();
  });

  it("shows the clock, GM beat, and hint", () => {
    render(
      <TerminalPanel
        session={session}
        busy={false}
        onCommand={vi.fn()}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    expect(screen.getByText("2m 5s")).toBeInTheDocument();
    expect(screen.getByText(/Torchlight/)).toBeInTheDocument();
    expect(screen.getByText(/pipe the log/)).toBeInTheDocument();
    expect(screen.queryByText(/Game Master unreachable/)).not.toBeInTheDocument();
  });

  it("marks YAML fallback next to the clock", () => {
    render(
      <TerminalPanel
        session={{ ...session, yamlFallback: true }}
        busy={false}
        onCommand={vi.fn()}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    expect(screen.getByText("YAML fallback — Game Master unreachable")).toBeInTheDocument();
    expect(screen.getByText("2m 5s")).toBeInTheDocument();
  });

  it("submits a trimmed command", async () => {
    const onCommand = vi.fn().mockResolvedValue(undefined);
    render(
      <TerminalPanel
        session={session}
        busy={false}
        onCommand={onCommand}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Command"), { target: { value: "  grep rune  " } });
    fireEvent.submit(screen.getByLabelText("Command").closest("form")!);
    await waitFor(() => expect(onCommand).toHaveBeenCalledWith("grep rune"));
  });

  it("sends on Enter without shift", async () => {
    const onCommand = vi.fn().mockResolvedValue(undefined);
    render(
      <TerminalPanel
        session={session}
        busy={false}
        onCommand={onCommand}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    const box = screen.getByLabelText("Command");
    fireEvent.change(box, { target: { value: "oc get pods" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: false });
    await waitFor(() => expect(onCommand).toHaveBeenCalledWith("oc get pods"));
  });

  it("ignores empty submits", async () => {
    const onCommand = vi.fn();
    render(
      <TerminalPanel
        session={session}
        busy={false}
        onCommand={onCommand}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    fireEvent.submit(screen.getByLabelText("Command").closest("form")!);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("imports a picked yaml file", async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(
      <TerminalPanel
        session={session}
        busy={false}
        onCommand={vi.fn()}
        onExport={vi.fn()}
        onImport={onImport}
      />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["id: restored\n"], "run.yaml", { type: "application/yaml" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onImport).toHaveBeenCalledWith("id: restored\n"));
    expect(screen.getByText(/restored run.yaml/)).toBeInTheDocument();
  });
});
