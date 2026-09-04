import { FormEvent, useEffect, useRef, useState } from "react";
import type { GameSession } from "../api/client";

type LogLine = { kind: "gm" | "you" | "sys"; text: string };

type Props = {
  session: GameSession | null;
  busy: boolean;
  onCommand: (command: string) => Promise<void>;
  onExport: () => Promise<void>;
};

export function TerminalPanel({ session, busy, onCommand, onExport }: Props) {
  const [draft, setDraft] = useState("");
  const [log, setLog] = useState<LogLine[]>([
    { kind: "sys", text: "QuestShift terminal. Seats are cosmetic. Anyone may solve." },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session?.lastNarrative) {
      setLog((prev) => {
        const last = prev[prev.length - 1];
        if (last?.text === session.lastNarrative) {
          return prev;
        }
        return [...prev, { kind: "gm", text: session.lastNarrative ?? "" }];
      });
    }
  }, [session?.lastNarrative, session?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const command = draft.trim();
    if (!command || !session) {
      return;
    }
    setLog((prev) => [...prev, { kind: "you", text: command }]);
    setDraft("");
    await onCommand(command);
  }

  return (
    <section className="terminal">
      <header className="terminal-header">
        <span>gm@questshift:~</span>
        <span className="clock">
          {session ? `${Math.floor(session.elapsedSeconds / 60)}m ${session.elapsedSeconds % 60}s` : "--"}
        </span>
      </header>
      <div className="log" aria-live="polite">
        {log.map((line, index) => (
          <pre key={`${line.kind}-${index}`} className={line.kind}>
            {line.kind === "gm" ? "GM> " : line.kind === "you" ? "$ " : "# "}
            {line.text}
          </pre>
        ))}
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
          disabled={!session || busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSubmit(e);
            }
          }}
          placeholder={session ? "type a command, YAML, oc, or Java snippet…" : "start a session first"}
          rows={3}
        />
        <button type="submit" disabled={!session || busy}>
          send
        </button>
      </form>
      <footer className="terminal-footer">
        <button type="button" disabled={!session} onClick={() => void onExport()}>
          export.yaml
        </button>
        {session?.lastHint ? <span className="hint">hint: {session.lastHint}</span> : null}
      </footer>
    </section>
  );
}
