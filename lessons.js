/* ==========================================================================
   lessons.js — Pédagogie
   --------------------------------------------------------------------------
   Lessons    : leçons, quiz, exercices et examens des niveaux 1 et 2
                (les niveaux 3 à 5 sont annoncés mais pas encore disponibles).
   Challenges : mode Défi (séries de questions et de situations).
   Analysis   : conseils en temps réel et analyse pédagogique après la main.

   Format d'une question :
     { q, options: [...], answer: index, explain, theme, context? }
   Dans les textes, [[As Kd]] est remplacé à l'affichage par des cartes.

   L'analyse n'utilise que les informations visibles par le joueur au moment
   de sa décision. Elle ne prétend jamais connaître les cartes adverses.
   ========================================================================== */
(function (global) {
  'use strict';
  const P = global.Poker;
  const B = global.Bots;

  const THEMES = {
    'regles': 'Règles et déroulement',
    'mains': 'Ordre des mains',
    'positions': 'Blinds et positions',
    'actions': 'Actions de jeu',
    'abattage': 'Abattage et partage du pot',
    'preflop': 'Mains de départ',
    'position-strat': 'Jouer en position',
    'ranges': 'Notion de range',
    'outs': 'Outs et probabilités',
    'pot-odds': 'Cotes du pot et équité',
    'postflop': 'Décisions après le flop',
    'preflop-avance': 'Relances avant le flop',
    'cbet-value': 'C-bet et mise pour valeur',
    'bluff': 'Bluff et fold equity',
    'lecture': 'Lecture des ranges et sizing',
    'stack': 'Profondeur de stack',
    'ranges-avance': 'Théorie des ranges',
    'exploit': 'Exploitation des tendances',
    'texture': 'Texture du board',
    'icm': 'ICM en tournoi',
    'gto': 'Stratégie GTO',
    'frequences': 'Fréquences de bluff',
    'multistreet': 'Plan sur plusieurs tours',
    'mental': 'Bankroll et mental'
  };

  /* ========================================================================
     1. CONTENU DES LEÇONS
     ======================================================================== */
  const LEVELS = [
    {
      id: 1, title: 'Niveau 1 — Débutant', subtitle: 'Les règles du Texas Hold\'em',
      mistakes: [
        'Oublier que la meilleure main se compose de 5 cartes seulement, choisies parmi 7.',
        'Confondre l\'ordre des mains : une couleur bat une quinte, un full bat une couleur.',
        'Se coucher alors que la parole (check) est gratuite.',
        'Croire qu\'une double paire est forte quand le board offre une quinte ou une couleur évidente.',
        'Ne pas savoir qui parle en premier : avant le flop, le joueur à gauche de la grosse blinde ; ensuite, le premier joueur à gauche du bouton.'
      ],
      lessons: [
        {
          id: 'n1-l1', title: 'Le but du jeu et le déroulement d\'une main', theme: 'regles', exercises: ['ranking'],
          steps: [
            '<h3>Le principe</h3><p>Au Texas Hold\'em, chaque joueur reçoit <strong>2 cartes fermées</strong> (visibles de lui seul). Ensuite, <strong>5 cartes communes</strong> sont retournées au centre de la table : c\'est le <em>board</em>.</p><p>Votre main finale est la <strong>meilleure combinaison de 5 cartes</strong> parmi les 7 disponibles (vos 2 cartes + les 5 du board). Vous pouvez utiliser vos deux cartes, une seule, ou même aucune.</p><div class="key-box"><strong>Deux façons de gagner le pot</strong>Avoir la meilleure main à l\'abattage, ou faire se coucher tous les autres joueurs avant.</div>',
            '<h3>Les quatre tours d\'enchères</h3><ol><li><strong>Pré-flop</strong> : chacun a ses 2 cartes, aucune carte commune.</li><li><strong>Flop</strong> : 3 cartes communes sont retournées.</li><li><strong>Turn</strong> : une 4<sup>e</sup> carte commune.</li><li><strong>River</strong> : la 5<sup>e</sup> et dernière carte commune.</li></ol><p>Après chaque étape, les joueurs encore en jeu misent à tour de rôle. S\'il reste au moins deux joueurs après la river, on compare les mains : c\'est l\'<strong>abattage</strong> (showdown).</p>',
            '<h3>Exemple</h3><div class="example-box"><strong>Une main complète</strong>Vous avez [[Ah Kd]]. Le flop tombe [[Ks 7c 2d]] : vous avez une paire de Rois. Le turn [[9h]] et la river [[Ac]] vous donnent une double paire As et Rois. Votre main finale : [[Ah Ac Kd Ks 9h]].</div><p>« No-Limit » signifie qu\'il n\'y a pas de plafond : à tout moment, un joueur peut miser tous ses jetons (le <strong>tapis</strong>, ou all-in).</p>'
          ],
          quiz: [
            { q: 'Combien de cartes fermées chaque joueur reçoit-il ?', options: ['1', '2', '4', '5'], answer: 1, explain: 'Chaque joueur reçoit 2 cartes fermées, visibles de lui seul.', theme: 'regles' },
            { q: 'Dans quel ordre les cartes communes sont-elles dévoilées ?', options: ['Turn, flop, river', 'Flop (3 cartes), turn (1), river (1)', 'River, turn, flop', 'Flop (2 cartes), turn (2), river (1)'], answer: 1, explain: 'Le flop compte 3 cartes, puis viennent le turn et la river, une carte chacun.', theme: 'regles' },
            { q: 'De combien de cartes se compose votre main finale ?', options: ['Vos 2 cartes uniquement', 'Les 7 cartes', 'Les 5 meilleures cartes parmi les 7', 'Exactement 2 de vos cartes + 3 du board'], answer: 2, explain: 'On retient les 5 meilleures cartes parmi vos 2 cartes et les 5 du board, dans n\'importe quelle proportion.', theme: 'regles' },
            { q: 'Que signifie « No-Limit » ?', options: ['Le nombre de joueurs est illimité', 'On peut miser jusqu\'à la totalité de ses jetons à tout moment', 'La partie n\'a pas de fin', 'Les blinds n\'existent pas'], answer: 1, explain: 'En No-Limit, la mise maximale est votre stack entier : le tapis.', theme: 'regles' }
          ]
        },
        {
          id: 'n1-l2', title: 'L\'ordre des mains', theme: 'mains', exercises: ['ranking', 'ranking'],
          steps: [
            '<h3>De la plus forte à la plus faible</h3><ol><li><strong>Quinte flush royale</strong> : 10-V-D-R-A de la même couleur [[As Ks Qs Js Ts]]</li><li><strong>Quinte flush</strong> : 5 cartes qui se suivent, même couleur [[9h 8h 7h 6h 5h]]</li><li><strong>Carré</strong> : 4 cartes de même rang [[9s 9d 9h 9c Kd]]</li><li><strong>Full</strong> : un brelan + une paire [[Ks Kd Kh 2c 2s]]</li><li><strong>Couleur</strong> : 5 cartes de la même couleur [[As Js 9s 6s 3s]]</li><li><strong>Quinte</strong> : 5 cartes qui se suivent [[9s 8d 7h 6c 5s]]</li><li><strong>Brelan</strong> : 3 cartes de même rang [[7s 7d 7h Kc 2s]]</li><li><strong>Double paire</strong> [[As Ad 9h 9c 4s]]</li><li><strong>Paire</strong> [[Qs Qd 9h 7c 4s]]</li><li><strong>Hauteur</strong> (carte haute) [[As Kd 9h 7c 4s]]</li></ol>',
            '<h3>Pourquoi cet ordre ?</h3><p>Plus une combinaison est <strong>rare</strong>, plus elle est forte. Une couleur est plus difficile à obtenir qu\'une quinte, donc elle la bat.</p><div class="key-box"><strong>Moyen mnémotechnique</strong>Quinte &lt; Couleur &lt; Full &lt; Carré. Retenez « Q-C-F-C » : Quelle Chance Formidable, Carré !</div><p>L\'As est la carte la plus forte, mais il peut aussi servir de carte basse dans la quinte A-2-3-4-5 [[5s 4d 3h 2c As]]. C\'est alors la plus petite quinte possible. En revanche, D-R-A-2-3 n\'est <strong>pas</strong> une quinte.</p>',
            '<h3>Les couleurs ne se départagent pas</h3><p>Au poker, pique, cœur, carreau et trèfle ont la même valeur. Deux quintes flush royales de couleurs différentes seraient à égalité.</p><div class="example-box"><strong>Exemple</strong>Avec [[Kh Qh]] sur un board [[Ah Jh 4h 9s 9d]], vous avez une <strong>couleur</strong> à l\'As (5 cœurs). Un adversaire avec [[9c 4c]] aurait un <strong>full</strong> aux Neuf par les Quatre : il gagne, car un full bat une couleur.</div>'
          ],
          quiz: [
            { q: 'Quelle main est la plus forte ?', options: ['Quinte', 'Brelan', 'Couleur', 'Double paire'], answer: 2, explain: 'La couleur bat la quinte, le brelan et la double paire.', theme: 'mains' },
            { q: 'Un full bat-il une couleur ?', options: ['Oui', 'Non', 'Seulement si le full est aux As', 'Ils sont à égalité'], answer: 0, explain: 'Le full est plus rare que la couleur : il la bat toujours.', theme: 'mains' },
            { q: 'Quelle est cette combinaison ?', context: '[[5s 4d 3h 2c As]]', options: ['Hauteur As', 'Quinte hauteur Cinq', 'Quinte hauteur As', 'Rien du tout'], answer: 1, explain: 'A-2-3-4-5 est une quinte dont l\'As est la carte basse : c\'est la plus petite quinte.', theme: 'mains' },
            { q: 'Laquelle de ces mains n\'est PAS une quinte ?', options: ['10-V-D-R-A', 'A-2-3-4-5', 'D-R-A-2-3', '6-7-8-9-10'], answer: 2, explain: 'Une quinte ne peut pas « faire le tour » : l\'As est soit tout en haut, soit tout en bas.', theme: 'mains' }
          ]
        },
        {
          id: 'n1-l3', title: 'Blinds, bouton et positions', theme: 'positions', exercises: [],
          steps: [
            '<h3>Le bouton et les blinds</h3><p>Un jeton marqué <strong>D</strong> (dealer, ou « bouton ») désigne le donneur. Il avance d\'un joueur vers la gauche à chaque main.</p><p>Avant de recevoir les cartes, deux joueurs posent une mise obligatoire :</p><ul><li>la <strong>petite blinde</strong> (SB), juste à gauche du bouton ;</li><li>la <strong>grosse blinde</strong> (BB), à gauche de la petite blinde, en général le double.</li></ul><p>Les blinds garantissent qu\'il y a toujours quelque chose à gagner. On mesure souvent les stacks en grosses blinds : 1 000 jetons aux blinds 5/10 représentent <strong>100 BB</strong>.</p>',
            '<h3>Les noms des positions</h3><p>À une table de 6 joueurs, dans l\'ordre de parole avant le flop :</p><ul><li><strong>UTG</strong> (« under the gun ») : premier à parler, la position la plus difficile ;</li><li><strong>MP</strong> : milieu de table ;</li><li><strong>CO</strong> (cut-off) : juste avant le bouton ;</li><li><strong>BTN</strong> (bouton) : la meilleure position ;</li><li><strong>SB</strong> et <strong>BB</strong> : les blinds.</li></ul><div class="key-box"><strong>Qui parle en premier ?</strong>Avant le flop : le joueur à gauche de la grosse blinde. Après le flop : le premier joueur encore en jeu à gauche du bouton. Le bouton parle donc en dernier après le flop.</div>',
            '<h3>Le cas du tête-à-tête</h3><p>À deux joueurs (« heads-up »), la règle change : le <strong>bouton poste la petite blinde</strong> et parle en premier avant le flop. Après le flop, c\'est la grosse blinde qui parle en premier.</p><div class="example-box"><strong>Exemple</strong>Table de 6, vous êtes au bouton. Avant le flop, 3 joueurs parlent avant vous. Après le flop, vous parlez en dernier : vous voyez ce que font tous les autres avant de décider. C\'est un avantage énorme, étudié au niveau 2.</div>'
          ],
          quiz: [
            { q: 'Où se trouve la petite blinde ?', options: ['À droite du bouton', 'Juste à gauche du bouton', 'En face du bouton', 'Au bouton, toujours'], answer: 1, explain: 'La petite blinde est le premier joueur à gauche du bouton (sauf en tête-à-tête).', theme: 'positions' },
            { q: 'Avant le flop, qui parle en premier (table de 6) ?', options: ['La petite blinde', 'Le bouton', 'Le joueur à gauche de la grosse blinde (UTG)', 'La grosse blinde'], answer: 2, explain: 'Les blinds ayant déjà misé, la parole commence à gauche de la grosse blinde.', theme: 'positions' },
            { q: 'Après le flop, qui parle en dernier ?', options: ['La grosse blinde', 'Le bouton (s\'il est encore en jeu)', 'Le premier relanceur', 'Le plus gros stack'], answer: 1, explain: 'Après le flop, la parole commence à gauche du bouton : le bouton conclut.', theme: 'positions' },
            { q: 'Aux blinds 5/10, combien de grosses blinds représente un stack de 500 ?', options: ['5', '50', '100', '500'], answer: 1, explain: '500 ÷ 10 = 50 grosses blinds.', theme: 'positions' },
            { q: 'En tête-à-tête (2 joueurs), qui poste la petite blinde ?', options: ['Le bouton', 'Le joueur qui n\'a pas le bouton', 'Personne', 'Les deux joueurs'], answer: 0, explain: 'En heads-up, le bouton est petite blinde et parle en premier avant le flop.', theme: 'positions' }
          ]
        },
        {
          id: 'n1-l4', title: 'Les actions : se coucher, parole, suivre, miser, relancer', theme: 'actions', exercises: [],
          steps: [
            '<h3>Quand personne n\'a misé</h3><ul><li><strong>Parole</strong> (check) : vous passez votre tour sans miser. C\'est gratuit.</li><li><strong>Miser</strong> (bet) : vous posez la première mise du tour d\'enchères.</li></ul><h3>Quand quelqu\'un a misé</h3><ul><li><strong>Se coucher</strong> (fold) : vous abandonnez la main et ce que vous avez déjà mis.</li><li><strong>Suivre</strong> (call) : vous égalisez la mise.</li><li><strong>Relancer</strong> (raise) : vous augmentez la mise.</li></ul><div class="mistakes-box"><strong>Erreur classique</strong>Ne vous couchez jamais quand la parole est possible : vous abandonnez gratuitement une chance de gagner.</div>',
            '<h3>Combien peut-on miser ?</h3><p>La mise minimale est d\'<strong>une grosse blinde</strong>. Pour relancer, il faut augmenter au moins du montant de la dernière mise ou relance.</p><div class="example-box"><strong>Exemple</strong>Blinds 5/10. Un joueur relance à 30 (soit 20 de plus que la grosse blinde). La sur-relance minimale est alors de 50 (30 + 20).</div><p>Le <strong>tapis</strong> (all-in) consiste à miser tous ses jetons. Si votre tapis est inférieur à la mise à suivre, vous restez en jeu mais ne pouvez gagner que la part du pot que vous avez couverte.</p>',
            '<h3>Quand le tour d\'enchères se termine-t-il ?</h3><p>Quand tous les joueurs encore en jeu ont parlé et ont mis <strong>le même montant</strong> (ou sont à tapis). On passe alors à la carte suivante.</p><p>Avant le flop, la grosse blinde a une « option » : si personne n\'a relancé, elle peut dire parole ou relancer.</p><div class="key-box"><strong>Vocabulaire</strong>« Limper » = suivre simplement la grosse blinde avant le flop. « Ouvrir » = être le premier à relancer. « 3-bet » = sur-relancer une première relance.</div>'
          ],
          quiz: [
            { q: 'Personne n\'a misé et vous ne voulez pas miser. Que faites-vous ?', options: ['Je me couche', 'Je dis parole (check)', 'Je dois suivre', 'Je quitte la table'], answer: 1, explain: 'La parole est gratuite : se coucher serait abandonner sans raison.', theme: 'actions' },
            { q: 'Blinds 5/10. Un joueur relance à 30. Quelle est la sur-relance minimale ?', options: ['40', '50', '60', '90'], answer: 1, explain: 'La relance était de 20 (de 10 à 30). Il faut relancer d\'au moins 20 de plus : 50.', theme: 'actions' },
            { q: 'Que signifie « limper » ?', options: ['Relancer très gros', 'Suivre simplement la grosse blinde avant le flop', 'Se coucher en blinde', 'Faire tapis'], answer: 1, explain: 'Limper, c\'est entrer dans le coup au prix minimal, sans relancer.', theme: 'actions' },
            { q: 'Vous faites tapis pour 40 alors que la mise est de 100. Que se passe-t-il ?', options: ['Votre tapis est refusé', 'Vous êtes éliminé de la main', 'Vous restez en jeu pour la part du pot que vous couvrez', 'Vous devez emprunter 60'], answer: 2, explain: 'Un pot annexe est créé pour le surplus : vous ne jouez que le pot principal.', theme: 'actions' }
          ]
        },
        {
          id: 'n1-l5', title: 'L\'abattage, les kickers et le partage du pot', theme: 'abattage', exercises: ['winner', 'winner'],
          steps: [
            '<h3>Le kicker</h3><p>Quand deux joueurs ont la même combinaison, les cartes restantes les départagent : ce sont les <strong>kickers</strong>.</p><div class="example-box"><strong>Exemple</strong>Board : [[Ah 7d 8s 2c 3d]]. Vous avez [[As Kd]], votre adversaire [[Ac Qd]]. Vous avez tous deux une paire d\'As. Votre main : A-A-<strong>K</strong>-8-7. La sienne : A-A-<strong>D</strong>-8-7. Votre Roi bat sa Dame : vous gagnez.</div><p>C\'est pourquoi A-K vaut bien plus que A-6 : avec la même paire, le kicker fait la différence.</p>',
            '<h3>L\'égalité et le partage</h3><p>Si les 5 meilleures cartes des deux joueurs sont identiques en rang, le pot est <strong>partagé</strong> (split pot).</p><div class="example-box"><strong>Exemple</strong>Board : [[Ah Kd Qs Jc 9d]]. Vous avez [[As 3c]], l\'adversaire [[Ac 2c]]. Main de chacun : A-A-K-D-V. Votre 3 et son 2 ne comptent pas (une main n\'a que 5 cartes) : égalité.</div><p>Quand le board lui-même forme la meilleure main possible pour tous, on dit que « le board joue ».</p>',
            '<h3>Les pots annexes (side pots)</h3><p>Un joueur à tapis ne peut gagner à chaque adversaire que le montant qu\'il a lui-même misé.</p><div class="example-box"><strong>Exemple</strong>Alice fait tapis pour 100. Bob et Chloé misent 300 chacun. <strong>Pot principal</strong> : 300 (100 de chacun), disputé par les trois. <strong>Pot annexe</strong> : 400 (200 de Bob + 200 de Chloé), disputé seulement par Bob et Chloé. Si Alice a la meilleure main, elle gagne 300 et le pot annexe va au meilleur entre Bob et Chloé.</div>'
          ],
          quiz: [
            { q: 'Qui gagne ?', context: 'Board : [[Kh Kd 7s 7c 2d]] — Vous : [[As 3c]] — Adversaire : [[Qs Jc]]', options: ['Vous, grâce à l\'As en kicker', 'L\'adversaire', 'Égalité', 'Impossible à dire'], answer: 0, explain: 'Tous deux ont double paire Rois et Sept. La 5e carte départage : votre As bat sa Dame.', theme: 'abattage' },
            { q: 'Qui gagne ?', context: 'Board : [[As Ks Qs Js Ts]] — Vous : [[2d 3c]] — Adversaire : [[9h 9d]]', options: ['Vous', 'L\'adversaire avec sa paire de Neuf', 'Égalité : le board joue pour les deux', 'Personne'], answer: 2, explain: 'Le board est une quinte flush royale : aucune carte fermée ne peut l\'améliorer. Partage.', theme: 'abattage' },
            { q: 'Alice est à tapis pour 50. Bob et Chloé misent 200 chacun. Combien Alice peut-elle gagner au maximum ?', options: ['50', '150', '250', '450'], answer: 1, explain: 'Elle gagne au plus 50 de chaque joueur, elle comprise : 3 × 50 = 150.', theme: 'abattage' },
            { q: 'Pourquoi A-K est-elle meilleure que A-6 ?', options: ['Parce qu\'elle contient deux figures', 'Parce que le Roi est un meilleur kicker quand on touche la paire d\'As', 'Parce que le 6 porte malheur', 'Elles se valent'], answer: 1, explain: 'Avec une paire d\'As commune, le kicker départage : le Roi gagne presque toujours.', theme: 'abattage' }
          ]
        }
      ]
    },
    {
      id: 2, title: 'Niveau 2 — Fondamentaux', subtitle: 'Mains de départ, position, cotes',
      mistakes: [
        'Jouer trop de mains : la plupart des mains de départ doivent être couchées.',
        'Limper (suivre la grosse blinde) au lieu d\'ouvrir en relançant.',
        'Jouer les mêmes mains à toutes les positions, sans tenir compte de la parole.',
        'Suivre une mise avec un tirage sans comparer ses chances à la cote du pot.',
        'Mettre l\'adversaire sur une seule main précise au lieu de raisonner sur un éventail de mains (range).'
      ],
      lessons: [
        {
          id: 'n2-l1', title: 'La sélection des mains de départ', theme: 'preflop', exercises: ['preflop', 'preflop'],
          steps: [
            '<h3>Peu de mains, mais de bonnes mains</h3><p>La première décision est la plus importante : jouer ou se coucher. Un bon joueur débutant se couche <strong>environ 4 fois sur 5</strong> avant le flop à une table pleine.</p><p>Quatre familles de mains valent d\'être jouées :</p><ul><li><strong>Les grosses paires</strong> : [[As Ad]] [[Ks Kd]] [[Qs Qd]] [[Js Jd]]</li><li><strong>Les gros As</strong> : [[As Kd]] [[Ah Qh]] [[Ad Jd]]</li><li><strong>Les figures assorties</strong> : [[Kh Qh]] [[Qs Js]] [[Jd Td]]</li><li><strong>Les paires moyennes et petites</strong> : de [[Ts Td]] à [[2s 2d]], surtout pour toucher un brelan.</li></ul>',
            '<h3>Assorties, connectées</h3><p>Deux cartes de la même couleur (« assorties », notées <strong>s</strong> pour <em>suited</em>) peuvent former une couleur. Deux cartes qui se suivent (« connectées ») peuvent former une quinte. Notation : <strong>AKs</strong> = As-Roi assortis ; <strong>AKo</strong> = dépareillés (<em>offsuit</em>).</p><div class="mistakes-box"><strong>Les mains pièges</strong>[[Kd 7c]], [[Qh 5s]], [[Ac 4d]] : une belle carte et une mauvaise. Quand vous touchez votre paire, un adversaire a souvent la même avec un meilleur kicker. Ce sont des mains « dominées ».</div>',
            '<h3>Relancer plutôt que suivre</h3><p>Si personne n\'a relancé et que votre main mérite d\'être jouée, <strong>ouvrez en relançant</strong> (environ 3 grosses blinds) au lieu de limper. Vous pouvez gagner les blinds tout de suite, vous réduisez le nombre d\'adversaires et vous prenez l\'initiative.</p><div class="key-box"><strong>Règle simple</strong>« Relancer ou se coucher. » Si la main n\'est pas assez bonne pour relancer, elle n\'est généralement pas assez bonne pour être jouée.</div>'
          ],
          quiz: [
            { q: 'À une table pleine, quelle proportion de mains un débutant solide joue-t-il ?', options: ['Presque toutes', 'Environ la moitié', 'Environ 1 sur 5', 'Uniquement les paires d\'As'], answer: 2, explain: 'La sélection est la base : environ 15 à 25 % des mains selon la position.', theme: 'preflop' },
            { q: 'Que signifie « AKs » ?', options: ['As-Roi de pique', 'As-Roi assortis (même couleur)', 'As-Roi « super »', 'As-Roi dépareillés'], answer: 1, explain: 's = suited (assortis). o = offsuit (dépareillés).', theme: 'preflop' },
            { q: 'Pourquoi K-7 dépareillés est-elle une main piège ?', options: ['Elle ne peut jamais gagner', 'Quand on touche le Roi, on est souvent battu par un meilleur kicker', 'Elle est interdite', 'Le 7 est trop fort'], answer: 1, explain: 'Elle est « dominée » par KQ, KJ, AK… qui ont la même paire et un meilleur kicker.', theme: 'preflop' },
            { q: 'Personne n\'a relancé et vous avez une main jouable. La meilleure habitude est de…', options: ['Suivre la grosse blinde (limper)', 'Ouvrir en relançant à environ 3 grosses blinds', 'Faire tapis', 'Dire parole'], answer: 1, explain: 'Relancer permet de gagner le pot immédiatement ou de jouer avec l\'initiative.', theme: 'preflop' }
          ]
        },
        {
          id: 'n2-l2', title: 'L\'importance de la position', theme: 'position-strat', exercises: ['preflop'],
          steps: [
            '<h3>Parler en dernier, c\'est savoir</h3><p>Après le flop, le joueur qui parle en dernier a vu les actions de tous les autres avant de décider. On dit qu\'il est <strong>« en position »</strong>. Il peut :</p><ul><li>miser quand tout le monde a montré de la faiblesse (parole) ;</li><li>prendre une carte gratuite quand il a un tirage ;</li><li>contrôler la taille du pot.</li></ul><p>Le joueur <strong>« hors de position »</strong> doit agir à l\'aveugle.</p>',
            '<h3>Adapter ses mains à sa position</h3><p>Plus vous parlez tôt, plus il reste de joueurs derrière vous qui peuvent avoir une grosse main : il faut donc être <strong>plus exigeant</strong>.</p><ul><li><strong>UTG</strong> (premier de parole) : uniquement les meilleures mains — grosses paires, AK, AQ.</li><li><strong>Milieu de table</strong> : on ajoute AJ, KQ, les paires moyennes.</li><li><strong>Cut-off et bouton</strong> : on ouvre beaucoup plus large — petites paires, As assortis, connecteurs assortis comme [[9h 8h]].</li></ul>',
            '<h3>Exemple</h3><div class="example-box"><strong>La même main, deux décisions</strong>[[Kd Jc]] en UTG à une table de 9 : couchez-vous. Huit joueurs peuvent encore se réveiller avec AK, AJ, KQ. La même main au bouton, quand tout le monde a passé : relancez. Il ne reste que les deux blinds, et vous aurez la position après le flop.</div><div class="key-box"><strong>À retenir</strong>Le bouton est la position la plus rentable de la table ; les blinds sont les moins rentables (on y mise sans choisir, puis on joue hors de position).</div>'
          ],
          quiz: [
            { q: 'Que signifie être « en position » ?', options: ['Être assis au milieu de la table', 'Parler après son adversaire', 'Avoir posé une blinde', 'Avoir le plus gros stack'], answer: 1, explain: 'Être en position, c\'est agir en dernier, donc avec plus d\'informations.', theme: 'position-strat' },
            { q: 'Depuis quelle position ouvre-t-on le plus de mains ?', options: ['UTG', 'Milieu de table', 'Le bouton', 'La petite blinde'], answer: 2, explain: 'Au bouton, il reste peu de joueurs à parler et vous aurez la position après le flop.', theme: 'position-strat' },
            { q: 'Table de 9 joueurs, vous êtes UTG avec K-J dépareillés. Que faites-vous ?', options: ['Je relance', 'Je suis', 'Je me couche', 'Je fais tapis'], answer: 2, explain: 'Trop de joueurs restent à parler et KJ est souvent dominée : on se couche en début de parole.', theme: 'position-strat' },
            { q: 'Pourquoi les blinds sont-elles des positions difficiles ?', options: ['On y reçoit de moins bonnes cartes', 'On mise sans choisir puis on parle en premier après le flop', 'On ne peut pas y relancer', 'On y joue une carte de moins'], answer: 1, explain: 'Mise forcée + hors de position pour tout le reste de la main.', theme: 'position-strat' }
          ]
        },
        {
          id: 'n2-l3', title: 'La notion de range', theme: 'ranges', exercises: [],
          steps: [
            '<h3>On ne devine pas une main, on estime un éventail</h3><p>Vous ne pouvez pas connaître les deux cartes de votre adversaire. En revanche, vous pouvez estimer <strong>l\'ensemble des mains qu\'il jouerait de cette façon</strong>. Cet ensemble s\'appelle une <strong>range</strong> (éventail de mains).</p><div class="example-box"><strong>Exemple</strong>Un joueur prudent relance en UTG. Sa range ressemble à : paires de 9 et plus, AK, AQ, AJ assortis, KQ assortis. Il n\'a « presque jamais » 7-2.</div>',
            '<h3>La range se réduit à chaque action</h3><p>Chaque décision de l\'adversaire élimine des mains :</p><ul><li>il relance avant le flop → on retire les mains faibles ;</li><li>il mise sur un flop [[Ks 8d 3c]] → il a souvent un Roi, une paire servie, ou parfois un bluff ;</li><li>il mise encore gros au turn et à la river → sa range se concentre sur les mains fortes.</li></ul><p>À l\'inverse, un joueur qui dit parole deux fois a rarement une très grosse main.</p>',
            '<h3>Lire le tableau des mains</h3><p>On représente une range sur une grille 13 × 13 : les paires sur la diagonale, les mains assorties au-dessus, les dépareillées en dessous.</p>{{range}}<div class="key-box"><strong>À retenir</strong>Posez-vous toujours la question : « Avec quelles mains ferait-il cela ? », jamais « Quelle main a-t-il ? ». Et souvenez-vous que vous aussi, vous avez une range aux yeux des autres.</div>'
          ],
          quiz: [
            { q: 'Qu\'est-ce qu\'une range ?', options: ['La taille d\'une mise', 'L\'ensemble des mains qu\'un joueur peut avoir dans une situation', 'Le classement des joueurs', 'Une suite de 5 cartes'], answer: 1, explain: 'Une range est un éventail de mains possibles, pas une main unique.', theme: 'ranges' },
            { q: 'Un joueur très prudent relance en premier de parole. Sa range est plutôt…', options: ['Très large (n\'importe quelles cartes)', 'Étroite et forte (grosses paires, gros As)', 'Composée surtout de bluffs', 'Impossible à estimer'], answer: 1, explain: 'Position difficile + joueur prudent = mains fortes uniquement.', theme: 'ranges' },
            { q: 'Votre adversaire dit parole au flop, puis parole au turn. Que peut-on en déduire ?', options: ['Il a sûrement un carré', 'Sa range contient peu de très grosses mains', 'Il va faire tapis', 'Rien du tout'], answer: 1, explain: 'Les grosses mains misent le plus souvent pour faire grossir le pot. Ce n\'est pas une certitude, mais une tendance.', theme: 'ranges' },
            { q: 'Sur la grille des mains de départ, où se trouvent les paires ?', options: ['Dans le coin en bas à droite', 'Sur la diagonale', 'Sur la première ligne', 'Elles n\'y figurent pas'], answer: 1, explain: 'AA, KK, QQ… occupent la diagonale ; les mains assorties sont au-dessus, les dépareillées en dessous.', theme: 'ranges' }
          ]
        },
        {
          id: 'n2-l4', title: 'Les outs et la règle du 2 et du 4', theme: 'outs', exercises: ['outs', 'outs'],
          steps: [
            '<h3>Qu\'est-ce qu\'un out ?</h3><p>Un <strong>out</strong> est une carte encore dans le paquet qui améliorerait votre main au point de (probablement) gagner.</p><div class="example-box"><strong>Tirage couleur</strong>Vous avez [[Ah 7h]], le flop est [[Kh 9h 2c]]. Il y a 13 cœurs dans le jeu ; vous en voyez 4. Il en reste <strong>9</strong> : vous avez 9 outs.</div><p>Les tirages les plus courants :</p><ul><li>tirage couleur : <strong>9 outs</strong> ;</li><li>tirage quinte par les deux bouts ([[Jd Tc]] sur [[9h 8s 2d]]) : <strong>8 outs</strong> ;</li><li>tirage quinte ventral ([[Jd Tc]] sur [[8h 7s 2d]], il manque le 9) : <strong>4 outs</strong> ;</li><li>deux cartes hautes sans paire : <strong>6 outs</strong> (fragiles).</li></ul>',
            '<h3>La règle du 2 et du 4</h3><p>Pour convertir vos outs en pourcentage de chances :</p><ul><li><strong>× 2</strong> pour une seule carte à venir (du flop au turn, ou du turn à la river) ;</li><li><strong>× 4</strong> pour deux cartes à venir (du flop jusqu\'à la river, par exemple si vous êtes à tapis).</li></ul><div class="example-box"><strong>Exemple</strong>Tirage couleur au flop, 9 outs. Chance de toucher au turn : 9 × 2 = <strong>18 %</strong> environ. Chance de toucher au turn ou à la river : 9 × 4 = <strong>36 %</strong> environ.</div>',
            '<h3>Attention aux faux outs</h3><p>Un out n\'est utile que s\'il vous donne la <strong>meilleure</strong> main. Si la carte qui complète votre quinte complète aussi une couleur possible pour l\'adversaire, comptez-la avec prudence.</p><div class="key-box"><strong>Quand deux tirages se cumulent</strong>Tirage couleur + tirage quinte par les deux bouts : 9 + 8 = 17, moins les 2 cartes comptées deux fois = <strong>15 outs</strong>. C\'est un tirage très puissant, souvent favori contre une simple paire.</div>'
          ],
          quiz: [
            { q: 'Combien d\'outs a un tirage couleur (4 cartes de la même couleur) ?', options: ['4', '8', '9', '13'], answer: 2, explain: '13 cartes de la couleur − 4 déjà visibles = 9.', theme: 'outs' },
            { q: 'Au flop, vous avez 8 outs. Quelle est environ votre chance de toucher sur la prochaine carte ?', options: ['8 %', '16 %', '32 %', '50 %'], answer: 1, explain: 'Une carte à venir : outs × 2 = 16 %.', theme: 'outs' },
            { q: 'Vous êtes à tapis au flop avec 9 outs. Quelle est environ votre chance de toucher d\'ici la river ?', options: ['9 %', '18 %', '36 %', '72 %'], answer: 2, explain: 'Deux cartes à venir : outs × 4 = 36 %.', theme: 'outs' },
            { q: 'Combien d\'outs ?', context: 'Vos cartes : [[Jd Tc]] — Flop : [[8h 7s 2d]]', options: ['4', '6', '8', '9'], answer: 0, explain: 'Seul un 9 complète la quinte (7-8-9-10-V) : 4 outs. C\'est un tirage ventral.', theme: 'outs' }
          ]
        },
        {
          id: 'n2-l5', title: 'Les cotes du pot (pot odds) et l\'équité', theme: 'pot-odds', exercises: ['potodds', 'potodds'],
          steps: [
            '<h3>L\'équité</h3><p>L\'<strong>équité</strong> (equity) est votre part théorique du pot : la fréquence à laquelle vous gagneriez si l\'on jouait la main jusqu\'au bout un grand nombre de fois. Avec 36 % de chances de gagner, vous « possédez » 36 % du pot.</p><h3>La cote du pot</h3><p>La <strong>cote du pot</strong> compare ce que vous devez payer à ce que vous pouvez gagner :</p><div class="key-box"><strong>Formule</strong>Cote du pot = montant à suivre ÷ (pot actuel, mise adverse comprise + montant à suivre)</div>',
            '<h3>Exemple pas à pas</h3><div class="example-box"><strong>Calcul</strong>Le pot contient 100. L\'adversaire mise 50. Le pot est maintenant de 150, et vous devez payer 50. Cote = 50 ÷ (150 + 50) = 50 ÷ 200 = <strong>25 %</strong>.</div><p>Cela signifie : pour que suivre soit rentable, il vous faut gagner <strong>au moins 25 % du temps</strong>.</p><p>Repères utiles : une mise d\'un demi-pot demande 25 % ; une mise des trois quarts du pot, 30 % ; une mise de la taille du pot, 33 %.</p>',
            '<h3>La décision</h3><p>Comparez votre équité à la cote du pot :</p><ul><li>équité <strong>supérieure</strong> à la cote → suivre est rentable à long terme ;</li><li>équité <strong>inférieure</strong> → se coucher.</li></ul><div class="example-box"><strong>Exemple</strong>Au turn, vous avez un tirage couleur : 9 outs × 2 = 18 %. L\'adversaire mise la moitié du pot : il vous faut 25 %. 18 % &lt; 25 % : suivre perd de l\'argent à long terme. S\'il n\'avait misé qu\'un quart du pot (cote 17 %), vous pouviez suivre.</div><p>Ce raisonnement ne garantit pas de gagner <em>cette</em> main : il garantit de prendre de bonnes décisions, qui paient sur la durée.</p>'
          ],
          quiz: [
            { q: 'Le pot est de 100, l\'adversaire mise 100. Quelle est la cote du pot ?', options: ['25 %', '33 %', '50 %', '100 %'], answer: 1, explain: '100 à payer ÷ (200 + 100) = 33 %.', theme: 'pot-odds' },
            { q: 'Votre équité est de 20 % et la cote du pot de 30 %. Que faites-vous ?', options: ['Je suis : 20 % c\'est déjà bien', 'Je me couche : je ne gagne pas assez souvent', 'Je relance toujours', 'Peu importe'], answer: 1, explain: 'Il faudrait gagner au moins 30 % du temps pour que suivre soit rentable.', theme: 'pot-odds' },
            { q: 'Qu\'est-ce que l\'équité ?', options: ['Le montant de la mise', 'Votre part théorique du pot, selon vos chances de gagner', 'Le nombre de joueurs en jeu', 'La taille de votre stack'], answer: 1, explain: 'L\'équité est votre pourcentage de chances de gagner le pot.', theme: 'pot-odds' },
            { q: 'Une mise d\'un demi-pot demande quelle équité minimale pour suivre ?', options: ['10 %', '25 %', '40 %', '50 %'], answer: 1, explain: 'Pot 100, mise 50 : 50 ÷ 200 = 25 %.', theme: 'pot-odds' }
          ]
        }
      ]
    },
    {
      id: 3, title: 'Niveau 3 — Joueur intermédiaire', subtitle: 'Relances, c-bet, bluff, lecture',
      mistakes: [
        `Ouvrir avec des tailles fantaisistes (relance minimale, ou cinq fois la blinde) au lieu d'une taille régulière.`,
        `Suivre un 3-bet hors de position avec des mains dominées comme A-10 ou K-J.`,
        `Faire une mise de continuation systématique, même contre trois adversaires sur un board dangereux.`,
        `Bluffer un joueur qui ne se couche jamais, ou raconter une histoire incohérente.`,
        `Choisir la taille de sa mise selon sa peur plutôt que selon le board et les mains qui peuvent payer.`
      ],
      lessons: [
        {
          id: 'n3-l1', title: 'Ouvrir le pot : taille de relance et isolation', theme: 'preflop-avance', exercises: ['preflop'],
          steps: [
            `<h3>Une taille régulière</h3><p>Quand vous êtes le premier à entrer dans le coup, relancez toujours d'une taille comparable, quelle que soit votre main : <strong>2,5 à 3 grosses blinds</strong>. Si vous relanciez plus gros avec vos As et plus petit avec vos mains moyennes, vos adversaires liraient votre jeu à livre ouvert.</p><ul><li>Ajoutez <strong>1 grosse blinde par joueur ayant limpé</strong> avant vous.</li><li>Depuis la petite blinde, relancez un peu plus gros (3 à 3,5 BB) : vous jouerez la suite hors de position.</li></ul><div class="mistakes-box"><strong>À éviter</strong>La relance minimale donne une cote excellente à tout le monde ; le limp abandonne l'initiative.</div>`,
            `<h3>Isoler et voler</h3><p><strong>Isoler</strong> : un joueur faible a limpé ? Relancez avec une main correcte pour jouer le pot seul contre lui, en position. C'est l'une des situations les plus rentables du poker.</p><p><strong>Voler les blinds</strong> : au cut-off et au bouton, quand tout le monde a passé, il ne reste que deux ou trois joueurs. Vous pouvez ouvrir beaucoup plus de mains : les blinds se couchent souvent, et sinon vous avez la position.</p><div class="example-box"><strong>Exemple</strong>Blinds 5/10. Deux joueurs limpent, vous êtes au bouton avec [[Ad Jd]]. Relancez à 50 (3 BB + 2 limpers) : soit vous gagnez 35 tout de suite, soit vous jouez un pot en position avec une bonne main.</div>`
          ],
          quiz: [
            { q: 'Quelle est la taille d\'ouverture standard quand personne n\'est entré dans le coup ?', options: ['La relance minimale (2 BB)', '2,5 à 3 grosses blinds', '6 grosses blinds', 'Cela dépend de la force de ma main'], answer: 1, explain: 'Une taille régulière de 2,5 à 3 BB, identique pour toutes vos mains, ne donne aucune information.', theme: 'preflop-avance' },
            { q: 'Blinds 5/10, deux joueurs ont limpé. Vous relancez avec une bonne main. À combien ?', options: ['20', '30', '50', '150'], answer: 2, explain: '3 BB + 1 BB par limper = 5 BB, soit 50.', theme: 'preflop-avance' },
            { q: 'Que signifie « isoler » un joueur ?', options: ['L\'empêcher de parler', 'Relancer après son limp pour jouer le pot seul contre lui', 'Changer de table', 'Faire tapis contre lui'], answer: 1, explain: 'On relance pour écarter les autres joueurs et affronter le joueur faible en tête-à-tête.', theme: 'preflop-avance' },
            { q: 'Pourquoi ouvrir plus de mains au bouton quand tout le monde a passé ?', options: ['Parce que les cartes y sont meilleures', 'Il ne reste que les blinds à battre et j\'aurai la position après le flop', 'Parce que c\'est obligatoire', 'Pour montrer mes cartes'], answer: 1, explain: 'Peu d\'adversaires restants + position garantie = ouverture large rentable.', theme: 'preflop-avance' }
          ]
        },
        {
          id: 'n3-l2', title: '3-bet, 4-bet et défense des blinds', theme: 'preflop-avance', exercises: ['potodds'],
          steps: [
            `<h3>Le 3-bet</h3><p>Sur-relancer une ouverture s'appelle un <strong>3-bet</strong> (la blinde est la 1<sup>re</sup> mise, l'ouverture la 2<sup>e</sup>). On 3-bet pour deux raisons :</p><ul><li><strong>Pour valeur</strong> : [[Qs Qd]] et mieux, [[As Kd]]. On veut être payé par moins bien.</li><li><strong>En bluff</strong> : de temps en temps, avec des mains comme [[As 5s]]. L'As en main rend moins probable que l'adversaire ait AA ou AK (on parle de « bloqueur »), et la main garde du potentiel.</li></ul><p>Taille : environ <strong>3 fois</strong> la relance adverse en position, <strong>4 fois</strong> hors de position.</p><p>Face à un 3-bet : sur-relancez encore (<strong>4-bet</strong>) avec KK, AA et parfois AK ; suivez en position avec JJ, AQ assortis ; couchez le reste. A-10 et K-J sont ici des pièges.</p>`,
            `<h3>Défendre sa grosse blinde</h3><p>En grosse blinde, vous avez déjà payé une partie de la mise : la cote est bonne.</p><div class="example-box"><strong>Calcul</strong>Blinds 5/10, le bouton ouvre à 25. Le pot contient 40. Il vous reste 15 à payer : 15 ÷ 55 = <strong>27 %</strong>. Beaucoup de mains ont plus de 27 % d'équité contre une ouverture large du bouton.</div><p>Défendez donc assez large contre une ouverture tardive : mains assorties, connecteurs, toutes les paires. Soyez plus strict contre une ouverture de début de parole (range forte).</p><div class="key-box"><strong>Petite blinde</strong>La cote y est moins bonne et vous serez hors de position face à tout le monde : préférez « 3-bet ou se coucher » plutôt que suivre.</div>`
          ],
          quiz: [
            { q: 'Qu\'est-ce qu\'un 3-bet ?', options: ['Une mise de trois fois le pot', 'La sur-relance d\'une première relance', 'La troisième mise au flop', 'Un tapis'], answer: 1, explain: 'Blinde = 1re mise, ouverture = 2e, sur-relance = 3e : le 3-bet.', theme: 'preflop-avance' },
            { q: 'Pourquoi A-5 assortis est-il un bon candidat au 3-bet en bluff ?', options: ['C\'est la meilleure main', 'L\'As bloque les mains premium adverses et la main garde du potentiel', 'Il gagne toujours au flop', 'Il n\'en est pas un'], answer: 1, explain: 'Avoir un As réduit les combinaisons AA et AK possibles en face ; A5s peut faire couleur et quinte.', theme: 'preflop-avance' },
            { q: 'Vous ouvrez avec A-10 dépareillés, un joueur sérieux vous 3-bet. Le plus souvent, il faut…', options: ['Faire tapis', 'Suivre hors de position', 'Se coucher', 'Relancer au minimum'], answer: 2, explain: 'A-10 est dominée par la range de 3-bet (AK, AQ, grosses paires).', theme: 'preflop-avance' },
            { q: 'Pourquoi défendre sa grosse blinde plus largement qu\'ailleurs ?', options: ['Parce qu\'on y a de meilleures cartes', 'Une partie de la mise est déjà payée : la cote du pot est bonne', 'Parce qu\'on y parle en dernier après le flop', 'Ce n\'est pas vrai'], answer: 1, explain: 'La blinde déjà postée réduit le prix à payer pour voir le flop.', theme: 'preflop-avance' }
          ]
        },
        {
          id: 'n3-l3', title: 'Mise de continuation et mise pour valeur', theme: 'cbet-value', exercises: [],
          steps: [
            `<h3>La mise de continuation (c-bet)</h3><p>Vous avez relancé avant le flop : vous représentez la main forte. Miser au flop, touché ou non, s'appelle un <strong>c-bet</strong>. L'adversaire rate le flop environ deux fois sur trois : il se couchera souvent.</p><p><strong>Bon moment</strong> : un seul adversaire, board sec avec une grosse carte ([[Ks 7d 2c]]). Une petite mise (un tiers du pot) suffit.</p><p><strong>Mauvais moment</strong> : trois adversaires, ou board bas et connecté ([[8h 7h 6c]]) qui a souvent aidé ceux qui ont suivi. Dites parole avec vos mains ratées.</p>`,
            `<h3>La mise pour valeur (value bet)</h3><p>Avant de miser une bonne main, posez-vous une seule question : <strong>« Quelles mains moins fortes peuvent me payer ? »</strong> S'il y en a beaucoup, misez. S'il n'y en a aucune, la mise ne sert à rien.</p><div class="example-box"><strong>Exemple</strong>Vous avez [[As Kd]] sur [[Kh 8c 3d 5s 2h]]. Un Roi plus faible, une paire de 8, une paire servie moyenne peuvent payer : misez aux trois tours contre un joueur qui suit facilement.</div><div class="mistakes-box"><strong>Erreur classique</strong>« Piéger » en disant parole avec une grosse main sur un board plein de tirages : vous offrez une carte gratuite qui peut vous battre, et vous ne faites pas grossir le pot.</div>`
          ],
          quiz: [
            { q: 'Qu\'est-ce qu\'un c-bet ?', options: ['Une mise faite par celui qui a relancé avant le flop', 'Une mise à la river uniquement', 'Un tapis au flop', 'Une mise de la grosse blinde'], answer: 0, explain: 'C-bet = mise de continuation : on poursuit l\'agression commencée avant le flop.', theme: 'cbet-value' },
            { q: 'Dans quelle situation le c-bet est-il le plus efficace ?', options: ['Contre 4 joueurs', 'Contre un seul joueur sur un board sec comme R-7-2', 'Sur un board 8-7-6 de la même couleur', 'Quand on n\'a pas relancé avant le flop'], answer: 1, explain: 'Un seul adversaire et un board qui favorise la range du relanceur.', theme: 'cbet-value' },
            { q: 'Quelle question se poser avant une mise pour valeur ?', options: ['Ai-je la meilleure main possible ?', 'Quelles mains moins fortes peuvent me payer ?', 'Combien ai-je déjà investi ?', 'Mon adversaire est-il sympathique ?'], answer: 1, explain: 'Une mise pour valeur n\'a de sens que si des mains plus faibles suivent.', theme: 'cbet-value' },
            { q: 'Vous avez un brelan sur un board avec tirages couleur et quinte. Que faire ?', options: ['Parole pour piéger', 'Miser assez gros pour faire payer les tirages', 'Miser le minimum', 'Se coucher'], answer: 1, explain: 'Sur un board dangereux, on fait payer : la carte gratuite coûte trop cher.', theme: 'cbet-value' }
          ]
        },
        {
          id: 'n3-l4', title: 'Bluff, semi-bluff et fold equity', theme: 'bluff', exercises: ['foldequity', 'foldequity'],
          steps: [
            `<h3>La fold equity</h3><p>Quand vous misez, vous pouvez gagner de deux manières : en ayant la meilleure main, ou parce que l'adversaire se couche. Cette seconde part s'appelle la <strong>fold equity</strong>.</p><div class="key-box"><strong>Seuil de rentabilité d'un bluff</strong>Fréquence de fold nécessaire = mise ÷ (pot + mise)</div><ul><li>Mise d'un tiers du pot : il doit se coucher <strong>25 %</strong> du temps.</li><li>Demi-pot : <strong>33 %</strong>.</li><li>Deux tiers du pot : <strong>40 %</strong>.</li><li>Pot : <strong>50 %</strong>.</li></ul><p>Un petit bluff n'a donc pas besoin de réussir souvent.</p>`,
            `<h3>Le semi-bluff</h3><p>Miser avec un tirage, c'est un <strong>semi-bluff</strong> : si l'adversaire se couche, vous gagnez tout de suite ; s'il suit, vous pouvez encore toucher. C'est le meilleur type de bluff.</p><p><strong>Bons candidats</strong> : tirages couleur et quinte, mains avec un bloqueur (un As de la couleur du tirage, par exemple).</p><p><strong>Mauvais bluffs</strong> :</p><ul><li>contre plusieurs adversaires ;</li><li>contre un joueur qui suit tout (on ne bluffe pas un « calling station ») ;</li><li>quand votre histoire est incohérente : parole, parole, puis grosse mise sur une carte qui ne change rien.</li></ul>`
          ],
          quiz: [
            { q: 'Qu\'est-ce que la fold equity ?', options: ['Vos chances de toucher votre tirage', 'La part de gain qui vient des abandons de l\'adversaire', 'Le montant du pot', 'Le droit de se coucher'], answer: 1, explain: 'C\'est ce que vous gagnez quand l\'adversaire se couche face à votre mise.', theme: 'bluff' },
            { q: 'Vous bluffez la moitié du pot. À quelle fréquence l\'adversaire doit-il se coucher pour que ce soit rentable ?', options: ['25 %', '33 %', '50 %', '67 %'], answer: 1, explain: 'Mise ÷ (pot + mise) = 0,5 ÷ 1,5 = 33 %.', theme: 'bluff' },
            { q: 'Pourquoi le semi-bluff est-il meilleur qu\'un bluff pur ?', options: ['Il coûte moins cher', 'Il peut gagner de deux façons : par abandon ou en touchant', 'Il est interdit de le suivre', 'Il ne l\'est pas'], answer: 1, explain: 'Fold equity + équité du tirage.', theme: 'bluff' },
            { q: 'Contre quel adversaire faut-il éviter de bluffer ?', options: ['Un joueur prudent', 'Un joueur qui suit presque toutes les mises', 'Un joueur qui se couche souvent', 'Un joueur fatigué'], answer: 1, explain: 'Contre un « calling station », on mise pour valeur et on ne bluffe pas.', theme: 'bluff' }
          ]
        },
        {
          id: 'n3-l5', title: 'Lire les ranges et choisir sa taille de mise', theme: 'lecture', exercises: ['potodds'],
          steps: [
            `<h3>L'entonnoir</h3><p>La range d'un joueur se resserre à chaque action, comme dans un entonnoir.</p><div class="example-box"><strong>Exemple</strong>Un joueur sérieux ouvre en début de parole : paires, gros As, grosses figures. Il mise sur [[Qh 9d 4c]] : il garde ses Dames, ses surpaires, quelques tirages et bluffs. Il mise encore gros au turn [[2s]] puis à la river [[7c]] : il ne reste presque que des mains fortes (AQ, KQ, surpaires, brelans). Votre paire de 9 ne bat presque plus rien.</div><p>Demandez-vous à chaque tour : « Quelles mains de sa range d'origine joueraient encore ainsi ? »</p>`,
            `<h3>Choisir sa taille de mise</h3><ul><li><strong>Board sec</strong> ([[Ks 7d 2c]]) : petite mise (un tiers du pot). L'adversaire a peu de tirages à payer.</li><li><strong>Board dangereux</strong> ([[Jh Th 8c]]) : grosse mise (deux tiers du pot ou plus). Faites payer les tirages.</li><li><strong>River avec une très forte main</strong> : misez gros si l'adversaire peut payer.</li></ul><div class="key-box"><strong>Principe</strong>Utilisez la même taille pour vos mises de valeur et vos bluffs dans une même situation. Sinon, la taille trahit votre main.</div><div class="mistakes-box"><strong>À éviter</strong>La petite mise « pour voir où j'en suis » avec une main moyenne : elle ne fait coucher personne de plus fort et s'expose à une relance.</div>`
          ],
          quiz: [
            { q: 'Un joueur sérieux mise au flop, au turn et à la river. Sa range est…', options: ['De plus en plus large', 'De plus en plus concentrée sur les mains fortes', 'Inchangée', 'Uniquement des bluffs'], answer: 1, explain: 'Chaque mise élimine des mains faibles : c\'est l\'entonnoir.', theme: 'lecture' },
            { q: 'Sur un board sec comme R-7-2 de couleurs différentes, quelle taille de mise privilégier ?', options: ['Un tiers du pot environ', 'Deux fois le pot', 'Toujours tapis', 'Aucune'], answer: 0, explain: 'Peu de tirages à faire payer : une petite mise accomplit le même travail pour moins cher.', theme: 'lecture' },
            { q: 'Pourquoi garder la même taille pour ses mises de valeur et ses bluffs ?', options: ['Pour aller plus vite', 'Pour que la taille ne révèle pas la force de la main', 'C\'est une règle officielle', 'Pour économiser des jetons'], answer: 1, explain: 'Des tailles différentes selon la main vous rendent lisible.', theme: 'lecture' },
            { q: 'Sur V-10-8 avec deux cœurs, vous avez un brelan. Quelle mise ?', options: ['Un quart du pot', 'Deux tiers du pot ou plus', 'Parole', 'Le minimum'], answer: 1, explain: 'Board plein de tirages : mise forte pour les faire payer.', theme: 'lecture' }
          ]
        }
      ]
    },
    {
      id: 4, title: 'Niveau 4 — Joueur avancé', subtitle: 'Stack, ranges, exploitation, ICM',
      mistakes: [
        `Jouer une top paire de la même façon avec 20 et avec 200 grosses blinds.`,
        `Bluffer sur un board où l'adversaire a l'avantage de range.`,
        `Tirer des conclusions sur un adversaire après dix mains seulement.`,
        `Ignorer la texture : traiter un board 9-8-7 assorti comme un board R-7-2.`,
        `En tournoi, suivre un tapis à la bulle avec une main moyenne parce que « la cote est bonne » en jetons.`
      ],
      lessons: [
        {
          id: 'n4-l1', title: 'Profondeur de stack et SPR', theme: 'stack', exercises: ['spr', 'spr'],
          steps: [
            `<h3>Le stack effectif</h3><p>Ce qui compte n'est pas votre stack, mais le <strong>stack effectif</strong> : le plus petit des deux stacks en présence. On ne peut pas gagner plus que ce que l'adversaire possède.</p><h3>Le SPR</h3><div class="key-box"><strong>SPR (stack-to-pot ratio)</strong>SPR = stack effectif ÷ pot, mesuré au flop</div><ul><li><strong>SPR bas (3 ou moins)</strong> : une top paire suffit pour engager tout son stack.</li><li><strong>SPR moyen (4 à 10)</strong> : prudence avec une seule paire ; il faut souvent deux paires ou mieux pour jouer un très gros pot.</li><li><strong>SPR élevé (plus de 10)</strong> : les très grosses mains et les tirages puissants prennent toute leur valeur.</li></ul>`,
            `<h3>Conséquences avant le flop</h3><p><strong>Stacks profonds</strong> (150 BB et plus) : les mains « spéculatives » montent en valeur — petites paires, connecteurs assortis comme [[8h 7h]]. Elles gagnent rarement, mais des pots énormes.</p><p><strong>Petits stacks</strong> (moins de 25 BB) : ces mêmes mains perdent leur intérêt ; les grosses cartes dominent. Sous <strong>12 BB</strong> environ, il n'y a plus de place pour relancer puis abandonner : on joue « tapis ou se coucher ».</p><div class="example-box"><strong>Exemple</strong>Pot de 60 au flop, stack effectif 180 : SPR = 3. Avec [[As Qd]] sur [[Qh 8c 3d]], vous pouvez vous engager sans regret. Avec 900 derrière (SPR 15), la même main devient une main à jouer prudemment si le pot grossit vite.</div>`
          ],
          quiz: [
            { q: 'Vous avez 2 000, votre adversaire 400. Quel est le stack effectif ?', options: ['2 000', '1 200', '400', '2 400'], answer: 2, explain: 'Le stack effectif est le plus petit des deux : on ne peut pas gagner plus.', theme: 'stack' },
            { q: 'Avec un SPR de 2 au flop et une top paire bon kicker, vous devez plutôt…', options: ['Vous coucher à la première mise', 'Accepter d\'engager votre stack', 'Dire parole jusqu\'à la river', 'Ne jouer que les brelans'], answer: 1, explain: 'Avec si peu de jetons derrière par rapport au pot, une top paire est une main forte.', theme: 'stack' },
            { q: 'Quelles mains gagnent en valeur avec des stacks très profonds ?', options: ['A-9 dépareillés', 'Petites paires et connecteurs assortis', 'R-5 dépareillés', 'Aucune'], answer: 1, explain: 'Elles font des mains cachées et très fortes qui gagnent de gros pots.', theme: 'stack' },
            { q: 'Avec 9 grosses blinds, la stratégie de base avant le flop est…', options: ['Limper pour voir des flops', 'Relancer petit puis aviser', 'Tapis ou se coucher', 'Attendre uniquement les As'], answer: 2, explain: 'Sous 12 BB environ, une relance engage déjà trop de jetons : on pousse ou on passe.', theme: 'stack' }
          ]
        },
        {
          id: 'n4-l2', title: 'Théorie des ranges : avantage, polarisation', theme: 'ranges-avance', exercises: [],
          steps: [
            `<h3>L'avantage de range</h3><p>Sur un board donné, l'une des deux ranges est en moyenne plus forte : elle a l'<strong>avantage de range</strong>. Le relanceur d'avant-flop l'a souvent sur les boards hauts ([[As Kd 7c]]) ; celui qui a suivi l'a plus souvent sur les boards bas et connectés ([[7h 6d 5c]]).</p><p>On parle d'<strong>avantage de nuts</strong> quand une range contient davantage de mains très fortes (brelans, doubles paires). C'est lui qui autorise les très grosses mises.</p><div class="key-box"><strong>Règle pratique</strong>Misez souvent et petit quand vous avez l'avantage de range ; misez gros quand vous avez l'avantage de nuts ; dites parole plus souvent quand vous n'avez ni l'un ni l'autre.</div>`,
            `<h3>Range linéaire, range polarisée</h3><ul><li><strong>Linéaire</strong> : vos meilleures mains, sans trou (par exemple miser toutes ses mains correctes sur un flop sec).</li><li><strong>Polarisée</strong> : des mains très fortes et des bluffs, mais rien entre les deux. C'est la forme normale d'une grosse mise à la river : les mains moyennes préfèrent dire parole.</li></ul><h3>Range plafonnée</h3><p>Un joueur qui se contente de suivre avant le flop n'a presque jamais AA ou KK (il aurait relancé) : sa range est <strong>plafonnée</strong>. On peut lui mettre la pression sur les boards où ces mains manquent.</p><div class="example-box"><strong>Exemple</strong>Vous ouvrez, la grosse blinde suit. Flop [[Ah Kc 4d]] : vous avez tous les AK, AA, KK ; lui presque aucun. Vous pouvez miser très souvent, pour une petite taille.</div>`
          ],
          quiz: [
            { q: 'Sur un flop A-R-7, qui a généralement l\'avantage de range ?', options: ['Celui qui a suivi en grosse blinde', 'Celui qui a relancé avant le flop', 'Personne', 'Le plus gros stack'], answer: 1, explain: 'Sa range contient plus de gros As et de Rois forts.', theme: 'ranges-avance' },
            { q: 'Qu\'est-ce qu\'une range polarisée ?', options: ['Uniquement des mains moyennes', 'Des mains très fortes et des bluffs, sans mains moyennes', 'Toutes les mains possibles', 'Uniquement des paires'], answer: 1, explain: 'Les deux « pôles » : le très fort et le très faible.', theme: 'ranges-avance' },
            { q: 'Un joueur a seulement suivi avant le flop. Sa range est dite « plafonnée » parce que…', options: ['Il a peu de jetons', 'Elle contient rarement les toutes meilleures mains', 'Il ne peut plus relancer', 'Il va se coucher'], answer: 1, explain: 'Avec AA ou KK, il aurait le plus souvent sur-relancé.', theme: 'ranges-avance' },
            { q: 'Quel avantage autorise les très grosses mises ?', options: ['L\'avantage de position seul', 'L\'avantage de nuts : plus de mains très fortes que l\'adversaire', 'Avoir relancé avant le flop', 'Aucun'], answer: 1, explain: 'On ne peut miser très gros de façon crédible que si l\'on a les meilleures mains plus souvent que l\'autre.', theme: 'ranges-avance' }
          ]
        },
        {
          id: 'n4-l3', title: 'Exploiter les tendances adverses', theme: 'exploit', exercises: [],
          steps: [
            `<h3>Quatre profils</h3><ul><li><strong>Le « calling station »</strong> (joue beaucoup de mains, relance peu, suit tout) : misez pour valeur plus souvent et plus gros ; ne bluffez jamais.</li><li><strong>Le joueur très serré</strong> (joue peu de mains) : volez ses blinds, et couchez-vous quand il mise fort.</li><li><strong>Le serré-agressif</strong> : le profil gagnant classique. Évitez les gros pots sans main forte.</li><li><strong>Le large-agressif</strong> (beaucoup de mains, beaucoup de relances) : suivez plus léger, laissez-le bluffer, sur-relancez pour valeur plus largement.</li></ul><p>Deux statistiques suffisent pour les reconnaître : le <strong>VPIP</strong> (mains jouées) et le <strong>PFR</strong> (mains relancées). Un grand écart entre les deux signale un joueur passif.</p>`,
            `<h3>La prudence statistique</h3><p>Dix mains ne prouvent rien : un joueur serré peut recevoir trois belles mains de suite. Attendez <strong>au moins une trentaine de mains</strong> avant d'ajuster fortement, et d'abord sur ce qui se voit vite (joue-t-il presque toutes les mains ? relance-t-il jamais ?).</p><div class="example-box"><strong>Exemple</strong>Un adversaire a joué 22 mains sur 30 et n'en a relancé que 2. À la river, il mise soudain gros. Un joueur aussi passif bluffe rarement : couchez vos mains moyennes sans regret. À l'inverse, quand vous avez une top paire contre lui, misez aux trois tours.</div><div class="key-box"><strong>À retenir</strong>Exploiter, c'est s'écarter du jeu standard dans la direction précise de l'erreur adverse — ni plus, ni dans tous les sens.</div>`
          ],
          quiz: [
            { q: 'Contre un joueur qui suit presque toutes les mises, il faut…', options: ['Bluffer plus souvent', 'Miser pour valeur plus souvent et arrêter de bluffer', 'Jouer moins de mains fortes', 'Faire tapis à chaque main'], answer: 1, explain: 'Il paie trop : faites-le payer avec vos bonnes mains.', theme: 'exploit' },
            { q: 'Un joueur a un VPIP de 60 % et un PFR de 5 %. C\'est un profil…', options: ['Serré-agressif', 'Large et passif', 'Très serré', 'Impossible'], answer: 1, explain: 'Il joue énormément de mains mais ne relance presque jamais.', theme: 'exploit' },
            { q: 'Un joueur très passif mise soudain très gros à la river. Sa main est le plus souvent…', options: ['Un bluff', 'Très forte', 'Moyenne', 'Impossible à estimer'], answer: 1, explain: 'Les joueurs passifs bluffent rarement : leurs grosses mises sont sincères.', theme: 'exploit' },
            { q: 'Après combien de mains peut-on commencer à ajuster sérieusement contre un adversaire ?', options: ['3', 'Une trentaine au minimum', '1 000', 'Jamais'], answer: 1, explain: 'Avant, le hasard de la distribution explique presque tout.', theme: 'exploit' }
          ]
        },
        {
          id: 'n4-l4', title: 'La texture du board', theme: 'texture', exercises: [],
          steps: [
            `<h3>Sec ou mouillé</h3><p>Un board <strong>sec</strong> offre peu de tirages : [[Ks 7d 2c]]. Un board <strong>mouillé</strong> en offre beaucoup : [[Jh Th 8c]].</p><h3>Statique ou dynamique</h3><p>Sur un board <strong>statique</strong> ([[Ah Ad 7c]]), la main la plus forte au flop le reste presque toujours. Sur un board <strong>dynamique</strong> ([[9h 8h 6d]]), une carte sur deux change tout au turn.</p><ul><li>Board sec et statique : petites mises, on peut prendre son temps avec ses grosses mains.</li><li>Board mouillé et dynamique : grosses mises pour protéger ; on se méfie des cartes qui complètent les tirages.</li></ul>`,
            `<h3>Boards pairés et monotones</h3><p><strong>Board pairé</strong> ([[9s 9d 4c]]) : peu de mains l'ont touché. Les bluffs y marchent souvent, mais un adversaire qui s'accroche peut avoir un brelan.</p><p><strong>Board monotone</strong> (trois cartes de la même couleur, [[Kh 8h 3h]]) : sans cœur en main, toute main devient fragile. Misez petit, avancez prudemment.</p><h3>Les cartes qui font peur</h3><p>Au turn et à la river, repérez les cartes qui changent la donne : la troisième carte d'une couleur, celle qui complète une quinte évidente, un As. Elles sont de bonnes occasions de bluffer quand elles favorisent <em>votre</em> range, et de bonnes raisons de ralentir quand elles favorisent celle de l'adversaire.</p>`
          ],
          quiz: [
            { q: 'Lequel de ces flops est le plus « mouillé » ?', options: ['R-7-2 de trois couleurs', 'V-10-8 avec deux cœurs', 'A-A-7', '9-9-4'], answer: 1, explain: 'Tirages quinte et couleur nombreux.', theme: 'texture' },
            { q: 'Sur un board dynamique comme 9-8-6 avec deux cœurs, avec une main forte il faut…', options: ['Dire parole pour piéger', 'Miser gros pour protéger sa main', 'Miser le minimum', 'Se coucher'], answer: 1, explain: 'Trop de cartes peuvent changer la situation : on fait payer tout de suite.', theme: 'texture' },
            { q: 'Flop R-8-3 tout à cœur, vous avez A-R sans cœur. Votre top paire est…', options: ['Invincible', 'Fragile : il faut avancer prudemment', 'Une couleur', 'À coucher immédiatement dans tous les cas'], answer: 1, explain: 'Une couleur est déjà possible et un quatrième cœur vous mettrait en grande difficulté.', theme: 'texture' },
            { q: 'Qu\'est-ce qu\'un board « statique » ?', options: ['Un board où la meilleure main au flop le reste presque toujours', 'Un board avec beaucoup de tirages', 'Un board sans As', 'Un board de cinq cartes'], answer: 0, explain: 'Peu de cartes à venir peuvent inverser la hiérarchie.', theme: 'texture' }
          ]
        },
        {
          id: 'n4-l5', title: 'L\'ICM en tournoi', theme: 'icm', exercises: [],
          steps: [
            `<h3>Les jetons ne sont pas de l'argent</h3><p>En cash game, 100 jetons valent toujours 100. En tournoi, non : on ne peut pas les encaisser, et les prix sont répartis entre plusieurs places. L'<strong>ICM</strong> (<em>Independent Chip Model</em>) convertit les stacks en valeur réelle.</p><div class="example-box"><strong>Exemple</strong>Trois joueurs restants, prix : 50 / 30 / 20. Stacks : 5 000, 3 000, 2 000. Le premier a 50 % des jetons, mais sa part des prix n'est que d'environ 38 % : même s'il gagne tous les jetons, il ne touchera « que » 50. Le plus petit stack, avec 20 % des jetons, vaut environ 29 % des prix : il a déjà la troisième place garantie.</div><div class="key-box"><strong>Conséquence</strong>Doubler son stack ne double pas sa valeur. Un jeton perdu coûte plus cher que ne rapporte un jeton gagné.</div>`,
            `<h3>Jouer la bulle</h3><p>La <strong>bulle</strong> est le moment où il reste un joueur de trop pour que tout le monde soit payé.</p><ul><li><strong>Suivez les tapis plus serré</strong> : pour risquer l'élimination, il faut une main nettement plus forte que ce qu'indique la cote en jetons.</li><li><strong>Poussez plus large</strong> : c'est celui qui mise le premier qui profite de la prudence des autres.</li><li><strong>Gros stack</strong> : mettez la pression sur les stacks moyens, qui ont le plus à perdre.</li><li><strong>Petit stack</strong> : n'attendez pas d'être réduit à rien ; sous 10 BB, cherchez une occasion de pousser.</li></ul><p>Dans les modes Tournoi et Sit & Go, la table affiche la valeur ICM estimée de votre stack.</p>`
          ],
          quiz: [
            { q: 'En tournoi, doubler son stack…', options: ['Double exactement sa valeur en prix', 'Augmente sa valeur, mais moins que du double', 'Ne change rien', 'Divise sa valeur par deux'], answer: 1, explain: 'Les prix sont répartis : les jetons supplémentaires valent de moins en moins.', theme: 'icm' },
            { q: 'Qu\'est-ce que la « bulle » ?', options: ['Le premier niveau de blinds', 'Le moment où il reste un joueur de trop avant les places payées', 'La table finale', 'Une mise obligatoire'], answer: 1, explain: 'Le prochain éliminé repart sans rien ; les suivants sont payés.', theme: 'icm' },
            { q: 'À la bulle, face à un tapis adverse, il faut…', options: ['Suivre plus large qu\'en cash game', 'Suivre plus serré : l\'élimination coûte très cher', 'Toujours suivre', 'Toujours se coucher, même avec les As'], answer: 1, explain: 'Le risque d\'élimination pèse plus lourd que le gain en jetons.', theme: 'icm' },
            { q: 'Qui profite le plus de la bulle ?', options: ['Le plus petit stack', 'Le gros stack, qui peut mettre la pression', 'Personne', 'Le donneur'], answer: 1, explain: 'Les stacks moyens ne veulent pas risquer leur tournoi contre lui.', theme: 'icm' }
          ]
        }
      ]
    },
    {
      id: 5, title: 'Niveau 5 — Expert', subtitle: 'GTO, fréquences, plan, mental',
      mistakes: [
        `Réciter des principes GTO contre des adversaires qui font des erreurs grossières, au lieu de les exploiter.`,
        `Se coucher trop souvent face aux mises : un adversaire attentif peut alors bluffer avec n'importe quoi.`,
        `Ne jamais bluffer à la river, ou bluffer sans tenir compte de la taille de sa mise.`,
        `Miser au flop sans plan pour le turn et la river.`,
        `Monter de limite après une bonne série, ou « se refaire » après une mauvaise.`
      ],
      lessons: [
        {
          id: 'n5-l1', title: 'Introduction à la stratégie GTO', theme: 'gto', exercises: ['mdf', 'mdf'],
          steps: [
            `<h3>Une stratégie inexploitable</h3><p><strong>GTO</strong> signifie <em>Game Theory Optimal</em> : une stratégie d'équilibre, telle qu'aucun adversaire ne peut gagner contre elle à long terme, quoi qu'il fasse. Elle ne cherche pas à punir les erreurs : elle garantit de ne pas en offrir.</p><p>Personne ne la joue parfaitement — elle est calculée par des logiciels (« solveurs ») dans des situations simplifiées. Mais ses principes servent de <strong>repères</strong> : fréquences de défense, proportion de bluffs, tailles de mise.</p><div class="key-box"><strong>L'indifférence</strong>À l'équilibre, votre adversaire ne gagne rien de plus à suivre qu'à se coucher avec ses mains moyennes : vos bluffs et vos mises de valeur sont dosés pour cela.</div>`,
            `<h3>La fréquence minimale de défense (MDF)</h3><p>Si vous vous couchez trop souvent face à une mise, l'adversaire gagne en bluffant avec n'importe quelles cartes. La <strong>MDF</strong> indique la part de votre range qu'il faut défendre (suivre ou relancer) pour l'en empêcher :</p><div class="key-box"><strong>Formule</strong>MDF = pot ÷ (pot + mise)</div><ul><li>Mise d'un tiers du pot : défendre <strong>75 %</strong>.</li><li>Demi-pot : <strong>67 %</strong>.</li><li>Pot : <strong>50 %</strong>.</li><li>Deux fois le pot : <strong>33 %</strong>.</li></ul><p>C'est un repère, pas une obligation : contre un joueur qui ne bluffe jamais, se coucher davantage est tout à fait correct (voir la leçon suivante).</p>`
          ],
          quiz: [
            { q: 'Que garantit une stratégie GTO ?', options: ['De gagner chaque main', 'De ne pas pouvoir être battue à long terme, quoi que fasse l\'adversaire', 'De toujours avoir la meilleure main', 'De gagner le plus possible contre les débutants'], answer: 1, explain: 'Elle est inexploitable, mais ne maximise pas le gain contre un joueur faible.', theme: 'gto' },
            { q: 'Face à une mise de la taille du pot, quelle part de sa range faut-il défendre (MDF) ?', options: ['25 %', '33 %', '50 %', '75 %'], answer: 2, explain: 'Pot ÷ (pot + mise) = 1 ÷ 2 = 50 %.', theme: 'gto' },
            { q: 'Que se passe-t-il si vous vous couchez beaucoup plus souvent que la MDF ?', options: ['Rien', 'L\'adversaire peut bluffer de façon rentable avec n\'importe quelle main', 'Vous gagnez plus', 'Le pot est annulé'], answer: 1, explain: 'Ses bluffs réussissent trop souvent : il n\'a plus besoin d\'avoir une main.', theme: 'gto' },
            { q: 'La MDF est-elle une règle absolue ?', options: ['Oui, toujours', 'Non : c\'est un repère, que l\'on quitte contre un adversaire qui bluffe trop peu ou trop', 'Oui, mais seulement au flop', 'Elle n\'existe pas'], answer: 1, explain: 'Contre un joueur qui ne bluffe jamais, se coucher davantage est plus rentable.', theme: 'gto' }
          ]
        },
        {
          id: 'n5-l2', title: 'GTO ou stratégie exploitative ?', theme: 'gto', exercises: [],
          steps: [
            `<h3>Deux approches complémentaires</h3><ul><li><strong>GTO</strong> : je joue de façon équilibrée et je ne peux pas être exploité. C'est le choix par défaut contre un inconnu ou un joueur fort.</li><li><strong>Exploitative</strong> : je repère une erreur précise de l'adversaire et je m'en écarte pour en profiter au maximum.</li></ul><div class="example-box"><strong>Exemple</strong>À la river, l'équilibre voudrait que vous bluffiez de temps en temps. Mais votre adversaire suit presque toutes les mises : la meilleure réponse n'est pas « bluffer un peu », c'est <strong>ne jamais bluffer</strong> et miser pour valeur plus largement.</div>`,
            `<h3>Le prix de l'exploitation</h3><p>Dès que vous quittez l'équilibre, vous devenez vous-même exploitable. Si vous ne bluffez plus jamais, un joueur attentif se couchera chaque fois que vous misez. La question est donc : <strong>mon adversaire est-il capable de s'en apercevoir et de s'adapter ?</strong></p><ul><li>Contre des joueurs faibles ou inattentifs : exploitez au maximum.</li><li>Contre des joueurs forts : restez proche de l'équilibre et ajustez à petites touches.</li></ul><div class="key-box"><strong>Dans cette application</strong>Les bots « Débutant » ne s'adaptent pas : exploitez-les sans retenue. L'« Expert simulé » observe vos tendances (fréquence de relance, d'abandon) et ajuste ses bluffs et ses calls : variez votre jeu contre lui.</div>`
          ],
          quiz: [
            { q: 'Contre un adversaire inconnu et visiblement compétent, l\'approche par défaut est…', options: ['Bluffer à chaque main', 'Un jeu équilibré, proche du GTO', 'Ne jouer que les As', 'Suivre toutes les mises'], answer: 1, explain: 'Sans information exploitable, on évite d\'offrir des failles.', theme: 'gto' },
            { q: 'Votre adversaire suit presque toutes les mises. La meilleure adaptation est de…', options: ['Bluffer un peu, comme à l\'équilibre', 'Ne plus bluffer et miser pour valeur plus largement', 'Bluffer davantage', 'Se coucher plus'], answer: 1, explain: 'On s\'écarte de l\'équilibre dans la direction de son erreur.', theme: 'gto' },
            { q: 'Quel est le risque d\'une stratégie exploitative ?', options: ['Aucun', 'Devenir soi-même exploitable si l\'adversaire s\'adapte', 'Perdre sa place à table', 'Jouer trop lentement'], answer: 1, explain: 'Quitter l\'équilibre ouvre une faille : elle ne coûte rien tant que l\'autre ne la voit pas.', theme: 'gto' },
            { q: 'Contre quel type de joueur exploite-t-on au maximum ?', options: ['Un joueur fort et attentif', 'Un joueur faible qui ne s\'adapte pas', 'Un joueur qu\'on ne connaît pas', 'Aucun'], answer: 1, explain: 'Il ne corrigera pas son erreur : autant en profiter pleinement.', theme: 'gto' }
          ]
        },
        {
          id: 'n5-l3', title: 'Fréquences de bluff et de mise pour valeur', theme: 'frequences', exercises: ['bluffratio', 'bluffratio'],
          steps: [
            `<h3>Combien de bluffs à la river ?</h3><p>Quand vous misez à la river avec une range polarisée, l'adversaire ne peut vous battre qu'en vous attrapant en bluff. Pour qu'il soit indifférent entre suivre et se coucher, votre part de bluffs doit égaler <strong>la cote que vous lui offrez</strong> :</p><div class="key-box"><strong>Formule</strong>Part de bluffs = mise ÷ (pot + 2 × mise)</div><ul><li>Demi-pot : <strong>25 %</strong> de bluffs (3 mises de valeur pour 1 bluff).</li><li>Pot : <strong>33 %</strong> (2 pour 1).</li><li>Deux fois le pot : <strong>40 %</strong> (3 pour 2).</li></ul><p>Plus vous misez gros, plus vous avez le droit de bluffer.</p>`,
            `<h3>Avant la river : plus de bluffs</h3><p>Au flop et au turn, vos « bluffs » sont surtout des semi-bluffs : ils gardent des chances de s'améliorer. On peut donc en avoir davantage qu'à la river — environ deux pour une mise de valeur au flop, un pour une au turn, selon les tailles.</p><h3>Choisir ses bluffs</h3><ul><li>Les mains qui ont <strong>le moins de chances de gagner à l'abattage</strong> : inutile de transformer en bluff une main qui gagne parfois en disant parole.</li><li>Les mains avec des <strong>bloqueurs</strong> : tenir l'As de la couleur présente au board réduit les chances que l'adversaire ait la couleur maximale.</li></ul><div class="mistakes-box"><strong>Deux excès</strong>Ne jamais bluffer : vos mises ne sont plus payées. Trop bluffer : vous offrez de l'argent à quiconque suit.</div>`
          ],
          quiz: [
            { q: 'Vous misez la taille du pot à la river. Quelle part de bluffs rend l\'adversaire indifférent ?', options: ['10 %', '25 %', '33 %', '50 %'], answer: 2, explain: 'Mise ÷ (pot + 2 × mise) = 1 ÷ 3 = 33 %.', theme: 'frequences' },
            { q: 'Plus votre mise est grosse, plus votre proportion de bluffs peut être…', options: ['Faible', 'Élevée', 'Nulle', 'Identique'], answer: 1, explain: 'Une grosse mise offre une moins bonne cote : il faut plus de bluffs pour que suivre reste tentant.', theme: 'frequences' },
            { q: 'Pourquoi peut-on bluffer plus souvent au flop qu\'à la river ?', options: ['Les adversaires sont distraits', 'Les semi-bluffs gardent des chances de s\'améliorer', 'Le pot est plus gros', 'On ne peut pas'], answer: 1, explain: 'À la river, un bluff qui est suivi a perdu ; au flop, il peut encore toucher.', theme: 'frequences' },
            { q: 'Quelle main fait le meilleur bluff à la river ?', options: ['Une main qui gagne souvent à l\'abattage', 'Une main sans valeur d\'abattage, si possible avec un bloqueur', 'Une top paire', 'Un brelan'], answer: 1, explain: 'On ne gâche pas une main qui peut gagner en disant parole.', theme: 'frequences' }
          ]
        },
        {
          id: 'n5-l4', title: 'Stratégies mixtes et plan sur plusieurs tours', theme: 'multistreet', exercises: [],
          steps: [
            `<h3>Jouer une même main de deux façons</h3><p>À l'équilibre, certaines mains sont jouées tantôt d'une manière, tantôt d'une autre : par exemple miser 70 % du temps et dire parole 30 %. C'est une <strong>stratégie mixte</strong>. Elle rend votre jeu imprévisible : l'adversaire ne peut rien déduire d'une parole.</p><p>En pratique, inutile de viser des pourcentages exacts. Retenez l'idée : <strong>ne jouez pas toujours la même main de la même manière</strong>. Certains joueurs s'en remettent à un tirage neutre, comme la couleur d'une de leurs cartes ou la trotteuse d'une montre.</p>`,
            `<h3>Avoir un plan</h3><p>Avant de miser au flop, demandez-vous ce que vous ferez au turn et à la river. Le pot grossit très vite :</p><div class="example-box"><strong>Géométrie des mises</strong>Trois mises des deux tiers du pot, toutes suivies, multiplient le pot par près de 13. Un pot de 100 au flop devient 233, puis 544, puis environ 1 270. Avec 600 jetons derrière vous au flop, votre stack entier sera donc au milieu à la river.</div><ul><li>Avec une main très forte : choisissez des tailles qui amènent le tapis à la river.</li><li>Avec une main moyenne : ne visez pas trois tours de mise ; un ou deux suffisent (« contrôle du pot »).</li><li>Avec un bluff : votre histoire doit rester cohérente d'un tour à l'autre.</li></ul><p>L'analyse d'après-main de cette application commente votre ligne sur l'ensemble des tours.</p>`
          ],
          quiz: [
            { q: 'Qu\'est-ce qu\'une stratégie mixte ?', options: ['Jouer deux tables à la fois', 'Jouer une même main de plusieurs façons, selon des fréquences', 'Alterner cash game et tournoi', 'Mélanger ses jetons'], answer: 1, explain: 'Par exemple miser parfois et dire parole parfois avec la même main.', theme: 'multistreet' },
            { q: 'À quoi sert une stratégie mixte ?', options: ['À jouer plus vite', 'À rester imprévisible', 'À gagner chaque main', 'À rien'], answer: 1, explain: 'L\'adversaire ne peut pas déduire votre main de votre action.', theme: 'multistreet' },
            { q: 'Trois mises des deux tiers du pot, toutes suivies, multiplient le pot par environ…', options: ['3', '6', '13', '30'], answer: 2, explain: '1 → 2,33 → 5,44 → 12,7.', theme: 'multistreet' },
            { q: 'Avec une main moyenne (une top paire kicker faible), combien de tours de mise viser en général ?', options: ['Trois, toujours', 'Un ou deux : on contrôle la taille du pot', 'Aucun, on se couche', 'Tapis au flop'], answer: 1, explain: 'Trois grosses mises ne sont payées que par mieux.', theme: 'multistreet' }
          ]
        },
        {
          id: 'n5-l5', title: 'Bankroll avancée et gestion du tilt', theme: 'mental', exercises: [],
          steps: [
            `<h3>La variance</h3><p>Même un très bon joueur perd pendant de longues périodes : c'est la <strong>variance</strong>. Une bankroll sert à y survivre sans changer sa façon de jouer.</p><ul><li><strong>Cash game</strong> : 20 à 30 caves pour la limite jouée.</li><li><strong>Tournois et Sit & Go</strong> : 50 à 100 buy-ins. On n'y est payé que rarement ; les séries sans gain sont longues.</li></ul><div class="key-box"><strong>Monter et descendre</strong>Montez de limite quand vous avez la bankroll <em>et</em> des résultats sur un grand nombre de mains. Descendez sans amour-propre dès que vous passez sous le seuil : c'est ce qui distingue un joueur durable.</div>`,
            `<h3>Le tilt</h3><p>Le <strong>tilt</strong> est l'état où l'émotion décide à votre place : après un mauvais coup, on joue trop de mains, on bluffe par colère, on veut « se refaire ».</p><p><strong>Signes d'alerte</strong> : vous rejouez mentalement la main précédente, vous relancez par agacement, vous montez de limite pour récupérer vos pertes.</p><p><strong>Garde-fous</strong> :</p><ul><li>une limite de perte par session (par exemple trois caves), après laquelle vous arrêtez ;</li><li>une pause de quelques minutes après chaque gros coup perdu ;</li><li>une revue à froid : l'onglet Historique permet de juger la décision, pas le résultat.</li></ul><p>Ces habitudes valent pour toute activité où l'argent est en jeu. Ici tout est virtuel : c'est l'endroit idéal pour les installer.</p>`
          ],
          quiz: [
            { q: 'Combien de buy-ins conseille-t-on pour jouer des tournois ?', options: ['3 à 5', '10', '50 à 100', '1 000'], answer: 2, explain: 'Les gains y sont rares et concentrés : il faut une réserve bien plus grande qu\'en cash game.', theme: 'mental' },
            { q: 'Qu\'est-ce que la variance ?', options: ['Une erreur de jeu', 'Les écarts de résultats dus au hasard, même en jouant bien', 'Le montant des blinds', 'Une taille de mise'], answer: 1, explain: 'À court terme, la chance domine ; à long terme, la qualité des décisions.', theme: 'mental' },
            { q: 'Après trois caves perdues dans la session, la bonne décision est de…', options: ['Monter de limite pour se refaire', 'Arrêter la session', 'Bluffer davantage', 'Jouer plus de mains'], answer: 1, explain: 'Une limite de perte fixée à l\'avance protège du tilt.', theme: 'mental' },
            { q: 'Comment évaluer une session ?', options: ['Sur le gain ou la perte du jour', 'Sur la qualité des décisions, relues à froid', 'Sur le nombre de mains jouées', 'Sur le nombre de bluffs réussis'], answer: 1, explain: 'Le résultat d\'une session dépend surtout du hasard ; les décisions, non.', theme: 'mental' }
          ]
        }
      ]
    }
  ];

  /** Questions de situation après le flop (mode Défi). */
  const POSTFLOP_BANK = [
    { q: 'Vous avez relancé avant le flop, un seul adversaire a suivi. Il dit parole. Que faites-vous ?', context: 'Vos cartes : [[As Kd]] — Flop : [[Kh 8c 3d]] — Pot : 70', options: ['Parole, pour le piéger', 'Miser environ la moitié du pot', 'Faire tapis', 'Me coucher'], answer: 1, explain: 'Top paire, meilleur kicker, sur un board sec : misez pour valeur. Des Rois plus faibles et des paires intermédiaires vous paieront.', theme: 'postflop' },
    { q: 'L\'adversaire mise 50 dans un pot de 100 au turn. Que faites-vous ?', context: 'Vos cartes : [[Ah 7h]] — Board : [[Kh 9h 2c 4s]]', options: ['Suivre : j\'ai un tirage couleur', 'Me coucher : 18 % de chances contre 25 % demandés', 'Relancer à tapis', 'Parole'], answer: 1, explain: '9 outs × 2 = 18 %. La cote demandée est 50 ÷ 200 = 25 %. Sans autre élément, suivre n\'est pas rentable.', theme: 'postflop' },
    { q: 'River. Vous avez raté votre tirage et l\'adversaire mise le pot. Que faites-vous ?', context: 'Vos cartes : [[Qd Jd]] — Board : [[Td 9s 2d 4c 3h]]', options: ['Suivre avec hauteur Dame', 'Me coucher', 'Suivre parce que j\'ai déjà beaucoup investi', 'Dire parole'], answer: 1, explain: 'Hauteur Dame ne bat presque aucune main qui mise. L\'argent déjà mis ne vous appartient plus : il ne doit pas influencer la décision.', theme: 'postflop' },
    { q: 'Trois adversaires voient le flop. Vous n\'avez rien touché. Tout le monde dit parole jusqu\'à vous, au bouton.', context: 'Vos cartes : [[7c 6c]] — Flop : [[Ah Kd Qs]]', options: ['Bluffer en misant le pot', 'Dire parole et abandonner si quelqu\'un mise', 'Faire tapis', 'Miser petit à chaque tour'], answer: 1, explain: 'Bluffer contre trois joueurs sur un board plein de grosses cartes réussit rarement : au moins l\'un d\'eux a souvent touché.', theme: 'postflop' },
    { q: 'Vous touchez un brelan au flop. Le board est dangereux. L\'adversaire dit parole.', context: 'Vos cartes : [[8s 8d]] — Flop : [[8h 9h Th]] — Pot : 80', options: ['Parole pour piéger', 'Miser gros (environ les deux tiers du pot)', 'Me coucher par peur de la couleur', 'Miser le minimum'], answer: 1, explain: 'Sur un board avec autant de tirages (quinte, couleur), faites payer cher les mains qui veulent voir une carte de plus.', theme: 'postflop' },
    { q: 'River : la couleur possible est arrivée. Vous avez top paire, l\'adversaire qui s\'était contenté de suivre jusque-là, fait soudain une grosse mise.', context: 'Vos cartes : [[Ad Jc]] — Board : [[Jh 7h 2s 5d 9h]]', options: ['Suivre sans réfléchir', 'Envisager sérieusement de me coucher', 'Relancer à tapis', 'C\'est forcément un bluff'], answer: 1, explain: 'Suivre puis miser gros quand le tirage rentre : sa range contient beaucoup de couleurs. Une top paire devient une main fragile ; contre une grosse mise, se coucher est raisonnable.', theme: 'postflop' },
    { q: 'Vous avez une paire servie de Rois. Le flop apporte un As. L\'adversaire, qui avait suivi votre relance, mise.', context: 'Vos cartes : [[Ks Kd]] — Flop : [[Ac 7d 2h]]', options: ['Faire tapis : j\'ai les Rois', 'Suivre une mise raisonnable et rester prudent ensuite', 'Me coucher immédiatement dans tous les cas', 'Relancer très gros'], answer: 1, explain: 'L\'As fait peur, mais l\'adversaire n\'en a pas toujours un. Suivre une mise modérée puis réévaluer est le compromis : ni tapis, ni abandon automatique.', theme: 'postflop' },
    { q: 'Vous êtes en position avec un tirage couleur. L\'adversaire dit parole au flop.', context: 'Vos cartes : [[Kh Th]] — Flop : [[8h 5h 2c]] — Pot : 60', options: ['Les deux options se défendent : miser en semi-bluff ou prendre la carte gratuite', 'Je dois me coucher', 'Seul le tapis est correct', 'Il est interdit de miser sans paire'], answer: 0, explain: 'Miser (semi-bluff) peut gagner tout de suite et garde 9 outs si l\'on est suivi ; dire parole donne une carte gratuite. Les deux se défendent.', theme: 'postflop' }
  ];

  /* ========================================================================
     2. EXERCICES GÉNÉRÉS
     ======================================================================== */
  function newRng() { return P.RNG(P.RNG.randomSeed()); }
  function pick(arr, rng) { return arr[rng.int(arr.length)]; }
  function pctText(x) { return Math.round(x) + ' %'; }

  /** Mélange l'ordre des réponses d'une question (copie). */
  function shuffleOptions(q, rng) {
    const order = P.shuffle(q.options.map(function (_, i) { return i; }), rng);
    return {
      q: q.q, context: q.context || '', explain: q.explain, theme: q.theme,
      options: order.map(function (i) { return q.options[i]; }),
      answer: order.indexOf(q.answer)
    };
  }

  const Generators = {
    /** Reconnaître une combinaison parmi 7 cartes. */
    ranking: function (rng) {
      const target = pick([1, 2, 2, 3, 4, 4, 5, 5, 6], rng);
      let cards, ev;
      for (let i = 0; i < 400; i++) {
        cards = P.shuffle(P.createDeck(), rng).slice(0, 7);
        ev = P.evaluate7(cards);
        if (ev.category === target) break;
      }
      const names = P.CATEGORY_NAMES;
      const wrong = [];
      [1, -1, 2, -2, 3, -3].forEach(function (d) {
        const c = ev.category + d;
        if (c >= 0 && c <= 8 && wrong.length < 3) wrong.push(names[c]);
      });
      const opts = P.shuffle([names[ev.category]].concat(wrong), rng);
      return {
        q: 'Quelle est votre meilleure combinaison de 5 cartes ?',
        context: 'Vos cartes : [[' + cards.slice(0, 2).join(' ') + ']] — Board : [[' + cards.slice(2).join(' ') + ']]',
        options: opts, answer: opts.indexOf(names[ev.category]),
        explain: ev.description + ' : [[' + ev.best5.join(' ') + ']]', theme: 'mains'
      };
    },

    /** Désigner le gagnant à l'abattage. */
    winner: function (rng) {
      let a, b, board, ea, eb;
      for (let i = 0; i < 200; i++) {
        const d = P.shuffle(P.createDeck(), rng);
        a = d.slice(0, 2); b = d.slice(2, 4); board = d.slice(4, 9);
        ea = P.evaluate7(a.concat(board)); eb = P.evaluate7(b.concat(board));
        if (ea.category >= 1 && eb.category >= 1 && Math.abs(ea.category - eb.category) <= 1) break;
      }
      const cmp = P.compareHands(ea, eb);
      return {
        q: 'Qui gagne à l\'abattage ?',
        context: 'Board : [[' + board.join(' ') + ']] — Joueur A : [[' + a.join(' ') + ']] — Joueur B : [[' + b.join(' ') + ']]',
        options: ['Joueur A', 'Joueur B', 'Égalité (partage du pot)'], answer: cmp > 0 ? 0 : cmp < 0 ? 1 : 2,
        explain: 'Joueur A : ' + ea.description + ' [[' + ea.best5.join(' ') + ']]. Joueur B : ' + eb.description + ' [[' + eb.best5.join(' ') + ']].',
        theme: 'abattage'
      };
    },

    /** Compter ses outs. */
    outs: function (rng) {
      const t = pick([
        { h: 'Ah 7h', b: 'Kh 9h 2c', n: 9, goal: 'une couleur', why: '13 cœurs − 4 visibles = 9 outs.' },
        { h: 'Jd Tc', b: '9h 8s 2d', n: 8, goal: 'une quinte', why: 'Les quatre Dames et les quatre 7 complètent la quinte : 8 outs.' },
        { h: 'Jd Tc', b: '8h 7s 2d', n: 4, goal: 'une quinte', why: 'Seuls les quatre 9 complètent la quinte : 4 outs (tirage ventral).' },
        { h: '9h 8h', b: '7h 6h Kc', n: 15, goal: 'une quinte ou une couleur', why: '9 cœurs + 8 cartes pour la quinte (les 10 et les 5) − 2 comptées deux fois = 15 outs.' },
        { h: 'Ad Kc', b: '9h 6s 2d', n: 6, goal: 'une paire d\'As ou de Rois', why: 'Trois As + trois Rois = 6 outs.' },
        { h: '7d 7c', b: '7h Ks 2d', n: 7, goal: 'un full ou un carré', why: 'Le dernier 7 (carré), trois Rois et trois 2 (full) : 1 + 3 + 3 = 7 outs.' },
        { h: 'Qh Jh', b: '9h 8c 2h', n: 12, goal: 'une quinte ou une couleur', why: '9 cœurs + 4 Dix pour la quinte − 1 (le 10 de cœur compté deux fois) = 12 outs.' },
        { h: 'Ad Jc', b: 'Jh 8s 3d', n: 5, goal: 'un brelan ou une double paire', why: 'Deux Valets (brelan) + trois As (double paire) = 5 outs.' }
      ], rng);
      const pool = [4, 5, 6, 7, 8, 9, 12, 15].filter(function (x) { return x !== t.n; });
      const opts = P.shuffle(pool, rng).slice(0, 3).concat([t.n]).sort(function (x, y) { return x - y; }).map(String);
      return {
        q: 'Combien d\'outs avez-vous pour obtenir ' + t.goal + ' ?',
        context: 'Vos cartes : [[' + t.h + ']] — Flop : [[' + t.b + ']]',
        options: opts, answer: opts.indexOf(String(t.n)), explain: t.why, theme: 'outs'
      };
    },

    /** Calculer une cote du pot, ou décider avec un tirage. */
    potodds: function (rng) {
      const pot = pick([40, 60, 80, 100, 120, 160, 200, 300], rng);
      if (rng.int(2) === 0) {
        const f = pick([0.25, 0.5, 0.75, 1], rng);
        const bet = Math.round(pot * f);
        const need = 100 * bet / (pot + 2 * bet);
        const opts = ['17 %', '25 %', '30 %', '33 %'];
        return {
          q: 'Le pot est de ' + pot + '. L\'adversaire mise ' + bet + '. Quelle équité minimale vous faut-il pour suivre ?',
          options: opts, answer: [0.25, 0.5, 0.75, 1].indexOf(f),
          explain: bet + ' à payer ÷ (' + (pot + bet) + ' + ' + bet + ') = ' + pctText(need) + '.', theme: 'pot-odds'
        };
      }
      let outs, f, bet, eq, need;
      for (let i = 0; i < 50; i++) {
        outs = pick([4, 8, 9, 12, 15], rng);
        f = pick([0.25, 0.5, 0.75, 1], rng);
        bet = Math.round(pot * f);
        eq = outs * 2; need = 100 * bet / (pot + 2 * bet);
        if (Math.abs(eq - need) >= 4) break;
      }
      const yes = eq >= need;
      return {
        q: 'Au turn, vous avez un tirage à ' + outs + ' outs. Le pot est de ' + pot + ' et l\'adversaire mise ' + bet + '. Avez-vous la cote pour suivre ?',
        options: ['Oui, suivre est rentable', 'Non, il faut se coucher'], answer: yes ? 0 : 1,
        explain: 'Vos chances : ' + outs + ' × 2 = ' + eq + ' %. Cote du pot : ' + bet + ' ÷ ' + (pot + 2 * bet) + ' = ' + pctText(need) + '. ' + (yes ? 'Vos chances dépassent la cote : suivez.' : 'Vos chances sont inférieures à la cote : couchez-vous.'),
        theme: 'pot-odds'
      };
    },

    /** Fold equity : fréquence de fold nécessaire pour qu'un bluff soit rentable. */
    foldequity: function (rng) {
      const pot = pick([60, 90, 120, 150, 300], rng);
      const i = rng.int(4);
      const bet = Math.round(pot * [1 / 3, 0.5, 2 / 3, 1][i]);
      return {
        q: 'Vous bluffez ' + bet + ' dans un pot de ' + pot + '. À quelle fréquence l\'adversaire doit-il se coucher pour que ce bluff soit rentable à lui seul ?',
        options: ['25 %', '33 %', '40 %', '50 %'], answer: i,
        explain: 'Mise ÷ (pot + mise) = ' + bet + ' ÷ ' + (pot + bet) + ' = ' + pctText(100 * bet / (pot + bet)) + '.', theme: 'bluff'
      };
    },

    /** Fréquence minimale de défense face à une mise. */
    mdf: function (rng) {
      const pot = pick([60, 90, 120, 150, 300], rng);
      const i = rng.int(4);
      const bet = Math.round(pot * [2, 1, 0.5, 1 / 3][i]);
      return {
        q: 'Le pot est de ' + pot + ' et l\'adversaire mise ' + bet + '. Quelle part de votre range faut-il défendre au minimum (MDF) pour qu\'il ne puisse pas bluffer à volonté ?',
        options: ['33 %', '50 %', '67 %', '75 %'], answer: i,
        explain: 'Pot ÷ (pot + mise) = ' + pot + ' ÷ ' + (pot + bet) + ' = ' + pctText(100 * pot / (pot + bet)) + '.', theme: 'gto'
      };
    },

    /** Proportion de bluffs équilibrée à la river selon la taille de mise. */
    bluffratio: function (rng) {
      const pot = pick([60, 100, 120, 200, 300], rng);
      const i = rng.int(4);
      const bet = Math.round(pot * [0.25, 0.5, 1, 2][i]);
      return {
        q: 'À la river, vous misez ' + bet + ' dans un pot de ' + pot + ' avec une range polarisée. Quelle part de bluffs rend votre adversaire indifférent entre suivre et se coucher ?',
        options: ['17 %', '25 %', '33 %', '40 %'], answer: i,
        explain: 'Mise ÷ (pot + 2 × mise) = ' + bet + ' ÷ ' + (pot + 2 * bet) + ' = ' + pctText(100 * bet / (pot + 2 * bet)) + '.', theme: 'frequences'
      };
    },

    /** Calculer un SPR et en tirer la conséquence. */
    spr: function (rng) {
      const pot = pick([40, 60, 100, 150], rng);
      const i = rng.int(4);
      const spr = [2, 5, 9, 15][i];
      const mine = pot * spr + pick([0, 200, 500], rng), other = pot * spr;
      if (rng.int(2) === 0) {
        return {
          q: 'Au flop, le pot est de ' + pot + '. Vous avez ' + mine + ' jetons, votre adversaire ' + other + '. Quel est le SPR ?',
          options: ['2', '5', '9', '15'], answer: i,
          explain: 'Stack effectif (le plus petit des deux) ÷ pot = ' + other + ' ÷ ' + pot + ' = ' + spr + '.', theme: 'stack'
        };
      }
      const low = spr <= 3;
      return {
        q: 'Au flop, le pot est de ' + pot + ' et le stack effectif de ' + other + ' (SPR ' + spr + '). Vous avez une top paire avec un bon kicker. Quelle attitude adopter ?',
        options: ['Accepter d\'engager tout mon stack', 'Miser, mais rester prudent si le pot devient très gros', 'Me coucher à la première mise'], answer: low ? 0 : 1,
        explain: low
          ? 'Avec un SPR de 3 ou moins, il reste peu de jetons par rapport au pot : une top paire est assez forte pour s\'engager.'
          : 'Avec un SPR de ' + spr + ', une simple paire ne justifie pas de jouer tout son stack : misez pour valeur, puis ralentissez face à une forte résistance.',
        theme: 'stack'
      };
    },

    /** Ouvrir ou se coucher selon la position (table de 6, personne n'a relancé). */
    preflop: function (rng) {
      const posList = [
        { label: 'UTG', name: 'premier de parole (UTG)', group: 'early' },
        { label: 'MP', name: 'milieu de table (MP)', group: 'middle' },
        { label: 'CO', name: 'cut-off (CO)', group: 'late' },
        { label: 'BTN', name: 'bouton (BTN)', group: 'late' }
      ];
      const pos = pick(posList, rng);
      const th = OPEN[pos.group];
      let hole, s;
      for (let i = 0; i < 300; i++) {
        hole = P.shuffle(P.createDeck(), rng).slice(0, 2);
        s = B.chen(hole);
        if (Math.abs(s - th) >= 1.5 && (s >= th || rng.int(3) > 0 || i > 200)) break;
      }
      const open = s >= th;
      return {
        q: 'Table de 6 joueurs. Vous êtes ' + pos.name + ' et tout le monde a passé avant vous. Que faites-vous ?',
        context: 'Vos cartes : [[' + hole.join(' ') + ']] (' + B.handKey(hole) + ')',
        options: ['Relancer à environ 3 grosses blinds', 'Suivre la grosse blinde (limper)', 'Me coucher'], answer: open ? 0 : 2,
        explain: open
          ? B.handKey(hole) + ' est assez forte pour ouvrir depuis cette position. On relance plutôt que de limper pour prendre l\'initiative.'
          : B.handKey(hole) + ' est trop faible pour cette position : trop de situations où vous seriez dominé ou hors de position. Limper ne corrige pas le problème.',
        theme: pos.group === 'late' || pos.group === 'early' ? 'position-strat' : 'preflop'
      };
    }
  };

  /* ========================================================================
     3. LESSONS
     ======================================================================== */
  const LESSON_PASS = 60;   // % minimal pour valider le quiz d'une leçon
  const EXAM_PASS = 70;     // % minimal pour valider l'examen d'un niveau
  const EXAM_SIZE = 10;
  const EXAM_GENERATORS = {
    1: ['ranking', 'ranking', 'winner', 'winner'],
    2: ['preflop', 'outs', 'potodds', 'potodds'],
    3: ['foldequity', 'foldequity', 'potodds', 'preflop'],
    4: ['spr', 'spr', 'foldequity', 'potodds'],
    5: ['mdf', 'mdf', 'bluffratio', 'bluffratio']
  };

  function progressState() { return global.Store.state.progress; }

  const Lessons = {
    THEMES: THEMES,
    LESSON_PASS: LESSON_PASS,
    EXAM_PASS: EXAM_PASS,
    levels: LEVELS,

    level: function (n) { return LEVELS.filter(function (l) { return l.id === n; })[0] || null; },

    get: function (id) {
      for (let i = 0; i < LEVELS.length; i++) {
        for (let j = 0; j < LEVELS[i].lessons.length; j++) {
          if (LEVELS[i].lessons[j].id === id) return LEVELS[i].lessons[j];
        }
      }
      return null;
    },

    levelOf: function (lessonId) {
      for (let i = 0; i < LEVELS.length; i++) {
        if (LEVELS[i].lessons.some(function (l) { return l.id === lessonId; })) return LEVELS[i];
      }
      return null;
    },

    /** Un niveau est ouvert si c'est le premier, ou si l'examen du précédent est validé. */
    isLevelUnlocked: function (n) {
      const lvl = Lessons.level(n);
      if (!lvl || lvl.comingSoon) return false;
      if (n === 1) return true;
      const ex = progressState().levelExams[n - 1];
      return !!(ex && ex.passed);
    },

    isUnlocked: function (lessonId) {
      const lvl = Lessons.levelOf(lessonId);
      return !!lvl && Lessons.isLevelUnlocked(lvl.id);
    },

    isDone: function (lessonId) {
      const x = progressState().lessons[lessonId];
      return !!(x && x.done);
    },

    /** L'examen d'un niveau s'ouvre quand toutes ses leçons sont validées. */
    isExamUnlocked: function (n) {
      const lvl = Lessons.level(n);
      return Lessons.isLevelUnlocked(n) && lvl.lessons.every(function (l) { return Lessons.isDone(l.id); });
    },

    isExamPassed: function (n) {
      const ex = progressState().levelExams[n];
      return !!(ex && ex.passed);
    },

    /** Quiz d'une leçon : ses questions + ses exercices pratiques générés. */
    buildQuiz: function (lessonId) {
      const lesson = Lessons.get(lessonId);
      const rng = newRng();
      const qs = lesson.quiz.map(function (q) { return shuffleOptions(q, rng); });
      (lesson.exercises || []).forEach(function (g) { qs.push(Generators[g](rng)); });
      return qs;
    },

    /** Examen d'un niveau : 10 questions tirées des leçons + exercices générés. */
    buildExam: function (n) {
      const lvl = Lessons.level(n);
      const rng = newRng();
      let pool = [];
      lvl.lessons.forEach(function (l) { pool = pool.concat(l.quiz); });
      const gens = EXAM_GENERATORS[n] || EXAM_GENERATORS[2];
      const qs = P.shuffle(pool, rng).slice(0, EXAM_SIZE - gens.length).map(function (q) { return shuffleOptions(q, rng); });
      gens.forEach(function (g) { qs.push(Generators[g](rng)); });
      return P.shuffle(qs, rng);
    },

    /** Corrige une série de réponses : { score, total, pct }. */
    grade: function (questions, answers) {
      let score = 0;
      questions.forEach(function (q, i) { if (answers[i] === q.answer) score++; });
      return { score: score, total: questions.length, pct: questions.length ? Math.round(100 * score / questions.length) : 0 };
    },

    /** Enregistre le résultat du quiz d'une leçon. Renvoie true si la leçon est validée. */
    completeLesson: function (lessonId, pct) {
      const p = progressState();
      const x = p.lessons[lessonId] || (p.lessons[lessonId] = { done: false, bestScore: 0, attempts: 0, completedAt: null });
      x.attempts++;
      x.bestScore = Math.max(x.bestScore, pct);
      const passed = pct >= LESSON_PASS;
      if (passed && !x.done) { x.done = true; x.completedAt = Date.now(); }
      global.Store.commit('lesson');
      return passed;
    },

    /** Enregistre le résultat d'un examen. Renvoie true si le niveau est validé. */
    completeExam: function (n, pct) {
      const p = progressState();
      const x = p.levelExams[n] || (p.levelExams[n] = { passed: false, score: 0, attempts: 0 });
      x.attempts++;
      x.score = Math.max(x.score, pct);
      const passed = pct >= EXAM_PASS;
      if (passed) {
        x.passed = true;
        p.level = Math.max(p.level, n + 1);
      }
      global.Store.commit('exam');
      return passed;
    },

    /** Niveau en cours et progression vers le suivant. */
    progress: function () {
      const available = LEVELS.filter(function (l) { return !l.comingSoon; });
      let current = available[0];
      available.forEach(function (l) { if (Lessons.isLevelUnlocked(l.id)) current = l; });
      const allDone = available.every(function (l) { return Lessons.isExamPassed(l.id); });
      const done = current.lessons.filter(function (l) { return Lessons.isDone(l.id); }).length;
      const total = current.lessons.length + 1;
      const steps = done + (Lessons.isExamPassed(current.id) ? 1 : 0);
      return {
        level: current.id,
        title: current.title,
        done: done,
        lessons: current.lessons.length,
        pct: Math.round(100 * steps / total),
        allDone: allDone,
        text: allDone
          ? 'Les cinq niveaux sont validés. Continuez à vous entraîner à la table, en tournoi et en mode Défi.'
          : done < current.lessons.length
            ? done + ' leçon(s) validée(s) sur ' + current.lessons.length + ', puis l\'examen du niveau'
            : 'Toutes les leçons sont validées : passez l\'examen du niveau ' + current.id
      };
    },

    /** Prochaine leçon à suivre (ou null si tout est validé). */
    nextLessonId: function () {
      for (let i = 0; i < LEVELS.length; i++) {
        if (!Lessons.isLevelUnlocked(LEVELS[i].id)) continue;
        for (let j = 0; j < LEVELS[i].lessons.length; j++) {
          if (!Lessons.isDone(LEVELS[i].lessons[j].id)) return LEVELS[i].lessons[j].id;
        }
      }
      return null;
    }
  };

  /* ========================================================================
     4. DÉFIS
     ======================================================================== */
  const Challenges = {
    SIZE: 5,
    THEMES: [
      { id: 'mixte', label: 'Mixte' },
      { id: 'mains', label: 'Reconnaître les mains' },
      { id: 'abattage', label: 'Qui gagne ?' },
      { id: 'preflop', label: 'Pré-flop' },
      { id: 'outs', label: 'Compter ses outs' },
      { id: 'pot-odds', label: 'Cotes du pot' },
      { id: 'postflop', label: 'Flop, turn, river' },
      { id: 'avance', label: 'Stratégie avancée' }
    ],

    /** Construit une série de 5 questions pour un thème. */
    build: function (theme) {
      const rng = newRng();
      const qs = [];
      const postflop = P.shuffle(POSTFLOP_BANK, rng);
      const one = function (t, i) {
        switch (t) {
          case 'mains': return Generators.ranking(rng);
          case 'abattage': return Generators.winner(rng);
          case 'preflop': return Generators.preflop(rng);
          case 'outs': return Generators.outs(rng);
          case 'pot-odds': return Generators.potodds(rng);
          case 'avance': {
            // Stratégie avancée : exercices chiffrés et questions des niveaux 3 à 5.
            if (i % 2 === 0) return Generators[pick(['foldequity', 'mdf', 'bluffratio', 'spr'], rng)](rng);
            let pool = [];
            LEVELS.forEach(function (l) { if (l.id >= 3) l.lessons.forEach(function (x) { pool = pool.concat(x.quiz); }); });
            return shuffleOptions(pick(pool, rng), rng);
          }
          default: return shuffleOptions(postflop[i % postflop.length], rng);
        }
      };
      const mix = P.shuffle(['mains', 'abattage', 'preflop', 'outs', 'pot-odds', 'postflop', 'postflop'], rng);
      for (let i = 0; i < Challenges.SIZE; i++) qs.push(one(theme === 'mixte' ? mix[i] : theme, i));
      return qs;
    },

    /** Enregistre le résultat d'une série terminée. */
    finish: function (score, total) {
      const c = progressState().challenges;
      c.series++;
      c.played += total;
      c.correct += score;
      global.Store.commit('challenge');
    }
  };

  /* ========================================================================
     5. CONSEILS ET ANALYSE
     ======================================================================== */
  /** Seuils (score de Chen) du tableau de mains de départ conseillé au joueur. */
  const OPEN = { early: 9, middle: 8, late: 6.5, blinds: 7.5 };
  const CALL_RAISE = { early: 10, middle: 9.5, late: 8.5, blinds: 8 };

  const ERRORS = {
    'main-trop-faible-preflop': { label: 'Main de départ trop faible pour la position', theme: 'preflop', lesson: 'n2-l1' },
    'limp': { label: 'Suivre au lieu de relancer avant le flop (limp)', theme: 'preflop', lesson: 'n2-l1' },
    'trop-passif': { label: 'Jeu trop passif avec une main forte avant le flop', theme: 'preflop', lesson: 'n2-l1' },
    'call-sans-cote': { label: 'Suivre sans avoir la cote', theme: 'pot-odds', lesson: 'n2-l5' },
    'fold-trop-serre': { label: 'Se coucher alors que la cote était suffisante', theme: 'pot-odds', lesson: 'n2-l5' },
    'fold-gratuit': { label: 'Se coucher alors que la parole était gratuite', theme: 'actions', lesson: 'n1-l4' },
    'fold-trop-fort': { label: 'Se coucher avec une main forte', theme: 'mains', lesson: 'n1-l2' },
    'pas-de-value': { label: 'Ne pas miser une main forte', theme: 'postflop', lesson: 'n3-l3' },
    'bluff-risque': { label: 'Miser sans main ni tirage dans une situation défavorable', theme: 'postflop', lesson: 'n3-l4' },
    'mise-trop-petite': { label: 'Taille de mise trop petite', theme: 'postflop', lesson: 'n3-l5' },
    'mise-trop-grosse': { label: 'Taille de mise trop grosse', theme: 'postflop', lesson: 'n3-l5' }
  };
  const VERDICTS = { good: 'Bonne décision', ok: 'Décision correcte', doubt: 'Discutable', bad: 'Erreur probable' };

  function classOf(type) { return type === 'bet' || type === 'raise' || type === 'allin' ? 'raise' : type; }
  function fmt(n) { return Math.round(n).toLocaleString('fr-FR'); }

  function actionLabel(cls, amount, L) {
    if (cls === 'fold') return 'Se coucher';
    if (cls === 'check') return 'Parole (check)';
    if (cls === 'call') return (L.callIsAllIn ? 'Suivre à tapis pour ' : 'Suivre ') + fmt(L.callAmount);
    if (amount >= L.maxRaiseTo) return 'Tapis (' + fmt(amount) + ')';
    return (L.isBet ? 'Miser ' : 'Relancer à ') + fmt(amount);
  }

  /** Construit l'objet conseil en s'assurant que l'action proposée est légale. */
  function makeHint(view, cls, amount, why, figures, hypotheses, data) {
    const L = view.legal;
    if (cls === 'raise') {
      if (!L.canRaise) { cls = L.canCall ? 'call' : 'check'; }
      else {
        amount = Math.max(L.minRaiseTo, Math.min(L.maxRaiseTo, Math.round(amount)));
        if (amount >= L.maxRaiseTo * 0.8) amount = L.maxRaiseTo;
      }
    }
    if (cls === 'fold' && L.canCheck) cls = 'check';
    if (cls === 'check' && !L.canCheck) cls = 'fold';
    if (cls === 'call' && !L.canCall) cls = 'check';
    return {
      action: cls,
      amount: cls === 'raise' ? amount : null,
      label: actionLabel(cls, amount, L),
      why: why, figures: figures, hypotheses: hypotheses, data: data || {}
    };
  }

  function preflopHint(view) {
    const L = view.legal, bb = view.bb, hole = view.holeCards;
    const s = B.chen(hole), key = B.handKey(hole);
    let group = P.positionGroup(view.position);
    if (view.numPlayers === 2 && view.position === 'BTN') group = 'late';
    const posName = P.POSITION_NAMES[view.position] || view.position;
    const acts = view.actions.filter(function (a) { return a.street === 'preflop'; });
    const raises = acts.filter(function (a) { return a.type === 'raise'; }).length;
    const limpers = raises === 0 ? acts.filter(function (a) { return a.type === 'call'; }).length : 0;
    const adj = view.numPlayers === 2 ? -2.5 : view.numPlayers === 3 ? -1 : 0;
    const stack = L.stack + L.streetBet, stackBB = stack / bb;
    const pair = hole[0][0] === hole[1][0];
    const figures = [{ label: 'Votre main', value: key }, { label: 'Position', value: view.position }];
    if (L.toCall > 0) {
      figures.push({ label: 'À suivre', value: fmt(L.callAmount) });
      figures.push({ label: 'Cote du pot', value: pctText(100 * L.callAmount / (L.pot + L.callAmount)) });
    }
    const hyp = ['Conseil fondé sur un tableau de mains de départ standard pour ' + view.numPlayers + ' joueurs, sans supposition sur le style précis de vos adversaires.'];
    const data = { chen: s, key: key, group: group, raises: raises };
    const few = view.numPlayers <= 3 ? ' À ' + view.numPlayers + ' joueurs, on joue nettement plus de mains qu\'à une table pleine.' : '';

    if (raises === 0) {
      // Petit stack (tournoi) : plus de place pour relancer puis abandonner.
      if (stackBB <= 12 && L.canRaise && s >= OPEN[group] + adj) {
        return makeHint(view, 'raise', L.maxRaiseTo, [
          'Vous n\'avez plus que ' + Math.round(stackBB) + ' grosses blinds : une relance classique engagerait déjà une grande partie de votre stack.',
          'Avec ' + key + ' depuis cette position, la bonne approche est « tapis ou se coucher » : vous profitez au maximum des abandons adverses.'
        ], figures, hyp, data);
      }
      if (s >= OPEN[group] + adj) {
        return makeHint(view, 'raise', bb * (3 + limpers), [
          key + ' est assez forte pour entrer dans le coup depuis votre position (' + posName + ').' + few,
          'Relancez plutôt que de suivre : vous pouvez gagner les blinds tout de suite et vous prenez l\'initiative pour la suite.'
        ], figures, hyp, data);
      }
      if (L.canCheck) {
        return makeHint(view, 'check', 0, ['Personne n\'a relancé : vous voyez le flop gratuitement depuis la grosse blinde.', key + ' n\'est pas assez forte pour relancer.'], figures, hyp, data);
      }
      return makeHint(view, 'fold', 0, [
        key + ' est trop faible pour cette position (' + posName + ').',
        group === 'early' || group === 'middle'
          ? 'Plus vous parlez tôt, plus il reste de joueurs qui peuvent avoir mieux : soyez exigeant.'
          : 'Même en fin de parole, cette main gagne trop rarement pour être rentable.'
      ], figures, hyp, data);
    }

    const share = L.toCall / Math.max(1, L.stack);
    if (L.callIsAllIn || share >= 0.4) {
      const th = 12 + (stackBB <= 15 ? -2 : 0) + (view.numPlayers === 2 ? -1 : 0);
      if (s >= th) return makeHint(view, L.callIsAllIn ? 'call' : 'raise', L.maxRaiseTo, [key + ' fait partie des meilleures mains de départ : elle est assez forte pour engager votre stack.'], figures, hyp, data);
      return makeHint(view, 'fold', 0, ['On vous demande d\'engager une grande partie de votre stack.', key + ' n\'est pas assez forte pour cela : un joueur qui mise aussi gros a le plus souvent une main premium.'], figures, hyp, data);
    }
    if (raises === 1) {
      if (s >= 12) return makeHint(view, 'raise', view.currentBet * 3, [key + ' est une main premium : sur-relancez (3-bet) pour faire grossir le pot pendant que vous êtes favori.'], figures, hyp, data);
      if (s >= CALL_RAISE[group] + adj) return makeHint(view, 'call', 0, [key + ' est assez forte pour suivre une relance, mais pas assez pour sur-relancer.', 'Jouez prudemment après le flop si vous ne touchez pas.'], figures, hyp, data);
      if (pair && L.toCall <= stack * 0.06) return makeHint(view, 'call', 0, ['Avec une petite paire, suivre peu cher est acceptable : vous espérez toucher un brelan au flop (environ 1 fois sur 8).', 'Si vous ne le touchez pas, abandonnez face à une mise.'], figures, hyp, data);
      return makeHint(view, 'fold', 0, ['Un joueur a relancé : sa range est plus forte qu\'un tirage au hasard.', key + ' est trop souvent dominée pour suivre de façon rentable.'], figures, hyp, data);
    }
    if (s >= 15) return makeHint(view, 'raise', L.toCall >= L.stack * 0.3 ? L.maxRaiseTo : Math.round(view.currentBet * 2.3), [key + ' est l\'une des deux ou trois meilleures mains de départ : continuez à relancer.'], figures, hyp, data);
    if (s >= 12 && L.toCall <= stack * 0.25) return makeHint(view, 'call', 0, ['Plusieurs relances annoncent des mains très fortes.', key + ' peut suivre, sans plus.'], figures, hyp, data);
    return makeHint(view, 'fold', 0, ['Il y a eu relance et sur-relance : les ranges adverses sont très fortes.', key + ' ne fait pas le poids.'], figures, hyp, data);
  }

  function postflopHint(view, rng) {
    const L = view.legal, pot = L.pot, street = view.street;
    const info = B.analyzeHand(view.holeCards, view.board);
    const tex = B.boardTexture(view.board);
    const nOpp = Math.max(1, view.numActive - 1);
    const eq = B.estimateEquity(view.holeCards, view.board, nOpp, rng, 300);
    const s = info.strength - (nOpp >= 2 && info.strength < 0.8 ? 0.04 * (nOpp - 1) : 0);
    const hasDraw = street !== 'river' && (info.flushDraw || info.straightDraw);
    const figures = [
      { label: 'Votre main', value: info.description },
      { label: 'Pot', value: fmt(pot) },
      { label: 'Équité brute', value: pctText(eq * 100) }
    ];
    if (hasDraw) figures.push({ label: 'Outs', value: String(info.outs) });
    const hyp = [
      'Équité brute estimée par simulation contre ' + nOpp + ' main(s) adverse(s) tirée(s) au hasard : c\'est une approximation, vos adversaires ne jouent pas des mains au hasard.',
      'Les cartes adverses sont inconnues : ce conseil repose sur des probabilités, pas sur une certitude.'
    ];
    const data = { strength: info.strength, equity: eq, outs: info.outs, label: info.label };
    const handLine = 'Vous avez : ' + info.label + '.';
    const multi = nOpp >= 2 ? ' Vous affrontez ' + nOpp + ' adversaires : il faut une main plus solide.' : '';

    if (L.toCall === 0) {
      if (s >= 0.55) {
        const frac = street === 'river' || tex.wet ? 0.66 : 0.5;
        return makeHint(view, 'raise', L.streetBet + Math.max(view.bb, Math.round(frac * pot)), [
          handLine,
          'C\'est une main assez forte pour miser « pour valeur » : vous voulez être payé par des mains moins bonnes.',
          'Le board est ' + tex.label + (tex.wet ? ' : misez assez gros pour faire payer les tirages.' : ' : une mise moyenne suffit.')
        ], figures, hyp, data);
      }
      if (hasDraw && info.outs >= 8 && nOpp <= 2) {
        return makeHint(view, 'raise', L.streetBet + Math.max(view.bb, Math.round(0.5 * pot)), [
          handLine,
          'Avec ' + info.outs + ' outs, vous pouvez miser en « semi-bluff » : soit l\'adversaire se couche, soit vous gardez de bonnes chances de toucher.',
          'Dire parole pour voir une carte gratuite est aussi une option raisonnable.'
        ], figures, hyp, data);
      }
      if (street === 'flop' && view.preflopAggressor === view.seat && nOpp === 1 && !tex.wet) {
        return makeHint(view, 'raise', L.streetBet + Math.max(view.bb, Math.round(0.33 * pot)), [
          handLine,
          'Vous avez relancé avant le flop et n\'avez qu\'un adversaire sur un board ' + tex.label + ' : une petite « mise de continuation » (c-bet) le fait souvent se coucher.'
        ], figures, hyp, data);
      }
      return makeHint(view, 'check', 0, [handLine, 'Ce n\'est pas assez fort pour miser pour valeur, et bluffer ici est peu prometteur.' + multi, 'La parole est gratuite : ne vous couchez pas.'], figures, hyp, data);
    }

    const odds = L.callAmount / (pot + L.callAmount);
    const betFrac = L.toCall / Math.max(1, pot - L.toCall);
    const penalty = 0.10 + 0.14 * Math.min(1.2, betFrac) + (street === 'river' ? 0.05 : 0) + 0.03 * (nOpp - 1);
    const eff = Math.max(0, eq - penalty);
    const drawEq = hasDraw ? info.outs * (street === 'flop' && L.callIsAllIn ? 0.04 : 0.02) : 0;
    const have = Math.max(eff, drawEq);
    figures.push({ label: 'À suivre', value: fmt(L.callAmount) });
    figures.push({ label: 'Cote du pot', value: pctText(odds * 100) });
    figures.push({ label: 'Équité ajustée', value: pctText(have * 100) });
    hyp.push('Équité ajustée : équité brute réduite de ' + Math.round(penalty * 100) + ' points, car un adversaire qui mise ' + (betFrac >= 0.75 ? 'gros ' : '') + 'a en moyenne une main plus forte que le hasard.');
    data.odds = odds; data.adjusted = have; data.toCall = L.callAmount; data.pot = pot;
    const oddsLine = 'Vous devez payer ' + fmt(L.callAmount) + ' pour un pot de ' + fmt(pot) + ' : la cote du pot est de ' + pctText(odds * 100) + '. Il faut donc gagner au moins ' + pctText(odds * 100) + ' du temps.';
    const drawLine = hasDraw ? 'Votre tirage : ' + info.outs + ' outs, soit environ ' + pctText(drawEq * 100) + ' de chances de toucher ' + (street === 'flop' && L.callIsAllIn ? 'd\'ici la river.' : 'sur la prochaine carte.') : null;
    const lines = [handLine, oddsLine];
    if (drawLine) lines.push(drawLine);

    if (s >= 0.85) {
      lines.push('Votre main est très forte : relancez pour faire grossir le pot.');
      return makeHint(view, 'raise', view.currentBet + Math.max(view.minRaise, Math.round(0.8 * (pot + L.toCall))), lines, figures, hyp, data);
    }
    if (have >= odds) {
      lines.push('Vos chances estimées (' + pctText(have * 100) + ') dépassent la cote demandée : suivre est rentable à long terme.' + multi);
      return makeHint(view, 'call', 0, lines, figures, hyp, data);
    }
    lines.push('Vos chances estimées (' + pctText(have * 100) + ') sont inférieures à la cote demandée : suivre perd de l\'argent à long terme.' + multi);
    return makeHint(view, 'fold', 0, lines, figures, hyp, data);
  }

  const Analysis = {
    ERRORS: ERRORS,
    VERDICTS: VERDICTS,
    OPEN: OPEN,
    classOf: classOf,

    /**
     * Conseil pour la décision en cours.
     * @param view vue publique du joueur (Poker.Engine.publicView), à son tour de parole
     * @returns { action, amount, label, why[], figures[], hypotheses[], data } ou null
     */
    hint: function (view) {
      if (!view || !view.legal) return null;
      // Générateur propre au conseil : la simulation ne perturbe pas l'aléatoire de la partie.
      const rng = P.RNG(1000003 * view.handNumber + 7919 * view.actions.length + 17);
      return view.street === 'preflop' ? preflopHint(view) : postflopHint(view, rng);
    },

    /** Compare la décision du joueur au conseil : { verdict, tags[], comment }. */
    _judge: function (d) {
      const h = d.hint, chosen = classOf(d.chosen.type), pre = d.view.street === 'preflop';
      const strong = !pre && h.data.strength >= 0.55;
      const tags = [];
      let verdict = 'good', comment = '';
      if (chosen === h.action) {
        comment = 'Votre choix correspond à l\'approche conseillée.';
        if (chosen === 'raise' && h.amount) {
          const base = d.view.legal.streetBet;
          const ratio = (d.chosen.amount - base) / Math.max(1, h.amount - base);
          if (ratio < 0.5) { verdict = 'ok'; tags.push('mise-trop-petite'); comment = 'Bonne idée de miser, mais le montant est petit : vous donnez une bonne cote aux tirages et gagnez moins avec vos bonnes mains.'; }
          else if (ratio > 2.2) { verdict = 'ok'; tags.push('mise-trop-grosse'); comment = 'Bonne idée de miser, mais le montant est élevé : seules les mains qui vous battent ont tendance à payer une très grosse mise.'; }
        }
      } else if (h.action === 'fold' && chosen === 'call') {
        verdict = 'bad'; tags.push(pre ? 'main-trop-faible-preflop' : 'call-sans-cote');
        comment = pre ? 'Suivre avec cette main depuis cette position coûte des jetons à long terme.' : 'Vos chances estimées étaient inférieures à la cote du pot : suivre n\'était pas rentable.';
      } else if (h.action === 'fold' && chosen === 'raise') {
        verdict = 'doubt'; tags.push(pre ? 'main-trop-faible-preflop' : 'bluff-risque');
        comment = pre ? 'Relancer avec une main aussi faible est un bluff : possible de temps en temps, mais coûteux s\'il devient une habitude.' : 'Relancer ici est un bluff : il ne fonctionne que si l\'adversaire se couche souvent.';
      } else if (h.action === 'check' && chosen === 'raise') {
        if (!pre && h.data.strength >= 0.38) { verdict = 'ok'; comment = 'Miser une main moyenne se défend (protection), même si la parole était l\'option prudente.'; }
        else if (pre) { verdict = 'ok'; comment = 'Relancer depuis la grosse blinde avec une main moyenne est agressif, mais jouable.'; }
        else { verdict = 'doubt'; tags.push('bluff-risque'); comment = 'Vous avez misé sans main faite ni gros tirage : c\'est un bluff, risqué dans cette configuration.'; }
      } else if (h.action === 'check' && chosen === 'fold') {
        verdict = 'bad'; tags.push('fold-gratuit');
        comment = 'La parole était gratuite : en vous couchant, vous abandonnez une chance de gagner sans rien économiser.';
      } else if (h.action === 'call' && chosen === 'fold') {
        verdict = 'doubt'; tags.push('fold-trop-serre');
        comment = 'La cote du pot justifiait de suivre. Se coucher reste prudent, mais vous renoncez à une situation rentable.';
      } else if (h.action === 'call' && chosen === 'raise') {
        verdict = strong || pre ? 'ok' : 'doubt';
        if (verdict === 'doubt') tags.push('bluff-risque');
        comment = 'Relancer est l\'option agressive. Elle se défend si vous pensez faire coucher mieux ou être payé par moins bien.';
      } else if (h.action === 'raise' && chosen === 'call') {
        if (pre) {
          if (h.data.raises === 0) { verdict = 'doubt'; tags.push('limp'); comment = 'Vous avez suivi au lieu d\'ouvrir en relançant : vous laissez entrer les autres à bas prix et renoncez à l\'initiative.'; }
          else { verdict = 'ok'; tags.push('trop-passif'); comment = 'Suivre est correct, mais avec une main premium, sur-relancer rapporte davantage.'; }
        } else { verdict = 'ok'; tags.push('pas-de-value'); comment = 'Suivre est acceptable, mais votre main méritait une relance pour faire grossir le pot.'; }
      } else if (h.action === 'raise' && chosen === 'check') {
        if (pre) { verdict = 'ok'; tags.push('trop-passif'); comment = 'Vous avez dit parole avec une main qui méritait une relance.'; }
        else if (strong) { verdict = 'doubt'; tags.push('pas-de-value'); comment = 'Vous aviez une main forte et vous n\'avez pas misé : vous laissez une carte gratuite et ne faites pas grossir le pot.'; }
        else { verdict = 'ok'; comment = 'La parole est l\'option prudente ; miser était l\'option agressive conseillée.'; }
      } else if (h.action === 'raise' && chosen === 'fold') {
        verdict = 'bad'; tags.push('fold-trop-fort');
        comment = 'Vous vous êtes couché avec une main forte dans cette situation.';
      } else {
        verdict = 'ok'; comment = 'Votre choix diffère du conseil, sans être une erreur nette.';
      }
      return { verdict: verdict, tags: tags, comment: comment };
    },

    _situation: function (v) {
      const L = v.legal;
      const parts = [P.STREET_NAMES[v.street]];
      if (v.board.length) parts.push('board [[' + v.board.join(' ') + ']]');
      parts.push('vos cartes [[' + v.holeCards.join(' ') + ']]');
      parts.push('position ' + v.position);
      parts.push('pot ' + fmt(L.pot));
      parts.push(L.toCall > 0 ? fmt(L.callAmount) + ' à suivre' : 'personne n\'a misé');
      parts.push((v.numActive - 1) + ' adversaire(s) en jeu');
      parts.push('stack ' + fmt(L.stack));
      return parts.join(' · ');
    },

    _alternatives: function (d) {
      const L = d.view.legal, h = d.hint, chosen = classOf(d.chosen.type);
      const out = [];
      const add = function (cls, text) {
        if (cls === chosen) return;
        out.push(text + (cls === h.action ? ' — option conseillée.' : ''));
      };
      if (L.canCheck) add('check', 'Parole : gratuit, vous gardez toutes vos chances sans investir');
      if (L.canCall) add('call', 'Suivre ' + fmt(L.callAmount) + ' : rentable seulement si vos chances de gagner dépassent la cote du pot');
      if (L.canRaise) add('raise', (L.isBet ? 'Miser' : 'Relancer') + ' : pour faire payer les mains moins fortes, ou pour faire coucher mieux');
      if (!L.canCheck) add('fold', 'Se coucher : vous ne perdez rien de plus');
      return out;
    },

    /**
     * Lecture de la main sur l'ensemble des tours : la « ligne » du joueur,
     * la part de stack investie, le SPR au flop et des remarques de cohérence.
     * @returns { line: 'Pré-flop : relance → Flop : mise…', invested, investedPct, spr, notes[] }
     */
    _multiStreet: function (rec, decisions) {
      const words = { fold: 'abandon', check: 'parole', call: 'suit', bet: 'mise', raise: 'relance' };
      const byStreet = {};
      decisions.forEach(function (d) {
        const st = d.view.street;
        (byStreet[st] = byStreet[st] || []).push(d);
      });
      const line = P.STREETS.filter(function (st) { return byStreet[st]; }).map(function (st) {
        return P.STREET_NAMES[st] + ' : ' + byStreet[st].map(function (d) { return words[d.chosen.type] + (d.chosen.allIn ? ' (tapis)' : ''); }).join(', ');
      }).join(' → ');
      let invested = 0;
      rec.actions.forEach(function (a) {
        if (a.seat !== rec.heroSeat) return;
        if (a.type === 'refund') invested -= a.amount;
        else if (a.type !== 'win') invested += a.amount || 0;
      });
      const start = (rec.seats.filter(function (s) { return s.seat === rec.heroSeat; })[0] || {}).stackStart || 1;
      const pctInvested = Math.round(100 * invested / start);
      const flop = (byStreet.flop || [])[0];
      const spr = flop ? Math.round(10 * flop.view.legal.stack / Math.max(1, flop.view.legal.pot)) / 10 : null;
      const notes = [];
      const post = decisions.filter(function (d) { return d.view.street !== 'preflop'; });
      const lastPost = post[post.length - 1];
      const strength = lastPost && lastPost.hint ? lastPost.hint.data.strength : null;
      const isAgg = function (d) { return classOf(d.chosen.type) === 'raise'; };
      const aggStreets = ['flop', 'turn', 'river'].filter(function (st) { return (byStreet[st] || []).some(isAgg); });
      const callStreets = ['flop', 'turn', 'river'].filter(function (st) { return (byStreet[st] || []).some(function (d) { return d.chosen.type === 'call'; }); });

      if (spr !== null) {
        notes.push('SPR au flop : ' + String(spr).replace('.', ',') + ' (' + (spr <= 3 ? 'bas : une top paire suffit pour s\'engager' : spr <= 10 ? 'moyen : prudence avec une seule paire dans un gros pot' : 'élevé : seules les très fortes mains justifient de jouer tout son stack') + ').');
      }
      if (strength !== null && strength < 0.6 && pctInvested >= 35 && (spr === null || spr > 3)) {
        notes.push('Vous avez investi ' + pctInvested + ' % de votre stack avec une main de force moyenne. Avec ce type de main, visez un ou deux tours de mise, pas trois : c\'est le contrôle du pot.');
      }
      if (aggStreets.length === 3 && strength !== null && strength >= 0.6) {
        notes.push('Vous avez misé aux trois tours avec une main forte : c\'est une ligne de valeur cohérente, celle qui fait le plus grossir le pot.');
      }
      if (aggStreets.length >= 2 && strength !== null && strength < 0.3 && !(lastPost.hint.data.outs >= 8)) {
        notes.push('Vous avez misé sur plusieurs tours sans main ni tirage : un bluff en plusieurs barils ne fonctionne que si votre histoire est crédible et l\'adversaire capable de se coucher.');
      }
      if (callStreets.length >= 2 && lastPost && lastPost.chosen.type === 'fold') {
        notes.push('Vous avez payé ' + callStreets.length + ' fois avant d\'abandonner. Quand une main ne supportera pas une mise de plus, mieux vaut le décider plus tôt : chaque appel intermédiaire est perdu.');
      }
      if (callStreets.length === 3) {
        notes.push('Vous avez suivi aux trois tours. Contre un adversaire qui mise trois fois, sa range est concentrée sur des mains fortes : cette ligne n\'est rentable qu\'avec une bonne main ou contre un bluffeur avéré.');
      }
      const pre = byStreet.preflop || [];
      const raisedPre = pre.some(isAgg);
      if (raisedPre && flop && flop.view.legal.toCall === 0 && !isAgg(flop) && flop.view.numActive === 2 && (byStreet.turn || []).some(isAgg)) {
        notes.push('Vous avez relancé avant le flop, dit parole au flop, puis misé au turn. Cette mise retardée est une ligne valable, à condition que la carte du turn vous soit favorable.');
      }
      if (!raisedPre && pre.some(function (d) { return d.chosen.type === 'call'; }) && aggStreets.length === 0 && callStreets.length >= 1) {
        notes.push('Vous n\'avez pris l\'initiative à aucun moment (suivi avant le flop, suivi ensuite). Sans initiative, on ne gagne qu\'en ayant la meilleure main à l\'abattage.');
      }
      return { line: line, invested: invested, investedPct: pctInvested, spr: spr, notes: notes };
    },

    /** Question de quiz liée à ce qui s'est passé dans la main. */
    _quiz: function (decisions) {
      const rng = newRng();
      const facing = decisions.filter(function (d) { return d.view.street !== 'preflop' && d.view.legal.toCall > 0; })[0];
      if (facing) {
        const L = facing.view.legal, need = 100 * L.callAmount / (L.pot + L.callAmount);
        const base = Math.round(need);
        let opts = [base, Math.max(1, base - 12), base + 12, Math.min(95, base + 25)];
        opts = opts.filter(function (x, i) { return opts.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
        return {
          q: 'Dans cette main (' + P.STREET_NAMES[facing.view.street].toLowerCase() + '), vous deviez payer ' + fmt(L.callAmount) + ' pour un pot de ' + fmt(L.pot) + '. Quelle équité minimale fallait-il pour suivre ?',
          options: opts.map(function (x) { return x + ' %'; }), answer: opts.indexOf(base),
          explain: fmt(L.callAmount) + ' ÷ (' + fmt(L.pot) + ' + ' + fmt(L.callAmount) + ') = ' + pctText(need) + '.', theme: 'pot-odds'
        };
      }
      const pre = decisions.filter(function (d) { return d.view.street === 'preflop' && d.hint.data.raises === 0 && !d.view.legal.canCheck; })[0];
      if (pre) {
        const open = pre.hint.action === 'raise';
        return {
          q: 'Avec ' + pre.hint.data.key + ' en position ' + pre.view.position + ' (' + pre.view.numPlayers + ' joueurs), quand personne n\'a relancé avant vous, quelle est l\'approche standard ?',
          options: ['Relancer', 'Suivre la grosse blinde (limper)', 'Se coucher'], answer: open ? 0 : 2,
          explain: open ? 'Cette main est assez forte pour ouvrir depuis cette position ; on relance plutôt que de limper.' : 'Cette main est trop faible pour cette position ; limper ne règle pas le problème.',
          theme: 'preflop'
        };
      }
      return Generators.ranking(rng);
    },

    /**
     * Analyse pédagogique d'une main terminée.
     * @param rec        enregistrement de la main (voir game.js)
     * @param decisions  [{ view, chosen: { type, amount }, hint }] décisions du joueur,
     *                   avec la vue publique qu'il avait à ce moment-là
     * @returns { summary, decisions[], review[], quiz, errorTags[] }
     */
    analyzeHand: function (rec, decisions) {
      const out = { summary: '', decisions: [], review: [], quiz: null, errorTags: [] };
      const counts = { good: 0, ok: 0, doubt: 0, bad: 0 };
      (decisions || []).forEach(function (d) {
        if (!d.hint) d.hint = Analysis.hint(d.view);
        if (!d.hint) return;
        const j = Analysis._judge(d);
        counts[j.verdict]++;
        j.tags.forEach(function (t) { if (out.errorTags.indexOf(t) < 0) out.errorTags.push(t); });
        out.decisions.push({
          street: d.view.street,
          streetName: P.STREET_NAMES[d.view.street],
          situation: Analysis._situation(d.view),
          chosen: actionLabel(classOf(d.chosen.type), d.chosen.amount, d.view.legal),
          advised: d.hint.label,
          verdict: j.verdict,
          verdictLabel: VERDICTS[j.verdict],
          comment: j.comment,
          principles: d.hint.why,
          figures: d.hint.figures,
          alternatives: Analysis._alternatives(d),
          hypotheses: d.hint.hypotheses
        });
      });

      const n = out.decisions.length;
      const result = rec.heroNet > 0 ? 'Vous gagnez ' + fmt(rec.heroNet) + ' jetons' : rec.heroNet < 0 ? 'Vous perdez ' + fmt(-rec.heroNet) + ' jetons' : 'Résultat nul';
      if (n === 0) {
        out.summary = result + '. Vous n\'avez eu aucune décision à prendre dans cette main.';
      } else {
        const parts = [];
        if (counts.good) parts.push(counts.good + ' bonne(s)');
        if (counts.ok) parts.push(counts.ok + ' correcte(s)');
        if (counts.doubt) parts.push(counts.doubt + ' discutable(s)');
        if (counts.bad) parts.push(counts.bad + ' erreur(s) probable(s)');
        out.summary = result + '. ' + n + ' décision(s) analysée(s) : ' + parts.join(', ') + '. '
          + 'Rappel : une bonne décision peut perdre et une mauvaise peut gagner ; ce qui compte, c\'est la qualité du choix sur la durée.';
      }
      out.errorTags.forEach(function (t) {
        const e = ERRORS[t];
        if (e) out.review.push({ tag: t, label: e.label, theme: e.theme, themeLabel: THEMES[e.theme] || e.theme, lesson: e.lesson });
      });
      out.multi = Analysis._multiStreet(rec, decisions || []);
      out.quiz = n ? Analysis._quiz(decisions) : Generators.ranking(newRng());
      return out;
    }
  };

  /** Grille 13 × 13 d'exemple pour la leçon sur les ranges (ouverture au cut-off). */
  Lessons.rangeGridHTML = function () {
    const R = 'AKQJT98765432';
    let html = '<div class="range-grid" aria-label="Tableau des mains de départ">';
    for (let i = 0; i < 13; i++) {
      for (let j = 0; j < 13; j++) {
        const hi = R[Math.min(i, j)], lo = R[Math.max(i, j)];
        const suited = i < j;
        const hole = i === j ? [hi + 's', lo + 'h'] : suited ? [hi + 's', lo + 's'] : [hi + 's', lo + 'h'];
        const s = B.chen(hole);
        const cls = s >= 9 ? 'r-strong' : s >= 6.5 ? 'r-medium' : '';
        html += '<span class="range-cell ' + cls + '">' + hi + lo + (i === j ? '' : suited ? 's' : 'o') + '</span>';
      }
    }
    html += '</div><div class="range-legend"><span class="l-strong">Jouables à toutes les positions</span><span class="l-medium">Jouables en fin de parole (cut-off, bouton)</span><span>À coucher</span></div>';
    return html;
  };

  global.Lessons = Lessons;
  global.Challenges = Challenges;
  global.Analysis = Analysis;

})(typeof window !== 'undefined' ? window : globalThis);
