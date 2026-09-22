import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  addPartyMember,
  deleteSession,
  exportSession,
  getSession,
  importSession,
  leaveParty,
  listCampaigns,
  reportPresence,
  startSession,
  submitCommand,
  type Campaign,
  type GameSession,
  type PartyMember,
} from "./api/client";
import { createDungeonGame, DungeonScene, type PresencePayload } from "./game/DungeonScene";
import { Lobby } from "./lobby/Lobby";
import { isSeatId, suggestAlias } from "./party";
import { bindPresence } from "./presenceBind";
import { foundCluesFor, layerClues } from "./clueDialog";
import { openSessionSocket } from "./sessionSocket";
import { musicBed } from "./sounds";
import { TerminalPanel } from "./terminal/TerminalPanel";
import "./App.css";

const ME_KEY = "questshift-me";

type Pending = "start" | "join" | "command" | "import" | "leave" | "delete" | null;

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

function MuteControl() {
  const [muted, setMuted] = useState(() => musicBed.isMuted());
  useEffect(() => musicBed.subscribe(() => setMuted(musicBed.isMuted())), []);
  return (
    <button
      type="button"
      className="mute-toggle"
      aria-pressed={muted}
      onClick={() => {
        musicBed.unlock();
        musicBed.setMuted(!muted);
      }}
    >
      {muted ? "Unmute music" : "Mute music"}
    </button>
  );
}

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<ReturnType<typeof createDungeonGame> | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("devops-dungeon");
  const [session, setSession] = useState<GameSession | null>(null);
  const [me, setMe] = useState<PartyMember | null>(null);
  const [missed, setMissed] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinDraft, setJoinDraft] = useState("");
  const [deleteDraft, setDeleteDraft] = useState("");
  const [seatId, setSeatId] = useState("guardian");
  const [alias, setAlias] = useState(() => suggestAlias("guardian", []));
  const [aliasTouched, setAliasTouched] = useState(false);
  const [takenAliases, setTakenAliases] = useState<string[]>([]);
  const [joinCampaignId, setJoinCampaignId] = useState<string | null>(null);
  const [pose, setPose] = useState<{
    mapX: number;
    mapY: number;
    viewedRoomId: string;
  } | null>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const meRef = useRef<PartyMember | null>(null);

  const campaign =
    campaigns.find((item) => item.metadata.id === (session?.campaignId ?? selectedCampaignId)) ??
    campaigns[0] ??
    null;
  const inPlay = Boolean(session);
  const joinLocksQuest = Boolean(joinCampaignId) && !session;

  useEffect(() => {
    sessionRef.current = session;
    meRef.current = me;
  }, [session, me]);

  useEffect(() => {
    const unlock = () => musicBed.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    musicBed.setScene(session ? "dungeon" : "lobby");
  }, [session]);

  const nodes = useMemo(
    () =>
      (campaign?.rooms ?? []).map((room) => ({
        id: room.id,
        title: room.title,
        x: room.mapX,
        y: room.mapY,
        kind: room.puzzle_type,
        order: room.order,
        guardianSprite: room.guardian?.sprite,
      })),
    [campaign],
  );

  useEffect(() => {
    listCampaigns()
      .then((all) => {
        setCampaigns(all);
        setSelectedCampaignId((current) =>
          all.some((item) => item.metadata.id === current)
            ? current
            : (all[0]?.metadata.id ?? current),
        );
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    const stored = readStoredMe();
    if (!stored) {
      return;
    }
    void getSession(stored.sessionId)
      .then((live) => {
        if (live.status !== "active" && live.status !== "complete") {
          sessionStorage.removeItem(ME_KEY);
          return;
        }
        const member = live.partyMembers.find(
          (item) => item.name.trim().toLowerCase() === stored.name.trim().toLowerCase(),
        );
        if (!member) {
          sessionStorage.removeItem(ME_KEY);
          return;
        }
        sessionRef.current = live;
        meRef.current = member;
        setSession(live);
        setMe(member);
        setAlias(member.name);
        setAliasTouched(true);
        setJoinDraft(live.joinCode ?? "");
        setSelectedCampaignId(live.campaignId);
      })
      .catch(() => {
        sessionStorage.removeItem(ME_KEY);
      });
  }, []);

  useEffect(() => {
    if (!session || !hostRef.current || nodes.length === 0) {
      return;
    }
    gameRef.current?.destroy(true);
    const game = createDungeonGame(hostRef.current, nodes);
    gameRef.current = game;
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
    const unbindPresence = bindPresence(game, onPresence);
    return () => {
      unbindPresence();
      game.destroy(true);
      gameRef.current = null;
    };
    // session?.id: do not recreate Phaser on every 1s poll snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- session object identity changes each poll
  }, [session?.id, nodes]);

  useEffect(() => {
    if (!session || !gameRef.current) {
      return;
    }
    const scene = gameRef.current.scene.getScene("dungeon") as DungeonScene | null;
    scene?.events.emit("board", {
      sessionId: session.id,
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
      foundClues: foundCluesFor(session.partyMembers, me?.name ?? ""),
      clues: layerClues(campaign),
    });
  }, [session, campaign, missed, me, pose]);

  useEffect(() => {
    if (!session?.id) {
      return;
    }
    return openSessionSocket(session.id, setSession);
  }, [session?.id]);

  useEffect(() => {
    if (!session?.id) {
      return;
    }
    const timer = window.setInterval(() => {
      void getSession(session.id)
        .then(setSession)
        .catch((err: unknown) => {
          const status =
            err && typeof err === "object" && "status" in err
              ? Number((err as { status?: number }).status)
              : 0;
          if (status === 404) {
            sessionStorage.removeItem(ME_KEY);
            sessionRef.current = null;
            meRef.current = null;
            setSession(null);
            setMe(null);
            setPose(null);
            setMissed(false);
            setDeleteDraft("");
          }
        });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session?.id]);

  useEffect(() => {
    const code = joinDraft.trim();
    if (!code.includes("-")) {
      setTakenAliases([]);
      setJoinCampaignId(null);
      return;
    }
    let cancelled = false;
    void getSession(code)
      .then((live) => {
        if (!cancelled) {
          setTakenAliases(live.partyMembers.map((member) => member.name));
          setJoinCampaignId(live.campaignId);
          setSelectedCampaignId(live.campaignId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTakenAliases([]);
          setJoinCampaignId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [joinDraft]);

  useEffect(() => {
    if (aliasTouched) {
      return;
    }
    setAlias(suggestAlias(seatId, takenAliases));
  }, [seatId, takenAliases, aliasTouched]);

  function dropLocal() {
    sessionStorage.removeItem(ME_KEY);
    sessionRef.current = null;
    meRef.current = null;
    setSession(null);
    setMe(null);
    setPose(null);
    setMissed(false);
    setDeleteDraft("");
    setJoinDraft("");
    setAliasTouched(false);
  }

  function claim(live: GameSession, member: PartyMember) {
    sessionRef.current = live;
    meRef.current = member;
    setPose(null);
    setSession(live);
    setMe(member);
    setAlias(member.name);
    setAliasTouched(true);
    setJoinDraft(live.joinCode ?? "");
    setSelectedCampaignId(live.campaignId);
    writeStoredMe(live.id, member);
  }

  async function leaveCurrent(): Promise<void> {
    const live = sessionRef.current;
    const who = meRef.current;
    if (!live || !who) {
      dropLocal();
      return;
    }
    try {
      await leaveParty(live.id, who.name);
    } catch {
      // Already gone or expired lookup failed.
    }
    dropLocal();
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
      await leaveCurrent();
      claim(await startSession([member], selectedCampaignId), member);
    } catch (err) {
      setError(err instanceof Error ? err.message : "start failed");
    } finally {
      setPending(null);
    }
  }

  async function join(event: FormEvent) {
    event.preventDefault();
    const code = joinDraft.trim();
    const member: PartyMember = { name: alias.trim(), seatId };
    if (!code || !member.name || !isSeatId(member.seatId)) {
      setError("Pick a character and a unique alias.");
      return;
    }
    setPending("join");
    setError(null);
    setMissed(false);
    try {
      const live = await getSession(code);
      const current = sessionRef.current;
      if (current && current.id !== live.id) {
        await leaveCurrent();
      }
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

  async function returnToLobby() {
    setPending("leave");
    setError(null);
    try {
      await leaveCurrent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "leave failed");
    } finally {
      setPending(null);
    }
  }

  async function destroyParty() {
    const live = sessionRef.current;
    const code = live?.joinCode ?? "";
    if (!live || deleteDraft.trim().toLowerCase() !== code.toLowerCase()) {
      setError("Type the join code to delete this party.");
      return;
    }
    setPending("delete");
    setError(null);
    try {
      await deleteSession(live.id);
      dropLocal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "delete failed");
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
            : pending === "leave"
              ? "Leaving party…"
              : pending === "delete"
                ? "Deleting party…"
                : null;

  const liveMe = session?.partyMembers.find(
    (member) => member.name.trim().toLowerCase() === (me?.name ?? "").trim().toLowerCase(),
  );
  const viewedRoomId = pose?.viewedRoomId || liveMe?.viewedRoomId || "";
  const viewedRoom = campaign?.rooms.find((room) => room.id === viewedRoomId);
  const lobbyCopy = viewedRoom
    ? undefined
    : (campaign?.story?.opening ?? campaign?.story?.premise ?? "").trim() || undefined;

  return (
    <div className="shell">
      <header className="topbar">
        <h1>QuestShift</h1>
        {inPlay ? (
          <p className="campaign-title">
            {campaign?.metadata.title ?? "The Cluster That Forgot Its Name"}
          </p>
        ) : (
          <p className="campaign-title">Quest lobby</p>
        )}
        {session ? (
          <details className="party-menu">
            <summary>Party {session.joinCode ?? ""}</summary>
            <div className="party-menu-body">
              {session.joinCode ? (
                <p className="party-code">
                  <span>party code {session.joinCode}</span>
                  <button type="button" onClick={copyJoinCode}>
                    Copy code
                  </button>
                </p>
              ) : null}
              <div className="party-menu-actions">
                <button type="button" onClick={() => void returnToLobby()} disabled={busy}>
                  Switch party
                </button>
                <button
                  type="button"
                  onClick={() => void returnToLobby()}
                  disabled={busy}
                  aria-busy={pending === "leave"}
                >
                  {pending === "leave" ? <BusyMark /> : null}
                  new party
                </button>
                <button
                  type="button"
                  onClick={() => void returnToLobby()}
                  disabled={busy}
                  aria-busy={pending === "leave"}
                >
                  {pending === "leave" ? <BusyMark /> : null}
                  Abandon party
                </button>
              </div>
              {session.joinCode ? (
                <details className="danger-zone">
                  <summary>Delete party</summary>
                  <p>This ends the hour for everyone on {session.joinCode}.</p>
                  <label>
                    Type {session.joinCode} to confirm
                    <input
                      value={deleteDraft}
                      onChange={(event) => setDeleteDraft(event.target.value)}
                      autoComplete="off"
                      disabled={busy}
                    />
                  </label>
                  <button
                    type="button"
                    className="danger"
                    disabled={
                      busy || deleteDraft.trim().toLowerCase() !== session.joinCode.toLowerCase()
                    }
                    aria-busy={pending === "delete"}
                    onClick={() => void destroyParty()}
                  >
                    {pending === "delete" ? <BusyMark /> : null}
                    Delete this party
                  </button>
                </details>
              ) : null}
            </div>
          </details>
        ) : null}
        <MuteControl />
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
      {inPlay ? (
        <main className="dual">
          <section className="canvas-panel" aria-label="Game canvas">
            <div
              ref={hostRef}
              className="phaser-host"
              tabIndex={0}
              onPointerDown={(event) => event.currentTarget.querySelector("canvas")?.focus()}
            />
            <p className="map-help">
              Click the map, then WASD or arrows to walk. E or Enter enters a room, opens a chest,
              or takes an open north door to the next challenge. Chest text is only on your map. Esc
              leaves to the lobby.
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
            lobbyCopy={lobbyCopy}
            onCommand={onCommand}
            onExport={onExport}
            onImport={onImport}
          />
        </main>
      ) : (
        <Lobby
          campaigns={campaigns}
          selectedCampaignId={selectedCampaignId}
          joinLocksQuest={joinLocksQuest}
          seatId={seatId}
          alias={alias}
          joinDraft={joinDraft}
          busy={busy}
          pending={pending === "command" ? null : pending}
          onSelectCampaign={setSelectedCampaignId}
          onSeat={setSeatId}
          onAlias={(value) => {
            setAliasTouched(true);
            setAlias(value);
          }}
          onJoinDraft={setJoinDraft}
          onStart={() => void begin()}
          onJoin={(event) => void join(event)}
          onImport={onImport}
        />
      )}
    </div>
  );
}
