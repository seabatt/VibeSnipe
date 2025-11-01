# 🎯 VibeSnipe — Engineering Tasks (Phase 1)

## E1 Authentication & Session
- [ ] Implement real Tastytrade /sessions login, store token & account ID.
- [ ] Token refresh & error handling.

## E2 Quotes, Chains & Delta Locator
- [ ] Replace mock QuoteBus with real WebSocket feed.
- [ ] Cache option chains, compute nearest 50Δ strikes.
- [ ] Validate width ≤10, correct rights, price increments (0.05).

## E3 Order Builder & Parsing
- [ ] Parse Discord trade text to legs & metadata.
- [ ] Preflight validation (width, rights, tick, risk %).
- [ ] Nudge: price ± tick, strike ± step via cancel/replace.

## E4 Trade Entry Flows
- [ ] Discord Paste, Preset (auto-armed), Manual Build (Δ-snap).
- [ ] Shared Preview: Spread Price (Bid·Mid·Ask·Last), Max Loss/Gain, Breakevens, Risk Graph, TP/SL/time-exit, Nudge.
- [ ] Confirm modal → Execute via API.

## E5 Risk Graph
- [ ] Plotly.js curve + TP/SL bands + live cursor.
- [ ] 200 ms motion, high contrast, tabular numbers.

## E6 Discipline Engine & Day HUD
- [ ] Load schedule.json; countdown; scalp counter x/3; exposure meters; Next block.
- [ ] Dual 13:30 tabs; re-arm < 250 ms; soft/hard locks + override.

## E7 Positions Panel
- [ ] Tiles: symbol, strategy, qty, P/L ring, TP/SL bars, mini risk curve, state chip.
- [ ] Actions: Close @ Mid ±1 tick, Change Target, Change Stop.
- [ ] Handles 20+ positions cleanly.

## E8 Theme & Design System
- [ ] Light/Dark tokens, semantic colors, Inter Tabular Lining, contrast ≥ 4.5:1.
- [ ] Charts recolor instantly (<100 ms) on theme switch.

## E9 Phase 2 Market View
- [ ] Embed live SPX chart (lightweight-charts). Toggle panel view.
- [ ] Theme parity and smooth performance.

## E10 QA & Stress Tests
- [ ] Stale quotes > 2 s, wide bid/ask, dual blocks, 20 positions.
- [ ] Keyboard shortcuts ⌘V, Enter, ↑/↓, ⇧↑/⇧↓.

### ✅ MVP Goal
User can connect account, paste alert, preview + execute, see live P/L + risk graph, manage positions, HUD active.
