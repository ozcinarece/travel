-- #345 KK2: içerik hattı Commons kapağını yazar. `yukle` gezi taslağını yazdıktan sonra çağrılır (yalnız KURU=false).
-- Kural: kapak boşsa yazılır; doluysa yalnız satır taslaksa ve mevcut kapak da Commons'tan geldiyse (atfında kaynak_url var)
-- değiştirilir. Böylece Ece'nin yüklediği kapak ("Tripmate" ya da eski atıfsız kapak) ve yayındaki satırın kapağı ezilmez.
-- Yer satırı gezinin şehrinden, place_id ile (aynı place_id başka şehirde de olabilir). Google fotoğrafı buraya hiç gelmez.
-- Yönetim API'sinden (postgres) çağrılır; uygulama rolleri çağıramaz.

create function public.icerik_kapak_yaz(p_veri jsonb) returns jsonb
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_sehir_id uuid;
  v_yazilan integer := 0;
  v_atlanan jsonb := '[]'::jsonb;
  v_n integer;
  y jsonb;
begin
  if jsonb_typeof(p_veri) is distinct from 'object' then
    raise exception 'veri bir nesne olmalı' using errcode = '22023';
  end if;
  select s.id into v_sehir_id from public.sehirler s where s.slug = p_veri ->> 'sehir_slug';
  if v_sehir_id is null then
    raise exception 'şehir bulunamadı: %', p_veri ->> 'sehir_slug' using errcode = '22023';
  end if;

  if p_veri ? 'gezi' then
    update public.geziler g
      set kapak_url = p_veri -> 'gezi' ->> 'kapak_url', kapak_atif = p_veri -> 'gezi' -> 'kapak_atif'
      where g.slug = p_veri ->> 'gezi_slug' and g.sehir_id = v_sehir_id
        and (g.kapak_url is null or (not g.yayin and g.kapak_atif ? 'kaynak_url'));
    get diagnostics v_n = row_count;
    if v_n = 1 then v_yazilan := v_yazilan + 1; else v_atlanan := v_atlanan || to_jsonb('gezi ' || (p_veri ->> 'gezi_slug')); end if;
  end if;

  if p_veri ? 'sehir' then
    update public.sehirler s
      set kapak_url = p_veri -> 'sehir' ->> 'kapak_url', kapak_atif = p_veri -> 'sehir' -> 'kapak_atif'
      where s.id = v_sehir_id
        and (s.kapak_url is null or (not s.yayin and s.kapak_atif ? 'kaynak_url'));
    get diagnostics v_n = row_count;
    if v_n = 1 then v_yazilan := v_yazilan + 1; else v_atlanan := v_atlanan || to_jsonb('sehir ' || (p_veri ->> 'sehir_slug')); end if;
  end if;

  for y in select * from jsonb_array_elements(coalesce(p_veri -> 'yerler', '[]'::jsonb)) loop
    update public.yerler r
      set kapak_url = y ->> 'kapak_url', kapak_atif = y -> 'kapak_atif'
      where r.sehir_id = v_sehir_id and r.place_id = y ->> 'place_id'
        and (r.kapak_url is null or (not r.yayin and r.kapak_atif ? 'kaynak_url'));
    get diagnostics v_n = row_count;
    if v_n >= 1 then v_yazilan := v_yazilan + 1; else v_atlanan := v_atlanan || to_jsonb('yer ' || (y ->> 'place_id')); end if;
  end loop;

  return jsonb_build_object('yazilan', v_yazilan, 'atlanan', v_atlanan);
end;
$$;
revoke execute on function public.icerik_kapak_yaz(jsonb) from public, anon, authenticated, service_role;
