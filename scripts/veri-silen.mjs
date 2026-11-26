// #494 bekçi: bir migration'ın veri silebilecek bir ifade içerip içermediğini söyler (§4, geri dönüşsüz iş).
// Otomatik (push) supabase-migrate bekleyen dosyalardan biri eşleşirse hiçbirini uygulamadan durur.
// Kalıplar scripts/veri-silen.test.mjs ile sabit; yeni bir biçim eklerken oraya örnek ekle.

// `alter table … drop …`: `column` kelimesi Postgres'te isteğe bağlı. Kısıt, varsayılan, not null, identity ve
// üretilen ifade kaldırmak veri silmez; bunlar hariç her `drop` sayılır. `[^;]*?` aynı ifadedeki sonraki `drop`'a da
// bakar (ör. `drop constraint a, drop b`).
const ALTER_TABLE_DROP =
  /\balter\s+(?:foreign\s+)?table\b[^;]*?\bdrop\s+(?!constraint\b|default\b|not\s+null\b|identity\b|expression\b)/;

const KALIPLAR = [
  /\bdrop\s+(?:table|schema|type|domain|foreign\s+table|materialized\s+view|database)\b/,
  ALTER_TABLE_DROP,
  // `alter [column] c [set data] type …`; `column` isteğe bağlı.
  /\balter\s+(?:column\s+)?(?!table\b|type\b)\S+\s+(?:set\s+data\s+)?type\b/,
  /\btruncate\b/,
  /\bdelete\s+from\b/,
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

/** Migration metni veri silebilecek bir ifade içeriyorsa true. */
export function veriSilebilir(sql) {
  const metin = temizle(sql);
  return KALIPLAR.some((k) => k.test(metin));
}
