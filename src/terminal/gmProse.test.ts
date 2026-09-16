import { describe, expect, it } from "vitest";
import { gmProse } from "./gmProse";

const leaked = `{
  "narrative": "A shell golem blocks the gate. Its chest is a log file that never ends.",
  "puzzle_type": "linux",
  "expected_command_pattern": "(?s).*grep.*-i.*rune.*awk.*\\$NF.*",
  "hint": "Use grep, then awk.",
  "canvas_event": "focus_room"
}`;

describe("gmProse", () => {
  it("returns plain narrative unchanged", () => {
    expect(gmProse("Torchlight on brushed metal.")).toBe("Torchlight on brushed metal.");
  });

  it("extracts narrative from Game Master JSON", () => {
    expect(gmProse('{"narrative":"The golem cracks.","puzzle_type":"linux"}')).toBe(
      "The golem cracks.",
    );
  });

  it("extracts narrative when Granite emits invalid \\$ escapes", () => {
    const raw = `{
  "narrative": "A shell golem blocks the gate.",
  "puzzle_type": "linux",
  "expected_command_pattern": "(?s).*awk.*\\$NF.*",
  "hint": "pipe",
  "canvas_event": "focus_room"
}`;
    expect(gmProse(raw)).toBe("A shell golem blocks the gate.");
    expect(gmProse(raw)).not.toContain("expected_command_pattern");
    expect(gmProse(raw)).not.toContain("puzzle_type");
  });

  it("hides a GM JSON blob when narrative cannot be read", () => {
    expect(gmProse('{"puzzle_type":"linux","canvas_event":"focus_room"}')).toBe("");
  });

  it("does not leak regex from the captured console payload shape", () => {
    const prose = gmProse(leaked);
    expect(prose).toContain("shell golem");
    expect(prose).not.toContain("expected_command_pattern");
    expect(prose).not.toContain("canvas_event");
  });
});
