import Phaser from "phaser";
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

export type DungeonNode = {
  id: string;
  title: string;
  x: number;
  y: number;
  kind: string;
};

export type BoardState = {
  currentRoomId: string;
  completed: Record<string, boolean>;
  canvasEvent?: string;
  seats: { id: string; color: string }[];
  inventory: string[];
  missed: boolean;
};

export class DungeonScene extends Phaser.Scene {
  private nodes: DungeonNode[] = [];
  private rooms = new Map<string, Phaser.GameObjects.Image>();
  private gems = new Map<string, Phaser.GameObjects.Image>();
  private party: Phaser.GameObjects.Image[] = [];
  private loot: Phaser.GameObjects.Image[] = [];
  private focus?: Phaser.GameObjects.Image;

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
      const room = this.place(roomSpriteKey(node.id), node.x, node.y).setDepth(1);
      this.rooms.set(node.id, room);
      const gem = this.place("gem_locked", node.x + 28, node.y - 40).setDepth(2);
      this.gems.set(node.id, gem);
      this.add
        .text(node.x, node.y + 28, node.title, {
          fontFamily: "IBM Plex Mono",
          fontSize: "12px",
          color: "#cfe7d4",
          align: "center",
          wordWrap: { width: 140 },
        })
        .setOrigin(0.5, 0)
        .setDepth(6);
    });
    this.focus = this.place("focus", 0, 0).setDepth(3).setVisible(false);
    this.events.on("board", (state: BoardState) => this.apply(state));
    this.apply({
      currentRoomId: "",
      completed: {},
      seats: [],
      inventory: [],
      missed: false,
    });
  }

  apply(state: BoardState) {
    this.nodes.forEach((node) => {
      const room = this.rooms.get(node.id);
      const gem = this.gems.get(node.id);
      if (!room || !gem) {
        return;
      }
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
      if (current) {
        this.tweens.add({
          targets: room,
          scale: SPRITE_SCALE * 1.15,
          duration: 600,
          yoyo: true,
          repeat: -1,
        });
      }
    });
    const current = this.nodes.find((node) => node.id === state.currentRoomId);
    if (this.focus) {
      if (current) {
        this.focus.setPosition(current.x, current.y).setVisible(true);
      } else {
        this.focus.setVisible(false);
      }
    }
    this.party.forEach((sprite) => sprite.destroy());
    this.party = [];
    if (current) {
      const offsets = [
        { x: -72, y: 52 },
        { x: -32, y: 52 },
        { x: 8, y: 52 },
        { x: 48, y: 52 },
      ];
      state.seats.forEach((seat, index) => {
        const key = seatSpriteKey(seat.id);
        if (!key) {
          return;
        }
        const spot = offsets[index] ?? offsets[0];
        this.party.push(this.place(key, current.x + spot.x, current.y + spot.y).setDepth(4));
      });
    }
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
