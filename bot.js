/* RCP's-GAMES — bilgisayar rakip
 * O turdaki bütün geçerli hamle dizilerini çıkarır, sonuçtaki her pozisyonu puanlar, en iyisini oynar.
 * Puanlama: pip farkı, kırık taşlar, yapılmış kapılar (özellikle evde), art arda kapılar (kuşatma),
 * rakip evinde çapa, açık taşların vurulma riski, toplanan taşlar. Yarış başlayınca sadece hız önemli.
 */
(function () {
  'use strict';
  const key = s => s.board.join(',') + '|' + s.bar.join(',') + '|' + s.off.join(',');

  function sequences(s) {
    const out = [], seen = new Set(), visited = new Set();
    let nodes = 0;
    (function rec(st, path) {
      if (nodes++ > 4000) return;
      const L = Tavla.legalMoves(st);
      if (!L.length) { const k = key(st); if (!seen.has(k)) { seen.add(k); out.push({ path, st }); } return; }
      const tried = new Set();
      for (const m of L) {
        const mk = m.from + '>' + m.to + '>' + m.die; if (tried.has(mk)) continue; tried.add(mk);
        const n = Tavla.applyMove(st, m).state;
        const nk = key(n) + '|' + n.left.join('');
        if (visited.has(nk)) continue; visited.add(nk);
        if (n.off[st.turn] === 15) { out.push({ path: path.concat([m]), st: n, win: true }); continue; }
        rec(n, path.concat([m]));
      }
    })(s, []);
    return out;
  }

  function evaluate(s, p) {
    const o = 1 - p, b = s.board;
    const me = i => (p === 0 ? (b[i] > 0 ? b[i] : 0) : (b[i] < 0 ? -b[i] : 0));
    const op = i => (p === 0 ? (b[i] < 0 ? -b[i] : 0) : (b[i] > 0 ? b[i] : 0));
    const rel = i => (p === 0 ? i : 23 - i);          // 0..5 = kendi evim
    const pipMe = Tavla.pips(s, p), pipOp = Tavla.pips(s, o);
    let sc = (pipOp - pipMe) * .55 + (s.off[p] - s.off[o]) * 4;
    sc += s.bar[o] * 13 - s.bar[p] * 13;
    if (Tavla.noContact(s)) return (pipOp - pipMe) * 1.2 + s.off[p] * 9;

    let run = 0, best = 0;
    for (let r = 0; r < 24; r++) {
      const i = p === 0 ? r : 23 - r, c = me(i);
      if (c >= 2) {
        sc += r <= 5 ? 3.2 : r <= 11 ? 1.7 : r >= 18 ? 1.9 : .8;
        run++; best = Math.max(best, run);
      } else run = 0;
      if (c > 4) sc -= (c - 4) * .7;
    }
    if (best >= 3) sc += (best - 2) * (best - 2) * 2.2;
    // rakip kırık taşı varken evimdeki kapılar çok değerli
    if (s.bar[o]) { let closed = 0; for (let r = 0; r < 6; r++) { const i = p === 0 ? r : 23 - r; if (me(i) >= 2) closed++; } sc += closed * closed * .9; }

    for (let i = 0; i < 24; i++) {
      if (me(i) !== 1) continue;
      const r = rel(i);
      let shots = 0;
      for (let j = 0; j < 24; j++) {
        if (!op(j)) continue;
        const d = p === 0 ? i - j : j - i;
        if (d >= 1 && d <= 6) shots += 2; else if (d >= 7 && d <= 12) shots += 1;
      }
      if (s.bar[o]) { const d = p === 0 ? i + 1 : 24 - i; if (d >= 1 && d <= 6) shots += 2 * s.bar[o]; else if (d <= 12) shots += 1; }
      sc -= Math.min(shots, 8) * (.45 + (24 - r) / 36);
    }
    return sc;
  }

  /** Bu tur oynanacak hamleleri sırayla döndürür. level: 'kolay' | 'orta' | 'usta' */
  function plan(s, level) {
    const seqs = sequences(s);
    if (!seqs.length) return [];
    const win = seqs.find(x => x.win); if (win) return win.path;
    const p = s.turn;
    let best = null, bestSc = -Infinity;
    seqs.forEach(x => {
      let sc = evaluate(x.st, p);
      if (level === 'kolay') sc += (Math.random() - .5) * 22;
      else if (level === 'orta') sc += (Math.random() - .5) * 9;
      if (sc > bestSc) { bestSc = sc; best = x; }
    });
    return best.path;
  }

  window.Bot = { plan, evaluate, sequences };
})();
