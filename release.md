# Release notes

## 0.2.0-SNAPSHOT

### Fixes

- **Combat sheet, Soviet losses:** only the unit that took the first hit had its counter; the other Soviet units hit were listed by name only.

### Improvements

- **Combat sheet, Soviet losses:** every Soviet unit hit is shown with its counter (steps lost, unit eliminated).
- **Combat sheet, 12.55 (Soviet Attacker Hit Reduction):** the note shows the calculation, e.g. "your units could absorb 4 of their 6 hits (retreat: 2 hexes, steps: 2): 4 − 2 = 2 Soviet hits".
- **"Your turn" banner:** once the Soviet impulse is over and the bot's counters have moved, a "YOUR TURN" banner fades in and out across the middle of the map (2 s). It says when the Soviet draw pile is empty, stays away while a Soviet attack waits for its combat, and never blocks the map.
- **Undo stops at the start of your German impulse:** Start, Next turn and the bot's Soviet impulse can no longer be undone (Undo on a combat sheet goes back to the sheet's first step at most). When Undo is greyed out, its tooltip says why. "Undo the last turn" at the end of the game still works.
- **Redo:** a "Redo" button next to Undo (turn bar and combat sheet), or Ctrl + Y / Ctrl + Shift + Z, plays again what you just undid, as long as you have not taken another action.
