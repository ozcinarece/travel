import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import type { HafifYer } from '@/features/yerler/api';
import { t } from '@/i18n';
import { kategoriEtiketi, sureMetni } from '@/lib/kategori';
import { puanMetni } from '@/lib/puan';
import type { Gun, Mekan } from '@/lib/tipler';
import { gunRengi, renk, yazi } from '@/theme';

type Props = {
  mekan: Mekan;
  yer: HafifYer | undefined;
  ekleyenAd: string;
  dakika: number;
  gunler: Gun[];
  /** Mekanın atanmış olduğu gün (varsa). */
  mevcutGunId: string | null;
  /** Gün başına yakınlık ipucu: "12 dk" (o günün son durağına yürüyüş), "boş" ya da null. */
  yakinlik: (gun: Gun) => string | null;
  mesgul: boolean;
  onGunSec: (gun: Gun) => void;
  onSure: (fark: number) => void;
  onDetay: () => void;
  onCikar: () => void;
  onKapat: () => void;
};

/**
 * #42 KK9: pine dokununca alt panel bu içeriğe döner — ad, kategori · süre · açık/kapalı; ★ puan · yorum · kim ekledi;
 * küçük fotoğraf; "Hangi güne?" gün kartları (yakınlık ipucuyla); süre −/+; Detay · Listeden çıkar.
 */
export function PinPaneli({ mekan, yer, ekleyenAd, dakika, gunler, mevcutGunId, yakinlik, mesgul, onGunSec, onSure, onDetay, onCikar, onKapat }: Props) {
  const puan = puanMetni(yer?.puan);
  return (
    <View style={s.kap}>
      <View style={s.ust}>
        {yer?.foto_uri ? <Image source={{ uri: yer.foto_uri }} style={s.foto} contentFit="cover" /> : null}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={s.ad} numberOfLines={2}>
            {yer?.ad ?? '…'}
          </Text>
          <Text style={s.alt} numberOfLines={1}>
            {kategoriEtiketi(mekan.primary_type)} · {sureMetni(dakika)}
            {yer?.acik === true ? ` · ${t('mekan.acik')}` : yer?.acik === false ? ` · ${t('mekan.kapali')}` : ''}
          </Text>
          <View style={s.satir}>
            <Text style={s.alt} numberOfLines={1}>
              {puan ? `★ ${puan}` : ''}
              {yer?.puan_sayisi ? ` · ${t('mekan.yorum', { n: yer.puan_sayisi.toLocaleString('tr-TR') })}` : ''}
            </Text>
            {ekleyenAd ? (
              <View style={s.ekleyen}>
                <Avatar ad={ekleyenAd} boyut={16} arkaPlan={renk.vurgu} />
                <Text style={s.alt}>{ekleyenAd}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('genel.vazgec')} onPress={onKapat} hitSlop={8} style={s.kapat}>
          <Text style={s.kapatMetin}>×</Text>
        </Pressable>
      </View>

      <Text style={s.baslik}>{t('program.pin.hangiGune')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.gunler}>
        {gunler.map((g) => {
          const secili = g.id === mevcutGunId;
          const rengi = gunRengi(g.index);
          const ipucu = yakinlik(g);
          return (
            <Pressable
              key={g.id}
              accessibilityRole="button"
              accessibilityState={{ selected: secili, disabled: mesgul }}
              disabled={mesgul}
              onPress={() => onGunSec(g)}
              style={[s.gun, { borderColor: rengi }, secili && { backgroundColor: rengi }]}>
              <Text style={[s.gunMetin, secili && { color: renk.zemin }]}>{t('program.gunSec', { n: g.index })}</Text>
              {ipucu ? <Text style={[s.gunIpucu, secili && { color: 'rgba(255,255,255,0.8)' }]}>{ipucu}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={s.altSatir}>
        <View style={s.sureKontrol}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('program.azalt')} onPress={() => onSure(-15)} style={s.sureDugme}>
            <Text style={s.sureIsaret}>−</Text>
          </Pressable>
          <Text style={s.sureMetin}>{sureMetni(dakika)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('program.artir')} onPress={() => onSure(15)} style={s.sureDugme}>
            <Text style={s.sureIsaret}>+</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={onDetay} style={s.dugme}>
          <Text style={s.dugmeMetin}>{t('program.pin.detay')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={mesgul} onPress={onCikar} style={s.dugme}>
          <Text style={[s.dugmeMetin, { color: renk.uyari }]}>{t('program.pin.listedenCikar')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kap: { gap: 10 },
  ust: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  foto: { width: 64, height: 64, borderRadius: 12, backgroundColor: renk.yuzey },
  ad: { fontFamily: yazi.ekstra, fontSize: 17, letterSpacing: -0.3, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  ekleyen: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kapat: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  kapatMetin: { fontFamily: yazi.kalin, fontSize: 20, color: renk.ikincil },
  baslik: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil },
  gunler: { gap: 8 },
  gun: { minWidth: 76, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1.5, backgroundColor: renk.zemin, alignItems: 'center', gap: 2 },
  gunMetin: { fontFamily: yazi.kalin, fontSize: 13, color: renk.metin },
  gunIpucu: { fontFamily: yazi.normal, fontSize: 11, color: renk.ikincil },
  altSatir: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  sureKontrol: { flexDirection: 'row', alignItems: 'center', height: 36, borderRadius: 999, backgroundColor: renk.yuzey, paddingHorizontal: 2 },
  sureDugme: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sureIsaret: { fontFamily: yazi.kalin, fontSize: 16, color: renk.metin },
  sureMetin: { width: 48, textAlign: 'center', fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
  dugme: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: renk.yuzey, justifyContent: 'center' },
  dugmeMetin: { fontFamily: yazi.kalin, fontSize: 12, color: renk.metin },
});
