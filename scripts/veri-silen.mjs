// #494 bekçi: bir migration'ın veri silebilecek bir ifade içerip içermediğini söyler (§4, geri dönüşsüz iş).
// Otomatik (push) supabase-migrate bekleyen dosyalardan biri eşleşirse hiçbirini uygulamadan durur.
// Kalıplar scripts/veri-silen.test.mjs ile sabit; yeni bir biçim eklerken oraya örnek ekle.
//
// #501: `create [or replace] function|procedure … as $tag$ … $tag$` gövdeleri taranmaz: içlerindeki `delete` ya da
// `update` migration çalışırken değil, fonksiyon çağrılınca çalışır. `do $tag$ … $tag$` blokları ise migration
// sırasında hemen çalışır; onlar taranır, içinde `execute` (dinamik SQL) varsa ihtiyaten durdurulur.

// `alter table … drop …`: `column` kelimesi Postgres'te isteğe bağlı. Kısıt, varsayılan, not null, identity ve
// üretilen ifade kaldırmak veri silmez; bunlar hariç her `drop` sayılır. `[^;]*?` aynı ifadedeki sonraki `drop`'a da
// bakar (ör. `drop constraint a, drop b`).
const ALTER_TABLE_DROP =
  /\balter\s+(?:foreign\s+)?table\b[^;]*?\bdrop\s+(?!constraint\b|default\b|not\s+null\b|identity\b|expression\b)/;

const KALIPLAR = [
  /\bdrop\s+(?:table|schema|type|domain|foreign\s+table|materialized\s+view|database|extension)\b/,
  ALTER_TABLE_DROP,
  // `alter [column] c [set data] type …`; `column` isteğe bağlı.
  /\balter\s+(?:column\s+)?(?!table\b|type\b)\S+\s+(?:set\s+data\s+)?type\b/,
  /\btruncate\b/,
  /\bdelete\s+from\b/,
  // `update [only] t [[as] takma] set …`: var olan satırı ezer. Tetikleyici (`before update on`), yetki
  // (`grant update`) ve upsert (`do update set`, tablo adı yok) sayılmaz.
  /\bupdate\s+(?:only\s+)?(?!set\b)[\w."]+\s+(?:(?:as\s+)?(?!set\b)\w+\s+)?set\b/,
  // `drop … cascade` bağlı nesneleri de siler. Yabancı anahtardaki `on delete/update cascade` sayılmaz.
  /(?<!\bon\s+(?:delete|update)\s+)\bcascade\b/,
];

/** Yorumları (`-- …`, `/* … *\/`) atıp küçük harfe çevirir; yorumdaki kelimeler bekçiyi tetiklemesin. */
function temizle(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .toLowerCase();
}

const DOLAR_AC = /\$([a-z_][a-z0-9_]*)?\$/g;
const FONKSIYON_BASI = /\bcreate\s+(?:or\s+replace\s+)?(?:function|procedure)\b/;
const DO_BASI = /\bdo\s*$/;

/**
 * Fonksiyon/prosedür gövdelerini boşlukla değiştirir; `do` ve diğer dolar tırnaklı metinler kalır.
 * `dinamik`: bir `do` bloğunda `execute` var mı.
 */
function govdeleriAyikla(metin) {
  let cikti = '';
  let ifadeBasi = 0; // içinde bulunulan ifadenin `cikti`daki başlangıcı (son `;`dan sonrası)
  let dinamik = false;
  let i = 0;
  while (i < metin.length) {
    DOLAR_AC.lastIndex = i;
    const ac = DOLAR_AC.exec(metin);
    const sonraki = ac ? ac.index : metin.length;
    const duz = metin.slice(i, sonraki);
    const nokta = duz.lastIndexOf(';');
    if (nokta >= 0) ifadeBasi = cikti.length + nokta + 1;
    cikti += duz;
    if (!ac) break;
    const etiket = ac[0];
    const govdeBasi = ac.index + etiket.length;
    const kapanis = metin.indexOf(etiket, govdeBasi);
    const govdeSonu = kapanis < 0 ? metin.length : kapanis;
    const govde = metin.slice(govdeBasi, govdeSonu);
    const bas = cikti.slice(ifadeBasi);
    if (FONKSIYON_BASI.test(bas)) {
      cikti += ' ';
    } else {
      if (DO_BASI.test(bas) && /\bexecute\b/.test(govde)) dinamik = true;
      cikti += ` ${govde} `;
    }
    i = kapanis < 0 ? metin.length : govdeSonu + etiket.length;
  }
  return { metin: cikti, dinamik };
}

/** Migration metni veri silebilecek bir ifade içeriyorsa true. */
export function veriSilebilir(sql) {
  const { metin, dinamik } = govdeleriAyikla(temizle(sql));
  return dinamik || KALIPLAR.some((k) => k.test(metin));
}
