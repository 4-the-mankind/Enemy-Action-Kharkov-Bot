# EA Kharkov Bot — Rule decisions

Rulings on points of the German Solo rulebook (`docs/rules-german-solo.md`) that were ambiguous, contradictory, or silent, and that the engine had to settle. Each entry keeps its question number from `PLANNING.md` §6 and the date it was settled. Interface, tooling and project questions are not listed here.

Where a ruling says "booklet example takes precedence", it follows decision D8 of `PLANNING.md`: the booklet's worked examples are replayed as reference tests and must give the same result as the book.

---

## 1. Errata, map and data

| #   | Point | Ruling | Date |
| --- | ----- | ------ | ---- |
| Q5  | Chuguev is in 1009 in the town list but in 1008 in the "Raus Overrun" and "Voronezh Front Breakout" set-up adjustments. | Official errata: 1009 for Raus Overrun; same correction for Voronezh Front Breakout, confirmed by the dev. `[Errata]` notes in the rules file. | 2026-10-08 |
| Q10 | Are the front target (VP hex / village) and the logistics hex (V/S) independent? | Yes. Any hex can be a logistics hex. Villages, towns and cities can target one front or both; a hex can be both a front target and a logistics hex. | — |
| Q11 | Recorded set-up data vs the booklet: (a) 5,6 Bloody Izyum places the objectives in 0608 and 1410 facing West, the booklet says South; (b) 1,2 Raus Overrun and 7,8 Voronezh Front Breakout place the Voronezh objective in 1008, the errata says 1009. | The booklet and the errata prevail; data corrected, reference test added. | 2026-10-10 |
| Q13 | 14.1 (Towns and Cities): "two Soviet towns in 0202 and 1103", but 0202 has no town; Valuyki is in 0302. | 0302 — booklet typo (`START_SOVIET_TOWNS`, `[Errata]` note). | 2026-10-10 |
| Q14 | Gazetteer vs printed map: Zmiyev 1311 in the gazetteer but town printed in 1210 (the adjustments say "Zmiyev (hex 1210)"); Sumy 0322 in the gazetteer, city printed in 0221. | The printed map is right: Zmiyev 1210, Sumy 0221 (`[Errata]` notes in the gazetteer). | 2026-10-10 |
| Q36 | Map data: no town/city had a front target; are target hexes without the `village` flag errors? | Town/city targets had been left out and were added: Voronezh = 0215, 0221, 0302, 0311, 0608, 0720, 0912, 1009, 1116, 1421, 1615; both fronts = Zmiyev 1210; none = Zaporozhe 3116; all others Southwest. Lozovaya 1910 gets 1 VP (map badge, example p18). **Every front-target hex that is not a town/city is a village.** | 2026-10-12 |
| Q108 | Example p44: 1521 and 1221 show a village symbol on the map but not in the data. | Data fixed by the dev in the Map painter (1221, 1521 and 0721 added). | 2026-10-19 |

## 2. Soviet activation terminology and movement (9.1–9.3)

| #   | Point | Ruling | Date |
| --- | ----- | ------ | ---- |
| Q12 | 9.3 (Soviet Activation Terminology): can distances ("closer / closest", objective within 4 hexes…) pass through dead hexes? | No; only playable hexes count (a dead hex is off-map). | 2026-10-10 |
| Q16 | Is an already surrounded Soviet unit "nearly surrounded" (9.3 says "would cause … to become surrounded")? | No; they are two distinct states (12.83 lists them side by side). | 2026-10-10 |
| Q25 | 9.22 (Soviet Movement Methods B) "would not be nearly surrounded" (methods 2 b, 4, 5, 7, 8): does a hex where the unit would be surrounded qualify? | No; it is excluded too. | 2026-10-11 |
| Q17 | 9.25 (Tactical Preferences When Moving Adjacent to German Units) says it takes "priority over preferences in a given movement method", but example p17 applies method 11's preferences first. Order, and the 9.25 shift to another hex adjacent to the same German unit ("This means that…", Examples 1-3)? | Order: method → 9.25 → 9.24. The shift is dropped for ordinary moves (it would send unit 04 of p17 to 1202 instead of 1103; the example prevails). Kept only for a unit a method says not to move (9.25, 2nd bullet and Example 3). | 2026-10-11 |
| Q19 | 9.23 (Restrictions on Soviet Movement) b: is "cause one or more German units to become proximate" judged per (German unit, town) pair or per town? | **Per town.** A town a German unit could already reach at the start of the move does not block it, even if the move lets a second unit reach it (one is enough to take it, 14.1); the move is refused only if it makes a previously unreachable town reachable. | 2026-10-11 |
| Q21 | 9.27 (Movement Methods For Unsupplied Units), 2nd bullet: a unit that cannot trace and reaches no supplied hex, already not adjacent and closer to supply than any reachable hex — does it move? | It stays (its hex competes with the destinations); but a unit adjacent to a German unit must first leave that contact (its starting hex does not compete). | 2026-10-11 |
| Q22 | 9.22 method 11: "proximate" to an occupied German VP hex (9.3 only defines it for an empty or friendly hex); and a unit already proximate at the start? | Empty VP hex = able to enter it; occupied = proximate to the German unit holding it (able to end adjacent). A unit already proximate at the start is not concerned ("becomes") and moves on to the next methods, without freezing. | 2026-10-11 |
| Q23 | 9.21 (Soviet Movement Methods A) method 5 and 9.22 method 3: the infantry clause ("a VP hex occupied only by Soviet armor units") and the freezes ("starting in a VP hex stacked with…") do not say "targeted for the active front". Which VP hexes count? | Any VP hex (Soviet town/city or map-edge VP hex), whatever its front target: a unit holding a threatened town of the other front does not abandon it. "Armor" = `mechanized` unit; "infantry" = `infantry` (not cavalry). | 2026-10-11 |
| Q24 | 9.21 method 7, preference b "the easternmost hex": hex of the German stack, or destination hex? | The German stack's hex (b breaks ties between equal-strength stacks; the hex around it is chosen by 9.25 then 9.24). | 2026-10-11 |
| Q26 | 10.4 (Stacking Units): a Soviet unit may end overstacked "if it is obvious" that active units not yet moved will leave the hex. Coded? | Yes, with look-ahead: the activation is played to the end and replayed without that ending if the hex is still overstacked. | 2026-10-11 |
| Q32 | 9.12 (Reaching a Front's Third Objective) / 9.13 (Placing and Removing an Army Objective Marker): does a hex merely passed through count as "entered"? | Yes, any hex of the path after the start (literal reading of "enters"). | 2026-10-12 |
| Q33 | 9.26 (Movement Methods For Units With Army Objectives) method 3: "the German unit in or closest to the active Army objective marker hex" — a German unit 100 hexes away would be "closest"; and if the Soviet unit cannot get closer? | Only German units **in the Army objective hex or proximate to it** (9.3) count; none → method 4. Starting adjacent to the target German unit: does not move (except 9.25), no method 4. Otherwise method 3 only if a move brings it closer to the target; else method 4. Method 4 only if a move brings it closer to the front objective. | 2026-10-12 |
| Q34 | 9.26, edge cases: order in a mixed activation, OOS 40th Army unit able to trace, when to place the Army marker? | 9.26 units are processed **before** 9.21 units, then 9.27. An OOS or isolated unit able to trace follows 9.26. The marker is placed at the first activation whose formation is the army itself (Army, Army Units, Front/STAVKA cards choosing it), not for units merely stacked with another army. | 2026-10-12 |
| Q35 | 9.12 [GT 7] Supply Phase: which units are "adjacent to the marker", and for which markers? | A unit of any front, in the hex or adjacent, able to trace reserve supply; the check is limited to the marker **on its 3rd hex** (strict reading of 9.12). The 1st and 2nd objectives stay until the end of GT 7. | 2026-10-12 |

## 3. Soviet attacks and reserves (9.4–9.7, 12.2)

| #   | Point | Ruling | Date |
| --- | ----- | ------ | ---- |
| Q38 | 9.4 (Soviet Attack Checks): "next active unit in ascending order", but also "until … an attack check against every German-occupied hex to which an active Soviet unit is adjacent". Can a unit that failed lead another check? | **Repeated passes** in ▲ order; a unit leads at most one check per pass; passes repeat while a pass made at least one check. A unit fights only **one combat** per activation (9.43). | 2026-10-14 |
| Q39 | 9.41 "highest rounded ratio": how to round? | **In the defender's favour**, down, to the steps 1:1, 1.5:1, 2:1, 3:1… (1.5:1 step from p24); below 1:1, 1:2, 1:3… | 2026-10-14 |
| Q40 | Readings made while coding the attack checks. | "Supplied" target (9.4) = at least one German unit in the hex without an OOS / Isolated marker; "armor" = `mechanized` unit (as Q23); 9.5 (Placing Active Soviet Reserve Units): after h), lowest hex number; 9.6 / 9.7 "did not move": a unit that advanced after combat has moved; [GT 7+] with VP < 20: the hex's VP value replaces the +1 (9.4). | 2026-10-14 |
| Q42 | (a) 12.2 (Soviet Reserves in Soviet Attacks) "until … no hex qualifies for placement"; (b) tactics counted in the chits at step 1 (12.4, 12.38); (c) 9.5 in a village, hex where the reserve would be surrounded; (d) mechanized unit attacking across the Dniepr from or into a marsh. | (a) If the attack is already overwhelming, no more reserves; otherwise a reserve with no possible hex is skipped and **the next one is tried** (in the 9.4 attack check too). (b) The barrage (GT 1-2) and STAVKA's NKVD, **known in advance, are counted from step 1**, only for a supported attack (13.52: no tactic in an unsupported attack). (c) Excluded too (as Q25). (d) Strength divided by four. | 2026-10-14 |
| Q105 | Example p24: the booklet makes a check with 14 (3 Popov, reverse side 3-14-6, 1 step) against DF DR IISS in 1614 (3:5, fails). 9.4 forbids a 1-step unit from leading a check against a supplied target. | The booklet is approximate; the engine refuses to lead (same outcome: no attack). | 2026-10-19 |
| Q107 | Example p32: is the Voronezh Front objective on the map? If removed, 12.2 would require supported hexes and 02 would go to 1514 instead of 1614. | The objective is on the map, out of view (1009 in the test). | 2026-10-19 |

## 4. Combat (12)

| #   | Point | Ruling | Date |
| --- | ----- | ------ | ---- |
| Q44 b | 12.51 (Hit Total Adjustments): where does the floor at 0 apply? | Once, on the final total (the order of the terms does not matter; the sum of the chits may be negative). | 2026-10-14 |
| Q47 | Chit of a tactic printed on a card but outside its game-turns, or defence-only (12.3, Combat Tactics)? | No; only tactics in effect give their chit (E03, E15: +1; E18: 0 on GT 1). | 2026-10-14 |
| Q48 | 12.37 (Soviet Deck Exhaustion), empty Soviet draw pile: separate tactics pile, or random draw from the discard? | Each time a random card from the discard (seeded), which goes back there; the draw pile stays empty. | 2026-10-14 |
| Q49 | 12.6 (Applying Step Losses), tie on steps and unit selector: who chooses? | Random tiebreak between the tied units (seeded). | 2026-10-14 |
| Q50 | 12.83 (Soviet Advance After Combat): (a) which objective for "closer to objective"? (b) does "across river" include minor rivers? | (a) The Army objective marker takes precedence over the front objective for that army's units (9.1); without an objective, the line is skipped and the next one is checked. (b) Yes: "river" means all three (minor river, Donets, Dniepr), as in the terrain chart. | 2026-10-14 |
| Q51 | 2nd advance hex with equal chance (12.81 Two-Hex Advance, 12.83)? | 9.24 (Movement Method Tiebreakers). | 2026-10-14 |
| Q57 | German Reinforce Battle in defence: "in the same army as a unit in the combat"; which corps belong to which army? | 1st Panzer Army = III, XL; 4th Panzer Army = XLVIII, LVII, IISS; Army Detachment Kempf = Raus. A stack with a unit of no defending army is refused. | 2026-10-14 |
| Q58 | NKVD Operations: "as if combat occurred… Do not reduce hits in a city/town hex". Does an IP on the targeted stack absorb a hit (and disappear), as in combat? | Yes; only town and city do not reduce hits; the IP takes the first hit and is removed (12.51). | 2026-10-14 |
| Q60 | 12.53 (Assigning Hits to Soviet Defenders) C (Hold Check): after a one-hex retreat, on which hex are VP, terrain and supply judged? | The hex occupied at the time of the check; "all attackers across Donets/Dniepr" is still judged on the original attack. | 2026-10-17 |
| Q61 | 12.7 (Retreats), Soviet preferences b) "a forward arrow" and c) "the forward direction": primary arrow only, or secondary too? | b) primary or secondary; c) hexes next to the primary direction; V/S arrows only for their own front. The p38 examples do not settle it (same results). | 2026-10-17 |
| Q62 | Soviet Reinforce Battle in defence: which German units are active, since the app does not track German activations (D14)? | The player **names what their card activated** (corps, or Kampfgruppe: marker hex + range 2/3), once per impulse, only when the bot's choice depends on it; plus the attackers and the (checked) units moved during the impulse. | 2026-10-17 |
| Q63 | Soviet intelligence in defence: what happens to units brought in by Reinforce Battle or Assault Coordination? | They leave the attack; the Reinforce Battle stack returns to its hex (as if the card had not been played). | 2026-10-17 |
| Q64 | (a) Soviet Artillery in defence inside the barrage zone on GT 1-2; (b) 12.1 (Attack Eligibility) "attacked once"; (c) Kampfgruppe and units of another corps. | (a) Literal reading: the tactic does not apply. The German Airpower and Artillery tactic has no zone restriction (12.3 only forbids a second artillery). (b) The refusal stands; the bot is bound by it too (9.42, one Soviet activation; 12.74). (c) Corps can be added to the Kampfgruppe (6.2 Activating a German Kampfgruppe, card P41). | 2026-10-17 |
| Q120 | 13.23 (Surrender): where does a destroyed unit go? | Out of play, for both sides. | 2026-11-04 |
| Q137 | Player aid tactic "Airpower and Artillery". | It is two tactics with the same effect, on both sides: German Airpower and German Artillery (two boxes, playable together), Soviet Airpower and Soviet Artillery. | 2026-11-05 |

## 5. Events and cards

| #   | Point | Ruling | Date |
| --- | ----- | ------ | ---- |
| Q27 | E22 STAVKA: the card says "Remove from the game if played for any purpose on Turn 7 or after"; 8.2 (STAVKA Command Card Removal) only says "[GT 7] upon drawing, implementing and discarding". | The card prevails (removed on GT 7 and later, whatever the use). | 2026-10-11 |
| Q31 | Partisan Uprisings: "Does not apply if only one hex other than Kharkov qualifies". Does Kharkov alone qualify? | A single qualifying hex is enough only if it is Kharkov; without Kharkov, two are needed. | 2026-10-11 |
| Q41 | Soviet Engineers event: "remove a German IP from a hex of your choice". | The bot removes German IPs **at random** (seeded); if it cannot, it places Soviet IPs following the event's preferences a, b (then lowest hex number). | 2026-10-14 |
| Q82 | Card E08: its replacement line is [GT 5+], while 16 (Replacements) starts Soviet replacements on GT 6. | The card prevails over the rule (8.12, "valid on the current game-turn"): E08 gives a replacement from GT 5. | 2026-10-18 |

## 6. German movement (10)

| #   | Point | Ruling | Date |
| --- | ----- | ------ | ---- |
| Q15 | 10.7 (German Map Edge Movement) and urban infiltration: does "regardless of enemy ZOC" also waive the +1 MP to leave the ZOC? | Not applicable: 10.7 only allows a one-hex move (movement stops in the hex entered, in ZOC); same for infiltration. The exception only matters ZOC to ZOC; to a hex outside ZOC it is an ordinary move (+1 MP to leave). | 2026-10-10 |
| Q74 | 15.3 (Removal of Garrisons), 10.1: the app does not track German activations (D14); when is a garrison removed "at the start of a German activation"? | On the first checked move of a supplied, non-dispersed German unit starting next to it, and on the attack declaration; plus "Remove garrison" in the right-click menu. | 2026-10-17 |

## 7. Supply, towns, IPs and garrisons (13–15)

| #   | Point | Ruling | Date |
| --- | ----- | ------ | ---- |
| Q78 | 15.1 ([GT 4+] Placing Garrisons) in the Supply Phase: "within the current Soviet operational limit" = line in use (GT 6+) whatever the front objectives, or only for a village whose front lost its objective (9.8)? | Line in use for all villages in the Supply Phase; Garrison Front event: the limit of the named front (15.11). | 2026-10-18 |
| Q79 | 15.3 at end of turn: are all garrisons judged on the state at the start of the check, or one by one (a removal opening German supply to another)? | All on a snapshot of the map at the start of the check; a garrison removed during the check still blocks German supply to the others. | 2026-10-18 |
| Q135 | 14.22 (IP Restrictions): placing an Improved Position. | Not allowed in a town/city, nor on a stack that is entirely dispersed/OOS/isolated (allowed if stacked with an eligible unit); also not allowed [GT 5+] on a Soviet unit out of support. | 2026-11-05 |
| Q138 | 14.23 (Additional Effects), 14.24 (Removing Improved Positions): when is a German IP removed? | When its hex is left empty (14.23), and when all the units in the hex attack. | 2026-11-05 |

## 8. Replacements, victory points and ground conditions (16–18)

| #   | Point | Ruling | Date |
| --- | ----- | ------ | ---- |
| Q76 | 16.1 (Replacing Lost Steps), German replacements: how is the priority order checked? | Within the corps of the chosen unit (so an army card cannot be wrongly refused); in heavy mud, over all German infantry (no corps named), two steps at most. Restrictions of 16.2 and 16.21, GT 3+. | 2026-10-17 |
| Q81 | 18.34 (Ground Condition Effects), heavy mud: does the "Soviet infantry step" go to a non-mechanized unit (priorities 1-2 of 16.1)? | (a) Yes; 11C cavalry (3T) counts as non-mechanized. (b) 16.2 restrictions apply: with no eligible non-mechanized unit in the front, the step is lost. | 2026-10-18 |
| Q80 | 17.1 (Soviet Victory Points), map-edge VP hexes: when are gain and loss counted? | (a) Gain checked when a Soviet unit ends in the hex (move, advance, retreat, placement) and at each Supply Phase; loss when the hex no longer has a Soviet unit, or in the Supply Phase if it no longer traces. (b) "Able to trace supply" = trace from the hex at that moment, not the unit's marker. | 2026-10-18 |
| Q75 | 18.33 (Ground Condition Markers): who draws them, and what are the five markers? | The app draws them (seeded); 3 frozen, 1 light mud, 1 heavy mud. | 2026-10-17 |

## 9. Booklet examples (reference tests)

| #   | Point | Ruling | Date |
| --- | ----- | ------ | ---- |
| Q18 | Example p17: is the starting position the booklet set-up **without adjustment**, with only the Voronezh West objective in 1009? | Yes: set-up without adjustment (only 1,2 and 7,8 place the objective in 1009, and both change the 3T's area). | 2026-10-11 |
| Q102 | Example p18: with an empty map outside the diagram, Izyum (1604) and Zmiyev (1210) are empty German VP hexes that 01 and 06 reach by method 1, while the booklet says only Lozovaya qualifies. | Izyum and Zmiyev are treated as already Soviet. | 2026-10-19 |
| Q103 | Example p18, method 10: the booklet says 06 (1611, 6 MP) would be eligible without 9.23 a. On the map it reaches 1915 with 1 MP left and the minor river to 1916 / 2015 costs 2: no path spends all its MP. | Map checked and correct; the booklet's reason for 06 is approximate; test kept as is. | 2026-10-19 |
| Q104 | Example p19, 9.22 method 4: the booklet says preferences a, b and c do not break the tie; the engine drops 1718, 1617, 1618, 1518 by c (closer to a supported hex). The booklet's result (1717) requires c. | The booklet is approximate; test kept as is. | 2026-10-19 |
| Q106 | Example p28: is the red star on Krasnograd (1615) a garrison or a Soviet control marker? With a garrison, 10.6 ([GT 2+] German Strategic Movement Bonus) would forbid 1616 (adjacent), which the booklet allows. | Soviet control marker, not a garrison. | 2026-10-19 |
| Q109 | Example p44: 0815 receives a garrison (unit 180 proximate, German trace from the west edge, out of view) that the booklet refuses. | The test ignores 0815 and 0915. | 2026-10-19 |
| Q110 | Example p44: without units on the VP hexes out of view, those hexes stay German and cut Soviet supply routes (13.1 Tracing Supply): no village is supplied. | All VP hexes out of view are Soviet without units, as Izyum and Zmiyev in p18. | 2026-10-19 |
