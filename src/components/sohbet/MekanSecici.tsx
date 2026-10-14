// #184 KK2: "Mekan" hızlı eki — listedeki mekanlardan ya da aramadan (otomatik tamamlama, seyahat şehrine yanlı) bir mekan seçilir
// ve sohbete kart olarak gider.
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FotoKutusu } from '@/components/gezi/GeziParcalari';
import { Ikon } from '@/components/ui/Ikon';
import { SayfaMetinAlani } from '@/components/ui/sayfaCekme';
import { useOneriler, yeniOturumJetonu } from '@/features/yerler/api';
import { t } from '@/i18n';
import type { Mekan } from '@/lib/tipler';
import { renk, yazi } from '@/theme';

import { KlavyeliPencere } from './KlavyeliPencere';

type Props = {
  acik: boolean;
  onKapat: () => void;
  merkez: { lat: number; lng: number };
  mekanlar: Mekan[];
  ad: (m: Mekan) => string;
  foto: (placeId: string) => string | null;
  onSec: (placeId: string) => void;
  baslik?: string;
};

export function MekanSecici({ acik, onKapat, merkez, mekanlar, ad, foto, onSec, baslik }: Props) {
  return (
    <KlavyeliPencere acik={acik} onKapat={onKapat} kapatEtiketi={t('harcama.form.kapat')}>
      <Icerik merkez={merkez} mekanlar={mekanlar} ad={ad} foto={foto} onSec={onSec} baslik={baslik} acik={acik} />
    </KlavyeliPencere>
  );
}

function Icerik({ merkez, mekanlar, ad, foto, onSec, baslik, acik }: Omit<Props, 'onKapat'>) {
  const [girdi, setGirdi] = useState('');
  const [oturum] = useState(yeniOturumJetonu);
  const oneriler = useOneriler('sohbet-mekan', girdi, oturum, undefined, { lat: merkez.lat, lng: merkez.lng, yaricapM: 20_000 }, acik);
  const sirali = useMemo(() => [...mekanlar].sort((a, b) => ad(a).localeCompare(ad(b), 'tr')), [mekanlar, ad]);
  const aramada = girdi.trim().length >= 2;
  return (
    <>
      <Text accessibilityRole="header" style={s.baslik}>
        {baslik ?? t('sohbet.mekan.baslik')}
      </Text>
      <View style={s.ara}>
        <Ikon ad="ara" boyut={18} renk={renk.ikincil} />
        <SayfaMetinAlani value={girdi} onChangeText={setGirdi} placeholder={t('sohbet.mekan.ara')} placeholderTextColor={renk.soluk} accessibilityLabel={t('sohbet.mekan.ara')} style={s.girdi} autoCorrect={false} />
      </View>
      {aramada ? (
        <View style={{ gap: 4 }}>
          {(oneriler.data ?? []).map((o) => (
            <Pressable key={o.place_id} accessibilityRole="button" onPress={() => onSec(o.place_id)} style={({ pressed }) => [s.satir, pressed && { opacity: 0.7 }]}>
              <View style={s.pin}>
                <Ikon ad="pin" boyut={18} renk={renk.ana} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.ad} numberOfLines={1}>
                  {o.ana}
                </Text>
                <Text style={s.alt} numberOfLines={1}>
                  {o.ikincil}
                </Text>
              </View>
            </Pressable>
          ))}
          {oneriler.isFetching ? <Text style={s.alt}>{t('genel.yukleniyor')}</Text> : null}
        </View>
      ) : (
        <View style={{ gap: 4 }}>
          <Text style={s.bolum}>{t('sohbet.mekan.listen', { n: mekanlar.length })}</Text>
          {sirali.length === 0 ? <Text style={s.alt}>{t('sohbet.mekan.listeBos')}</Text> : null}
          {sirali.map((m) => (
            <Pressable key={m.id} accessibilityRole="button" onPress={() => onSec(m.place_id)} style={({ pressed }) => [s.satir, pressed && { opacity: 0.7 }]}>
              <FotoKutusu uri={foto(m.place_id)} tip={m.primary_type} boyut={36} kose={10} />
              <Text style={[s.ad, { flex: 1 }]} numberOfLines={1}>
                {ad(m)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  baslik: { fontFamily: yazi.baslik, fontSize: 22, letterSpacing: -0.5, color: renk.metin },
  ara: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 14, backgroundColor: renk.yuzey },
  girdi: { flex: 1, fontFamily: yazi.yari, fontSize: 15, color: renk.metin, paddingVertical: 0 },
  bolum: { fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: 0.5, color: renk.ikincil, textTransform: 'uppercase', marginBottom: 4 },
  satir: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  pin: { width: 36, height: 36, borderRadius: 10, backgroundColor: renk.yuzey, alignItems: 'center', justifyContent: 'center' },
  ad: { fontFamily: yazi.ekstra, fontSize: 14, color: renk.metin },
  alt: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
});
