/* ==========================================================================
   app.js — Interface et liaison des modules
   --------------------------------------------------------------------------
   UI  : outils d'affichage (cartes, modale, notifications, quiz, graphiques)
   App : navigation, rendu des 7 vues, gestion des événements, démarrage.

   Chargé en dernier : utilise Poker, Bots, Store, Bankroll, Stats, Lessons,
   Challenges, Analysis et Game.
   ========================================================================== */
(function (global) {
  'use strict';
  const P = global.Poker, S = global.Store, G = global.Game, L = global.Lessons;
  const doc = global.document;

  /* ------------------------------------------------------------------------
     OUTILS
     ------------------------------------------------------------------------ */
  function $(id) { return doc.getElementById(id); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmt(n) { return Math.round(n || 0).toLocaleString('fr-FR'); }
  function signed(n) { n = Math.round(n || 0); return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toLocaleString('fr-FR'); }
  function pct(v, digits) { return v === null || v === undefined ? '—' : v.toFixed(digits === undefined ? 0 : digits).replace('.', ',') + ' %'; }
  function num(v, digits) { return v === null || v === undefined ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(digits).replace('.', ','); }
  function dateText(ts) {
    try { return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }
  function show(el, visible) { if (el) el.classList.toggle('hidden', !visible); }
  function signClass(n) { return n > 0 ? 'pos' : n < 0 ? 'neg' : ''; }

  const GLOSSARY = [
    ['Abattage (showdown)', 'Moment où les joueurs encore en jeu après la river montrent leurs cartes pour désigner le gagnant.'],
    ['All-in (tapis)', 'Miser la totalité de ses jetons.'],
    ['Bankroll', 'Somme totale réservée au poker. Ici, elle est 100 % virtuelle.'],
    ['BB/100', 'Gain ou perte moyenne en grosses blinds pour 100 mains jouées : la mesure de référence du niveau d\'un joueur de cash game.'],
    ['Blinds', 'Mises obligatoires posées avant la distribution par les deux joueurs à gauche du bouton : petite blinde (SB) et grosse blinde (BB).'],
    ['Bluff', 'Miser avec une main faible pour faire coucher une main meilleure.'],
    ['Board', 'Les cartes communes retournées au centre de la table.'],
    ['Bouton (BTN)', 'Position du donneur, marquée par le jeton « D ». Il parle en dernier après le flop : c\'est la meilleure position.'],
    ['Buy-in (cave)', 'Montant de jetons avec lequel on s\'assoit à une table.'],
    ['Call (suivre)', 'Égaliser la mise d\'un adversaire.'],
    ['C-bet (mise de continuation)', 'Mise au flop faite par le joueur qui a relancé avant le flop, qu\'il ait touché ou non.'],
    ['Check (parole)', 'Passer son tour sans miser, quand personne n\'a misé avant soi.'],
    ['Cote du pot (pot odds)', 'Rapport entre ce qu\'il faut payer et le pot final : montant à suivre ÷ (pot + montant à suivre). C\'est l\'équité minimale pour suivre de façon rentable.'],
    ['Cut-off (CO)', 'Position juste avant le bouton.'],
    ['Équité (equity)', 'Votre part théorique du pot : la fréquence à laquelle vous gagneriez si la main était jouée jusqu\'au bout.'],
    ['Flop', 'Les trois premières cartes communes.'],
    ['Fold (se coucher)', 'Abandonner la main.'],
    ['Freeroll', 'Partie à entrée gratuite. Ici : une table d\'entraînement qui ne touche pas à votre bankroll.'],
    ['Heads-up', 'Tête-à-tête entre deux joueurs.'],
    ['Kicker', 'Carte d\'appoint qui départage deux mains de même combinaison.'],
    ['Limp', 'Entrer dans le coup en suivant simplement la grosse blinde, sans relancer.'],
    ['Outs', 'Cartes restantes qui amélioreraient votre main.'],
    ['PFR', 'Pourcentage de mains où vous relancez avant le flop.'],
    ['Position', 'Votre place dans l\'ordre de parole. « Être en position » = parler après l\'adversaire.'],
    ['Pot annexe (side pot)', 'Pot séparé créé quand un joueur est à tapis pour moins que les autres : il ne peut pas le gagner.'],
    ['Pré-flop', 'Premier tour d\'enchères, avant toute carte commune.'],
    ['Raise (relancer)', 'Augmenter la mise en cours.'],
    ['Range', 'Éventail des mains qu\'un joueur peut avoir dans une situation donnée.'],
    ['River', 'La cinquième et dernière carte commune.'],
    ['ROI', 'Retour sur investissement : résultat net divisé par le total des buy-ins.'],
    ['Semi-bluff', 'Miser avec un tirage : la main n\'est pas encore faite, mais elle peut s\'améliorer.'],
    ['Stack', 'Vos jetons sur la table.'],
    ['3-bet', 'Sur-relance d\'une première relance.'],
    ['Tilt', 'État de frustration qui pousse à mal jouer après un mauvais coup.'],
    ['Turn', 'La quatrième carte commune.'],
    ['UTG', '« Under the gun » : premier joueur à parler avant le flop.'],
    ['Value bet (mise pour valeur)', 'Miser une bonne main pour être payé par des mains moins fortes.'],
    ['VPIP', 'Pourcentage de mains où vous mettez volontairement de l\'argent dans le pot avant le flop (blinds obligatoires exclues).']
  ];

  /* ------------------------------------------------------------------------
     UI — briques d'affichage
     ------------------------------------------------------------------------ */
  const UI = {
    /** HTML d'une carte. `cls` : classes supplémentaires ('sm', 'highlight', 'dealt'...). */
    card: function (card, cls) {
      if (!card) return '<div class="card back ' + (cls || '') + '" aria-label="Carte cachée"></div>';
      const c = P.parseCard(card);
      return '<div class="card ' + (c.red ? 'red' : 'black') + ' suit-' + c.suit + ' ' + (cls || '') + '" aria-label="' + esc(P.cardName(card)) + '">'
        + '<span class="card-rank">' + c.rankChar + '</span><span class="card-suit">' + c.symbol + '</span></div>';
    },
    cards: function (list, cls) { return (list || []).map(function (c) { return UI.card(c, cls); }).join(''); },

    /** Remplace [[As Kd]] par des cartes et {{range}} par la grille des mains. */
    rich: function (html) {
      return String(html || '')
        .replace(/\[\[([^\]]+)\]\]/g, function (_, list) {
          return '<span class="cards-inline">' + UI.cards(list.trim().split(/\s+/), 'sm') + '</span>';
        })
        .replace('{{range}}', L.rangeGridHTML());
    },

    toast: function (msg, kind) {
      const el = doc.createElement('div');
      el.className = 'toast ' + (kind || '');
      el.textContent = msg;
      $('toasts').appendChild(el);
      global.setTimeout(function () { el.classList.add('leaving'); }, 3600);
      global.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
    },

    _modalResolve: null,
    /**
     * Fenêtre modale. Renvoie une promesse résolue avec la valeur du bouton choisi
     * (ou opts.dismissValue si la fenêtre est fermée).
     * opts : { title, html, actions: [{ label, cls, value }], wide, dismissValue, onOpen(body, close) }
     */
    modal: function (opts) {
      UI.closeModal(opts.dismissValue);
      return new Promise(function (resolve) {
        UI._modalResolve = resolve;
        UI._modalDismiss = opts.dismissValue;
        $('modal-title').textContent = opts.title || '';
        $('modal-body').innerHTML = opts.html || '';
        $('modal').classList.toggle('wide', !!opts.wide);
        const actions = $('modal-actions');
        actions.innerHTML = '';
        (opts.actions || []).forEach(function (a) {
          const b = doc.createElement('button');
          b.type = 'button';
          b.className = 'btn ' + (a.cls || 'btn-ghost');
          b.textContent = a.label;
          b.addEventListener('click', function () { UI.closeModal(a.value); });
          actions.appendChild(b);
        });
        show($('modal-overlay'), true);
        if (opts.onOpen) opts.onOpen($('modal-body'), UI.closeModal);
        const first = actions.querySelector('button') || $('modal-close');
        if (first) first.focus();
      });
    },
    closeModal: function (value) {
      if (!UI._modalResolve) return;
      const r = UI._modalResolve;
      UI._modalResolve = null;
      show($('modal-overlay'), false);
      $('modal-body').innerHTML = '';
      r(value === undefined ? UI._modalDismiss : value);
    },
    confirm: function (title, html, okLabel, danger) {
      return UI.modal({
        title: title, html: html, dismissValue: false,
        actions: [{ label: 'Annuler', cls: 'btn-ghost', value: false }, { label: okLabel || 'Confirmer', cls: danger ? 'btn-danger' : 'btn-accent', value: true }]
      });
    },

    /**
     * Quiz générique (leçons, examens, défis, analyse).
     * session : { questions, index, answers, revealed } — objet sérialisable.
     * opts    : { onAnswer(question, correct), onChange(), onFinish(result), lastLabel }
     */
    quiz: function (container, session, opts) {
      opts = opts || {};
      const q = session.questions[session.index];
      if (!q) { if (opts.onFinish) opts.onFinish(L.grade(session.questions, session.answers)); return; }
      const total = session.questions.length;
      const chosen = session.answers[session.index];
      const letters = 'ABCDEF';
      let html = '<div class="quiz">';
      if (total > 1) {
        html += '<p class="lesson-step-count">Question ' + (session.index + 1) + ' sur ' + total + '</p>'
          + '<div class="progress"><div class="progress-bar" style="width:' + Math.round(100 * session.index / total) + '%"></div></div>';
      }
      if (q.context) html += '<div class="quiz-context">' + UI.rich(esc(q.context)) + '</div>';
      html += '<p class="quiz-question">' + esc(q.q) + '</p><div class="quiz-options">';
      q.options.forEach(function (o, i) {
        let cls = 'quiz-option';
        if (session.revealed) {
          if (i === q.answer) cls += ' correct';
          else if (i === chosen) cls += ' wrong';
        }
        html += '<button type="button" class="' + cls + '" data-opt="' + i + '"' + (session.revealed ? ' disabled' : '') + '>'
          + '<span class="quiz-letter">' + letters[i] + '</span><span>' + esc(o) + '</span></button>';
      });
      html += '</div>';
      if (session.revealed) {
        const good = chosen === q.answer;
        html += '<div class="quiz-feedback ' + (good ? 'good' : 'bad') + '"><strong>' + (good ? 'Bonne réponse.' : 'Ce n\'est pas ça.') + '</strong> ' + UI.rich(esc(q.explain)) + '</div>';
        if (total > 1 || opts.lastLabel) {
          html += '<button type="button" class="btn btn-accent" data-next="1">' + (session.index + 1 < total ? 'Question suivante' : (opts.lastLabel || 'Voir le résultat')) + '</button>';
        }
      }
      html += '</div>';
      container.innerHTML = html;
      container.querySelectorAll('[data-opt]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (session.revealed) return;
          const i = parseInt(b.getAttribute('data-opt'), 10);
          session.answers[session.index] = i;
          session.revealed = true;
          if (opts.onAnswer) opts.onAnswer(q, i === q.answer);
          if (opts.onChange) opts.onChange();
          UI.quiz(container, session, opts);
        });
      });
      const next = container.querySelector('[data-next]');
      if (next) {
        next.addEventListener('click', function () {
          session.index++;
          session.revealed = false;
          if (opts.onChange) opts.onChange();
          UI.quiz(container, session, opts);
        });
        next.focus();
      }
    },

    /** Courbe simple en SVG pur. Renvoie false s'il n'y a pas assez de points. */
    lineChart: function (svg, values, opts) {
      opts = opts || {};
      if (!svg) return false;
      if (!values || values.length < 2) { svg.innerHTML = ''; return false; }
      const W = Math.max(300, svg.clientWidth || 600), H = 240;
      const padL = 56, padR = 12, padT = 14, padB = 16;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      let min = Math.min.apply(null, values), max = Math.max.apply(null, values);
      // Séries supplémentaires (même échelle) : opts.extra = [{ values, cls }]
      (opts.extra || []).forEach(function (e) {
        min = Math.min(min, Math.min.apply(null, e.values));
        max = Math.max(max, Math.max.apply(null, e.values));
      });
      if (opts.zero) { min = Math.min(min, 0); max = Math.max(max, 0); }
      if (min === max) { max += 1; min -= 1; }
      const n = values.length;
      const x = function (i) { return padL + i * (W - padL - padR) / (n - 1); };
      const y = function (v) { return padT + (max - v) * (H - padT - padB) / (max - min); };
      let d = '';
      values.forEach(function (v, i) { d += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1) + ' '; });
      const base = y(opts.zero ? 0 : min);
      const area = d + 'L' + x(n - 1).toFixed(1) + ' ' + base.toFixed(1) + ' L' + x(0).toFixed(1) + ' ' + base.toFixed(1) + ' Z';
      const label = function (v) { return Math.abs(v) >= 10000 ? Math.round(v / 1000) + ' k' : fmt(v); };
      let html = '';
      [max, (max + min) / 2, min].forEach(function (v) {
        html += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>'
          + '<text x="' + (padL - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + label(v) + '</text>';
      });
      if (opts.zero && min < 0 && max > 0) html += '<line class="zero" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + base.toFixed(1) + '" y2="' + base.toFixed(1) + '"/>';
      (opts.extra || []).forEach(function (e) {
        let de = '';
        e.values.forEach(function (v, i) { de += (i ? 'L' : 'M') + (padL + i * (W - padL - padR) / Math.max(1, e.values.length - 1)).toFixed(1) + ' ' + y(v).toFixed(1) + ' '; });
        html += '<path class="' + e.cls + '" d="' + de + '"/>';
      });
      html += (opts.extra ? '' : '<path class="area" d="' + area + '"/>') + '<path class="line" d="' + d + '"/>';
      svg.innerHTML = html;
      return true;
    },

    /** Diagramme en barres (valeurs positives en vert, négatives en rouge). items : [{ label, value, note }]. */
    barChart: function (svg, items) {
      if (!svg) return false;
      if (!items || !items.length) { svg.innerHTML = ''; return false; }
      const W = Math.max(300, svg.clientWidth || 600), H = 240;
      const padL = 56, padR = 12, padT = 14, padB = 34;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      let min = Math.min.apply(null, items.map(function (i) { return i.value; }).concat([0]));
      let max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([0]));
      if (min === max) { max += 1; }
      const y = function (v) { return padT + (max - v) * (H - padT - padB) / (max - min); };
      const slot = (W - padL - padR) / items.length;
      const bw = Math.min(46, slot * 0.6);
      let html = '';
      [max, min].forEach(function (v) {
        html += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>'
          + '<text x="' + (padL - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + fmt(v) + '</text>';
      });
      html += '<line class="zero" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '"/>';
      items.forEach(function (it, i) {
        const cx = padL + slot * (i + 0.5);
        const top = Math.min(y(it.value), y(0)), h = Math.max(1, Math.abs(y(it.value) - y(0)));
        html += '<rect class="' + (it.value >= 0 ? 'bar-pos' : 'bar-neg') + '" x="' + (cx - bw / 2).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3"><title>' + esc(it.note || '') + '</title></rect>'
          + '<text x="' + cx.toFixed(1) + '" y="' + (H - 18) + '" text-anchor="middle">' + esc(it.label) + '</text>'
          + '<text x="' + cx.toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle">' + esc(it.sub || '') + '</text>';
      });
      svg.innerHTML = html;
      return true;
    },

    /**
     * État visible d'une main après les entrées de l'historique numérotées <= N :
     * stacks, mises, joueurs couchés, board, pot. Sert à la table, au rejeu et à l'historique.
     */
    handStateAt: function (actions, seatInfos, N) {
      const seats = {};
      seatInfos.forEach(function (s) { seats[s.seat] = { stack: s.stackStart, bet: 0, folded: false, last: null, won: 0 }; });
      let board = [], pot = 0, street = 'preflop';
      actions.forEach(function (a) {
        if (a.n > N) return;
        const p = a.seat !== null && a.seat !== undefined ? seats[a.seat] : null;
        switch (a.type) {
          case 'sb': case 'bb': case 'call': case 'bet': case 'raise':
            p.stack -= a.amount; p.bet = a.to; pot += a.amount; p.last = a; break;
          case 'check': p.last = a; break;
          case 'fold': p.folded = true; p.last = a; break;
          case 'refund': p.stack += a.amount; p.bet = a.to; pot -= a.amount; break;
          case 'deal':
            board = board.concat(a.cards); street = a.street;
            Object.keys(seats).forEach(function (k) { seats[k].bet = 0; if (!seats[k].folded) seats[k].last = null; });
            break;
          case 'win': p.stack += a.amount; p.won += a.amount; pot -= a.amount; p.last = a; break;
          default: break;
        }
      });
      return { seats: seats, board: board, pot: Math.max(0, pot), street: street };
    },

    /** Phrase décrivant une entrée de l'historique. names : { siège: nom }, heroSeat : siège du joueur. */
    actionText: function (a, names, heroSeat) {
      const me = a.seat === heroSeat;
      const who = me ? 'Vous' : esc(names[a.seat] || ('Siège ' + a.seat));
      const amt = '<span class="log-amount">' + fmt(a.amount) + '</span>';
      const to = '<span class="log-amount">' + fmt(a.to) + '</span>';
      const tapis = a.allIn ? ' <strong>(tapis)</strong>' : '';
      switch (a.type) {
        case 'sb': return who + (me ? ' postez' : ' poste') + ' la petite blinde ' + amt + tapis;
        case 'bb': return who + (me ? ' postez' : ' poste') + ' la grosse blinde ' + amt + tapis;
        case 'fold': return who + (me ? ' vous couchez' : ' se couche');
        case 'check': return who + (me ? ' dites' : ' dit') + ' parole';
        case 'call': return who + (me ? ' suivez ' : ' suit ') + amt + tapis;
        case 'bet': return who + (me ? ' misez ' : ' mise ') + to + tapis;
        case 'raise': return who + (me ? ' relancez à ' : ' relance à ') + to + tapis;
        case 'refund': return who + (me ? ' récupérez ' : ' récupère ') + amt + ' (mise non suivie)';
        case 'win': return who + (me ? ' gagnez ' : ' gagne ') + amt;
        default: return '';
      }
    },

    /** Lignes <li> du journal d'une main, limitées aux entrées <= N. */
    logHTML: function (actions, names, heroSeat, N) {
      let html = '<li class="log-street">Pré-flop</li>';
      actions.forEach(function (a) {
        if (a.n > N) return;
        if (a.type === 'deal') {
          html += '<li class="log-street">' + P.STREET_NAMES[a.street] + ' <span class="cards-inline">' + UI.cards(a.cards, 'sm') + '</span></li>';
          return;
        }
        const cls = a.type === 'win' ? 'log-win' : a.seat === heroSeat ? 'log-hero' : (a.type === 'sb' || a.type === 'bb' || a.type === 'refund') ? 'log-info' : '';
        html += '<li class="' + cls + '">' + UI.actionText(a, names, heroSeat) + '</li>';
      });
      return html;
    },

    /** Affiche l'analyse pédagogique d'une main dans un conteneur. */
    analysis: function (container, rec) {
      const an = rec.analysis;
      if (!an) { container.innerHTML = '<p class="muted">Analyse indisponible pour cette main.</p>'; return; }
      let html = '<div class="analysis-head"><h2 class="panel-title">Analyse de la main n° ' + rec.number + '</h2>'
        + '<span class="tag ' + (rec.heroNet > 0 ? 'tag-ok' : rec.heroNet < 0 ? 'tag-danger' : '') + '">Résultat : ' + signed(rec.heroNet) + '</span></div>'
        + '<p class="analysis-summary">' + esc(an.summary) + '</p>';
      an.decisions.forEach(function (d, i) {
        const tagCls = d.verdict === 'good' ? 'tag-ok' : d.verdict === 'bad' ? 'tag-danger' : d.verdict === 'doubt' ? 'tag-warn' : '';
        html += '<section class="decision v-' + d.verdict + '">'
          + '<div class="decision-head"><h3>Décision ' + (i + 1) + ' — ' + esc(d.streetName) + '</h3><span class="tag ' + tagCls + '">' + esc(d.verdictLabel) + '</span></div>'
          + '<p class="muted">' + UI.rich(esc(d.situation)) + '</p>'
          + '<p><strong>Votre décision :</strong> ' + esc(d.chosen) + ' — <strong>Approche conseillée :</strong> ' + esc(d.advised) + '</p>'
          + '<p>' + esc(d.comment) + '</p>'
          + '<p class="decision-sub">Principes applicables</p><ul>' + d.principles.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>'
          + '<div class="hint-figures">' + d.figures.map(function (f) { return '<span class="tag">' + esc(f.label) + ' : ' + esc(f.value) + '</span>'; }).join('') + '</div>';
        if (d.alternatives.length) html += '<p class="decision-sub">Alternatives possibles</p><ul>' + d.alternatives.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>';
        html += '<p class="decision-sub">Hypothèses utilisées</p><ul class="hypotheses">' + d.hypotheses.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></section>';
      });
      if (an.review.length) {
        html += '<h3>Notions à revoir</h3><div class="review-topics">';
        an.review.forEach(function (r) {
          html += r.lesson
            ? '<button type="button" class="btn btn-chip" data-lesson="' + esc(r.lesson) + '">' + esc(r.label) + ' → revoir la leçon</button>'
            : '<span class="tag tag-warn">' + esc(r.label) + '</span>';
        });
        html += '</div>';
      }
      if (an.multi && (an.multi.line || an.multi.notes.length)) {
        html += '<h3>Lecture de la main sur plusieurs tours</h3><div class="multi-box">'
          + (an.multi.line ? '<p class="multi-line">Votre ligne : ' + esc(an.multi.line) + '</p>' : '')
          + '<p class="muted">Jetons investis : ' + fmt(an.multi.invested) + ' (' + an.multi.investedPct + ' % de votre stack de départ).</p>'
          + (an.multi.notes.length ? '<ul>' + an.multi.notes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
      }
      html += '<h3>Question liée à cette main</h3><div class="analysis-quiz"></div>';
      container.innerHTML = html;
      container.querySelectorAll('[data-lesson]').forEach(function (b) {
        b.addEventListener('click', function () { UI.closeModal(); App.openLesson(b.getAttribute('data-lesson')); });
      });
      if (an.quiz) {
        UI.quiz(container.querySelector('.analysis-quiz'), { questions: [an.quiz], index: 0, answers: [], revealed: false }, {
          onAnswer: function (q, correct) { global.Stats.recordAnswer(q.theme, correct); }
        });
      }
    },

    /** Rejeu pas à pas d'une main enregistrée, dans une fenêtre modale. */
    replay: function (rec) {
      const names = {};
      rec.seats.forEach(function (s) { names[s.seat] = s.name; });
      const steps = rec.actions;
      let k = 0;
      const render = function (body) {
        const a = steps[k];
        const st = UI.handStateAt(rec.actions, rec.seats, a.n);
        const last = k === steps.length - 1;
        let html = '<div class="replay-stage"><p class="muted">Main n° ' + rec.number + ' · blinds ' + rec.sb + '/' + rec.bb + ' · étape ' + (k + 1) + ' sur ' + steps.length + '</p>'
          + '<div class="card-row" style="justify-content:center"><span class="card-row-label">Vos cartes</span>' + UI.cards(rec.heroCards) + '</div>'
          + '<div class="replay-board">' + (st.board.length ? UI.cards(st.board) : '<span class="muted">Pas encore de carte commune</span>') + '</div>'
          + '<p><span class="tag tag-accent">Pot : ' + fmt(st.pot) + '</span> <span class="tag">' + P.STREET_NAMES[st.street === 'showdown' ? 'showdown' : st.street] + '</span></p>'
          + '<p class="replay-step">' + (a.type === 'deal' ? P.STREET_NAMES[a.street] + ' : ' + UI.rich('[[' + a.cards.join(' ') + ']]') : UI.actionText(a, names, rec.heroSeat)) + '</p>'
          + '<div class="replay-players">';
        rec.seats.forEach(function (s) {
          const p = st.seats[s.seat];
          html += '<div class="replay-player' + (p.folded ? ' folded' : '') + (a.seat === s.seat ? ' acting' : '') + '"><strong>' + esc(s.seat === rec.heroSeat ? 'Vous' : s.name) + '</strong> <span class="muted">' + esc(s.position) + '</span><br>'
            + '<span class="num">' + fmt(p.stack) + '</span>' + (p.bet ? ' · mise ' + fmt(p.bet) : '') + (p.folded ? ' · couché' : '') + '</div>';
        });
        html += '</div>';
        if (last && rec.showdown.length) {
          html += '<ul class="showdown-list">' + rec.showdown.map(function (sd) {
            return '<li><strong>' + esc(sd.seat === rec.heroSeat ? 'Vous' : names[sd.seat]) + '</strong> <span class="cards-inline">' + UI.cards(sd.cards, 'sm') + '</span> ' + esc(sd.description) + '</li>';
          }).join('') + '</ul>';
        }
        html += '<div class="replay-controls"><button type="button" class="btn btn-ghost" data-r="first"' + (k === 0 ? ' disabled' : '') + '>⏮ Début</button>'
          + '<button type="button" class="btn btn-ghost" data-r="prev"' + (k === 0 ? ' disabled' : '') + '>◀ Précédent</button>'
          + '<button type="button" class="btn btn-accent" data-r="next"' + (last ? ' disabled' : '') + '>Suivant ▶</button></div></div>';
        body.innerHTML = html;
        body.querySelectorAll('[data-r]').forEach(function (b) {
          b.addEventListener('click', function () {
            const r = b.getAttribute('data-r');
            k = r === 'first' ? 0 : r === 'prev' ? Math.max(0, k - 1) : Math.min(steps.length - 1, k + 1);
            render(body);
          });
        });
      };
      UI.modal({ title: 'Rejouer la main', wide: true, html: '', actions: [{ label: 'Fermer', cls: 'btn-ghost' }], onOpen: render });
    }
  };

  /* ------------------------------------------------------------------------
     APP
     ------------------------------------------------------------------------ */
  const MODE_LABEL = { cash: 'Cash Game', freeroll: 'Freeroll', learning: 'Apprentissage', tournament: 'Tournoi', sng: 'Sit & Go' };
  const BUBBLES = { fold: 'Couché', check: 'Parole', call: 'Suit', bet: 'Mise', raise: 'Relance', sb: 'Petite blinde', bb: 'Grosse blinde' };

  const App = {
    view: 'home',
    betValue: 0,
    _betKey: null,
    _analysisShownFor: null,
    _historyId: null,

    /* ===================== Navigation ===================== */
    navigate: function (view) {
      if (!$('view-' + view)) view = 'home';
      App.view = view;
      S.state.ui.view = view;
      doc.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + view); });
      doc.querySelectorAll('.nav-btn').forEach(function (b) {
        const on = b.getAttribute('data-view') === view;
        b.classList.toggle('active', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
      App.render();
      S.commit('nav');
      global.scrollTo(0, 0);
    },

    render: function () {
      App.renderHeader();
      switch (App.view) {
        case 'home': App.renderHome(); break;
        case 'learn': App.renderLearn(); break;
        case 'game': App.renderGame(); break;
        case 'stats': App.renderStats(); break;
        case 'bankroll': App.renderBankroll(); break;
        case 'history': App.renderHistory(); break;
        case 'settings': App.renderSettings(); break;
        default: break;
      }
    },

    renderHeader: function () {
      $('header-bankroll').textContent = fmt(global.Bankroll.balance());
      doc.body.classList.toggle('four-colors', !!S.state.settings.fourColors);
      App.renderSync();
    },

    /* ===================== Accueil ===================== */
    renderHome: function () {
      const st = S.state;
      $('home-player-name').textContent = st.profile.name ? ', ' + st.profile.name : '';
      const g = G.state();
      show($('btn-resume-game'), !!g);
      show($('home-resume-info'), !!g);
      if (g) {
        $('home-resume-info').textContent = 'Partie en cours : ' + MODE_LABEL[global.Stats.category(g.config)] + ', blinds ' + g.table.sb + '/' + g.table.bb
          + ', main n° ' + g.table.handNumber + ', votre stack : ' + fmt(g.table.seats[g.heroSeat].stack) + '.';
      }
      const pr = L.progress();
      $('home-level').textContent = 'Niveau ' + pr.level;
      $('home-progress-bar').style.width = pr.pct + '%';
      $('home-progress-text').textContent = pr.text;
      const sum = global.Bankroll.summary();
      $('home-bankroll').textContent = fmt(sum.balance);
      $('home-bankroll-net').textContent = 'Résultat de jeu : ' + signed(sum.net) + (sum.onTable ? ' · ' + fmt(sum.onTable) + ' en table' : '');
      const c = global.Stats.compute({ mode: 'all', level: 'all' });
      $('home-hands').textContent = fmt(c.hands);
      $('home-winrate').textContent = c.hands ? 'Mains gagnées : ' + pct(c.winRate) + ' · ' + num(c.bb100, 1) + ' BB/100' : 'Aucune main jouée pour l\'instant';
      const b = global.Stats.badge();
      $('home-badge').textContent = b.current.label;
      $('home-badge-next').textContent = b.next ? 'Prochain : ' + b.next.label + ' — ' + b.next.need : 'Badge maximal atteint';
      $('btn-home-learn').textContent = L.nextLessonId() ? 'Continuer l\'apprentissage' : 'Revoir les leçons';
      $('home-alerts').innerHTML = global.Bankroll.alerts().map(function (a) {
        return '<div class="alert alert-' + (a.level === 'danger' ? 'danger' : a.level === 'info' ? 'info' : 'warn') + '">' + esc(a.text) + '</div>';
      }).join('');
    },

    /* ===================== Apprentissage ===================== */
    setLearnTab: function (tab) {
      S.state.ui.learnTab = tab;
      S.commit('tab');
      App.renderLearn();
    },

    renderLearn: function () {
      const tab = S.state.ui.learnTab || 'lessons';
      doc.querySelectorAll('[data-learn-tab]').forEach(function (b) {
        const on = b.getAttribute('data-learn-tab') === tab;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      ['lessons', 'challenges', 'glossary'].forEach(function (t) { $('learn-' + t).classList.toggle('active', t === tab); });
      if (tab === 'lessons') { App.renderLevels(); App.renderLessonContent(); }
      else if (tab === 'challenges') App.renderChallenges();
      else App.renderGlossary();
    },

    renderLevels: function () {
      const cur = S.state.ui.lesson;
      let html = '';
      L.levels.forEach(function (lvl) {
        const open = L.isLevelUnlocked(lvl.id);
        const passed = L.isExamPassed(lvl.id);
        html += '<div class="level-block' + (open ? '' : ' locked') + '"><div class="level-head"><div>' + esc(lvl.title) + '<small>' + esc(lvl.subtitle) + '</small></div>'
          + '<span class="tag ' + (passed ? 'tag-ok' : open ? 'tag-accent' : '') + '">' + (passed ? 'Validé' : lvl.comingSoon ? 'À venir' : open ? 'Ouvert' : 'Verrouillé') + '</span></div><ul class="lesson-list">';
        if (lvl.comingSoon) {
          lvl.topics.forEach(function (t) { html += '<li class="lesson-item" style="cursor:default"><span class="lesson-state">·</span><span class="muted">' + esc(t) + '</span></li>'; });
        } else {
          lvl.lessons.forEach(function (l, i) {
            const done = L.isDone(l.id);
            const isCur = cur && cur.kind === 'lesson' && cur.id === l.id;
            html += '<li><button type="button" class="lesson-item' + (done ? ' done' : '') + (isCur ? ' current' : '') + '" data-lesson="' + l.id + '"' + (open ? '' : ' disabled') + '>'
              + '<span class="lesson-state">' + (done ? '✓' : (i + 1)) + '</span><span>' + esc(l.title) + '</span></button></li>';
          });
          const mCur = cur && cur.kind === 'mistakes' && cur.id === lvl.id;
          html += '<li><button type="button" class="lesson-item' + (mCur ? ' current' : '') + '" data-mistakes="' + lvl.id + '"' + (open ? '' : ' disabled') + '><span class="lesson-state">!</span><span>Erreurs fréquentes du niveau</span></button></li>';
          const exOpen = L.isExamUnlocked(lvl.id);
          const eCur = cur && cur.kind === 'exam' && cur.id === lvl.id;
          html += '<li><button type="button" class="lesson-item exam' + (passed ? ' done' : '') + (eCur ? ' current' : '') + '" data-exam="' + lvl.id + '"' + (exOpen ? '' : ' disabled') + '>'
            + '<span class="lesson-state">' + (passed ? '✓' : '★') + '</span><span>Examen du niveau ' + lvl.id + (exOpen ? '' : ' (validez d\'abord les leçons)') + '</span></button></li>';
        }
        html += '</ul></div>';
      });
      const box = $('learn-levels');
      box.innerHTML = html;
      box.querySelectorAll('[data-lesson]').forEach(function (b) { b.addEventListener('click', function () { App.openLesson(b.getAttribute('data-lesson')); }); });
      box.querySelectorAll('[data-exam]').forEach(function (b) { b.addEventListener('click', function () { App.openExam(parseInt(b.getAttribute('data-exam'), 10)); }); });
      box.querySelectorAll('[data-mistakes]').forEach(function (b) {
        b.addEventListener('click', function () { S.state.ui.lesson = { kind: 'mistakes', id: parseInt(b.getAttribute('data-mistakes'), 10) }; S.commit('lesson'); App.renderLearn(); });
      });
    },

    openLesson: function (id) {
      if (!L.get(id) || !L.isUnlocked(id)) { UI.toast('Cette leçon n\'est pas encore accessible.', 'warn'); return; }
      S.state.ui.lesson = { kind: 'lesson', id: id, phase: 'read', step: 0, quiz: null, result: null };
      S.state.ui.learnTab = 'lessons';
      App.navigate('learn');
    },

    openExam: function (level) {
      if (!L.isExamUnlocked(level)) { UI.toast('Validez d\'abord toutes les leçons du niveau.', 'warn'); return; }
      S.state.ui.lesson = { kind: 'exam', id: level, phase: 'intro', step: 0, quiz: null, result: null };
      S.state.ui.learnTab = 'lessons';
      App.navigate('learn');
    },

    mistakesHTML: function (level) {
      const lvl = L.level(level);
      return '<div class="mistakes-box"><strong>Erreurs fréquentes — ' + esc(lvl.title) + '</strong><ul>' + lvl.mistakes.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></div>';
    },

    renderLessonContent: function () {
      const box = $('learn-content');
      const cur = S.state.ui.lesson;
      const save = function () { S.commit('lesson'); };
      const rerender = function () { save(); App.renderLearn(); };

      if (!cur) {
        const pr = L.progress();
        const next = L.nextLessonId();
        box.innerHTML = '<h2>' + esc(pr.title) + '</h2><div class="progress progress-lg"><div class="progress-bar" style="width:' + pr.pct + '%"></div></div>'
          + '<p class="muted">' + esc(pr.text) + '</p>'
          + '<p>Chaque leçon se termine par un quiz et des exercices pratiques. Validez toutes les leçons d\'un niveau, puis son examen, pour débloquer le niveau suivant.</p>'
          + (next ? '<button type="button" class="btn btn-accent" id="learn-start">' + (pr.done ? 'Continuer' : 'Commencer') + ' : ' + esc(L.get(next).title) + '</button>'
            : (pr.allDone ? '' : '<button type="button" class="btn btn-accent" id="learn-exam">Passer l\'examen du niveau ' + pr.level + '</button>'));
        if ($('learn-start')) $('learn-start').addEventListener('click', function () { App.openLesson(next); });
        if ($('learn-exam')) $('learn-exam').addEventListener('click', function () { App.openExam(pr.level); });
        return;
      }

      if (cur.kind === 'mistakes') {
        box.innerHTML = '<h2>Résumé des erreurs fréquentes</h2>' + App.mistakesHTML(cur.id)
          + '<p class="muted">Relisez cette liste avant chaque session : ce sont les fautes qui coûtent le plus de jetons aux débutants.</p>';
        return;
      }

      /* ---------- Leçon ---------- */
      if (cur.kind === 'lesson') {
        const lesson = L.get(cur.id);
        if (!lesson) { S.state.ui.lesson = null; App.renderLessonContent(); return; }
        const lvl = L.levelOf(cur.id);
        if (cur.phase === 'read') {
          const n = lesson.steps.length;
          cur.step = Math.max(0, Math.min(n - 1, cur.step || 0));
          box.innerHTML = '<div class="lesson-meta"><span class="tag tag-accent">' + esc(lvl.title) + '</span><span class="tag">' + esc(L.THEMES[lesson.theme]) + '</span>'
            + '<span class="lesson-step-count">Page ' + (cur.step + 1) + ' sur ' + n + '</span></div>'
            + '<h2>' + esc(lesson.title) + '</h2><div class="lesson-body">' + UI.rich(lesson.steps[cur.step]) + '</div>'
            + '<div class="lesson-nav"><button type="button" class="btn btn-ghost" id="lesson-prev"' + (cur.step === 0 ? ' disabled' : '') + '>◀ Précédent</button>'
            + '<button type="button" class="btn btn-accent" id="lesson-next">' + (cur.step < n - 1 ? 'Suivant ▶' : 'Passer au quiz') + '</button></div>';
          $('lesson-prev').addEventListener('click', function () { cur.step--; rerender(); });
          $('lesson-next').addEventListener('click', function () {
            if (cur.step < n - 1) cur.step++;
            else { cur.phase = 'quiz'; cur.quiz = { questions: L.buildQuiz(cur.id), index: 0, answers: [], revealed: false }; }
            rerender();
            global.scrollTo(0, 0);
          });
          return;
        }
        if (cur.phase === 'quiz') {
          box.innerHTML = '<div class="lesson-meta"><span class="tag tag-accent">Quiz et exercices</span><span class="tag">' + esc(lesson.title) + '</span></div><div id="quiz-host"></div>';
          UI.quiz($('quiz-host'), cur.quiz, {
            onAnswer: function (q, correct) { global.Stats.recordAnswer(q.theme, correct); },
            onChange: save,
            onFinish: function (res) {
              const passed = L.completeLesson(cur.id, res.pct);
              cur.phase = 'result';
              cur.result = { score: res.score, total: res.total, pct: res.pct, passed: passed };
              rerender();
            }
          });
          return;
        }
        // Résultat de la leçon
        const r = cur.result || { score: 0, total: 0, pct: 0, passed: false };
        const idx = lvl.lessons.map(function (l) { return l.id; }).indexOf(cur.id);
        const nextLesson = lvl.lessons[idx + 1];
        box.innerHTML = '<div class="quiz-result"><h2>' + esc(lesson.title) + '</h2><p class="quiz-score ' + (r.passed ? 'pass' : 'fail') + '">' + r.score + ' / ' + r.total + '</p>'
          + '<p>' + (r.passed ? 'Leçon validée. Bravo !' : 'Il faut au moins ' + L.LESSON_PASS + ' % de bonnes réponses pour valider la leçon. Relisez-la et retentez le quiz.') + '</p></div>'
          + App.correctionsHTML(cur.quiz)
          + '<div class="lesson-nav"><button type="button" class="btn btn-ghost" id="lesson-again">Relire la leçon</button><span>'
          + '<button type="button" class="btn btn-ghost" id="lesson-retry">Refaire le quiz</button> '
          + (r.passed ? (nextLesson ? '<button type="button" class="btn btn-accent" id="lesson-go-next">Leçon suivante ▶</button>'
            : '<button type="button" class="btn btn-accent" id="lesson-go-exam">Passer l\'examen du niveau ' + lvl.id + '</button>') : '')
          + '</span></div>';
        $('lesson-again').addEventListener('click', function () { cur.phase = 'read'; cur.step = 0; rerender(); });
        $('lesson-retry').addEventListener('click', function () { cur.phase = 'quiz'; cur.quiz = { questions: L.buildQuiz(cur.id), index: 0, answers: [], revealed: false }; rerender(); });
        if ($('lesson-go-next')) $('lesson-go-next').addEventListener('click', function () { App.openLesson(nextLesson.id); });
        if ($('lesson-go-exam')) $('lesson-go-exam').addEventListener('click', function () { App.openExam(lvl.id); });
        return;
      }

      /* ---------- Examen ---------- */
      const lvl = L.level(cur.id);
      if (!lvl) { S.state.ui.lesson = null; App.renderLessonContent(); return; }
      if (cur.phase === 'intro') {
        box.innerHTML = '<h2>Examen — ' + esc(lvl.title) + '</h2><p>10 questions tirées des leçons du niveau et d\'exercices pratiques. Il faut au moins <strong>' + L.EXAM_PASS + ' %</strong> de bonnes réponses pour valider le niveau'
          + (L.level(lvl.id + 1) ? ' et débloquer le niveau suivant.' : '.') + '</p>' + App.mistakesHTML(lvl.id)
          + '<button type="button" class="btn btn-accent" id="exam-start">Commencer l\'examen</button>';
        $('exam-start').addEventListener('click', function () { cur.phase = 'quiz'; cur.quiz = { questions: L.buildExam(cur.id), index: 0, answers: [], revealed: false }; rerender(); });
        return;
      }
      if (cur.phase === 'quiz') {
        box.innerHTML = '<div class="lesson-meta"><span class="tag tag-accent">Examen du niveau ' + lvl.id + '</span></div><div id="quiz-host"></div>';
        UI.quiz($('quiz-host'), cur.quiz, {
          onAnswer: function (q, correct) { global.Stats.recordAnswer(q.theme, correct); },
          onChange: save,
          onFinish: function (res) {
            const passed = L.completeExam(cur.id, res.pct);
            cur.phase = 'result';
            cur.result = { score: res.score, total: res.total, pct: res.pct, passed: passed };
            rerender();
            if (passed) UI.toast('Niveau ' + lvl.id + ' validé !', 'ok');
          }
        });
        return;
      }
      const r = cur.result || { score: 0, total: 0, pct: 0, passed: false };
      box.innerHTML = '<div class="quiz-result"><h2>Examen — ' + esc(lvl.title) + '</h2><p class="quiz-score ' + (r.passed ? 'pass' : 'fail') + '">' + r.score + ' / ' + r.total + '</p>'
        + '<p>' + (r.passed
          ? 'Niveau validé. ' + (L.isLevelUnlocked(lvl.id + 1) ? 'Le niveau ' + (lvl.id + 1) + ' est débloqué.' : 'Vous avez terminé le parcours : continuez à vous entraîner à la table, en tournoi et en mode Défi.')
          : 'Il faut ' + L.EXAM_PASS + ' % pour valider. Revoyez les leçons liées à vos erreurs, puis retentez.') + '</p></div>'
        + App.correctionsHTML(cur.quiz) + App.mistakesHTML(lvl.id)
        + '<div class="lesson-nav"><button type="button" class="btn btn-ghost" id="exam-retry">Repasser l\'examen</button>'
        + (r.passed && L.isLevelUnlocked(lvl.id + 1) ? '<button type="button" class="btn btn-accent" id="exam-next">Commencer le niveau ' + (lvl.id + 1) + ' ▶</button>' : '<button type="button" class="btn btn-accent" id="exam-play">Aller jouer ▶</button>') + '</div>';
      $('exam-retry').addEventListener('click', function () { cur.phase = 'intro'; rerender(); });
      if ($('exam-next')) $('exam-next').addEventListener('click', function () { App.openLesson(L.level(lvl.id + 1).lessons[0].id); });
      if ($('exam-play')) $('exam-play').addEventListener('click', function () { App.navigate('game'); });
    },

    /** Liste des questions ratées d'un quiz terminé. */
    correctionsHTML: function (quiz) {
      if (!quiz) return '';
      const wrong = [];
      quiz.questions.forEach(function (q, i) { if (quiz.answers[i] !== q.answer) wrong.push(q); });
      if (!wrong.length) return '<p class="center muted">Aucune erreur : sans faute.</p>';
      return '<h3>À retenir de vos erreurs</h3><ol class="correction-list">' + wrong.map(function (q) {
        return '<li>' + (q.context ? '<div>' + UI.rich(esc(q.context)) + '</div>' : '') + '<strong>' + esc(q.q) + '</strong><br>Bonne réponse : ' + esc(q.options[q.answer]) + '. ' + UI.rich(esc(q.explain)) + '</li>';
      }).join('') + '</ol>';
    },

    renderChallenges: function () {
      const ch = S.state.ui.challenge;
      const c = S.state.progress.challenges;
      $('challenge-themes').innerHTML = global.Challenges.THEMES.map(function (t) {
        return '<button type="button" class="btn btn-chip' + (ch && ch.theme === t.id ? ' active' : '') + '" data-ch="' + t.id + '">' + esc(t.label) + '</button>';
      }).join('');
      $('challenge-themes').querySelectorAll('[data-ch]').forEach(function (b) {
        b.addEventListener('click', function () { App.startChallenge(b.getAttribute('data-ch')); });
      });
      $('challenge-score').textContent = c.series
        ? 'Séries terminées : ' + c.series + ' — bonnes réponses : ' + c.correct + ' sur ' + c.played + ' (' + Math.round(100 * c.correct / Math.max(1, c.played)) + ' %)'
        : 'Aucune série terminée pour l\'instant.';
      const box = $('challenge-content');
      if (!ch) { box.innerHTML = '<p class="muted">Sélectionnez un thème pour lancer une série de ' + global.Challenges.SIZE + ' questions.</p>'; return; }
      const label = (global.Challenges.THEMES.filter(function (t) { return t.id === ch.theme; })[0] || {}).label || '';
      if (ch.result) {
        box.innerHTML = '<div class="quiz-result"><h2>Défi « ' + esc(label) + ' » terminé</h2><p class="quiz-score ' + (ch.result.pct >= 60 ? 'pass' : 'fail') + '">' + ch.result.score + ' / ' + ch.result.total + '</p></div>'
          + App.correctionsHTML(ch.quiz)
          + '<div class="lesson-nav"><button type="button" class="btn btn-accent" id="ch-again">Nouvelle série sur ce thème</button></div>';
        $('ch-again').addEventListener('click', function () { App.startChallenge(ch.theme); });
        return;
      }
      box.innerHTML = '<div class="lesson-meta"><span class="tag tag-accent">Défi</span><span class="tag">' + esc(label) + '</span></div><div id="ch-host"></div>';
      UI.quiz($('ch-host'), ch.quiz, {
        onAnswer: function (q, correct) { global.Stats.recordAnswer(q.theme, correct); },
        onChange: function () { S.commit('challenge'); },
        onFinish: function (res) {
          global.Challenges.finish(res.score, res.total);
          ch.result = { score: res.score, total: res.total, pct: res.pct };
          S.commit('challenge');
          App.renderChallenges();
        }
      });
    },

    startChallenge: function (theme) {
      S.state.ui.challenge = { theme: theme, quiz: { questions: global.Challenges.build(theme), index: 0, answers: [], revealed: false }, result: null };
      S.state.ui.learnTab = 'challenges';
      S.commit('challenge');
      if (App.view !== 'learn') App.navigate('learn'); else App.renderLearn();
    },

    renderGlossary: function () {
      const term = ($('glossary-search').value || '').trim().toLowerCase();
      const items = GLOSSARY.filter(function (g) { return !term || g[0].toLowerCase().indexOf(term) >= 0 || g[1].toLowerCase().indexOf(term) >= 0; });
      $('glossary-list').innerHTML = items.length
        ? items.map(function (g) { return '<dt>' + esc(g[0]) + '</dt><dd>' + esc(g[1]) + '</dd>'; }).join('')
        : '<dd class="muted">Aucun terme ne correspond à votre recherche.</dd>';
    },

    /* ===================== Jeu : configuration ===================== */
    readConfig: function () {
      const blinds = $('cfg-blinds').value.split('/');
      return G.normalizeConfig({
        mode: $('cfg-mode').value,
        freeroll: $('cfg-freeroll').checked,
        players: $('cfg-players').value,
        botLevel: $('cfg-bot-level').value,
        speed: $('cfg-speed').value,
        sb: parseInt(blinds[0], 10), bb: parseInt(blinds[1], 10),
        stackBB: $('cfg-stack').value,
        buyIn: $('cfg-buyin').value,
        hints: $('cfg-hints').checked,
        review: $('cfg-review').checked
      });
    },

    fillSetup: function () {
      const st = S.state.settings;
      const c = st.lastTableConfig || { mode: 'cash', freeroll: false, players: 6, botLevel: 'debutant', speed: st.speed, sb: 5, bb: 10, stackBB: 100, hints: st.hints, review: st.reviewAfterHand };
      $('cfg-mode').value = c.mode;
      $('cfg-players').value = String(c.players);
      $('cfg-bot-level').value = c.botLevel;
      $('cfg-speed').value = c.speed;
      $('cfg-blinds').value = c.sb + '/' + c.bb;
      if (!$('cfg-blinds').value) $('cfg-blinds').value = '5/10';
      $('cfg-stack').value = String(c.stackBB);
      $('cfg-hints').checked = !!c.hints;
      $('cfg-review').checked = !!c.review;
      $('cfg-freeroll').checked = !!c.freeroll;
      $('cfg-buyin').value = String(c.buyIn || 500);
      App.updateSetupSummary();
    },

    updateSetupSummary: function () {
      const learning = $('cfg-mode').value === 'learning';
      const tour = G.isTournamentMode($('cfg-mode').value);
      show($('field-buyin'), tour);
      show($('field-blinds'), !tour);
      show($('field-stack'), !tour);
      ['cfg-freeroll', 'cfg-hints', 'cfg-review'].forEach(function (id) {
        $(id).disabled = learning;
        if (learning) $(id).checked = true;
      });
      const c = App.readConfig();
      const buyIn = G.buyInFor(c);
      const bal = global.Bankroll.balance();
      $('cfg-summary').innerHTML = App.setupSummaryHTML(c, buyIn, bal);
      const lack = !c.freeroll && bal < buyIn;
      show($('cfg-error'), lack);
      if (lack) $('cfg-error').textContent = 'Bankroll insuffisante pour ce buy-in. Ajoutez de l\'argent virtuel dans l\'onglet Bankroll, choisissez un montant plus petit ou cochez Freeroll.';
      show($('btn-setup-resume'), G.isActive());
    },

    /** Texte récapitulatif de la partie qui va être lancée. */
    setupSummaryHTML: function (c, buyIn, bal) {
      const who = 'Vous affronterez <strong>' + (c.players - 1) + '</strong> adversaire(s) de niveau <strong>' + esc(global.Bots.levelLabel(c.botLevel)) + '</strong>. ';
      if (G.isTournamentMode(c.mode)) {
        const st = G.STRUCTURES[c.mode];
        const prizes = G.prizesFor(c);
        let html = who + '<strong>' + st.label + '</strong> : ' + fmt(st.startStack) + ' jetons chacun, blinds de départ ' + c.sb + '/' + c.bb + ', en hausse toutes les ' + st.handsPerLevel + ' mains. Pas de recave : un joueur sans jetons est éliminé. ';
        html += c.freeroll
          ? 'Entrée <strong>gratuite</strong> : aucun prix, votre bankroll n\'est pas touchée.'
          : 'Buy-in de <strong>' + fmt(buyIn) + '</strong> (solde : ' + fmt(bal) + '). Prix : ' + prizes.map(function (p, i) { return (i + 1) + (i === 0 ? 're' : 'e') + ' place <strong>' + fmt(p) + '</strong>'; }).join(', ') + '.';
        return html;
      }
      return who + 'Blinds <strong>' + c.sb + '/' + c.bb + '</strong>, stack de départ <strong>' + fmt(buyIn) + '</strong> jetons (' + c.stackBB + ' BB). '
        + (c.freeroll
          ? 'Entrée <strong>gratuite</strong> : votre bankroll n\'est pas touchée et les jetons de la table n\'y reviennent pas.'
          : 'Buy-in de <strong>' + fmt(buyIn) + '</strong> prélevé sur votre bankroll (solde : ' + fmt(bal) + '). Vous encaissez vos jetons en quittant la table.');
    },

    /** Affiche le bandeau et le résultat final d'un tournoi. */
    renderTournament: function () {
      const info = G.tournamentInfo();
      show($('table-tournament'), !!info);
      show($('table-icm'), !!info && info.icm !== null && !info.finished);
      const panel = $('tournament-panel');
      if (!info) { show(panel, false); return; }
      $('table-tournament').textContent = 'Niveau ' + info.level + ' · ' + info.remaining + '/' + info.total + ' joueurs'
        + (info.finished ? '' : info.lastLevel ? '' : ' · blinds ' + info.nextSb + '/' + info.nextBb + ' dans ' + info.handsToNext + ' main(s)');
      if (info.icm !== null) $('table-icm').textContent = 'Valeur ICM de votre stack ≈ ' + fmt(info.icm) + (info.paid ? ' · ' + info.paid + ' place(s) payée(s)' : '');
      show(panel, info.finished);
      if (!info.finished) return;
      const place = info.heroPlace;
      let html = '<p class="tour-headline">' + (place === 1 ? 'Victoire ! Vous remportez le tournoi.' : 'Tournoi terminé : vous finissez ' + place + 'e sur ' + info.total + '.') + '</p>'
        + '<p>' + (info.prize > 0 ? 'Prix crédité sur votre bankroll : <strong>' + fmt(info.prize) + '</strong> jetons.' : (info.prizes.length ? 'Vous terminez hors des places payées.' : 'Tournoi gratuit : aucun prix, bankroll inchangée.')) + '</p>'
        + '<div class="table-scroll"><table class="data-table"><thead><tr><th>Place</th><th>Joueur</th><th class="num">Prix</th></tr></thead><tbody>'
        + info.results.map(function (r) {
          return '<tr class="' + (r.isHero ? 'tour-me' : '') + '"><td>' + r.place + '</td><td>' + esc(r.isHero ? 'Vous' : r.name) + '</td><td class="num">' + (r.prize ? fmt(r.prize) : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        + (place > 1 && info.remaining > 1 ? '<p class="muted">La fin du tournoi a été jouée automatiquement entre les adversaires restants pour établir le classement.</p>' : '')
        + '<div class="detail-actions"><button type="button" class="btn btn-accent" id="tour-close">Terminer et revenir au menu</button></div>';
      panel.innerHTML = html;
      $('tour-close').addEventListener('click', function () { App.leaveTable(); });
    },

    startGame: function () {
      const cfg = App.readConfig();
      const go = function () {
        const r = G.create(cfg);
        if (!r.ok) { show($('cfg-error'), true); $('cfg-error').textContent = r.error; return; }
        App._analysisShownFor = null;
        App.renderGame();
        App.renderHeader();
      };
      if (!G.isActive()) { go(); return; }
      const g = G.state();
      UI.confirm('Quitter la table en cours ?', '<p>Une partie est en cours (blinds ' + g.table.sb + '/' + g.table.bb + '). Pour en démarrer une nouvelle, vous devez d\'abord la quitter'
        + (G.handInProgress() ? ' : <strong>la main en cours sera abandonnée</strong> et les jetons que vous y avez misés seront perdus.' : '.') + '</p>', 'Quitter et démarrer').then(function (yes) {
        if (!yes) return;
        App.leaveTable(true);
        go();
      });
    },

    leaveTable: function (silent) {
      const out = G.leaveTable();
      if (!out) return;
      if (out.tournament) {
        UI.toast(out.finished ? 'Tournoi terminé : ' + out.place + (out.place === 1 ? 're' : 'e') + ' place' + (out.prize ? ', ' + fmt(out.prize) + ' jetons gagnés.' : '.') : 'Tournoi abandonné : aucun prix.', out.prize ? 'ok' : 'warn');
      } else UI.toast(out.freeroll
        ? 'Table quittée (freeroll : bankroll inchangée). Résultat de la session : ' + signed(out.net) + ' jetons.'
        : 'Table quittée : ' + fmt(out.cashOut) + ' jetons encaissés. Résultat de la session : ' + signed(out.net) + '.', out.net >= 0 ? 'ok' : 'warn');
      App._analysisShownFor = null;
      App.renderHeader();
      if (!silent) App.renderGame();
    },

    /* ===================== Jeu : table ===================== */
    renderGame: function () {
      const g = G.state();
      const onTable = !!g && S.state.ui.gameScreen === 'table';
      show($('game-setup'), !onTable);
      show($('game-table'), onTable);
      if (!onTable) { App.fillSetup(); return; }
      App.renderTable();
    },

    renderTable: function () {
      const g = G.state();
      if (!g || App.view !== 'game' || S.state.ui.gameScreen !== 'table') return;
      const t = g.table, h = t.hand, hero = g.heroSeat;
      if (!h) return;
      const N = G.display.n;
      const synced = N >= h.actionCount && !G.busy;
      const over = t.phase === 'handOver';
      const res = h.result;
      const infos = h.order.map(function (s) { return { seat: s, stackStart: h.startStacks[s] }; });
      const st = UI.handStateAt(h.actions, infos, N);
      const names = {};
      t.seats.forEach(function (s) { names[s.seat] = s.name; });

      // Bandeau supérieur
      $('table-mode').textContent = MODE_LABEL[global.Stats.category(g.config)];
      $('table-blinds').textContent = 'Blinds ' + t.sb + '/' + t.bb;
      $('table-hand-number').textContent = 'Main n° ' + t.handNumber;
      $('table-bot-level').textContent = 'Adversaires : ' + global.Bots.levelLabel(g.config.botLevel);
      const hb = $('btn-toggle-hints');
      hb.textContent = 'Conseils : ' + (g.config.hints ? 'oui' : 'non');
      hb.setAttribute('aria-pressed', g.config.hints ? 'true' : 'false');
      hb.disabled = g.mode === 'learning';
      const rebuy = G.rebuyAmount();
      $('btn-rebuy').disabled = !(over && !G.busy && rebuy > 0);
      $('btn-rebuy').textContent = rebuy > 0 && over ? 'Recaver (+' + fmt(rebuy) + ')' : 'Recaver';
      show($('btn-rebuy'), !g.tournament);
      App.renderTournament();

      // Centre : pot, board
      $('pot-amount').textContent = fmt(st.pot);
      $('street-label').textContent = P.STREET_NAMES[st.street] || '';
      const showCards = G.display.showdown && res && !res.byFold;
      let highlight = {};
      if (showCards && synced && res.pots.length) {
        const w = res.pots[0].winners[0];
        const sd = res.showdown.filter(function (x) { return x.seat === w; })[0];
        if (sd) sd.best5.forEach(function (c) { highlight[c] = true; });
      }
      let boardHTML = '';
      for (let i = 0; i < 5; i++) {
        boardHTML += st.board[i] ? UI.card(st.board[i], highlight[st.board[i]] ? 'highlight' : '') : '<div class="card empty"></div>';
      }
      $('board').innerHTML = boardHTML;
      // Les pots annexes n'existent que lorsqu'un joueur encore en jeu est à tapis.
      const someAllIn = h.order.some(function (s) { return h.players[s].allIn && !h.players[s].folded; });
      const pots = !over && synced && someAllIn ? P.Engine.currentPots(t) : [];
      $('side-pots').innerHTML = pots.length > 1 ? pots.map(function (p, i) {
        return '<span class="side-pot">' + (i === 0 ? 'Principal' : 'Annexe ' + i) + ' : ' + fmt(p.amount) + '</span>';
      }).join('') : '';

      // Sièges
      const n = t.seats.length;
      let seatsHTML = '';
      t.seats.forEach(function (s, i) {
        const ang = Math.PI / 2 + i * 2 * Math.PI / n;
        const x = 50 + 50 * Math.cos(ang), y = 50 + 53 * Math.sin(ang);
        const inHand = h.order.indexOf(s.seat) >= 0;
        const p = st.seats[s.seat];
        const isHero = s.seat === hero;
        const stack = inHand ? p.stack : s.stack;
        const cls = ['seat'];
        if (isHero) cls.push('hero');
        if (!inHand) cls.push(g.tournament && s.stack === 0 ? 'eliminated' : 'out');
        if (inHand && p.folded) cls.push('folded');
        if (inHand && !p.folded && stack === 0 && !over) cls.push('allin');
        if (inHand && synced && !over && h.toAct === s.seat) cls.push('active');
        if (inHand && p.won > 0) cls.push('winner');
        let cards = '', handName = '';
        if (inHand) {
          if (isHero) {
            cards = h.holeCards[hero].map(function (c) { return UI.card(c, highlight[c] ? 'highlight' : ''); }).join('');
            if (!p.folded && st.board.length >= 3) handName = P.evaluate7(h.holeCards[hero].concat(st.board)).description;
          } else if (showCards && !p.folded) {
            const sd = res.showdown.filter(function (x) { return x.seat === s.seat; })[0];
            if (sd) { cards = sd.cards.map(function (c) { return UI.card(c, highlight[c] ? 'highlight' : ''); }).join(''); handName = sd.description; }
          } else if (!p.folded) cards = UI.card(null) + UI.card(null);
        }
        let bubble = '', bubbleCls = '';
        if (inHand && p.last) {
          const a = p.last;
          if (a.type === 'win') { bubble = '+' + fmt(p.won); bubbleCls = 'a-win'; }
          else if (a.allIn && a.type !== 'sb' && a.type !== 'bb') { bubble = 'Tapis'; bubbleCls = 'a-allin'; }
          else if (a.type !== 'sb' && a.type !== 'bb') { bubble = BUBBLES[a.type] || ''; bubbleCls = 'a-' + a.type; }
        }
        seatsHTML += '<div class="' + cls.join(' ') + '" style="--x:' + x.toFixed(2) + '%;--y:' + y.toFixed(2) + '%">'
          + '<div class="seat-cards">' + cards + '</div>'
          + '<div class="seat-plate"><span class="seat-pos">' + (inHand ? esc(h.positions[s.seat]) : '—') + '</span><span class="seat-name">' + esc(isHero ? (s.name === 'Vous' ? 'Vous' : s.name + ' (vous)') : s.name) + '</span>'
          + '<span class="seat-stack">' + (inHand && !p.folded && stack === 0 && !over ? 'Tapis' : (g.tournament && stack === 0 ? 'Éliminé' : fmt(stack))) + '</span></div>'
          + '<div class="seat-bet">' + (inHand && p.bet > 0 ? fmt(p.bet) : '') + '</div>'
          + '<div class="seat-hand-name">' + esc(handName) + '</div>'
          + (bubble ? '<div class="seat-action ' + bubbleCls + '">' + esc(bubble) + '</div>' : '')
          + (s.seat === h.buttonSeat ? '<span class="dealer-btn" title="Bouton (donneur)">D</span>' : '')
          + '</div>';
      });
      $('seats').innerHTML = seatsHTML;

      // Journal
      const log = $('action-log');
      log.innerHTML = UI.logHTML(h.actions, names, hero, N);
      log.scrollTop = log.scrollHeight;

      // Résultat de la main
      const resultBox = $('hand-result');
      if (over && synced && res) {
        const lines = [];
        res.pots.forEach(function (pot, i) {
          const label = res.pots.length > 1 ? (i === 0 ? 'Pot principal' : 'Pot annexe ' + i) + ' (' + fmt(pot.amount) + ') : ' : '';
          const who = pot.winners.map(function (w) { return w === hero ? 'vous' : names[w]; }).join(' et ');
          let how = '';
          if (res.byFold) how = ' — tous les autres joueurs se sont couchés';
          else { const sd = res.showdown.filter(function (x) { return x.seat === pot.winners[0]; })[0]; if (sd) how = ' avec ' + sd.description; }
          lines.push(label + (pot.winners.length > 1 ? 'partage entre ' + who : (pot.winners[0] === hero ? 'vous gagnez ' : who + ' gagne ') + fmt(pot.amount)) + how + '.');
        });
        const net = res.net[hero] || 0;
        resultBox.innerHTML = lines.map(function (l) { return esc(l.charAt(0).toUpperCase() + l.slice(1)); }).join('<br>') + '<br><strong>Votre résultat sur cette main : ' + signed(net) + '</strong>';
        resultBox.className = 'hand-result ' + (net > 0 ? 'won' : net < 0 ? 'lost' : '');
      } else resultBox.className = 'hand-result hidden';

      // Barres d'actions
      const myTurn = G.isHeroTurn();
      show($('action-bar'), myTurn);
      show($('hint-panel'), myTurn && g.config.hints);
      if (myTurn) { App.renderActionBar(); if (g.config.hints) App.renderHint(); }
      const tourDone = !!(g.tournament && g.tournament.finished);
      show($('handover-bar'), over && synced);
      show($('tournament-panel'), tourDone && over && synced);
      const wait = $('waiting-msg');
      if (over && synced && G.needsRebuy()) {
        show(wait, true);
        wait.textContent = 'Vous n\'avez plus de jetons. Recavez-vous (bouton « Recaver » en haut) ou quittez la table.';
        $('btn-next-hand').disabled = true;
      } else {
        $('btn-next-hand').disabled = tourDone;
        const botTurn = !over && !myTurn && h.toAct !== null && h.toAct !== hero && N >= h.actionCount;
        show(wait, botTurn);
        if (botTurn) wait.textContent = names[h.toAct] + ' réfléchit…';
      }
      if (!over) { show($('analysis-panel'), false); }
    },

    renderActionBar: function () {
      const g = G.state(), legal = G.legal(), view = G.heroView();
      const key = g.table.handNumber + ':' + g.table.hand.actionCount;
      if (App._betKey !== key) { App._betKey = key; App.betValue = legal.canRaise ? legal.minRaiseTo : 0; }
      show($('btn-fold'), !legal.canCheck);
      show($('btn-check'), legal.canCheck);
      show($('btn-call'), legal.canCall);
      $('btn-call').innerHTML = (legal.callIsAllIn ? 'Suivre à tapis' : 'Suivre') + '<small>' + fmt(legal.callAmount) + '</small>';
      show($('btn-bet'), legal.canRaise);
      show($('btn-allin'), legal.canAllIn && !legal.callIsAllIn);
      $('btn-allin').innerHTML = 'Tapis<small>' + fmt(legal.stack) + '</small>';
      $('bet-controls').classList.toggle('disabled', !legal.canRaise);
      if (legal.canRaise) {
        const slider = $('bet-slider'), input = $('bet-amount');
        slider.min = legal.minRaiseTo; slider.max = legal.maxRaiseTo; slider.step = 1;
        input.min = legal.minRaiseTo; input.max = legal.maxRaiseTo;
        App.setBet(App.betValue);
      }
      App._legal = legal;
      App._view = view;
    },

    /** Fixe le montant de mise (borné aux limites légales) et met l'affichage à jour. */
    setBet: function (value, fromInput) {
      const legal = G.legal();
      if (!legal || !legal.canRaise) return;
      let v = Math.round(Number(value));
      if (!isFinite(v)) v = legal.minRaiseTo;
      v = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, v));
      App.betValue = v;
      $('bet-slider').value = v;
      if (!fromInput) $('bet-amount').value = v;
      const allIn = v >= legal.maxRaiseTo;
      $('btn-bet').innerHTML = (allIn ? 'Tapis' : legal.isBet ? 'Miser' : 'Relancer à') + '<small>' + fmt(v) + '</small>';
    },

    applyPreset: function (preset) {
      const legal = G.legal(), view = G.heroView();
      if (!legal || !legal.canRaise || !view) return;
      if (preset === 'min') { App.setBet(legal.minRaiseTo); return; }
      const f = parseFloat(preset);
      const to = legal.isBet ? legal.streetBet + Math.round(f * legal.pot) : view.currentBet + Math.round(f * (legal.pot + legal.toCall));
      App.setBet(to);
    },

    renderHint: function () {
      const hint = G.currentHint();
      if (!hint) { show($('hint-panel'), false); return; }
      $('hint-title').textContent = 'Conseil : ' + hint.label;
      $('hint-body').innerHTML = '<ul>' + hint.why.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>'
        + '<div class="hint-figures">' + hint.figures.map(function (f) { return '<span class="tag">' + esc(f.label) + ' : ' + esc(f.value) + '</span>'; }).join('') + '</div>'
        + '<p class="hint-hyp">Hypothèses : ' + hint.hypotheses.map(esc).join(' ') + '</p>';
    },

    heroAct: function (action) {
      const r = G.heroAction(action);
      if (!r.ok) UI.toast(r.error, 'error');
    },

    showAnalysis: function () {
      const rec = G.lastRecord();
      const box = $('analysis-panel');
      if (!rec) { UI.toast('Aucune main à analyser.', 'warn'); return; }
      show(box, true);
      UI.analysis(box, rec);
      App._analysisShownFor = rec.id;
    },

    onHandOver: function () {
      App.renderHeader();
      App.renderTable();
      const g = G.state();
      if (!g || App.view !== 'game') return;
      const rec = G.lastRecord();
      if (g.config.review && rec && App._analysisShownFor !== rec.id) App.showAnalysis();
    },

    /* ===================== Statistiques ===================== */
    renderStats: function () {
      const f = S.state.ui.statsFilter || { mode: 'all', level: 'all' };
      $('stats-filter-mode').value = f.mode;
      $('stats-filter-level').value = f.level;
      const c = global.Stats.compute(f);
      const pr = L.progress();
      $('stats-level').textContent = 'Niveau ' + pr.level;
      $('stats-level-note').textContent = pr.text;
      $('stats-progress-bar').style.width = pr.pct + '%';
      $('stats-badges').innerHTML = global.Stats.badges().map(function (b) {
        return '<span class="badge' + (b.earned ? ' earned' : '') + (b.current ? ' current' : '') + '" title="' + esc(b.need) + '">' + (b.earned ? '★ ' : '☆ ') + esc(b.label) + '</span>';
      }).join('');

      const best = S.state.stats.bestHand;
      const tile = function (label, value, note, cls) {
        return '<div class="stat"><p class="stat-label">' + label + '</p><p class="stat-value ' + (cls || '') + '">' + value + '</p><p class="stat-note">' + (note || '') + '</p></div>';
      };
      $('stats-grid').innerHTML =
        tile('Mains jouées', fmt(c.hands), 'Mains terminées uniquement')
        + tile('Mains gagnées', pct(c.winRate), fmt(c.handsWon) + ' main(s)')
        + tile('VPIP', pct(c.vpip), 'Mains jouées volontairement')
        + tile('PFR', pct(c.pfr), 'Relances avant le flop')
        + tile('BB/100', num(c.bb100, 1), 'Grosses blinds pour 100 mains', signClass(c.bb100))
        + tile('ROI virtuel', c.roi === null ? '—' : num(c.roi, 1) + ' %', 'Net ÷ buy-ins (' + fmt(c.buyIns) + ')', signClass(c.roi))
        + tile('Résultat net', signed(c.netMoney), 'Argent virtuel, hors freeroll · ' + num(c.hands ? c.netBB : null, 1) + ' BB jouées', signClass(c.netMoney))
        + tile('Abattages gagnés', pct(c.showdownWinRate), fmt(c.showdowns) + ' abattage(s)')
        + tile('Meilleure main', best ? esc(P.CATEGORY_NAMES[best.category]) : '—', best ? '<span class="cards-inline">' + UI.cards(best.cards, 'sm') + '</span>' : 'Pas encore de main complète');

      const curve = S.state.stats.bbCurve.map(function (p) { return p.v; });
      const drawn = UI.lineChart($('stats-chart'), [0].concat(curve), { zero: true });
      show($('stats-chart-empty'), !drawn);
      show($('stats-chart').parentNode, drawn);

      const bars = [['Se coucher', c.foldPct, 'b-fold'], ['Parole', c.checkPct, 'b-check'], ['Suivre', c.callPct, 'b-call'], ['Miser / relancer', c.raisePct, 'b-raise'], ['Tapis', c.allinPct, 'b-allin']];
      $('stats-actions').innerHTML = c.totalActions ? bars.map(function (b) {
        return '<div class="bar-row"><span>' + b[0] + '</span><div class="bar-track"><div class="bar-fill ' + b[2] + '" style="width:' + (b[1] || 0).toFixed(1) + '%"></div></div><span class="bar-value">' + pct(b[1]) + '</span></div>';
      }).join('') : '<p class="muted">Aucune action enregistrée pour ce filtre.</p>';

      const errors = global.Stats.topErrors(6);
      $('stats-errors').innerHTML = errors.length ? errors.map(function (e) {
        return '<li><span>' + esc(e.label) + (e.lesson ? ' <button type="button" class="btn btn-chip" data-lesson="' + e.lesson + '">Revoir</button>' : '') + '</span><span class="rank-count">' + e.count + ' ×</span></li>';
      }).join('') : '<li class="muted">Aucune erreur relevée pour l\'instant. Elles apparaîtront ici au fil de vos mains.</li>';
      $('stats-errors').querySelectorAll('[data-lesson]').forEach(function (b) { b.addEventListener('click', function () { App.openLesson(b.getAttribute('data-lesson')); }); });

      const th = global.Stats.themes();
      const group = function (title, list, cls) {
        if (!list.length) return '';
        return '<div class="theme-group"><h3>' + title + '</h3><div class="chip-row">' + list.map(function (t) {
          return '<span class="tag ' + cls + '">' + esc(t.label) + ' · ' + t.correct + '/' + t.total + '</span>';
        }).join('') + '</div></div>';
      };
      $('stats-themes').innerHTML = (group('Thèmes maîtrisés', th.mastered, 'tag-ok') + group('Thèmes à revoir', th.review, 'tag-warn') + group('Thèmes commencés', th.started, ''))
        || '<p class="muted">Répondez à quelques quiz (leçons, défis, analyses) pour voir vos points forts et vos points faibles.</p>';

      App.renderAdvancedStats();

      const rows = global.Stats.breakdown();
      $('stats-breakdown').innerHTML = rows.length ? rows.map(function (r) {
        return '<tr><td>' + esc(r.label) + '</td><td class="num">' + fmt(r.hands) + '</td><td class="num">' + pct(r.won) + '</td><td class="num">' + pct(r.vpip) + '</td><td class="num">' + pct(r.pfr) + '</td>'
          + '<td class="num ' + signClass(r.bb100) + '">' + num(r.bb100, 1) + '</td><td class="num ' + signClass(r.net) + '">' + signed(r.net) + '</td></tr>';
      }).join('') : '<tr class="empty-row"><td colspan="7">Aucune main jouée.</td></tr>';

      const sessions = S.state.sessions.slice().reverse().slice(0, 50);
      $('stats-sessions').innerHTML = sessions.length ? sessions.map(function (s) {
        return '<tr><td>' + dateText(s.startedAt) + '</td><td>' + esc(MODE_LABEL[s.category] || s.mode) + (s.endedAt ? '' : ' <span class="tag tag-accent">en cours</span>') + '</td>'
          + '<td>' + (s.tournament ? 'buy-in ' + (s.freeroll ? 'gratuit' : fmt(s.buyIns)) + (s.place ? ' · ' + s.place + (s.place === 1 ? 're' : 'e') + ' place' : '') : s.sb + '/' + s.bb) + ' · ' + s.players + ' j. · ' + esc(global.Bots.levelLabel(s.botLevel)) + '</td><td class="num">' + s.hands + '</td>'
          + '<td class="num">' + (s.freeroll ? 'gratuit' : fmt(s.buyIns)) + '</td><td class="num">' + (s.endedAt ? (s.freeroll ? '—' : fmt(s.cashOut)) : '…') + '</td>'
          + '<td class="num ' + signClass(s.net) + '">' + signed(s.net) + '</td></tr>';
      }).join('') : '<tr class="empty-row"><td colspan="7">Aucune session pour l\'instant.</td></tr>';
    },

    /** Diagnostic du jeu et graphiques avancés (position, abattage, mains de départ). */
    renderAdvancedStats: function () {
      $('stats-diagnosis').innerHTML = global.Stats.diagnosis().map(function (d) {
        return '<li class="d-' + d.level + '"><strong>' + esc(d.title) + '</strong>' + esc(d.text)
          + (d.lesson && L.get(d.lesson) ? '<br><button type="button" class="btn btn-chip" data-lesson="' + d.lesson + '">Leçon : ' + esc(L.get(d.lesson).title) + '</button>' : '') + '</li>';
      }).join('');
      $('stats-diagnosis').querySelectorAll('[data-lesson]').forEach(function (b) {
        b.addEventListener('click', function () { App.openLesson(b.getAttribute('data-lesson')); });
      });

      const adv = global.Stats.advanced();
      $('stats-advanced-note').textContent = adv.count
        ? 'Calculés sur vos ' + adv.count + ' dernières mains détaillées (tous modes confondus).'
        : 'Ces graphiques apparaîtront dès vos premières mains.';
      UI.barChart($('stats-chart-position'), adv.positions.map(function (p) {
        return { label: p.label, value: Math.round(p.bb100), sub: p.hands + ' m.', note: p.label + ' : ' + num(p.bb100, 1) + ' BB/100 sur ' + p.hands + ' main(s), VPIP ' + pct(p.vpip) };
      }));
      UI.lineChart($('stats-chart-lines'), adv.lines.total, {
        zero: true,
        extra: [{ values: adv.lines.showdown, cls: 'line-sd' }, { values: adv.lines.noShowdown, cls: 'line-nsd' }]
      });

      // Grille 13 × 13 des mains de départ, colorée selon le résultat moyen.
      const R = 'AKQJT98765432';
      let html = '';
      for (let i = 0; i < 13; i++) {
        for (let j = 0; j < 13; j++) {
          const key = R[Math.min(i, j)] + R[Math.max(i, j)] + (i === j ? '' : i < j ? 's' : 'o');
          const cell = adv.grid[key];
          if (!cell) { html += '<span class="heat-cell" title="' + key + ' : jamais reçue">' + key + '</span>'; continue; }
          const avg = cell.bb / cell.n;
          const k = Math.min(1, Math.abs(avg) / 8);
          const color = avg >= 0 ? 'rgba(47,165,108,' + (0.25 + 0.75 * k).toFixed(2) + ')' : 'rgba(217,81,81,' + (0.25 + 0.75 * k).toFixed(2) + ')';
          html += '<span class="heat-cell played" style="background:' + color + '" title="' + key + ' : ' + cell.n + ' fois, ' + num(avg, 1) + ' BB par main en moyenne">' + key + '</span>';
        }
      }
      $('stats-heat').innerHTML = html;
    },

    /* ===================== Bankroll ===================== */
    renderBankroll: function () {
      const sum = global.Bankroll.summary();
      $('bankroll-balance').textContent = fmt(sum.balance);
      $('bankroll-on-table').textContent = sum.onTable ? 'Plus ' + fmt(sum.onTable) + ' jetons actuellement en table.' : '';
      $('bankroll-alerts').innerHTML = global.Bankroll.alerts().map(function (a) {
        return '<div class="alert alert-' + (a.level === 'danger' ? 'danger' : a.level === 'info' ? 'info' : 'warn') + '">' + esc(a.text) + '</div>';
      }).join('');
      const tile = function (label, value, note, cls) {
        return '<div class="stat"><p class="stat-label">' + label + '</p><p class="stat-value ' + (cls || '') + '">' + value + '</p><p class="stat-note">' + note + '</p></div>';
      };
      $('bankroll-summary').innerHTML =
        tile('Solde initial', fmt(sum.initial), 'Bankroll de départ')
        + tile('Dépôts virtuels', fmt(sum.deposits), sum.depositCount + ' dépôt(s)')
        + tile('Buy-ins et recaves', fmt(sum.buyIns), 'Jetons apportés aux tables')
        + tile('Cash-outs', fmt(sum.cashOuts), 'Jetons repris des tables')
        + tile('Résultat net de jeu', signed(sum.net), 'Gains et pertes, hors dépôts', signClass(sum.net));
      const curve = S.state.stats.bankrollCurve.map(function (p) { return p.v; });
      UI.lineChart($('bankroll-chart'), [sum.initial].concat(curve), {});
      const tx = S.state.bankroll.transactions.slice().reverse().slice(0, 100);
      $('bankroll-transactions').innerHTML = tx.length ? tx.map(function (t) {
        return '<tr><td>' + dateText(t.ts) + '</td><td>' + esc(global.Bankroll.TYPE_LABELS[t.type] || t.type) + '</td><td>' + esc(t.note) + '</td>'
          + '<td class="num ' + signClass(t.amount) + '">' + signed(t.amount) + '</td><td class="num">' + fmt(t.balanceAfter) + '</td></tr>';
      }).join('') : '<tr class="empty-row"><td colspan="5">Aucun mouvement pour l\'instant.</td></tr>';
    },

    deposit: function (amount) {
      const r = global.Bankroll.deposit(amount);
      show($('deposit-error'), !r.ok);
      if (!r.ok) { $('deposit-error').textContent = r.error; return; }
      $('deposit-amount').value = '';
      UI.toast(fmt(amount) + ' jetons virtuels ajoutés à votre bankroll.', 'ok');
      App.renderHeader();
      App.renderBankroll();
    },

    /* ===================== Historique ===================== */
    renderHistory: function () {
      const filter = $('history-filter').value;
      const hands = S.state.hands.slice().reverse().filter(function (h) {
        if (filter === 'won') return h.heroNet > 0;
        if (filter === 'lost') return h.heroNet < 0;
        if (filter === 'showdown') return h.flags.showdown;
        if (filter === 'played') return h.flags.vpip;
        return true;
      });
      show($('history-empty'), hands.length === 0);
      const list = $('history-list');
      list.innerHTML = hands.map(function (h) {
        return '<li><button type="button" class="history-item' + (h.id === App._historyId ? ' current' : '') + '" data-hand="' + h.id + '">'
          + '<span class="history-cards">' + UI.cards(h.heroCards, 'sm') + '</span>'
          + '<span class="history-meta">Main n° ' + h.number + ' · ' + esc(h.heroPosition) + ' · ' + h.sb + '/' + h.bb + '<small>' + dateText(h.ts) + ' · ' + esc(MODE_LABEL[h.category] || '') + (h.flags.showdown ? ' · abattage' : '') + '</small></span>'
          + '<span class="history-net ' + signClass(h.heroNet) + '">' + signed(h.heroNet) + '</span></button></li>';
      }).join('');
      list.querySelectorAll('[data-hand]').forEach(function (b) {
        b.addEventListener('click', function () { App._historyId = b.getAttribute('data-hand'); App.renderHistory(); });
      });
      const rec = S.state.hands.filter(function (h) { return h.id === App._historyId; })[0];
      const box = $('history-detail');
      if (!rec) { box.innerHTML = '<p class="muted">Sélectionnez une main pour voir son déroulement, la rejouer ou l\'analyser.</p>'; return; }
      const names = {};
      rec.seats.forEach(function (s) { names[s.seat] = s.name; });
      let html = '<h2>Main n° ' + rec.number + ' <span class="tag ' + (rec.heroNet > 0 ? 'tag-ok' : rec.heroNet < 0 ? 'tag-danger' : '') + '">' + signed(rec.heroNet) + '</span></h2>'
        + '<p class="muted">' + dateText(rec.ts) + ' · ' + esc(MODE_LABEL[rec.category] || '') + ' · blinds ' + rec.sb + '/' + rec.bb + ' · ' + rec.players + ' joueurs · adversaires ' + esc(global.Bots.levelLabel(rec.botLevel)) + ' · vous étiez ' + esc(rec.heroPosition) + '</p>'
        + '<div class="card-row"><span class="card-row-label">Vos cartes</span>' + UI.cards(rec.heroCards) + '</div>'
        + '<div class="card-row"><span class="card-row-label">Board</span>' + (rec.board.length ? UI.cards(rec.board) : '<span class="muted">aucune carte commune</span>') + '</div>'
        + '<div class="detail-actions"><button type="button" class="btn btn-primary" id="hist-analyze">Analyser ma main</button><button type="button" class="btn btn-ghost" id="hist-replay">Rejouer la main</button></div>';
      if (rec.showdown.length) {
        html += '<h3>Abattage</h3><ul class="showdown-list">' + rec.showdown.map(function (sd) {
          const won = rec.pots.some(function (p) { return p.winners.indexOf(sd.seat) >= 0; });
          return '<li><strong>' + esc(sd.seat === rec.heroSeat ? 'Vous' : names[sd.seat]) + '</strong> <span class="cards-inline">' + UI.cards(sd.cards, 'sm') + '</span> ' + esc(sd.description) + (won ? ' <span class="tag tag-ok">gagne</span>' : '') + '</li>';
        }).join('') + '</ul>';
      } else html += '<p class="muted">Pas d\'abattage : la main s\'est terminée quand tous les joueurs sauf un se sont couchés.</p>';
      html += '<h3>Déroulement</h3><ol class="action-log">' + UI.logHTML(rec.actions, names, rec.heroSeat, Infinity) + '</ol><div id="hist-analysis"></div>';
      box.innerHTML = html;
      $('hist-replay').addEventListener('click', function () { UI.replay(rec); });
      $('hist-analyze').addEventListener('click', function () {
        const host = $('hist-analysis');
        host.className = 'panel analysis-panel';
        UI.analysis(host, rec);
        host.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },

    /* ===================== Réglages ===================== */
    renderSettings: function () {
      App.renderSync();
      const st = S.state.settings;
      $('set-name').value = S.state.profile.name || '';
      $('set-speed').value = st.speed;
      $('set-initial-bankroll').value = st.initialBankroll;
      $('set-hints').checked = !!st.hints;
      $('set-review').checked = !!st.reviewAfterHand;
      $('set-four-colors').checked = !!st.fourColors;
      $('storage-info').textContent = S.memoryOnly
        ? 'Attention : votre navigateur bloque l\'enregistrement local. Utilisez l\'export pour conserver votre progression.'
        : 'Taille actuelle de la sauvegarde : environ ' + S.sizeKB() + ' ko · ' + S.state.hands.length + ' main(s) détaillée(s) en mémoire.';
    },

    exportSave: function () {
      try {
        S.flush();
        const blob = new global.Blob([S.exportJSON()], { type: 'application/json' });
        const url = global.URL.createObjectURL(blob);
        const a = doc.createElement('a');
        a.href = url;
        a.download = 'poker-academie-' + new Date().toISOString().slice(0, 10) + '.json';
        doc.body.appendChild(a);
        a.click();
        doc.body.removeChild(a);
        global.setTimeout(function () { global.URL.revokeObjectURL(url); }, 2000);
        UI.toast('Sauvegarde exportée.', 'ok');
      } catch (e) { UI.toast('Export impossible dans ce navigateur.', 'error'); }
    },

    importSave: function (file) {
      if (!file) return;
      const reader = new global.FileReader();
      reader.onerror = function () { UI.toast('Lecture du fichier impossible.', 'error'); };
      reader.onload = function () {
        const r = S.parseImport(String(reader.result || ''));
        if (!r.ok) { UI.modal({ title: 'Import impossible', html: '<p>' + esc(r.error) + '</p><p class="muted">Votre progression actuelle n\'a pas été modifiée.</p>', actions: [{ label: 'Fermer' }] }); return; }
        let html = '<p>Cette sauvegarde contient <strong>' + fmt(r.state.stats.global.hands) + '</strong> main(s) jouée(s) et une bankroll de <strong>' + fmt(r.state.bankroll.balance) + '</strong>.</p>'
          + '<p><strong>Elle remplacera toute votre progression actuelle.</strong></p>';
        if (r.problems.length) html += '<div class="alert">Certaines parties du fichier sont illisibles et seront remises à zéro : ' + esc(r.problems.join(', ')) + '.</div>';
        UI.confirm('Importer cette sauvegarde ?', html, 'Remplacer ma progression', true).then(function (yes) {
          if (!yes) return;
          G.pause();
          S.importState(r.state);
          App.afterStateReplaced();
          UI.toast('Sauvegarde importée.', 'ok');
        });
      };
      reader.readAsText(file);
    },

    resetProgress: function () {
      UI.confirm('Réinitialiser ma progression ?', '<p>Vous allez effacer vos leçons validées, vos statistiques, votre historique, votre bankroll et la partie en cours.</p><p class="muted">Vos réglages sont conservés. Pensez à exporter votre sauvegarde avant, si vous voulez pouvoir revenir en arrière.</p>' + (global.Sync.enabled() ? '<p><strong>La synchronisation est active : la copie en ligne et vos autres appareils seront remis à zéro eux aussi.</strong></p>' : ''), 'Continuer', true)
        .then(function (yes) {
          if (!yes) return false;
          return UI.confirm('Dernière confirmation', '<p><strong>Cette action est définitive.</strong> Confirmez-vous l\'effacement complet de votre progression ?</p>', 'Oui, tout effacer', true);
        }).then(function (yes) {
          if (!yes) return;
          G.pause();
          S.reset();
          App._historyId = null;
          App.afterStateReplaced('home');
          UI.toast('Progression réinitialisée.', 'ok');
        });
    },

    /** Après un import, une restauration ou une remise à zéro : tout réafficher. */
    afterStateReplaced: function (view) {
      App._analysisShownFor = null;
      App._betKey = null;
      App.navigate(view || S.state.ui.view || 'home');
      if (G.isActive()) G.resume();
    },

    /* ===================== Synchronisation ===================== */
    _lastSyncCheck: 0,

    renderSync: function () {
      const Y = global.Sync, on = Y.enabled();
      const badge = $('sync-badge');
      show(badge, on);
      badge.setAttribute('data-status', Y.status);
      badge.textContent = Y.status === 'error' ? 'Synchro en échec' : Y.status === 'ok' ? 'Synchronisé' : Y.status === 'pending' ? 'Envoi en attente' : 'Synchro…';
      badge.title = Y.message || 'Synchronisation entre appareils';
      show($('sync-off'), !on);
      show($('sync-on'), on);
      $('sync-state').textContent = !on ? 'Synchronisation désactivée sur cet appareil.'
        : Y.status === 'error' ? 'Activée, mais le dernier envoi a échoué : ' + Y.message
          : 'Activée. ' + (Y.meta.syncedAt ? 'Dernière synchronisation : ' + dateText(Y.meta.syncedAt) + '.' : '');
    },

    /** Remplace la progression locale par une sauvegarde reçue de GitHub. */
    applyRemote: function (text, updatedAt) {
      const r = S.parseImport(text);
      if (!r.ok) { UI.toast('La sauvegarde en ligne est illisible : ' + r.error, 'error'); return false; }
      global.Sync.applying = true;
      G.pause();
      S.importState(r.state);
      global.Sync.applying = false;
      global.Sync.markAdopted(updatedAt);
      App._historyId = null;
      App.afterStateReplaced();
      return true;
    },

    /** Résumé d'une sauvegarde, pour aider à choisir en cas de conflit. */
    saveSummary: function (state) {
      return fmt(state.stats.global.hands) + ' main(s) jouée(s), niveau ' + (state.progress.level || 1) + ', bankroll ' + fmt(state.bankroll.balance);
    },

    /** Demande quelle version garder quand les deux ont changé. Renvoie une promesse. */
    resolveConflict: function (remote, intro) {
      const r = S.parseImport(remote.text);
      if (!r.ok) return global.Sync.push();
      return UI.modal({
        title: 'Deux versions de votre progression',
        html: '<p>' + intro + '</p>'
          + '<p><strong>En ligne</strong> (enregistrée le ' + dateText(Date.parse(remote.updatedAt)) + ') : ' + esc(App.saveSummary(r.state)) + '.</p>'
          + '<p><strong>Sur cet appareil</strong> : ' + esc(App.saveSummary(S.state)) + '.</p>'
          + '<p class="muted">La version non retenue sera remplacée. En cas de doute, fermez cette fenêtre et exportez d\'abord votre sauvegarde depuis les Réglages.</p>',
        actions: [{ label: 'Garder la version en ligne', cls: 'btn-primary', value: 'remote' }, { label: 'Garder celle de cet appareil', cls: 'btn-accent', value: 'local' }],
        dismissValue: null
      }).then(function (choice) {
        if (choice === 'remote') { if (App.applyRemote(remote.text, remote.updatedAt)) UI.toast('Progression en ligne chargée.', 'ok'); }
        else if (choice === 'local') { global.Sync.meta.remoteAt = remote.updatedAt; return global.Sync.push().then(function (ok) { if (ok) UI.toast('Progression de cet appareil envoyée.', 'ok'); }); }
        else UI.toast('Synchronisation en pause : choisissez une version depuis Réglages → Synchroniser maintenant.', 'warn');
      });
    },

    /** Active la synchronisation avec la clé saisie. */
    syncConnect: function () {
      const btn = $('btn-sync-connect');
      show($('sync-error'), false);
      btn.disabled = true;
      global.Sync.connect($('sync-token').value).then(function (res) {
        $('sync-token').value = '';
        btn.disabled = false;
        App.renderSync();
        if (res.created || !res.remote || !res.remote.text) {
          if (!res.created) global.Sync.push();
          UI.toast('Synchronisation activée : votre progression a été envoyée.', 'ok');
          return;
        }
        // Une sauvegarde existe déjà en ligne.
        const local = S.state.stats.global.hands > 0 || Object.keys(S.state.progress.lessons).length > 0 || S.state.bankroll.transactions.length > 0;
        if (!local) {
          if (App.applyRemote(res.remote.text, res.remote.updatedAt)) UI.toast('Synchronisation activée : progression récupérée.', 'ok');
          return;
        }
        return App.resolveConflict(res.remote, 'Une sauvegarde existe déjà sur votre compte GitHub, et cet appareil a aussi une progression. Laquelle voulez-vous garder ?');
      }).catch(function (e) {
        btn.disabled = false;
        show($('sync-error'), true);
        $('sync-error').textContent = e.message;
        App.renderSync();
      });
    },

    /** Vérifie si un autre appareil a enregistré une version plus récente. */
    syncCheck: function (manual) {
      const Y = global.Sync;
      if (!Y.enabled()) return;
      const now = Date.now();
      if (!manual && now - App._lastSyncCheck < 20000) return;
      App._lastSyncCheck = now;
      Y.check().then(function (r) {
        if (r.state === 'remote') {
          if (r.conflict) return App.resolveConflict(r, 'Votre progression a été modifiée sur un autre appareil, et cet appareil a aussi des changements qui n\'avaient pas encore été envoyés.');
          if (App.applyRemote(r.text, r.updatedAt)) UI.toast('Progression récupérée depuis votre autre appareil.', 'ok');
        } else if (manual) {
          if (r.state === 'error') UI.toast(r.error, 'error');
          else Y.push().then(function (ok) { UI.toast(ok ? 'Synchronisation terminée.' : 'Synchronisation en échec : ' + Y.message, ok ? 'ok' : 'error'); });
        }
      });
    },

    /* ===================== Sauvegarde abîmée ===================== */
    handleCorruption: function (r) {
      const backup = r.hasBackup ? S.backupCandidate() : null;
      let html = '<p>Votre sauvegarde est abîmée' + (r.kind === 'json' ? ' : le fichier enregistré dans ce navigateur est illisible.' : ' : certaines parties sont illisibles.') + '</p>';
      const actions = [];
      if (r.candidate) {
        html += '<p><strong>Restauration partielle</strong> : tout ce qui est lisible est conservé ; seront remis à zéro : ' + esc(r.problems.join(', ')) + '.</p>';
        actions.push({ label: 'Restauration partielle', cls: 'btn-accent', value: 'partial' });
      }
      if (backup) {
        html += '<p><strong>Dernière sauvegarde valide</strong> : état enregistré lors d\'un précédent démarrage réussi (' + fmt(backup.stats.global.hands) + ' main(s), bankroll ' + fmt(backup.bankroll.balance) + ').</p>';
        actions.push({ label: 'Restaurer la dernière sauvegarde valide', cls: 'btn-primary', value: 'backup' });
      }
      html += '<p class="muted">Rien n\'est effacé tant que vous n\'avez pas choisi.</p>';
      actions.push({ label: 'Tout réinitialiser', cls: 'btn-danger', value: 'reset' });
      return UI.modal({ title: 'Sauvegarde abîmée', html: html, actions: actions, dismissValue: null }).then(function (choice) {
        if (choice === 'partial') { S.applyRecovery(r.candidate); return true; }
        if (choice === 'backup') { S.applyRecovery(backup); return true; }
        if (choice === 'reset') {
          return UI.confirm('Tout réinitialiser ?', '<p>Toute la progression enregistrée dans ce navigateur sera effacée. Cette action est définitive.</p>', 'Oui, repartir de zéro', true)
            .then(function (yes) { if (yes) { S.applyRecovery(null); return true; } return App.handleCorruption(r); });
        }
        return App.handleCorruption(r);   // fenêtre fermée sans choix : on redemande
      });
    },

    /* ===================== Événements ===================== */
    bind: function () {
      doc.querySelectorAll('.nav-btn').forEach(function (b) {
        b.addEventListener('click', function () { App.navigate(b.getAttribute('data-view')); });
      });
      $('modal-close').addEventListener('click', function () { UI.closeModal(); });
      $('modal-overlay').addEventListener('click', function (e) { if (e.target === $('modal-overlay')) UI.closeModal(); });
      doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') UI.closeModal(); });

      // Accueil
      $('btn-new-game').addEventListener('click', function () { S.state.ui.gameScreen = 'setup'; App.navigate('game'); });
      $('btn-resume-game').addEventListener('click', function () { S.state.ui.gameScreen = 'table'; App.navigate('game'); });
      $('btn-home-learn').addEventListener('click', function () {
        const next = L.nextLessonId();
        if (next) App.openLesson(next); else { S.state.ui.learnTab = 'lessons'; S.state.ui.lesson = null; App.navigate('learn'); }
      });
      $('btn-home-challenge').addEventListener('click', function () { App.startChallenge('mixte'); });

      // Apprentissage
      doc.querySelectorAll('[data-learn-tab]').forEach(function (b) {
        b.addEventListener('click', function () { App.setLearnTab(b.getAttribute('data-learn-tab')); });
      });
      $('glossary-search').addEventListener('input', App.renderGlossary);

      // Configuration de partie
      ['cfg-mode', 'cfg-players', 'cfg-bot-level', 'cfg-speed', 'cfg-blinds', 'cfg-stack', 'cfg-hints', 'cfg-review', 'cfg-freeroll'].forEach(function (id) {
        $(id).addEventListener('change', App.updateSetupSummary);
      });
      $('setup-form').addEventListener('submit', function (e) { e.preventDefault(); App.startGame(); });
      $('btn-setup-resume').addEventListener('click', function () { S.state.ui.gameScreen = 'table'; S.commit('nav'); App.renderGame(); });

      // Table
      $('btn-fold').addEventListener('click', function () { App.heroAct({ type: 'fold' }); });
      $('btn-check').addEventListener('click', function () { App.heroAct({ type: 'check' }); });
      $('btn-call').addEventListener('click', function () { App.heroAct({ type: 'call' }); });
      $('btn-bet').addEventListener('click', function () { App.heroAct({ type: 'raise', amount: App.betValue }); });
      $('btn-allin').addEventListener('click', function () { App.heroAct({ type: 'allin' }); });
      $('bet-slider').addEventListener('input', function () { App.setBet($('bet-slider').value); });
      $('bet-amount').addEventListener('input', function () { if ($('bet-amount').value !== '') App.setBet($('bet-amount').value, true); });
      $('bet-amount').addEventListener('change', function () { App.setBet($('bet-amount').value); });
      doc.querySelectorAll('.bet-preset').forEach(function (b) {
        b.addEventListener('click', function () { App.applyPreset(b.getAttribute('data-preset')); });
      });
      $('btn-next-hand').addEventListener('click', function () {
        const r = G.nextHand();
        if (!r.ok) UI.toast(r.error, 'warn');
        else { show($('analysis-panel'), false); global.scrollTo(0, 0); }
      });
      $('btn-analyze').addEventListener('click', function () { App.showAnalysis(); $('analysis-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      $('btn-replay').addEventListener('click', function () { const rec = G.lastRecord(); if (rec) UI.replay(rec); else UI.toast('Aucune main à rejouer.', 'warn'); });
      $('btn-toggle-hints').addEventListener('click', function () { const g = G.state(); if (g) G.setHints(!g.config.hints); });
      $('btn-rebuy').addEventListener('click', function () {
        const r = G.rebuy();
        if (!r.ok) { UI.toast(r.error, 'warn'); return; }
        UI.toast('Recave de ' + fmt(r.amount) + ' jetons.', 'ok');
        App.renderHeader();
        App.renderTable();
      });
      $('btn-leave-table').addEventListener('click', function () {
        const g = G.state();
        if (!g) return;
        const mid = G.handInProgress();
        const stack = g.table.seats[g.heroSeat].stack;
        UI.confirm('Quitter la table ?', '<p>' + (g.tournament ? (g.tournament.finished ? 'Le tournoi est terminé.' : '<strong>Abandonner le tournoi</strong> : vos jetons ne peuvent pas être encaissés et vous ne recevrez aucun prix.') : g.freeroll ? 'Table gratuite : votre bankroll ne changera pas.' : 'Vous encaisserez <strong>' + fmt(stack) + '</strong> jetons dans votre bankroll.') + '</p>'
          + (mid ? '<p><strong>Une main est en cours</strong> : elle sera abandonnée et les jetons que vous y avez déjà misés seront perdus. Mieux vaut attendre la fin de la main.</p>' : ''), 'Quitter la table', mid)
          .then(function (yes) { if (yes) App.leaveTable(); });
      });

      // Statistiques, bankroll, historique
      ['stats-filter-mode', 'stats-filter-level'].forEach(function (id) {
        $(id).addEventListener('change', function () {
          S.state.ui.statsFilter = { mode: $('stats-filter-mode').value, level: $('stats-filter-level').value };
          S.commit('filter');
          App.renderStats();
        });
      });
      doc.querySelectorAll('.deposit-quick').forEach(function (b) {
        b.addEventListener('click', function () { App.deposit(parseInt(b.getAttribute('data-amount'), 10)); });
      });
      $('deposit-form').addEventListener('submit', function (e) { e.preventDefault(); App.deposit(Number($('deposit-amount').value)); });
      $('history-filter').addEventListener('change', App.renderHistory);

      // Réglages
      $('set-name').addEventListener('change', function () {
        S.state.profile.name = $('set-name').value.trim().slice(0, 20);
        G.setHeroName(S.state.profile.name);
        S.commit('settings');
      });
      $('set-speed').addEventListener('change', function () { S.state.settings.speed = $('set-speed').value; S.commit('settings'); });
      $('set-initial-bankroll').addEventListener('change', function () {
        const v = Math.floor(Number($('set-initial-bankroll').value));
        if (!(v >= 100 && v <= 10000000)) { UI.toast('La bankroll initiale doit être comprise entre 100 et 10 000 000.', 'warn'); $('set-initial-bankroll').value = S.state.settings.initialBankroll; return; }
        S.state.settings.initialBankroll = v;
        S.commit('settings');
      });
      $('set-hints').addEventListener('change', function () { S.state.settings.hints = $('set-hints').checked; S.commit('settings'); });
      $('set-review').addEventListener('change', function () { S.state.settings.reviewAfterHand = $('set-review').checked; S.commit('settings'); });
      $('set-four-colors').addEventListener('change', function () { S.state.settings.fourColors = $('set-four-colors').checked; S.commit('settings'); App.renderHeader(); });
      $('btn-export').addEventListener('click', App.exportSave);
      $('btn-import').addEventListener('click', function () { $('import-file').value = ''; $('import-file').click(); });
      $('import-file').addEventListener('change', function () { App.importSave($('import-file').files[0]); });
      $('btn-run-tests').addEventListener('click', function () {
        const out = $('tests-output');
        show(out, true);
        out.textContent = 'Tests en cours…';
        global.setTimeout(function () { out.textContent = global.PokerTests.run(true).text; }, 30);
      });
      $('btn-reset-progress').addEventListener('click', App.resetProgress);

      // Synchronisation entre appareils
      $('btn-sync-connect').addEventListener('click', App.syncConnect);
      $('btn-sync-now').addEventListener('click', function () { App.syncCheck(true); });
      $('btn-sync-disconnect').addEventListener('click', function () {
        UI.confirm('Désactiver la synchronisation ?', '<p>La clé sera oubliée sur cet appareil. Votre progression reste ici et la copie en ligne est conservée sur GitHub.</p>', 'Désactiver').then(function (yes) {
          if (!yes) return;
          global.Sync.disconnect();
          App.renderSync();
        });
      });
      S.onWrite(function () { global.Sync.schedule(); });
      global.Sync.onStatus(function () { App.renderSync(); });

      // Sauvegarde à la fermeture ou à la mise en arrière-plan
      global.addEventListener('beforeunload', function () { S.flush(); });
      global.addEventListener('pagehide', function () { S.flush(); });
      doc.addEventListener('visibilitychange', function () {
        if (doc.visibilityState === 'hidden') { S.flush(); if (global.Sync.meta.pending) global.Sync.push(); }
        else App.syncCheck(false);   // retour sur la page : un autre appareil a peut-être joué entre-temps
      });

      // Événements du jeu
      G.on('update', function () { App.renderTable(); });
      G.on('heroTurn', function () { App.renderTable(); });
      G.on('handOver', App.onHandOver);
      G.on('level', function (l) { UI.toast('Les blinds montent : ' + l.sb + '/' + l.bb + ' (niveau ' + (l.level + 1) + ').', 'warn'); });
      $('cfg-buyin').addEventListener('change', App.updateSetupSummary);

      // Indicateur de sauvegarde
      S.onStatus(function (status, message) {
        $('save-status').setAttribute('data-status', status);
        $('save-status-text').textContent = message || (status === 'saved' ? 'Sauvegardé' : status === 'saving' ? 'Enregistrement…' : 'Prêt');
      });
    },

    /* ===================== Démarrage ===================== */
    init: function () {
      global.Sync.load();
      App.bind();
      const r = S.load();
      const start = function () {
        App.afterStateReplaced();
        App.syncCheck(false);
        if (r.status === 'unavailable') {
          UI.modal({ title: 'Enregistrement indisponible', html: '<p>' + esc(r.message) + '</p><p class="muted">Vous pouvez jouer normalement et utiliser « Exporter ma sauvegarde » dans les Réglages pour conserver votre progression.</p>', actions: [{ label: 'Compris', cls: 'btn-accent' }] });
        }
      };
      if (r.status === 'corrupt') App.handleCorruption(r).then(start);
      else start();
    }
  };

  global.UI = UI;
  global.App = App;

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', App.init);
  else App.init();

})(window);
