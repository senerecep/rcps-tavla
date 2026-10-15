/* RCP's-GAMES — sohbet paneli */
(function () {
  'use strict';
  const EMOJIS = ['😂', '🔥', '👏', '😎', '😤', '🙏', '😱', '💀', '🍀', '🎲', '☕', '🤝'];
  const PHRASES = ['Hadi oyna!', 'Hassiktir', 'Aq', 'Şansımı sikeyim', 'Balını yesinler', 'Haydi yavrum marsa', 'Okullar tatil',
    'Hayde oynaaağ 💃🏻', 'Kaspar olduk birader!', 'Zar bozuk bu!', 'Kırdım seni 😎',
    'Çaylar benden ☕', 'Mars olacaksın!', 'Bir el daha?', 'İyi oyundu 🤝'];

  let sendFn = () => {}, myKey = null, unread = 0;
  const $ = s => document.querySelector(s);

  function isEmojiOnly(t) {
    const s = t.trim();
    return [...s].length <= 4 && /\p{Extended_Pictographic}/u.test(s) && !/[\p{L}\p{N}]/u.test(s);
  }

  function build() {
    const box = $('#chat');
    box.innerHTML = `
      <div class="chatHead"><span>Sohbet</span><button class="icon sm" id="chatClose" aria-label="Sohbeti kapat">✕</button></div>
      <div class="chatList" id="chatList" aria-live="polite"></div>
      <div class="quick emo" id="qEmo"></div>
      <div class="quick phr" id="qPhr"></div>
      <div class="recLabel" id="recLabel" hidden></div>
      <form class="chatForm" id="chatForm" autocomplete="off">
        <button type="button" class="micBtn" id="micBtn" aria-label="Basılı tut, sesli mesaj gönder">🎤</button>
        <input id="chatIn" maxlength="140" placeholder="Bir şey yaz…" enterkeyhint="send">
        <button class="btn sm" type="submit">Gönder</button>
      </form>`;
    const qe = $('#qEmo'), qp = $('#qPhr');
    EMOJIS.forEach(e => { const b = document.createElement('button'); b.type = 'button'; b.textContent = e; b.onclick = () => send(e); qe.appendChild(b); });
    PHRASES.forEach(p => { const b = document.createElement('button'); b.type = 'button'; b.textContent = p; b.onclick = () => send(p); qp.appendChild(b); });
    $('#chatForm').onsubmit = e => {
      e.preventDefault();
      const i = $('#chatIn'); const v = i.value.trim(); if (!v) return;
      send(v); i.value = ''; i.blur();
    };
    $('#chatClose').onclick = () => toggle(false);
  }

  function send(text) { sendFn(text); }

  function add(m) {
    if (!m || !m.text) return;
    const list = $('#chatList'); if (!list) return;
    const row = document.createElement('div');
    if (m.sys) {
      row.className = 'msg sys'; row.textContent = m.text;
    } else {
      const mine = m.key === myKey;
      row.className = 'msg ' + (mine ? 'me' : 'them') + (isEmojiOnly(m.text) ? ' big' : '');
      const n = document.createElement('b'); n.textContent = m.name || '';
      const t = document.createElement('span'); t.textContent = m.text;
      if (!mine) row.appendChild(n);
      row.appendChild(t);
      if (isEmojiOnly(m.text) && Date.now() - (m.t || 0) < 15000) floatEmoji(m.text, mine);
      if (!mine && Date.now() - (m.t || 0) < 15000) { window.Sfx && Sfx.chat(); if (document.body.classList.contains('chat-closed')) badge(++unread); }
    }
    list.appendChild(row);
    while (list.children.length > 80) list.firstChild.remove();
    list.scrollTop = list.scrollHeight;
  }

  function floatEmoji(e, mine) {
    const area = document.getElementById('stage'); if (!area) return;
    const f = document.createElement('div');
    f.className = 'floatEmoji'; f.textContent = e;
    f.style.left = (mine ? 55 + Math.random() * 25 : 20 + Math.random() * 25) + '%';
    area.appendChild(f);
    setTimeout(() => f.remove(), 2600);
  }

  function badge(n) {
    const b = document.querySelector('#chatBtn .badge');
    if (b) { b.textContent = n || ''; b.hidden = !n; }
  }

  function toggle(force) {
    const closed = document.body.classList.toggle('chat-closed', force === undefined ? undefined : !force);
    if (!closed) { unread = 0; badge(0); }
    window.dispatchEvent(new Event('resize'));
  }

  function addVoice(m) {
    const list = $('#chatList'); if (!list) return;
    const mine = m.key === myKey;
    const row = document.createElement('div'); row.className = 'msg voice ' + (mine ? 'me' : 'them');
    if (!mine) { const n = document.createElement('b'); n.textContent = m.name || ''; row.appendChild(n); }
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'vplay';
    btn.innerHTML = `<span>▶</span><i></i><em>${(m.dur || 0).toFixed(1)} sn</em>`;
    btn.onclick = () => window.Voice && Voice.play(m.data);
    row.appendChild(btn); list.appendChild(row); list.scrollTop = list.scrollHeight;
    if (!mine && Date.now() - (m.t || 0) < 20000) { if (window.Sfx && Sfx.on && window.Voice) Voice.play(m.data); if (document.body.classList.contains('chat-closed')) badge(++unread); }
  }

  window.Chat = {
    addVoice,
    mount(opts) { sendFn = opts.send; myKey = opts.key; unread = 0; build(); badge(0); },
    add, sys: text => add({ sys: true, text }), toggle, floatEmoji
  };
})();
