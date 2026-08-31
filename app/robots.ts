import type { MetadataRoute } from "next";
import { SITE_URL } from "./layout";

export default function robots(): MetadataRoute.Robots {
  return {
    /* `/app` e `/api` ficam fora do rastreamento. As rotas privadas já
       redirecionam para `/entrar`, então não havia risco de vazar
       conteúdo — mas deixá-las abertas faz o crawler gastar orçamento
       nelas e indexar URLs que nunca renderizam nada útil. As demais
       páginas fora do sitemap (auth, /comecar, legais) se protegem pelo
       `noindex` da própria metadata. */
    rules: { userAgent: "*", allow: "/", disallow: ["/app", "/api"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
