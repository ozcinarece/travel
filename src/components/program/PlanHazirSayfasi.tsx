// #139 KK6 → #396 (UX önerileri kanvası, `Sayfa_v5_PlanHazir`): Planı kur sonrası haritanın üstünde alt çekmece. Küçük gri
// "Plan hazır", başlık "{Şehir}'de N gün, N durak"; günler gri satır (#F6F7FA): renk noktası, "Cuma · {ilk durak} çevresi",
// "N durak · 09:45–13:00" ve ›; satıra dokununca o gün Plan'da açılır. Boş günler tek gri satır yazı ("Pazar boş").
// Tek turuncu eylem: grupta yalnız sen varsan "Arkadaşlarını çağır" (altında yazı olarak "Önce plana bak"), başkası varsa
// "Plana bak". Değerler Program'ın kendi hesabından (tempolar).
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AltPencere } from '@/components/ui/AltPencere';
import { Ikon } from '@/components/ui/Ikon';
import { t } from '@/i18n';
import { bulunmaEkli } from '@/lib/ek';
import { GUNLER, haftaGunu } from '@/lib/takvim';
import type { Gun } from '@/lib/tipler';
import { anaV5, baslikStili, gunRengi, renk, yazi } from '@/theme';

export type PlanGunOzeti = { gun: Gun; durakSayisi: number; bas: string; bit: string; yolDk: number; araba: boolean; ilkAd: string };

type Props = {
  acik: boolean;
  /** Seyahatin şehri (başlıkta "{Şehir}'de"). */
  sehir: string;
  ozetler: PlanGunOzeti[];
  bosGunler: Gun[];
  atanmamis: number;
  /** KK6: grupta senden başka biri var → ana eylem "Plana bak", davet yok. */
  grupVar: boolean;
  onDavet: () => void;
  /** "Önce plana bak" / "Plana bak": ilk gün Plan'da. */
  onPlan: () => void;
  /** KK3: gün satırı → o gün Plan'da. */
  onGun: (g: Gun) => void;
  onKapat: () => void;
};

export function gunAdi(g: Gun): string {
  return g.date ? GUNLER[haftaGunu(g.date)] : t('program.planHazir.gunNo', { n: g.index });
}

function listeMetni(adlar: string[]): string {
  if (adlar.length <= 1) return adlar.join('');
  return `${adlar.slice(0, -1).join(', ')} ve ${adlar[adlar.length - 1]}`;
}

export function PlanHazirSayfasi({ acik, sehir, ozetler, bosGunler, atanmamis, grupVar, onDavet, onPlan, onGun, onKapat }: Props) {
  const durak = ozetler.reduce((t0, o) => t0 + o.durakSayisi, 0);
  const gun = ozetler.length + bosGunler.length;
  const sehirde = bulunmaEkli(sehir);
  return (
    <AltPencere acik={acik} onKapat={onKapat} kapatEtiketi={t('genel.vazgec')} kaydirilir gorunus="v5" stil={s.icerik}>
      <View style={{ gap: 2 }}>
        <Text style={s.ust}>{t('program.planHazir.ust')}</Text>
        <Text accessibilityRole="header" style={s.baslik}>
          {sehirde ? t('program.planHazir.baslik', { sehirde, gun, durak }) : t('program.planHazir.baslikSehirsiz', { gun, durak })}
        </Text>
      </View>
      {ozetler.map((o) => {
        const ust = t('program.planHazir.gunSatiri', { gun: gunAdi(o.gun), ad: t('program.planHazir.cevre', { ad: o.ilkAd }) });
        const alt = t('program.planHazir.gunAlt', { n: o.durakSayisi, bas: o.bas, bit: o.bit });
        return (
          <Pressable key={o.gun.id} accessibilityRole="button" accessibilityLabel={`${ust}, ${alt}`} onPress={() => onGun(o.gun)} style={({ pressed }) => [s.satir, pressed && { opacity: 0.85 }]}>
            <View style={[s.nokta, { backgroundColor: gunRengi(o.gun.index) }]} testID={`plan-hazir-nokta-${o.gun.index}`} />
            <View style={s.satirMetin}>
              <Text style={s.satirBaslik} numberOfLines={1}>
                {ust}
              </Text>
              <Text style={s.satirAlt} numberOfLines={1}>
                {alt}
              </Text>
            </View>
            <Ikon ad="ileri" boyut={18} renk={anaV5.ok} kalinlik={2.4} />
          </Pressable>
        );
      })}
      {bosGunler.length > 0 ? <Text style={s.bos}>{t('program.planHazir.bosGunler', { gunler: listeMetni(bosGunler.map(gunAdi)) })}</Text> : null}
      {atanmamis > 0 ? <Text style={s.bos}>{t('program.planHazir.atanmamis', { n: atanmamis })}</Text> : null}
      <View style={s.eylemler}>
        <Pressable accessibilityRole="button" onPress={grupVar ? onPlan : onDavet} style={({ pressed }) => [s.ana, pressed && { opacity: 0.85 }]}>
          <Text style={s.anaMetin}>{grupVar ? t('program.planHazir.planaBak') : t('program.planHazir.davet')}</Text>
        </Pressable>
        {grupVar ? null : (
          <Pressable accessibilityRole="button" onPress={onPlan} style={({ pressed }) => [s.ikincil, pressed && { opacity: 0.6 }]}>
            <Text style={s.ikincilMetin}>{t('program.planHazir.oncePlan')}</Text>
          </Pressable>
        )}
      </View>
    </AltPencere>
  );
}

const s = StyleSheet.create({
  // Kanvas: çekmece içi 20 px kenar, öğeler arası 12; altta 30.
  icerik: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 30, gap: 12 },
  ust: { fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil },
  baslik: { ...baslikStili(24), letterSpacing: -0.24, lineHeight: 28, color: renk.metin },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: anaV5.satirZemin },
  nokta: { width: 10, height: 10, borderRadius: 5 },
  satirMetin: { flex: 1, gap: 1, minWidth: 0 },
  satirBaslik: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  satirAlt: { fontFamily: yazi.normal, fontSize: 13, color: anaV5.ikincil },
  bos: { fontFamily: yazi.normal, fontSize: 14, color: anaV5.ikincil },
  eylemler: { gap: 10, paddingTop: 4 },
  ana: { height: 52, borderRadius: 26, backgroundColor: renk.vurgu, alignItems: 'center', justifyContent: 'center' },
  anaMetin: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  // "Önce plana bak": yazı (15 px, Gece); dokunma alanı 44.
  ikincil: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 6, justifyContent: 'center' },
  ikincilMetin: { fontFamily: yazi.kalin, fontSize: 15, color: renk.ana },
});
