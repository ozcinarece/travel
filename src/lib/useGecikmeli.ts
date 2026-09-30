import { useEffect, useState } from 'react';

/** Değer `ms` boyunca değişmeyince yansır (PRD 0.2 KK1: kullanıcı adı kontrolü 300 ms debounce). */
export function useGecikmeli<T>(deger: T, ms: number): T {
  const [gecikmis, setGecikmis] = useState(deger);
  useEffect(() => {
    const z = setTimeout(() => setGecikmis(deger), ms);
    return () => clearTimeout(z);
  }, [deger, ms]);
  return gecikmis;
}
