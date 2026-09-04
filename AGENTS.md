# Agent notes — questshift-ui

Canonical map:

- GitHub: https://github.com/NA-FSI-Services/questshift/blob/main/AGENTS.md
- Local: `/Users/dtorresf/Documents/GitHub/na-fsi-services/questshift/questshift/AGENTS.md`

Read essentials, then UX sprite keys:

- GitHub: https://github.com/NA-FSI-Services/questshift/blob/main/docs/ARCHITECTURE-ESSENTIALS.md
- Local: `/Users/dtorresf/Documents/GitHub/na-fsi-services/questshift/questshift/docs/ARCHITECTURE-ESSENTIALS.md`
- GitHub: https://github.com/NA-FSI-Services/questshift/blob/main/docs/UX.md
- Local: `/Users/dtorresf/Documents/GitHub/na-fsi-services/questshift/questshift/docs/UX.md`

## This repo

Phaser 3 + React + TypeScript. Vite proxies `/api` and `/ws` to `localhost:8080`.

- Panel A: pixel dungeon (`src/game/DungeonScene.ts`). Panel B: IBM Plex Mono terminal (`src/terminal/TerminalPanel.tsx`).
- Sprite sheet: `public/assets/kenney/tiny-dungeon/tilemap_packed.png` (Kenney CC0). Use named keys in UX.md. No AI-generated images.
- Seats are cosmetic. Do not gate commands by seat.
- No TTS, mic, or Web Speech.
- Do not commit `.env` or API keys (already gitignored). v1 UI has no auth.
- Run: `npm install && npm run dev` (engine already on `:8080`).
