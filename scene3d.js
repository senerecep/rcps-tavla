/* RCP's-GAMES — 3D masa (Three.js r128)
 * Gerçekçi görünüm: ortam yansıması (PMREM), cilalı ahşap (clearcoat), yuvarlak kenarlı pullar ve zarlar,
 * pahlı (bevel) çerçeve, tek parça ceviz masa. Koordinatlar 1000x700 birimlik tahta düzeninden S ölçeğiyle gelir.
 */
(function () {
  'use strict';
  const T = window.THREE;
  if (!T) { window.Scene = null; return; }

  const S = 0.015, CH = 0.17, R = 0.42, RIM = 0.26, BASE = 0.42, PW = 410 / 6, DU = 58, DIE = 0.56;
  const TY = -BASE;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer, scene, camera, stage;
  let quality = localStorage.getItem('rcp_q') || 'high';
  let view = localStorage.getItem('rcp_view') || 'seated';
  let persp = 0;
  let boardG, leftG, rightPivot, rightG, barG, hlG, pickG;
  const pickables = [];
  let onPick = () => {};
  const camBase = { pos: new T.Vector3(), target: new T.Vector3() };
  let shakeT = 0, camPitch = 0, dolly = { v: new T.Vector3(), amt: 0 };
  let last = performance.now();

  /* ---------- Tween ---------- */
  const tweens = [];
  const EIO = t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const EO = t => 1 - Math.pow(1 - t, 3);
  const LIN = t => t;
  function tween(dur, fn, ease) {
    if (reduce) dur = Math.min(dur, 0.12);
    return new Promise(res => tweens.push({ s: performance.now(), d: Math.max(1, dur * 1000), fn, ease: ease || EIO, res }));
  }
  const wait = ms => new Promise(r => setTimeout(r, reduce ? Math.min(ms, 100) : ms));
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- Dokular ---------- */
  function ctex(w, h, draw, rep, linear) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    if (!linear) t.encoding = T.sRGBEncoding;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (rep) t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }
  function dX(d) {
    if (d <= 5) return 530 + (5 - d + 0.5) * PW;
    if (d <= 11) return 60 + (11 - d + 0.5) * PW;
    if (d <= 17) return 60 + (d - 12 + 0.5) * PW;
    return 530 + (d - 18 + 0.5) * PW;
  }
  const W = (x, y) => ({ x: (x - 500) * S, z: (y - 350) * S });

  /** Ahşap damar çizgileri (renk veya gri tonlu kabartma için) */
  function grain(g, x, y, w, h, base, dark, n, vertical) {
    g.fillStyle = base; g.fillRect(x, y, w, h);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * .22 + .04;
      g.strokeStyle = dark.replace('A', a.toFixed(3));
      g.lineWidth = Math.random() * 2.2 + .4;
      g.beginPath();
      if (vertical) {
        const xx = x + Math.random() * w;
        g.moveTo(xx, y); g.bezierCurveTo(xx + rnd(-6, 6), y + h * .33, xx + rnd(-6, 6), y + h * .66, xx + rnd(-3, 3), y + h);
      } else {
        const yy = y + Math.random() * h;
        g.moveTo(x, yy); g.bezierCurveTo(x + w * .33, yy + rnd(-10, 10), x + w * .66, yy + rnd(-10, 10), x + w, yy + rnd(-5, 5));
      }
      g.stroke();
    }
  }

  /* ---------- Temalar ---------- */
  const BOARD_THEMES = {
    abanoz: {
      ad: 'Klasik abanoz', frame: '#1b110c', frameGrain: 'rgba(70,40,20,A)', inlay: ['rgba(236,230,218,.95)', 'rgba(176,168,160,.85)'], line: 'rgba(190,150,80,.55)',
      field: '#7a4a26', fieldGrain: 'rgba(40,16,4,A)', ptA: ['#16100d', '#0d0907'], ptB: ['#efe0bd', '#d2bd92'], ptEdge: 'rgba(176,138,72,.55)', tray: '#0c0706', side: 0x1b110c,
      ck: [{ top: ['#f4ecdc', '#d9ccb2'], line: 'rgba(120,95,60,.55)', side: 0xf0e6d0 }, { top: ['#3b2b21', '#17100c'], line: 'rgba(205,165,95,.65)', side: 0x261912 }],
      die: { face: '#ece3cf', pip: ['#2a1a10', '#0a0503'], one: ['#7a1208', '#3d0703'] }, gold: '#e7cf95', swatch: ['#1b110c', '#7a4a26', '#efe0bd']
    },
    osmanli: {
      ad: 'Osmanlı kırmızı', frame: '#3a1210', frameGrain: 'rgba(110,35,25,A)', inlay: ['rgba(245,222,160,.95)', 'rgba(205,165,95,.85)'], line: 'rgba(225,185,95,.7)',
      field: '#dccaa0', fieldGrain: 'rgba(120,90,50,A)', ptA: ['#901e1e', '#6d1212'], ptB: ['#1f4a35', '#143526'], ptEdge: 'rgba(205,165,80,.75)', tray: '#1d0907', side: 0x3a1210,
      ck: [{ top: ['#fbf8f0', '#e3dccb'], line: 'rgba(160,120,60,.5)', side: 0xf6f1e6 }, { top: ['#2c2c2c', '#0e0e0e'], line: 'rgba(225,185,95,.65)', side: 0x161616 }],
      die: { face: '#fbf8f2', pip: ['#1a1a1a', '#000000'], one: ['#c01818', '#700000'] }, gold: '#f0d59a', swatch: ['#3a1210', '#901e1e', '#1f4a35']
    },
    lacivert: {
      ad: 'Lacivert gece', frame: '#121c33', frameGrain: 'rgba(60,80,130,A)', inlay: ['rgba(228,233,242,.95)', 'rgba(160,170,190,.85)'], line: 'rgba(195,205,220,.6)',
      field: '#d9c8a2', fieldGrain: 'rgba(120,95,60,A)', ptA: ['#1b2a4a', '#121d36'], ptB: ['#a9b2bc', '#8a939e'], ptEdge: 'rgba(205,210,220,.75)', tray: '#0a0f1c', side: 0x121c33,
      ck: [{ top: ['#f6efde', '#ddd2b8'], line: 'rgba(30,45,80,.45)', side: 0xf2ead8 }, { top: ['#8c1b2a', '#5a0d18'], line: 'rgba(235,205,145,.6)', side: 0x6e1420 }],
      die: { face: '#f6f0e2', pip: ['#1b2a4a', '#0d1528'], one: ['#8c1b2a', '#4a0c14'] }, gold: '#dfe4ec', swatch: ['#121c33', '#d9c8a2', '#8c1b2a']
    },
    cuha: {
      ad: 'Yeşil çuha', frame: '#6e4a28', frameGrain: 'rgba(55,30,10,A)', inlay: ['rgba(246,236,206,.92)', 'rgba(205,185,145,.85)'], line: 'rgba(250,230,180,.45)',
      field: '#1f5a3d', felt: true, ptA: ['#6b1d1d', '#561515'], ptB: ['#eadfc4', '#d4c6a3'], ptEdge: 'rgba(240,225,190,.5)', tray: '#123826', side: 0x5e3f22,
      ck: [{ top: ['#fbfaf6', '#e6e2d8'], line: 'rgba(120,120,120,.45)', side: 0xf5f3ec }, { top: ['#2c2c2c', '#101010'], line: 'rgba(205,205,205,.35)', side: 0x171717 }],
      die: { face: '#fbfaf6', pip: ['#1a1a1a', '#000000'], one: ['#b01515', '#600000'] }, gold: '#f3e6c4', swatch: ['#6e4a28', '#1f5a3d', '#6b1d1d']
    }
  };
  const TABLE_THEMES = {
    ceviz: { ad: 'Ceviz masa', swatch: ['#432818', '#2a160c'] },
    cuha: { ad: 'Yeşil çuha örtü', swatch: ['#1e4d36', '#123322'] },
    mermer: { ad: 'Mermer', swatch: ['#e7e3dc', '#9a948a'] },
    kareli: { ad: 'Kareli örtü', swatch: ['#b3201c', '#f1ece2'] }
  };
  let TH = BOARD_THEMES[localStorage.getItem('rcp_board')] || BOARD_THEMES.abanoz;
  let TT = localStorage.getItem('rcp_table') in TABLE_THEMES ? localStorage.getItem('rcp_table') : 'ceviz';

  function feltFill(g, x, y, w, h, base) {
    g.fillStyle = base; g.fillRect(x, y, w, h);
    for (let i = 0; i < w * h / 60; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${(Math.random() * .06).toFixed(3)})`; g.fillRect(x + Math.random() * w, y + Math.random() * h, 2, 2); }
  }

  function fieldTex(side) {
    return ctex(1000, 1400, (g) => {
      const k = 2, x0 = side === 'L' ? 0 : 500;
      const fx0 = side === 'L' ? 60 : 30, fx1 = side === 'L' ? 470 : 440;
      g.fillStyle = TH.tray; g.fillRect(0, 0, 1000, 1400);
      if (TH.felt) feltFill(g, fx0 * k, 20 * k, (fx1 - fx0) * k, 660 * k, TH.field);
      else grain(g, fx0 * k, 20 * k, (fx1 - fx0) * k, 660 * k, TH.field, TH.fieldGrain, 260, true);
      const ds = side === 'L' ? [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] : [0, 1, 2, 3, 4, 5, 18, 19, 20, 21, 22, 23];
      ds.forEach(d => {
        const cx = (dX(d) - x0) * k, hw = (PW / 2 - 3) * k, top = d >= 12, a = d % 2 === 0;
        const yb = (top ? 20 : 680) * k, ya = (top ? 298 : 402) * k;
        const pg = g.createLinearGradient(0, yb, 0, ya), c = a ? TH.ptA : TH.ptB;
        pg.addColorStop(0, c[0]); pg.addColorStop(1, c[1]);
        g.fillStyle = pg;
        g.beginPath(); g.moveTo(cx - hw, yb); g.lineTo(cx + hw, yb); g.lineTo(cx, ya); g.closePath(); g.fill();
        g.strokeStyle = TH.ptEdge; g.lineWidth = 2; g.stroke();
      });
      if (side === 'R') { g.fillStyle = TH.tray; g.fillRect(448 * k, 20 * k, 37 * k, 660 * k); }
      const sh = (yy, dir) => { const s = g.createLinearGradient(0, yy, 0, yy + dir * 40); s.addColorStop(0, 'rgba(0,0,0,.5)'); s.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = s; g.fillRect(fx0 * k, Math.min(yy, yy + dir * 40), (fx1 - fx0) * k, 40); };
      sh(20 * k, 1); sh(680 * k, -1);
    });
  }

  /** Çerçeve üst yüzü: temanın ahşabı, sedef yıldızlar, ince çizgiler */
  function frameTex(side) {
    const t = ctex(1000, 1400, (g) => {
      const k = 2;
      grain(g, 0, 0, 1000, 1400, TH.frame, TH.frameGrain, 220, false);
      const star = (cx, cy, r) => {
        g.save(); g.translate(cx, cy);
        const gr = g.createRadialGradient(-r * .2, -r * .25, 1, 0, 0, r);
        gr.addColorStop(0, TH.inlay[0]); gr.addColorStop(1, TH.inlay[1]);
        g.fillStyle = gr; g.beginPath();
        for (let i = 0; i < 16; i++) { const rr = i % 2 ? r * .45 : r, a = i * Math.PI / 8 - Math.PI / 2; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        g.closePath(); g.fill();
        g.fillStyle = TH.frame; g.beginPath(); g.arc(0, 0, r * .22, 0, 7); g.fill();
        g.restore();
      };
      const line = (x, y, w, h) => { g.strokeStyle = TH.line; g.lineWidth = 2; g.strokeRect(x * k, y * k, w * k, h * k); };
      const xs = side === 'L' ? [60, 470] : [30, 440];
      for (let x = xs[0] + 18; x < xs[1] - 6; x += 34) { star(x * k, 10 * k, 13); star(x * k, 690 * k, 13); }
      line(xs[0], 3, xs[1] - xs[0], 14); line(xs[0], 683, xs[1] - xs[0], 14);
      if (side === 'L') {
        for (let y = 50; y < 660; y += 50) star(30 * k, y * k, 30);
        line(10, 20, 40, 660);
        for (let y = 40; y < 680; y += 40) star(485 * k, y * k, 16);
      } else {
        for (let y = 40; y < 680; y += 40) star(15 * k, y * k, 16);
        for (let y = 40; y < 680; y += 40) star(492 * k, y * k, 9);
      }
    });
    t.repeat.set(1 / 7.5, 1 / 10.5); t.offset.set(side === 'L' ? 1 : 0, .5);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }

  function coverTex() {
    const t = ctex(1000, 1400, (g) => {
      grain(g, 0, 0, 1000, 1400, TH.frame, TH.frameGrain, 260, false);
      g.strokeStyle = TH.gold; g.globalAlpha = .85; g.lineWidth = 8; g.strokeRect(60, 60, 880, 1280);
      g.lineWidth = 3; g.strokeRect(90, 90, 820, 1220);
      g.save(); g.translate(500, 700);
      for (let r = 0; r < 2; r++) { g.save(); g.rotate(r * Math.PI / 4); g.lineWidth = 7; g.strokeRect(-190, -190, 380, 380); g.restore(); }
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(0, 0, 170, 0, 7); g.fill();
      g.strokeStyle = TH.gold; g.lineWidth = 5; g.stroke();
      g.fillStyle = TH.gold; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '74px "Yeseva One", Georgia, serif'; g.fillText("RCP's", 0, -34);
      g.font = '58px "Yeseva One", Georgia, serif'; g.fillText('GAMES', 0, 46);
      g.restore();
    });
    t.center.set(.5, .5); t.rotation = Math.PI;
    return t;
  }

  function checkerTop(p) {
    const c = TH.ck[p];
    return ctex(512, 512, (g) => {
      const gr = g.createRadialGradient(210, 190, 30, 256, 256, 300);
      gr.addColorStop(0, c.top[0]); gr.addColorStop(1, c.top[1]);
      g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
      g.strokeStyle = c.line; g.lineWidth = 5;
      g.beginPath(); g.arc(256, 256, 200, 0, 7); g.stroke();
      g.save(); g.translate(256, 256);
      for (let i = 0; i < 8; i++) { g.save(); g.rotate(i * Math.PI / 4); g.beginPath(); g.ellipse(0, -84, 30, 74, 0, 0, 7); g.lineWidth = 4; g.stroke(); g.restore(); }
      g.beginPath(); g.arc(0, 0, 26, 0, 7); g.lineWidth = 5; g.stroke();
      g.restore();
    });
  }

  function dieFace(v) {
    const P = { 1: [[.5, .5]], 2: [[.28, .28], [.72, .72]], 3: [[.28, .28], [.5, .5], [.72, .72]], 4: [[.28, .28], [.72, .28], [.28, .72], [.72, .72]], 5: [[.28, .28], [.72, .28], [.5, .5], [.28, .72], [.72, .72]], 6: [[.29, .25], [.71, .25], [.29, .5], [.71, .5], [.29, .75], [.71, .75]] };
    const D = TH.die;
    return ctex(256, 256, (g) => {
      g.fillStyle = D.face; g.fillRect(0, 0, 256, 256);
      P[v].forEach(([x, y]) => {
        const c = v === 1 ? D.one : D.pip;
        const pg = g.createRadialGradient(x * 256 + 5, y * 256 + 5, 2, x * 256, y * 256, 22);
        pg.addColorStop(0, c[0]); pg.addColorStop(1, c[1]);
        g.fillStyle = pg; g.beginPath(); g.arc(x * 256, y * 256, v === 1 ? 28 : 21, 0, 7); g.fill();
      });
    });
  }

  function tableTex() {
    return ctex(2048, 1024, (g) => {
      if (TT === 'cuha') { feltFill(g, 0, 0, 2048, 1024, '#1e4d36'); return; }
      if (TT === 'kareli') {
        const n = 16, s = 2048 / n;
        for (let i = 0; i < n; i++) for (let j = 0; j < n / 2; j++) {
          g.fillStyle = (i + j) % 2 ? '#f1ece2' : '#b3201c'; g.fillRect(i * s, j * s, s, s);
        }
        for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${(Math.random() * .06).toFixed(3)})`; g.fillRect(Math.random() * 2048, Math.random() * 1024, 2, 1); }
        return;
      }
      if (TT === 'mermer') {
        const gr = g.createLinearGradient(0, 0, 2048, 1024); gr.addColorStop(0, '#ece8e1'); gr.addColorStop(1, '#d9d4cb');
        g.fillStyle = gr; g.fillRect(0, 0, 2048, 1024);
        for (let i = 0; i < 26; i++) {
          let x = Math.random() * 2048, y = Math.random() * 1024;
          g.strokeStyle = `rgba(110,105,98,${(rnd(.08, .35)).toFixed(2)})`; g.lineWidth = rnd(.6, 2.4);
          g.beginPath(); g.moveTo(x, y);
          for (let s = 0; s < 14; s++) { x += rnd(20, 90); y += rnd(-40, 40); g.lineTo(x, y); }
          g.stroke();
        }
        return;
      }
      const gr = g.createLinearGradient(0, 0, 0, 1024);
      gr.addColorStop(0, '#3a2215'); gr.addColorStop(.5, '#432818'); gr.addColorStop(1, '#341e12');
      g.fillStyle = gr; g.fillRect(0, 0, 2048, 1024);
      grain(g, 0, 0, 2048, 1024, 'rgba(0,0,0,0)', 'rgba(15,7,2,A)', 520, false);
      for (let i = 0; i < 6; i++) {
        const cx = rnd(200, 1850), cy = rnd(150, 870);
        for (let r = 8; r < 140; r += rnd(5, 11)) { g.strokeStyle = `rgba(20,9,3,${(.25 - r / 700).toFixed(3)})`; g.lineWidth = 1.4; g.beginPath(); g.ellipse(cx, cy, r * 3.2, r * .7, 0, 0, 7); g.stroke(); }
      }
    }, true);
  }

  function radialTex(inner, outer) {
    return ctex(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, inner); gr.addColorStop(1, outer);
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
  }

  /* ---------- Malzemeler ---------- */
  let MAT = {};
  function makeMats() {
    MAT.ebony = new T.MeshPhysicalMaterial({ color: TH.side, roughness: .42, clearcoat: .7, clearcoatRoughness: .3 });
    MAT.wood = MAT.ebony;
    MAT.brass = new T.MeshStandardMaterial({ color: 0xb8913f, metalness: .9, roughness: .32 });
    MAT.gold = new T.MeshStandardMaterial({ color: 0xc9a24f, metalness: .95, roughness: .25 });
    MAT.porcelain = new T.MeshPhysicalMaterial({ color: 0xf2eee6, roughness: .2, clearcoat: .8, side: T.DoubleSide });
    MAT.ceramic = new T.MeshStandardMaterial({ color: 0xd9c6a6, roughness: .45, side: T.DoubleSide });
    MAT.glass = new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: .03, metalness: 0, transparent: true, opacity: .2, side: T.DoubleSide, depthWrite: false, clearcoat: 1, clearcoatRoughness: .03, envMapIntensity: 1.6 });
    MAT.glassThick = new T.MeshPhysicalMaterial({ color: 0xbfd6dc, roughness: .06, transparent: true, opacity: .38, side: T.DoubleSide, depthWrite: false, clearcoat: 1, envMapIntensity: 1.6 });
    MAT.sugar = new T.MeshStandardMaterial({ color: 0xf6f4ef, roughness: .95 });
    MAT.silver = new T.MeshStandardMaterial({ color: 0xcfd1d3, metalness: .95, roughness: .2 });
    MAT.ash = new T.MeshStandardMaterial({ color: 0x7d7872, roughness: 1 });
    MAT.filter = new T.MeshStandardMaterial({ color: 0xc98238, roughness: .8 });
    MAT.paper = new T.MeshStandardMaterial({ color: 0xf2f0ea, roughness: .9 });
    MAT.ember = new T.MeshStandardMaterial({ color: 0xff5a10, emissive: 0xff4400, emissiveIntensity: 1.2, roughness: .8 });
    MAT.ring = new T.MeshBasicMaterial({ color: 0xffdf9a, transparent: true, opacity: .7, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
    MAT.invisible = new T.MeshBasicMaterial({ visible: false });
  }

  /** Kahvehane ortamı: yansımalar için sanal oda (tavan lambası, sıcak pencere, loş duvarlar) */
  function makeEnv() {
    const pm = new T.PMREMGenerator(renderer);
    const es = new T.Scene();
    es.add(new T.Mesh(new T.BoxGeometry(40, 16, 40), new T.MeshBasicMaterial({ color: 0x150c0a, side: T.BackSide })));
    const panel = (w, h, col, k, pos, rot) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: col, side: T.DoubleSide }));
      m.material.color.multiplyScalar(k); m.position.set(...pos); if (rot) m.rotation.set(...rot); es.add(m);
    };
    panel(4, 4, 0xffd09a, 2.2, [-9, 7.9, -9], [Math.PI / 2, 0, 0]);
    panel(4, 4, 0xffc890, 1.4, [10, 7.9, 8], [Math.PI / 2, 0, 0]);
    panel(10, 4, 0xff9a50, 1.2, [-19.9, 2, -4], [0, Math.PI / 2, 0]);
    panel(12, 3, 0xffb070, .9, [6, 2.5, -19.9], [0, 0, 0]);
    panel(6, 3, 0x6a4aa0, .6, [19.9, 3, 6], [0, -Math.PI / 2, 0]);
    const env = pm.fromScene(es, 0.04).texture;
    pm.dispose();
    return env;
  }

  /* ---------- Sahne kurulumu ---------- */
  function init(el) {
    stage = el;
    renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.domElement.className = 'gl';
    stage.prepend(renderer.domElement);

    scene = new T.Scene();
    scene.background = new T.Color(0x0c0607);
    scene.fog = new T.Fog(0x0c0607, 26, 58);
    scene.environment = makeEnv();
    camera = new T.PerspectiveCamera(36, 1.6, 0.1, 200);
    scene.add(camera);

    makeMats();
    lights();
    table();
    buildBoard();
    buildCheckers();
    buildParticles();
    buildProps();
    bokeh();

    setQuality(quality);
    resize();
    addEventListener('resize', resize);
    bindPointer();
    requestAnimationFrame(loop);
  }

  let spot;
  function lights() {
    scene.add(new T.AmbientLight(0x3a2a30, .25));
    spot = new T.SpotLight(0xffd6a8, 1.25, 60, .58, .8, 1.3);
    spot.position.set(1.5, 17, 4); spot.target.position.set(0, 0, -.5);
    spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0003; spot.shadow.normalBias = .02;
    scene.add(spot, spot.target);
    const fill = new T.DirectionalLight(0xffb27a, .18); fill.position.set(-10, 6, 12); scene.add(fill);
    const rim = new T.PointLight(0x7a5aa8, .25, 50); rim.position.set(-12, 5, -14); scene.add(rim);
  }

  let tableMat = null;
  const TABLE_LOOK = {
    ceviz: { rough: .55, coat: .35, bump: .004, rep: [2, 2.4] },
    cuha: { rough: .95, coat: 0, bump: .002, rep: [2.5, 3] },
    mermer: { rough: .22, coat: .6, bump: 0, rep: [1.4, 1.6] },
    kareli: { rough: .85, coat: 0, bump: .003, rep: [2.2, 2.6] }
  };
  function applyTableLook() {
    const L = TABLE_LOOK[TT], tex = tableTex(); tex.repeat.set(...L.rep);
    if (tableMat.map) tableMat.map.dispose();
    tableMat.map = tex; tableMat.roughness = L.rough; tableMat.clearcoat = L.coat; tableMat.bumpScale = L.bump; tableMat.needsUpdate = true;
  }
  function table() {
    const bump = ctex(1024, 512, (g) => grain(g, 0, 0, 1024, 512, '#808080', 'rgba(0,0,0,A)', 300, false), true, true);
    bump.repeat.set(4, 4.8);
    const mat = tableMat = new T.MeshPhysicalMaterial({ bumpMap: bump, bumpScale: .004, roughness: .55, clearcoat: .35, clearcoatRoughness: .4, envMapIntensity: .6 });
    applyTableLook();
    const top = new T.Mesh(new T.BoxGeometry(70, .8, 60), mat);
    top.position.set(0, TY - .4, -12); top.receiveShadow = true;
    scene.add(top);
  }

  function bokeh() {
    const tex = radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    const cols = [0xffb060, 0xff9a50, 0xffd090, 0xff7a40];
    for (let i = 0; i < 14; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: cols[i % cols.length], transparent: true, opacity: rnd(.08, .2), blending: T.AdditiveBlending, depthWrite: false, fog: false }));
      s.position.set(rnd(-34, 34), rnd(7, 16), rnd(-46, -40));
      const sc = rnd(1.5, 4); s.scale.set(sc, sc, 1);
      scene.add(s);
    }
  }

  /* ---------- Tahta ---------- */
  let hitPts = {}, hitBar, hitTray, colPts = {}, colTray, rings = [];
  const bx = x => (x - 500) * S, bz = y => (y - 350) * S;
  function rectPath(p, x0, x1, y0, y1) { p.moveTo(bx(x0), -bz(y0)); p.lineTo(bx(x1), -bz(y0)); p.lineTo(bx(x1), -bz(y1)); p.lineTo(bx(x0), -bz(y1)); p.lineTo(bx(x0), -bz(y0)); }
  const MB = { frame: {}, field: {}, cover: null };
  function frameMesh(side) {
    const shape = new T.Shape();
    if (side === 'L') rectPath(shape, 0, 500, 0, 700); else rectPath(shape, 500, 1000, 0, 700);
    const hole = (x0, x1, y0, y1) => { const h = new T.Path(); rectPath(h, x0, x1, y0, y1); shape.holes.push(h); };
    if (side === 'L') hole(60, 470, 20, 680);
    else { hole(530, 940, 20, 680); hole(948, 985, 20, 340); hole(948, 985, 360, 680); }
    const bt = .025;
    const geo = new T.ExtrudeGeometry(shape, { depth: RIM - bt * 2, bevelEnabled: true, bevelThickness: bt, bevelSize: .022, bevelSegments: 3, curveSegments: 4 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, bt, 0);
    const top = MB.frame[side] = new T.MeshPhysicalMaterial({ map: frameTex(side), roughness: .45, clearcoat: .3, clearcoatRoughness: .45, envMapIntensity: .6 });
    const m = new T.Mesh(geo, [top, MAT.ebony]);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function buildBoard() {
    boardG = new T.Group(); scene.add(boardG);
    leftG = new T.Group(); boardG.add(leftG);
    rightPivot = new T.Group(); rightPivot.position.set(0, RIM, 0); boardG.add(rightPivot);
    rightG = new T.Group(); rightG.position.set(0, -RIM, 0); rightPivot.add(rightG);
    barG = new T.Group(); boardG.add(barG);
    hlG = new T.Group(); boardG.add(hlG);
    pickG = new T.Group(); boardG.add(pickG);

    const fieldMat = side => (MB.field[side] = new T.MeshStandardMaterial({ map: fieldTex(side), roughness: TH.felt ? .95 : .62, envMapIntensity: .55 }));
    const cov = MB.cover = new T.MeshPhysicalMaterial({ map: coverTex(), roughness: .45, clearcoat: .7, clearcoatRoughness: .3 });
    const bL = new T.Mesh(new T.BoxGeometry(7.5, BASE, 10.5), [MAT.ebony, MAT.ebony, fieldMat('L'), MAT.ebony, MAT.ebony, MAT.ebony]);
    bL.position.set(-3.75, -BASE / 2, 0); bL.receiveShadow = true; bL.castShadow = true; leftG.add(bL);
    const bR = new T.Mesh(new T.BoxGeometry(7.5, BASE, 10.5), [MAT.ebony, MAT.ebony, fieldMat('R'), cov, MAT.ebony, MAT.ebony]);
    bR.position.set(3.75, -BASE / 2, 0); bR.receiveShadow = true; bR.castShadow = true; rightG.add(bR);
    leftG.add(frameMesh('L'));
    rightG.add(frameMesh('R'));
    [-3.1, 3.1].forEach(z => {
      const h = new T.Mesh(new T.CylinderGeometry(.06, .06, .8, 14), MAT.brass);
      h.rotation.x = Math.PI / 2; h.position.set(0, RIM + .01, z); leftG.add(h);
    });

    const gTex = ctex(16, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,220,150,1)'); gr.addColorStop(1, 'rgba(255,220,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, 16, 256); });
    for (let i = 0; i < 24; i++) {
      const c = new T.Mesh(new T.PlaneGeometry(PW * S * .9, 285 * S), new T.MeshBasicMaterial({ map: gTex, color: 0xffd8a0, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
      c.rotation.x = -Math.PI / 2; c.visible = false; hlG.add(c); colPts[i] = c;
      const h = new T.Mesh(new T.PlaneGeometry(PW * S, 315 * S), MAT.invisible);
      h.rotation.x = -Math.PI / 2; h.userData.pick = i; pickG.add(h); pickables.push(h); hitPts[i] = h;
    }
    colTray = new T.Mesh(new T.PlaneGeometry(.55, 9.9), new T.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
    colTray.rotation.x = -Math.PI / 2; colTray.position.set((966 - 500) * S, .03, 0); colTray.visible = false; hlG.add(colTray);
    hitBar = new T.Mesh(new T.PlaneGeometry(1.0, 10.5), MAT.invisible); hitBar.rotation.x = -Math.PI / 2; hitBar.position.set(0, RIM + .03, 0); hitBar.userData.pick = 'bar'; pickG.add(hitBar); pickables.push(hitBar);
    hitTray = new T.Mesh(new T.PlaneGeometry(.9, 10.5), MAT.invisible); hitTray.rotation.x = -Math.PI / 2; hitTray.position.set((966 - 500) * S, .05, 0); hitTray.userData.pick = 'off'; pickG.add(hitTray); pickables.push(hitTray);
    for (let i = 0; i < 8; i++) {
      const r = new T.Mesh(new T.RingGeometry(R * .74, R * .96, 40), MAT.ring.clone());
      r.rotation.x = -Math.PI / 2; r.visible = false; hlG.add(r); rings.push(r);
    }
    placeHits();
  }

  function placeHits() {
    for (let i = 0; i < 24; i++) {
      const d = persp === 0 ? i : 23 - i, top = d >= 12, x = dX(d);
      const pc = W(x, top ? 162 : 538), ph = W(x, top ? 175 : 525);
      colPts[i].position.set(pc.x, .012, pc.z);
      colPts[i].rotation.z = top ? Math.PI : 0;
      hitPts[i].position.set(ph.x, .03, ph.z);
    }
  }

  /* ---------- Konum hesapları ---------- */
  function pointPos(i, k) {
    const d = persp === 0 ? i : 23 - i, x = dX(d), top = d >= 12;
    const slot = k % 5, layer = Math.floor(k / 5);
    const off = layer ? DU * 0.5 : 0;
    const y2 = top ? 20 + DU / 2 + slot * DU + off : 680 - DU / 2 - slot * DU - off;
    const p = W(x, y2);
    return new T.Vector3(p.x, layer * CH + .002, p.z);
  }
  function barPos(p, k) {
    const slot = k % 4, layer = Math.floor(k / 4);
    const y2 = p === persp ? 410 + DU / 2 + slot * DU : 290 - DU / 2 - slot * DU;
    const q = W(500, y2);
    return new T.Vector3(q.x, RIM + layer * CH, q.z);
  }
  function offPos(p, k) {
    const mine = p === persp;
    const y2 = mine ? 668 - k * 12.6 : 32 + k * 12.6;
    const q = W(966, y2);
    return { pos: new T.Vector3(q.x, R * .95, q.z), rx: mine ? Math.PI / 2 + .28 : Math.PI / 2 - .28 };
  }

  /* ---------- Pullar (yuvarlak kenarlı, oymalı) ---------- */
  let CK = [], pool = [[], []], topMesh = {};
  function checkerGeo() {
    const e = .035, pts = [
      [0, 0], [R - e, 0], [R - e * .3, e * .3], [R, e], [R, CH - e], [R - e * .3, CH - e * .3], [R - e, CH],
      [R - .07, CH], [R - .085, CH - .012], [R - .1, CH - .012]
    ];
    return new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), 56);
  }
  function buildCheckers() {
    const body = checkerGeo();
    const disc = new T.CircleGeometry(R - .1, 48); disc.rotateX(-Math.PI / 2); disc.translate(0, CH - .012, 0);
    for (const p of [0, 1]) {
      const top = checkerTop(p);
      const side = new T.MeshPhysicalMaterial({ color: TH.ck[p].side, roughness: p ? .32 : .36, clearcoat: .7, clearcoatRoughness: .2 });
      const face = new T.MeshPhysicalMaterial({ map: top, roughness: .35, clearcoat: .6, clearcoatRoughness: .25 });
      const mk = (em, ei) => { const a = side.clone(), b = face.clone(); a.emissive = new T.Color(em); a.emissiveIntensity = ei; b.emissive = new T.Color(em); b.emissiveIntensity = ei; return { side: a, face: b }; };
      CK[p] = { body, disc, base: { side, face }, mov: mk(0xb07020, .25), sel: mk(0xffb040, .6) };
      for (let i = 0; i < 15; i++) { const m = newChecker(p); m.visible = false; pool[p].push(m); boardG.add(m); }
    }
  }
  function newChecker(p) {
    const m = new T.Mesh(CK[p].body, CK[p].base.side);
    const d = new T.Mesh(CK[p].disc, CK[p].base.face); m.add(d);
    m.castShadow = true; m.receiveShadow = true; d.receiveShadow = true;
    m.userData.p = p; return m;
  }
  function setCkMat(m, kind) { const s = CK[m.userData.p][kind]; m.material = s.side; m.children[0].material = s.face; }
  function tempChecker(p, pos) { const m = newChecker(p); boardG.add(m); m.position.copy(pos); return () => boardG.remove(m); }

  function render(st, hide) {
    hide = hide || {};
    topMesh = {};
    const used = [0, 0];
    const put = (p, pos, parent, rx, key) => {
      const m = pool[p][used[p]++]; if (!m) return;
      parent.add(m); m.position.copy(pos); m.rotation.set(rx || 0, 0, 0);
      setCkMat(m, 'base'); m.visible = !(key && hide[key]);
      if (key) topMesh[key] = m;
    };
    for (let i = 0; i < 24; i++) {
      const v = st.board[i]; if (!v) continue;
      const p = v > 0 ? 0 : 1, n = Math.abs(v);
      for (let k = 0; k < n; k++) { const pos = pointPos(i, k); put(p, pos, pos.x < 0 ? leftG : rightG, 0, k === n - 1 ? 'pt' + i : null); }
    }
    for (const p of [0, 1]) {
      for (let k = 0; k < st.bar[p]; k++) put(p, barPos(p, k), barG, 0, k === st.bar[p] - 1 ? 'bar' + p : null);
      for (let k = 0; k < st.off[p]; k++) { const o = offPos(p, k); put(p, o.pos, rightG, o.rx, k === st.off[p] - 1 ? 'off' + p : null); }
    }
    for (const p of [0, 1]) for (let i = used[p]; i < 15; i++) pool[p][i].visible = false;
  }

  function setHighlights(h) {
    Object.values(topMesh).forEach(m => setCkMat(m, 'base'));
    (h.movable || []).forEach(k => { const m = topMesh[k]; if (m) setCkMat(m, k === h.sel ? 'sel' : 'mov'); });
    for (let i = 0; i < 24; i++) colPts[i].visible = false;
    colTray.visible = false;
    rings.forEach(r => r.visible = false);
    (h.dests || []).forEach((d, j) => {
      if (d.t === 'off') colTray.visible = true;
      else if (typeof d.t === 'number') colPts[d.t].visible = true;
      if (d.pos && rings[j] && d.t !== 'off') { rings[j].visible = true; rings[j].position.set(d.pos.x, d.pos.y + .012, d.pos.z); }
    });
  }

  /* ---------- Taş hareketi ---------- */
  function worldOf(m) { const v = new T.Vector3(); m.getWorldPosition(v); return v; }
  async function moveChecker(p, from, to, opts) {
    opts = opts || {};
    const m = newChecker(p); boardG.add(m);
    m.position.copy(from); m.rotation.set(opts.rx0 || 0, 0, 0);
    const dist = from.distanceTo(to);
    const dur = Math.min(.8, .32 + dist * .045);
    const h = Math.min(1.6, .55 + dist * .12);
    await tween(dur, (t) => {
      m.position.lerpVectors(from, to, t);
      m.position.y = lerp(from.y, to.y, t) + Math.sin(Math.PI * t) * h;
      if (opts.rx1 != null) m.rotation.x = lerp(opts.rx0 || 0, opts.rx1, t);
    }, EIO);
    boardG.remove(m);
  }

  function burst(pos, color, n) {
    for (let i = 0; i < (n || 18); i++) {
      const a = Math.random() * Math.PI * 2, sp = rnd(1.2, 3.2);
      spawn(pos.clone().add(new T.Vector3(0, .2, 0)), { vel: new T.Vector3(Math.cos(a) * sp, rnd(1.5, 3.5), Math.sin(a) * sp), life: rnd(.4, .8), s0: .16, s1: .05, op: .9, color: color || 0xffc060, add: true, grav: 7 });
    }
  }

  /* ---------- Zarlar (yuvarlak köşeli) ---------- */
  let faceT = null, dice = [], opDice = [], dieGeo = null;
  const FACE_ORDER = [2, 5, 1, 6, 3, 4];
  const UPQ = {
    1: new T.Euler(0, 0, 0), 6: new T.Euler(Math.PI, 0, 0), 2: new T.Euler(0, 0, Math.PI / 2),
    5: new T.Euler(0, 0, -Math.PI / 2), 3: new T.Euler(-Math.PI / 2, 0, 0), 4: new T.Euler(Math.PI / 2, 0, 0)
  };
  function roundedBox(s, r, seg) {
    const g = new T.BoxGeometry(s, s, s, seg, seg, seg), pos = g.attributes.position, h = s / 2 - r, v = new T.Vector3(), c = new T.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      c.set(clamp(v.x, -h, h), clamp(v.y, -h, h), clamp(v.z, -h, h));
      v.sub(c).normalize().multiplyScalar(r).add(c);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }
  function makeDie() {
    if (!faceT) faceT = [1, 2, 3, 4, 5, 6].reduce((o, v) => (o[v] = dieFace(v), o), {});
    if (!dieGeo) dieGeo = roundedBox(DIE, .085, 8);
    const mats = FACE_ORDER.map(v => new T.MeshPhysicalMaterial({ map: faceT[v], roughness: .25, clearcoat: 1, clearcoatRoughness: .08, transparent: true, opacity: 1 }));
    const m = new T.Mesh(dieGeo, mats);
    m.castShadow = true; scene.add(m);
    return m;
  }
  function finalQ(v) {
    const qf = new T.Quaternion().setFromEuler(UPQ[v]);
    const qy = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), rnd(-.35, .35));
    return qy.multiply(qf);
  }
  function diceSpot(side, i, single) {
    const xs = single ? (side === 'R' ? 735 : 265) : (side === 'R' ? 690 + i * 96 : 214 + i * 96);
    const w = W(xs, 350);
    return new T.Vector3(w.x, DIE / 2, w.z + (single ? 0 : (i ? .25 : -.2)));
  }
  function throwDie(v, side, i, single) {
    const m = makeDie();
    const end = diceSpot(side, i, single);
    const start = side === 'R' ? new T.Vector3(5.2 + i * .6, 4, 7.5) : new T.Vector3(-5.2 - i * .6, 4, -7.5);
    const e0 = new T.Euler(rnd(0, 6), rnd(0, 6), rnd(0, 6));
    const w = new T.Vector3(rnd(9, 16), rnd(4, 9), rnd(9, 16)).multiplyScalar(Math.random() < .5 ? 1 : -1);
    const qF = finalQ(v); let qM = null;
    m.position.copy(start);
    return tween(1.15, (u) => {
      const h = EO(Math.min(1, u / .86));
      m.position.x = lerp(start.x, end.x, h); m.position.z = lerp(start.z, end.z, h);
      let y;
      if (u < .42) { const a = u / .42; y = lerp(start.y, end.y, a * a); }
      else if (u < .66) y = end.y + .7 * Math.sin(Math.PI * (u - .42) / .24);
      else if (u < .82) y = end.y + .22 * Math.sin(Math.PI * (u - .66) / .16);
      else y = end.y;
      m.position.y = y;
      if (u < .68) m.quaternion.setFromEuler(new T.Euler(e0.x + w.x * u, e0.y + w.y * u, e0.z + w.z * u));
      else { if (!qM) qM = m.quaternion.clone(); m.quaternion.copy(qM).slerp(qF, EO((u - .68) / .32)); }
    }, LIN).then(() => m);
  }
  async function rollDice(vals, side) { clearDice(); dice = await Promise.all(vals.map((v, i) => throwDie(v, side, i, false))); return dice; }
  function showDice(vals, side) {
    clearDice();
    dice = vals.map((v, i) => { const m = makeDie(); m.position.copy(diceSpot(side, i, false)); m.quaternion.copy(finalQ(v)); return m; });
  }
  function markDice(used) { dice.forEach((m, i) => m.material.forEach(x => { x.opacity = used[i] ? .35 : 1; })); }
  function clearDice() { dice.forEach(m => scene.remove(m)); dice = []; }
  async function openingDie(v, side) { const m = await throwDie(v, side, 0, true); opDice.push(m); return m; }
  function clearOpening() { opDice.forEach(m => scene.remove(m)); opDice = []; }

  /* ---------- Parçacıklar (duman, buhar, kıvılcım) ---------- */
  let parts = [], puffTex, sparkTex;
  function buildParticles() {
    puffTex = radialTex('rgba(255,255,255,.9)', 'rgba(255,255,255,0)');
    sparkTex = radialTex('rgba(255,255,255,1)', 'rgba(255,200,120,0)');
    for (let i = 0; i < 160; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0, depthWrite: false }));
      s.visible = false; s.userData.age = 1; s.userData.life = 0; scene.add(s); parts.push(s);
    }
  }
  function spawn(pos, o) {
    const s = parts.find(x => !x.visible); if (!s) return;
    s.visible = true; s.position.copy(pos);
    Object.assign(s.userData, { age: 0, life: o.life, vel: o.vel.clone(), s0: o.s0, s1: o.s1, op: o.op, grav: o.grav || 0 });
    const add = !!o.add;
    if (s.userData.add !== add) { s.material.map = add ? sparkTex : puffTex; s.material.blending = add ? T.AdditiveBlending : T.NormalBlending; s.material.needsUpdate = true; s.userData.add = add; }
    s.material.color.set(o.color || 0xffffff);
    s.scale.set(o.s0, o.s0, 1);
  }
  function updateParts(dt) {
    parts.forEach(s => {
      if (!s.visible) return;
      const u = s.userData; u.age += dt;
      if (u.age >= u.life) { s.visible = false; return; }
      const t = u.age / u.life;
      u.vel.y -= u.grav * dt;
      s.position.addScaledVector(u.vel, dt);
      const sc = lerp(u.s0, u.s1, t); s.scale.set(sc, sc, 1);
      s.material.opacity = u.op * Math.min(1, t * 6) * (1 - t);
    });
  }

  /* ---------- İçecekler ---------- */
  const PROF = {
    ince: [[0, 0], [.29, 0], [.3, .04], [.26, .2], [.2, .5], [.205, .6], [.25, .8], [.32, 1.08], [.35, 1.25]],
    fincan: [[0, 0], [.17, 0], [.19, .03], [.27, .14], [.33, .36], [.35, .55]],
    kupa: [[0, 0], [.27, 0], [.28, .05], [.3, .78]],
    bardak: [[0, 0], [.25, 0], [.26, .04], [.31, 1.1]]
  };
  const DRINK = {
    cay: { kind: 'ince', c: 0xa82a10, op: .9, hot: true, y0: .05, y1: 1.02 },
    oralet: { kind: 'ince', c: 0xf08418, op: .92, hot: true, y0: .05, y1: 1.02 },
    kahve: { kind: 'fincan', c: 0x2e160a, op: 1, hot: true, y0: .05, y1: .5 },
    sahlep: { kind: 'kupa', c: 0xf0e0c2, op: 1, hot: true, y0: .05, y1: .72 },
    soda: { kind: 'bardak', c: 0xcfeefc, op: .38, hot: false, y0: .05, y1: .95, bubbles: true },
    buzlu: { kind: 'bardak', c: 0xdff3ff, op: .35, hot: false, y0: .05, y1: .9, ice: true },
    kola: { kind: 'bardak', c: 0x2b1006, op: .93, hot: false, y0: .05, y1: .88, bubbles: true, ice: true, bottle: 0x3a1a0a },
    icetea: { kind: 'bardak', c: 0xb8641a, op: .8, hot: false, y0: .05, y1: .88, ice: true, lemon: true },
    tost: { kind: 'food', food: 'tost', hot: true },
    sosisli: { kind: 'food', food: 'sosisli', hot: true }
  };
  function radiusAt(pr, y) {
    for (let i = 1; i < pr.length; i++) {
      const a = pr[i - 1], b = pr[i];
      if (y <= b[1]) { const t = (y - a[1]) / Math.max(1e-6, b[1] - a[1]); return lerp(a[0], b[0], clamp(t, 0, 1)); }
    }
    return pr[pr.length - 1][0];
  }
  const lathe = (pts, seg) => new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), seg || 48);
  function liquidGeo(pr, y0, y1, k) {
    const pts = [[0, y0]];
    for (let i = 0; i <= 10; i++) { const y = lerp(y0, y1, i / 10); pts.push([radiusAt(pr, y) * k, y]); }
    pts.push([0, y1]);
    return lathe(pts, 40);
  }
  function saucer(r, gold) {
    const g = new T.Group();
    const s = new T.Mesh(lathe([[0, 0], [r * .75, 0], [r * .95, .05], [r, .09]]), MAT.porcelain); g.add(s);
    if (gold) { const t = new T.Mesh(new T.TorusGeometry(r * .985, .012, 6, 48), MAT.gold); t.rotation.x = Math.PI / 2; t.position.y = .088; g.add(t); }
    return g;
  }
  function toastTex() {
    return ctex(256, 256, (g) => {
      const gr = g.createRadialGradient(128, 128, 20, 128, 128, 180); gr.addColorStop(0, '#e2ad62'); gr.addColorStop(1, '#b97a35');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(95,48,15,.75)'; g.lineWidth = 9;
      for (let i = -256; i < 512; i += 46) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); }
      for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(90,45,10,${(Math.random() * .25).toFixed(2)})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    });
  }
  function buildFood(type, D) {
    const g = new T.Group(), body = new T.Group(); g.add(body);
    const plate = new T.Mesh(lathe([[0, 0], [.6, 0], [.82, .04], [.92, .09]]), MAT.porcelain); g.add(plate);
    const rim = new T.Mesh(new T.TorusGeometry(.905, .012, 6, 48), MAT.gold); rim.rotation.x = Math.PI / 2; rim.position.y = .088; g.add(rim);
    body.position.y = .035;
    const o = { g, body, type, level: 1, hot: true, D, bubbles: [], cup: body, cupH: .2 };
    if (D.food === 'tost') {
      const bread = new T.MeshStandardMaterial({ map: toastTex(), roughness: .85 });
      const crust = new T.MeshStandardMaterial({ color: 0x8e5220, roughness: .9 });
      const cheese = new T.MeshStandardMaterial({ color: 0xf2c14e, roughness: .45 });
      const q = .42, tris = [[[q, q], [q, -q]], [[q, -q], [-q, -q]], [[-q, -q], [-q, q]], [[-q, q], [q, q]]];
      const pieces = [];
      tris.forEach(([a, b]) => {
        const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(a[0], a[1]); sh.lineTo(b[0], b[1]); sh.lineTo(0, 0);
        const mk = (h, m) => { const geo = new T.ExtrudeGeometry(sh, { depth: h, bevelEnabled: true, bevelThickness: .012, bevelSize: .014, bevelSegments: 2 }); geo.rotateX(-Math.PI / 2); const me = new T.Mesh(geo, [m, crust]); me.castShadow = true; return me; };
        const pc = new T.Group(), b1 = mk(.07, bread), ch = mk(.022, cheese), b2 = mk(.07, bread);
        ch.position.y = .08; ch.scale.set(1.04, 1, 1.04); b2.position.y = .11;
        pc.add(b1, ch, b2);
        pc.position.set((a[0] + b[0]) * .06, 0, -(a[1] + b[1]) * .06);
        body.add(pc); pieces.push(pc);
      });
      o.setLevel = l => { o.level = l; const n = Math.ceil(l * 4 - .001); pieces.forEach((p, i) => { p.visible = i < n; }); };
    } else {
      const bun = new T.MeshStandardMaterial({ color: 0xd49a55, roughness: .8 });
      const saus = new T.MeshPhysicalMaterial({ color: 0x8a3518, roughness: .4, clearcoat: .5 });
      const grp = new T.Group(); grp.position.x = -.62; body.add(grp);
      const inner = new T.Group(); inner.position.x = .62; grp.add(inner);
      [-.085, .085].forEach(z => { const b = new T.Mesh(new T.SphereGeometry(1, 24, 12), bun); b.scale.set(.62, .15, .13); b.position.set(0, .14, z); b.castShadow = true; inner.add(b); });
      const s2 = new T.Mesh(new T.SphereGeometry(1, 24, 12), saus); s2.scale.set(.7, .085, .085); s2.position.y = .2; inner.add(s2);
      const zig = (col, off) => {
        const pts = []; for (let i = 0; i <= 14; i++) pts.push(new T.Vector3(-.55 + i * .078, .29, (i % 2 ? .05 : -.05) + off));
        const m = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 60, .014, 6), new T.MeshStandardMaterial({ color: col, roughness: .35 }));
        inner.add(m);
      };
      zig(0xc0180e, 0); zig(0xe8b520, .015);
      o.setLevel = l => { o.level = l; grp.visible = l > .01; grp.scale.x = Math.max(.001, l); };
    }
    o.topLocal = new T.Vector3(0, .45, 0);
    return o;
  }
  function buildDrink(type) {
    const D = DRINK[type] || DRINK.cay, pr = PROF[D.kind];
    if (D.kind === 'food') return buildFood(type, D);
    const g = new T.Group(), body = new T.Group(); g.add(body);
    const o = { g, body, type, level: 1, hot: D.hot, D };
    let lift = 0;
    if (D.kind === 'ince') {
      g.add(saucer(.62, true)); lift = .08;
      [[-.45, .2], [-.36, -.32]].forEach(([x, z]) => { const c = new T.Mesh(new T.BoxGeometry(.12, .1, .12), MAT.sugar); c.position.set(x, .14, z); c.rotation.y = rnd(0, 1); g.add(c); });
      const sp = new T.Mesh(new T.CylinderGeometry(.018, .012, 1.3, 6), MAT.silver); sp.position.set(.12, .75, .05); sp.rotation.z = -.22; body.add(sp);
    } else if (D.kind === 'fincan') {
      g.add(saucer(.58, true)); lift = .08;
      const lok = new T.Mesh(new T.BoxGeometry(.17, .14, .17), new T.MeshStandardMaterial({ color: 0xf2a3b8, roughness: .9 })); lok.position.set(.42, .16, .18); lok.rotation.y = .5; g.add(lok);
      const wg = new T.Group(); wg.position.set(.95, 0, -.3); g.add(wg);
      const wGlass = new T.Mesh(lathe([[0, 0], [.15, 0], [.18, .7]]), MAT.glass); wGlass.renderOrder = 3; wg.add(wGlass);
      const wLiq = new T.Mesh(liquidGeo([[0, 0], [.15, 0], [.18, .7]], .03, .58, .9), new T.MeshStandardMaterial({ color: 0xdff2ff, transparent: true, opacity: .35, roughness: .1 })); wLiq.renderOrder = 2; wg.add(wLiq);
    } else if (D.kind === 'kupa') {
      g.add(saucer(.5, false)); lift = .08;
    } else {
      lift = 0;
      if (D.bubbles) {
        const bt = new T.Group(); bt.position.set(.75, 0, -.35); g.add(bt);
        const b = new T.Mesh(lathe([[0, 0], [.17, 0], [.18, .55], [.1, .75], [.07, .95], [.075, 1.0]]), new T.MeshPhysicalMaterial({ color: D.bottle || 0x2e7d4f, transparent: true, opacity: D.bottle ? .85 : .62, roughness: .1, clearcoat: 1, side: T.DoubleSide }));
        bt.add(b);
        const cap = new T.Mesh(new T.CylinderGeometry(.08, .08, .06, 16), MAT.gold); cap.position.y = 1.02; bt.add(cap);
      }
    }
    body.position.y = lift;
    // kap
    const opaque = D.kind === 'fincan' || D.kind === 'kupa';
    const cup = new T.Mesh(lathe(pr), opaque ? (D.kind === 'fincan' ? MAT.porcelain : MAT.ceramic) : MAT.glass);
    cup.castShadow = opaque; cup.renderOrder = opaque ? 0 : 3; body.add(cup);
    const topY = pr[pr.length - 1][1], topR = pr[pr.length - 1][0];
    if (D.kind === 'fincan') {
      const rim = new T.Mesh(new T.TorusGeometry(topR, .012, 6, 48), MAT.gold); rim.rotation.x = Math.PI / 2; rim.position.y = topY; body.add(rim);
      const band = new T.Mesh(new T.TorusGeometry(radiusAt(pr, .44) + .004, .01, 6, 48), new T.MeshStandardMaterial({ color: 0x8d1b22, roughness: .4 })); band.rotation.x = Math.PI / 2; band.position.y = .44; body.add(band);
    }
    if (D.kind === 'fincan' || D.kind === 'kupa') {
      const hd = new T.Mesh(new T.TorusGeometry(D.kind === 'fincan' ? .1 : .15, .03, 8, 20, Math.PI * 1.25), opaque ? cup.material : MAT.porcelain);
      hd.position.set(radiusAt(pr, topY * .55) + .02, topY * .55, 0); hd.rotation.z = -Math.PI * .62; body.add(hd);
    }
    if (D.kind === 'fincan') {
      const telve = new T.Mesh(new T.CircleGeometry(.17, 24), new T.MeshStandardMaterial({ color: 0x1a0b04, roughness: 1 }));
      telve.rotation.x = -Math.PI / 2; telve.position.y = .045; body.add(telve);
    }
    // sıvı
    const lmat = new T.MeshStandardMaterial({ color: D.c, transparent: D.op < 1, opacity: D.op, roughness: .15, metalness: 0 });
    const liq = new T.Mesh(new T.BufferGeometry(), lmat); liq.renderOrder = 2; body.add(liq);
    let foam = null;
    if (type === 'kahve' || type === 'sahlep') {
      const ft = type === 'kahve'
        ? ctex(128, 128, (c) => { c.fillStyle = '#a7774a'; c.fillRect(0, 0, 128, 128); for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(${200 + Math.random() * 40 | 0},${150 + Math.random() * 40 | 0},100,.5)`; c.beginPath(); c.arc(Math.random() * 128, Math.random() * 128, Math.random() * 3, 0, 7); c.fill(); } })
        : ctex(128, 128, (c) => { c.fillStyle = '#f3e4c6'; c.fillRect(0, 0, 128, 128); for (let i = 0; i < 160; i++) { c.fillStyle = 'rgba(120,60,20,.7)'; c.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); } });
      foam = new T.Mesh(new T.CircleGeometry(1, 36), new T.MeshStandardMaterial({ map: ft, roughness: .7 }));
      foam.rotation.x = -Math.PI / 2; body.add(foam);
    }
    if (D.ice) {
      for (let i = 0; i < 3; i++) { const c = new T.Mesh(new T.BoxGeometry(.2, .2, .2), new T.MeshPhysicalMaterial({ color: 0xeaf8ff, transparent: true, opacity: .55, roughness: .1, clearcoat: 1 })); c.position.set(rnd(-.08, .08), .6 + i * .14, rnd(-.08, .08)); c.rotation.set(rnd(0, 1), rnd(0, 1), 0); c.renderOrder = 2; body.add(c); }
    }
    if (D.lemon) {
      const lem = new T.Mesh(new T.CylinderGeometry(.16, .16, .02, 20), new T.MeshStandardMaterial({ color: 0xf5d74a, roughness: .5 }));
      lem.position.set(.27, 1.05, 0); lem.rotation.z = 1.2; body.add(lem);
    }
    o.bubbles = [];
    if (D.bubbles) for (let i = 0; i < 9; i++) { const b = new T.Mesh(new T.SphereGeometry(.018, 6, 6), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8 })); b.userData.ph = Math.random(); body.add(b); o.bubbles.push(b); }
    o.setLevel = (l) => {
      o.level = l;
      const y1 = lerp(D.y0 + .02, D.y1, clamp(l, 0, 1));
      liq.geometry.dispose();
      if (l <= .01) { liq.visible = false; if (foam) foam.visible = false; return; }
      liq.visible = true; liq.geometry = liquidGeo(pr, D.y0, y1, opaque ? .95 : .9);
      if (foam) { foam.visible = true; foam.position.y = y1 + .002; const r = radiusAt(pr, y1) * .94; foam.scale.set(r, r, 1); }
    };
    o.topLocal = new T.Vector3(0, lift + topY + .1, 0);
    o.cup = body;
    o.cupH = topY;
    g.traverse(m => { if (m.isMesh) { m.castShadow = m.castShadow || false; } });
    return o;
  }

  const LAYOUT = {
    seated: { me: [8.9, -2.2], opp: [-6.4, -7.0], ash: [5.9, -7.0], pack: [7.6, -6.2] },
    top: { me: [9.0, 2.7], opp: [-9.0, -2.7], ash: [9.0, -2.5], pack: [9.2, -.1] }
  };
  const L0 = LAYOUT[view] || LAYOUT.seated;
  const SLOT = { me: new T.Vector3(L0.me[0], TY, L0.me[1]), opp: new T.Vector3(L0.opp[0], TY, L0.opp[1]) };
  const drinks = { me: null, opp: null };
  function setPickTree(g, name) { g.traverse(m => { if (m.isMesh) { m.userData.pick = name; pickables.push(m); } }); }
  function unPickTree(g) { g.traverse(m => { const i = pickables.indexOf(m); if (i >= 0) pickables.splice(i, 1); }); }
  function disposeTree(g) { g.traverse(m => { if (m.geometry) m.geometry.dispose(); }); }

  function placeDrink(slot, type, level) {
    if (drinks[slot]) { unPickTree(drinks[slot].g); scene.remove(drinks[slot].g); disposeTree(drinks[slot].g); }
    const d = buildDrink(type); d.setLevel(level);
    d.g.position.copy(SLOT[slot]); d.g.scale.setScalar(1.3);
    d.g.rotation.y = slot === 'me' ? -.4 : 2.6;
    scene.add(d.g); setPickTree(d.g, slot === 'me' ? 'drinkMe' : 'drinkOpp');
    drinks[slot] = d; d.slot = slot;
    return d;
  }
  function setLevel(slot, level) { const d = drinks[slot]; if (d) d.setLevel(level); }

  let fpBusy = false;
  async function sipFirstPerson(slot, onPeak, onDown) {
    const d = drinks[slot]; if (!d || fpBusy) return; fpBusy = true;
    const g = d.body, home = { p: g.position.clone(), q: g.quaternion.clone() };
    camera.attach(g);
    const p0 = g.position.clone(), q0 = g.quaternion.clone();
    const food = d.D.kind === 'food';
    const p1 = food ? new T.Vector3(.05, -.75, -1.9) : new T.Vector3(.05, -.95, -2.0), q1 = new T.Quaternion().setFromEuler(new T.Euler(food ? .6 : .35, .2, 0));
    const p2 = food ? new T.Vector3(0, -.42, -1.15) : new T.Vector3(.02, -.55, -1.35), q2 = new T.Quaternion().setFromEuler(new T.Euler(food ? .9 : 1.15, food ? .5 : .2, 0));
    await tween(.7, t => { g.position.lerpVectors(p0, p1, t); g.quaternion.copy(q0).slerp(q1, t); });
    await tween(.55, t => { g.position.lerpVectors(p1, p2, t); g.quaternion.copy(q1).slerp(q2, t); camPitch = .1 * t; });
    onPeak && onPeak();
    await wait(380);
    await tween(.5, t => { g.position.lerpVectors(p2, p1, t); g.quaternion.copy(q2).slerp(q1, t); camPitch = .1 * (1 - t); });
    d.g.attach(g);
    const p3 = g.position.clone(), q3 = g.quaternion.clone();
    await tween(.65, t => { g.position.lerpVectors(p3, home.p, t); g.position.y += Math.sin(Math.PI * t) * .3; g.quaternion.copy(q3).slerp(home.q, t); });
    g.position.copy(home.p); g.quaternion.copy(home.q);
    fpBusy = false;
    onDown && onDown();
  }
  async function sipOther(slot, onPeak, onDown) {
    const d = drinks[slot]; if (!d) return;
    const g = d.body, p0 = g.position.clone(), r0 = g.rotation.x;
    const dir = 1;
    await tween(.5, t => { g.position.y = p0.y + 1.1 * t; g.position.z = p0.z + dir * .7 * t; });
    onPeak && onPeak();
    await tween(.6, t => { g.rotation.x = r0 + dir * .9 * Math.sin(Math.PI * t); });
    await tween(.5, t => { g.position.y = p0.y + 1.1 * (1 - t); g.position.z = p0.z + dir * .7 * (1 - t); });
    g.position.copy(p0); g.rotation.x = r0;
    onDown && onDown();
  }

  function makeTray() {
    const tr = new T.Group();
    const p = new T.Mesh(new T.CylinderGeometry(1.0, .95, .05, 40), MAT.brass); p.castShadow = true; tr.add(p);
    const l = new T.Mesh(new T.TorusGeometry(1.0, .03, 6, 40), MAT.brass); l.rotation.x = Math.PI / 2; l.position.y = .03; tr.add(l);
    const hdl = new T.Mesh(new T.TorusGeometry(.4, .025, 6, 24, Math.PI), MAT.brass); hdl.position.y = .03; hdl.rotation.y = Math.PI / 2; tr.add(hdl);
    hdl.scale.set(1, 1.6, 1); hdl.position.y = .05; hdl.rotation.set(0, 0, 0); hdl.position.set(0, .05, 0); hdl.visible = false;
    return tr;
  }
  async function serve(slot, type, level) {
    const pos = SLOT[slot], sx = pos.x > 0 ? 1 : -1, old = drinks[slot];
    if (old) {
      unPickTree(old.g); const x0 = old.g.position.x;
      await tween(.45, t => { old.g.position.x = x0 + sx * 9 * t; }, EIO);
      scene.remove(old.g); disposeTree(old.g); drinks[slot] = null;
    }
    const d = buildDrink(type); d.setLevel(level); d.g.scale.setScalar(1.3);
    d.g.rotation.y = slot === 'me' ? -.4 : 2.6;
    const tray = makeTray(); scene.add(tray);
    const ty = TY + 1.3, xs = pos.x + sx * 10;
    tray.position.set(xs, ty, pos.z); tray.add(d.g); d.g.position.set(0, .03, 0);
    await tween(.75, t => { tray.position.x = lerp(xs, pos.x, t); tray.position.y = ty + Math.sin(Math.PI * t) * .2; }, EO);
    scene.attach(d.g);
    const y0 = d.g.position.y;
    tray.position.x += 0;
    await tween(.4, t => { d.g.position.y = lerp(y0, TY, t); tray.position.x = pos.x + sx * 1.4 * t; }, EIO);
    d.g.position.copy(pos);
    drinks[slot] = d; d.slot = slot; setPickTree(d.g, slot === 'me' ? 'drinkMe' : 'drinkOpp');
    tween(.55, t => { tray.position.x = lerp(pos.x + sx * 1.4, xs, t); }, EIO).then(() => scene.remove(tray));
    return d;
  }
  async function coldWater(slot) {
    const pos = SLOT[slot], sx = pos.x > 0 ? 1 : -1;
    const d = buildDrink('buzlu'); d.setLevel(.9); d.g.scale.setScalar(1.3);
    const tray = makeTray(); scene.add(tray); tray.add(d.g); d.g.position.set(0, .03, 0);
    const ty = TY + 1.7, xs = pos.x + sx * 10, xe = pos.x - sx * .4;
    tray.position.set(xs, ty, pos.z);
    await tween(.8, t => { tray.position.x = lerp(xs, xe, t); }, EO);
    for (let i = 0; i < 8; i++) spawn(d.g.getWorldPosition(new T.Vector3()).add(new T.Vector3(rnd(-.3, .3), 1.2, rnd(-.3, .3))), { vel: new T.Vector3(rnd(-.2, .2), rnd(.1, .4), 0), life: 1.6, s0: .3, s1: .9, op: .35, color: 0xdff4ff });
    await tween(1.4, t => { tray.rotation.z = Math.sin(t * Math.PI * 4) * .03; }, LIN);
    await tween(.7, t => { tray.position.x = lerp(xe, xs, t); }, EIO);
    scene.remove(tray);
  }
  async function flipCup(slot, down) {
    const d = drinks[slot]; if (!d || !d.cup) return;
    const c = d.cup, y0 = c.position.y, H = d.cupH;
    if (down) {
      await tween(.35, t => { c.position.y = y0 + .6 * t; }, EIO);
      await tween(.5, t => { c.rotation.x = Math.PI * t; }, EIO);
      await tween(.3, t => { c.position.y = lerp(y0 + .6, .08 + H, t); }, EIO);
    } else {
      await tween(.3, t => { c.position.y = lerp(.08 + H, .08 + H + .5, t); }, EIO);
      await tween(.5, t => { c.rotation.x = Math.PI * (1 - t); }, EIO);
      await tween(.3, t => { c.position.y = lerp(.08 + H + .5, .08, t); }, EIO);
    }
  }

  /* ---------- Küllük, sigara, paket ---------- */
  const ASH = new T.Vector3(L0.ash[0], TY, L0.ash[1]);
  let packM = null;
  let cig = null, cigG, cigParts = {}, butts = [], ashG, cigHome;
  function buildProps() {
    ashG = new T.Group(); ashG.position.copy(ASH); scene.add(ashG);
    const tray = new T.Mesh(lathe([[0, 0], [.72, 0], [.76, .05], [.8, .24], [.66, .24], [.62, .09], [0, .09]], 48), MAT.glassThick);
    tray.renderOrder = 3; ashG.add(tray);
    const ashD = new T.Mesh(new T.CircleGeometry(.6, 32), new T.MeshStandardMaterial({ color: 0x5e5954, roughness: 1 }));
    ashD.rotation.x = -Math.PI / 2; ashD.position.y = .095; ashG.add(ashD);
    for (let i = 0; i < 40; i++) { const a = new T.Mesh(new T.SphereGeometry(rnd(.02, .05), 5, 4), MAT.ash); a.position.set(rnd(-.4, .4), .1, rnd(-.4, .4)); a.scale.y = .4; ashG.add(a); }
    cigG = new T.Group();
    const cyl = (mat, r) => { const m = new T.Mesh(new T.CylinderGeometry(r || .045, r || .045, 1, 14), mat); m.rotation.z = Math.PI / 2; m.castShadow = true; return m; };
    cigParts.filter = cyl(MAT.filter); cigParts.filter.scale.y = .28; cigParts.filter.position.x = .14;
    cigParts.paper = cyl(MAT.paper); cigParts.ash = cyl(MAT.ash, .043); cigParts.ember = cyl(MAT.ember, .044);
    cigG.add(cigParts.filter, cigParts.paper, cigParts.ash, cigParts.ember);
    cigHome = { p: new T.Vector3(.95, .27, .1), r: new T.Euler(0, Math.PI, -.12) };
    cigG.position.copy(cigHome.p); cigG.rotation.copy(cigHome.r);
    ashG.add(cigG);
    setPickTree(ashG, 'cig');
    const packT = ctex(256, 384, (g) => {
      g.fillStyle = '#efece4'; g.fillRect(0, 0, 256, 384);
      g.fillStyle = '#8e1d17'; g.fillRect(0, 140, 256, 244);
      g.beginPath(); g.moveTo(0, 140); g.lineTo(128, 200); g.lineTo(256, 140); g.fill();
      g.fillStyle = '#efe6d2'; g.font = 'bold 64px Georgia, serif'; g.textAlign = 'center'; g.fillText('RCP', 128, 300);
      g.fillStyle = '#8e1d17'; g.font = 'bold 26px Georgia, serif'; g.fillText('KIRAATHANE', 128, 90);
    });
    const red = new T.MeshStandardMaterial({ color: 0x8e1d17, roughness: .55 });
    const pack = new T.Mesh(new T.BoxGeometry(.55, .17, .82), [red, red, new T.MeshPhysicalMaterial({ map: packT, roughness: .4, clearcoat: .5 }), red, red, red]);
    pack.position.set(L0.pack[0], TY + .085, L0.pack[1]); pack.rotation.y = -.5; pack.castShadow = true; scene.add(pack); packM = pack;
    setPickTree(pack, 'pack');
    lightCig(true);
  }

  function updateCig() {
    if (!cig) return;
    const pl = .7 * cig.life, al = .02 + .2 * cig.ash;
    cigParts.paper.scale.y = Math.max(.001, pl); cigParts.paper.position.x = .28 + pl / 2;
    cigParts.ember.scale.y = .025; cigParts.ember.position.x = .28 + pl + .012;
    cigParts.ash.scale.y = al; cigParts.ash.position.x = .28 + pl + .025 + al / 2;
  }
  function lightCig(initial) {
    if (cig && cig.life > .05 && !initial) addButt();
    cig = { life: 1, ash: 0 }; cigG.visible = true; updateCig();
  }
  function addButt() {
    const b = new T.Group();
    const f = new T.Mesh(new T.CylinderGeometry(.045, .045, .26, 10), MAT.filter); f.rotation.z = Math.PI / 2; b.add(f);
    const p = new T.Mesh(new T.CylinderGeometry(.045, .045, .1, 10), MAT.paper); p.rotation.z = Math.PI / 2; p.position.x = .18; b.add(p);
    const e = new T.Mesh(new T.CylinderGeometry(.046, .046, .03, 10), new T.MeshStandardMaterial({ color: 0x333333 })); e.rotation.z = Math.PI / 2; e.position.x = .24; b.add(e);
    b.position.set(rnd(-.35, .35), .12, rnd(-.35, .35)); b.rotation.y = rnd(0, 6);
    ashG.add(b); butts.push(b); if (butts.length > 7) ashG.remove(butts.shift());
  }
  function cigLit() { return !!cig; }
  function emberPos() { const v = new T.Vector3(); cigParts.ember.getWorldPosition(v); return v; }
  async function smokeFirstPerson(onExhale) {
    if (!cig || fpBusy) return; fpBusy = true;
    camera.attach(cigG);
    const p0 = cigG.position.clone(), q0 = cigG.quaternion.clone();
    const p1 = new T.Vector3(.1, -.32, -.62), q1 = new T.Quaternion().setFromEuler(new T.Euler(.18, Math.PI / 2, .05));
    await tween(.8, t => { cigG.position.lerpVectors(p0, p1, t); cigG.quaternion.copy(q0).slerp(q1, t); });
    window.Sfx && Sfx.inhale && Sfx.inhale();
    await tween(1.0, t => { MAT.ember.emissiveIntensity = 1.2 + 4 * Math.sin(Math.PI * t); cigG.position.z = p1.z + .05 * Math.sin(Math.PI * t); }, LIN);
    cig.life = Math.max(0, cig.life - .06); cig.ash = Math.min(1, cig.ash + .15); updateCig();
    ashG.attach(cigG);
    const p2 = cigG.position.clone(), q2 = cigG.quaternion.clone(), qh = new T.Quaternion().setFromEuler(cigHome.r);
    await tween(.7, t => { cigG.position.lerpVectors(p2, cigHome.p, t); cigG.quaternion.copy(q2).slerp(qh, t); });
    cigG.position.copy(cigHome.p); cigG.rotation.copy(cigHome.r);
    window.Sfx && Sfx.ashTap && Sfx.ashTap();
    fpBusy = false;
    await wait(250);
    onExhale && onExhale();
    smokeScreen();
  }
  /** Üflenen duman: kameranın önünde büyüyüp dağılan bulutlar (HTML katmanı yok, telefonu yormaz) */
  function smokeScreen() {
    const base = camera.position.clone(), dir = new T.Vector3(); camera.getWorldDirection(dir);
    const right = new T.Vector3().crossVectors(dir, camera.up).normalize(), up = new T.Vector3().crossVectors(right, dir).normalize();
    for (let i = 0; i < 12; i++) {
      const p = base.clone().addScaledVector(dir, rnd(1.3, 2.4)).addScaledVector(right, rnd(-.35, .35)).addScaledVector(up, rnd(-.6, -.25));
      const v = dir.clone().multiplyScalar(rnd(.5, 1.1)).addScaledVector(right, rnd(-.9, .9)).addScaledVector(up, rnd(.25, .8));
      setTimeout(() => spawn(p, { vel: v, life: rnd(2.6, 3.6), s0: .35, s1: rnd(2.2, 3.2), op: .5, color: 0xe6e4ea }), i * 45);
    }
  }

  /* ---------- Katlanma ---------- */
  async function fold() {
    clearDice(); clearOpening(); hlG.visible = false; barG.visible = false;
    await tween(1.35, t => { rightPivot.rotation.z = Math.PI * t; }, EIO);
    await tween(1.9, carryPose, LIN);
  }
  const KF = [
    { t: 0, p: [0, 0, 0], r: [0, 0, 0] },
    { t: .3, p: [3.75, 1.4, .8], r: [-.2, 0, 0] },
    { t: .68, p: [1.5, 4.6, 6.5], r: [-.7, .25, .2] },
    { t: 1, p: [-5.7, 3.3, 7.4], r: [-1.45, .9, 1.35] }
  ];
  function carryPose(u) {
    let i = 1; while (i < KF.length - 1 && u > KF[i].t) i++;
    const a = KF[i - 1], b = KF[i], t = EIO(clamp((u - a.t) / (b.t - a.t), 0, 1));
    boardG.position.set(lerp(a.p[0], b.p[0], t), lerp(a.p[1], b.p[1], t), lerp(a.p[2], b.p[2], t));
    boardG.rotation.set(lerp(a.r[0], b.r[0], t), lerp(a.r[1], b.r[1], t), lerp(a.r[2], b.r[2], t));
  }
  async function unfold() {
    const p0 = boardG.position.clone(), r0 = boardG.rotation.clone();
    if (p0.lengthSq() > 0.001 || rightPivot.rotation.z > 0.01) {
      await tween(1.0, t => { boardG.position.lerpVectors(p0, new T.Vector3(), t); boardG.rotation.set(lerp(r0.x, 0, t), lerp(r0.y, 0, t), lerp(r0.z, 0, t)); }, EIO);
      const z0 = rightPivot.rotation.z;
      await tween(1.1, t => { rightPivot.rotation.z = lerp(z0, 0, t); }, EIO);
    }
    boardG.position.set(0, 0, 0); boardG.rotation.set(0, 0, 0); rightPivot.rotation.z = 0;
    hlG.visible = true; barG.visible = true;
  }
  function isFolded() { return rightPivot.rotation.z > .01; }

  /* ---------- Kamera (sahneyi ekrana sığdır) ---------- */
  const VIEWS = {
    seated: { dir: new T.Vector3(0, 1, .95).normalize(), target: new T.Vector3(0, -.2, .2) },
    top: { dir: new T.Vector3(0, 1, .16).normalize(), target: new T.Vector3(0, 0, .1) }
  };
  const FIT_PTS = [];
  for (const x of [-7.65, 7.65]) for (const z of [-5.35, 5.35]) FIT_PTS.push(new T.Vector3(x, .28, z), new T.Vector3(x, TY + .1, z));
  function addFit(c, rx, rz, h) { [[-rx, -rz], [rx, -rz], [-rx, rz], [rx, rz]].forEach(([a, b]) => { FIT_PTS.push(new T.Vector3(c.x + a, TY, c.z + b), new T.Vector3(c.x + a, TY + h, c.z + b)); }); }
  function fitCamera() {
    const v = VIEWS[view] || VIEWS.seated;
    camBase.target.copy(v.target);
    const tmp = new T.Vector3();
    let d = 8;
    for (; d < 80; d += .2) {
      camera.position.copy(v.target).addScaledVector(v.dir, d);
      camera.lookAt(v.target); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      let ok = true;
      const yTop = view === 'top' ? .95 : .62, xMax = view === 'top' ? .97 : .985;
      for (const p of FIT_PTS) { tmp.copy(p).project(camera); if (Math.abs(tmp.x) > xMax || tmp.y > yTop || tmp.y < -.96) { ok = false; break; } }
      if (ok) break;
    }
    camBase.pos.copy(v.target).addScaledVector(v.dir, d);
  }
  function setView(v) { view = v; localStorage.setItem('rcp_view', v); fitCamera(); applyLayout(); }
  /** Üstten bakışta çaylar ve küllük yanlara, oturuşta arka köşelere */
  function applyLayout() {
    const Lx = LAYOUT[view] || LAYOUT.seated;
    SLOT.me.set(Lx.me[0], TY, Lx.me[1]); SLOT.opp.set(Lx.opp[0], TY, Lx.opp[1]); ASH.set(Lx.ash[0], TY, Lx.ash[1]);
    const moves = [];
    ['me', 'opp'].forEach(k => { const d = drinks[k]; if (d && !fpBusy) moves.push([d.g.position, d.g.position.clone(), SLOT[k].clone()]); });
    if (ashG) moves.push([ashG.position, ashG.position.clone(), ASH.clone()]);
    if (packM) moves.push([packM.position, packM.position.clone(), new T.Vector3(Lx.pack[0], TY + .085, Lx.pack[1])]);
    tween(.5, t => moves.forEach(([v, a, b]) => v.lerpVectors(a, b, t)), EIO);
  }
  function toggleView() { setView(view === 'seated' ? 'top' : 'seated'); return view; }
  function shake(amt) { shakeT = Math.max(shakeT, .3 * (amt || 1)); }
  async function lean(pos, amt, dur) {
    dolly.v.copy(pos);
    await tween((dur || .9) / 2, t => { dolly.amt = (amt || .18) * t; }, EIO);
    await tween((dur || .9) / 2, t => { dolly.amt = (amt || .18) * (1 - t); }, EIO);
  }
  function updateCamera(dt) {
    const p = camBase.pos.clone();
    if (dolly.amt > 0) p.lerp(dolly.v, dolly.amt);
    if (shakeT > 0) { shakeT -= dt; const s = shakeT * .22; p.add(new T.Vector3(rnd(-s, s), rnd(-s, s), rnd(-s, s))); }
    camera.position.copy(p);
    camera.lookAt(camBase.target);
    if (camPitch) camera.rotateX(camPitch);
  }

  /* ---------- Girdi ---------- */
  let dragCfg = null, drag = null;
  function enableDrag(cfg) { dragCfg = cfg; }
  function bindPointer() {
    const c = renderer.domElement; let down = null;
    const ndc = e => { const r = c.getBoundingClientRect(); return new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
    const isBoard = v => typeof v === 'number' || v === 'bar' || v === 'off';
    const pickAt = (e, boardOnly) => {
      const rc = new T.Raycaster(); rc.setFromCamera(ndc(e), camera);
      const hits = rc.intersectObjects(pickables, false);
      if (boardOnly) { const h = hits.find(x => isBoard(x.object.userData.pick)); return h ? h.object.userData.pick : null; }
      const prop = hits.find(x => !isBoard(x.object.userData.pick));
      const h = prop || hits[0]; return h ? h.object.userData.pick : null;
    };
    const planeAt = e => { const rc = new T.Raycaster(); rc.setFromCamera(ndc(e), camera); const p = new T.Vector3(); return rc.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -.7), p) ? p : null; };
    c.addEventListener('pointerdown', e => {
      down = { x: e.clientX, y: e.clientY }; drag = null;
      if (!dragCfg || isFolded()) return;
      const t = pickAt(e, true); if (t === null) return;
      const info = dragCfg.can(t);
      if (info && topMesh[info.key]) drag = { t, info, mesh: topMesh[info.key], started: false };
    });
    c.addEventListener('pointermove', e => {
      if (!drag || !down) return;
      if (!drag.started) {
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10) return;
        drag.started = true;
        try { c.setPointerCapture(e.pointerId); } catch (er) {}
        drag.home = worldOf(drag.mesh);
        drag.ghost = newChecker(drag.info.p); drag.ghost.position.copy(drag.home); boardG.add(drag.ghost);
        drag.mesh.visible = false;
        dragCfg.start && dragCfg.start(drag.t);
        drag.mesh.visible = false;
      }
      const p = planeAt(e); if (p) drag.ghost.position.set(p.x, .7, p.z);
    });
    c.addEventListener('pointerup', async e => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
      if (drag && drag.started) {
        const d = drag; drag = null;
        const t = pickAt(e, true);
        const ok = t !== null && t !== d.t && dragCfg.drop(t, d.ghost.position.clone());
        if (ok) { boardG.remove(d.ghost); return; }
        const from = d.ghost.position.clone();
        await tween(.28, u => { d.ghost.position.lerpVectors(from, d.home, u); d.ghost.position.y += Math.sin(Math.PI * u) * .2; }, EIO);
        boardG.remove(d.ghost); d.mesh.visible = true;
        dragCfg.cancel && dragCfg.cancel();
        return;
      }
      drag = null;
      if (moved > 12) return;
      const t = pickAt(e, false);
      if (t !== null && t !== undefined) onPick(t);
    });
    c.addEventListener('pointercancel', () => { if (drag && drag.started) { boardG.remove(drag.ghost); drag.mesh.visible = true; } drag = null; down = null; });
  }

  /* ---------- Döngü ---------- */
  let steamT = 0, smokeT = 0, cigT = 0, glowT = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (document.hidden) return;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i], u = clamp((now - tw.s) / tw.d, 0, 1);
      try { tw.fn(tw.ease(u), u); } catch (e) { console.error(e); }
      if (u >= 1) { tweens.splice(i, 1); tw.res(); }
    }
    glowT += dt;
    [0, 1].forEach(p => { if (CK[p]) { const k = .12 + .2 * (0.5 + 0.5 * Math.sin(glowT * 4.5)); CK[p].mov.side.emissiveIntensity = k; CK[p].mov.face.emissiveIntensity = k; } });
    for (let i = 0; i < 24; i++) if (colPts[i].visible) colPts[i].material.opacity = .16 + .12 * Math.sin(glowT * 4);
    if (colTray.visible) colTray.material.opacity = .2 + .12 * Math.sin(glowT * 4);
    rings.forEach(r => { if (r.visible) { r.rotation.z += dt; r.material.opacity = .45 + .25 * Math.sin(glowT * 5); } });
    steamT += dt;
    if (steamT > .38) {
      steamT = 0;
      ['me', 'opp'].forEach(s => {
        const d = drinks[s]; if (!d || !d.hot || d.level <= .01 || fpBusy) return;
        const p = d.g.localToWorld(d.topLocal.clone());
        spawn(p.add(new T.Vector3(rnd(-.12, .12), 0, rnd(-.12, .12))), { vel: new T.Vector3(rnd(-.08, .08), rnd(.35, .6), rnd(-.08, .08)), life: 2.4, s0: .18, s1: .9, op: .12, color: 0xffffff });
      });
    }
    ['me', 'opp'].forEach(s => { const d = drinks[s]; if (d && d.bubbles.length) d.bubbles.forEach(b => { b.userData.ph = (b.userData.ph + dt * .35) % 1; const y = lerp(.1, .9 * d.level + .05, b.userData.ph); b.position.set(Math.sin(b.userData.ph * 20) * .08, y, Math.cos(b.userData.ph * 17) * .08); b.visible = d.level > .05; }); });
    if (cig) {
      cigT += dt;
      if (cigT > 1) { cigT = 0; cig.life = Math.max(0, cig.life - 1 / 320); cig.ash = Math.min(1, cig.ash + 1 / 140); if (cig.ash > .8 && Math.random() < .1) cig.ash = .05; updateCig(); if (cig.life <= 0) { addButt(); cig = null; cigG.visible = false; } }
      smokeT += dt;
      if (cig && smokeT > .45 && !fpBusy) {
        smokeT = 0;
        spawn(emberPos(), { vel: new T.Vector3(rnd(-.06, .06), rnd(.45, .7), rnd(-.06, .06)), life: 3.2, s0: .1, s1: 1.1, op: .18, color: 0xd8d8de });
      }
      if (!fpBusy) MAT.ember.emissiveIntensity = 1 + .5 * Math.sin(glowT * 2.2);
    }
    updateParts(dt);
    updateCamera(dt);
    renderer.render(scene, camera);
  }

  function resize() {
    if (!stage) return;
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    fitCamera();
  }
  function setQuality(q) {
    quality = q; localStorage.setItem('rcp_q', q);
    const hi = q === 'high';
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, hi ? 2 : 1.25));
    renderer.shadowMap.enabled = hi; spot.castShadow = hi;
    scene.traverse(m => { if (m.material) [].concat(m.material).forEach(x => x.needsUpdate = true); });
    resize();
  }
  function setPersp(p) { persp = p; placeHits(); }
  function swapMap(m, tex) { if (m.map) m.map.dispose(); m.map = tex; m.needsUpdate = true; }
  function setBoardTheme(id) {
    if (!BOARD_THEMES[id]) return;
    TH = BOARD_THEMES[id]; localStorage.setItem('rcp_board', id);
    ['L', 'R'].forEach(sd => { swapMap(MB.field[sd], fieldTex(sd)); MB.field[sd].roughness = TH.felt ? .95 : .62; swapMap(MB.frame[sd], frameTex(sd)); });
    swapMap(MB.cover, coverTex());
    MAT.ebony.color.set(TH.side);
    [0, 1].forEach(p => {
      const top = checkerTop(p);
      ['base', 'mov', 'sel'].forEach(k => { CK[p][k].side.color.set(TH.ck[p].side); CK[p][k].face.map = top; CK[p][k].face.needsUpdate = true; });
    });
    faceT = null; clearDice();
  }
  function setTableTheme(id) { if (!TABLE_THEMES[id]) return; TT = id; localStorage.setItem('rcp_table', id); applyTableLook(); }

  window.Scene = {
    init, render, setPersp, setHighlights, pointPos, barPos, offPos, moveChecker, tempChecker, worldOf,
    get topMesh() { return topMesh; },
    rollDice, showDice, markDice, clearDice, openingDie, clearOpening,
    placeDrink, setLevel, sipFirstPerson, sipOther, serve, coldWater, flipCup, drinks,
    lightCig, cigLit, smokeFirstPerson,
    fold, unfold, isFolded, shake, lean, burst,
    toggleView, get view() { return view; }, setQuality, get quality() { return quality; },
    onPick(fn) { onPick = fn; }, enableDrag, resize, get fpBusy() { return fpBusy; },
    smokeScreen, BOARD_THEMES, TABLE_THEMES, setBoardTheme, setTableTheme, get boardTheme() { return Object.keys(BOARD_THEMES).find(k => BOARD_THEMES[k] === TH); }, get tableTheme() { return TT; },
    _pose(u, f) { rightPivot.rotation.z = Math.PI * f; carryPose(u); }, _KF: KF, get _cam() { return camera; }
  };
})();
