# QuestShift UI

Phaser 3 + React dual-panel client for [QuestShift](https://github.com/NA-FSI-Services/questshift).

- **Panel A:** 2D dungeon board (rooms, avatars, status)
- **Panel B:** retro terminal for Game Master text and command input
- Voice / TTS is intentionally absent in v1

## Run locally

Node 22+. Engine should already be on `:8080`.

```bash
npm install
npm run dev
```

Vite proxies `/api` and `/ws` to the Quarkus engine. Panel B **export.yaml** / **import.yaml** persist the run through the engine (`POST /api/sessions/import`).

## Quality gates

```bash
npm run format:check   # Prettier
npm run lint           # ESLint (static analysis)
npm run test:coverage  # Vitest, ≥ 80% lines / 70% branches (excludes Phaser canvas)
npm run verify         # format + lint + coverage + production build
```

Pre-commit (once per clone): `./.githooks/install`. PRs to `main` run **Quality** / **Format, lint, coverage**.

## Layout

```text
src/
  App.tsx                 dual-panel shell
  game/DungeonScene.ts    Phaser board
  terminal/TerminalPanel.tsx
  api/client.ts           REST helpers
```
