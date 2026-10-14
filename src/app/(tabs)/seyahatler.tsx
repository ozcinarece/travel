import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MiniCubuk } from '@/components/program/MiniCubuk';
import { BosDurum } from '@/components/seyahatler/BosDurum';
import { GecmisSatiri, KapakKarti, SeyahatSatiri } from '@/components/seyahatler/SeyahatSatiri';
import { useSeyahattenAyril } from '@/features/davet/sorgular';
import { hedefSeyahatler } from '@/features/icerik/yerEkle';
import { useProfil } from '@/features/profil/sorgular';
import { useDurakGuncelle } from '@/features/program/sorgular';
import { useAktifProgram } from '@/features/program/useAktifProgram';
import { useSeyahatDurumlari, type DurumCipi } from '@/features/seyahatler/durum';
import { eylemMenusu, sahipMi, silmeMetni } from '@/features/seyahatler/silme';
import { siniflandir } from '@/features/seyahatler/siniflandir';
import { useSeyahatler, useSeyahatSil } from '@/features/seyahatler/sorgular';
import { yeniGirisNo } from '@/features/sihirbaz/girisler';
import { seyahatAdi } from '@/features/sihirbaz/sihirbaz';
import { t } from '@/i18n';
import { onayIste } from '@/lib/onay';
import { useOturum } from '@/lib/oturum';
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
    if (c.anahtar === 'atanmamis') router.push({ pathname: '/seyahat/[id]/listem', params: { id: sy.id, segment: 'atanmamis' } });
    else if (c.anahtar === 'otel') router.push({ pathname: '/seyahat/[id]/(sekmeler)/program', params: { id: sy.id, otel: '1' } });
  };
  // #174 KK1, KK3–KK4, KK9: uzun basınca platform menüsü — sahipte "Seyahati sil", üyede "Seyahatten ayrıl"; onay, kısa bildirim.
  const { session } = useOturum();
  const sil = useSeyahatSil();
  const ayril = useSeyahattenAyril();
  const [bildirim, setBildirim] = useState<string | null>(null);
  const bildirimZamani = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goster = useCallback((metin: string) => {
    setBildirim(metin);
    if (bildirimZamani.current) clearTimeout(bildirimZamani.current);
    bildirimZamani.current = setTimeout(() => setBildirim(null), 3000);
  }, []);
  // Seyahat içinden silince (sahip) ya da açık seyahat başkası tarafından silinince (KK5) liste bildirimle açılır; bildirim
  // parametresi 3 sn sonra temizlenir.
  const parametre = useLocalSearchParams<{ bildirim?: string }>();
  const gelenBildirim = parametre.bildirim === 'silindi' ? t('seyahatler.silindi') : parametre.bildirim === 'silinmis' ? t('seyahatler.silinmis') : null;
  useEffect(() => {
    if (!gelenBildirim) return;
    const z = setTimeout(() => router.setParams({ bildirim: undefined }), 3000);
    return () => clearTimeout(z);
  }, [gelenBildirim]);
  const gorunenBildirim = bildirim ?? gelenBildirim;
  const uzunBas = async (sy: SeyahatOzet) => {
    const sahip = sahipMi(sy.members, session?.user.id);
    const secildi = await eylemMenusu(seyahatAdi(sy), { metin: t(sahip ? 'seyahatler.sil' : 'davet.grup.ayril'), yikici: sahip }, t('genel.vazgec'));
    if (!secildi) return;
    if (sahip) {
      if (!(await onayIste(t('seyahatler.silOnay'), silmeMetni(sy.members.length), t('seyahatler.silEvet'), t('genel.vazgec')))) return;
      try {
        await sil.mutateAsync(sy.id);
        goster(t('seyahatler.silindi'));
      } catch {
        goster(t('seyahatler.silHata'));
      }
      return;
    }
    if (!(await onayIste(t('davet.grup.ayrilOnay'), t('davet.grup.ayrilMetin'), t('davet.grup.ayrilEvet'), t('genel.vazgec')))) return;
    try {
      await ayril.mutateAsync(sy.id);
    } catch {
      goster(t('davet.grup.ayrilHata'));
    }
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
            {kapak ? (
              <KapakKarti seyahat={kapak} durum={durumlar.data?.get(kapak.id)} onPress={() => ac(kapak.id)} onUzunBas={() => uzunBas(kapak)} onCip={cip(kapak)} siradaki={siradaki} />
            ) : null}
            {digerleri.map((sy, i) => (
              <SeyahatSatiri key={sy.id} seyahat={sy} sira={i} durum={durumlar.data?.get(sy.id)} onPress={() => ac(sy.id)} onUzunBas={() => uzunBas(sy)} onCip={cip(sy)} />
            ))}
          </View>
        ) : null}

        {gecmis.length > 0 ? (
          <View style={s.bolum}>
            <Text style={[s.bolumBaslik, yaklasan.length > 0 && { paddingTop: 6 }]}>{t('seyahatler.gecmis')}</Text>
            {gecmis.map((sy, i) => (
              <GecmisSatiri key={sy.id} seyahat={sy} sira={i} durum={durumlar.data?.get(sy.id)} onPress={() => ac(sy.id)} onUzunBas={() => uzunBas(sy)} onTekrar={() => tekrarKur(sy.id)} />
            ))}
          </View>
        ) : null}
      </ScrollView>
      {aktif[0] ? <AktifCubuk seyahat={aktif[0]} program={program} /> : null}
      {gorunenBildirim ? (
        <View style={s.bildirim} pointerEvents="none" accessibilityLiveRegion="polite">
          <Text style={s.bildirimMetin}>{gorunenBildirim}</Text>
        </View>
      ) : null}
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
  bildirim: { position: 'absolute', left: bosluk.kenar, right: bosluk.kenar, bottom: 24, alignItems: 'center' },
  bildirimMetin: { overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: renk.metin, color: renk.zemin, fontFamily: yazi.ekstra, fontSize: 13 },
});
