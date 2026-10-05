# EA Kharkov Bot — consignes pour l'IA

- Discuter avec le dev en **français**.
- **Code et interface en anglais** : identifiants, commentaires, messages d'erreur, tests et tout texte affiché par l'application. Seuls la discussion et les documents de pilotage (`PLANNING.md`, `CLAUDE.md`) restent en français ; les règles citées gardent leur numéro (ex. `// 9.21 method 10`).
- **Lire `PLANNING.md` en début de session.** Y mettre à jour le statut des tâches, les décisions, les questions et le journal dès que quelque chose change.
- **Règles du jeu** : `docs/rules-german-solo.md`. Consulter l'index (numéros de ligne) en tête du fichier et lire uniquement la section utile (offset/limit). Ne pas relire le PDF.
  - Conventions du fichier : `[GT 5+]` = condition de tour, `> **[Exemple pN]**` = encadré d'exemple, `<!-- pN -->` = page du PDF.
  - Si une règle est ambiguë, poser la question au dev et la noter dans `PLANNING.md` §6.
- **Données** en JSON dans `data/` ; conventions (numéros de case `CCRR` à partir de 0101, côtés de case `"CCRR-CCRR"`) dans `PLANNING.md` §3.
- Le moteur du bot doit **tracer chaque décision** (méthode, préférence, départage). Les exemples du livret servent de **tests de référence**.
- Node.js est installé via nvm : dans les commandes shell, préfixer par `source ~/.nvm/nvm.sh && …`.
- Modèle, effort et économie de tokens : `PLANNING.md` §7.
- Git : ne commiter que sur demande du dev.
- Toujours demander au dev la permission avant de commencer à éditer les fichiers / coder.
