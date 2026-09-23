import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Campaign } from "../api/client";
import { Lobby } from "./Lobby";

const campaign: Campaign = {
  metadata: {
    id: "devops-dungeon",
    title: "The Cluster That Forgot Its Name",
    subtitle: "A 60-minute dungeon crawl through Linux, Ansible, OpenShift, and Java",
    durationMinutes: 60,
  },
  story: {
    premise: "The workshop cluster woke up unnamed.",
  },
  seats: [{ id: "guardian", title: "Guardian", color: "#3d7a4a" }],
  rooms: [],
};

const ansibleCampaign: Campaign = {
  metadata: {
    id: "ansible-bastion",
    title: "The Bastion That Lost Its Runbook",
    subtitle: "A 60-minute Ansible crawl",
    durationMinutes: 60,
  },
  story: {
    premise: "Automation Controller Aether woke with an empty inventory.",
  },
  seats: [{ id: "automancer", title: "Automancer", color: "#c45c26" }],
  rooms: [],
};

describe("Lobby", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders one campaign card and character picker", () => {
    render(
      <Lobby
        campaigns={[campaign]}
        selectedCampaignId="devops-dungeon"
        joinLocksQuest={false}
        seatId="guardian"
        alias="Ada"
        joinDraft=""
        busy={false}
        pending={null}
        onSelectCampaign={vi.fn()}
        onSeat={vi.fn()}
        onAlias={vi.fn()}
        onJoinDraft={vi.fn()}
        onStart={vi.fn()}
        onJoin={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Quest lobby")).toBeInTheDocument();
    expect(screen.getByText("The Cluster That Forgot Its Name")).toBeInTheDocument();
    expect(screen.getByText(/unnamed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guardian/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "start 60-minute run" })).toBeEnabled();
  });

  it("renders two campaign cards and selects ansible-bastion", () => {
    const onSelect = vi.fn();
    render(
      <Lobby
        campaigns={[campaign, ansibleCampaign]}
        selectedCampaignId="devops-dungeon"
        joinLocksQuest={false}
        seatId="guardian"
        alias="Ada"
        joinDraft=""
        busy={false}
        pending={null}
        onSelectCampaign={onSelect}
        onSeat={vi.fn()}
        onAlias={vi.fn()}
        onJoinDraft={vi.fn()}
        onStart={vi.fn()}
        onJoin={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    expect(screen.getByText("The Cluster That Forgot Its Name")).toBeInTheDocument();
    expect(screen.getByText("The Bastion That Lost Its Runbook")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /The Bastion That Lost Its Runbook/ }));
    expect(onSelect).toHaveBeenCalledWith("ansible-bastion");
  });

  it("shows an empty state and disables start", () => {
    render(
      <Lobby
        campaigns={[]}
        selectedCampaignId=""
        joinLocksQuest={false}
        seatId="guardian"
        alias="Ada"
        joinDraft=""
        busy={false}
        pending={null}
        onSelectCampaign={vi.fn()}
        onSeat={vi.fn()}
        onAlias={vi.fn()}
        onJoinDraft={vi.fn()}
        onStart={vi.fn()}
        onJoin={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    expect(screen.getByText("No quests loaded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "start 60-minute run" })).toBeDisabled();
  });

  it("locks the quest card when joining a live party", () => {
    const onSelect = vi.fn();
    render(
      <Lobby
        campaigns={[campaign]}
        selectedCampaignId="devops-dungeon"
        joinLocksQuest
        seatId="guardian"
        alias="Briar"
        joinDraft="thorn-golem"
        busy={false}
        pending={null}
        onSelectCampaign={onSelect}
        onSeat={vi.fn()}
        onAlias={vi.fn()}
        onJoinDraft={vi.fn()}
        onStart={vi.fn()}
        onJoin={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    expect(screen.getByText("Joining that party's live quest.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /The Cluster That Forgot Its Name/ }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
