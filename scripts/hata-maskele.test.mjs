// node --test scripts/hata-maskele.test.mjs (CI `uygulama` işinde çalışır)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hataMaskele } from './hata-maskele.mjs';

test('JSON gövdede DETAIL ve Key değerleri maskelenir; kod ve ilk satır kalır', () => {
  const govde = JSON.stringify({
    message:
      'Failed to run sql query: ERROR:  23505: duplicate key value violates unique constraint "profiles_email_key"\nDETAIL:  Key (email)=(ece@ornek.com) already exists.\n',
  });
  const sonuc = hataMaskele(govde);
  assert.ok(!sonuc.includes('ece@ornek.com'), sonuc);
  assert.ok(sonuc.includes('23505: duplicate key value violates unique constraint \\"profiles_email_key\\"'), sonuc);
  assert.ok(sonuc.includes('DETAIL: ***'), sonuc);
});

test('düz metinde Key (…)=(…) DETAIL dışında da maskelenir', () => {
  const sonuc = hataMaskele(
    'ERROR: 23503: insert or update on table "stops" violates foreign key constraint "stops_trip_id_fkey"\nKey (trip_id)=(0b9c…-gizli) is not present in table "trips".',
  );
  assert.equal(
    sonuc,
    'ERROR: 23503: insert or update on table "stops" violates foreign key constraint "stops_trip_id_fkey"\nKey (trip_id)=(***)',
  );
});

test('DETAIL: Failing row contains (…) ve CONTEXT maskelenir', () => {
  const sonuc = hataMaskele(
    'ERROR: 23502: null value in column "ad" violates not-null constraint\nDETAIL: Failing row contains (1, null, gizli@ornek.com).\nCONTEXT: SQL statement',
  );
  assert.equal(
    sonuc,
    'ERROR: 23502: null value in column "ad" violates not-null constraint\nDETAIL: ***\nCONTEXT: ***',
  );
});

test('değer içindeki kaçışlı tırnak maskeyi erken bitirmez', () => {
  const govde = JSON.stringify({ message: 'ERROR: 23505: x\nDETAIL: Key (ad)=(a"b gizli) already exists.' });
  const sonuc = hataMaskele(govde);
  assert.ok(!sonuc.includes('gizli'), sonuc);
  assert.ok(sonuc.endsWith('DETAIL: ***"}'), sonuc);
});

test('değer yoksa metin değişmez', () => {
  const metin = '{"message":"Failed to run sql query: ERROR:  42601: syntax error at or near \\"selec\\""}';
  assert.equal(hataMaskele(metin), metin);
});

test('çok satırlı DETAIL değeri bir sonraki başlığa kadar maskelenir', () => {
  const sonuc = hataMaskele(
    'ERROR: P0001: x\nDETAIL: birinci gizli\nikinci gizli satır\nHINT: ipucu gizli\nQUERY: select 1',
  );
  assert.equal(sonuc, 'ERROR: P0001: x\nDETAIL: ***\nHINT: ***\nQUERY: select 1');
});

test('HINT, CONTEXT ve WHERE değerleri maskelenir; JSON gövdede de', () => {
  const govde = JSON.stringify({
    message:
      "ERROR:  P0001: kural\nHINT:  gizli@ornek.com dene\nCONTEXT:  PL/pgSQL function f(text) line 3 at RAISE 'gizli'\nWHERE: gizli değer",
  });
  const sonuc = JSON.parse(hataMaskele(govde)).message;
  assert.equal(sonuc, 'ERROR:  P0001: kural\nHINT: ***\nCONTEXT: ***\nWHERE: ***');
});

test('ilk satır tasarım gereği kalır', () => {
  assert.equal(
    hataMaskele('ERROR: 23505: duplicate key value violates unique constraint "k"'),
    'ERROR: 23505: duplicate key value violates unique constraint "k"',
  );
});
