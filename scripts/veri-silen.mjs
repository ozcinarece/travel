// #494 bekçi: bir migration'ın veri silebilecek bir ifade içerip içermediğini söyler (§4, geri dönüşsüz iş).
// Otomatik (push) supabase-migrate bekleyen dosyalardan biri eşleşirse hiçbirini uygulamadan durur.
// Kalıplar scripts/veri-silen.test.mjs ile sabit; yeni bir biçim eklerken oraya örnek ekle.
//
// #501: metin tek geçişte okunur; yorumlar `'…'`, `"…"` ve `$tag$…$tag$` dışında atılır.
// - `do [language x] $tag$ … $tag$` blokları migration sırasında hemen çalışır: taranır; içinde `execute` (dinamik
//   SQL) varsa ihtiyaten durdurulur.
// - `create [or replace] function|procedure ad … as $tag$ … $tag$` gövdeleri kendiliğinden taranmaz; ama aynı
//   dosyada çalışan metin (gövde dışı, `do` blokları, çağrılan başka fonksiyonlar) `ad(` diye o fonksiyonu
//   çağırıyorsa (`select`, `perform`, `call`, varsayılan, politika…) ya da `create trigger … on t … execute function
//   ad` varken aynı dosya `t`ye yazıyorsa gövde de taranır. `drop/grant/revoke/comment/alter function ad(…)` çağrı
//   sayılmaz.
// - #526: fonksiyon haritası bütün migration'lardan kurulur (`fonksiyonHaritasi`, `bekciSonuclari`). Bir dosya
//   değerlendirilirken kendisinden önceki dosyaların tanımları geçerlidir; aynı ad ve imzanın birden çok tanımı
//   varsa son tanım kalır. Önceki bir dosyada tanımlanmış silen fonksiyonu çağıran yeni dosya da durdurur.
//   Tetikleyiciler de haritada (`ad on tablo` → ifade, son tanım): önceki dosyada silen fonksiyona bağlanmış
//   tabloya yazan yeni dosya durdurur. Sonraki `drop trigger|function` haritadan düşürmez (ihtiyatlı).
// - Bilinen sınırlar (tehdit modeli kazara yazılan hata; kasıtlı atlatma kapsam dışı): `execute` ile dinamik
//   kurulan ya da dolar tırnağı dışında (`as 'gövde'`) yazılmış fonksiyon gövdeleri haritaya girmez; çağrılar
//   şemadan bağımsız, sade adla eşleşir; `standard_conforming_strings = off` (düz `'…'` içinde `\'`) varsayılmaz.

// `alter table … drop …`: `column` kelimesi Postgres'te isteğe bağlı. Kısıt, varsayılan, not null, identity ve
// üretilen ifade kaldırmak veri silmez; bunlar hariç her `drop` sayılır. `[^;]*?` aynı ifadedeki sonraki `drop`'a da
// bakar (ör. `drop constraint a, drop b`).
const ALTER_TABLE_DROP =
  /\balter\s+(?:foreign\s+)?table\b[^;]*?\bdrop\s+(?!constraint\b|default\b|not\s+null\b|identity\b|expression\b)/;

/** Tanıtıcı: `ad`, `"Ad Soyad"`; isteğe bağlı şema ile. */
const ID = String.raw`(?:"[^"]+"|\w+)`;
const NITELIKLI = String.raw`${ID}(?:\.${ID})?`;

const KALIPLAR = [
  /\bdrop\s+(?:table|schema|type|domain|foreign\s+table|materialized\s+view|database|extension|owned\s+by)\b/,
  ALTER_TABLE_DROP,
  // `alter [column] c [set data] type …`; `column` isteğe bağlı.
  /\balter\s+(?:column\s+)?(?!table\b|type\b)\S+\s+(?:set\s+data\s+)?type\b/,
  /\btruncate\b/,
  /\bdelete\s+from\b/,
  // `update [only] t [[as] takma] set …`: var olan satırı ezer. Tetikleyici (`before update on`), yetki
  // (`grant update`) ve upsert (`do update set`, tablo adı yok) sayılmaz.
  // #526 KK2: `update t * set`, `update t as "x" set`, `update "t" "x" set`.
  new RegExp(
    String.raw`\bupdate\s+(?:only\s+)?(?!set\b)${NITELIKLI}(?:\s*\*\s*|\s+)(?:(?:as\s+)?(?!set\b)${ID}\s+)?set\b`,
  ),
  // `merge into … when matched then delete | update set`.
  /\bmerge\s+into\b/,
  // `drop … cascade` bağlı nesneleri de siler. Yabancı anahtardaki `on delete/update cascade` sayılmaz.
  /(?<!\bon\s+(?:delete|update)\s+)\bcascade\b/,
];

const ETIKET = /\$([a-z_][a-z0-9_]*)?\$/y;
// Ad; argüman listesi (imza) `argumanListesi` ile dengeli parantezle okunur.
const FONKSIYON_BASI = new RegExp(String.raw`\bcreate\s+(?:or\s+replace\s+)?(?:function|procedure)\s+(${NITELIKLI})\s*`);
const DO_BASI = /\bdo(?:\s+language\s+\w+)?\s*$/;
const DINAMIK = /\bexecute\b(?!\s+(?:function|procedure)\b)/;

/**
 * Küçük harfli SQL'i tek geçişte parçalar: `{ duz }` (yorumlar boşluk, tırnaklı metinler olduğu gibi; içlerindeki
 * `;` ifade sonu sayılmasın diye `,`) ve `{ dolar }` (dolar tırnaklı gövde, ham).
 */
function parcala(sql) {
  const parcalar = [];
  let duz = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    const d = sql[i + 1];
    if (c === '-' && d === '-') {
      const satir = sql.indexOf('\n', i);
      i = satir < 0 ? n : satir;
      duz += ' ';
    } else if (c === '/' && d === '*') {
      // Postgres blok yorumları iç içe olabilir.
      let derinlik = 1;
      i += 2;
      while (i < n && derinlik > 0) {
        if (sql.startsWith('/*', i)) {
          derinlik += 1;
          i += 2;
        } else if (sql.startsWith('*/', i)) {
          derinlik -= 1;
          i += 2;
        } else {
          i += 1;
        }
      }
      duz += ' ';
    } else if (c === "'" || c === '"') {
      // #526 KK3: `E'…'` (kaçışlı metin) içinde `\'` metni bitirmez.
      const kacisli = c === "'" && sql[i - 1] === 'e' && !/[\w$]/.test(sql[i - 2] ?? '');
      let j = i + 1;
      while (j < n && !(sql[j] === c && sql[j + 1] !== c)) j += sql[j] === c || (kacisli && sql[j] === '\\') ? 2 : 1;
      duz += sql.slice(i, j + 1).replaceAll(';', ',');
      i = j + 1;
    } else if (c === '$' && !/[\w$]/.test(sql[i - 1] ?? '')) {
      ETIKET.lastIndex = i;
      const ac = ETIKET.exec(sql);
      if (!ac) {
        duz += c;
        i += 1;
        continue;
      }
      const bas = i + ac[0].length;
      const kapanis = sql.indexOf(ac[0], bas);
      parcalar.push({ duz });
      duz = '';
      parcalar.push({ dolar: sql.slice(bas, kapanis < 0 ? n : kapanis) });
      i = kapanis < 0 ? n : kapanis + ac[0].length;
    } else {
      duz += c;
      i += 1;
    }
  }
  parcalar.push({ duz });
  return parcalar;
}

/** `"Public"."Ad"` → `ad`: çağrılar şemadan bağımsız, sade adla eşleşir (ihtiyatlı). */
function sadeAd(ad) {
  return ad.split('.').pop().replaceAll('"', '');
}

let benzersiz = 0;

/**
 * `metin[i]`den başlayan dengeli parantezli argüman listesi (`(a int default coalesce(1, abs(2)))`), boşlukları
 * sadeleşmiş: aynı imzanın tanımları üst üste yazılsın diye. Okunamazsa benzersiz bir anahtar döner; tanım hiçbir
 * öncekini ezmez (ihtiyatlı).
 */
function argumanListesi(metin, i) {
  if (metin[i] === '(') {
    let derinlik = 0;
    for (let j = i; j < metin.length; j += 1) {
      if (metin[j] === '(') derinlik += 1;
      else if (metin[j] === ')' && --derinlik === 0) {
        return metin.slice(i, j + 1).replace(/\s+/g, ' ').replace(/\s*([(),])\s*/g, '$1');
      }
    }
  }
  benzersiz += 1;
  return `?${benzersiz}`;
}

/** `fonksiyonlar`: ad → imza → gövdeler. Aynı dosyadaki tanımlar birikir (ihtiyatlı). */
function ekle(fonksiyonlar, ad, imz, govde) {
  const imzalar = fonksiyonlar.get(ad) ?? new Map();
  imzalar.set(imz, [...(imzalar.get(imz) ?? []), govde]);
  fonksiyonlar.set(ad, imzalar);
}

/**
 * Migration sırasında çalışan metni (`ust`) çıkarır: fonksiyon gövdeleri `fonksiyonlar`a ayrılır, `do` gövdeleri
 * yerinde açılır, diğer dolar tırnaklı metinler olduğu gibi kalır.
 */
function analiz(sql, fonksiyonlar) {
  let ust = '';
  let ifadeBasi = 0; // içinde bulunulan ifadenin `ust`teki başlangıcı (son `;`dan sonrası)
  let dinamik = false;
  for (const p of parcala(sql)) {
    if ('duz' in p) {
      const nokta = p.duz.lastIndexOf(';');
      if (nokta >= 0) ifadeBasi = ust.length + nokta + 1;
      ust += p.duz;
      continue;
    }
    const bas = ust.slice(ifadeBasi);
    const fonksiyon = FONKSIYON_BASI.exec(bas);
    if (fonksiyon) {
      const imza = argumanListesi(bas, fonksiyon.index + fonksiyon[0].length);
      ekle(fonksiyonlar, sadeAd(fonksiyon[1]), imza, p.dolar);
      ust += ' ';
    } else if (DO_BASI.test(bas)) {
      const ic = analiz(p.dolar, fonksiyonlar);
      if (ic.dinamik || DINAMIK.test(ic.ust)) dinamik = true;
      ust += ` ${ic.ust} ; `;
    } else {
      ust += ` ${p.dolar} `;
    }
  }
  return { ust, dinamik };
}

function kacir(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Fonksiyonu adıyla anan ama çalıştırmayan ifadeler: yetki, silme, değiştirme, açıklama.
const ANAN_IFADELER =
  /\b(?:grant|revoke)\b[^;]*|\b(?:drop|alter|comment\s+on)\s+(?:function|procedure|routine)\b[^;]*/g;

/** Metin içindeki ad (ör. `cron.schedule('…', 'select ad()')`) migration sırasında çalışmaz; anan ifadeler atılır. */
function temizle(metin) {
  return metin.replace(/\be'(?:[^'\\]|\\[\s\S]|'')*'|'(?:[^']|'')*'/g, "''").replace(ANAN_IFADELER, ' ');
}

const TETIKLEYICI_TANIMI = new RegExp(
  String.raw`\bcreate\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\s+(${ID})[^;]*?\bon\s+(${NITELIKLI})[^;]*`,
  'g',
);

/**
 * Çalışan metin `ad` fonksiyonunu çalıştırıyor mu? Doğrudan çağrı (`select|perform|call ad(`, varsayılan, politika…)
 * ya da `create trigger … on tablo … execute function ad()` ile aynı metinde o tabloya yazma
 * (`insert|update|delete|merge|copy`).
 */
function cagriliyor(metin, ad, oncekiTetikleyiciler = '') {
  const a = `"?${kacir(ad)}"?`;
  const temiz = temizle(metin);
  // Başlangıç bir tanıtıcının ortasında ya da `şema.`dan sonra olamaz; önündeki `function|procedure` tanım ya da
  // tetikleyici bağlantısıdır (aşağıda ayrıca bakılır).
  const cagri = new RegExp(
    String.raw`(?<!\b(?:function|procedure)\s+(?:if\s+exists\s+)?)(?<![\w$".])(?:${ID}\.)?${a}\s*\(`,
  );
  if (cagri.test(temiz)) return true;
  const tetikleyici = new RegExp(
    String.raw`\bcreate\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\b[^;]*?\bon\s+(${NITELIKLI})[^;]*?\bexecute\s+(?:function|procedure)\s+(?:${ID}\.)?${a}\s*\(`,
    'g',
  );
  // Önceki dosyalardaki tetikleyici tanımları da bağlantı sayılır; yazma yine bu dosyada aranır.
  for (const t of `${oncekiTetikleyiciler} ; ${temiz}`.matchAll(tetikleyici)) {
    const tablo = `(?:${ID}\\.)?"?${kacir(sadeAd(t[1]))}"?`;
    const yazma = new RegExp(
      String.raw`\b(?:insert\s+into|update(?:\s+only)?|delete\s+from|merge\s+into|copy)\s+${tablo}(?![\w"])`,
    );
    if (yazma.test(temiz.replace(t[0], ' '))) return true;
  }
  return false;
}

const BOS_HARITA = { fonksiyonlar: new Map(), tetikleyiciler: new Map() };

/** Haritanın kopyası (iç `Map`ler de); `veriSilebilir` kopyaya yazar, verilen harita değişmez. */
function kopya(harita) {
  return {
    fonksiyonlar: new Map([...harita.fonksiyonlar].map(([ad, imzalar]) => [ad, new Map(imzalar)])),
    tetikleyiciler: new Map(harita.tetikleyiciler),
  };
}

/**
 * #526 KK1: sıralı migration metinlerinden harita: `fonksiyonlar` (ad → imza → gövdeler) ve `tetikleyiciler`
 * (`ad on tablo` → `create trigger` ifadesi). Her dosyanın tanımları öncekileri aynı anahtarda ezer: son tanım
 * geçerlidir.
 */
export function fonksiyonHaritasi(sqller, harita = BOS_HARITA) {
  const sonuc = kopya(harita);
  for (const sql of sqller) {
    const dosya = new Map();
    const { ust } = analiz(sql.toLowerCase(), dosya);
    for (const [ad, imzalar] of dosya) {
      const hedef = sonuc.fonksiyonlar.get(ad) ?? new Map();
      for (const [imz, govdeler] of imzalar) hedef.set(imz, govdeler);
      sonuc.fonksiyonlar.set(ad, hedef);
    }
    for (const t of temizle(ust).matchAll(TETIKLEYICI_TANIMI)) {
      sonuc.tetikleyiciler.set(`${sadeAd(t[1])} on ${sadeAd(t[2])}`, t[0]);
    }
  }
  return sonuc;
}

/**
 * Sıralı `[{ ad, sql }]` listesindeki her dosyanın bekçi sonucu (ad → true: durdur). Her dosya kendisinden önceki
 * dosyaların fonksiyon haritasıyla değerlendirilir.
 */
export function bekciSonuclari(dosyalar) {
  const sonuc = new Map();
  let harita = BOS_HARITA;
  for (const { ad, sql } of dosyalar) {
    sonuc.set(ad, veriSilebilir(sql, harita));
    harita = fonksiyonHaritasi([sql], harita);
  }
  return sonuc;
}

/**
 * Migration metni veri silebilecek bir ifade içeriyorsa true. `onceki`: önceki migration'ların fonksiyon haritası
 * (`fonksiyonHaritasi`); bu dosyadaki tanımlar ona eklenir (çağrı yeniden tanımdan önce olabilir, ikisi de taranır).
 */
export function veriSilebilir(sql, onceki = BOS_HARITA) {
  const { fonksiyonlar, tetikleyiciler } = kopya(onceki);
  const oncekiTetikleyiciler = [...tetikleyiciler.values()].join(' ; ');
  let { ust: calisan, dinamik } = analiz(sql.toLowerCase(), fonksiyonlar);
  const taranan = new Set();
  let degisti = true;
  while (degisti) {
    degisti = false;
    for (const [ad, imzalar] of fonksiyonlar) {
      if (taranan.has(ad) || !cagriliyor(calisan, ad, oncekiTetikleyiciler)) continue;
      taranan.add(ad);
      degisti = true;
      for (const govde of [...imzalar.values()].flat()) {
        const ic = analiz(govde, fonksiyonlar);
        if (ic.dinamik || DINAMIK.test(ic.ust)) dinamik = true;
        calisan += ` ; ${ic.ust} ; `;
      }
    }
  }
  return dinamik || KALIPLAR.some((k) => k.test(calisan));
}
