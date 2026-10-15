/* RCP's-GAMES — arka plan müziği
 * Kayıt yok; müzik her an yeniden üretilir:
 *  - Ud: Karplus-Strong telli çalgı modeli, Hicaz makamında (Re karar) kısa doğaçlama cümleler.
 *  - Dem: Re ve La'da çok kısık, yavaş nefes alan bir taban.
 *  - Def: arada bir yumuşak "düm" ve "tek".
 * Tempo yavaş, ses kısık; oyunun önüne geçmez.
 */
(function () {
  'use strict';
  let on = localStorage.getItem('rcp_music') !== '0';
  let wanted = false, A = null, out = null, timer = null, nextT = 0, bufs = {}, drone = null;
  const BPM = 64, BEAT = 60 / BPM;
  // Hicaz (Re): Re, Mi♭(biraz pes), Fa#, Sol, La, Si♭, Do, Re + üst oktav
  const SC = [146.83, 154.5, 185.0, 196.0, 220.0, 233.08, 261.63, 293.66, 309.0, 369.99, 392.0, 440.0];
  const R = (a, b) => a + Math.random() * (b - a);

  /** Karplus-Strong: gürültüyle başlayan, ortalama alınarak sönen tel */
  function pluck(f) {
    const c = A.ctx, sr = c.sampleRate, len = Math.floor(sr * 2.6), b = c.createBuffer(1, len, sr), d = b.getChannelData(0);
    const N = Math.max(2, Math.round(sr / f)), buf = new Float32Array(N);
    let prev = 0;
    for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; prev = prev * .45 + w * .55; buf[i] = prev; }
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const a = buf[idx], nb = buf[(idx + 1) % N];
      const v = .4985 * (a + nb);
      d[i] = a; buf[idx] = v; idx = (idx + 1) % N;
    }
    // gövde rezonansı için hafif kenar yumuşatma
    for (let i = 0; i < 200; i++) d[i] *= i / 200;
    return b;
  }
  function note(i, t, g, dur) {
    if (!bufs[i]) bufs[i] = pluck(SC[i]);
    const c = A.ctx, s = c.createBufferSource(); s.buffer = bufs[i];
    const e = c.createGain(); e.gain.setValueAtTime(g, t); e.gain.setTargetAtTime(0, t + dur, .25);
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    s.connect(e);
    if (p) { p.pan.value = R(-.25, .25); e.connect(p); p.connect(out); } else e.connect(out);
    s.start(t); s.stop(t + dur + 1.2);
  }
  function def(t, low) {
    const c = A.ctx, e = c.createGain();
    if (low) {
      const o = c.createOscillator(); o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(48, t + .25);
      e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(.32, t + .006); e.gain.exponentialRampToValueAtTime(.0005, t + .4);
      o.connect(e); e.connect(out); o.start(t); o.stop(t + .45);
    } else {
      const s = c.createBufferSource(), len = Math.floor(c.sampleRate * .06), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * .18));
      s.buffer = b;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 1.2;
      e.gain.value = .12; s.connect(f); f.connect(e); e.connect(out); s.start(t);
    }
  }

  let deg = 0, phrase = 0;
  /** Bir ölçülük (4 vuruş) müzik yaz */
  function bar(t0) {
    // def: düm . tek . | düm düm tek .
    const pat = phrase % 2 ? [[0, 1], [1.5, 0], [2, 1], [2.5, 1], [3, 0]] : [[0, 1], [1, 0], [2, 1], [3, 0]];
    if (Math.random() < .85) pat.forEach(([b, low]) => def(t0 + b * BEAT, low));
    // ud cümlesi
    let b = 0;
    const end = phrase % 4 === 3;
    while (b < 4) {
      if (Math.random() < .14) { b += .5; continue; }
      const step = [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)];
      deg = Math.max(0, Math.min(SC.length - 1, deg + step));
      let len = [.5, .5, 1, 1, 1.5][Math.floor(Math.random() * 5)];
      if (b + len > 4) len = 4 - b;
      if (end && b + len >= 4) deg = Math.random() < .5 ? 0 : 7;
      const t = t0 + b * BEAT;
      if (len >= 1 && Math.random() < .22) { for (let k = 0; k < 4; k++) note(deg, t + k * BEAT / 4, .16, BEAT / 4); }
      else note(deg, t, R(.2, .3), len * BEAT);
      b += len;
    }
    phrase++;
  }
  function startDrone() {
    const c = A.ctx, g = c.createGain(); g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(.05, c.currentTime + 4);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const os = [73.42, 110, 146.83].map((f, i) => { const o = c.createOscillator(); o.type = i === 2 ? 'sine' : 'triangle'; o.frequency.value = f * (1 + R(-.002, .002)); o.connect(lp); o.start(); return o; });
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .07; lg.gain.value = .02; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    lp.connect(g); g.connect(out);
    drone = { g, os: os.concat([lfo]) };
  }
  function start() {
    if (timer || !on || !wanted) return;
    A = window.Sfx && Sfx.audio(); if (!A) return;
    out = A.ctx.createGain(); out.gain.value = 0;
    out.gain.linearRampToValueAtTime(.38, A.ctx.currentTime + 3);
    out.connect(A.master);
    const send = A.ctx.createGain(); send.gain.value = .5; out.connect(send); send.connect(A.conv);
    startDrone();
    nextT = A.ctx.currentTime + .3;
    timer = setInterval(() => { if (document.hidden) return; while (nextT < A.ctx.currentTime + 1.5) { bar(nextT); nextT += 4 * BEAT; } }, 300);
  }
  function stop() {
    clearInterval(timer); timer = null;
    if (A && out) {
      const t = A.ctx.currentTime, o = out, d = drone;
      o.gain.cancelScheduledValues(t); o.gain.setValueAtTime(o.gain.value, t); o.gain.linearRampToValueAtTime(0, t + .8);
      setTimeout(() => { try { if (d) d.os.forEach(x => x.stop()); o.disconnect(); } catch (e) {} }, 1000);
    }
    out = null; drone = null;
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  window.addEventListener('pointerdown', () => { if (wanted && on && !timer) start(); }, { passive: true });

  window.Music = {
    get on() { return on; },
    setOn(v) { on = v; localStorage.setItem('rcp_music', v ? '1' : '0'); if (v) start(); else stop(); },
    room(v) { wanted = v; if (v) start(); else stop(); }
  };
})();
