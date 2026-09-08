import type { MetadataRoute } from "next";
import { SITE_URL } from "./layout";
import { indexavelPorAmbiente } from "@/lib/ambiente";

export default function robots(): MetadataRoute.Robots {
  /* Indexação é opt-in explícito por ambiente (ver lib/ambiente.ts), não
     o padrão — e o sinal é uma flag, nunca a URL do deploy. Comparar
     contra a URL seria frágil: staging na Vercel muda de endereço a cada
     deploy de preview, e não há como escrever essa comparação sem
     hardcodear um domínio específico. Com uma flag, o ambiente errado
     nunca é indexado por esquecimento — só produção, que precisa setar a
     variável para "true" de propósito, é rastreável. */
  if (!indexavelPorAmbiente()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

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
