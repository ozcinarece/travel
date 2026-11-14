// #143 KK5 · #144 KK2: "Seyahatime al" akışı — alt sayfa (`SeyahatimeAl`), aktarım ve dönüş. Gezi sayfası ile Kaydettiklerim'deki
// gezi satırı aynı akışı kullanır; Kaydettiklerim yalnız slug bilir (`GeziAlYukleyici` detayı yükler). #193: "Yeni seyahat"
// sihirbaza gitmez — seyahat ve plan tek işlemde açılır (KK2–KK3). Dönüş: plan → o seyahatin Plan sekmesi, eklenen ilk gün
// seçili ve kısa bildirim (KK4 · KK7); yalnız mekanlar → seyahatin Gezi sayfası (KK9). Keşfet'e gidilmez.
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Buton } from '@/components/ui/Buton';
import type { AktarmaPlani } from '@/features/icerik/aktar';
import { useGeziAktar, useGezidenSeyahatAc } from '@/features/icerik/aktarSorgu';
import { useIcerikCanli } from '@/features/icerik/fotolar';
import { useGezi } from '@/features/icerik/sorgular';
import { hedefSeyahatler, varsayilanHedef } from '@/features/icerik/yerEkle';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { t } from '@/i18n';
import type { GeziDetay, GeziDuragi } from '@/lib/tipler';
import { renk, yazi } from '@/theme';

import { SeyahatimeAl, type AlSecenegi, type YeniSeyahatIstegi } from './SeyahatimeAl';

type Props = {
  gezi: GeziDetay;
  kimlik: (d: GeziDuragi) => string | null;
  /** Açılışta seçili seyahat; verilmezse aynı şehirdeki en yakın tarihli. */
  ilkHedefId?: string | null;
  onKapat: () => void;
  /** Gezi sayfası kendini Program'la değiştirir; sekmeden açılınca Program üstüne itilir. */
  gecis?: 'replace' | 'push';
  /** #193 KK11: satır fotoğrafı (sayfanın elindeki; yeni istek yok). */
  foto?: (d: GeziDuragi) => string | null;
  /** Bir seyahatin Gezi sayfasından açıldıysa o seyahat: aynı seyahate "Yalnız mekanlar" sonrası yalnız sayfa kapanır. */
  acikSeyahatId?: string;
};

/** #118 KK4: hiçbir şey eklenmediyse sebep (ilk çözülemeyen mekan ya da "hepsi zaten listende"). */
function eklenmediSebebi(cozumsuzler: { ad: string; sebep: string }[]): string {
  const ilkHata = cozumsuzler[0];
  const sebep = ilkHata ? (ilkHata.sebep === 'bulunamadi' ? t('gezi.sebepBulunamadi', { ad: ilkHata.ad }) : t('gezi.sebepSunucu', { ad: ilkHata.ad, sebep: ilkHata.sebep })) : t('gezi.hepsiZatenVar');
  return t('gezi.hicEklenmedi', { sebep });
}

export function GeziAl({ gezi, kimlik, ilkHedefId, onKapat, gecis = 'replace', foto, acikSeyahatId }: Props) {
  const seyahatler = useSeyahatler();
  const hedefler = useMemo(() => hedefSeyahatler(seyahatler.data), [seyahatler.data]);
  const ilk = ilkHedefId !== undefined ? ilkHedefId : (varsayilanHedef(hedefler, gezi.sehirler?.ad)?.id ?? null);
  const aktar = useGeziAktar();
  const yeni = useGezidenSeyahatAc();
  const [hata, setHata] = useState<string | null>(null);
  // KK3: "plan kuruldu" süresi sayfanın açılışından ölçülür (sihirbazla aynı).
  const [acilis] = useState(() => Date.now());

  const git = (hedef: Parameters<typeof router.push>[0]) => {
    if (gecis === 'replace') router.replace(hedef);
    else router.push(hedef);
  };
  /** KK9: yalnız mekanlar → seyahatin Gezi sayfası ("Sıradaki adım" atanmamış mekanları gösterir). */
  const geziSayfasina = (seyahatId: string) => {
    onKapat();
    if (seyahatId !== acikSeyahatId) git({ pathname: '/seyahat/[id]/(sekmeler)/gezi', params: { id: seyahatId } });
  };

  // Aktarım sonrası Plan, eklenen ilk gün seçili; saatler Plan açılınca yeniden hesaplanır.
  const al = async (seyahatId: string, plan: AktarmaPlani, secenek: AlSecenegi, ekGunler?: string[]) => {
    setHata(null);
    try {
      const sonuc = await aktar.mutateAsync({ seyahatId, geziId: gezi.id, sehirAdi: gezi.sehirler?.ad ?? '', plan, secenek, gunler: gezi.gezi_gunleri, ekGunler });
      // #118 KK4: sessiz başarısızlık yok — hiçbir şey eklenmediyse sayfa açık kalır ve sebep söylenir.
      if (sonuc.eklenenMekan === 0 && sonuc.eklenenDurak === 0) {
        setHata(eklenmediSebebi(sonuc.cozumsuzler));
        return;
      }
      if (secenek === 'mekan') return geziSayfasina(seyahatId);
      onKapat();
      git({
        pathname: '/seyahat/[id]/(sekmeler)/program',
        params: { id: seyahatId, eklenenDurak: String(sonuc.eklenenDurak), eklenenMekan: String(sonuc.eklenenMekan + sonuc.zatenVar), atlanan: String(sonuc.cozumsuz), ...(sonuc.ilkGunIndex !== null ? { gun: String(sonuc.ilkGunIndex) } : {}) },
      });
    } catch (e) {
      setHata(t('gezi.alHata', { sebep: e instanceof Error ? e.message : String(e) }));
    }
  };
  // KK2–KK4 · KK10: yeni seyahat akışın içinde; bitince Plan (1. gün) ya da yalnız mekanlarda Gezi sayfası.
  const yeniSeyahat = async (istek: YeniSeyahatIstegi) => {
    setHata(null);
    try {
      const sonuc = await yeni.mutateAsync({ gezi, ...istek, baslangicAni: acilis });
      if (!sonuc.seyahatId) {
        setHata(eklenmediSebebi(sonuc.cozumsuzler));
        return;
      }
      if (istek.secim.tur === 'mekan') return geziSayfasina(sonuc.seyahatId);
      onKapat();
      git({
        pathname: '/seyahat/[id]/(sekmeler)/program',
        params: { id: sonuc.seyahatId, gun: '1', eklenenGun: String(sonuc.gun), eklenenDurak: String(sonuc.eklenenDurak), atlanan: String(sonuc.cozumsuz) },
      });
    } catch (e) {
      setHata(t('gezi.alHata', { sebep: e instanceof Error ? e.message : String(e) }));
    }
  };
  return <SeyahatimeAl gezi={gezi} seyahatler={hedefler} ilkHedefId={ilk} kimlik={kimlik} foto={foto} onKapat={onKapat} onAl={al} onYeni={yeniSeyahat} hata={hata} />;
}

/** #144 KK2: slug'dan gezi detayı ve durakların Google kimlikleri yüklenir, sonra aynı alt sayfa. */
export function GeziAlYukleyici({ slug, onKapat, ilkHedefId }: { slug: string; onKapat: () => void; /** #181: seyahatin Gezi sayfasından açılınca o seyahat seçili. */ ilkHedefId?: string }) {
  const gezi = useGezi(slug);
  const duraklar = useMemo(() => gezi.data?.gezi_gunleri.flatMap((g) => g.gezi_duraklari) ?? [], [gezi.data]);
  // #172: yalnız Google kimlikleri gerekir — fotoğraf istenmez (places-light çağrılmaz).
  const canli = useIcerikCanli(duraklar, () => gezi.data?.sehirler?.ad ?? '', !!gezi.data, { foto: false });
  const kimlik = useCallback((d: GeziDuragi) => canli.data?.get(d.id)?.place_id ?? d.place_id ?? null, [canli.data]);
  if (gezi.data) return <GeziAl gezi={gezi.data} kimlik={kimlik} ilkHedefId={ilkHedefId} onKapat={onKapat} gecis="push" acikSeyahatId={ilkHedefId} />;
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
