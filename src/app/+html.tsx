// #550 KK-ek1: web sayfalarının kök HTML'i (yalnız statik derlemede, Node'da çalışır). Expo varsayılanıyla aynı; tek fark
// `lang="tr"`: ekran okuyucu Türkçe metni Türkçe sesle okusun. Web davet girişi (`src/davet-web`) de bunu kullanır.
// Belge: https://docs.expo.dev/router/reference/static-rendering/#root-html
import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { ReactNode } from 'react';

export default function Root({ children }: { children: ReactNode }) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();
  return (
    <html {...htmlAttributes} lang="tr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
