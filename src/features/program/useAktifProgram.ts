// PRD 3.1 KK1/KK4: aktif seyahatin bugünkü programı — "Sıradaki" durak + saat ve mini-çubuk.
import { useMemo } from 'react';

import { useDuraklar, useGunler } from '@/features/gunler/sorgular';
import { useMekanlar } from '@/features/mekanlar/sorgular';
import { useSeyahat } from '@/features/seyahatler/sorgular';
import { useHafifYerler } from '@/features/yerler/api';
import type { SeyahatOzet } from '@/lib/tipler';
import { kacinciGun } from '@/lib/zaman';

import { matrisNoktalari, useYuruyusMatrisi } from './sorgular';
import { gunDuraklari, useGunProgrami, useSimdi } from './useProgram';

export function useAktifProgram(ozet: SeyahatOzet | undefined) {
  const id = ozet?.id;
  const seyahat = useSeyahat(id);
  const gunler = useGunler(id);
  const duraklar = useDuraklar(id);
  const mekanlar = useMekanlar(id);
  const an = useSimdi(!!id);
  const gun = useMemo(() => {
    const n = ozet ? kacinciGun(ozet, an) : null;
    return gunler.data?.find((g) => g.index === n);
  }, [ozet, gunler.data, an]);
  const mekanIle = useMemo(() => new Map((mekanlar.data ?? []).map((m) => [m.id, m])), [mekanlar.data]);
  const gunMekanlari = useMemo(
    () => (gun ? gunDuraklari(gun, duraklar.data ?? []).map((d) => mekanIle.get(d.place_ref)).filter((m): m is NonNullable<typeof m> => !!m) : []),
    [gun, duraklar.data, mekanIle],
  );
  const otel = seyahat.data && seyahat.data.hotel_lat !== null && seyahat.data.hotel_lng !== null ? { lat: seyahat.data.hotel_lat, lng: seyahat.data.hotel_lng } : null;
  const matris = useYuruyusMatrisi(id, matrisNoktalari(otel, gunMekanlari));
  const yerler = useHafifYerler(gunMekanlari.map((m) => m.place_id));
  const prog = useGunProgrami({ seyahat: seyahat.data, gun, duraklar: duraklar.data ?? [], mekanlar: mekanlar.data ?? [], yuruyus: matris.yuruyus, an });

  const adi = (durakId: string) => {
    const d = duraklar.data?.find((x) => x.id === durakId);
    const m = d ? mekanIle.get(d.place_ref) : undefined;
    return (m && yerler.data?.[m.place_id]?.ad) || '…';
  };
  const siradaki = prog?.canli.satirlar.find((s) => s.durum === 'siradaki' || s.durum === 'buradasin') ?? null;
  const bitti = !!prog && prog.canli.satirlar.length > 0 && !siradaki && prog.canli.satirlar.every((s) => s.durum === 'gecildi' || s.durum === 'atlandi');
  return { prog, gun, siradaki, bitti, adi, duraklar: duraklar.data ?? [], yukleniyor: gunler.isPending || duraklar.isPending };
}
