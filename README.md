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

Vite proxies `/api` and `/ws` to the Quarkus engine.

## Layout

```text
src/
  App.tsx                 dual-panel shell
  game/DungeonScene.ts    Phaser board
  terminal/TerminalPanel.tsx
  api/client.ts           REST helpers
```
