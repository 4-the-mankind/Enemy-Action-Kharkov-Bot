---
name: golden-test
description: Transforme un exemple du livret (encadré « [Exemple pN] » de docs/rules-german-solo.md, schéma dans docs/pN.png) en test de référence du moteur dans tests/engine/booklet-examples.test.ts. À utiliser quand le dev demande un test de référence, un « golden test », ou fournit la capture d'un exemple du livret.
---

# golden-test — un exemple du livret devient un test de référence

Argument : le numéro de page de l'exemple (ex. `/golden-test p41`). Suivre `CLAUDE.md` en tout (discussion en français, termes du jeu en anglais, questions au format prescrit, **rien d'édité sans le go du dev**).

## 1. Lire l'exemple

- Trouver `> **[Exemple pN]**` dans `docs/rules-german-solo.md` (index en tête, lecture par offset/limit) et la section de règle qu'il illustre.
- Noter le **résultat attendu** : décisions, ordre, méthodes, préférences, départages, raisons de refus. Le texte peut continuer après un `<!-- pN -->`.
- Pas de capture `docs/pN.png` : la demander au dev.

## 2. Lire l'image

- Le numéro d'une case est imprimé **en haut** de la case. Les colonnes paires sont décalées d'une demi-case vers le bas et n'ont que **22 rangées** (pas de `1223`) ; les rangées croissent vers l'ouest (bas de l'image).
- Identifier chaque pion dans `data/units.json` (désignation, valeurs `force-sélecteur-MP`) et sa **face** : valeurs du recto (`front`), de `reducedFace` (`reduced`) ou de `backFace` (`back`). Un « R » ou une bande pâle signale une face réduite ou le verso.
- Marqueurs : « SOVIET GARRISON » = garnison ; carré rose à étoile rouge **sans texte** = marqueur de contrôle soviétique (Q106), pas une garnison. Les « Soviet Unit » anonymes : n'importe quelles unités soviétiques.
- Lire aussi : tour, VP, carte jouée (Command Value), objectifs, unités ayant bougé ou attaqué, boîte de réserve, garnisons déjà posées.
- Vérifier la lecture contre le texte (cases citées, adjacences). Soumettre la position au dev en tableau avant d'écrire le test.

## 3. Hors de l'image (décisions du dev, 2026-10-19)

Ce qui n'est pas sur l'image **n'existe pas**. Une carte réduite à la zone du schéma est pire (ravitaillement, distances) : garder la vraie carte. Mais le bot cherche sur toute la carte, d'où :

- **Exemples où le bot décide** (mouvement, attaques, réserves, retraits) : toute case VP hors vue est soviétique et tenue par des unités du **front inactif**, 2 steps (3 à Kharkov 0912) — `heldVpHexes(inView, taken, inactive)`.
- **Sinon** (mouvement allemand, garnisons) : pas d'unités qui tiendraient ces cases (elles seraient proximate). Les rendre soviétiques sans unité si le ravitaillement soviétique en dépend (13.1 : une town/city allemande coupe les routes) — `vpHexesOutOf(inView)` dans `sovietTowns` (Q110), ou les laisser telles quelles.
- Une case en bord d'image dont le résultat dépend du hors-vue : ne pas la vérifier, avec un commentaire (Q109). Ne jamais inventer un pion sans l'accord du dev.

## 4. Lancer le moteur

| Exemple | Appel | À lire |
|---|---|---|
| Mouvement soviétique (9.21, 9.22) | `engine.step(state, { type: "ActivateFormation", army })` | `DecisionTraced` (method, steps, skipped), `FormationActivated` |
| Étapes 3-7 d'une activation (9.4, 12.2, 9.5, 9.6, 9.7) | `engine.sovietActivations.resume(state, activation(units, {...}), null)` ; boucle avec `settleCombat` tant que `pending` | `AttackChecked`, `SovietAttackDeclared`, `ReservePlaced`, `RemovalChecked` |
| Mouvement allemand (10.x) | `engine.germanMoves.reach(state, id).hexes`, `engine.movement.walk` / `reachable` / `path` | coût, `strategic` |
| Supply Phase (13, 15) | `engine.step(state, { type: "SupplyPhase" })` | `GarrisonsPlaced.checks` |

Pour reprendre une activation après ses attaques : toutes les cases allemandes dans `checked`. Unités qui ont bougé : `moved`. Activation d'un autre front : `army` et `front` dans `activation(...)`.

## 5. Explorer, puis classer les écarts

- Essai dans `tests/scratch/pN.test.ts` (écrire les événements dans un fichier JSON : la console de vitest est masquée), à supprimer ensuite.
- Pour chaque écart avec le livret, trouver la cause avant de proposer quoi que ce soit :
  1. **erreur de lecture** de l'image → corriger et revérifier ;
  2. **erreur de carte** (`data/map-hexes.json`, `map-hexsides.json`) → question au dev, qui corrige souvent lui-même dans le Map painter ;
  3. **effet du hors-vue** → appliquer §3 ou poser la question ;
  4. **livret approximatif** (explication contredite par une règle explicite, résultat identique) → question au dev ; jusqu'ici il a toujours gardé le moteur (Q103-Q105).
- Un vrai bug du moteur se corrige dans une tâche à part, avec le go du dev.

## 6. Écrire le test

- Un `describe("Booklet example pN: … (règle, reference test)")` dans `tests/engine/booklet-examples.test.ts`, avec les aides `position`, `heldVpHexes`, `vpHexesOutOf`, `traceOf`.
- Vérifier le résultat **et** sa justification : destinations et ordre, méthode, préférence ou départage qui tranche (`steps.at(-1)`), raisons des refus avec `msg(clé)` (jamais la formulation).
- Chaque hypothèse ou écart accepté : commentaire citant la question (`// Q105: …`).
- Lancer toute la suite et `npx tsc --noEmit -p .` (préfixe `source ~/.nvm/nvm.sh &&`).

## 7. Clore

- `PLANNING.md` : position et résultat dans la tâche, questions en §6 (forme courte, recommandation), journal.
- Résumé au dev : position lue, ce que le test vérifie, écarts, questions. Commit seulement sur demande.
