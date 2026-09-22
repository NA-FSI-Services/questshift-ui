import Phaser from "phaser";
import {
  atInteriorChallengeDoor,
  atInteriorDoor,
  challengeDoorLocked,
  clueInReach,
  ENTER_RADIUS,
  INTERIOR_CHALLENGE_DOOR,
  INTERIOR_DOOR,
  INTERIOR_GUARDIAN,
  INTERIOR_SPAWN,
  nearestUnlockedRoom,
  nextRoomThroughChallengeDoor,
  overworldSpawn,
  roomUnlocked,
  stepToward,
} from "../map";
import {
  clueDialogBounds,
  clueDialogVisible,
  floorChests,
  mayOpenClue,
  ROOM_TITLE,
  ROOM_TITLE_STYLE,
  roomTitleWell,
  type ClueDialogCopy,
} from "../clueDialog";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  frameFor,
  gemKeyFor,
  guardianSpriteKey,
  lobbyDoorKey,
  LOOT_ORDER,
  lootSpriteKey,
  seatSpriteKey,
  SPRITE_SCALE,
  SPRITESHEET_LOAD,
  TILE_DISPLAY,
  TINY_DUNGEON_SHEET,
  type SpriteKey,
} from "../sprites";
import {
  ALIAS_TEXT_STYLE,
  aliasLabelOffset,
  occupantsByRoom,
  occupancySlot,
  placeWalkers,
} from "../occupancy";
import {
  completionsToCue,
  duckMusic,
  ROOM_ENTER_DELAY_MS,
  SFX_EVENTS,
  SFX_LOAD,
  type SfxEvent,
} from "../sounds";
import { bindWalkKeys } from "../walkKeys";

export type DungeonNode = {
  id: string;
  title: string;
  x: number;
  y: number;
  kind: string;
  order?: number;
  guardianSprite?: string;
};

export type PresencePayload = {
  mapX: number;
  mapY: number;
  viewedRoomId: string;
  pickupClueId?: string;
};

export type BoardMember = {
  name: string;
  seatId: string;
  mapX: number;
  mapY: number;
  viewedRoomId?: string;
};

export type BoardClue = {
  id: string;
  x: number;
  y: number;
  roomId: string;
  label: string;
  text: string;
};

export type BoardState = {
  sessionId?: string;
  currentRoomId: string;
  completed: Record<string, boolean>;
  canvasEvent?: string;
  seats: { id: string; color: string }[];
  members: BoardMember[];
  meName: string;
  inventory: string[];
  missed: boolean;
  foundClues: string[];
  clues: BoardClue[];
};

const PRESENCE_MS = 150;

export class DungeonScene extends Phaser.Scene {
  private nodes: DungeonNode[] = [];
  private rooms = new Map<string, Phaser.GameObjects.Image>();
  private gems = new Map<string, Phaser.GameObjects.Image>();
  private labels: Phaser.GameObjects.Text[] = [];
  private party: Phaser.GameObjects.GameObject[] = [];
  private loot: Phaser.GameObjects.Image[] = [];
  private interior: Phaser.GameObjects.GameObject[] = [];
  private focus?: Phaser.GameObjects.Image;
  private meSprite?: Phaser.GameObjects.Image;
  private meLabel?: Phaser.GameObjects.Text;
  private board: BoardState = {
    currentRoomId: "",
    completed: {},
    seats: [],
    members: [],
    meName: "",
    inventory: [],
    missed: false,
    foundClues: [],
    clues: [],
  };
  private localX = 120;
  private localY = 276;
  private localViewed = "";
  private posed = false;
  private lastPresenceAt = 0;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW?: Phaser.Input.Keyboard.Key;
  private keyA?: Phaser.Input.Keyboard.Key;
  private keyS?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;
  private keyE?: Phaser.Input.Keyboard.Key;
  private keyEnter?: Phaser.Input.Keyboard.Key;
  private keyEsc?: Phaser.Input.Keyboard.Key;
  private openClue?: ClueDialogCopy;
  private heardComplete = new Set<string>();
  private completePrimed = false;
  private enterCue?: Phaser.Time.TimerEvent;

  constructor() {
    super("dungeon");
  }

  init(data?: { nodes?: DungeonNode[] }) {
    this.nodes = data?.nodes ?? this.registry.get("nodes") ?? [];
  }

  preload() {
    this.load.spritesheet(SPRITESHEET_LOAD.key, SPRITESHEET_LOAD.url, SPRITESHEET_LOAD.frameConfig);
    SFX_LOAD.forEach((clip) => this.load.audio(clip.key, clip.urls));
  }

  create() {
    this.cameras.main.setBackgroundColor("#101714");
    this.drawTiles();
    this.nodes.forEach((node) => {
      const room = this.hotspot("lobby_gate", node.x, node.y).setDepth(2);
      room.on("pointerdown", () => this.tryEnter(node.id));
      this.rooms.set(node.id, room);
      const gem = this.place("gem_locked", node.x + 36, node.y - 8).setDepth(3);
      this.gems.set(node.id, gem);
      this.labels.push(
        this.add
          .text(node.x, node.y + 28, node.title, {
            fontFamily: "IBM Plex Mono",
            fontSize: "12px",
            color: "#cfe7d4",
            align: "center",
            wordWrap: { width: 140 },
          })
          .setOrigin(0.5, 0)
          .setDepth(6),
      );
    });
    this.focus = this.place("focus", 0, 0).setDepth(3).setVisible(false);
    this.game.canvas.setAttribute("tabindex", "0");
    this.game.canvas.setAttribute("aria-label", "Dungeon map");
    if (this.input.keyboard) {
      const keys = bindWalkKeys(this.input.keyboard);
      this.cursors = keys.cursors as Phaser.Types.Input.Keyboard.CursorKeys;
      this.keyW = keys.W as Phaser.Input.Keyboard.Key;
      this.keyA = keys.A as Phaser.Input.Keyboard.Key;
      this.keyS = keys.S as Phaser.Input.Keyboard.Key;
      this.keyD = keys.D as Phaser.Input.Keyboard.Key;
      this.keyE = keys.E as Phaser.Input.Keyboard.Key;
      this.keyEnter = keys.Enter as Phaser.Input.Keyboard.Key;
      this.keyEsc = keys.Esc as Phaser.Input.Keyboard.Key;
    }
    this.input.setTopOnly(false);
    this.input.on("pointerdown", () => this.unlockAudio());
    window.addEventListener("pointerdown", this.unlockAudio, { capture: true });
    window.addEventListener("keydown", this.unlockAudio, { capture: true });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("pointerdown", this.unlockAudio, true);
      window.removeEventListener("keydown", this.unlockAudio, true);
    });
    this.events.on("board", (state: BoardState) => this.apply(state));
    this.apply({
      currentRoomId: "",
      completed: {},
      seats: [],
      members: [],
      meName: "",
      inventory: [],
      missed: false,
      foundClues: [],
      clues: [],
    });
  }

  update() {
    if (clueDialogVisible(this.openClue)) {
      if (
        this.justDown(this.keyE) ||
        this.justDown(this.keyEnter) ||
        this.justDown(this.cursors?.space) ||
        this.justDown(this.keyEsc)
      ) {
        this.closeClueDialog();
      }
      return;
    }
    if (!this.board.meName || !this.canvasFocused()) {
      return;
    }
    let dx = 0;
    let dy = 0;
    if (this.cursors?.left.isDown || this.keyA?.isDown) {
      dx -= 1;
    }
    if (this.cursors?.right.isDown || this.keyD?.isDown) {
      dx += 1;
    }
    if (this.cursors?.up.isDown || this.keyW?.isDown) {
      dy -= 1;
    }
    if (this.cursors?.down.isDown || this.keyS?.isDown) {
      dy += 1;
    }
    if (dx !== 0 || dy !== 0) {
      const next = stepToward(this.localX, this.localY, dx, dy);
      this.localX = next.x;
      this.localY = next.y;
      this.poseSelf();
      this.emitPresence(false);
    }
    if (
      this.justDown(this.keyE) ||
      this.justDown(this.keyEnter) ||
      this.justDown(this.cursors?.space)
    ) {
      this.act();
    }
    if (this.justDown(this.keyEsc)) {
      this.leaveRoom();
    }
  }

  apply(state: BoardState) {
    if (this.board.meName !== state.meName) {
      this.posed = false;
    }
    if (this.board.sessionId !== state.sessionId) {
      this.heardComplete = new Set();
      this.completePrimed = false;
    }
    const cue = completionsToCue({
      heard: this.heardComplete,
      completed: state.completed,
      primed: this.completePrimed,
      live: Boolean(state.sessionId || state.meName || state.currentRoomId),
    });
    this.heardComplete = cue.heard;
    this.completePrimed = cue.primed;
    if (cue.play) {
      this.playSfx("quest_complete");
    }
    this.board = state;
    const interior = Boolean(this.localViewed);
    this.nodes.forEach((node) => {
      const room = this.rooms.get(node.id);
      const gem = this.gems.get(node.id);
      if (!room || !gem) {
        return;
      }
      room.setVisible(!interior);
      gem.setVisible(!interior);
      const current = Boolean(state.currentRoomId) && state.currentRoomId === node.id;
      room.setFrame(frameFor(lobbyDoorKey()));
      gem.setFrame(
        frameFor(
          gemKeyFor({
            roomId: node.id,
            currentRoomId: state.currentRoomId,
            completed: state.completed,
            missed: state.missed,
          }),
        ),
      );
      this.tweens.killTweensOf(room);
      room.setScale(SPRITE_SCALE);
      if (current && !interior) {
        this.tweens.add({
          targets: room,
          scale: SPRITE_SCALE * 1.15,
          duration: 600,
          yoyo: true,
          repeat: -1,
        });
      }
    });
    this.labels.forEach((label) => label.setVisible(!interior));
    const current = this.nodes.find((node) => node.id === state.currentRoomId);
    if (this.focus) {
      if (current && !interior) {
        this.focus.setPosition(current.x, current.y).setVisible(true);
      } else {
        this.focus.setVisible(false);
      }
    }
    const mine = state.members.find(
      (member) => member.name.trim().toLowerCase() === state.meName.trim().toLowerCase(),
    );
    if (mine && !this.posed) {
      this.localX = mine.mapX;
      this.localY = mine.mapY;
      this.localViewed = mine.viewedRoomId ?? "";
      this.posed = true;
    }
    this.drawParty(state);
    this.drawInterior(state);
    this.loot.forEach((sprite) => sprite.destroy());
    this.loot = [];
    const lootY = CANVAS_HEIGHT - TILE_DISPLAY * 1.5;
    LOOT_ORDER.forEach((itemId, index) => {
      if (!state.inventory.includes(itemId)) {
        return;
      }
      const key = lootSpriteKey(itemId);
      if (!key) {
        return;
      }
      this.loot.push(this.place(key, TILE_DISPLAY * 1.5 + index * TILE_DISPLAY, lootY).setDepth(5));
    });
  }

  private drawParty(state: BoardState) {
    this.party.forEach((sprite) => sprite.destroy());
    this.party = [];
    this.meSprite = undefined;
    this.meLabel = undefined;
    const view = this.localViewed;
    if (!state.meName && !view) {
      this.drawParkedSeats(state);
      return;
    }
    const members = state.members.map((member) => {
      const self = member.name.trim().toLowerCase() === state.meName.trim().toLowerCase();
      return {
        name: member.name,
        seatId: member.seatId,
        mapX: self ? this.localX : member.mapX,
        mapY: self ? this.localY : member.mapY,
        viewedRoomId: self ? view : (member.viewedRoomId ?? ""),
      };
    });
    placeWalkers(members, view, state.meName).forEach((walker) => {
      const key = seatSpriteKey(walker.seatId);
      if (!key) {
        return;
      }
      const depth = walker.self ? 7 : 4;
      const sprite = this.place(key, walker.x, walker.y).setDepth(depth);
      const label = this.aliasText(walker.x, walker.y, walker.name, depth + 1);
      this.party.push(sprite, label);
      if (walker.self) {
        this.meSprite = sprite;
        this.meLabel = label;
      }
    });
    if (view) {
      return;
    }
    occupantsByRoom(members, view).forEach((group) => {
      const node = this.nodes.find((item) => item.id === group.roomId);
      if (!node) {
        return;
      }
      group.occupants.forEach((occupant, index) => {
        const slot = occupancySlot(node.x, node.y, index, group.occupants.length);
        const key = seatSpriteKey(occupant.seatId);
        if (key) {
          this.party.push(
            this.place(key, slot.x, slot.y)
              .setScale(SPRITE_SCALE * 0.67)
              .setDepth(5),
          );
        }
        this.party.push(this.aliasText(slot.x, slot.y, occupant.name, 6));
      });
    });
  }

  private drawParkedSeats(state: BoardState) {
    const parked = this.nodes[0];
    const offsets = [
      { x: -72, y: 52 },
      { x: -32, y: 52 },
      { x: 8, y: 52 },
      { x: 48, y: 52 },
    ];
    if (!parked) {
      return;
    }
    state.seats.forEach((seat, index) => {
      const key = seatSpriteKey(seat.id);
      if (!key) {
        return;
      }
      const spot = offsets[index] ?? offsets[0];
      this.party.push(this.place(key, parked.x + spot.x, parked.y + spot.y).setDepth(4));
    });
  }

  private poseSelf() {
    this.meSprite?.setPosition(this.localX, this.localY);
    const off = aliasLabelOffset();
    this.meLabel?.setPosition(this.localX + off.x, this.localY + off.y);
  }

  private aliasText(x: number, y: number, name: string, depth: number) {
    const off = aliasLabelOffset();
    return this.add
      .text(x + off.x, y + off.y, name, ALIAS_TEXT_STYLE)
      .setOrigin(0.5, 1)
      .setDepth(depth);
  }

  private drawInterior(state: BoardState) {
    this.interior.forEach((sprite) => sprite.destroy());
    this.interior = [];
    if (this.localViewed) {
      const node = this.nodes.find((item) => item.id === this.localViewed);
      const title = this.add
        .text(CANVAS_WIDTH / 2, ROOM_TITLE.y, node?.title ?? this.localViewed, ROOM_TITLE_STYLE)
        .setOrigin(0.5, 0);
      const well = roomTitleWell(title.width, title.height);
      const plate = this.add.graphics().setDepth(7);
      plate.fillStyle(ROOM_TITLE.fill, ROOM_TITLE.fillAlpha);
      plate.fillRoundedRect(well.x, well.y, well.width, well.height, ROOM_TITLE.radius);
      this.interior.push(plate, title.setDepth(8));
      const lobby = this.hotspot("door", INTERIOR_DOOR.x, INTERIOR_DOOR.y).setDepth(4);
      lobby.on("pointerdown", () => this.leaveRoom());
      this.interior.push(lobby);
      const locked = challengeDoorLocked(this.localViewed, state.completed);
      const challengeKey = locked ? "door_locked" : "door";
      const challenge = this.place(
        challengeKey,
        INTERIOR_CHALLENGE_DOOR.x,
        INTERIOR_CHALLENGE_DOOR.y,
      ).setDepth(4);
      if (!locked) {
        challenge
          .setInteractive(
            new Phaser.Geom.Rectangle(
              -ENTER_RADIUS,
              -ENTER_RADIUS,
              ENTER_RADIUS * 2,
              ENTER_RADIUS * 2,
            ),
            Phaser.Geom.Rectangle.Contains,
          )
          .on("pointerdown", () => this.advanceThroughChallengeDoor());
      }
      this.interior.push(challenge);
      if (locked) {
        const sprite = guardianSpriteKey(this.localViewed, node?.guardianSprite);
        this.interior.push(
          this.place(sprite, INTERIOR_GUARDIAN.x, INTERIOR_GUARDIAN.y).setDepth(5),
        );
      }
    }
    floorChests(state.clues, this.localViewed).forEach((clue) => {
      const chest = this.hotspot("clue", clue.x, clue.y).setDepth(4);
      chest.on("pointerdown", () => this.pickClue(clue.id));
      this.interior.push(chest);
    });
    this.drawClueDialog();
  }

  private act() {
    const layerChests = floorChests(this.board.clues, this.localViewed);
    if (this.localViewed) {
      if (atInteriorDoor(this.localX, this.localY)) {
        this.leaveRoom();
        return;
      }
      if (atInteriorChallengeDoor(this.localX, this.localY)) {
        this.advanceThroughChallengeDoor();
        return;
      }
      const clue = clueInReach(this.localX, this.localY, layerChests);
      if (clue) {
        this.pickClue(clue.id);
      }
      return;
    }
    const clue = clueInReach(this.localX, this.localY, layerChests);
    if (clue) {
      this.pickClue(clue.id);
      return;
    }
    const node = nearestUnlockedRoom(
      this.localX,
      this.localY,
      this.nodes,
      this.board.currentRoomId,
      this.board.completed,
    );
    if (node) {
      this.tryEnter(node.id);
    }
  }

  private advanceThroughChallengeDoor() {
    const nextId = nextRoomThroughChallengeDoor(
      this.localViewed,
      this.nodes,
      this.board.currentRoomId,
      this.board.completed,
    );
    if (nextId) {
      this.tryEnter(nextId);
    }
  }

  private tryEnter(roomId: string) {
    if (!this.board.meName || this.localViewed === roomId) {
      return;
    }
    if (!roomUnlocked(roomId, this.board.currentRoomId, this.board.completed)) {
      return;
    }
    this.openClue = undefined;
    this.localViewed = roomId;
    this.localX = INTERIOR_SPAWN.x;
    this.localY = INTERIOR_SPAWN.y;
    this.poseSelf();
    this.playSfx("door_open");
    this.enterCue?.remove(false);
    this.enterCue = this.time.delayedCall(ROOM_ENTER_DELAY_MS, () => this.playSfx("room_enter"));
    this.apply(this.board);
    this.emitPresence(true);
  }

  private pickClue(clueId: string) {
    const clue = this.board.clues.find((item) => item.id === clueId);
    if (!mayOpenClue(clue, this.localViewed)) {
      return;
    }
    this.openClue = { id: clue.id, label: clue.label, text: clue.text };
    this.playSfx("chest_open");
    const firstOpen = !this.board.foundClues.includes(clueId);
    if (firstOpen) {
      this.board = {
        ...this.board,
        foundClues: [...this.board.foundClues, clueId],
      };
    }
    this.drawInterior(this.board);
    this.emitPresence(true, firstOpen ? clueId : undefined);
  }

  private closeClueDialog() {
    if (!this.openClue) {
      return;
    }
    this.openClue = undefined;
    this.drawInterior(this.board);
  }

  private drawClueDialog() {
    if (!clueDialogVisible(this.openClue) || !this.openClue) {
      return;
    }
    const box = clueDialogBounds();
    const shade = this.add.graphics().setDepth(18);
    shade.fillStyle(0x070a09, 0.72);
    shade.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    shade.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT),
      Phaser.Geom.Rectangle.Contains,
    );
    shade.on("pointerdown", () => this.closeClueDialog());
    const panel = this.add.graphics().setDepth(19);
    panel.fillStyle(0x101714, 0.97);
    panel.fillRoundedRect(box.x, box.y, box.width, box.height, 6);
    panel.lineStyle(2, 0xe0b25a, 1);
    panel.strokeRoundedRect(box.x, box.y, box.width, box.height, 6);
    const title = this.add
      .text(box.x + box.width / 2, box.y + 16, this.openClue.label, {
        fontFamily: "IBM Plex Mono",
        fontSize: "15px",
        color: "#e0b25a",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setDepth(20);
    const body = this.add
      .text(box.x + 20, box.y + 44, this.openClue.text.trim(), {
        fontFamily: "IBM Plex Mono",
        fontSize: "13px",
        color: "#d7eadb",
        wordWrap: { width: box.width - 40 },
      })
      .setOrigin(0, 0)
      .setDepth(20);
    const hint = this.add
      .text(box.x + box.width / 2, box.y + box.height - 22, "only you can read this · Esc closes", {
        fontFamily: "IBM Plex Mono",
        fontSize: "11px",
        color: "#7f9a86",
      })
      .setOrigin(0.5, 0)
      .setDepth(20);
    this.interior.push(shade, panel, title, body, hint);
  }

  private leaveRoom() {
    if (!this.localViewed) {
      return;
    }
    this.openClue = undefined;
    this.enterCue?.remove(false);
    this.playSfx("door_open");
    const node = this.nodes.find((item) => item.id === this.localViewed);
    this.localViewed = "";
    if (node) {
      const spawn = overworldSpawn(node);
      this.localX = spawn.x;
      this.localY = spawn.y;
      this.poseSelf();
    }
    this.apply(this.board);
    this.emitPresence(true);
  }

  private emitPresence(force: boolean, pickupClueId?: string) {
    const now = this.time.now;
    if (!force && now - this.lastPresenceAt < PRESENCE_MS) {
      return;
    }
    this.lastPresenceAt = now;
    const payload: PresencePayload = {
      mapX: Math.round(this.localX),
      mapY: Math.round(this.localY),
      viewedRoomId: this.localViewed,
    };
    if (pickupClueId) {
      payload.pickupClueId = pickupClueId;
    }
    this.events.emit("presence", payload);
    this.game.events.emit("presence", payload);
  }

  private canvasFocused(): boolean {
    const canvas = this.game.canvas;
    const active = document.activeElement;
    return active === canvas || active === canvas.parentElement;
  }

  private justDown(key?: Phaser.Input.Keyboard.Key): boolean {
    return Boolean(key && Phaser.Input.Keyboard.JustDown(key));
  }

  private unlockAudio = () => {
    if (this.sound.locked) {
      this.sound.unlock();
    }
  };

  private playSfx(event: SfxEvent) {
    this.unlockAudio();
    const spec = SFX_EVENTS[event];
    if (!this.cache.audio.exists(spec.key)) {
      return;
    }
    if (event === "quest_complete") {
      duckMusic();
    }
    this.sound.play(spec.key, { volume: spec.volume });
  }

  private drawTiles() {
    const cols = Math.ceil(CANVAS_WIDTH / TILE_DISPLAY);
    const rows = Math.ceil(CANVAS_HEIGHT / TILE_DISPLAY);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const edge = row === 0 || col === 0 || row === rows - 1 || col === cols - 1;
        this.add
          .image(
            col * TILE_DISPLAY,
            row * TILE_DISPLAY,
            TINY_DUNGEON_SHEET,
            frameFor(edge ? "wall" : "floor"),
          )
          .setOrigin(0)
          .setScale(SPRITE_SCALE)
          .setDepth(0);
      }
    }
  }

  private place(key: SpriteKey, x: number, y: number) {
    return this.add
      .image(x, y, TINY_DUNGEON_SHEET, frameFor(key))
      .setScale(SPRITE_SCALE)
      .setOrigin(0.5);
  }

  private hotspot(key: SpriteKey, x: number, y: number) {
    return this.place(key, x, y).setInteractive(
      new Phaser.Geom.Rectangle(-TILE_DISPLAY / 2, -TILE_DISPLAY / 2, TILE_DISPLAY, TILE_DISPLAY),
      Phaser.Geom.Rectangle.Contains,
    );
  }
}

export function createDungeonGame(parent: HTMLElement, nodes: DungeonNode[]) {
  return new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: "#101714",
    pixelArt: true,
    roundPixels: true,
    scene: [DungeonScene],
    callbacks: {
      preBoot: (game) => {
        game.registry.set("nodes", nodes);
      },
    },
  });
}
