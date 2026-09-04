import Phaser from "phaser";

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
};

export class DungeonScene extends Phaser.Scene {
  private nodes: DungeonNode[] = [];
  private sprites = new Map<string, Phaser.GameObjects.Arc>();
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private party: Phaser.GameObjects.Arc[] = [];
  private statusText?: Phaser.GameObjects.Text;

  constructor() {
    super("dungeon");
  }

  init(data: { nodes: DungeonNode[] }) {
    this.nodes = data.nodes;
  }

  create() {
    this.cameras.main.setBackgroundColor("#101714");
    this.add.rectangle(0, 0, 1600, 900, 0x101714).setOrigin(0);
    this.drawPath();
    this.nodes.forEach((node) => {
      const circle = this.add.circle(node.x, node.y, 28, 0x2a4a38).setStrokeStyle(3, 0x6bd68a);
      const label = this.add
        .text(node.x, node.y + 42, node.title, {
          fontFamily: "IBM Plex Mono",
          fontSize: "12px",
          color: "#cfe7d4",
          align: "center",
          wordWrap: { width: 140 },
        })
        .setOrigin(0.5, 0);
      this.sprites.set(node.id, circle);
      this.labels.set(node.id, label);
    });
    this.statusText = this.add.text(24, 16, "QuestShift", {
      fontFamily: "IBM Plex Mono",
      fontSize: "16px",
      color: "#8fe0a4",
    });
    this.events.on("board", (state: BoardState) => this.apply(state));
  }

  apply(state: BoardState) {
    this.nodes.forEach((node) => {
      const sprite = this.sprites.get(node.id);
      if (!sprite) {
        return;
      }
      const done = Boolean(state.completed[node.id]);
      const current = state.currentRoomId === node.id;
      sprite.setFillStyle(done ? 0x3f8f4f : current ? 0xc6a24a : 0x2a4a38);
      sprite.setScale(current ? 1.15 : 1);
    });
    this.party.forEach((dot) => dot.destroy());
    this.party = [];
    const current = this.nodes.find((n) => n.id === state.currentRoomId);
    if (current) {
      state.seats.forEach((seat, index) => {
        const color = Number.parseInt(seat.color.replace("#", ""), 16);
        const dot = this.add.circle(current.x - 24 + index * 16, current.y - 48, 6, color);
        this.party.push(dot);
      });
    }
    if (this.statusText) {
      this.statusText.setText(state.canvasEvent ? `event: ${state.canvasEvent}` : "QuestShift");
    }
  }

  private drawPath() {
    if (this.nodes.length < 2) {
      return;
    }
    const gfx = this.add.graphics();
    gfx.lineStyle(4, 0x3a5c44, 0.9);
    gfx.beginPath();
    gfx.moveTo(this.nodes[0].x, this.nodes[0].y);
    this.nodes.slice(1).forEach((node) => gfx.lineTo(node.x, node.y));
    gfx.strokePath();
  }
}

export function createDungeonGame(parent: HTMLElement, nodes: DungeonNode[]) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 900,
    height: 520,
    backgroundColor: "#101714",
    scene: [],
  });
  game.scene.add("dungeon", DungeonScene, true, { nodes });
  return game;
}
