/** Named Kenney CC0 SFX from UX.md. DungeonScene must not hard-code file paths. */

export const SFX_DIR = "/assets/kenney/sfx";

export const ROOM_ENTER_DELAY_MS = 280;

export const SFX_EVENTS = {
  door_open: {
    key: "sfx_door_open",
    urls: [`${SFX_DIR}/door_open.ogg`, `${SFX_DIR}/door_open.wav`],
    pack: "RPG Audio",
    source: "doorOpen_1.ogg",
    volume: 0.55,
  },
  room_enter: {
    key: "sfx_room_enter",
    urls: [`${SFX_DIR}/room_enter.ogg`, `${SFX_DIR}/room_enter.wav`],
    pack: "RPG Audio",
    source: "footstep00.ogg",
    volume: 0.75,
  },
  quest_complete: {
    key: "sfx_quest_complete",
    urls: [`${SFX_DIR}/quest_complete.ogg`, `${SFX_DIR}/quest_complete.wav`],
    pack: "Music Jingles",
    source: "jingles_NES03.ogg",
    volume: 0.5,
  },
  chest_open: {
    key: "sfx_chest_open",
    urls: [`${SFX_DIR}/chest_open.ogg`, `${SFX_DIR}/chest_open.wav`],
    pack: "RPG Audio",
    source: "metalLatch.ogg",
    volume: 0.65,
  },
} as const;

export type SfxEvent = keyof typeof SFX_EVENTS;

export const SFX_LOAD = (Object.keys(SFX_EVENTS) as SfxEvent[]).map((event) => ({
  event,
  key: SFX_EVENTS[event].key,
  urls: [...SFX_EVENTS[event].urls],
}));

export const BGM_DIR = "/assets/kenney/music";

export const QUEST_COMPLETE_DUCK_MS = 1400;

export const MUTE_STORAGE_KEY = "questshift-muted";

export const BGM_EVENTS = {
  lobby: {
    key: "bgm_lobby",
    urls: [`${BGM_DIR}/lobby.ogg`, `${BGM_DIR}/lobby.wav`],
    pack: "Music Loops",
    source: "Wacky Waiting.ogg",
    volume: 0.28,
  },
  dungeon: {
    key: "bgm_dungeon",
    urls: [`${BGM_DIR}/dungeon.ogg`, `${BGM_DIR}/dungeon.wav`],
    pack: "Music Loops",
    source: "Infinite Descent.ogg",
    volume: 0.18,
  },
} as const;

export type BgmScene = keyof typeof BGM_EVENTS;

export const BGM_LOAD = (Object.keys(BGM_EVENTS) as BgmScene[]).map((scene) => ({
  scene,
  key: BGM_EVENTS[scene].key,
  urls: [...BGM_EVENTS[scene].urls],
}));

export function readMuted(): boolean {
  try {
    return sessionStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMuted(muted: boolean): void {
  try {
    sessionStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // Private mode / missing sessionStorage.
  }
}

function mimeFor(url: string): string {
  return url.endsWith(".ogg") ? "audio/ogg; codecs=vorbis" : "audio/wav";
}

export function pickAudioUrl(urls: readonly string[]): string {
  if (typeof Audio === "undefined") {
    return urls[0];
  }
  try {
    const probe = new Audio();
    const supported = urls.find((url) => {
      const can = probe.canPlayType(mimeFor(url));
      return can === "probably" || can === "maybe";
    });
    return supported ?? urls[0];
  } catch {
    return urls[0];
  }
}

type BedPlay = "lobby" | "dungeon" | "none";

class MusicBed {
  private muted = readMuted();
  private unlocked = false;
  private scene: BedPlay = "none";
  private ducking = false;
  private duckTimer: ReturnType<typeof setTimeout> | null = null;
  private current: HTMLAudioElement | null = null;
  private listeners = new Set<() => void>();

  isMuted(): boolean {
    return this.muted;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  unlock(): void {
    if (this.unlocked) {
      return;
    }
    this.unlocked = true;
    this.apply();
    this.emit();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    writeMuted(muted);
    this.apply();
    this.emit();
  }

  setScene(scene: BedPlay): void {
    if (this.scene === scene) {
      return;
    }
    this.scene = scene;
    this.apply();
  }

  duck(durationMs = QUEST_COMPLETE_DUCK_MS): void {
    this.ducking = true;
    this.apply();
    if (this.duckTimer) {
      clearTimeout(this.duckTimer);
    }
    this.duckTimer = setTimeout(() => {
      this.ducking = false;
      this.duckTimer = null;
      this.apply();
    }, durationMs);
  }

  resetForTests(): void {
    if (this.duckTimer) {
      clearTimeout(this.duckTimer);
      this.duckTimer = null;
    }
    this.pauseCurrent();
    this.current = null;
    this.muted = false;
    this.unlocked = false;
    this.scene = "none";
    this.ducking = false;
    this.listeners.clear();
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  private pauseCurrent(): void {
    if (!this.current) {
      return;
    }
    try {
      this.current.pause();
    } catch {
      // Fail open.
    }
  }

  private apply(): void {
    if (!this.unlocked || this.muted || this.scene === "none") {
      this.pauseCurrent();
      return;
    }
    const spec = BGM_EVENTS[this.scene];
    const url = pickAudioUrl(spec.urls);
    if (!this.current || this.current.dataset.key !== spec.key) {
      this.pauseCurrent();
      try {
        const audio = new Audio(url);
        audio.loop = true;
        audio.dataset.key = spec.key;
        this.current = audio;
      } catch {
        this.current = null;
        return;
      }
    }
    if (!this.current) {
      return;
    }
    this.current.volume = this.ducking ? Math.min(0.04, spec.volume) : spec.volume;
    if (this.current.paused) {
      try {
        const playing = this.current.play();
        if (playing && typeof playing.catch === "function") {
          void playing.catch(() => undefined);
        }
      } catch {
        // Fail open — lobby and board still work.
      }
    }
  }
}

export const musicBed = new MusicBed();

export function duckMusic(durationMs = QUEST_COMPLETE_DUCK_MS): void {
  musicBed.duck(durationMs);
}

export type CompletionCue = {
  heard: Set<string>;
  primed: boolean;
  play: boolean;
};

/**
 * First live board remembers existing completions so restore does not replay.
 * Later boards cue once when a room flips to complete.
 */
export function completionsToCue(opts: {
  heard: ReadonlySet<string>;
  completed: Record<string, boolean>;
  primed: boolean;
  live: boolean;
}): CompletionCue {
  if (!opts.primed) {
    if (!opts.live) {
      return { heard: new Set(opts.heard), primed: false, play: false };
    }
    const heard = new Set(opts.heard);
    Object.entries(opts.completed).forEach(([id, done]) => {
      if (done) {
        heard.add(id);
      }
    });
    return { heard, primed: true, play: false };
  }
  const heard = new Set(opts.heard);
  let play = false;
  Object.entries(opts.completed).forEach(([id, done]) => {
    if (done && !heard.has(id)) {
      heard.add(id);
      play = true;
    }
  });
  return { heard, primed: true, play };
}
