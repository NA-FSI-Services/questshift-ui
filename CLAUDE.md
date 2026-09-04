# Claude / Cursor — questshift-ui

Read `AGENTS.md` first (this repo), then the docs-repo map.

- GitHub: https://github.com/NA-FSI-Services/questshift/blob/main/AGENTS.md
- Local: `/Users/dtorresf/Documents/GitHub/na-fsi-services/questshift/questshift/AGENTS.md`

## Hard rules (v1 freeze)

- Phaser 3 + React + TypeScript. Dual panel: pixel canvas + IBM Plex Mono terminal.
- Kenney Tiny Dungeon CC0 only for sprites (`public/assets/`). No AI images. No TTS.
- Terminal is simulated. Never shell out `oc` / Ansible / Java from the browser.
- Campaign YAML / engine evaluator decide wins. UI does not invent puzzle answers.
- One party, cosmetic seats. No multi-party UI.
- Match `src/api/client.ts` to engine REST; do not add auth or extra verbs.
- Do not commit `.env` or API keys. UI has no auth in v1.
