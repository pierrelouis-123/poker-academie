/* ==========================================================================
   bots.js — Adversaires virtuels
   --------------------------------------------------------------------------
   Quatre niveaux : débutant, intermédiaire, avancé, expert simulé.
   Les bots appliquent des heuristiques de poker (pas une stratégie GTO).

   RÈGLE ABSOLUE — AUCUNE TRICHE : la seule entrée d'un bot est la « vue
   publique » fabriquée par Poker.Engine.publicView (ses 2 cartes, le board,
   le pot, les mises, les stacks, les positions, l'historique public) et les
   tendances observées publiquement chez les adversaires. Ce fichier ne lit
   jamais l'état interne de la partie, ni le deck, ni les cartes adverses.

   Outils partagés (utilisés aussi par les conseils et l'analyse) :
     Bots.chen, Bots.handKey, Bots.analyzeHand, Bots.estimateEquity,
     Bots.boardTexture
   ========================================================================== */
(function (global) {
  'use strict';
  const P = global.Poker;

  /* ------------------------------------------------------------------------
     1. FORCE D'UNE MAIN DE DÉPART
     ------------------------------------------------------------------------ */

  /**
   * Score de Chen : estimation classique de la force d'une main de départ.
   * Environ -1,5 (7-2 dépareillés) à 20 (paire d'As).
   */
  function chen(hole) {
    const r1 = P.rankOf(hole[0]), r2 = P.rankOf(hole[1]);
    const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
    const pts = function (r) { return r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2; };
    let score = pts(hi);
    if (hi === lo) return Math.max(5, score * 2);
    if (hole[0][1] === hole[1][1]) score += 2;
    const gap = hi - lo - 1;
    score -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
    if (gap <= 1 && hi < 12) score += 1;
    return score;
  }

  /** Force pré-flop ramenée entre 0 et 1. */
  function preflopStrength(hole) {
    return Math.max(0, Math.min(1, (chen(hole) + 1.5) / 21.5));
  }

  /** Notation courte d'une main de départ : "AKs" (assortis), "T9o" (dépareillés), "QQ". */
  function handKey(hole) {
    const a = hole[0], b = hole[1];
    const hiFirst = P.rankOf(a) >= P.rankOf(b);
    const x = hiFirst ? a : b, y = hiFirst ? b : a;
    if (x[0] === y[0]) return x[0] + y[0];
    return x[0] + y[0] + (x[1] === y[1] ? 's' : 'o');
  }

  /* ------------------------------------------------------------------------
     2. LECTURE DE SA PROPRE MAIN APRÈS LE FLOP
     ------------------------------------------------------------------------ */

  function containsStraight(set) {
    for (let hi = 5; hi <= 14; hi++) {
      let okAll = true;
      for (let k = 0; k < 5; k++) {
        let r = hi - k;
        if (r === 1) r = 14;           // l'As sert de carte basse dans A-2-3-4-5
        if (!set[r]) { okAll = false; break; }
      }
      if (okAll) return true;
    }
    return false;
  }

  /** Rangs qui compléteraient une quinte (si la main n'en contient pas déjà une). */
  function straightOutRanks(ranks) {
    const set = {};
    ranks.forEach(function (r) { set[r] = true; });
    if (containsStraight(set)) return [];
    const outs = [];
    for (let r = 2; r <= 14; r++) {
      if (set[r]) continue;
      set[r] = true;
      if (containsStraight(set)) outs.push(r);
      delete set[r];
    }
    return outs;
  }

  /**
   * Analyse la main d'un joueur (ses 2 cartes + le board, 3 à 5 cartes).
   * @returns {
   *   category, description   catégorie et description de la meilleure main
   *   strength                force estimée de la main faite, de 0 à 1
   *   label                   libellé pédagogique ("top paire", "surpaire"...)
   *   flushDraw, straightDraw ('oesd' = par les deux bouts, 'gutshot' = ventrale)
   *   outs                    nombre de cartes améliorantes estimé
   *   overcards               deux cartes au-dessus du board, sans paire
   * }
   */
  function analyzeHand(hole, board) {
    const all = hole.concat(board);
    const ev = P.evaluate7(all);
    const hr = hole.map(P.rankOf).sort(function (a, b) { return b - a; });
    const br = board.map(P.rankOf);
    const boardCounts = {};
    br.forEach(function (r) { boardCounts[r] = (boardCounts[r] || 0) + 1; });
    const distinctBoard = Object.keys(boardCounts).map(Number).sort(function (a, b) { return b - a; });
    const maxBoard = distinctBoard[0];
    const pocket = hr[0] === hr[1];
    const cat = ev.category;
    const playsBoard = board.length === 5 && P.evaluate7(board).score === ev.score;

    function onePair(pr) {
      if (pocket) {
        if (pr > maxBoard) return { s: 0.66, l: 'surpaire (paire servie au-dessus du board)' };
        if (distinctBoard.length > 1 && pr > distinctBoard[1]) return { s: 0.45, l: 'paire servie intermédiaire' };
        return { s: 0.3, l: 'petite paire servie' };
      }
      if (pr === maxBoard) {
        const kicker = hr[0] === pr ? hr[1] : hr[0];
        const bonus = kicker >= 13 ? 0.08 : kicker >= 11 ? 0.05 : kicker >= 9 ? 0.02 : 0;
        return { s: 0.52 + bonus, l: 'top paire' + (kicker >= 11 ? ' avec un bon kicker' : ' avec un kicker faible') };
      }
      if (distinctBoard.length > 1 && pr === distinctBoard[1]) return { s: 0.4, l: 'deuxième paire' };
      return { s: 0.3, l: 'petite paire' };
    }

    let strength, label;
    if (playsBoard) {
      strength = cat >= 4 ? 0.3 : 0.18;
      label = 'le board joue seul (vos cartes ne l\'améliorent pas)';
    } else if (cat >= 7) { strength = 0.99; label = ev.name.toLowerCase(); }
    else if (cat === 6) { strength = 0.95; label = 'full'; }
    else if (cat === 5) {
      const suit = ev.best5[0][1];
      const mine = hole.filter(function (c) { return c[1] === suit; }).map(P.rankOf);
      const weak = board.filter(function (c) { return c[1] === suit; }).length >= 4 && Math.max.apply(null, mine.concat([0])) < 11;
      strength = weak ? 0.72 : 0.9; label = weak ? 'couleur faible' : 'couleur';
    }
    else if (cat === 4) { strength = 0.86; label = 'quinte'; }
    else if (cat === 3) {
      const tr = ev.tiebreak[0];
      if (boardCounts[tr] === 3) { strength = 0.25; label = 'brelan sur le board (commun à tous)'; }
      else if (pocket && hr[0] === tr) { strength = 0.88; label = 'brelan (set)'; }
      else { strength = 0.78; label = 'brelan'; }
    }
    else if (cat === 2) {
      const pairs = [ev.tiebreak[0], ev.tiebreak[1]];
      const mine = pairs.filter(function (r) { return hr.indexOf(r) >= 0; });
      const onBoard = pairs.filter(function (r) { return boardCounts[r] >= 2; });
      if (mine.length === 0) { strength = 0.2; label = 'double paire sur le board (commune à tous)'; }
      else if (onBoard.length >= 1) {
        const o = onePair(mine[0]);
        strength = Math.min(0.7, o.s + 0.03); label = o.l + ' (plus une paire commune sur le board)';
      } else { strength = 0.75; label = 'double paire'; }
    }
    else if (cat === 1) {
      const pr = ev.tiebreak[0];
      if (boardCounts[pr] === 2) { strength = 0.15 + (hr[0] === 14 ? 0.05 : 0); label = 'paire sur le board (commune à tous)'; }
      else { const o = onePair(pr); strength = o.s; label = o.l; }
    }
    else {
      strength = 0.08 + (hr[0] === 14 ? 0.07 : hr[0] >= 13 ? 0.04 : 0);
      label = 'aucune paire (hauteur ' + P.RANK_SINGULAR[hr[0]] + ')';
    }

    // Tirages (seulement s'il reste des cartes à venir).
    let flushDraw = false, straightDraw = null, outs = 0;
    const overcards = cat === 0 && hr[1] > maxBoard;
    if (board.length < 5) {
      if (cat < 5) {
        const suitCount = {};
        all.forEach(function (c) { suitCount[c[1]] = (suitCount[c[1]] || 0) + 1; });
        Object.keys(suitCount).forEach(function (s) {
          if (suitCount[s] === 4 && hole.some(function (c) { return c[1] === s; })) flushDraw = true;
        });
      }
      let straightRanks = 0;
      if (cat < 4) {
        const withHole = straightOutRanks(all.map(P.rankOf));
        const boardOnly = board.length >= 4 ? straightOutRanks(br) : [];
        straightRanks = withHole.filter(function (r) { return boardOnly.indexOf(r) < 0; }).length;
        if (straightRanks >= 2) straightDraw = 'oesd';
        else if (straightRanks === 1) straightDraw = 'gutshot';
      }
      outs = (flushDraw ? 9 : 0) + straightRanks * 4 - (flushDraw ? straightRanks : 0);
      if (outs === 0 && overcards) outs = 6;
      if (flushDraw || straightDraw) {
        const parts = [];
        if (flushDraw) parts.push('tirage couleur');
        if (straightDraw === 'oesd') parts.push('tirage quinte par les deux bouts');
        if (straightDraw === 'gutshot') parts.push('tirage quinte ventral');
        label += ' + ' + parts.join(' et ');
      }
    }

    return {
      category: cat, description: ev.description, strength: strength, label: label,
      flushDraw: flushDraw, straightDraw: straightDraw, outs: outs, overcards: overcards
    };
  }

  /**
   * Équité estimée par simulation (Monte-Carlo) : part du pot gagnée en moyenne
   * si l'on allait à l'abattage contre `nOpp` mains adverses TIRÉES AU HASARD.
   * Les cartes adverses sont inventées à chaque tirage : rien n'est lu dans la partie.
   */
  function estimateEquity(hole, board, nOpp, rng, iterations) {
    nOpp = Math.max(1, Math.min(8, nOpp || 1));
    iterations = iterations || 200;
    const known = {};
    hole.concat(board).forEach(function (c) { known[c] = true; });
    const deck = P.createDeck().filter(function (c) { return !known[c]; });
    const missing = 5 - board.length;
    const need = 2 * nOpp + missing;
    let total = 0;
    for (let it = 0; it < iterations; it++) {
      for (let i = 0; i < need; i++) {
        const j = i + rng.int(deck.length - i);
        const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
      }
      const full = board.concat(deck.slice(2 * nOpp, 2 * nOpp + missing));
      const mine = P.evaluate7(hole.concat(full)).score;
      let better = false, ties = 0;
      for (let o = 0; o < nOpp; o++) {
        const sc = P.evaluate7([deck[2 * o], deck[2 * o + 1]].concat(full)).score;
        if (sc > mine) { better = true; break; }
        if (sc === mine) ties++;
      }
      if (!better) total += 1 / (1 + ties);
    }
    return total / iterations;
  }

  /** Texture du board : sec (peu de tirages) ou « mouillé » (beaucoup de tirages). */
  function boardTexture(board) {
    const suits = {}, ranks = {};
    board.forEach(function (c) { suits[c[1]] = (suits[c[1]] || 0) + 1; ranks[P.rankOf(c)] = (ranks[P.rankOf(c)] || 0) + 1; });
    const maxSuit = Math.max.apply(null, Object.keys(suits).map(function (s) { return suits[s]; }).concat([0]));
    const uniq = Object.keys(ranks).map(Number).sort(function (a, b) { return a - b; });
    let close = 0;
    for (let i = 1; i < uniq.length; i++) if (uniq[i] - uniq[i - 1] <= 2) close++;
    const paired = uniq.length < board.length;
    let wetness = (maxSuit >= 3 ? 0.5 : maxSuit === 2 ? 0.2 : 0) + Math.min(0.5, close * 0.2);
    if (paired) wetness -= 0.1;
    wetness = Math.max(0, Math.min(1, wetness));
    return {
      paired: paired,
      monotone: maxSuit >= 3,
      twoTone: maxSuit === 2,
      connected: close >= 2,
      high: uniq.filter(function (r) { return r >= 10; }).length,
      wetness: wetness,
      wet: wetness >= 0.4,
      label: wetness >= 0.6 ? 'très dangereux (beaucoup de tirages possibles)' : wetness >= 0.4 ? 'assez dangereux (des tirages possibles)' : 'plutôt sec (peu de tirages)'
    };
  }

  /* ------------------------------------------------------------------------
     3. TENDANCES OBSERVÉES PUBLIQUEMENT
     ------------------------------------------------------------------------ */

  function newTendency() {
    return { hands: 0, vpip: 0, pfr: 0, bets: 0, raises: 0, calls: 0, folds: 0, facedBet: 0, foldToBet: 0 };
  }

  /**
   * Met à jour les tendances de chaque joueur à partir de l'historique PUBLIC
   * d'une main terminée.
   * @param tendencies { idJoueur: tendance }
   * @param info       { players: [{ seat, id }], actions: [...] }
   */
  function recordHand(tendencies, info) {
    info.players.forEach(function (pl) {
      const t = tendencies[pl.id] || (tendencies[pl.id] = newTendency());
      t.hands++;
      let vpip = false, pfr = false;
      info.actions.forEach(function (a) {
        if (a.seat !== pl.seat) return;
        const pre = a.street === 'preflop';
        if (a.type === 'call') { t.calls++; if (pre) vpip = true; else t.facedBet++; }
        else if (a.type === 'bet') { t.bets++; if (pre) { vpip = true; pfr = true; } }
        else if (a.type === 'raise') { t.raises++; if (pre) { vpip = true; pfr = true; } else t.facedBet++; }
        else if (a.type === 'fold') { t.folds++; if (!pre) { t.facedBet++; t.foldToBet++; } }
      });
      if (vpip) t.vpip++;
      if (pfr) t.pfr++;
    });
  }

  /** Résumé lisible d'une tendance (pourcentages). */
  function profileOf(t) {
    if (!t || !t.hands) return { hands: 0, reliable: false, vpip: 0, pfr: 0, aggression: 0, foldToBet: 0 };
    const agg = t.bets + t.raises, tot = agg + t.calls;
    return {
      hands: t.hands,
      reliable: t.hands >= 10,
      vpip: 100 * t.vpip / t.hands,
      pfr: 100 * t.pfr / t.hands,
      aggression: tot ? 100 * agg / tot : 0,
      foldToBet: t.facedBet ? 100 * t.foldToBet / t.facedBet : 0
    };
  }

  /* ------------------------------------------------------------------------
     4. PROFILS DES QUATRE NIVEAUX
     Les seuils « open », « callRaise »... sont des scores de Chen.
     ------------------------------------------------------------------------ */
  const PROFILES = {
    debutant: {
      label: 'Débutant',
      open: { early: 4.5, middle: 4, late: 4, blinds: 4 }, limp: 0.8, looseCall: 0.25, openSize: 2,
      callRaise: 5.5, threeBet: 16, threeBetBluff: 0, fourBet: 20, callAllIn: 9,
      cbet: 0.2, valueThresh: 0.6, valueFreq: 0.6, raiseThresh: 0.93, callThresh: 0.28,
      bluff: 0.04, semiBluff: 0.05, mc: 0, usesOdds: false, adapt: false
    },
    intermediaire: {
      label: 'Intermédiaire',
      open: { early: 9, middle: 8, late: 7, blinds: 8 }, limp: 0.05, looseCall: 0, openSize: 3,
      callRaise: { early: 9.5, middle: 9, late: 8.5, blinds: 8 }, threeBet: 12, threeBetBluff: 0, fourBet: 16, callAllIn: 12,
      cbet: 0.55, valueThresh: 0.55, valueFreq: 0.9, raiseThresh: 0.85, callThresh: 0.5,
      bluff: 0.03, semiBluff: 0.15, mc: 0, usesOdds: true, adapt: false
    },
    avance: {
      label: 'Avancé',
      open: { early: 9, middle: 7.5, late: 6, blinds: 6.5 }, limp: 0, looseCall: 0, openSize: 2.5,
      callRaise: { early: 9.5, middle: 9, late: 8, blinds: 7.5 }, threeBet: 12, threeBetBluff: 0.08, fourBet: 16, callAllIn: 12,
      cbet: 0.65, valueThresh: 0.5, valueFreq: 0.92, raiseThresh: 0.82, callThresh: 0.5,
      bluff: 0.12, semiBluff: 0.4, mc: 120, usesOdds: true, adapt: false
    },
    expert: {
      label: 'Expert simulé',
      open: { early: 8.5, middle: 7, late: 5.5, blinds: 6 }, limp: 0, looseCall: 0, openSize: 2.5,
      callRaise: { early: 9.5, middle: 8.5, late: 7.5, blinds: 7 }, threeBet: 11.5, threeBetBluff: 0.1, fourBet: 15, callAllIn: 11.5,
      cbet: 0.7, valueThresh: 0.48, valueFreq: 0.94, raiseThresh: 0.8, callThresh: 0.5,
      bluff: 0.16, semiBluff: 0.5, mc: 200, usesOdds: true, adapt: true
    }
  };

  /** Styles individuels : t décale la sélection de mains, a multiplie l'agressivité. */
  const STYLES = {
    equilibre: { label: 'équilibré', t: 0, a: 1 },
    serre: { label: 'serré', t: 0.7, a: 0.9 },
    large: { label: 'large', t: -0.8, a: 1 },
    agressif: { label: 'agressif', t: -0.3, a: 1.3 },
    prudent: { label: 'prudent', t: 0.3, a: 0.75 }
  };
  const STYLE_KEYS = Object.keys(STYLES);
  const NAMES = ['Léa', 'Marc', 'Inès', 'Paul', 'Zoé', 'Hugo', 'Nina', 'Tom', 'Jade', 'Louis', 'Emma', 'Noah', 'Lina', 'Axel', 'Rose', 'Malo'];

  /** Crée n adversaires d'un niveau donné, avec des prénoms et des styles variés. */
  function createRoster(n, level, rng) {
    const names = P.shuffle(NAMES, rng);
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ id: 'bot' + (i + 1), name: names[i % names.length], isHuman: false, botLevel: level, botStyle: STYLE_KEYS[rng.int(STYLE_KEYS.length)] });
    }
    return out;
  }

  /* ------------------------------------------------------------------------
     5. DÉCISION
     ------------------------------------------------------------------------ */

  /** Rend une intention toujours légale (sécurité : un bot ne peut pas bloquer la partie). */
  function finalize(intent, view) {
    const L = view.legal;
    let type = intent.type;
    if (type === 'fold' && L.canCheck) type = 'check';
    if (type === 'check' && !L.canCheck) type = 'fold';
    if (type === 'call' && !L.canCall) type = 'check';
    if (type === 'allin') {
      if (L.canRaise) { type = 'raise'; intent.amount = L.maxRaiseTo; }
      else type = L.canCall ? 'call' : 'check';
    }
    if (type === 'raise' || type === 'bet') {
      if (!L.canRaise) return { type: L.canCall ? 'call' : 'check', reason: intent.reason };
      let to = Math.round(intent.amount);
      if (!(to >= L.minRaiseTo)) to = L.minRaiseTo;
      if (to >= L.maxRaiseTo * 0.8) to = L.maxRaiseTo;     // presque tout le stack : autant faire tapis
      return { type: L.isBet ? 'bet' : 'raise', amount: Math.min(to, L.maxRaiseTo), reason: intent.reason };
    }
    return { type: type, reason: intent.reason };
  }

  function idOfSeat(view, seat) {
    for (let i = 0; i < view.players.length; i++) if (view.players[i].seat === seat) return view.players[i].id;
    return null;
  }

  function decidePreflop(view, prof, style, tend, rng, icm) {
    const L = view.legal, bb = view.bb;
    const s = chen(view.holeCards);
    let group = P.positionGroup(view.position);
    if (view.numPlayers === 2 && view.position === 'BTN') group = 'late';
    const acts = view.actions.filter(function (a) { return a.street === 'preflop'; });
    const raises = acts.filter(function (a) { return a.type === 'raise'; });
    const limpers = raises.length === 0 ? acts.filter(function (a) { return a.type === 'call'; }).length : 0;
    const shortAdj = view.numPlayers === 2 ? -2.5 : view.numPlayers === 3 ? -1 : 0;
    const t = style.t + shortAdj;
    const stack = L.stack + L.streetBet;
    const stackBB = stack / bb;

    /* --- Personne n'a relancé --- */
    if (raises.length === 0) {
      const th = prof.open[group] + t;
      if (s >= th) {
        if (L.toCall > 0 && rng.next() < prof.limp) return { type: 'call', reason: 'suit simplement (limp)' };
        if (stackBB <= 12 && s >= th + 1 && prof.usesOdds) return { type: 'allin', reason: 'tapis avec un petit stack' };
        return { type: 'raise', amount: bb * (prof.openSize + limpers), reason: 'ouvre le pot' };
      }
      if (L.canCheck) return { type: 'check', reason: 'parole gratuite' };
      if (view.seat === view.sbSeat && s >= th - 2) return { type: 'call', reason: 'complète la petite blinde' };
      if (prof.looseCall && rng.next() < prof.looseCall) return { type: 'call', reason: 'suit par curiosité' };
      return { type: 'fold', reason: 'main trop faible' };
    }

    /* --- Face à une ou plusieurs relances --- */
    const lastRaiser = raises[raises.length - 1].seat;
    let adj = 0;
    if (prof.adapt) {
      const tp = profileOf(tend[idOfSeat(view, lastRaiser)]);
      if (tp.reliable) { if (tp.pfr < 10) adj = 1.5; else if (tp.pfr > 28 || tp.vpip > 45) adj = -1.2; }
    }
    const share = L.toCall / Math.max(1, L.stack);
    if (L.callIsAllIn || share >= 0.4) {
      // En tournoi, près des places payées, risquer son stack exige une main plus forte (ICM).
      const icmAdj = prof.usesOdds && stackBB > 8 ? icm * 1.5 : 0;
      const th = prof.callAllIn + style.t * 0.5 + adj + icmAdj + (stackBB <= 15 ? -2.5 : stackBB <= 30 ? -1 : 0) + (view.numPlayers === 2 ? -1 : 0);
      return s >= th ? { type: L.callIsAllIn ? 'call' : 'allin', reason: 'engage son stack avec une main forte' } : { type: 'fold', reason: 'trop cher' };
    }
    if (raises.length === 1) {
      const threeBetSize = view.currentBet * (group === 'blinds' ? 3.5 : 3);   // plus gros hors de position
      if (s >= prof.threeBet + t * 0.5 + adj) return { type: 'raise', amount: threeBetSize, reason: 'sur-relance pour valeur' };
      const hi = Math.max(P.rankOf(view.holeCards[0]), P.rankOf(view.holeCards[1]));
      const lo = Math.min(P.rankOf(view.holeCards[0]), P.rankOf(view.holeCards[1]));
      const suited = view.holeCards[0][1] === view.holeCards[1][1];
      if (prof.threeBetBluff && hi === 14 && suited && lo <= 5 && (group === 'late' || group === 'blinds') && rng.next() < prof.threeBetBluff * style.a) {
        return { type: 'raise', amount: view.currentBet * 3, reason: 'sur-relance en bluff' };
      }
      // Avancé et expert : défense plus large des blinds contre une ouverture de fin de parole.
      let steal = 0;
      if (prof.mc && group === 'blinds') {
        const rp = view.players.filter(function (p) { return p.seat === lastRaiser; })[0];
        if (rp && P.positionGroup(rp.position) === 'late') steal = -1;
      }
      const cr = (typeof prof.callRaise === 'number' ? prof.callRaise : prof.callRaise[group]) + t + adj + steal;
      const odds = L.toCall / (L.pot + L.toCall);
      const disc = (prof.usesOdds && view.seat === view.bbSeat && odds < 0.3) ? -1 : 0;
      const affordable = !prof.usesOdds || L.toCall <= stack * 0.15;
      if (s >= cr + disc && affordable) return { type: 'call', reason: 'suit la relance' };
      if (prof.usesOdds && hi === lo && L.toCall <= stack * 0.06) return { type: 'call', reason: 'suit avec une petite paire pour toucher un brelan' };
      return { type: 'fold', reason: 'main insuffisante face à une relance' };
    }
    if (s >= prof.fourBet + adj) {
      return { type: L.toCall >= L.stack * 0.3 ? 'allin' : 'raise', amount: Math.round(view.currentBet * 2.3), reason: 'relance encore avec une main premium' };
    }
    if (s >= prof.threeBet + adj && L.toCall <= stack * 0.25) return { type: 'call', reason: 'suit la sur-relance' };
    if (!prof.usesOdds && s >= prof.callRaise + 2 && rng.next() < 0.5) return { type: 'call', reason: 'suit trop largement' };
    return { type: 'fold', reason: 'trop de relances' };
  }

  function decidePostflop(view, prof, style, tend, rng, icm) {
    const L = view.legal, pot = L.pot;
    const info = analyzeHand(view.holeCards, view.board);
    const tex = boardTexture(view.board);
    const nOpp = Math.max(1, view.numActive - 1);
    const street = view.street;
    let s = info.strength;
    if (nOpp >= 2 && s < 0.8) s -= 0.04 * (nOpp - 1);
    const strongDraw = street !== 'river' && info.outs >= 8;
    const anyDraw = street !== 'river' && info.outs >= 4 && (info.flushDraw || info.straightDraw);

    // Adaptation (expert) : moyenne des tendances des adversaires encore en jeu.
    let bluffMul = 1, valueAdj = 0;
    if (prof.adapt) {
      let sum = 0, n = 0;
      view.players.forEach(function (p) {
        if (p.isSelf || p.folded) return;
        const tp = profileOf(tend[p.id]);
        if (tp.reliable) { sum += tp.foldToBet; n++; }
      });
      if (n) {
        const avg = sum / n;
        if (avg > 55) bluffMul = 1.5;
        else if (avg < 30) { bluffMul = 0.4; valueAdj = -0.04; }
      }
    }

    const betTo = function (frac) { return L.streetBet + Math.max(view.bb, Math.round(frac * pot)); };
    const raiseTo = function (frac) { return view.currentBet + Math.max(view.minRaise, Math.round(frac * (pot + L.toCall))); };

    /* --- Personne n'a misé : miser ou dire parole --- */
    if (L.toCall === 0) {
      if (s >= prof.valueThresh + valueAdj) {
        if (prof.mc && s >= 0.93 && !tex.wet && street !== 'river' && rng.next() < 0.2) return { type: 'check', reason: 'piège avec une très grosse main' };
        if (rng.next() < prof.valueFreq) {
          let size;
          if (!prof.usesOdds) size = 0.3 + 0.3 * rng.next();
          else if (!prof.mc) size = 0.66;
          else size = s >= 0.8 ? (tex.wet || street === 'river' ? 0.8 : 0.6) : (tex.wet ? 0.6 : 0.4);
          return { type: 'bet', amount: betTo(size), reason: 'mise pour valeur' };
        }
        return { type: 'check', reason: 'parole' };
      }
      if (street === 'flop' && view.preflopAggressor === view.seat) {
        let f = prof.cbet * style.a * bluffMul;
        if (nOpp >= 2) f *= 0.45;
        if (prof.mc && tex.wet) f *= 0.7;
        if (rng.next() < f) return { type: 'bet', amount: betTo(prof.mc ? (tex.wet ? 0.6 : 0.33) : 0.5), reason: 'mise de continuation' };
      }
      if (strongDraw && rng.next() < prof.semiBluff * style.a) return { type: 'bet', amount: betTo(0.6), reason: 'semi-bluff avec un tirage' };
      if (prof.mc && s < 0.4 && nOpp <= 2) {
        // Deuxième baril : le c-bet du flop a été suivi et le turn apporte une grosse carte
        // (elle favorise la range du relanceur d'avant-flop).
        if (street === 'turn' && nOpp === 1 && view.preflopAggressor === view.seat) {
          const betFlop = view.actions.some(function (a) { return a.street === 'flop' && a.seat === view.seat && a.type === 'bet'; });
          const turnRank = P.rankOf(view.board[3]);
          const scare = turnRank >= 13 && view.board.slice(0, 3).every(function (c) { return P.rankOf(c) < turnRank; });
          if (betFlop && scare && rng.next() < 0.5 * style.a * bluffMul) return { type: 'bet', amount: betTo(0.66), reason: 'deuxième baril sur une carte haute' };
        }
        // Mise de position : tous les adversaires ont dit parole avant lui.
        const checks = view.actions.filter(function (a) { return a.street === street && a.type === 'check'; }).length;
        if (checks >= nOpp && s < 0.35 && rng.next() < 0.28 * style.a * bluffMul) return { type: 'bet', amount: betTo(0.5), reason: 'mise de position après des paroles' };
      }
      if (street !== 'flop' && nOpp === 1 && s < 0.3 && rng.next() < prof.bluff * style.a * bluffMul) {
        return { type: 'bet', amount: betTo(0.66), reason: 'bluff' };
      }
      if (prof.usesOdds && s >= 0.4 && street !== 'river' && nOpp === 1 && rng.next() < 0.35 * style.a) {
        return { type: 'bet', amount: betTo(0.4), reason: 'petite mise de protection' };
      }
      return { type: 'check', reason: 'parole' };
    }

    /* --- Face à une mise --- */
    const odds = L.toCall / (pot + L.toCall);
    const betFrac = L.toCall / Math.max(1, pot - L.toCall);
    const big = L.callIsAllIn || L.toCall >= 0.5 * L.stack;

    if (s >= prof.raiseThresh) {
      if (L.canRaise && rng.next() < (prof.usesOdds ? 0.75 : 0.5)) {
        return { type: 'raise', amount: prof.usesOdds ? raiseTo(0.8) : L.minRaiseTo, reason: 'relance pour valeur' };
      }
      return { type: 'call', reason: 'suit avec une main très forte' };
    }
    if (strongDraw && L.canRaise && street === 'flop' && !big && rng.next() < prof.semiBluff * 0.35 * style.a) {
      return { type: 'raise', amount: raiseTo(0.7), reason: 'relance en semi-bluff' };
    }

    if (prof.mc) {
      // Avancé / expert : équité simulée, pénalisée car une mise annonce de la force.
      const eq = estimateEquity(view.holeCards, view.board, nOpp, rng, prof.mc);
      let penalty = 0.10 + 0.14 * Math.min(1.2, betFrac) + (street === 'river' ? 0.05 : 0) + 0.03 * (nOpp - 1);
      const streetActs = view.actions.filter(function (a) { return a.street === street; });
      if (streetActs.some(function (a) { return a.type === 'raise'; })) penalty += 0.1;
      if (prof.adapt && view.lastAggressor !== null) {
        const tp = profileOf(tend[idOfSeat(view, view.lastAggressor)]);
        if (tp.reliable) { if (tp.aggression > 55) penalty -= 0.06; else if (tp.aggression < 25) penalty += 0.06; }
      }
      if (eq - penalty >= odds + (big ? 0.04 : 0)) return { type: 'call', reason: 'la cote est suffisante' };
      if (anyDraw && !big && info.outs * 0.021 >= odds * 0.8 && L.stack > pot * 2) return { type: 'call', reason: 'tirage avec cotes implicites' };
      return { type: 'fold', reason: 'cote insuffisante' };
    }

    if (prof.usesOdds) {
      // Intermédiaire : règles simples (« ABC poker »).
      if (s >= 0.5) return (big && s < 0.6 && betFrac > 0.9) ? { type: 'fold', reason: 'trop cher pour une paire' } : { type: 'call', reason: 'suit avec une bonne paire' };
      if (s >= 0.38 && betFrac <= 0.6 && street !== 'river') return { type: 'call', reason: 'suit une petite mise' };
      if (anyDraw) {
        const p = info.outs * (street === 'flop' && L.callIsAllIn ? 0.04 : 0.02);
        if (p >= odds || (street === 'flop' && info.outs >= 8 && betFrac <= 0.75)) return { type: 'call', reason: 'tirage avec la cote' };
      }
      return { type: 'fold', reason: 'rien de suffisant' };
    }

    // Débutant : suit trop souvent, se couche rarement avec une paire ou un tirage.
    if (s >= prof.callThresh) return (big && s < 0.5 && rng.next() < 0.6) ? { type: 'fold', reason: 'prend peur' } : { type: 'call', reason: 'suit avec une paire' };
    if (anyDraw) return (big && rng.next() < 0.5) ? { type: 'fold', reason: 'prend peur' } : { type: 'call', reason: 'suit avec un tirage' };
    if ((info.overcards || s >= 0.15) && betFrac <= 0.5 && rng.next() < 0.4) return { type: 'call', reason: 'suit par curiosité' };
    if (rng.next() < 0.08) return { type: 'call', reason: 'suit sans raison' };
    return { type: 'fold', reason: 'abandonne' };
  }

  /**
   * Décision d'un bot.
   * @param view   vue publique gelée (Poker.Engine.publicView) — seule source d'information sur la main
   * @param ctx    { level, style, tendencies, rng }
   * @returns { type: 'fold' | 'check' | 'call' | 'bet' | 'raise', amount?, reason }
   */
  function decide(view, ctx) {
    const prof = PROFILES[ctx.level] || PROFILES.intermediaire;
    const style = STYLES[ctx.style] || STYLES.equilibre;
    const tend = ctx.tendencies || {};
    if (!view || !view.legal) return { type: 'fold', reason: 'aucune action possible' };
    let intent;
    try {
      intent = view.street === 'preflop'
        ? decidePreflop(view, prof, style, tend, ctx.rng, ctx.icmPressure || 0)
        : decidePostflop(view, prof, style, tend, ctx.rng, ctx.icmPressure || 0);
    } catch (e) {
      intent = { type: 'check', reason: 'décision de secours' };
    }
    return finalize(intent, view);
  }

  global.Bots = {
    PROFILES: PROFILES,
    STYLES: STYLES,
    LEVELS: ['debutant', 'intermediaire', 'avance', 'expert'],
    levelLabel: function (level) { return PROFILES[level] ? PROFILES[level].label : level; },
    chen: chen,
    preflopStrength: preflopStrength,
    handKey: handKey,
    analyzeHand: analyzeHand,
    estimateEquity: estimateEquity,
    boardTexture: boardTexture,
    newTendency: newTendency,
    recordHand: recordHand,
    profileOf: profileOf,
    createRoster: createRoster,
    decide: decide
  };

})(typeof window !== 'undefined' ? window : globalThis);
