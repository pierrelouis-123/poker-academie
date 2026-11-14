/* ==========================================================================
   poker.js — Moteur de règles du Texas Hold'em No-Limit
   --------------------------------------------------------------------------
   Contenu :
     1. Cartes, deck et générateur aléatoire à graine (déterministe)
     2. Évaluateur de mains (5 cartes, puis meilleure main parmi 5 à 7 cartes
        en testant toutes les combinaisons : 21 pour 7 cartes)
     3. Side pots : construction et distribution
     4. Positions à la table
     5. Moteur d'une main (Poker.Engine) : blinds, tours d'enchères, relance
        minimale, all-in incomplets, abattage. L'état est un objet JSON pur,
        donc sérialisable et restaurable à tout instant.
     6. Vue publique d'un joueur (anti-triche pour les bots)
     7. Tests unitaires : PokerTests.run() dans la console

   Aucune dépendance, aucun accès au DOM. Chargé par une balise <script>
   classique : expose les objets globaux `Poker` et `PokerTests`.
   ========================================================================== */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------------
     1. CARTES, DECK, ALÉATOIRE
     Une carte est une chaîne de 2 caractères : rang + couleur.
     Rangs : 2 3 4 5 6 7 8 9 T J Q K A — Couleurs : s (pique) h (cœur)
     d (carreau) c (trèfle). Exemple : "As" = As de pique, "Td" = Dix de carreau.
     ------------------------------------------------------------------------ */
  const RANKS = '23456789TJQKA';
  const SUITS = 'shdc';
  const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const SUIT_NAMES = { s: 'pique', h: 'cœur', d: 'carreau', c: 'trèfle' };
  const RANK_SINGULAR = { 2: 'Deux', 3: 'Trois', 4: 'Quatre', 5: 'Cinq', 6: 'Six', 7: 'Sept', 8: 'Huit', 9: 'Neuf', 10: 'Dix', 11: 'Valet', 12: 'Dame', 13: 'Roi', 14: 'As' };
  const RANK_PLURAL = { 2: 'Deux', 3: 'Trois', 4: 'Quatre', 5: 'Cinq', 6: 'Six', 7: 'Sept', 8: 'Huit', 9: 'Neuf', 10: 'Dix', 11: 'Valets', 12: 'Dames', 13: 'Rois', 14: 'As' };
  const CATEGORY_NAMES = ['Hauteur', 'Paire', 'Double paire', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush', 'Quinte flush royale'];

  /** Valeur numérique du rang d'une carte : 2 à 14 (As = 14). */
  function rankOf(card) { return RANKS.indexOf(card[0]) + 2; }
  /** Couleur d'une carte : 's', 'h', 'd' ou 'c'. */
  function suitOf(card) { return card[1]; }

  /** Vérifie qu'une chaîne est une carte valide. */
  function isCard(str) {
    return typeof str === 'string' && str.length === 2 && RANKS.indexOf(str[0]) >= 0 && SUITS.indexOf(str[1]) >= 0;
  }

  /** Décompose une carte : { rank, suit, rankChar, symbol, red }. */
  function parseCard(str) {
    if (!isCard(str)) throw new Error('Carte invalide : ' + str);
    return {
      rank: rankOf(str),
      suit: str[1],
      rankChar: str[0] === 'T' ? '10' : str[0],
      symbol: SUIT_SYMBOLS[str[1]],
      red: str[1] === 'h' || str[1] === 'd'
    };
  }

  /** Libellé lisible d'une carte, par exemple "10♦" ou "A♠". */
  function cardLabel(str) {
    const c = parseCard(str);
    return c.rankChar + c.symbol;
  }

  /** Nom complet en français, par exemple "As de pique". */
  function cardName(str) {
    const c = parseCard(str);
    return RANK_SINGULAR[c.rank] + ' de ' + SUIT_NAMES[c.suit];
  }

  /** Deck neuf de 52 cartes, dans un ordre fixe. */
  function createDeck() {
    const deck = [];
    for (let s = 0; s < SUITS.length; s++) {
      for (let r = 0; r < RANKS.length; r++) deck.push(RANKS[r] + SUITS[s]);
    }
    return deck;
  }

  /**
   * Générateur pseudo-aléatoire déterministe (mulberry32).
   * Son état tient dans un seul entier 32 bits : on peut le sauvegarder
   * (getState) et le recréer plus tard (RNG(etat)) pour reprendre exactement
   * la même suite de tirages.
   */
  function RNG(seedOrState) {
    let state = (Number(seedOrState) >>> 0) || 0x9E3779B9;
    return {
      /** Nombre réel dans [0, 1[. */
      next: function () {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      /** Entier dans [0, n[. */
      int: function (n) { return Math.floor(this.next() * n); },
      /** État interne à sauvegarder. */
      getState: function () { return state; }
    };
  }

  /** Graine imprévisible pour démarrer une nouvelle partie. */
  RNG.randomSeed = function () {
    try {
      if (global.crypto && global.crypto.getRandomValues) {
        const a = new Uint32Array(1);
        global.crypto.getRandomValues(a);
        return a[0] || 1;
      }
    } catch (e) { /* on retombe sur Math.random */ }
    return (Math.floor(Math.random() * 4294967295) + 1) >>> 0;
  };

  /** Mélange de Fisher-Yates ; renvoie un nouveau tableau. */
  function shuffle(deck, rng) {
    const a = deck.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /* ------------------------------------------------------------------------
     2. ÉVALUATEUR DE MAINS
     Catégories : 0 Hauteur, 1 Paire, 2 Double paire, 3 Brelan, 4 Quinte,
     5 Couleur, 6 Full, 7 Carré, 8 Quinte flush, 9 Quinte flush royale.
     Le « score » est un entier : catégorie puis départages (kickers) en
     base 15. Deux mains se comparent en comparant leurs scores.
     ------------------------------------------------------------------------ */

  /** Toutes les combinaisons de k indices parmi n (ex. : 21 pour n=7, k=5). */
  function combinations(n, k) {
    const out = [];
    const idx = [];
    (function rec(start) {
      if (idx.length === k) { out.push(idx.slice()); return; }
      for (let i = start; i <= n - (k - idx.length); i++) {
        idx.push(i);
        rec(i + 1);
        idx.pop();
      }
    })(0);
    return out;
  }
  const COMBOS = { 5: combinations(5, 5), 6: combinations(6, 5), 7: combinations(7, 5) };

  function scoreOf(category, tiebreak) {
    let s = category;
    for (let i = 0; i < 5; i++) s = s * 15 + (tiebreak[i] || 0);
    return s;
  }

  /** Évalue exactement 5 cartes. Renvoie { category, tiebreak, score, cards }. */
  function evaluate5(cards) {
    if (!cards || cards.length !== 5) throw new Error('evaluate5 attend exactement 5 cartes.');
    const ranks = cards.map(rankOf).sort(function (a, b) { return b - a; });
    const flush = cards.every(function (c) { return c[1] === cards[0][1]; });

    // Regroupe les rangs identiques, triés par nombre puis par rang.
    const counts = {};
    ranks.forEach(function (r) { counts[r] = (counts[r] || 0) + 1; });
    const groups = Object.keys(counts).map(function (r) { return { r: +r, n: counts[r] }; })
      .sort(function (a, b) { return b.n - a.n || b.r - a.r; });

    // Quinte : 5 rangs distincts consécutifs, ou A-2-3-4-5 (l'As vaut alors 1).
    let straightHigh = 0;
    if (groups.length === 5) {
      if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
      else if (ranks[0] === 14 && ranks[1] === 5 && ranks[4] === 2) straightHigh = 5;
    }

    let category, tiebreak;
    if (straightHigh && flush) { category = straightHigh === 14 ? 9 : 8; tiebreak = [straightHigh]; }
    else if (groups[0].n === 4) { category = 7; tiebreak = [groups[0].r, groups[1].r]; }
    else if (groups[0].n === 3 && groups[1].n === 2) { category = 6; tiebreak = [groups[0].r, groups[1].r]; }
    else if (flush) { category = 5; tiebreak = ranks.slice(); }
    else if (straightHigh) { category = 4; tiebreak = [straightHigh]; }
    else if (groups[0].n === 3) { category = 3; tiebreak = [groups[0].r, groups[1].r, groups[2].r]; }
    else if (groups[0].n === 2 && groups[1].n === 2) { category = 2; tiebreak = [groups[0].r, groups[1].r, groups[2].r]; }
    else if (groups[0].n === 2) { category = 1; tiebreak = [groups[0].r, groups[1].r, groups[2].r, groups[3].r]; }
    else { category = 0; tiebreak = ranks.slice(); }

    // Cartes ordonnées pour l'affichage : groupes d'abord ; l'As en dernier pour A-2-3-4-5.
    const ordered = cards.slice().sort(function (a, b) {
      const ra = rankOf(a), rb = rankOf(b);
      if (straightHigh === 5) return (ra === 14 ? 1 : ra) < (rb === 14 ? 1 : rb) ? 1 : -1;
      return counts[rb] - counts[ra] || rb - ra;
    });

    return { category: category, tiebreak: tiebreak, score: scoreOf(category, tiebreak), cards: ordered };
  }

  /** Préposition correcte devant un rang : "d'As", "de Rois". */
  function deRank(r, plural) {
    const name = (plural ? RANK_PLURAL : RANK_SINGULAR)[r];
    return (r === 14 ? "d'" : 'de ') + name;
  }

  /** Description française d'une main évaluée, par exemple "Paire de Rois". */
  function describeHand(category, tiebreak) {
    const t = tiebreak;
    switch (category) {
      case 0: return 'Hauteur ' + RANK_SINGULAR[t[0]];
      case 1: return 'Paire ' + deRank(t[0], true);
      case 2: return 'Double paire ' + RANK_PLURAL[t[0]] + ' et ' + RANK_PLURAL[t[1]];
      case 3: return 'Brelan ' + deRank(t[0], true);
      case 4: return 'Quinte hauteur ' + RANK_SINGULAR[t[0]];
      case 5: return 'Couleur hauteur ' + RANK_SINGULAR[t[0]];
      case 6: return 'Full aux ' + RANK_PLURAL[t[0]] + ' par les ' + RANK_PLURAL[t[1]];
      case 7: return 'Carré ' + deRank(t[0], true);
      case 8: return 'Quinte flush hauteur ' + RANK_SINGULAR[t[0]];
      case 9: return 'Quinte flush royale';
      default: return '';
    }
  }

  /**
   * Meilleure main de 5 cartes parmi 5, 6 ou 7 cartes.
   * Teste rigoureusement toutes les combinaisons (21 pour 7 cartes).
   * Renvoie { category, name, description, tiebreak, score, best5, combosTested }.
   */
  function evaluate7(cards) {
    if (!cards || cards.length < 5 || cards.length > 7) throw new Error('evaluate7 attend entre 5 et 7 cartes.');
    const seen = {};
    for (let i = 0; i < cards.length; i++) {
      if (!isCard(cards[i])) throw new Error('Carte invalide : ' + cards[i]);
      if (seen[cards[i]]) throw new Error('Carte en double : ' + cards[i]);
      seen[cards[i]] = true;
    }
    const combos = COMBOS[cards.length];
    let best = null;
    for (let i = 0; i < combos.length; i++) {
      const c = combos[i];
      const r = evaluate5([cards[c[0]], cards[c[1]], cards[c[2]], cards[c[3]], cards[c[4]]]);
      if (!best || r.score > best.score) best = r;
    }
    return {
      category: best.category,
      name: CATEGORY_NAMES[best.category],
      description: describeHand(best.category, best.tiebreak),
      tiebreak: best.tiebreak,
      score: best.score,
      best5: best.cards,
      combosTested: combos.length
    };
  }

  /** Compare deux mains évaluées : 1 si a gagne, -1 si b gagne, 0 si égalité. */
  function compareHands(a, b) {
    return a.score > b.score ? 1 : (a.score < b.score ? -1 : 0);
  }

  /* ------------------------------------------------------------------------
     3. SIDE POTS
     ------------------------------------------------------------------------ */

  /**
   * Construit le pot principal et les pots annexes.
   * @param contribs [{ seat, totalBet, folded }] mise totale de chaque joueur sur la main
   * @returns [{ amount, eligible: [sièges] }] du pot principal au dernier pot annexe
   *
   * Principe : chaque palier de mise d'un joueur encore en jeu crée une
   * « tranche ». Tous les joueurs (même couchés) alimentent la tranche à
   * hauteur de leur mise ; seuls les joueurs non couchés ayant misé au moins
   * le palier peuvent la gagner.
   */
  function buildPots(contribs) {
    const live = contribs.filter(function (c) { return !c.folded && c.totalBet > 0; });
    const levels = [];
    live.forEach(function (c) { if (levels.indexOf(c.totalBet) < 0) levels.push(c.totalBet); });
    levels.sort(function (a, b) { return a - b; });

    const pots = [];
    let prev = 0;
    levels.forEach(function (level) {
      let amount = 0;
      contribs.forEach(function (c) {
        amount += Math.min(c.totalBet, level) - Math.min(c.totalBet, prev);
      });
      const eligible = live.filter(function (c) { return c.totalBet >= level; }).map(function (c) { return c.seat; });
      if (amount > 0) pots.push({ amount: amount, eligible: eligible });
      prev = level;
    });

    // Jetons de joueurs couchés au-delà du plus haut palier : ils vont au dernier pot.
    let extra = 0;
    contribs.forEach(function (c) { extra += Math.max(0, c.totalBet - prev); });
    if (extra > 0) {
      if (pots.length) pots[pots.length - 1].amount += extra;
      else if (live.length) pots.push({ amount: extra, eligible: live.map(function (c) { return c.seat; }) });
    }
    return pots;
  }

  /**
   * Distribue chaque pot à la meilleure main parmi ses joueurs éligibles.
   * @param pots         résultat de buildPots
   * @param scoreBySeat  { siège: score de la main }
   * @param order        sièges dans l'ordre à partir de la gauche du bouton
   *                     (sert à attribuer le jeton impair en cas de partage)
   * @returns { payouts: { siège: montant }, detail: [{ index, amount, eligible, winners, shares }] }
   */
  function distributePots(pots, scoreBySeat, order) {
    const payouts = {};
    const detail = [];
    pots.forEach(function (pot, index) {
      let best = -1;
      let winners = [];
      pot.eligible.forEach(function (seat) {
        const sc = scoreBySeat[seat];
        if (sc > best) { best = sc; winners = [seat]; }
        else if (sc === best) winners.push(seat);
      });
      winners.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
      const share = Math.floor(pot.amount / winners.length);
      let remainder = pot.amount - share * winners.length;
      const shares = {};
      winners.forEach(function (seat) {
        shares[seat] = share + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        payouts[seat] = (payouts[seat] || 0) + shares[seat];
      });
      detail.push({ index: index, amount: pot.amount, eligible: pot.eligible.slice(), winners: winners, shares: shares });
    });
    return { payouts: payouts, detail: detail };
  }

  /* ------------------------------------------------------------------------
     4. POSITIONS
     ------------------------------------------------------------------------ */
  const POSITION_LABELS = {
    2: ['BTN', 'BB'],
    3: ['BTN', 'SB', 'BB'],
    4: ['BTN', 'SB', 'BB', 'UTG'],
    5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
    6: ['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO'],
    7: ['BTN', 'SB', 'BB', 'UTG', 'MP', 'HJ', 'CO'],
    8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'HJ', 'CO'],
    9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO']
  };
  const POSITION_NAMES = {
    'BTN': 'Bouton', 'SB': 'Petite blinde', 'BB': 'Grosse blinde', 'UTG': 'Premier de parole (UTG)',
    'UTG+1': 'UTG+1', 'MP': 'Milieu de table', 'LJ': 'Lojack', 'HJ': 'Hijack', 'CO': 'Cut-off'
  };

  /**
   * Position de chaque joueur de la main.
   * @param seatList   sièges participant à la main (ordre croissant)
   * @param buttonSeat siège du bouton
   * @returns { siège: 'BTN' | 'SB' | 'BB' | 'UTG' | ... }
   * À 2 joueurs, le bouton est aussi la petite blinde.
   */
  function positions(seatList, buttonSeat) {
    const n = seatList.length;
    const labels = POSITION_LABELS[n];
    if (!labels) throw new Error('Nombre de joueurs non géré : ' + n);
    const start = seatList.indexOf(buttonSeat);
    if (start < 0) throw new Error('Le bouton doit être un joueur de la main.');
    const map = {};
    for (let i = 0; i < n; i++) map[seatList[(start + i) % n]] = labels[i];
    return map;
  }

  /** Catégorie simplifiée d'une position : 'early', 'middle', 'late' ou 'blinds'. */
  function positionGroup(label) {
    if (label === 'SB' || label === 'BB') return 'blinds';
    if (label === 'BTN' || label === 'CO') return 'late';
    if (label === 'UTG' || label === 'UTG+1') return 'early';
    return 'middle';
  }

  /* ------------------------------------------------------------------------
     5. MOTEUR D'UNE MAIN
     L'état « table » est un objet JSON pur :
       { sb, bb, buttonSeat, handNumber, phase, seats: [...], hand: {...} }
     phase : 'idle' | 'preflop' | 'flop' | 'turn' | 'river' | 'handOver'
     ------------------------------------------------------------------------ */
  const STREETS = ['preflop', 'flop', 'turn', 'river'];
  const STREET_NAMES = { preflop: 'Pré-flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Abattage' };

  /** Siège suivant dans une liste triée, en tournant (strictement après `from`). */
  function nextIn(list, from) {
    for (let i = 0; i < list.length; i++) if (list[i] > from) return list[i];
    return list[0];
  }

  const Engine = {

    /**
     * Crée une table.
     * @param config { sb, bb, buttonSeat?, seats: [{ id, name, isHuman, stack, ... }] }
     */
    createTable: function (config) {
      if (!config || !Array.isArray(config.seats) || config.seats.length < 2 || config.seats.length > 9) {
        throw new Error('Une table compte de 2 à 9 joueurs.');
      }
      if (!(config.bb > 0) || !(config.sb > 0) || config.sb > config.bb) throw new Error('Blinds invalides.');
      return {
        sb: Math.floor(config.sb),
        bb: Math.floor(config.bb),
        buttonSeat: config.buttonSeat || 0,
        handNumber: 0,
        phase: 'idle',
        seats: config.seats.map(function (s, i) {
          return Object.assign({}, s, { seat: i, stack: Math.max(0, Math.floor(s.stack)) });
        }),
        hand: null
      };
    },

    /** Sièges qui ont des jetons et peuvent donc recevoir des cartes. */
    liveSeats: function (table) {
      return table.seats.filter(function (s) { return s.stack > 0 && !s.sittingOut; }).map(function (s) { return s.seat; });
    },

    /** Total des jetons en jeu (stacks + mises de la main en cours). */
    totalChips: function (table) {
      let total = 0;
      table.seats.forEach(function (s) { total += s.stack; });
      if (table.hand && !table.hand.result) total += Engine.pot(table);
      return total;
    },

    /** Montant total du pot de la main en cours. */
    pot: function (table) {
      const h = table.hand;
      if (!h) return 0;
      let pot = 0;
      h.order.forEach(function (s) { pot += h.players[s].totalBet; });
      return pot;
    },

    /** Pots (principal + annexes) calculés sur les mises actuelles. */
    currentPots: function (table) {
      const h = table.hand;
      if (!h) return [];
      return buildPots(h.order.map(function (s) {
        return { seat: s, totalBet: h.players[s].totalBet, folded: h.players[s].folded };
      }));
    },

    /** Ordre de distribution : en commençant à gauche du bouton. */
    dealOrder: function (seatList, buttonSeat) {
      const out = [];
      let s = buttonSeat;
      for (let i = 0; i < seatList.length; i++) { s = nextIn(seatList, s); out.push(s); }
      return out;
    },

    /**
     * Démarre une nouvelle main : déplace le bouton, poste les blinds, distribue.
     * @param rng   générateur Poker.RNG (mélange du deck)
     * @param opts  { deck?: deck imposé (tests), keepButton?: ne pas déplacer le bouton }
     * @returns { ok, error?, events? }
     */
    startHand: function (table, rng, opts) {
      opts = opts || {};
      if (table.phase !== 'idle' && table.phase !== 'handOver') {
        return { ok: false, error: 'Une main est déjà en cours.' };
      }
      const live = Engine.liveSeats(table);
      if (live.length < 2) return { ok: false, error: 'Il faut au moins deux joueurs avec des jetons.' };

      // Bouton : avance d'un cran à chaque main (sauf la première).
      if ((table.handNumber > 0 && !opts.keepButton) || live.indexOf(table.buttonSeat) < 0) {
        table.buttonSeat = nextIn(live, table.buttonSeat);
      }
      table.handNumber++;

      // Blinds. À 2 joueurs (heads-up), le bouton est la petite blinde.
      const headsUp = live.length === 2;
      const sbSeat = headsUp ? table.buttonSeat : nextIn(live, table.buttonSeat);
      const bbSeat = nextIn(live, sbSeat);

      const deck = opts.deck ? opts.deck.slice() : shuffle(createDeck(), rng);
      if (deck.length !== 52) return { ok: false, error: 'Deck invalide.' };

      const players = {};
      const startStacks = {};
      live.forEach(function (s) {
        players[s] = { folded: false, allIn: false, streetBet: 0, totalBet: 0, hasActed: false, actedAtBet: null };
        startStacks[s] = table.seats[s].stack;
      });

      const h = {
        number: table.handNumber,
        deck: deck,
        board: [],
        holeCards: {},
        buttonSeat: table.buttonSeat,
        sbSeat: sbSeat,
        bbSeat: bbSeat,
        order: live,
        positions: positions(live, table.buttonSeat),
        startStacks: startStacks,
        street: 'preflop',
        toAct: null,
        currentBet: 0,
        minRaise: table.bb,
        lastAggressor: null,
        preflopAggressor: null,
        players: players,
        actions: [],
        actionCount: 0,
        result: null
      };
      table.hand = h;
      table.phase = 'preflop';
      const events = [];

      // Distribution : une carte à la fois, deux tours, en partant de la gauche du bouton.
      const order = Engine.dealOrder(live, table.buttonSeat);
      order.forEach(function (s) { h.holeCards[s] = []; });
      for (let round = 0; round < 2; round++) {
        order.forEach(function (s) { h.holeCards[s].push(h.deck.shift()); });
      }
      events.push({ type: 'deal' });

      // Blinds (un joueur trop court est à tapis pour ce qu'il lui reste).
      Engine._post(table, sbSeat, table.sb, 'sb', events);
      Engine._post(table, bbSeat, table.bb, 'bb', events);
      h.currentBet = table.bb;
      h.minRaise = table.bb;

      // Premier de parole : à gauche de la grosse blinde (en heads-up : le bouton).
      Engine._progress(table, bbSeat, events);
      return { ok: true, events: events };
    },

    /** Ajoute une entrée à l'historique public de la main. */
    _log: function (table, entry, events) {
      const h = table.hand;
      entry.n = ++h.actionCount;
      entry.street = h.street;
      entry.pot = Engine.pot(table);
      h.actions.push(entry);
      if (events) events.push({ type: 'action', action: entry });
      return entry;
    },

    /** Fait payer `amount` jetons à un joueur (plafonné à son stack). */
    _pay: function (table, seat, amount) {
      const s = table.seats[seat];
      const p = table.hand.players[seat];
      const paid = Math.min(amount, s.stack);
      s.stack -= paid;
      p.streetBet += paid;
      p.totalBet += paid;
      if (s.stack === 0) p.allIn = true;
      return paid;
    },

    _post: function (table, seat, amount, type, events) {
      const paid = Engine._pay(table, seat, amount);
      Engine._log(table, {
        seat: seat, type: type, amount: paid, to: table.hand.players[seat].streetBet,
        allIn: table.hand.players[seat].allIn
      }, events);
    },

    /**
     * Actions autorisées pour un joueur.
     * @returns {
     *   toCall        jetons à ajouter pour suivre (0 = parole possible)
     *   canFold, canCheck, canCall, callAmount, callIsAllIn
     *   canRaise      mise ou relance autorisée
     *   isBet         true si personne n'a encore misé sur ce tour (on « mise », sinon on « relance »)
     *   minRaiseTo    mise totale minimale sur ce tour pour miser/relancer
     *   maxRaiseTo    mise totale maximale (tapis)
     *   canAllIn, pot, stack, streetBet
     * }
     */
    legalActions: function (table, seat) {
      const h = table.hand;
      const none = { toCall: 0, canFold: false, canCheck: false, canCall: false, callAmount: 0, callIsAllIn: false, canRaise: false, isBet: false, minRaiseTo: 0, maxRaiseTo: 0, canAllIn: false, pot: h ? Engine.pot(table) : 0, stack: 0, streetBet: 0 };
      if (!h || h.result || !h.players[seat]) return none;
      const p = h.players[seat];
      const stack = table.seats[seat].stack;
      if (p.folded || p.allIn || stack <= 0) return none;

      const toCall = Math.max(0, h.currentBet - p.streetBet);
      const maxRaiseTo = p.streetBet + stack;

      // Quelqu'un d'autre peut-il encore répondre à une relance ?
      const othersCanRespond = h.order.some(function (s) {
        return s !== seat && !h.players[s].folded && !h.players[s].allIn;
      });
      // Règle de réouverture : un joueur qui a déjà parlé ne peut relancer que si la
      // mise a augmenté d'au moins une relance complète depuis son action
      // (un tapis incomplet ne rouvre pas les enchères).
      const reopened = p.actedAtBet === null || (h.currentBet - p.actedAtBet) >= h.minRaise;
      const canRaise = stack > toCall && reopened && othersCanRespond;

      return {
        toCall: toCall,
        canFold: true,
        canCheck: toCall === 0,
        canCall: toCall > 0,
        callAmount: Math.min(toCall, stack),
        callIsAllIn: toCall > 0 && stack <= toCall,
        canRaise: canRaise,
        isBet: h.currentBet === 0,
        minRaiseTo: canRaise ? Math.min(h.currentBet + h.minRaise, maxRaiseTo) : 0,
        maxRaiseTo: canRaise ? maxRaiseTo : 0,
        canAllIn: canRaise || (toCall > 0 && stack <= toCall),
        pot: Engine.pot(table),
        stack: stack,
        streetBet: p.streetBet
      };
    },

    /**
     * Applique l'action d'un joueur.
     * @param action { type: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin', amount? }
     *        Pour 'bet' et 'raise', `amount` est la mise TOTALE du joueur sur ce tour
     *        d'enchères (« relancer à 60 »), pas le supplément.
     * @returns { ok: true, events } ou { ok: false, error }
     */
    applyAction: function (table, seat, action) {
      const h = table.hand;
      if (!h || h.result || table.phase === 'idle' || table.phase === 'handOver') {
        return { ok: false, error: 'Aucune main en cours.' };
      }
      if (h.toAct !== seat) return { ok: false, error: "Ce n'est pas à ce joueur de parler." };
      if (!action || typeof action.type !== 'string') return { ok: false, error: 'Action invalide.' };

      const p = h.players[seat];
      const legal = Engine.legalActions(table, seat);
      let type = action.type;
      let amount = action.amount;
      const events = [];

      // Le tapis devient, selon le cas, un « suivre » ou une mise/relance du stack entier.
      if (type === 'allin') {
        if (!legal.canAllIn) return { ok: false, error: 'Tapis impossible dans cette situation.' };
        if (legal.canRaise) { type = 'raise'; amount = legal.maxRaiseTo; }
        else type = 'call';
      }

      if (type === 'fold') {
        p.folded = true;
        p.hasActed = true;
        Engine._log(table, { seat: seat, type: 'fold', amount: 0, to: p.streetBet, allIn: false }, events);

      } else if (type === 'check') {
        if (!legal.canCheck) return { ok: false, error: 'Parole impossible : il y a une mise à suivre.' };
        p.hasActed = true;
        p.actedAtBet = h.currentBet;
        Engine._log(table, { seat: seat, type: 'check', amount: 0, to: p.streetBet, allIn: false }, events);

      } else if (type === 'call') {
        if (!legal.canCall) return { ok: false, error: 'Rien à suivre : vous pouvez dire « parole ».' };
        const paid = Engine._pay(table, seat, legal.callAmount);
        p.hasActed = true;
        p.actedAtBet = h.currentBet;
        Engine._log(table, { seat: seat, type: 'call', amount: paid, to: p.streetBet, allIn: p.allIn }, events);

      } else if (type === 'bet' || type === 'raise') {
        if (!legal.canRaise) return { ok: false, error: 'Mise ou relance impossible dans cette situation.' };
        if (typeof amount !== 'number' || !isFinite(amount) || Math.floor(amount) !== amount) {
          return { ok: false, error: 'Le montant doit être un nombre entier.' };
        }
        if (amount > legal.maxRaiseTo) return { ok: false, error: 'Montant supérieur à votre stack.' };
        if (amount < legal.minRaiseTo) {
          return { ok: false, error: 'Montant trop faible : le minimum est ' + legal.minRaiseTo + '.' };
        }
        const wasBet = h.currentBet === 0;
        const raiseSize = amount - h.currentBet;
        const paid = Engine._pay(table, seat, amount - p.streetBet);
        // Une relance complète fixe la nouvelle relance minimale ; un tapis incomplet non.
        if (raiseSize >= h.minRaise) h.minRaise = raiseSize;
        h.currentBet = amount;
        h.lastAggressor = seat;
        h.order.forEach(function (s) {
          const o = h.players[s];
          if (s !== seat && !o.folded && !o.allIn) o.hasActed = false;
        });
        p.hasActed = true;
        p.actedAtBet = amount;
        Engine._log(table, { seat: seat, type: wasBet ? 'bet' : 'raise', amount: paid, to: p.streetBet, allIn: p.allIn }, events);

      } else {
        return { ok: false, error: 'Action inconnue : ' + type };
      }

      Engine._progress(table, seat, events);
      return { ok: true, events: events };
    },

    /**
     * Fait avancer la main après une action : joueur suivant, tour suivant,
     * déroulement automatique du board si plus personne ne peut miser, abattage.
     */
    _progress: function (table, fromSeat, events) {
      const h = table.hand;
      const alive = h.order.filter(function (s) { return !h.players[s].folded; });

      // Tout le monde s'est couché sauf un joueur : il gagne sans abattage.
      if (alive.length === 1) {
        Engine._returnUncalled(table, events);
        Engine._awardByFold(table, alive[0], events);
        return;
      }

      const canAct = alive.filter(function (s) { return !h.players[s].allIn; });
      let pending = canAct.filter(function (s) {
        const p = h.players[s];
        return !p.hasActed || p.streetBet < h.currentBet;
      });

      // Un seul joueur peut encore miser : il n'a à parler que s'il doit
      // compléter une mise adverse supérieure à la sienne.
      if (canAct.length === 1 && pending.length === 1) {
        const me = h.players[canAct[0]];
        let maxOther = 0;
        alive.forEach(function (s) { if (s !== canAct[0]) maxOther = Math.max(maxOther, h.players[s].streetBet); });
        if (me.streetBet >= maxOther) pending = [];
      }

      if (pending.length > 0) {
        const n = h.order.length;
        const idx = h.order.indexOf(fromSeat);
        for (let k = 1; k <= n; k++) {
          const s = h.order[(idx + k) % n];
          if (pending.indexOf(s) >= 0) { h.toAct = s; return; }
        }
      }
      Engine._endStreet(table, events);
    },

    /** Rend à un joueur la partie de sa mise que personne n'a suivie. */
    _returnUncalled: function (table, events) {
      const h = table.hand;
      let top = -1, second = 0, topSeat = null, topCount = 0;
      h.order.forEach(function (s) {
        const b = h.players[s].totalBet;
        if (b > top) { second = Math.max(second, top); top = b; topSeat = s; topCount = 1; }
        else if (b === top) topCount++;
        else second = Math.max(second, b);
      });
      if (topCount !== 1 || top <= second) return;
      const p = h.players[topSeat];
      if (p.folded) return;
      const diff = top - second;
      table.seats[topSeat].stack += diff;
      p.totalBet -= diff;
      p.streetBet = Math.max(0, p.streetBet - diff);
      p.allIn = false;
      Engine._log(table, { seat: topSeat, type: 'refund', amount: diff, to: p.streetBet, allIn: false }, events);
    },

    /** Clôt le tour d'enchères ; distribue la suite ou passe à l'abattage. */
    _endStreet: function (table, events) {
      const h = table.hand;
      Engine._returnUncalled(table, events);
      if (h.street === 'preflop') h.preflopAggressor = h.lastAggressor;

      if (h.street === 'river') { Engine._showdown(table, events); return; }

      // Remise à zéro des mises du tour.
      h.order.forEach(function (s) {
        const p = h.players[s];
        p.streetBet = 0;
        p.hasActed = false;
        p.actedAtBet = null;
      });
      h.currentBet = 0;
      h.minRaise = table.bb;
      h.lastAggressor = null;

      // Une carte brûlée, puis 3 cartes (flop) ou 1 carte (turn, river).
      const next = STREETS[STREETS.indexOf(h.street) + 1];
      h.deck.shift();
      const cards = [];
      const count = next === 'flop' ? 3 : 1;
      for (let i = 0; i < count; i++) cards.push(h.deck.shift());
      h.board = h.board.concat(cards);
      h.street = next;
      table.phase = next;
      h.toAct = null;
      const entry = { seat: null, type: 'deal', amount: 0, to: 0, allIn: false, cards: cards };
      Engine._log(table, entry);
      events.push({ type: 'street', street: next, cards: cards, board: h.board.slice(), n: entry.n });

      // Après le flop, le premier joueur actif à gauche du bouton parle en premier.
      Engine._progress(table, h.buttonSeat, events);
    },

    _finish: function (table, result, events) {
      const h = table.hand;
      result.net = {};
      h.order.forEach(function (s) { result.net[s] = table.seats[s].stack - h.startStacks[s]; });
      h.result = result;
      h.toAct = null;
      table.phase = 'handOver';
      events.push({ type: 'handOver', result: result });
    },

    _awardByFold: function (table, winner, events) {
      const h = table.hand;
      const pot = Engine.pot(table);
      table.seats[winner].stack += pot;
      const shares = {}; shares[winner] = pot;
      Engine._log(table, { seat: winner, type: 'win', amount: pot, to: 0, allIn: false, potIndex: 0 }, events);
      Engine._finish(table, {
        byFold: true,
        totalPot: pot,
        pots: [{ index: 0, amount: pot, eligible: [winner], winners: [winner], shares: shares }],
        showdown: []
      }, events);
    },

    _showdown: function (table, events) {
      const h = table.hand;
      const alive = h.order.filter(function (s) { return !h.players[s].folded; });
      const scoreBySeat = {};
      const shown = alive.map(function (s) {
        const ev = evaluate7(h.holeCards[s].concat(h.board));
        scoreBySeat[s] = ev.score;
        return {
          seat: s, cards: h.holeCards[s].slice(), category: ev.category, name: ev.name,
          description: ev.description, best5: ev.best5, score: ev.score
        };
      });
      const totalPot = Engine.pot(table);
      const pots = Engine.currentPots(table);
      const dist = distributePots(pots, scoreBySeat, Engine.dealOrder(h.order, h.buttonSeat));
      h.street = 'showdown';
      events.push({ type: 'showdown', showdown: shown });
      dist.detail.forEach(function (d) {
        d.winners.forEach(function (s) {
          table.seats[s].stack += d.shares[s];
          Engine._log(table, { seat: s, type: 'win', amount: d.shares[s], to: 0, allIn: false, potIndex: d.index }, events);
        });
      });
      Engine._finish(table, { byFold: false, totalPot: totalPot, pots: dist.detail, showdown: shown }, events);
    },

    /* ----------------------------------------------------------------------
       6. VUE PUBLIQUE (ANTI-TRICHE)
       Seule information transmise à un bot : ses propres cartes et ce que
       tout le monde voit à la table. Jamais le deck ni les cartes adverses.
       L'objet est une copie gelée : le modifier n'a aucun effet sur le jeu.
       ---------------------------------------------------------------------- */
    publicView: function (table, seat) {
      const h = table.hand;
      if (!h || !h.players[seat]) return null;
      const view = {
        seat: seat,
        handNumber: h.number,
        street: h.street,
        phase: table.phase,
        holeCards: h.holeCards[seat].slice(),
        board: h.board.slice(),
        sb: table.sb,
        bb: table.bb,
        pot: h.result ? h.result.totalPot : Engine.pot(table),
        currentBet: h.currentBet,
        minRaise: h.minRaise,
        buttonSeat: h.buttonSeat,
        sbSeat: h.sbSeat,
        bbSeat: h.bbSeat,
        position: h.positions[seat],
        toAct: h.toAct,
        isMyTurn: h.toAct === seat,
        legal: h.toAct === seat ? Engine.legalActions(table, seat) : null,
        preflopAggressor: h.preflopAggressor,
        lastAggressor: h.lastAggressor,
        numPlayers: h.order.length,
        numActive: h.order.filter(function (s) { return !h.players[s].folded; }).length,
        players: h.order.map(function (s) {
          const p = h.players[s];
          return {
            seat: s,
            id: table.seats[s].id,
            name: table.seats[s].name,
            isSelf: s === seat,
            stack: table.seats[s].stack,
            startStack: h.startStacks[s],
            streetBet: p.streetBet,
            totalBet: p.totalBet,
            folded: p.folded,
            allIn: p.allIn,
            position: h.positions[s]
          };
        }),
        actions: h.actions.map(function (a) {
          const copy = Object.assign({}, a);
          if (a.cards) copy.cards = a.cards.slice();
          return copy;
        }),
        // Cartes montrées à l'abattage : publiques une fois la main terminée.
        shown: h.result ? h.result.showdown.map(function (sd) { return { seat: sd.seat, cards: sd.cards.slice(), description: sd.description }; }) : null
      };
      return deepFreeze(view);
    }
  };

  function deepFreeze(obj) {
    if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
      Object.keys(obj).forEach(function (k) { deepFreeze(obj[k]); });
      Object.freeze(obj);
    }
    return obj;
  }

  const Poker = {
    RANKS: RANKS,
    SUITS: SUITS,
    SUIT_SYMBOLS: SUIT_SYMBOLS,
    CATEGORY_NAMES: CATEGORY_NAMES,
    RANK_SINGULAR: RANK_SINGULAR,
    RANK_PLURAL: RANK_PLURAL,
    STREETS: STREETS,
    STREET_NAMES: STREET_NAMES,
    POSITION_NAMES: POSITION_NAMES,
    RNG: RNG,
    rankOf: rankOf,
    suitOf: suitOf,
    isCard: isCard,
    parseCard: parseCard,
    cardLabel: cardLabel,
    cardName: cardName,
    createDeck: createDeck,
    shuffle: shuffle,
    combinations: combinations,
    evaluate5: evaluate5,
    evaluate7: evaluate7,
    describeHand: describeHand,
    compareHands: compareHands,
    buildPots: buildPots,
    distributePots: distributePots,
    positions: positions,
    positionGroup: positionGroup,
    nextIn: nextIn,
    deepFreeze: deepFreeze,
    Engine: Engine
  };

  /* ------------------------------------------------------------------------
     7. TESTS UNITAIRES
     Dans la console du navigateur :  PokerTests.run()
     ------------------------------------------------------------------------ */
  const PokerTests = (function () {
    const tests = [];
    function test(name, fn) { tests.push({ name: name, fn: fn }); }

    function fail(msg) { throw new Error(msg); }
    function eq(actual, expected, label) {
      const a = JSON.stringify(actual), e = JSON.stringify(expected);
      if (a !== e) fail((label ? label + ' : ' : '') + 'attendu ' + e + ', obtenu ' + a);
    }
    function ok(cond, label) { if (!cond) fail(label || 'condition fausse'); }

    /** Évalue une main écrite en clair : ev('As Kd 9h 7c 4s 3d 2h'). */
    function ev(str) { return evaluate7(str.split(' ')); }
    /** Compare deux mains privées sur un même board. */
    function versus(board, handA, handB) {
      return compareHands(ev(handA + ' ' + board), ev(handB + ' ' + board));
    }

    function mkTable(stacks, sb, bb, button) {
      return Engine.createTable({
        sb: sb, bb: bb, buttonSeat: button || 0,
        seats: stacks.map(function (s, i) { return { id: 'p' + i, name: 'Joueur ' + i, isHuman: i === 0, stack: s }; })
      });
    }
    function act(table, type, amount) {
      const r = Engine.applyAction(table, table.hand.toAct, { type: type, amount: amount });
      if (!r.ok) fail('Action refusée (' + type + ') : ' + r.error);
      return r;
    }
    function stacks(table) { return table.seats.map(function (s) { return s.stack; }); }
    function sum(arr) { return arr.reduce(function (a, b) { return a + b; }, 0); }

    /** Construit un deck truqué pour imposer les cartes privées et le board (tests). */
    function arrangeDeck(table, holes, board) {
      const live = Engine.liveSeats(table);
      const order = Engine.dealOrder(live, table.buttonSeat);
      const used = {};
      Object.keys(holes).forEach(function (s) { holes[s].forEach(function (c) { used[c] = true; }); });
      board.forEach(function (c) { used[c] = true; });
      const filler = createDeck().filter(function (c) { return !used[c]; });
      const deck = [];
      for (let round = 0; round < 2; round++) order.forEach(function (s) { deck.push(holes[s][round]); });
      deck.push(filler.shift()); deck.push(board[0], board[1], board[2]);
      deck.push(filler.shift()); deck.push(board[3]);
      deck.push(filler.shift()); deck.push(board[4]);
      return deck.concat(filler);
    }
    /** Tout le monde suit ou dit parole jusqu'à la fin de la main. */
    function checkDown(table) {
      let guard = 0;
      while (table.phase !== 'handOver') {
        const l = Engine.legalActions(table, table.hand.toAct);
        act(table, l.canCheck ? 'check' : 'call');
        if (++guard > 200) fail('Boucle infinie dans checkDown');
      }
    }

    /* ---------- A. Catégories de mains ---------- */
    test('01 Hauteur (carte haute)', function () {
      const r = ev('As Kd 9h 7c 4s 3d 2h');
      eq(r.category, 0); eq(r.tiebreak, [14, 13, 9, 7, 4]); eq(r.description, 'Hauteur As');
    });
    test('02 Paire', function () {
      const r = ev('As Ad 9h 7c 4s 3d 2h');
      eq(r.category, 1); eq(r.tiebreak, [14, 9, 7, 4]); eq(r.description, "Paire d'As");
    });
    test('03 Double paire', function () {
      const r = ev('As Ad 9h 9c 4s 3d 2h');
      eq(r.category, 2); eq(r.tiebreak, [14, 9, 4]);
    });
    test('04 Brelan', function () {
      const r = ev('As Ad Ah 9c 4s 3d 2h');
      eq(r.category, 3); eq(r.tiebreak, [14, 9, 4]);
    });
    test('05 Quinte', function () {
      const r = ev('9s 8d 7h 6c 5s Kd 2h');
      eq(r.category, 4); eq(r.tiebreak, [9]);
    });
    test('06 Couleur', function () {
      const r = ev('As Js 9s 6s 3s Kd 2h');
      eq(r.category, 5); eq(r.tiebreak, [14, 11, 9, 6, 3]);
    });
    test('07 Full', function () {
      const r = ev('Ks Kd Kh 2c 2s 9d 5h');
      eq(r.category, 6); eq(r.tiebreak, [13, 2]); eq(r.description, 'Full aux Rois par les Deux');
    });
    test('08 Carré', function () {
      const r = ev('9s 9d 9h 9c As Kd 2h');
      eq(r.category, 7); eq(r.tiebreak, [9, 14]);
    });
    test('09 Quinte flush', function () {
      const r = ev('9h 8h 7h 6h 5h As Ad');
      eq(r.category, 8); eq(r.tiebreak, [9]);
    });
    test('10 Quinte flush royale', function () {
      const r = ev('As Ks Qs Js Ts 2d 2h');
      eq(r.category, 9); eq(r.name, 'Quinte flush royale');
    });
    test('11 Les 10 catégories sont strictement ordonnées', function () {
      const hands = ['As Kd 9h 7c 4s 3d 2h', 'As Ad 9h 7c 4s 3d 2h', 'As Ad 9h 9c 4s 3d 2h', 'As Ad Ah 9c 4s 3d 2h',
        '9s 8d 7h 6c 5s Kd 2h', 'As Js 9s 6s 3s Kd 2h', 'Ks Kd Kh 2c 2s 9d 5h', '9s 9d 9h 9c As Kd 2h',
        '9h 8h 7h 6h 5h As Ad', 'As Ks Qs Js Ts 2d 2h'];
      for (let i = 1; i < hands.length; i++) ok(ev(hands[i]).score > ev(hands[i - 1]).score, 'catégorie ' + i + ' > ' + (i - 1));
    });

    /* ---------- B. Quintes particulières ---------- */
    test('12 Suite A-2-3-4-5 reconnue, hauteur Cinq', function () {
      const r = ev('As 2d 3h 4c 5s Kd Kh');
      eq(r.category, 4); eq(r.tiebreak, [5]);
      eq(r.best5[4][0], 'A', "l'As est la carte basse");
    });
    test('13 A-2-3-4-5 perd contre 2-3-4-5-6', function () {
      eq(compareHands(evaluate5(['2s', '3d', '4h', '5c', '6s']), evaluate5(['As', '2d', '3h', '4c', '5s'])), 1);
    });
    test('14 Quinte à l\'As (10-V-D-R-A)', function () {
      const r = ev('As Kd Qh Jc Ts 3d 2h');
      eq(r.category, 4); eq(r.tiebreak, [14]);
    });
    test('15 Pas de quinte « autour du coin » (D-R-A-2-3)', function () {
      eq(ev('Qs Kd Ah 2c 3s 7d 9h').category, 0);
    });
    test('16 Quinte flush A-2-3-4-5', function () {
      const r = ev('Ah 2h 3h 4h 5h Kd Ks');
      eq(r.category, 8); eq(r.tiebreak, [5]);
    });
    test('17 Quinte de 6 cartes : la plus haute est retenue', function () {
      eq(ev('4s 5d 6h 7c 8s 9d Kh').tiebreak, [9]);
    });

    /* ---------- C. Départages et kickers ---------- */
    test('18 Paire d\'As : kicker Roi bat kicker Dame', function () {
      eq(versus('Ah 7d 8s 2c 3d', 'As Kd', 'Ac Qd'), 1);
    });
    test('19 Deuxième kicker décisif', function () {
      eq(versus('Ah Kd 8s 2c 3d', 'As Qc', 'Ac Jc'), 1);
    });
    test('20 Kicker qui ne joue pas : égalité', function () {
      eq(versus('Ah Kd Qs Jc 9d', 'As 3c', 'Ac 2c'), 0);
    });
    test('21 Double paire : kicker décisif', function () {
      eq(versus('Kh Kd 7s 7c 2d', 'As 3c', 'Qs Jc'), 1);
    });
    test('22 Le board joue pour tous : égalité', function () {
      eq(versus('As Ks Qs Js Ts', '2d 3c', '9h 9d'), 0);
    });
    test('23 Couleur contre couleur : la plus haute carte gagne', function () {
      eq(versus('Ks 9s 6s 2s 3d', 'As 4d', 'Qs Jd'), 1);
    });
    test('24 Carré bat full', function () {
      eq(compareHands(evaluate5(['Ks', 'Kd', 'Kh', '2c', '2s']), evaluate5(['3s', '3d', '3h', '3c', '4s'])), -1);
    });
    test('25 Full contre full : le brelan décide', function () {
      eq(compareHands(evaluate5(['As', 'Ad', 'Ah', '2c', '2s']), evaluate5(['Ks', 'Kd', 'Kh', 'Qc', 'Qs'])), 1);
    });
    test('26 Carré sur le board : kicker décisif', function () {
      eq(versus('9s 9d 9h 9c 5s', 'Ad 2c', 'Kd Qc'), 1);
    });
    test('27 Deux brelans parmi 7 cartes : meilleur full', function () {
      const r = ev('As Ad Ah Ks Kd Kh 2c');
      eq(r.category, 6); eq(r.tiebreak, [14, 13]);
    });
    test('28 Trois paires parmi 7 cartes : deux meilleures + meilleur kicker', function () {
      const r = ev('As Ad Ks Kd Qs Qd Jc');
      eq(r.category, 2); eq(r.tiebreak, [14, 13, 12]);
    });
    test('29 Couleur préférée à la quinte', function () {
      const r = ev('9s 8s 7s 6d 5c 2s Ks');
      eq(r.category, 5); eq(r.tiebreak, [13, 9, 8, 7, 2]);
    });
    test('30 Quinte flush préférée à une couleur plus haute', function () {
      const r = ev('As 9s 8s 7s 6s 5s Kd');
      eq(r.category, 8); eq(r.tiebreak, [9]);
    });
    test('31 Les 21 combinaisons de 5 cartes parmi 7 sont testées', function () {
      eq(combinations(7, 5).length, 21);
      eq(ev('As Kd 9h 7c 4s 3d 2h').combosTested, 21);
      const keys = {};
      combinations(7, 5).forEach(function (c) { keys[c.join('')] = true; });
      eq(Object.keys(keys).length, 21, 'combinaisons toutes distinctes');
    });
    test('32 compareHands est symétrique', function () {
      const a = ev('As Ad 9h 7c 4s 3d 2h'), b = ev('Ks Kd 9h 7c 4s 3d 2h');
      eq(compareHands(a, b), 1); eq(compareHands(b, a), -1); eq(compareHands(a, a), 0);
    });
    test('33 Carte en double refusée', function () {
      let thrown = false;
      try { ev('As As 9h 7c 4s 3d 2h'); } catch (e) { thrown = true; }
      ok(thrown, 'une carte en double doit lever une erreur');
    });

    /* ---------- D. Side pots ---------- */
    test('34 Side pot avec 2 all-in', function () {
      const pots = buildPots([
        { seat: 0, totalBet: 100, folded: false },
        { seat: 1, totalBet: 300, folded: false },
        { seat: 2, totalBet: 300, folded: false }]);
      eq(pots, [{ amount: 300, eligible: [0, 1, 2] }, { amount: 400, eligible: [1, 2] }]);
    });
    test('35 Side pots avec 3 all-in', function () {
      const pots = buildPots([
        { seat: 0, totalBet: 50, folded: false },
        { seat: 1, totalBet: 150, folded: false },
        { seat: 2, totalBet: 400, folded: false },
        { seat: 3, totalBet: 400, folded: false }]);
      eq(pots, [{ amount: 200, eligible: [0, 1, 2, 3] }, { amount: 300, eligible: [1, 2, 3] }, { amount: 500, eligible: [2, 3] }]);
      eq(sum(pots.map(function (p) { return p.amount; })), 1000, 'aucun jeton perdu');
    });
    test('36 Les jetons d\'un joueur couché restent dans le pot', function () {
      const pots = buildPots([
        { seat: 0, totalBet: 100, folded: true },
        { seat: 1, totalBet: 200, folded: false },
        { seat: 2, totalBet: 200, folded: false }]);
      eq(pots, [{ amount: 500, eligible: [1, 2] }]);
    });
    test('37 Le petit tapis gagne le pot principal, le suivant le pot annexe', function () {
      const pots = buildPots([
        { seat: 0, totalBet: 100, folded: false },
        { seat: 1, totalBet: 300, folded: false },
        { seat: 2, totalBet: 300, folded: false }]);
      const d = distributePots(pots, { 0: 900, 1: 500, 2: 100 }, [1, 2, 0]);
      eq(d.payouts, { 0: 300, 1: 400 });
    });
    test('38 Partage du pot : jeton impair à gauche du bouton', function () {
      const d = distributePots([{ amount: 25, eligible: [0, 1, 2] }], { 0: 700, 1: 100, 2: 700 }, [2, 0, 1]);
      eq(d.payouts, { 0: 12, 2: 13 });
    });
    test('39 Trois all-in : égalité dans un pot annexe', function () {
      const pots = buildPots([
        { seat: 0, totalBet: 50, folded: false },
        { seat: 1, totalBet: 150, folded: false },
        { seat: 2, totalBet: 400, folded: false },
        { seat: 3, totalBet: 400, folded: false }]);
      const d = distributePots(pots, { 0: 10, 1: 800, 2: 800, 3: 20 }, [1, 2, 3, 0]);
      // Pot principal 200 et pot annexe 300 : partagés entre 1 et 2 ; dernier pot 500 : joueur 2.
      eq(d.payouts, { 1: 250, 2: 750 });
      eq(sum(Object.keys(d.payouts).map(function (k) { return d.payouts[k]; })), 1000);
    });
    test('40 Joueur couché avec la plus grosse mise : rien n\'est perdu', function () {
      const pots = buildPots([
        { seat: 0, totalBet: 300, folded: true },
        { seat: 1, totalBet: 100, folded: false },
        { seat: 2, totalBet: 300, folded: false }]);
      eq(pots, [{ amount: 300, eligible: [1, 2] }, { amount: 400, eligible: [2] }]);
    });

    /* ---------- E. Moteur de la main ---------- */
    test('41 Heads-up : le bouton est petite blinde et parle en premier avant le flop', function () {
      const t = mkTable([1000, 1000], 5, 10, 0);
      Engine.startHand(t, RNG(1));
      eq([t.hand.sbSeat, t.hand.bbSeat, t.hand.toAct], [0, 1, 0]);
      eq(t.hand.positions, { 0: 'BTN', 1: 'BB' });
      act(t, 'call'); act(t, 'check');
      eq(t.phase, 'flop'); eq(t.hand.toAct, 1, 'après le flop, la grosse blinde parle en premier');
    });
    test('42 À 3 joueurs : ordre de parole avant et après le flop', function () {
      const t = mkTable([1000, 1000, 1000], 5, 10, 0);
      Engine.startHand(t, RNG(2));
      eq([t.hand.sbSeat, t.hand.bbSeat, t.hand.toAct], [1, 2, 0]);
      act(t, 'call'); act(t, 'call');
      eq(t.phase, 'preflop', 'la grosse blinde a encore son option');
      const l = Engine.legalActions(t, 2);
      ok(l.canCheck && l.canRaise, 'option de la grosse blinde : parole ou relance');
      act(t, 'check');
      eq(t.phase, 'flop'); eq(t.hand.toAct, 1); eq(t.hand.board.length, 3);
    });
    test('43 All-in inférieur à la grosse blinde (3 joueurs)', function () {
      const t = mkTable([1000, 1000, 3], 5, 10, 0);
      Engine.startHand(t, RNG(3));
      ok(t.hand.players[2].allIn, 'la grosse blinde est à tapis pour 3');
      eq(Engine.legalActions(t, 0).toCall, 10, 'les autres doivent suivre la grosse blinde entière');
      act(t, 'call'); act(t, 'call');
      eq(Engine.currentPots(t), [{ amount: 9, eligible: [0, 1, 2] }, { amount: 14, eligible: [0, 1] }]);
      checkDown(t);
      eq(sum(stacks(t)), 2003, 'conservation des jetons');
      ok(t.seats[2].stack <= 9, 'le petit tapis ne peut gagner que le pot principal');
    });
    test('44 All-in inférieur à la grosse blinde (heads-up) : excédent rendu', function () {
      const t = mkTable([1000, 3], 5, 10, 0);
      Engine.startHand(t, RNG(4));
      eq(t.phase, 'handOver', 'plus personne ne peut miser : la main se déroule seule');
      eq(t.hand.board.length, 5);
      eq(t.hand.result.totalPot, 6, 'pot disputé : 3 + 3');
      eq(sum(stacks(t)), 1003);
      ok(t.hand.actions.some(function (a) { return a.type === 'refund' && a.seat === 0 && a.amount === 2; }), 'remboursement de 2');
    });
    test('45 Un tapis incomplet ne rouvre pas les enchères', function () {
      const t = mkTable([1000, 1000, 150], 5, 10, 0);
      Engine.startHand(t, RNG(5));
      act(t, 'raise', 100);          // siège 0 relance à 100 (relance de 90)
      act(t, 'call');                // siège 1 suit
      act(t, 'allin');               // siège 2 : tapis à 150 (relance de 50 < 90)
      const l0 = Engine.legalActions(t, 0);
      eq([t.hand.toAct, l0.toCall, l0.canRaise], [0, 50, false]);
      const r = Engine.applyAction(t, 0, { type: 'raise', amount: 400 });
      ok(!r.ok, 'la relance doit être refusée');
      act(t, 'call');
      eq(Engine.legalActions(t, 1).canRaise, false);
      act(t, 'call');
      eq(t.phase, 'flop');
    });
    test('46 Un tapis qui constitue une relance complète rouvre les enchères', function () {
      const t = mkTable([1000, 1000, 300], 5, 10, 0);
      Engine.startHand(t, RNG(6));
      act(t, 'raise', 100); act(t, 'call'); act(t, 'allin');   // tapis à 300 : relance de 200
      const l0 = Engine.legalActions(t, 0);
      eq([l0.toCall, l0.canRaise, l0.minRaiseTo], [200, true, 500]);
    });
    test('47 Relance minimale respectée', function () {
      const t = mkTable([1000, 1000], 5, 10, 0);
      Engine.startHand(t, RNG(7));
      eq(Engine.legalActions(t, 0).minRaiseTo, 20);
      ok(!Engine.applyAction(t, 0, { type: 'raise', amount: 15 }).ok, 'relance à 15 refusée');
      ok(!Engine.applyAction(t, 0, { type: 'raise', amount: 20.5 }).ok, 'montant non entier refusé');
      act(t, 'raise', 30);           // relance de 20
      eq(Engine.legalActions(t, 1).minRaiseTo, 50, 'sur-relance minimale : 30 + 20');
      ok(!Engine.applyAction(t, 1, { type: 'raise', amount: 45 }).ok, 'sur-relance à 45 refusée');
      ok(!Engine.applyAction(t, 1, { type: 'raise', amount: 5000 }).ok, 'montant supérieur au stack refusé');
      act(t, 'raise', 50);
    });
    test('48 Victoire sans abattage : mise non suivie rendue', function () {
      const t = mkTable([1000, 1000], 5, 10, 0);
      Engine.startHand(t, RNG(8));
      act(t, 'raise', 30); act(t, 'fold');
      eq(stacks(t), [1010, 990]);
      ok(t.hand.result.byFold && t.hand.result.showdown.length === 0, 'aucune carte montrée');
      eq(t.hand.result.net, { 0: 10, 1: -10 });
    });
    test('49 Abattage à 3 joueurs : la meilleure main gagne', function () {
      const t = mkTable([1000, 1000, 1000], 5, 10, 0);
      const deck = arrangeDeck(t, { 0: ['As', 'Ah'], 1: ['Ks', 'Kh'], 2: ['7c', '2d'] }, ['Qd', '9s', '4c', '3h', '8d']);
      Engine.startHand(t, RNG(9), { deck: deck });
      eq(t.hand.holeCards[0], ['As', 'Ah']); eq(t.hand.holeCards[2], ['7c', '2d']);
      checkDown(t);
      eq(t.hand.board, ['Qd', '9s', '4c', '3h', '8d']);
      eq(stacks(t), [1020, 990, 990]);
      eq(t.hand.result.pots[0].winners, [0]);
      eq(t.hand.result.showdown.length, 3);
    });
    test('50 Trois tapis de tailles différentes : pots annexes distribués', function () {
      const t = mkTable([100, 300, 300], 5, 10, 0);
      const deck = arrangeDeck(t, { 0: ['As', 'Ah'], 1: ['Ks', 'Kh'], 2: ['Qc', 'Qd'] }, ['2d', '7s', '9c', '3h', 'Jd']);
      Engine.startHand(t, RNG(10), { deck: deck });
      act(t, 'allin'); act(t, 'allin'); act(t, 'call');
      eq(t.phase, 'handOver');
      eq(stacks(t), [300, 400, 0]);
      eq(t.hand.result.pots.map(function (p) { return [p.amount, p.winners]; }), [[300, [0]], [400, [1]]]);
    });
    test('51 Split pot : mains identiques', function () {
      const t = mkTable([1000, 1000], 5, 10, 0);
      const deck = arrangeDeck(t, { 0: ['As', 'Kd'], 1: ['Ac', 'Kh'] }, ['2d', '7s', '9c', '3h', 'Jd']);
      Engine.startHand(t, RNG(11), { deck: deck });
      act(t, 'raise', 40); act(t, 'call');
      checkDown(t);
      eq(stacks(t), [1000, 1000]);
      eq(t.hand.result.pots[0].winners.length, 2);
    });
    test('52 Tapis suivi par un stack plus petit : excédent rendu', function () {
      const t = mkTable([1000, 200], 5, 10, 0);
      Engine.startHand(t, RNG(12));
      act(t, 'allin'); act(t, 'call');
      eq(t.hand.result.totalPot, 400);
      eq(sum(stacks(t)), 1200);
      ok(t.seats[0].stack >= 800, 'le gros stack ne risque que 200');
    });
    test('53 Actions illégales refusées', function () {
      const t = mkTable([1000, 1000, 1000], 5, 10, 0);
      Engine.startHand(t, RNG(13));
      ok(!Engine.applyAction(t, 1, { type: 'call' }).ok, 'parler hors de son tour');
      ok(!Engine.applyAction(t, 0, { type: 'check' }).ok, 'parole face à une mise');
      ok(!Engine.applyAction(t, 0, { type: 'danse' }).ok, 'action inconnue');
      ok(!Engine.applyAction(t, 0, null).ok, 'action absente');
      act(t, 'call'); act(t, 'call'); act(t, 'check');
      ok(!Engine.applyAction(t, t.hand.toAct, { type: 'call' }).ok, 'suivre sans mise');
      ok(!Engine.startHand(t, RNG(1)).ok, 'démarrer une main pendant une autre');
    });
    test('54 Le bouton tourne et saute les joueurs sans jetons', function () {
      const t = mkTable([1000, 0, 1000, 1000], 5, 10, 0);
      Engine.startHand(t, RNG(14));
      eq(t.hand.order, [0, 2, 3]); eq(t.buttonSeat, 0);
      act(t, 'fold'); act(t, 'fold');
      Engine.startHand(t, RNG(15));
      eq(t.buttonSeat, 2, 'le siège 1 (sans jetons) est sauté');
      eq([t.hand.sbSeat, t.hand.bbSeat], [3, 0]);
    });
    test('55 Positions à 6 et à 9 joueurs', function () {
      eq(positions([0, 1, 2, 3, 4, 5], 2), { 2: 'BTN', 3: 'SB', 4: 'BB', 5: 'UTG', 0: 'MP', 1: 'CO' });
      const p9 = positions([0, 1, 2, 3, 4, 5, 6, 7, 8], 0);
      eq([p9[0], p9[1], p9[2], p9[3], p9[8]], ['BTN', 'SB', 'BB', 'UTG', 'CO']);
    });

    /* ---------- F. Deck, aléatoire, sérialisation ---------- */
    test('56 Deck de 52 cartes uniques, conservé par le mélange', function () {
      const d = createDeck();
      eq(d.length, 52);
      const s = shuffle(d, RNG(99));
      eq(s.slice().sort(), d.slice().sort());
      ok(s.join() !== d.join(), 'le deck est bien mélangé');
    });
    test('57 Aléatoire déterministe et reprenable', function () {
      eq(shuffle(createDeck(), RNG(42)), shuffle(createDeck(), RNG(42)), 'même graine, même mélange');
      ok(shuffle(createDeck(), RNG(42)).join() !== shuffle(createDeck(), RNG(43)).join(), 'graines différentes');
      const a = RNG(777); a.next(); a.next();
      const b = RNG(a.getState());
      eq([a.next(), a.next(), a.int(1000)], [b.next(), b.next(), b.int(1000)], 'reprise depuis un état sauvegardé');
    });
    test('58 Sauvegarde/restauration en pleine main : suite identique', function () {
      const rngA = RNG(2024);
      const a = mkTable([1000, 800, 1200, 500], 5, 10, 1);
      Engine.startHand(a, rngA);
      act(a, 'raise', 30); act(a, 'call');
      // Instantané JSON (comme dans localStorage), puis reprise.
      const b = JSON.parse(JSON.stringify(a));
      const rngB = RNG(rngA.getState());
      [[a, rngA], [b, rngB]].forEach(function (pair) {
        checkDown(pair[0]);
        Engine.startHand(pair[0], pair[1]);
      });
      eq(JSON.stringify(b), JSON.stringify(a), 'les deux parties sont identiques');
    });

    /* ---------- G. Anti-triche ---------- */
    test('59 La vue d\'un bot ne contient aucune carte adverse ni le deck', function () {
      const t = mkTable([1000, 1000, 1000, 1000], 5, 10, 0);
      Engine.startHand(t, RNG(31));
      act(t, 'call'); act(t, 'call'); act(t, 'call'); act(t, 'check');   // flop
      for (let seat = 0; seat < 4; seat++) {
        const view = Engine.publicView(t, seat);
        const allowed = {};
        t.hand.holeCards[seat].concat(t.hand.board).forEach(function (c) { allowed[c] = true; });
        const found = [];
        (function walk(o) {
          if (typeof o === 'string') { if (isCard(o)) found.push(o); }
          else if (o && typeof o === 'object') Object.keys(o).forEach(function (k) { walk(o[k]); });
        })(view);
        found.forEach(function (c) { ok(allowed[c], 'carte interdite visible par le siège ' + seat + ' : ' + c); });
        eq(found.filter(function (c) { return t.hand.holeCards[seat].indexOf(c) >= 0; }).length, 2, 'ses 2 cartes seulement');
        ok(!('deck' in view) && !('holeCardsBySeat' in view), 'pas de deck dans la vue');
        ok(view.players.every(function (p) { return !('holeCards' in p) && !('cards' in p); }), 'pas de cartes par joueur');
      }
    });
    test('60 La vue est gelée : la modifier ne change pas la partie', function () {
      const t = mkTable([1000, 1000], 5, 10, 0);
      Engine.startHand(t, RNG(32));
      const view = Engine.publicView(t, 0);
      ok(Object.isFrozen(view) && Object.isFrozen(view.players) && Object.isFrozen(view.players[1]) && Object.isFrozen(view.holeCards), 'objet gelé en profondeur');
      try { view.players[1].stack = 0; view.holeCards[0] = 'XX'; view.board.push('As'); } catch (e) { /* mode strict : erreur attendue */ }
      eq(t.seats[1].stack, 990); eq(t.hand.board.length, 0);
      ok(isCard(t.hand.holeCards[0][0]), 'cartes réelles intactes');
    });
    test('61 Après l\'abattage, seules les cartes montrées deviennent publiques', function () {
      const t = mkTable([1000, 1000, 1000], 5, 10, 0);
      Engine.startHand(t, RNG(33));
      act(t, 'fold');                       // le siège 0 se couche : ses cartes restent cachées
      act(t, 'call'); act(t, 'check');
      checkDown(t);
      const view = Engine.publicView(t, 1);
      eq(view.shown.map(function (s) { return s.seat; }).sort(), [1, 2]);
      const hidden = t.hand.holeCards[0];
      ok(JSON.stringify(view).indexOf('"' + hidden[0] + '"') < 0 || t.hand.board.indexOf(hidden[0]) >= 0, 'cartes du joueur couché invisibles');
    });

    /* ---------- H. Robustesse ---------- */
    test('62 Simulation aléatoire de 400 mains : jetons conservés, aucune main bloquée', function () {
      const rng = RNG(20240607);
      let hands = 0;
      while (hands < 400) {
        const n = 2 + rng.int(8);
        const st = [];
        for (let i = 0; i < n; i++) st.push(1 + rng.int(rng.int(3) === 0 ? 30 : 2000));
        const t = mkTable(st, 5, 10, rng.int(n));
        const total = sum(st);
        for (let k = 0; k < 12 && hands < 400; k++) {
          if (!Engine.startHand(t, rng).ok) break;
          hands++;
          let guard = 0;
          while (t.phase !== 'handOver') {
            const seat = t.hand.toAct;
            const l = Engine.legalActions(t, seat);
            ok(l.canFold, 'le joueur désigné doit pouvoir agir');
            const roll = rng.int(100);
            let r;
            if (l.canRaise && roll < 25) {
              const span = l.maxRaiseTo - l.minRaiseTo;
              r = Engine.applyAction(t, seat, { type: 'raise', amount: l.minRaiseTo + (span > 0 ? rng.int(Math.min(span, 200) + 1) : 0) });
            } else if (l.canAllIn && roll < 33) r = Engine.applyAction(t, seat, { type: 'allin' });
            else if (l.canCheck) r = Engine.applyAction(t, seat, { type: 'check' });
            else if (roll < 75) r = Engine.applyAction(t, seat, { type: 'call' });
            else r = Engine.applyAction(t, seat, { type: 'fold' });
            ok(r.ok, 'action légale refusée : ' + r.error);
            eq(Engine.totalChips(t), total, 'jetons conservés pendant la main');
            if (++guard > 400) fail('main bloquée');
          }
          eq(sum(stacks(t)), total, 'jetons conservés en fin de main');
          ok(t.seats.every(function (s) { return s.stack >= 0 && Math.floor(s.stack) === s.stack; }), 'stacks entiers et positifs');
          eq(sum(Object.keys(t.hand.result.net).map(function (s) { return t.hand.result.net[s]; })), 0, 'gains et pertes se compensent');
        }
      }
    });

    /**
     * Exécute tous les tests.
     * @param silent true pour ne rien écrire dans la console
     * @returns { total, passed, failed, results: [{ name, ok, error }], text }
     */
    function run(silent) {
      const results = tests.map(function (t) {
        try { t.fn(); return { name: t.name, ok: true, error: null }; }
        catch (e) { return { name: t.name, ok: false, error: e && e.message ? e.message : String(e) }; }
      });
      const failed = results.filter(function (r) { return !r.ok; });
      const lines = results.map(function (r) { return (r.ok ? '✔ ' : '✘ ') + r.name + (r.ok ? '' : '\n    → ' + r.error); });
      lines.push('');
      lines.push(failed.length === 0
        ? 'Tous les tests réussis : ' + results.length + ' / ' + results.length
        : failed.length + ' échec(s) sur ' + results.length + ' tests');
      const summary = { total: results.length, passed: results.length - failed.length, failed: failed.length, results: results, text: lines.join('\n') };
      if (!silent && global.console) {
        global.console.log(summary.text);
      }
      return summary;
    }

    return { run: run, count: function () { return tests.length; } };
  })();

  global.Poker = Poker;
  global.PokerTests = PokerTests;
  if (typeof module !== 'undefined' && module.exports) module.exports = { Poker: Poker, PokerTests: PokerTests };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
