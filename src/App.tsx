import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  addPartyMember,
  exportSession,
  getSession,
  importSession,
  listCampaigns,
  reportPresence,
  startSession,
  submitCommand,
  type Campaign,
  type GameSession,
  type PartyMember,
} from "./api/client";
import { createDungeonGame, DungeonScene, type PresencePayload } from "./game/DungeonScene";
import { isSeatId, suggestAlias } from "./party";
import { TerminalPanel } from "./terminal/TerminalPanel";
import "./App.css";

const ME_KEY = "questshift-me";

type Pending = "start" | "join" | "command" | "import" | null;

type StoredMe = { sessionId: string; name: string; seatId: string };

function BusyMark() {
  return <span className="spinner" aria-hidden="true" />;
}

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
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinDraft, setJoinDraft] = useState("");
  const [seatId, setSeatId] = useState("guardian");
  const [alias, setAlias] = useState(() => suggestAlias("guardian", []));
  const [aliasTouched, setAliasTouched] = useState(false);
  const [takenAliases, setTakenAliases] = useState<string[]>([]);
  const [pose, setPose] = useState<{
    mapX: number;
    mapY: number;
    viewedRoomId: string;
  } | null>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const meRef = useRef<PartyMember | null>(null);

  useEffect(() => {
    sessionRef.current = session;
    meRef.current = me;
  }, [session, me]);

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
    const scene = gameRef.current.scene.getScene("dungeon") as DungeonScene | null;
    const onPresence = (payload: PresencePayload) => {
      setPose({
        mapX: payload.mapX,
        mapY: payload.mapY,
        viewedRoomId: payload.viewedRoomId,
      });
      const live = sessionRef.current;
      const who = meRef.current;
      if (!live || !who) {
        return;
      }
      void reportPresence(live.id, { name: who.name, ...payload })
        .then(setSession)
        .catch(() => undefined);
    };
    scene?.events.on("presence", onPresence);
    return () => {
      scene?.events.off("presence", onPresence);
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
      members: session.partyMembers.map((member) => {
        const self =
          Boolean(me) && member.name.trim().toLowerCase() === (me?.name ?? "").trim().toLowerCase();
        if (self && pose) {
          return {
            name: member.name,
            seatId: member.seatId,
            mapX: pose.mapX,
            mapY: pose.mapY,
            viewedRoomId: pose.viewedRoomId,
          };
        }
        return {
          name: member.name,
          seatId: member.seatId,
          mapX: member.mapX ?? 0,
          mapY: member.mapY ?? 0,
          viewedRoomId: member.viewedRoomId ?? "",
        };
      }),
      meName: me?.name ?? "",
      inventory: session.inventory,
      missed,
      foundClues: session.foundClues ?? [],
      clues: (campaign?.rooms ?? []).flatMap((room) =>
        (room.clues ?? []).map((clue) => ({
          id: clue.id,
          x: clue.x,
          y: clue.y,
          roomId: room.id,
        })),
      ),
    });
  }, [session, campaign, missed, me, pose]);

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
    setPose(null);
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
    setPending("start");
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
      setPending(null);
    }
  }

  async function join(event: FormEvent) {
    event.preventDefault();
    const code = joinDraft.trim();
    const member: PartyMember = { name: alias.trim(), seatId };
    if (!code || !member.name || !isSeatId(member.seatId)) {
      return;
    }
    setPending("join");
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
      setPending(null);
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
    setPending("command");
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
      setPending(null);
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
    setPending("import");
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
      setPending(null);
    }
  }

  const busy = pending !== null;
  const waitMessage =
    pending === "start"
      ? "Starting the hour — waiting on the Game Master…"
      : pending === "join"
        ? "Joining party…"
        : pending === "command"
          ? "The Game Master is answering…"
          : pending === "import"
            ? "Restoring session…"
            : null;
  const startLabel =
    pending === "start" ? "starting…" : session ? "new party" : "start 60-minute run";

  const liveMe = session?.partyMembers.find(
    (member) => member.name.trim().toLowerCase() === (me?.name ?? "").trim().toLowerCase(),
  );
  const viewedRoomId = pose?.viewedRoomId || liveMe?.viewedRoomId || "";
  const viewedRoom = campaign?.rooms.find((room) => room.id === viewedRoomId);
  const foundClueRows = (viewedRoom?.clues ?? []).filter((clue) =>
    (session?.foundClues ?? []).includes(clue.id),
  );

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
              <button
                type="submit"
                disabled={busy || !joinDraft.trim() || !alias.trim()}
                aria-busy={pending === "join"}
              >
                {pending === "join" ? (
                  <>
                    <BusyMark />
                    joining…
                  </>
                ) : (
                  "Join"
                )}
              </button>
            </form>
          </>
        )}
        <button
          type="button"
          onClick={() => void begin()}
          disabled={busy || !alias.trim()}
          aria-busy={pending === "start"}
        >
          {pending === "start" ? <BusyMark /> : null}
          {startLabel}
        </button>
        {waitMessage ? (
          <p className="busy-status" role="status">
            <BusyMark />
            {waitMessage}
          </p>
        ) : null}
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
          <div
            ref={hostRef}
            className="phaser-host"
            tabIndex={0}
            onPointerDown={(event) => event.currentTarget.querySelector("canvas")?.focus()}
          />
          <p className="map-help">
            Click the map, then WASD or arrows to walk. E or Enter enters a room or picks a clue.
            Esc leaves the room.
          </p>
          <ul className="seats">
            {(session?.partyMembers?.length ? session.partyMembers : []).map((member) => {
              const seat = campaign?.seats.find((item) => item.id === member.seatId);
              const inside = (member.viewedRoomId ?? "").trim();
              const room = campaign?.rooms.find((item) => item.id === inside);
              return (
                <li key={`${member.seatId}-${member.name}`}>
                  <i style={{ background: seat?.color ?? "#7f9a86" }} />
                  {member.name}
                  {seat ? ` · ${seat.title}` : ""}
                  {room ? ` · in ${room.title}` : ""}
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
          waitMessage={waitMessage}
          roomTitle={viewedRoom?.title}
          roomNarrative={viewedRoom?.narrative}
          clues={foundClueRows}
          onCommand={onCommand}
          onExport={onExport}
          onImport={onImport}
        />
      </main>
    </div>
  );
}
