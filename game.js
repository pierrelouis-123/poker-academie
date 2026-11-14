/* ==========================================================================
   game.js — Boucle de jeu
   --------------------------------------------------------------------------
   Orchestre une table : création, tours des bots, action du joueur, fin de
   main (statistiques, analyse), recave, sortie de table.

   Tout l'état de la partie vit dans Store.state.currentGame (objet JSON pur) :
   il est sauvegardé après chaque action validée et peut être restauré à tout
   instant avec Game.resume(). Game ne touche jamais au DOM : il émet des
   événements ('update', 'heroTurn', 'handOver') que l'interface affiche.

   Les bots ne reçoivent que Poker.Engine.publicView(...) : aucune triche.
   ========================================================================== */
(function (global) {
  'use strict';
  const P = global.Poker;
  const E = P.Engine;

  const DELAYS = {
    normal: { bot: 900, street: 750, win: 500 },
    fast: { bot: 220, street: 220, win: 150 }
  };

  /* Structures des tournois. Les blinds montent toutes les `handsPerLevel` mains
     (et non selon une horloge) : la partie reste ainsi sauvegardable et reprenable à l'identique. */
  const BLIND_LEVELS = [[10, 20], [15, 30], [25, 50], [40, 80], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400],
    [300, 600], [400, 800], [600, 1200], [800, 1600], [1000, 2000], [1500, 3000], [2000, 4000], [3000, 6000], [5000, 10000]];
  const STRUCTURES = {
    tournament: { label: 'Tournoi', startStack: 3000, handsPerLevel: 10, levels: BLIND_LEVELS },
    sng: { label: 'Sit & Go', startStack: 1500, handsPerLevel: 6, levels: BLIND_LEVELS }
  };
  const BUY_INS = [100, 500, 1000, 5000];

  /** Répartition des prix selon le nombre d'inscrits. */
  function payoutShares(players) {
    if (players <= 3) return [1];
    if (players <= 6) return [0.65, 0.35];
    return [0.5, 0.3, 0.2];
  }

  /**
   * ICM (Independent Chip Model, méthode de Malmuth-Harville) : valeur en prix
   * de chaque stack. La probabilité de finir premier est proportionnelle au stack,
   * puis on répète le raisonnement pour les places suivantes.
   */
  function icm(stacks, prizes) {
    const eq = stacks.map(function () { return 0; });
    (function rec(alive, prob, place) {
      if (place >= prizes.length || !alive.length) return;
      let total = 0;
      alive.forEach(function (i) { total += stacks[i]; });
      if (total <= 0) return;
      alive.forEach(function (i) {
        const p = prob * stacks[i] / total;
        if (p <= 0) return;
        eq[i] += p * prizes[place];
        rec(alive.filter(function (j) { return j !== i; }), p, place + 1);
      });
    })(stacks.map(function (_, i) { return i; }).filter(function (i) { return stacks[i] > 0; }), 1, 0);
    return eq;
  }

  const Game = {
    STRUCTURES: STRUCTURES,
    BUY_INS: BUY_INS,
    icm: icm,
    isTournamentMode: function (mode) { return mode === 'tournament' || mode === 'sng'; },

    /**
     * Ce que l'interface doit montrer : toutes les entrées de l'historique dont
     * le numéro est <= n. Permet de dérouler un board pas à pas alors que le
     * moteur, lui, a déjà calculé (et sauvegardé) la fin de la main.
     */
    display: { n: 0, showdown: false },
    busy: false,
    _token: 0,
    _listeners: {},
    _hintCache: null,

    on: function (evt, cb) { (Game._listeners[evt] = Game._listeners[evt] || []).push(cb); },
    _emit: function (evt, data) {
      (Game._listeners[evt] || []).forEach(function (cb) {
        try { cb(data); } catch (e) { if (global.console) global.console.error(e); }
      });
    },

    /** Partie en cours (ou null). */
    state: function () { return global.Store.state.currentGame; },
    isActive: function () { return !!Game.state(); },
    table: function () { const g = Game.state(); return g ? g.table : null; },

    /** Vrai si une main est en cours (ni terminée, ni en attente). */
    handInProgress: function () {
      const t = Game.table();
      return !!t && t.phase !== 'idle' && t.phase !== 'handOver';
    },

    /** Complète et vérifie une configuration de partie. */
    normalizeConfig: function (c) {
      const cfg = {
        mode: ['cash', 'learning', 'tournament', 'sng'].indexOf(c.mode) >= 0 ? c.mode : 'cash',
        buyIn: BUY_INS.indexOf(Number(c.buyIn)) >= 0 ? Number(c.buyIn) : 500,
        freeroll: !!c.freeroll,
        players: Math.max(2, Math.min(9, parseInt(c.players, 10) || 6)),
        botLevel: global.Bots.LEVELS.indexOf(c.botLevel) >= 0 ? c.botLevel : 'debutant',
        speed: c.speed === 'fast' ? 'fast' : 'normal',
        sb: Math.max(1, Math.floor(c.sb) || 5),
        bb: Math.max(2, Math.floor(c.bb) || 10),
        stackBB: [40, 100, 200].indexOf(Number(c.stackBB)) >= 0 ? Number(c.stackBB) : 100,
        hints: !!c.hints,
        review: !!c.review
      };
      if (cfg.sb >= cfg.bb) cfg.sb = Math.floor(cfg.bb / 2);
      // Le mode Apprentissage est une table d'entraînement gratuite, conseils et révision activés.
      if (cfg.mode === 'learning') { cfg.freeroll = true; cfg.hints = true; cfg.review = true; }
      // Tournoi et Sit & Go : blinds et stack fixés par la structure.
      if (Game.isTournamentMode(cfg.mode)) {
        const st = STRUCTURES[cfg.mode];
        cfg.sb = st.levels[0][0];
        cfg.bb = st.levels[0][1];
        cfg.stackBB = st.startStack / cfg.bb;
      }
      return cfg;
    },

    /** Prix d'entrée : buy-in du tournoi, ou stack de départ en cash game. */
    buyInFor: function (cfg) { return Game.isTournamentMode(cfg.mode) ? cfg.buyIn : cfg.bb * cfg.stackBB; },

    /** Montants des prix pour un tournoi (tableau, de la 1re place à la dernière place payée). */
    prizesFor: function (cfg) {
      if (cfg.freeroll) return [];
      const pool = cfg.buyIn * cfg.players;
      const shares = payoutShares(cfg.players);
      const prizes = shares.map(function (s) { return Math.floor(pool * s); });
      prizes[0] += pool - prizes.reduce(function (a, b) { return a + b; }, 0);
      return prizes;
    },

    /**
     * Crée une table et distribue la première main.
     * @returns { ok: true } ou { ok: false, error }
     */
    create: function (config) {
      const S = global.Store;
      if (Game.isActive()) return { ok: false, error: 'Une partie est déjà en cours.' };
      const cfg = Game.normalizeConfig(config);
      const tour = Game.isTournamentMode(cfg.mode);
      const cost = Game.buyInFor(cfg);
      const startStack = tour ? STRUCTURES[cfg.mode].startStack : cost;
      if (!cfg.freeroll && global.Bankroll.balance() < cost) {
        return { ok: false, error: 'Bankroll insuffisante : il faut ' + cost.toLocaleString('fr-FR') + ' jetons pour ce buy-in. Ajoutez de l\'argent virtuel (onglet Bankroll), choisissez un buy-in plus petit ou cochez Freeroll.' };
      }
      const rng = P.RNG(P.RNG.randomSeed());
      const seats = [{ id: 'hero', name: S.state.profile.name || 'Vous', isHuman: true, stack: startStack }]
        .concat(global.Bots.createRoster(cfg.players - 1, cfg.botLevel, rng).map(function (b) { b.stack = startStack; return b; }));
      const table = E.createTable({ sb: cfg.sb, bb: cfg.bb, buttonSeat: rng.int(cfg.players), seats: seats });

      const sessionId = global.Stats.startSession(cfg);
      if (!cfg.freeroll) {
        global.Bankroll.buyIn(cost, sessionId, 'buyin', (tour ? STRUCTURES[cfg.mode].label : 'Table ' + cfg.sb + '/' + cfg.bb) + ', ' + cfg.players + ' joueurs');
        global.Stats.addBuyIn(sessionId, cost);
      }
      const prizes = tour ? Game.prizesFor(cfg) : [];
      S.state.currentGame = {
        id: S.uid('g'), sessionId: sessionId, mode: cfg.mode, freeroll: cfg.freeroll, config: cfg,
        startStack: startStack, rngState: rng.getState(), table: table, heroSeat: 0,
        tendencies: {}, heroDecisions: [], recordedHand: 0, lastHandId: null, createdAt: Date.now(),
        // Tournoi : niveau de blinds, joueurs éliminés (siège et place), résultat final.
        tournament: tour ? {
          buyIn: cfg.freeroll ? 0 : cost, prizes: prizes, prizePool: prizes.reduce(function (a, b) { return a + b; }, 0),
          level: 0, out: [], finished: false, results: null, heroPlace: null, prize: 0
        } : null
      };
      S.state.settings.lastTableConfig = cfg;
      S.state.ui.gameScreen = 'table';
      Game._token++;
      Game.busy = false;
      const r = Game._startHand();
      return r.ok ? { ok: true } : r;
    },

    /** Distribue une nouvelle main (les bots sans jetons se recavent automatiquement). */
    _startHand: function () {
      const g = Game.state(), t = g.table;
      if (g.tournament) {
        if (g.tournament.finished) return { ok: false, error: 'Le tournoi est terminé.' };
        // Montée des blinds selon le nombre de mains déjà jouées.
        const st = STRUCTURES[g.mode];
        const lvl = Math.min(st.levels.length - 1, Math.floor(t.handNumber / st.handsPerLevel));
        t.sb = st.levels[lvl][0];
        t.bb = st.levels[lvl][1];
        if (lvl !== g.tournament.level) { g.tournament.level = lvl; Game._emit('level', { level: lvl, sb: t.sb, bb: t.bb }); }
      } else {
        t.seats.forEach(function (s) { if (!s.isHuman && s.stack === 0) s.stack = g.startStack; });
      }
      if (t.seats[g.heroSeat].stack === 0) return { ok: false, needRebuy: true, error: 'Vous n\'avez plus de jetons : recavez-vous ou quittez la table.' };
      const rng = P.RNG(g.rngState);
      const res = E.startHand(t, rng);
      if (!res.ok) return res;
      g.rngState = rng.getState();
      g.heroDecisions = [];
      Game._hintCache = null;
      Game.display.showdown = false;
      // Les blinds s'affichent immédiatement.
      let shown = 0;
      t.hand.actions.forEach(function (a) { if (a.type === 'sb' || a.type === 'bb') shown = a.n; });
      Game.display.n = shown;
      if (t.phase === 'handOver') Game._finalizeHand();
      global.Store.commit('deal');
      Game._emit('update');
      Game._play(res.events.filter(function (e) { return !(e.type === 'action' && e.action.n <= shown) && e.type !== 'deal'; }));
      return { ok: true };
    },

    /** Affiche une suite d'événements du moteur, avec des pauses, puis passe au joueur suivant. */
    _play: function (events) {
      const token = Game._token;
      const g = Game.state();
      const d = DELAYS[g.config.speed] || DELAYS.normal;
      let i = 0;
      Game.busy = true;
      const preDelay = function (e) {
        if (e.type === 'street' || e.type === 'showdown') return d.street;
        if (e.type === 'action' && e.action.type === 'win') return d.win;
        return 0;
      };
      const apply = function () {
        if (token !== Game._token || !Game.state()) return;
        const e = events[i++];
        if (e.type === 'action') Game.display.n = Math.max(Game.display.n, e.action.n);
        else if (e.type === 'street') Game.display.n = Math.max(Game.display.n, e.n);
        else if (e.type === 'showdown') Game.display.showdown = true;
        Game._emit('update');
        next();
      };
      const next = function () {
        if (token !== Game._token || !Game.state()) return;
        if (i >= events.length) {
          const h = Game.state().table.hand;
          Game.display.n = h.actionCount;
          Game.busy = false;
          Game._emit('update');
          Game._continue();
          return;
        }
        const wait = preDelay(events[i]);
        if (wait > 0) global.setTimeout(apply, wait); else apply();
      };
      next();
    },

    /** Donne la parole au joueur suivant (bot ou humain), ou signale la fin de la main. */
    _continue: function () {
      const g = Game.state();
      if (!g) return;
      const t = g.table;
      if (t.phase === 'handOver') { Game._emit('handOver'); return; }
      const seat = t.hand.toAct;
      if (seat === g.heroSeat) { Game._emit('heroTurn'); return; }
      const token = Game._token;
      Game.busy = true;
      Game._emit('update');
      global.setTimeout(function () {
        if (token !== Game._token || !Game.state()) return;
        Game._botAct(seat);
      }, (DELAYS[g.config.speed] || DELAYS.normal).bot);
    },

    /** Tour d'un bot : il ne reçoit que sa vue publique. */
    _botAct: function (seat) {
      const g = Game.state(), t = g.table;
      if (t.phase === 'handOver' || t.hand.toAct !== seat) { Game.busy = false; Game._continue(); return; }
      const rng = P.RNG(g.rngState);
      const res = Game._botMove(t, seat, g.tendencies, rng, Game._icmPressure(t, g.tournament));
      g.rngState = rng.getState();
      if (t.phase === 'handOver') Game._finalizeHand();
      global.Store.commit('action');
      Game._play(res.events);
    },

    /**
     * Fait jouer un bot sur une table donnée. Le bot ne reçoit que sa vue publique,
     * les tendances publiques et (en tournoi) la pression liée aux places payées.
     */
    _botMove: function (table, seat, tendencies, rng, icmPressure) {
      const s = table.seats[seat];
      const view = E.publicView(table, seat);
      const decision = global.Bots.decide(view, { level: s.botLevel, style: s.botStyle, tendencies: tendencies, rng: rng, icmPressure: icmPressure || 0 });
      let res = E.applyAction(table, seat, decision);
      if (!res.ok) {
        // Sécurité : une décision invalide est remplacée par parole ou abandon.
        const legal = E.legalActions(table, seat);
        res = E.applyAction(table, seat, { type: legal.canCheck ? 'check' : 'fold' });
      }
      return res;
    },

    /** Pression ICM (information publique) : 1 à la bulle, 0,5 dans les places payées, 0 sinon. */
    _icmPressure: function (table, tour) {
      if (!tour || !tour.prizes.length) return 0;
      const left = E.liveSeats(table).length;
      if (left === tour.prizes.length + 1) return 1;
      return left <= tour.prizes.length && left > 2 ? 0.5 : 0;
    },

    /** Après une main de tournoi : enregistre les éliminations et détecte la fin. */
    _tournamentAfterHand: function () {
      const g = Game.state(), tr = g.tournament, t = g.table;
      Game._recordBusts(t, tr.out);
      const left = t.seats.length - tr.out.length;
      const heroOut = tr.out.some(function (o) { return o.seat === g.heroSeat; });
      if (left <= 1 || heroOut) Game._finishTournament();
    },

    /** Ajoute à `out` les joueurs qui viennent de perdre tous leurs jetons (le plus petit stack de départ sort le premier). */
    _recordBusts: function (table, out) {
      const h = table.hand;
      const already = out.map(function (o) { return o.seat; });
      const busted = h.order.filter(function (s) { return table.seats[s].stack === 0 && already.indexOf(s) < 0; })
        .sort(function (a, b) { return h.startStacks[a] - h.startStacks[b]; });
      let left = table.seats.length - out.length;
      busted.forEach(function (s) { out.push({ seat: s, place: left }); left--; });
    },

    /**
     * Fin du tournoi : classement final et prix. Si le joueur est éliminé alors
     * qu'il reste plusieurs bots, la fin est jouée instantanément entre eux sur
     * une copie de la table, uniquement pour établir le classement.
     */
    _finishTournament: function () {
      const g = Game.state(), tr = g.tournament, t = g.table, st = STRUCTURES[g.mode];
      const out = tr.out.slice();
      if (t.seats.length - out.length > 1) {
        const sim = JSON.parse(JSON.stringify(t));
        const tend = JSON.parse(JSON.stringify(g.tendencies));
        const rng = P.RNG((g.rngState ^ 0x5bd1e995) >>> 0);
        let guard = 0;
        while (E.liveSeats(sim).length > 1 && guard++ < 3000) {
          const lvl = Math.min(st.levels.length - 1, Math.floor(sim.handNumber / st.handsPerLevel));
          sim.sb = st.levels[lvl][0];
          sim.bb = st.levels[lvl][1];
          if (!E.startHand(sim, rng).ok) break;
          let steps = 0;
          while (sim.phase !== 'handOver' && steps++ < 400) {
            Game._botMove(sim, sim.hand.toAct, tend, rng, Game._icmPressure(sim, tr));
          }
          if (sim.phase !== 'handOver') break;
          Game._recordBusts(sim, out);
        }
        // Joueurs encore en jeu (cas normal : un seul) classés par stack.
        const done = out.map(function (o) { return o.seat; });
        sim.seats.filter(function (s) { return done.indexOf(s.seat) < 0; })
          .sort(function (a, b) { return a.stack - b.stack; })
          .forEach(function (s) { out.push({ seat: s.seat, place: sim.seats.length - out.length }); });
      } else {
        const done = out.map(function (o) { return o.seat; });
        t.seats.forEach(function (s) { if (done.indexOf(s.seat) < 0) out.push({ seat: s.seat, place: 1 }); });
      }
      tr.results = out.map(function (o) {
        return { seat: o.seat, name: t.seats[o.seat].name, isHero: o.seat === g.heroSeat, place: o.place, prize: tr.prizes[o.place - 1] || 0 };
      }).sort(function (a, b) { return a.place - b.place; });
      const mine = tr.results.filter(function (r) { return r.isHero; })[0];
      tr.heroPlace = mine.place;
      tr.prize = mine.prize;
      tr.finished = true;
      if (tr.prize > 0) global.Bankroll.prize(tr.prize, g.sessionId, STRUCTURES[g.mode].label + ' : ' + mine.place + (mine.place === 1 ? 're' : 'e') + ' place sur ' + t.seats.length);
      global.Stats.endTournament(g.sessionId, tr.prize, tr.heroPlace);
    },

    /** Informations de tournoi pour l'affichage (ou null hors tournoi). */
    tournamentInfo: function () {
      const g = Game.state();
      if (!g || !g.tournament) return null;
      const tr = g.tournament, t = g.table, st = STRUCTURES[g.mode];
      const lvl = Math.min(st.levels.length - 1, Math.floor(Math.max(0, t.handNumber - 1) / st.handsPerLevel));
      const next = st.levels[Math.min(st.levels.length - 1, lvl + 1)];
      const stacks = t.seats.map(function (s) { return s.stack; });
      const eq = tr.prizes.length ? icm(stacks, tr.prizes) : null;
      return {
        label: st.label, level: lvl + 1, sb: t.sb, bb: t.bb,
        nextSb: next[0], nextBb: next[1], lastLevel: lvl >= st.levels.length - 1,
        handsToNext: st.handsPerLevel - ((Math.max(1, t.handNumber) - 1) % st.handsPerLevel),
        remaining: t.seats.length - tr.out.length, total: t.seats.length,
        prizes: tr.prizes, prizePool: tr.prizePool, paid: tr.prizes.length,
        icm: eq ? Math.round(eq[g.heroSeat]) : null,
        finished: tr.finished, results: tr.results, heroPlace: tr.heroPlace, prize: tr.prize
      };
    },

    /** Vrai si c'est au joueur humain de parler (et que l'affichage est à jour). */
    isHeroTurn: function () {
      const g = Game.state();
      if (!g || Game.busy) return false;
      const t = g.table;
      return t.phase !== 'handOver' && t.phase !== 'idle' && !!t.hand && t.hand.toAct === g.heroSeat;
    },

    heroView: function () {
      const g = Game.state();
      return g && g.table.hand ? E.publicView(g.table, g.heroSeat) : null;
    },

    legal: function () {
      const g = Game.state();
      return g ? E.legalActions(g.table, g.heroSeat) : null;
    },

    /** Conseil pour la décision en cours (calculé une seule fois par décision). */
    currentHint: function () {
      const g = Game.state();
      if (!g || !g.table.hand || g.table.hand.toAct !== g.heroSeat) return null;
      const key = g.table.handNumber + ':' + g.table.hand.actionCount;
      if (!Game._hintCache || Game._hintCache.key !== key) {
        Game._hintCache = { key: key, hint: global.Analysis.hint(Game.heroView()) };
      }
      return Game._hintCache.hint;
    },

    /**
     * Action du joueur humain.
     * @param action { type: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin', amount? }
     * @returns { ok } ou { ok: false, error }
     */
    heroAction: function (action) {
      const g = Game.state();
      if (!Game.isHeroTurn()) return { ok: false, error: "Ce n'est pas à vous de parler." };
      const t = g.table;
      const view = E.publicView(t, g.heroSeat);
      const hint = Game.currentHint();
      const res = E.applyAction(t, g.heroSeat, action);
      if (!res.ok) return res;
      const entry = res.events[0].action;
      // Mémorise la décision et ce que le joueur voyait, pour l'analyse après la main.
      const snapshot = JSON.parse(JSON.stringify(view));
      snapshot.actions = [];
      g.heroDecisions.push({ view: snapshot, chosen: { type: entry.type, amount: entry.to, allIn: entry.allIn }, hint: hint });
      Game._hintCache = null;
      if (t.phase === 'handOver') Game._finalizeHand();
      global.Store.commit('action');
      Game._play(res.events);
      return { ok: true };
    },

    /** Construit l'enregistrement d'une main terminée (historique + statistiques). */
    _buildRecord: function () {
      const g = Game.state(), t = g.table, h = t.hand, hero = g.heroSeat, res = h.result;
      const heroActs = h.actions.filter(function (a) { return a.seat === hero; });
      const voluntary = function (a) { return a.type === 'call' || a.type === 'bet' || a.type === 'raise'; };
      const foldAct = heroActs.filter(function (a) { return a.type === 'fold'; })[0];
      const folded = h.players[hero].folded;
      const counts = { fold: 0, check: 0, call: 0, raise: 0, allin: 0 };
      heroActs.forEach(function (a) {
        if (a.type === 'fold') counts.fold++;
        else if (a.type === 'check') counts.check++;
        else if (voluntary(a)) { if (a.allIn) counts.allin++; else if (a.type === 'call') counts.call++; else counts.raise++; }
      });
      const showdown = !res.byFold && !folded;
      let bestHand = null;
      if (!folded && h.board.length >= 3) {
        const ev = P.evaluate7(h.holeCards[hero].concat(h.board));
        bestHand = { score: ev.score, category: ev.category, description: ev.description, cards: ev.best5 };
      }
      return {
        id: global.Store.uid('h'), sessionId: g.sessionId, ts: Date.now(), number: t.handNumber,
        category: global.Stats.category(g.config), mode: g.mode, freeroll: g.freeroll, botLevel: g.config.botLevel,
        sb: t.sb, bb: t.bb, players: h.order.length, heroSeat: hero,
        buttonSeat: h.buttonSeat, sbSeat: h.sbSeat, bbSeat: h.bbSeat,
        seats: h.order.map(function (s) {
          return { seat: s, name: t.seats[s].name, isHuman: !!t.seats[s].isHuman, stackStart: h.startStacks[s], position: h.positions[s] };
        }),
        heroCards: h.holeCards[hero].slice(), heroPosition: h.positions[hero],
        board: h.board.slice(),
        actions: JSON.parse(JSON.stringify(h.actions)),
        showdown: res.showdown.map(function (sd) { return { seat: sd.seat, cards: sd.cards.slice(), description: sd.description, best5: sd.best5.slice() }; }),
        pots: JSON.parse(JSON.stringify(res.pots)), byFold: res.byFold, totalPot: res.totalPot,
        net: Object.assign({}, res.net), heroNet: res.net[hero] || 0,
        flags: {
          vpip: heroActs.some(function (a) { return a.street === 'preflop' && voluntary(a); }),
          pfr: heroActs.some(function (a) { return a.street === 'preflop' && (a.type === 'raise' || a.type === 'bet'); }),
          sawFlop: h.board.length >= 3 && !(foldAct && foldAct.street === 'preflop'),
          showdown: showdown,
          won: (res.net[hero] || 0) > 0,
          wonShowdown: showdown && res.pots.some(function (p) { return p.winners.indexOf(hero) >= 0; })
        },
        heroActions: counts, bestHand: bestHand, analysis: null, tournament: !!g.tournament
      };
    },

    /**
     * Fin de main : statistiques, analyse pédagogique, tendances publiques.
     * Appelé dès que le moteur a terminé la main (une seule fois par main).
     */
    _finalizeHand: function () {
      const g = Game.state(), t = g.table, h = t.hand;
      if (!h || !h.result || g.recordedHand === t.handNumber) return;
      g.recordedHand = t.handNumber;
      global.Bots.recordHand(g.tendencies, {
        players: h.order.map(function (s) { return { seat: s, id: t.seats[s].id }; }),
        actions: h.actions
      });
      if (h.order.indexOf(g.heroSeat) >= 0) {
        const rec = Game._buildRecord();
        try { rec.analysis = global.Analysis.analyzeHand(rec, g.heroDecisions); }
        catch (e) { rec.analysis = null; if (global.console) global.console.error(e); }
        global.Stats.recordHand(rec);
        if (rec.analysis) global.Stats.recordErrors(rec.analysis.errorTags);
        g.lastHandId = rec.id;
      }
      if (g.tournament && !g.tournament.finished) Game._tournamentAfterHand();
    },

    /** Enregistrement de la dernière main jouée à cette table (ou null). */
    lastRecord: function () {
      const g = Game.state();
      if (!g || !g.lastHandId) return null;
      const hands = global.Store.state.hands;
      for (let i = hands.length - 1; i >= 0; i--) if (hands[i].id === g.lastHandId) return hands[i];
      return null;
    },

    /** Le joueur n'a plus de jetons et doit se recaver pour continuer. */
    needsRebuy: function () {
      const g = Game.state();
      return !!g && !g.tournament && !Game.handInProgress() && g.table.seats[g.heroSeat].stack === 0;
    },

    /** Montant de recave possible (jusqu'au stack de départ), 0 si aucun. */
    rebuyAmount: function () {
      const g = Game.state();
      if (!g || g.tournament || Game.handInProgress()) return 0;   // pas de recave en tournoi
      return Math.max(0, g.startStack - g.table.seats[g.heroSeat].stack);
    },

    /** Recave le joueur jusqu'au stack de départ (entre deux mains uniquement). */
    rebuy: function () {
      const g = Game.state();
      if (!g) return { ok: false, error: 'Aucune partie en cours.' };
      if (Game.handInProgress()) return { ok: false, error: 'La recave se fait entre deux mains.' };
      const amount = Game.rebuyAmount();
      if (amount <= 0) return { ok: false, error: 'Votre stack est déjà au maximum autorisé.' };
      if (!g.freeroll) {
        if (!global.Bankroll.buyIn(amount, g.sessionId, 'rebuy', 'Recave ' + g.table.sb + '/' + g.table.bb)) {
          return { ok: false, error: 'Bankroll insuffisante pour recaver ' + amount.toLocaleString('fr-FR') + ' jetons.' };
        }
        global.Stats.addBuyIn(g.sessionId, amount);
      }
      g.table.seats[g.heroSeat].stack += amount;
      global.Store.commit('rebuy');
      Game._emit('update');
      return { ok: true, amount: amount };
    },

    /** Passe à la main suivante. */
    nextHand: function () {
      const g = Game.state();
      if (!g) return { ok: false, error: 'Aucune partie en cours.' };
      if (Game.busy || Game.handInProgress()) return { ok: false, error: 'La main en cours n\'est pas terminée.' };
      return Game._startHand();
    },

    /**
     * Quitte la table et encaisse les jetons restants.
     * En pleine main, les jetons déjà misés sont abandonnés (la main n'entre pas dans les statistiques).
     * @returns { cashOut, midHand, freeroll, net }
     */
    leaveTable: function () {
      const g = Game.state();
      if (!g) return null;
      Game._token++;
      Game.busy = false;
      const t = g.table, hero = g.heroSeat;
      const midHand = Game.handInProgress();
      const cashOut = t.seats[hero].stack;
      const session = global.Stats._session(g.sessionId);
      if (g.tournament) {
        // Tournoi : les jetons ne s'encaissent pas. Un abandon avant la fin ne rapporte rien.
        const tr = g.tournament;
        if (!tr.finished) global.Stats.endTournament(g.sessionId, 0, null);
        const res = { tournament: true, finished: tr.finished, place: tr.heroPlace, prize: tr.prize, freeroll: g.freeroll, midHand: midHand, cashOut: 0, net: session ? session.net : 0 };
        global.Store.state.currentGame = null;
        global.Store.state.ui.gameScreen = 'setup';
        global.Store.commit('leave');
        return res;
      }
      if (midHand && session && t.hand.players[hero]) session.net -= t.hand.players[hero].totalBet;
      if (!g.freeroll) global.Bankroll.cashOut(cashOut, g.sessionId, 'Sortie de table ' + t.sb + '/' + t.bb);
      global.Stats.endSession(g.sessionId, g.freeroll ? 0 : cashOut);
      const out = { cashOut: cashOut, midHand: midHand, freeroll: g.freeroll, net: session ? session.net : 0 };
      global.Store.state.currentGame = null;
      global.Store.state.ui.gameScreen = 'setup';
      global.Store.commit('leave');
      return out;
    },

    /** Active ou désactive les conseils en cours de partie. */
    setHints: function (on) {
      const g = Game.state();
      if (!g) return;
      g.config.hints = !!on;
      global.Store.commit('hints');
      Game._emit('update');
    },

    /** Répercute un changement de pseudo sur le siège du joueur. */
    setHeroName: function (name) {
      const g = Game.state();
      if (g) g.table.seats[g.heroSeat].name = name || 'Vous';
    },

    /**
     * Reprend une partie restaurée depuis la sauvegarde : l'affichage est
     * recalé sur l'état sauvegardé et la parole est rendue au bon joueur.
     */
    resume: function () {
      const g = Game.state();
      if (!g) return false;
      Game._token++;
      Game.busy = false;
      Game._hintCache = null;
      const t = g.table, h = t.hand;
      if (!h || t.phase === 'idle') { Game._startHand(); return true; }
      Game.display.n = h.actionCount;
      Game.display.showdown = !!(h.result && !h.result.byFold);
      if (t.phase === 'handOver') Game._finalizeHand();
      Game._emit('update');
      Game._continue();
      return true;
    },

    /** Met la partie en pause (changement d'onglet) : annule les minuteries en attente. */
    pause: function () {
      Game._token++;
      Game.busy = false;
    }
  };

  global.Game = Game;

})(typeof window !== 'undefined' ? window : globalThis);
