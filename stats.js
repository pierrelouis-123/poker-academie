/* ==========================================================================
   stats.js — Sauvegarde, bankroll virtuelle et statistiques
   --------------------------------------------------------------------------
   Store    : état unique de l'application + sauvegarde automatique dans
              localStorage (une seule écriture groupée par cycle), export /
              import JSON, gestion des erreurs (quota, données corrompues,
              stockage bloqué).
   Bankroll : argent 100 % virtuel — dépôts, buy-ins, cash-outs, alertes.
   Stats    : sessions, mains terminées, VPIP, PFR, BB/100, ROI, badges.
   ========================================================================== */
(function (global) {
  'use strict';

  const VERSION = 1;
  const KEY = 'pokerAcademie.v1';
  const BACKUP_KEY = KEY + '.bak';
  const MAX_HANDS = 150;          // mains détaillées conservées dans l'historique
  const MAX_TRANSACTIONS = 400;
  const MAX_SESSIONS = 200;
  const MAX_CURVE = 400;
  const VIEWS = ['home', 'learn', 'game', 'stats', 'bankroll', 'history', 'settings'];

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function uid(prefix) { return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }

  function newCounters() {
    return {
      hands: 0, handsWon: 0, showdowns: 0, showdownsWon: 0, vpipHands: 0, pfrHands: 0, sawFlop: 0,
      actions: { fold: 0, check: 0, call: 0, raise: 0, allin: 0 },
      netChips: 0, netBB: 0, buyIns: 0, prizes: 0, tourBuyIns: 0
    };
  }

  /** État complet d'une application neuve. */
  function defaultState() {
    return {
      version: VERSION,
      profile: { name: '', createdAt: new Date().toISOString() },
      settings: { speed: 'normal', hints: true, reviewAfterHand: true, fourColors: false, initialBankroll: 10000, lastTableConfig: null },
      ui: { view: 'home', learnTab: 'lessons', gameScreen: 'setup', lesson: null, challenge: null, statsFilter: { mode: 'all', level: 'all' } },
      progress: { level: 1, lessons: {}, levelExams: {}, themes: {}, challenges: { played: 0, correct: 0, series: 0 } },
      bankroll: { balance: 10000, initial: 10000, transactions: [] },
      stats: { global: newCounters(), byMode: {}, byStakes: {}, byBotLevel: {}, byCombo: {}, bestHand: null, errors: {}, bbCurve: [], bankrollCurve: [] },
      sessions: [],
      hands: [],
      currentGame: null
    };
  }

  /** Complète `val` avec les clés manquantes de `def` (compatibilité entre versions). */
  function fillDefaults(val, def) {
    if (!isObj(def) || !isObj(val)) return val;
    Object.keys(def).forEach(function (k) {
      if (val[k] === undefined) val[k] = clone(def[k]);
      else if (isObj(def[k]) && isObj(val[k])) fillDefaults(val[k], def[k]);
    });
    return val;
  }

  /* ========================================================================
     STORE
     ======================================================================== */
  const Store = {
    KEY: KEY,
    state: defaultState(),
    memoryOnly: false,      // true si le navigateur bloque localStorage
    locked: false,          // true tant qu'une sauvegarde corrompue n'a pas été traitée
    status: 'idle',
    statusMessage: '',
    _dirty: false,
    _scheduled: false,
    _lastJson: null,
    _listeners: [],
    _writeListeners: [],

    defaultState: defaultState,
    newCounters: newCounters,
    uid: uid,

    /** S'abonner aux écritures réelles (appelé seulement quand l'état enregistré a changé). */
    onWrite: function (cb) { Store._writeListeners.push(cb); },

    /** S'abonner aux changements d'état de sauvegarde : cb(status, message). */
    onStatus: function (cb) { Store._listeners.push(cb); },
    _setStatus: function (status, message) {
      Store.status = status;
      Store.statusMessage = message || '';
      Store._listeners.forEach(function (cb) { try { cb(status, Store.statusMessage); } catch (e) { /* ignoré */ } });
    },

    _storageAvailable: function () {
      try {
        const k = KEY + '.test';
        global.localStorage.setItem(k, '1');
        global.localStorage.removeItem(k);
        return true;
      } catch (e) { return false; }
    },

    /**
     * Vérifie et répare une sauvegarde.
     * @returns { state, problems: [libellés des sections illisibles remises à zéro] }
     *          state vaut null si l'objet est inutilisable.
     */
    validate: function (obj) {
      if (!isObj(obj)) return { state: null, problems: ['la sauvegarde entière'] };
      const d = defaultState();
      const problems = [];
      const out = { version: VERSION };
      function section(name, label, check) {
        let good = false;
        try { good = check(obj[name]); } catch (e) { good = false; }
        if (good) out[name] = isObj(d[name]) ? fillDefaults(obj[name], d[name]) : obj[name];
        else { out[name] = d[name]; if (obj[name] !== undefined) problems.push(label); }
      }
      section('profile', 'le profil', isObj);
      section('settings', 'les réglages', isObj);
      section('ui', "l'écran en cours", isObj);
      section('progress', 'la progression des leçons', function (v) { return isObj(v) && isObj(v.lessons) && isObj(v.levelExams); });
      section('bankroll', 'la bankroll', function (v) { return isObj(v) && typeof v.balance === 'number' && isFinite(v.balance) && v.balance >= 0 && Array.isArray(v.transactions); });
      section('stats', 'les statistiques', function (v) { return isObj(v) && isObj(v.global) && isObj(v.global.actions) && typeof v.global.hands === 'number'; });
      section('sessions', "l'historique des sessions", Array.isArray);
      section('hands', "l'historique des mains", Array.isArray);
      section('currentGame', 'la partie en cours', function (g) {
        if (g === null) return true;
        if (!isObj(g) || !isObj(g.config) || !isObj(g.table) || !Array.isArray(g.table.seats) || g.table.seats.length < 2) return false;
        if (typeof g.table.bb !== 'number' || typeof g.rngState !== 'number') return false;
        const h = g.table.hand;
        if (h !== null && h !== undefined) {
          if (!isObj(h) || !Array.isArray(h.order) || !isObj(h.players) || !Array.isArray(h.actions) || !Array.isArray(h.deck) || !isObj(h.holeCards)) return false;
        }
        return g.table.seats.every(function (s) { return isObj(s) && typeof s.stack === 'number' && s.stack >= 0; });
      });
      if (VIEWS.indexOf(out.ui.view) < 0) out.ui.view = 'home';
      if (!out.currentGame && out.ui.gameScreen === 'table') out.ui.gameScreen = 'setup';
      return { state: out, problems: problems };
    },

    /**
     * Charge la sauvegarde au démarrage.
     * @returns { status, problems?, candidate?, hasBackup?, message? }
     *   'new'         première visite
     *   'ok'          sauvegarde restaurée
     *   'unavailable' stockage bloqué : la progression ne sera pas conservée
     *   'corrupt'     sauvegarde illisible ou abîmée. Rien n'est écrasé tant que
     *                 l'utilisateur n'a pas choisi (voir applyRecovery / backupCandidate).
     */
    load: function () {
      Store.state = defaultState();
      Store.locked = false;
      if (!Store._storageAvailable()) {
        Store.memoryOnly = true;
        Store._setStatus('error', 'Stockage indisponible');
        return { status: 'unavailable', message: "Votre navigateur bloque l'enregistrement local : la progression ne sera pas conservée après fermeture." };
      }
      let raw = null;
      try { raw = global.localStorage.getItem(KEY); } catch (e) { raw = null; }
      if (raw === null) { Store._setStatus('idle', 'Prêt'); return { status: 'new' }; }

      let parsed = null, jsonOk = true;
      try { parsed = JSON.parse(raw); } catch (e) { jsonOk = false; }
      const inner = jsonOk && isObj(parsed) && isObj(parsed.state) ? parsed.state : parsed;
      const res = jsonOk ? Store.validate(inner) : { state: null, problems: ['la sauvegarde entière (fichier illisible)'] };

      if (res.state && res.problems.length === 0) {
        Store.state = res.state;
        Store._lastJson = JSON.stringify(Store.state);
        try { global.localStorage.setItem(BACKUP_KEY, raw); } catch (e) { /* copie de secours facultative */ }
        Store._setStatus('saved', 'Sauvegardé');
        return { status: 'ok' };
      }
      // Sauvegarde abîmée : on verrouille l'écriture jusqu'à la décision de l'utilisateur.
      Store.locked = true;
      Store._setStatus('error', 'Sauvegarde abîmée');
      return { status: 'corrupt', kind: jsonOk ? 'structure' : 'json', problems: res.problems, candidate: res.state, hasBackup: !!Store.backupCandidate() };
    },

    /** Dernière sauvegarde valide connue (copie faite au dernier démarrage réussi), ou null. */
    backupCandidate: function () {
      try {
        const raw = global.localStorage.getItem(BACKUP_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const res = Store.validate(isObj(parsed) && isObj(parsed.state) ? parsed.state : parsed);
        return res.state && res.problems.length === 0 ? res.state : null;
      } catch (e) { return null; }
    },

    /** Applique le choix de l'utilisateur après une sauvegarde abîmée (état à adopter, ou null = remise à zéro). */
    applyRecovery: function (state) {
      Store.state = state || defaultState();
      Store.locked = false;
      Store._lastJson = null;
      Store.commit('recovery');
      Store.flush();
    },

    /**
     * Point d'entrée unique de la sauvegarde : à appeler après toute modification
     * de Store.state. Les appels d'un même cycle sont regroupés en une écriture.
     */
    commit: function () {
      if (Store.locked) return;
      Store._dirty = true;
      if (Store._scheduled) return;
      Store._scheduled = true;
      Store._setStatus('saving', 'Enregistrement…');
      Promise.resolve().then(function () { Store._scheduled = false; Store.flush(); });
    },

    /** Écrit immédiatement si quelque chose a changé. Renvoie true si l'état est bien enregistré. */
    flush: function () {
      if (Store.locked) return false;
      if (!Store._dirty) return Store.status !== 'error';
      Store._dirty = false;
      if (Store.memoryOnly) { Store._setStatus('error', 'Non enregistré (stockage bloqué)'); return false; }

      Store._trim(false);
      let json;
      try { json = JSON.stringify(Store.state); }
      catch (e) { Store._setStatus('error', 'Erreur de sauvegarde'); return false; }
      if (json === Store._lastJson) { Store._setStatus('saved', 'Sauvegardé'); return true; }   // rien de nouveau : pas d'écriture

      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          global.localStorage.setItem(KEY, '{"savedAt":"' + new Date().toISOString() + '","state":' + json + '}');
          Store._lastJson = json;
          Store._setStatus('saved', 'Sauvegardé');
          Store._writeListeners.forEach(function (cb) { try { cb(); } catch (e) { /* ignoré */ } });
          return true;
        } catch (e) {
          // Quota dépassé : on libère la copie de secours puis on allège les historiques.
          try { global.localStorage.removeItem(BACKUP_KEY); } catch (e2) { /* ignoré */ }
          if (attempt > 0) Store._trim(true);
          try { json = JSON.stringify(Store.state); } catch (e3) { break; }
        }
      }
      Store._dirty = true;
      Store._setStatus('error', 'Espace de stockage plein');
      return false;
    },

    /** Limite la taille des historiques (hard = réduction forte en cas de quota dépassé). */
    _trim: function (hard) {
      const s = Store.state;
      const cut = function (arr, max) { if (arr.length > max) arr.splice(0, arr.length - max); };
      cut(s.hands, hard ? Math.max(10, Math.floor(s.hands.length / 2)) : MAX_HANDS);
      cut(s.bankroll.transactions, hard ? 100 : MAX_TRANSACTIONS);
      cut(s.sessions, hard ? 50 : MAX_SESSIONS);
      cut(s.stats.bbCurve, hard ? 100 : MAX_CURVE);
      cut(s.stats.bankrollCurve, hard ? 100 : MAX_CURVE);
      if (hard) s.hands.forEach(function (h) { h.analysis = null; });
    },

    /** Texte JSON de toute la sauvegarde (pour export manuel). */
    exportJSON: function () {
      return JSON.stringify({ app: 'poker-academie', version: VERSION, exportedAt: new Date().toISOString(), state: Store.state }, null, 2);
    },

    /**
     * Analyse un fichier d'import sans rien modifier.
     * @returns { ok, error?, state?, problems? }
     */
    parseImport: function (text) {
      let parsed;
      try { parsed = JSON.parse(text); }
      catch (e) { return { ok: false, error: "Ce fichier n'est pas un JSON valide." }; }
      if (!isObj(parsed)) return { ok: false, error: 'Format de sauvegarde non reconnu.' };
      if (parsed.app && parsed.app !== 'poker-academie') return { ok: false, error: 'Ce fichier ne provient pas de Poker Académie.' };
      const inner = isObj(parsed.state) ? parsed.state : parsed;
      if (!isObj(inner.bankroll) && !isObj(inner.progress) && !isObj(inner.stats)) return { ok: false, error: 'Format de sauvegarde non reconnu.' };
      const res = Store.validate(clone(inner));
      if (!res.state) return { ok: false, error: 'Sauvegarde inutilisable.' };
      return { ok: true, state: res.state, problems: res.problems };
    },

    /** Remplace tout l'état par une sauvegarde importée (déjà validée par parseImport). */
    importState: function (state) {
      Store.state = state;
      Store.locked = false;
      Store._lastJson = null;
      Store.commit('import');
      return Store.flush();
    },

    /** Réinitialise toute la progression ; les réglages sont conservés. */
    reset: function () {
      const keep = Store.state.settings;
      const name = Store.state.profile.name;
      Store.state = defaultState();
      Store.state.settings = fillDefaults(keep, defaultState().settings);
      Store.state.settings.lastTableConfig = null;
      Store.state.profile.name = name;
      const initial = Math.max(100, Math.floor(Store.state.settings.initialBankroll) || 10000);
      Store.state.bankroll.balance = initial;
      Store.state.bankroll.initial = initial;
      Store.locked = false;
      Store._lastJson = null;
      try { global.localStorage.removeItem(BACKUP_KEY); } catch (e) { /* ignoré */ }
      Store.commit('reset');
      Store.flush();
    },

    /** Taille approximative de la sauvegarde, en kilo-octets. */
    sizeKB: function () {
      try { return Math.round((Store._lastJson || JSON.stringify(Store.state)).length / 1024); } catch (e) { return 0; }
    }
  };

  /* ========================================================================
     BANKROLL (argent virtuel uniquement)
     ======================================================================== */
  const Bankroll = {
    MAX_DEPOSIT: 10000000,
    TYPE_LABELS: { deposit: 'Dépôt virtuel', buyin: 'Buy-in', rebuy: 'Recave', cashout: 'Cash-out', prize: 'Prix de tournoi', reset: 'Remise à zéro' },

    _add: function (type, amount, sessionId, note) {
      const b = Store.state.bankroll;
      b.balance += amount;
      b.transactions.push({ id: uid('t'), ts: Date.now(), type: type, amount: amount, balanceAfter: b.balance, sessionId: sessionId || null, note: note || '' });
      Store.state.stats.bankrollCurve.push({ ts: Date.now(), v: b.balance });
      Store.commit('bankroll');
    },

    balance: function () { return Store.state.bankroll.balance; },

    /** Ajoute de l'argent virtuel (gratuit). */
    deposit: function (amount, note) {
      amount = Number(amount);
      if (!isFinite(amount) || Math.floor(amount) !== amount || amount <= 0) return { ok: false, error: 'Saisissez un montant entier supérieur à 0.' };
      if (amount > Bankroll.MAX_DEPOSIT) return { ok: false, error: 'Montant maximal par dépôt : ' + Bankroll.MAX_DEPOSIT.toLocaleString('fr-FR') + '.' };
      Bankroll._add('deposit', amount, null, note || 'Argent virtuel ajouté');
      return { ok: true };
    },

    /** Prélève un buy-in ou une recave. Renvoie false si le solde est insuffisant. */
    buyIn: function (amount, sessionId, type, note) {
      if (!(amount > 0) || amount > Store.state.bankroll.balance) return false;
      Bankroll._add(type === 'rebuy' ? 'rebuy' : 'buyin', -amount, sessionId, note);
      return true;
    },

    /** Recrédite les jetons en quittant une table. */
    cashOut: function (amount, sessionId, note) {
      if (!(amount >= 0)) return;
      Bankroll._add('cashout', amount, sessionId, note);
    },

    /** Crédite un prix de tournoi. */
    prize: function (amount, sessionId, note) {
      if (!(amount > 0)) return;
      Bankroll._add('prize', amount, sessionId, note);
    },

    /** Totaux : dépôts, buy-ins, cash-outs, résultat net de jeu. */
    summary: function () {
      const b = Store.state.bankroll;
      const sum = { balance: b.balance, initial: b.initial, deposits: 0, buyIns: 0, cashOuts: 0, depositCount: 0 };
      b.transactions.forEach(function (t) {
        if (t.type === 'deposit') { sum.deposits += t.amount; sum.depositCount++; }
        else if (t.type === 'buyin' || t.type === 'rebuy') sum.buyIns += -t.amount;
        else if (t.type === 'cashout' || t.type === 'prize') sum.cashOuts += t.amount;
      });
      // Résultat de jeu = ce que la bankroll a gagné ou perdu hors dépôts (jetons encore en table non comptés).
      const g = Store.state.currentGame;
      sum.onTable = g && !g.freeroll && !g.tournament ? g.table.seats[g.heroSeat].stack : 0;
      sum.net = b.balance + sum.onTable - b.initial - sum.deposits;
      return sum;
    },

    /** Alertes pédagogiques de gestion de bankroll : [{ level: 'warn' | 'danger' | 'info', text }]. */
    alerts: function () {
      const out = [];
      const s = Store.state;
      const sum = Bankroll.summary();
      const total = sum.balance + sum.onTable;
      const last = s.settings.lastTableConfig;
      if (last && !last.freeroll && last.mode === 'cash') {
        const buyIn = last.bb * last.stackBB;
        const caves = Math.floor(total / buyIn);
        if (caves < 5) out.push({ level: 'danger', text: 'Votre bankroll ne représente plus que ' + caves + ' cave(s) aux blinds ' + last.sb + '/' + last.bb + '. Descendez de limite : en cash game, on conseille au moins 20 caves pour encaisser la malchance.' });
        else if (caves < 20) out.push({ level: 'warn', text: 'Vous avez ' + caves + ' caves aux blinds ' + last.sb + '/' + last.bb + '. La règle prudente est de 20 caves minimum : pensez à jouer des blinds plus petites.' });
      }
      // Baisse rapide sur les 5 dernières sessions payantes.
      const paid = s.sessions.filter(function (x) { return !x.freeroll && x.endedAt; }).slice(-5);
      const lost = paid.reduce(function (a, x) { return a + Math.min(0, x.net); }, 0);
      const won = paid.reduce(function (a, x) { return a + Math.max(0, x.net); }, 0);
      if (paid.length >= 2 && -lost - won > 0.3 * (total + (-lost - won))) {
        out.push({ level: 'warn', text: 'Votre bankroll a fondu de plus de 30 % sur vos dernières sessions. Faites une pause, relisez vos mains dans l\'Historique et vérifiez que vous ne jouez pas sous le coup de la frustration (le « tilt »).' });
      }
      const dayAgo = Date.now() - 24 * 3600 * 1000;
      const recentDeposits = s.bankroll.transactions.filter(function (t) { return t.type === 'deposit' && t.ts >= dayAgo; }).length;
      if (recentDeposits >= 3) out.push({ level: 'info', text: 'Vous avez rechargé ' + recentDeposits + ' fois en 24 heures. Avec de l\'argent réel, ce serait un signal d\'alarme : fixez-vous un budget et tenez-vous-y.' });
      if (total === 0) out.push({ level: 'danger', text: 'Bankroll à zéro. Ajoutez de l\'argent virtuel ci-contre, ou entraînez-vous en Freeroll.' });
      return out;
    }
  };

  /* ========================================================================
     STATISTIQUES
     Toutes les statistiques sont calculées sur des mains TERMINÉES.
     ======================================================================== */
  const BADGES = [
    { id: 'debutant', label: 'Débutant', need: 'Badge de départ' },
    { id: 'apprenti', label: 'Apprenti', need: "Valider l'examen du niveau 1" },
    { id: 'intermediaire', label: 'Intermédiaire', need: "Valider l'examen du niveau 2 et jouer 100 mains" },
    { id: 'avance', label: 'Avancé', need: "Valider l'examen du niveau 3" },
    { id: 'expert-formation', label: 'Expert en formation', need: "Valider l'examen du niveau 4" },
    { id: 'expert', label: 'Expert', need: "Valider l'examen du niveau 5" }
  ];
  const MODE_LABELS = { cash: 'Cash Game', freeroll: 'Freeroll', learning: 'Apprentissage', tournament: 'Tournoi', sng: 'Sit & Go' };

  const Stats = {
    BADGES: BADGES,
    MODE_LABELS: MODE_LABELS,

    /** Catégorie statistique d'une partie : 'cash', 'freeroll' ou 'learning'. */
    category: function (config) {
      if (config.mode === 'learning') return 'learning';
      if (config.mode === 'tournament' || config.mode === 'sng') return config.mode;
      return config.freeroll ? 'freeroll' : 'cash';
    },

    _buckets: function (cat, stakes, level) {
      const st = Store.state.stats;
      const get = function (map, key) { return map[key] || (map[key] = newCounters()); };
      return [st.global, get(st.byMode, cat), get(st.byStakes, stakes), get(st.byBotLevel, level), get(st.byCombo, cat + '|' + level)];
    },

    _session: function (id) {
      const list = Store.state.sessions;
      for (let i = list.length - 1; i >= 0; i--) if (list[i].id === id) return list[i];
      return null;
    },

    /** Ouvre une session de jeu et renvoie son identifiant. */
    startSession: function (config) {
      const s = {
        id: uid('s'), mode: config.mode, freeroll: !!config.freeroll, category: Stats.category(config),
        sb: config.sb, bb: config.bb, players: config.players, botLevel: config.botLevel,
        startedAt: Date.now(), endedAt: null, hands: 0, buyIns: 0, cashOut: 0, net: 0, netBB: 0,
        tournament: config.mode === 'tournament' || config.mode === 'sng', place: null
      };
      Store.state.sessions.push(s);
      Store.commit('session');
      return s.id;
    },

    /** Enregistre un buy-in ou une recave (0 pour un freeroll). */
    addBuyIn: function (sessionId, amount) {
      const s = Stats._session(sessionId);
      if (!s || !(amount > 0)) return;
      s.buyIns += amount;
      Stats._buckets(s.category, s.tournament ? 'tournois' : s.sb + '/' + s.bb, s.botLevel).forEach(function (b) { b.buyIns += amount; if (s.tournament) b.tourBuyIns = (b.tourBuyIns || 0) + amount; });
      Store.commit('buyin');
    },

    /** Résultat en argent virtuel d'un compteur : cash game + prix de tournoi − buy-ins de tournoi. */
    _money: function (c) {
      return (c.cashNet === undefined ? c.netChips : c.cashNet) + (c.prizes || 0) - (c.tourBuyIns || 0);
    },

    /** Clôt un tournoi : prix gagné (0 si aucun) et place finale (null en cas d'abandon). */
    endTournament: function (sessionId, prize, place) {
      const s = Stats._session(sessionId);
      if (!s || s.endedAt) return;
      s.endedAt = Date.now();
      s.cashOut = prize || 0;
      s.place = place;
      s.net = (prize || 0) - s.buyIns;
      if (prize > 0) {
        Stats._buckets(s.category, 'tournois', s.botLevel).forEach(function (b) { b.prizes = (b.prizes || 0) + prize; });
      }
      Store.commit('session');
    },

    /**
     * Diagnostic du jeu du joueur à partir de ses statistiques globales :
     * [{ level: 'ok' | 'warn' | 'info', title, text, lesson }].
     */
    diagnosis: function () {
      const c = Stats.compute({ mode: 'all', level: 'all' });
      const out = [];
      if (c.hands < 30) {
        return [{ level: 'info', title: 'Pas encore assez de mains', text: 'Jouez au moins 30 mains pour obtenir un diagnostic (' + c.hands + ' pour l\'instant). En dessous, le hasard de la distribution fausse tout.', lesson: null }];
      }
      const players = (Store.state.settings.lastTableConfig || {}).players || 6;
      const hi = players <= 3 ? 60 : players <= 6 ? 35 : 28;
      const lo = players <= 3 ? 30 : players <= 6 ? 15 : 11;
      if (c.vpip > hi) out.push({ level: 'warn', title: 'Vous jouez trop de mains', text: 'VPIP de ' + Math.round(c.vpip) + ' % : à ' + players + ' joueurs, visez plutôt moins de ' + hi + ' %. Les mains faibles coûtent des jetons petit à petit.', lesson: 'n2-l1' });
      else if (c.vpip < lo) out.push({ level: 'warn', title: 'Vous jouez très peu de mains', text: 'VPIP de ' + Math.round(c.vpip) + ' % : vous laissez passer des occasions, surtout en fin de parole, et vos adversaires savent que vous n\'entrez qu\'avec du lourd.', lesson: 'n2-l2' });
      else out.push({ level: 'ok', title: 'Sélection de mains équilibrée', text: 'VPIP de ' + Math.round(c.vpip) + ' % : dans la bonne zone pour ' + players + ' joueurs.', lesson: null });
      if (c.vpip - c.pfr > 12) out.push({ level: 'warn', title: 'Trop de mains suivies, pas assez relancées', text: 'Écart de ' + Math.round(c.vpip - c.pfr) + ' points entre VPIP et PFR : vous entrez souvent dans le coup en suivant. Préférez « relancer ou se coucher ».', lesson: 'n3-l1' });
      else if (c.pfr > 0) out.push({ level: 'ok', title: 'Bonne agressivité avant le flop', text: 'PFR de ' + Math.round(c.pfr) + ' % pour un VPIP de ' + Math.round(c.vpip) + ' % : vous relancez la plupart des mains que vous jouez.', lesson: null });
      if (c.totalActions >= 40 && c.raisePct + c.allinPct < 15) out.push({ level: 'warn', title: 'Jeu trop passif', text: 'Vous ne misez ou relancez que ' + Math.round(c.raisePct + c.allinPct) + ' % du temps. Sans mise, on ne gagne qu\'à l\'abattage : misez vos bonnes mains pour valeur.', lesson: 'n3-l3' });
      if (c.totalActions >= 40 && c.callPct > 35) out.push({ level: 'warn', title: 'Vous suivez beaucoup', text: 'Suivre représente ' + Math.round(c.callPct) + ' % de vos actions. Vérifiez la cote du pot avant chaque appel, et demandez-vous ce que la mise adverse représente.', lesson: 'n2-l5' });
      if (c.showdowns >= 10) {
        if (c.showdownWinRate < 40) out.push({ level: 'warn', title: 'Vous allez à l\'abattage avec des mains trop faibles', text: 'Vous ne gagnez que ' + Math.round(c.showdownWinRate) + ' % de vos abattages. Couchez davantage vos mains moyennes face aux grosses mises de fin de coup.', lesson: 'n3-l5' });
        else if (c.showdownWinRate > 65) out.push({ level: 'info', title: 'Vous pourriez miser plus finement', text: 'Vous gagnez ' + Math.round(c.showdownWinRate) + ' % de vos abattages : signe que vous n\'y allez qu\'avec de très bonnes mains. Vous pouvez miser pour valeur un peu plus souvent, et parfois bluffer.', lesson: 'n3-l4' });
      }
      if (c.totalActions >= 40 && c.allinPct > 8) out.push({ level: 'warn', title: 'Beaucoup de tapis', text: 'Le tapis représente ' + Math.round(c.allinPct) + ' % de vos actions. En cash game profond, il prive vos bonnes mains de valeur et expose vos mains moyennes.', lesson: 'n4-l1' });
      const top = Stats.topErrors(1)[0];
      if (top && top.count >= 3) out.push({ level: 'warn', title: 'Votre erreur la plus fréquente', text: top.label + ' (' + top.count + ' fois).', lesson: top.lesson });
      if (c.bb100 !== null) out.push({ level: c.bb100 >= 0 ? 'ok' : 'info', title: 'Résultat', text: (c.bb100 >= 0 ? 'Vous gagnez ' : 'Vous perdez ') + Math.abs(c.bb100).toFixed(1).replace('.', ',') + ' BB pour 100 mains sur ' + c.hands + ' mains. ' + (c.hands < 500 ? 'Sur un si petit échantillon, ce chiffre reflète surtout la chance.' : ''), lesson: null });
      return out;
    },

    /**
     * Données des graphiques avancés, calculées sur les mains détaillées en mémoire.
     * @returns { count, positions[], lines: { total[], showdown[], noShowdown[] }, grid: { 'AKs': { n, bb } } }
     */
    advanced: function () {
      const hands = Store.state.hands;
      const order = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
      const pos = {};
      const grid = {};
      const total = [0], sd = [0], nsd = [0];
      let t = 0, a = 0, b = 0;
      hands.forEach(function (h) {
        const bb = h.heroNet / h.bb;
        const p = pos[h.heroPosition] || (pos[h.heroPosition] = { hands: 0, bb: 0, vpip: 0 });
        p.hands++; p.bb += bb; if (h.flags.vpip) p.vpip++;
        const key = global.Bots.handKey(h.heroCards);
        const g = grid[key] || (grid[key] = { n: 0, bb: 0 });
        g.n++; g.bb += bb;
        t += bb;
        if (h.flags.showdown) a += bb; else b += bb;
        total.push(t); sd.push(a); nsd.push(b);
      });
      return {
        count: hands.length,
        positions: order.filter(function (k) { return pos[k]; }).map(function (k) {
          return { label: k, hands: pos[k].hands, bb100: 100 * pos[k].bb / pos[k].hands, vpip: 100 * pos[k].vpip / pos[k].hands };
        }),
        lines: { total: total, showdown: sd, noShowdown: nsd },
        grid: grid
      };
    },

    endSession: function (sessionId, cashOut) {
      const s = Stats._session(sessionId);
      if (!s) return;
      s.endedAt = Date.now();
      s.cashOut = cashOut || 0;
      Store.commit('session');
    },

    /**
     * Enregistre une main terminée (statistiques + historique).
     * @param rec enregistrement de main construit par game.js (voir Game._buildRecord)
     */
    recordHand: function (rec) {
      const st = Store.state.stats;
      const f = rec.flags;
      const bbNet = rec.heroNet / rec.bb;
      Stats._buckets(rec.category, rec.tournament ? 'tournois' : rec.sb + '/' + rec.bb, rec.botLevel).forEach(function (b) {
        b.hands++;
        if (f.won) b.handsWon++;
        if (f.showdown) b.showdowns++;
        if (f.wonShowdown) b.showdownsWon++;
        if (f.vpip) b.vpipHands++;
        if (f.pfr) b.pfrHands++;
        if (f.sawFlop) b.sawFlop++;
        Object.keys(rec.heroActions).forEach(function (k) { b.actions[k] = (b.actions[k] || 0) + rec.heroActions[k]; });
        // cashNet : résultat en jetons-argent (cash game). En tournoi, les jetons ne sont pas de l'argent.
        if (b.cashNet === undefined) b.cashNet = b.netChips;
        if (!rec.tournament && !rec.freeroll) b.cashNet += rec.heroNet;
        b.netChips += rec.heroNet;
        b.netBB += bbNet;
      });
      if (rec.bestHand && (!st.bestHand || rec.bestHand.score > st.bestHand.score)) {
        st.bestHand = { score: rec.bestHand.score, category: rec.bestHand.category, description: rec.bestHand.description, cards: rec.bestHand.cards, handId: rec.id, ts: rec.ts };
      }
      const prev = st.bbCurve.length ? st.bbCurve[st.bbCurve.length - 1].v : 0;
      st.bbCurve.push({ n: st.global.hands, v: Math.round((prev + bbNet) * 100) / 100 });
      const s = Stats._session(rec.sessionId);
      if (s) { s.hands++; if (!rec.tournament) s.net += rec.heroNet; s.netBB += bbNet; }
      Store.state.hands.push(rec);
      Store.commit('hand');
    },

    /** Comptabilise les erreurs relevées par l'analyse d'une main. */
    recordErrors: function (tags) {
      const e = Store.state.stats.errors;
      (tags || []).forEach(function (t) { e[t] = (e[t] || 0) + 1; });
      if (tags && tags.length) Store.commit('errors');
    },

    /** Enregistre une réponse à un quiz pour le suivi des thèmes. */
    recordAnswer: function (theme, correct) {
      if (!theme) return;
      const t = Store.state.progress.themes;
      const x = t[theme] || (t[theme] = { correct: 0, total: 0 });
      x.total++;
      if (correct) x.correct++;
      Store.commit('theme');
    },

    /**
     * Statistiques calculées pour un filtre { mode: 'all' | catégorie, level: 'all' | niveau }.
     * Les pourcentages valent null quand il n'y a pas encore de données.
     */
    compute: function (filter) {
      const st = Store.state.stats;
      const mode = (filter && filter.mode) || 'all', level = (filter && filter.level) || 'all';
      let c;
      if (mode === 'all' && level === 'all') c = st.global;
      else if (level === 'all') c = st.byMode[mode];
      else if (mode === 'all') c = st.byBotLevel[level];
      else c = st.byCombo[mode + '|' + level];
      c = c || newCounters();
      const pct = function (a, b) { return b > 0 ? 100 * a / b : null; };
      const acts = c.actions;
      const totalActs = acts.fold + acts.check + acts.call + acts.raise + acts.allin;
      return {
        hands: c.hands,
        handsWon: c.handsWon,
        winRate: pct(c.handsWon, c.hands),
        vpip: pct(c.vpipHands, c.hands),
        pfr: pct(c.pfrHands, c.hands),
        sawFlop: pct(c.sawFlop, c.hands),
        showdowns: c.showdowns,
        showdownWinRate: pct(c.showdownsWon, c.showdowns),
        foldPct: pct(acts.fold, totalActs),
        checkPct: pct(acts.check, totalActs),
        callPct: pct(acts.call, totalActs),
        raisePct: pct(acts.raise, totalActs),
        allinPct: pct(acts.allin, totalActs),
        totalActions: totalActs,
        netChips: c.netChips,
        netBB: c.netBB,
        bb100: c.hands > 0 ? 100 * c.netBB / c.hands : null,
        buyIns: c.buyIns,
        netMoney: Stats._money(c),
        roi: c.buyIns > 0 ? 100 * Stats._money(c) / c.buyIns : null
      };
    },

    /** Lignes du tableau « Résultats par catégorie ». */
    breakdown: function () {
      const st = Store.state.stats;
      const rows = [];
      const add = function (label, c, free) {
        if (!c || !c.hands) return;
        rows.push({
          label: label, hands: c.hands, won: 100 * c.handsWon / c.hands, vpip: 100 * c.vpipHands / c.hands,
          pfr: 100 * c.pfrHands / c.hands, bb100: 100 * c.netBB / c.hands, net: free ? c.netChips : Stats._money(c)
        });
      };
      Object.keys(st.byMode).forEach(function (k) { add('Mode : ' + (MODE_LABELS[k] || k), st.byMode[k], k === 'freeroll' || k === 'learning'); });
      Object.keys(st.byStakes).forEach(function (k) { add('Blinds : ' + k, st.byStakes[k]); });
      Object.keys(st.byBotLevel).forEach(function (k) { add('Adversaires : ' + (global.Bots ? global.Bots.levelLabel(k) : k), st.byBotLevel[k]); });
      return rows;
    },

    /** Badges avec leur état : [{ id, label, need, earned, current }]. */
    badges: function () {
      const p = Store.state.progress;
      const hands = Store.state.stats.global.hands;
      const passed = function (n) { return !!(p.levelExams[n] && p.levelExams[n].passed); };
      const earned = [true, passed(1), passed(1) && passed(2) && hands >= 100, passed(3), passed(4), passed(5)];
      let current = 0;
      for (let i = 0; i < earned.length; i++) { if (earned[i] && (i === 0 || earned[i - 1])) current = i; else break; }
      return BADGES.map(function (b, i) { return { id: b.id, label: b.label, need: b.need, earned: i <= current, current: i === current }; });
    },

    /** Badge actuel et prochain objectif. */
    badge: function () {
      const list = Stats.badges();
      let cur = list[0], next = null;
      list.forEach(function (b, i) { if (b.current) { cur = b; next = list[i + 1] || null; } });
      return { current: cur, next: next };
    },

    /** Les n erreurs les plus fréquentes : [{ tag, label, count }]. */
    topErrors: function (n) {
      const e = Store.state.stats.errors;
      const labels = (global.Analysis && global.Analysis.ERRORS) || {};
      return Object.keys(e).map(function (tag) {
        return { tag: tag, label: labels[tag] ? labels[tag].label : tag, lesson: labels[tag] ? labels[tag].lesson : null, count: e[tag] };
      }).sort(function (a, b) { return b.count - a.count; }).slice(0, n || 5);
    },

    /** Thèmes maîtrisés (au moins 70 % sur 3 réponses ou plus) et thèmes à revoir. */
    themes: function () {
      const t = Store.state.progress.themes;
      const labels = (global.Lessons && global.Lessons.THEMES) || {};
      const mastered = [], review = [], started = [];
      Object.keys(t).forEach(function (k) {
        const x = t[k];
        const item = { theme: k, label: labels[k] || k, correct: x.correct, total: x.total, pct: x.total ? Math.round(100 * x.correct / x.total) : 0 };
        if (x.total < 3) started.push(item);
        else if (item.pct >= 70) mastered.push(item);
        else review.push(item);
      });
      return { mastered: mastered, review: review, started: started };
    }
  };

  /* ========================================================================
     SYNCHRONISATION ENTRE APPAREILS (facultative)
     La sauvegarde est copiée dans un « gist » PRIVÉ du compte GitHub du joueur.
     - Rien n'est envoyé tant que le joueur n'a pas saisi sa clé d'accès.
     - La clé reste dans ce navigateur (clé locale distincte) : elle n'est
       jamais incluse dans la sauvegarde ni dans un export.
     - Seul api.github.com est contacté (et gist.githubusercontent.com pour
       relire un fichier volumineux).
     ======================================================================== */
  const SYNC_KEY = 'pokerAcademie.sync';
  const SYNC_FILE = 'poker-academie-sauvegarde.json';
  const SYNC_API = 'https://api.github.com';
  const SYNC_DELAY = 4000;   // attente après la dernière modification avant l'envoi

  const Sync = {
    FILE: SYNC_FILE,
    meta: { token: '', gistId: '', remoteAt: '', syncedAt: 0, pending: false },
    status: 'off',          // 'off' | 'ok' | 'pending' | 'syncing' | 'error'
    message: '',
    applying: false,        // vrai pendant qu'on applique une sauvegarde reçue
    _timer: null,
    _busy: false,
    _listeners: [],

    onStatus: function (cb) { Sync._listeners.push(cb); },
    _set: function (status, message) {
      Sync.status = status;
      Sync.message = message || '';
      Sync._listeners.forEach(function (cb) { try { cb(status, Sync.message); } catch (e) { /* ignoré */ } });
    },

    enabled: function () { return !!(Sync.meta.token && Sync.meta.gistId); },

    /** Relit les réglages de synchronisation de cet appareil. */
    load: function () {
      try {
        const m = JSON.parse(global.localStorage.getItem(SYNC_KEY) || 'null');
        if (isObj(m)) Sync.meta = fillDefaults(m, { token: '', gistId: '', remoteAt: '', syncedAt: 0, pending: false });
      } catch (e) { /* réglages illisibles : synchronisation désactivée */ }
      Sync._set(Sync.enabled() ? (Sync.meta.pending ? 'pending' : 'ok') : 'off', Sync.enabled() ? 'Synchronisation activée' : '');
    },

    _saveMeta: function () {
      try { global.localStorage.setItem(SYNC_KEY, JSON.stringify(Sync.meta)); } catch (e) { /* ignoré */ }
    },

    /** Appel à l'API GitHub ; lève une erreur au message lisible. */
    _api: function (method, path, body) {
      return global.fetch(SYNC_API + path, {
        method: method,
        headers: { 'Authorization': 'Bearer ' + Sync.meta.token, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store'
      }).then(function (res) {
        if (res.ok) return res.json();
        let msg = 'Erreur GitHub (' + res.status + ').';
        if (res.status === 401) msg = 'Clé d\'accès refusée : elle est incorrecte, expirée ou révoquée.';
        else if (res.status === 403) msg = 'Accès refusé : la clé n\'a pas le droit « gist », ou la limite de requêtes est atteinte.';
        else if (res.status === 404) msg = 'Sauvegarde en ligne introuvable (le fichier a peut-être été supprimé sur GitHub).';
        const err = new Error(msg);
        err.status = res.status;
        throw err;
      }, function () {
        throw new Error('Connexion impossible : vérifiez votre accès à Internet.');
      });
    },

    /** Lit la sauvegarde en ligne : { text, updatedAt }. */
    fetchRemote: function () {
      return Sync._api('GET', '/gists/' + Sync.meta.gistId).then(function (gist) {
        const f = gist.files && gist.files[SYNC_FILE];
        if (!f) return { text: null, updatedAt: gist.updated_at };
        if (f.truncated && f.raw_url) {
          return global.fetch(f.raw_url, { cache: 'no-store' }).then(function (r) { return r.text(); })
            .then(function (text) { return { text: text, updatedAt: gist.updated_at }; });
        }
        return { text: f.content, updatedAt: gist.updated_at };
      });
    },

    /**
     * Connecte cet appareil avec une clé d'accès GitHub (droit « gist » uniquement).
     * Retrouve la sauvegarde en ligne si elle existe, sinon la crée.
     * @returns Promise<{ created: bool, remote: { text, updatedAt } | null }>
     */
    connect: function (token) {
      Sync.meta = { token: String(token || '').trim(), gistId: '', remoteAt: '', syncedAt: 0, pending: false };
      if (!Sync.meta.token) return Promise.reject(new Error('Collez d\'abord votre clé d\'accès.'));
      Sync._set('syncing', 'Connexion…');
      return Sync._api('GET', '/gists?per_page=100').then(function (list) {
        const found = (list || []).filter(function (g) { return g.files && g.files[SYNC_FILE]; })[0];
        if (found) {
          Sync.meta.gistId = found.id;
          return Sync.fetchRemote().then(function (remote) {
            Sync._saveMeta();
            Sync._set('ok', 'Connecté');
            return { created: false, remote: remote };
          });
        }
        const files = {};
        files[SYNC_FILE] = { content: Store.exportJSON() };
        return Sync._api('POST', '/gists', { description: 'Poker Académie — sauvegarde (ne pas modifier à la main)', public: false, files: files })
          .then(function (gist) {
            Sync.meta.gistId = gist.id;
            Sync.meta.remoteAt = gist.updated_at;
            Sync.meta.syncedAt = Date.now();
            Sync._saveMeta();
            Sync._set('ok', 'Synchronisé');
            return { created: true, remote: null };
          });
      }).catch(function (e) {
        Sync.meta = { token: '', gistId: '', remoteAt: '', syncedAt: 0, pending: false };
        Sync._saveMeta();
        Sync._set('off', '');
        throw e;
      });
    },

    /** Oublie la clé sur cet appareil (la sauvegarde en ligne est conservée). */
    disconnect: function () {
      if (Sync._timer) global.clearTimeout(Sync._timer);
      Sync.meta = { token: '', gistId: '', remoteAt: '', syncedAt: 0, pending: false };
      try { global.localStorage.removeItem(SYNC_KEY); } catch (e) { /* ignoré */ }
      Sync._set('off', '');
    },

    /** À appeler après chaque écriture locale : programme un envoi groupé. */
    schedule: function () {
      if (!Sync.enabled() || Sync.applying) return;
      Sync.meta.pending = true;
      Sync._saveMeta();
      Sync._set('pending', 'Envoi en attente…');
      if (Sync._timer) global.clearTimeout(Sync._timer);
      Sync._timer = global.setTimeout(function () { Sync.push(); }, SYNC_DELAY);
    },

    /** Envoie la sauvegarde de cet appareil vers GitHub. */
    push: function () {
      if (!Sync.enabled()) return Promise.resolve(false);
      if (Sync._busy) { Sync._again = true; return Promise.resolve(false); }
      if (Sync._timer) { global.clearTimeout(Sync._timer); Sync._timer = null; }
      Sync._busy = true;
      Sync._set('syncing', 'Synchronisation…');
      const files = {};
      files[SYNC_FILE] = { content: Store.exportJSON() };
      return Sync._api('PATCH', '/gists/' + Sync.meta.gistId, { files: files }).then(function (gist) {
        Sync.meta.remoteAt = gist.updated_at;
        Sync.meta.syncedAt = Date.now();
        Sync.meta.pending = false;
        Sync._saveMeta();
        Sync._busy = false;
        Sync._set('ok', 'Synchronisé');
        if (Sync._again) { Sync._again = false; Sync.schedule(); }
        return true;
      }).catch(function (e) {
        Sync._busy = false;
        Sync._again = false;
        Sync._set('error', e.message);
        return false;
      });
    },

    /**
     * Compare avec la sauvegarde en ligne.
     * @returns Promise<{ state: 'off' | 'same' | 'remote', text?, updatedAt?, conflict? }>
     *   'remote'  : un autre appareil a enregistré une version plus récente.
     *   conflict  : cet appareil a aussi des changements non envoyés.
     */
    check: function () {
      if (!Sync.enabled()) return Promise.resolve({ state: 'off' });
      return Sync.fetchRemote().then(function (remote) {
        if (!remote.text || remote.updatedAt === Sync.meta.remoteAt) {
          if (Sync.meta.pending || !remote.text) Sync.push(); else Sync._set('ok', 'Synchronisé');
          return { state: 'same' };
        }
        return { state: 'remote', text: remote.text, updatedAt: remote.updatedAt, conflict: !!Sync.meta.pending };
      }).catch(function (e) {
        Sync._set('error', e.message);
        return { state: 'error', error: e.message };
      });
    },

    /** Note que la version en ligne `updatedAt` est désormais celle de cet appareil. */
    markAdopted: function (updatedAt) {
      Sync.meta.remoteAt = updatedAt;
      Sync.meta.syncedAt = Date.now();
      Sync.meta.pending = false;
      Sync._saveMeta();
      Sync._set('ok', 'Synchronisé');
    }
  };

  global.Sync = Sync;
  global.Store = Store;
  global.Bankroll = Bankroll;
  global.Stats = Stats;

})(typeof window !== 'undefined' ? window : globalThis);
