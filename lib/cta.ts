/**
 * Destino único dos CTAs das seções comerciais.
 *
 * Era `#comecar` — e isso estava errado de um jeito que não aparecia em
 * teste nenhum: `id="comecar"` está no `<div>` do botão "Criar cobrança"
 * **dentro da maquete do capítulo 2**, um elemento decorativo no meio da
 * cena pinada. Clicar em "Começar agora" rolava o visitante *para trás*,
 * até o meio da animação. A âncora existia, então nenhuma verificação de
 * link acusava; o defeito era de destino, não de link quebrado.
 *
 * Agora aponta para `/comecar`, que é uma página de espera honesta: diz que
 * o cadastro não abriu e reserva o lugar exato onde ele vai entrar.
 *
 * PENDENTE: quando o cadastro real existir, ele ocupa `/comecar` — ou esta
 * constante passa a apontar para o canal externo. Uma linha, um lugar.
 *
 * Os CTAs do hero e do capítulo 5, em `Stage.tsx` e `StaticStory.tsx`, foram
 * apontados para `/comecar` em 26/08/2026 com autorização explícita do
 * proprietário — só o `href`, nada mais. Eles não leem esta constante (são
 * literais), então uma troca futura de destino precisa incluir os 6 `href`
 * daqueles dois arquivos.
 */
export const CTA_HREF = "/comecar";
