import type { MetadataRoute } from "next";
import { SITE_URL } from "./layout";

/**
 * Só a página inicial entra aqui.
 *
 * `/comecar` existe, mas é `noindex` de propósito enquanto for uma página de
 * espera — anunciá-la no sitemap seria pedir para o Google indexar um "ainda
 * não está aberto". Quando o cadastro real ocupar a rota, tirar o `noindex`
 * do `metadata` dela e acrescentar a entrada aqui.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
