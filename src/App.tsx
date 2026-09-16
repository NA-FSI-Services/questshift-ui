import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  addPartyMember,
  exportSession,
  getSession,
  importSession,
  listCampaigns,
  startSession,
  submitCommand,
  type Campaign,
  type GameSession,
  type PartyMember,
} from "./api/client";
import { createDungeonGame, DungeonScene } from "./game/DungeonScene";
import { isSeatId, suggestAlias } from "./party";
import { TerminalPanel } from "./terminal/TerminalPanel";
import "./App.css";

const ME_KEY = "questshift-me";

type StoredMe = { sessionId: string; name: string; seatId: string };

function readStoredMe(): StoredMe | null {
  try {
    const raw = sessionStorage.getItem(ME_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredMe;
    if (!parsed.sessionId || !parsed.name || !isSeatId(parsed.seatId)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredMe(sessionId: string, member: PartyMember) {
  sessionStorage.setItem(
    ME_KEY,
    JSON.stringify({ sessionId, name: member.name, seatId: member.seatId }),
  );
}

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<ReturnType<typeof createDungeonGame> | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [me, setMe] = useState<PartyMember | null>(null);
  const [missed, setMissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinDraft, setJoinDraft] = useState("");
  const [seatId, setSeatId] = useState("guardian");
  const [alias, setAlias] = useState(() => suggestAlias("guardian", []));
  const [aliasTouched, setAliasTouched] = useState(false);
  const [takenAliases, setTakenAliases] = useState<string[]>([]);

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
    const stored = readStoredMe();
    if (!stored) {
      return;
    }
    void getSession(stored.sessionId)
      .then((live) => {
        const member = live.partyMembers.find(
          (item) => item.name.trim().toLowerCase() === stored.name.trim().toLowerCase(),
        );
        if (!member) {
          return;
        }
        setSession(live);
        setMe(member);
      })
      .catch(() => undefined);
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
      inventory: session.inventory,
      missed,
    });
  }, [session, campaign, missed]);

  useEffect(() => {
    if (!session?.id) {
      return;
    }
    const timer = window.setInterval(() => {
      void getSession(session.id)
        .then(setSession)
        .catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session?.id]);

  useEffect(() => {
    const code = joinDraft.trim();
    if (!code.includes("-") || session) {
      setTakenAliases([]);
      return;
    }
    let cancelled = false;
    void getSession(code)
      .then((live) => {
        if (!cancelled) {
          setTakenAliases(live.partyMembers.map((member) => member.name));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTakenAliases([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [joinDraft, session]);

  useEffect(() => {
    if (aliasTouched) {
      return;
    }
    setAlias(suggestAlias(seatId, takenAliases));
  }, [seatId, takenAliases, aliasTouched]);

  function claim(live: GameSession, member: PartyMember) {
    setSession(live);
    setMe(member);
    writeStoredMe(live.id, member);
  }

  async function begin() {
    const member: PartyMember = { name: alias.trim(), seatId };
    if (!member.name || !isSeatId(member.seatId)) {
      setError("Pick a character and a unique alias.");
      return;
    }
    setBusy(true);
    setError(null);
    setMissed(false);
    try {
      claim(await startSession([member]), member);
    } catch (err) {
      setError(err instanceof Error ? err.message : "start failed");
      if (err && typeof err === "object" && "joinCode" in err) {
        const code = (err as { joinCode?: string }).joinCode;
        if (code) {
          setJoinDraft(code);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function join(event: FormEvent) {
    event.preventDefault();
    const code = joinDraft.trim();
    const member: PartyMember = { name: alias.trim(), seatId };
    if (!code || !member.name || !isSeatId(member.seatId)) {
      return;
    }
    setBusy(true);
    setError(null);
    setMissed(false);
    try {
      const live = await getSession(code);
      const joined = await addPartyMember(live.id, member);
      const mine =
        joined.partyMembers.find(
          (item) => item.name.trim().toLowerCase() === member.name.toLowerCase(),
        ) ?? member;
      claim(joined, mine);
    } catch (err) {
      setError(err instanceof Error ? err.message : "join failed");
    } finally {
      setBusy(false);
    }
  }

  function copyJoinCode() {
    if (!session?.joinCode || !navigator.clipboard) {
      return;
    }
    void navigator.clipboard.writeText(session.joinCode);
  }

  async function onCommand(command: string) {
    if (!session) {
      return;
    }
    setBusy(true);
    try {
      const result = await submitCommand(
        session.id,
        command,
        me?.seatId ?? "shared",
        me?.name ?? "",
      );
      if (result.session.currentRoomId !== session.currentRoomId) {
        setMissed(false);
      } else {
        setMissed(!result.passed);
      }
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

  async function onImport(body: string) {
    setBusy(true);
    setError(null);
    setMissed(false);
    try {
      const live = await importSession(body);
      setSession(live);
      const stored = readStoredMe();
      const mine =
        live.partyMembers.find(
          (item) => stored && item.name.trim().toLowerCase() === stored.name.trim().toLowerCase(),
        ) ?? live.partyMembers[0];
      if (mine) {
        setMe(mine);
        writeStoredMe(live.id, mine);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <h1>QuestShift</h1>
        <p>{campaign?.metadata.title ?? "The Cluster That Forgot Its Name"}</p>
        {session?.joinCode ? (
          <p className="party-code">
            <span>party code {session.joinCode}</span>
            <button type="button" onClick={copyJoinCode}>
              Copy code
            </button>
          </p>
        ) : (
          <>
            <div className="party-picker">
              <fieldset className="seat-picker">
                <legend>Character</legend>
                {(campaign?.seats ?? []).map((seat) => (
                  <button
                    key={seat.id}
                    type="button"
                    className={seatId === seat.id ? "seat-pick selected" : "seat-pick"}
                    aria-pressed={seatId === seat.id}
                    disabled={busy}
                    onClick={() => setSeatId(seat.id)}
                  >
                    {seat.title}
                  </button>
                ))}
              </fieldset>
              <label>
                Alias
                <input
                  value={alias}
                  onChange={(event) => {
                    setAliasTouched(true);
                    setAlias(event.target.value);
                  }}
                  autoComplete="off"
                  disabled={busy}
                />
              </label>
            </div>
            <form className="join-form" onSubmit={(event) => void join(event)}>
              <label>
                Join code
                <input
                  value={joinDraft}
                  onChange={(event) => setJoinDraft(event.target.value)}
                  placeholder="thorn-golem"
                  autoComplete="off"
                  disabled={busy}
                />
              </label>
              <button type="submit" disabled={busy || !joinDraft.trim() || !alias.trim()}>
                Join
              </button>
            </form>
          </>
        )}
        <button type="button" onClick={() => void begin()} disabled={busy || !alias.trim()}>
          {session ? "new party" : "start 60-minute run"}
        </button>
        {session?.yamlFallback ? (
          <p
            className="gm-offline"
            role="status"
            aria-label="YAML fallback — Game Master unreachable"
          >
            YAML fallback — Game Master unreachable
          </p>
        ) : null}
      </header>
      {error ? <p className="banner">{error}</p> : null}
      <main className="dual">
        <section className="canvas-panel" aria-label="Game canvas">
          <div ref={hostRef} className="phaser-host" />
          <ul className="seats">
            {(session?.partyMembers?.length ? session.partyMembers : []).map((member) => {
              const seat = campaign?.seats.find((item) => item.id === member.seatId);
              return (
                <li key={`${member.seatId}-${member.name}`}>
                  <i style={{ background: seat?.color ?? "#7f9a86" }} />
                  {member.name}
                  {seat ? ` · ${seat.title}` : ""}
                </li>
              );
            })}
            {!session
              ? (campaign?.seats ?? []).map((seat) => (
                  <li key={seat.id}>
                    <i style={{ background: seat.color }} />
                    {seat.title}
                  </li>
                ))
              : null}
          </ul>
          {session ? (
            <p className="loot">inventory: {session.inventory.join(", ") || "empty"}</p>
          ) : null}
        </section>
        <TerminalPanel
          session={session}
          busy={busy}
          onCommand={onCommand}
          onExport={onExport}
          onImport={onImport}
        />
      </main>
    </div>
  );
}
