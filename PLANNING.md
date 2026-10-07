# PLANNING — EA Kharkov Bot

Fichier de pilotage du projet, lu par l'IA en début de session et tenu à jour au fil de l'eau.

**Statuts** : `[ ]` à faire · `[~]` en cours · `[x]` fait · `[!]` bloqué (raison indiquée).
**Responsable** : `IA` / `Dev` (le développeur humain) / `IA+Dev`.
**Charge IA** : léger · moyen · lourd.

Mise à jour : 2026-10-05.

---

## 1. Objectif

Automatiser le bot soviétique (« paper AI ») d'*Enemy Action: Kharkov – German Solo*. Le joueur joue les Allemands sur le plateau réel et indique à l'application ce qui s'est passé. L'application applique la procédure soviétique et **affiche sur la carte** les déplacements et actions du bot, avec un **journal expliquant chaque décision**.

- Court terme : **POC en 2-3 soirées** (voir §4, jalon M1).
- Long terme : application web installable sur téléphone (**PWA**), sans serveur.

---

## 2. Décisions

### Validées par le dev

| #   | Décision                                                                                                                                                                                                                                                                                                              | Date       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| D1  | Les règles se lisent dans `docs/rules-german-solo.md` (index par numéro de ligne), pas dans le PDF.                                                                                                                                                                                                                   | 2026-10-03 |
| D2  | Carte = image **PNG** haute résolution en fond, sous une **grille générée** par le programme (précisé par D9 : c'est la PNG qui est calée sur la grille).                                                                                                                                                             | 2026-10-03 |
| D3  | Un clic sur la carte renvoie le **numéro de case**, ou le **côté de case** si on clique près d'un bord.                                                                                                                                                                                                               | 2026-10-03 |
| D4  | Numérotation des cases `CCRR` : `CC` = colonne, `RR` = ligne ; la toute première case est **0101** (1re colonne, 1re ligne), pas 0001. La première est dans le coin haut à gauche.                                                                                                                                    | 2026-10-03 |
| D5  | La carte n'est pas un rectangle : le dev **peint les cases mortes** (non jouables).                                                                                                                                                                                                                                   | 2026-10-03 |
| D6  | Données au format **JSON**.                                                                                                                                                                                                                                                                                           | 2026-10-03 |
| D7  | Projet sous **git** (dépôt initialisé).                                                                                                                                                                                                                                                                               | 2026-10-03 |
| D8  | **Tests de référence** : les exemples chiffrés du livret (p17, 18, 19, 24, 25, 32, 44…) sont rejoués et le résultat doit être identique au livre.                                                                                                                                                                     | 2026-10-03 |
| D9  | Grille de **lignes** (verticales, horizontales, 2 diagonales) : un **centre de case = croisement des 4 lignes** ; les croisements de 2 lignes ne représentent rien. La grille est la référence, la PNG est calée **dessous en CSS** (position, taille). L'image d'une unité est **centrée sur le centre de sa case**. | 2026-10-04 |
| D10 | Les **images des pions sont déjà séparées** (une image par pion) : aucun découpage de planche à faire.                                                                                                                                                                                                                | 2026-10-04 |

### Proposées par défaut (non contestées ; le dev peut les remettre en cause)

| #   | Proposition                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Moteur de décision **codé et déterministe** (pas un LLM). Chaque décision est tracée : méthode, préférence et départage utilisés. |
| P2  | Stack : **TypeScript + Vite**, carte en **SVG** par-dessus la PNG, tests **Vitest**. Tout tourne dans le navigateur.              |
| P3  | **Paquet soviétique virtuel** : l'application tire les cartes E01-E22. Les cartes allemandes restent physiques.                   |
| P4  | POC : le dev **saisit les résultats de combat** ; la simulation des jetons de combat vient plus tard.                             |
| P5  | Parties sauvegardées dans un fichier log JSON, en phase 5.                                                                        |
| P6  | Modèle, effort, plugins et règles d'économie de tokens : voir §7.                                                                 |

---

## 3. Conventions de données

- **Case** : `"CCRR"` (chaîne de 4 chiffres). Voisinage et distances calculés par le code à partir de la grille.
- **Côté de case** : paire des deux cases triées, `"0912-0913"`. Pour un bord de carte, l'autre case peut être hors grille ou morte.
- **Orientation géographique (hypothèse à vérifier sur la PNG)** : d'après le livret (15.1 : numéros décroissants = du sud au nord, puis d'ouest en est ; Zaporozhe 3116 au sud ; Valuyki 0302 à l'est ; le joueur s'assoit côté ouest), `CC` augmente vers le **sud** et `RR` vers l'**ouest**. Cela compte pour les départages « le plus à l'ouest/est » et pour la direction W/S des marqueurs d'objectif.
- **Arborescence du projet** :
  ```
  index.html                      accueil (liens vers les outils)
  src/core/                       logique pure, partagée et testée (geometry.ts, map-grid.ts)
  src/ui/                         styles communs (theme.css : feldgrau)
  src/tools/<outil>/              un dossier par outil : index.html, main.ts, style.css
  src/tools/map-calibration/      outil de calage de la carte (1.1)
  server/                         API locale du serveur de dev (map-api.ts : lecture/écriture data/, import d'images)
  tests/core/                     tests Vitest, même découpage que src/
  data/                           données JSON (voir ci-dessous)
  assets/                         images : map/, counters/, cards/
  docs/                           règles en Markdown
  ```
- **Fichiers prévus** (dossier `data/`) :
  - `map-grid.json` : grille de référence (D9) : orientation des hexagones, origine (centre de 0101 dans le repère de la grille), écart entre deux colonnes et entre deux lignes, sens du décalage des colonnes (`evenColumnShift`), colonnes paires « rentrées » avec une case de moins (`evenColumnShorter`, cas de la carte de Kharkov), nombre de colonnes et de lignes ; calage de la PNG sous la grille en CSS (`background-position`, `background-size` en largeur et hauteur).
    - Géométrie (hexagones côté plat en haut ; pointe en haut = rôles des verticales et horizontales inversés) : une verticale par colonne ; horizontales espacées d'une **demi-ligne** (les colonnes décalées tombent à mi-chemin) ; diagonales passant par les centres (±30° pour des hexagones réguliers). Les seuls croisements parasites sont vertical × horizontal (2 lignes) : diagonale × diagonale, diagonale × verticale et diagonale × horizontale tombent toujours sur un centre.
  - `map-hexes.json` : par case :
    - jouable ou morte ;
    - terrain **en case** : clear, broken, marsh, woods, town, city (+ route et village en overlays indépendants du terrain) ;
    - village (booléen, indépendant du terrain — un village peut coexister avec clear/broken/etc.) ;
    - case VP : valeur 1 à 4 si la case en est une (toutes les town/city, plus 4 cases clear en bord est/sud) ;
    - cible de front, pour les town, city et village : aucune / Voronezh / Southwest / commune aux deux (16.1) — indépendante de la case logistique ci-dessous ;
    - case logistique : aucune / Voronezh (zone jaune) / Southwest (zone rouge) (16.1) — n'importe quelle case, indépendamment de son terrain ou de sa cible de front ;
    - bord de carte : aucun / soviétique / allemand ;
    - **point d'entrée logistique** (`edgeRoad`, booléen) : case où une route sort de la carte — ancre un point de ravitaillement (« supply head ») pour la chaîne de cases-route connectées (13.1). La carte n'étant pas un rectangle (D5), « sortir de la carte » veut dire soit sortir de la grille, soit entrer dans une case morte (D5) : les deux comptent pareil, recalculé dynamiquement à chaque peinture de case morte ;
    - position par rapport aux **3 lignes physiques** (chaque case : à l'est ou à l'ouest de chacune) — une ligne peut avoir plusieurs rôles selon le tour, le moteur choisit le rôle, pas l'éditeur :
      - ligne Est/Artillerie (0107–1901) : zone de bombardement d'artillerie (GT1-2), portée d'artillerie fixe (FAR), devient la **ligne de soutien Est** dès GT8 ;
      - ligne Ouest (0114–2501) : **ligne de soutien Ouest** dès GT5, **limite opérationnelle proche** dès GT6 ;
      - ligne Lointaine (0120–3107) : **limite opérationnelle lointaine** dès GT6 ;

    Pas de zone de déploiement allemande : le joueur incarne le camp allemand et place lui-même ses unités, le moteur n'a pas besoin de la connaître.
  - `map-hexsides.json` : par côté : route, rivière mineure, Donets, Dniepr, Dniepr bloqué (affichage sur le côté de case uniquement, jamais en remplissage de case).
    - **Flèche de mouvement** : portée par le côté de case mais **dirigée** (le déplacement n'est permis que dans un sens, jamais l'inverse) — donc stockée avec `from`/`to` explicites (cases de départ et d'arrivée), en plus du côté de case `"CCRR-CCRR"` (paire triée) qu'elle occupe. Type primaire ou secondaire, et **front obligatoire** (Voronezh / Southwest / commune) — toute flèche imprimée est marquée pour un front, il n'existe pas de flèche commune non marquée (9.21, 2.1).
  - `units.json` : image(s) du pion (`assets/counters/`, D10), désignation, camp, front/armée ou armée/corps, type, pas, force pleine et réduite, mouvement, sélecteur plein et réduit, case de départ ou tour d'entrée, pion « R ».
  - `cards-soviet.json` : ID, valeur de commandement, Primary, tour d'entrée, liste ordonnée des commandes, tactiques.
  - `terrain-effects.json` : coûts de mouvement et effets de combat (tableau des terrains de l'aide de jeu).
  - `scenarios/*.json` : mise en place et ajustements (résultats de dé 1-10).
- **État de partie** : un JSON sérialisable (tour, impulsion, positions, pas, marqueurs, propriété des villes, PV, cartes, objectifs).
- **Positionnement des pions** : l'état de partie et les décisions du bot ne contiennent que des cases (`"at": "0712"`), jamais de pixels. Le centre de la case est calculé depuis la grille (D9) ; l'image du pion y est centrée (`translate(-50%, -50%)`), avec un petit décalage par niveau de pile calculé à l'affichage.

---

## 4. Phases et tâches

### Phase 0 — Fondations

- [x] **0.1** Conversion du livret en `docs/rules-german-solo.md` — IA (Sonnet 5, moyen) — fait
- [x] **0.2** `git init` + `.gitignore` + premier commit — IA (Haiku 4.5, bas) — fait
- [x] **0.3** `PLANNING.md` + `CLAUDE.md` — IA (Sonnet 5, moyen) — fait
- [x] **0.4** Installer Node.js LTS — IA (Haiku 4.5, bas) — fait : v24.21.0 via nvm (dans les commandes de l'IA : `source ~/.nvm/nvm.sh && …`)
- [x] **0.5** Déposer la carte PNG dans `assets/map/` — Dev
- [x] **0.6** Images des pions (déjà séparées, D10) dans `assets/counters/` ; scans : cartes soviétiques E01-E22, aides de jeu (tableau des terrains, événements et tactiques, résumé des activations soviétiques) — Dev
- [x] **0.7** Squelette d'application (Vite + TS + Vitest), structure `src/ data/ tests/` — IA — fait : `npm run dev` (accessible sur le réseau local), `npm test`
- [x] **0.8** Régler la propriété du dossier (voir §6, Q7) — Dev (Haiku 4.5, bas) — fait

### Phase 1 — Carte (POC, soirées 1-2)

- [x] **1.1** Outil de calage (D9) : afficher la grille de lignes, puis régler la PNG dessous en CSS (position, largeur, hauteur) jusqu'à ce que les croisements de 4 lignes tombent au centre des cases imprimées → `map-grid.json`. Un background CSS ne tourne pas : si le scan est de travers, le redresser avant — IA (Sonnet 5, moyen) — fait, calage dev validé (33 × 23, colonnes paires rentrées)
- [x] **1.2** Grille superposée ; au survol et au clic : numéro de case, ou côté de case près d'un bord (D3) — IA (Sonnet 5, moyen) — fait, intégré dans `map-calibration` (pas de nouvel outil) : onglet « Clicks » avec curseur de seuil (`sideThreshold`, enregistré dans `map-grid.json`), survol = case ou côté affiché en continu, clic = fige la sélection avec surbrillance distincte. Nouvelles primitives `src/core/geometry.ts` : `hexNeighbor`, `hexSideId`, `pointerTarget`, testées.
- [x] **1.3** Éditeur à pinceaux : cases mortes, terrain, villages, PV, cibles V/S, logistique, bords de carte, flèches (dirigées, sur côté de case), côtés de case (routes, rivières), lignes ; export JSON ; annuler/refaire — IA (Sonnet 5, moyen) — fait : outil `map-painter` (onglets Hexes/Sides/Display), données dans `data/map-hexes.json` et `data/map-hexsides.json` (schémas `src/core/map-hexes.ts`, `src/core/map-hexsides.ts`, testés). Pas de zone de déploiement allemande (hors scope, cf. §8 2026-10-06).
- [ ] **1.4** (Optionnel) Pré-remplissage du terrain d'après la couleur au centre de chaque case, puis correction au pinceau — IA (Sonnet 5, moyen)
- [ ] **1.5** Calques de debug activables : grille, numéros, terrain, côtés, flèches, cibles, lignes (plus tard : zones de contrôle, portée, ravitaillement) — IA (Sonnet 5, moyen)
- [ ] **1.6** Annoter la **zone de l'exemple p17** (3ᵉ Armée blindée, tour 1, environ les cases 05xx-11xx) — Dev
- [ ] **1.7** Annoter le reste de la carte (peut continuer en parallèle des phases suivantes) — Dev — gros morceau

### Phase 2 — Unités et état (POC, soirée 2)

- [ ] **2.1** Schéma `units.json` ; saisie des unités de l'exemple p17 (3T + Allemands voisins) — IA+Dev (Sonnet 5, moyen)
- [ ] **2.2** État de partie + placement des pions par glisser-déposer sur la carte — IA (Sonnet 5, moyen)
- [ ] **2.3** Extraction des données de toutes les unités depuis les images de pions (déjà séparées, D10), avec un écran de vérification (image du pion à côté de ses données) — IA (sous-agent Sonnet 5, bas à moyen) + Dev (vérification)

### Phase 3 — Moteur POC (soirées 2-3) → jalon **M1 = POC**

- [ ] **3.1** Géométrie : voisins, distance, côtés de case, exception du Dniepr bloqué — IA (Opus 5.5, élevé)
- [ ] **3.2** Mouvement : coûts du tableau des terrains, routes, rivières, zones de contrôle, empilement ; cases atteignables ; « proximate » ; encerclé / presque encerclé — IA (Opus 5.5, élevé)
- [ ] **3.3** Méthodes de mouvement 9.21 (1-12) + restrictions 9.23 + départages 9.24 + préférences tactiques 9.25 + journal des décisions — IA (Opus 5.5, très élevé)
- [ ] **3.4** Test de référence p17 : reproduire exactement les déplacements du livre — IA+Dev (Opus 5.5, élevé)
- [ ] **3.5** Affichage des mouvements du bot sur la carte (flèches) + panneau du journal — IA (Sonnet 5, moyen)

**M1 atteint** quand le test 3.4 passe et que le résultat est visible sur la carte.

### Phase 4 — Bot complet

- [ ] **4.1** Cartes soviétiques en JSON ; choix carte de commandement / auxiliaire (8.1) ; commandes 8.11-8.13 — IA (sous-agent Sonnet 5, bas à moyen)
- [ ] **4.2** Objectifs de front et d'armée (9.1, tables de placement), armées avec objectif (9.26), unités non ravitaillées (9.27) — IA (Opus 5.5, très élevé)
- [ ] **4.3** Ravitaillement (13.1-13.4), soutien (13.5), limite opérationnelle (9.8), méthodes 9.22 — IA (Opus 5.5, élevé)
- [ ] **4.4** Tests d'attaque (9.4), réserves en attaque (12.2) et en placement (9.5), retrait en réserve (9.6), positions améliorées (9.7) — IA (Opus 5.5, très élevé)
- [ ] **4.5** Combat : saisie des résultats, puis côté soviétique : pertes, retraites, avances (12.53, 12.54, 12.7, 12.83) ; simulation des 60 jetons en option (données des jetons à fournir) — IA (Opus 5.5, très élevé)
- [ ] **4.6** Garnisons (15), remplacements (16), événements (aide de jeu), victoire (17-18), boue (18.34) — IA (Opus 5.5, très élevé)
- [ ] **4.7** Mise en place et ajustements (dé 1-10) : le dev relève les positions des schémas p48-50 — IA+Dev (Sonnet 5, moyen)
- [ ] **4.8** Tests de référence p18, p19, p24, p25, p32, p44 — IA+Dev (Opus 5.5, élevé)

### Phase 5 — Jouabilité et PWA

- [ ] **5.1** Saisie du tour allemand : déplacements, attaques, résultats, cartes allemandes jouées — IA (Sonnet 5, moyen)
- [ ] **5.2** Annuler, sauvegarde et reprise de partie (IndexedDB) — IA (Sonnet 5, moyen)
- [ ] **5.3** Interface mobile, manifest et service worker (hors ligne) — IA (Sonnet 5, moyen)

### Phase 6 — Optionnel

- [ ] **6.1** Assistant IA (serveur MCP) qui explique les décisions du bot ou répond aux questions de règles à partir du journal et de `docs/` — IA (Sonnet 5, moyen)

---

## 5. Prérequis à fournir par le dev

- [x] Carte PNG → `assets/map/` (0.5)
- [x] Images des pions, déjà séparées (D10) → `assets/counters/`
- [x] Scans des cartes soviétiques E01-E22 → `assets/cards/`
- [ ] Aides de jeu : tableau des terrains, événements et tactiques, activations soviétiques → `assets/aids/`
- [ ] Positions des schémas d'ajustement de mise en place (p48-50), pour la phase 4.7
- [ ] Réponses aux questions ouvertes (§6)

---

## 6. Questions ouvertes

| #   | Question                                                                                                                                                 | Statut                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Orientation des hexagones (côté plat ou pointe en haut) et colonnes décalées : sera visible sur la PNG.                                                  | **réglée** : côté plat en haut                                                                                                                     |
| Q2  | Orientation géographique de la numérotation (§3) : confirmer sur la PNG.                                                                                 | **réglée** : compréhension correcte ; CC augmente vers le sud, RR vers l'ouest                                                                     |
| Q3  | Combat : jetons et dé physiques avec saisie des résultats, ou simulation complète par l'application ? (Proposition P4 pour le POC.)                      | **réglée** : joueur tire les chits pour le bot ET retraite, avance après combat, hits. P4 confirmée.                                               |
| Q4  | Usage : PC à côté du plateau d'abord, téléphone ensuite ?                                                                                                | **réglée** : PC d'abord, téléphone ensuite                                                                                                         |
| Q5  | Incohérence du livret : Chuguev est en 1009 dans la liste des villes, mais en 1008 dans les ajustements « Raus Overrun » et « Voronezh Front Breakout ». | Dev répond plus tard                                                                                                                               |
| Q6  | Existe-t-il un module VASSAL du jeu ? Il pourrait fournir carte et pions déjà numérisés.                                                                 | **réglée** : oui, module VASSAL existe ; images viennent de VASSAL                                                                                 |
| Q7  | Le dossier appartenait à l'utilisateur `claude` et git refusait de travailler.                                                                           | réglée : propriétaire changé (2026-10-03)                                                                                                          |
| Q8  | Images des pions : les versos (face réduite) sont-ils inclus ? Quelle convention de nom de fichier ?                                                     | **réglée** : versos inclus ; déduire recto/verso par noms fichiers. Certaines unités : 3 steps (réduite = 2 steps) ou 1 step sans version réduite. |
| Q9  | Boîtes de réserve et d'éliminés (4 zones : réserve/éliminés × soviétique/allemand, §3) : rectangles en pixels sur la PNG, ou simple liste dans l'UI du jeu ?                        | **réglée** : hors scope de `map-hexes.json` et de l'éditeur 1.3. Ces zones existent déjà sur la carte physique ; le joueur y déplace lui-même les pions à l'écran, le système n'a pas besoin de les connaître.                                                                                                                                          |
| Q10 | La cible de front (case VP/village) et la case logistique (V/S) sont-elles indépendantes ?                                                                                           | **réglée** : oui, indépendantes. N'importe quelle case peut être case logistique, indépendamment du reste. Les villages (et les town/city) peuvent être cible exclusive d'un front ou des deux ; une même case peut être à la fois cible de front et case logistique.                                                                          |

---

## 7. Outillage IA et économie de tokens

### 7.1 Modèle et effort par type de tâche

Changer de modèle **au début d'une nouvelle session**, pas en cours de route (le cache de la conversation est perdu à chaque changement de modèle).

| Type de tâche                                                          | Tâches                  | Modèle              | Effort      |
| ---------------------------------------------------------------------- | ----------------------- | ------------------- | ----------- |
| Discussion, planning, questions de règles simples                      | —                       | Sonnet 5            | moyen       |
| Squelette, outils de carte, interface, PWA                             | 0.7, 1.x, 2.2, 3.5, 5.x | Sonnet 5            | moyen       |
| Extraction des pions et cartes depuis les images                       | 2.3, 4.1                | sous-agent Sonnet 5 | bas à moyen |
| Géométrie, mouvement, ravitaillement                                   | 3.1, 3.2, 4.3           | Opus 5.5            | élevé       |
| Cœur du bot : méthodes de mouvement, tests d'attaque, réserves, combat | 3.3, 4.2, 4.4, 4.5      | Opus 5.5            | très élevé  |
| Débogage d'un test de référence qui échoue                             | 3.4, 4.8                | Opus 5.5            | élevé       |
| Tâches mécaniques (renommer, reformater du JSON)                       | —                       | Haiku 4.5           | bas         |

L'effort maximal n'est utile que là où une erreur de raisonnement coûte cher : l'application exacte des règles soviétiques.

### 7.2 Plugins, skills, MCP

- **Déjà disponibles, rien à installer :**
  - navigateur intégré à l'application Claude, pour tester l'app : lire la page en texte plutôt qu'en capture d'écran, une capture coûte bien plus de tokens ;
  - skills `run` (lancer l'app), `code-review` (relire les changements), `simplify` (simplifier le code), `fewer-permission-prompts` (autoriser une fois pour toutes les commandes courantes), `skill-creator`.
- **Plugins proposés (à installer par le dev) :**
  - `typescript-native-lsp` (communautaire) : erreurs TypeScript et navigation dans le code sans relire des fichiers entiers. Économise des tokens dès la phase 3.
  - `frontend-design` (Anthropic) : qualité de l'interface (éditeur de carte, appli mobile). Phases 1 et 5.
- **Skill projet à créer plus tard** (tâche 4.8) : `golden-test`, qui transforme un exemple du livret en test de référence. La procédure est répétitive, une skill évite de la réexpliquer.
- **MCP** : aucun serveur externe nécessaire. Celui de la phase 6 serait le nôtre.

### 7.3 Règles d'économie de tokens

1. **Une session par bloc de tâches.** Mieux vaut repartir d'une session neuve qu'allonger une très longue conversation. `PLANNING.md` et `CLAUDE.md` suffisent pour reprendre le fil.
2. **Règles** : lire une section via l'index de `docs/rules-german-solo.md`, jamais le PDF.
3. **Images** : fournir des scans recadrés et éviter les captures d'écran répétées.
4. **Extraction en masse** (scans) confiée à un sous-agent : les images restent hors de la conversation principale, seul le JSON revient.
5. **Les tests de référence fixent le comportement** : une fois un test vert, plus besoin de relire la règle correspondante.
6. **Le code cite la règle appliquée** (commentaire court en anglais, ex. `// 9.21 method 10`) : on retrouve le lien sans relire le livret.

---

## 8. Journal

- **2026-10-03** — Lecture du livret et du « But du projet ». Livret converti en Markdown. Dépôt git initialisé. Décisions D1-D8. Planning créé. Propriété du dossier réglée, Node.js v24.21.0 installé via nvm, section §7 « Outillage IA » ajoutée.
- **2026-10-04** — Positionnement des pions : grille de lignes dont les croisements de 4 lignes sont les centres des cases, PNG calée dessous en CSS (D9, précise D2). Images des pions déjà séparées (D10). §3, §5, tâches 0.6, 1.1, 2.3 mis à jour ; Q8 ajoutée.
- **2026-10-04** — Dev répond à Q1-Q6, Q8 : hexagones côté plat en haut (Q1) ; orientation géographique confirmée (Q2) ; joueur tire les chits et dé (Q3, P4 validée) ; PC d'abord, téléphone ensuite (Q4) ; module VASSAL source images (Q6) ; versos inclus, déduction par noms fichiers (Q8). Q5 réponse ultérieure.
- **2026-10-06** — Préparation de l'éditeur à pinceaux (1.3) : le dev précise que le peinturage n'est que pour l'enregistrement des données du moteur (la PNG en fond montre déjà tout visuellement, pas besoin de reproduire les couleurs de terrain). Liste des attributs par case corrigée et complétée (§3) : VP 1-4, village distinct de town/city, cible de front propre aux cases VP/village, case logistique (V/S), lignes — une seule ligne physique Est/Artillerie et une seule ligne Ouest selon le livret (chacune change de rôle selon le tour, pas 4 lignes séparées), flèches primaire/secondaire conditionnelles à un front, bord de carte soviétique/allemand, zone de déploiement allemande. Rivières confirmées affichées sur le côté de case uniquement. Ajout des zones de réserve/éliminés (4, hors grille) — Q9 ouverte sur leur représentation. Q10 ouverte sur l'indépendance cible de front / case logistique.
- **2026-10-06** — Dev répond à Q9, Q10 : les zones de réserve/éliminés sont hors scope (déjà sur la carte physique, le joueur déplace les pions lui-même à l'écran) — retirées de `map-hexes.json` et de l'éditeur 1.3. Cible de front et case logistique confirmées indépendantes ; n'importe quelle case peut être logistique, et une town/city/village peut être cible de front sans être logistique ou l'inverse.
- **2026-10-06** — Deux corrections du dev : zone de déploiement allemande retirée du scope (le joueur incarne les Allemands et place lui-même ses unités) ; les flèches de mouvement sont portées par un **côté de case**, pas par la case entière — déplacées de `map-hexes.json` vers `map-hexsides.json` (§3), avec une direction (case de départ → case voisine) en plus du type (primaire/secondaire) et du front conditionnel.
- **2026-10-06** — Précision du dev sur les flèches : le déplacement n'est permis que dans le sens indiqué (jamais l'inverse) donc la donnée stocke `from`/`to` explicites, pas seulement le côté de case triée. Visuel revu : flèche primaire = pleine couleur (remplie), flèche secondaire = contour seul (non remplie, « light »), pas de tiret.
- **2026-10-06** — Tâche 1.3 terminée : outil `map-painter` (`src/tools/map-painter/`), modules `src/core/map-hexes.ts` et `src/core/map-hexsides.ts` (lecture/validation, sparse par case/côté, testés dans `tests/core/`), API serveur étendue (`/api/map-hexes`, `/api/map-hexsides`). Interface : onglet Hexes (cases mortes, terrain, village, PV, cible de front, logistique, bord de carte, 3 lignes), onglet Sides (route, rivières, flèches dirigées avec bouton « Flip direction »), onglet Display (image, grille, numéros). Peinture au clic et au glisser, clic droit pour effacer, annuler/refaire (Ctrl+Z/Y), sauvegarde et import/export JSON séparés pour les deux fichiers. Marqueurs symboliques discrets (pas de reproduction du terrain) conformément au principe retenu plus haut. Testé dans le navigateur intégré sur la zone de Kharkov (calage 1.1/1.2 confirmé correct) : peinture, indépendance des attributs sur une même case, direction et retournement de flèche, sauvegarde vérifiée sur disque.
- **2026-10-07** — Dev a peint toute la carte avec l'outil (tâche 1.7 bien avancée, `data/map-hexes.json` et `data/map-hexsides.json` remplis). Ajout d'un pinceau « Road off map » (`edgeRoad`, §3) demandé par le dev : case de bord de carte où une route sort de la carte, point de ravitaillement (13.1) — section « Supply entry » dans l'onglet Hexes, marqueur = trait noir pointillé sortant du bord de la case concernée. Testé en mémoire sans écraser les données déjà peintes par le dev (pas de clic Save pendant le test).
- **2026-10-07** — Correctif : « Road off map » ne se dessinait que sur le bord rectangulaire de la grille, pas à côté d'une case morte intérieure (dev avait peint `edgeRoad` sur des cases en bordure de case morte sans rien voir à l'écran, ex. 2721 à côté de la case morte 2821). Le marqueur est maintenant calculé par côté de case à l'affichage : un trait sort sur chaque côté dont le voisin est mort ou hors grille, recalculé en direct quand une case morte voisine est peinte/dépeinte (pas besoin de recharger). Testé en direct : peindre une case voisine en morte fait apparaître le trait du bon côté immédiatement.
- **2026-10-07** — Deux corrections du dev sur les flèches : (1) **front obligatoire**, retrait de l'option « Any / common » — toute flèche imprimée est marquée pour un front (Voronezh, Southwest ou commune), il n'y a pas de flèche non marquée ; `Arrow.front` n'est plus nullable dans `map-hexsides.json` (§3). (2) **Bug « Flip direction »** : le bouton se désactivait dès que la souris quittait la grille de cases en chemin vers le panneau (le survol hors case remettait `hoveredSideId` à `null`), rendant le clic souvent impossible. Le côté ciblé par Flip est maintenant mémorisé séparément (`selectedSideId`) : fixé au survol d'un côté avec flèche ou juste après avoir peint une flèche, et non réinitialisé par un survol hors grille — reste utilisable même après avoir déplacé la souris vers le bouton. Testé en reproduisant le scénario exact (survol flèche → survol hex → clic Flip) : fonctionne.
- **2026-10-07** — Bug « secondary arrow pas en style outline » : `refreshSideVisual` fixait `fill` et `stroke` en style inline inconditionnellement, ce qui écrasait toujours les règles CSS `.primary`/`.secondary` (un style inline gagne toujours sur une règle de classe) — les flèches secondaires s'affichaient donc remplies comme les primaires. Corrigé : `fill` dépend maintenant du type (`none` pour secondary) directement dans le JS qui fixe le style inline ; CSS mort nettoyé en conséquence. Au passage, `vector-effect: non-scaling-stroke` manquait sur `.arrow` (seul le fill rendait les primary visibles quel que soit le zoom ; le contour seul des secondary pouvait devenir sous-pixel) — ajouté. Dev a confirmé peindre ~590 flèches (tâche 1.7) ; toutes testées en primary, aucune en secondary avant le correctif — testé après coup sans toucher aux données sauvegardées.
- **2026-10-07** — Fausse alerte « rien ne se peint, même les primary » : le dev avait oublié de cliquer sur « Paint arrow » pour activer le pinceau avant de cliquer sur la carte (`activeBrush` restait `null`, le clic ne fait alors rien, silencieusement). Pas un bug. Redémarrage du serveur de dev à la demande du dev (accès depuis un deuxième ordinateur du réseau local, HMR Vite parfois mal reconnecté dans ce cas).
- **2026-10-07** — Retrait de la fonctionnalité « Flip direction » (bouton, logique `selectedSideId`/`updateFlipButton`) à la demande du dev : l'heuristique de direction par proximité du clic (9.21 du livret appliqué à l'éditeur, cf. §3) suffit, pas besoin de pouvoir inverser après coup.
- **2026-10-04** — Ajouter modèle et effort (§7.1) en parenthèses dans chaque tâche des phases 0-6, pour autonomie des tâches.
- **2026-10-05** — Squelette Vite + TS + Vitest (0.7). Outil de calage de la carte (1.1) : grille de lignes D9, hexagones et numéros, image de fond réglable, enregistrement dans `data/map-grid.json` ; couleurs feldgrau (choix du dev). Tests de géométrie : chaque centre = croisement des 4 lignes. Reste le calage par le dev.
- **2026-10-05** — Calage enregistré par le dev. Option « colonnes paires rentrées » (une case de moins, `evenColumnShorter`). Import JSON et brouillon automatique dans le navigateur. Projet réorganisé en arborescence (`src/core`, `src/ui`, `src/tools/<outil>`, `server/`, `tests/core`) avec une page d'accueil.
- **2026-10-05** — Dépôt poussé sur GitHub (remote SSH, clé de déploiement). Règle ajoutée dans `CLAUDE.md` : code et interface en anglais ; outil de calage et tests traduits. Cadrage de la carte recalculé quand la zone d'affichage change de taille.
