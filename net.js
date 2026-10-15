/* RCP's-GAMES — online masa katmanı (Firebase Realtime Database)
 * lobby/{kod}  : masa listesi için özet
 * rooms/{kod}  : players, state (JSON metin), opening, table (içecekler), chat
 */
(function () {
  'use strict';
  let db = null, room = null, code = null, seat = null, subs = [];

  const myId = (() => {
    let id = localStorage.getItem('rcp_id');
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('rcp_id', id); }
    return id;
  })();

  function configured() {
    const c = window.FIREBASE_CONFIG;
    return !!(c && c.apiKey && c.databaseURL && !/BURAYA|PROJE-ID/.test(c.apiKey + c.databaseURL) && window.firebase);
  }
  function init() {
    if (db) return true;
    if (!configured()) return false;
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      db = firebase.database();
      return true;
    } catch (e) { console.error(e); return false; }
  }

  async function create(name, target) {
    if (!init()) throw new Error('Online bağlantı ayarlı değil');
    for (let t = 0; t < 12; t++) {
      const c = String(1000 + Math.floor(Math.random() * 9000));
      const ex = await db.ref('lobby/' + c).get();
      if (ex.exists() && Date.now() - (ex.val().created || 0) < 12 * 3600e3) continue;
      const st = Tavla.newState(1, [0, 0], target);
      await db.ref('rooms/' + c).set({
        meta: { created: Date.now() },
        players: { 0: { name, id: myId, online: true } },
        state: JSON.stringify(st),
        table: { 0: { type: 'cay', level: 1, n: 0 }, 1: { type: 'cay', level: 1, n: 0 } }
      });
      await db.ref('lobby/' + c).set({ created: Date.now(), host: name, guest: '', on0: true, on1: false });
      return enter(c, 0, name);
    }
    throw new Error('Boş masa bulunamadı, bir daha dene');
  }

  async function join(c, name) {
    if (!init()) throw new Error('Online bağlantı ayarlı değil');
    const snap = await db.ref('rooms/' + c).get();
    if (!snap.exists()) throw new Error(c + ' numaralı masa yok. Numarayı kontrol et.');
    const pl = snap.val().players || {};
    let s = null;
    if (pl[0] && pl[0].id === myId) s = 0;
    else if (pl[1] && pl[1].id === myId) s = 1;
    else if (!pl[1]) s = 1;
    else if (!pl[0]) s = 0;
    else if (!pl[1].online) s = 1;
    else if (!pl[0].online) s = 0;
    if (s === null) throw new Error('Masa dolu, iki kişi oynuyor.');
    return enter(c, s, name);
  }

  function enter(c, s, name) {
    code = c; seat = s; room = db.ref('rooms/' + c);
    const pref = room.child('players/' + s);
    pref.update({ name, id: myId, online: true });
    pref.child('online').onDisconnect().set(false);
    const lob = db.ref('lobby/' + c);
    lob.update(s === 0 ? { host: name, on0: true } : { guest: name, on1: true });
    lob.child('on' + s).onDisconnect().set(false);
    return { code: c, seat: s };
  }

  function sub(ref, ev, cb) { ref.on(ev, cb); subs.push(() => ref.off(ev, cb)); }

  function listen(h) {
    sub(room.child('players'), 'value', s => h.players(s.val() || {}));
    sub(room.child('state'), 'value', s => { const v = s.val(); if (v) try { h.state(JSON.parse(v)); } catch (e) { console.error(e); } });
    sub(room.child('opening'), 'value', s => h.opening(s.val() || {}));
    sub(room.child('table'), 'value', s => h.table(s.val() || {}));
    sub(room.child('chat').limitToLast(40), 'child_added', s => h.chat(s.val()));
    sub(room.child('voice').limitToLast(3), 'child_added', s => h.voice && h.voice(s.val()));
    sub(db.ref('.info/connected'), 'value', s => h.conn && h.conn(!!s.val()));
  }

  const setState = st => room && room.child('state').set(JSON.stringify(st));
  const setOpening = (key, p, v) => room && room.child('opening/' + key + '/' + p).set(v);
  const setTable = (p, t) => room && room.child('table/' + p).set(t);
  const chat = m => room && room.child('chat').push(m);
  const voice = m => room && room.child('voice').push(m);
  const ref = path => (room ? room.child(path) : null);

  function leave() {
    subs.forEach(f => f()); subs = [];
    if (room) {
      room.child('players/' + seat + '/online').set(false);
      db.ref('lobby/' + code + '/on' + seat).set(false);
    }
    room = null; code = null; seat = null;
  }

  function lobby(cb) {
    if (!init()) return () => {};
    const q = db.ref('lobby').orderByChild('created').limitToLast(30);
    const f = s => { const a = []; s.forEach(c => { a.push(Object.assign({ code: c.key }, c.val())); }); cb(a.reverse()); };
    q.on('value', f, () => cb(null));
    return () => q.off('value', f);
  }

  window.Net = { configured, init, create, join, listen, setState, setOpening, setTable, chat, voice, ref, leave, lobby, myId };
})();
