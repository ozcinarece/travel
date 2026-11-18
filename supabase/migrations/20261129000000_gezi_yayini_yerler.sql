-- #314: gezi yayınlanınca durak yerleri de yayına girer. İçerik hattı durak yerlerini taslak açar; yerler_select yalnız
-- yayındaki satırı gösterir. Gezi yayına girdiği anda (yayin false → true, ya da yayında eklenen gezi) durağı olan taslak
-- yerler aynı deyimde, aynı transaction'da yayına girer (KK1). Durak → yer eşlemesi place_id ile (içerik hattının kuralı).
-- Elle yayından kaldırılmış yer geri alınmaz (KK2). Gezi yayından kalkınca yerlere dokunulmaz (KK4): tetikleyici yalnız
-- yayına girişte çalışır. Planlı gezi (yayin=true, yayin_at ileride) de bu anda yerleri açar; yerler tek başına içeriktir.

-- KK2: yayındaki yer yayından alınınca işaretlenir; yeniden yayına alınınca işaret kalkar. Taslak doğan yer işaretsizdir.
alter table public.yerler add column yayindan_kaldirildi boolean not null default false;

create function public.yer_yayin_isareti() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.yayin then
    new.yayindan_kaldirildi := false;
  elsif old.yayin then
    new.yayindan_kaldirildi := true;
  end if;
  return new;
end;
$$;

create trigger yerler_yayin_isareti before update of yayin on public.yerler
  for each row when (old.yayin is distinct from new.yayin)
  execute function public.yer_yayin_isareti();

-- Geziyle yayına girecek yerler: gezinin duraklarındaki place_id'lerin taslak ve elle kaldırılmamış yer satırları.
-- security invoker: BO'daki sayaç (KK3) admin olarak çağırır; admin olmayan taslak satırı göremediği için 0 alır.
create function public.gezi_yayina_girecek_yerler(p_gezi uuid) returns setof uuid
language sql stable security invoker set search_path = ''
as $$
  select y.id from public.yerler y
  where not y.yayin and not y.yayindan_kaldirildi
    and y.place_id in (
      select d.place_id from public.gezi_duraklari d join public.gezi_gunleri gg on gg.id = d.gezi_gun_id
      where gg.gezi_id = p_gezi and d.place_id is not null);
$$;

create function public.gezi_yayina_girecek_yer_sayisi(p_gezi uuid) returns integer
language sql stable security invoker set search_path = ''
as $$
  select count(*)::integer from public.gezi_yayina_girecek_yerler(p_gezi);
$$;

-- KK1: tetikleyici security definer (geziler'e yazabilen zaten admin ya da service_role; RLS geziler_admin'de).
create function public.gezi_yayini_yerleri_ac() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.yayin and (tg_op = 'INSERT' or not old.yayin) then
    update public.yerler set yayin = true where id in (select public.gezi_yayina_girecek_yerler(new.id));
  end if;
  return null;
end;
$$;
revoke execute on function public.gezi_yayini_yerleri_ac() from public, anon, authenticated;

create trigger geziler_yayini_yerleri_ac after insert or update of yayin on public.geziler
  for each row execute function public.gezi_yayini_yerleri_ac();
