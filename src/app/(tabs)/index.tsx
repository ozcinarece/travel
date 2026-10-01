import { Link, Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MiniCubuk } from '@/components/program/MiniCubuk';
import { AktifKart } from '@/components/seyahatler/AktifKart';
import { BosDurum } from '@/components/seyahatler/BosDurum';
import { GecmisKart } from '@/components/seyahatler/GecmisKart';
import { SeyahatSatiri } from '@/components/seyahatler/SeyahatSatiri';
import { Avatar } from '@/components/ui/Avatar';
import { useProfil } from '@/features/profil/sorgular';
import { useDurakGuncelle } from '@/features/program/sorgular';
import { useAktifProgram } from '@/features/program/useAktifProgram';
import { siniflandir } from '@/features/seyahatler/siniflandir';
import { useSeyahatler } from '@/features/seyahatler/sorgular';
import { t } from '@/i18n';
import { useOturum } from '@/lib/oturum';
import type { SeyahatOzet } from '@/lib/tipler';
import { kaydirSuresi } from '@/schedule/kaydir';
import { dakikaSaat } from '@/schedule/tempo';
import { bosluk, renk, yazi } from '@/theme';

export default function SeyahatlerEkrani() {
  const { session } = useOturum();
  const profil = useProfil();
  const seyahatler = useSeyahatler();

  const { aktif, yaklasan, gecmis } = siniflandir(seyahatler.data ?? []);
  const program = useAktifProgram(aktif[0]);

  // 0.3 bir kez gösterilir: profil var ama yönlendirme damgası yoksa oraya.
  if (profil.data && !profil.data.onboarding_done_at) return <Redirect href="/ilk-seyahat" />;

  const ac = (id: string) => router.push({ pathname: '/seyahat/[id]', params: { id } });
  const programAc = (id: string) => router.push({ pathname: '/seyahat/[id]/(sekmeler)/program', params: { id } });
  const bos = !seyahatler.isPending && !seyahatler.isError && (seyahatler.data?.length ?? 0) === 0;

  return (
    <SafeAreaView style={s.ekran} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.icerik}
        refreshControl={<RefreshControl refreshing={seyahatler.isRefetching} onRefresh={() => seyahatler.refetch()} />}>
        <View style={s.ust}>
          <Text accessibilityRole="header" style={s.baslik}>
            {t('seyahatler.baslik')}
          </Text>
          <Link href="/(tabs)/profil" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel={t('sekme.profil')} hitSlop={8}>
              <Avatar ad={profil.data?.name ?? '?'} url={profil.data?.photo_url} boyut={30} />
            </Pressable>
          </Link>
        </View>

        {seyahatler.isError ? <Text style={s.hata}>{t('seyahatler.hata')}</Text> : null}
        {bos ? <BosDurum buyuk={profil.data?.next_trip_window === 'bu_ay'} /> : null}

        {aktif.map((sy, i) => (
          <View key={sy.id} style={s.aktif}>
            <AktifKart
              seyahat={sy}
              onAc={() => programAc(sy.id)}
              siradaki={i === 0 && program.siradaki ? t('seyahatler.aktif.siradakiSaat', { ad: program.adi(program.siradaki.durak.id), saat: dakikaSaat(program.siradaki.varisDk) }) : null}
              bitti={i === 0 && program.bitti}
            />
          </View>
        ))}

        {yaklasan.length > 0 ? (
          <View style={s.bolum}>
            <Text style={s.bolumBaslik}>{t('seyahatler.yaklasan')}</Text>
            <View style={s.liste}>
              {yaklasan.map((sy) => (
                <SeyahatSatiri key={sy.id} seyahat={sy} benimId={session?.user.id ?? ''} onPress={() => ac(sy.id)} />
              ))}
            </View>
          </View>
        ) : null}

        {gecmis.length > 0 ? (
          <View style={s.bolum}>
            <View style={s.bolumSatir}>
              <Text style={s.bolumBaslik}>{t('seyahatler.gecmis')}</Text>
              <Text style={s.bolumSag}>{t('seyahatler.gecmisSayi', { n: gecmis.length })}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.gecmisSerit}>
              {gecmis.map((sy, i) => (
                <GecmisKart key={sy.id} seyahat={sy} sira={i} onPress={() => ac(sy.id)} />
              ))}
            </ScrollView>
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
  icerik: { paddingBottom: 24 },
  ust: {
    paddingHorizontal: bosluk.kenar,
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  baslik: { fontFamily: yazi.ekstra, fontSize: 28, letterSpacing: -0.9, color: renk.metin },
  hata: { fontFamily: yazi.yari, fontSize: 12, color: renk.uyari, paddingHorizontal: bosluk.kenar, paddingTop: 12 },
  aktif: { paddingHorizontal: bosluk.kenar, paddingTop: 18 },
  bolum: { paddingTop: 22 },
  bolumSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: bosluk.kenar },
  bolumBaslik: {
    fontFamily: yazi.ekstra,
    fontSize: 17,
    letterSpacing: -0.4,
    color: renk.metin,
    paddingHorizontal: bosluk.kenar,
    paddingBottom: 10,
  },
  bolumSag: { fontFamily: yazi.yari, fontSize: 13, color: renk.ikincil, paddingBottom: 10 },
  liste: { paddingHorizontal: bosluk.kenar },
  gecmisSerit: { paddingHorizontal: bosluk.kenar, gap: 12 },
});
