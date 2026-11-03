# Release notes

## 0.2.0-SNAPSHOT

### Fixes

- **Combat sheet, Soviet losses:** only the unit that took the first hit had its counter; the other Soviet units hit were listed by name only.

### Improvements

- **Combat sheet, Soviet losses:** every Soviet unit hit is shown with its counter (steps lost, unit eliminated).
- **Combat sheet, 12.55 (Soviet Attacker Hit Reduction):** the note shows the calculation, e.g. "your units could absorb 4 of their 6 hits (retreat: 2 hexes, steps: 2): 4 − 2 = 2 Soviet hits".
- **"Your turn" banner:** once the Soviet impulse is over and the bot's counters have moved, a "YOUR TURN" banner fades in and out across the middle of the map (2 s). It says when the Soviet draw pile is empty, stays away while a Soviet attack waits for its combat, and never blocks the map.
