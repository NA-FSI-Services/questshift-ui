import { describe, expect, it } from "vitest";
import {
  completionsToCue,
  ROOM_ENTER_DELAY_MS,
  SFX_DIR,
  SFX_EVENTS,
  SFX_LOAD,
  type SfxEvent,
} from "./sounds";

const UX_EVENTS: SfxEvent[] = ["door_open", "room_enter", "quest_complete", "chest_open"];

describe("Kenney SFX keys", () => {
  it("maps every UX.md event to Kenney pack files under /assets/kenney/sfx", () => {
    expect(Object.keys(SFX_EVENTS).sort()).toEqual([...UX_EVENTS].sort());
    expect(SFX_DIR).toBe("/assets/kenney/sfx");
    expect(SFX_LOAD).toHaveLength(4);
    expect(ROOM_ENTER_DELAY_MS).toBe(280);
    expect(SFX_EVENTS.door_open).toMatchObject({
      key: "sfx_door_open",
      pack: "RPG Audio",
      source: "doorOpen_1.ogg",
    });
    expect(SFX_EVENTS.room_enter.source).toBe("footstep00.ogg");
    expect(SFX_EVENTS.quest_complete).toMatchObject({
      pack: "Music Jingles",
      source: "jingles_NES03.ogg",
    });
    expect(SFX_EVENTS.chest_open.source).toBe("metalLatch.ogg");
    SFX_LOAD.forEach((clip) => {
      expect(clip.urls[0]).toMatch(/\.ogg$/);
      expect(clip.urls[1]).toMatch(/\.wav$/);
      expect(clip.urls[0].startsWith(SFX_DIR)).toBe(true);
    });
  });

  it("does not cue until a live board primes existing completions", () => {
    const idle = completionsToCue({
      heard: new Set(),
      completed: { "room-01-broken-shell": true },
      primed: false,
      live: false,
    });
    expect(idle.primed).toBe(false);
    expect(idle.play).toBe(false);
    expect([...idle.heard]).toEqual([]);

    const restore = completionsToCue({
      heard: idle.heard,
      completed: { "room-01-broken-shell": true, "room-02-playbook-of-binding": false },
      primed: idle.primed,
      live: true,
    });
    expect(restore.primed).toBe(true);
    expect(restore.play).toBe(false);
    expect([...restore.heard]).toEqual(["room-01-broken-shell"]);
  });

  it("cues once when a new room completes after prime", () => {
    const primed = completionsToCue({
      heard: new Set(),
      completed: {},
      primed: false,
      live: true,
    });
    expect(primed.play).toBe(false);

    const pass = completionsToCue({
      heard: primed.heard,
      completed: { "room-01-broken-shell": true },
      primed: primed.primed,
      live: true,
    });
    expect(pass.play).toBe(true);

    const again = completionsToCue({
      heard: pass.heard,
      completed: { "room-01-broken-shell": true },
      primed: pass.primed,
      live: true,
    });
    expect(again.play).toBe(false);

    const nextRoom = completionsToCue({
      heard: again.heard,
      completed: { "room-01-broken-shell": true, "room-02-playbook-of-binding": true },
      primed: again.primed,
      live: true,
    });
    expect(nextRoom.play).toBe(true);
  });

  it("ignores incomplete rooms and empty completion maps", () => {
    const primed = completionsToCue({
      heard: new Set(["room-01-broken-shell"]),
      completed: { "room-01-broken-shell": false, "room-02-playbook-of-binding": false },
      primed: true,
      live: true,
    });
    expect(primed.play).toBe(false);
    expect([...primed.heard]).toEqual(["room-01-broken-shell"]);
  });
});
