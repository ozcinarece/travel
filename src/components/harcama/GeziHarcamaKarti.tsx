// #183 KK8 (kanvas 23) ve KK3 (kanvas 23b): Gezi sayfasındaki "Harcamalar" bölümü. Plan modunda toplam + "Sana borçlular /
// Borcun", "Harcama ekle" · "Bakiyeler"; gezi modunda bugünün toplamı + son harcama ("Son: Tramvay · Mert", "90 ₺ · 3'e
// bölündü") ve "Harcama ekle". Hiç harcama yoksa tek satır açıklama + "Harcama ekle".
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BolumBasligi, geziStil, Kart } from '@/components/gezi/GeziParcalari';
import { Ikon } from '@/components/ui/Ikon';
import { paraMetni, sayiYonelme, type Harcama, type HarcamaOzeti } from '@/features/harcama/hesap';
import { bolusumMetni, harcamaBasligi, type Kisiler } from '@/features/harcama/metin';
import { t } from '@/i18n';
import { renk, yazi } from '@/theme';

type Props = { gezi: boolean; ozet: HarcamaOzeti; adet: number; k: Kisiler; benId: string | null; onTumu: () => void; onEkle: () => void; onBakiyeler: () => void };

export function GeziHarcamaKarti({ gezi, ozet, adet, k, benId, onTumu, onEkle, onBakiyeler }: Props) {
  const ekle = (
    <Pressable accessibilityRole="button" onPress={onEkle} style={({ pressed }) => [geziStil.dugme, { flex: 1, backgroundColor: renk.ana }, pressed && { opacity: 0.85 }]}>
      <Ikon ad="arti" boyut={16} renk={renk.zemin} kalinlik={2.3} />
      <Text style={[geziStil.dugmeMetin, { color: renk.zemin }]}>{t('harcama.ekle')}</Text>
    </Pressable>
  );
  const son = ozet.sonBugun;
  return (
    <View style={{ gap: 10 }}>
      <BolumBasligi baslik={t('harcama.baslik')} baglanti={adet ? t('geziSayfasi.tumu') : undefined} onBaglanti={onTumu} />
      <Kart>
        {adet === 0 ? (
          <Text style={s.bos}>{t('harcama.geziBos')}</Text>
        ) : gezi ? (
          <View style={s.ust}>
            <View>
              <Text style={s.etiket}>{t('harcama.bugun')}</Text>
              <Text style={[s.sayi, { fontSize: 22 }]}>{paraMetni(ozet.bugunToplam)}</Text>
            </View>
            {son ? (
              <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
                <Text style={s.etiket} numberOfLines={1}>
                  {t('harcama.son', { ad: harcamaBasligi(son), kim: son.odeyen_id === benId ? t('harcama.sen') : k.ad(son.odeyen_id) })}
                </Text>
                <Text style={s.sonTutar}>{sonAlt(son, benId, k)}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={s.ust}>
            <View>
              <Text style={s.etiket}>{t('harcama.toplamHarcama')}</Text>
              <Text style={s.sayi}>{paraMetni(ozet.toplam)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.etiket}>{ozet.benimNet > 0 ? t('harcama.sanaBorclular') : ozet.benimNet < 0 ? t('harcama.borcun') : t('harcama.seninDurumun')}</Text>
              <Text style={[s.sayi, ozet.benimNet > 0 && { color: renk.basariMetin }, ozet.benimNet < 0 && { color: renk.uyari }]}>{paraMetni(ozet.benimNet, 'TRY', true)}</Text>
            </View>
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {ekle}
          {!gezi && adet > 0 ? (
            <Pressable accessibilityRole="button" onPress={onBakiyeler} style={({ pressed }) => [geziStil.dugme, { flex: 1, backgroundColor: renk.yuzey }, pressed && { opacity: 0.85 }]}>
              <Text style={[geziStil.dugmeMetin, { color: renk.ana }]}>{t('harcama.bakiyeler')}</Text>
            </Pressable>
          ) : null}
        </View>
      </Kart>
    </View>
  );
}

/** "90 ₺ · 3'e bölündü"; tek kişiyse "180 ₺ · yalnız sen". */
function sonAlt(h: Harcama, benId: string | null, k: Kisiler): string {
  const n = h.harcama_paylari.filter((p) => p.pay_kurus > 0).length;
  return n > 1 ? t('harcama.sonBolundu', { tutar: paraMetni(h.tl_kurus), n: sayiYonelme(n) }) : `${paraMetni(h.tl_kurus)} · ${bolusumMetni(h, benId, k)}`;
}

const s = StyleSheet.create({
  ust: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  etiket: { fontFamily: yazi.ekstra, fontSize: 12, color: renk.ikincil },
  sayi: { fontFamily: yazi.baslik, fontSize: 24, letterSpacing: -0.48, color: renk.metin },
  sonTutar: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  bos: { fontFamily: yazi.normal, fontSize: 13, lineHeight: 18, color: renk.ikincil },
});
