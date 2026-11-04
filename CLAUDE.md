# EA Kharkov Bot — consignes pour l'IA

- Discuter avec le dev en **français**.
- **Code et interface en anglais** : identifiants, commentaires, messages d'erreur, tests et tout texte affiché par l'application. Seuls la discussion et les documents de pilotage (`PLANNING.md`, `CLAUDE.md`) restent en français ; les règles citées gardent leur numéro (ex. `// 9.21 method 10`).
- **Termes du jeu en anglais, même dans la discussion en français** : terrains (`clear`, `broken`, `marsh`, `woods`, `town`, `city`, `village`, `road`, `minor river`, `Donets`, `Dniepr`), et termes de règle du livret quand ils sont ambigus en traduction (ex. `town` et `city` ne sont pas des `village`). Ne pas traduire « town » par « ville » ni « woods » par « forêt ».
- **Lire `PLANNING.md` en début de session.** Y mettre à jour le statut des tâches, les décisions, les questions et le journal dès que quelque chose change.
- **Règles du jeu** : `docs/rules-german-solo.md`. Consulter l'index (numéros de ligne) en tête du fichier et lire uniquement la section utile (offset/limit). Ne pas relire le PDF.
  - Conventions du fichier : `[GT 5+]` = condition de tour, `> **[Exemple pN]**` = encadré d'exemple, `<!-- pN -->` = page du PDF.
  - Si une règle est ambiguë, poser la question au dev et la noter dans `PLANNING.md` §6.
  - **Dans la discussion, toute section de règle citée est suivie de son titre entre parenthèses**, tel qu'il figure dans le livret (en anglais), ex. « 9.3 (Soviet Activation Terminology) », « 9.21 méthode 10 (Follow Movement Arrows) ». Même chose pour les tâches de `PLANNING.md` : « tâche 4.3 (ravitaillement) ». Ne s'applique pas aux commentaires du code, qui gardent le numéro seul (`// 9.21 method 10`).
- **Textes** : tout texte affiché vient de `src/i18n/en.json` (`t(...)`, `data-i18n` dans les pages). Le moteur n'écrit jamais de phrase : il renvoie des messages `msg(clé, paramètres)`. Les tests vérifient la clé et les paramètres avec `expectMessage`, pas la formulation.
- **Données** en JSON dans `data/` ; conventions (numéros de case `CCRR` à partir de 0101, côtés de case `"CCRR-CCRR"`) dans `PLANNING.md` §3.
- **Avant de coder une tâche**, chercher `TODO <numéro de la tâche>` dans `src/` et lire la liste « Points de branchement » de la tâche dans `PLANNING.md` : le moteur appelle déjà des fonctions provisoires (`src/engine/pending.ts`) qu'elle doit remplacer. Une tâche qui laisse une règle pour plus tard fait de même : fonction provisoire dans `pending.ts`, `TODO <tâche>` dans le code, point de branchement dans `PLANNING.md`.
- Le moteur du bot doit **tracer chaque décision** (méthode, préférence, départage). Les exemples du livret servent de **tests de référence**.
- Node.js est installé via nvm : dans les commandes shell, préfixer par `source ~/.nvm/nvm.sh && …`.
- **Serveur de dev : port 5173 uniquement.** Le dev ne peut ouvrir que ce port dans son navigateur ; ne pas lancer de serveur sur un autre port. Si l'instance du 5173 sert du code périmé (modification non prise en compte), l'IA peut la redémarrer (arrêter le processus `vite` en cours, puis relancer la configuration `map` de `.claude/launch.json`) pour mettre à jour la page du dev.
- Modèle, effort et économie de tokens : `PLANNING.md` §7.
- Git : ne commiter que sur demande du dev.
- **Mise en ligne** : seuls les tags de version `vX.Y.Z` sont déployés (il n'y a plus de branche `release`). Procédure : passer la version sans `-SNAPSHOT` (`package.json`, `package-lock.json`, titre de section de `release.md`), commiter sur `main`, poser le tag annoté `vX.Y.Z` et pousser `main` et le tag ; le push du tag lance `.github/workflows/deploy.yml` (tests, build, publication de `dist/`). Ensuite passer la version suivante en `-SNAPSHOT` sur `main`. Le problème est déjà arrivé deux fois : la page en ligne s'affiche sans CSS ni script parce que GitHub Pages publie les fichiers bruts du dépôt (`index.html` source qui pointe vers `/src/game/main.ts`) au lieu du build. **À chaque demande de mise en ligne, toujours rappeler au dev les deux réglages GitHub** : Settings → Pages → Build and deployment → Source = **« GitHub Actions »** (et non « Deploy from a branch ») ; Settings → Environments → github-pages → Deployment branches and tags = règle de type **Tag**, motif **`v*`** (sinon : « Tag … is not allowed to deploy to github-pages due to environment protection rules »). Relancer à la main : Actions → Deploy to GitHub Pages (https://github.com/4-the-mankind/Enemy-Action-Kharkov-Bot/actions/workflows/deploy.yml) → Run workflow sur le tag. Après le déploiement, vérifier que la page en ligne charge des fichiers `/Enemy-Action-Kharkov-Bot/assets/…` et non `/src/…`.
- **Notes de version** : dans `release.md`, pas dans `PLANNING.md` (les corrections de bugs n'y vont pas).
  - Une section par version, au nom de la version en cours (ex. `0.2.0-SNAPSHOT`) ; si le projet est encore à la version précédente, monter la version du projet.
  - En anglais.
  - Seulement les bugs corrigés et les améliorations : pas de décisions, d'options écartées ni de justification.
  - Pas de référence interne (ex. « Bug 2 ») : chaque entrée décrit ce que voit le joueur.
- **Ne JAMAIS commencer sans le « go » explicite du dev** : aucune édition de fichier (code, données, `PLANNING.md`…) ni aucun code avant ce go. Répondre d'abord à **toutes** ses questions, et reposer clairement toute question qu'il n'a pas comprise, sans trancher à sa place. Une réponse à une question n'est pas un go.
- **Questions et choix proposés au dev** : chaque question finit par un point d'interrogation et se comprend sans relire la conversation. Elle donne, dans l'ordre :
  1. le contexte : règle citée avec son titre, situation de jeu, exemple chiffré si utile ;
  2. les options, numérotées, chacune avec ses conséquences concrètes (partie, interface, code, tâches suivantes) ;
  3. la recommandation de l'IA et sa raison ;
  4. la question elle-même, en gras.

  Une question = un seul choix ; les sous-questions sont lettrées (a, b…). La même question va dans `PLANNING.md` §6 en forme courte, avec la recommandation. Une réponse ambiguë est reposée, sans trancher à la place du dev.
