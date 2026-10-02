import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EkranBasligi } from '@/components/EkranBasligi';
import { Avatar } from '@/components/ui/Avatar';
import { useMekanlar, useUyeler } from '@/features/mekanlar/sorgular';
import { useDegisiklikler } from '@/features/program/sorgular';
import { useSeyahatId } from '@/features/seyahatler/baglam';
import { useHafifYerler } from '@/features/yerler/api';
import { t } from '@/i18n';
import type { Degisiklik } from '@/lib/tipler';
import { bosluk, renk, yazi } from '@/theme';

// PRD 3.7 KK9: üyeler, davet linki (3.10'da), son 10 değişiklik (kim, ne, ne zaman).
export default function GrupEkrani() {
  const id = useSeyahatId();
  const uyeler = useUyeler(id);
  const degisiklikler = useDegisiklikler(id);
  const mekanlar = useMekanlar(id);
  const yerler = useHafifYerler((mekanlar.data ?? []).map((m) => m.place_id));

  const uyeAdi = (uid: string | null) => uyeler.data?.find((u) => u.user_id === uid)?.display_name ?? '?';
  const mekanAdi = (placesId: string | null | undefined) => {
    const m = mekanlar.data?.find((x) => x.id === placesId);
    return m ? (yerler.data?.[m.place_id]?.ad ?? '…') : '';
  };

  return (
    <SafeAreaView style={s.ekran}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <EkranBasligi baslik={t('seyahat.grup.baslik')} />
        <Text style={s.bolum}>{t('seyahat.grup.uyeler')}</Text>
        {uyeler.data?.map((u) => (
          <View key={u.user_id} style={s.satir}>
            <Avatar ad={u.display_name} boyut={32} />
            <Text style={s.ad}>{u.display_name}</Text>
            <Text style={s.rol}>{u.role === 'owner' ? t('seyahat.grup.sahip') : u.guest ? t('seyahat.grup.misafir') : ''}</Text>
          </View>
        ))}
        <Text style={s.bolum}>{t('seyahat.grup.davet')}</Text>
        <Text style={s.not}>{t('program.grup.davetYakinda')}</Text>
        <Text style={s.bolum}>{t('program.grup.degisiklikler')}</Text>
        {degisiklikler.data?.length === 0 ? <Text style={s.not}>{t('program.grup.degisiklikYok')}</Text> : null}
        {degisiklikler.data?.map((d) => (
          <View key={d.id} style={s.degisiklik}>
            <Text style={s.degisiklikMetin} numberOfLines={2}>
              <Text style={s.kim}>{uyeAdi(d.user_id)}</Text> {degisiklikMetni(d, mekanAdi)}
            </Text>
            <Text style={s.zaman}>{zamanMetni(d.at)}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

/** changes satırını kısa Türkçe cümleye çevirir (tetikleyici satır/alan bazlı yazar). */
function degisiklikMetni(d: Degisiklik, mekanAdi: (placesId: string | null | undefined) => string): string {
  const yeni = d.new as Record<string, unknown> | null;
  const eski = d.old as Record<string, unknown> | null;
  const ekle = !eski && yeni;
  const sil = eski && !yeni;
  switch (d.entity) {
    case 'places':
      if (ekle) return `${mekanAdi(d.entity_id)} ekledi`;
      if (sil) return 'bir mekanı listeden çıkardı';
      if (d.field === 'note') return `${mekanAdi(d.entity_id)} için not yazdı`;
      if (d.field === 'default_minutes') return `${mekanAdi(d.entity_id)} süresini ${d.new} dk yaptı`;
      return `${mekanAdi(d.entity_id)} bilgisini değiştirdi`;
    case 'stops': {
      const ref = String((yeni ?? eski)?.place_ref ?? '');
      if (ekle) return `${mekanAdi(ref)} mekanını bir güne ekledi`;
      if (sil) return 'bir durağı günden çıkardı';
      if (d.field === 'arrived_at') return d.new ? 'bir durağa vardı' : 'varış işaretini geri aldı';
      if (d.field === 'skipped') return d.new ? 'bir durağı atladı' : 'atlamayı geri aldı';
      if (d.field === 'day_id') return 'bir durağı başka güne aldı';
      if (d.field === 'order_key') return 'sırayı değiştirdi';
      if (d.field === 'minutes') return `bir durağın süresini ${d.new} dk yaptı`;
      return 'bir durağı değiştirdi';
    }
    case 'days':
      if (ekle) return 'gün ekledi';
      if (sil) return 'bir günü sildi';
      if (d.field === 'start_time') return `gün başlangıcını ${String(d.new ?? '').slice(0, 5)} yaptı`;
      if (d.field === 'order_manual') return d.new ? 'sırayı elle düzenledi' : 'en kısa rotaya dizdi';
      return 'günü değiştirdi';
    case 'members':
      if (ekle) return 'katıldı';
      if (sil) return 'ayrıldı';
      return 'üyeliği değişti';
    case 'trips':
      if (d.field?.startsWith('hotel')) return 'oteli değiştirdi';
      return 'seyahati değiştirdi';
    default:
      return 'bir değişiklik yaptı';
  }
}

function zamanMetni(iso: string): string {
  const fark = Math.max(0, Date.now() - Date.parse(iso));
  const dk = Math.round(fark / 60_000);
  if (dk < 1) return 'şimdi';
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.round(dk / 60);
  if (sa < 24) return `${sa} sa önce`;
  return `${Math.round(sa / 24)} gün önce`;
}

const s = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: renk.zemin },
  bolum: { fontFamily: yazi.kalin, fontSize: 12, color: renk.ikincil, paddingHorizontal: bosluk.kenar, paddingTop: 20, paddingBottom: 4 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: bosluk.kenar, paddingVertical: 10 },
  ad: { flex: 1, fontFamily: yazi.kalin, fontSize: 15, color: renk.metin },
  rol: { fontFamily: yazi.normal, fontSize: 12, color: renk.ikincil },
  not: { fontFamily: yazi.normal, fontSize: 13, color: renk.ikincil, paddingHorizontal: bosluk.kenar, paddingVertical: 6 },
  degisiklik: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: bosluk.kenar, paddingVertical: 8, borderTopWidth: 1, borderTopColor: renk.ayrac },
  degisiklikMetin: { flex: 1, fontFamily: yazi.normal, fontSize: 13, color: renk.metin },
  kim: { fontFamily: yazi.kalin },
  zaman: { fontFamily: yazi.normal, fontSize: 11, color: renk.soluk },
});
