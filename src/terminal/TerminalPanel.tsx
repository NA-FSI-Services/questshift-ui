import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import type { CommandLogEntry, GameSession, GmLogEntry } from "../api/client";
import { gmProse } from "./gmProse";

type LogLine = { kind: "you" | "sys"; text: string };

function roomScenes(session: GameSession | null): GmLogEntry[] {
  if (!session) {
    return [];
  }
  return (session.gmLog ?? []).filter(
    (beat) => beat.roomId === session.currentRoomId && !beat.name && gmProse(beat.narrative),
  );
}

function roomAttempts(session: GameSession | null): CommandLogEntry[] {
  if (!session) {
    return [];
  }
  return (session.commandLog ?? []).filter((row) => row.roomId === session.currentRoomId);
}

function hasPersistedGm(session: GameSession | null): boolean {
  return (
    roomScenes(session).length > 0 || roomAttempts(session).some((row) => gmProse(row.narrative))
  );
}

function attemptAddressee(name?: string, seatId?: string): string {
  const alias = name?.trim() ?? "";
  if (!alias) {
    return "";
  }
  const seat = seatId?.trim();
  return seat ? `${alias} · ${seat}` : alias;
}

type Props = {
  session: GameSession | null;
  playerAlias?: string;
  busy: boolean;
  waitMessage?: string | null;
  roomTitle?: string;
  roomNarrative?: string;
  lobbyCopy?: string;
  onCommand: (command: string) => Promise<void>;
  onExport: () => Promise<void>;
  onImport: (body: string) => Promise<void>;
};

function holdsFloor(session: GameSession | null, alias?: string): boolean {
  const turn = session?.turnName?.trim() ?? "";
  const me = alias?.trim() ?? "";
  if (!turn || !me) {
    return false;
  }
  return turn.toLowerCase() === me.toLowerCase();
}

export function TerminalPanel({
  session,
  playerAlias,
  busy,
  waitMessage,
  roomTitle,
  roomNarrative,
  lobbyCopy,
  onCommand,
  onExport,
  onImport,
}: Props) {
  const [draft, setDraft] = useState("");
  const [log, setLog] = useState<LogLine[]>([{ kind: "sys", text: "QuestShift terminal." }]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLog([{ kind: "sys", text: "QuestShift terminal." }]);
  }, [session?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log, session?.commandLog, session?.gmLog, session?.lastNarrative, session?.currentRoomId]);

  const hourOver = session?.status === "complete" || session?.status === "expired";
  const myFloor = holdsFloor(session, playerAlias);
  const floorWait =
    session && session.status === "active" && !myFloor && session.turnName?.trim()
      ? `waiting — ${session.turnName.trim()} has the floor`
      : null;
  const canType = Boolean(session) && !busy && !hourOver && myFloor;
  const clock = session
    ? `${Math.floor(session.elapsedSeconds / 60)}m ${session.elapsedSeconds % 60}s`
    : "--";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const command = draft.trim();
    if (!command || !session || hourOver || !myFloor) {
      return;
    }
    setDraft("");
    await onCommand(command);
  }

  async function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const text = await file.text();
    setLog((prev) => [...prev, { kind: "sys", text: `restored ${file.name}` }]);
    await onImport(text);
  }

  return (
    <section className="terminal">
      <header className="terminal-header">
        <span>gm@questshift:~</span>
        <span className="clock-row">
          {session?.yamlFallback ? (
            <span className="gm-offline" aria-hidden="true">
              YAML fallback — Game Master unreachable
            </span>
          ) : null}
          <span className="clock">
            {session ? (hourOver ? `${clock} · stopped` : clock) : "--"}
          </span>
        </span>
      </header>
      <div className="log" aria-live="polite">
        {log.map((line, index) => (
          <pre key={`${line.kind}-${index}`} className={line.kind}>
            {line.kind === "you" ? "$ " : "# "}
            {line.text}
          </pre>
        ))}
        {roomScenes(session).map((beat, index) => (
          <pre key={`scene-${beat.roomId}-${index}`} className="gm">
            GM&gt; {gmProse(beat.narrative)}
          </pre>
        ))}
        {!hasPersistedGm(session) && gmProse(session?.lastNarrative) ? (
          <pre className="gm">GM&gt; {gmProse(session?.lastNarrative)}</pre>
        ) : null}
        {roomTitle ? (
          <pre className="sys">
            # inside {roomTitle}
            {roomNarrative ? `\n${roomNarrative.trim()}` : ""}
          </pre>
        ) : lobbyCopy ? (
          <pre className="sys">
            # lobby
            {`\n${lobbyCopy.trim()}`}
          </pre>
        ) : null}
        {waitMessage ? <pre className="sys"># {waitMessage}</pre> : null}
        {floorWait ? (
          <pre className="sys" role="status">
            # {floorWait}
          </pre>
        ) : null}
        {roomAttempts(session).map((row, index) => (
          <div key={`${row.name}-${row.command}-${index}`}>
            <pre className={row.passed ? "board pass" : "board fail"}>
              $ {row.name} · {row.seatId}
              {"\n"}
              {row.command}
              {"\n"}
              {row.passed ? "accepted" : "failed"}
            </pre>
            {gmProse(row.narrative) ? (
              <pre className="gm">
                {`GM> ${attemptAddressee(row.name, row.seatId)}\n${gmProse(row.narrative)}`}
              </pre>
            ) : null}
          </div>
        ))}
        {session?.status === "complete" && session.adventureSummary?.prose ? (
          <pre className="sys recap" role="status">
            {session.adventureSummary.prose}
          </pre>
        ) : null}
        <div ref={endRef} />
      </div>
      <form onSubmit={onSubmit} className="prompt-row">
        <label className="sr-only" htmlFor="command">
          Command
        </label>
        <span className="prompt">$</span>
        <textarea
          id="command"
          value={draft}
          disabled={!canType}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSubmit(e);
            }
          }}
          placeholder={
            waitMessage
              ? waitMessage
              : floorWait && session?.turnName
                ? `the Game Master gave the floor to ${session.turnName.trim()}…`
                : hourOver
                  ? "the hour is complete"
                  : session
                    ? "type a command, YAML, oc, or Java snippet…"
                    : "start a session first"
          }
          rows={3}
        />
        <button type="submit" disabled={!canType}>
          send
        </button>
      </form>
      <footer className="terminal-footer">
        <span className="footer-actions">
          <button type="button" disabled={!session} onClick={() => void onExport()}>
            export.yaml
          </button>
          <label className="import-yaml">
            import.yaml
            <input
              type="file"
              accept=".yaml,.yml,.json,application/yaml,application/json"
              disabled={busy}
              onChange={(event) => void onPickFile(event)}
            />
          </label>
        </span>
        {session?.lastHint ? <span className="hint">hint: {session.lastHint}</span> : null}
      </footer>
    </section>
  );
}
