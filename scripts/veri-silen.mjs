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
// - Önceki bir migration'da tanımlanmış fonksiyonun gövdesi bu dosyada görünmez; o çağrı bu bekçinin dışında.

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
  new RegExp(String.raw`\bupdate\s+(?:only\s+)?(?!set\b)${NITELIKLI}\s+(?:(?:as\s+)?(?!set\b)\w+\s+)?set\b`),
  // `merge into … when matched then delete | update set`.
  /\bmerge\s+into\b/,
  // `drop … cascade` bağlı nesneleri de siler. Yabancı anahtardaki `on delete/update cascade` sayılmaz.
  /(?<!\bon\s+(?:delete|update)\s+)\bcascade\b/,
];

const ETIKET = /\$([a-z_][a-z0-9_]*)?\$/y;
const FONKSIYON_BASI = new RegExp(String.raw`\bcreate\s+(?:or\s+replace\s+)?(?:function|procedure)\s+(${NITELIKLI})`);
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
      let j = i + 1;
      while (j < n && !(sql[j] === c && sql[j + 1] !== c)) j += sql[j] === c ? 2 : 1;
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
      const ad = sadeAd(fonksiyon[1]);
      fonksiyonlar.set(ad, [...(fonksiyonlar.get(ad) ?? []), p.dolar]);
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

/**
 * Çalışan metin `ad` fonksiyonunu çalıştırıyor mu? Doğrudan çağrı (`select|perform|call ad(`, varsayılan, politika…)
 * ya da `create trigger … on tablo … execute function ad()` ile aynı metinde o tabloya yazma
 * (`insert|update|delete|merge|copy`).
 */
function cagriliyor(metin, ad) {
  const a = `"?${kacir(ad)}"?`;
  // Metin içindeki ad (ör. `cron.schedule('…', 'select ad()')`) migration sırasında çalışmaz.
  const temiz = metin.replace(/'(?:[^']|'')*'/g, "''").replace(ANAN_IFADELER, ' ');
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
  for (const t of temiz.matchAll(tetikleyici)) {
    const tablo = `(?:${ID}\\.)?"?${kacir(sadeAd(t[1]))}"?`;
    const yazma = new RegExp(
      String.raw`\b(?:insert\s+into|update(?:\s+only)?|delete\s+from|merge\s+into|copy)\s+${tablo}(?![\w"])`,
    );
    if (yazma.test(temiz.replace(t[0], ' '))) return true;
  }
  return false;
}

/** Migration metni veri silebilecek bir ifade içeriyorsa true. */
export function veriSilebilir(sql) {
  const fonksiyonlar = new Map();
  let { ust: calisan, dinamik } = analiz(sql.toLowerCase(), fonksiyonlar);
  const taranan = new Set();
  let degisti = true;
  while (degisti) {
    degisti = false;
    for (const [ad, govdeler] of fonksiyonlar) {
      if (taranan.has(ad) || !cagriliyor(calisan, ad)) continue;
      taranan.add(ad);
      degisti = true;
      for (const govde of govdeler) {
        const ic = analiz(govde, fonksiyonlar);
        if (ic.dinamik || DINAMIK.test(ic.ust)) dinamik = true;
        calisan += ` ; ${ic.ust} ; `;
      }
    }
  }
  return dinamik || KALIPLAR.some((k) => k.test(calisan));
}
