# Enemy Action: Kharkov — German Solo Rules (rulebook transcription)

Source: `Rulebook German Solo.pdf` (Compass Games 2021), converted to Markdown for the project. Text is verbatim; images/diagrams are not transcribed (only short layout notes in *italics*).

Conventions: `[GT 5+]` = game-turn badge (rule applies on GT 5 and later; `[GT 1-4]` range; `[GT 7]` single turn). ▲/▼ = check units in ascending/descending selector order. `> **[Exemple pN]**` = example/illustration box from page N. `<!-- pN -->` = start of PDF page N.

## INDEX (line numbers)

- **1. INTRODUCTION** L34
- **2. GAME COMPONENTS** L44 — 2.1 L68 · 2.2 L125 · 2.21 L129 · 2.22 L182 · 2.23 L198 · 2.3 L206 · 2.31 L210 · 2.32 L236 · 2.4 L242 · 2.5 L252
- **3. SETTING UP FOR PLAY** L256
- **4. SEQUENCE OF PLAY** L311
- **5. GERMAN DRAW PILE AND COMMANDS** L391 — 5.1 L403 · 5.2 L409 · 5.3 L423 · 5.4 L431 · 5.5 L437 · 5.6 L441
- **6. ACTIVATING GERMAN UNITS AND FORMATIONS** L445 — 6.1 L454 · 6.2 L458 · 6.3 L498
- **7. GERMAN RESERVES** L512 — 7.1 L521 · 7.2 L542 · 7.3 L550
- **8. SOVIET DRAW PILE AND COMMANDS** L566 — 8.1 L578 · 8.11 L606 · 8.12 L610 · 8.13 L614 · 8.2 L659 · 8.3 L663
- **9. SOVIET UNIT ACTIVATIONS** L667 — 9.1 L680 · 9.11 L686 · 9.12 L726 · 9.13 L743 · 9.14 L756 · 9.2 L760 · 9.21 L781 · 9.22 L924 · 9.23 L1030 · 9.24 L1046 · 9.25 L1050 · 9.26 L1069 · 9.27 L1078 · 9.3 L1086 · 9.4 L1153 · 9.41 L1226 · 9.42 L1230 · 9.43 L1234 · 9.5 L1257 · 9.6 L1277 · 9.7 L1300 · 9.8 L1320
- **10. MOVEMENT** L1336 — 10.1 L1349 · 10.2 L1387 · 10.3 L1391 · 10.31 L1393 · 10.32 L1401 · 10.4 L1405 · 10.5 L1417 · 10.6 L1423 · 10.7 L1437
- **11. ZONES OF CONTROL (ZOC)** L1441 — 11.1 L1445
- **12. COMBAT** L1462 — 12.1 L1500 · 12.2 L1508 · 12.3 L1523 · 12.31 L1559 · 12.32 L1574 · 12.33 L1578 · 12.34 L1598 · 12.35 L1602 · 12.36 L1606 · 12.37 L1610 · 12.38 L1614 · 12.39 L1649 · 12.4 L1653 · 12.41 L1674 · 12.42 L1750 · 12.5 L1754 · 12.51 L1760 · 12.52 L1797 · 12.53 L1805 · 12.54 L1832 · 12.55 L1873 · 12.6 L1877 · 12.61 L1886 · 12.62 L1890 · 12.7 L1897 · 12.71 L1912 · 12.72 L1922 · 12.73 L1926 · 12.74 L1930 · 12.75 L1934 · 12.8 L1940 · 12.81 L2000 · 12.82 L2011 · 12.83 L2017 · 12.9 L2039
- **13. SUPPLY** L2067 — 13.1 L2089 · 13.2 L2110 · 13.21 L2114 · 13.22 L2126 · 13.23 L2154 · 13.3 L2163 · 13.4 L2172 · 13.5 L2176 · 13.51 L2180 · 13.52 L2194 · 13.53 L2204 · 13.54 L2218
- **14. TOWNS, CITIES AND IMPROVED POSITIONS** L2225 — 14.1 L2227 · 14.11 L2243 · 14.2 L2247 · 14.21 L2251 · 14.22 L2276 · 14.23 L2280 · 14.24 L2284
- **15. SOVIET GARRISONS [GT 3+]** L2293 — 15.1 L2297 · 15.11 L2335 · 15.2 L2342 · 15.21 L2346 · 15.22 L2354 · 15.3 L2358
- **16. REPLACEMENTS [GT 3+]** L2369 — 16.1 L2377 · 16.2 L2402 · 16.21 L2413
- **17. VICTORY CONDITIONS** L2427 — 17.1 L2431 · 17.2 L2439 · 17.3 L2443
- **18. SCENARIOS** L2459 — 18.1 L2461 · 18.2 L2476 · 18.3 L2494 · 18.31 L2496 · 18.32 L2500 · 18.33 L2504 · 18.34 L2515 · 18.35 L2541
- **SET-UP ADJUSTMENTS (German Solo Game)** L2553 — D1,2: Raus Overrun L2574 · D3,4: Slavyansk Liberated L2588 · D5,6: Bloody Izyum (historical start) L2601 · D7,8: Voronezh Front Breakout L2615 · D9,10: Drive on the Donets L2627
- **TOWN AND CITY GAZETTEER** L2640
- **SEQUENCE OF PLAY SUMMARY (back cover, 4.0)** L2671 · **ERRATA (German Solo)** L2756


<!-- p3 -->

## 1. INTRODUCTION

**Enemy Action** is a series of card-driven games simulating pivotal military operations in World War II. Each game in the series may be played by two players or one player, playing either side in the conflict.

This second volume in the series, **Enemy Action: Kharkov** portrays a key battle on the Eastern Front in which the German Army ended a string of Soviet victories that began at Stalingrad. In the late winter of 1943, dual Soviet Operations code-named Star and Gallop drove the Germans from the city of Kharkov and threatened a complete breakthrough, only to be driven back by the German counteroffensive popularly known as Von Manstein’s Back Hand Blow.

This rules book covers the GERMAN SOLO version of **Enemy Action: Kharkov**. You control the German armies while the game system controls the Soviets.

FOR NEW PLAYERS: We recommend playing the Two Player game first before trying out the German and Soviet Solo games. Doing so will get you familiar with the game system before taking on the additional complexity of the “paper AI” in the two solo games.

## 2. GAME COMPONENTS

**Enemy Action: Kharkov** includes the following components:

- Three game maps, one each for the German Solo, Soviet Solo, and Two Player games
- 432 playing pieces on four die-cut sheets
- 110 cards
- Seven player aids, four of which are used in the German solo game (2.4)
- Three rules books, one for each game
- One box and lid set
- One ten-sided die

Rules and game functions in effect for specific game turns are highlighted in the rules, cards and play aids as follows:

- **Individual game turn** – applies to the particular game turn only. Example: [GT 8] (game-turn 8)
- **Starting game-turn** – applies to the listed game-turn and to every game-turn after that. Example: [GT 8+] (starting on game turn 8 and continuing in effect every game turn after that)
- **Game-turn ranges** – applies to the range of game-turns, inclusive of those listed. Example: [GT 8-12] (starting on game turn 8 and continuing in effect through the completion of game turn 12)

ORDER-DEPENDENT RULES: Rules that check the unit selector (2.21) in ascending (▲) or descending (▼) order are marked with the appropriate arrow symbol.

ABBREVIATIONS: Certain abbreviations are frequently used and may appear in advance of their formal definition: **FAR** – Fixed Artillery Range for the Soviet Fixed Artillery combat tactic **GT** – Game-turn **IP** – Improved Position – defined in 14.2. **MP/MPs** – Movement Point(s) – defined in 10.0. **OL** – Soviet operational limit – defined in 9.8. **OOS** – Out of Supply – defined in 13.2. **VP/VPs** – Victory Point(s) – defined in 17.0. **ZOC** – Zone of Control – defined in 10.1 and 11.0.

SOVIET SYSTEM INTELLIGENCE: The German Solo game uses a unique methodology for the Soviet system intelligence, which is primarily documented in rule sections 8.0, 9.0 and 15.0. Special terminology is defined in section 9.3. Two important terms – **proximate** and **surround** – are also illustrated in that section.

### 2.1 Map

The map for the German Solo game portrays an area in the southwest Soviet Union where the battles occurred. A hexagonal grid is superimposed over the terrain features to regulate the placement and movement of the playing pieces. Each hex is numbered for identification, and represents an area twelve km (7.5 miles) across.

**Terrain** The map terrain and other key features are identified in the map terrain key. **In-hex** terrain types are clear, broken, marsh, woods, town and city. Roads and **villages** (a feature unique to the German solo game) can appear with in-hex terrain types. **Hexside** terrain features are minor rivers, the Donets River, the Dniepr River, and blocked Dniepr River hexsides.

**German Army Deployment Areas** are defined by boundary lines running generally east-west across the map. Identifying labels along the west edge of the map define the extent of each deployment area.

**Victory Point (VP) Hexes** Certain hexes are marked as VP hexes. These include all towns and cities as well as four clear hexes on the east and south map edge. The Soviets earn the VPs listed for owning each town/city hex. The four map-edge hexes award the Soviets VPs when occupied by Soviet units per 17.1. Most (but not all) VP hexes are marked to indicate that the hex is a target for the Voronezh or Southwest Soviet front.

**Soviet and German Map Edges** Every hex along a map edge is Soviet-friendly or German-friendly and this status does not change during the game. Each side traces supply to a friendly map edge.

- Soviet map-edge hexes are all those along the portions of the east and north map edge marked as Soviet.
- German map-edge hexes are all other map-edge hexes; that is, all hexes on map edge portions not marked as Soviet. Note that the Soviet north map edge extends further west on the German solo game map than on the maps for the other games.

**Soviet Artillery Line** (from 0107 to 1901) This line defines three limits at different stages of the game:

- [GT 1,2] Soviet attacks in hexes east of this line are in the Artillery Barrage Zone, thus gaining a bonus artillery combat tactic (12.36).
- The Soviet **fixed artillery** combat tactic applies in all hexes east of this line, and extends a number of hexes beyond the line equal to the current Fixed Artillery Range (FAR).
- [GT 8+] Starting on Game turn 8, this line serves as the **Soviet East Support Line** (13.51).

**Soviet Support Lines** The **East** and **West** Soviet Support lines define the extent of Soviet Support at different stages of the game:

- [GT 1-4] Prior to game turn 5, all hexes on the map are in Soviet support.
- [GT 5+] Starting on Game-turn 5, all hexes on the Soviet side of the **West** Line (from 0114 to 2501) are in Soviet support (13.51).
- [GT 8+] On Game-turn 8 and after, the current Soviet VPs determine if the West Line or the **East** Line (same as the Soviet Artillery Line) is used.

<!-- p4 -->

**HEX FEATURES SPECIFIC TO GERMAN SOLO**

**Soviet Operational Limit Lines** All hexes to the West/South of the active line are beyond the Soviet Operational Limit. Soviet movements and other activities are limited (but not prohibited) beyond the active line (9.8)

[GT 1-5] Prior to game turn 6, the entire map is within the Soviet Operational Limit

[GT 6+] Starting on Game-turn 6, VPs determine the active Operational Limit Line: the **Near** Line (same as the West Soviet Support Line), or the **Far** Line (from 0120 to 3107).

**Soviet Movement Arrows** Many hexes include one or two arrows, indicating the direction a Soviet unit in the hex will move via certain movement methods (9.2) or when advancing after combat. The primary forward direction is indicated by a wide black arrow. Some hexes have a secondary movement arrow, indicated by a black dash. Some movement arrows are marked as conditional: An arrow marked with a V or S exists only for units of the Voronezh or Southwest Front respectively.

**Soviet Village Hexes** Indicate locations in which Soviet garrison markers may be placed (in addition to town and city hexes). Villages have no effect on unit placement, movement and combat. Most (but not all) village symbols are marked as targets for the Voronezh front, Southwest front or both.

**Soviet Front Targets** Most **city, town** and **village** hexes are marked as targets for one or both Soviet fronts. Units will tend to move to targets for their front.

**Soviet Logistics Hexes** Hexes in two areas of the map are shaded yellow (for the Voronezh Front) and red (for the SouthWest front). Logistics hexes are used with the Soviet Movement Methods (9.2).

**OTHER MAP FEATURES**

**The Calendar** The game is played in game-turns, each representing three days of time in 1943. You record the passage of game-turns by moving the Game-Turn marker along the calendar on the map. Each space of the calendar lists card allotments and other turn-dependent game information.

*Calendar space layout (diagram p4):* each space shows the Turn number, the Date, the **FAR** (max range from the Soviet artillery line for the Soviet fixed artillery combat tactic), the **German hand size**, the number of **German supplemental cards**, key rules starting or ending on this turn, and **VP ranges** (when applicable).

**Soviet Victory Point Track** As the Soviet forces gain or lose Victory Points, move the VP markers along the VP track to indicate the current Soviet VP total.

**Unit Boxes** Both sides have boxes to hold Reserve Units and Eliminated Units.

**Soviet Card Boxes** Four Boxes hold the Draw Pile, cards in play (Command Card and Auxiliary card) and the discard pile (Discards).

### 2.2 Playing Pieces

The playing pieces consist of **units**, representing Soviet and German military forces; **combat chits**, used to resolve combat; and **markers**, placed on units, tracks, or the map to denote information or status.

#### 2.21 Units

*Counter layout (diagram p4):* **Front (full strength)** – designation in the top colour stripe; number of steps (dots) and unit-type symbol in the middle; setup hex or game-turn of entry in the upper right; bottom row = **combat strength** (left) · **selector number** (centre, small) · **movement allowance** (right), e.g. `6 01 6`. **Back (reduced strength)** – same layout with the reduced number of steps, reduced combat strength and its own selector, e.g. `3 14 6`. Field colour = Soviet front / German army; top stripe colour = Soviet army / German corps.

<!-- p5 -->

**Unit Colors** Colors identify the German army and corps to which German units belong, or the front and army to which Soviet units belongs.

A unit’s field color denotes the unit’s front or army: Soviet – Voronezh Front, South West Front; German – Army Det. Kempf, 4th Panzer Army, 1st Panzer Army.

A color stripe across the top of each unit denotes a Soviet unit’s Army or a German unit’s corps. A Soviet unit’s army is also identified by letters and numbers; and a German unit’s corps by roman numerals. Affiliations are as follows:

- Soviet Voronezh Front: 3rd Tank, 40th and 69th Armies
- Soviet Southwest Front: 6th Army, 1st Guards Army and Mobile Group Popov (MGP, considered an army)
- German 1st Panzer Army: III Panzer and XL Panzer Corps
- German 4th Panzer Army: IISS Panzer, XLVIII Panzer and LVII Panzer Corps
- German Army Detachment Kempf: Corps Raus (considered part of 4th Panzer Army for command purposes; independent for deployment purposes.)

**Unit Types** – Non-mechanized units: Infantry, Cavalry. Mechanized units: Armor, Mechanized Infantry, Armored Cavalry (considered Armor in combat).

**Designation** Every unit has a two-part or three-part historical designation:

- A unit with a three-part designation is a regiment or brigade that is part of a division. The first part of the designation identifies the regiment or brigade, the second part is the division to which the unit belongs, and the third part is the German corps or Soviet army.
- A unit with a two-part designation is a regiment, brigade or entire division attached directly to a German corps or Soviet army.

Examples: `679.333.XL` is the 679th Regiment of the 333rd Division in 40th Corps. `1GC.3T` is the 1st Guards Cavalry Corps in the 3rd Tank Army.

German corps and Soviet army designations affect activation and deployment. Regimental, brigade and division designations are for historical interest only.

**Designation Abbreviations** A: Armored; C: Cavalry; G: Guards; **GA**: Guards Armored; **Pz**: Panzer; T: Tank.

**Combat Strength** is a numerical expression of the unit’s combat effectiveness, used when resolving combat. When a unit loses a step (but is not eliminated), its combat strength is reduced.

**Movement Allowance** is the number of Movement Points (MP) the unit may spend to move during one activation (see 10.0 and the TERRAIN EFFECTS CHART).

**Steps:** Each unit possesses one to three steps, shown by the number of step dots on the unit’s counter. A unit with one or two steps has one counter with one or two printed sides. A unit with three steps has two counters, with one printed side on one counter and two printed sides on a reduced steps counter, distinguished by an R symbol, for reduced. Only one counter for a given unit is in play at a time.

Units lose steps as a result of combat and from surrender. As a unit loses steps, its combat strength is reduced. In addition, certain armor units lose their armor upon losing a step, becoming mechanized infantry. Units regain lost steps as a result of receiving replacements.

Every unit counter has one of three indicators of how it enters play:

- **Setup Hex** Four-digit ID number of the hex in which the unit is placed at the start of the game. An asterisk on certain German units has no effect in the German solo game.
- **Game-Turn of Entry** The numbered game-turn on which the unit is available to enter play as a **reserve**. Three Soviet units have game turn numbers marked with an asterisk (*) indicating the unit is not used in the German solo game.
- R (reduced) Every 3-step unit has a second reduced unit counter with the same designation. When the 3-step unit loses a step, it is replaced by its reduced 2-step unit counter.

**Unit Selector Number** Each unit has a selector number from **01** to **36**, used when selecting a unit from a group or to determine the order in which several units perform an action. A unit’s selector number changes as it loses steps.

You may be called on to select Soviet units in ascending (▲) numerical order (starting with the lowest selector) or in descending (▼) numerical order (starting with the highest selector).

<!-- p6 -->

In the event that you must select from units with the same selector (possible between units in different German corps or Soviet armies), select the unit in the lower numbered corps or army. Soviet Mobile Group Popov and German Corps Raus are considered to be numbered “0” for this purpose.

#### 2.22 COMBAT CHITS

The sixty combat chits are drawn randomly from a cup to resolve combat. Two identical sets of sixty combat chits are provided with the game. Use only one set at a time. Use the second set if the first gets worn from use. The two sets are differentiated by color –don’t mix them together!

*Chit layout (diagram p6):* each side (front and back) shows a **Combat Situation**, **Attacker Hits** and **Defender Hits** (a negative value = hits subtracted); one side may carry the priority symbol **P**.

**Combat Situation** A situation that may apply to the combat being resolved.

**Example:** If the defending unit in a combat is in clear terrain, the back side of the combat chit shown above would apply, the front side would not. If the defender is in a town hex, the combat chit would not apply at all.

In most cases, the situations listed on the two sides of a combat chit are mutually exclusive. However, when both situations apply, the side of the chit with a Priority Symbol P takes precedence (13.31).

**Attacker Hits / Defender Hits** The number of combat hits applied to the attacker or to the defender if the situation on the combat chit applies. A positive number indicates hits added to the hit total. A negative number indicates hits subtracted from the hit total.

Three combat chits in each set are darker; they operate like other combat chits and also trigger a remixing of all combat chits (12.42).

#### 2.23 Markers

The following markers used are in the German Solo game:

- Placed on units to indicate unit status: Dispersed, Out of Supply / Isolated (two sides of one marker), Improved Position.
- Placed in boxes, tracks, or off-map: Game-turn, Ground Condition, Soviet VP (1VP and 10VP), German Corps activated, German One Unit Activation.
- Placed on the map to indicate special conditions: Ownership, Soviet Garrison, Soviet Forward Support, German Kampfgruppe, Soviet Army Objective, Soviet Front Objective.

### 2.3 Card Sets

45 of the 110 cards in Enemy Action: Kharkov are used in the German Solo game: **23 German Player Command cards** (P23-P45) and **22 Soviet Enemy Command cards** (E01-E22). Return all other cards to the box; they are not used in the German solo game.

#### 2.31 German Command Cards

*Card layout (diagrams p6-7):* Command Value (CV, upper left) · Card ID number · Game-turn of entry (upper right) or Primary indication · Command Formation (large box) with its Higher Echelon(s) · Formation section · Command section · Tactics section.

<!-- p7 -->

Your cards drive everything you do. You start each German impulse by playing a card from your hand to initiate a command. Each card has three sections:

- The **Formation section** displays one or more formations (groups of units)
- The **Command section** lists commands that you may undertake by playing the card during your impulse, some commands involve the card’s formation.
- The **Tactics section** lists combat tactics for which you can play the card when attacking or defending in a combat.

**Command Formation** appears in the large box on the card. A command formation can be certain units in a German Corps or Soviet Army, all the units in a German Corps or Soviet Army, a German army (several corps), a Soviet Front (several armies), a German Army Group, Soviet STAVKA high command, and German General von Manstein.

**Command Value** (upper left corner). Quality of leadership and organization represented when playing the card.

**Higher Echelons** indicate the larger formations to which the command formation belongs. Formations are color coded to match unit colors, for ease of identification.

**Commands** are functions you may undertake with the play of a card. Some commands apply to the formation listed on the card, while others do not, as stated in the command text. Some commands are marked with a game-turn or game-turn range, limiting when the command may be played. Certain commands are events, independent of the formation listed on the card: the **command events** and **special events** are fully described on the EVENTS player aid.

The **Tactics Section** lists combat tactics, fully described in the TACTICS player aid. Combat tactics are independent of the formation listed on the card. Some tactics are marked with a game-turn or game-turn range, limiting when the tactic may be applied.

**Game-turn of Entry** (upper right corner) indicates when the card enters play. A card with no game-turn is available throughout the game.

**Primary Indication** A card marked Primary is available to you every game-turn. Cards without the Primary indication are **supplemental** and are available to you on a random basis.

#### 2.32 Soviet Enemy Command Cards

You draw cards from the Soviet Enemy deck to activate Soviet formations, bring in Soviet reserves, and check for combat tactics and Soviet events.

Soviet command cards are identical in format to German command cards. In the German Solo game Soviet Command values affect card selection in each Soviet impulse (8.1).

### 2.4 Player Aids

Key reference aids for the German Solo game include:

- GERMAN COMMAND CARD DISPLAY
- SEQUENCE OF PLAY SUMMARY (back cover of rule book)
- COMBAT PROCEDURES, COMBAT TACTICS & EVENTS
- SOVIET ACTIVATIONS & KEY RULES SUMMARIES
- TERRAIN EFFECTS CHART (backside of unused Soviet card display)

### 2.5 Ten-sided Die

A 10-sided die is used for all die rolls, generating a number from 1 to **10**. If you use a ten-sided die numbered from 0 to 9, treat each roll of 0 as a **10**.

## 3. SETTING UP FOR PLAY

Lay out the map for the German Solo game so you are sitting on the west side. Place the GERMAN COMMAND CARD DISPLAY next to the map.

**Choose a Scenario to Play** All scenarios use the setup instructions in this section.

- **The Initial Assault**: Game-Turns 1 and 2. An introductory scenario taking about 90 minutes to complete. See 18.1 for modifications for this scenario.
- **Operations Star and Gallop**: Game-Turns 1-6. This scenario takes about five hours to complete. See 18.2 for modifications for this scenario.
- **The Campaign**: up to fourteen game turns, taking about nine hours to complete. See 18.3 for modifications for this scenario.

**Unit Placement** Every unit has a placement designation on its front side:

- Place each unit with a **4-digit hex number** in the indicated hex on the map.
- Place each unit marked with **Game-turn 1** in the reserve box for its nationality. Place all other units with a game-turn in the indicated space of the calendar. For ease of play, organize units into stacks by army and front. **Exception**: Three Soviet units in 40th Army with an asterisked (*) game-turn of entry are not used in the German solo game; do not place them on the calendar.
- Place aside each unit with a R (Reduced). These will enter play as 3-step units lose steps.

<!-- p8 -->

**Marker Placement**

- Place the **Game-turn marker** in the Game-Turn 1 space of the calendar.
- Place the Soviet **1VP** marker in the “2” space and the **10VP** marker in the “0” space of the Soviet Victory Point Track.
- Place one set of sixty **combat chits** in a coffee mug or other widemouth container to draw from during play.

**Card Preparation** Sort the **command cards** by side – 22 Soviet Enemy cards (E01-E22) and 23 German Player cards (P23-P45).

**German Player Command Cards** Separate the ten German initial cards (those with no game-turn in the upper right corner) from German reinforcement cards (those with a game-turn). Sort the ten initial German cards into two piles, five marked Primary into one pile and the five others (referred to as supplemental cards) into another pile. After sorting, place the cards as follows:
1. Place German supplemental card #41 (LVII Panzer Corps KG) in your hand.
2. Shuffle the **four** remaining initial German supplemental cards and place them face down in the Available Supplemental Card box on the GERMAN COMMAND CARD DISPLAY.
3. Place the five initial German primary cards face down in the Draw Pile box.
4. Draw **two** cards from the German Available Supplemental card box sight unseen and place face down in the Draw Pile box.
5. Shuffle the German draw pile and draw **three** cards into your hand, for a total of four cards in your initial hand.
6. Place the **13** German reinforcement cards in the Cards Entering Play box.

**Soviet Enemy Cards** Separate the 19 initial Soviet cards from the three Soviet reinforcement cards. Keep all the Soviet initial cards in front of you for access in the **Set-Up Adjustments** step. Place the three Soviet Reinforcement cards aside for use later in the game.

**Set-up Adjustments** In this step you adjust the placement and status of specified units on the map and discard specified Soviet cards, to reflect the outcome of the Soviet initial assault.

Roll the die and select the set-up adjustment diagram corresponding to the die result, located on pages 48-50 of this rulebook. Optional: Instead of rolling the die simply choose one of the five set-up adjustments.

The selected depiction and its accompanying text explain adjustments to be made. These may include:

- Changing the hex location of units.
- Placing units from the Soviet reserve box on the map.
- Removing steps from units.
- Placing Dispersed markers on units.
- Eliminating German units.
- Placing both Soviet Front Objective markers on the map.
- Adjusting Soviet victory points.
- Placing Soviet cards in the Soviet discard box.

Follow the instructions with the selected depiction in their entirety. When completed, the situation on the map should match that in the depiction. Then shuffle together the remaining initial Soviet cards and place them face down in the Soviet Draw Deck box.

These set-up adjustments take the place of the first Soviet Impulse of Game-turn 1. Start the game with the first German Impulse of the Command Phase of Game-turn 1.

## 4. SEQUENCE OF PLAY

**Enemy Action: Kharkov** is played in **game-turns**, each representing three days of the campaign. Each game-turn consists of five phases, conducted in sequence. In the Reserve Phase, Card Prep Phase and Supply Phase you prepare for the turn’s operations and set supply status of all units. The Command Phase is the heart of the game-turn, consisting of repeating Soviet and German impulses, in which you play Soviet cards or draw German cards to activate units to move and attack or to implement other functions. In the End of Turn Phase, you check for victory and conduct end-of-turn activities.

- [GT 1] On Game-turn 1, skip the first three phases and the first Soviet Impulse of the Command Phase. Start Game-turn 1 with the first German Impulse of the Command Phase.

I. RESERVE PHASE [GT 2+] Take all units from the calendar space for the current game-turn and place them in their respective Reserve Units box.

- [GT 3+] You may deploy to the map any German units in the Reserve Units box with a printed entry turn two or more turns earlier than the current turn (7.3).

II. CARD PREPARATION PHASE [GT 2+] Using your COMMAND CARD DISPLAY, prepare the German draw pile for the day and draw your initial hand, in this step-by-step order:

1. Place **German Reinforcement Cards** scheduled to enter play this game-turn face down in the Draw Pile box if **Primary**, or face down in the Available Supplemental Card box if **Supplemental**.
2. Shuffle the **Available Supplemental Cards**. Draw the number of cards indicated on the calendar for this game-turn and place face down in the Draw Pile box.
3. Place all **Supplemental Discards** from the previous game-turn face down in the Available Supplemental Card box.
4. Place all **Primary Discards** from the previous game-turn face down in the Draw Pile box.
5. Shuffle the **Draw Pile** and draw the number of cards indicated on the calendar for this game-turn to form your initial hand for the game-turn.

**Prepare the Soviet Draw Pile:** Add Soviet cards scheduled to enter play this game-turn to the Soviet card deck. Shuffle the deck, including discards from the previous game-turn to form the Soviet draw pile.

III. SUPPLY PHASE [GT 2+] Conduct the following steps in sequence:
1. [GT 4+] Place Soviet garrison markers in vacant village and Soviet VP hexes (15.1).
2. Determine supply status of all German units and then [GT 4+] of all Soviet units (13.0 & 13.1). Remove all Out of Supply and Isolated markers from units determined to be in supply.
3. Adjust supply status (13.2): Place an Out of Supply marker on each unsupplied unit. If the unit is already OOS, place an Isolated marker. If already isolated, conduct surrender (13.23).
4. [GT 8+] Check the VP Level to determine which Soviet Support Line to use throughout the Game-turn (13.5).
5. [GT 7] Check for front objective marker removal (9.12).

IV. COMMAND PHASE Alternate conducting impulses for both sides, beginning with a Soviet impulse.

<!-- p9 -->

1. SOVIET IMPULSE Draw the top two cards from the Soviet draw pile (one card if only one available). Place the card marked Primary in the Soviet Command Card box. If both or neither are primary, place the card with the Higher Command value in the Command Card Box. If of equal command value, place the card with the lower ID number in the Command Card box. Place the unselected card in the Auxiliary Card box
- AUXILIARY EVENT CHECK: If the Auxiliary card shows a valid command event, immediately implement the event and discard the Auxiliary card.

Conduct the first applicable command listed on the Command card in the command card box. Commands may include the following, not necessarily in this order:

- Special event or command event (8.11). See EVENTS player aids.
- Assign replacements (8.12 & 16.0).
- Activate formation (8.13 & 9.0); and conduct the following steps in sequence:
1. Check the location of the Objective marker for the front or army to which the active units belong, relocating it if required (9.1)
2. Move active on-map units according to the movement methods currently in effect (9.2).
3. Conduct attack checks with active units and, for each successful check, conduct attacks (9.4). For each non-overwhelming attack add eligible active reserve units, and, if the attack is in support, draw a Soviet card as a combat tactic and check for application of the Soviet auxiliary card as an additional combat tactic. You may play German cards as combat tactics in response to Soviet attacks.
4. [GT 4+] Place eligible active reserve units on the map (9.5).
5. [GT 2+] Remove eligible active units to the Soviet Reserve Units box (9.6).
6. [GT 4+] Place an IP marker on one eligible active unit (9.7)
7. Remove Dispersed markers from active units (12.9).

After completing a command listed on the command card, discard it.

- If there is a card in the Auxiliary card box at this time move it to the Command Card box (8.1) and immediately conduct another Soviet command.
- If no card is in the Auxiliary card box, the Soviet impulse is over. A German impulse then begins
2. GERMAN IMPULSE Play one German card from your hand to initiate one command of your choice listed on the card. All the possible German commands are listed below. A given card possesses a subset of these.
- **Activate units specified in the card’s formation** (6.0). OR
- **Activate** units in an adhoc **Kampfgruppe** specified on the card (6.2). OR
- Once per game-turn, **activate any one unit** able to trace supply, regardless of formation (6.1). A unit activated this way can’t attack. OR
- **Deploy reserve units** in the formation listed on the card by moving them from the Reserve Units box to the map (7.1). OR
- [GT 3+] **Assign replacement steps** to units in the formation listed on the card (16.1). OR
- **Implement the command event or special event** listed on the card. See the EVENTS player aid.

ACTIVATIONS: When activating units as your command, you can’t activate a formation or unit activated in the immediately preceding German impulse (6.3). Activated units conduct operations in the following sequence:
1. [GT 4+] Soviet garrison removal (15.3)
2. Movement (10.0).
3. Attacks (12.0). You may play additional cards as combat tactics, each in support of one attack.
4. Improved position placement (14.21).
5. Dispersed marker removal (12.9).

You may pass instead of playing a card if your draw pile is empty and you have **just one card in hand**. You must pass if you have no cards. Passing ends your impulse. After completing a command, draw cards from your draw pile if available to bring your hand up to the German hand size limit for the game-turn. A Soviet impulse then begins.

3. REPEAT IMPULSES

Repeat Soviet and German impulses in the Command Phase until the Soviet draw pile, and your hand and draw pile are all exhausted, at which point the game-turn ends. When one side runs out of cards, the other side receives consecutive impulses until they also run out of cards.

V. END OF TURN PHASE If the space for the current game-turn on the calendar includes Victory Levels, check to see if you have won or lost the game (17.2). Then:

- Return all combat chits to the cup.
- Remove all Dispersed and Forward support markers from the map.
- [GT 4+] Check Soviet Garrison markers in villages for removal (15.3).
- [GT 7] At the end of Game-turn 7, remove all Soviet objective markers from play.
- Advance the Game-Turn marker to the next space on the calendar and start a new game-turn.

## 5. GERMAN DRAW PILE AND COMMANDS

At game start, the primary and supplemental German command cards for Game-turn 1 are potentially available to you. More command cards become available to you over the course of the game per the reinforcement card schedule on the GERMAN COMMAND CARD DISPLAY.

From your available command cards each game-turn, you assemble a draw pile consisting of all your primary cards plus the number of randomly drawn supplemental cards indicated for the current game-turn on the calendar. Follow the procedure in the sequence of play and your COMMAND CARD DISPLAY. The supplemental cards you draw for your draw pile come from **all** available supplemental cards **except** those that were in your draw pile on the previous game-turn. Once the draw pile is formed, you use it to draw and replenish your hand throughout the game-turn.

**Example:** On Game-turn 1 the German draw pile totals eight cards (five primary plus three supplemental). On Game-turn 2 the German draw pile totals nine cards (five primary, four supplemental).

The German hand size limit changes on some game-turn as noted on the calendar, starting at four cards and increasing on subsequent game-turns.

<!-- p10 -->

### 5.1 Playing Cards from your Hand

In each German impulse, you play a card from your hand to initiate one of the commands listed on the card and described in rules 5.2-5.5. You may also play cards from your hand as **combat tactics** during a German or Soviet attack (12.3).

PASS OPTION: You may pass instead of playing a card for your impulse if your draw pile is empty and you have just one card in hand. Passing does not prevent you from playing a card in a subsequent impulse. You must pass if you have no cards.

### 5.2 Activation Commands

You may play any of the following command cards during your impulse to activate a specific set of German units, per 6.0.

**German Activation Commands:**

- Play a **Corps** card to activate all units in the named corps.
- Play a **Corps Kampfgruppe** card to activate a Kampfgruppe consisting of all units in the named corps within two hexes of a hex you designate.
- Play an **Army** card to activate all units of one corps of your choice in the named army.
- Play an **Army** card to activate a Kampfgruppe consisting of all units in the named army within two hexes of a hex you designate.
- Play the **Army Group South** or **Von Manstein** card to activate all units of one corps of your choice.
- Play the **Army Group South** or **Von Manstein** card to activate a Kampfgruppe consisting of all German units within three (or two if Von Manstein) hexes of a hex you designate.
- Once per Game Turn, play any card to activate one unit of your choice (6.1).

### 5.3 Deploy Reserves Commands

You may play one of the following command cards during your impulse to deploy available reserve units to the map, per 7.1.

- Play a **Corps** or **Corps Kampfgruppe** card to deploy all reserve units in the named corps.
- Play an **Army** card to deploy all reserve units in one corps of your choice in the named army.
- Play the **Army Group South** card to deploy all reserve units in any two corps of your choice.

### 5.4 Event and Special Event Commands

You may play a command card during your impulse to implement an event or special event shown on the card. Cards that do not list an event, or list an event not valid on the current turn cannot be played for a command event. Events are implemented per the Event’s instructions on the player aid.

German **Army**, **Army Group South** and **von Manstein** cards may be played as any Command Event. When you play one of these cards choose any German command event on the player aid valid on the current game-turn. Special events can’t be selected when choosing any command event.

### 5.5 Replacement Commands

[GT 3+] Beginning on Game Turn 3, you may play a Corps command card during your impulse to replace the indicated number of lost unit steps in that Corps, per 16.1.

### 5.6 Discarding Cards

Once you play a German card for any purpose and its effects are implemented, discard it. The GERMAN COMMAND CARD DISPLAY has two boxes for discards, one for primary cards and one for supplemental cards. This separation facilitates draw pile preparation at the start of the next game-turn.

## 6. ACTIVATING GERMAN UNITS AND FORMATIONS

During your impulse, you may play a card to activate the on-map German units specified by the card’s activation command. Active undispersed units perform actions in the following sequence.
1. [GT 4+] Starting Game-turn 4, remove all Soviet garrisons adjacent to active supplied undispersed units (15.3).
2. All active units may move (10.0).
3. All active units may attack adjacent enemy units (12.0).
4. Active units that did not move or attack may build improved positions (14.21).
5. Dispersed units in the active formation that didn’t attack become undispersed (12.9).

### 6.1 Activating One Unit

Once per game-turn, you may activate any one German unit able to trace supply at the moment of activation, by playing any command card, regardless of the unit’s designation. A unit activated in this manner can’t attack. You can place the optional marker provided on the current game-turn space of the calendar as a reminder; flip the marker to show that the command is available or used.

### 6.2 Activating a German Kampfgruppe

Several German command cards allow you to activate an ad-hoc Kampfgruppe (literally “battle group”) consisting of units within two or three hexes of a designated hex. Upon playing a card to activate a Kampfgruppe, place the KG marker in any hex on the map (even if occupied by an enemy unit). All eligible units specified on the card that start the activation within the indicated hex range of the KG marker must be activated, regardless of the presence of enemy units. Friendly in-range units that are not specified on the card or are ineligible due to the consecutive activation restriction (6.3) are not activated. Remove the KG marker from the map at the end of the activation.

> **[Exemple p10]**
>
> **Example:**
>
> **German Game-turn 1**
>
> - You begin the game with five primary cards and five supplementalcards potentially available.
> - The Game Turn 1 space of the calendar indicates that you receive 2 supplemental cards plus the LVII PzCorps KG (card P41). Place the LVII card in your hand. Shuffle the remaining four supplementals and put them in the Available Supplemental Card box.
> - Now draw two cards from the available supplemental pile and shuffle them together with all five primary cards. This forms the draw pile for the turn, consisting of seven cards.
> - The German hand size on game-turn 1 is four cards. Therefore, from your draw pile, draw three cards. These three cards, plus the LVII PzCorps KG card forms your game-turn 1 starting hand.
> - At the end of each German impulse, you draw cards from the draw pile to bring your hand back up to four, until the draw pile is exhausted.
>
> **German Game-turn2**
>
> - As listed on the GERMAN COMMAND CARD DISPLAY, four new cards become available to you on Game-turn 2 -- all supplemental, giving you a total of five primary and nine supplemental cards potentially available.
> - However, the three supplemental cards that were in your draw pile on Game-turn 1 are not available to you on Game-turn 2, leaving you with six supplemental cards available.
> - Shuffle those six cards and draw four, as noted on the calendar.
> - Shuffle the four supplemental cards together with your five primary cards to form your draw pile for Game-turn 2.
> - Finally draw four cards from the draw pile to form your initial hand.

> **[Exemple p11]**
>
> Example of German Corps Activation by Army Card:
>
> You play the 4th Panzer Army command card which allows you to activate any Corps in that Army. You choose the LVII Panzer Corps. All the units of that corps on the map are activated. This includes dispersed and out of supply units in the activated formation. Depicted units of the IISS and Corps Raus are not activated. The IISS is in the 4th Panzer Army but the activation only affects the selected corps, the LVII. **[Errata]** Last sentence should read: “IISS and Corps Raus are in 4th Panzer Army for command purposes but only the LVII Panzer Corps is activated.”
>
> Activating a German Kampfgruppe (6.2):
>
> You play the German Army Groups South card and place the KG marker on hex 2213. All German units within 3 hexes, regardless of corps or army affiliation, or enemy units, are activated.
>
> This activation includes three units of Corps Raus, one from the XLVIII Panzer Corps, one from the IISS Panzer Corps (all from 4 PZ Army), and one from the XL Panzer Corps in 1 PZ Army.
>
> It does not include units of these corps outside the 3-hex range from the KG marker; 429.168. Raus is not activated.

<!-- p12 -->

### 6.3 German Consecutive Activation Restriction

You can’t activate a German unit, corps or Kampfgruppe containing units that were activated in the immediately preceding German impulse. You can’t activate a unit in a Corps if any units of that Corps were activated in your immediately preceding impulse. Thus, if a unit were activated in one impulse, you could not activate that same unit in your next impulse and could not activate the unit’s parent corps. If you activate a Kampfgruppe (6.2), it can’t include any units activated or in a formation activated in the previous German impulse. In the impulse following activation of a Kampfgruppe you can’t activate units in any corps that includes units that were part of that Kampfgruppe.

VON MANSTEIN EXCEPTION: A unit, Corps or Kampfgruppe activated by the Von Manstein card is not subject to the Consecutive Activation Restriction. That is, all units and formations are eligible for activation by Von Manstein, even if activated in the preceding German impulse.

Playing a command card to deploy reserves or assign replacements for a formation are not activations and do not prevent play of a card to activate that formation in the next impulse. Conversely, activating a corps does not prevent deploying reserves or assigning replacements for that formation in the next impulse.

Bringing a unit into a combat via the Reinforce Battle or Assault Coordination combat tactic card play is not considered an activation and so is not subject to these restrictions.

Consecutive activation restrictions do not carry over from the last impulse of one day to the first of the next. Consecutive activation restrictions apply only to German activations, never Soviet.

You can use the optional corps activation markers as reminders of corps activation restrictions. At the end of each impulse in which you activate units, place markers for the active units’ corps in an easy to see location, such as an unused area of the map or card display. Remove or replace the markers at the end of your next impulse.

## 7. GERMAN RESERVES

Reserves include units that have not yet entered play, and units previously eliminated that have received replacements. A unit is a reserve when in the Reserve Units box.

- During the Reserve Phase of each game-turn, place German units marked with the current game-turn in the German Reserve Units box.
- During your impulse, when you play a Replacement Command you may place eliminated units in the Reserve units box, per 16.1.

Units in the Reserve Units boxes are deployed onto the game map by the play of a card as a Deploy Reserves command, or after two game-turns have passed since their printed game-turn of arrival.

### 7.1 Deploying German Reserves

As your command card play for an impulse, you may play a card to deploy all the reserve units in the formation listed on the card.

- Play a **Corps** or **Corps KG** card to deploy all reserve units in the named corps.
- Play an **Army** card to deploy all reserve units in one corps of your choice in the Army.
- Play the **Army Group South** card to deploy all reserve units in any two corps of your choice.

German units may be deployed via **Tactical Deployment** or **Strategic Deployment** at your option.

**TACTICAL RESERVE DEPLOYMENT** Place German reserve units in hexes of your choice on the map within all the following restrictions:

- In the unit’s army area.
- In a German map edge hex or road hex that is a valid friendly supply head (13.1), or a clear terrain hex adjacent to such a hex.
- At least three hexes away from an enemy unit or enemy town or city, excluding isolated enemy units. This distance is reduced to two hexes if placing the unit in a German map-edge hex.
- Not in a hex containing a Soviet garrison, but may be adjacent.

Within these restrictions, place the unit within three hexes of a unit in the same corps. If this is not possible then place the unit within three hexes of a unit in the same army. If neither is possible, the reserve unit can’t be placed via tactical reserve deployment.

**STRATEGIC RESERVE DEPLOYMENT** Place reserve units in a German map-edge hex or road hex that is a valid friendly supply head (13.1) in the unit’s army area, and at least five hexes away from all non-isolated enemy units, garrisons, and enemy towns and cities. This distance is reduced to two hexes if placing the unit in a German map-edge hex.

### 7.2 Multi-Unit Deployments

Reserve units may be deployed in any sequence. The moment a unit is placed it is considered in play when determining where subsequent reserves may be placed in the same impulse.

**Example:** If you are deploying two reserve units via tactical deployment, you may place one unit within three hexes of an on-map unit in the same corps, and then place the second unit within three hexes of the just placed unit.

Reserve units may be deployed in hexes with other friendly units as long as stacking limits are observed.

### 7.3 Delayed Reserves [GT 3+]

During the Reserve Phase any full-strength units in your Reserve Units box with a printed game-turn two or more game-turns earlier than the current game-turn may be deployed to the map without a card play, in accordance with the reserve placement rules. The delayed reserves rule does not apply to replacement or reduced units in the reserve box.

**Example:** A unit printed with Game-Turn 1 could be deployed during the Reserve Phase of Game-Turn 3, if still in the Reserve Units box.

> **[Exemple p12]**
>
> **Examples:**
>
> - You play the Army Group South card to activate a Kampfgruppe made up of units of Corps Raus, XLVIII Panzer Corps, and IISS Panzer Corps. In your next impulse, you may not activate any units in any of these three corps.
> - You play the XL Panzer Corps card to activate units of that corps. In your next impulse you cannot play a card to activate the XL Corps or any units in that corps.
> - You play a card for the command “Activate any one unit” and choose to activate the single unit AH.LAH.IISS. In your next impulse, you cannot activate any units in IISS Corps.

<!-- p13 -->

## 8. SOVIET DRAW PILE AND COMMANDS

At game start, the Soviet draw pile consists of all Soviet cards specified in the game setup (3.0). You add cards during the Card Preparation Phase of Game-turns 2 and 3 (per the reinforcement card schedule in the Soviet Draw Pile box).

During the course of the game-turn you draw and reveal Soviet cards from the draw pile for the following:

- At the start of each Soviet impulse draw two cards from the draw pile, selecting one as the command card for the impulse and the other as the auxiliary card, per 8.1.
- During the Soviet impulse, draw a card for each non-overwhelming Soviet attack in Soviet support, to see if the attackers benefit from the card’s combat tactic (12.3 and 12.38).
- During the German impulse, for each non-weak German attack against Soviet units in a hex in Soviet support, draw a Soviet card to see if the Soviet defenders benefit from a combat tactic (12.3).

As you complete the use of Soviet cards, place each face up in the Soviet Discards box on the map. When you draw the last card in the deck, complete the function for which the card is drawn, then after German impulses are completed, the game-turn ends. If only one card is available at the start of a Soviet impulse, draw just one (instead of two) and use it as a command card.

### 8.1 Soviet Command Card Selection and Use

At the start of each Soviet impulse, draw the top two cards from the Soviet draw pile and select the card marked **Primary** as the **command card** for the impulse. If both or neither are Primary, select the card with the **higher Command Value** as the command card. If Command Values are equal, select the card with the **lower card ID number** as the command card. The unselected card is the **auxiliary card**.

Place the command card in the Command Card box and the auxiliary card in the Auxiliary card box. Then conduct the Soviet impulse, performing functions with the command card and auxiliary card in the following sequence:
1. **Auxiliary card:** If the auxiliary card shows a **command event** applicable on the current game-turn, and in the current game situation, implement the event and discard the card. An auxiliary card without an applicable event remains in the Auxiliary card box. Special events on the auxiliary card are not implemented.
2. **Command card:** On the command card, read through the eligible commands in order from top to bottom and perform the first command that is possible to carry out. When the command is completed or if no command can be conducted, place the command card in the discard pile.
    - **Auxiliary combat tactic.** If the command being conducted is an activation command in which an attack occurs, and the auxiliary card lists a combat tactic applicable to that attack, that tactic may be applied, see 12.31. If applied, the auxiliary card is then discarded.
3. **Second Impulse**. If the auxiliary card is still in the Auxiliary card box upon completing the command on the command card, move the auxiliary card to the Command Card box and immediately repeat step 2 using this new command card. In this way, the Soviet side will sometimes conduct two impulses in a row, although there will be no auxiliary card available as a combat tactic in the second impulse.

> **[Exemple p13]**
>
> Deploying German Reserves (7.1):
>
> It is Game-turn 1. You play the IISS Corps command card to deploy the four units of that Corps available on Game-turn 1. The units must be placed in a supply head hex or clear hex adjacent to such a hex in the 4th Panzer Army deployment area. You choose to use tactical deployment for all four units.
>
> 1. There are no units of IISS Corps on the map. The first IISS unit - you may freely choose the order - must be placed within three hexes of a unit in the same army, the 4th Panzer. However the unit cannot be placed within three hexes of a Soviet unit. Green checkmarks indicate valid placement hexes, red “x” symbols indicate invalid placement locations. You choose to place the unit in hex 1108.
>
> 2. Now that there is a unit of IISS Corps on the map, the other IISS units must be placed within three hexes of that unit. You place the DF and LG units in hex 1407.
>
> 3. The DL unit cannot be placed in 1407 due to stacking limits. However, because units are “active” for reserve placement rules as soon as they are placed on the map, the DL unit could be placed within three hexes of the units in 1407. You choose hex 1507.
>
> Alternatively, you could have chosen to deploy some or all the units using strategic deployment. placing the units in any German supply head hex in the 4th Panzer Army deployment area and at least five hexes away from a Soviet unit.

<!-- p14 -->

COMMANDS: The command card may include any of the commands listed in 8.11, 8.12 or 8.13. Check the commands in the order listed on the card and perform the **first command that applies** on the current game-turn. If no commands on the card can be conducted, discard the card without effect.

#### 8.11 Event or Special Event Command

Conduct the event or special event listed on the card if valid on the current game-turn. All events and special events are described on the EVENTS & TACTICS player aid. Some command descriptions include situations in which the command does not apply. In such a situation do not perform the event command.

#### 8.12 Assign Replacements Command

If the Replacement Command is valid on the current game-turn and the listed Army has a unit eligible for replacement, assign a replacement step to the unit (16.0). If the army has no eligible units, do not perform this command.

#### 8.13 Unit Activation Command

Activate units in the formation specified on the card, per 9.0, if at least one non-isolated unit in the specified formation is on the map or in the reserve box. If this minimum requirement is not met, do not perform the activation command. Soviet formations are not subject to consecutive activation restrictions.

- ARMY UNITS CARD: Activate up to two units or stacks in the listed army and not in a VP hex. Among eligible units/stacks, prefer: a) supplied; b) not surrounded; c) highest total strength; c) most units; d) lowest selector. Also activate all units of the army in the Soviet Reserve Units box. If no units can be activated, do not perform this command.
- ARMY CARD: Activate all units in the listed army, including units on the map and in the Soviet Reserve Units box. Mobile Group Popov is considered an army for activation purposes.
- **Army and Army Units Exception:** If there are no non-isolated units on the map or in the reserve box in the listed army, the activation does not occur. Move on to the next command on the card. If no commands on the card can be conducted, discard the card without effect.
- VORONEZH FRONT CARD:

[GT 2,3] Activate all units in the 3rd Tank Army, and any Voronezh Front units stacked with units of that army.

[GT 4-7] Activate all units in the army in Voronezh front with the most units. Count only on-map supplied units and units in the reserve box. If activated include the army’s unsupplied units and include units in the same front stacked with units of that army. If tied, activate the army with a supplied unit closest in hexes to the west map edge, then the lowest numbered army.

[GT 8+] Activate all Voronezh Front units that are outside the operational limit or are nearly surrounded. Reserve units are not activated. If no units qualify, instead activate units per the instructions for Game-turns 4 through 7.

- SOUTHWEST FRONT CARD:

[GT 1-3] Activate all unit in Mobile Group Popov, and any Southwest Front units stacked with units in MGP.

[GT 4-7] Activate the army in Southwest front with the most units. Count only on-map supplied units and units in the reserve box. If activated, include the army’s unsupplied units and include units in the same front stacked with units of that army. If tied, activate the army with a supplied unit closest to the 3300 hexrow, then the lowest numbered army.

[GT 8+] Activate all Southwest Front units that are outside the operational limit or are nearly surrounded. Reserve units are not activated. If no units qualify, instead activate units per the instructions for Game-turns 4 through 7.

- STAVKA CARD:

[GT 1&3] Activate all unit in Mobile Group Popov, and any Southwest front units stacked with units of MGP.

[GT 2&4] Activate all unit in the 3rd Tank Army, and any Voronezh Front units stacked with units of that army.

[GT 5-7] Activate the army with the most units. Count only on-map supplied units and units in the reserve box. If activated include the army’s unsupplied units and include units in the same front stacked with units of that army. If tied, activate the army with a supplied unit closest to hex 1923.

Activations via a Front card or the STAVKA card include unsupplied units and reserve units in the activated army and all units from other armies in the same front stacked with the units in the activated army. All attacks in a STAVKA activation receive the NKVD combat tactic.

> **[Exemple p14]**
>
> Soviet Front Card Activation (8.1):
>
> During a Soviet impulse on Game-turn 4, you draw **Southwest Front** (E20) as the Soviet command card, instructing you to ”Activate army in SW Front with most supplied units on map and in reserve box, plus stacked units.”
>
> There are three armies in the SW front: Mobile Group Popov has six units on the map and in reserve; 6 Army has four units; and 1G Army (not shown) has three units.
>
> Since Popov has the most units, its five units on the map and one unit in the reserve box are activated. Unit 172/6 is stacked with an active Popov unit, so it too is activated.

<!-- p15 -->

### 8.2 STAVKA Command Card Removal [GT 7]

Upon drawing, implementing and discarding the STAVKA card on game-turn 7, remove the card from play. It is not in the Soviet deck from turn 8 on.

### 8.3 Selection Preferences

Many command instructions include selection preferences to be used when more than one hex, unit or stack meets the instruction’s selection requirements. When more than one item is eligible, process the preferences in alphabetical order. If preference (a) applies to just one item, select that item. If (a) applies to more than one item, then apply preference (b) to those items, and so on through the lettered preferences until the choice is narrowed to one item. If a preference applies to no items, skip it and proceed to the next preference in the list.

## 9. SOVIET UNIT ACTIVATIONS

When a Soviet command card calls for the activation of a Soviet formation, determine which units are activated per 8.13, then conduct the activation in the following sequence of steps:
1. [GT 1-7] OBJECTIVE CHECK. Check the location of the Objective marker for the front or army to which the active units belong, relocating or removing it if required (9.1). Skip this step if the active front’s objective marker has been removed from play.
2. MOVEMENT. Move active on-map units according to the movement methods currently in effect (9.2).
3. ATTACKS. Conduct attack checks and attacks with active units (9.4). Add eligible active reserve units to attacks.
4. [GT 4+] PLACE RESERVES. Place eligible active reserve units on the map (9.5).
5. [GT 2+] REMOVALS. Remove eligible active units to the Soviet Reserve Units box (9.6)
6. [GT 4+] PLACE IP. Place an improved position marker on one eligible active unit (9.7)
7. UNDISPERSE. Remove Dispersed markers from active units that did not attack (12.9).

ACTIVATION COMPLETION. After processing all activation steps, the activation command is considered complete, even if nothing occurred in those steps.

### 9.1 Soviet Front and Army Objectives

The two Soviet Fronts each have a Front Objective marker, placed in a hex on the map. Soviet units tend to move toward their front’s objective unless other movement methods take precedence. As Soviet units approach a front objective, the marker is relocated to keep objectives ahead of the Soviet offensive.

One army in each Soviet front – 40th and 1st Guards – has an Army Objective marker that takes priority over the Front Objective marker for units in that army, giving the units army-specific objectives.

#### 9.11 Placing and Relocating a Front Objective Marker:

The objective markers for the Voronezh and Southwest fronts are placed on the map as indicated in the initial set up adjustments (Section 3). During play, upon activating a Soviet formation check the location of the Objective marker for the front to which the activated formation belongs.

If any active or inactive unit in the active Soviet front:

- Occupies the objective hex, or
- Occupies a hex adjacent to the German-occupied objective hex, or
- is proximate to the unoccupied objective hex;

then relocate the Front objective marker. If none of these situations apply the objective marker remains in its current hex.

RELOCATION PROCEDURE: Roll the die and cross reference the die result with the Objective marker’s current location on one of the following two tables. Place the front’s Objective marker in the indicated hex, with the side showing the indicated compass direction face up.

**OBJECTIVE PLACEMENT TABLE: 1st to 2nd objective**

| Objective marker current hex | 1-6 | 7-9 | 10 |
|---|---|---|---|
| Chuguev | Valki W | Krasnograd W | Kharkov W |
| Volchansk | Kharkov W | 0614 S | Valki W |
| Zmiyev | Valki W | Krasnograd W | Kharkov S |
| 1608 | 2015 S | Pavlograd W | 2809 W |
| 1906 | Pavlograd W | Krasnoarmiysk W | 2809 W |
| 1410 | 2214 S | Lozovaya W | 2015 S |

**OBJECTIVE PLACEMENT TABLE: 2nd to 3rd objective**

| Objective marker current hex | 1-6 | 7-9 | 10 |
|---|---|---|---|
| Valki | Poltava W | 1221 S | 1621 W |
| Kharkov | Poltava W | 0821 S | 1221 S |
| 0614 | 1221 S | Poltava W | 0821 S |
| Krasnograd | Poltava W | 1621 W | Poltava W |
| 2015 | Dnepropetrovsk W | Pryadovka S | Sinelnikowo W |
| Pavlograd | Zaporozhe W | Dnepropetrovsk W | Dnepropetrovsk W |
| 2214 | Zaporozhe W | Dnepropetrovsk W | Pryadovka S |
| 2809 | Sinelnikowo W | Zaporozhe W | 3314 W |
| Krasnoarmiysk | Zaporozhe W | Sinelnikowo W | 3314 W |
| Lozovaya | Dnepropetrovsk W | Pryadovka S | Sinelnikowo W |

#### 9.12 Reaching a Front’s Third Objective:

Over the course of the game, each Front Objective marker is placed in a sequence of three objective hexes. Once an Objective marker for a given front is placed in its third hex (per the Third Objective Placement Table above), the objective placement tables are no longer used for that front.

FRONT OBJECTIVE REMOVAL. A front’s objective marker remains in its 3rd location hex until any of the following occurs:

- At the end of a Soviet activation in which a Soviet unit enters the 3rd objective location hex, remove the objective marker in that hex from play.
- [GT 7] Remove the objective marker for a given front during the Supply Phase of Game-turn 7, if no Soviet unit able to trace reserve supply is adjacent to the marker at that time.
- [GT 7] Remove both front objective markers from play at the end of Game-turn 7, regardless of Soviet unit adjacency.

From the moment a Front’s objective marker is removed:

- the **Soviet Operational Limit** is in effect for that front and all units of that front (9.8);
- use the Movement Methods in 9.22 when moving units in the front.

<!-- p16 -->

#### 9.13 Placing and Removing an Army Objective Marker:

Upon activating the 40th or 1st Guards Army for the first time, place the Army Objective marker for that army in the first hex indicated on the back of the marker – 0311 for 40th Army and 2102 for 1G Army. An Army objective is considered reached only when a Soviet unit (of any army) enters the marker’s hex. When this occurs move the army objective marker to the next hex listed on the back of the marker. For example when a Soviet unit enters hex 0311 for the first time, relocate the 40th Army Objective marker to hex 1012, then when that hex is entered, to 0215.

As long as an Army objective marker is in play, the units in that army follow the special movement methods of 9.26.

ARMY OBJECTIVE REMOVAL: An army objective marker is removed from play when:

- any Soviet unit enters the last listed hex on the army objective marker (hex 0215 for 40th Army, hex 2701 for 1Guards Army),even if other hexes on the marker have not yet been entered; or
- the front objective marker for the front to which the army belongs is removed from play.

When an army objective marker is removed, units in that army follow the movement methods for their front’s objective, if in play.

#### 9.14 No Effect on German Units:

Objective markers have no effect at all on German units. An Objective marker may be in a hex with a German unit, town or city.

### 9.2 Soviet Movement Methods

During Step 2 of a Soviet activation, move active on-map undispersed units via the numerical sequence of movement methods currently in effect;

- use the Movement Methods in 9.21 throughout Game-turns 1-4 and on subsequent Game-turns if the Front objective marker for the active front is in play;
- use the Movement Methods in 9.22 from Game-turn 5 on if the front objective marker for the active front has been removed from play.

PROCESS MOVEMENT METHODS IN NUMERICAL ORDER:

- Check units for eligibility to move by a given method in unit selector order. Check units in **ascending** (▲) or **descending** (▼) order as indicated for each method.
- Move **all** eligible units by a given movement method **before** proceeding to the next movement method.
- Continue down the list of movement methods until all units have moved or been directed not to move, or until all Movement Methods have been checked.
- All movement methods are subject to the rules for movement (10.0) and the Soviet movement restrictions (9.23). A unit that hasn’t moved after all movement methods are checked does not move in that activation.

**Exceptions:** The movement methods are modified or superseded for units in the following situations:

- Active units with an **Army** Objective (9.26);
- Unsupplied units (9.27).

A given unit moves only by one method per activation. Some movement methods specify situations in which a unit does not to move at all by that method or any later method in the sequence. **Suggestion:** As you complete a unit’s move, or determine that a unit will not move this activation, rotate the unit’s orientation in the hex as a reminder.

#### 9.21 Soviet Movement Methods A

**[GT 1-4] USE THROUGHOUT GAME-TURNS 1-4 · [GT 5-7] USE IF FRONT OBJECTIVE IN PLAY**

Use the movement methods of 9.21 throughout Game-turns 1 to 4. Use these methods from Game-turn 5 onward, only if the active front’s Objective Marker is in play. **[Errata]** These movement methods are used throughout Game-turns 1-4 even if the Front objective marker has been removed from play.

##### 1. ▼ TAKE VP HEX

a) **Enter empty German Town or City.** Move to an empty German-owned town/city hex, unless targeted exclusively for the inactive front. **Urban Infiltration:** If starting adjacent to the town/city hex, move into that hex regardless of German zones of control.

b) **Enter empty map-edge VP hex.** If (a) not possible, move to an empty map-edge VP hex from which Soviet Supply can be traced and stop. Map edge VP hexes are not eligible for urban infiltration.

##### 2. ▲ ADJACENT TO GERMAN VP HEX & NEAR OBJECTIVE

Skip Method 2 if the active front’s objective marker has been removed from play.

Move to a hex closer to or within four hexes of the unit’s objective marker **and** adjacent to a German VP hex. Prefer a VP hex a) targeted exclusively by the active front; b) occupied by the least German strength; c) not across a Dniepr River hexside from the moving unit’s hex; d) with the highest VP value. A Soviet unit starting adjacent to a German VP hex within four hexes of the objective marker and unable to move to a more preferred VP hex does not move by this or any subsequent method (except as directed by 9.25).

##### 3. ▼OPEN SUPPLY LINE [GT 3+]

Move to a hex that if occupied by the unit would enable a unit in the active front and currently unable to trace supply (including the moving unit itself) to be able to trace supply. Prefer the hex that enables the most Soviet units to trace supply. Note that this movement method begins on Game-turn 3 even though Soviet supply checks begin on Game-turn 4.

**MOVEMENT METHODS 4-9 AND SOVIET SPEARHEADS**

Units in the Soviet 3rd Tank Army (**3T**) and Mobile Group Popov (**Popov**) are considered spearhead units as long as their front’s objective marker is in play.

Methods 4-9 of 9.21 are skipped by certain spearhead units in early game turns. Methods 4-9 apply to all other units.

- [GT 1-2] Supplied spearhead units skip Methods 4-9 on Turns 1 and 2, unless those units occupy a town or city, or their front objective marker is removed from play.
- [GT 3-5] Supplied armored spearhead units skip Methods 4-9 on Turns 3-5, unless those units occupy a town or city or their front objective marker is removed from play. Methods 4-9 apply to spearhead units other than armor units on Game-turns 3-5.
- [GT 6,7] Methods 4-9 apply to all units.

##### 4. ▼CAUSE SURROUND

Move to a hex that if occupied by the unit would cause an unsurrounded German unit to become surrounded (9.3). Prefer a hex that a) causes surround of the most German units; b) is adjacent to the German unit being surrounded; c) prevents a German unit from tracing supply; d) is not adjacent to a Soviet unit.

<!-- p17 -->

A Soviet unit already causing surround but not adjacent to the surrounded German unit moves adjacent if possible.

##### 5. ▼TO SOVIET VP HEX

**Any unit:** move to an empty or garrisoned Soviet VP hex targeted for the active front, and to which a German unit is proximate or [GT 3+] German supply is traceable. Prefer a) a hex to which a German unit is adjacent; b) an empty hex; c) the highest VP value.

**Soviet infantry unit:** if unable to move to an unoccupied Soviet VP hex, move to a VP hex occupied only by Soviet armor units, regardless of German proximity or supply trace. An infantry unit starting in a VP hex stacked with only armor units does not move by this or any subsequent method.

##### 6. ▲ADJACENT TO GERMAN VP HEX

Move to a hex adjacent to a German VP hex targeted for the active front. Prefer a) the hex occupied by the least German strength; b) the highest VP value. A Soviet unit starting adjacent to the most qualified German VP hex does not move by this or any subsequent method (except as directed by 9.25).

##### 7. ▼ADJACENT TO GERMAN UNIT IN LOGISTICS HEX

Move adjacent to a German unit in a logistics hex for the active front and not currently surrounded. Prefer a) the German unit/stack with the lowest total strength; b) the easternmost hex. A Soviet unit starting adjacent to a qualifying German unit/stack does not move by this or any subsequent method (except as directed by 9.25).

##### 8. ▼ADJACENT TO GERMAN UNIT

Move to an unoccupied hex that is adjacent to a German unit and not adjacent to a Soviet unit adjacent to that same German unit. Prefer a) a hex adjacent to the most German units; b) a German unit to which no Soviet unit is adjacent; c) the closest German unit. A unit starting in a hex satisfying this movement method does not move by this or any subsequent method (except as directed by 9.25).

> **[Exemple p17]**
>
> Processing Movement Methods for 3rd Tank Army on Game-turn 1 (9.21):
>
> During the first Soviet impulse of Game-turn 1, the 3rd Tank Army is activated. The Voronezh Front Objective West marker is in Chugyev, (hex 1009, not shown), so you use the Movement Methods of 9.21. Starting with Method 1, you check each method for all units before proceeding to the next method.
>
> Methods 1 and 2 do not apply because no active units can move to a German VP hex or a hex adjacent to a German VP hex.
>
> Method 3 is skipped because it is not yet GT 3. The 3rd Tank Army is a spearhead formation, so Methods 4-9 are skipped for all active units on Game-turn 1 (unless those units are in a town or city hex).
>
> According to Method 10, units will move following the movement arrows in each hex. However, Method 10 applies only if a unit can spend its entire movement allowance. All the units in 3rd Tank Army will be stopped by German ZOCs before using their entire movement allowance, therefore none move by Method 10.
>
> Method 11 calls for units to move closer to the objective marker (in 1009). Check units in ascending ▲ unit selector order:
>
> - Unit 01 (A.12.**3T**) is eight hexes from the objective. It can reach three hexes that are closer – 0903, 1002 and 1103 are all seven hexes from the objective and all happen to be adjacent to a German unit. To resolve the choice you first check the preferences in Method 11. None of these narrow the choice. Then you check the tactical preferences for moves adjacent to German units (9.25). Preference (f) indicatesa hex not occupied by an active unit, which applies to hex 1103 only. Unit 01 moves there.
> - Unit 03 is nine hexes from the objective and can reach several hexes that are eight away. Tactical preference (e) narrows the choices to two empty hexes, 0504 and 0802, and tiebreaker (c) puts the unit in the westernmost hex, 0504.
> - Unit 04, like unit 01, can move to 0903, 1002 or 1103. The preferences for Method 11 and for moving adjacent to a German unit do not resolve the choice, so you check the tiebreakers (9.24). Tiebreaker (c) indicates the hex farthest in the objective’s compass direction (west), narrowing the choice to 0903 and 1103. Tiebreaker (e) indicates the highest numbered hex, so unit 04 moves to 1103.
> - Unit 05 is eight hexes from the objective and can’t reach a closer hex so it does not move by Method 11.
> - Unit 06 is nine hexes away and can reach several hexes that are eight away. It moves to the only one that is now empty, 0802.
> - Unit 08 would move to hex 1103 following the same logic as units 01 and 04, but that would now exceed stacking limits, so it instead moves to 0903.
> - Unit 09 is nine hexes away from the objective and can reach many hexes that are closer. Method 11 preference (a) calls for the closest hex. Only one hex is seven away from the objective and within stacking limits: 1002. Unit 09 moves there.
> - Units 10, 15 and 24 don’t move by Method 11.
>
> Method 12 does not apply to units adjacent to German units, so units 05, 10, 15 and 24 don’t move at all in the activation.

<!-- p18 -->

##### 9. ▼RELIEVE GARRISON [GT 4+]

Move to a garrisoned hex targeted for the active front, to which a German unit is proximate or German supply can be traced, and to which Soviet supply can be traced. A hex adjacent to a Soviet unit is not eligible unless a VP hex. Prefer a garrisoned hex adjacent to a German unit.

MOVEMENT METHODS 10-12 apply to all units.

##### 10. ▲FOLLOW MOVEMENT ARROWS

If the unit occupies a hex with a movement arrow, move hex-to-hex in the direction indicated by arrows. In order to move by this method the unit must be able to spend its entire movement allowance. Consider primary and secondary movement arrows, disregarding movement arrows marked for the inactive front. The unit may spend an MP to exit an enemy ZOC at the start of its move, if otherwise allowed.

Prefer a move that a) ends in an unoccupied hex; b) ends farthest in hexes from the move’s starting hex; c) ends closest to objective; d) follows primary movement arrows. If a move in the primary direction would result in the unit’s move ending before all MPs are spent (due to enemy ZOC or high terrain cost) while a move in the secondary direction would allow all MPs to be spent, move in the secondary direction.

##### 11. ▲MOVE CLOSEST TO FRONT OBJECTIVE

Skip Method 11 if the active front’s objective marker has been removed from play.

Move to a hex closer to the unit’s front objective, not the same distance from the objective. Prefer the hex a) closest to the front objective, b) adjacent to German-occupied hex with least strength; c) empty hex.

Distance to the front objective is traced regardless of intervening units and terrain, except that distance can’t be traced across a blocked Dniepr River hexside.

> **[Exemple p18]**
>
> Processing Movement Methods for Mobile Group Popov on Game-turn 3 (9.21):
>
> During Game-turn 3, Mobile Group Popov is activated. The Southwest Front Objective West marker is in Pavlograd, (hex 2412, not shown), so you use the Movement Methods of 9.21.
>
> Method 1 checks units in descending▼order for movement to an empty German VP hex targeted by the Southwest front. The town of Lozavaya in 1910 qualifies. Unit 08 can’t reach 1910 in a single move, but unit 07 can so it moves to Lozavaya and stops, causing Lozavaya to immediately become Soviet-owned. After this move, Method 1 applies to no other units. Note also that as a consequence of this move the German unit in 1710 is surrounded.
>
> Method 2 doesn’t apply because now no active units can move to a hex adjacent to a German VP hex (remember, Lozavaya is now Soviet).
>
> Method 3 doesn’t apply because all Soviet units can trace supply.
>
> Mobile Group Popov is a spearhead formation, so Methods 4-9 are skipped for armor units in non-town/city hexes, but apply to infantry units on Game-turn 3.
>
> Method 4 checks units in descending▼order for a move that causes a German unit to be surrounded. Unit 08 can’t make such a move but unit 05 can. It moves to hex 1807, causing surround of the German unit in 1808.
>
> Method 5, 6 and 7 do not apply.
>
> Method 8 calls for a move to hex adjacent to a German unit and not adjacent to a Soviet unit adjacent to the same German unit. Unit 08 can reach hex 1709 which qualifies, so it moves there.
>
> All infantry units have moved so Method 9 is skipped.
>
> Method 10 checks units in▲ scending order for a move in which the entire movement allowance is spent following movement arrows. Unit 01 can’t do this because the move would be stopped by German ZOCs. Unit 03 qualifies. It spends 1 MP to exit a German ZOC then follows movement arrows to avoid German ZOCs, ending its move in hex 1914. Unit 06 would be eligible except that it is causing surround of the German unit in 1710 and Soviet movement restriction 9.23a prohibits a unit from moving if doing so would cause a surrounded German unit to become unsurrounded.
>
> Method 11 checks units in▲ascending order for a move closer to the objective, with a preference for closest to objective.
>
> Unit 01 is eight hexes from the objective and can get within six hexes of the objective by moving to 1811 or 1812. Tiebreaker (c) places the unit in the 1812, the westernmost hex.
>
> Unit 06 can move closer to the objective as long as it also keeps the German unit in 1710 surrounded. It moves to hex 1711, one hex closer to the objective and still causing surround.
>
> Method 12 is skipped since all active units have moved.

<!-- p19 -->

##### 12. ▲STRENGTHEN POTENTIAL ATTACK

If not adjacent to a German unit, move to a hex adjacent to a German unit to which another active Soviet unit is also adjacent. A unit starting adjacent to a German unit does not move by this method.

#### 9.22 Soviet Movement Methods B

**[GT 5+] USE IF FRONT OBJECTIVE REMOVED FROM PLAY**

Use these movement methods from Game-turn 5 onward if the active front’s Objective Marker has been removed from play.

[GT 6+] Starting on Game-turn 6, the Soviet Operational Limit (9.8) applies to certain movement methods in 9.22. If so indicated, the destination hex for that movement method must be within the current Soviet operational limit line.

##### 1. ▼ TAKE VP HEX

a) **Enter empty German Town or City.** Move to an empty German-owned town/city, unless targeted exclusively for the inactive front. Urban Infiltration: If starting adjacent to the town/city hex, move into that hex regardless of German zones of control.

b) **Enter empty map-edge VP hex.** If (a) not possible, move to an empty map-edge VP hex from which Soviet Supply can be traced. Map edge VP hexes are not eligible for urban infiltration.

##### 2. ▼OPEN SUPPLY LINE

Move to a hex that if occupied by the unit would enable a unit in the active front and currently unable to trace supply (including the moving unit itself) to be able to do so. Prefer a hex a) enabling the most Soviet units to trace supply; b) in which the moving unit would not be nearly surrounded; c) in Soviet support; d) closest to Soviet support.

##### 3. ▲TO SOVIET VP HEX

**3a.** Move to a Soviet VP hex targeted for the active front, that is empty, garrisoned **or occupied by only one step (one or two steps in Kharkov)**, and to which a German unit is proximate or German supply is traceable. Prefer a) an empty or garrisoned hex; b) the highest VP value hex; c) a hex to which a German unit is adjacent; d) in Soviet support. A unit starting stacked with one or fewer other steps in a VP hex (two or fewer in Kharkov) to which a German unit is proximate or German supply is traceable does not move by this or any subsequent method.

> **[Exemple p19]**
>
> Processing Movement Methods for 6th Army on Game-turn 8 (9.22):
>
> During Game-turn 8, 6th Army is activated. The Southwest Front objective marker has been removed so you use the Movement Methods of 9.22. The Soviets have just 18 VP, so any units west of the near operational limit line (running from 1613 to 2212) are beyond the current Soviet operational limit. The VP level also means that all the depicted Soviet units are not in support, and none can reach a hex in support in a single move.
>
> Methods 1-3 do not apply.
>
> Method 4 checks for active units that are nearly surrounded. This applies to unit 04 in 1817, because the German unit in 1818 is proximate to hex 1717, from which it would surround the Soviet unit. Unit 04 can move to several different hexes that are not nearly surrounded.
>
> Method 4 preferences a, b and c do not narrow the choice. But preferences d, e and f do. You move the unit to hex 1717; it is (d) an unoccupied hex, (e) not adjacent to a Soviet unit and (f) closest to the hex from which the move starts.
>
> Method 5 does not apply. With VPs below 19, Soviet desperation is in effect so you interrupt the sequence to check Method 11 now, but it does not apply.
>
> Method 6 checks for units outside the operational limit, which now applies only to unit 08 in 1815. The unit can reach several hexes east of the near operational limit line. Preference (e) closest to a hex in support, narrows the choice to 1713 and 1812. You then apply tiebreaker 9.24 (e) and move the unit to hex 1812.
>
> Method 7 does not apply to the two remaining active units.
>
> Method 8 checks for moves to a hex adjacent to a German unit, but all such hexes are beyond the operational limit so this method is skipped.
>
> Method 9 checks units in▼descending order for a move to a garrisoned hex to which a German unit is proximate or German supply can be traced, and to which Soviet supply can be traced. Garrisoned hex 1813 qualifies, so you move unit 13 there and remove the garrison.
>
> Method 10 does not apply to unit 02, the only active unit remaining, and Method 11 was checked earlier, out of sequence. Unit 02 does not move at all; and since it is outside Soviet support it is not a candidate to receive an IP.

<!-- p20 -->

**3b. Soviet infantry unit only:** if paragraph 3a does not apply to the unit, then move to a VP hex occupied only by Soviet armor units, regardless of German proximity or supply trace. An infantry unit starting in a VP hex stacked with only armor units does not move by this or any subsequent method.

##### 4. ▲AVOID SURROUND

If nearly surrounded in a non-VP hex, move to a hex in which the unit is not nearly surrounded. Prefer a hex a) in Soviet support; b) within the operational limit; c) closer to a hex in support than the starting hex; d) unoccupied; e) not adjacent to a Soviet unit; f) closest to the starting hex.

##### 5. ▲ADJACENT TO GERMAN VP HEX

A German VP hex beyond the operational limit is eligible only if empty or occupied by just 1 step.

Move to a hex adjacent to a German VP hex targeted for the active front and in which the moving unit would not be nearly surrounded. Prefer adjacent to a VP hex a) occupied by the least German strength; b) with the highest VP value. A Soviet unit starting in a hex adjacent to a qualified German VP hex and not nearly surrounded does not move by this or any subsequent method (except as directed by 9.25).

SOVIET DESPERATION: If the Soviets have **less than 19 VPs**, process **Movement Method 11** (9.22) now, before proceeding to Method 6.

##### 6. ▲MOVE INTO OR TOWARD OPERATIONAL LIMIT

Skip if no active units are beyond the operational limit.

If in a hex beyond the current Soviet operational limit, move to a hex within the limit or, if not possible, to a hex closer to the limit. Prefer a hex a) within the operational limit; b) not on a map edge; c) not stacked with or adjacent to a Soviet unit; d) in Soviet support; e) closest to a hex in support; f) containing a village targeted for the moving unit’s front.

##### 7. ▼CAUSE SURROUND

*Operational limit applies.*

Move to a hex that if occupied by the unit would cause an unsurrounded German unit to become surrounded and would not cause the moving unit to become nearly surrounded (9.3). Prefer a hex that a) causes surround of the most German units; b) is adjacent to the German unit being surrounded; c) prevents a German unit from tracing supply; d) is not adjacent to a Soviet unit.

A Soviet unit already causing surround but not adjacent to the surrounded German unit moves adjacent if possible.

##### 8.▼ADJACENT TO GERMAN UNIT

*Operational limit applies.*

Move to an unoccupied hex adjacent to a German unit and not adjacent to a Soviet unit adjacent to the same German unit, and in which the moving unit would not be nearly surrounded. Prefer a) a hex adjacent to the most German units; b) a German unit to which no Soviet unit is adjacent; c) the closest German unit; d) highest hex number. If starting as the only Soviet unit adjacent to a given German unit and in a hex within the operational limit and not nearly surrounded, the unit does not move by this or any subsequent method (except as directed by 9.25).

##### 9. ▼RELIEVE GARRISON

*Operational limit applies.*

Move to a garrisoned hex targeted for the active front, to which a German unit is proximate or German supply can be traced, and to which Soviet supply can be traced. Prefer a garrisoned hex a) adjacent to a German unit; b) to which a German unit is proximate. A unit starting in a village hex targeted for the active front and to which a German unit is proximate does not move by this or any subsequent method.

##### 10. ▲FOLLOW MOVEMENT ARROWS

*Operational limit applies.*

If the unit occupies a hex with a movement arrow, move hex-to-hex in the direction indicated by arrows. In order to move by this method the unit must be able to spend its entire movement allowance. Consider primary and secondary movement arrows, disregarding movement arrows marked for the inactive front. The unit may spend an MP to exit an enemy ZOC at the start of its move, if otherwise allowed.

Prefer a move that a) ends in an unoccupied hex; b) ends farthest in hexes from the move’s starting hex; c) follows primary movement arrows. If a move in the primary direction would result in the unit’s move ending outside the operational limit or before all MPs are spent while a move in the secondary direction would avoid these outcomes, move in the secondary direction.

##### 11. ▲PROXIMATE TO GERMAN VP HEX

A VP hex beyond the operational limit is an eligible Target only if empty or occupied by just 1 step.

Move to a hex in which the moving unit becomes proximate to a German VP hex targeted for the active front. Prefer a hex a) adjacent to the VP hex, b) from which Soviet supply can be traced; c) closest to the VP hex.

If there are no German VP hexes targeted for the active front on the map (that is, they are all Soviet-owned), then a German VP hex targeted for no front is eligible. A VP hex targeted exclusively for the inactive front is not eligible.

If Movement Method 11 was processed earlier due to Soviet Desperation, skip it here.

#### 9.23 Restrictions on Soviet Movement

These restrictions apply **at the end of a unit’s move** by any movement method. Do not conduct a move if it would …

- a) cause a surrounded German unit to become no longer surrounded. Does not apply if the German unit is isolated or the moving unit is in a hex outside the current operational limit.
- b) cause one or more German units to become proximate to or, [GT 4+] German supply to be traceable to, an empty or garrisoned Soviet town or city hex. Does not apply if the situation exists at the start of the move.
- c) cause a map-edge VP hex to become vacant, unless Soviet supply cannot be traced to the hex.
- d) [GT 4+] cause a Soviet unit to become unable to trace supply. This includes the moving unit, if it starts the move able to trace supply. **Restriction (d) does not apply to a move ending in a German VP hex.**
- e) [GT 1-6] end with a Soviet mechanized unit in a marsh hex.

Take care in checking for situations that prevent or limit Soviet movement. For example, a Soviet move away from a road might allow German supply to be traced to a distant Soviet town/city, violating restriction (b).

Some moves may be limited but not prohibited by these restrictions. Thus, if the preferred destination of a given movement method violates a restriction while a less preferred destination of that method does not, then implement the less preferred option.

<!-- p21 -->

#### 9.24 Movement Method Tiebreakers

If more than one destination hex meets the requirements and preferences of a given movement method, prefer a) closest to the unit’s Objective marker if in play; b) an empty hex; c) the hex furthest in the compass direction indicated on the objective marker if in play; d) in or closest to a hex in Soviet Support; e) the highest numbered hex.

#### 9.25 Tactical Preferences When Moving Adjacent to German Units

These preferences:

- apply to **all** moves in which a Soviet unit would end its move in a hex adjacent to a German unit;
- apply to movement methods that calls for a Soviet unit starting adjacent to a German unit to not move;
- take priority over preferences in a given movement method;
- apply to Soviet units moving via the Reinforce Battle combat tactic during a Soviet attack.

When ending a move adjacent to a German unit prefer: a) a hex within the current Soviet operational limit; b) a hex that would cause the German unit to become surrounded; c) a hex in Soviet support; d) a hex not adjacent to a Soviet unit; e) an empty or garrisoned hex; f) a hex not occupied by an active unit.

This means that if a move by a given movement method would end in a hex adjacent to a German unit, then apply the tactical adjustments of 9.25, even if those adjustments result in the move shifting to an end hex not conforming to the tiebreakers, preferences or requirements of the movement method. Make sure however, that the unit’s move conforms to the rules for movement and the restrictions of 9.23.

- **Example 1:** A Soviet unit moving via Movement Method 10 (follow movement arrows) happens to end its move in a hex adjacent to a German unit. Tactical preference (b) calls for the unit to end its move in a hex that causes the German unit to become surrounded if possible. The Soviet unit is able to conduct its move along a route that would reach such a hex, so the unit moves to that hex instead, even though the move does not follow movement arrows.
- **Example 2:** Several hexes qualify as the endpoint of a move by a given movement method. Applying the 9.24 tiebreakers happens to result in placement of the unit in a hex adjacent to a German unit. This causes the adjacency preferences of 9.25 to come into effect, possibly resulting in movement of the unit to a different hex adjacent to that German unit even if that hex is not among those indicated by the tiebreaker or the movement method.
- **Example 3:** A Soviet unit moving via 9.21 Movement Method 7 starts its move already adjacent to a German unit in a logistics hex, so it is instructed to not move at all. However, you still check to see if the preferences of 9.25 instruct you to move the unit to a more preferred hex adjacent to that German unit.

**Blocked Dniepr River hexside exception:** A unit is not considered adjacent to an enemy unit if they occupy adjacent hexes separated by a **blocked** Dniepr River hexeside.

#### 9.26 Movement Methods For Units With Army Objectives

▼Check active units with an Army Objective marker (40th and 1G Armies, see 9.13) one at a time in **descending** numerical order. Each unit moves according to the following methods instead of the methods in 9.21, but are still subject to the conditions of 9.23, 9.24 and 9.25.

1. **TAKE VP HEX** – Identical to 9.21, Method 1, including urban infiltration..
2. **ADJACENT TO GERMAN UNIT** – Identical to 9.21, Method 8.
3. **CLOSER TO GERMAN UNIT & ARMY OBJECTIVE** – Locate the German unit in or closest to the active Army objective marker hex. Among German units closest to the objective, prefer the unit in a) the hex closest to the moving unit; b) the highest numbered hex. Move as close as possible to that German unit, entering a hex adjacent to that unit if able. If starting adjacent to the German unit that is in or closest to the objective hex, the unit does not move at all in this activation (except as directed by 9.25).
4. **CLOSER TO FRONT OBJECTIVE** – Move as close as possible to the active Front objective marker’s hex, entering the hex if able. Among hexes closest to front objective, prefer closer to the unit’s army objective.

#### 9.27 Movement Methods For Unsupplied Units

▲Check active out-of-supply or isolated Soviet units one at a time in ascending order after checking all other active units. All such units move within the limitations of their supply state (13.2).

- An OOS or isolated unit that is able to trace supply follows the movement methods of 9.21 or 9.22 and the restrictions of 9.23.
- An OOS or isolated unit that is unable to trace supply moves to a hex in Soviet supply. Prefer a) a hex in Soviet support; b) the closest hex. If not possible, move to a hex not adjacent to any German unit, preferring a hex as close as possible to a hex in Soviet supply.
- If surrounded, or if isolated and adjacent to a German unit, the unit does not move.

### 9.3 Soviet Activation Terminology

**Active Front** The Soviet front to which the currently activated formation belongs.

**Active unit** A Soviet unit in the activated formation, on the map or in the Reserve Units box. This includes units activated because they are stacked with units of a formation activated by a Front or STAVKA card.

**Adjacent** A hex is adjacent to every hex with which it shares a hexside. A unit is adjacent to another unit if they occupy adjacent hexes. **Exception:** A unit is not considered adjacent to another unit if they occupy hexes separated by a **blocked** Dniepr River hexside.

**Cause Surround** A Soviet unit is said to be causing surround if its presence in a hex results in Soviet units or their ZOCs in all hexes adjacent to a given German-occupied hex. In other words, if the removal of the Soviet unit from its hex would cause a currently surrounded German unit to become unsurrounded, then that Soviet unit is causing surround.

**Closer and Closest** Distance measured by counting hexes, not movement points, regardless of terrain and enemy units; except that the distance cannot be traced across a **blocked** Dniepr River hexside.

**Empty** A hex is considered empty if there are no units and no garrison in the hex.

**Front Target** Most VP and village hexes are marked as a target for the Voronezh or Southwest front. Some hexes are targets for both fronts while others are targets for neither front. Soviet units tend to move to hexes targeted for their front and avoid hexes targeted for the other front.

**German VP Hex** A hex with a VP value that is currently owned by the German side, even if not occupied by a German unit.

<!-- p22 -->

**Large Attack** a Soviet attack in which at least seven combat chits are drawn. A German attack in which at least six combat chits are drawn.

**Nearly Surrounded** A Soviet unit is considered nearly surrounded if a potential move by **one** undispersed German unit would cause that Soviet unit to become surrounded. Does not apply if the Soviet unit is in a friendly map edge hex

**Occupied** A hex is considered occupied if a unit of either side is in the hex. Soviet garrisons do not occupy hexes.

**Overwhelming Attack** Applies to a Soviet attack if:

- The attack has odds of **8:1 or greater**; or
- The attack is a **large attack** and has odds of **6:1 or greater**; or
- All defending units are **unsupplied** or **dispersed** and the attack has odds of **5:1 or greater**; or
- All defending units are **isolated** and not in a VP hex.

**Proximate** A unit is proximate to a target hex or unit if it has sufficient Movement Points to reach the target in one move.

- **Proximate to a hex:** A unit is proximate to an empty or friendly-occupied hex if it has sufficient Movement Points to move to and enter the hex.
- **Proximate to an enemy unit:** A unit is proximate to an enemy unit if it is adjacent to the enemy unit or has sufficient Movement Points to move to and enter a hex adjacent to the enemy unit.
- **Proximate to garrisoned hex:** A German unit is proximate to a hex containing a Soviet garrison marker if it is adjacent to the garrison or has sufficient movement points to enter a hex adjacent to the garrison.

Movement restrictions are taken into account when determining proximity. These include terrain, enemy units and ZOCs, supply state and stacking limits. German units trace proximity using regular movement, not strategic movement. A German unit can’t trace proximity through a garrisoned hex or through a hex adjacent to a garrisoned hex, unless the German unit is adjacent to the garrisoned hex.

**Reserve Supply** Soviet reserve supply (13.3) is traced like regular supply with the added restriction that it can’t be traced through a hex in a German zone of control, even if occupied by a Soviet unit.

**Soviet VP Hex** A hex with a VP value that is currently owned by the Soviet side, even if not occupied by a Soviet unit.

**Spearhead Unit** From Game-Turns 1 through 5, certain units in Soviet 3rd **Tank Army (3T)** and **Mobile Group Popov** are spearhead units as long as their Front Objective marker is in play, affecting their movement methods (9.21).

**Surround** A unit is surrounded when every hex adjacent to its hex is occupied by an enemy unit or in an enemy ZOC, regardless of the presence of friendly units.

**Unoccupied** A hex that is empty or has a garrison marker in it is considered unoccupied.

**Urban Infiltration** Special move in Movement Method 1 allowing a Soviet unit that starts its move adjacent to an empty German town or city hex to enter that hex regardless of German ZOCs.

**Weak Attack** Applies to a German attack with a maximum combat chit draw of one or two chits.

> **[Exemple p22]**
>
> Example of Cause Surround:
>
> Example of Nearly Surrounded:
>
> German unit 01 is surrounded: All adjacent hexes are occupied by Soviet units or their Zones of Control. However only Soviet unit 06 is CAUSING surround.The other three Soviet units are not individually causing surround. If any one were removed, the German unit would still be surrounded. A unit causes surround only if its removal alone would break surround. Note that unit 06 could move one hex to Lozovaya and still be causing surround.
>
> Soviet unit 07 is nearly surrounded: If German unit 05 moves into 1814, all hexes adjacent to Soviet unit 07 will be occupied by German units or their zones of control. Soviet unit 06 is also nearly surrounded: A move by German unit 01 or 07 can surround the unit. Soviet unit 08 is not nearly surrounded, because it would require moves by two German units to surround it.

<!-- p23 -->

### 9.4 Soviet Attack Checks

During step 3 of a Soviet activation, active supplied non-dispersed Soviet units participate in attack checks against adjacent German-occupied hexes. If a check against a given German-occupied hex is successful, the Soviet units participating in the check immediately attack those German units. A Soviet unit can participate in multiple attack checks, until a check succeeds, but can attack only once in a given activation.

ATTACK CHECK SEQUENCE: ▲Check each active unit adjacent to a German-occupied hex (the target) if that hex has not already been the target of an attack check this activation. Check active units one at a time in **ascending** numerical order, to determine if that Soviet unit will attack the target hex. The active unit being checked is referred to as the **lead unit**. An active unit **can’t** be the lead unit if it:

- already attacked in this activation, or
- is dispersed, out of supply or isolated.

Furthermore, if the target is supplied, the active unit can’t be a lead unit if it:

- has just one step, or
- is in a VP hex occupied by less than three steps;

To conduct an attack check with a given lead unit, add the combat strength of the lead unit to the strengths of the following additional Soviet units:

- all other active units that have not yet attacked this activation and are adjacent to the target hex, including units with just one step. Exclude dispersed, out of supply and isolated units.
- all active Soviet **reserve** units that could legally be placed in hexes adjacent to the target hex, per the placement requirements of 12.2. ▲If there are more reserve units than could be placed, include reserve units in ascending numerical order. Do not actually place any reserve units at this time.
- If the auxiliary card shows the Assault Coordination combat tactic, include all non-active Soviet units adjacent to the target and capable of attack.

Once the group of units eligible for a potential attack has been identified, calculate the situational strength ratio using all those Soviet units. **Exception:** if all defending units of the attack are isolated, immediately conduct the attack.

SITUATIONAL STRENGTH RATIO: To conduct an attack check, calculate the **situational strength** ratio of the opposing units by comparing the total Soviet strength to the strength of all German units in the target hex, taking into account strength adjustments for rivers and marsh terrain called for by the terrain effects chart. Then, add to or subtract from the defending units’ total strength for any of the following defender situations:

| Defender situation | Mod |
|---|---|
| In Improved Position | +1 |
| Defender adjacent to one or more supplied German units | +1 |
| All attackers across Donets or Dniepr River hexsides | +1 |
| [GT 5+] All attackers and defenders outside Soviet support | +1 |
| All German units dispersed | -1 |
| All German units Out of Supply | -2 |

Minimum situational strength is 1.

CONDUCT ATTACK CHECK: Once the situational strength ratio is calculated, use it to determine if the attack occurs, but not to resolve the combat.

- If equal to or greater than 3:1, or if all defending units are isolated (regardless of ratio) conduct the attack.
- If less than 1:1, do not conduct the attack.

If the ratio is at least 1:1 and less than 3:1, calculate the **Tactical Value** of the Soviet Attack by totaling the following factors:

- + **the Command Value** of the activating command card;
- **+2** if the situational strength ratio is > 2:1;
- **+1** [GT 1,2] if the Soviet Artillery Barrage Bonus applies;
- **+1** if the attack is supported (all attacks on Game-turns 1-4 are supported);
- **+1** if only Soviet units have armor in the combat;
- **+1** if any **attacking** units are surrounded;
- **+1** if flanking will apply, or if the defender will be surrounded and unable to trace supply, once all attacking units are in place;
- **+1** if the target hex has a VP value of 2 or more **OR** [GT 7+] **+VP value of the target hex** if the Soviets have **< 20 VP**;
- **+1** if the attack is in Soviet support and all combat tactics on the auxiliary card apply to the attack;
- **+1** if less than four cards are in the Soviet draw pile.

> **[Exemple p23]**
>
> Examples of Proximity to ...
>
> **An unoccupied hex** – Lozovaya (1910). Unit A is proximate to Lozavaya because it can move to and enter the hex in a single move. Unit B is not proximate to Lozovaya even though adjacent; enemy ZOCs and a garrison prevent the unit from being able to enter the hex. Units C and D are not proximate; they can move adjacent to but can’t enter the hex.
>
> **A friendly occupied hex** (Unit B in 2010): Units C and D are proximate to unit B; they can move to and enter the hex. Unit A is not proximate to unit B; it can’t enter the hex in a single move.
>
> **An enemy unit** (Soviet unit in 1911): Unit B is adjacent to and thus proximate to the Soviet unit. Units A, C and D are all proximate to the Soviet unit since they can move to and enter a hex adjacent to the enemy unit.
>
> **A garrisoned hex.** All four German units are proximate to the garrison in 2109 since they can all move to a hex adjacent to the garrison. All German units except unit A are proximate to the garrison in 1912. Unit A does not have sufficient movement points to enter a hex adjacent to the garrison.

<!-- p24 -->

If the tactical value **equals or exceeds seven**, the attack proceeds. If less than seven, the attack is not conducted.

CONDUCT VALID ATTACK: When an attack check results in a valid attack, immediately conduct the attack in accordance with the procedures in 12.0.

CONTINUE ATTACK CHECK SEQUENCE: ▲After completing the attack or if the lead unit failed its attack check, conduct a check with the next active Soviet unit in **ascending** numerical order to see if it is eligible to attack an adjacent enemy-occupied hex. Continue checking active units in sequence, and conduct the attack if allowed, until all active Soviet units have participated in an attack or you have conducted an attack check against every German-occupied hex to which an active Soviet unit is adjacent.

#### 9.41 Multiple Attack Units

If a Soviet lead unit is adjacent to more than one German-occupied hex, separately determine all the potential participating units against each potential target and calculate situational strength ratios for this lead unit against each target. Then conduct one attack check for this lead unit, only against the target with the highest rounded ratio. If ratios are tied, prefer a) VP hex, b) westernmost hex, c) highest hex number.

#### 9.42 One Attack Check per German Unit

A given German unit or stack may be the target of only one attack check in a given Soviet activation. Thus, if an attack check against a German-occupied hex fails, that hex is not eligible to be checked again during the current activation.

#### 9.43 One Combat per Unit

A Soviet unit may participate in only one attack in a given activation – once a unit participates in an attack, don’t include it in other attack checks this activation. An attack check that results in no attack does not count as an attack; a unit in a failed check is eligible to be included in a check for an attack against a different German-occupied hex to which it is adjacent in the same activation.

> **[Exemple p24]**
>
> Soviet attack checks (9.4):
>
> Mobile Group Popov is activated by a card with a Command Value of 3 on Game-turn 5. The Far Soviet Support line (1514 to 2013) is in effect . The active units have moved; it is now time to conduct attack checks with active units adjacent to German units, in ascending order by Soviet unit selectors. All Soviet units shown will participate except for active unit 17 because it is not adjacent to a German unit and unit 106.6 because it is not active.
>
> Soviet unit 02 is adjacent to German units in two hexes, so you select one of those German units as the attack check target based on most favorable situational strength ratio.
>
> - Against the German armor unit the situational strength ratio is 6:4, simplified to 1.5:1 (Soviet strength is 6; German printed strength is 2 plus 1 because the attack would be outside Soviet support plus 1 because the German unit is adjacent to a supplied German unit).
> - Against the German infantry unit the situation strength ratio is 12:4 simplified to 3:1. (The combined strength of all active Soviet units adjacent to the target is 12; German printed strength is 3 plus 1 for being adjacent to a supplied German unit). Note that the attack would be in Soviet support because at least one of the attacking units is in a hex in Soviet support.
>
> The situational strength ratio against the infantry unit is more favorable so the attack check is made against that target. With a ratio of 3:1 the check automatically succeeds and the attack is immediately conducted by units 02, 08 and 21.
>
> Soviet unit 06 is checked next. Against the German unit in Lozovaya the situational strength ratio is 8:3 reduced to 2:1 (The strength of the two active units adjacent to the target is 8. German printed strength is 3 and no situational modifiers apply.). The ratio falls between 1:1 and 3:1 so you calculate the potential attack’s tactical value, which totals to 9. (Command value of 3, plus 2 because the situational ratio is 2:1, plus 1 because the attack is in Soviet support, plus 1 because only the Soviets possess armor, plus 1 because an attacking unit is surrounded, plus 1 because the defending unit is surrounded.) The tactical value equals or exceeds 7 so you immediately conduct the attack with units 06 and 07.
>
> Last you check Soviet unit 14, the only active unit yet to be in an attack check or attack. Against the German unit 04 the situational strength ratio is 3:5 which is less than 1:1 (Soviet strength is 3; German strength is 5 and no situational modifiers apply.) Since the ratio is less than 1:1 the attack check fails. Unit 14 does not attack.

<!-- p25 -->

### 9.5 Placing Active Soviet Reserve Units

When a Soviet army is activated by any Soviet card, all units of that army in the reserve box become active reserves, eligible for placement on the map in two ways:

- During step 3 of the Soviet activation sequence, active reserve units may be placed on the map to participate in Soviet attacks per the procedure in 12.2.
- [GT 4+] Beginning on Game-Turn 4, during step 4 of the Soviet activation sequence, all active units in the reserve box are placed in VP hexes and village hexes on the map, often replacing garrison markers.

PLACING RESERVES: In Soviet activation step 4, place all active units in the reserve box on the map one at a time in ▼descending numerical order. A hex is eligible for reserve placement if **all** the following are true:

- The hex has a village or Soviet town/city **targeted by the active front** (German town/cities are not eligible);
- The hex is empty or contains only a garrison.
- Soviet reserve supply can be traced to the hex.
- The hex is not adjacent to a Soviet unit, unless the hex is a VP hex.
- If in a village hex, a reserve unit placed there would not be nearly surrounded.
- The hex is not beyond the current operational limit.

Among eligible hexes prefer a) a hex to which German supply can be traced or to which a German unit is proximate; b) a garrisoned hex; c) a hex adjacent to a German unit; d) a hex in Soviet support; e) a city hex; f) a VP hex; g) closest to a supplied unit in the active army not placed as a reserve in the current activation; h) closest to a supplied unit in the active front.

Upon placing a reserve unit in a Garrisoned hex, remove the Garrison marker.

### 9.6 Removing Soviet Units to Reserve [GT 2+]

Starting on Game-turn 2, during step 5 of a Soviet activation, check to see if any active units are removed from the map and placed in the Soviet Reserve Units box. ▼Check active units one at a time in descending numerical order. If a unit is eligible for removal, remove it from the map and place it in the Soviet Reserve Units box. It may re-enter as a reserve in a subsequent activation.

First check that the unit meets all these eligibility pre-requisites for removal:

- The unit did not move or attack this activation;
- The unit is adjacent to a German unit;
- Supply can be traced from the unit’s hex. Reserve supply is not required, and supply state and dispersal have no effect.
- The unit was not placed on the map from the Reserve Units box this activation.
- Removal of the unit would not cause another Soviet unit to become nearly surrounded or unable to trace supply.
- If in a hex in the operational limit, removal of the unit would not cause a surrounded German unit to become unsurrounded.
- The unit is not in Kharkov.

Then, if the unit meets all pre-requisites for removal and is in any of the following four situations, remove the unit:

- In or adjacent to a village hex targeted exclusively for the non-active front;
- In a VP hex, and stacked with at least two other steps;
- In a non-VP hex within the operational limit, and stacked with another unit or adjacent to at least two Soviet-occupied hexes;
- In a non-VP hex outside the operational limit, and stacked with another unit or adjacent to at least one Soviet-occupied hex.

A unit not in one of these four situations is not removed.

### 9.7 Placing an IP on a Soviet Unit [GT 4+]

Starting on Game-Turn 4, in Step 6 of a Soviet activation, place an IP marker in one hex (only) in Soviet support containing at least one active Soviet unit that did not move or attack and was not placed as a reserve in the current activation. Do not place an IP marker in a hex with a town or city, or that already has an IP marker, or if all units in the hex are dispersed, out of supply, or isolated. Among qualifying hexes prefer a hex a) adjacent to a hex occupied by a supplied German unit, b) to which a supplied German unit is proximate, c) with the least Soviet strength; d) lowest hex number.

> **[Exemple p25]**
>
> Removing Soviet units to reserve box (9.6):
>
> It is Game Turn 8 and the Soviets have fewer than 19 VPs; the near Operational Limit (shown in this diagram) is in effect. Mobile Group Popov was activated this impulse but the following units did not move or attack: 14, 06, 21 and 07.
>
> Unit removal to the reserve box is checked in DESCENDING order. The highest-numbered unit that did not move or attack is unit 21 in hex 1712. All of the removal criteria in 9.6 must apply for the unit to be removed. This unit is adjacent to your unit in 1812; it did not move or attack; it is a non-VP hex within the operational limit; it is adjacent to two other Soviet-occupied hexes, 1612 and 1811. Therefore 21 is removed to the reserves. Hex 1712 is now empty.
>
> Next is unit 14, the 3rd Corps of MGP. It meets all the criteria of the previous unit except, it is not adjacent to two Soviet-occupied hexes. However, it is stacked with another unit, A/4G, unit 06. Therefore 3.**Popov** goes to the reserve box.
>
> Next is 07. This unit is not removed to the reserve box, because 1712 is now empty; the unit is no longer adjacent to 2 Soviet-occupied hexes.
>
> Similarly, the last non-moving, non-attacking unit is 06, which is not removed because it is no longer stacked with another unit.

<!-- p26 -->

### 9.8 Soviet Operational Limit

Design note: The Soviet operational limit guides Soviet response in the late game, to protect objectives achieved (the far limit) or to fall back under German counter thrusts (the near limit), while also allowing Soviet counterattack when the situation gets desperate.

WHEN UNITS BECOME SUBJECT: At the start of the game, no Soviet units are subject to the operational limit. Later in the game, when a Soviet front’s objective marker is removed from the map (per 9.12), all units of that front immediately become subject to the Soviet Operational Limit currently in use. As long as a Front objective marker is on the map, the units of that front are not subject to the operational limit, regardless of Soviet VP level.

One of three Soviet operational limits is in use at a time and can change at any moment after Game-Turn 5, depending on Soviet Victory Points:

- [GT 1-5] The entire map is within the Soviet Operational Limit on Game-Turns 1-5.
- [GT 6+] The **Far** Operational Limit Line is in use when the Soviets have **21 or more** VPs.
- [GT 6+] The **Near** Operational Limit Line is in use when the Soviets have **20 or fewer** VPs.

The operational limit in use can change in the middle of an activation which the VPs change between 20 and 21.

EFFECT OF THE OPERATIONAL LIMIT: When the far or near Soviet Operational Limit line is in use, actions by Soviet units subject to the limit (that is Soviet units in a Front without an objective marker) are affected in hexes beyond (to the west/south of) the line, as specified in certain movement methods and placement procedures. The operational limit has no effect on supply and Soviet support.

## 10. MOVEMENT

Active undispersed Soviet and German units move during their respective impulses.

- During a German Impulse, when you play a command card to activate German units, you may move all, some or none of those units.
- During a Soviet Impulse, when Soviet units are activated, those units move in Activation Step 2 as directed by the Soviet movement methods (9.2) and these movement rules.

Each unit is moved individually through one or more contiguous hexes, up to the limit of the unit’s movement allowance. For each hex entered, the unit pays Movement Points. The Movement Point (MP) cost to enter a hex varies with the type of unit moving (infantry or mechanized), the terrain in the hex being entered, and the presence of a river along the intervening hexside, as specified on the TERRAIN EFFECTS CHART.

BASIC RESTRICTIONS: A unit may not exceed its movement allowance when moving (however, see 10.6 for German Strategic Movement). A unit with insufficient Movement Points to enter a hex may not do so. **Exception:** A unit may always move at least one hex, as long as the move is otherwise allowed.

The movement of one unit must be completed before the next is begun. Any Movement Points left unused by a unit are lost; they are not saved for a future activation or impulse. Movement Points can’t be transferred between units.

### 10.1 Effects of Other Units on Movement

ZONE OF CONTROL (ZOC) EFFECTS: The movement of units is affected by enemy units and their zones of control (11.0). A unit must pay one Movement Point to leave an enemy-controlled hex, in addition to the cost of the terrain in the hex being entered. A unit can’t move from one enemy-controlled hex directly into an adjacent enemy-controlled hex (**Exceptions**: Soviet urban infiltration 9.21 and German map-edge movement 10.7). There is no additional cost to enter an enemy-controlled hex, but a unit must stop upon doing so.

HEX ENTRY RESTRICTIONS: A unit can’t enter an enemy-occupied hex. A unit may move or advance into an enemy-owned town or city hex, but must stop upon doing so. Friendly units, towns and cities have no effect on the movement of other friendly units.

A German unit must stop moving upon entering a hex adjacent to a garrisoned hex (15.22). German units can’t enter a garrisoned hex (**Exception**: German retreat 12.71). If a German unit starts its move adjacent to a garrisoned hex, remove the Garrison marker from the hex (15.3).

> **[Exemple p26]**
>
> ZOC Effects on Movement (10.1):
>
> Unit A, adjacent to an enemy, shows movement options and prohibitions. Note that moving out of an enemy ZOC costs +1 MP in addition to the cost of terrain for the hex to be entered.

> **[Exemple p27]**
>
> Examples of Movement (10.2-10.3):
>
> A. The armored unit moves 6 hexes expending 6 MPs by using the road at a cost of 1MP per hex entered, regardless of other terrain.
>
> B. The armored unit moves four hexes expending 6 MPs; crossing the Donets adds +2. Alternatively, it could have moved south of the Donets by first crossing the bridge at Izyum and the stream (+1)
>
> C. The infantry unit pays 1MP per hex, except 2MPs for Woods and Marsh, and +1 for crossing the Donets.

> **[Exemple p28]**
>
> Illustration of German Strategic Movement (10.6):
>
> A. Your infantry unit in 1919 has a strategic movement allowance of 6 MPs (4 MP base plus the infantry strategic bonus of 2 MP). It can move to hexes like 1913 and 2013. It cannot move to 1714 and 1813 because strategic movement cannot move adjacent to an enemy unit (the Soviet unit in 1713).
>
> B. Your armor unit 73.19P.III does not gain extra MPs like infantry. Its strategic movement bonus is to pay only 1/2 MP for movement along roads.
>
> It expends all 6 MPs to reach its destination.
>
> C. Your armor unit also has a strategic movement bonus of 1/2 MP road movement. It expends 5 of its 6 MPs to reach hex 1617. It has 1 MP remaining, enough for 2 hexes on the road. It can proceed to hex 1616 but cannot enter Krasnograd, because strategic movement is not allowed into enemy VP hexes.

<!-- p29 -->

### 10.2 Moving on Roads

A unit entering a hex through a connecting road hexside (including a bridge) pays just one Movement Point to enter the hex, regardless of the terrain in the hex. German mechanized units conducting strategic movement pay ½ movement point to enter a hex through a road hexside.

### 10.3 Crossing River Hexsides

#### 10.31 Unbridged River Hexsides

Units moving across an unbridged river must spend movement points to cross the hexside in addition to the cost to enter the hex, as noted on the Terrain Effects. The hexside costs vary depending on the type of unit (mechanized or non-mechanized) and the type of river (minor river, Donets River or Dniepr River), and are higher if the ground condition is light mud (18.34).

A unit must spend its entire movement allowance to cross an unbridged Dniepr River hexside. That is, the unit must start its move in a hex bordering the river hexside to be crossed and end its move upon entering the adjacent hex across the river hexside.

A **blocked** Dniepr River hexside can’t be crossed at all.

#### 10.32 Bridged River Hexsides

A river hexside crossed by a road is considered bridged. A unit crossing a river hexside via a road disregards movement penalties for the river.

### 10.4 Stacking Units

More than one friendly unit may occupy a hex; this is called stacking. The maximum number of units that may stack in a hex is **three units or six steps**.

**Example:** If two 3-step units occupy a hex, a third unit could not stack with them. If three one-step units occupy a hex, no more units can stack with them.

Stacking limits must be observed at all times, except during the movement portion of an activation and during retreat or advance after combat. That is, units may move through other units in violation of stacking limits but when all movement in an activation is complete, or when all retreats and advances in a given combat are complete, stacking limits are enforced.

A Soviet unit may end its move in an over-stacked situation as long as it is obvious that other active units in the hex (which have not yet moved) will be leaving the hex when they move, thus correcting the over-stack by the time the movement step of the activation is complete.

If German units are found to be in violation of stacking limits after completing movement, retreat or advance, you must remove steps or eliminate units to meet the limits.

### 10.5 German Movement Supply Trace Limits

A German unit can’t **end** its movement or advance after combat in a hex from which it can’t trace supply. **Exception:** a German unit that starts its move or advance in a hex from which it can’t trace supply and is unable to move or advance to a hex from which it can trace supply, is not bound by this restriction.

This limit applies only during German activations, not when checking German proximity at other times.

### 10.6 [GT 2+] German Strategic Movement Bonus

Starting on Game-turn 2, an active German unit in supply may move with the strategic movement bonus, within the following restrictions:

- The unit can’t start its move adjacent to an enemy unit or garrison;
- The unit can’t move adjacent to an enemy unit or garrison during the activation;
- The unit can’t enter a Soviet-owned town or city during the activation.
- Strategic Movement is not allowed in light mud ground conditions (18.34).

Strategic Movement Bonuses:

- Armor and mechanized infantry: Movement cost to enter a road hex through a connected road hexside is ½ movement point. When entering a hex not connected by road, normal movement costs apply.
- Infantry: Movement Allowance is **increased by two** (to six).

### 10.7 German Map Edge Movement

A German unit starting its move in a German map-edge hex can move one hex to an adjacent German map-edge hex regardless of enemy zones of control. If the hex entered is in an enemy ZOC, the unit’s move ends in that hex.

## 11. ZONES OF CONTROL (ZOC)

Every non-isolated unit exerts control into the six adjacent hexes. Control inhibits enemy movement, retreat, advance and the tracing of enemy supply. Isolated units do not exert control. Zones of control extend across hexsides and into hexes of all terrain types, including across **blocked** Dniepr River hexsides.

### 11.1 Effects of Control

- A unit must stop movement upon entering an enemy-controlled hex and cannot move further that activation.
- A unit that starts its move in an enemy-controlled hex must pay an additional Movement Point to exit the hex, and can’t move directly into an adjacent enemy-controlled hex (**Exceptions:** German map-edge movement 10.7, and Soviet urban infiltration 9.21). The presence of other friendly units in the hex does not negate this effect.
- Supply for both sides may be traced from but not through an enemy-controlled hex. The presence of a friendly unit in a hex negates enemy control for the purposes of tracing supply through the hex. Soviet reserve supply (13.3) can’t be traced through an enemy controlled hex, even if occupied by a friendly unit.
- A unit may retreat into an enemy-controlled hex, within the retreat priorities of 12.7. If the hex is occupied by a friendly supplied undispersed unit there is no penalty. If the hex is unoccupied, or occupied only by a friendly unsupplied or dispersed unit, the retreating unit or stack must lose a step.
- A unit may ignore enemy zones of control when advancing one hex. If advancing a second hex, the unit can’t advance from one enemy-controlled hex to an adjacent enemy-controlled hex. **Exception:** A unit advancing two hexes along the path of retreat of a unit that retreated two hexes may ignore enemy ZOCs.
- A hex may be mutually controlled by opposing units. There is no additional effect when more than one unit exerts control into a hex.

> **[Exemple p29]**
>
> German map-edge movement (10.7):
>
> Units normally can’t move from a hex in an enemy ZOC directly to another hex in an enemy ZOC. However, a German unit starting its move in a German map edge hex in an enemy ZOC may move one hex to an adjacent German map edge hex in an enemy ZOC. The unit’s move ends upon doing so.

<!-- p30 -->

## 12. COMBAT

Combat occurs during the Soviet Impulse, when Soviet units attack your units; and during the German impulse, when your units attack Soviet units.

**SOVIET COMBAT SEQUENCE**

Active Soviet units attack German units, as a result of a successful Soviet attack check (9.4). Soviet combats are resolved one at a time. The Soviets are the **attacker** and you are the **defender**. Once you have determined that a specific German-occupied hex is the target of a valid Soviet attack, resolve the combat in the following sequence:

1. **Add Active Soviet Reserve Units.** Skip if the attack is overwhelming (12.38). If there are active units in the Soviet reserve units box, add those units to the combat by placing them in valid hexes adjacent to the target hex (12.2).
2. **Draw Card and Apply Combat Tactics.** Skip if the attack is overwhelming or not in Soviet support. Draw one Soviet card and apply the card’s combat tactic to the combat (12.3). Then, if there is a card in the Soviet auxiliary card box and all its listed combat tactics differ from any already applied combat tactics AND benefit the attack, apply those combat tactics.
3. **Play German Combat Tactic Cards.** You may play one or more cards as combat tactics against the attack. If you play the Reinforce Battle combat tactic you may move an eligible German unit/stack into the defending units’ hex.
4. **Draw Combat Chits.** Draw Combat Chits from the combat chit cup equal to the maximum number of chit draws allowed to the Soviet Attackers (12.4). As each chit is drawn, check to see if the situation on either side of the chit applies to the combat. If so, the chit is retained for step 5. If not, the chit is set aside (but still counts as a chit draw).
5. **Calculate Hits.** After drawing all chits, add up the number of defender hits and attacker hits listed on the retained combat chits to arrive at hit totals incurred by the defender and the attacker.
6. **Apply Hits to Your Defending Units.** Apply hits by removing one step per hit or retreating all units one hex per hit. If the defending units occupy an improved position, remove the IP marker to satisfy the first hit. Up to two defender hits may be satisfied by retreat; all other hits must be satisfied by step loss.
7. **Apply Hits to Attacking Soviet Units.** Apply the first attacker hit as a step loss. Apply additional hits by dispersing all attacking units or applying additional step losses, per 12.54. The total number of Soviet attacker hits may be reduced if the defending units are completely eliminated (12.55).
8. **Advance after Combat.** If the defending units retreated and the attacking units are not dispersed, conduct advance checks for Soviet attacking units to see if any advance after combat (12.83). If the defending units retreated two hexes or were completely eliminated, attacking mechanized units may advance two hexes.
9. **Clean up.** Discard any cards drawn as combat tactics and discard the auxiliary card if its combat tactics were applied. (**Exception:** if a Soviet card applied as a combat tactic states that it is to be returned to the deck, do so and shuffle the deck). Set all drawn combat chits aside.

**GERMAN COMBAT SEQUENCE**

After you have completed moving your active units in an activation, you may have any of your active units attack adjacent enemy units. Declare and resolve combats one at a time, in any order you choose. You are the **attacker** and the Soviets are the **defender**. Each combat is against all the enemy units in one hex and is resolved in the following sequence:

1. **Declare Target and Attacking Units.** Choose an enemy-occupied hex adjacent to at least one active unit as the target of the attack, and choose one or more of your active units adjacent to the target hex to participate in the attack.
2. **Play Combat Tactics Cards.** You may play one or more cards as combat tactics if beneficial to the attack. If the combat tactic allows additional units to join the attack, select and move those units
3. **Draw One Soviet Card.** Skip if your attack is weak (12.39) or if all defending units are unsupplied, dispersed or not in Soviet support. Draw one Soviet card and apply the card’s combat tactic.
4. **Draw Combat Chits.** Draw combat chits up to a maximum equal to the number of your attacking units. Other factors may modify the maximum number of chit draws allowed (12.4). 
    1. **Required Draw.** First, draw a number of chits equal to the number of steps in the defending units. You may then stop, or draw additional chits.
    2. **Declared Draw.** If you continue, declare a number of additional chit draws up to the allowed maximum, less the already drawn required chits. Then draw your declared number of additional chits.

    **Examination:** As you draw each chit check to see if the situation on either side of the chit applies to the combat. If so, retain the chit for step 5. If not, set the chit aside (but it counts as a chit draw).

5. **Calculate Hits.** Once you stop drawing chits, add up the number of defender hits and attacker hits listed on the retained combat chits to arrive at hit totals incurred by the defender and the attacker.
6. **Apply Hits to Defending Soviet Units.** Apply each hit incurred by the defending units as a step loss or retreat, in accordance with the Soviet hit application priorities (12.53). If the defending units occupy an improved position, the IP marker is removed to satisfy the first hit.
7. **Apply Hits to Your Attacking Units.** The first attacker hit must be applied as a step loss. The second and third hit may be applied by dispersing all attacking units or as step losses. All subsequent hits must be applied as step losses.
8. **Advance after Combat.** If the defending units retreated or were eliminated and the attacking units are not dispersed, you may advance your attacking units into the hex vacated by the defending units (12.8). If the defending units retreated two hexes or were completely eliminated, attacking mechanized units may advance two hexes.
9. **Clean up.** Discard any combat tactic cards played (**Exception:** if a Soviet card drawn during the combat states that it is to be returned to the deck, do so and shuffle the deck). Set aside all the drawn combat chits.
<!-- p31 -->

### 12.1 Attack Eligibility

The attacker can attack only one hex at a time in a single combat. Any number of active units in hexes adjacent to the target hex may participate in the attack. Units are not required to attack; some units in a stack may participate while others do not. Inactive units may not attack unless allowed by the Reinforce Battle or Assault Coordination combat tactic.

A unit may participate in only one attack in a given activation. A defending unit may only be attacked once in a given activation (however, see 12.74).

Units that are dispersed or isolated may not attack. Out of Supply Soviet units can’t attack. Out of Supply German units may participate in an attack in which at least one supplied unit is attacking.

### 12.2 Soviet Reserves in Soviet Attacks

Active Soviet reserve units may be placed on the map to participate in Soviet attacks, and then stay in play. ▲In step 1 of a Soviet attack, check active reserve units one at a time in **ascending** numerical order to determine if each is placed on the map to participate in the attack. Place the reserve unit if at the moment of the check the attack is **not overwhelming** (12.38) and a placement hex meets all the following requirements:

- The hex is adjacent to the hex under attack;
- Soviet reserve supply (13.3) can be traced to the hex;
- A unit in the same front other than a reserve placed in this attack is in or proximate to the hex;
- Placement of the unit in the hex would not violate stacking limits;
- The hex is within the operational limits for the active front and is not a German town/city;
- If the objective marker for the active front has been removed, the hex is in Soviet support.

Among qualifying hexes prefer: a) a hex in Soviet support if the attack is not already supported; b) a hex causing surround of the defender; c) a hex not across a Dniepr River hexside from the defender; d) a hex causing the defender to be flanked; e) an unoccupied hex; f) highest hex number.

Complete the check and placement of one reserve unit before checking the next. Continue adding active reserve units to the attack until all have been placed, or no hex qualifies for placement, or the attack becomes overwhelming.

### 12.3 Combat Tactics

PLAYING GERMAN COMBAT TACTICS: In step 3 of a Soviet attack and step 2 of a German attack, you have the opportunity to play cards from your hand as combat tactics, as long as at least one of your units involved in the combat is in supply and not dispersed.

In order to play or apply a combat tactic during a German attack, the tactic must provide a benefit other than an additional chit draw. For example, you can’t apply a second artillery tactic, you can’t apply Reinforce Battle if no units can reinforce, and you can’t apply a combat tactic beneficial only to the defense. On the other hand, a tactic that adds combat strength is considered beneficial even if it doesn’t affect the combat odds.

APPLYING SOVIET COMBAT TACTICS – SOVIET ATTACK: In step 2 of a Soviet attack, one or more combat tactics may be applied to the attack, if the attack is not overwhelming and the German defender or at least one attacking Soviet unit is in a hex in Soviet support. Soviet combat tactics are applied to a Soviet attack from four potential sources, checked in this order:
1. On Game-turns 1 and 2, the **artillery** combat tactic and an additional combat chit draw is applied to every attack against a German unit in the printed Soviet artillery barrage zone.
2. If the Soviet units were activated by the STAVKA command card, the NKVD combat tactic and an additional chit draw is applied to every attack during the activation.
3. Draw one card from the Soviet deck and apply any combat tactic(s) listed on the card. Add a combat chit draw to the attack for each tactic on the card, even if that tactic does not otherwise apply to the attack. After resolving the combat, discard the card (Exception: 12.32).
4. If there is a card in the Auxiliary card box listing combat tactics and ALL those tactics meet the requirements of 12.31, apply all those tactics to the attack and add a combat chit draw to the attack for each tactic. If any of those tactics don’t apply, none are applied.

DRAWING SOVIET COMBAT TACTICS – GERMAN ATTACK: In step 3 of a non-weak German attack (12.39) against a supplied undispersed Soviet unit in a hex in Soviet Support, draw one Soviet card and apply the combat tactics listed on the card if applicable to the Soviet defense. After resolving the combat, discard the card, even if none of its tactics were applied, unless the card text directs you to return the card to the Soviet draw pile (12.32).

> **[Exemple p31]**
>
> Examples of Attack Eligibility (12.1):
>
> A. The attacker may attack only one hex at a time.
>
> B. Units are not required to attack.
>
> C. A unit may attack while another unit stacked with it attacks a different hex or not at all.
>
> D. A unit may participate in only one attack in an activation.
>
> E. Inactive units may not attack unless allowed by a combat tactic.
>
> F. A defending unit may only be attacked once in an activation. If unit D attacks the unit in 2018, unit F may be included in that attack, but may not conduct a separate attack against 2018. Unit F may instead attack the unit in 2118. The dispersed unit stacked with unit F can’t participate.

<!-- p32 -->

COMBAT TACTIC BENEFITS: Each combat tactic provides a specific benefit described on the EVENTS & TACTICS player aid. In addition, each combat tactic applied by the attacker allows the draw of an additional combat chit (12.4). The additional chit draw is received only if the specific benefit of the combat tactic can be applied. **Exception:** A Soviet combat tactic on a card **drawn** during a Soviet attack provides an additional combat chit draw even if the tactic does not otherwise benefit the attack.

Combat tactics benefit any units of the card’s nationality, regardless of the formation listed on the card. A combat tactic in the combat tactic section of a card applies only to one attack. A combat tactic named in an activation command on the German **von Manstein** card or the Soviet **STAVKA** card applies to every attack in that activation.

#### 12.31 Soviet Auxiliary Combat Tactics

If there is a card in the Soviet Auxiliary card box during a non-overwhelming Soviet attack in Soviet support, the combat tactics listed on the card may be applied to the attack. All the listed combat tactics are awarded to the first Soviet attack of the activation to which they all apply, and the auxiliary card is then discarded (Exception: 12.32).

An auxiliary card’s combat tactics are applied to a Soviet attack only if **all** the tactics listed on the auxiliary card provide a benefit to the attacker **other than an additional chit draw**. If any of the auxiliary card’s tactics can’t be applied, then none of its tactics are applied and the card remains in the auxiliary box. The auxiliary card’s combat tactics are not applied in these situations:

- Reinforce Battle, if there are no units available to reinforce with.
- Artillery or Fixed Artillery if the attack is within the bonus artillery zone on Turn 1 or 2.
- Fixed Artillery, if beyond the fixed artillery range (FAR) specified for the game-turn.
- Battlefield Replacements never applies to a Soviet attack.
- Partisans if not attacking into a woods, town or city hex.
- NKVD if attacking when activated by the STAVKA card.
- If the combat tactic is identical to a tactic in the combat tactic card draw for this attack.
- If there is more than one tactic listed on the card and any of those tactics do not apply.

#### 12.32 Soviet Tactic Card Re-Use

The Combat Tactic description on certain Soviet cards direct you to return the card to the Soviet draw pile (and shuffle the pile) after applying the combat tactic, instead of discarding the card. The re-use direction applies if the card was drawn in an attack or defense (even if not applied), or was applied when in the auxiliary card box. **Exceptions:** The card is not returned to the draw pile if the pile has less than four cards, or if light mud is in effect; discard the card instead

#### 12.33 German Combat Tactic Wild Cards

You may play a **German Army** or **Army Group South** card as a “wild” combat tactic. You choose any combat tactic available to the Germans and declare its use in the combat (whether attacking or defending) when you play the card.

> **[Exemple p32]**
>
> Soviet Reserve Placement in Soviet Attack (12.2):
>
> During an activation of 3rd Tank Army on Game-turn 5, Soviet units 04, 05 and 15 attack the German unit in hex 1515. The attack is in Soviet support, within the operational limit and is not overwhelming (12.38) so in Step 1 of the attack sequence you check for the addition of active reserves to the attack. Three active reserve units of 3rd Tank Army are available in the Soviet reserve box. The reserve unit of 40th Army is not available because it is not in the active formation.
>
> The reserve units are checked one at a time in ascending selector order, beginning with unit 02. This unit can be added if there is a hex adjacent to the defender’s hex from which Soviet reserve supply can be traced and to which a unit in the active front is proximate. Four of the six hexes adjacent to the defender’s hex qualify. Hex 1615 does not qualify because it is a German town. Hex 1516 does not qualify because no unit in the active front is proximate to the hex (note that the Popov unit is proximate to 1516 but is not in the active front).
>
> Application of placement preferences (d) (flanking) and then preference (f) (highest hex number) results in placement of reserve unit 02 in 1614.
>
> Next, reserve unit 09 is checked for placement. Applying preference (b) (hex causing surround), you place the unit in 1415.
>
> After the placement of two reserve units, the attack’s combat ratio will be 7:1 (22:3) and seven combat chits will be drawn. This makes the combat an overwhelming attack, and no longer eligible for reserve unit placement. The third reserve unit is not placed.

<!-- p33 -->

#### 12.34 German Von Manstein Activation Bonuses

All attacks conducted by German units activated by the Von Manstein card benefit from one “wild” combat tactic. Every attack receives the tactic, and you may assign each a different combat tactic. This is in addition to any combat tactic cards you choose to play in support of a specific attack.

#### 12.35 Soviet STAVKA Activation Combat Bonuses

All attacks conducted by Soviet units activated by the STAVKA card benefit from the NKVD combat tactic. Every attack receives the NKVD combat tactic and a combat chit draw. This is in addition to any combat tactics drawn for a specific attack

#### 12.36 [GT 1,2] Soviet Artillery Barrage Combat tactic Bonus

On Game-Turns 1 and 2, every Soviet attack against a German unit in the printed Soviet Artillery Barrage zone receives the **artillery** combat tactic (and its combat chit draw).

#### 12.37 Soviet Deck Exhaustion

If the Soviet deck is exhausted when a combat tactic draw is called for, reshuffle the deck only for the purpose of drawing combat tactics. This reshuffle does not extend Soviet impulses.

#### 12.38 Soviet Overwelming Attack

A Soviet attack is overwhelming if any of the following applies:

- The attack has odds of **8:1 or greater**; or
- The attack has odds of **6:1 or greater** and qualifies as a **large attack** (seven or more combat chits will be drawn); or
- All defending units are **unsupplied** or **dispersed** and the attack has odds of **5:1 or greater**; or
- All defending units are **isolated** and not in a VP hex.

When determining if an attack is overwhelming, take into account the effects of marsh terrain and Dniepr river hexsides on unit strength.

If the attack is overwhelming do not add reserve units to the attack, do not draw a card for the attack, and do not apply the auxiliary card’s combat tactic to the attack. If a Soviet attack becomes overwhelming due to the addition of reserve units, do not draw a card and do not apply the auxiliary card. If the attack becomes overwhelming due to the card draw, do not apply the auxiliary card.

> **[Exemple p33]**
>
> Applying Soviet Combat Tactics in Soviet Attack (12.3):
>
> On Game-turn 3 you are resolving a Soviet attack by units activated by command card E07. Card E12 is in the auxiliary card box. The attack is within range of fixed artillery.
>
> In Attack Step 2 you draw combat tactic card E03, listing the Tank Brigade tactic. The tactic is applicable to the attack; it adds two to the attack strength and, if no attacking units are armored, adds armor to the attack. And, as with all drawn combat tactic cards, it grants an additional combat chit draw.
>
> Then you check the auxiliary card. Its Fixed Artillery combat tactic applies to the attack, so the attack gains artillery and another additional chit draw.
>
> After resolving the attack you discard both the drawn combat tactic card and the auxiliary card.
>
> On Game-turn 4 you are resolving a Soviet attack by units activated by command card E04 against German units in a clear hex. Card E05 is in the auxiliary card box. No Soviet units other than the attacking units are proximate to the defenders.
>
> In attack step 2 you draw combat tactic card e11, listing the Partisans tactic. This tactic does not apply to the attack because the defenders are in a clear hex. Nonetheless, the card draw grants your attack an additional combat chit draw.
>
> Then you check the auxiliary card. It has two combat tactics; the artillery combat applies to your attack, but the reinforce tactic does not because no Soviet units are eligible to reinforce. Since one of the tactics on the auxiliary card does not apply, none of the card’s tactics are applied and no combat chit draws are added.
>
> After resolving the attack you discard the drawn combat tactic card. The auxiliary card remains in the auxiliary card box.

<!-- p34 -->

#### 12.39 German Weak Attack

If a German attack will have a maximum combat chit draw of one or two chits, the attack is considered weak. This means you do not draw a Soviet Card during the attack; skip step 3 of the German Attack Sequence.

### 12.4 Drawing Combat Chits

MINIMUM DRAW: Draw combat chits blindly from the combat chit cup one at a time. The required minimum number of draws equals the number of steps in the defending units, regardless of any combat tactics or other factors.

OPTION TO CONTINUE: When the Germans are attacking and you have drawn the minimum number of combat chits required, you may choose to stop there or draw any number of additional chits, up to the maximum allowed. You must choose the total number you will draw prior to drawing any additional chits. Once you have decided, draw that number of chits and only that number of chits.

When the Soviets are attacking, draw the maximum number of chits allowed.

MAXIMUM DRAW: The maximum equals the sum of all the following:

- **+1** chit for each attacking unit with one or two steps
- **+2** chits for each attacking unit with three steps.
- **+1** chit for each combat tactic applied by the attacker
- **+1** chit if the defender is out of supply.
- **+2** chits if the defender is isolated.
- **-2** chits if the Screen combat tactic is in effect for the German defender.

If the ground condition is light mud (18.34) the maximum allowed chit draw may not exceed six chits.

MANDATORY MINIMUM: If the calculated chit draw maximum is equal to or less than the required minimum draw, the attacker draws just the required minimum number of combat chits. Never draw less than the required minimum.

#### 12.41 Combat Chit Situations

As you draw each combat chit, check the situation listed on the front and back of the chit.

- If either situation applies to the combat, retain the chit and place it in front of you with the applicable side up.
- In some cases, both situations on the chit may apply. If so, use the side with priority, indicated by a P symbol.
- If neither situation applies, set the chit aside; it is not returned to the cup and counts as a chit draw.

Combat chits list the following situations:

**Combat Ratios** are a comparison of the attacker’s combat strength to the defender’s combat strength. To determine if a combat ratio situation applies, add up the strength of all attacking units and all defending units and compare the two. The attacker’s strength is given first in the ratio. Examples:

- **> 3:1** The attack strength is at least three times the defense strength e.g. 9:3
- **> 1:1** The attack strength is greater than the defense strength e.g. 5:4
- **< 2:1** The attack strength is less than two times the defense strength e.g. 5:3
- **> 8:1** The attack strength is at least eight times the defense strength e.g. 16:2
- **< 1.5:1** The attack strength is less than one and a half times the defense strength e.g. 7:5

Terrain affects the calculation of combat ratios in the following situations:

- The total strength of units attacking across a **Dniepr River** hexside is **halved**.
- The total strength of mechanized unit attacking into or from a **marsh** hex, or defending in a marsh hex is **halved**.

When halving, total the strength of all affected units and then halve the total, rounding down fractions. **Example:** If two units with a total strength of seven are attacking across the Dniepr river, their strength is halved and rounded down to three.

**Terrain** such as **clear, broken, woods, town or city** applies if the defending units occupy a hex with one of the terrain features listed on the combat chit.

**German or Soviet Airpower** applies if the Airpower combat tactic has been applied by the attacker or defender.

**Attacker or Defender Artillery** applies if the Artillery combat tactic has been applied by the attacker or defender.

**Combat Engineers** applies if the attacker (only) played the Combat Engineers combat tactic.

**Defender Adjacent** applies if the defender is adjacent to a non-dispersed supplied unit friendly to the defender and which has not yet been attacked in the current impulse.

[GT 5+] Applies to Soviet defenders only if the defending units and the adjacent unit are in support.

> **[Exemple p34]**
>
> Example of Combat Chit Draw (12.4): Five of your units are attacking a Soviet unit with two steps. One of your units has 3 steps. You have played two combat tactics. A minimum of two combat chits must be drawn and a maximum of eight combat chits may be drawn.
>
> After drawing and inspecting the first two chits, you must commit to drawing 0 to 6 more chits. Once you have made that commitment, you must draw that number of chits and abide by the results of the drawn chits.
>
> Minimum Draw: 2
>
> - 2 Steps defending
>
> Maximum Draw: 8
> - 4 two-step units
> - 1 three-step unit (2 draws)
> - 2 combat tactics played

<!-- p35 -->

**Dispersed or Unsupplied** applies if all defending units are dispersed, out of supply, or isolated.

**Flank Attack** applies if the attacking units occupy at least three hexes or occupy two hexes not adjacent to each other. Flank Attack does not apply if the defender is in a town or city.

**Large Attack** applies to a Soviet attack in which at least seven combat chits are drawn; and to a German attack in which at least six combat chits are drawn.

**IP Crossfire** applies if the defender occupies an Improved Position.

**One-Hex Attack** applies if all the attacking units are in a single hex.

**Only Attacker or Defender Armor** applies if only one side has an armor unit in the combat. The Tank Brigade or Panzer Battalion combat tactic fulfills the armor requirement.

**Command Value #** applies if the attacking units were activated by a card with the matching command value (the value in the top left corner of the card).

**NKVD** applies if the Soviet NKVD combat tactic was applied to this combat.

[GT 5+] **Attack not Supported** applies to a Soviet attack if all attacking and defending units are in hexes outside Soviet support.

[GT 5+] **Defender not Supported** applies to a German attack if the defending Soviet units are in a hex outside Soviet support.

[GT 5+] **Soviets not Supported** applies to a Soviet attack if all attacking and defending units are in hexes outside Soviet support; or applies to a German attack if the defending units are in a hex outside Soviet support.

#### 12.42 Replenishing the Combat Chit Cup

Once drawn, combat chits are kept out of the cup. After resolving a combat, place the drawn combat chits to the side with any previously drawn chits until replenishment occurs. Replenishment is triggered when a darker combat chit is drawn. Upon drawing a darker combat chit, immediately return all drawn chits from previous combats to the cup and resume drawing chits for the current combat. Then, after the current combat is resolved return those chits to the cup as well. The combat chit cup is also replenished at the end of the day; return all chits to the cup at that time.

### 12.5 Combat Hits

After drawing combat chits and determining which ones apply to the combat situation, calculate the total hits incurred by the attacking and defending units. Each combat chit lists an A (for attacker) or D (for defender) followed by a numerical hit result, for example **A1** or **D2**. Some chits list hit results for both the attacker and defender, such as **A1 D1**. Some chits list a hit result subtraction, such as **D-1**. Still other chits list S for Soviet or G for German followed by a hit number; these apply to units of that nationality, whether attacking or defending.

Calculate the hits (add and subtract as necessary) on all the chits for the defender and attacker to arrive at a hit total for each side.

#### 12.51 Hit Total Adjustments

The hit total is adjusted in the following situations:

- If the defender occupies a town, city or improved position, the total number of defender hits is reduced by one. The IP marker is removed upon conferring this reduction.
- If all attacking units are attacking across Donets or Dniepr River hexsides defender hits are reduced by one.
- If all defending units are dispersed or out of supply the total number of attacker hits is reduced by one.
- If all defending units are isolated, all attacker hits are ignored.
- The application of any of the following combat tactics may increase or decrease hits to the defender or attacker; see the play aid for specifics: Partisans, NKVD, rifle brigade, tank brigade, intelligence, and battlefield replacements.
- If all German units defending in a combat are eliminated, Soviet hits may be reduced per 12.55.

HIT TOTAL LESS THAN 0: A hit total less than 0 (due to subtractions) is treated as 0.

> **[Exemple p35]**
>
> Examples of Flank Attacks:
>
> A. Unit A is flanked because enemy units are attacking it from three hexes.
>
> B. Unit B is not flanked because only one enemy unit is adjacent to it.
>
> C. Even though three enemy units are adjacent to Unit C, it is not flanked because it is in a town.
>
> D. Unit D is flanked because it is adjacent to two enemy units which are not adjacent to each other.

> **[Exemple p35]**
>
> Examples of Combat Hits (12.5):
>
> These three chits total A2 D2; two hits to the attacker and two to the defender.
>
> These five chits total A1 D2; although the chits show four defender hits, the two D-1 results reduce the total defender hits to two. (If the attacker had chosen to draw only four chits, the result would have been A1 D3.)
>
> If the Soviets are attacking, these four chits total A1 D3; If the Soviets are defending, these chits total A0 D4.

<!-- p36 -->

#### 12.52 Processing Hits

After calculating each side’s hit totals, apply defender hits to the defending units, then apply attacker hits to attacking units. Apply each hit by removing a step from a unit participating in the combat or by retreating or dispersing all participating units, within the following restrictions.

- Defending units may all retreat one hex to satisfy one hit, or retreat two hexes and disperse all defending units to satisfy two hits. All other defender hits must be satisfied by step losses. **Exception:** If any of the defending units are already dispersed, that stack may retreat only one hex.
- The first hit incurred by attacking units must be applied as a step loss to one of those units. Up to two additional hits may be satisfied by dispersing all attacking hits. All other attacker hits must be satisfied by step losses.
- You are not required to retreat or disperse German units; you may choose to apply all hits as step losses.

#### 12.53 Assigning Hits to Soviet Defenders

Assign each hit to Soviet units defending in combat either as a one-hex retreat of all units, or a step loss to one unit. Assign each hit in accordance with the first of the following priorities that applies. If the Soviet units were defending in a town, city or improved position hex, reduce the total number of hits by one (and remove the IP marker) before checking these priorities.

A. If the defender has already retreated the maximum number of hexes allowed, apply a step loss for each remaining hit not yet applied. If not, proceed to B.

B. If the number of hits remaining is equal to or greater than the number of steps in the defending units, retreat one hex. If the number of hits is less, proceed to C.

C. Conduct a Hold Check to determine if the defending units take a step loss or retreat. Calculate the defender’s Hold Chance as follows:

SOVIET DEFENDER’S HOLD CHANCE:

- **+ number of steps** in defending units
- **+ twice the VP value** of hex
- **+1** if hex is **woods, town** or **city**
- **+1** if all attackers are across **Donets** or **Dniepr River** hexsides
- **-2** if supply can’t be traced from defenders’ hex (13.1)
- **+2** if all retreat routes would require an extra step loss (that is the defenders would have to retreat into a hex in German control but not occupied by a supplied Soviet unit)
- **+2** if the defending units have already retreated one hex

Roll the die; if the result is:

- **equal to or less than** the defender’s Hold Chance, apply a step loss;
- **greater than** the Hold Chance, retreat one hex.

With each hit applied, repeat these priorities from the top, beginning with Priority A.

#### 12.54 Assigning Hits to Soviet Attackers

1st hit: Assign the first hit incurred by Soviet units attacking in combat as a step loss.

**Additional hits:** After removing a step for the first hit, use the table below to assign additional hits, by comparing the total steps remaining in the attacking units to the number of hits remaining to be assigned. Disregard hits in excess of those shown on the table.

| Steps \ Hits remaining after first step loss | 1 | 2 | 3 | 4 | 5 | 6+ |
|---|---|---|---|---|---|---|
| 1 | D | D | E | E | E | E |
| 2 | D | D | 1D | E | E | E |
| 3 | D | D | 1D | 2D | E | E |
| 4 | 1 (0D) | D | 1D | 2D | 3D | E |
| 5 | 1 (0D) | D | 1D | 2D | 3D | 4D |
| 6,7 | 1 | 2 (0D) | 1D | 2D | 3D | 4D |
| 8,9 | 1 | 2 (0D) | 3 (1D) | 2D | 3D | 4D |
| 10+ | 1 | 2 | 3 (1D) | 4 (2D) | 3D | 4D |

**#**: Steps removed · **D**: Disperse all attacking units · **E**: All attacking units eliminated · (#D): If there are less than four cards in the Soviet draw pile and the combat did not result in the defender vacating a VP hex, use the parenthetical result. Otherwise use the primary result.

> **[Exemple p36]**
>
> **Examples of Processing Hits:**
>
> **Scenario 1:** Five of your units have attacked two Soviet units with one step each, resulting in 2 hits against the defender and 2 hits against the attacker. Defender hits are processed first. The attack was not in a town, city, or improved position, so the number of defender hits remains at 2.
>
> Checking priorities, it is found that (A) the defender has not already retreated two hexes, but (B) the number of hits is equal to or greater to the number of defending steps. Therefore, retreat the defenders one hex.
>
> To process the second hit, (A) still does not apply, but now (B) does not apply either. Therefore (C) conduct a Hold Check. There are two defending steps (+2) and the units have already retreated one hex (+2); we will assume that none of the other factors for Hold Checks applies, so that the Hold Chance is 4. You roll the die and get a 3. This is less than or equal to the Hold Chance, so the defenders stop their retreat and take a step loss.
>
> You, as the attacker, process hits second. The first hit is applied by removing a step from an attacking unit of your choice. However, the first step loss incurred by German attackers must be taken from a three-step unit or an armor unit, if any participated.
>
> You may satisfy the second hit by removing a step from any attacking unit of your choice or by dispersing all attacking units. However, in a given combat, a unit can’t lose a second step until all attacking units have lost one step.
>
> **Scenario 2:** Two 2-step Soviet units and two 1-step Soviet units, with a total of six steps, attack two of your units, resulting in 3 hits on the attackers and 2 on the defenders. As defender, you have three options: take 2 step losses; take 1 step loss and retreat all defenders 1 hex; or retreat 2 hexes and disperse all defending units.
>
> The first hit against the Soviet attackers is applied as a step loss to the unit with the most steps; higher selector if tied. The step is removed from the 2-step unit with the higher selector.
>
> Two hits remain to be accounted for. The Soviets have 5 steps left. Checking column 2 and row 5 in the table in 12.54, the result is D: The remaining attacker units will all be dispersed.

<!-- p37 -->

#### 12.55 Soviet Attacker Hit Reduction

The number of hits incurred by the Soviets in a Soviet attack is reduced if all the German units defending in the combat are eliminated and German hits remain unfulfilled. Reduce the number of Soviet hits by the number of unfulfilled German hits. Assume the German units satisfied hits by retreating two hexes before losing steps if retreat was possible.

### 12.6 Applying Step Losses

A combat hit assigned as a step loss is applied to one unit that participated in the combat.

- Apply a German step loss to a unit of your choice. However, the first step loss assigned must be to a 3-step unit or an armor unit, if any participated.
- Apply a Soviet step loss to the unit with the most steps. Among units with the most steps, apply the loss to the unit with the higher selector. Among units with the same selector, you choose.

To apply a step loss, flip the unit to the side showing one less step or replace the unit with its replacement counter (marked R), showing one less step.

#### 12.61 Assign Step Losses Evenly

If you are assigning more than one step loss to units in a given combat, no unit may be assigned a second step loss until all participating units have been assigned one step loss in that combat.

#### 12.62 Elimination and Destruction

A unit that loses its lone remaining step is eliminated. An eliminated unit that was originally a multi-step unit is placed in the eliminated units box on its one-step side. It may be returned to play later via replacement (16.0).

- An eliminated unit that was one-step at full strength is removed from play entirely, it can’t be replaced.
- A unit that is eliminated when in a state of Isolation is destroyed. Remove destroyed units from play, they can’t return via replacements.

### 12.7 Retreats

The defender (whether German or Soviet) in a combat may satisfy one hit by retreating all defending units one hex, or two hits by retreating all defending units two hexes. The attacker can’t retreat. **Exceptions:** Dispersed units and isolated non-mech units may retreat only one hex. Isolated mech units can’t retreat at all. Soviet defenders can’t retreat in a combat to which the NKVD combat tactic was applied.

RETREAT PRIORITIES: Retreat units one or two hexes away from the hex the units occupied during combat, entering hexes in the following priority order during the retreat:
1. Into a hex not in enemy control. If none available…
2. Into a hex in enemy control, occupied by a friendly supplied non-dispersed unit. If none available …
3. Into an unoccupied hex in enemy control and in friendly supply. This retreat requires the removal of a step from one of the retreating units. The step loss does not count toward satisfying a combat hit.
4. Into an unoccupied hex in enemy control and not in friendly supply or into a hex in enemy control and occupied only by friendly unsupplied or dispersed units. This retreat requires a step loss, as in Priority 3.

MORE THAN ONE CHOICE: Within any of these priorities, retreat into any hex regardless of terrain. However, retreat is allowed across an unbridged Dniepr river hexside **only if** no other hex is available in that priority.

- GERMAN: If there is still more than one choice available when retreating **German** units, you choose.
- SOVIET: If there is still more than one choice available when retreating Soviet units, prefer: a) a **Soviet** VP hex; b) a hex not in the direction indicated by a forward arrow; c) a hex not adjacent to the forward direction; d) a woods terrain hex; e) the easternmost hex; f) the lowest numbered hex.

#### 12.71 Prohibited Retreats

A unit can’t …

- retreat into an unoccupied enemy town or city hex;
- retreat across a **blocked** Dniepr River hexside;
- end its retreat in violation of stacking restrictions.

German units **can** retreat into a garrisoned village hex.

#### 12.72 Avoid Elimination

If following the above retreat priorities would result in a unit’s elimination when another valid retreat route of lesser priority would not, take the lesser priority route.

#### 12.73 Stay Together

When more than one unit is retreating, all retreating units must retreat together and end in the same hex, if possible. Retreat to different hexes is allowed only to avoid overstacking at the end of the retreat. If Soviet units must retreat to different hexes, retreat the units in ascending selector order.

#### 12.74 Already Retreated Units

If a unit ends its retreat in a hex occupied by a friendly unit, and that friendly unit is attacked later in the same activation, the retreated unit contributes nothing to the defense in the attack; its steps are not counted in determining combat chit draws and its steps can’t be removed to satisfy step losses. If the defending unit retreats or is eliminated by the attack, the previously retreated unit is eliminated.

#### 12.75 Two-Hex Retreat

Defending units may retreat two hexes to satisfy a second combat hit, as long as none of the defending units is already dispersed or isolated. Upon doing so, the retreating units become **dispersed**. A unit retreating two hexes may retreat through friendly units in excess of the stacking limit. A two-hex retreat must end two hexes away from the combat hex.

Soviet unit(s) retreat in violation of stacking limits only into the first hex of the retreat and only if at least one defender hit remains unfulfilled after entering the hex. The retreating units then fulfill their next hit by retreating a second hex, instead of checking the priorities of 12.52. If unable to retreat a second hex from the over stacked hex, the defending units may not retreat at all.

### 12.8 Advance after Combat

If the defender vacates the hex under attack by retreat or elimination, all undispersed attacking units may advance into the hex, within stacking limits, and regardless of the presence of enemy zones of control. Units included in an attack via the Assault Coordination or Reinforce Battle combat tactic can’t advance after combat.

- Victorious attacking units (whether German or Soviet) use the general advance rules (including 12.81 and 12.82).
- A German unit can’t end its advance in a hex from which it can’t trace supply (10.5). **Exception:** A German unit unable to trace supply and unable to advance into a hex from which it can trace supply is not bound by this restriction.
- Check victorious attacking Soviet units using the Soviet advance rules (12.83) to see whether they actually advance.

> **[Exemple p38]**
>
> Examples of German Retreats (12.7):
>
> Since combats are resolved one at a time, the order of resolution will affect the retreat priorities available. Each of the attacking Soviet units in this illustration will advance one hex in the direction of the attack arrow (the triangle symbol shows how many defender hits have to be processed by the defending unit). Hits satisfied by retreat and/or dispersal are noted by green checkmark symbols. Step losses are noted by red “x” symbols.
>
> A. This unit incurs one hit in combat and can satisfy that hit by retreating one hex. Using retreat priority 1, its only choice is retreat directly west into hex 1912.
>
> B. This three-step unit incurs two hits in combat and can satisfy both of them by retreating two hexes and becoming dispersed. The unit chooses hex 1612; the only other options (because of retreat priority 1) would have been hexes 1713 or 1812.
>
> C. Two two-step units incur one hit in combat. If both units hold position, one step loss is taken. If a one-hex retreat is attempted, both units must retreat together and end up in the same hex together. They cannot use retreat priority 1 to enter hex 1512 or 1712, because those hexes are now in enemy ZOC (the unit that attacked unit B having advanced into B’s hex). Nor may the units enter hex 1612 because the overall number of steps in the hex (seven steps across the three units) would exceed the stacking limit. Therefore, the two retreating units must now retreat using retreat priority 3, losing an extra step for retreating into an enemy ZOC. In the end, the two units retreat one hex to hex 1512, satisfying the original hit, and then one of them incurs a step loss for using retreat priority 3.
>
> D. This two-step unit incurs two hits in combat. Note that the unit which attacked unit A has advanced and now occupies the hex formerly occupied by unit A (blocking one retreat path option).
>
> Unit D has no options under retreat priority 1, because every adjacent hex is in enemy control. Retreat priority 2 is not vailable because none of the enemy-controlled adjacent hexes has a friendly unit. Unit D must use retreat priority 3 and retreat into an unoccupied enemy-controlled hex.
>
> It cannot “retreat forward” into Lozovaya, because retreats into unoccupied enemy towns and cities is not allowed.
>
> If it retreats to the southwest (hex 2111), the second retreat hex can only be 2210. At that point the unit will have incurred two step losses from retreating through enemy-controlled hexes, eliminating the unit. To avoid elimination, the unit may instead retreat west to hex 2011 and then northwest into hex 1912.
>
> By retreating two hexes, the unit satisfies two hits. It loses 1 step for retreating through an enemy-controlled unoccupied hex (2011). It does not lose a step for the second hex, however, because retreat priority 2 is in effect: A unit can retreat into an enemy-ZOC hex occupied by a friendly unit without losing a step.
>
> Examples of Soviet Retreats (12.7):
>
> In both attacks A and B, the defending Soviet unit will retreat 2 hexes.
>
> A. Under priority 1, the Soviet unit may retreat to any hex not in enemy control. The first retreat hex must be 1711 or 1811. Using the Soviet retreat priorities in 12.7: Neither hex is a Soviet VP, and neither is in the direction of a forward arrow. 1711 is not adjacent to the direction of 1712’s forward arrow, but 1811 is. Therefore the first hex of retreat is 1711. From there, hexes 1610, 1710 and 1810 would be eligible. 1810 is in the direction of 1711’s forward arrow and 1710 is adjacent to that direction. Therefore the unit retreats to 1610.
>
> B. Here the Soviet unit is not able to retreat into a hex not in enemy control (priority 1). Priority 2 is applicable because the unit can move into the friendly-occupied hex 2011. From there, the eligible hexes are 2010 and 1911. Neither hex is along or adjacent to hex 2011’s forward arrow. Neither hex is wooded, but 2010 is easternmost. Therefor the unit retreats to 2010..

> **[Exemple p39]**
>
> Examples of German Advance After Combat (12.8):
>
> Two combats occur, first A then B.
>
> A. The defending unit retreats one hex. All, some, or none of the attackers may advance into the vacated hex.
>
> B. The defender retreats two hexes. Your infantry can advance into the vacated hex. The armor unit may advance one or two hexes. The first hex entered must be the attacked hex. The second hex may be any hex not occupied by enemy units. However the advance into the second hex can’t be from one enemy-controlled hex to another, unless following the path of retreat. The armor unit can advance to 1711 or 1812, but not to 1811.
>
> Examples of Soviet Advance After Combat (12.8):
>
> A. The defending unit retreats one hex. Check the attacking Soviet units in ascending selector order, beginning with unit 01. Hex 1413 is in the primary forward direction, and there are no Soviet units already in hex 1413. Therefore, unit 01 advances. Unit 18 is next. Hex 1413 is in the forward direction from hex 1412, however, there is now a unit in the hex. You roll the die for unit 18 and the result is 7. Checking the table in 12.83, a 1-6 is required to advance. The unit does not advance.
>
> B. The defender retreats 2 hexes. Unit 04 checks for advance first. Hex
>
> 1611 is not in its primary forward direction but is in its secondary forward direction (priority 5); the unit advances into 1611. Unit 04 is armored and may advance a second hex. It advances in the secondary direction, which is also along the path of retreat, to hex 1612. Infantry unit 05 advances one hex into the now empty hex 1611.
>
> C. Hex 1813 has been attacked by MPG units 03, 06, and 08. The defender retreats to hex 1814. Unit 03 checks for advance first and advances along its forward direction to 1813. Unit 06 can also advance to 1813 but must roll due to the presence of unit 03. The roll is a 2; Unit 06 advances. Hex 1813 now has 2 Soviet units. Unit 08 does not advance because the table in 12.83 indicates that there are no Soviet advances into hexes that already have 2 Soviet units.

<!-- p40 -->

#### 12.81 Two-Hex Advance

If the defending units retreat two hexes or are eliminated, attacking **mechanized** units may advance two hexes.

- The **first** hex entered in the advance must be the attacked hex.
- The **second** hex entered in the advance may be any hex adjacent to the attacked hex. However, when deviating from the path of retreat, the advancing unit can’t move directly from one enemy-controlled hex to another.
- A German unit can’t deviate from the path of retreat if adjacent to a garrisoned hex after advancing one hex.
- When more than one unit is advancing two hexes, they may advance into different hexes.
- Defending units that are eliminated leave no path of retreat. In this situation, advancing into a second hex always deviates from the path of retreat.
- The German Panzer Battalion combat tactic enables one attacking infantry unit to advance after combat as a mechanized unit.

#### 12.82 Advancing Across Donets and Dniepr River

A unit may advance across an unbridged Donets or Dniepr hexside only if it attacked across that hexside or is following the path of retreat. A unit advancing across an unbridged Donets or Dniepr hexside must stop in the hex across the river, even if the unit is mechanized and has advanced only one hex.

Units may advance across bridged river hexsides without restriction.

#### 12.83 Soviet Advance After Combat

▲Victorious attacking Soviet units advance one unit at a time, in **ascending** numerical order. For each unit eligible to advance, check to determine if its advance into the hex would be in the primary forward direction from the unit’s hex, secondary forward direction, closer to the unit’s objective, or some other direction. Consult the following table, cross referencing the route of advance with the number of Soviet units that already occupy the hex via advance (if any). Roll the die; if the die result falls in the indicated range, the unit advances.

| Route of advance | 0 Soviet units already in hex | 1 | 2 |
|---|---|---|---|
| The first of these routes that apply: 1) into VP hex, 2) primary direction, 3) enables supply\*, 4) across river and closer to objective, 5) secondary direction; 6) if advancing a second hex, along the path of retreat. | Advance | 1-6 | No |
| 1) Causes surround, 2) closer to objective, 3) attacked hex. | 1-7 | 1-3 | No |
| Other route | No | No | No |

\*An advance into a given hex **enables supply** if any Soviet units not able to trace supply become able to do so as a result of the advance.

If a Soviet unit advancing a second hex has a choice of hexes to enter, check for advance into the hex with highest chance of advance only.

SOVIET ADVANCE RESTRICTIONS:

- A Soviet will not advance if doing so would cause one or more German units to become proximate to or, [GT 4+] German supply to be traceable to, an empty or garrisoned Soviet town or city hex. Does not apply if the situation exists at the start of the advance.
- A Soviet unit will not advance out of a map-edge VP hex if doing so leaves the hex vacant, unless Soviet supply cannot be traced to the hex.
- A Soviet mechanized unit will not advance into a marsh hex.
- [GT 3+] A Soviet unit will not advance if doing so causes another Soviet unit to become unable to trace supply..
- [GT 6+] Beginning Game-Turn 6, a Soviet unit will advance into a surrounded or nearly surrounded hex only if the hex is a VP hex or the advance enables any Soviet units currently unable to trace a line of supply to do so.

### 12.9 Dispersal

A unit becomes dispersed in the following situations:

- The unit is defending in combat and retreats two hexes.
- The unit is attacking and becomes dispersed to satisfy combat hits.
- The unit is German and a target of the Partisan Uprising event.
- The unit is Soviet and a target of the Over Extended event.

EFFECTS: Place a Dispersed marker on the unit.

A dispersed unit:

- Can’t move, attack or receive an improved position;
- Can’t advance after combat.

A dispersed unit and any units stacked with it can retreat only one hex if attacked.

If all units defending in a combat start the combat dispersed:

- subtract one hit from hits incurred by the attacker;
- Combat tactics can’t be applied to the defenders.

REMOVAL: A dispersed unit becomes undispersed when:

- The unit is activated. After all other units in the activated formation have completed their actions, the unit’s Dispersed marker is removed. However, an active unit that becomes dispersed when attacking does not become undispersed at the end of the current activation.
- All Dispersed markers are removed at the end of the game-turn.

## 13. SUPPLY

A **unit** is supplied or unsupplied. All units start the game supplied. A unit unable to trace supply during the Supply Phase becomes (or remains) unsupplied throughout the game-turn.

A **hex** is considered to be in supply for a given side at a given moment if a friendly supply path can be traced from the hex at that moment.

SUPPLY FOR UNITS: All units are supplied throughout Game-turn 1. All Soviet units are supplied throughout Game-turns 2 and 3. Starting on Game-turn 2 for German units and Game-turn 4 for Soviet units, supply for all units is determined during the Supply Phase, by checking if each unit can trace supply. Supply determinations made for units in the Supply Phase apply throughout the game-turn, even if the unit becomes unable or able to trace supply during the turn. **Exception:** Air Resupply (13.4).

SUPPLY FOR HEXES: Soviet or German supply for a hex is determined at the moment a function requiring supply is to be performed in the hex, including but not limited to the following:

- A German unit can’t end its move or advance in a hex from which German supply can’t be traced (exception, 10.5).
- To place a German reserve unit in a hex, the hex must be a German supply head or a clear hex adjacent to a German supply head.
- To assign replacements to a German unit, the unit must be supplied and in a hex in German supply.

<!-- p41 -->

- To assign replacements to a Soviet unit, the unit must be in supply and in a hex from which Soviet reserve supply can be traced (13.3).
- To play the German “activate any one Unit” command (6.1) the unit must be in a hex in German supply.
- In order to place a Soviet garrison marker (15.1) the placement hex must be in Soviet supply.

To determine if supply is traceable from an unoccupied or enemy-occupied hex, imagine a friendly unit in the hex (instead of an enemy unit); if the hypothetical friendly unit could trace supply, the hex is in friendly supply. Use this test in all cases of tracing supply to a hex.

### 13.1 Tracing Supply

SUPPLY PATHS: Supply can be traced from a unit or hex if a path of no more than seven hexes can be traced from the unit or hex to a hex on a friendly map edge or to a road hex that is a valid supply head.

- First, the hex for which supply is being traced may be in an enemy ZOC.
- From there, the seven-hex path can’t pass through enemy town or city hexes, or hexes occupied by enemy units or garrisons.
- The path may be traced into a hex in an enemy ZOC **only if** that hex is occupied by a friendly unit.
- If the path crosses an unbridged Dniepr river hexside, its allowed length is shortened to two hexes. The path can’t cross a **blocked** Dniepr river hexside.

FRIENDLY MAP EDGES: For purposes of tracing supply, all map edge hexes are Soviet-friendly or German-friendly:

- Soviet: all map-edge hexes along those portions of the east and north map edge marked as Soviet.
- German: all map-edge hexes along map edges that are not marked as Soviet.

A unit in a friendly map edge hex is always supplied.

SUPPLY HEADS: Every hex on a friendly map edge is a friendly supply head. A road hex is a friendly supply head if a path of connected road hexes can be traced from the road hex to a hex on a friendly map edge with a road leading off the map.

- The road path may be of any length but may not pass through enemy town or city hexes, or through hexes occupied by enemy units or garrisons.
- The road path may be traced into a hex in an enemy ZOC **only if** that hex is occupied by a friendly unit.

### 13.2 Effects of Unsupply

A unit unable to trace supply during the Supply Phase enters one of two states of unsupply: out of supply (OOS) or isolated. A unit in either of these states is considered unsupplied.

#### 13.21 Out of Supply

An unsupplied unit that was in supply before the current Supply Phase receives an Out of Supply marker. An out of supply unit suffers the following effects throughout the game turn:

- No combat tactic may be played for or applied to the unit. If the combat includes other friendly units in supply, combat tactics may be applied on their behalf.
- If mechanized, the unit may move no more than two hexes.
- The unit can’t build an IP, but retains one previously placed.
- If German, the unit may attack only if at least one supplied unit is also attacking. Out of Supply Soviet units can’t attack at all.
- If all units in the hex are out of supply (or a combination of out of supply and isolated), the enemy attackers may draw **one** extra combat chit and may disregard **one** attacker hit.
- The unit can’t be assigned replacements.
- If Soviet, the unit has special movement methods (9.27).

#### 13.22 Isolated

An unsupplied unit already out of supply during the Supply Phase becomes Isolated. Flip its OOS marker to the isolated side. An isolated unit **suffers all the effects of being out of supply**, plus the following:

> **[Exemple p41]**
>
> Examples of Tracing Supply (13.1):
>
> Hexes marked with a green check are valid German supply heads, whereas hexes marked with a red “X” are not, due to the presence of Soviet ZOCs.
> A. In supply: these units have a supply path that exits a ZOC and reaches the supply head at 2405 in two hexes.
> B. In supply: This unit’s path goes through enemy ZOC in hex 2504, but the enemy ZOC hex is occupied by a friendly unit, allowing supply to be traced through.
> C. Not in supply. This unit’s supply path to the supply head in 2804 is blocked by Soviet zones of control in hexes not occupied by German units.
> D. In supply. A unit in a German map edge hex is always in supply.

<!-- p42 -->

- The unit does not exert a zone of control.
- A mechanized unit can’t move.
- A mechanized unit and any units stacked with it can’t retreat.
- An armored unit is considered unarmored.
- An infantry or cavalry unit can move only one hex, can’t move out of an enemy ZOC, and can’t move into an enemy town or city.
- An infantry or cavalry unit and any units stacked with it can retreat only one hex.
- The unit can’t attack.
- If all units in the hex are isolated, enemy attackers may draw two extra combat chits and disregard all attacker hits on all chit draws. This supersedes the effects of being attacked when out of supply.
- German isolated units are eligible to be attacked by Soviet units regardless of situational strength (9.4).
- If eliminated, the unit is destroyed. Remove the unit from the game; it can’t return via replacement.
- The unit does not affect the placement of enemy reserve units, except in its own hex.

#### 13.23 Surrender

An already isolated unit or stack of units that can’t trace supply during the Supply Phase continues to suffer all the effects of being isolated. In addition …

- if German you must remove one step from the isolated unit or stack.
- if Soviet, and adjacent to a German unit, remove one step from the unit (from the unit with the highest selector if in a stack).

If a unit’s last step is removed in this manner, the unit is destroyed.

### 13.3 Soviet Reserve Supply

A more restrictive form of supply trace called **reserve supply** applies to placement of Soviet reserves and replacements on all game-turns. Reserve supply is traced from a hex like regular supply with the added restriction that it can’t be traced through a hex in a German ZOC, **even if occupied by a Soviet unit**.

A hex must be in **reserve supply** in order to:

- Place a Soviet reserve unit in the hex.
- Assign a replacement step to a Soviet unit in the hex.

### 13.4 Air Resupply

The German and Soviet sides may play an Airpower command event to restore an unsupplied friendly unit or stack to supply, per the event description. When the event is applied, the stack immediately returns to supply; remove the Out of Supply or Isolated marker from the stack. During the next Supply Phase, the unit will again be subject to a normal supply check. Soviet Air Resupply does not put Soviet units in support.

### 13.5 [GT 5+] Soviet Support [GT 5+]

Beginning on Game-Turn 5, a hex must be in Soviet support in order for Soviet units in the hex to operate at full effectiveness. Soviet support is independent of supply state. **Prior to Game-Turn 5, all hexes are in Soviet support**.

#### 13.51 Determining Support

A hex is in Soviet support if:

- in the Soviet support zone valid on the current game-turn; or
- within five hexes of a hex occupied by a Soviet Forward Support marker. The five hex range is traced through any terrain and regardless of the presence of German units.

Western and Eastern Soviet Support Lines The Soviet Support zone consists of all hexes to the east of the current Soviet Support line. There are two Soviet Support lines marked on the map – the western line and the eastern line. Note that the eastern support line is also the Soviet artillery line

- [GT 5-7] The western support line is in effect throughout Game-turns 5-7, and throughout any turn thereafter in which the Soviet Player starts the turn with **at least 21 VPs**.
- [GT 8+] Starting on Game-turn 8, the eastern support line is used throughout any game-turn in which the Soviets start the turn with **less than 21 VPs**.

[GT 8+] In Step 4 of each Game-turn’s Supply Phase, check the VP Level to determine which Soviet support line to use throughout that turn.

#### 13.52 Effects of Unsupport on Soviet Units

- **Unsupported attack.** A Soviet attack in which all the participating Soviet units and the German defenders are in hexes outside Soviet support is considered unsupported. If at least one attacking unit or the German defenders are in a hex in Soviet support, the attack is supported.
- **Unsupported defense.** Soviet units defending in a hex outside Soviet support against a German attack are considered unsupported.
- **No Combat Tactics.** Combat tactics are not applied to an unsupported Soviet attack or defense.
- **Combat Chits Effects.** Certain combat chits apply to an unsupported Soviet attack or defense.
- **No Replacements.** A Soviet unit in a hex outside Soviet support can’t be assigned replacements.
- **No Improved Positions.** A Soviet unit in a hex outside Soviet support can’t receive an IP, but retains an IP previously placed.
- **Reserves limited.** If a front’s objective marker has been removed, reserve units of that front can’t be added to an unsupported Soviet attack.

#### 13.53 Soviet Forward Support Markers

When the **Soviet Forward Support** command event occurs, place a Forward Support marker per the event instructions. From the moment a Forward Support marker is placed, all hexes within five hexes of the marker’s hex are in Soviet support. Up to two Forward Support markers may be on the map at the same time. A Soviet support marker has no effect on the placement or movement of German units.

> **[Exemple p42]**
>
> Examples of Soviet Reserve Supply (13.3):
>
> A. The hex is in supply and also in reserve supply.
>
> B. The hex is in supply because it can trace supply through the friendly unit in hex 2404. However, it is not in reserve supply. Reserve supply cannot be traced through enemy ZOC, even if the ZOC hex is occupied by a friendly unit.

<!-- p43 -->

#### 13.54 Forward Support Marker Removal

Once placed, a Soviet forward support marker remains on the map until removed by any of the following:

- Both Soviet support markers are removed during the End of Turn Phase.
- When you play the German **Air Interdiction** command event, remove one Soviet support marker of your choice.

## 14. TOWNS, CITIES AND IMPROVED POSITIONS

### 14.1 Towns and Cities

Every town and city hex is considered owned by the Soviets or the Germans, even if not occupied by a unit. At the start of play, all town and city hexes are German owned except for two Soviet owned towns in 0202 and 1103. Ownership of a town or city changes the moment an enemy unit enters the hex. From that point forward, the town or city is owned by the side whose unit last entered the hex, even if the hex is subsequently empty.

Ownership of a town or city is not affected by being in an enemy zone of control or out of supply; an enemy unit must actually enter the town or city to take ownership.

Soviet and German Ownership markers are provided for marking ownership of towns and cities.

EFFECTS OF ENEMY-OWNED TOWNS AND CITIES:

- A unit may not retreat into an enemy town or city.
- A unit must stop moving or advancing upon entering an enemy town or city (upon which the town or city immediately becomes friendly-owned).
- A German unit conducting strategic movement may not enter a Soviet town or city.
- Supply may not be traced through an enemy town or city.
- A German reserve unit must be placed at least three hexes away from a Soviet town or city (at least two hexes way if placed in a friendly map edge hex).

#### 14.11 Soviet Front Targets

Most city and town hexes are marked with a symbol indicating that the hex is a target for the Soviet Voronezh Front or Southwest Front (or both). Target symbols affect some Soviet movement methods and placement procedures. Target symbols do not generally prevent entry by Soviet units of the other front and have no effect on ownership.

### 14.2 Improved Positions

An improved position (IP) is a defensive preparation that aids units defending in combat. When a unit with an Improved Position marker is attacked, the **total number of hits** incurred by the defender is **reduced by one**. An IP marker confers this benefit just once – the marker is removed when the IP absorbs a hit.

#### 14.21 Building Improved Positions

Units may gain an IP during play in the following ways:

- At the end of a German activation, you may place IP markers on active undispersed supplied German units that did not move or attack in the activation.
- [GT 4+] At the end of a Soviet activation on and after Game-Turn 4, place an IP marker on one active supplied undispersed Soviet unit per 9.7.

> **[Exemple p43]**
>
> Examples of Soviet Support (13.5):
>
> Game-turn 5 is underway. The red dotted line is the western Soviet Support line. It is in effect on Game Turns 5-7, and and on any turn thereafter when the Soviets have at least 21 VPs.
>
> A. These units are east of the support line and are in support. They may attack the unit in 0915 without penalty.
> B. Both units are west of the support line and beyond the 5-hex range of the Forward Support marker; the units are not in Soviet support. They incur all the penalties described in Section 13.52.
> C. Both units are west of the Soviet support line. The unit in 1315 is within range of the Forward Support marker and so is in support. The other unit is not in support. An attack by both units against the German unit in 1215 would be in support.
> D. The unit is in support because it is within 5 hexes of a Forward Support marker. The presence of German units has no effect on this determination.

<!-- p44 -->

- If the Soviet Combat Engineers combat tactic is drawn when Soviet units are defending in combat, place an IP marker on the defending units, unless they occupy a town or city, or already have an IP marker.
- During a combat in which German units are defending, you may play a Combat Engineers combat tactic to place an IP marker on your defending units unless they occupy a town or city, or already have an IP marker.
- You may play the Engineers command event to place an IP marker on any three eligible German units/stacks.
- If the Soviet Combat Engineers event occurs, place IP markers on Soviet units in support per the event description.

#### 14.22 IP Restrictions

An IP marker can’t be placed in a town or city hex, or in a hex that already has an IP marker. IPs can’t be placed on a unit that is dispersed, out of supply or isolated unless stacked with an eligible unit, or [GT 5+] on a Soviet unit outside Soviet support; but such units may retain a previously placed IP.

#### 14.23 Additional Effects

If a unit moves into a hex occupied by a friendly unit with an IP marker, the arriving unit gains the benefit of the IP, even if the unit originally in the hex moves out. IP markers do not count against stacking limits. An IP marker may remain in a hex indefinitely, as long as friendly units occupy the hex.

#### 14.24 Removing Improved Positions

An IP marker is removed in any of the following situations:

- The hex with the IP marker is attacked and incurs at least one hit – the marker is removed after reducing the number of defender hits by one, before conducting retreats and advances. The IP marker is not removed if the defender receives no hits.
- The hex with the IP marker is subject to an attack to which the Combat Engineers combat tactic has been applied. The IP marker is removed before resolving the combat, negating its benefit to the defender.
- All units in a hex with an IP marker participate in a combat as attackers – the IP marker is immediately removed.
- A unit moves out of a hex with an IP marker, leaving the hex unoccupied. An IP marker is removed if abandoned; it never moves with a unit.

## 15. SOVIET GARRISONS [GT 3+]

Soviet garrison markers represent small forces holding Soviet rear areas and flank positions. Garrison markers are placed in village and VP hexes only. A hex with a garrison marker is referred to as a garrisoned hex.

### 15.1 [GT 4+] Placing Garrisons

Garrison markers are placed on the map in Step 1 of the Supply Phase beginning on Game-Turn 4, and as called for by the Soviet command event **Garrison Front** (see Player Aid).

GARRISON PLACEMENT PROCESS:

1. Place a garrison marker in every empty **Soviet VP** hex from which Soviet supply can be traced;
2. **then** place a garrison marker in every empty **village** hex meeting all these requirements:
- A Soviet unit is proximate or [GT 5+] the hex is in Soviet support;
- Soviet supply can be traced from the hex;
- A German unit is not adjacent;
- A German unit would be proximate to the garrisoned hex or German supply can be traced to the hex;
- Within the current Soviet operational limit.

When checking German proximity and supply trace in this process, all garrisons not adjacent to German units are considered to possess a Soviet zone of control. Treat garrisons in hexes adjacent to German units as if they do not exist.

Check villages in sequence from south to north, and within a given hex row from west to east; in other words, in descending hex number order. Placement of garrisons affect the subsequent placement of garrisons in villages in the same step. If the placement of a garrison causes another garrison in a village to no longer meet the placement requirements, remove that earlier placed garrison even if placed in an earlier turn. For example, if you place a garrison in a hex because a German unit would be proximate to the garrisoned hex, then you place a garrison in another hex that blocks that proximity, you would remove the earlier placed garrison.

> **[Exemple p44]**
>
> Placing Soviet Garrisons (15.1):
>
> It is the garrison placement step of the Game-turn 5 Supply Phase. First you place a garrison marker in the empty Soviet VP hex of Krasnograd. Then you check every empty village hex for garrison placement, in descending hex number order. In this example checks are limited to the depicted map area.
>
> - 2119: No garrison because adjacent to German unit.
> - 1920: No, no Soviet unit proximate and hex outside Soviet support.
> - 1815: Yes, and the placement of this garrison blocks German supply and proximity to Village hex 2014; if there were a garrison marker there you would remove it.
> - 1813: No; German proximity and supply trace are blocked by other garrisons.
> - 1721: Yes; in German supply and Soviet unit in 1416 is proximate.
> - 1619: Yes; Soviet and German units proximate.
> - 1617 and 1613: No
> - 1521: No because adjacent to German unit.
> - 1419: Yes: Soviet and German units proximate.
> - 1218: Yes: Soviet and German units proximate.
> - All remaining villages: No; 0921 because no Soviet unit proximate; 0918 and 0817 because adjacent to German unit; all others because German proximity and supply are blocked.

<!-- p45 -->

#### 15.11 Garrison Front Event

The **Garrison Front event** uses the same Garrison Placement Process with two additional requirements:

- The placement hex is targeted for the front named in the event and is within the current operational limit for that front;
- If the placement hex is a village and is not in Soviet support, a Soviet unit **in the named front** must be proximate to the placement hex.

### 15.2 Properties of Soviet Garrisons

Garrisons are not units; they do not move, attack, defend, retreat or advance after combat. They have no effect on Soviet movement. A garrisoned hex does not negate German ZOCs when tracing Soviet supply. A garrison blocks the tracing of German supply through its hex.

#### 15.21 Garrison Provisional Zones of Control

A garrison not adjacent to a German unit exerts a zone of control affecting the tracing of German supply at these specific moments during play:

- During Step 1 of the Supply Phase when placing garrisons;
- During the End of Turn Phase, when checking for garrison removal.
- During resolution of the Soviet **Garrison Front** event.

#### 15.22 Effects of Garrisons on German Proximity, Movement and Deployment

A German unit must stop its movement or advance (but not its retreat) upon entering a hex adjacent to a Soviet garrison. German units do not attack garrisons. A German reserve unit can’t be placed in a hex with a Soviet garrison, but may be placed in an adjacent hex. Proximity of a German unit to a given hex or unit can’t be traced through a hex occupied by or adjacent to a garrison marker unless that German unit is adjacent to the garrison. A German unit can retreat into a garrisoned village hex; remove the garrison upon doing so.

### 15.3 Removal of Garrisons

During the End of Turn Phase, if either German **OR** Soviet supply cannot be traced to a Garrison marker in a village hex, remove the marker. When making this check, other garrisons not adjacent to German units possess zones of control. Garrison markers are not removed from VP hexes at this time.

Garrison markers are also removed when:

- a supplied undispersed German unit begins its activation adjacent to the marker;
- a Soviet unit ends its move, advance or retreat in the marker’s hex;
- a Soviet reserve unit is placed in the marker’s hex;
- a German unit retreats into the marker’s hex.

## 16. REPLACEMENTS [GT 3+]

Starting on Game-turn 3 for the Germans and Game-turn 6 for the Soviets, units may receive replacements to enable reduced one-step units on the map to regain a step, or to transfer eliminated units in the eliminated units box to the reserve units box on their one-step side.

You may play a German card listing a replacement command valid on the current game-turn during your impulse to rebuild lost German unit steps in the named corps via replacements. Playing a command card for replacements counts as your card play for the impulse but is not considered a unit activation.

In a Soviet impulse, conduct the command card’s replacement command if valid on the current game-turn and the card’s army has a one-step unit on the map or a unit in the Eliminated Units box.

### 16.1 Replacing Lost Steps

The replacement command lists a number of replacement steps that may be replaced in the named formation per card play; 1 or 2 for the Germans, always 1 for the Soviets. Assign replacement steps to units in the formation up to but not exceeding the replacement steps listed on the card. Unused replacement steps are lost if not assigned in the impulse received.

German replacement steps are assigned to units in the named corps in the following priority order:
1. Reduced one-step infantry units on the map. If steps remain after all such units have received a step …
2. Infantry units in the eliminated units box.
3. Reduced one-step mech units on the map.
4. Mech units in the eliminated units box.

A Soviet replacement step is assigned to a unit in the named army in the following priority order:
1. Non-mech unit in the eliminated units box;
2. Reduced one-step non-mech units on the map;
3. Mech unit in the eliminated units box;
4. Reduced one-step mech units on the map.

Within a given priority …

- assign to a German unit of your choice;
- assign to a Soviet unit with the lowest selector.

**On-Map Unit:** To assign a replacement step to a unit on the map, flip the unit from its one-step side to its two step side.

**Eliminated Unit:** To assign a replacement step to an eliminated unit, take the unit from the eliminated units box and place it in the reserve units box, with its one-step side face up.

### 16.2 Replacement Restrictions

The following units are **not** eligible to receive replacements:

- a unit on the map with two or more steps;
- a unit consisting of only one step at full strength;
- a unit in a stack with six steps;
- a unit in the reserve units box;
- a destroyed unit;
- a Soviet unit in a hex outside Soviet support.

#### 16.21 Supply Requirements

An on-map unit must be in supply and able to trace supply in order to receive replacements. Additionally, a Soviet unit must be able to trace reserve supply. The unit may be in an enemy-controlled hex and may be dispersed.

> **[Exemple p45]**
>
> **Example:** You play the XL Panzer Corps command card to assign two replacement steps to units in XL Panzer Corps. A reduced unit of the 333rd infantry division is on the map and must be flipped first.
>
> There are no other reduced or eliminated units of the 333rd (the only non-mechanized formation in the XL Panzer), and there are no one-step mechanized units on the map either.
>
> However, the reduced Wes.Wik.**XL** unit of the Viking Division is in the eliminated units box. This is eligible to be moved to the reserve units box at the cost of 1 replacement point. The unit remains reduced but is now available as a reserve.

<!-- p46 -->

## 17. VICTORY CONDITIONS

Victory is determined by the number of Victory Points (VPs) earned by the Soviet side. The German side does not earn VPs.

### 17.1 Soviet Victory Points

The Soviets start the game with **two** Victory Points; credit for the two town hexes on the Soviet side of the initial front line. As the Soviets gain and lose Victory Points, adjust the VP markers on the VP track to show the current total. Two markers, one for single VPs and one for VPs x10, allows from 0 to 99 VPs to be recorded.

VPS FOR OWNING TOWN AND CITY HEXES: The Soviets gain and lose the listed VPs for owning town and city hexes. The moment a Soviet unit enters a German-owned town or city hex, that hex becomes Soviet-owned and the Soviets gain the VPs listed, and retains those VPs even if Soviet units leave the hex. If a German unit subsequently enters a Soviet owned VP hex, the Soviets lose the VPs.

MAP EDGE VP HEXES: Four hexes on the east and south map edges are marked with VP values. Unlike towns and cities, these hexes are not owned by either side. The Soviets gain the listed VPs when a Soviet unit occupies the hex and **is able to trace supply**. The Soviets lose those VPs if the hex becomes unoccupied by Soviet units, or if during a subsequent supply phase, the Soviet units in that hex cannot trace supply.

### 17.2 Winning the Game

The scenario instructions in Section 18 state when to conduct victory checks and the number of VPs that result in a German victory, as well as the level of that outcome.

### 17.3 Interpretation of Victory Levels

Levels of victory reflect the historical outcome.

GERMAN STRATEGIC VICTORY: Operations Star and Gallop fail to create meaningful breakthroughs. German counterattacks swiftly retake Soviet gains, destroying two Soviet fronts in the process.

GERMAN OPERATIONAL VICTORY (historical result): After a major Soviet breakout, Army Group South regroups and counterattacks, destroying Soviet spearheads and retaking most ground lost.

GERMAN TACTICAL VICTORY: Battered but not broken, the German forces give ground then manage to re-establish a viable defensive front.

GERMAN TACTICAL DEFEAT: Although falling short of strategic objectives, the Soviets gain and hold key ground, forcing German withdrawal from the Crimea.

GERMAN OPERATIONAL DEFEAT: Star and Gallop succeed in taking Kharkov and holding Soviet initiative in southern Russia. There will be no major German 1943 offensive in the east.

GERMAN STRATEGIC DEFEAT: Army Group South is shattered; its remnants trapped to the south and east will be destroyed. The way is open for the Soviet juggernaut to sweep west.

## 18. SCENARIOS

### 18.1 The Initial Assault

GAME DURATION: Game Turns 1 and 2

SETUP: Per Section 3.

EARLY GERMAN LOSS: The scenario ends in an immediate German Operational Defeat if the Soviets own Kharkov **and** a Soviet unit occupies a hex south or west of the printed Soviet western support line.

VICTORY CONDITIONS: If you do not suffer an early loss, determine victory at the end of Game-Turn 2.

| Soviet VPs | Victory level |
|---|---|
| 9 or more | German Tactical Defeat |
| 8 or fewer | German Tactical Victory |

### 18.2 Operations Star and Gallop

GAME DURATION: Game Turns 1-6

SETUP: Per Section 3.

EARLY GERMAN LOSS: The scenario ends in a German strategic defeat immediately upon the Soviet VP level reaching or exceeding 26 VP.

VICTORY CONDITIONS: If you do not suffer an early loss, determine victory in the Game-Turn 6 End of Turn Phase.

| Soviet VPs | Victory level |
|---|---|
| 24-25 | German Operational Defeat |
| 21-23 | German Tactical Defeat |
| 18-20 | German Tactical Victory |
| 15-17 | German Operational Victory |
| 14 or fewer | German Strategic Victory |

### 18.3 The Campaign Game

#### 18.31 Game Duration

Game Turns 1-14, if not decided earlier. Due to the spring thaw, muddy ground conditions may limit operations on Game-turns 7-13

#### 18.32 Setup

Per Section 3.

#### 18.33 Ground Condition Markers

On game-turns 7 through 13, the ground conditions vary randomly from frozen to light mud to heavy mud, based on the ground condition marker revealed that turn. Set up and reveal ground condition markers as follows:

- [GT 6] During the End of Turn Phase of Game-Turn 6, mix together face down the five ground condition markers. Place four of the markers face down on the calendar spaces for Game-turns 7-10 and place the fifth marker aside, unseen.
- [GT 6-12] During the End of Turn Phase of Game-Turns 6-12 reveal the ground condition marker for the next turn. For example, reveal the marker for GT 8 at the end of GT 7.
- [GT 10] During the End of Turn Phase of Game-Turn 10, gather up the five ground condition markers. Mix together **four** of the markers face-down, setting aside one frozen marker. Place three of the mixed markers face down on the calendar spaces for Game-turns 11,12 and 13, and place the fourth marker aside unseen (resulting in two markers set aside; one frozen and one unseen).
- [GT 14] The ground condition is frozen on Game-Turn 14; do not place a ground condition marker.

<!-- p47 -->

#### 18.34 Ground Condition Effects

The effects of the ground condition shown on the marker for a given game-turn apply throughout the turn.

**Frozen.** No effect; conduct the game turn as normal.

**Light Mud.** Conduct the game turn with the following adjustments:

- During the card preparation phase, deal four supplemental cards to your draw pile instead of seven.
- Units moving across minor river and Donets river hexsides use the Light Mud movement costs shown on the Terrain Effects Chart.
- German units can’t conduct strategic movement.
- The maximum combat chit draw may not exceed six chits, regardless of the number of units attacking and combat tactics played.
- When instructed to return a drawn Soviet card to the Soviet draw pile, discard the card instead.

**Heavy Mud.** Cards are not played and formations are not activated this game-turn. The sequence of play is limited as follows:

**I. RESERVE PHASE:** Conduct as in the normal Sequence of Play.

**II. CARD PREPARATION PHASE:** Conduct German card preparation step 3 of this phase only. If this is Game Turn 7, remove the Soviet STAVKA card permanently from play.

**III. SUPPLY PHASE:** Skip this phase. Except do remove OOS and Isolated markers from units able to trace supply.

**IV. COMMAND PHASE:** Skip this phase. Instead each side receives two infantry replacement steps. Assign your steps to eligible German infantry units. Assign one Soviet infantry step to a unit in each Front. Use the priorities of 16.1.

**V. END OF TURN PHASE:** Conduct as in the normal sequence of play, except do not check for victory.

#### 18.35 Victory Conditions

The game can end in German victory or defeat at the end of any game-turn beginning with Game Turn 4 if the number of Soviet VPs is sufficiently high or low. At the end of each game-turn, beginning Game Turn 4, compare the current number of Soviet VPs to the Victory Levels shown for the current game-turn on the calendar.

- If the number of VPs exceeds the value listed for a German defeat, the game immediately ends in a German defeat of the level listed.
- If the number of VPs is less than the value listed for a German victory and Kharkov is German-owned, the game ends in a German victory of the level listed.
- If the number of VPs equals or falls between the two values or Kharkov is Soviet-owned, the game continues.

If the game ends on Game-Turn 14 with the VP level indicating a German victory but Kharkov is Soviet-owned, the game ends in a draw.

<!-- p48 -->

## SET-UP ADJUSTMENTS (German Solo Game)

> ⚠ The new hex locations of the “boxed units” and which Soviet/German units lose steps are shown **only on the diagrams** of PDF pages 48-50 – not transcribed here.

The instructions and diagrams on these three pages are for your use when setting up the German Solo game. After placing counters on the map and preparing the cards as described in Section 3 of this rule book, you will refer to one of the five diagrams here to adjust the placement and status of specified units on the map and discard specified Soviet cards, to reflect the outcome of the Soviet initial assault.

Roll the die and select the set-up adjustment depiction corresponding to the die result. Optional: Instead of rolling the die simply choose one of the five set-up adjustments. The selected depiction and its accompanying text explain adjustments to be made. These may include:

- Changing the hex location of units.
- Placing units from the Soviet reserve box on the map.
- Removing steps from units.
- Placing Dispersed markers on units.
- Eliminating German units.
- Placing both Soviet Front Objective markers on the map.
- Adjusting Soviet victory points.
- Placing Soviet cards in the Soviet discard box.

Follow the instructions with the selected depiction in their entirety. When completed, the situation on the map should match that in the depiction. Note that units in partially-depicted hexes in the diagrams are not shown. Such units remain where initially placed.

After making all adjustments, shuffle together the remaining initial Soviet cards and place them face down in the Soviet Draw Deck box. These set-up adjustments take the place of the first Soviet Impulse of Game-turn 1. Start the game with the first German Impulse of the Command Phase of Game-turn 1.

### Die Result 1,2: Raus Overrun

- Place Raus units 586/320 & 587/320 in the German Eliminated Units Box.
- Adjust the hex locations of nine boxed units as shown. **[Errata]** The two German units that start in hexes 1903 and 1904 should be shown in those hexes.
- Remove a step and place a dispersed marker on Raus unit 585/320.
- Remove one step each from the three Soviet units shown.
- Place the two Popov reserve units for Turn 1 in hex 1504.
- Place the Voronezh Front Objective West marker in Chuguev (hex 1008) and the Southwest Front Objective West marker in hex 1608 (not shown). **[Errata]** The town of Chuguev is in hex 1009, not 1008.
- Place Soviet cards e03, e11, e17 and e20 in the Soviet discard pile.

**Report:** Mobile Group Popov (e17) attacks 1402 with Assault Coordination (e07, returned to deck) and also attacks 1503 with Airpower (e20). Next, 6th Army (auxiliary card e11) attacks 1203 with a Tank Brigade (e03). All attacks use artillery barrage.

<!-- p49 -->

### Die Result 3,4: Slavyansk Liberated

- Place unit 587/320/Raus in the German Eliminated Units Box.
- Adjust the hex locations of the six boxed units as shown.
- Place three reserve units: 38G/1G in 1702 reduced; 41G/Popov in 1502; 18/Popov in 1602.
- Remove two steps from 10/Popov
- Remove a step and place a dispersed marker on 27/19P/III.
- Place the Voronezh Front Objective West marker in Zmiyev (hex 1210) and the Southwest Front Objective West marker in hex 1906 (not shown).
- Set Soviet Victory Points to 4.
- Place Soviet cards e01, e02, e05 and e22 in the Soviet discard pile.

**Report:** 1st Guards Army (e01) attacks 1802 with Reinforce Battle (e05). Next STAVKA (auxiliary card e22) commands Mobile Group Popov and stacked units. They overwhelm 1503 and also attack 1802 again with airpower and partisans (e02). All attacks use artillery barrage.

### Die Result 5,6: Bloody Izyum (historical start)

- Place 587/320/Raus in the German Eliminated Units Box.
- Adjust the hex locations of the five boxed units as shown. **[Errata]** The German unit in hex 1604 should be unit 387-/III (reduced). The three German units that start in hex 2001 should be shown in that hex.
- Place the two Popov reserve units for Turn 1 in hex 1403 and 1603.
- Remove one step each from the four Soviet units and three German units shown
- Place a dispersed marker on unit 586/320/Raus.
- Place the Voronezh Front Objective South marker in Volchansk (hex 0608) and the Southwest Front Objective South marker in hex 1410 (not shown).
- Place Soviet cards e03, e08, e12, e17 and e20 in the Soviet discard pile.

**Report:** Mobile Group Popov (e17) overwhelms 1503 and also attacks 1402 with redundant artillery (e12). The Southwest Front (auxiliary card e20) activates Popov again with stacked units for three attacks: 1403 with a tank brigade (e03), Slavyansk with reinforce battle (e10, returned to deck) and Izyum with airpower (e08). All attacks use artillery barrage.

<!-- p50 -->

### Die Result 7,8: Voronezh Front Breakout

- Place 429/168/Raus and Fus/GD/XLVIII in the German Eliminated Units Box.
- Adjust the hex locations of the eleven boxed units as shown.
- Place the 40th Army reserve unit for Turn 1 in hex 0205.
- Remove one step each from the three Soviet units shown.
- Remove a step and place a dispersed marker on Gre/GD/XLVIII. Place a dispersed marker on 417/168/Raus.
- Place the Voronezh Front Objective West marker in Chuguev (hex 1008) and the Southwest Front Objective West marker in hex 1410 (not shown). **[Errata, same error as Raus Overrun — confirmed by dev 2026-10-08]** The town of Chuguev is in hex 1009, not 1008.
- Place Soviet cards e04, e05, e11, e19 and e22 in the Soviet discard pile.

**Report:** 40th Army (e04) attacks 0205 with STAVKA’s combat tactics (e22). Then 3rd Tank Army (auxiliary card e05) attacks 0604 with NKVD (e19) and 0803 with no tactic (e11 gives additional combat chit). All attacks use artillery barrage.

### Die Result 9,10: Drive on the Donets

- Place Gre/GD/XLVIII in the German Eliminated Units Box.
- Adjust the hex locations of the eleven boxed units as shown.
- Remove one step each from the two Soviet units shown
- Remove a step and place a dispersed marker on German unit 298/ LVII.
- Place the Voronezh Front Objective West marker in Zmiyev (hex 1210) and the Southwest Front Objective West marker in hex 1608 (not shown).
- Place Soviet cards e03, e05, e19 and e20 in the Soviet discard pile.

**Report:** 3rd Tank Army (e05) attacks 1003 with NKVD (e19) and a tank brigade (e03), and then attacks 0803 with airpower (e20). All attacks use artillery barrage.

<!-- p51 -->

## TOWN AND CITY GAZETTEER

| Town / City | Hex |
|---|---|
| Akhtyrka | 0720 |
| Belgorod | 0311 |
| Chuguev | 1009 |
| Dnepropetrovsk | 2518 |
| Dniprodzerzhynsk | 2520 |
| Gotnya | 0215 |
| Izyum | 1604 |
| Kharkov | 0912 |
| Kramatorsk | 2102 |
| Krasnoarmiysk | 2404 |
| Krasnograd | 1615 |
| Kupiansk | 1103 |
| Lozovaya | 1910 |
| Pavlograd | 2412 |
| Poltava | 1421 |
| Pryadovka | 2120 |
| Sinelnikowo | 2615 |
| Slavyansk | 1802 |
| Sumy | 0322 |
| Valky | 1116 |
| Valuyki | 0302 |
| Volchansk | 0608 |
| Zaporozhe | 3116 |
| Zmiyev | 1311 |

<!-- p52 -->

## SEQUENCE OF PLAY SUMMARY (back cover, 4.0)

**I. RESERVE PHASE** [GT 2+] Take units from the current turn space and place them in their reserve boxes. [GT 3+] Deploy delayed German reserves (7.3).

**II. CARD PREPARATION PHASE** [GT 2+] Prepare German cards & draw your initial hand:
1. Place this turn’s Primary reinforcement cards face down in Draw pile; place Supplemental reinforcement cards face down in Available Supplemental Card pile.
2. Shuffle Available Supplemental Cards. Deal quantity indicated for this turn and place face down in Draw Pile.
3. Place last turn’s Supplemental Discards face down in Available Supplemental Card pile.
4. Place last turn’s Primary Discards face down in Draw pile.
5. Shuffle Draw pile and draw your initial hand per this turn’s hand size limit.

Shuffle Soviet Deck to form Soviet draw pile, including reinforcement cards entering this turn.

**III. SUPPLY PHASE** [GT 2+]
1. [GT 4+] Place garrisons in eligible Soviet VP and village hexes (15.1).
2. Determine supply status of German units, then [GT 4+] Soviet units (13.0). Remove Out of Supply and Isolated markers from units in supply.
3. Place Out of Supply markers on unsupplied units. If already OOS, place Isolated marker. If already isolated, check for surrender (13.23).
4. [GT 8+] Check VPs to determine Soviet support line use (13.5).
5. [GT 7] Check for front objective removal (9.12).

**IV. COMMAND PHASE** Conduct alternating impulses. Soviets first.

**SOVIET IMPULSE** Draw two Soviet cards. Place one card in Command Card Box by preference: a) Primary card; b) higher Command Rating; c) lower card ID. Place other card in Auxiliary Card box.

- If Auxiliary card has valid Command Event (not Special Event), implement and discard.

Conduct the 1st listed command on the Command card that applies. Commands may include:
- Special event or command event.
- [GT 6+] Assign replacements.
- Activate units in specified formation and conduct these steps:
1. Check formation’s objective marker for relocation.
2. Move active on-map units.
3. Conduct attack checks and attacks with active units. For each non-overwhelming attack: add eligible active reserve units; if attack is in Soviet support draw card as combat tactic; and check to apply auxiliary card’s combat tactic. You may play German cards as combat tactics in response to Soviet attacks.
4. [GT 4+] Place eligible active reserve units on the map.
5. [GT 2+] Remove eligible active units to Reserve box.
6. [GT 4+] Place IP marker on one eligible active unit.
7. Remove Dispersed markers from active units (12.9).

After completing command, discard command card. Then, if there’s an Auxiliary Card, move it to Command Card box and conduct another command. If no card in Auxiliary Card box, Soviet impulse is over.

**GERMAN IMPULSE** Play one card to initiate ONE command listed on the card:

- Activate all units in specified formation.
- Activate a Kampfgruppe if specified on card (6.2).
- Once per turn, activate 1 unit able to trace supply regardless of formation (6.1). It can’t attack.
- Deploy reserve units in specified formation (7.1).
- [GT 3+] Assign replacements to units in specified formation (16.1).
- Implement command event or special event on card.

You can’t activate a unit or formation that was activated in immediately preceding German impulse (6.3).

If conducting activation command, do so in this order:
1. [GT 4+] Soviet Garrison removal.
2. Movement
3. Attacks. You may play cards as combat tactics.
4. Place IP markers.
5. Remove Dispersed markers.

You may pass if German draw pile empty and just 1 card in hand. After completing a command, draw cards to up to your hand size limit, then begin Soviet impulse.

Repeat Soviet and German impulses. When one side runs out of cards, the other side takes consecutive impulses, until both sides’ draw piles and your hand are all exhausted, ending the game-turn.

**V. END OF TURN PHASE**

- [GT 4+] Check victory levels in current turn space (17.2).
- Return all combat chits to cup.
- Remove Dispersed and Forward Support markers.
- [GT 4+] Check Garrison markers in villages for removal (15.3).
- [GT 7] Remove all Soviet objective markers from play.
- Advance turn marker on the calendar and start next turn.

**[GT 7-13] HEAVY MUD GAME-TURN SEQUENCE OF PLAY**

I. RESERVE PHASE. As in standard SOP.

II. CARD PREPARATION PHASE. Conduct step 3 only.

III. SUPPLY PHASE: Skip entirely. Except remove OOS and isolated markers from units now in supply.

IV. COMMAND PHASE. Skip entirely. Instead assign each side two infantry replacement steps, per 16.1 and 18.34.

V. END OF TURN PHASE. As in SOP, but no Victory check.

<!-- errata sheet (assets/scans/errata.jpg) -->

## ERRATA (German Solo)

Official errata, also inserted inline as **[Errata]** at the end of the affected lines.

### GS Rules

- Page 11, **Example of German Corps Activation by Army Card**: Last sentence should read “IISS and Corps Raus are in 4th Panzer Army for command purposes but only the LVII Panzer Corps is activated.” (→ L486)
- Page 16, **9.21 Soviet Movement Methods A**. These movement methods are used throughout Game-turns 1-4 even if the Front objective marker has been removed from play. (→ L785)
- Page 48, ***Raus Overrun***: The town of Chuguev is in hex 1009, not 1008. The two German units that start in hexes 1903 and 1904 should be shown in those hexes. (→ L2577, L2581)
- Page 49, ***Bloody Izyum***: The German unit in hex 1604 should be unit 387-/III (reduced). The three German units that start in hex 2001 should be shown in that hex. (→ L2604)

### GS Player Aids

- **Soviet Activation Step 2, Method 3 Open Supply Line**: Applies on Game Turn 3 and after. (Rulebook 9.21 method 3 at L799 already reads [GT 3+].)
- **Soviet Activation Step 3**, first bullet after chart should begin “Attack if ≥ 3:1 or ...” (Rulebook 9.4 at L1190 already reads “equal to or greater than 3:1”.)
