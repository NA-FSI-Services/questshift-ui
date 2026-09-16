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

  it("prints a wait line while a request is in flight", () => {
    render(
      <TerminalPanel
        session={null}
        busy
        waitMessage="Starting the hour — waiting on the Game Master…"
        onCommand={vi.fn()}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    expect(
      screen.getByText("# Starting the hour — waiting on the Game Master…"),
    ).toBeInTheDocument();
    expect(screen.getByText("# QuestShift terminal.")).toBeInTheDocument();
    expect(screen.queryByText(/Seats are cosmetic/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Anyone may solve/)).not.toBeInTheDocument();
  });

  it("shows only GM narrative, not puzzle JSON", () => {
    render(
      <TerminalPanel
        session={{
          ...session,
          lastNarrative: `{
  "narrative": "A shell golem blocks the gate.",
  "puzzle_type": "linux",
  "expected_command_pattern": "(?s).*awk.*\\$NF.*",
  "hint": "Use grep.",
  "canvas_event": "focus_room"
}`,
        }}
        busy={false}
        onCommand={vi.fn()}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    expect(screen.getByText(/GM> A shell golem blocks the gate/)).toBeInTheDocument();
    expect(screen.queryByText(/expected_command_pattern/)).not.toBeInTheDocument();
    expect(screen.queryByText(/puzzle_type/)).not.toBeInTheDocument();
    expect(screen.queryByText(/canvas_event/)).not.toBeInTheDocument();
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

  it("shows another player's command on the shared room board", () => {
    render(
      <TerminalPanel
        session={{
          ...session,
          commandLog: [
            {
              roomId: "room-01-broken-shell",
              name: "Linus",
              seatId: "automancer",
              command: "cat /var/log/quest.log",
              passed: false,
            },
            {
              roomId: "room-01-broken-shell",
              name: "Ada",
              seatId: "guardian",
              command: "grep -i rune /var/log/quest.log | awk '{print $NF}'",
              passed: true,
            },
            {
              roomId: "room-02-playbook-of-binding",
              name: "Moss",
              seatId: "ranger",
              command: "hosts: dungeon",
              passed: true,
            },
          ],
        }}
        busy={false}
        onCommand={vi.fn()}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    expect(screen.getByText(/Linus · automancer/)).toBeInTheDocument();
    expect(screen.getByText(/cat \/var\/log\/quest\.log/)).toBeInTheDocument();
    expect(screen.getByText(/failed/)).toBeInTheDocument();
    expect(screen.getByText(/Ada · guardian/)).toBeInTheDocument();
    expect(screen.getByText(/accepted/)).toBeInTheDocument();
    expect(screen.queryByText(/Moss · ranger/)).not.toBeInTheDocument();
  });

  it("shows the room description and collected clues", () => {
    render(
      <TerminalPanel
        session={session}
        busy={false}
        roomTitle="The Broken Shell"
        roomNarrative="A shell golem blocks the gate."
        clues={[{ id: "shell-log", label: "scratched plaque", text: "/var/log/quest.log" }]}
        onCommand={vi.fn()}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    expect(screen.getByText(/inside The Broken Shell/)).toBeInTheDocument();
    expect(screen.getByText(/A shell golem blocks the gate/)).toBeInTheDocument();
    expect(screen.getByText(/scratched plaque/)).toBeInTheDocument();
    expect(screen.getByText(/\/var\/log\/quest\.log/)).toBeInTheDocument();
  });
});
