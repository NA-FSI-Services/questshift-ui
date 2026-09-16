import Phaser from "phaser";
import {
  atInteriorDoor,
  clueInReach,
  INTERIOR_DOOR,
  INTERIOR_SPAWN,
  nearestUnlockedRoom,
  overworldSpawn,
  roomUnlocked,
  stepToward,
} from "../map";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  frameFor,
  gemKeyFor,
  LOOT_ORDER,
  lootSpriteKey,
  roomSpriteKey,
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
import { bindWalkKeys } from "../walkKeys";

export type DungeonNode = {
  id: string;
  title: string;
  x: number;
  y: number;
  kind: string;
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
};

export type BoardState = {
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

  constructor() {
    super("dungeon");
  }

  init(data?: { nodes?: DungeonNode[] }) {
    this.nodes = data?.nodes ?? this.registry.get("nodes") ?? [];
  }

  preload() {
    this.load.spritesheet(SPRITESHEET_LOAD.key, SPRITESHEET_LOAD.url, SPRITESHEET_LOAD.frameConfig);
  }

  create() {
    this.cameras.main.setBackgroundColor("#101714");
    this.drawTiles();
    this.nodes.forEach((node) => {
      const room = this.hotspot(roomSpriteKey(node.id), node.x, node.y).setDepth(1);
      room.on("pointerdown", () => this.tryEnter(node.id));
      this.rooms.set(node.id, room);
      const gem = this.place("gem_locked", node.x + 28, node.y - 40).setDepth(2);
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
    if (!this.localViewed) {
      return;
    }
    const node = this.nodes.find((item) => item.id === this.localViewed);
    this.interior.push(
      this.add
        .text(CANVAS_WIDTH / 2, 28, node?.title ?? this.localViewed, {
          fontFamily: "IBM Plex Mono",
          fontSize: "16px",
          color: "#e0b25a",
        })
        .setOrigin(0.5, 0)
        .setDepth(8),
    );
    const door = this.hotspot("door", INTERIOR_DOOR.x, INTERIOR_DOOR.y).setDepth(4);
    door.on("pointerdown", () => this.leaveRoom());
    this.interior.push(door);
    state.clues
      .filter((clue) => clue.roomId === this.localViewed && !state.foundClues.includes(clue.id))
      .forEach((clue) => {
        const chest = this.hotspot("clue", clue.x, clue.y).setDepth(4);
        chest.on("pointerdown", () => this.pickClue(clue.id));
        this.interior.push(chest);
      });
  }

  private act() {
    if (this.localViewed) {
      if (atInteriorDoor(this.localX, this.localY)) {
        this.leaveRoom();
        return;
      }
      const roomClues = this.board.clues.filter((clue) => clue.roomId === this.localViewed);
      const clue = clueInReach(this.localX, this.localY, roomClues, this.board.foundClues);
      if (clue) {
        this.pickClue(clue.id);
      }
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

  private tryEnter(roomId: string) {
    if (!this.board.meName || this.localViewed) {
      return;
    }
    if (!roomUnlocked(roomId, this.board.currentRoomId, this.board.completed)) {
      return;
    }
    this.localViewed = roomId;
    this.localX = INTERIOR_SPAWN.x;
    this.localY = INTERIOR_SPAWN.y;
    this.poseSelf();
    this.apply(this.board);
    this.emitPresence(true);
  }

  private pickClue(clueId: string) {
    if (!this.localViewed || this.board.foundClues.includes(clueId)) {
      return;
    }
    this.board = {
      ...this.board,
      foundClues: [...this.board.foundClues, clueId],
    };
    this.drawInterior(this.board);
    this.emitPresence(true, clueId);
  }

  private leaveRoom() {
    if (!this.localViewed) {
      return;
    }
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
