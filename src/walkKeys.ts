/** Phaser's default addKey() calls preventDefault, which blocks typing in the terminal. */
export const CAPTURE_MAP_KEYS = false;

export const MAP_KEY_CODES = {
  W: 87,
  A: 65,
  S: 83,
  D: 68,
  E: 69,
  ENTER: 13,
  ESC: 27,
  UP: 38,
  DOWN: 40,
  LEFT: 37,
  RIGHT: 39,
  SPACE: 32,
  SHIFT: 16,
} as const;

export type WalkKeyBind = {
  keyCode?: number;
  isDown?: boolean;
};

export type WalkKeyboard = {
  disableGlobalCapture: () => void;
  clearCaptures: () => void;
  addKey: (code: number, capture?: boolean) => WalkKeyBind | undefined;
  addKeys: (keys: Record<string, number>, capture?: boolean) => object;
};

export function bindWalkKeys(keyboard: WalkKeyboard) {
  keyboard.disableGlobalCapture();
  keyboard.clearCaptures();
  return {
    cursors: keyboard.addKeys(
      {
        up: MAP_KEY_CODES.UP,
        down: MAP_KEY_CODES.DOWN,
        left: MAP_KEY_CODES.LEFT,
        right: MAP_KEY_CODES.RIGHT,
        space: MAP_KEY_CODES.SPACE,
        shift: MAP_KEY_CODES.SHIFT,
      },
      CAPTURE_MAP_KEYS,
    ) as {
      left?: WalkKeyBind;
      right?: WalkKeyBind;
      up?: WalkKeyBind;
      down?: WalkKeyBind;
      space?: WalkKeyBind;
    },
    W: keyboard.addKey(MAP_KEY_CODES.W, CAPTURE_MAP_KEYS),
    A: keyboard.addKey(MAP_KEY_CODES.A, CAPTURE_MAP_KEYS),
    S: keyboard.addKey(MAP_KEY_CODES.S, CAPTURE_MAP_KEYS),
    D: keyboard.addKey(MAP_KEY_CODES.D, CAPTURE_MAP_KEYS),
    E: keyboard.addKey(MAP_KEY_CODES.E, CAPTURE_MAP_KEYS),
    Enter: keyboard.addKey(MAP_KEY_CODES.ENTER, CAPTURE_MAP_KEYS),
    Esc: keyboard.addKey(MAP_KEY_CODES.ESC, CAPTURE_MAP_KEYS),
  };
}
