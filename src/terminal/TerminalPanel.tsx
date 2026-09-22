import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import type { GameSession } from "../api/client";
import { gmProse } from "./gmProse";

type LogLine = { kind: "gm" | "you" | "sys"; text: string };

type Props = {
  session: GameSession | null;
  busy: boolean;
  waitMessage?: string | null;
  roomTitle?: string;
  roomNarrative?: string;
  lobbyCopy?: string;
  onCommand: (command: string) => Promise<void>;
  onExport: () => Promise<void>;
  onImport: (body: string) => Promise<void>;
};

export function TerminalPanel({
  session,
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
    const prose = gmProse(session?.lastNarrative);
    if (!prose) {
      return;
    }
    setLog((prev) => {
      const last = prev[prev.length - 1];
      if (last?.text === prose) {
        return prev;
      }
      return [...prev, { kind: "gm", text: prose }];
    });
  }, [session?.lastNarrative, session?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const hourOver = session?.status === "complete" || session?.status === "expired";
  const clock = session
    ? `${Math.floor(session.elapsedSeconds / 60)}m ${session.elapsedSeconds % 60}s`
    : "--";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const command = draft.trim();
    if (!command || !session || hourOver) {
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
            {line.kind === "gm" ? "GM> " : line.kind === "you" ? "$ " : "# "}
            {line.text}
          </pre>
        ))}
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
        {(session?.commandLog ?? [])
          .filter((row) => row.roomId === session?.currentRoomId)
          .map((row, index) => (
            <pre
              key={`${row.name}-${row.command}-${index}`}
              className={row.passed ? "board pass" : "board fail"}
            >
              $ {row.name} · {row.seatId}
              {"\n"}
              {row.command}
              {"\n"}
              {row.passed ? "accepted" : "failed"}
            </pre>
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
          disabled={!session || busy || hourOver}
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
              : hourOver
                ? "the hour is complete"
                : session
                  ? "type a command, YAML, oc, or Java snippet…"
                  : "start a session first"
          }
          rows={3}
        />
        <button type="submit" disabled={!session || busy || hourOver}>
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
