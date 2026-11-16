-- #247: seyahat_net ve seyahat_hesabinda security definer (RLS'yi atlar); üyelik denetimi yoktu. Seyahat kimliğini bilen her oturum
-- başkasının bakiyesini okuyabiliyordu. Artık çağıran o seyahatin üyesi değilse seyahat_net null, seyahat_hesabinda false döner.
-- Bugünkü çağıranlar üye bağlamında çalışır: odesmeler_guard (önce is_member denetler) ve iban_gorebilir (çağıranın şimdiki
-- üyeliği üzerinden). Gövdeler 20261105000000_harcamalar.sql ile aynı; veri değişmez. Yetkiler korunur (create or replace).

create or replace function public.seyahat_net(t uuid, u uuid)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select case when public.is_member(t) then
    coalesce((select sum(h.tl_kurus) from public.harcamalar h where h.trip_id = t and h.odeyen_id = u), 0)
    - coalesce((select sum(p.pay_kurus) from public.harcama_paylari p where p.trip_id = t and p.user_id = u), 0)
    + coalesce((select sum(o.tl_kurus) from public.odesmeler o where o.trip_id = t and o.kimden = u), 0)
    - coalesce((select sum(o.tl_kurus) from public.odesmeler o where o.trip_id = t and o.kime = u), 0)
  end;
$$;

create or replace function public.seyahat_hesabinda(t uuid, u uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_member(t) and (
    exists (select 1 from public.harcamalar h where h.trip_id = t and h.odeyen_id = u)
    or exists (select 1 from public.harcama_paylari p where p.trip_id = t and p.user_id = u)
    or exists (select 1 from public.odesmeler o where o.trip_id = t and u in (o.kimden, o.kime)));
$$;
