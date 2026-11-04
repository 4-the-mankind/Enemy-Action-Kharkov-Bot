# Release notes

## 0.2.0-SNAPSHOT

### Fixes

- **Combat sheet, Soviet losses:** only the unit that took the first hit had its counter; the other Soviet units hit were listed by name only.
- **Combat sheet, decision steps:** under a Soviet reserve placement (or a loss or a tactic), the rule text of each step was squeezed into a narrow column, one word per line, beside its hexes; it now reads on full lines with the hexes after it.
- **Bot tab, Next turn:** the card reading and the orders of the last Soviet impulse of the turn before stayed on show; the tab is now cleared when a new turn starts, as if the bot had not played yet.

### Improvements

- **Combat sheet, Soviet losses:** every Soviet unit hit is shown with its counter (steps lost, unit eliminated).
- **Combat sheet, 12.55 (Soviet Attacker Hit Reduction):** the note shows the calculation, e.g. "your units could absorb 4 of their 6 hits (retreat: 2 hexes, steps: 2): 4 − 2 = 2 Soviet hits".
- **"Your turn" banner:** once the Soviet impulse is over and the bot's counters have moved, a "YOUR TURN" banner fades in and out across the middle of the map (2 s). It says when the Soviet draw pile is empty, stays away while a Soviet attack waits for its combat, and never blocks the map.
- **Undo stops at the start of your German impulse:** Start, Next turn and the bot's Soviet impulse can no longer be undone (Undo on a combat sheet goes back to the sheet's first step at most). When Undo is greyed out, its tooltip says why. "Undo the last turn" at the end of the game still works.
- **Redo:** a "Redo" button next to Undo (turn bar and combat sheet), or Ctrl + Y / Ctrl + Shift + Z, plays again what you just undid, as long as you have not taken another action.
- **Supply Phase notice:** after Next turn, a slip in the middle of the map lists what the Supply Phase did, one step after the other: Soviet garrisons placed, then for each side the supply markers gained or removed and the surrenders this turn, and the Out of Supply and Isolated markers now on the map; the Soviet support line and the front objectives removed when they apply. In a heavy mud turn, it lists the markers removed. "Run bot impulse" and "Next turn" wait until you click "Continue to command phase".
- **Combat sheet, chit situations:** the list now comes from the real combat chits: every ratio printed on a chit (1.5:1 to 9:1 or more, below 1:1 to below 4:1), attacker and defender artillery, attacker command with its values, and attack, defender or Soviets not supported from game-turn 5.
- **German surrender (13.23):** an isolated German unit alone in its hex that still can't trace supply loses its step by itself (destroyed and out of play on its last step). For a stack, the Supply Phase notice lists its units: click the one that loses the step. "Continue to command phase", "Run bot impulse" and "Next turn" wait until every stack has lost its step. Undo takes back the choice.
