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
- Kenney Tiny Dungeon CC0 for sprites; Kenney RPG Audio + Music Jingles CC0 for map SFX (`public/assets/kenney/sfx/`). Named keys in UX.md. No AI images. No TTS.
- Seats are cosmetic. Do not gate commands by seat.
- No TTS, mic, or Web Speech.
- Do not commit `.env` or API keys (already gitignored). v1 UI has no auth.
- Run: `npm install && npm run dev` (engine already on `:8080`).
- Quality: `npm run verify` (Prettier, ESLint, Vitest ≥ 80% lines / 70% branches, `tsc`+Vite build). Pre-commit: `./.githooks/install`. CI: `.github/workflows/quality.yml`. Dependabot: `.github/dependabot.yml` (weekly GitHub Actions).
