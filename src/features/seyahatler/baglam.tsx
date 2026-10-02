import { useGlobalSearchParams, useLocalSearchParams } from 'expo-router';
import { createContext, useContext, type ReactNode } from 'react';

const Baglam = createContext<string | undefined>(undefined);

/** seyahat/[id]/_layout: dinamik parçayı iç sekmelere ve detay ekranına güvenle taşır (#25). */
export function SeyahatIdSaglayici({ id, children }: { id: string | undefined; children: ReactNode }) {
  return <Baglam.Provider value={id}>{children}</Baglam.Provider>;
}

function tekil(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Seyahat kimliği: önce layout bağlamı, sonra yerel, sonra genel URL parametresi. */
export function useSeyahatId(): string | undefined {
  const baglam = useContext(Baglam);
  const yerel = useLocalSearchParams<{ id?: string }>();
  const genel = useGlobalSearchParams<{ id?: string }>();
  return baglam ?? tekil(yerel.id) ?? tekil(genel.id);
}
