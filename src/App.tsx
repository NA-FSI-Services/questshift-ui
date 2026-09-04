import { useEffect, useMemo, useRef, useState } from "react";
import {
  exportSession,
  listCampaigns,
  startSession,
  submitCommand,
  type Campaign,
  type GameSession,
  type PartyMember,
} from "./api/client";
import { createDungeonGame, DungeonScene } from "./game/DungeonScene";
import { TerminalPanel } from "./terminal/TerminalPanel";
import "./App.css";

const defaultParty: PartyMember[] = [
  { name: "Ada", seatId: "guardian" },
  { name: "Linus", seatId: "automancer" },
  { name: "Kelsey", seatId: "ranger" },
  { name: "James", seatId: "artificer" },
];

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<ReturnType<typeof createDungeonGame> | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nodes = useMemo(
    () =>
      (campaign?.rooms ?? []).map((room) => ({
        id: room.id,
        title: room.title,
        x: room.mapX,
        y: room.mapY,
        kind: room.puzzle_type,
      })),
    [campaign],
  );

  useEffect(() => {
    listCampaigns()
      .then((all) => setCampaign(all[0] ?? null))
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!hostRef.current || nodes.length === 0) {
      return;
    }
    gameRef.current?.destroy(true);
    gameRef.current = createDungeonGame(hostRef.current, nodes);
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [nodes]);

  useEffect(() => {
    if (!session || !gameRef.current) {
      return;
    }
    const scene = gameRef.current.scene.getScene("dungeon") as DungeonScene | null;
    scene?.events.emit("board", {
      currentRoomId: session.currentRoomId,
      completed: session.puzzleCompletion,
      canvasEvent: session.lastCanvasEvent,
      seats: campaign?.seats ?? [],
    });
  }, [session, campaign]);

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      setSession(await startSession(defaultParty));
    } catch (err) {
      setError(err instanceof Error ? err.message : "start failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCommand(command: string) {
    if (!session) {
      return;
    }
    setBusy(true);
    try {
      const result = await submitCommand(session.id, command, "shared");
      setSession(result.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "command failed");
    } finally {
      setBusy(false);
    }
  }

  async function onExport() {
    if (!session) {
      return;
    }
    const yaml = await exportSession(session.id);
    const blob = new Blob([yaml], { type: "application/yaml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `questshift-${session.id}.yaml`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="shell">
      <header className="topbar">
        <h1>QuestShift</h1>
        <p>{campaign?.metadata.title ?? "The Cluster That Forgot Its Name"}</p>
        <button type="button" onClick={() => void begin()} disabled={busy}>
          {session ? "new party" : "start 60-minute run"}
        </button>
      </header>
      {error ? <p className="banner">{error}</p> : null}
      <main className="dual">
        <section className="canvas-panel" aria-label="Game canvas">
          <div ref={hostRef} className="phaser-host" />
          <ul className="seats">
            {(campaign?.seats ?? []).map((seat) => (
              <li key={seat.id}>
                <i style={{ background: seat.color }} />
                {seat.title}
              </li>
            ))}
          </ul>
          {session ? (
            <p className="loot">inventory: {session.inventory.join(", ") || "empty"}</p>
          ) : null}
        </section>
        <TerminalPanel session={session} busy={busy} onCommand={onCommand} onExport={onExport} />
      </main>
    </div>
  );
}
