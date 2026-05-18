# chess.coach

> **🚧 WIP — more features upcoming.** Active development. Puzzle mode, weakness reports, right-click annotations, consequence arrows for blunders, and a viewIndex-aware coach are next. See `TODO.md`.

Local Stockfish-powered chess coach. Play against the engine in your browser. Every move classified instantly. Optional LLM commentary explains the why.

## What it does

- Play vs Stockfish 18 (WASM, runs in your browser — no server engine)
- Every move classified: **Best / Good / Inaccuracy / Mistake / Blunder**
- 12 internal detectors (hung piece, missed mate, allowed fork, early queen, lost tempo, etc) feed an LLM coach
- Hint mode shows top-3 engine arrows on the board
- Smart eval bar with smooth transitions
- Captured material + point lead beside player tags
- ← / → arrow keys to scrub through played moves
- **Explore mode**: branch from any position, move both sides, see what would've happened, then return to your live game
- Time controls: unlimited, 1+0 through 30+0, plus increment variants
- Post-game analysis from the same screen
- Firebase Google sign-in + Firestore game history
- Optional NVIDIA NIM (any model) for natural-language move explanations

## Stack

- Next.js 15 + React 19
- Tailwind 3
- `chess.js` for rules · `chessground` (Lichess board) for UI
- `stockfish@18` WASM, multi-threaded build when crossOriginIsolated
- `zustand` for state
- Firebase Auth + Firestore (optional)
- NVIDIA NIM via internal `/api/coach` edge proxy (avoids CORS)

## Develop

```bash
pnpm install
pnpm dev
```

First run copies Stockfish + chessground assets from `node_modules/` into `public/`.

### Firebase (optional)

Create a Firebase project, enable Google Auth and Firestore, then drop the config into `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### NVIDIA NIM (optional)

Get a free key at [build.nvidia.com](https://build.nvidia.com), paste into Settings → AI coach. Stored only in browser localStorage. Calls go through the internal `/api/coach` route to avoid CORS issues.

## Deploy

Vercel works out of the box. The headers in `next.config.mjs` (COOP `same-origin` + COEP `require-corp`) enable multi-threaded Stockfish via `SharedArrayBuffer`.

## Controls

| Action | Input |
|---|---|
| Move | drag-and-drop or click squares |
| Toggle hints | Hint button |
| Step backward | ← |
| Step forward | → |
| Jump to first move | Home |
| Return to live | Esc / End |
| Explore branch | Explore button |
| Reset branch | Reset |
| Exit branch | Exit explore |

## License

MIT.
