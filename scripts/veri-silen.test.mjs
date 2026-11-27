// node --test scripts/veri-silen.test.mjs (CI `uygulama` işinde çalışır)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { bekciSonuclari, fonksiyonHaritasi, veriSilebilir } from './veri-silen.mjs';

const durdurur = [
  'drop table trips;',
  'DROP TABLE IF EXISTS public.trips;',
  'alter table t drop column c;',
  'ALTER TABLE t DROP c;',
  'alter table t drop if exists c;',
  'alter table only public.t drop constraint t_pk, drop c;',
  'alter table t alter column c type int;',
  'alter table t alter c type int;',
  'alter table t alter column c set data type bigint using c::bigint;',
  'drop schema eski cascade;',
  'drop type durum;',
  'drop domain eposta;',
  'drop foreign table uzak;',
  'drop materialized view ozet;',
  'drop function f() cascade;',
  'truncate trips;',
  'drop view v cascade;',
  'delete from trips where true;',
  'alter foreign table uzak drop c;',
  // #501 KK3
  'update public.yerler set yayin = true;',
  'UPDATE ONLY t AS x SET c = null WHERE x.id = 1;',
  'update t x set c = 1;',
  'drop extension if exists pg_trgm;',
  // #501 KK1: `do` blokları migration sırasında çalışır, taranır.
  "do $$ begin update changes set old = null where tablo = 'profiles'; end $$;",
  'do $$ begin delete from t; end $$;',
  'do $x$ begin truncate t; end $x$;',
  // `do` içinde dinamik SQL: ne yaptığı okunamaz, ihtiyaten durdurur.
  "do $$ begin execute format('alter table %I drop constraint k', 't'); end $$;",
  // Gövde dışındaki silme, fonksiyonla aynı dosyada olsa da yakalanır.
  'create function f() returns void language plpgsql as $$ begin delete from t; end $$;\ndelete from u;',
  'create or replace function f() returns void language sql as $$ select 1 $$;\ndrop table eski;',
  // #523 inceleme 1: aynı dosyada tanımlanıp çalıştırılan fonksiyonun gövdesi taranır.
  'create function x() returns void language plpgsql as $$ begin delete from trips; end $$;\nselect x();',
  'create function public.x() returns void language plpgsql as $$ begin delete from trips; end $$;\ndo $$ begin perform public.x(); end $$;',
  'create procedure p() language plpgsql as $$ begin truncate t; end $$;\ncall p();',
  'create function "Temizle"() returns void language sql as $$ delete from t $$;\nselect "Temizle"();',
  'create function tf() returns trigger language plpgsql as $$ begin delete from eski; return new; end $$;\ncreate trigger tr after insert on t for each row execute function tf();\ninsert into t values (1);',
  'create function tf() returns trigger language plpgsql as $$ begin update s set n = n + 1; return new; end $$;\ncreate trigger tr after insert or update of c on public."T" for each row execute procedure tf();\nupdate public."T" set c = 1;',
  // Zincir: f, g'yi çağırır; g siler.
  'create function g() returns void language sql as $$ delete from t $$;\ncreate function f() returns void language plpgsql as $$ begin perform g(); end $$;\nselect f();',
  // Çağrılan fonksiyonda dinamik SQL.
  "create function f() returns void language plpgsql as $$ begin execute 'select 1'; end $$;\nselect f();",
  // Aynı biçimde yazılmış eski taşıma (20261008000000_stays.sql).
  'create or replace function public.tasi() returns integer language plpgsql as $$ begin update public.days d set a = 1; return 0; end; $$;\nrevoke execute on function public.tasi() from public;\nselect public.tasi();',
  // #523 inceleme 2: `do language x $$ … $$`.
  "do language plpgsql $$ begin execute 'select 1'; end $$;",
  'do language plpgsql $$ begin delete from t; end $$;',
  // #523 inceleme 3: merge.
  'merge into t using s on t.id = s.id when matched then delete;',
  'MERGE INTO t USING s ON t.id = s.id WHEN MATCHED THEN UPDATE SET c = s.c;',
  // #523 inceleme 4: tırnak içindeki yorum işaretleri yorum başlatmaz.
  "insert into n values ('a--b'); delete from trips;",
  "insert into n values ('/*'); delete from trips; select '*/';",
  'insert into "a--b" values (1); delete from trips;',
  // #523 inceleme 5.
  'update "Trip Table" set c = 1;',
  'update public."Trip Table" t set c = 1;',
  'drop owned by eski_rol;',
  // #526 KK2: `*` (alt tablolar dahil) ve tırnaklı takma ad.
  'update t * set c = 1;',
  'update public.t * as x set c = 1;',
  'update t as "x" set c = 1;',
  'update "t" "x" set c = 1;',
  'UPDATE ONLY "T" AS "Takma Ad" SET c = 1;',
  // #526 KK3: E-string içindeki `\'` metni bitirmez; ardından gelen `--` yorum değildir.
  "select E'\\' -- ' ; delete from t;",
  // E-string içindeki `/*` yorum başlatmaz.
  "select e'a\\'b /* ' ; truncate t; select ' */';",
];

const durdurmaz = [
  'create table t (id uuid primary key, ad text);',
  'alter table t add column c text;',
  'alter table t drop constraint t_c_check;',
  'alter table t alter column c drop default;',
  'alter table t alter column c drop not null;',
  'alter table t alter column id drop identity if exists;',
  'alter table t enable row level security;',
  'drop policy if exists "okur" on t;',
  'drop function if exists f(uuid);',
  'drop index if exists t_ad_idx;',
  'drop trigger if exists t_tr on t;',
  'drop view if exists v;',
  'create table c (trip_id uuid references trips (id) on delete cascade on update cascade);',
  'alter table public.olaylar drop constraint if exists olaylar_tur_check;',
  "alter type durum add value if not exists 'arsiv';",
  "create type durum as enum ('taslak', 'yayinda');",
  '-- eskiden drop table yapardık\ncreate table t (id int);',
  '/* truncate etmeyin */ create index i on t (id);',
  // #501 KK3: tetikleyici, yetki ve upsert `update … set` sayılmaz.
  'create trigger tr before update on public.t for each row execute function f();',
  'create trigger tr after insert or update of c on t for each row execute function f();',
  'grant update (ad) on public.profiles to authenticated;',
  'create policy p on t for update using (true) with check (true);',
  'insert into t (id, c) values (1, 2) on conflict (id) do update set c = excluded.c;',
  // #501 KK1: fonksiyon/prosedür gövdesi çağrılınca çalışır, taranmaz.
  'create function f() returns void language plpgsql as $$ begin delete from t; end $$;',
  "create or replace function public.f(p uuid) returns void\nlanguage plpgsql security definer set search_path = ''\nas $$\nbegin\n  update changes set old = null where id = p;\nend;\n$$;",
  'create procedure p() language plpgsql as $govde$ begin truncate t; drop table x; end $govde$;',
  "create function f() returns void language plpgsql as $$ begin execute 'delete from t'; end $$;",
  // Fonksiyon gövdesinde `$$` dışında bir etiket ve içte `$1`.
  'create function f(int) returns int language sql as $f$ select $1 + 1 $f$;\ncreate table t (id int);',
  "do $$ begin raise notice 'tamam'; end $$;",
  // #523: tanım, yetki, silme ve açıklama çağrı sayılmaz.
  "create function f() returns void language plpgsql as $$ begin delete from t; end $$;\nrevoke execute on function public.f() from public, anon;\ngrant execute on function f() to service_role;\ncomment on function f() is 'çağrılınca siler';",
  'create function f() returns void language sql as $$ delete from t $$;\ndrop function if exists public.f();',
  // Tetikleyici fonksiyonu silmiyorsa tetikleyici sorun değil.
  'create function tf() returns trigger language plpgsql as $$ begin new.c := now(); return new; end $$;\ncreate trigger tr before insert on t for each row execute function tf();',
  // Silen tetikleyici fonksiyonu bağlanıyor ama bu dosya o tabloya yazmıyor: migration sırasında çalışmaz.
  'create function tf() returns trigger language plpgsql as $$ begin delete from eski; return new; end $$;\ncreate trigger tr after insert on public.t for each row execute function public.tf();\ninsert into u values (1);',
  // Çağrılan fonksiyon silmiyor; başka bir (çağrılmayan) fonksiyon siliyor.
  'create function okur() returns int language sql as $$ select 1 $$;\ncreate function siler() returns void language sql as $$ delete from t $$;\nselect okur();',
  // Zamanlanmış iş metnindeki çağrı migration sırasında çalışmaz (20261116000000_places_gunluk_sinir.sql).
  "create function temizle() returns void language sql as $$ delete from s where gun < now() $$;\ndo $$ begin perform cron.schedule('s-temizle', '41 3 * * *', 'select public.temizle()'); end $$;",
  // Yetki listesindeki ikinci, üçüncü ad da çağrı değil.
  'create function a(text) returns void language sql as $$ select 1 $$;\ncreate function b(text, text) returns void language sql as $$ delete from t $$;\ngrant execute on function public.a(text), public.b(text, text) to authenticated;\nrevoke execute on function a(text), b(text, text) from anon;',
  // Gövdedeki yorumda tırnak.
  "create function f() returns void language plpgsql as $$ begin -- otel'i taşı\n perform 1; end $$;\nselect f();",
  "do language plpgsql $$ begin raise notice 'tamam'; end $$;",
  "insert into n values ('a--b'), ('/* yorum değil */');",
  // #526 KK2: `update … set` olmayanlar.
  'create trigger tr after update of c on t * for each row execute function f();',
  // #526 KK3: `E'\\'` (kaçışlı ters bölü) metni bitirir; ardından gelen `--` yorumdur.
  "select E'\\\\' -- '; delete from t;\n;",
  "select pg_size_pretty(1) as e, 'x';",
];

for (const sql of durdurur) {
  test(`durdurur: ${sql.split('\n')[0]}`, () => assert.equal(veriSilebilir(sql), true));
}
for (const sql of durdurmaz) {
  test(`durdurmaz: ${sql.split('\n')[0]}`, () => assert.equal(veriSilebilir(sql), false));
}

// #526 KK1: fonksiyon haritası bütün migration'lardan kurulur.
const SILEN = 'create function public.eski_fn() returns void language sql as $$ delete from t $$;';
const OKUYAN = 'create or replace function public.eski_fn() returns void language sql as $$ select 1 $$;';

test('KK1: önceki migration\'da tanımlanmış silen fonksiyon çağrılırsa durdurur', () => {
  assert.equal(veriSilebilir('select public.eski_fn();'), false);
  assert.equal(veriSilebilir('select public.eski_fn();', fonksiyonHaritasi([SILEN])), true);
  assert.equal(veriSilebilir('do $$ begin perform eski_fn(); end $$;', fonksiyonHaritasi([SILEN])), true);
});

test('KK1: aynı fonksiyonun son tanımı geçerlidir', () => {
  assert.equal(veriSilebilir('select public.eski_fn();', fonksiyonHaritasi([SILEN, OKUYAN])), false);
  assert.equal(veriSilebilir('select public.eski_fn();', fonksiyonHaritasi([OKUYAN, SILEN])), true);
  // Farklı imza (aşırı yükleme) üst üste yazmaz.
  const baska = 'create function public.eski_fn(n int) returns void language sql as $$ select n $$;';
  assert.equal(veriSilebilir('select public.eski_fn();', fonksiyonHaritasi([SILEN, baska])), true);
});

test('KK1: önceki dosyadaki silen fonksiyona bağlanan tetikleyici, yazmada durdurur', () => {
  const tf = 'create function tf() returns trigger language plpgsql as $$ begin delete from eski; return new; end $$;';
  const harita = fonksiyonHaritasi([tf]);
  assert.equal(
    veriSilebilir('create trigger tr after insert on t for each row execute function tf();\ninsert into t values (1);', harita),
    true,
  );
  assert.equal(veriSilebilir('create trigger tr after insert on t for each row execute function tf();', harita), false);
});

test('KK1: bekciSonuclari her dosyayı kendisinden önceki dosyaların haritasıyla değerlendirir', () => {
  const sonuc = bekciSonuclari([
    { ad: '1.sql', sql: SILEN },
    { ad: '2.sql', sql: 'select public.eski_fn();' },
    { ad: '3.sql', sql: OKUYAN },
    { ad: '4.sql', sql: 'select public.eski_fn();' },
  ]);
  assert.deepEqual(Object.fromEntries(sonuc), { '1.sql': false, '2.sql': true, '3.sql': false, '4.sql': false });
});

test('fonksiyonHaritasi verilen haritayı değiştirmez', () => {
  const harita = fonksiyonHaritasi([SILEN]);
  fonksiyonHaritasi([OKUYAN], harita);
  veriSilebilir(OKUYAN, harita);
  assert.equal(veriSilebilir('select eski_fn();', harita), true);
});

test('supabase/migrations içindeki hiçbir dosyada okunamayan kalıp yok (çökme yok)', async () => {
  const klasor = new URL('../supabase/migrations/', import.meta.url);
  for (const ad of (await readdir(klasor)).filter((a) => a.endsWith('.sql'))) {
    assert.equal(typeof veriSilebilir(await readFile(new URL(ad, klasor), 'utf8')), 'boolean', ad);
  }
});

test('supabase/migrations bütünüyle haritalı değerlendirilir (çökme yok)', async () => {
  const klasor = new URL('../supabase/migrations/', import.meta.url);
  const adlar = (await readdir(klasor)).filter((a) => a.endsWith('.sql')).sort();
  const dosyalar = await Promise.all(adlar.map(async (ad) => ({ ad, sql: await readFile(new URL(ad, klasor), 'utf8') })));
  assert.equal(bekciSonuclari(dosyalar).size, adlar.length);
});
