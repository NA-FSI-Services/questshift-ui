import type { PartyMember } from "./api/client";

export const SEAT_IDS = ["guardian", "automancer", "ranger", "artificer"] as const;

export type SeatId = (typeof SEAT_IDS)[number];

/** First unused name per seat. Keep in sync with docs/GAME-DESIGN.md. */
export const SEAT_ALIASES: Record<SeatId, string[]> = {
  guardian: ["Ada", "Briar", "Helm", "Ward", "Oak", "Granite", "Bastion", "Aegis"],
  automancer: ["Linus", "Ember", "Forge", "Glyph", "Spark", "Pipe", "Playbook", "Ansible"],
  ranger: ["Kelsey", "Moss", "Trail", "Vault", "Torch", "Cluster", "Route", "Probe"],
  artificer: ["James", "Cipher", "Rune", "Shard", "Tome", "Servlet", "Quark", "Loom"],
};

export function suggestAlias(seatId: string, taken: string[]): string {
  const names = SEAT_ALIASES[seatId as SeatId] ?? SEAT_ALIASES.guardian;
  const used = new Set(taken.map((name) => name.trim().toLowerCase()).filter(Boolean));
  return names.find((name) => !used.has(name.toLowerCase())) ?? names[0];
}

export function isSeatId(value: string): value is SeatId {
  return (SEAT_IDS as readonly string[]).includes(value);
}

export function memberKey(member: PartyMember): string {
  return member.name.trim().toLowerCase();
}
