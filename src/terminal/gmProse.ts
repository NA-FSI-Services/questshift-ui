/** Player-facing GM text. Never show puzzle JSON (regex, canvas_event, puzzle_type). */
export function gmProse(raw: string | undefined | null): string {
  if (!raw) {
    return "";
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  const fromJson = narrativeField(trimmed);
  if (fromJson) {
    return fromJson;
  }
  if (looksLikeGmJson(trimmed)) {
    return "";
  }
  return trimmed;
}

function looksLikeGmJson(text: string): boolean {
  return (
    text.startsWith("{") &&
    (text.includes('"puzzle_type"') ||
      text.includes('"expected_command_pattern"') ||
      text.includes('"canvas_event"'))
  );
}

function narrativeField(text: string): string {
  try {
    const parsed = JSON.parse(text) as { narrative?: unknown };
    if (typeof parsed.narrative === "string" && parsed.narrative.trim()) {
      return parsed.narrative.trim();
    }
  } catch {
    try {
      const parsed = JSON.parse(text.replaceAll("\\$", "$")) as { narrative?: unknown };
      if (typeof parsed.narrative === "string" && parsed.narrative.trim()) {
        return parsed.narrative.trim();
      }
    } catch {
      // Granite often emits invalid JSON; scan the narrative string next.
    }
  }
  const key = '"narrative"';
  const keyAt = text.indexOf(key);
  if (keyAt < 0) {
    return "";
  }
  const colon = text.indexOf(":", keyAt + key.length);
  const quote = text.indexOf('"', colon + 1);
  if (colon < 0 || quote < 0) {
    return "";
  }
  let prose = "";
  for (let i = quote + 1; i < text.length; i += 1) {
    const c = text[i];
    if (c === "\\" && i + 1 < text.length) {
      i += 1;
      const next = text[i];
      prose +=
        next === "n"
          ? "\n"
          : next === "t"
            ? "\t"
            : next === "r"
              ? "\r"
              : next === '"'
                ? '"'
                : next === "\\"
                  ? "\\"
                  : next === "/"
                    ? "/"
                    : next;
      continue;
    }
    if (c === '"') {
      return prose.trim();
    }
    prose += c;
  }
  return "";
}
