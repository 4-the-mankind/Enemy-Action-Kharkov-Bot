# Release notes

## 0.2.0

### Fixes

- **Combat sheet, Soviet losses:** only the unit that took the first hit had its counter; the other Soviet units hit were listed by name only.
- **Combat sheet, decision steps:** under a Soviet reserve placement (or a loss or a tactic), the rule text of each step was squeezed into a narrow column, one word per line, beside its hexes; it now reads on full lines with the hexes after it.
- **Bot decision details, pointing at a step:** the map outlined the hexes the step set aside, while the panel shows the hexes it kept in black; the map now outlines the hexes kept, the unit's hex with them (dark dashed edge over its red edge, dark inside).
- **Bot decision details during a combat:** back on the Bot or Log tab while a combat is on, the map outlines the unit's hex and the hexes of the step pointed at again; they step aside only while the Combat tab is open.
- **Bot tab, Next turn:** the card reading and the orders of the last Soviet impulse of the turn before stayed on show; the tab is now cleared when a new turn starts, as if the bot had not played yet.

### Improvements

- **Log tab, by turn and impulse:** a "Show" list above the log picks one turn (the current turn by default) or all turns. Each German and Soviet impulse has its own panel ("German impulse 2", "Soviet impulse 2"), newest first, its lines in play order. Panels are open in the current turn and with all turns shown, closed in a past turn; a panel you closed opens again when a new line arrives in it. Next turn brings the list to the new turn.
- **Overlays tab, map legend:** the legend now explains every mark drawn on the map, in five groups: bot moves, combat (Soviet and German attacks, retreat and advance hexes, Kampfgruppe range), supply lines, moving German units (reachable hexes, drop hex, drop refused), pointer and selection. The Printed map, Units and Fit map buttons now sit above it.
- **Right-hand panel tabs:** the tabs now read Bot, Combat, Log, Overlays.
- **Combat sheet, Soviet losses:** every Soviet unit hit is shown with its counter (steps lost, unit eliminated).
- **Combat sheet, 12.55 (Soviet Attacker Hit Reduction):** the note shows the calculation, e.g. "your units could absorb 4 of their 6 hits (retreat: 2 hexes, steps: 2): 4 − 2 = 2 Soviet hits".
- **"Your turn" banner:** once the Soviet impulse is over and the bot's counters have moved, a "YOUR TURN" banner fades in and out across the middle of the map (2 s). It says when the Soviet draw pile is empty, stays away while a Soviet attack waits for its combat, and never blocks the map.
- **Undo stops at the start of your German impulse:** Start, Next turn and the bot's Soviet impulse can no longer be undone (Undo on a combat sheet goes back to the sheet's first step at most). When Undo is greyed out, its tooltip says why. "Undo the last turn" at the end of the game still works.
- **Redo:** a "Redo" button next to Undo (turn bar and combat sheet), or Ctrl + Y / Ctrl + Shift + Z, plays again what you just undid, as long as you have not taken another action.
- **Supply Phase notice:** after Next turn, a slip in the middle of the map lists what the Supply Phase did, one step after the other: Soviet garrisons placed, then for each side the supply markers gained or removed and the surrenders this turn, and the Out of Supply and Isolated markers now on the map; the Soviet support line and the front objectives removed when they apply. In a heavy mud turn, it lists the markers removed. "Run bot impulse" and "Next turn" wait until you click "Continue to command phase".
- **Combat sheet, chit situations:** the list now comes from the real combat chits: every ratio printed on a chit (1.5:1 to 9:1 or more, below 1:1 to below 4:1), attacker and defender artillery, attacker command with its values, and attack, defender or Soviets not supported from game-turn 5. Large attack shows the chits it needs ("large attack: 7 needed" in a Soviet attack, 6 in a German attack).
- **Attack from the right-click menu:** on a Soviet hex, "Attack" now shows first even when no German counter is selected, greyed out, with how to select the attacking units (during your German impulse, outside a combat).
- **German attack arrows:** a German attack now shows the same arrows as a Soviet attack, in Prussian blue, from each attacking hex into the hex attacked; they fade when the combat ends.
- **German surrender (13.23):** an isolated German unit alone in its hex that still can't trace supply loses its step by itself (destroyed and out of play on its last step). For a stack, the Supply Phase notice lists its units: click the one that loses the step. "Continue to command phase", "Run bot impulse" and "Next turn" wait until every stack has lost its step. Undo takes back the choice.
