import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GecmisSatiri, YaklasanSatiri } from '@/components/seyahatler/SeyahatSatiri';
import { useSeyahattenAyril } from '@/features/davet/sorgular';
import { useSeyahatDurumlari } from '@/features/seyahatler/durum';
import { eylemMenusu, sahipMi, silmeMetni } from '@/features/seyahatler/silme';
import { useSeyahatSil } from '@/features/seyahatler/sorgular';
import { yeniGirisNo } from '@/features/sihirbaz/girisler';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { onayIste } from '@/lib/onay';
import { useOturum } from '@/lib/oturum';
import type { SeyahatOzet } from '@/lib/tipler';
import { renk, yazi } from '@/theme';

/**
 * #275 KK4 (kanvas 29d · Profil › Gezilerim): YAKLAŞAN — bitmemiş bütün seyahatler ve taslaklar (tarih sırası, taslaklar sonda;
 * boşsa bölüm yok), satır dokununca seyahati açar, sağda chevron. GEÇMİŞ — eski Seyahatler ekranının bölümü. Geçmiş satırı: harf karosu, ad,
 * "Ay yıl · N mekan gezildi · N kişi", Tekrar kur (aynı plan, yeni tarih → sihirbaz 2. adım). Uzun basınca #174 menüsü:
 * sahipte "Seyahati sil", üyede "Seyahatten ayrıl"; onay, kısa bildirim.
 */
export function Gezilerim({ yaklasan, gecmis, onBildirim }: { yaklasan: SeyahatOzet[]; gecmis: SeyahatOzet[]; onBildirim: (metin: string) => void }) {
  const durumlar = useSeyahatDurumlari();
  const { session } = useOturum();
  const sil = useSeyahatSil();
  const ayril = useSeyahattenAyril();

  const ac = (id: string) => router.push({ pathname: '/seyahat/[id]', params: { id } });
  const tekrarKur = (id: string) =>
    router.navigate({
      pathname: '/(tabs)/yeni',
      params: { tekrar: id, n: yeniGirisNo() },
    });
  const uzunBas = async (sy: SeyahatOzet) => {
    const sahip = sahipMi(sy.members, session?.user.id);
    const secildi = await eylemMenusu(
      seyahatAdi(sy),
      {
        metin: t(sahip ? 'seyahatler.sil' : 'davet.grup.ayril'),
        yikici: sahip,
      },
      t('genel.vazgec'),
    );
    if (!secildi) return;
    if (sahip) {
      if (!(await onayIste(t('seyahatler.silOnay'), silmeMetni(sy.members.length), t('seyahatler.silEvet'), t('genel.vazgec')))) return;
      try {
        await sil.mutateAsync(sy.id);
        onBildirim(t('seyahatler.silindi'));
      } catch {
        onBildirim(t('seyahatler.silHata'));
      }
      return;
    }
    if (!(await onayIste(t('davet.grup.ayrilOnay'), t('davet.grup.ayrilMetin'), t('davet.grup.ayrilEvet'), t('genel.vazgec')))) return;
    try {
      await ayril.mutateAsync(sy.id);
    } catch {
      onBildirim(t('davet.grup.ayrilHata'));
    }
  };

  if (yaklasan.length === 0 && gecmis.length === 0) return <Text style={s.bos}>{t('profil.gezilerimBos')}</Text>;
  return (
    <View style={s.liste}>
      {yaklasan.length > 0 ? <Text style={s.baslik}>{t('seyahatler.yaklasan')}</Text> : null}
      {yaklasan.map((sy, i) => (
        <YaklasanSatiri key={sy.id} seyahat={sy} sira={i} onPress={() => ac(sy.id)} onUzunBas={() => uzunBas(sy)} />
      ))}
      {gecmis.length > 0 ? <Text style={[s.baslik, yaklasan.length > 0 && { marginTop: 6 }]}>{t('seyahatler.gecmis')}</Text> : null}
      {gecmis.map((sy, i) => (
        <GecmisSatiri key={sy.id} seyahat={sy} sira={i} durum={durumlar.data?.get(sy.id)} onPress={() => ac(sy.id)} onUzunBas={() => uzunBas(sy)} onTekrar={() => tekrarKur(sy.id)} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  liste: { gap: 12 },
  baslik: {
    fontFamily: yazi.ekstra,
    fontSize: 12,
    letterSpacing: 0.48,
    color: renk.ikincil,
  },
  bos: {
    fontFamily: yazi.normal,
    fontSize: 14,
    lineHeight: 20,
    color: renk.ikincil,
  },
});
