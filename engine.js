/* RCP's-GAMES Tavla — kural motoru
 * Tahta: 24 hane (0..23). Pozitif = Oyuncu 0 (Beyaz), negatif = Oyuncu 1 (Siyah).
 * Oyuncu 0: 23 -> 0 yönünde ilerler, evi 0..5.
 * Oyuncu 1: 0 -> 23 yönünde ilerler, evi 18..23.
 */
(function (global) {
  'use strict';

  function initialBoard() {
    const b = new Array(24).fill(0);
    b[23] = 2; b[12] = 5; b[7] = 3; b[5] = 5;
    b[0] = -2; b[11] = -5; b[16] = -3; b[18] = -5;
    return b;
  }

  function newState(game, score, target) {
    return {
      v: 1, game: game || 1,
      board: initialBoard(), bar: [0, 0], off: [0, 0],
      turn: 0, phase: 'opening', openRound: 0,
      dice: [], diceP: null, left: [],
      last: { type: 'new' },
      winner: null, mars: false,
      score: score ? score.slice() : [0, 0],
      target: target || 5
    };
  }

  const own = (b, i, p) => (p === 0 ? b[i] > 0 : b[i] < 0);
  const blocked = (b, i, p) => (p === 0 ? b[i] <= -2 : b[i] >= 2);
  const blot = (b, i, p) => (p === 0 ? b[i] === -1 : b[i] === 1);
  const uniq = a => [...new Set(a)];

  function allHomeB(b, bar, p) {
    if (bar[p]) return false;
    if (p === 0) { for (let i = 6; i < 24; i++) if (b[i] > 0) return false; }
    else { for (let i = 0; i < 18; i++) if (b[i] < 0) return false; }
    return true;
  }

  function movesForDie(b, bar, p, d) {
    const res = [];
    if (bar[p] > 0) {
      const t = p === 0 ? 24 - d : d - 1;
      if (!blocked(b, t, p)) res.push({ from: 'bar', to: t, die: d });
      return res;
    }
    const home = allHomeB(b, bar, p);
    for (let i = 0; i < 24; i++) {
      if (!own(b, i, p)) continue;
      const t = p === 0 ? i - d : i + d;
      if (t >= 0 && t < 24) {
        if (!blocked(b, t, p)) res.push({ from: i, to: t, die: d });
      } else if (home) {
        const exact = p === 0 ? t === -1 : t === 24;
        if (exact) { res.push({ from: i, to: 'off', die: d }); continue; }
        // Büyük zarla toplama: daha geride taş yoksa serbest
        let further = false;
        if (p === 0) { for (let j = i + 1; j <= 5; j++) if (b[j] > 0) { further = true; break; } }
        else { for (let j = i - 1; j >= 18; j--) if (b[j] < 0) { further = true; break; } }
        if (!further) res.push({ from: i, to: 'off', die: d });
      }
    }
    return res;
  }

  function applyLight(pos, m) {
    const b = pos.b.slice(), bar = pos.bar.slice(), off = pos.off.slice(), left = pos.left.slice();
    const p = pos.p, sg = p === 0 ? 1 : -1;
    if (m.from === 'bar') bar[p]--; else b[m.from] -= sg;
    if (m.to === 'off') off[p]++;
    else {
      if (blot(b, m.to, p)) { b[m.to] = 0; bar[1 - p]++; }
      b[m.to] += sg;
    }
    left.splice(left.indexOf(m.die), 1);
    return { b, bar, off, left, p };
  }

  function maxDepth(pos, memo) {
    if (!pos.left.length) return 0;
    const key = pos.b.join(',') + '|' + pos.bar.join(',') + '|' + pos.left.join('');
    if (memo.has(key)) return memo.get(key);
    let best = 0;
    outer:
    for (const d of uniq(pos.left)) {
      for (const m of movesForDie(pos.b, pos.bar, pos.p, d)) {
        const r = 1 + maxDepth(applyLight(pos, m), memo);
        if (r > best) { best = r; if (best === pos.left.length) break outer; }
      }
    }
    memo.set(key, best);
    return best;
  }

  /** Şu an oynanabilecek tek adımlık hamleler (azami zar kullanımı ve büyük zar kuralıyla) */
  function legalMoves(s) {
    const left = s.left || [];
    if (!left.length || s.phase !== 'move') return [];
    const pos = { b: s.board, bar: s.bar, off: s.off, left, p: s.turn };
    const memo = new Map();
    const total = maxDepth(pos, memo);
    if (!total) return [];
    let c = [];
    for (const d of uniq(left)) {
      for (const m of movesForDie(pos.b, pos.bar, pos.p, d)) {
        if (1 + maxDepth(applyLight(pos, m), memo) === total) c.push(m);
      }
    }
    // Son taşı toplayan hamle oyunu bitirir, her zaman geçerli
    if (s.off[s.turn] === 14) {
      for (const d of uniq(left)) for (const m of movesForDie(pos.b, pos.bar, pos.p, d)) {
        if (m.to === 'off' && !c.some(x => x.from === m.from && x.to === 'off' && x.die === m.die)) c.push(m);
      }
    }
    if (total === 1 && left.length === 2 && left[0] !== left[1]) {
      const hi = Math.max(...left);
      const h = c.filter(m => m.die === hi);
      if (h.length) c = h;
    }
    return c;
  }

  function applyMove(s, m) {
    const n = JSON.parse(JSON.stringify(s));
    const p = n.turn, sg = p === 0 ? 1 : -1;
    let hit = false;
    if (m.from === 'bar') n.bar[p]--; else n.board[m.from] -= sg;
    if (m.to === 'off') n.off[p]++;
    else {
      if (blot(n.board, m.to, p)) { n.board[m.to] = 0; n.bar[1 - p]++; hit = true; }
      n.board[m.to] += sg;
    }
    const k = n.left.indexOf(m.die);
    if (k >= 0) n.left.splice(k, 1);
    return { state: n, hit };
  }

  function pips(s, p) {
    let t = s.bar[p] * 25;
    for (let i = 0; i < 24; i++) {
      if (p === 0 && s.board[i] > 0) t += s.board[i] * (i + 1);
      if (p === 1 && s.board[i] < 0) t += -s.board[i] * (24 - i);
    }
    return t;
  }

  function noContact(s) {
    if (s.bar[0] || s.bar[1]) return false;
    let max0 = -1, min1 = 24;
    for (let i = 0; i < 24; i++) {
      if (s.board[i] > 0) max0 = Math.max(max0, i);
      if (s.board[i] < 0) min1 = Math.min(min1, i);
    }
    return max0 < min1;
  }

  const NUM = { 1: 'Yek', 2: 'Dü', 3: 'Se', 4: 'Cihar', 5: 'Penç', 6: 'Şeş' };
  const DOUBLE = { 1: 'Hepyek', 2: 'Dubara', 3: 'Düse', 4: 'Dörtcihar', 5: 'Dübeş', 6: 'Düşeş' };
  function diceName(a, b) {
    if (a === b) return DOUBLE[a];
    const h = Math.max(a, b), l = Math.min(a, b);
    if (h === 6 && l === 5) return 'Şeşbeş';
    return NUM[h] + ' ' + NUM[l];
  }
  /** 0 sakin, 1 güzel, 2 coşku, 3 düşeş çılgınlığı */
  function excite(a, b) {
    if (a === 6 && b === 6) return 3;
    if ((a === b && a >= 4) || a + b === 11) return 2;
    if (a === b || a + b >= 9) return 1;
    return 0;
  }

  global.Tavla = {
    newState, legalMoves, applyMove, pips, noContact,
    allHome: (s, p) => allHomeB(s.board, s.bar, p),
    diceName, excite
  };
})(typeof window !== 'undefined' ? window : globalThis);
