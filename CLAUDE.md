# Claude / Cursor — questshift-ui

Read `AGENTS.md` first (this repo), then the docs-repo map.

- GitHub: https://github.com/NA-FSI-Services/questshift/blob/main/AGENTS.md
- Local: `/Users/dtorresf/Documents/GitHub/na-fsi-services/questshift/questshift/AGENTS.md`

## Hard rules (v1 freeze)

- Phaser 3 + React + TypeScript. Quest lobby, then dual panel: pixel canvas + IBM Plex Mono terminal.
- Kenney Tiny Dungeon CC0 for sprites (`public/assets/kenney/tiny-dungeon/`). Kenney RPG Audio + Music Jingles CC0 for map SFX (`public/assets/kenney/sfx/`). Kenney Music Loops CC0 for looping beds (`public/assets/kenney/music/`). No AI assets. No TTS.
- Terminal is simulated. Never shell out `oc` / Ansible / Java from the browser.
- Campaign YAML / engine evaluator decide wins. UI does not invent puzzle answers.
- Each interior: south lobby door always open; north challenge door locked with that room's guardian until the YAML puzzle is solved, then an open north door into the next YAML room.
- Cosmetic seats. Pick character + alias in the lobby. Switch, abandon, and delete parties from the in-run topbar.
- Match `src/api/client.ts` to engine REST; do not add auth.
- Do not commit `.env` or API keys. UI has no auth in v1.
