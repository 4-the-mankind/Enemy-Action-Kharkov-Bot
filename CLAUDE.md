# EA Kharkov Bot — consignes pour l'IA

- Discuter avec le dev en **français**.
- **Code et interface en anglais** : identifiants, commentaires, messages d'erreur, tests et tout texte affiché par l'application. Seuls la discussion et les documents de pilotage (`PLANNING.md`, `CLAUDE.md`) restent en français ; les règles citées gardent leur numéro (ex. `// 9.21 method 10`).
- **Termes du jeu en anglais, même dans la discussion en français** : terrains (`clear`, `broken`, `marsh`, `woods`, `town`, `city`, `village`, `road`, `minor river`, `Donets`, `Dniepr`), et termes de règle du livret quand ils sont ambigus en traduction (ex. `town` et `city` ne sont pas des `village`). Ne pas traduire « town » par « ville » ni « woods » par « forêt ».
- **Lire `PLANNING.md` en début de session.** Y mettre à jour le statut des tâches, les décisions, les questions et le journal dès que quelque chose change.
- **Règles du jeu** : `docs/rules-german-solo.md`. Consulter l'index (numéros de ligne) en tête du fichier et lire uniquement la section utile (offset/limit). Ne pas relire le PDF.
  - Conventions du fichier : `[GT 5+]` = condition de tour, `> **[Exemple pN]**` = encadré d'exemple, `<!-- pN -->` = page du PDF.
  - Si une règle est ambiguë, poser la question au dev et la noter dans `PLANNING.md` §6.
- **Données** en JSON dans `data/` ; conventions (numéros de case `CCRR` à partir de 0101, côtés de case `"CCRR-CCRR"`) dans `PLANNING.md` §3.
- Le moteur du bot doit **tracer chaque décision** (méthode, préférence, départage). Les exemples du livret servent de **tests de référence**.
- Node.js est installé via nvm : dans les commandes shell, préfixer par `source ~/.nvm/nvm.sh && …`.
- **Serveur de dev : port 5173 uniquement.** Le dev ne peut ouvrir que ce port dans son navigateur ; ne pas lancer de serveur sur un autre port. Si l'instance du 5173 sert du code périmé (modification non prise en compte), l'IA peut la redémarrer (arrêter le processus `vite` en cours, puis relancer la configuration `map` de `.claude/launch.json`) pour mettre à jour la page du dev.
- Modèle, effort et économie de tokens : `PLANNING.md` §7.
- Git : ne commiter que sur demande du dev.
- Toujours demander au dev la permission avant de commencer à éditer les fichiers / coder.
