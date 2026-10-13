// #139 KK6 (kanvas 8 · Plan hazır): Planı kur sonrası Program'ın üstünde alt sayfa — "PLANIN HAZIR" rozeti, "N mekanı yakınlığa
// göre K güne dağıttık", gün özetleri (gün rengi kare, "Cuma · {ilk durak} çevresi", "3 mekan · 09:45 – 13:00 · 26 dk yol"),
// boş günler satırı, güne sığmayan mekan notu, Davet et / 1. güne bak. Değerler Program'ın kendi hesabından (tempolar).
import { StyleSheet, Text, View } from 'react-native';

import { AltPencere } from '@/components/ui/AltPencere';
import { Buton } from '@/components/ui/Buton';
import { Rozet } from '@/components/ui/Rozet';
import { t } from '@/i18n';
import { GUNLER, haftaGunu } from '@/lib/takvim';
import type { Gun } from '@/lib/tipler';
import { gunRengi, gunUstuMetin, olcek, renk, yazi } from '@/theme';

export type PlanGunOzeti = { gun: Gun; durakSayisi: number; bas: string; bit: string; yolDk: number; araba: boolean; ilkAd: string };

type Props = { acik: boolean; ozetler: PlanGunOzeti[]; bosGunler: Gun[]; atanmamis: number; onDavet: () => void; onGune: () => void; onKapat: () => void };

export function gunAdi(g: Gun): string {
  return g.date ? GUNLER[haftaGunu(g.date)] : t('program.planHazir.gunNo', { n: g.index });
}

function listeMetni(adlar: string[]): string {
  if (adlar.length <= 1) return adlar.join('');
  return `${adlar.slice(0, -1).join(', ')} ve ${adlar[adlar.length - 1]}`;
}

export function PlanHazirSayfasi({ acik, ozetler, bosGunler, atanmamis, onDavet, onGune, onKapat }: Props) {
  const mekan = ozetler.reduce((t0, o) => t0 + o.durakSayisi, 0);
  return (
    <AltPencere acik={acik} onKapat={onKapat} kapatEtiketi={t('genel.vazgec')} kaydirilir stil={{ paddingHorizontal: 22, gap: 14 }}>
      <View style={{ gap: 6 }}>
        <Rozet metin={t('program.planHazir.rozet')} tur="basari" />
        <Text accessibilityRole="header" style={s.baslik}>
          {ozetler.length === 1 ? t('program.planHazir.baslikTek', { n: mekan }) : t('program.planHazir.baslik', { n: mekan, gun: ozetler.length })}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {ozetler.map((o) => {
          const rengi = gunRengi(o.gun.index);
          return (
            <View key={o.gun.id} style={[s.satir, { backgroundColor: o.gun.index % 2 === 0 ? '#fff6e6' : renk.yuzey }]}>
              <View style={[s.gunKare, { backgroundColor: rengi }]}>
                <Text style={[s.gunNo, { color: gunUstuMetin(rengi) }]}>{o.gun.index}</Text>
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={s.satirBaslik} numberOfLines={1}>
                  {t('program.planHazir.gunSatiri', { gun: gunAdi(o.gun), ad: t('program.planHazir.cevre', { ad: o.ilkAd }) })}
                </Text>
                <Text style={s.satirAlt} numberOfLines={1}>
                  {t('program.planHazir.gunAlt', { n: o.durakSayisi, bas: o.bas, bit: o.bit, yol: o.araba ? t('program.planHazir.yolAraba', { dk: o.yolDk }) : t('program.planHazir.yolYuruyus', { dk: o.yolDk }) })}
                </Text>
              </View>
            </View>
          );
        })}
        {bosGunler.length > 0 ? (
          <View style={[s.satir, s.bos]}>
            <View style={[s.gunKare, { backgroundColor: renk.yuzey }]}>
              <Text style={[s.gunNo, { color: renk.ikincil }]}>{bosGunler[0].index}</Text>
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={[s.satirBaslik, { color: renk.ikincil }]}>{t('program.planHazir.bosGunler', { gunler: listeMetni(bosGunler.map(gunAdi)) })}</Text>
              <Text style={s.satirAlt}>{t('program.planHazir.bosAlt')}</Text>
            </View>
          </View>
        ) : null}
        {atanmamis > 0 ? <Text style={s.not}>{t('program.planHazir.atanmamis', { n: atanmamis })}</Text> : null}
      </View>
      <View style={s.dugmeler}>
        <Buton baslik={t('program.planHazir.davet')} tur="ikincil" boy="buyuk" onPress={onDavet} stil={{ flex: 1 }} />
        <Buton baslik={t('program.planHazir.gune')} boy="buyuk" onPress={onGune} stil={{ flex: 1.4 }} />
      </View>
    </AltPencere>
  );
}

const s = StyleSheet.create({
  baslik: { fontFamily: yazi.baslik, fontSize: olcek.kart, lineHeight: 27, letterSpacing: -0.6, color: renk.metin },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16 },
  bos: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#b4bbd3' },
  gunKare: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gunNo: { fontFamily: yazi.baslik, fontSize: 16 },
  satirBaslik: { fontFamily: yazi.ekstra, fontSize: 15, color: renk.metin },
  satirAlt: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil },
  not: { fontFamily: yazi.yari, fontSize: 13, color: renk.ikincil },
  dugmeler: { flexDirection: 'row', gap: 10 },
});
