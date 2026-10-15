/* RCP's-GAMES — ses motoru
 * Dosya yok; her ses fiziksel modellemeyle üretilir:
 *  - Darbe sesleri (ahşap, cam, porselen, zar): modal sentez, yani malzemenin kendi tını frekansları sönümlenerek çalar.
 *  - Sıvı sesleri (yudum, soda): Minnaert baloncuk modeli, frekansı yükselen kısa sinüs taneleri.
 *  - Nefes, üfleme, çakmak: biçimlendirilmiş (formant) gürültü ve tütün çıtırtısı.
 *  - Hepsi küçük bir kahvehane odasının yankısından geçer.
 */
(function () {
  'use strict';
  let ctx = null, bus = null;
  let on = localStorage.getItem('rcp_sound') !== '0';
  let ambOn = localStorage.getItem('rcp_amb') !== '0';
  const R = (a, b) => a + Math.random() * (b - a);

  /* ---------- Ses yolu: kuru + oda yankısı → kompresör → hoparlör ---------- */
  function makeBus(c) {
    const master = c.createGain(); master.gain.value = .85;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .15;
    master.connect(comp); comp.connect(c.destination);
    const conv = c.createConvolver(); conv.buffer = roomIR(c);
    const wet = c.createGain(); wet.gain.value = .32;
    conv.connect(wet); wet.connect(master);
    return { c, master, conv, noise: null, pink: null };
  }
  /** Küçük, ahşap kaplı bir oda: erken yansımalar + 1 saniyelik yumuşak kuyruk */
  function roomIR(c) {
    const len = Math.floor(c.sampleRate * 1.1), b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / c.sampleRate;
        lp += (Math.random() * 2 - 1 - lp) * (0.55 - t * .4);
        d[i] = lp * Math.exp(-t / .22) * .6;
      }
      [.007, .013, .019, .027, .034].forEach((tt, k) => { const i = Math.floor(tt * c.sampleRate) + ch * 7; d[i] += (k % 2 ? -1 : 1) * (.5 - k * .07); });
    }
    return b;
  }
  function noiseBuf() {
    if (bus.noise) return bus.noise;
    const c = bus.c, len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return (bus.noise = b);
  }
  function pinkBuf() {
    if (bus.pink) return bus.pink;
    const c = bus.c, len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
      b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + w * .5362) * .11;
    }
    return (bus.pink = b);
  }

  function init() {
    try {
      if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); bus = makeBus(ctx); }
      if (ctx.state === 'suspended') ctx.resume();
      if (ambOn && on && ambient.wanted) ambient.start();
    } catch (e) { /* ses yoksa sessiz devam */ }
  }
  const ok = () => on && ctx && bus;
  const now = () => bus.c.currentTime;

  /** Bir sesin çıkışı: kuru seviye + yankı payı + stereo konum */
  function voice(g, wet, pan) {
    const c = bus.c, v = c.createGain(); v.gain.value = g;
    let node = v;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; v.connect(p); node = p; }
    node.connect(bus.master);
    if (wet) { const s = c.createGain(); s.gain.value = wet; node.connect(s); s.connect(bus.conv); }
    return v;
  }

  /* ---------- Yapı taşları ---------- */
  /** Gürültü parçası: filtre + zarf (shape verilirse o eğriyi izler) */
  function nz(out, t, o) {
    const { dur = .1, a = .002, g = .5, f = 2000, q = 1, type = 'bandpass', f2 = null, hp = null, pink = false, shape = null } = o || {};
    const c = bus.c, s = c.createBufferSource(); s.buffer = pink ? pinkBuf() : noiseBuf();
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    let n = fl; s.connect(fl);
    if (hp) { const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; fl.connect(h); n = h; }
    const e = c.createGain();
    if (shape) { e.gain.setValueCurveAtTime(new Float32Array(shape.map(x => Math.max(.0001, x * g))), t, dur); }
    else { const at = Math.min(a, dur * .3); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + at); e.gain.exponentialRampToValueAtTime(.0001, t + dur); e.gain.setValueAtTime(0, t + dur + .001); }
    n.connect(e); e.connect(out);
    s.start(t, Math.random() * 1.5, dur + .01);
  }
  /** Modal darbe: [frekans, sönüm süresi, genlik] modları + temas tıkı */
  function strike(out, t, modes, o) {
    const { g = 1, click = .3, clickF = 3000, detune = .015 } = o || {};
    const c = bus.c;
    modes.forEach(([f, d, a]) => {
      const osc = c.createOscillator(), e = c.createGain();
      osc.frequency.value = f * (1 + R(-detune, detune));
      e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(a * g, t + .0015);
      e.gain.exponentialRampToValueAtTime(.0001, t + d);
      osc.connect(e); e.connect(out); osc.start(t); osc.stop(t + d + .02);
    });
    if (click) nz(out, t, { dur: .006, a: .0005, g: click * g, f: clickF, q: .7 });
  }
  /** Minnaert baloncuğu: kısa, frekansı yükselen sinüs (sıvı sesinin temeli) */
  function bubble(out, t, f, g, d) {
    const c = bus.c, o = c.createOscillator(), e = c.createGain();
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * R(1.25, 1.6), t + d);
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + .002); e.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(e); e.connect(out); o.start(t); o.stop(t + d + .01);
  }
  function tone(out, t, o) {
    const { f = 440, f2 = null, dur = .2, g = .2, type = 'sine', a = .01, lp = null, vib = 0 } = o || {};
    const c = bus.c, osc = c.createOscillator(); osc.type = type;
    osc.frequency.setValueAtTime(f, t); if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t + dur);
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = vib; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + .05); }
    const e = c.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + a); e.gain.exponentialRampToValueAtTime(.0005, t + dur);
    let n = osc; if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; osc.connect(fl); n = fl; }
    n.connect(e); e.connect(out); osc.start(t); osc.stop(t + dur + .05);
  }

  /* ---------- Malzemeler: [frekans Hz, sönüm sn, genlik] ---------- */
  const WOOD = [[165, .07, .5], [410, .045, .55], [880, .03, .35], [1530, .02, .22], [2650, .012, .12]];
  const WOOD_BIG = [[95, .16, .6], [230, .11, .5], [520, .07, .3], [1100, .04, .15]];
  const CLACK = [[1180, .03, .4], [2350, .022, .3], [3900, .014, .18], [5600, .008, .1]];
  const BONE = [[1850, .018, .35], [3150, .014, .3], [4750, .01, .2], [6600, .006, .1]];
  const GLASS = [[2870, .45, .32], [4120, .32, .2], [5650, .22, .13], [7350, .14, .08]];
  const PORCELAIN = [[1720, .28, .3], [3380, .2, .2], [5100, .13, .1]];
  const CERAMIC = [[980, .12, .35], [2100, .08, .2], [3500, .05, .1]];
  const BRASS = [[620, .5, .25], [1650, .35, .15], [2950, .25, .1], [4400, .15, .05]];
  const ASHTRAY = [[1900, .14, .25], [3600, .1, .15], [5200, .06, .08]];

  /* ---------- Sesler ---------- */
  const Sfx = {
    init,
    get on() { return on; },
    get ambientOn() { return ambOn; },
    toggle() { on = !on; localStorage.setItem('rcp_sound', on ? '1' : '0'); if (on) { init(); if (ambOn && ambient.wanted) ambient.start(); } else ambient.stop(); return on; },
    setAmbient(v) { ambOn = v; localStorage.setItem('rcp_amb', v ? '1' : '0'); if (v && on && ambient.wanted) { init(); ambient.start(); } else ambient.stop(); },
    /** Oyun ekranına girince ortam sesi başlar, lobiye dönünce susar */
    room(v) { ambient.wanted = v; if (v && ambOn && on && ctx) ambient.start(); else ambient.stop(); },

    /** Zar: avuçta çarpışma, tahtaya düşüş ve iki sekme, sonunda kısa sürtünme (animasyonla aynı zamanlama) */
    roll(n) {
      if (!ok()) return; const t = now(), o = voice(.8, .35);
      for (let i = 0; i < 6; i++) strike(o, t + i * .035 + R(0, .015), BONE, { g: R(.12, .25), click: .15, clickF: 5000 });
      const hits = [[.483, 1], [.759, .55], [.943, .28]];
      for (let d = 0; d < (n || 2); d++) {
        const off = d * R(.012, .03);
        hits.forEach(([tt, k]) => { strike(o, t + tt + off, BONE, { g: .7 * k, click: .5 * k, clickF: 4200 }); strike(o, t + tt + off, WOOD, { g: .45 * k, click: 0 }); });
        nz(o, t + .96 + off, { dur: .16, g: .05, f: 2600, q: .8 });
      }
    },
    single() { Sfx.roll(1); },
    pick() { if (!ok()) return; strike(voice(.5, .15), now(), CLACK, { g: .18, click: .12, clickF: 5000 }); },
    /** Pul tahtaya ya da başka pulun üstüne iner */
    place(onStack) {
      if (!ok()) return; const t = now(), o = voice(.9, .25);
      if (onStack) { strike(o, t, CLACK, { g: .7, click: .4 }); strike(o, t, WOOD, { g: .35, click: 0 }); }
      else strike(o, t, WOOD, { g: .9, click: .35, clickF: 2400 });
      nz(o, t + .004, { dur: .05, g: .05, f: 900, q: .7 });
    },
    hit() {
      if (!ok()) return; const t = now(), o = voice(1, .3);
      strike(o, t, CLACK, { g: 1.1, click: .6 }); strike(o, t, WOOD, { g: .7, click: 0 });
      strike(o, t + .018, CLACK, { g: .5, click: .2 });
      nz(o, t + .03, { dur: .28, g: .08, f: 700, f2: 2400, q: .9 });
    },
    off() {
      if (!ok()) return; const t = now(), o = voice(.8, .25);
      strike(o, t, WOOD, { g: .6, click: .25 }); strike(o, t + .045, WOOD, { g: .25, click: .1 });
      nz(o, t + .05, { dur: .12, g: .04, f: 1400, q: .8 });
    },
    tick() { if (!ok()) return; strike(voice(.4, .05), now(), [[2400, .05, .2], [4800, .03, .1]], { g: .5, click: 0 }); },

    /** Bardak kalkarken kaşığın bardağa hafifçe değmesi, fincan/kupa tabaktan ayrılırken ince tık */
    lift(kind, far) {
      if (!ok()) return; const t = now(), o = voice(far ? .3 : .5, .25, far ? -.4 : 0);
      if (kind === 'glass') { strike(o, t + .05, [[6200, .09, .15], [8400, .06, .08]], { g: .5, click: .05, clickF: 7000 }); strike(o, t + .14, [[6000, .07, .1]], { g: .35, click: 0 }); }
      else strike(o, t, kind === 'porcelain' ? PORCELAIN : CERAMIC, { g: .12, click: .05 });
    },
    /** Yudum: dudaktan çekilen hava + sıvı baloncukları + yutkunma */
    sip(kind, far) {
      if (!ok()) return; const t = now(), o = voice(far ? .45 : 1.1, .08, far ? -.4 : 0);
      const fizz = kind === 'soda' || kind === 'kola', cold = fizz || kind === 'icetea', hot = !cold;
      // dudaktan çekilen hava: dar, yumuşak bir "şüüp"
      nz(o, t, { dur: .5, g: hot ? .075 : .04, f: 1500, q: 2.4, pink: true, shape: [0, .3, .7, 1, .85, .5, .15, 0] });
      nz(o, t + .05, { dur: .35, g: hot ? .025 : .015, f: 3000, q: 4, shape: [0, .6, 1, .5, 0] });
      // sıvı: baloncuklar ve şırıltı
      const nB = fizz ? 110 : kind === 'kahve' ? 45 : 70;
      for (let i = 0; i < nB; i++) {
        const u = Math.random(), tt = t + .06 + u * .4;
        const f = fizz ? R(2400, 6000) : R(500, 1500) * (1 + u * .3);
        bubble(o, tt, f, R(.04, .14) * (kind === 'kahve' ? .7 : 1), R(.01, .03));
      }
      if (fizz) nz(o, t, { dur: .9, g: .04, f: 6500, q: .6, hp: 3000, shape: [0, 1, .8, .6, .3, 0] });
      if (cold) for (let i = 0; i < 3; i++) strike(o, t + .1 + i * R(.08, .14), [[R(2600, 3400), .2, .2], [R(4800, 5600), .12, .1]], { g: .25, click: .1, clickF: 6000 });
      // yutkunma: boğuk, kısa
      tone(o, t + .7, { f: 160, f2: 85, dur: .11, g: .09, a: .012 });
      nz(o, t + .7, { dur: .08, g: .05, f: 320, q: 2 });
      // "oh" diye keyifli nefes
      if (hot && !far) nz(o, t + .95, { dur: .5, g: .03, f: 650, q: 1.6, pink: true, shape: [0, .6, 1, .7, .3, 0] });
    },
    /** İçecek tabağa / masaya bırakılır */
    setDown(kind, far) {
      if (!ok()) return; const t = now(), o = voice(far ? .45 : .9, .35, far ? -.4 : 0);
      if (kind === 'glass') {
        strike(o, t, GLASS, { g: .55, click: .25, clickF: 5000 }); strike(o, t, PORCELAIN, { g: .25, click: 0 });
        strike(o, t + .016, GLASS, { g: .2, click: .1, clickF: 5000 });
      } else if (kind === 'porcelain') {
        strike(o, t, PORCELAIN, { g: 1.1, click: .45 }); strike(o, t + .012, PORCELAIN, { g: .4, click: .15 });
      } else if (kind === 'ceramic') {
        strike(o, t, CERAMIC, { g: 1.2, click: .35 }); strike(o, t, WOOD, { g: .3, click: 0 });
      } else if (kind === 'plate') {
        strike(o, t, PORCELAIN, { g: .8, click: .3 }); strike(o, t, WOOD, { g: .4, click: 0 });
      } else { strike(o, t, GLASS, { g: .4, click: .2 }); strike(o, t, WOOD, { g: .35, click: 0 }); }
    },
    /** Isırık: çıtır kabuk + çiğneme (tost daha çıtır, sosisli daha yumuşak) */
    bite(kind, far) {
      if (!ok()) return; const t = now(), o = voice(far ? .45 : 1.3, .08, far ? -.4 : 0), crisp = kind === 'tost' ? 1 : .45;
      for (let i = 0; i < 14; i++) { const tt = t + Math.pow(Math.random(), 1.5) * .28; nz(o, tt, { dur: R(.004, .012), g: R(.08, .3) * crisp, f: R(1800, 5200), q: R(.8, 2) }); }
      nz(o, t, { dur: .12, g: .1, f: 600, q: .8, pink: true });
      [.45, .78, 1.1, 1.42].forEach((d, i) => nz(o, t + d, { dur: .18, g: .06 / (1 + i * .3), f: 420, q: 1.2, pink: true, shape: [0, .7, 1, .5, .1, 0] }));
    },
    /** Garson tepsiyi getirip bardağı bırakır */
    serve(kind) { if (!ok()) return; strike(voice(.9, .35, .3), now(), BRASS, { g: .3, click: .12 }); Sfx.setDown(kind); },
    clink() { if (!ok()) return; strike(voice(.7, .35), now(), GLASS, { g: .6, click: .2 }); },
    ice() {
      if (!ok()) return; const t = now(), o = voice(.8, .3);
      [0, .08, .19, .26, .41, .5].forEach((d, i) => {
        strike(o, t + d, [[R(2600, 3400), .25, .25], [R(4800, 5600), .15, .15]], { g: .6 / (1 + i * .25), click: .2, clickF: 6000 });
        strike(o, t + d + .004, [[R(1300, 1700), .03, .2]], { g: .4, click: 0 });
      });
    },
    flip() { if (!ok()) return; strike(voice(.6, .25), now(), PORCELAIN, { g: .15, click: .05 }); },

    /** Çakmak: çark sürtünmesi, çakmaktaşı kıvılcımı, gaz ve alevin tutuşması */
    lighter() {
      if (!ok()) return; const t = now(), o = voice(3, .15, .35);
      for (let i = 0; i < 26; i++) nz(o, t + i * .0011 + R(0, .0006), { dur: .004, g: R(.08, .3), f: R(3500, 7000), q: 2 });
      strike(o, t + .03, [[3100, .05, .12], [5400, .03, .08]], { g: .5, click: 0 });
      nz(o, t + .04, { dur: .55, g: .05, f: 6500, q: 1.5, shape: [0, 1, .9, .8, .5, 0] });
      nz(o, t + .07, { dur: .16, g: .14, f: 320, q: .7, type: 'lowpass' });
    },
    /** Nefes çekiş: dudak/nefes formantı + yanan tütünün çıtırtısı */
    inhale() {
      if (!ok()) return; const t = now(), o = voice(2.4, .06, .1), D = 1.0;
      nz(o, t, { dur: D, g: .09, f: 650, q: 1.8, pink: true, shape: [0, .4, .7, .9, 1, .95, .6, 0] });
      nz(o, t, { dur: D, g: .03, f: 1900, q: 3, pink: true, shape: [0, .4, .7, .9, .8, .5, 0] });
      for (let i = 0; i < 70; i++) {
        const u = Math.pow(Math.random(), .8), tt = t + .08 + u * (D - .15);
        nz(o, tt, { dur: R(.0015, .004), g: R(.03, .16) * (.4 + u), f: R(3500, 8000), q: R(1, 3) });
        if (Math.random() < .12) nz(o, tt, { dur: .006, g: R(.08, .18), f: R(1200, 2200), q: 2 });
      }
    },
    /** Dumanı üfleme: "fffhh" sürtünmesi ve gövdeli nefes */
    exhale() {
      if (!ok()) return; const t = now(), o = voice(1.6, .15), D = 1.8;
      nz(o, t, { dur: D, g: .15, f: 1000, q: 1.1, pink: true, shape: [0, .8, 1, .9, .75, .55, .38, .22, .1, .03, 0] });
      nz(o, t, { dur: D * .8, g: .045, f: 2600, q: 1.8, pink: true, shape: [0, .9, 1, .7, .4, .15, 0] });
      nz(o, t, { dur: D * .6, g: .07, f: 380, q: 1, pink: true, shape: [0, .7, 1, .6, .2, 0] });
    },
    /** Sigara küllüğe bırakılınca camın ince tıkı */
    ashTap() { if (!ok()) return; strike(voice(2.5, .3, .35), now(), ASHTRAY, { g: .5, click: .2 }); },
    puff() { Sfx.exhale(); },

    chat() { if (!ok()) return; const t = now(), o = voice(.35, .1); tone(o, t, { f: 1046, dur: .12, g: .2 }); tone(o, t + .09, { f: 1568, dur: .18, g: .18 }); },
    cheer(level) {
      if (!ok()) return; const t = now(), o = voice(.55, .3);
      const notes = level >= 3 ? [523, 659, 784, 1047, 1319, 1568] : [587, 740, 880, 1175];
      notes.forEach((f, i) => tone(o, t + i * .075, { f, dur: .5, g: .14, type: 'triangle', lp: 4000 }));
      if (level >= 3) for (let i = 0; i < 10; i++) strike(o, t + .45 + i * .06, GLASS, { g: .12, click: 0 });
    },
    win() {
      if (!ok()) return; const t = now(), o = voice(.55, .35);
      [523, 659, 784, 1047].forEach((f, i) => tone(o, t + i * .13, { f, dur: .4, g: .16, type: 'triangle', lp: 3500 }));
      [523, 659, 784, 1047].forEach(f => tone(o, t + .62, { f, dur: 1.4, g: .07, type: 'triangle', lp: 3000 }));
    },
    lose() {
      if (!ok()) return; const t = now(), o = voice(.55, .3);
      [392, 370, 349].forEach((f, i) => tone(o, t + i * .36, { f, dur: .34, g: .14, type: 'sawtooth', lp: 1000 }));
      tone(o, t + 1.08, { f: 330, f2: 300, dur: 1.0, g: .14, type: 'sawtooth', lp: 900, vib: 8 });
    },
    /** Tahta kapanırken menteşe gıcırtısı ve kapağın oturması (katlanma animasyonuyla aynı anda) */
    fold() {
      if (!ok()) return; const t = now(), o = voice(.9, .35);
      let tt = t + .1;
      for (let i = 0; i < 40; i++) { tt += Math.max(.008, .03 - i * .0005) * R(.7, 1.3); strike(o, tt, [[R(700, 1100), .025, .2]], { g: .12, click: .08, clickF: 1500 }); }
      strike(o, t + 1.3, WOOD_BIG, { g: 1, click: .5, clickF: 1800 });
      strike(o, t + 1.33, WOOD, { g: .4, click: .2 });
    },
    whoosh() { if (!ok()) return; nz(voice(2, .2), now(), { dur: .7, g: .12, f: 300, f2: 1800, q: .8, pink: true, shape: [0, .5, 1, .7, .3, 0] }); },

    /** Müzik ve sesli mesaj için ortak ses yolu */
    audio() { init(); return ctx && bus ? { ctx, master: bus.master, conv: bus.conv } : null; },

    /** Test için: bir sesi çevrimdışı çalıp örneklerini döndürür */
    async _render(name, args, dur) {
      const off = new OfflineAudioContext(2, Math.floor(44100 * (dur || 2)), 44100);
      const keep = { ctx, bus, on }; ctx = off; bus = makeBus(off); on = true;
      try { Sfx[name].apply(Sfx, args || []); } finally { ctx = keep.ctx; bus = keep.bus; on = keep.on; }
      const buf = await off.startRendering();
      return Array.from(buf.getChannelData(0));
    }
  };

  /* ---------- Kahvehane ortamı: oda uğultusu, uzaktan bardak, kaşık, zar, pul sesleri ---------- */
  const ambient = (() => {
    let tm = null, hum = null;
    const api = { wanted: false, start, stop };
    function start() {
      if (!ctx || tm || !api.wanted) return;
      const c = ctx, s = c.createBufferSource(); s.buffer = pinkBuf(); s.loop = true;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      const g = c.createGain(); g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(.06, c.currentTime + 3);
      s.connect(lp); lp.connect(g); g.connect(bus.master); s.start();
      hum = { s, g };
      const next = () => { tm = setTimeout(() => { event(); next(); }, R(2500, 7000)); };
      next();
    }
    function stop() {
      clearTimeout(tm); tm = null;
      if (hum && ctx) { try { hum.g.gain.linearRampToValueAtTime(0, ctx.currentTime + .5); hum.s.stop(ctx.currentTime + .6); } catch (e) {} }
      hum = null;
    }
    function event() {
      if (!ok() || document.hidden) return;
      const t = now(), o = voice(R(.07, .14), .9, R(-.8, .8)), k = Math.random();
      if (k < .4) { strike(o, t, GLASS, { g: .5, click: .2 }); strike(o, t, PORCELAIN, { g: .2, click: 0 }); }
      else if (k < .65) { for (let i = 0; i < 4; i++) strike(o, t + i * R(.11, .15), [[R(5500, 6500), .08, .2]], { g: .4, click: .1, clickF: 7000 }); }
      else if (k < .85) { [0, .22, .38].forEach((d, i) => { strike(o, t + d, BONE, { g: .6 / (i + 1), click: .3 }); strike(o, t + d, WOOD, { g: .3 / (i + 1), click: 0 }); }); }
      else { for (let i = 0; i < 3; i++) strike(o, t + i * .09, WOOD, { g: .5, click: .2 }); }
    }
    return api;
  })();
  document.addEventListener('visibilitychange', () => { if (document.hidden) ambient.stop(); else if (ambOn && on && ctx) ambient.start(); });

  window.Sfx = Sfx;
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, init, { passive: true }));
})();
