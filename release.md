# Release notes

## 0.2.0-SNAPSHOT

### Fixes

- **Bug 2 — Soviet losses in combat (2026-11-03).** The engine already followed 12.55 (Soviet Attacker Hit Reduction): 6 German hits, 4 of which could be absorbed (2-hex retreat + 2 steps), so 4 − 2 = 2 Soviet hits. The display was the problem. Developer's choice: option 2 (counters and a detailed 12.55 note).
  - The Soviet losses report keeps the 12.55 details (`reduction`: German hits, retreat hexes, steps). The combat sheet note shows the calculation.
  - Every Soviet unit hit after the first hit is shown with its counter (steps lost, unit eliminated).

### Decisions

- **Saves from an earlier version (2026-11-03).** A field added to the game state (e.g. the 12.55 details) makes the Q91 comparison fail when a combat is open. The save then loads without its log or Undo, with the old display (short 12.55 note). The "loaded as it was saved" message depends on the replayed state, not on the version. Developer's choice: option 1, no change. Options set aside: (2) `sameState` ignores fields missing from the saved state; (3) always keep the replayed state when no command is refused.
