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
