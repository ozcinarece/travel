// node --test scripts/veri-silen.test.mjs (CI `uygulama` işinde çalışır)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { veriSilebilir } from './veri-silen.mjs';

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
  'do $$ begin update changes set old = null where tablo = \'profiles\'; end $$;',
  'do $$ begin delete from t; end $$;',
  'do $x$ begin truncate t; end $x$;',
  // `do` içinde dinamik SQL: ne yaptığı okunamaz, ihtiyaten durdurur.
  "do $$ begin execute format('alter table %I drop constraint k', 't'); end $$;",
  // Gövde dışındaki silme, fonksiyonla aynı dosyada olsa da yakalanır.
  'create function f() returns void language plpgsql as $$ begin delete from t; end $$;\ndelete from u;',
  'create or replace function f() returns void language sql as $$ select 1 $$;\ndrop table eski;',
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
  'alter type durum add value if not exists \'arsiv\';',
  'create type durum as enum (\'taslak\', \'yayinda\');',
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
  'create or replace function public.f(p uuid) returns void\nlanguage plpgsql security definer set search_path = \'\'\nas $$\nbegin\n  update changes set old = null where id = p;\nend;\n$$;',
  'create procedure p() language plpgsql as $govde$ begin truncate t; drop table x; end $govde$;',
  'create function f() returns void language plpgsql as $$ begin execute \'delete from t\'; end $$;',
  // Fonksiyon gövdesinde `$$` dışında bir etiket ve içte `$1`.
  'create function f(int) returns int language sql as $f$ select $1 + 1 $f$;\ncreate table t (id int);',
  'do $$ begin raise notice \'tamam\'; end $$;',
];

for (const sql of durdurur) {
  test(`durdurur: ${sql.split('\n')[0]}`, () => assert.equal(veriSilebilir(sql), true));
}
for (const sql of durdurmaz) {
  test(`durdurmaz: ${sql.split('\n')[0]}`, () => assert.equal(veriSilebilir(sql), false));
}

test('supabase/migrations içindeki hiçbir dosyada okunamayan kalıp yok (çökme yok)', async () => {
  const klasor = new URL('../supabase/migrations/', import.meta.url);
  for (const ad of (await readdir(klasor)).filter((a) => a.endsWith('.sql'))) {
    assert.equal(typeof veriSilebilir(await readFile(new URL(ad, klasor), 'utf8')), 'boolean', ad);
  }
});
