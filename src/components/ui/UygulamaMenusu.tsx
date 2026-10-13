import { AltMenu } from './AltMenu';

/**
 * #45 §1: seyahat içinde de uygulama alt menüsü görünür (Seyahatler seçili). #138: 5 öğeli AltMenu ile aynı.
 * #141 bunu seyahat içi menüyle (Keşfet · Program · Listem · Rehber) değiştirir.
 */
export function UygulamaMenusu() {
  return <AltMenu aktif="seyahatler" />;
}
