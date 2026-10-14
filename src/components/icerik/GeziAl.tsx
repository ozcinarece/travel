// #143 KK5 · #144 KK2: "Seyahatime al" akışı — alt sayfa (`SeyahatimeAl`), aktarım ve Program'a geçiş. Gezi sayfası ile
// Kaydettiklerim'deki gezi satırı aynı akışı kullanır; Kaydettiklerim yalnız slug bilir (`GeziAlYukleyici` detayı yükler).
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Buton } from '@/components/ui/Buton';
import type { AktarmaPlani } from '@/features/icerik/aktar';
import { useGeziAktar } from '@/features/icerik/aktarSorgu';
import { useIcerikCanli } from '@/features/icerik/fotolar';
import { useGezi } from '@/features/icerik/sorgular';
import { hedefSeyahatler, varsayilanHedef } from '@/features/icerik/yerEkle';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { t } from '@/i18n';
import type { GeziDetay, GeziDuragi } from '@/lib/tipler';
import { renk, yazi } from '@/theme';

import { SeyahatimeAl } from './SeyahatimeAl';

type Props = {
  gezi: GeziDetay;
  kimlik: (d: GeziDuragi) => string | null;
  /** Açılışta seçili seyahat; verilmezse aynı şehirdeki en yakın tarihli. */
  ilkHedefId?: string | null;
  onKapat: () => void;
  /** Gezi sayfası kendini Program'la değiştirir; sekmeden açılınca Program üstüne itilir. */
  gecis?: 'replace' | 'push';
};

export function GeziAl({ gezi, kimlik, ilkHedefId, onKapat, gecis = 'replace' }: Props) {
  const seyahatler = useSeyahatler();
  const hedefler = useMemo(() => hedefSeyahatler(seyahatler.data), [seyahatler.data]);
  const ilk = ilkHedefId !== undefined ? ilkHedefId : (varsayilanHedef(hedefler, gezi.sehirler?.ad)?.id ?? null);
  const aktar = useGeziAktar();
  const [hata, setHata] = useState<string | null>(null);

  // Aktarım sonrası Program, eklenen ilk gün seçili; saatler Program açılınca yeniden hesaplanır.
  const al = async (seyahatId: string, plan: AktarmaPlani, secenek: 'tum' | 'gunler' | 'mekan') => {
    setHata(null);
    try {
      const sonuc = await aktar.mutateAsync({ seyahatId, geziId: gezi.id, sehirAdi: gezi.sehirler?.ad ?? '', plan, secenek, gunler: gezi.gezi_gunleri });
      // #118 KK4: sessiz başarısızlık yok — hiçbir şey eklenmediyse sayfa açık kalır ve sebep söylenir.
      if (sonuc.eklenenMekan === 0 && sonuc.eklenenDurak === 0) {
        const ilkHata = sonuc.cozumsuzler[0];
        const sebep = ilkHata ? (ilkHata.sebep === 'bulunamadi' ? t('gezi.sebepBulunamadi', { ad: ilkHata.ad }) : t('gezi.sebepSunucu', { ad: ilkHata.ad, sebep: ilkHata.sebep })) : t('gezi.hepsiZatenVar');
        setHata(t('gezi.hicEklenmedi', { sebep }));
        return;
      }
      onKapat();
      const hedef = {
        pathname: '/seyahat/[id]/(sekmeler)/program' as const,
        params: { id: seyahatId, eklenenDurak: String(sonuc.eklenenDurak), eklenenMekan: String(sonuc.eklenenMekan + sonuc.zatenVar), atlanan: String(sonuc.cozumsuz), ...(sonuc.ilkGunIndex !== null ? { gun: String(sonuc.ilkGunIndex) } : {}) },
      };
      if (gecis === 'replace') router.replace(hedef);
      else router.push(hedef);
    } catch (e) {
      setHata(t('gezi.alHata', { sebep: e instanceof Error ? e.message : String(e) }));
    }
  };
  const yeniSeyahat = () => {
    onKapat();
    router.navigate('/(tabs)/yeni');
  };
  return <SeyahatimeAl gezi={gezi} seyahatler={hedefler} ilkHedefId={ilk} kimlik={kimlik} onKapat={onKapat} onYeniSeyahat={yeniSeyahat} onAl={al} hata={hata} />;
}

/** #144 KK2: slug'dan gezi detayı ve durakların Google kimlikleri yüklenir, sonra aynı alt sayfa. */
export function GeziAlYukleyici({ slug, onKapat, ilkHedefId }: { slug: string; onKapat: () => void; /** #181: seyahatin Gezi sayfasından açılınca o seyahat seçili. */ ilkHedefId?: string }) {
  const gezi = useGezi(slug);
  const duraklar = useMemo(() => gezi.data?.gezi_gunleri.flatMap((g) => g.gezi_duraklari) ?? [], [gezi.data]);
  // #172: yalnız Google kimlikleri gerekir — fotoğraf istenmez (places-light çağrılmaz).
  const canli = useIcerikCanli(duraklar, () => gezi.data?.sehirler?.ad ?? '', !!gezi.data, { foto: false });
  const kimlik = useCallback((d: GeziDuragi) => canli.data?.get(d.id)?.place_id ?? d.place_id ?? null, [canli.data]);
  if (gezi.data) return <GeziAl gezi={gezi.data} kimlik={kimlik} ilkHedefId={ilkHedefId} onKapat={onKapat} gecis="push" />;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onKapat}>
      <Pressable style={s.perde} onPress={onKapat} accessibilityLabel={t('genel.vazgec')}>
        <View style={s.kutu}>
          {gezi.isError ? (
            <>
              <Text style={s.hata}>{t('gezi.hata')}</Text>
              <Buton baslik={t('genel.geri')} tur="ikincil" onPress={onKapat} />
            </>
          ) : (
            <ActivityIndicator color={renk.ana} />
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  perde: { flex: 1, backgroundColor: 'rgba(14,20,48,0.5)', alignItems: 'center', justifyContent: 'center', padding: 40 },
  kutu: { minWidth: 120, padding: 24, borderRadius: 22, backgroundColor: renk.zemin, alignItems: 'center', gap: 12 },
  hata: { fontFamily: yazi.yari, fontSize: 13, color: renk.uyari, textAlign: 'center' },
});
