# But du projet

J'ai un jeu wargame plateau nommé Enemy Action Kharkov, dont les règles sont uploadé dans le dossier de travail. Le joueur incarne les allemands et le bot sovietique est une procédure d'instructions à appliquer par le joueur .  Le but de ce projet serait d'avoir un logiciel capable d'automatiser le bot via un input graphique où les pions seraient déplacés sur une carte de bataille et le output du système afficherait les déplacements et actions du bot sur cette carte. 

## Pistes d'implémentations

Les pistes sont à discuter, elles ne sont pas un plan figé. Chaque point est une proposition qui peut soit être complémentaire ou exclusive. Quand on parle de map, c'est la carte du champ de bataille. Il faudrait étudier quels seraient les besoins pour chaque possibilité. Estimer la charge de travail IA (léger, moyen, lourd), ainsi que les prérequis à apporter à l'IA de la part du dev. 

### Map

- On pourrait envisager un outil créé par l'IA qui aurait pour utilité de marquer sur l'image de la map les éléments de gameplay. comme les positions, les limites entre les fronts soviétiques, les bords de map.... C'est moi le dev qui marquerait ça avec des pinceaux créé par l'ia sur navigateur pour qu'elle puisse encoder dans le programme une matrice de cases... 

- L'ia fait tout elle meme par reconnaissance d'image. 

- Le système a la matrice dans ses données, mais elle n'est reliée à aucune image. L'input serait alors uniquement le joueur qui indique par commande quelles unités ont bougé et les résultats d'attaque. L'ouput serait du texte avec la position des unités bougées par le programme. 

- Le programme génère une grille d'hexagones avec x et y et z nombres de lignes, colonnes , délimitée visuellement, et tout ce joue la dessus, et l'image de la map n'est que un background. 

### Les unités

- pour initier la db du programme, ça se baserait sur de l'océrisation des jetons d'unités qui sont actuellement à l'état d'image uniquement. Le dev pourrait donner une image en exemple où les zones du jeton seraient à délimiter , car les infos sont toujours au même endroit dessus.

- Les unités seraient à identifier une à une à la main, il faudrait que le programmeur encode un nouveau corp d'armée, nouvelle armée , type d'armée, les stats de MP et attaque.... 

### Cartes à jouer

Propositions identiques aux unités . En plus : 

- Dans un premier temps c'est le joueur qui indique quelle carte est en jeu , jouée par le bot et le système suit les instructions de celle ci . 

- Ou alors prévoir un système automatisé de tirage de carte. 

### Actions

Certaines informations du bot ,; comme la description des évènements de combat ne sont pas dans le livret de règle mais dans l'aide de jeu de la boite. Je pourrais les founir il faudra alors qu'une IA les OCR. 

- Les procédures de prise de décision du bot et d'analyse du state du jeu seraient prises par un programme codé sur un logiciel / serveur avec input / output qu'elles soient en commandes ou UI. 

- Les procédures de décision sont prises par une IA à qui on donne les règles du jeu et elle interagit avec l'interface qui n'est qu'un serveur MCP.

## Outils

Il serait plus agréable si l'IA créerait des outils pour faciliter le développement, et pour que le dev puisse voir ce qu'il s'y passe. par exemple des layers de données superposés sur la map, pour voir les grid, les positions connues du système etc... Un outil pour lire la db contenant toutes les unités. d'ailelurs une db ou un csv ? propose les technologies les plus adéquates. Il serait bon que in fine ça puisse tourner sur un téléphone, donc un PWA seriat top. ***Mais d'abord il faudrait faire un POC, qui puisse être mis en place en 2 ou 3 soirées max***. 

Réflichis à chaque fois aux outils qu'il seraient judicieux d'implémenter, comme: 

- Skills

- Connectors

- Plugins

- Model

- Type d'effort

- Outils externes à installer etc.. 


