// #181 KK4: kapaktaki ⋯ menü — Yeniden adlandır · Tarihleri değiştir · Seyahati sil (sahip) / Seyahatten ayrıl (üye). Silme ve
// ayrılma #174 ile aynı onay ve dönüş (Seyahatler + bildirim). Tarih kısalırsa sondaki günlerin durakları için onay istenir.
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SecimMenusu } from '@/components/program/SecimMenusu';
import { AltPencere } from '@/components/ui/AltPencere';
import { Buton } from '@/components/ui/Buton';
import { MetinAlani } from '@/components/ui/MetinAlani';
import { TarihSecici } from '@/components/ui/TarihSecici';
import { useSeyahattenAyril } from '@/features/davet/sorgular';
import { silmeMetni } from '@/features/seyahatler/silme';
import { useSeyahatAdiKaydet, useSeyahatSil, useTarihleriDegistir } from '@/features/seyahatler/sorgular';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { onayIste } from '@/lib/onay';
import type { Durak, Gun, Seyahat } from '@/lib/tipler';
import { gunSayisi } from '@/lib/zaman';
import { olcek, renk, yazi } from '@/theme';

type Props = {
  acik: boolean;
  onKapat: () => void;
  seyahat: Seyahat;
  gunler: Gun[];
  duraklar: Durak[];
  sahip: boolean;
  uyeSayisi: number;
  onHata: (metin: string) => void;
};

export function GeziMenusu({ acik, onKapat, seyahat, gunler, duraklar, sahip, uyeSayisi, onHata }: Props) {
  const [adAcik, setAdAcik] = useState(false);
  const [tarihAcik, setTarihAcik] = useState(false);
  const [ad, setAd] = useState('');
  const adKaydet = useSeyahatAdiKaydet(seyahat.id);
  const tarihDegistir = useTarihleriDegistir(seyahat.id);
  const sil = useSeyahatSil();
  const ayril = useSeyahattenAyril();

  const adlandir = () => {
    setAd(seyahatAdi(seyahat));
    setAdAcik(true);
  };
  const adiKaydet = async () => {
    try {
      await adKaydet.mutateAsync(ad);
      setAdAcik(false);
    } catch {
      onHata(t('geziSayfasi.kaydedilemedi'));
    }
  };

  const tarihSec = async (aralik: { gidis: string; donus: string } | null) => {
    setTarihAcik(false);
    if (!aralik) return;
    // Kısalan seyahatte sondaki günlerin durakları kalkar (mekanlar listede kalır): önce sorulur.
    const yeniSayi = gunSayisi(aralik.gidis, aralik.donus);
    const silinecek = gunler.filter((g) => g.index > yeniSayi);
    const durak = duraklar.filter((d) => silinecek.some((g) => g.id === d.day_id)).length;
    if (silinecek.length > 0 && durak > 0) {
      const onay = await onayIste(t('geziSayfasi.tarihKisalir', { n: silinecek.length }), t('geziSayfasi.tarihKisalirMetin', { n: durak }), t('geziSayfasi.tarihKisalirEvet'), t('genel.vazgec'));
      if (!onay) return;
    }
    try {
      await tarihDegistir.mutateAsync(aralik);
    } catch {
      onHata(t('geziSayfasi.kaydedilemedi'));
    }
  };

  const seyahatiSil = async () => {
    const onay = await onayIste(t('seyahatler.silOnay'), silmeMetni(uyeSayisi), t('seyahatler.silEvet'), t('genel.vazgec'));
    if (!onay) return;
    try {
      await sil.mutateAsync(seyahat.id);
      router.replace({ pathname: '/(tabs)/seyahatler', params: { bildirim: 'silindi' } });
    } catch {
      onHata(t('seyahatler.silHata'));
    }
  };
  const seyahattenAyril = async () => {
    const onay = await onayIste(t('davet.grup.ayrilOnay'), t('davet.grup.ayrilMetin'), t('davet.grup.ayrilEvet'), t('genel.vazgec'));
    if (!onay) return;
    try {
      await ayril.mutateAsync(seyahat.id);
      router.replace('/(tabs)/seyahatler');
    } catch {
      onHata(t('davet.grup.ayrilHata'));
    }
  };

  return (
    <>
      <SecimMenusu
        acik={acik}
        baslik={seyahatAdi(seyahat)}
        onKapat={onKapat}
        secenekler={[
          { etiket: t('geziSayfasi.adlandir'), onPress: adlandir },
          { etiket: t('geziSayfasi.tarihleriDegistir'), onPress: () => setTarihAcik(true) },
          sahip ? { etiket: t('seyahatler.sil'), onPress: seyahatiSil, tehlike: true } : { etiket: t('davet.grup.ayril'), onPress: seyahattenAyril, tehlike: true },
        ]}
      />
      <AltPencere acik={adAcik} onKapat={() => setAdAcik(false)} kapatEtiketi={t('genel.vazgec')}>
        <View style={{ gap: 16 }}>
          <Text style={s.baslik}>{t('geziSayfasi.adlandir')}</Text>
          <MetinAlani etiket={t('geziSayfasi.seyahatAdi')} value={ad} onChangeText={setAd} maxLength={80} autoFocus returnKeyType="done" onSubmitEditing={adiKaydet} />
          <Buton baslik={t('geziSayfasi.kaydet')} onPress={adiKaydet} yukleniyor={adKaydet.isPending} boy="buyuk" />
        </View>
      </AltPencere>
      {tarihAcik ? (
        <TarihSecici
          acik
          deger={seyahat.start_date && seyahat.end_date ? { gidis: seyahat.start_date, donus: seyahat.end_date } : null}
          onKapat={() => setTarihAcik(false)}
          onSec={tarihSec}
        />
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  baslik: { fontFamily: yazi.baslik, fontSize: olcek.bolum, color: renk.metin },
});
