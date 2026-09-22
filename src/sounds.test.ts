import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BGM_DIR,
  BGM_EVENTS,
  BGM_LOAD,
  completionsToCue,
  duckMusic,
  musicBed,
  MUTE_STORAGE_KEY,
  pickAudioUrl,
  QUEST_COMPLETE_DUCK_MS,
  readMuted,
  ROOM_ENTER_DELAY_MS,
  SFX_DIR,
  SFX_EVENTS,
  SFX_LOAD,
  writeMuted,
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

describe("Kenney music bed", () => {
  afterEach(() => {
    musicBed.resetForTests();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("maps lobby and dungeon beds to Music Loops files", () => {
    expect(BGM_DIR).toBe("/assets/kenney/music");
    expect(QUEST_COMPLETE_DUCK_MS).toBe(1400);
    expect(BGM_LOAD).toHaveLength(2);
    expect(BGM_EVENTS.lobby).toMatchObject({
      key: "bgm_lobby",
      pack: "Music Loops",
      source: "Wacky Waiting.ogg",
    });
    expect(BGM_EVENTS.dungeon).toMatchObject({
      key: "bgm_dungeon",
      source: "Infinite Descent.ogg",
    });
    BGM_LOAD.forEach((clip) => {
      expect(clip.urls[0]).toMatch(/\.ogg$/);
      expect(clip.urls[1]).toMatch(/\.wav$/);
      expect(clip.urls[0].startsWith(BGM_DIR)).toBe(true);
    });
  });

  it("picks a playable URL and fails open to the first", () => {
    class Probe {
      canPlayType(type: string) {
        return type.includes("wav") ? "probably" : "";
      }
    }
    vi.stubGlobal("Audio", Probe as unknown as typeof Audio);
    expect(pickAudioUrl(["/a.ogg", "/a.wav"])).toBe("/a.wav");
  });

  it("persists mute for the tab and stays silent until unlock", () => {
    expect(readMuted()).toBe(false);
    writeMuted(true);
    expect(sessionStorage.getItem(MUTE_STORAGE_KEY)).toBe("1");
    expect(readMuted()).toBe(true);
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "Audio",
      class {
        paused = true;
        loop = false;
        volume = 1;
        dataset: Record<string, string> = {};
        play = play;
        pause = vi.fn();
        canPlayType() {
          return "probably";
        }
      } as unknown as typeof Audio,
    );
    musicBed.setMuted(true);
    musicBed.setScene("lobby");
    musicBed.unlock();
    expect(play).not.toHaveBeenCalled();
    musicBed.setMuted(false);
    expect(play).toHaveBeenCalled();
  });

  it("ducks volume under quest complete then resumes", () => {
    vi.useFakeTimers();
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "Audio",
      class {
        paused = false;
        loop = false;
        volume = 1;
        dataset: Record<string, string> = {};
        play = play;
        pause = vi.fn();
        canPlayType() {
          return "probably";
        }
      } as unknown as typeof Audio,
    );
    musicBed.setMuted(false);
    musicBed.unlock();
    musicBed.setScene("dungeon");
    duckMusic(1400);
    vi.advanceTimersByTime(1400);
    vi.useRealTimers();
  });
});
