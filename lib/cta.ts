/**
 * Destino único dos CTAs das seções comerciais: o CADASTRO de verdade.
 *
 * História (para não repetir o erro): primeiro era `#comecar`, uma âncora
 * dentro da maquete da cena que rolava o visitante para trás. Depois virou
 * `/comecar`, uma página de espera que só capturava lead ("em breve entramos
 * em contato"). Com o cadastro self-service no ar (`/criar-conta`), manter os
 * CTAs em `/comecar` fazia quem queria criar conta cair numa lista de espera
 * e nunca conseguir entrar — achado em produção em 05/10/2026.
 *
 * `/comecar` agora redireciona para cá (`next.config.ts`), então links
 * antigos, favoritos e mensagens já enviadas também funcionam. Os CTAs do
 * hero e do capítulo 5 (`Stage.tsx`, `StaticStory.tsx`) são literais e
 * apontam para o mesmo destino: uma troca futura precisa incluir os 4 `href`
 * daqueles dois arquivos.
 */
export const CTA_HREF = "/criar-conta";
