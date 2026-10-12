import type { CSSProperties, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { yazi } from '@/theme';

import { yGolge, yRenk } from './tema';

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

/** Kanvas sekme çubuğu: #f6f6f4 zemin, 4 iç boşluk; seçili sekme beyaz + gölge, 30 px, 12,5 px 800. */
export function Sekmeler<T extends string>({ secili, sekmeler, onSec }: { secili: T; sekmeler: { anahtar: T; etiket: string }[]; onSec: (a: T) => void }) {
  return (
    <View accessibilityRole="tablist" style={s.sekmeler}>
      {sekmeler.map((sk) => {
        const aktif = sk.anahtar === secili;
        return (
          <Pressable
            key={sk.anahtar}
            accessibilityRole="tab"
            accessibilityState={{ selected: aktif }}
            onPress={() => onSec(sk.anahtar)}
            style={StyleSheet.flatten([s.sekme, aktif && s.sekmeAktif])}>
            <Text style={[s.sekmeMetin, !aktif && s.sekmeMetinPasif]}>{sk.etiket}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const ROZET = {
  yayinda: { zemin: '#e6f5ec', metin: '#1f8a4c' },
  taslak: { zemin: '#f1f1ef', metin: '#6e6e6e' },
  planli: { zemin: '#fff1e8', metin: '#ff5a1f' },
} as const;

/** Kanvas durum rozeti: 22 px, tam yuvarlak, 11 px 800. */
export function DurumRozeti({ durum, etiket }: { durum: keyof typeof ROZET; etiket: string }) {
  return (
    <View style={[s.rozet, { backgroundColor: ROZET[durum].zemin }]}>
      <Text style={[s.rozetMetin, { color: ROZET[durum].metin }]}>{etiket}</Text>
    </View>
  );
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
  hatali: { borderColor: '#ff5a1f' },
  sekmeler: { flexDirection: 'row', gap: 2, padding: 4, borderRadius: 12, backgroundColor: yRenk.yuzey, alignSelf: 'flex-start' },
  sekme: { height: 30, paddingHorizontal: 14, borderRadius: 9, justifyContent: 'center' },
  sekmeAktif: { backgroundColor: yRenk.zemin, boxShadow: yGolge },
  sekmeMetin: { fontFamily: yazi.ekstra, fontSize: 12.5, color: yRenk.metin },
  sekmeMetinPasif: { color: yRenk.ikincil },
  rozet: { height: 22, paddingHorizontal: 8, borderRadius: 999, justifyContent: 'center' },
  rozetMetin: { fontFamily: yazi.ekstra, fontSize: 11 },
});
