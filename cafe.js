/* RCP's-GAMES — masa üstü mantığı: içecekler, garson, fal, sigara, tespih, soğuk su */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const DRINKS = {
    cay:    { ad: 'Çay',          kisa: 'çay',          fiyat: 15, sips: 4, renk: 'rgba(170,45,15,.55)' },
    oralet: { ad: 'Oralet',       kisa: 'oralet',       fiyat: 20, sips: 4, renk: 'rgba(240,130,20,.5)' },
    kahve:  { ad: 'Türk kahvesi', kisa: 'Türk kahvesi', fiyat: 60, sips: 5, renk: 'rgba(45,20,8,.6)' },
    sahlep: { ad: 'Sahlep',       kisa: 'sahlep',       fiyat: 70, sips: 5, renk: 'rgba(240,225,195,.6)' },
    soda:   { ad: 'Maden suyu',   kisa: 'maden suyu',   fiyat: 25, sips: 3, renk: 'rgba(200,235,255,.45)' },
    kola:   { ad: 'Kola',         kisa: 'kola',         fiyat: 40, sips: 4, renk: 'rgba(60,20,8,.5)' },
    icetea: { ad: 'Ice tea',      kisa: 'ice tea',      fiyat: 40, sips: 4, renk: 'rgba(190,105,30,.45)' },
    tost:   { ad: 'Kaşarlı tost', kisa: 'kaşarlı tost', fiyat: 90, sips: 4, yemek: true },
    sosisli:{ ad: 'Sosisli',      kisa: 'sosisli',      fiyat: 80, sips: 4, yemek: true }
  };
  const ICON = { cay: '🍵', oralet: '🍊', kahve: '☕', sahlep: '🥛', soda: '🫧', kola: '🥤', icetea: '🧊', tost: '🥪', sosisli: '🌭' };
  const KAP = { cay: 'glass', oralet: 'glass', kahve: 'porcelain', sahlep: 'ceramic', soda: 'glass', kola: 'glass', icetea: 'glass', tost: 'plate', sosisli: 'plate' };

  /* Türkçe ekler */
  function sonUnlu(n) { const m = n.toLocaleLowerCase('tr').match(/[aeıioöuü](?=[^aeıioöuü]*$)/); return m ? m[0] : 'e'; }
  const unluBiter = n => /[aeıioöuü]$/i.test(n.toLocaleLowerCase('tr'));
  function iyelik(n) { const v = sonUnlu(n), h = { a: 'ı', ı: 'ı', e: 'i', i: 'i', o: 'u', u: 'u', ö: 'ü', ü: 'ü' }[v]; return `${n}'${unluBiter(n) ? 'n' : ''}${h}n`; }
  function yonelme(n) { const v = sonUnlu(n), h = 'aıou'.includes(v) ? 'a' : 'e'; return `${n}'${unluBiter(n) ? 'y' : ''}${h}`; }

  let opt = null, busy = false, lastSu = 0;
  const drinks = [null, null];
  const slotOf = p => (p === opt.persp ? 'me' : 'opp');
  const canControl = p => opt.local || p === opt.persp;
  const seatOfSlot = s => (s === 'me' ? opt.persp : 1 - opt.persp);

  function draw(p) { const t = drinks[p]; if (t) Scene.placeDrink(slotOf(p), t.type, t.level); }

  async function tapDrink(slot) {
    const p = seatOfSlot(slot);
    if (!canControl(p) || busy || Scene.fpBusy) return;
    const t = drinks[p]; if (!t) return;
    if (t.level <= .01) {
      if (t.type === 'kahve' && !t.fal) { fal(p); return; }
      openMenu(p); return;
    }
    busy = true;
    const d = DRINKS[t.type];
    t.level = Math.max(0, Math.round((t.level - 1 / d.sips) * 100) / 100);
    Sfx.lift(KAP[t.type], slot !== 'me');
    if (slot === 'me') {
      await Scene.sipFirstPerson('me', () => { if (d.yemek) Sfx.bite(t.type); else { Sfx.sip(t.type); opt.fx.sip(d.renk); } Scene.setLevel('me', t.level); }, () => Sfx.setDown(KAP[t.type]));
    } else {
      await Scene.sipOther(slot, () => d.yemek ? Sfx.bite(t.type, true) : Sfx.sip(t.type, true), () => Sfx.setDown(KAP[t.type], true)); Scene.setLevel(slot, t.level);
    }
    opt.send(p, { type: t.type, level: t.level, n: t.n || 0 });
    busy = false;
    if (t.level <= .01) opt.toast(t.type === 'kahve' ? 'Kahve bitti. Fincana bir daha dokun, falına bakalım ☕' : d.yemek ? 'Afiyet olsun! Tabağa dokunursan garson gelir.' : d.ad + ' bitti. Garsona bir işaret yeter.', 2600);
  }

  async function fal(p) {
    busy = true;
    const slot = slotOf(p), t = drinks[p];
    Sfx.flip();
    await Scene.flipCup(slot, true);
    Sfx.setDown('porcelain');
    for (let i = 5; i >= 1; i--) { opt.fx.chip(`Fincan soğuyor… ${i}`); await sleep(1000); }
    opt.fx.chip('');
    Sfx.flip();
    await Scene.flipCup(slot, false);
    Sfx.setDown('porcelain');
    t.fal = true; busy = false;
    const f = Fal.uret();
    const ad = opt.names()[p] || 'Misafir';
    opt.modal(`
      <h2>${f.nadir ? 'Nadir fal ✨' : 'Kahve falın'}</h2>
      <div class="falBody">
        <canvas id="falCv" width="300" height="300"></canvas>
        <div><p class="falText"></p>
        <div class="row"><button class="btn" id="falShare">Masaya oku</button><button class="btn ghost" id="falOk">Tamam</button></div></div>
      </div>`, root => {
      Fal.ciz(root.querySelector('#falCv'), f.e);
      root.querySelector('.falText').textContent = f.text;
      root.querySelector('#falOk').onclick = opt.closeModal;
      root.querySelector('#falShare').onclick = () => { opt.say(`☕ ${iyelik(ad)} falı: ${f.text}`); opt.closeModal(); };
    });
  }

  async function order(p, type) {
    const cur = drinks[p] || { n: 0 };
    const t = { type, level: 1, n: (cur.n || 0) + 1 };
    drinks[p] = t;
    opt.send(p, t);
    opt.say(`${opt.names()[p] || 'Biri'} bir ${DRINKS[type].kisa} söyledi ${ICON[type]}`);
    await Scene.serve(slotOf(p), type, 1); Sfx.serve(KAP[type]);
  }

  function sendColdWater(from) {
    const now = Date.now();
    if (now - lastSu < 30000) { opt.toast(`Garson daha önceki suyu taşıyor. ${Math.ceil((30000 - (now - lastSu)) / 1000)} sn bekle.`); return; }
    lastSu = now;
    const names = opt.names(), to = 1 - from;
    opt.event({ kind: 'su', from, to, text: `🧊 ${names[from]}, ${yonelme(names[to] || 'rakibi')} bir soğuk su ısmarladı.` });
  }

  /** Sohbet kanalından gelen olaylar */
  async function event(ev) {
    if (ev.kind !== 'su') return;
    const names = opt.names();
    const toSlot = slotOf(ev.to);
    setTimeout(() => Sfx.ice(), 750);
    if (!opt.local && ev.to === opt.persp) {
      opt.fx.frost();
      opt.banner('Soğuk su geldi 🧊', `${names[ev.from]} ısmarladı. Sakin ol, oyun daha bitmedi.`);
    } else if (!opt.local) {
      opt.toast(`Soğuk su ${yonelme(names[ev.to] || 'rakibe')} gidiyor 😄`);
    } else {
      opt.fx.frost();
      opt.banner('Soğuk su 🧊', `${names[ev.from]}, ${yonelme(names[ev.to])} ısmarladı.`);
    }
    await Scene.coldWater(toSlot);
  }

  function openMenu(forP) {
    let target = forP != null ? forP : opt.persp;
    const names = opt.names();
    const who = opt.local ? `<div class="seg" id="mFor">${[0, 1].map(p => `<button type="button" data-p="${p}" class="${p === target ? 'on' : ''}">${names[p]}</button>`).join('')}</div>` : '';
    opt.modal(`
      <h2>Garson! Ne alırsın?</h2>
      ${who}
      <div class="menuGrid">
        ${Object.entries(DRINKS).map(([k, d]) => `<button class="menuItem" data-k="${k}"><span class="mi">${ICON[k]}</span><span class="mn">${d.ad}</span><span class="mp">${d.fiyat} ₺</span></button>`).join('')}
      </div>
      <button class="btn ice" id="suBtn">🧊 Rakibe soğuk su ısmarla</button>
      <p class="fine">Hesap RCP'ye yazılır. Soğuk su şakadır, rakibin bardağı değişmez.</p>`, root => {
      root.querySelectorAll('#mFor button').forEach(b => b.onclick = () => { target = +b.dataset.p; root.querySelectorAll('#mFor button').forEach(x => x.classList.toggle('on', x === b)); });
      root.querySelectorAll('.menuItem').forEach(b => b.onclick = () => { opt.closeModal(); order(target, b.dataset.k); });
      root.querySelector('#suBtn').onclick = () => { opt.closeModal(); sendColdWater(target); };
    });
  }

  function sync(tbl) {
    [0, 1].forEach(async p => {
      const nt = tbl[p]; if (!nt) return;
      const old = drinks[p];
      if (!old) { drinks[p] = Object.assign({}, nt); draw(p); return; }
      if ((nt.n || 0) > (old.n || 0)) { drinks[p] = Object.assign({}, nt); await Scene.serve(slotOf(p), nt.type, nt.level); Sfx.serve(KAP[nt.type]); return; }
      if (nt.type === old.type && nt.level < old.level - .001) {
        old.level = nt.level; Sfx.lift(KAP[old.type], true);
        await Scene.sipOther(slotOf(p), () => DRINKS[old.type].yemek ? Sfx.bite(old.type, true) : Sfx.sip(old.type, true), () => Sfx.setDown(KAP[old.type], true)); Scene.setLevel(slotOf(p), nt.level); return;
      }
      if (nt.type !== old.type || Math.abs(nt.level - old.level) > .001) { drinks[p] = Object.assign({}, nt); draw(p); }
    });
  }

  async function tapCig() {
    if (busy || Scene.fpBusy) return;
    if (!Scene.cigLit()) { Sfx.lighter(); Scene.lightCig(); return; }
    busy = true;
    await Scene.smokeFirstPerson(() => { Sfx.exhale(); opt.fx.smoke(); });
    busy = false;
  }

  function pick(name) {
    if (name === 'drinkMe') tapDrink('me');
    else if (name === 'drinkOpp') tapDrink('opp');
    else if (name === 'cig') tapCig();
    else if (name === 'pack') { Sfx.lighter(); Scene.lightCig(); opt.toast('Yeni bir tane yakıldı 🚬', 1400); }
  }

  window.Cafe = {
    DRINKS, iyelik, yonelme,
    mount(o) {
      opt = o; drinks[0] = null; drinks[1] = null; busy = false;
      if (o.local || o.initDrinks) sync({ 0: { type: 'cay', level: 1, n: 0 }, 1: { type: 'cay', level: 1, n: 0 } });
    },
    sync, openMenu, event, pick,
    /** Bilgisayar rakip kendi bardağından içer, bitince yenisini söyler */
    async npcSip(p) {
      const t = drinks[p]; if (!t || busy) return;
      const slot = slotOf(p);
      if (t.level <= .01) { const types = ['cay', 'cay', 'cay', 'kahve', 'oralet', 'soda', 'kola', 'tost', 'sosisli']; order(p, types[Math.floor(Math.random() * types.length)]); return; }
      t.level = Math.max(0, Math.round((t.level - 1 / DRINKS[t.type].sips) * 100) / 100);
      Sfx.lift(KAP[t.type], true);
      await Scene.sipOther(slot, () => DRINKS[t.type].yemek ? Sfx.bite(t.type, true) : Sfx.sip(t.type, true), () => Sfx.setDown(KAP[t.type], true));
      Scene.setLevel(slot, t.level);
    },
    redraw() { [0, 1].forEach(p => drinks[p] && draw(p)); }
  };
})();
