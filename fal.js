/* RCP's-GAMES — kahve falı
 * Fallar parçalardan birleşir: şekil + anlam + zaman/kişi + masa esprisi + kapanış.
 * Araya elle yazılmış "nadir fallar" serpiştirilir. Hep iyi niyetli, hep eğlenceli.
 */
(function () {
  'use strict';
  const pick = a => a[Math.floor(Math.random() * a.length)];

  const SEMBOL = [
    { e: '🐦', ad: 'kuş', m: ['Kuş haber demek. Yolda güzel bir haber var, kanadı biraz yavaş ama geliyor.', 'Kuş kanatlanmış, sıkıntılar uçup gidiyor.', 'Bir kuş konmuş fincanına, kısmetin pencereden giriyor.', 'Kuş ağzında dal taşıyor. Barış, huzur, bir de bedava çay.'] },
    { e: '🐟', ad: 'balık', m: ['Balık kısmet demek. Hem de büyüğünden.', 'Balık su yolunda, bereketin akıp geliyor.', 'İki balık yan yana, ortaklık işi görünüyor. Belki de çift zar.', 'Balık ağzını açmış. Söylenecek güzel bir söz var, kulağın açık olsun.'] },
    { e: '🐎', ad: 'at', m: ['At murattır. Muradına koşa koşa ereceksin.', 'Dörtnala bir at. İşlerin hızlanacak, sakın frene basma.', 'At başı dik, gururlu bir zafer görünüyor.', 'Atın yelesi rüzgârda. Yeni bir yola çıkış var.'] },
    { e: '🔑', ad: 'anahtar', m: ['Anahtar görünüyor. Kapalı bir kapı açılacak, belki de rakibin kapısı.', 'Anahtar çözüm demek. Uğraştığın bir iş kendiliğinden düğümünü çözecek.', 'Elinde anahtar var ama hangi kapı, onu sen bileceksin.', 'Anahtar parlıyor. Yeni bir eve, yeni bir başlangıca işaret.'] },
    { e: '💍', ad: 'yüzük', m: ['Yüzük görünüyor. Bir söz, bir bağlılık, belki bir davet.', 'Yüzük yuvarlak, işler tam bir tur atıp yerine oturacak.', 'Parlak bir yüzük. Birinin gözünde çok kıymetlisin.', 'Yüzük taşı yukarı bakıyor. Sevindirici bir haber yolda.'] },
    { e: '⛰️', ad: 'dağ', m: ['Dağ görünüyor ama tepesi aydınlık. Zor kısım bitti sayılır.', 'Önünde bir dağ var, çıkınca manzara şahane.', 'Dağın ardında güneş doğuyor. Sabreden derviş muradına erer.', 'Dağ sağlam duruyor. Seni kimse yerinden oynatamaz, taşlarını bile.'] },
    { e: '🛤️', ad: 'yol', m: ['Fincanın dibinden ağzına bir yol uzanıyor. Yolculuk var.', 'Açık bir yol, önünde engel yok. Gaza bas.', 'Yol ikiye ayrılıyor. Hangisini seçsen hayırlı.', 'Uzun ama keyifli bir yol. Yanına çay al.'] },
    { e: '🌳', ad: 'ağaç', m: ['Kökleri sağlam bir ağaç. Ailen arkanda, sırtın yere gelmez.', 'Ağaç dallanmış. Yeni insanlar, yeni dostluklar.', 'Meyveli bir ağaç. Emeklerinin karşılığını alma vakti.', 'Ağacın gölgesi geniş. Birilerine sen kol kanat gereceksin.'] },
    { e: '🐈', ad: 'kedi', m: ['Kedi görünüyor. Biraz naz var, biraz da şans.', 'Kedi tüylerini yalıyor. Kendine vakit ayırman lazım.', 'Kedinin kuyruğu dik. Keyfin yerinde olacak.', 'Kedi dört ayak üstüne düşmüş. Her durumdan çıkarsın.'] },
    { e: '🦋', ad: 'kelebek', m: ['Kelebek değişim demek. Yeni bir sayfa açılıyor.', 'Kelebek kanat çırpıyor. Küçük bir hareket büyük sonuç getirecek.', 'Renkli bir kelebek. Hayatına neşe katacak biri var.', 'Kelebek uçmaya hazır. Sen de hazırsın.'] },
    { e: '🌙', ad: 'hilal', m: ['Hilal görünüyor. Yeni bir dönem, yeni bir ay, yeni bir şans.', 'Ay büyüyor. Kısmetin de onunla büyüyor.', 'Hilalin ucunda bir yıldız. Dileğin gerçekleşmeye yakın.', 'Ay ışığı fincana vurmuş. Gece güzel geçecek.'] },
    { e: '⭐', ad: 'yıldız', m: ['Yıldız var. Parlama zamanı geldi.', 'Yıldızın parlak, bu akşam masada göz önündesin.', 'Kayan bir yıldız. Hemen bir dilek tut.', 'Yıldızlar sıralanmış. Şansın tam yerinde.'] },
    { e: '🏠', ad: 'ev', m: ['Ev görünüyor. Huzurlu bir yuva, sıcak bir sofra.', 'Evin bacası tütüyor. Bereket var, misafir var.', 'Yeni bir ev ya da evde yeni bir düzen görünüyor.', 'Evin kapısı açık. Gelen gidenin bol olacak.'] },
    { e: '⛵', ad: 'gemi', m: ['Gemi yelken açmış. Rüzgâr arkandan esiyor.', 'Gemi limana yanaşıyor. Beklediğin şey geliyor.', 'Uzaklardan bir haber gemiyle yola çıkmış.', 'Gemi dalgaları yarıyor. Sen de engelleri öyle yaracaksın.'] },
    { e: '🐘', ad: 'fil', m: ['Fil hafıza demek. Unutulmuş bir iyilik geri dönecek.', 'Filin hortumu yukarıda. Bu çok uğurlu.', 'Fil sağlam basıyor. Kararlarında emin adımlarla ilerleyeceksin.', 'Koca bir fil. Büyük bir iş, ama hakkından gelirsin.'] },
    { e: '🎲', ad: 'zar', m: ['Fincanda zar var! Bu gece zarlar senden yana.', 'Zar şeş gösteriyor. Daha ne diyeyim.', 'İki zar yan yana. Çift atacaksın, hem de yerinde.', 'Zarın bir yüzü kapalı. Sürpriz var.'] },
    { e: '🫖', ad: 'demlik', m: ['Demlik görünüyor. Muhabbet uzun, çay bol.', 'Demlik fokurduyor. Güzel bir sohbet kapıda.', 'Demliğin ağzından buhar çıkıyor. Biri seni çok merak ediyor.', 'Tavşan kanı bir demlik. Her şey kıvamında olacak.'] },
    { e: '🦅', ad: 'kartal', m: ['Kartal yükseklerde. Hedefini tepeden görüyorsun.', 'Kartalın gözü keskin. Kimse seni kandıramaz.', 'Kartal kanat açmış. Büyük bir başarı yolda.', 'Kartal süzülüyor. Acele etme, an gelince dal.'] },
    { e: '🌹', ad: 'gül', m: ['Gül görünüyor. Gönül işleri tatlı.', 'Açmış bir gül. Güzel bir sürpriz seni bekliyor.', 'Gülün dikeni bile tatlı duruyor. Küçük tartışmalar tatlıya bağlanacak.', 'Gül demeti. Birileri seni takdir edecek.'] },
    { e: '🕊️', ad: 'güvercin', m: ['Güvercin barış getiriyor. Küs olanlar barışacak.', 'Güvercin mektup taşıyor. Beklenen haber geliyor.', 'Bembeyaz bir güvercin. İçin rahat olsun.', 'Güvercin yuvaya dönüyor. Uzaktaki biri yakına geliyor.'] },
    { e: '🦁', ad: 'aslan', m: ['Aslan görünüyor. Cesaretin artacak, sesin gür çıkacak.', 'Aslan yelesini sallıyor. Masanın hâkimi sen olacaksın.', 'Uyuyan bir aslan. Gücünü sakla, zamanı gelince göster.', 'Aslan payı senin. Paylaşırken cömert ol.'] },
    { e: '🐢', ad: 'kaplumbağa', m: ['Kaplumbağa yavaş ama emin. Acele etme, sen kazanacaksın.', 'Kaplumbağa kabuğundan çıkmış. Yeni bir cesaret var.', 'Kaplumbağa uzun ömür demek. Sağlıklı, huzurlu günler.', 'Kaplumbağa yarışı kazanıyor. Sabırla oynayan kazanır.'] },
    { e: '👑', ad: 'taç', m: ['Taç görünüyor. Bu masanın şahı sensin.', 'Başında bir taç. Takdir edilecek, alkışlanacaksın.', 'Altın bir taç. Emeklerin ödüllendirilecek.', 'Taç biraz yamuk duruyor ama yakışıyor.'] },
    { e: '🚗', ad: 'araba', m: ['Araba görünüyor. Bir gezme tozma var.', 'Araba yola çıkmış. Beklediğin biri yolda.', 'Arabanın farları yanıyor. Önünü net göreceksin.', 'Araba park etmiş. Bir işin yerli yerine oturacak.'] },
    { e: '✈️', ad: 'uçak', m: ['Uçak var. Uzak bir yer seni çağırıyor.', 'Uçak havalanıyor. Moralin uçacak.', 'Uçak iniyor. Uzaktan biri gelecek.', 'Bulutların üstünde bir uçak. Dertler aşağıda kaldı.'] },
    { e: '🍀', ad: 'yonca', m: ['Dört yapraklı yonca! Bu fincan şans dolu.', 'Yonca görünüyor. Uğur seninle.', 'Yoncanın bir yaprağı büyük. Bir dileğin öne çıkıyor.', 'Yonca tarlası. Şans tek başına gelmez.'] },
    { e: '🐓', ad: 'horoz', m: ['Horoz ötüyor. Uyanma vakti, fırsat kapında.', 'Horoz gururla dikilmiş. Sözün dinlenecek.', 'Horoz sabahı müjdeliyor. Yeni bir gün, yeni bir el.', 'Horoz eşeliyor. Aradığını bulacaksın.'] },
    { e: '☂️', ad: 'şemsiye', m: ['Şemsiye açık. Ne yağarsa yağsın sana bir şey olmaz.', 'Şemsiye korunmak demek. Biri seni gözetiyor.', 'Kapalı bir şemsiye. Yağmur bitti, güneş çıkıyor.', 'Şemsiyenin altında iki kişi. Paylaşılan bir sevinç var.'] }
  ];

  const ACILIS = [
    'Fincanında {s} görüyorum.', 'Bak bak, şuracıkta bir {s} var.', 'Telve {s} şeklinde toplanmış.',
    'Fincanın kulpuna yakın bir {s} duruyor.', 'Dibe doğru bir {s} seçiliyor.', 'Hah, işte! Kocaman bir {s}.',
    'Fincanın ağzında bir {s} beliriyor.', 'Şu tarafta bir {s}, öbür tarafta da gölgesi.',
    'İlk gözüme çarpan bir {s} oldu.', 'Telve akmış, bir {s} çizmiş.', 'Fincanın sağında bir {s} saklanıyor.',
    'Çevir çevir baktım, her seferinde {s} çıkıyor.'
  ];

  const ZAMAN = ['üç vakte kadar', 'üç güne kadar', 'kırk gün içinde', 'bu akşam', 'iki zar atımı sonra',
    'çayın soğumadan', 'sıradaki elde', 'hafta sonuna kadar', 'bir sonraki düşeşte', 'ay dolmadan',
    'garson bir daha uğramadan', 'üç el sonra', 'yarın sabah ilk çayda', 'bayramdan önce', 'sigaran bitmeden'];

  const KISI = ['esmer biri', 'kısa boylu, bıyıklı biri', 'elinde tepsi olan biri', 'kahvehanenin müdavimlerinden biri',
    'adının içinde R harfi geçen biri', 'uzun boylu, sessiz biri', 'gözlüklü biri', 'senden yaşça büyük biri',
    'güler yüzlü biri', 'sarı arabası olan biri', 'telefonu hep sessizde olan biri', 'çayı şekersiz içen biri',
    'tavlada hep "zar bozuk" diyen biri', 'uzaktan bir akraban', 'eski bir arkadaşın'];

  const BAGLAC = [
    '{z} {k} sana güzel bir haber getirecek.', '{k} hakkında hayırlı konuşuyor, {z} bunu duyacaksın.',
    '{z} {k} kapını çalacak, eli boş gelmeyecek.', '{k} seni düşünüyor. {Z} bir işaret gelecek.',
    '{z} {k} ile yolun kesişecek.', '{Z} bir müjde var, getiren {k}.', '{k} sana bir çay ısmarlayacak, {z}.'
  ];

  const MASA = [
    'Rakibin taşları birbirine girecek.', 'Kapıların açık olsun, zarların yüksek.', 'Bir mars kokusu var ama kimin, telve söylemiyor.',
    'Kırılan taşın hemen içeri girecek.', 'Bu akşam şeşbeşler senden yana.', 'Rakibin bir kapıyı açık unutacak, sakın kaçırma.',
    'Bir el kaybedersen üzülme, rövanşta kasıp kavuracaksın.', 'Zar elinde ısınıyor, at gitsin.', 'Rakip çay söylerken sen taş topluyor olacaksın.',
    'Kapını kapatmaya çalışan var ama anahtar sende.', 'Bu gece düşeşin kokusu geliyor.', 'Taşların evine erken dönecek.',
    'Rakibinin zarı bozulacak, ama sen yine de dikkatli oyna.', 'Masada bir hepyek görünüyor, gülme bekle.',
    'Bir taşın yalnız kalacak ama kimse dokunmayacak.', 'Rakip "zar bozuk" diyecek, sen sadece gülümse.',
    'Tavla koltuğunun altına girmeyecek, ona söz veriyorum.', 'Pullar senin için dizilecek.', 'Garson sana bir çay daha getirecek, hayırdır.',
    'Bu masadan kazançlı kalkacaksın.', 'Bir taşı geri çevirmen gerekecek, çevir, hayırlısı odur.',
    'Rakibin yüzündeki gülümseme ikinci elde silinecek.', 'Bir kapıyı açık bıraktın gibi ama aslında tuzak.',
    'Masanın bereketi bol, çaylar senden olsun.', 'Kahvehanede adın bir süre konuşulacak, hep iyilikle.',
    'Bir sonraki zarın tam istediğin sayı.', 'Kırık taş görünmüyor, yalnız rakibin taşları biraz tedirgin.',
    'Bu fincan "rövanş iste" diyor.', 'Toplamaya ilk sen başlayacaksın.', 'Masadaki herkes senin oyununu konuşacak.'
  ];

  const KAPANIS = [
    'Gerisini fincan söylemiyor, telve utandı.', 'Kapat kapat, gerisi kısmet.', 'Bu fal 15 lira, hesaba yazıyorum.',
    'İnanma, ama güzel şeylere inan.', 'Niyetine göre çıksın.', 'Fincanın temiz, kalbin de temiz.',
    'Hayırlısı neyse o olsun.', 'Ben söyledim, sen unutma.', 'Fal bu kadar, gerisi zarın keyfine.',
    'Şimdi bir çay daha söyle, kısmet açılsın.', 'Dilek tuttuysan tutuldu say.', 'Bu fincanı saklayasım geldi.',
    'Fal yalan olmaz ama falcı yanılabilir.', 'Telve az ama söz çok.', 'Kalk bakalım, sıra zarda.'
  ];

  const NADIR = [
    { e: '🫶', t: 'Bu fincan çok nadir! Telve kalp şeklinde toplanmış, ortasında bir zar. Hem gönlün hem zarın aynı anda açılıyor. Böylesini yılda bir görürüm.' },
    { e: '🧞', t: 'Fincanın dibinde bir cin var! Üç dilek hakkın var ama ikisini düşeşe harcama, birini de çaya sakla.' },
    { e: '🏆', t: 'Fincanda kupa görünüyor. Bu masanın şampiyonu belli oldu. Rakibine söyleme, kendi görsün.' },
    { e: '🌈', t: 'Telve gökkuşağı çizmiş. Yedi renk, yedi güzel haber. Birini bu akşam alacaksın.' },
    { e: '🐉', t: 'Fincanda ejderha var! Masaya ateş saçacaksın. Rakip soğuk su ısmarlasa da sönmez.' },
    { e: '🧿', t: 'Fincanda koca bir nazar boncuğu. Kim ne derse desin, sana nazar değmez. Zarına da değmez.' },
    { e: '🎻', t: 'Fincanda bir keman görünüyor. Bu akşam her şey ahenk içinde. Zarlar bile ritim tutacak.' },
    { e: '🦄', t: 'Tek boynuzlu at! Böyle fal çıkmaz, çıktıysa da hayırdır. Bu gece imkânsız atışlar senin.' },
    { e: '🍉', t: 'Fincanda karpuz var. Kahvede karpuz ne arar demeyeceğim, bereket demek. Ferah bir hafta seni bekliyor.' },
    { e: '🚀', t: 'Fincandan roket kalkıyor. Morali tavan yapacaksın. Pullarını uzaya fırlatma yeter.' },
    { e: '🕰️', t: 'Fincanda saat var, akrep ile yelkovan üstüste. Tam zamanında, tam yerinde olacaksın.' },
    { e: '🎁', t: 'Fincanda paket görünüyor. Biri sana hediye hazırlıyor. Kim olduğunu söylersem sürpriz kaçar.' },
    { e: '🥇', t: 'Bu fincanda madalya var. Bugün kim ne derse desin birincisin. Telve yemin ediyor.' },
    { e: '🍯', t: 'Fincanın dibi bal gibi. Önümüzdeki günler tatlı, sözlerin tatlı, zarların tatlı.' },
    { e: '🧭', t: 'Fincanda pusula var. Kafan karışıksa bile yönünü bulacaksın. Kuzey, bir sonraki zar.' }
  ];

  const ayir = (s) => s.charAt(0).toLocaleUpperCase('tr') + s.slice(1);

  function uret() {
    if (Math.random() < 0.08) { const n = pick(NADIR); return { e: n.e, ad: 'nadir', text: n.t, nadir: true }; }
    const s = pick(SEMBOL);
    const parts = [pick(ACILIS).replace('{s}', s.ad), pick(s.m)];
    if (Math.random() < 0.75) {
      const z = pick(ZAMAN), k = pick(KISI);
      parts.push(ayir(pick(BAGLAC).replace('{z}', z).replace('{Z}', ayir(z)).replace('{k}', k)));
    }
    parts.push(pick(MASA));
    parts.push(pick(KAPANIS));
    return { e: s.e, ad: s.ad, text: parts.join(' ') };
  }

  /** Fincanın içini çizer: porselen, telve lekeleri ve ortada sembolün telveden silüeti */
  function ciz(canvas, emoji) {
    const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2, R = W * 0.46;
    g.clearRect(0, 0, W, H);
    const rim = g.createRadialGradient(cx, cy, R * .7, cx, cy, R);
    rim.addColorStop(0, '#f4efe6'); rim.addColorStop(1, '#d9cfbf');
    g.fillStyle = rim; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.strokeStyle = '#c99a3e'; g.lineWidth = W * .02; g.beginPath(); g.arc(cx, cy, R - W * .01, 0, 7); g.stroke();
    g.save(); g.beginPath(); g.arc(cx, cy, R * .93, 0, 7); g.clip();
    for (let i = 0; i < 900; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), .7) * R * .93;
      g.fillStyle = `rgba(${40 + Math.random() * 30 | 0},${20 + Math.random() * 15 | 0},8,${Math.random() * .35})`;
      g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.random() * W * .012, 0, 7); g.fill();
    }
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2; g.strokeStyle = 'rgba(55,28,10,.35)'; g.lineWidth = W * .006;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * R * .2, cy + Math.sin(a) * R * .2);
      g.quadraticCurveTo(cx + Math.cos(a + .4) * R * .6, cy + Math.sin(a + .4) * R * .6, cx + Math.cos(a + .2) * R * .9, cy + Math.sin(a + .2) * R * .9); g.stroke();
    }
    g.restore();
    // sembol silüeti
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
    const s = c2.getContext('2d');
    s.font = `${Math.round(W * .42)}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`;
    s.textAlign = 'center'; s.textBaseline = 'middle';
    s.fillText(emoji, cx, cy + W * .03);
    s.globalCompositeOperation = 'source-in';
    s.fillStyle = '#3a1c0a'; s.fillRect(0, 0, W, H);
    s.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 500; i++) { s.fillStyle = `rgba(0,0,0,${Math.random() * .6})`; s.beginPath(); s.arc(Math.random() * W, Math.random() * H, Math.random() * W * .008, 0, 7); s.fill(); }
    g.globalAlpha = .88; g.drawImage(c2, 0, 0); g.globalAlpha = 1;
  }

  window.Fal = { uret, ciz, SEMBOL_SAYISI: SEMBOL.length };
})();
