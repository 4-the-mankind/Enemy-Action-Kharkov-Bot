<img width="2160" height="2700" alt="00-poster" src="https://github.com/user-attachments/assets/ed0d27ea-67c8-44c4-8357-16d3195c9d86" />

# EA Kharkov Bot

**A Soviet bot for _Enemy Action: Kharkov_ – German Solo.**
You command the Germans. The app plays the Soviet side of the solo game for you: it draws the Soviet cards, moves and attacks with the Soviet units, and checks supply. Every decision is traced to its rule.

**▶ Play now: [4-the-mankind.github.io/Enemy-Action-Kharkov-Bot](https://4-the-mankind.github.io/Enemy-Action-Kharkov-Bot/)**. It runs in your browser, with nothing to install and no account.

> **Beta.** The whole campaign (game-turns 1 to 14) is playable, but bugs are still possible. See the [release notes](release.md).

---

## Contents

- [What you need](#what-you-need)
- [Features](#features)
- [How to start a game](#how-to-start-a-game)
- [What the header shows](#what-the-header-shows)
- [Playing a Soviet impulse](#playing-a-soviet-impulse)
- [Attacking as the Germans](#attacking-as-the-germans)
- [Defending against a Soviet attack](#defending-against-a-soviet-attack)
- [Checking supply](#checking-supply)
- [Next turn and the Supply Phase](#next-turn-and-the-supply-phase)
- [The counter menu](#the-counter-menu)
- [German events](#german-events)
- [Log and map overlays](#log-and-map-overlays)
- [Save, load, undo](#save-load-undo)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [For developers](#for-developers)
- [Legal](#legal)

---

## What you need

- **Your German cards**, in your hand.
- **The combat chits**, in a bowl or a cup.
- **The rules for your side.** The app plays the Soviets by the solo booklet, but you play the Germans by the rules: it checks your moves and your combats, it doesn't teach them.

The map and the counters are optional. The app shows the whole situation on its own map. You can play with only your cards in hand and the chits, or keep the board next to you and move the counters on both.

## Features

- **The Soviet paper AI, automated.** The bot draws the Soviet command and auxiliary cards, activates the armies, picks movement methods, preferences and tie-breaks, places reserves and declares attacks.
- **Every decision explained.** For each Soviet unit, the Bot tab shows the method used, the hexes kept at each step and the rule that applied.
- **The bot moves on the map.** Each Soviet unit walks its path with a red trail, and you can replay any move.
- **Combat, guided.** A combat sheet walks you through the 9 steps of a combat: reserves, tactics, chits, hits, losses, retreats and advances.
- **Supply, checked.** The German and Soviet supply lines are drawn on the map, and the Supply Phase is done for you.
- **The whole campaign.** Set-up adjustments, reinforcements, events, ground conditions, victory points and the end-of-game check.

<img width="720" alt="gif-soviet-move" src="https://github.com/user-attachments/assets/f6224d98-0a81-4888-96f0-e75b2ce92492" />

---

## How to start a game

**1. Open the menu and click Start.**

<img width="620" alt="01-start" src="https://github.com/user-attachments/assets/35b7fa83-8c0e-4449-9246-7f0a2b7bc0a4" />

**2. Click Set up turn 1.** The counters go to their start hexes, the turn 1 units to their reserve box and the later units to the calendar of reinforcements.

<img width="520" alt="02-setup" src="https://github.com/user-attachments/assets/559b3b8b-93e9-4434-b7be-b2906bd90c99" />

**3. Pick the set-up adjustment, then click Start.** Roll the die or pick a row of the table (1). The bot plays the outcome of the Soviet initial assault. When you're done, click Start (2) and your first German impulse begins.

<img width="560" alt="03-adjustment" src="https://github.com/user-attachments/assets/592b84dc-6ed8-4b86-a0c8-486d4c90f2e7" />

## What the header shows

<img width="800" alt="04-header" src="https://github.com/user-attachments/assets/54208438-6475-45e0-ad6b-2dd5af4174ba" />

| # | Item | What it tells you |
|---|------|-------------------|
| 1 | **Game-turn** | The turn, its dates and where you are in it (before the first Soviet impulse, after Soviet impulse 2…). |
| 2 | **VP** | The Soviet victory point level. |
| 3 | **Victory outlook** | Who would win if the game were checked now. Victory is checked at the end of each game-turn from game-turn 4 on. |
| 4 | **Soviet support** | The support line in use: the whole map until game-turn 4, then the west or east line. |
| 5 | **Operational limit** | The line that holds back Soviet fronts without an objective marker, from game-turn 6. |
| 6 | **Kharkov** | Who owns Kharkov. |
| 7 | **Undo / Redo** | Take back your last action, or play it again. |
| 8 | **Run bot impulse** | Ends your German impulse and plays the next Soviet impulse. |
| 9 | **Next turn** | Ends the game-turn and runs the Supply Phase. |
| 10 | **Conditions** | What applies this turn: ground condition, Soviet desperation, events in play… |
| 11 | **Add event** | Plays a German event card. |

Click any item of the top line to read what it means and which rule applies.

## Playing a Soviet impulse

Play your German impulse on the map: hold a counter to pick it up, drag it and drop it on its new hex. The app checks the move. When you're done, **click Run bot impulse**. You don't need to end your impulse in any other way.

<img width="560" alt="05a-run-impulse" src="https://github.com/user-attachments/assets/50cabc5c-da1e-4b2e-8299-e3d2102f0a6f" />

The bot draws its cards. The Bot tab shows the card that commands, the auxiliary card and the orders read from them.

<img width="390" alt="gif-card-draw" src="https://github.com/user-attachments/assets/17abe83c-10c7-49bc-b9ce-c0ce1785da16" />

Then the Soviet units move one after the other. **Replay all moves** plays the whole activation again, and **Clear trails** wipes the red trails off the map.

<img width="400" alt="05-bot-impulse" src="https://github.com/user-attachments/assets/edf235de-d784-4f7f-bf7d-7fccbaaf0e40" />

In the Bot tab, **click a unit** (1) to see why it moved there: the method, then each preference and tie-break with the hexes it kept. **Point at a step** (2) and the map outlines in black the hexes it kept.
<img width="1351" height="720" alt="05b-decision" src="https://github.com/user-attachments/assets/3278956e-17d7-4e3b-8058-3abe96c33e7a" />

<!-- MEDIA 05b-decision.png -->

## Attacking as the Germans

**1. Select your attacking units.** Click a counter (1), then Ctrl + click to add another one (2). Shift + click adds a whole stack.

<img width="380" alt="06-attack-select" src="https://github.com/user-attachments/assets/7023d027-217b-4488-b46a-39aa9ba099c3" />

**2. Right-click the Soviet hex and choose Attack.**

<img width="520" alt="07-attack-menu" src="https://github.com/user-attachments/assets/021e6bc8-feea-4d98-a2c8-4a8b98ddd02f" />

**3. Follow the combat sheet.** It opens in the Combat tab. Tick the tactic cards you play from your hand, then go on step by step: the Soviet card, the chits you draw from the bowl, the hits printed on the chits you keep, the losses, the retreats and your advance. The bot plays the Soviet side of each step.

<img width="400" alt="08-attack-sheet" src="https://github.com/user-attachments/assets/326308c6-71de-44c0-90b4-c0ce2f8ac83c" />

## Defending against a Soviet attack

When the bot attacks, the combat sheet opens by itself. The bot has already chosen its reserves and tactics. Tick the tactic cards you play from your hand, or click **Continue without tactics**, then follow the steps as in your own attacks.

<img width="400" alt="09-defend" src="https://github.com/user-attachments/assets/d6adf79f-2560-4748-99a6-967cce931bb9" />

## Checking supply

**Click German supply (G)** to draw the supply line of every German unit, or **Soviet supply (S)** for the Soviet units. The lines run from each unit to its supply source. Point at a hex to see the line of the units in it.

<img width="780" alt="10-supply" src="https://github.com/user-attachments/assets/ea4149ba-73ee-44a7-a629-7c18c7ee3ea0" />

<img width="720" alt="gif-german-supply" src="https://github.com/user-attachments/assets/5383c718-9e73-4507-bd77-820c27c15403" />

## Next turn and the Supply Phase

At the end of the game-turn, **click Next turn**. A notice lists what the Supply Phase did, one step after the other: Soviet garrisons placed, supply markers gained or removed, surrenders, and the support line and objectives removed when they apply. Click **Continue to command phase** to start the new turn.

<img width="520" alt="11-next-turn" src="https://github.com/user-attachments/assets/5e06720f-f3f3-46ed-b3e3-68f461415af0" />

## The counter menu

**Right-click a counter** (1) to remove a step, eliminate it, place or remove a Dispersed marker, place an Improved Position, set its supply marker (In supply, Out of Supply, Isolated) or place a garrison. Options that don't apply are greyed out.

<img width="380" alt="12-counter-menu" src="https://github.com/user-attachments/assets/fb3605b2-7eff-4a0f-936b-decb70fcab39" />

## German events

**Click Add event** to play a German event card: STAVKA Confused, OKW Expedites or Air Interdiction. The app applies its effect.

<img width="400" alt="13-events" src="https://github.com/user-attachments/assets/d1891515-78c3-4e2c-84d7-8f525369f02b" />

## Log and map overlays

**The Log tab** keeps every action of the game, by turn and by impulse. Use the **Show** list to see one turn or all of them.

<img width="400" alt="14-log" src="https://github.com/user-attachments/assets/c43f45a6-47cc-4072-a4a3-f87c2dbb7599" />

**The Overlays tab** lays data sheets on the map, so you can see what the bot reads from it: hex grid, hex numbers, terrain, roads and rivers, movement arrows, objectives, support and limit lines, map edges and supply. It also has the map legend. Above the map, **Hide units (U)** clears the counters away so you can read the map underneath.

<img width="800" alt="15-overlays" src="https://github.com/user-attachments/assets/3ebf60c7-30f7-47c8-bbb3-20cd8803fd50" />

## Save, load, undo

- **Menu → Save game** downloads your game as a file. **Menu → Load save** opens it again, with its whole log and undo history.
- Nothing is kept in your browser: save before you close or reload the page. The app asks you first if the game has changed since your last save.
- **Undo** (Ctrl + Z) takes back your last action and **Redo** (Ctrl + Y) plays it again. Undo stops at the start of your German impulse: the bot's impulse can't be undone.

<img width="620" alt="16-save" src="https://github.com/user-attachments/assets/bbcf04db-4f47-4124-8908-1c94bcbf2348" />

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `U` | Hide or show the units |
| `S` / `G` | Soviet / German supply lines |
| `M` | Printed map image on or off |
| `0` | Fit the map to the window |
| `1` … `8` | Map overlays (Overlays tab) |
| `+` / `-`, mouse wheel | Zoom |
| Arrow keys, drag | Move the map |
| `Ctrl + Z` / `Ctrl + Y` | Undo / Redo |
| `Esc` | Close a menu, release a pinned hex |

---

## For developers

TypeScript and Vite, with no server: everything runs in the browser. The bot engine (`src/engine/`) is pure TypeScript, tested with Vitest. The booklet's examples are replayed as reference tests.

```bash
npm install
npm run dev     # http://localhost:5173
npm test
npm run build
```

## Legal

This is a fan-made companion app, not affiliated with or endorsed by Compass Games. _Enemy Action: Kharkov_ is designed by John Butterfield and published by Compass Games. You need a copy of the game to play.
