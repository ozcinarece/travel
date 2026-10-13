import type { CSSProperties, ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { yazi } from '@/theme';

import { AltCizgiliSekmeler, Rozet, type RozetTuru } from './Ortak';
import { yRenk } from './tema';

// Kanvas (Backoffice ekran 2): alan = 11 px 800 büyük harf etiket + 36 px kutu (10 yarıçap, 1 px #d9d9d4, 13 px 700).

export function Alan({ etiket, genislik, children }: { etiket: string; genislik?: number; children: ReactNode }) {
  return (
    <View style={[s.alan, genislik ? { width: genislik } : s.esnek]}>
      <Text style={s.etiket}>{etiket}</Text>
      {children}
    </View>
  );
}

export function AlanSatiri({ children }: { children: ReactNode }) {
  return <View style={s.satir}>{children}</View>;
}

export function MetinKutusu(props: TextInputProps & { hatali?: boolean }) {
  const { hatali, style, ...diger } = props;
  return <TextInput {...diger} placeholderTextColor={yRenk.ikincil} style={[s.kutu, hatali && s.hatali, style]} />;
}

// Seçim ve tarih alanları yalnız web'de: tarayıcının kendi denetimleri, kanvastaki kutu görünümüyle.
const domKutu: CSSProperties = {
  minHeight: 36,
  padding: '8px 12px',
  borderRadius: 10,
  border: `1px solid ${yRenk.cerceve}`,
  fontFamily: yazi.kalin,
  fontSize: 13,
  lineHeight: 1.45,
  color: yRenk.metin,
  background: yRenk.zemin,
  boxSizing: 'border-box',
  width: '100%',
};

export function SecimKutusu<T extends string>({
  deger,
  secenekler,
  onDegis,
  etiket,
}: {
  deger: T;
  secenekler: { deger: T; etiket: string }[];
  onDegis: (d: T) => void;
  etiket: string;
}) {
  return (
    <select aria-label={etiket} value={deger} onChange={(e) => onDegis(e.target.value as T)} style={domKutu}>
      {secenekler.map((s) => (
        <option key={s.deger} value={s.deger}>
          {s.etiket}
        </option>
      ))}
    </select>
  );
}

export function TarihKutusu({ deger, onDegis, etiket }: { deger: string; onDegis: (d: string) => void; etiket: string }) {
  return <input aria-label={etiket} type="datetime-local" value={deger} onChange={(e) => onDegis(e.target.value)} style={domKutu} />;
}

/** Sekmeler: #155 alt çizgili sekmeler (Ortak); editörler sekmeleri sayfa başlığına verir. */
export const Sekmeler = AltCizgiliSekmeler;

const ROZET = { yayinda: 'basari', taslak: 'notr', planli: 'bekliyor' } as const satisfies Record<string, RozetTuru>;

/** Durum rozeti (#155: Ortak › Rozet; yayında Başarı, taslak nötr, planlı bekliyor). */
export function DurumRozeti({ durum, etiket }: { durum: keyof typeof ROZET; etiket: string }) {
  return <Rozet tur={ROZET[durum]} etiket={etiket} />;
}

/** Kanvas süre hapı: 26 px, #f6f6f4, 11,5 px 800. */
export const hapStili = StyleSheet.create({
  kap: { height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: yRenk.yuzey, justifyContent: 'center' },
  metin: { fontFamily: yazi.ekstra, fontSize: 11.5, color: yRenk.metin },
});

const s = StyleSheet.create({
  alan: { gap: 5 },
  esnek: { flex: 1, minWidth: 0 },
  satir: { flexDirection: 'row', gap: 12 },
  etiket: { fontFamily: yazi.ekstra, fontSize: 11, color: yRenk.ikincil },
  kutu: {
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: yRenk.cerceve,
    fontFamily: yazi.kalin,
    fontSize: 13,
    lineHeight: 19,
    color: yRenk.metin,
  },
  hatali: { borderColor: yRenk.hata },
});
