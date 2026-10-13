import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MiniCubuk } from '@/components/program/MiniCubuk';
import { BosDurum } from '@/components/seyahatler/BosDurum';
import { GecmisSatiri, KapakKarti, SeyahatSatiri } from '@/components/seyahatler/SeyahatSatiri';
import { hedefSeyahatler } from '@/features/icerik/yerEkle';
import { useProfil } from '@/features/profil/sorgular';
import { useDurakGuncelle } from '@/features/program/sorgular';
import { useAktifProgram } from '@/features/program/useAktifProgram';
import { useSeyahatDurumlari, type DurumCipi } from '@/features/seyahatler/durum';
import { siniflandir } from '@/features/seyahatler/siniflandir';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { yeniGirisNo } from '@/features/sihirbaz/girisler';
import { t } from '@/i18n';
import type { SeyahatOzet } from '@/lib/tipler';
import { kaydirSuresi } from '@/schedule/kaydir';
import { dakikaSaat } from '@/schedule/tempo';
import { bosluk, renk, yazi } from '@/theme';

/**
 * PRD 3.1 → #144 (kanvas 20): sekme yok; YAKLAŞAN (şu an süren + yaklaşan; ilki Gece kapak kartı, tarihsizler TASLAK) ve GEÇMİŞ
 * ("N mekan gezildi" + Tekrar kur) alt alta. Yüzde yok: "3 / 4 gün planlandı", "2 mekan güne atanmadı" → Listem (Atanmamış),
 * "Otel yok" → Program'da "Nerede kalıyorsun?".
 */
export default function SeyahatlerEkrani() {
  const profil = useProfil();
  const seyahatler = useSeyahatler();
  const durumlar = useSeyahatDurumlari();
  // Sekme ekranı açık kalır: başka ekranda plan değişince çipler dönüşte tazelenir.
  useFocusEffect(
    useCallback(() => {
      durumlar.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const { aktif, gecmis } = siniflandir(seyahatler.data ?? []);
  const yaklasan = hedefSeyahatler(seyahatler.data);
  const kapak = yaklasan.find((sy) => !!sy.start_date) ?? null;
  const digerleri = yaklasan.filter((sy) => sy !== kapak);
  const program = useAktifProgram(aktif[0]);

  const ac = (id: string) => router.push({ pathname: '/seyahat/[id]', params: { id } });
  const cip = (sy: SeyahatOzet) => (c: DurumCipi) => {
    if (c.anahtar === 'atanmamis') router.push({ pathname: '/seyahat/[id]/(sekmeler)/listem', params: { id: sy.id, segment: 'atanmamis' } });
    else if (c.anahtar === 'otel') router.push({ pathname: '/seyahat/[id]/(sekmeler)/program', params: { id: sy.id, otel: '1' } });
  };
  // KK1: Tekrar kur — aynı plan, yeni tarih (sihirbaz 2. adım).
  const tekrarKur = (id: string) => router.navigate({ pathname: '/(tabs)/yeni', params: { tekrar: id, n: yeniGirisNo() } });
  const bos = !seyahatler.isPending && !seyahatler.isError && (seyahatler.data?.length ?? 0) === 0;
  const siradaki =
    kapak && kapak.id === aktif[0]?.id
      ? program.siradaki
        ? t('seyahatler.siradaki', { ad: program.adi(program.siradaki.durak.id), saat: dakikaSaat(program.siradaki.varisDk) })
        : program.bitti
          ? t('seyahatler.aktif.bitti')
          : null
      : null;

  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.icerik}
        refreshControl={
          <RefreshControl
            refreshing={seyahatler.isRefetching}
            onRefresh={() => {
              seyahatler.refetch();
              durumlar.refetch();
            }}
          />
        }>
        <Text accessibilityRole="header" style={s.baslik}>
          {t('seyahatler.baslik')}
        </Text>

        {seyahatler.isError ? <Text style={s.hata}>{t('seyahatler.hata')}</Text> : null}
        {bos ? <BosDurum buyuk={profil.data?.next_trip_window === 'bu_ay'} /> : null}

        {yaklasan.length > 0 ? (
          <View style={s.bolum}>
            <Text style={s.bolumBaslik}>{t('seyahatler.yaklasan')}</Text>
            {kapak ? <KapakKarti seyahat={kapak} durum={durumlar.data?.get(kapak.id)} onPress={() => ac(kapak.id)} onCip={cip(kapak)} siradaki={siradaki} /> : null}
            {digerleri.map((sy, i) => (
              <SeyahatSatiri key={sy.id} seyahat={sy} sira={i} durum={durumlar.data?.get(sy.id)} onPress={() => ac(sy.id)} onCip={cip(sy)} />
            ))}
          </View>
        ) : null}

        {gecmis.length > 0 ? (
          <View style={s.bolum}>
            <Text style={[s.bolumBaslik, yaklasan.length > 0 && { paddingTop: 6 }]}>{t('seyahatler.gecmis')}</Text>
            {gecmis.map((sy, i) => (
              <GecmisSatiri key={sy.id} seyahat={sy} sira={i} durum={durumlar.data?.get(sy.id)} onPress={() => ac(sy.id)} onTekrar={() => tekrarKur(sy.id)} />
            ))}
          </View>
        ) : null}
      </ScrollView>
      {aktif[0] ? <AktifCubuk seyahat={aktif[0]} program={program} /> : null}
    </SafeAreaView>
  );
}

// PRD 3.1 KK4 / §5.4: mini-çubuk alt menünün hemen üstünde; eylemler 3.7 ile aynı (seyahat düzeyinde).
function AktifCubuk({ seyahat, program }: { seyahat: SeyahatOzet; program: ReturnType<typeof useAktifProgram> }) {
  const guncelle = useDurakGuncelle(seyahat.id);
  const [korunan, setKorunan] = useState<string | null>(null);
  const cubuk = program.prog?.cubuk ?? null;
  if (!cubuk || !program.prog) return null;
  const kimlik = `${cubuk.tur}:${'durakId' in cubuk ? cubuk.durakId : cubuk.hedefId}`;
  if (korunan === kimlik) return null;
  const satirlar = program.prog.canli.satirlar;
  const kaydir = () => {
    if (cubuk.tur === 'uzun' && program.prog?.simdiDk !== null) {
      const satir = satirlar.find((x) => x.durak.id === cubuk.durakId);
      if (satir) guncelle.mutate({ id: cubuk.durakId, minutes: kaydirSuresi(satir.varisDk, program.prog!.simdiDk!) });
    } else setKorunan(kimlik);
  };
  const atla = () => {
    const hedefId = cubuk.tur === 'uzun' ? satirlar.find((x) => x.durum === 'siradaki')?.durak.id : cubuk.hedefId;
    if (hedefId) guncelle.mutate({ id: hedefId, skipped: true });
  };
  return <MiniCubuk cubuk={cubuk} adi={program.adi} onKaydir={kaydir} onAtla={atla} onKoru={() => setKorunan(kimlik)} />;
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  icerik: { paddingHorizontal: bosluk.kenar, paddingBottom: 24 },
  baslik: { fontFamily: yazi.baslik, fontSize: 30, letterSpacing: -0.9, color: renk.metin, paddingTop: 14 },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari, paddingTop: 12 },
  bolum: { paddingTop: 18, gap: 12 },
  bolumBaslik: { fontFamily: yazi.ekstra, fontSize: 12, letterSpacing: 0.48, color: renk.ikincil },
});
