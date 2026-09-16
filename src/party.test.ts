import { describe, expect, it } from "vitest";
import { isSeatId, memberKey, suggestAlias } from "./party";

describe("suggestAlias", () => {
  it("returns the first unused seat-themed name", () => {
    expect(suggestAlias("guardian", [])).toBe("Ada");
    expect(suggestAlias("guardian", ["Ada"])).toBe("Briar");
    expect(suggestAlias("automancer", ["Linus", "ember"])).toBe("Forge");
    expect(suggestAlias("wizard", [])).toBe("Ada");
  });
});

describe("seat helpers", () => {
  it("recognizes cosmetic seats and alias keys", () => {
    expect(isSeatId("guardian")).toBe(true);
    expect(isSeatId("wizard")).toBe(false);
    expect(memberKey({ name: " Ada ", seatId: "guardian" })).toBe("ada");
  });
});
