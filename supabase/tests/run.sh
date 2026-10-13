#!/usr/bin/env bash
# Migration'ları boş bir Postgres'e uygular ve RLS testlerini çalıştırır.
# PGHOST/PGPORT/PGUSER/PGPASSWORD ile bir sunucu verilir (CI: postgres servisi).
set -euo pipefail

cd "$(dirname "$0")/.."
DB=gezi_test

# UTF8 (Supabase ile aynı); yerel küme SQL_ASCII olsa da Türkçe metin testleri doğru çalışsın.
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB template template0 encoding 'UTF8' lc_collate 'C' lc_ctype 'C'"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/stub_supabase.sql
for f in migrations/*.sql; do
  echo "migration: $f"
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"
done
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/rls_test.sql
