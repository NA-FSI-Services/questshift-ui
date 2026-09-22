import { type ChangeEvent, type FormEvent } from "react";
import type { Campaign } from "../api/client";
import { frameFor, seatSpriteKey, spriteSheetStyle } from "../sprites";

type Pending = "start" | "join" | "import" | "leave" | "delete" | null;

type Props = {
  campaigns: Campaign[];
  selectedCampaignId: string;
  joinLocksQuest: boolean;
  seatId: string;
  alias: string;
  joinDraft: string;
  busy: boolean;
  pending: Pending;
  onSelectCampaign: (id: string) => void;
  onSeat: (id: string) => void;
  onAlias: (value: string) => void;
  onJoinDraft: (value: string) => void;
  onStart: () => void;
  onJoin: (event: FormEvent) => void;
  onImport: (body: string) => Promise<void>;
};

function BusyMark() {
  return <span className="spinner" aria-hidden="true" />;
}

function SeatSprite({ seatId }: { seatId: string }) {
  const key = seatSpriteKey(seatId);
  if (!key) {
    return null;
  }
  return <span className="seat-sprite" style={spriteSheetStyle(frameFor(key))} aria-hidden />;
}

function campaignCardCopy(campaign: Campaign) {
  return {
    id: campaign.metadata.id,
    title: campaign.metadata.title,
    subtitle: campaign.metadata.subtitle ?? "",
    duration: campaign.metadata.durationMinutes,
    premise: (campaign.story?.premise ?? "").trim(),
  };
}

export function Lobby({
  campaigns,
  selectedCampaignId,
  joinLocksQuest,
  seatId,
  alias,
  joinDraft,
  busy,
  pending,
  onSelectCampaign,
  onSeat,
  onAlias,
  onJoinDraft,
  onStart,
  onJoin,
  onImport,
}: Props) {
  const selected = campaigns.find((item) => item.metadata.id === selectedCampaignId);
  const seats = selected?.seats ?? campaigns[0]?.seats ?? [];

  async function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    await onImport(await file.text());
  }

  return (
    <section className="lobby" aria-label="Quest lobby">
      <div className="lobby-quests">
        <h2>Pick a quest</h2>
        {campaigns.length === 0 ? (
          <p className="lobby-empty">No quests loaded.</p>
        ) : (
          <ul className="quest-cards">
            {campaigns.map((campaign) => {
              const copy = campaignCardCopy(campaign);
              const selectedCard = copy.id === selectedCampaignId;
              return (
                <li key={copy.id}>
                  <button
                    type="button"
                    className={selectedCard ? "quest-card selected" : "quest-card"}
                    aria-pressed={selectedCard}
                    disabled={busy || joinLocksQuest}
                    onClick={() => onSelectCampaign(copy.id)}
                  >
                    <strong>{copy.title}</strong>
                    {copy.subtitle ? <span className="quest-subtitle">{copy.subtitle}</span> : null}
                    <span className="quest-duration">{copy.duration} minutes</span>
                    {copy.premise ? <span className="quest-premise">{copy.premise}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {joinLocksQuest ? (
          <p className="lobby-join-quest">Joining that party&apos;s live quest.</p>
        ) : null}
      </div>
      <div className="party-picker">
        <fieldset className="seat-picker">
          <legend>Character</legend>
          {seats.map((seat) => (
            <button
              key={seat.id}
              type="button"
              className={seatId === seat.id ? "seat-pick selected" : "seat-pick"}
              aria-pressed={seatId === seat.id}
              disabled={busy}
              onClick={() => onSeat(seat.id)}
            >
              <SeatSprite seatId={seat.id} />
              {seat.title}
            </button>
          ))}
        </fieldset>
        <label>
          Alias
          <input
            value={alias}
            onChange={(event) => onAlias(event.target.value)}
            autoComplete="off"
            disabled={busy}
          />
        </label>
      </div>
      <div className="lobby-actions">
        <button
          type="button"
          onClick={onStart}
          disabled={busy || !alias.trim() || !selectedCampaignId || campaigns.length === 0}
          aria-busy={pending === "start"}
        >
          {pending === "start" ? <BusyMark /> : null}
          {pending === "start" ? "starting…" : "start 60-minute run"}
        </button>
        <form className="join-form" onSubmit={onJoin}>
          <label>
            Join code
            <input
              value={joinDraft}
              onChange={(event) => onJoinDraft(event.target.value)}
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
        <label className="import-yaml">
          import.yaml
          <input
            type="file"
            accept=".yaml,.yml,.json,text/yaml"
            onChange={(event) => void onPickFile(event)}
          />
        </label>
      </div>
    </section>
  );
}
