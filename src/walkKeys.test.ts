import { describe, expect, it, vi } from "vitest";
import { bindWalkKeys, CAPTURE_MAP_KEYS, MAP_KEY_CODES } from "./walkKeys";

describe("bindWalkKeys", () => {
  it("does not capture WASD, E, space, or arrows so the terminal can type them", () => {
    const addKey = vi.fn((code: number) => ({ keyCode: code }));
    const addKeys = vi.fn((keys: Record<string, number>) => keys);
    const disableGlobalCapture = vi.fn();
    const clearCaptures = vi.fn();
    bindWalkKeys({
      addKey,
      addKeys,
      disableGlobalCapture,
      clearCaptures,
    });
    expect(CAPTURE_MAP_KEYS).toBe(false);
    expect(disableGlobalCapture).toHaveBeenCalled();
    expect(clearCaptures).toHaveBeenCalled();
    expect(addKeys).toHaveBeenCalledWith(
      expect.objectContaining({ space: MAP_KEY_CODES.SPACE }),
      false,
    );
    for (const call of addKey.mock.calls) {
      expect(call[1]).toBe(false);
    }
    const codes = addKey.mock.calls.map((call) => call[0]);
    expect(codes).toEqual(
      expect.arrayContaining([
        MAP_KEY_CODES.W,
        MAP_KEY_CODES.A,
        MAP_KEY_CODES.S,
        MAP_KEY_CODES.D,
        MAP_KEY_CODES.E,
      ]),
    );
  });
});
