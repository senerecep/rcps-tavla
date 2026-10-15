/* RCP's-GAMES Tavla — oyun akışı (3D) */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  const roll1 = () => rand(6) + 1;
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLOR_NAME = ['Krem', 'Bordo'];

  const G = {
    mode: null, me: 0, code: null, names: ['', ''], online: [false, false],
    S: null, sel: null, legal: [], openings: {}, openShown: {}, openResolved: {},
    auto: localStorage.getItem('rcp_auto') !== '0', joined: false, conn: true, sceneReady: false,
    undo: [], noAuto: false
  };

  let chain = Promise.resolve(), pending = 0;
  function queue(fn) {
    pending++;
    chain = chain.then(fn).catch(e => console.error(e)).finally(() => { pending--; if (!pending) refreshInteract(); });
    return chain;
  }

  const persp = () => (G.mode === 'online' ? G.me : 0);
  const myTurn = () => !!G.S && (G.mode === 'local' || G.S.turn === G.me);
  const isBot = () => G.mode === 'bot';
  const BOT = 1;
  const sideOf = p => (p === persp() ? 'R' : 'L');
  const waitingOpp = () => G.mode === 'online' && !G.names[1 - G.me];
  const nameOf = p => G.names[p] || COLOR_NAME[p];

  /** Kırık taşı olan oyuncu için rakip evinin 6 kapısı da kapalı mı */
  function entryClosed(S, p) {
    if (!S.bar[p]) return false;
    for (let d = 1; d <= 6; d++) {
      const t = p === 0 ? 24 - d : d - 1, v = S.board[t];
      if (p === 0 ? v > -2 : v < 2) return false;
    }
    return true;
  }

  /* ---------- Çizim ---------- */
  function render(hide) {
    if (!G.S) return;
    Scene.render(G.S, hide);
    renderDice();
    hud();
  }
  let diceKey = -1;
  function renderDice() {
    const S = G.S;
    const c = $('#dcount');
    if (!S.dice || !S.dice.length || S.phase === 'opening') { Scene.clearDice(); diceKey = -1; c.hidden = true; return; }
    if (diceKey !== S.rollV) { Scene.showDice(S.dice, sideOf(S.diceP)); diceKey = S.rollV; }
    const left = S.left || [], [a, b] = S.dice;
    if (a === b) {
      Scene.markDice([left.length === 0, left.length === 0]);
      c.hidden = !(left.length && S.phase === 'move');
      c.textContent = `×${left.length} hamle`;
    } else {
      Scene.markDice([!left.includes(a), !left.includes(b)]);
      c.hidden = true;
    }
  }

  /* ---------- Banner, efektler ---------- */
  let bannerT = null;
  const PIPS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const miniDie = v => `<span class="mini${v === 1 ? ' one' : ''}">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<i class="${PIPS[v].includes(i) ? 'on' : ''}"></i>`).join('')}</span>`;
  function banner(title, sub, level = 0, ms = 1700, dice = null) {
    const b = $('#banner'); clearTimeout(bannerT);
    b.className = 'banner show l' + level;
    b.innerHTML = `${dice ? `<div class="bdice">${dice.map(miniDie).join('')}</div>` : ''}<div class="bt">${esc(title)}</div>${sub ? `<div class="bs">${esc(sub)}</div>` : ''}`;
    bannerT = setTimeout(() => b.classList.remove('show'), ms);
  }
  function btoast(text, ms = 1600) { const t = $('#btoast'); t.textContent = text; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), ms); }
  function toast(text, ms = 2200) { const t = $('#toast'); t.textContent = text; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), ms); }
  function confetti(n = 60, big = false) {
    if (reduce) return;
    const box = $('#confetti'), cols = ['#d9ab52', '#f3d48a', '#c8431f', '#f5ead2', '#e2620c', '#ffffff', '#7a3cff'];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('i');
      c.style.left = (big ? Math.random() * 100 : 25 + Math.random() * 50) + 'vw';
      c.style.background = cols[i % cols.length];
      c.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
      c.style.setProperty('--r', (Math.random() * 900) + 'deg');
      c.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
      c.style.animationDelay = (Math.random() * .4) + 's';
      if (Math.random() < .3) c.className = 'round';
      box.appendChild(c); setTimeout(() => c.remove(), 3800);
    }
  }
  const FX = {
    sip(color) {
      const s = $('#sipFX'); s.style.setProperty('--c', color);
      s.classList.remove('on'); void s.offsetWidth; s.classList.add('on');
    },
    smoke() { /* duman Scene.smokeScreen ile sahnede çiziliyor */ },
    frost() { const f = $('#frostFX'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); },
    chip(text) { const c = $('#coolChip'); c.textContent = text; c.hidden = !text; }
  };

  async function diceBanner(ns) {
    const [a, b] = ns.dice, lv = Tavla.excite(a, b);
    const sub = G.mode !== 'local' && ns.diceP === G.me ? 'Sen attın' : `${nameOf(ns.diceP)} attı`;
    const title = Tavla.diceName(a, b) + (lv >= 2 ? '!' : '') + (lv >= 3 ? '!!' : '');
    banner(title, sub, lv, lv >= 2 ? 2100 : 1500, [a, b]);
    if (lv >= 1) Sfx.cheer(lv);
    if (isBot() && ns.diceP !== BOT && a === b) botSay('youDouble', .6);
    if (lv >= 2) { Scene.shake(lv - .5); confetti(lv >= 3 ? 140 : 50, lv >= 3); }
    if (lv >= 3) { document.body.classList.add('flash'); setTimeout(() => document.body.classList.remove('flash'), 700); Scene.lean(new THREE.Vector3(sideOf(ns.diceP) === 'R' ? 3.5 : -3.5, 1, 0), .35, 1.4); }
    await sleep(lv >= 2 ? 650 : 280);
  }

  /* ---------- Taş animasyonu ---------- */
  async function animateMove(prev, ns, m) {
    const p = prev.turn;
    const fromN = m.from === 'bar' ? prev.bar[p] : Math.abs(prev.board[m.from]);
    const from = G.dragFrom || (m.from === 'bar' ? Scene.barPos(p, fromN - 1) : Scene.pointPos(m.from, fromN - 1));
    G.dragFrom = null;
    let to, rx1 = null; const hide = {};
    if (m.to === 'off') { const o = Scene.offPos(p, ns.off[p] - 1); to = o.pos; rx1 = o.rx; hide['off' + p] = true; }
    else { const n = Math.abs(ns.board[m.to]); to = Scene.pointPos(m.to, n - 1); hide['pt' + m.to] = true; }
    if (m.hit) hide['bar' + (1 - p)] = true;
    G.S = ns; render(hide);
    Sfx.pick();
    // kırılan taş kısa süre yerinde görünsün
    const rmBlot = m.hit ? Scene.tempChecker(1 - p, Scene.pointPos(m.to, 0)) : null;
    await Scene.moveChecker(p, from, to, { rx0: 0, rx1 });
    if (rmBlot) rmBlot();
    if (m.to === 'off') { Sfx.off(); Scene.burst(to, 0xfff1c0, 12); }
    else Sfx.place(Math.abs(ns.board[m.to]) > 1);
    if (m.hit) {
      Sfx.hit(); Scene.shake(1.6); Scene.burst(to, 0xffa040, 26);
      if (isBot()) botSay(p === BOT ? 'hitYou' : 'gotHit', .7);
      btoast('Kırıldı!', 900);
      const n = ns.bar[1 - p];
      render(Object.assign({}, hide, { ['pt' + m.to]: false }));
      await Scene.moveChecker(1 - p, Scene.pointPos(m.to, 0).setY(.6), Scene.barPos(1 - p, n - 1));
    }
    render();
  }

  async function animateUndo(prev, ns, m) {
    const p = prev.turn;
    let from, rx0 = 0;
    if (m.to === 'off') { const o = Scene.offPos(p, prev.off[p] - 1); from = o.pos; rx0 = o.rx; }
    else { const n = Math.abs(prev.board[m.to]); from = Scene.pointPos(m.to, n - 1); }
    const to = m.from === 'bar' ? Scene.barPos(p, ns.bar[p] - 1) : Scene.pointPos(m.from, Math.abs(ns.board[m.from]) - 1);
    const hide = { [m.from === 'bar' ? 'bar' + p : 'pt' + m.from]: true };
    if (m.hit) hide['pt' + m.to] = true;
    G.S = ns; render(hide);
    Sfx.pick();
    const jobs = [Scene.moveChecker(p, from, to, { rx0, rx1: 0 })];
    if (m.hit) jobs.push(Scene.moveChecker(1 - p, Scene.barPos(1 - p, prev.bar[1 - p] - 1), Scene.pointPos(m.to, 0)));
    await Promise.all(jobs);
    Sfx.place();
    render();
  }

  /* ---------- Etkileşim ---------- */
  function refreshInteract() {
    const S = G.S; if (!S || !G.sceneReady) return;
    const active = !pending && myTurn() && S.phase === 'move' && !waitingOpp() && !Scene.isFolded();
    G.legal = active ? Tavla.legalMoves(S) : [];
    if (G.legal.length && G.legal.every(m => m.from === 'bar')) G.sel = 'bar';
    if (G.sel !== null && !G.legal.some(m => m.from === G.sel)) G.sel = null;
    const key = src => (src === 'bar' ? 'bar' + S.turn : 'pt' + src);
    const movable = [...new Set(G.legal.map(m => m.from))].map(key);
    const dests = [];
    G.combos = new Map();
    if (G.sel !== null) {
      const p = S.turn;
      const singles = new Set(G.legal.filter(m => m.from === G.sel).map(m => m.to));
      comboTargets(S, G.sel).forEach((v, t) => { if (!singles.has(t)) G.combos.set(t, v.path); });
      [...singles, ...G.combos.keys()].forEach(t => {
        let pos = null;
        if (t !== 'off') { const v = S.board[t], mine = p === 0 ? v > 0 : v < 0, n = mine ? Math.abs(v) : 0; pos = Scene.pointPos(t, n); }
        dests.push({ t, pos });
      });
    }
    Scene.setHighlights({ movable, sel: G.sel !== null ? key(G.sel) : null, dests });
    const rb = $('#rollBtn');
    const canRoll = !pending && myTurn() && S.phase === 'roll' && !waitingOpp() && !entryClosed(S, S.turn) && !Scene.isFolded();
    rb.hidden = !canRoll;
    if (canRoll) { rb.classList.toggle('opp', sideOf(S.turn) === 'L'); rb.querySelector('span:last-child').textContent = Shake.on && isTouch ? 'Salla / dokun' : 'Zar at'; }
    const ub = $('#undoBtn');
    const canUndo = !pending && G.undo.length > 0 && myTurn() && S.phase === 'move' && !Scene.isFolded();
    ub.hidden = !canUndo;
    if (canUndo) {
      ub.classList.toggle('ending', !!S.done);
      ub.style.setProperty('--ms', END_MS + 'ms');
      ub.querySelector('span').textContent = S.done ? 'Geri al (sıra geçiyor)' : 'Geri al';
      if (S.done) { const bar = ub.querySelector('i'); bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
    }
    const okb = $('#okBtn');
    okb.hidden = !(canUndo && S.done);
    const ab = $('#autoBtn'), ap = G.mode === 'local' ? S.turn : G.me;
    const canAuto = S.phase !== 'over' && S.phase !== 'opening' && Tavla.allHome(S, ap) && !Scene.isFolded();
    ab.hidden = !canAuto;
    if (canAuto) { ab.classList.toggle('on', G.autoRoll); ab.textContent = G.autoRoll ? '🎲 Otomatik: açık' : '🎲 Otomatik zar'; }
    else if (G.autoRoll && S.phase !== 'over') G.autoRoll = false;
    openingPanel(); waitPanel(); hud();
  }

  /** Bütün taşlar evdeyken: zar kendiliğinden atılır, en iyi toplama hamlesi oynanır, sıra kendiliğinden geçer */
  let autoRollT = null;
  function autoRollStep() {
    clearTimeout(autoRollT);
    const S = G.S;
    if (!G.autoRoll || !S || !myTurn() || S.phase === 'over' || (isBot() && S.turn === BOT)) return;
    if (!Tavla.allHome(S, S.turn)) { G.autoRoll = false; btoast('Otomatik zar kapandı', 1400); refreshInteract(); return; }
    autoRollT = setTimeout(() => {
      if (pending) { autoRollStep(); return; }
      const S = G.S; if (!G.autoRoll || !myTurn()) return;
      if (S.phase === 'roll') doRoll();
      else if (S.phase === 'move') {
        if (S.done) { clearTimeout(endT); endTurn(); return; }
        const L = Tavla.legalMoves(S); if (!L.length) return;
        clearTimeout(autoT);
        if (!G.autoPlan || G.autoPlanV !== S.rollV) { G.autoPlan = Bot.plan(S, 'usta'); G.autoPlanV = S.rollV; }
        const m = G.autoPlan.shift();
        const mm = m && (L.find(x => x.from === m.from && x.to === m.to && x.die === m.die) || L.find(x => x.from === m.from && x.to === m.to));
        doMove(mm || L[0]);
      }
    }, S.phase === 'roll' ? 600 : 420);
  }

  /** Aynı taşla birden fazla zarı arka arkaya oynayarak varılabilecek haneler (ör. 3+5 = 8). Ara hanede taş kırmayan yol tercih edilir. */
  function comboTargets(S, src) {
    const res = new Map();
    const rec = (st, from, path) => {
      if (path.length >= 4) return;
      const seen = new Set();
      Tavla.legalMoves(st).filter(m => m.from === from).forEach(m => {
        const k = m.to + ':' + m.die; if (seen.has(k)) return; seen.add(k);
        const r = Tavla.applyMove(st, m), np = path.concat([{ from: m.from, to: m.to, die: m.die, hit: r.hit }]);
        if (np.length >= 2) {
          const hits = np.slice(0, -1).filter(x => x.hit).length, prev = res.get(m.to);
          if (!prev || hits < prev.hits || (hits === prev.hits && np.length < prev.path.length)) res.set(m.to, { path: np, hits });
        }
        if (m.to !== 'off') rec(r.state, m.to, np);
      });
    };
    rec(S, src, []);
    return res;
  }
  /** Birleşik hamle: ilk adımı oyna, kalanları sırayla kendiliğinden oyna */
  function playCombo(path) {
    G.comboQueue = path.slice(1).map(m => ({ from: m.from, to: m.to, die: m.die }));
    const f = path[0];
    doMove({ from: f.from, to: f.to, die: f.die });
  }

  function onTarget(t) {
    if (pending || !G.legal.length) return;
    if (G.sel !== null) {
      const ms = G.legal.filter(m => m.from === G.sel && m.to === t).sort((a, b) => a.die - b.die);
      if (ms.length) { doMove(ms[0]); return; }
      if (G.combos && G.combos.has(t)) { playCombo(G.combos.get(t)); return; }
      if (t === G.sel) {
        const ds = [...new Set(G.legal.filter(m => m.from === G.sel).map(m => m.to))];
        if (ds.length === 1) { doMove(G.legal.filter(m => m.from === G.sel && m.to === ds[0]).sort((a, b) => a.die - b.die)[0]); return; }
        G.sel = null; refreshInteract(); return;
      }
    }
    if (G.legal.some(m => m.from === t)) { G.sel = t; Sfx.tick(); }
    else if (G.sel !== 'bar') G.sel = null;
    refreshInteract();
  }

  /* ---------- Eylemler ---------- */
  function commit(ns) { if (G.mode === 'online') Net.setState(ns); queue(() => transition(ns)); }

  /** Sallama gücü e (0-1): hafif sallama küçük sayılara, sert sallama büyük sayılara hafifçe yatkın. e yoksa tamamen eşit. */
  function rollBiased(e) {
    if (e == null) return roll1();
    const tilt = (e - .5) * .5, w = [1, 2, 3, 4, 5, 6].map(k => 1 + tilt * (k - 3.5) / 2.5), sum = w.reduce((x, y) => x + y, 0);
    let r = rand(1e6) / 1e6 * sum;
    for (let k = 0; k < 6; k++) { r -= w[k]; if (r <= 0) return k + 1; }
    return 6;
  }
  function doRoll(force, shakeE) {
    const S = G.S;
    if (pending || !S || S.phase !== 'roll' || (!myTurn() && force !== true) || waitingOpp()) return;
    const a = rollBiased(shakeE), b = rollBiased(shakeE);
    const ns = clone(S); ns.v++;
    ns.dice = [a, b]; ns.diceP = S.turn; ns.rollV = ns.v;
    ns.left = a === b ? [a, a, a, a] : [a, b];
    ns.phase = 'move'; ns.last = { type: 'roll', p: S.turn }; ns.done = false;
    G.sel = null; G.undo = []; G.noAuto = false; $('#rollBtn').hidden = true;
    commit(ns);
  }

  function doMove(m) {
    const S = G.S, p = S.turn;
    clearTimeout(autoT);
    G.undo.push(clone(S));
    const r = Tavla.applyMove(S, m), ns = r.state;
    ns.v = S.v + 1;
    ns.last = { type: 'move', p, m: { from: m.from, to: m.to, die: m.die, hit: r.hit } };
    if (ns.off[p] === 15) {
      ns.phase = 'over'; ns.winner = p; ns.mars = ns.off[1 - p] === 0;
      ns.score[p] += ns.mars ? 2 : 1; ns.left = []; G.undo = [];
      ns.matchOver = ns.score[p] >= (ns.target || 5);
    } else if (!ns.left.length || !Tavla.legalMoves(ns).length) {
      if (ns.left.length) ns.last.blocked = true;
      ns.done = true;
    }
    G.sel = null; commit(ns);
  }

  /** Zarlar bitti: kısa bir süre geri alma şansı, sonra sıra geçer */
  let endT = null;
  const END_MS = 2300;
  function scheduleEnd() { clearTimeout(endT); endT = setTimeout(endTurn, END_MS); }
  function endTurn(force) {
    const S = G.S;
    if (!S || S.phase !== 'move' || !S.done) return;
    if (!force && !myTurn()) return;
    if (pending) { endT = setTimeout(() => endTurn(force), 300); return; }
    const ns = clone(S); ns.v++;
    ns.turn = 1 - S.turn; ns.phase = 'roll'; ns.left = []; ns.done = false;
    ns.last = { type: 'end', p: S.turn };
    G.undo = []; commit(ns);
  }
  function doUndo() {
    G.comboQueue = null;
    if (pending || !G.undo.length || !myTurn() || G.S.phase !== 'move') return;
    clearTimeout(endT); clearTimeout(autoT);
    const ns = clone(G.undo.pop());
    ns.v = G.S.v + 1; ns.done = false;
    ns.last = { type: 'undo', p: G.S.turn, m: G.S.last && G.S.last.m };
    G.noAuto = true; G.sel = null;
    commit(ns);
  }

  function doPass(type, force) {
    const S = G.S; if (!S || (!myTurn() && force !== true)) return;
    if (type === 'closed') { if (S.phase !== 'roll' || !entryClosed(S, S.turn)) return; }
    else if (S.phase !== 'move' || Tavla.legalMoves(S).length) return;
    const ns = clone(S); ns.v++;
    ns.turn = 1 - S.turn; ns.phase = 'roll'; ns.left = [];
    ns.last = { type: type || 'pass', p: S.turn };
    commit(ns);
  }

  let autoT = null;
  function scheduleAuto() {
    clearTimeout(autoT);
    autoT = setTimeout(() => {
      if (pending) { scheduleAuto(); return; }
      if (!myTurn() || G.S.phase !== 'move') return;
      const m = autoPick(); if (m) doMove(m);
    }, 560);
  }
  /** Sadece seçim yoksa oynar: tek hamle kaldıysa ya da yapılabilecek her hamle zaten toplamaysa */
  function autoPick() {
    const L = Tavla.legalMoves(G.S); if (!L.length) return null;
    const keys = new Set(L.map(m => m.from + '>' + m.to));
    if (keys.size === 1) return L.sort((a, b) => a.die - b.die)[0];
    if (L.every(m => m.to === 'off')) {
      const ex = L.filter(m => (G.S.turn === 0 ? m.from + 1 : 24 - m.from) === m.die);
      return (ex.length ? ex : L).sort((a, b) => a.die - b.die)[0];
    }
    return null;
  }

  /* ---------- Durum geçişleri ---------- */
  async function transition(ns) {
    const prev = G.S;
    if (prev && ns.v <= prev.v) return;
    const L = ns.last || {}, seq = prev && ns.v === prev.v + 1;
    if (prev && prev.phase === 'over' && ns.phase !== 'over') { closeModal(); $('#foldCaption').classList.remove('show'); document.body.classList.remove('folded'); await Scene.unfold(); }
    if (seq && L.type === 'roll') {
      Sfx.roll();
      await Scene.rollDice(ns.dice, sideOf(ns.diceP)); diceKey = ns.rollV;
      G.S = ns; render(); await diceBanner(ns);
    } else if (seq && L.type === 'move') {
      await animateMove(prev, ns, L.m);
      if (L.blocked) btoast('Kalan zar oynanamıyor');
      if (ns.phase === 'roll') await sleep(250);
    } else if (seq && L.type === 'undo' && L.m) {
      await animateUndo(prev, ns, L.m);
      btoast('Hamle geri alındı', 1100);
    } else if (seq && L.type === 'end') {
      G.S = ns; render();
    } else if (seq && L.type === 'pass') {
      G.S = ns; render(); btoast(`${nameOf(L.p)} oynayamadı, sıra geçti`, 1800); await sleep(500);
    } else if (seq && L.type === 'closed') {
      G.S = ns; render(); banner('Kapılar kapalı 🔒', `${nameOf(L.p)} giremiyor, sıra geçti`, 0, 1900); Sfx.place(); await sleep(700);
    } else if (L.type === 'tie') {
      G.S = ns; Scene.clearOpening(); render();
    } else if (L.type === 'start') {
      G.S = ns; Scene.clearOpening(); render();
      if (myTurn()) btoast(G.mode === 'local' ? `${nameOf(ns.turn)}, zar at` : 'Sen başlıyorsun, zar at', 1800);
      if (isBot() && ns.turn === BOT) botSay('start');
    } else { G.S = ns; render(); if (L.type === 'new' && L.starter != null) banner(G.mode !== 'local' && L.starter === G.me ? 'Sen başlıyorsun' : `${nameOf(L.starter)} başlıyor`, 'Önceki eli kazandı', 1, 1800); }
    if (ns.phase === 'roll' && prev && prev.turn !== ns.turn && myTurn() && L.type !== 'start') {
      G.undo = [];
      Sfx.tick(); if (G.mode !== 'local' && !entryClosed(ns, ns.turn)) btoast('Sıra sende, zar at', 1500);
    }
    if (ns.phase === 'over' && (!prev || prev.phase !== 'over') && seq) await endGame();
    else if (ns.phase === 'over') showResult();
    afterState();
  }

  let closedT = null, otherEndT = null;
  function afterState() {
    const S = G.S; G.sel = null;
    if (G.comboQueue && G.comboQueue.length) {
      const next = G.comboQueue.shift();
      const mm = S.phase === 'move' && !S.done && myTurn() && Tavla.legalMoves(S).find(x => x.from === next.from && x.to === next.to && x.die === next.die);
      if (mm) { clearTimeout(autoT); clearTimeout(endT); setTimeout(() => doMove(mm), 40); refreshInteract(); return; }
      G.comboQueue = null;
    }
    clearTimeout(otherEndT);
    if (S.phase === 'move' && S.done) {
      if (myTurn() && !G.autoRoll) scheduleEnd();
      else if (G.mode === 'online') { const v = S.v; otherEndT = setTimeout(() => { if (G.S.v === v) endTurn(true); }, 9000); }
    } else if (S.phase === 'move' && myTurn()) {
      if (!Tavla.legalMoves(S).length) { btoast('Oynanacak hamle yok', 1400); setTimeout(() => doPass('pass'), 1500); }
      else if (G.auto && !G.noAuto && !G.autoRoll) scheduleAuto();
    }
    if (S.phase === 'roll' && myTurn() && !waitingOpp() && entryClosed(S, S.turn)) {
      clearTimeout(closedT); closedT = setTimeout(() => doPass('closed'), 1200);
    }
    if (S.phase === 'opening') handleOpening();
    if (isBot()) { botStep(); clearTimeout(kasparT); if (S.turn !== BOT && (S.phase === 'roll' || S.phase === 'move') && !S.done) kasparT = setTimeout(() => botSay('kaspar'), 25000); }
    if (G.autoRoll) autoRollStep();
    refreshInteract();
  }

  /* ---------- Telefonu sallayarak zar ---------- */
  const Shake = { on: localStorage.getItem('rcp_shake') !== '0', energy: 0, active: false, last: 0, snd: 0, prev: null };
  function shakeReady() { const S = G.S; return !!S && S.phase === 'roll' && myTurn() && !pending && !waitingOpp() && !$('#rollBtn').hidden; }
  function onMotion(e) {
    if (!Shake.on || !G.mode) return;
    const a = e.accelerationIncludingGravity || e.acceleration; if (!a) return;
    const v = [a.x || 0, a.y || 0, a.z || 0];
    if (!Shake.prev) { Shake.prev = v; return; }
    const d = Math.hypot(v[0] - Shake.prev[0], v[1] - Shake.prev[1], v[2] - Shake.prev[2]); Shake.prev = v;
    if (!shakeReady()) { Shake.energy = 0; Shake.active = false; return; }
    const now = performance.now();
    if (d > 9) {
      Shake.active = true; Shake.last = now; Shake.energy += d;
      const k = Math.min(1, (d - 9) / 25);
      if (now - Shake.snd > 75 - k * 35) { Shake.snd = now; Sfx.cupShake(k); }
      clearTimeout(Shake.t); Shake.t = setTimeout(shakeDone, 400);
    }
  }
  /** Sallama bitti: toplanan enerjiye göre zar atılır */
  function shakeDone() {
    if (!Shake.active) return;
    const en = Math.min(1, Shake.energy / 1500); Shake.active = false; Shake.energy = 0;
    if (en > .06 && shakeReady()) doRoll(false, en);
  }
  async function askMotion() {
    try { if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') return (await DeviceMotionEvent.requestPermission()) === 'granted'; } catch (e) { return false; }
    return true;
  }
  window.addEventListener('devicemotion', onMotion);
  const isTouch = matchMedia('(pointer: coarse)').matches;

  /* ---------- Bilgisayar rakip ---------- */
  let botT = null;
  const HITAP = ['dostum', 'kanka', 'arkadaşım', 'birader', 'hocam', 'reis', 'kardeşim', 'usta', 'aslanım'];
  const BOT_SOZ = {
    start: ['Hadi bakalım {a}, göreyim seni.', 'Çayını iç {a}, sonra ağlarsın 😄', 'Zarlar ısındı mı {a}?', 'Bugün masada tek hakim var {a}.', 'Hoş geldin {a}, kolay gelsin… sana lazım olacak 😄'],
    double: ['Hayde oynaaağ 💃🏻', 'Çift geldi {a}, kusura bakma 😏', 'Zarlar beni seviyor {a}!', 'Bu zarı çerçeveletip asacağım.', 'Balını yesinler, ne zar ama!'],
    youDouble: ['Şansına bak {a}!', 'Hassiktir, yine mi çift?', 'Zar seni kolluyor {a}.', 'O zarı nereden buldun {a}?', 'Tamam {a}, bu seferlik geçerli 😄'],
    bad: ['Şansımı sikeyim.', 'Zar bozuk bu {a}!', 'Aq, bu ne zar.', 'Bu zarla ancak çay söylerim.', 'Zarı kim yaptıysa elleri dert görmesin(!)'],
    hitYou: ['Kırdım seni {a}, otur kenara 😄', 'Pardon {a}, yolumdaydın.', 'Kapıdan dön bakalım {a}.', 'Kırık taş, kırık kalp {a} 😎', 'Taşını aldım {a}, makbuz ister misin?'],
    gotHit: ['Hassiktir!', 'Ooo {a}, ustaymışsın.', 'Aq, tam da oraya mı?', 'Tamam {a}, intikam soğuk yenir.', 'Bunu not ettim {a} 😤'],
    winMars: ['Haydi yavrum marsa! Okullar tatil 🎒', 'Mars {a}! Okullar tatil 😎', 'Çift puan cebimde {a}, eyvallah.'],
    win: ['Okullar tatil 🎒', 'Tavla koltuğunun altında {a}.', 'Bu el benim {a}, sıradaki gelsin.', 'Eyvallah {a}, iyi mücadeleydi.'],
    lose: ['Aq, iyi oynadın {a}. Bir el daha?', 'Şansımı sikeyim, rövanş!', 'Helal olsun {a}, bu sefer senin.', 'Tamam {a}, sıradaki elde görüşürüz.'],
    blocked: ['Kapıları kapattın ha {a}, aferin.', 'Aq, kilit vurmuş adam.', 'Kapı duvar {a}, açsana biraz.'],
    kaspar: ['Kaspar olduk {a}! Oyna artık.', 'Kaspar ettin beni {a}, çay soğudu.', 'Hadi {a}, zar seni bekliyor.', 'Uyudun mu {a}? Kaspar olduk burada.', 'Düşünürken saç beyazladı {a} 😄'],
    voice: ['Sesin bayağı gür çıkıyor {a} 😄', 'Ne dedin duyamadım {a}, zarlar çok gürültülü.', 'Radyo programı mı yapıyoruz {a}? Oyna hadi.', 'Güzel ses {a}, türkü de söyle bari.'],
    cold: ['Soğuk su mu? Asıl sen iç onu {a} 😄', 'Hassiktir, buz gibi!', 'Sağ ol {a}, tam da terlemiştim.', 'Bu suyu sana iade ediyorum {a} 🧊']
  };
  /** Hazır mesajlara ve yazılanlara bilgisayarın cevapları */
  const BOT_CEVAP = {
    'hadi oyna!': ['Oynuyorum {a}, sakin.', 'Acele işe şeytan karışır {a}.', 'Sen bana değil zara söyle onu 😄', 'Tamam tamam, geliyorum.'],
    'hassiktir': ['Ne oldu {a}? 😄', 'Kontrolü kaybetme {a}.', 'Sakin, daha maç bitmedi.', 'Ooo, sinirler gerildi.'],
    'aq': ['Ayıp ayıp {a} 😄', 'Kızma {a}, oyun bu.', 'Hehe, canın mı sıkıldı?', 'Bir çay iç, geçer {a}.'],
    'şansımı sikeyim': ['Şans değil {a}, yetenek bu 😎', 'Zarı suçlama {a}.', 'Bir dahakine belki.', 'Herkesin zarı bir gün döner {a}.'],
    'balını yesinler': ['Sağ ol {a} 😄', 'Yesinler yesinler.', 'Ballı zar bunlar {a}.', 'Eyvallah {a}!'],
    'haydi yavrum marsa': ['Rüyanda {a} 😄', 'O mars sana dönecek, görürsün.', 'Önce bir taş topla bakalım.', 'Az bekle, kim kime mars oluyor göreceğiz.'],
    'okullar tatil': ['Daha karne dağıtılmadı {a}!', 'Tatil sana {a}, ben mesaideyim.', 'Erken sevinme {a}.', 'Okul bitmez {a}, yaz okulu var 😄'],
    'hayde oynaaağ 💃🏻': ['Oynaaa 💃🏻💃🏻', 'Halay başı benim {a}!', 'Ooo, keyifler yerinde.', 'Mendil de getireyim mi {a}? 😄'],
    'kaspar olduk birader!': ['Düşünüyorum {a}, beyin yanıyor 😄', 'Tamam tamam, oynuyorum.', 'Sabır {a}, sabır.', 'Usta işi düşünmek ister {a}.'],
    'zar bozuk bu!': ['Zar aynı zar {a} 😄', 'Zarı değiştirelim mi {a}?', 'Ustalar zara bakmaz.', 'Zar bozuk değil, şansın bozuk {a}.'],
    'kırdım seni 😎': ['Daha bitmedi {a}.', 'Görürsün sen 😤', 'Kırık taş geri döner {a}.', 'Bir taştan ne olur {a}.'],
    'çaylar benden ☕': ['Eyvallah {a} ☕', 'Bir de tost söyle bari.', 'Sen çok yaşa {a}.', 'Demli olsun {a}.'],
    'mars olacaksın!': ['Hayatta olmam {a}.', 'O laf sana döner {a} 😄', 'Görürüz bakalım.', 'Mars kelimesini ağzına alma {a}.'],
    'bir el daha?': ['Her zaman {a}!', 'Otur, bir el daha.', 'Rövanş hakkın var {a}.', 'Masa senin {a}.'],
    'iyi oyundu 🤝': ['Senin de eline sağlık {a} 🤝', 'Eyvallah, iyiydin.', 'Bir dahakine yine bekliyorum {a}.'],
    '😂': ['😂😂', 'Gül gül {a}, sonra ağlarsın.', 'Neye güldün {a}?'], '🔥': ['🔥 Masa yanıyor {a}!', 'Sıcak sıcak oynuyoruz.'],
    '👏': ['👏 Eyvallah {a}.', 'Alkışı hak ettim 😎'], '😎': ['Gözlükleri ben de taktım 😎', 'Havalısın {a}.'],
    '😤': ['Sinirlenme {a} 😄', 'Nefes al, ver.'], '🙏': ['Dua etme {a}, oyna 🙏', 'Allah ne verdiyse.'],
    '😱': ['Korkma {a}, bir şey olmaz.', 'Ne gördün?'], '💀': ['Daha ölmedin {a} 💀', 'Yaşıyor musun {a}?'],
    '🍀': ['Şans bende {a} 🍀', 'Yoncaları ben topladım.'], '🎲': ['Zar at {a}, zar 🎲', 'Zarlar hazır.'],
    '☕': ['Bir çay da bana {a} ☕', 'Çay olmadan olmaz.'], '🤝': ['🤝 Eyvallah {a}.', 'Centilmenlik güzel.']
  };
  const BOT_SERBEST = [
    [/selam|merhaba|naber|slm/i, ['Selam {a}, hoş geldin!', 'Aleyküm selam {a}.', 'İyidir {a}, senden naber?']],
    [/nasılsın|nasilsin|iyi misin/i, ['İyiyim {a}, sen nasılsın?', 'Zarlar iyi geldikçe iyiyim 😄']],
    [/çay|cay|kahve|tost|sosisli/i, ['Garson! İki çay {a} için ☕', 'Bana da söyle {a}.', 'Kahvehanede çaysız olmaz {a}.']],
    [/mars/i, ['Mars lafı geçince tüylerim diken diken oluyor {a}.', 'Kim kime mars olacak, göreceğiz.']],
    [/zar/i, ['Zar zar, hep zar {a} 😄', 'Zara söz geçmez {a}.']],
    [/kazan|yen/i, ['Önce oyna, sonra konuşalım {a}.', 'Söz uçar, zar kalır {a}.']],
    [/sağ ?ol|tşk|teşekkür|eyv/i, ['Rica ederim {a}.', 'Ne demek {a}.']]
  ];
  const fill = t => t.replace(/\{a\}/g, () => HITAP[rand(HITAP.length)]);
  const pickOf = l => fill(l[rand(l.length)]);
  let lastSay = 0, kasparT = null;
  function botSay(kind, chance) {
    if (!isBot()) return;
    if (chance != null && Math.random() > chance) return;
    if (Date.now() - lastSay < 4000 && !['win', 'winMars', 'lose', 'kaspar'].includes(kind)) return;
    lastSay = Date.now();
    const list = BOT_SOZ[kind]; if (!list) return;
    const text = pickOf(list);
    setTimeout(() => Chat.add({ key: 'bot', name: nameOf(BOT), text, t: Date.now() }), 500 + rand(700));
  }
  /** Bilgisayar her hazır mesaja ve yazılana cevap verir */
  function botReply(text) {
    if (!isBot()) return;
    const k = text.trim().toLocaleLowerCase('tr');
    let list = BOT_CEVAP[k];
    if (!list) { const hit = BOT_SERBEST.find(([re]) => re.test(text)); list = hit ? hit[1] : ['Hı hı {a}.', 'Doğru diyorsun {a}.', 'Önce oyna, sonra konuşuruz 😄', 'Anladım {a}.', 'Hehe 😄', 'Öyle mi diyorsun {a}?']; }
    lastSay = Date.now();
    setTimeout(() => { Chat.add({ key: 'bot', name: nameOf(BOT), text: pickOf(list), t: Date.now() }); Sfx.chat(); }, 800 + rand(1000));
  }
  function botStep() {
    clearTimeout(botT);
    const S = G.S;
    if (!isBot() || !S || S.turn !== BOT || S.phase === 'over' || S.phase === 'opening') return;
    const delay = S.phase === 'roll' ? 950 : S.done ? 650 : 620;
    botT = setTimeout(() => {
      if (pending) { botStep(); return; }
      const S = G.S; if (!S || S.turn !== BOT || !isBot()) return;
      if (S.phase === 'roll') {
        if (Math.random() < .2) Cafe.npcSip(BOT);
        if (entryClosed(S, BOT)) { doPass('closed', true); botSay('blocked', .6); }
        else doRoll(true);
      } else if (S.phase === 'move') {
        if (S.done) { endTurn(true); return; }
        const L = Tavla.legalMoves(S);
        if (!L.length) { doPass('pass', true); botSay('bad', .6); return; }
        if (!G.botPlan || G.botPlanV !== S.rollV) {
          G.botPlan = Bot.plan(S, G.botLevel); G.botPlanV = S.rollV;
          if (S.dice[0] === S.dice[1] && S.dice[0] >= 4) botSay('double', .6);
          else if (S.dice[0] + S.dice[1] <= 4) botSay('bad', .35);
        }
        const m = G.botPlan.shift();
        const mm = m && (L.find(x => x.from === m.from && x.to === m.to && x.die === m.die) || L.find(x => x.from === m.from && x.to === m.to));
        doMove(mm || L[0]);
      }
    }, delay);
  }
  function startBot(name, level) {
    G.mode = 'bot'; G.me = 0; G.code = null; G.botLevel = level || 'usta'; G.botPlan = null;
    G.names = [name, 'Bilgisayar']; G.online = [true, true];
    G.openings = {}; G.openShown = {}; G.openResolved = {}; G.S = null;
    if (!enterGame()) return;
    G.S = Tavla.newState(1, [0, 0], matchLen());
    render(); afterState();
  }

  /* ---------- Başlangıç zarı ---------- */
  const openKey = () => G.S.game + '_' + (G.S.openRound || 0);
  function openingPanel() {
    const P = $('#openPanel'), S = G.S;
    if (S.phase !== 'opening' || waitingOpp()) { P.hidden = true; return; }
    const vals = G.openings[openKey()] || {};
    P.hidden = false;
    if (G.mode !== 'online') {
      P.innerHTML = `<h3>Kim başlıyor?</h3><p>Herkes tek zar atar, büyük atan başlar.</p>${vals[0] != null ? '' : '<button class="btn" id="opBtn">Zarları at</button>'}`;
    } else {
      const mine = vals[G.me] != null, theirs = vals[1 - G.me] != null;
      P.innerHTML = `<h3>Kim başlıyor?</h3><p>Herkes tek zar atar, büyük atan başlar.</p>${mine ? `<p class="wait">${theirs ? 'Bakalım…' : esc(nameOf(1 - G.me)) + ' zarını bekliyoruz'}</p>` : '<button class="btn" id="opBtn">Zarımı at</button>'}`;
    }
    const b = $('#opBtn'); if (b) b.onclick = doOpeningRoll;
  }
  function doOpeningRoll() {
    if (pending) return;
    const k = openKey();
    if (G.mode !== 'online') G.openings[k] = { 0: roll1(), 1: roll1() };
    else { const v = roll1(); G.openings[k] = Object.assign({}, G.openings[k], { [G.me]: v }); Net.setOpening(k, G.me, v); }
    $('#openPanel').hidden = true;
    handleOpening();
  }
  function handleOpening() {
    const S = G.S; if (!S || S.phase !== 'opening') return;
    const k = openKey(), vals = G.openings[k] || {};
    const fresh = [0, 1].filter(p => vals[p] != null && !G.openShown[k + '_' + p]);
    if (fresh.length) {
      fresh.forEach(p => { G.openShown[k + '_' + p] = true; });
      queue(async () => { Sfx.single(); await Promise.all(fresh.map(p => Scene.openingDie(vals[p], sideOf(p)))); });
    }
    if (vals[0] != null && vals[1] != null && !G.openResolved[k]) { G.openResolved[k] = true; queue(() => resolveOpening(vals[0], vals[1])); }
    refreshInteract();
  }
  async function resolveOpening(a, b) {
    await sleep(350);
    if (a === b) banner('Beraber!', 'Bir daha atın', 0, 1500);
    else {
      const w = a > b ? 0 : 1;
      banner(G.mode !== 'local' && w === G.me ? 'Sen başlıyorsun' : `${nameOf(w)} başlıyor`, `${a} – ${b}`, 1, 1600); Sfx.cheer(1);
    }
    await sleep(1500);
    if ((G.mode !== 'online' || G.me === 0) && G.S.phase === 'opening') {
      const ns = clone(G.S); ns.v++;
      if (a === b) { ns.openRound = (ns.openRound || 0) + 1; ns.last = { type: 'tie' }; }
      else { ns.phase = 'roll'; ns.turn = a > b ? 0 : 1; ns.last = { type: 'start', o: [a, b] }; }
      commit(ns);
    }
  }

  /* ---------- Oyun sonu ---------- */
  async function endGame() {
    const S = G.S, w = S.winner;
    const pts = (S.resign != null ? `${nameOf(S.resign)} teslim oldu · ` : '') + (S.mars ? 'Mars! 2 sayı' : '1 sayı');
    Scene.setHighlights({}); G.autoRoll = false;
    if (S.matchOver) setTimeout(() => confetti(120, true), 600);
    if (isBot()) botSay(w === BOT ? (S.mars ? 'winMars' : 'win') : 'lose');
    if (G.mode !== 'local' && w === G.me) {
      Sfx.win(); confetti(160, true); banner('Kazandın!', pts, 3, 2600); await sleep(2600);
    } else {
      if (G.mode === 'local') { Sfx.win(); banner(`${nameOf(w)} kazandı`, pts, 2, 1800); await sleep(1900); }
      Sfx.fold();
      setTimeout(() => Sfx.whoosh(), 1400);
      document.body.classList.add('folded');
      await Scene.fold();
      Sfx.lose();
      const cap = $('#foldCaption');
      cap.innerHTML = isBot()
        ? `<b>${esc(nameOf(BOT))} tavlayı koltuğunun altına verdi.</b><span>Rövanş istersen otur, çay benden.</span>`
        : G.mode === 'online'
        ? '<b>Tavla koltuğunun altında.</b><span>Kalk bakalım, sıradaki gelsin. Ya da rövanş iste.</span>'
        : `<b>${esc(nameOf(1 - w))}, tavla koltuğunun altında.</b><span>Kalk bakalım, sıradaki gelsin.</span>`;
      cap.classList.add('show');
      await sleep(1700);
    }
    showResult();
  }
  function showResult() {
    const S = G.S, w = S.winner;
    const iWon = G.mode !== 'local' ? w === G.me : null;
    const mo = !!S.matchOver;
    const title = mo ? (iWon === null ? `Maçı ${nameOf(w)} kazandı 🏆` : iWon ? 'Maçı kazandın 🏆' : 'Maçı kaybettin')
      : (iWon === null ? `${nameOf(w)} kazandı` : iWon ? 'Kazandın' : 'Kaybettin');
    const sub = (S.resign != null ? `${nameOf(S.resign)} teslim oldu. ` : '') + (S.mars ? 'Mars, 2 sayı yazıldı.' : '1 sayı yazıldı.') + ` Maç ${S.target || 5} sayıya.`;
    openModal(`
      <h2>${esc(title)}</h2>
      <p class="resSub">${esc(sub)}</p>
      <div class="resScore">
        <div><span class="dot c0"></span>${esc(nameOf(0))}<b>${S.score[0]}</b></div>
        <div><span class="dot c1"></span>${esc(nameOf(1))}<b>${S.score[1]}</b></div>
      </div>
      <div class="row"><button class="btn" id="rematch">${mo ? 'Yeni maç' : 'Sonraki el'}</button><button class="btn ghost" id="leaveR">Masadan kalk</button></div>`, r => {
      $('#rematch', r).onclick = rematch; $('#leaveR', r).onclick = leave;
    }, true);
  }
  function rematch() {
    const S = G.S; if (S.phase !== 'over') { closeModal(); return; }
    G.botPlan = null;
    const ns = Tavla.newState(S.game + 1, S.matchOver ? [0, 0] : S.score, S.target || 5); ns.v = S.v + 1; ns.last = { type: 'new' };
    if (!S.matchOver) { ns.phase = 'roll'; ns.turn = S.winner; ns.last.starter = S.winner; }
    closeModal(); commit(ns);
  }

  function resign() {
    const S = G.S; if (!S || S.phase === 'over' || S.phase === 'opening') { closeModal(); return; }
    const loser = G.mode === 'local' ? S.turn : G.me, w = 1 - loser;
    const mars = S.off[loser] === 0 && S.off[w] > 0;
    const ns = clone(S); ns.v++;
    ns.phase = 'over'; ns.winner = w; ns.mars = mars; ns.resign = loser; ns.left = []; ns.done = false;
    ns.score[w] += mars ? 2 : 1; ns.matchOver = ns.score[w] >= (ns.target || 5);
    ns.last = { type: 'resign', p: loser };
    clearTimeout(endT); clearTimeout(autoT); clearTimeout(botT); G.undo = [];
    closeModal(); commit(ns);
  }
  function askResign() {
    openModal(`<h2>Teslim olmak mı?</h2><p class="resSub">Rakibin bu eli kazanır. Sen hiç taş toplamadıysan ve o toplamaya başladıysa mars sayılır.</p>
      <div class="row"><button class="btn ghost" id="rsNo">Vazgeç</button><button class="btn danger" id="rsYes">🏳️ Teslim ol</button></div>`, r => {
      $('#rsNo', r).onclick = openMenu; $('#rsYes', r).onclick = resign;
    });
  }

  /* ---------- Paneller ---------- */
  function waitPanel() {
    const P = $('#waitPanel');
    if (!waitingOpp()) { P.hidden = true; return; }
    P.hidden = false;
    P.innerHTML = `<h3>Rakip bekleniyor</h3><div class="bigCode">${esc(G.code)}</div><p>Arkadaşına masa numarasını ver ya da davet linkini gönder.</p><button class="btn" id="inviteBtn">Davet linkini paylaş</button>`;
    $('#inviteBtn').onclick = invite;
  }
  function invite() {
    const url = location.origin + location.pathname + '?masa=' + G.code;
    const text = `RCP's-GAMES'te tavla masası açtım. Masa no: ${G.code}`;
    if (navigator.share) navigator.share({ title: "RCP's-GAMES Tavla", text, url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Davet linki kopyalandı'));
    else toast(url, 5000);
  }
  function hud() {
    const S = G.S; if (!S) return;
    const me = persp(), op = 1 - me;
    const chip = (p, id) => {
      const c = $(id), active = (S.phase === 'roll' || S.phase === 'move') && S.turn === p;
      c.classList.toggle('turn', active);
      c.classList.toggle('off', G.mode === 'online' && !G.online[p] && !!G.names[p]);
      c.innerHTML = `<span class="dot c${p}"></span><span class="nm">${esc(nameOf(p))}${G.mode !== 'local' && p === G.me ? ' <em>(sen)</em>' : ''}</span><span class="pip">${Tavla.pips(S, p)}</span>`;
    };
    chip(me, '#pcMe'); chip(op, '#pcOpp');
    $('#score').innerHTML = `${S.score[me]} – ${S.score[op]}<small>/${S.target || 5}</small>`;
  }

  /* ---------- Modal ---------- */
  function openModal(html, bind, sticky) {
    const m = $('#modal'); $('.sheet', m).innerHTML = html;
    m.hidden = false; m.dataset.sticky = sticky ? '1' : '';
    if (bind) bind($('.sheet', m));
  }
  function closeModal() { $('#modal').hidden = true; }
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !$('#modal').dataset.sticky) closeModal(); });

  function openMenu() {
    const bt = Scene.BOARD_THEMES, tt = Scene.TABLE_THEMES;
    const sw = (c) => `<span class="sw">${c.map(x => `<i style="background:${x}"></i>`).join('')}</span>`;
    openModal(`
      <h2>Ayarlar</h2>
      <div class="setGrid">
        <section>
          <h3>Oyun</h3>
          <label class="tog"><input type="checkbox" id="optAuto" ${G.auto ? 'checked' : ''}><span>Seçim yoksa taşı kendisi oynasın</span></label>
          <label class="tog"><input type="checkbox" id="optQ" ${Scene.quality === 'high' ? 'checked' : ''}><span>Yüksek görüntü kalitesi (telefon ısınırsa kapat)</span></label>
          <label class="tog"><input type="checkbox" id="optShake" ${Shake.on ? 'checked' : ''}><span>Telefonu sallayınca zar at (sert sallama büyük zara biraz yatkın)</span></label>
          <h3>Ses</h3>
          <label class="tog"><input type="checkbox" id="optSnd" ${Sfx.on ? 'checked' : ''}><span>Ses efektleri</span></label>
          <label class="tog"><input type="checkbox" id="optMus" ${Music.on ? 'checked' : ''}><span>Müzik (Hicaz ud ve def)</span></label>
          <label class="tog"><input type="checkbox" id="optAmb" ${Sfx.ambientOn ? 'checked' : ''}><span>Kahvehane ortam sesi</span></label>
        </section>
        <section>
          <h3>Tavla tasarımı</h3>
          <div class="themes" id="thB">${Object.entries(bt).map(([k, v]) => `<button type="button" data-k="${k}" class="${Scene.boardTheme === k ? 'on' : ''}">${sw(v.swatch)}<span>${v.ad}</span></button>`).join('')}</div>
          <h3>Masa</h3>
          <div class="themes" id="thT">${Object.entries(tt).map(([k, v]) => `<button type="button" data-k="${k}" class="${Scene.tableTheme === k ? 'on' : ''}">${sw(v.swatch)}<span>${v.ad}</span></button>`).join('')}</div>
        </section>
      </div>
      <div class="row end"><button class="btn ghost" id="mLeave">Masadan kalk</button><button class="btn" id="mClose">Tamam</button></div>
      <button class="linkBtn" id="mResign">Teslim ol</button>`, r => {
      $('#optAuto', r).onchange = e => { G.auto = e.target.checked; localStorage.setItem('rcp_auto', G.auto ? '1' : '0'); if (G.auto) afterState(); };
      $('#optSnd', r).onchange = () => { Sfx.toggle(); sndIcon(); Music.room(Sfx.on && !!G.mode); };
      $('#optMus', r).onchange = e => Music.setOn(e.target.checked);
      $('#optAmb', r).onchange = e => Sfx.setAmbient(e.target.checked);
      $('#optQ', r).onchange = e => Scene.setQuality(e.target.checked ? 'high' : 'low');
      $('#optShake', r).onchange = async e => { if (e.target.checked && !(await askMotion())) { e.target.checked = false; toast('Hareket sensörüne izin verilmedi'); } Shake.on = e.target.checked; localStorage.setItem('rcp_shake', Shake.on ? '1' : '0'); refreshInteract(); };
      $$('#thB button', r).forEach(b => b.onclick = () => { Scene.setBoardTheme(b.dataset.k); diceKey = -1; render(); refreshInteract(); $$('#thB button', r).forEach(x => x.classList.toggle('on', x === b)); });
      $$('#thT button', r).forEach(b => b.onclick = () => { Scene.setTableTheme(b.dataset.k); $$('#thT button', r).forEach(x => x.classList.toggle('on', x === b)); });
      $('#mClose', r).onclick = closeModal; $('#mLeave', r).onclick = leave;
      const rs = $('#mResign', r); rs.hidden = !G.S || G.S.phase === 'over' || G.S.phase === 'opening'; rs.onclick = askResign;
    });
  }
  function sndIcon() { $('#sndBtn').textContent = Sfx.on ? '🔊' : '🔇'; }

  /* ---------- Ekranlar ---------- */
  function showScreen(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    if (id === 'game') requestAnimationFrame(() => Scene && Scene.resize());
  }

  function ensureScene() {
    if (G.sceneReady) return true;
    if (!window.Scene) { toast('3D kütüphanesi yüklenemedi. İnterneti kontrol edip sayfayı yenile.', 5000); return false; }
    Scene.init($('#stage'));
    Scene.onPick(name => {
      if (typeof name === 'number' || name === 'bar' || name === 'off') onTarget(name);
      else Cafe.pick(name);
    });
    Scene.enableDrag({
      can(t) {
        if (pending || !G.legal.length || !G.legal.some(m => m.from === t)) return null;
        const p = G.S.turn; return { p, key: t === 'bar' ? 'bar' + p : 'pt' + t };
      },
      start(t) { G.sel = t; Sfx.pick(); refreshInteract(); },
      drop(t, pos) {
        const ms = G.legal.filter(m => m.from === G.sel && m.to === t).sort((a, b) => a.die - b.die);
        if (ms.length) { G.dragFrom = pos; doMove(ms[0]); return true; }
        if (G.combos && G.combos.has(t)) { G.dragFrom = pos; playCombo(G.combos.get(t)); return true; }
        btoast('Oraya gidemez', 900); return false;
      },
      cancel() { refreshInteract(); }
    });
    G.sceneReady = true;
    return true;
  }

  function sendEvent(ev) {
    ev.t = Date.now();
    if (G.mode === 'online') Net.chat(Object.assign({ sys: true }, ev));
    else { Chat.sys(ev.text); Cafe.event(ev); if (isBot() && ev.to === BOT) setTimeout(() => botSay('cold'), 1500); }
  }
  function onChat(m) {
    if (m && m.kind) {
      if (m.text) Chat.sys(m.text);
      if (Date.now() - (m.t || 0) < 15000) Cafe.event(m);
      return;
    }
    Chat.add(m);
  }

  function enterGame() {
    if (lobbyOff) { lobbyOff(); lobbyOff = null; }
    showScreen('game');
    if (!ensureScene()) { showScreen('lobby'); return false; }
    Sfx.room(true); Music.room(Sfx.on);
    Scene.setPersp(persp());
    Scene.unfold();
    $('#roomChip').textContent = G.mode === 'online' ? `Masa ${G.code}` : isBot() ? ({ kolay: '🤖 Kolay', orta: '🤖 Orta', usta: '🤖 Usta' }[G.botLevel] || '🤖') : 'Aynı cihaz';
    $('#roomChip').onclick = G.mode === 'online' ? invite : null;
    $('#foldCaption').classList.remove('show'); document.body.classList.remove('folded');
    Cafe.mount({
      persp: persp(), local: G.mode === 'local', initDrinks: G.mode !== 'online', names: () => [nameOf(0), nameOf(1)],
      send: (p, t) => { if (G.mode === 'online') Net.setTable(p, t); },
      say: text => { if (G.mode === 'online') Net.chat({ sys: true, text, t: Date.now() }); else Chat.sys(text); },
      event: sendEvent, toast, banner: (a, b) => banner(a, b, 1, 2600), modal: openModal, closeModal, fx: FX
    });
    Chat.mount({
      key: G.mode === 'online' ? Net.myId : 'local',
      send: text => {
        const m = { key: G.mode === 'online' ? Net.myId : 'local', name: G.mode === 'online' ? nameOf(G.me) : '', text, t: Date.now() };
        if (G.mode === 'online') Net.chat(m); else { Chat.add(m); botReply(text); }
      }
    });
    Voice.mount({
      online: G.mode === 'online', seat: G.me, toast,
      send: m => {
        const msg = Object.assign({ key: G.mode === 'online' ? Net.myId : 'local', name: nameOf(G.me), t: Date.now() }, m);
        if (G.mode === 'online') Net.voice(msg); else { Chat.addVoice(msg); if (isBot()) botSay('voice'); }
      },
      onLive: st => { const b = $('#voiceBtn'); b.className = 'icon live-' + st; b.title = { off: 'Sesli sohbet kapalı', waiting: 'Rakip bekleniyor', connecting: 'Bağlanıyor', live: 'Sesli sohbet açık', failed: 'Bağlanamadı' }[st] || ''; }
    });
    $('#voiceBtn').hidden = G.mode !== 'online';
    $('#voiceBtn').className = 'icon live-off';
    Chat.sys(G.mode === 'online' ? `Masa ${G.code} açıldı. Çaylar geliyor.` : isBot() ? `${nameOf(BOT)} masaya oturdu. Çaylar geliyor.` : 'Aynı cihazda oyun başladı. Çaylar geliyor.');
    return true;
  }

  const matchLen = () => { const v = +($('#matchLen') && $('#matchLen').value) || 5; localStorage.setItem('rcp_match', v); return v; };
  function startLocal(n0, n1) {
    G.mode = 'local'; G.me = 0; G.code = null;
    G.names = [n0, n1 || 'Misafir']; G.online = [true, true];
    G.openings = {}; G.openShown = {}; G.openResolved = {}; G.S = null;
    if (!enterGame()) return;
    G.S = Tavla.newState(1, [0, 0], matchLen());
    render(); afterState();
  }

  function startOnline(code, seat) {
    G.mode = 'online'; G.me = seat; G.code = code;
    G.names = ['', '']; G.online = [false, false];
    G.openings = {}; G.openShown = {}; G.openResolved = {}; G.joined = false; G.S = null;
    if (!enterGame()) return;
    history.replaceState(null, '', '?masa=' + code);
    Net.listen({
      players(pl) {
        const had = G.names[1 - G.me];
        [0, 1].forEach(p => { G.names[p] = pl[p] ? pl[p].name : ''; G.online[p] = !!(pl[p] && pl[p].online); });
        const opp = G.names[1 - G.me];
        if (opp && !had) { Chat.sys(`${opp} masaya oturdu.`); Sfx.chat(); }
        if (opp && had && !G.online[1 - G.me] && G.joined) toast(`${opp} bağlantıdan düştü, bekleniyor…`);
        G.joined = !!opp;
        if (G.S) { refreshInteract(); afterState(); }
      },
      state(st) {
        if (!G.S) { G.S = st; render(); if (st.phase === 'over') showResult(); afterState(); return; }
        if (st.v > G.S.v) queue(() => transition(st));
      },
      opening(o) { Object.keys(o).forEach(k => { G.openings[k] = Object.assign({}, G.openings[k], o[k]); }); if (G.S) handleOpening(); },
      table(t) { Cafe.sync(t); },
      chat: onChat,
      voice(m) { Chat.addVoice(m); },
      conn(c) { if (G.conn && !c) toast('Bağlantı koptu, tekrar bağlanılıyor…'); G.conn = c; }
    });
  }

  function leave() {
    closeModal();
    if (G.mode === 'online') Net.leave();
    clearTimeout(botT);
    G.mode = null; G.S = null; Sfx.room(false); Music.room(false); Voice.unmount(); G.autoRoll = false;
    history.replaceState(null, '', location.pathname);
    showScreen('lobby'); lobbyInit();
    if (G.reloadOnLeave) location.reload();
  }

  /* ---------- Lobi ---------- */
  let lobbyOff = null;
  function getName() {
    const v = $('#nameIn').value.trim().slice(0, 16);
    if (!v) { toast('Önce adını yaz, garson kime çay getireceğini bilsin.'); $('#nameIn').focus(); return null; }
    localStorage.setItem('rcp_name', v); return v;
  }
  function lobbyInit() {
    $('#nameIn').value = localStorage.getItem('rcp_name') || '';
    const online = Net.configured();
    $('#onlineBox').hidden = !online; $('#offlineNote').hidden = online;
    const q = new URLSearchParams(location.search).get('masa'); if (q) $('#codeIn').value = q;
    if (lobbyOff) lobbyOff();
    if (online) lobbyOff = Net.lobby(list => {
      const box = $('#roomList');
      if (list === null) { box.innerHTML = '<p class="empty">Masa listesi okunamadı. Firebase kurallarını kontrol et.</p>'; return; }
      const now = Date.now(), rows = list.filter(r => now - (r.created || 0) < 12 * 3600e3 && (r.on0 || r.on1));
      if (!rows.length) { box.innerHTML = '<p class="empty">Şu an açık masa yok. İlk masayı sen aç.</p>'; return; }
      box.innerHTML = rows.map(r => {
        const full = r.guest && r.on1 && r.host && r.on0;
        const who = r.guest ? `${esc(r.host)} ve ${esc(r.guest)}` : `${esc(r.host)} bekliyor`;
        return `<div class="roomRow"><span class="rc">${esc(r.code)}</span><span class="rw">${who}</span>${full ? '<span class="full">Dolu</span>' : `<button class="btn sm" data-c="${esc(r.code)}">Otur</button>`}</div>`;
      }).join('');
      $$('button[data-c]', box).forEach(b => b.onclick = () => join(b.dataset.c));
    });
  }
  function busyLobby(b) { $$('#lobby button').forEach(x => x.disabled = b); }
  async function create() {
    const n = getName(); if (!n) return;
    try { busyLobby(true); const r = await Net.create(n, matchLen()); startOnline(r.code, r.seat); }
    catch (e) { toast(e.message || 'Masa açılamadı'); } finally { busyLobby(false); }
  }
  async function join(code) {
    const n = getName(); if (!n) return;
    code = String(code || $('#codeIn').value).trim();
    if (!/^\d{4}$/.test(code)) { toast('Masa numarası 4 haneli olmalı'); return; }
    try { busyLobby(true); const r = await Net.join(code, n); startOnline(r.code, r.seat); }
    catch (e) { toast(e.message || 'Masaya oturulamadı'); } finally { busyLobby(false); }
  }

  function boot() {
    $('#createBtn').onclick = create;
    $('#joinBtn').onclick = () => join();
    $('#codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
    $('#localBtn').onclick = () => { const n = getName(); if (n) startLocal(n, $('#guestIn').value.trim().slice(0, 16)); };
    $('#botBtn').onclick = () => { const n = getName(); if (n) { localStorage.setItem('rcp_botlv', $('#botLv').value); startBot(n, $('#botLv').value); } };
    $('#botLv').value = localStorage.getItem('rcp_botlv') || 'usta';
    $('#rollBtn').onclick = () => { if (Shake.on && !Shake.asked) { Shake.asked = true; askMotion(); } doRoll(); };
    $('#undoBtn').onclick = doUndo;
    $('#okBtn').onclick = () => { if (G.S && G.S.done && myTurn()) { clearTimeout(endT); endTurn(); } };
    $('#autoBtn').onclick = () => { G.autoRoll = !G.autoRoll; G.autoPlan = null; btoast(G.autoRoll ? 'Otomatik zar açık: zar atılır, taşlar toplanır' : 'Otomatik zar kapalı', 1600); refreshInteract(); if (G.autoRoll) autoRollStep(); };
    $('#voiceBtn').onclick = () => Voice.live.toggle();
    if ($('#matchLen')) $('#matchLen').value = localStorage.getItem('rcp_match') || '5';
    $('#waiterBtn').onclick = () => Cafe.openMenu();
    $('#menuBtn').onclick = openMenu;
    $('#camBtn').onclick = () => { const v = Scene.toggleView(); btoast(v === 'top' ? 'Kamera: üstten' : 'Kamera: oturuş', 1100); };
    $('#sndBtn').onclick = () => { Sfx.toggle(); sndIcon(); Music.room(Sfx.on && !!G.mode); };
    $('#chatBtn').onclick = () => Chat.toggle();
    $('#fsBtn').onclick = async () => {
      try {
        if (!document.fullscreenElement) { await document.documentElement.requestFullscreen(); await screen.orientation.lock('landscape').catch(() => {}); }
        else await document.exitFullscreen();
      } catch (e) { toast('Tam ekran bu tarayıcıda desteklenmiyor'); }
    };
    sndIcon();
    if (innerWidth < 700) document.body.classList.add('chat-closed');
    lobbyInit();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
      let had = !!navigator.serviceWorker.controller, done = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!had) { had = true; return; }
        if (done) return; done = true;
        if (!G.mode) location.reload(); else { G.reloadOnLeave = true; toast('Yeni sürüm indi. Masadan kalkınca yüklenecek.', 3500); }
      });
    }
  }
  window.RCP = { G, toast, onTarget, render, afterState, refreshInteract, rematchTest: () => rematch() };
  boot();
})();
