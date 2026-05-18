# chess.coach — progress + next session

## DONE so far

### Session 1 (foundations)
- TopNav (sticky, active-tab) used on all pages
- Toast system (ToastProvider + useToast)
- Home: gradient hero, QuickStart preset cards, HomeStats strip
- PlayScreen: 3-col grid, ControlBar (Hint/Undo/Resign/Explore + nav), GameStatusBanner, keybinds N/R/U/H/E + Home/End/Esc + arrows
- MoveHistory: filters (all/bad/mine), auto-scroll, blunder jump, clickable cells
- Settings: ELO tier label, NIM test button, reset defaults, section icons
- History: stats strip, filters, search, sort, delete, skeleton loaders
- KeyboardHelp (`?` overlay)
- EvalGraph (sparkline, click to jump)
- globals.css: btn-sm/btn-icon/btn-ghost, kbd styling, animations, focus rings

### Session 2 (UX + learning)
- Layout swap: Moves big (540px), Coach collapsed by default
- Opening detection (~50 ECO entries) + OpeningBadge above board
- GameSummary modal: accuracy %, label counts, biggest blunder, best move, blunder list w/ jumps, copy PGN
- Flip board button + `F` keybind, settings persist
- Best-move arrow in review (toggle in settings)
- Board themes: Wood / Green / Blue / Slate w/ swatch picker
- Coordinates toggle
- Animations toggle
- Kid mode (single-ply undo)
- PGN copy to clipboard
- lib/analysis.ts (Lichess-style accuracy)

---

## TODO next session

### bugs to fix
- **Black play still broken**
  - investigate: when userColor='b', first SF move fires but board orientation / movable color may still be off after explore/review or after game ends
  - check Board.tsx `movable.color` — currently always `baseOrient` even though when flipped, user still plays same color (color is who you ARE, not which side is at bottom). Bug: flip should not change movable.
  - clock side mapping in PlayerTag after flip — top/bottom recompute looked off
  - test: start as black w/ several time controls + flip toggle + explore

### context-aware coach (priority — user-requested)
- Coach panel currently always shows LAST user move
- When `viewIndex !== null` (reviewing) → coach should show analysis for `history[viewIndex]`
- Refactor CoachPanel:
  - read `viewIndex`, pick `targetMove = viewIndex != null ? history[viewIndex] : lastUserMove`
  - show: SAN, label, cpLoss, best-move SAN, all flags as chips
  - "Ask coach why" → trigger explain for THAT move (not last user move)
  - store: change `requestExplanation()` to accept a ply index or read current viewIndex
  - on hover/click any move in MoveHistory → setViewIndex → coach updates automatically

### board annotations (user-requested)
- letters and numbers on the board like a b c d e f.. 1 2 3 4 5 6... 
- Right-click drag = arrow (chessground supports natively via `drawable.shapes`)
- Right-click single square = highlight (red circle)
- Already enabled via `drawable: { enabled: true }` — verify it works
- Persist annotations per ply in MoveRecord? optional
- Clear-all-annotations button
- Show LLM-suggested lines as faded arrows when coach explains

### visual "what would have happened"
- When reviewing a blunder, show arrows for SF's punishment line (top-3 plies of best variation)
- Use `move.topLines[0].pv` — render first 2-3 plies as fading arrows
- Toggle: "Show consequence" button on coach panel

### more learning features
- **Puzzles mode** — drill tactics from your own blunders
  - extract blunder positions from history, replay as puzzles ("you blundered here — find the right move")
- **Opening trainer** — pick an opening, drill first 8-12 moves
- **Hint costs** — track how many hints used per game, show in summary
- **Streak tracker** — daily play, consecutive days
- **Personal weakness report** — which detector flags fire most (you hang pieces often, you miss forks)
- **"Explain this position"** button — not just last move, current position summary
- **Pre-move support** — queue move during opponent's think time
- **Takeback request** in non-kid mode (limit 1 per game)

### nice-to-haves
- PGN import (paste game → analyze)
- Share link (encode game in URL hash → load on open)
- Mobile drawer for move list (currently 3-col cramped)
- Promotion picker styled w/ board piece set (not unicode glyphs)
- First-time tour (5-step overlay walking through UI)
- Onboarding when no NIM key: "skip — Stockfish still works"
- Dark/light theme toggle (currently dark only)
- Time-control: custom input (not just presets)
- Engine-vs-engine spectate mode

### code cleanup
- Extract `useGameKeyboard` hook from PlayScreen (130 lines of useEffect)
- Split PlayScreen: it's now 450 lines — pull `runMoveReview` into `lib/review.ts`
- GameStatusBanner: kid-mode wording ("Oops! Try again?" instead of "blunder")
- Coach panel: kid-mode = encouraging tone

### testing checklist
- [ ] Play full game as white, finish via checkmate → summary fires
- [ ] Play full game as black → opponent opens, summary correct
- [ ] Resign → save → reload → game in history
- [ ] History page: click old game → loads in review, all arrows work
- [ ] Flip board mid-game → moves still work
- [ ] Theme change mid-game → board updates without redraw glitch
- [ ] Kid mode: undo single ply works
- [ ] PGN copy → paste into lichess analysis → loads correctly
- [ ] Mobile: < 768px, verify scroll/stack behavior
