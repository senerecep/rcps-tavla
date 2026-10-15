/* RCP's-GAMES — sesli mesaj ve canlı sesli sohbet
 * Sesli mesaj: mikrofona basılı tut, konuş, bırak. Kayıt (en çok 15 sn) sıkıştırılıp karşıya gider, orada kendiliğinden çalar.
 * Canlı sohbet: iki oyuncu 🎙️'yu açınca telefonlar Firebase üzerinden el sıkışır ve doğrudan (WebRTC) konuşur.
 */
(function () {
  'use strict';
  let opt = null, stream = null, rec = null, chunks = [], t0 = 0, tick = null;
  const MAX = 15000;
  const toast = (m, ms) => opt && opt.toast && opt.toast(m, ms);

  function pickMime() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
  }
  async function getMic() {
    if (stream && stream.getTracks().some(t => t.readyState === 'live')) return stream;
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    return stream;
  }
  function releaseMic() { if (stream && !rec && Live.state === 'off') { stream.getTracks().forEach(t => t.stop()); stream = null; } }
  const toDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });

  /* ---------- Sesli mesaj ---------- */
  async function startRec() {
    if (rec) return;
    if (!navigator.mediaDevices || !window.MediaRecorder) { toast('Bu tarayıcı ses kaydını desteklemiyor'); return; }
    try {
      const s = await getMic(), mt = pickMime();
      rec = new MediaRecorder(s, mt ? { mimeType: mt, audioBitsPerSecond: 24000 } : undefined);
      chunks = []; rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = finish; rec.start(); t0 = Date.now(); ui(true);
      tick = setInterval(() => { const s = (Date.now() - t0) / 1000; label(s); if (s * 1000 >= MAX) stopRec(); }, 200);
    } catch (e) { rec = null; toast('Mikrofona izin verilmedi. Tarayıcı ayarlarından izin verebilirsin.', 3200); }
  }
  function stopRec(cancel) {
    if (!rec) return;
    rec._cancel = !!cancel; clearInterval(tick); ui(false);
    try { rec.stop(); } catch (e) {}
  }
  async function finish() {
    const r = rec; rec = null;
    const dur = (Date.now() - t0) / 1000;
    releaseMic();
    if (!r || r._cancel) return;
    if (dur < .6) { toast('Basılı tutup konuş, bırakınca gider', 1600); return; }
    const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
    if (blob.size > 400000) { toast('Kayıt çok büyük oldu, daha kısa konuş'); return; }
    const data = await toDataURL(blob);
    opt.send({ data, dur: Math.round(dur * 10) / 10 });
  }
  function ui(onRec) {
    const b = document.getElementById('micBtn'), l = document.getElementById('recLabel');
    if (b) b.classList.toggle('rec', onRec);
    if (l) { l.hidden = !onRec; if (onRec) label(0); }
  }
  function label(s) { const l = document.getElementById('recLabel'); if (l) l.textContent = `● Kaydediliyor 0:${String(Math.floor(s)).padStart(2, '0')} · bırakınca gider`; }

  let current = null;
  function play(src) {
    try {
      if (current) current.pause();
      current = new Audio(src); current.volume = 1;
      current.play().catch(() => toast('Sesi çalmak için ▶ düğmesine dokun', 2000));
    } catch (e) {}
  }
  function bindMic(btn) {
    if (!btn) return;
    btn.addEventListener('pointerdown', e => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch (er) {} startRec(); });
    btn.addEventListener('pointerup', () => stopRec(false));
    btn.addEventListener('pointercancel', () => stopRec(true));
    btn.addEventListener('contextmenu', e => e.preventDefault());
  }

  /* ---------- Canlı sesli sohbet (WebRTC, sinyal Firebase üzerinden) ---------- */
  const ICE = {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
    ]
  };
  const Live = {
    state: 'off', pc: null, sid: null, me: 0, snap: {}, offs: [], candOff: null, audio: null, busy: false,
    attach(seat) {
      this.detach(); this.me = seat;
      const r = Net.ref('rtc'); if (!r) return;
      const f = s => { this.snap = s.val() || {}; this.react(); };
      r.on('value', f); this.offs.push(() => r.off('value', f));
      if (!this.audio) { this.audio = document.createElement('audio'); this.audio.autoplay = true; this.audio.setAttribute('playsinline', ''); document.body.appendChild(this.audio); }
    },
    detach() { if (this.state !== 'off') this.disable(); this.offs.forEach(f => f()); this.offs = []; },
    set(st, msg) { this.state = st; opt && opt.onLive && opt.onLive(st); if (msg) toast(msg, 2600); },
    async enable() {
      try { await getMic(); } catch (e) { toast('Mikrofona izin verilmedi.', 2600); return; }
      const r = Net.ref('rtc/on' + this.me); r.set(true); r.onDisconnect().set(false);
      this.set('waiting', 'Sesli sohbet açık. Rakip de açınca bağlanacak.');
      this.react();
    },
    disable() {
      const r = Net.ref('rtc/on' + this.me); if (r) r.set(false);
      this.close(); this.set('off'); releaseMic();
    },
    toggle() { if (this.state === 'off') this.enable(); else this.disable(); },
    close() { if (this.candOff) { this.candOff(); this.candOff = null; } if (this.pc) { try { this.pc.close(); } catch (e) {} this.pc = null; } this.sid = null; },
    newPc(sid) {
      this.close(); this.sid = sid;
      const pc = this.pc = new RTCPeerConnection(ICE), other = 1 - this.me;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.onicecandidate = e => { if (e.candidate && this.sid === sid) Net.ref(`rtc/cand/${sid}/${this.me}`).push(e.candidate.toJSON()); };
      pc.ontrack = e => { this.audio.srcObject = e.streams[0]; this.audio.play().catch(() => {}); };
      pc.onconnectionstatechange = () => {
        if (this.pc !== pc) return;
        const c = pc.connectionState;
        if (c === 'connected') this.set('live', 'Sesli sohbet bağlandı 🎙️');
        else if (c === 'failed') this.set('failed', 'Bağlantı kurulamadı, ağ engelliyor olabilir. Sesli mesaj her zaman çalışır.');
        else if (c === 'disconnected') this.set('waiting');
      };
      const cr = Net.ref(`rtc/cand/${sid}/${other}`);
      const f = s => { if (this.pc === pc) pc.addIceCandidate(s.val()).catch(() => {}); };
      cr.on('child_added', f); this.candOff = () => cr.off('child_added', f);
    },
    async react() {
      if (this.state === 'off' || !stream) return;
      if (this.busy) { this.again = true; return; }
      const v = this.snap || {}, other = 1 - this.me;
      this.busy = true;
      try {
        if (!v['on' + other]) { if (this.pc) { this.close(); this.set('waiting', 'Rakip sesli sohbeti kapattı.'); } return; }
        if (this.me === 0) {
          if (!this.pc) {
            const sid = Math.random().toString(36).slice(2, 9);
            this.newPc(sid);
            const off = await this.pc.createOffer(); await this.pc.setLocalDescription(off);
            await Net.ref('rtc/answer').remove();
            await Net.ref('rtc/offer').set({ sdp: off.sdp, sid, t: Date.now() });
            this.set('connecting');
          } else if (v.answer && v.answer.sid === this.sid && this.pc.signalingState === 'have-local-offer') {
            await this.pc.setRemoteDescription({ type: 'answer', sdp: v.answer.sdp });
          }
        } else if (v.offer && v.offer.sid !== this.sid && Date.now() - (v.offer.t || 0) < 120000) {
          this.newPc(v.offer.sid);
          await this.pc.setRemoteDescription({ type: 'offer', sdp: v.offer.sdp });
          const ans = await this.pc.createAnswer(); await this.pc.setLocalDescription(ans);
          await Net.ref('rtc/answer').set({ sdp: ans.sdp, sid: v.offer.sid });
          this.set('connecting');
        }
      } catch (e) { console.error(e); this.set('failed', 'Sesli sohbet başlatılamadı.'); }
      finally { this.busy = false; if (this.again) { this.again = false; this.react(); } }
    }
  };

  window.Voice = {
    mount(o) { opt = o; bindMic(document.getElementById('micBtn')); if (o.online) Live.attach(o.seat); },
    unmount() { Live.detach(); stopRec(true); },
    play, live: Live,
    supported: () => !!(navigator.mediaDevices && window.MediaRecorder)
  };
})();
