# Zelo — checkpoint do projeto

Estado em **25/08/2026**. Este documento existe para outra sessão continuar sem
reconstruir decisões. Leia junto com o [README](README.md), que explica *como*
as coisas funcionam; aqui está *onde paramos e o que não pode ser tocado*.

> **Leia primeiro:** a página deixou de ser só a peça cinematográfica. Hoje ela
> é `HEADER → HERO → capítulos 1–5 (pinados) → 8 seções comerciais → FOOTER`.
> Os capítulos **e agora também o hero** estão congelados. As seções 16 a 19
> descrevem tudo que foi construído depois deles.

---

## 1. Objetivo do site

Zelo é um SaaS de **cobrança recorrente automática via Pix Automático**,
para autônomos e prestadores de serviço (personal, terapeuta, professor
particular, consultor). O site precisa fazer o visitante entender, sem estudar:

1. existe um problema de cobrança manual;
2. a Zelo organiza isso;
3. o cliente autoriza uma vez;
4. a cobrança acontece automaticamente;
5. o dinheiro chega ao prestador;
6. a recorrência continua;
7. o prestador não precisa ficar cobrando;
8. ele pode continuar trabalhando.

Mote da marca: **"Você trabalha. A Zelo cobra."**

## 2. Conceito visual

**Scroll storytelling cinematográfico, não landing page.** Uma cena única,
pinada, em que o scroll dirige a câmera. Tudo é reversível: rolar para cima
volta a história. Regras permanentes:

- nada "aparece": todo elemento tem origem e destino no espaço;
- sem seta, linha ligando objetos, fluxograma, moeda, partícula, gráfico
  genérico, dashboard, ícone decorativo ou efeito sem função narrativa;
- todo movimento explica uma etapa do produto — **menos decoração, mais
  demonstração**;
- desktop e mobile têm coreografias próprias quando a composição horizontal
  não funciona.

Stack: **Next.js 16 + React 19 + TypeScript + GSAP ScrollTrigger + Lenis**.
Sem WebGL: a profundidade vem de camadas DOM em `perspective`/`translateZ`.
CSS Modules, sem Tailwind.

## 3–4. Capítulos e timeline

Roteiro em **`lib/scene.ts`** (`BEAT` = instantes, `RITMO` = durações). Um beat
vale **72px no desktop e 52px no mobile** (`PX_POR_BEAT`), e `SCROLL_LENGTH`
deriva de `PX_POR_BEAT × BEAT.end` — **esticar a narrativa nunca acelera o que
já foi aprovado**.

| capítulo | beats | conteúdo |
| --- | --- | --- |
| **1 — o caos** | 0–66 | calma → 3 cobranças → mensagens/planilha/lembrete → pico → congelamento (40–44) → esvaziamento → **silêncio (51–56,5)** → "E se você não precisasse mais cobrar?" (57–66) |
| **2 — o sistema** | 67–157 | a frase recua → primeiro sinal verde (72) → o caos vira estrutura (74–87) → ZELO nasce dela (89) → travessia da câmera (100–108,5) → interface e seus estados: criar → criando → criada → autorização pendente → autorizado → cobrança ativa |
| **3 — o dinheiro** | 157–216 | a câmera recua e revela os dois polos → o dia 05 chega → o Pix debita → o valor atravessa o espaço → pago → recebido → próxima agendada → recorrência (2 ciclos mais curtos) → R$ 1.050,00 e 05 DEZ |
| **4 — a atenção** | 216–261 | a câmera vai até o profissional (cresce 45%) → o sistema sai de foco → os **mesmos três clientes do capítulo 1** voltam pagos → a rotina segue desfocada (saldo até R$ 1.750, datas até 05 FEV) → a assinatura nasce da cena |
| **5 — a decisão** | 261–286 | a assinatura sobe e a marca se remonta em volta dela → CTA "Criar minha primeira cobrança" → silêncio: ficam marca, assinatura, CTA e o profissional |

Constantes de fronteira: **`BEAT.capituloDois = 157`** e
**`BEAT.capituloTres = 216`**. Os tweens finais dos capítulos 2 e 3 apontam
para elas, nunca para `BEAT.end`. **Um capítulo novo deve criar a sua própria
constante de fronteira do mesmo jeito.**

**Compressão de densidade (25/08/2026).** A timeline foi de 312 para **286
beats** sem perder nenhum estado ou momento narrativo: só os capítulos 2
(105 → 90) e 3 (70 → 59) encolheram, por *dwell* e duração, nunca por
remoção de história. Capítulo 1 ficou **numericamente idêntico** (beat 51,
silêncio 5,5 beats/396px e frase 61→71,5 preservados ao pixel); capítulos 4
e 5 mantêm 45 e 25 beats — apenas deslocados. O capítulo 1 perdeu dois chips
("Vence hoje", "Atrasado 3 dias") que repetiam o status dos próprios cards.

## 5. Comprimento

- Desktop: **20.592px** de trecho pinado (286 × 72)
- Mobile: **14.872px** (286 × 52)
- Página inteira, com as seções comerciais: **29.439px desktop · 25.524px
  mobile** (medido em 25/08/2026, depois das camadas de animação de Problema,
  Como funciona e Automação. O número anterior — 24.006px — é de antes delas;
  o trecho pinado não mudou, quem cresceu foram as seções comerciais)

São ~23 telas no desktop. O usuário aceitou o comprimento **desde que cada
trecho tenha função narrativa**, e **vetou reduzir `PX_POR_BEAT`** para
comprimir a peça — a compressão foi feita em beats, não em pixels por beat.

## 6. Estado de cada capítulo

| capítulo | estado |
| --- | --- |
| 1 | **aprovado e congelado** |
| 2 | **aprovado e congelado** |
| 3 | **aprovado e congelado** |
| 4 | implementado e revisado, sem objeções pendentes |
| 5 | implementado e revisado, sem objeções pendentes |
| calibração de luz | **aprovada** |
| correção do notebook no mobile | **aprovada** |
| **hero (fundo + demonstração)** | **aprovado e congelado** — ver seção 16 |
| **seções comerciais** | implementadas — ver seção 17 |
| **Problema · Como funciona** | animadas e **aprovadas** (25/08/2026) |
| **Automação** | animada — ver seção 20 |
| **header + footer** | implementados — ver seção 17 |
| **base de produção (SEO/analytics)** | implementada — ver seção 18 |

## 7. Decisões de design já aprovadas

- **O profissional é uma silhueta SVG em contraluz**, nunca foto. Foto de banco
  de imagem foi o que quebrou as tentativas anteriores do projeto.
- **Ele nunca age.** Em nenhum beat dos capítulos 3, 4 e 5 ele clica, confere ou
  reage. A ausência de ação é a mensagem.
- **A silhueta é o elemento mais escuro do quadro** (`#030504`). É a diferença
  entre ela e um ambiente com volume que a torna legível — nunca iluminá-la.
- **O verde é narrativo**: quase ausente no capítulo 1, primeiro sinal no beat
  72, autoridade a partir da marca, e depois só em confirmação, status, valores,
  ações e marca. Nunca lavando o fundo.
- **O dinheiro é o próprio valor tipográfico** viajando pelo espaço, com o
  rótulo "Pix Automático" junto. Sem moeda, sem nota, sem partícula.
- **Valor nunca aparece sem contexto de recorrência**: sempre `R$ 350,00 / mês`.
- **Os três cards do capítulo 1 são reusados** no capítulo 4 — os mesmos nós do
  DOM, agora pagos. É a rima que fecha a peça. Nenhum cliente novo.
- **O CTA é o botão do capítulo 2 voltando** — mesma linguagem visual do
  `.compBtn` que o visitante viu funcionar. Sem CTA secundário.
- **Prioridade em conflito:** clareza acima de estética.

## 8. O que NÃO deve ser alterado

Sem autorização explícita do usuário:

- beats, durações, timeline e ordem dos capítulos 1–5;
- composição, posições, escalas e câmera dos capítulos 1–3;
- o **beat 51** (quadro limpo com o profissional no escuro) — citado pelo
  usuário como o momento que ele mais preserva;
- a mesa, a janela, o notebook, a silhueta e a iluminação;
- headline, frase, assinatura, identidade, tipografia;
- tokens de cor (calibração recém-aprovada);
- CTA e linha de público;
- **o HERO INTEIRO** — fundo de infraestrutura, demonstração
  Cliente → Zelo → Você recebe, headline, kicker, assinatura, CTAs e
  indicador de rolagem. Congelado desde a etapa de construção comercial.

Se algo anterior precisar mudar para viabilizar uma continuação, **explique
antes, não faça automaticamente**. Foi assim que o projeto inteiro andou.

## 9. Tokens e última calibração

Calibração de luz aprovada em 25/08/2026, feita por **medição** com
`tools/lum.mjs` (fotografa a cena e lê o brilho médio por região).

Diagnóstico que motivou: mesa, notebook e profissional viviam todos entre 4 e 6
de luminância — indistinguíveis entre si e do preto.

| região | antes | depois |
| --- | --- | --- |
| interface (card branco) | 95,9 | 95,9 |
| CTA (botão verde) | 44,9 | 44,9 |
| parede / fundo superior | 7,7–14,7 | 11,7–19,0 |
| mesa / fundo inferior | 4,0–4,4 | 7,0–7,2 |
| profissional | 3,9–5,2 | 9,3–10,7 |
| notebook | 4,0–6,0 | 8,1–9,2 |

Tokens atuais (`app/globals.css`):

```
--black:#0A0F0D          --graphite-900:#111614   --graphite-800:#171D1B
--graphite-700:#1E2523   --graphite-600:#262E2B
--gray-500:#5A6360       --gray-400:#7E8885       --gray-300:#9AA3A0
--gray-200:#C6CCCA       --off:#F2F4F3            --paper:#FFFFFF
--green:#16805C          --green-deep:#0B5C41     --green-bright:#22A277
--green-pale:#E7F3EE     --warn:#96702a           --warn-soft:#f7efde

/* violeta elétrico — energia do hero e acento das seções comerciais */
--violet:#6C3BFF         --violet-deep:#4520C9    --violet-bright:#8B5CFF
--violet-highlight:#B59CFF                        --violet-pale:#EFEAFF
--violet-rgb:108,59,255        (estrutura e energia)
--violet-glow-rgb:139,92,255   (queda das auras — o elétrico puro escurece)
```

Camadas de ambiente calibradas em `Stage.module.css`: `.viewport`, `.wall`,
`.desk`, `.laptop`, `.nearField` (0,86), `.vignette` (0,40).

**Sobre os neutros:** os atuais são **esverdeados**. O usuário aprovou uma
paleta com neutros **azulados** (`#080A0F` / `#0D1018` / `#151923`), mas ela
foi aplicada **só no fundo do hero** — `--black` e `--graphite-*` continuam
como estão. Estender é seguro para os capítulos (as cores da sala são
hardcoded, não tokens), mas muda as seções comerciais. **Decisão em aberto.**

## 10. Mobile — estado atual

O mobile tem coreografia própria em todos os capítulos:

- **capítulo 1:** o caos é **temporal**, não espacial — os elementos atravessam
  a cena um a um em faixas verticais próprias, em vez de se acumularem;
- **capítulo 3:** o dinheiro **cai** (eixo vertical) em vez de atravessar;
- **capítulo 4:** o card da interface some (a 35% de escala vira ruído
  ilegível), o saldo sobe para o topo e os três clientes ocupam o meio;
- **capítulo 5:** o sistema se recolhe no beat 287 (e não no 302 como no
  desktop), porque cards, marca e CTA não cabem juntos.

**Correção do notebook (aprovada):** no fecho do mobile a tampa do notebook
cobria a cabeça do profissional. Duas correções foram aplicadas, nessa ordem:

1. **Opção A** — o recuo final da câmera passou de z 90 para **z 200**
   (`isMobile ? 400 : 180` no tween de `BEAT.silencio`). Melhorou o
   enquadramento (figura 9% maior) mas **não resolveu**: a razão entre figura e
   notebook não muda com a câmera.
2. **Opção B** — a tampa perde opacidade entre os beats 302 e 312, só no
   mobile, com `sine.out`: **1,00 → 0,62 (306) → 0,42 (309) → 0,35 (312)**.
   Isso resolveu: cabeça, pescoço e ombros ficam legíveis e o notebook continua
   reconhecível como painel sobre a mesa. Desktop permanece em 1,00.

## 11–12. Testes e sondas

Todos em `tools/`, rodam contra o dev server em `http://localhost:3210` usando
`puppeteer-core` + Chrome local. Dependem dos handles `window.__st` e
`window.__lenis`, que **só existem em desenvolvimento**.

| script | para que serve |
| --- | --- |
| `shots.mjs L A pasta` | fotografa cada beat marcado da narrativa (listas separadas para desktop e mobile) |
| `ritmo.mjs` | cadência, densidade e respiro beat a beat — mede o silêncio do capítulo 1 |
| `cap2.mjs` | quanto tempo cada momento do capítulo 2 existe **formado** |
| `cap3.mjs` | invariantes do dinheiro: estado único do token, saldo crescente, datas em ordem, nada preso |
| `cap45.mjs` | invariantes da conclusão: crescimento do profissional, estado dos cards, sistema vivo fora de foco, ordem assinatura→marca→CTA, CTA clicável só quando existe |
| `colisao.mjs L A de ate passo` | varre uma faixa de beats atrás de sobreposição e corte de quadro |
| `reverso.mjs` | rola até o fim e volta, comparando o estado em beats-chave |
| `fps.mjs` / `fpsmob.mjs` | ritmo de quadros durante o scroll |
| `lum.mjs` | luminância medida por região (auditoria de luz) |
| `geo.mjs`, `geo45.mjs`, `bandas.mjs` | geometria: onde cada elemento está, em % da viewport |
| `recorte.mjs beat nome` | recorta a região do profissional **da viewport** (o `clip` do Puppeteer usa coordenadas do documento — cuidado) |
| `reduced.mjs` | captura a versão `prefers-reduced-motion` |
| `automacao.mjs L A pasta` | invariantes da seção Automação: repouso, ciclo fechado, recuo do "antes", passagem, linha percorrida e overflow. Acha tudo por `data-*`, não por nome de classe |
| `fim.mjs` | fotografa o estado exato do último beat |

**Resultado da última rodada completa (25/08/2026):**

| verificação | resultado |
| --- | --- |
| TypeScript | limpo |
| Build de produção | compila |
| `cap45.mjs` desktop e mobile | todos os invariantes cumpridos (profissional 115→167px, saldo R$ 1.750,00) |
| `cap3.mjs` desktop e mobile | todos os invariantes cumpridos |
| Capítulo 1 | silêncio 5,5 beats/396px · cena vazia no beat 51 · frase legível 61→71,5 |
| Capítulo 2 | estrutura 6 · travessia 8 · CRIAR 7,5 · CRIADA 8 · PENDENTE 7,5 · AUTORIZADO 7 · ATIVA 7,5 |
| Capítulo 3 | ciclo 1 = 37 beats · ciclo 2 = 9 · ciclo 3 = 7 (aceleração preservada) |
| Colisão/corte 216–286 | nenhuma, desktop e mobile |
| Reversibilidade | idêntica nos dois formatos |
| FPS | **57,7–57,9 desktop · 58,3–58,4 mobile** |
| `prefers-reduced-motion` | documento de 10.425px com header, história, seções comerciais e footer |
| Console | zero erros, desktop e mobile |
| Overflow horizontal | nenhum em 1440 / 1280 / 768 / 390 / 360 |

**Estes números são a linha de base.** Qualquer alteração futura precisa
reproduzi-los exatamente.

**Armadilha ao medir FPS:** `tools/fps.mjs` abre um browser novo a cada
execução, então mede sempre um **primeiro scroll frio** — com o documento
maior, o custo de primeira pintura derruba o número. Um teste A/B na mesma
sessão mostrou **59,4 com e 59,4 sem** as seções comerciais: em regime elas
custam zero. Se um valor vier baixo, repita na mesma sessão antes de concluir
que houve regressão; a máquina também fica sobrecarregada após várias rodadas.

**Atenção às sondas:** `cap2.mjs`, `cap3.mjs`, `cap45.mjs`, `reverso.mjs` e
`shots.mjs` têm faixas de beat **fixas no próprio arquivo**. Quando a timeline
muda, elas passam a medir o capítulo errado sem acusar erro — foi o que
aconteceu na compressão de 25/08/2026. Ao mexer em `lib/scene.ts`, confira
essas constantes no topo de cada sonda.

## 13. Problemas conhecidos, não resolvidos

1. **O CTA não tem destino.** Tudo aponta para `#comecar`, uma âncora interna.
   As seções comerciais leem `lib/cta.ts` — quando o cadastro existir, **uma
   linha** resolve todas elas. O hero e os capítulos ainda usam `#comecar`
   literal, porque estão congelados: são 3 `href` a trocar com autorização.
2. **Preço não definido.** `Pricing.tsx` mostra `[DEFINIR PREÇO]`; a estrutura
   aceita taxa por cobrança, mensalidade ou grátis+taxa sem redesenho.
3. **"ZELO" aparece duas vezes no topo** — no header e na assinatura do hero,
   uma abaixo da outra. A assinatura do hero nasceu quando não havia header.
   Remover é uma linha em `Stage.tsx`, mas o hero está congelado: **precisa de
   autorização**.
4. **Logo oficial não está no projeto.** O usuário enviou uma folha com 4
   versões (lockup, símbolo, wordmark, app icon) como imagem de conversa, mas
   **os arquivos não estão no disco**. Header, footer e Open Graph usam wordmark
   textual com `TODO(marca)` marcado. Precisa dos SVGs em `public/`.
5. **A assinatura no mobile, no capítulo 2**, ocupa 380px numa tela de 390px e
   encosta nas bordas. O usuário optou por **não alterar o capítulo aprovado**;
   o ajuste de entreletras vale só a partir do beat 278. Unificar é uma linha de
   CSS + reteste dos capítulos 1–3.
6. **Deltas em pixels calculados na montagem.** Vários movimentos (viagem do
   dinheiro, ida do card para o polo) usam px derivados de `window.innerWidth/
   innerHeight` no momento em que a timeline é criada. Trocar de breakpoint
   recria tudo via `matchMedia`, mas **redimensionar dentro do mesmo
   breakpoint deixa os deltas defasados**. Nunca incomodou em uso real; se um
   dia incomodar, o caminho é recriar a timeline no `refreshInit`.
7. **O projeto não é um repositório Git.** `git rev-parse` falha. Sem isso não
   há GitHub nem deploy na Vercel. `git init` é ação do usuário.

## 14. Próximos passos recomendados

Em ordem de valor:

1. **Destino do CTA** (`lib/cta.ts`) — sem isso o site não converte nada.
2. **Preço** — decidir o modelo e preencher `Pricing.tsx`.
3. **`git init` + GitHub + deploy na Vercel.** O projeto nunca foi publicado.
4. **Arquivos da logo** em `public/` — destrava header, footer e Open Graph.
5. **Dados da empresa** para o footer (e-mail, razão social, CNPJ) e as páginas
   Sobre / Contato / Termos / Privacidade, que ainda não existem.
6. **Validar a peça com gente de fora** antes de investir em tráfego.

## 15. Detalhes técnicos que economizam tempo

- **Rodar:** `npm run dev` na pasta `web/`, porta **3210**. A entrada
  `cobra-certo` do `launch.json` compartilhado aponta para lá — esse arquivo é
  usado por outros projetos, **leia antes de sobrescrever**.
- **Armadilha de GSAP com `scrub`:** posicionar o playhead num beat renderiza
  *também* os tweens seguintes no estado inicial deles. Consequências reais já
  enfrentadas: (a) nunca escreva no DOM pelo `onUpdate` de vários tweens
  concorrentes — o valor fica preso num estado futuro; calcule como função pura
  do beat no `onUpdate` da timeline (é assim que o saldo funciona); (b) evite
  `fromTo` em ciclos repetidos, porque o `from` de um ciclo futuro se impõe
  durante o ciclo atual — use `.to` encadeado.
- **Camadas:** `.room` e `.layer` são dois planos **achatados**, cada um com
  `perspective` própria. Se a sala virar `preserve-3d` junto com o caos, o plano
  da mesa atravessa o volume e **oclui** elementos que têm `opacity: 1`.
  `.layer` sempre pinta na frente de `.room` — nada do caos pode passar atrás
  do profissional.
- **Transform tem um dono só.** Um elemento não pode ter `transform` no CSS e
  ser animado pelo GSAP: o primeiro tween apaga o CSS. Centralizações são feitas
  com `gsap.set` (`xPercent`/`yPercent`). Pelo mesmo motivo, a respiração de
  repouso vive nas âncoras (`.anchor`) e o movimento de cena nos filhos.
- **`filter: blur()` é caro** quando a câmera muda de escala: força
  re-rasterizar. Os brilhos de ambiente usam paradas suaves dentro do próprio
  gradiente. Isso levou a cena de 38fps para 58fps.
- **Verificação visual não usa o painel de preview** — ele frequentemente não
  compõe quadros, e o `javascript_tool` engana porque sem quadros o rAF não roda
  e o scroll programático não avança. Use os scripts em `tools/`.
- **Código morto removido:** a classe `.cool` (esfriamento da luz no caos) foi
  apagada do CSS numa refatoração antiga e ficou referenciada no componente sem
  nunca funcionar. A referência foi removida; a aparência aprovada é a que
  existe **sem** essa camada.

---

## 16. O HERO — congelado

O hero **não é mais a sala**. A sala (`.room`, `.wall`, `.desk`, `.figure`,
`.laptop`) continua intacta no DOM porque pertence aos capítulos, mas durante
os beats do hero ela é **coberta** por uma camada nova e revelada de volta no
`BEAT.copyOut`. Medido: desligar `.camera` inteira no hero muda 0,42 de 255.

**Camadas do fundo** (todas exclusivas do hero, todas somem no `copyOut`):

| classe | o que é |
|---|---|
| `.heroScape` | contêiner; `z-index: 6`, acima da sala |
| `.heroScapeBase` | grafite com faixa de horizonte — opaco, é ele que cobre a sala |
| `.heroArch` | SVG: 13 vigas + 9 travessas convergindo para um **ponto de fuga sobre a demonstração** (`VP = {x:1150, y:470}`). É o que faz o hero ler como *lugar* |
| `.heroPlaneA/B` | dois planos angulares, deriva de 34s/46s |
| `.heroConduits` | SVG: 4 condutos **curvos** — 2 entram no núcleo, 2 saem. Traçado sempre visível; o pulso viaja por `stroke-dashoffset` |
| `.heroFore` | primeiro plano cortado pelas bordas — dá escala, deriva de 58s/72s |
| `.heroAura` / `AuraIn` / `AuraDeep` | núcleo de energia. **Três nós, três donos**: contêiner = scroll, interna = respiração, funda = pulso |

**A demonstração** (`.heroDemo`) é `Cliente → Pix Automático autorizado → Zelo
→ Cobrança automática → Você recebe`, com ciclo próprio em loop (~9s),
independente do scroll. Quando a Zelo processa, **a infraestrutura reage**:
anel acende, condutos ganham intensidade, 3 luzes distantes acendem em
sequência.

**A vignette é neutralizada só no hero** (`opacity: 0.22`) e volta a `1` no
`copyOut`. Ela apagava justamente os cantos onde a arquitetura vive — media
3,43 de delta contra 3,31 de toda a infraestrutura nova somada.

**Regra cromática do hero:** violeta = processo/energia; **verde = resultado
financeiro** (PAGO, + R$ 350,00, ponto de "Você recebe").

## 17. A página comercial

Ordem em `app/page.tsx`:

```
SiteHeader (fixo)
Stage  → hero + capítulos 1–5 (pinado, 20.592px desktop)
CommercialProblem   #problema      ← animada (ScrollTrigger scrub)
HowItWorks          #como-funciona ← animada (ScrollTrigger scrub)
Automation          #automacao
Benefits            #beneficios
WhoItsFor           #para-quem
Pricing             #preco
Trust               #confianca
Faq                 #faq
ClosingCta          #comecar-agora
SiteFooter
```

- **`Commercial.module.css`** é a casca compartilhada das seções (section,
  inner, kicker, title, lead, grid, cell, botões, marcador `pendente`).
  Ajustar o ritmo vertical da parte comercial é **uma** edição, não sete.
- **`lib/useReveal.ts`** usa **IntersectionObserver, não ScrollTrigger**.
  Motivo medido: cada ScrollTrigger é reavaliado a todo evento de scroll,
  inclusive durante a cena pinada — oito deles custavam ~2fps no desktop.
- **Três seções têm ScrollTrigger** (uma cada, com `scrub`): Problema (o
  ciclo cobrar→lembrar→acompanhar→conferir que se acumula e pesa), Como
  funciona (a energia percorrendo o fluxo, terminando em verde) e Automação
  (o ciclo manual se fechando, e a linha automática percorrida até o verde —
  ver seção 20). Com as três, a página tem **5 ScrollTriggers** no total.
- **`lib/lenis.ts`** é a ponte para as âncoras: `window.__lenis` só existe em
  dev, e sem isso o salto `href="#id"` briga com o scroll suave em produção.
  Offset do header = 76px.
- **Header:** transparente no topo, sólido ao rolar. O estado vem de
  **IntersectionObserver sobre uma sentinela**, não de listener de scroll —
  custo zero por quadro. Hamburger no mobile, Esc fecha, foco volta ao botão.

## 18. Produção — SEO, analytics, segurança

Tudo com **zero dependências novas** (o Next.js já traz o necessário):

- `app/layout.tsx` — metadata completa: `metadataBase`, canonical, Open Graph,
  Twitter card, robots. `TODO(marca)` nas imagens de OG (falta a logo).
- `app/robots.ts` e `app/sitemap.ts` — rotas geradas, servindo.
- `components/Analytics.tsx` — GA4 + Clarity via `next/script`, **carregados só
  se a env existir**. Confirmado: sem os IDs, `gtag` é `undefined` e **zero**
  scripts externos são baixados.
- `lib/analytics.ts` — `cta_start`, `cta_demo` ativos. `signup_start` e
  `signup_complete` **declarados mas nunca disparados** (não há cadastro).
  Cliques capturados por **um listener delegado** lendo `data-evt` — foi o que
  permitiu instrumentar sem tocar em arquivo congelado.
- `next.config.ts` — 5 headers de segurança, `X-Powered-By` removido. **CSP
  ficou de fora de propósito:** o projeto usa scripts/estilos inline (GSAP,
  gtag, Clarity) e uma CSP mal calibrada quebraria a cena só em produção.
- `.gitignore` — corrigido: **não cobria `.env*`** (qualquer chave iria para o
  Git). Também ignora `shots*/` (~150 PNGs de sonda).
- `.env.example` — `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`,
  `NEXT_PUBLIC_CLARITY_ID`. Nenhuma obrigatória.
- **Script `lint` removido:** `next lint` não existe mais no Next 16 e o
  projeto nunca teve ESLint. Existe `npm run typecheck`.

## 19. Pendências de decisão do usuário

Nada disso pode ser inventado — está tudo marcado no código:

| pendência | onde |
|---|---|
| Modelo e valor do preço | `Pricing.tsx` → `PRECO` |
| 2 respostas do FAQ (mensalidade, como começar) | `Faq.tsx` → `pendente: true` |
| Infra/compliance de pagamento | `Trust.tsx` → `PENDENTES` |
| E-mail, razão social, CNPJ | `SiteFooter.tsx` → `EMPRESA` |
| Destino real do cadastro | `lib/cta.ts` → `CTA_HREF` |
| Arquivos da logo | `public/` (não existem) |
| Páginas Sobre/Contato/Termos/Privacidade | não existem |
| Remover o "ZELO" duplicado do hero | precisa autorização (hero congelado) |

### Onde estão as coisas

```
Documents/cobra-certo/
├── web/                  ← o site (este projeto)
│   ├── app/              layout, globals.css (tokens), page.tsx,
│   │                     robots.ts, sitemap.ts, icon.svg
│   ├── components/
│   │   ├── Stage.tsx          hero + capítulos 1–5 (~2.400 linhas) — CONGELADO
│   │   ├── StaticStory.tsx    versão prefers-reduced-motion
│   │   ├── SmoothScroll.tsx   Lenis (+ ponte lib/lenis)
│   │   ├── JourneyProgress.*  indicador de jornada (5 etapas)
│   │   ├── SiteHeader.*       header fixo + menu mobile
│   │   ├── SiteFooter.*       rodapé (dados da empresa pendentes)
│   │   ├── Commercial.module.css   casca compartilhada das seções
│   │   ├── CommercialProblem.*     ← ScrollTrigger próprio
│   │   ├── HowItWorks.*            ← ScrollTrigger próprio
│   │   ├── Automation.*  Benefits.*  WhoItsFor.*
│   │   ├── Pricing.*  Trust.*  Faq.*  ClosingCta.*
│   │   ├── Analytics.tsx      GA4 + Clarity (opcionais)
│   │   └── icons.tsx
│   ├── lib/
│   │   ├── scene.ts      o roteiro: BEAT, RITMO — NÃO ALTERAR
│   │   ├── useReveal.ts  revelação por IntersectionObserver
│   │   ├── lenis.ts      ponte para âncoras do header
│   │   ├── cta.ts        CTA_HREF (destino pendente)
│   │   └── analytics.ts  eventos de conversão
│   ├── tools/            as sondas (+ herociclo.mjs, comercial.mjs)
│   ├── .env.example      chaves documentadas, sem valores
│   ├── shots*/           quadros de inspeção (fora do Git)
├── landing/autorizar.html   tela de autorização do Pix, do trabalho antigo
├── app-next/                scaffold antigo — NÃO é o projeto atual
├── assets/ e docs/
```

---

## 20. A seção Automação

Terceira seção comercial a ganhar camada de animação (25/08/2026), depois de
Problema e Como funciona. **A copy não mudou** — só a forma.

**A ideia:** a mesma rotina lida duas vezes. À esquerda ela é um **ciclo
fechado** (manual, e por isso recomeça); à direita é uma **linha** (configurada
uma vez, e por isso termina em dinheiro). O contraste entre as duas formas é a
mensagem, então não há card novo, dashboard, ícone nem partícula: só nós,
conectores e uma passagem entre as colunas.

| decisão | por quê |
|---|---|
| as colunas têm **altura natural** (`align-self: start`) | o "depois" termina visivelmente antes: é o "ciclo que sobra é mais curto" do lead acontecendo na composição, sem mais uma frase |
| o "depois" nasce em **fantasma** (opacidade 0,16), não ausente | no desktop as duas colunas são vistas juntas; esconder uma deixaria meia composição vazia |
| conector do "antes" é **1px interrompido**, o do "depois" é **trilho de 2px com energia dentro** | manual *versus* contínuo, sem precisar de rótulo |
| as tarefas manuais **entram de lados alternados** e ficam desalinhadas | o "fragmentado" existe também no repouso, não só na entrada |
| o colchete de retorno fecha "Cobrar de novo" em "Cobrar" | é o que torna o ciclo um ciclo |
| **violeta** só em `Automatizar`, **verde** só em `Receber` | regra cromática: violeta é onde a Zelo age, verde é o dinheiro |
| nada de `filter: blur()` | mesma razão dos capítulos |

**Coreografia** (um ScrollTrigger, `scrub: 0.8`, gatilho `.par`,
`start "top 82%"` → `end "bottom 62%"`): as cinco tarefas manuais chegam uma a
uma → o ciclo se fecha → o "antes" recua para opacidade 0,4 → a passagem
preenche → os quatro passos do "depois" acendem em linha, com a energia
percorrendo → anel violeta em `Automatizar`, anel verde em `Receber`.

**Ritmo medido:** 76px de scroll por unidade da timeline, contra 59 do Problema
e 28 do Como funciona — é a mais folgada das três.

**Eixo no mobile:** as colunas já são verticais nos dois formatos. Quem troca
de eixo é só a **passagem** entre elas — `scaleX` lado a lado, `scaleY` quando
empilham em 760px, via `matchMedia`.

**Custo medido:** A/B na mesma sessão, matando só este ScrollTrigger —
**60,0 fps com e 60,0 fps sem**. Em regime ele custa zero; o 57,4 que aparece
na primeira medição é o primeiro scroll frio de sempre.

**A seção cresceu ~360px.** É o preço de trocar duas listas compactas por duas
sequências com conectores.

---

## 21. Execução da fila do ZELO_AUTONOMOUS_PLAN

O plano existe agora em `ZELO_AUTONOMOUS_PLAN.md` (foi fornecido pelo
proprietário em 26/08/2026; antes disso era citado mas não estava no disco).

### O mecanismo novo: `useRevealEach`

`lib/useReveal.ts` ganhou um segundo hook, **aditivo** — o `useReveal`
original não mudou uma linha, e as seções congeladas que dependem dele
seguem idênticas.

O problema que ele resolve: `useReveal` observa a **seção inteira**, então
numa grade de seis células as de baixo terminavam de animar antes de o
visitante chegar nelas — o movimento acontecia fora da vista. `useRevealEach`
observa **cada item sozinho**, e o item só entra quando aparece de fato.

Continua sendo IntersectionObserver, não ScrollTrigger, pela mesma razão
medida de sempre. **A página segue com 5 ScrollTriggers** — nenhum foi
adicionado nesta rodada.

Dois detalhes que custaram tempo e ficam registrados:

1. **Numa grade, quem se move é o conteúdo, nunca a célula.** As divisórias
   são o `gap: 1px` da grade aparecendo por trás; uma célula que translada
   abre uma fresta na linha. Por isso Benefícios e Confiança animam um `div`
   interno, e as células ficam com `transform: none` (verificado por sonda).
2. **Listas que dividem borda usam deslocamento 0.** No FAQ, o transform
   levaria a borda do item junto e ela invadiria o item seguinte —
   `useRevealEach(0)` anima só a opacidade.

### Tarefas

| # | tarefa | resultado |
|---|---|---|
| 01 | Benefícios | 6 células, entrada progressiva por posição própria |
| 02 | Para quem é | revelação por perfil; lista foi de 7 para **14 perfis**, todos da lista do proprietário no plano (TASK 02) |
| 03 | Pricing | só a lista "o que está incluso" ganhou entrada progressiva. **Preço segue bloqueado** |
| 04 | Trust | 3 fatos com entrada progressiva; faixa de pendências intacta |
| 05 | FAQ | revelação por pergunta + `aria-controls`/`role=region` ligando botão e painel |
| 06 | CTA final | destinos, âncoras, tracking e nomes acessíveis conferidos |
| 09 | SEO | metadata completa e correta; faltam só imagem de OG e JSON-LD, ambos bloqueados |
| 10 | Responsividade | 1440 · 1280 · 1024 · 768 · 390 · 360 — **0px de overflow** em todas |
| 11 | Acessibilidade | 1 h1, 13 h2, 19 h3; **0** interativos sem nome acessível; **0** `<img>` sem alt |
| 12 | Analytics | **falha corrigida** — ver abaixo |
| 13 | Links | **âncora morta corrigida** — ver abaixo |
| 14 | Footer | conferido: nenhum dado inventado, pendências como "a definir" |
| 16 | QA final | typecheck limpo, build compila, console zerado |

### Duas correções de verdade encontradas na auditoria

1. **Os CTAs do hero e do capítulo 5 não disparavam nenhum evento.**
   `cta_start` só existia no header, no preço e no fechamento — o primeiro e
   mais visível CTA da página era invisível em qualquer relatório. Como
   `Stage.tsx` e `StaticStory.tsx` são congelados e não podem receber
   `data-evt`, o listener delegado de `Analytics.tsx` passou a reconhecer o
   CTA **pelo destino** (`CTA_HREF` ou `#comecar`) quando não há atributo.
   Verificado: dispara `cta_start` com `local=cena`.
2. **`href="#topo"` no header apontava para uma âncora inexistente.** Só
   funcionava porque o `onClick` intercepta; sem JavaScript, ou ao abrir em
   nova aba, não levava a lugar nenhum. Virou `href="/"`.

### Medições desta rodada

| verificação | resultado |
|---|---|
| TypeScript | limpo |
| Build | compila |
| Console | **0 erros** em 1440/1280/1024/768/390/360, varrendo a página inteira |
| Overflow horizontal | **0px** nas seis larguras |
| `prefers-reduced-motion` | 33 itens novos, **0 invisíveis**, todos `transform: none`; documento de 10.878px |
| Automação (regressão) | todos os invariantes cumpridos — `useReveal.ts` mudou sem afetá-la |
| FPS | **ver o aviso abaixo** |

**Aviso sobre o FPS desta rodada.** Os números absolutos vieram baixos
(50–56 desktop, 46–54 mobile) e o p95 subiu de 16,8 para 18,3ms. **Não é
regressão do código.** O A/B na mesma sessão — alternando três vezes, com os
observers de `[data-reveal-each]` ligados e desligados — deu **54,5 fps com
e 53,6 fps sem**, e p95 de 18,3ms nas **duas** condições. Ou seja: a página
*sem* a mudança mede o mesmo hoje. A máquina estava carregada (dezenas de
instâncias do Chrome ao longo da sessão) e o servidor de dev era novo. Uma
armadilha extra descoberta agora: **manter o painel de preview aberto na
mesma página custa ~4 fps** na medição, porque um segundo Chrome renderiza a
cena em paralelo. Feche o preview antes de medir.

---

## 22. Finalização — auditoria de lançamento (26/08/2026)

### O defeito de conversão que nenhuma verificação de link pegava

`CTA_HREF` era `#comecar`. A âncora **existia**, então toda checagem de links
passava — mas `id="comecar"` está no `<div>` do botão "Criar cobrança"
**dentro da maquete do capítulo 2**, um elemento decorativo no meio da cena
pinada. Na prática, clicar em "Começar agora" rolava o visitante *para trás*,
até o meio da animação. O defeito era de **destino**, não de link quebrado.

Correção: existe agora a rota **`/comecar`** — uma página de espera honesta,
que diz que o cadastro não abriu, repete os três passos que a página inicial
já explica e **reserva o lugar exato onde o cadastro real entra**. Nada é
coletado, nada é prometido, nenhuma integração foi inventada.

`CTA_HREF` passou a apontar para ela. Continua sendo uma linha em
`lib/cta.ts` — quando o fluxo real existir, ele ocupa `/comecar` ou a
constante aponta para o canal externo.

**Ainda bloqueado:** os 3 `href="#comecar"` do hero e do capítulo 5 vivem em
`Stage.tsx` e `StaticStory.tsx`. São congelados — trocar precisa da sua
autorização. Até lá, esses CTAs continuam levando à maquete.

### Outras correções

| o quê | por quê |
|---|---|
| CTAs viraram `<Link>` do Next | com `<a>`, a navegação de página inteira derruba o beacon do GA antes de ele sair; com `Link` o evento sobrevive |
| `signup_start` passou a disparar | estava declarado desde sempre e nunca acontecia. Chegar a `/comecar` **é** a entrada do funil. Em dev ele dispara duas vezes (StrictMode); em produção, uma |
| contraste do rodapé | `--gray-500` sobre o grafite dava **2,95:1** em texto de 10–14px — abaixo do mínimo de 4,5:1 da WCAG AA. Virou `--gray-400` (**5,0:1**) e o `opacity: 0.72` do marcador "a definir" saiu, porque devolvia o texto ao nível anterior |
| `/comecar` fora do sitemap | é `noindex` enquanto for página de espera: anunciá-la seria pedir para o Google indexar um "ainda não está aberto" |

### Estado medido em 26/08/2026

| verificação | resultado |
|---|---|
| TypeScript · Build | limpos; 6 rotas estáticas, `/comecar` entre elas |
| Console | **0 erros** — as duas páginas, nas seis larguras |
| Overflow | **0px** em 1440/1280/1024/768/390/360, nas duas páginas |
| Menu mobile | abre, `aria-expanded` e `hidden` corretos, **Esc fecha**, foco volta ao botão, 0 overflow aberto |
| Âncoras | todas existem; nenhum link para 404 |
| Analytics | `cta_start` (header, preço, fechamento, **cena**), `cta_demo`, `signup_start`. Só `signup_complete` continua pendente |
| Contraste | **7 textos** abaixo de 4,5:1, **todos em área congelada** (5 na cena, 1 no Problema, 1 na Automação — o rótulo "Antes"). Rodapé: mínimo 5,0:1 |
| Cabeçalhos | 1 `h1`, 13 `h2`, 19 `h3` · `lang="pt-BR"` · 0 interativos sem nome acessível · 0 `<img>` sem alt |
| `prefers-reduced-motion` | documento de 10.878px, legível, sem depender de animação |
| Capítulos 3, 4 e 5 | invariantes **todos cumpridos** |
| Automação | invariantes **todos cumpridos** |
| FPS desktop | 56,1 · 57,3 · 56,6 — **p95 de 16,8ms, igual à linha de base** |
| FPS mobile | 58,0 · 50,5 · 55,1 — p95 16,8ms em duas das três |

Sobre o FPS: o que importa é o **p95 de 16,8ms**, idêntico ao da linha de
base — o custo de quadro em regime não mudou. As médias oscilam por causa de
travadas isoladas (83–133ms) típicas do modo de desenvolvimento. E vale
repetir a armadilha descoberta na rodada anterior: **feche o painel de
preview antes de medir**, senão um segundo Chrome renderiza a cena em
paralelo e o número cai ~4fps.

### Contraste em área congelada — a decidir

`--gray-500` (#5A6360) em texto pequeno não passa na WCAG AA sobre os fundos
escuros do projeto. Sete ocorrências ficaram, todas congeladas: o rótulo
"Antes" da Automação, o "Todo mês" do Problema e cinco elementos da cena.
A correção seria trocar por `--gray-400` nesses pontos — **precisa da sua
autorização**, porque mexe em arquivos aprovados.

---

## 23. Auditoria de continuidade (26/08/2026)

### Fatos verificados nesta sessão

| verificação | resultado |
| --- | --- |
| Contexto do projeto | `ZELO_PROJECT_CONTEXT.md` não existe; `ZELO_AUTONOMOUS_PLAN.md` e este checkpoint foram relidos antes de qualquer edição |
| Estrutura | `app/`, `components/`, `lib/` e `tools/` presentes; `public/` não existe |
| Git | continua ausente; `git init` não foi executado |
| TypeScript | `npm run typecheck` limpo |
| Build | `npm run build` compila; rotas estáticas: `/`, `/comecar`, `/icon.svg`, `/robots.txt`, `/sitemap.xml` |
| Analytics | comentário em `lib/analytics.ts` alinhado ao código: `signup_start` é disparado em `/comecar`; `signup_complete` permanece pendente do cadastro real |

### QA de navegador nesta sessão

O servidor ativo em `http://localhost:3210` respondeu `200` e entregou a
página Zelo. As sondas com Puppeteer não puderam iniciar uma nova sessão do
Chrome antes do limite de 30 segundos; portanto não foram usados números
novos de console, overflow, reduced motion, FPS ou regressão dos capítulos.
Os resultados medidos na seção 22 continuam sendo a última referência
verificada para esses itens.

### Pendências que continuam bloqueadas

- **BLOCKED — OFFICIAL LOGO REQUIRED:** não há `public/` nem assets oficiais.
- **BLOCKED — OWNER DECISION REQUIRED:** preço, dados empresariais,
  infraestrutura/compliance, conteúdo jurídico e destino definitivo do
  cadastro.
- **BLOCKED — FROZEN AREA:** os três CTAs literais `#comecar` em `Stage.tsx`
  e `StaticStory.tsx`, além dos contrastes abaixo de AA nas áreas aprovadas.

---

## 24. Alteração autorizada dos CTAs da cena (26/08/2026)

O proprietário autorizou exclusivamente a troca de destino dos três CTAs
funcionais da cena. Cada CTA também existe em `StaticStory.tsx`, a versão de
`prefers-reduced-motion`; por isso foram alterados seis atributos `href`, sem
mudança de elemento, classe, copy, layout, animação, beat, RITMO, câmera ou
coreografia.

| CTA funcional | arquivos | destino anterior | destino atual |
| --- | --- | --- | --- |
| Hero — `Começar agora` | `Stage.tsx` + `StaticStory.tsx` | `#comecar` | `/comecar` |
| Hero — `Ver como funciona` | `Stage.tsx` + `StaticStory.tsx` | `#comecar` | `/comecar` |
| Encerramento — `Criar minha primeira cobrança` | `Stage.tsx` + `StaticStory.tsx` | `#comecar` | `/comecar` |

### Verificações

- `npm run typecheck`: limpo.
- `npm run build`: compila; `/comecar` permanece uma rota estática.
- O servidor ativo respondeu `200` para `/comecar`.
- Busca nas duas fontes: nenhum `href="#comecar"` remanescente; os seis CTAs
  usam `/comecar`, portanto a alteração não criou âncora morta.
- A sonda `cap45.mjs` não chegou a executar porque uma nova instância do Chrome
  excedeu o limite de inicialização de 30 segundos. Console e regressão visual
  dos capítulos não receberam nova medição nesta sessão; não há falha do
  projeto registrada, apenas ausência de medição por limitação do ambiente.

`/comecar` ainda é uma página de espera honesta, não o cadastro definitivo.
O formulário, API, backend e evento `signup_complete` continuam bloqueados por
decisão do proprietário.

---

## 23. CTAs do hero e do capítulo 5 → /comecar (26/08/2026)

Correção **autorizada explicitamente** pelo proprietário: os CTAs que viviam
em arquivos congelados deixaram de apontar para `#comecar` — a âncora do
`<div>` decorativo dentro da maquete do capítulo 2 — e passaram a apontar
para `/comecar`.

**A alteração já estava no disco quando fui verificar.** Foi aplicada por
outra sessão entre 26/08 06:38 e 07:09, junto com o formulário de
`/comecar`. Não refiz nada; o que segue é a verificação do estado real.

| arquivo | `href` alterados |
|---|---|
| `components/Stage.tsx` | 3 (hero primário, hero secundário, CTA do capítulo 5) |
| `components/StaticStory.tsx` | 3 (os mesmos, na versão `prefers-reduced-motion`) |

Só o atributo `href` mudou. Copy, layout, beats, RITMO, câmera, coreografia e
estrutura da cena estão intactos — confirmado pelas sondas abaixo.

Os dois `id="comecar"` **continuam onde estavam** (o `<div>` do botão da
maquete em `Stage.tsx`, o `<dl>` do card em `StaticStory.tsx`). Viraram
âncoras órfãs: nada aponta mais para elas, e isso é inofensivo.

### Verificação

| item | resultado |
|---|---|
| `href="#comecar"` restantes | **0**, nas duas versões |
| links para `/comecar` na página | **7** (2 header, 3 cena, 1 preço, 1 fechamento) — os mesmos 7 em reduced motion |
| `/` e `/comecar` | **HTTP 200** |
| TypeScript · Build | limpos; 6 rotas estáticas |
| Console | **0 erros**, versão normal e reduced motion |
| `cta_start` no CTA da cena | dispara com `local=cena`, pelo reconhecimento por destino em `Analytics.tsx` |
| Capítulos 3, 4 e 5 | invariantes **todos cumpridos** |
| Automação | invariantes **todos cumpridos** |
| `prefers-reduced-motion` | documento de 10.878px, íntegro |

### Um efeito colateral que precisa de decisão

O CTA **secundário** do hero tem o rótulo **"Ver como funciona"** e agora
aponta para `/comecar`, ou seja, para o formulário de cadastro. Ele já
estava errado antes (apontava para a maquete), mas a troca em bloco tornou o
descasamento visível: o botão promete explicação e entrega formulário.

Duas consequências: o visitante que quer entender é empurrado para o
cadastro, e o evento registrado vira `cta_start` em vez de `cta_demo`.

O equivalente correto já existe em `ClosingCta.tsx`, que usa
`href="#como-funciona"` com `EVENTOS.ctaDemo`. A correção seria trocar o
`href` desse botão em `Stage.tsx:2190` e `StaticStory.tsx:28` para
`#como-funciona`. **Não foi feita: a autorização cobria apenas
`#comecar` → `/comecar`.**

---

## 24. CTA secundário do hero → #como-funciona (26/08/2026)

Correção **autorizada explicitamente**. O botão **"Ver como funciona"**
apontava para `/comecar`: prometia explicação e entregava formulário de
cadastro. Agora aponta para `#como-funciona` e é registrado como `cta_demo`.

| arquivo | alteração |
|---|---|
| `components/Stage.tsx:2190` | `href="/comecar"` → `href="#como-funciona"` |
| `components/StaticStory.tsx:28` | idem, na versão `prefers-reduced-motion` |
| `components/Analytics.tsx` | o listener delegado passou a reconhecer `#como-funciona` como `cta_demo`, e a **ignorar links dentro de `<nav>`** |

**Por que o evento não foi resolvido dentro do Stage.** Colocar
`data-evt={EVENTOS.ctaDemo}` no `<a>` exigiria um import novo em
`Stage.tsx`. O reconhecimento por destino em `Analytics.tsx` já era o padrão
usado para os CTAs congelados, mantém `EVENTOS` como fonte única e deixa os
arquivos congelados com **uma alteração de `href` e nada mais**.

**A guarda de `<nav>` não é detalhe.** Os itens "Como funciona" do header e do
rodapé também apontam para `#como-funciona`; sem ela, cada clique no menu
inflaria o `cta_demo`. Link dentro de `<nav>` é navegação, não CTA.

### O salto funciona mesmo com o Lenis

`lib/lenis.ts` documenta que o salto nativo de `href="#id"` "fica preso"
quando o Lenis intercepta a rolagem — por isso o header usa `irPara()`.
**Medido: não fica.** O clique leva a seção ao topo da viewport nas duas
versões.

| versão | scrollY | topo da seção | hash |
|---|---|---|---|
| normal | 0 → **22.728** | 0px | `#como-funciona` |
| reduced motion | 0 → **4.836** | 0px | `#como-funciona` |

O salto nativo não aplica o offset de 76px do header fixo, mas a seção tem
122px de padding no topo: o kicker sobra 46px abaixo do header. Não atrapalha.

### Verificação

| destino | resultado |
|---|---|
| "Começar agora" (hero) | `/comecar` · `cta_start:cena` |
| "Ver como funciona" (hero) | `#como-funciona` · **`cta_demo:cena`** |
| "Criar minha primeira cobrança" (cap. 5) | `/comecar` · `cta_start:cena` |
| "Como funciona" (menu do header) | navega · **nenhum evento**, como deve ser |
| "Ver como funciona" (fechamento) | `#como-funciona` · `cta_demo:fechamento` |
| "Começar agora" (preço) | `/comecar` · `cta_start:preco` |

TypeScript e build limpos, 6 rotas estáticas. Console **zero erros** nas duas
versões. Capítulos 3, 4 e 5 e Automação: invariantes **todos cumpridos**.

---

## 25. Finalização técnica de `/comecar` (26/08/2026)

### Ajustes concluídos

- O formulário local em `app/comecar/ComecarForm.tsx` valida nome, empresa,
  WhatsApp, e-mail e tipo de negócio sem transmitir dados.
- No envio inválido, o foco vai para o primeiro campo com erro; o resumo de
  erros usa `role="alert"` e `aria-live="assertive"`.
- O estado validado usa `role="status"`, `aria-live="polite"` e desloca o
  foco para o título de confirmação. Ele declara explicitamente que nenhum
  dado foi enviado.
- `signup_start` é enviado uma única vez no primeiro foco ou interação do
  formulário. `signup_complete` não é disparado.
- `ComecarTracking.tsx` foi removido após busca confirmar que já não havia
  importação ou referência legítima.

### Auditoria de destinos

| item | resultado |
| --- | --- |
| Hero — `Começar agora` | `/comecar` |
| Hero — `Ver como funciona` | `#como-funciona` |
| Capítulo 5 — `Criar minha primeira cobrança` | `/comecar` |
| Header e footer | links dentro de `<nav>` são ignorados pelo listener de CTA |
| `/` e `/comecar` | HTTP 200 |
| Âncora real da cena | `#como-funciona` existe em `HowItWorks.tsx` |

### QA desta sessão

- `npm run typecheck`: limpo.
- `npm run build`: compila; 6 rotas estáticas.
- `prefers-reduced-motion`: o CSS de `/comecar` neutraliza o movimento de
  hover do botão.
- Console, interação visual nos seis breakpoints e sondas de capítulos não
  receberam nova medição: o navegador integrado não teve permissão para
  acessar `localhost` e as sondas Puppeteer continuam sem conseguir iniciar
  outra sessão do Chrome. Não foi registrada falha do projeto; há apenas
  limitação do ambiente de teste.

### Pendências do proprietário

- Destino seguro dos dados do formulário (backend/API ou integração aprovada).
- Regra de negócio para considerar o cadastro concluído e, então, disparar
  `signup_complete`.
- Preço, dados empresariais, conteúdo jurídico, logo oficial e informações de
  infraestrutura, parceiros e compliance.

---

## 25. Reconciliação de estado — duas sessões no mesmo projeto (26/08/2026)

A partir daqui, **`ZELO_AUTONOMOUS_PLAN.md` é a fonte de verdade operacional**
e este documento é o registro do estado real. Claude Code e Codex trabalham no
mesmo diretório, então nenhum dos dois pode assumir que o que escreveu
continua lá.

### Protocolo adotado

1. **Antes de editar**, conferir a data de modificação do arquivo. Se ela for
   mais recente que a última leitura, **reler antes de alterar**.
2. **Não editar arquivo tocado há pouco pela outra sessão.** Registrar o
   problema aqui e deixar para quem está com ele na mão.
3. **Escrever neste documento só por acréscimo** — nunca reescrever seções
   anteriores. Duas sessões editando o mesmo trecho perdem trabalho.
4. **Nenhuma conclusão sem medição.** "Deve funcionar" não vale; roda a sonda.
5. Este é um protocolo por convenção, **não um lock**. Ele reduz colisão, não
   elimina.

### O que a outra sessão fez e eu verifiquei

| arquivo | quando | o quê |
|---|---|---|
| `Stage.tsx`, `StaticStory.tsx` | 26/08 ~07:00 | os 6 `href` de CTA para `/comecar` |
| `app/comecar/*` | 06:36 → 07:21 | formulário completo, substituindo a página de espera |
| `lib/analytics.ts` | 06:57 | só comentários |

**As três lacunas de acessibilidade do formulário que eu havia relatado foram
corrigidas pela outra sessão** e estão confirmadas por medição:

| verificação | 1440x900 | 390x844 |
|---|---|---|
| envio vazio → campos marcados `aria-invalid` | 5 | 5 |
| foco vai para o primeiro campo inválido | `nome` | `nome` |
| erro geral com `role="alert"` | sim | sim |
| envio válido → estado de sucesso | sim | sim |
| foco vai para o título do sucesso | `sucesso-titulo` | `sucesso-titulo` |
| overflow horizontal | 0px | 0px |
| console | 0 erros | 0 erros |

`signup_start` dispara **uma vez**, com `local=formulario-comecar`.
`signup_complete` **não dispara** — correto, não há cadastro concluído.

TypeScript e build revalidados no estado atual (o `ComecarForm.tsx` mudou às
07:21, depois do último build registrado): **limpos, 6 rotas estáticas**.

### Duas divergências entre documentação e código

1. **`lib/analytics.ts` descreve `signup_start` como "chegada à página
   /comecar".** Medido: na chegada não dispara nada; o evento sai na primeira
   interação com o formulário. O comportamento é melhor que o comentário —
   quem interage tem intenção real. **O comentário é que está errado.**
2. **`app/comecar/ComecarTracking.tsx` está órfão.** Nenhum arquivo o importa;
   quem dispara `signup_start` agora é o formulário. É código morto.

Não corrigi nenhuma das duas: os dois arquivos foram tocados pela outra sessão
minutos antes, e o protocolo acima manda não editar em cima.

### Pendências e bloqueios — estado consolidado

**BLOCKED — OWNER DECISION REQUIRED:** preço e modelo comercial · 2 respostas
do FAQ · e-mail, razão social e CNPJ · JSON-LD · conteúdo de /termos e
/privacidade · infraestrutura e compliance do Trust · destino real do cadastro.

**BLOCKED — OFFICIAL LOGO REQUIRED:** `public/` não existe. Trava header,
footer e imagem de Open Graph. O favicon está coberto por `app/icon.svg`.

**BLOCKED — FROZEN AREA:** 7 textos com contraste abaixo de 4,5:1, todos em
`--gray-500` (5 na cena, 1 no Problema, 1 no rótulo "Antes" da Automação).

**O risco maior não é técnico:** o formulário de `/comecar` coleta nome,
WhatsApp e e-mail e **não entrega esses dados a lugar nenhum**. O aviso acima
do botão declara isso, mas cada pessoa que preencher é um lead perdido.

---

## 26. Decisões comerciais aplicadas — pré-lançamento (26/08/2026)

O proprietário definiu preço, posicionamento e o fluxo de cadastro. Parte já
tinha sido aplicada pela outra sessão; o que segue é o estado verificado.

### O build estava quebrado no disco

`npm run build` saía com **exit 1**. Ao remover a última flag `pendente: true`
do FAQ, o TypeScript passou a inferir `PERGUNTAS` como `{ q, a }[]` e o
`p.pendente` do JSX deixou de compilar. **Corrigido** com um tipo explícito
`{ q: string; a: string; pendente?: boolean }[]`, que mantém de pé o mecanismo
de pendência para a próxima resposta que depender de decisão comercial.

Fica o registro: um relatório anterior dizia "build limpo", e o disco mudou
depois. **Rodar, não confiar.**

### O que mudou nesta etapa

| arquivo | mudança |
|---|---|
| `Faq.tsx` | tipo explícito de `PERGUNTAS` — desbloqueia o build |
| `Pricing.tsx` | `PRECO` ganhou campo `trial`; `unidade` virou "por mês depois do teste" |
| `Pricing.module.css` | selo `.trial`; `.obs` e `.inclusoTitulo` de `gray-500` para `gray-400` |
| `WhoItsFor.tsx` | lead de posicionamento |
| `Trust.tsx` | 4º fato "Pagamento seguro"; grade de 3 para 2 colunas |
| `Trust.module.css` | `.reservadoTitulo` de `gray-500` para `gray-400` |

**Por que o selo de teste grátis.** "14 dias grátis" estava dentro da
observação, em cinza pequeno, dividindo linha com a frase de posicionamento —
a maior alavanca de conversão da seção lida como nota de rodapé. Agora é um
selo verde acima do valor, e a sequência lê **14 dias grátis → R$ 29,90 → por
mês depois do teste**.

**Por que o Trust virou 2 colunas.** Quatro fatos numa grade de três deixariam
uma faixa vazia na segunda linha, porque as divisórias são o `gap` aparecendo
por trás. Em duas colunas viram 2x2 limpo.

**A frase de pagamento seguro descreve o mecanismo**, não uma alegação: "a
cobrança acontece pelo Pix Automático, dentro do sistema bancário: a
autorização fica no aplicativo do banco do seu cliente, não com a Zelo". Sem
citar Asaas, banco parceiro, certificação ou conformidade.

### Asaas — o que existe e o que não existe

Existe: `ASAAS_API_KEY` e `ASAAS_ENV` reservadas no `.env.example`, sem
prefixo `NEXT_PUBLIC_`, com instrução de não preencher até a integração
existir.

**Não existe: backend.** O projeto é estático, sem rota de API, sem servidor,
sem credenciais. Não criei endpoint nem cliente de API — seria encanamento
para lugar nenhum. A arquitetura "preparada" hoje são as variáveis de
ambiente e o ponto de integração marcado em `ComecarForm.tsx`.

### Verificação

| item | resultado |
|---|---|
| Typecheck · Build | limpos, **exit 0**, 6 rotas estáticas |
| Console | **0 erros** — `/` e `/comecar`, nas seis larguras |
| Overflow | **0px** em 1440/1280/1024/768/390/360, nas duas páginas |
| Preço na tela | selo "14 dias grátis" · "R$ 29,90" · "por mês depois do teste" · marcador `[DEFINIR PREÇO]` ausente |
| FAQ | **0 marcadores pendentes**; as duas respostas reais no ar |
| Trust | 4 fatos, incluindo "Pagamento seguro" |
| Posicionamento | lead presente em `#para-quem` |
| Contraste | `#preco`, `#confianca` e `#para-quem`: **0 textos abaixo de 4,5:1** |
| Links e âncoras | todas existem; nenhum destino vazio |
| CTAs | `cta_start` em preço, fechamento e header |
| `prefers-reduced-motion` | documento de 11.108px, íntegro |
| Capítulos 3, 4, 5 e Automação | invariantes **todos cumpridos** |
| FPS | 57,1 · 57,3 desktop e 57,8 mobile nas medições com p95 de 16,8ms — **em cima da linha de base**. Duas medições saíram com p95 de 49,9ms (regime diferente, travada de máquina), descartadas |

### Ainda depende do proprietário

CNPJ, razão social e e-mail empresarial · arquivos da logo (`public/` **não
existe**) · imagem de Open Graph · JSON-LD · conteúdo de /termos e
/privacidade · credenciais e backend do Asaas · **o destino real do envio do
formulário**.

---

## 27. Hero — silhueta e fundo (26/08/2026)

Duas correções aplicadas, uma decisão devolvida ao proprietário.

### A silhueta disputando a demonstração — corrigido

**Causa medida.** No `BEAT.copyOut` (beat 6) três coisas saem juntas com
durações diferentes: a copy em 7 beats, a demonstração em 7 e o `heroScape`
— a camada que **cobre a sala** — em **5**. Resultado: entre os beats 8 e 13
a sala reaparecia com os cards ainda na tela, e a silhueta ficava exatamente
atrás deles. Fotografado em y=600 (beat 8,3): cabeça e ombros sobre a
demonstração.

**Correção.** A silhueta nunca teve a opacidade animada por tween nenhum —
só respiração (`y`/`rotate`) e um `filter` no mobile a partir da assinatura.
Então bastou: `gsap.set(figure, { opacity: 0 })` e um tween de entrada em
`BEAT.copyOut + 7` (beat 13), com 3 beats de duração.

**Nenhum beat, duração, posição, escala ou câmera mudou.** A silhueta segue
existindo e se comportando igual dos capítulos 1 a 5 — ela só não divide mais
a tela com a demonstração. Medido nos seis breakpoints: opacidade **0** ao
fim do hero em 1440, 1280, 1024, 768, 390 e 360.

| beat | y (desktop) | silhueta | demo | scape |
|---|---|---|---|---|
| 0 | 0 | 0 | 1 | 1 |
| 6 | 432 | 0 | 1 | 1 |
| 8,3 | 600 | **0** | 0,96 | 0,59 |
| 11,1 | 800 | **0** | 0,61 | 0 |
| 13,9 | 1000 | 0,65 | **0** | 0 |
| 16,7 | 1200 | 1 | 0 | 0 |

### O fundo — menos elementos

`.heroPlane` (A e B) e `.heroFore` (duas arestas) eram chapas angulares
acinzentadas (`rgba(21,25,35,.9)`, `rgba(167,172,186,.06)`,
`rgba(196,208,236,.055)`) atravessando o quadro — a poluição que competia com
a demonstração. Desligadas por `display: none`, com o DOM preservado: religar
é apagar duas linhas e `Stage.tsx` não precisa ser tocado.

Some junto o custo de **quatro animações CSS infinitas** (`heroPlaneDrift`
34s/46s e `heroForeDrift` 58s/72s).

A profundidade agora vem só de: base (preto/azul `#080a0f → #151923`),
arquitetura de linhas convergindo para a demonstração, e a aura violeta.
Preto premium, violeta discreto, poucos elementos — a direção pedida.

### A distância de scroll — NÃO alterada, e por quê

**Onde ela é determinada:** `lib/scene.ts` → `PX_POR_BEAT = { desktop: 72,
mobile: 52 }` e `SCROLL_LENGTH = PX_POR_BEAT × BEAT.end` (`BEAT.end = 286`).

**O hero em si não é longo.** Ele ocupa os beats 0→6 = **432px no desktop**,
312px no mobile — menos de meia tela. Reduzir "o hero" não resolve nada.

O que custa 23 telas é o **trecho pinado inteiro**: 286 × 72 = **20.592px**.
Encurtá-lo só tem um lever sem tocar em BEAT nem RITMO: **baixar
`PX_POR_BEAT`** — e isso acelera **todos** os capítulos aprovados na mesma
proporção. A seção 5 registra que o proprietário **vetou** exatamente isso.

Não decidi sozinho. Ver o relatório para as opções com números.

**Uma observação que importa para a sensação de "não responde":** durante os
432px do hero a copy não se move e a demonstração roda num **loop próprio de
~9s, independente do scroll** (seção 16). O visitante rola e nada reage —
"uma rolagem → a demonstração acontece" é impossível hoje por construção.

### Verificação

| item | resultado |
|---|---|
| Typecheck · Build | limpos, exit 0 |
| Console | **0 erros** em 1440/1280/1024/768/390/360 |
| Overflow | **0px** nos seis breakpoints |
| Silhueta no fim do hero | **0** nos seis breakpoints |
| `prefers-reduced-motion` | 11.108px, íntegro (usa `StaticStory`, não afetado) |
| Capítulos 3, 4, 5 e Automação | invariantes **todos cumpridos** |
| FPS desktop | 57,2 · 57,2 (p95 16,8ms) |
| FPS mobile | 57,5 · 57,8 (p95 16,8ms) |

---

## 28. O Hero passou a responder ao scroll (26/08/2026)

### Como era

A demonstração vivia num `gsap.timeline({ repeat: -1, repeatDelay: 1.4 })` —
**~9,3s rodando à revelia do scroll**. O visitante rolava os 432px do hero e
a apresentação não reagia: ela estava no seu próprio relógio.

O ciclo controlava a narrativa inteira: `criada → autorizada`, o pulso do
cliente até a Zelo, o núcleo acendendo (marca, anel, campo), a reação do
ambiente (aura funda, condutos, sparks), o pulso da Zelo até o profissional,
`proc → pago`, o ponto verde e `saldoRest → saldoPago`. E terminava
desfazendo tudo, para poder recomeçar.

### Como ficou

**Uma mudança de parâmetro e um tween.** O roteiro do ciclo não teve **uma
linha alterada**: ele só deixou de rodar sozinho.

```
gsap.timeline({ repeat: -1, repeatDelay: 1.4 })  →  gsap.timeline({ paused: true })
```

e, dentro da timeline mestre que já existia:

```
tl.to(heroCycle, { progress: FIM_DA_DEMO, duration: BEAT.copyOut }, 0)
```

O alvo do tween é o **playhead do próprio ciclo**. Não há ScrollTrigger novo:
quem empurra é a mestre, que já é dirigida pelo scroll. `PX_POR_BEAT`, `BEAT`,
`RITMO` e os capítulos 1–5 não foram tocados.

**Para em 5,9s de um roteiro de 7,9s de propósito.** O trecho 7,0→7,9 só
existia para desfazer tudo e reiniciar o loop; mantido, ele apagaria o
resultado exatamente quando o visitante chega ao fim do hero. **O hero termina
no PAGO.**

### O que continua contínuo, e por quê

Ficaram no array `idles`, independentes do scroll, porque são **ambiente** e
não narrativa — sem eles o hero parado vira uma captura de tela:

- a respiração da aura interna (`heroAuraIn`, 8s, yoyo);
- o balanço dos nós e do núcleo (`heroNodes` + `heroCore`, 5,5–8,5s);
- a névoa da cena.

As reações do ambiente que pertencem ao *momento* em que a Zelo processa —
aura funda, condutos, sparks — continuam dentro do ciclo, e portanto agora
respondem ao scroll junto com a narrativa. É o correto: elas são consequência
da ação, não respiração.

### A sequência medida (desktop, 432px)

| y | beat | estado |
|---|---|---|
| 0 | 0,0 | criada · **imóvel: idêntico após 4s parado** |
| 110 | 1,5 | criada 0,16 → autorizada 0,84 |
| 180 | 2,5 | autorizada · o pulso sai do cliente |
| 250 | 3,5 | o pulso atravessa até a Zelo |
| 320 | 4,4 | o valor sai da Zelo rumo ao profissional |
| 432 | 6,0 | **PAGO · + R$ 350,00** |

### Verificação

| item | resultado |
|---|---|
| Typecheck · Build | limpos, exit 0 |
| Hero completo | **432px** desktop · **312px** mobile — uma rolagem |
| Estado final nos 5 breakpoints | 1440, 1280, 768, 390, 360: `pago` 1 e `saldoPago` 1 |
| Console | **0 erros** nos cinco |
| Overflow | **0px** nos cinco |
| Sem scroll, a demo não anda | confirmado por leitura em dois instantes |
| `prefers-reduced-motion` | 11.108px, íntegro (`StaticStory` não usa este código) |
| Capítulos 3, 4, 5 e Automação | invariantes **todos cumpridos** |
| Reversibilidade | `reverso.mjs`: a história volta idêntica |
| FPS desktop | 56,8 · 56,8 · 56,6 (p95 16,8ms) |
| FPS mobile | 57,7 · 58,1 (p95 16,8ms) |

### Limitação conhecida

Os 432px comportam seis momentos narrativos — **~72px por momento**. É rápido
por construção: alongar exigiria mexer em `BEAT.copyOut`, que está vetado.
Quem rola devagar acompanha bem; quem dá um flick de trackpad atravessa a
demonstração inteira de uma vez e vê só o estado final. Se isso incomodar, o
caminho é `BEAT.copyOut` de 6 para ~10 — e aí os capítulos deslocam.

---

## 29. Motion design das seções comerciais (26/08/2026)

O Hero está **aprovado e congelado**. Nada em `Stage.tsx`, `Stage.module.css`
ou `lib/scene.ts` foi tocado nesta etapa.

**Nenhum ScrollTrigger novo. A página continua com 5** — os mesmos de sempre:
o pin do Stage, um interno dele, Problema, Como funciona e Automação. Tudo o
que segue é IntersectionObserver e CSS.

### O sistema, evoluído em vez de duplicado

`useRevealEach` passou a aceitar um objeto de opções — `y`, `x`, `scale`,
`duration`, `stagger` — mantendo compatibilidade com a forma antiga
(`useRevealEach(0)` no FAQ). Duas capacidades novas:

1. **Ordem de leitura por atributo.** `data-reveal-each="3"` define a posição
   na cascata quando ela não é a do DOM. É o que resolve o Preço, onde o CTA
   vem antes da lista no markup mas precisa entrar por último.
2. **`data-revelado="true"`** é posto no item ao fim da entrada. É o gancho
   para um destaque de uma vez só em CSS — sem loop, sem timer.

O `x` é **cortado pela metade abaixo de 760px**: deslocamento lateral em tela
estreita lê como tremor, não como intenção.

### Uma narrativa por seção, não fade em tudo

| seção | sensação | como |
|---|---|---|
| **Benefícios** | organização | células assentam na grade: sobem 18px e crescem de 0,97 → 1, stagger 0,08 |
| **Para quem é** | identificação | perfis chegam de lados **alternados** (±14px), sem escala — varredura de reconhecimento, não fileira |
| **Preço** | clareza | ordem forçada: selo → valor → unidade → observação → o que está incluso → **CTA por último**. Escala 0,96 igual para todos; o destaque vai para o valor porque é o maior elemento |
| **Confiança** | segurança | **sem escala e sem quique**: sobem 12px, devagar (0,9s) e em intervalo largo. O que transmite solidez é a ausência de elasticidade |
| **FAQ** | interação | a resposta sobe 6px e ganha opacidade **enquanto** a linha abre, com 0,08s de atraso. Só transform e opacity; o painel continua abrindo por `grid-template-rows` |
| **CTA final** | ação | monta de cima para baixo com stagger largo (0,13) e o botão chega por último, seguido de um anel violeta que abre e fecha **uma vez** |

O anel do CTA é `animation: … 1 both` disparado por `[data-revelado="true"]`:
não roda no carregamento, não fica em loop, e é desligado em reduced motion.

### Verificação

| item | resultado |
|---|---|
| ScrollTriggers | **5 antes · 5 depois** |
| Itens revelados | 45 em 6 seções (6 · 14 · 10 · 4 · 6 · 5) |
| Presos invisíveis após percorrer a página | **0** — nos seis breakpoints |
| Typecheck · Build | limpos, exit 0 |
| Console | **0 erros** em 1440/1280/1024/768/390/360 |
| Overflow | **0px** nos seis |
| FAQ | abre (`0px` → `71,25px`), resposta em opacidade 1, fecha, `aria-expanded` e `aria-controls` intactos |
| Reduced motion | 73 alvos, **0 invisíveis**, **0 com transform**, FAQ abre, CTA funcional, animação do anel `none` |
| Hero (regressão) | y=0 `criada` · y=432 **`pago` + saldo**, silhueta em 0 nos dois |
| Capítulos 3, 4, 5 e Automação | invariantes **todos cumpridos** |
| FPS desktop | 57,3 · 57,0 (p95 16,8ms) — antes 56,8 · 56,6 |
| FPS mobile | 57,8 · 57,9 (p95 16,8ms) — antes 57,7 · 58,1 |

Sem regressão de performance: o p95 continua em 16,8ms e as médias ficam
dentro do ruído das medições anteriores. O motivo é arquitetural — nenhuma
destas animações roda por quadro; elas disparam uma vez e se desligam.

---

## 30. /comecar — o fluxo de pré-cadastro (26/08/2026)

Pagamento **não** foi integrado. `lib/asaas/config.ts` continua existindo, sem
ser importado por ninguém — é a semente da etapa separada, e não foi tocado.

### O problema que isto resolve

As regras de validação viviam **dentro do componente cliente**. Quando o
backend existir ele vai precisar revalidar tudo — validação de cliente nunca
é garantia, qualquer um faz um POST direto — e teria que reescrever as mesmas
regras num segundo lugar, que divergiria do primeiro na primeira mudança.

### `lib/lead.ts` — a definição única

Não importa React nem nada do DOM, de propósito: roda igual no cliente e no
servidor.

| exporta | para quê |
|---|---|
| `Lead`, `CampoLead`, `ErrosLead` | o formato |
| `ROTULOS` | os rótulos num lugar só |
| `normalizarLead` | espaço sobrando e caixa do e-mail são erro de digitação, não do visitante. WhatsApp guarda **só dígitos** |
| `validarLead` | regras frouxas de propósito: impedem engano óbvio, não provam que o dado é verdadeiro — só a confirmação real prova, e ela não existe |
| `primeiroCampoInvalido` | ordem de leitura, para o foco ir ao primeiro |
| `registrarLead` | **o ponto de registro** |
| `ResultadoLead` | `registrado` · `nao-configurado` · `erro` |

### Três campos, não cinco

`Nome`, `WhatsApp`, `E-mail`. Saíram "Nome da empresa" e "Tipo de negócio":
cada campo a mais é um dado pessoal a proteger e um motivo a mais para
desistir. **Se esses dois fizerem falta na qualificação do lead, é uma
decisão comercial** — voltam em duas linhas.

### BLOCKED — DESTINO DO LEAD NÃO DEFINIDO

`registrarLead` **não faz nenhuma chamada de rede** e retorna
`nao-configurado`. Deliberado: não há endpoint, banco, CRM nem caixa de
e-mail confirmados. Escrever um envio para um destino imaginário criaria um
caminho que nunca foi exercitado — pior que não ter.

O que já está resolvido para quem for implementar: o formato do que sai, a
validação reaproveitável no servidor, a interface tratando os três
resultados, e `signup_complete` disparando **apenas** quando o retorno for
`registrado`. **Trocar o corpo daquela função é suficiente** — nada no
componente precisa mudar.

O caminho provável é `app/api/lead/route.ts`, que receberia, revalidaria com
`validarLead` e persistiria. Não foi criada porque não há onde persistir.

### Verificação

| cenário | 1440 | 390 | 360 |
|---|---|---|---|
| campos no formulário | `nome, whatsapp, email` | idem | idem |
| envio vazio | 3 inválidos · foco em `nome` · alerta visível | idem | idem |
| dados inválidos | 3 inválidos · foco no primeiro · mensagem certa | idem | idem |
| envio válido | sucesso · foco em `sucesso-titulo` | idem | idem |
| eventos | `signup_start` **uma vez** | idem | idem |
| `signup_complete` | **não dispara** | idem | idem |
| console · overflow | 0 · 0px | 0 · 0px | 0 · 0px |

O envio válido usou `"  Ana   Souza "` e `"  Ana@Exemplo.COM "` — passou, o
que prova que a normalização roda antes da validação.

Reduced motion: nenhum elemento invisível no formulário, as três `label`
ligadas aos campos, envio funcional, animação do sucesso `none`.

Typecheck e build limpos, exit 0.

---

## 31. Persistência dos leads — estrutura pronta, banco BLOCKED (26/08/2026)

### Não existe projeto Supabase da Zelo

Conferido na conta do proprietário: **NexusERP** (inativo), **Akira** (ativo)
e **nosia-cube-ai** (inativo). Nenhum é da Zelo.

Não criei projeto: provisionar infraestrutura na conta de alguém é decisão do
dono, não do agente. E não reaproveitei o banco do Akira — misturar dados de
produtos diferentes é problema garantido depois.

Então foi executado o ramo previsto: **estrutura segura completa, conexão
bloqueada**.

### Arquitetura

```
ComecarForm (cliente)
  └─ validarLead ................... rápido, para o visitante
  └─ registrarLead → POST /api/lead ... só um caminho relativo
        │
        ▼
  app/api/lead/route.ts (servidor)
        └─ normalizarLead + validarLead ... DE NOVO, com as mesmas regras
        └─ supabaseConfigurado()? .......... não → 503
        └─ inserirLead → PostgREST via fetch
              └─ 201 registrado · 502 falha
```

**Nenhuma dependência instalada.** `@supabase/supabase-js` não entrou porque
a API REST do Supabase é HTTP e o `fetch` do Next resolve um INSERT sem o
peso do pacote.

**A validação roda duas vezes, com o mesmo código.** A do navegador é
conveniência; a que vale é a do servidor. Qualquer um manda um POST direto —
testado abaixo.

### Segredo nenhum no cliente

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` **não** têm o prefixo
`NEXT_PUBLIC_`. Sem ele o Next não injeta nada no bundle do navegador. O
`lib/supabase.ts` ainda tem um `throw` se for importado no cliente — cinto de
segurança, não a proteção principal.

Verificado no bundle compilado: **zero ocorrências** de `supabase`,
`service_role` ou `.supabase.co` em `.next/static/`.

### O schema fica em `docs/supabase-leads.sql`

Documentação executável — **não foi rodada contra banco nenhum**. Dois
detalhes que importam:

- **índice único em `lower(email)`**, que faz o `resolution=merge-duplicates`
  funcionar: a mesma pessoa reenviando **atualiza** em vez de duplicar;
- **RLS ligado e nenhuma policy**: a chave `anon` não lê nem escreve nada.
  Quem grava é a rota, com a `service_role`, que ignora RLS.

### Testes do endpoint

| requisição | resposta |
|---|---|
| POST válido, sem credenciais | **503** `{"estado":"nao-configurado"}` |
| POST inválido | **422** com erro por campo |
| JSON quebrado | **400** |
| GET | **405** |
| POST com `senha`, `admin`, `cpf` | **503** — campos extras **descartados**, nunca considerados |

### Fluxo pelo navegador (1440 e 390)

`POST /api/lead` sai · sucesso honesto ("Dados prontos para o próximo
passo") · foco em `sucesso-titulo` · `signup_start` **uma vez** ·
`signup_complete` **não dispara** · overflow 0px.

**Sobre o console:** aparece 1 entrada — `Failed to load resource: 503`. É o
log de rede do navegador, **não um erro de JavaScript**: zero erros antes e
depois, e o `fetch` é tratado. Some quando o banco existir (201 no lugar de
503). Manter 503 é o certo: é o status honesto para "o destino não está
ligado".

O aviso do formulário muda sozinho: **o servidor** informa ao componente se
há destino (`supabaseConfigurado()` como prop). Sem isso, a frase "nada é
enviado" viraria mentira no dia em que o banco fosse ligado.

Reduced motion em /comecar: 0 invisíveis, envio funcional, foco correto.
Capítulos 3, 4, 5 e Automação: invariantes todos cumpridos. Typecheck e
build limpos; `/api/lead` compila como rota dinâmica.

### BLOCKED — CREDENCIAIS DO SUPABASE

Para ligar, na ordem:

1. criar um projeto Supabase para a Zelo (região `sa-east-1`);
2. rodar `docs/supabase-leads.sql` no SQL Editor;
3. copiar de Project Settings > API para o `.env.local`:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = chave **service_role** (nunca a `anon`);
4. reiniciar o dev server.

Nada mais precisa mudar no código. **O caminho do INSERT nunca foi
exercitado contra um banco real** — é o único trecho sem teste, e só dá para
testar com credenciais.

---

## 32. Supabase — banco criado e validado, falta uma chave (26/08/2026)

### O projeto existe agora

**Zelo** — ref `krwzohklsqdysdrfkjcd`, região `us-east-1`, ACTIVE_HEALTHY,
criado em 26/08/2026 09:21. Estava **vazio**: o SQL nunca tinha sido rodado.

### O schema foi aplicado

Migração `cria_tabela_leads`, com o conteúdo exato de
`docs/supabase-leads.sql` — nenhuma estrutura inventada. Conferido:

| item | estado |
|---|---|
| colunas | `id, nome, whatsapp, email, origem, criado_em, atualizado_em` — batem |
| RLS | **ligado** |
| policies | **0** — proposital: só a `service_role` grava |
| índice `leads_email_unico` | existe, em `lower(email)` |
| trigger `leads_atualizado_em` | existe e dispara |

### Um aviso de segurança real, corrigido

O linter acusou **`function_search_path_mutable`** (WARN) na função do
trigger que eu tinha escrito. Uma função com `search_path` mutável pode ser
sequestrada por quem consiga criar objetos num schema que venha antes na
busca. Migração `fixa_search_path_da_funcao_leads`: `security invoker` e
`set search_path = ''`. **O WARN sumiu** e o trigger continua funcionando
(testado com um UPDATE depois da mudança).

Sobrou só `rls_enabled_no_policy`, nível **INFO** — que é exatamente o
desenho pretendido: RLS ligado sem policy nenhuma significa que a chave
`anon` não lê nem escreve nada.

`docs/supabase-leads.sql` foi sincronizado com o que está no banco.

### Gravação e duplicidade — testados no banco

```
1º envio  → 1 linha criada, criado_em = atualizado_em
2º envio, mesmo e-mail em CAIXA ALTA, nome e whatsapp diferentes
          → continua 1 linha · nome e whatsapp atualizados
          → atualizado_em > criado_em
```

A duplicidade funciona **e é insensível a caixa**, porque o índice é em
`lower(email)`. Ficou uma linha de teste na tabela:
`teste-zelo@example.com`. Para remover quando quiser:

```sql
delete from public.leads where email = 'teste-zelo@example.com';
```

### BLOCKED — falta a SUPABASE_SERVICE_ROLE_KEY

`.env.local` foi criado com `SUPABASE_URL` preenchida e
`SUPABASE_SERVICE_ROLE_KEY` **vazia, de propósito**: não manuseio chave
secreta, e essa chave dá acesso total ao banco.

Painel do Supabase > projeto Zelo > Project Settings > API Keys >
**service_role** (atrás de "Reveal"). Colar no `.env.local` e reiniciar o
dev server. **É a única coisa que falta.**

Enquanto ela estiver vazia, `supabaseConfigurado()` é falso, `/api/lead`
responde 503 e o formulário avisa honestamente que nada foi enviado.

### Estado dos testes

| teste | resultado |
|---|---|
| POST válido | **503** `nao-configurado` (correto sem a chave) |
| POST inválido | **422** com erro por campo |
| GET | **405** |
| formulário em /comecar | envia `POST /api/lead`, sucesso, foco em `sucesso-titulo` |
| `signup_start` | **uma vez** — após 1 campo, após 3 campos e após o envio, sempre 1 |
| `signup_complete` | **não implementado**, conforme a regra |
| erros de JavaScript | **0** |
| Typecheck · Build | limpos, exit 0 |

**O elo ainda não exercitado** é o HTTP entre a rota e o Supabase. O banco
foi validado por SQL direto; a rota foi validada até o 503. Só a chave fecha
esse último trecho.

---

## 33. Supabase LIGADO — cadastro gravando de verdade (26/08/2026)

A `SUPABASE_SERVICE_ROLE_KEY` foi colada no `.env.local` pelo proprietário.
Servidor reiniciado. **O cadastro grava no banco.**

### Dois defeitos reais, encontrados só porque o teste foi de verdade

Ambos estavam no código que eu tinha escrito e que "parecia certo".

**1. O upsert não funcionava — índice de expressão.**
`docs/supabase-leads.sql` criava `unique index ... on leads (lower(email))`.
O PostgREST **só infere o `ON CONFLICT` a partir de uma CONSTRAINT unique
sobre coluna(s)** — índice sobre expressão não serve. O reenvio virava
`409 / 23505`.
Correção (migração `unique_em_email_para_upsert`): `constraint unique
(email)` mais `check (email = lower(email))`. O CHECK é o que mantém a
unicidade insensível a caixa, transformando a garantia da aplicação
(`normalizarLead`) em garantia do banco.

**2. Faltava `?on_conflict=email` na URL.**
Mesmo com a constraint certa, continuava 409. Isolado por teste controlado
direto no PostgREST, variando um fator por vez:

| requisição | resultado |
|---|---|
| `Prefer: return=minimal,resolution=merge-duplicates` | **409** |
| idem, com espaço depois da vírgula | **409** |
| **`?on_conflict=email` na URL** | **200** |

`Prefer: resolution=merge-duplicates` sozinho não diz *qual* constraint
usar. Uma linha em `lib/supabase.ts`.

### Testes com o banco ligado

| teste | resultado |
|---|---|
| POST e-mail novo | **201** `registrado` |
| POST mesmo e-mail, CAIXA ALTA, dados diferentes | **201** — atualizou |
| POST terceiro envio | **201** — continua 1 linha |
| conferência no banco | 3 e-mails → **3 linhas**, com os dados do ÚLTIMO envio |
| POST inválido | **422** com erro por campo |
| GET | **405** |
| formulário 1440 e 390 | **201** · "Cadastro recebido." · foco em `sucesso-titulo` · **0 erros de JS** |
| aviso do formulário | trocou sozinho para a versão de banco ligado |

Os leads de teste (todos `@example.com`) foram apagados. **A tabela está
vazia**, pronta para o primeiro lead real.

### Atenção: `signup_complete` agora dispara

A regra do projeto sempre foi "dispara quando `registrarLead` retornar
`registrado`". Com o banco ligado essa condição passou a acontecer, então o
evento **está saindo** — confirmado nos dois breakpoints.

**Isso precisa de decisão.** Hoje `signup_complete` significa *"lead
gravado"*, não *"conta criada e teste de 14 dias iniciado"*. Pelo funil
definido na seção 1 (LP → cadastro → criação da conta → 14 dias), o nome
promete mais do que acontece. Duas saídas:

- manter, aceitando que o evento marca captura de lead; ou
- mover o disparo para quando a conta existir de fato — e aí a captura de
  lead vira um evento próprio.

Enquanto não for decidido, o número de `signup_complete` no GA4 vai contar
leads, não assinantes.

---

## 34. Semântica do funil corrigida — lead_captured (26/08/2026)

Capturar um lead **não é** concluir um cadastro. O funil passou a ter três
marcos distintos:

| evento | significa | dispara hoje? |
|---|---|---|
| `signup_start` | o visitante começou a preencher | **sim**, uma vez por sessão |
| `lead_captured` | o lead foi **gravado no Supabase** | **sim**, só com 201 |
| `signup_complete` | a conta existe e os 14 dias começaram | **não** — só declarado |

**Por que isso importa e não é preciosismo:** com `signup_complete` contando
lead, todo número de conversão do GA4 ficaria inflado, e a decisão de quanto
investir em tráfego sairia de uma métrica falsa. É o tipo de erro que só
aparece quando o dinheiro já foi gasto.

### Alteração

Mínima, três arquivos:

- `lib/analytics.ts` — entrou `leadCaptured: "lead_captured"`; o comentário
  de `signupComplete` passou a dizer explicitamente para **não** disparar
  antes da criação da conta;
- `app/comecar/ComecarForm.tsx` — uma linha: `EVENTOS.signupComplete` virou
  `EVENTOS.leadCaptured`;
- `PROJECT_STATUS.md`.

`lib/lead.ts` não precisou de mudança — o comentário que citava a regra
antiga já tinha saído na reescrita de `registrarLead`.

### Testes, nos dois breakpoints

| momento | eventos acumulados |
|---|---|
| após o 1º campo | `signup_start` |
| após os 3 campos | `signup_start` |
| **após envio INVÁLIDO** | `signup_start` — **nada mais** |
| após envio VÁLIDO (201) | `signup_start`, `lead_captured` |

`signup_start` = **1** · `lead_captured` = **1** · `signup_complete` = **0**.

O envio inválido é a prova que importa: `lead_captured` não sai quando não
há gravação.

Leads gravados e conferidos no banco; os de teste (`@example.com`) foram
apagados — a tabela está vazia.

### Sem regressão

`cta_start` (preço, fechamento, cena) e `cta_demo` (cena) continuam
disparando; 0 erros de JS na página inicial; capítulos 4 e 5 e Automação com
invariantes cumpridos. Typecheck e build limpos.

### Quando ligar o `signup_complete`

Quando existir criação de conta: disparar no ponto em que a conta foi criada
**e** o teste de 14 dias começou — nunca antes. O evento já está declarado e
comentado com essa regra.

---

## 35. FASE 0 e 1 — fundação do sistema (26/08/2026)

Início da construção do produto. A landing page **não foi tocada**.

Arquitetura completa em **`ZELO_SYSTEM_ARCHITECTURE.md`**.

### Decisões tomadas (eram técnicas, não comerciais)

| decisão | escolha | porquê |
|---|---|---|
| tenant | **empresa desde o dia 1** | "atender empresas maiores" exige mais de um usuário por conta. Modelar depois, com dados dentro, é a migração mais cara que existe |
| autenticação | **e-mail + senha** | quem usa toda semana não quer abrir o e-mail toda vez |
| onde o app mora | **mesmo Next, route groups** | um deploy, uma sessão, sem CORS |
| dinheiro | **integer em centavos** | float acumula erro e o total para de bater com o extrato |
| `vencida` | **consulta, não status** | status exigiria cron; cron parado vira dado errado silencioso |

### Banco (4 migrações)

`fase1_empresas_membros_rls` · `remove_empresa_sem_membros`

- **`empresas`** — tenant e assinante: `trial_termina_em`, `assinatura_status`
  (`trial`/`ativa`/`inadimplente`/`cancelada`), campos do Asaas reservados.
- **`membros`** — `(empresa_id, user_id)`, papel `dono`/`membro`.
- Trigger em `auth.users`: a empresa nasce **na mesma transação** do usuário.
  O cliente não participa, logo não pode pular a etapa nem escolher empresa.
- `eh_membro()` e `empresa_liberada()` — `SECURITY DEFINER`, `search_path=''`.
- RLS ligado. **Sem policy de INSERT em `empresas`**: empresa só nasce pelo
  trigger.

### Dependências (3, todas necessárias)

`@supabase/supabase-js` e `@supabase/ssr` — sessão com cookie e refresh de
token é criptografia e protocolo; escrever à mão é onde bug vira vazamento.
`puppeteer-core` como **devDependency** — ver problemas abaixo.

### Arquivos

**Novos:** `lib/supabase/{browser,server,admin}.ts` · `lib/conta.ts` ·
`lib/empresa.ts` · `lib/dinheiro.ts` · `proxy.ts` · `app/(auth)/*` (layout,
CSS, campo, 4 páginas, 3 formulários) · `app/auth/{callback,sair}/route.ts` ·
`app/(app)/App.module.css` · `app/(app)/app/*` (layout, nav, sair, dashboard,
assinatura, 2 stubs) · `ZELO_SYSTEM_ARCHITECTURE.md`

**Alterados:** `lib/analytics.ts` (+`account_created`, +`trial_started`) ·
`app/api/lead/route.ts` e `app/comecar/page.tsx` (import do admin) ·
`.env.local` e `.env.example` (chaves públicas)

`lib/supabase.ts` virou **`lib/supabase/admin.ts`** — nome que diz o que é.
É a chave que ignora RLS; se vazar para o código do app, o isolamento entre
empresas cai inteiro **sem erro nenhum aparecer**.

### Três problemas encontrados e corrigidos

1. **Empresa órfã.** Apagar o usuário fazia cascade em `membros` mas deixava
   a `empresa` sem ninguém — inalcançável e permanente. Trigger
   `ao_remover_membro` resolve. Também importa para exclusão a pedido do
   titular. Verificado: 0 → 1 → 0.
2. **`npm install` podou o `puppeteer-core`.** Ele nunca esteve no
   `package.json` e sumiu com o dedupe, quebrando **todas as sondas**. Agora
   é devDependency declarada.
3. **`middleware.ts` está depreciado no Next 16.** Virou `proxy.ts`. Build
   sem avisos.

### Testes

**Isolamento entre empresas** (dois usuários, chave publicável, o que o
navegador usa):

| tentativa | resultado |
|---|---|
| A lista empresas | vê **só a dele** |
| A lê a empresa de B por id | **bloqueado** |
| A lista `membros` | **só os vínculos dele** |
| A altera a empresa de B | **bloqueado** |
| A cria empresa sozinho | **bloqueado** |
| anônimo em `empresas` / `leads` | **bloqueado** nas duas |

**Fluxo pela interface:**

| passo | resultado |
|---|---|
| `/app/clientes` sem sessão | → `/entrar?de=%2Fapp%2Fclientes` |
| cadastro vazio | 3 campos inválidos, foco no primeiro, `role=alert` |
| senha curta | "pelo menos 8 caracteres" |
| senha errada | "E-mail ou senha incorretos" (não revela se o e-mail existe) |
| login | **volta ao destino original**, não ao `/app` genérico |
| dashboard | faixa "Teste grátis: 14 dias restantes", nav, nome da empresa |
| `/entrar` já logado | → `/app` |
| sair | → `/entrar`; `/app` volta a bloquear |
| erros de JS | **0** |

Rotas: 17. Typecheck e build limpos, exit 0. `GET /auth/sair` → **405**
(logout por GET permitiria derrubar a sessão com um `<img>` de outro site).

### BLOCKED — SMTP para e-mails de autenticação

A confirmação de e-mail está **ligada** no projeto, e o SMTP padrão do
Supabase estourou o limite durante o teste (2–3 e-mails/hora no plano free).

**Isto bloqueia o cadastro real em produção, não só o teste.** Com o limite
estourado, quem tentar criar conta vê "muitas tentativas" e não recebe nada.

Duas saídas, e a escolha é do proprietário:
1. **configurar SMTP próprio** (Resend, SendGrid, Amazon SES) no painel —
   caminho correto para lançar;
2. **desligar a confirmação de e-mail** — remove o atrito, mas abre a porta
   para conta com e-mail falso consumindo trial.

Recomendo (1). Enquanto isso, testes usam usuário criado pela API de admin,
que dispensa envio.

Descoberta relacionada: **o Supabase recusa `@example.com`** (domínio
reservado por RFC). A mensagem genérica não dizia isso — agora diz "use um
endereço de e-mail real".

### Próxima fase

Clientes (CRUD + RLS), depois Cobranças.

---

## 36. FASE 2 — Clientes (26/08/2026)

Módulo completo: listar, criar, ver, editar, arquivar, reativar, excluir,
buscar, filtrar e paginar.

### Banco — migração `fase2_clientes`

`clientes` com `empresa_id`, `nome`, `email`, `whatsapp`, `documento`,
`observacoes`, `status` (`ativo`/`arquivado`), `criado_em`, `atualizado_em`.

Três detalhes que não são decoração:

- **Índice único PARCIAL** em `(empresa_id, email) where email is not null`.
  Um unique comum trata NULLs de forma que impediria o **segundo** cliente
  sem e-mail — e cliente sem e-mail é o caso comum do público-alvo.
- **CHECK `email = lower(email)`** transforma a normalização da aplicação em
  garantia do banco. É o que faz o índice ser de fato insensível a caixa.
- **A policy de INSERT exige `empresa_liberada()`**. A regra dos 14 dias
  passa a valer **no banco**: trial vencido não cria cliente nem por
  chamada direta à API. Ler continua liberado — quem perde acesso aos
  próprios dados não volta.

### Decisões

**Só o nome é obrigatório.** Exigir e-mail e documento travaria o cadastro
de quem só tem o telefone do cliente na agenda — exatamente o público. O
Asaas vai exigir documento na hora de gerar cobrança; a exigência entra lá.

**Não validamos dígito verificador de CPF/CNPJ.** Documento formalmente
válido não prova que é daquela pessoa, e recusar um número certo por engano
é pior que aceitar um errado que o Asaas recusa depois.

**Arquivar é a ação normal, excluir é a exceção.** Cliente com cobrança paga
não pode sumir: o histórico perderia o pagador.

**`empresa_id` nunca vem do formulário** — sempre da sessão. Aceitar do
cliente seria entregar a chave do isolamento.

**Busca por GET**, com o termo na URL: compartilhável, volta no botão
voltar e funciona sem JavaScript.

### Arquivos

**Novos:** `lib/cliente.ts` · `app/(app)/app/clientes/acoes.ts` ·
`FormularioCliente.tsx` · `AcoesCliente.tsx` · `page.tsx` ·
`novo/page.tsx` · `[id]/page.tsx` · `[id]/editar/page.tsx`
**Alterado:** `app/(app)/App.module.css` (tabelas, filtros, formulário, ficha)

### Segurança — 11 testes, todos por chamada direta à API

| tentativa | resultado |
|---|---|
| A lista clientes | vê **só os dele** |
| A lê cliente de B por id | **bloqueado** |
| A edita cliente de B | **bloqueado** |
| A apaga cliente de B | **bloqueado** |
| A insere cliente **na empresa de B** | **bloqueado** (`with check`) |
| anônimo lê / escreve | **bloqueado** nos dois |
| e-mail repetido na mesma empresa | **bloqueado** |
| mesmo e-mail em empresa diferente | **permitido**, como deve ser |
| trial expirado → criar | **bloqueado** |
| trial expirado → ler | **continua funcionando** |
| dois clientes sem e-mail | **permitido** (índice parcial) |
| apagar usuário remove os clientes dele | 5 → 2, cascade |

### Interface

| teste | resultado |
|---|---|
| estado vazio | "Cadastre seu primeiro cliente" |
| formulário vazio | 1 inválido, foco em `nome`, mensagem correta |
| documento curto | "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)" |
| criação | redireciona para a ficha, campos formatados |
| lista e contagem | 2 linhas, "2 clientes." |
| busca | filtra corretamente |
| e-mail duplicado | "Já existe um cliente com este e-mail." |
| arquivar | some dos ativos, aparece nos arquivados |
| id inexistente | **404** (não "sem permissão" — dizer que existe já entrega informação) |
| overflow em 1440/1280/1024/768/390/360 | **0px em todas** |
| erros de JS | **0** |

Typecheck e build limpos.

### Um susto que era do teste, não do produto

O primeiro teste de interface indicava que a sessão caía ao enviar o
formulário. Não caía: o seletor `querySelector("form")` pegava o formulário
de **logout** da barra lateral, que vem antes no DOM. Corrigido para
`main form`. Fica o registro para a próxima sonda.

### Próxima fase

Cobranças: acordo recorrente + ciclos, valores em centavos, `vencida`
derivada por data.

---

## 37. Auditoria da Fase 2 e estados de rota (26/08/2026)

Auditoria pedida sobre a Fase 2. **O CRUD já estava implementado** (seção
36) — não foi refeito. A auditoria achou **uma lacuna real** da lista de
requisitos e ela foi preenchida.

### O que a auditoria encontrou

| item | estado |
|---|---|
| `ZELO_PROJECT_CONTEXT.md` | **não existe** (citado pela 4ª vez) |
| `ZELO_SYSTEM_ARCHITECTURE.md` | 466 linhas, presente |
| módulo de clientes | 8 arquivos, completo |
| banco | 4 tabelas · **4 policies em `clientes`**, uma por operação · 4 índices |
| **estados de rota** | **nenhum `loading.tsx`, `error.tsx` ou `not-found.tsx` em todo o app** |

O último era a lacuna: "loading" e "erro" estavam resolvidos **dentro** dos
formulários ("Salvando…", `role="alert"`), mas não na navegação entre telas.
Quem clicava em Clientes via a tela anterior congelada até o servidor
responder.

### Preenchido

- **`app/(app)/app/loading.tsx`** — esqueleto padrão do sistema.
- **`app/(app)/app/clientes/loading.tsx`** — esqueleto com a **forma da
  lista**: barra de busca e seis linhas de tabela. Esqueleto com a forma do
  conteúdo evita o salto de layout que faz a tela parecer instável; um
  spinner centralizado não informa nada e ainda deixa o layout pular.
- **`app/(app)/app/error.tsx`** — fronteira de erro com "tentar de novo".
  Mostra o `digest` do Next, que também vai para o log do servidor: o
  usuário cita o código no suporte sem que a mensagem real — que pode
  conter tabela, coluna ou caminho — apareça na tela.
- **`app/(app)/app/clientes/[id]/not-found.tsx`** — "este cliente não
  existe". Mesma mensagem para id inexistente e para id de outra empresa,
  de propósito: "existe, mas você não pode ver" já entrega informação.
- `App.module.css` — esqueleto com onda, **desligada em reduced motion**.

### Reverificação completa

**Isolamento entre empresas — 11/11 por chamada direta à API:**
listar só os próprios · ler, editar e apagar cliente alheio **bloqueados** ·
inserir na empresa de outro **bloqueado** · anônimo lendo e escrevendo
**bloqueado** · e-mail duplicado na mesma empresa **bloqueado** e em empresa
diferente **permitido** · trial expirado **não cria mas continua lendo**.

**Interface — 11/11:**
empty state · validação com foco no primeiro inválido · criação · **edição**
· listagem · busca · erro de duplicado · arquivar · filtro ativo/arquivado ·
**exclusão com confirmação** · not-found personalizado.

Overflow **0px** em 1440/1280/1024/768/390/360. **0 erros de JS.**
Typecheck e build limpos, **18 rotas**.

### Bloqueios reais

Só o de sempre: **SMTP dos e-mails de autenticação** (seção 35). Bloqueia
lançamento, não construção.

`ZELO_PROJECT_CONTEXT.md` continua sem existir. Se tiver conteúdo, é só
mandar que eu gravo.

### Próxima fase

Cobranças.

---

## 38. FASE 3 — Cobranças (26/08/2026)

Também foi criado **`ZELO_PROJECT_CONTEXT.md`** na raiz, consolidando o que
já estava estabelecido. Nada inventado: cada item veio de decisão do
proprietário nesta sessão ou de código testado.

### Modelo — duas tabelas, e a separação importa

- **`cobrancas`** — o que é pago. Uma linha por cobrança, sempre.
- **`recorrencias`** — o **acordo** que gera cobranças mês a mês.
  Estrutura criada, interface fica para a fase de recorrência.

Cobrança única é `recorrencia_id = null`. Assim listagem, filtros e
dashboard leem **uma** tabela; sem isso, "pendente/paga/vencida" precisaria
ser consultado em dois lugares com regras diferentes.

**`vencida` não é coluna.** É `status in (pendente, enviada) and vence_em <
hoje`, derivado em `lib/cobranca.ts` e reproduzido igual no filtro da
consulta. Guardar como status exigiria um processo virando a chave toda
meia-noite — e processo parado vira dado errado sem avisar.

**Integridade no banco, não só na tela:**
- `valor_centavos integer check (> 0)` — nunca float;
- `check` de coerência: `paga` exige `pago_em`; não-paga não pode ter;
- `dia_vencimento between 1 and 28` — dia 31 não existe em fevereiro;
- `asaas_payment_id` único parcial — idempotência do webhook, já pronta;
- FK de cliente com `on delete restrict` — cliente com cobrança não some.

### Duas falhas encontradas por teste, não por leitura

**1. Vulnerabilidade real: cobrança em cliente de outra empresa.**
O RLS só validava `empresa_id`. Um usuário podia inserir cobrança na
**própria** empresa apontando `cliente_id` para o cliente de **outra**. A
Server Action barrava, mas chamada direta ao PostgREST passava.

Correção declarativa — **chave estrangeira composta**: `unique (id,
empresa_id)` em `clientes` e `recorrencias`, e FK de `cobrancas` sobre o par
`(cliente_id, empresa_id)`. O banco passa a exigir que o par exista; não dá
para pendurar cobrança em cliente alheio nem por SQL.

**2. Toda UPDATE falhava com `42703`.**
Reaproveitei a função de trigger de `clientes` (coluna `atualizado_em`) em
cobranças, onde eu havia nomeado `atualizada_em` — gênero gramatical virou
divergência de esquema. Padronizei **`criado_em`/`atualizado_em` no banco
inteiro**: duas funções quase idênticas por causa de gênero traria o mesmo
bug de volta.

Lacuna do meu próprio teste que permitiu isso passar: a bateria de API
verificava que updates **proibidos** falham, mas nunca que um update
**permitido** funciona. Corrigido.

### Arquivos

**Novos:** `lib/cobranca.ts` · `app/(app)/app/cobrancas/{acoes.ts,
FormularioCobranca.tsx, AcoesCobranca.tsx, page.tsx, loading.tsx,
nova/page.tsx, [id]/page.tsx, [id]/editar/page.tsx, [id]/not-found.tsx}` ·
`ZELO_PROJECT_CONTEXT.md`

**Alterados:** `app/(app)/app/page.tsx` (dashboard passou a somar dados
reais) · `app/(app)/app/clientes/acoes.ts` (trata a FK `23503` com mensagem
que ensina a arquivar) · `App.module.css`

**Migrações:** `fase3_cobrancas_e_recorrencias` ·
`fk_composta_cliente_empresa` · `padroniza_timestamps_criado_atualizado`

### Testes

**Segurança e integridade — 22/22, por chamada direta à API:**
ler, editar, cancelar e apagar cobrança alheia **bloqueados** · inserir com
`empresa_id` de outro **bloqueado** · **pendurar cobrança no cliente de
outra empresa bloqueado** · recorrência idem · anônimo lendo e escrevendo
**bloqueado** · valor zero e negativo recusados · status inválido recusado ·
paga sem `pago_em` e pendente com `pago_em` recusadas · `dia_vencimento 31`
recusado · vencida derivada por data · centavos guardados como inteiro ·
cliente com cobrança não é apagável · trial expirado **não cria mas lê**.

**Interface — 21/21:** estados vazios encadeados (sem cliente → pede
cliente; com cliente → pede cobrança) · validação com foco no primeiro
inválido · descrição curta, valor inválido e vencimento no passado
recusados · espelho do valor em reais · criação · **marcar como enviada** ·
**edição** · **registrar pagamento** · paga esconde editar e cancelar ·
filtros pagas/pendentes/vencidas · busca · **dashboard somando o recebido**
· cancelamento com confirmação · cancelada sem ações · not-found.

Overflow **0px** em 1440/1280/1024/768/390/360 · **0 erros de JS** ·
typecheck e build limpos · **21 rotas**.

### O que ficou pendente

- **Asaas**: `asaas_payment_id` e `asaas_subscription_id` reservados, nada
  integrado. Bloqueado por credencial.
- **"Registrar pagamento" é baixa manual**, não confirmação de pagamento:
  é o dono declarando que recebeu por fora. Quando o webhook existir, ele
  vira a fonte da verdade e esta ação passa a ser exceção.

### Bloqueio real

Só o de sempre: **SMTP dos e-mails de autenticação**. Bloqueia lançamento,
não construção.

---

## 39. FASE 4 — Recorrências (26/08/2026)

Módulo completo de acordos recorrentes implementado e testado.

### Arquitetura e Modelo
- Separação estrita mantida:
  - `recorrencias` = o acordo recorrente (valor em centavos, dia 1..28, início, status `ativa`/`pausada`/`encerrada`).
  - `cobrancas` = cada ciclo/cobrança gerada com `recorrencia_id` apontando para o acordo de origem.
- Geração automática e determinística:
  - Ao criar uma nova recorrência, o primeiro ciclo em `cobrancas` é criado automaticamente com o primeiro vencimento calculado com base na data de início e dia do mês.
  - Ação `gerarProximoCiclo` avança deterministicamente 1 mês a partir do último vencimento gerado, com verificação de idempotência (impede geração duplicada para a mesma competência/data).
- Integridade e RLS:
  - FK composta `(cliente_id, empresa_id)` no banco impede associar recorrência a cliente de outra empresa.
  - `dia_vencimento` restrito a 1..28 no banco e validações isomórficas.
  - Exclusão física de cliente bloqueada se houver recorrência vinculada (`on delete restrict`).

### Arquivos
**Novos:**
- `lib/recorrencia.ts` (contrato isomórfico, validações, cálculo determinístico de vencimentos, status e transições)
- `app/(app)/app/recorrencias/acoes.ts` (Server Actions: `criarRecorrencia`, `atualizarRecorrencia`, `pausarRecorrencia`, `reativarRecorrencia`, `encerrarRecorrencia`, `gerarProximoCiclo`)
- `app/(app)/app/recorrencias/FormularioRecorrencia.tsx`
- `app/(app)/app/recorrencias/AcoesRecorrencia.tsx`
- `app/(app)/app/recorrencias/page.tsx` (listagem com filtros todas/ativas/pausadas/encerradas, busca e paginação)
- `app/(app)/app/recorrencias/nova/page.tsx`
- `app/(app)/app/recorrencias/[id]/page.tsx` (ficha do acordo com resumo, ações e histórico de cobranças geradas)
- `app/(app)/app/recorrencias/[id]/editar/page.tsx`
- `app/(app)/app/recorrencias/[id]/not-found.tsx`
- `app/(app)/app/recorrencias/loading.tsx`
- `tools/teste-fase4.ts`

**Alterados:**
- `app/(app)/app/NavegacaoApp.tsx` (incluído item "Recorrências")
- `app/(app)/app/clientes/[id]/page.tsx` (exibe recorrências ativas e histórico de cobranças na ficha do cliente)
- `app/(app)/app/cobrancas/[id]/page.tsx` (link para a recorrência de origem)

### Testes
- **Segurança e Integridade — 29/29 testes automatizados (`tools/teste-fase4.ts`):**
  - Validações de entrada (campos obrigatórios, valores válidos, dia 1..28, datas).
  - Cálculo do 1º vencimento e próximos ciclos (inclusive virada de ano).
  - Anônimo bloqueado de ler ou escrever em recorrências.
  - Usuário A insere recorrência na própria empresa -> permitido.
  - Cobrança do ciclo 1 gerada com `recorrencia_id`.
  - Usuário A associando cliente de B -> bloqueado por FK composta / RLS.
  - Usuário A inserindo com `empresa_id` de B -> bloqueado por `with check`.
  - Usuário B lendo/alterando recorrência de A -> bloqueado (0 linhas retornadas).
  - Pausar e reativar recorrência funcionando.
  - Constraints do banco (`valor_centavos <= 0` e `dia_vencimento 31` recusados).
  - Exclusão de cliente com recorrência bloqueada (`23503`).
- **Build de Produção:**
  - `next build` limpo gerando 27 rotas.
  - `typecheck` com 0 erros.

### Próxima fase
Configurações da Empresa / Ajustes de Perfil e Preparação do Webhook Asaas.

---

## 40. FASE 5 — Integração & Preparação Asaas (26/08/2026)

Camada de integração financeira com o Asaas, webhooks seguros e configurações da empresa implementados e testados.

### Arquitetura da Integração
- **Fluxo seguro ponta a ponta:**
  `Zelo (Servidor) → Camada Asaas (lib/asaas) → API Asaas v3 → Cobrança/Pix → Webhook (/api/webhooks/asaas) → Atualização no Zelo`
- **Desacoplamento e Segurança:**
  - Zero secrets no cliente (browser). Chaves manuseadas exclusivamente no servidor.
  - Se `ASAAS_API_KEY` não estiver preenchida, o sistema opera de forma segura e resiliente, respondendo status `503` com tratamento amigável sem quebras ou travamentos de tela.
  - Endpoints oficiais da API v3 do Asaas (`https://sandbox.asaas.com/api/v3` e `https://api.asaas.com/api/v3`).
- **Webhook e Idempotência:**
  - Rota `/api/webhooks/asaas` protegida por autenticação de token no header (`asaas-access-token` / Bearer).
  - Verificação de idempotência via `eventos_asaas` (tabela com RLS de zero policies públicas, acesso apenas por `service_role`).
  - Tratamento automático de eventos `PAYMENT_RECEIVED` e `PAYMENT_CONFIRMED` (atualiza cobrança para `paga`, grava `pago_em`, vincula `asaas_payment_id` e registra `valor_pago_centavos`), `PAYMENT_DELETED` (`cancelada`), `PAYMENT_RESTORED` (`pendente`) e assinaturas.
  - Resposta HTTP 200 rápida para evitar tempestades de retentativas do provedor.
- **Configurações da Empresa:**
  - Rota `/app/configuracoes` com formulário para edição de nome comercial e documento (CPF/CNPJ com normalização de dígitos), além do painel de monitoramento do status da conexão bancária e URL do webhook.

### Arquivos
**Novos:**
- `lib/asaas/config.ts` (URLs oficiais v3, leitura segura de ambiente e flags)
- `lib/asaas/tipos.ts` (contrato completo e estrito de tipos: `AsaasCustomer`, `AsaasPayment`, `AsaasSubscription`, `AsaasWebhookPayload`, etc.)
- `lib/asaas/cliente-api.ts` (wrapper HTTP desacoplado com tratamento de erros da API)
- `lib/asaas/cliente.ts` (operações de clientes: criar, buscar por CPF/CNPJ ou e-mail, obter, atualizar)
- `lib/asaas/cobranca.ts` (operações de cobranças: criar Pix/Boleto, obter Pix QR Code, consultar e cancelar)
- `lib/asaas/assinatura.ts` (operações de assinaturas recorrentes)
- `lib/asaas/webhook.ts` (autenticação de token, dispatcher de eventos e idempotência)
- `app/api/webhooks/asaas/route.ts` (API route pública do webhook fora do matcher do middleware)
- `app/(app)/app/configuracoes/page.tsx` (tela de configurações da empresa e status financeiro)
- `app/(app)/app/configuracoes/FormularioConfiguracoes.tsx`
- `app/(app)/app/configuracoes/acoes.ts` (Server Action para atualização dos dados da empresa)
- `docs/supabase-fase5-asaas.sql` (schema de `eventos_asaas` para auditoria e idempotência)
- `tools/teste-fase5.ts` (bateria de testes automatizados da integração)

**Alterados:**
- `lib/supabase/admin.ts` (exportação dinâmica de `supabaseAdmin()` com `createClient`)
- `app/(app)/app/NavegacaoApp.tsx` (adicionado link para "Configurações")

### Testes
- **Bateria Automatizada Asaas e Webhooks — 16/16 testes (`tools/teste-fase5.ts`):**
  - Configuração oficial sandbox/produção.
  - Chamadas sem API Key retornando 503 controlado sem exceptions.
  - Autenticação de token do webhook (nulo, vazio e incorreto rejeitados com 401; válido aceito).
  - Processamento de `PAYMENT_RECEIVED` atualizando a cobrança no banco para `paga` com centavos exatos e timestamp.
  - Idempotência: reenvio do mesmo evento tratado com sucesso sem duplicar efeitos.
  - Processamento de `PAYMENT_DELETED` atualizando para `cancelada`.
- **Regressão da Fase 4 (`tools/teste-fase4.ts`):** 29/29 testes passaram.
- **Build de Produção:**
  - `next build` limpo com **29 rotas** geradas no Next.js 16.
  - `typecheck` com 0 erros.

### Bloqueio Real
- **Credenciais de Produção/Sandbox do Asaas (`ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN`):** O sistema está 100% pronto no código para começar a transacionar assim que as credenciais forem inseridas no `.env.local`.
- **SMTP dos e-mails de autenticação** (bloqueio do lançamento para tráfego aberto de cadastro).

### Próxima etapa recomendada
FASE 6 — QA GERAL, PÁGINAS LEGAIS (/termos e /privacidade com estrutura LGPD) E REFINAMENTOS DE ACESSIBILIDADE/RESPONSIVIDADE.



---

## 41. Correção crítica — `eventos_asaas` nunca foi aplicada (26/08/2026)

A auditoria apontou que o código do webhook dependia de `eventos_asaas`
para idempotência, o SQL existia em `docs/supabase-fase5-asaas.sql`, mas a
**tabela não estava no banco**. Confirmado: só existiam 6 tabelas.

### Por que os 16/16 da Fase 5 passaram assim mesmo

`lib/asaas/webhook.ts`, linhas 67–69: quando o insert falha com `PGRST205`
(tabela ausente do schema cache), o código **registra um aviso e segue
processando**. Sem a tabela, portanto:

- todo reenvio do provedor era processado **de novo**;
- um pagamento podia virar dois;
- e **nada acusava** — nem erro, nem teste vermelho.

O teste da Fase 5 verificava apenas que o reenvio "foi tratado com sucesso
sem erro". Retorno `ok: true` era exatamente o que o caminho quebrado
produzia. Asserção fraca escondendo o furo.

### Correção — migração `fase5_eventos_asaas`

Aplicada só a tabela que faltava; nada existente foi recriado ou alterado.

| item | estado no banco |
|---|---|
| tabela `eventos_asaas` | **existe** |
| RLS | **ligado** |
| policies | **0** — nem chave publicável nem usuário logado enxergam; grava só a `service_role` |
| constraint única em `asaas_event_id` | **presente** (`eventos_asaas_asaas_event_id_key`) |
| índices | `pkey`, único do evento, `tipo`, `recebido_em desc` |
| trigger `atualizado_em` | presente |

Um desvio consciente do arquivo documentado: **não** criei
`idx_eventos_asaas_event_id`. O `unique` da coluna já gera índice; um
segundo sobre a mesma coluna só custaria escrita. `docs/supabase-fase5-asaas.sql`
foi sincronizado para refletir o banco.

### Verificação REAL de idempotência — 13/13

Bateria nova, conferindo **o estado do banco** e não o retorno da função:

| verificação | resultado |
|---|---|
| 1ª entrega retorna ok e **não** idempotente | ✓ |
| evento **gravado** (1 linha) com `processado_em` e payload | ✓ |
| cobrança virou `paga` com **12345 centavos exatos** | ✓ |
| 2ª entrega marcada como **idempotente** | ✓ |
| **não duplicou** linha em `eventos_asaas` | ✓ |
| **`pago_em` não foi sobrescrito** | ✓ |
| `asaas_payment_id` inalterado | ✓ |
| **valor não somado duas vezes** | ✓ |
| 3ª entrega ainda idempotente, 1 linha só | ✓ |
| evento **diferente** não é bloqueado | ✓ |

### Regressões

- `tools/teste-fase5.ts` — **16/16**
- `tools/teste-fase4.ts` — **29/29**
- typecheck limpo · build exit 0 · **29 rotas**
- banco zerado após os testes (0 em todas as tabelas)

### Duas observações que ficam registradas

1. ~~`tools/*.ts` não entram no `npm run typecheck` e têm 3 erros de tipo.~~
   **ERRADO — corrigido na seção 42.** Os 3 erros eram artefato dos flags
   de compilação usados na apuração (faltava `--strict`), e `tools/` **está**
   coberto pelo typecheck.
2. **O fallback de `PGRST205` continua no código.** Com a tabela criada ele
   nunca dispara, mas é ele que transforma "idempotência quebrada" em
   aviso silencioso. Vale decidir se deve virar falha explícita.
   → **Resolvido na seção 42.**

### Bloqueios inalterados

`ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` (ausentes do `.env.local`) · SMTP
dos e-mails de autenticação.


---

## 42. Idempotência com falha explícita + correção de um relato errado (26/08/2026)

### 1. O webhook agora RECUSA processar sem idempotência

O problema era maior do que "um fallback para `PGRST205`". O `if` apenas
**evitava o log** nesse código; em **todos** os casos de erro o fluxo caía
fora do bloco e processava assim mesmo. Tabela ausente, permissão negada,
conexão caída — qualquer falha na gravação do evento resultava em pagamento
processado **sem proteção nenhuma**. O `catch` fazia o mesmo.

Agora, em `lib/asaas/webhook.ts`:

- `23505` (unique_violation) → `{ ok: true, idempotente: true }` — caminho
  feliz, o evento já era conhecido;
- **qualquer outro erro** → `{ ok: false, statusHttp: 503 }`, e **nada é
  processado**;
- o `catch` faz o mesmo em vez de engolir;
- o detalhe técnico (código, tabela, mensagem do Postgres) vai para o log
  do servidor; a resposta HTTP leva só *"Não foi possível registrar o
  evento. Tente novamente."*

503 e não 500 de propósito: sinaliza indisponibilidade temporária, que é o
que de fato é, e o Asaas reenvia. **Reenvio é barato; pagamento contado em
dobro não é.**

### 2. Correção de um relato meu que estava errado

A seção 41 afirmou que `tools/*.ts` ficava fora do `npm run typecheck` e
que havia 3 erros de tipo reais. **As duas afirmações estavam erradas.**

- `tsconfig.json` inclui `**/*.ts`; `tsc --listFiles` confirma os três
  arquivos de `tools/` sendo verificados.
- Os 3 erros só aparecem quando se compila **sem `--strict`** — foi o que
  eu fiz ao rodar o teste à mão. Sem `strictNullChecks` o TypeScript não
  estreita a união discriminada `RespostaAsaas`, e `resCli.status` passa a
  ser inválido. Com a configuração real do projeto, **zero erros**.

Nenhuma alteração foi feita em `tools/` — não havia o que corrigir.
Ferramenta de apuração mal configurada produz achado falso; o relato
anterior foi consertado na própria seção 41.

### Testes — todos contra o banco real

**A) Com a tabela presente — 9/9**
1ª entrega: ok e não idempotente · evento gravado com `processado_em` ·
cobrança paga com **12345 centavos exatos**. 2ª entrega: **idempotente** ·
não duplicou linha · `pago_em` **não sobrescrito** · `payment_id` e valor
inalterados. 3ª entrega ainda idempotente. Evento **diferente** não é
bloqueado.

**B) Com a infraestrutura caída — 4/4**
A tabela foi **renomeada** (não apagada, e estava vazia) para reproduzir o
cenário, e restaurada logo depois:

| verificação | resultado |
|---|---|
| recusa processar (`ok = false`) | ✓ |
| status **503**, para o Asaas reenviar | ✓ |
| mensagem genérica, sem citar tabela, código ou schema | ✓ |
| **cobrança NÃO foi paga** — segue `pendente`, `pago_em` nulo | ✓ |

O log do servidor registrou o motivo real (`PGRST205 Could not find the
table…`) — exatamente onde deve ficar.

Após restaurar: tabela de volta, RLS ligado, constraint única presente,
nenhuma tabela temporária sobrando, 0 linhas.

**Regressões:** `teste-fase5` **16/16** · `teste-fase4` **29/29** ·
typecheck limpo · build exit 0, **29 rotas**.

### Arquivos alterados

`lib/asaas/webhook.ts` · `PROJECT_STATUS.md`. Mais nada.

### Bloqueios inalterados

`ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` ausentes do `.env.local` · SMTP
dos e-mails de autenticação.

---

## 43. QA técnico geral do produto (26/08/2026)

Auditoria dos 25 pontos pedidos. **Um problema real encontrado e corrigido**;
o resto passou.

### Estáticas — todas limpas

| verificação | resultado |
|---|---|
| `supabaseAdmin` importado em componente cliente | **nenhum** |
| variáveis `NEXT_PUBLIC_` | só as 5 legítimas (site, GA, Clarity, URL e chave **publicável** do Supabase) |
| segredos no bundle compilado | `SERVICE_ROLE`, `service_role`, `ASAAS_API_KEY`, `WEBHOOK_TOKEN`: **0 ocorrências** |
| `supabase.co` no bundle | 1 — a URL do projeto, junto da chave `sb_publishable_…`. Público por desenho |
| Server Actions sem checagem de sessão | **nenhuma** (16 ações, todas passando por `usuarioAtual`/`contexto`) |
| links internos apontando para rota inexistente | **nenhum** |
| `.env*` no `.gitignore` | sim |

### Runtime — 15 rotas autenticadas, todas limpas

Para cada rota: **1 `h1`**, **0** campos sem label, **0** botões/links sem
nome acessível, **0** `<img>` sem alt, **0px** de overflow em 1440 **e** em
390, **0** erros de JavaScript.

`/app` · `/app/clientes` (+novo, ficha, editar) · `/app/cobrancas` (+nova,
ficha, editar) · `/app/recorrencias` (+nova, ficha, editar) ·
`/app/assinatura` · `/app/configuracoes`

Proteção de rota: as **9** rotas privadas redirecionam para
`/entrar?de=…` preservando o destino. Logout leva a `/entrar` e
`/app/cobrancas` volta a bloquear. Todos os links do menu respondem 200.

Webhook: **401** sem token, **405** em GET.

### Isolamento entre empresas — 22/22, por chamada direta à API

Para `clientes`, `cobrancas`, `recorrencias` e `empresas`: ler, alterar e
apagar registro de outra empresa **bloqueado**; anônimo **bloqueado** em
todas. Cada usuário só enxerga os próprios registros e os próprios vínculos
em `membros`. `eventos_asaas` e `leads` invisíveis para usuário logado e
para anônimo.

### PROBLEMA ENCONTRADO E CORRIGIDO — funções `SECURITY DEFINER` expostas

O linter de segurança do Supabase apontou 4 funções `SECURITY DEFINER`
publicadas em `/rest/v1/rpc` para `anon` e `authenticated`.

**Reproduzido antes de corrigir:**

| função | chamada anônima |
|---|---|
| `cria_empresa_do_novo_usuario()` | recusada — PostgREST não expõe função que retorna `trigger` |
| `remove_empresa_sem_membros()` | recusada, mesmo motivo |
| `eh_membro(uuid)` | **EXECUTOU** |
| `empresa_liberada(uuid)` | **EXECUTOU** |

Severidade real: baixa — exige adivinhar um UUIDv4. Mas
`empresa_liberada` revela se uma empresa existe e está ativa, informação
que ninguém deslogado precisa.

**Correção** (`restringe_execute_das_funcoes_definer`): `EXECUTE` revogado
de `public` e `anon` nas quatro; as de trigger perderam também de
`authenticated` (só devem rodar pelo trigger, como dono da tabela).

**`authenticated` MANTÉM** execute em `eh_membro` e `empresa_liberada`: as
policies de RLS as chamam, e a expressão da policy roda com o papel de quem
consulta. Revogar ali derrubaria o isolamento inteiro — por isso a
verificação abaixo era obrigatória.

**Verificado depois — 10/10:** RPC anônimo recusado nas duas · usuário ainda
**cria** cliente e cobrança · ainda **lê** e **edita** os próprios dados ·
continua **sem enxergar** os da outra empresa · anônimo bloqueado · **trial
expirado ainda bloqueia criação** (prova de que `empresa_liberada` segue
funcionando dentro da policy).

### Regressões — nenhuma

`teste-fase5` **16/16** · `teste-fase4` **29/29** · typecheck limpo · build
exit 0, **29 rotas**. Banco zerado ao fim (0 em todas as tabelas).

### Pendências que o QA confirmou, sem correção possível aqui

| pendência | efeito |
|---|---|
| **`/termos` e `/privacidade` → 404** | o sistema já guarda dados de clientes **dos clientes** do usuário. É exigência de LGPD, não item de acabamento |
| `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` ausentes | nada transaciona |
| SMTP dos e-mails de autenticação | ninguém cria conta em produção |
| avisos `rls_enabled_no_policy` em `leads` e `eventos_asaas` | nível **INFO** e **intencional**: RLS ligado sem policy é o que torna as tabelas invisíveis a qualquer chave que não seja a de serviço |

### Não foi possível testar

- **Integração real com o Asaas** — sem credenciais, só o caminho de
  degradação (503) foi exercitado.
- **Envio real de e-mail** de confirmação e recuperação — SMTP bloqueado.
- **Comportamento sob carga/concorrência** — fora do escopo desta bateria.

---

## 44. Páginas legais — ESTRUTURA criada, conteúdo jurídico PENDENTE (26/08/2026)

**`/termos` e `/privacidade` existem e respondem 200.** Antes davam 404.

### O que foi criado — e o que NÃO foi

**Criado:** a estrutura. Títulos de seção, marcadores do que falta, e o
levantamento **factual** do que o sistema coleta.

**NÃO criado:** texto jurídico. Nenhuma cláusula foi redigida, nenhum dado
da empresa foi presumido, nenhuma obrigação foi declarada.

O motivo é direto: **texto genérico apresentado como política é pior que
política nenhuma** — cria aparência de conformidade sem nenhuma, e uma
cláusula de limitação de responsabilidade copiada de modelo costuma ser
inválida no Brasil por conflito com o Código de Defesa do Consumidor.

### Três decisões que protegem contra o documento parecer vigente

1. **Aviso no topo das duas páginas**, em âmbar: *"Documento em elaboração —
   ainda não vigente… não constitui contrato, política em vigor ou
   orientação jurídica."* Sem ele, um documento com títulos de seção e
   aparência de política passa a impressão de estar valendo.
2. **`robots: noindex`** nas duas. Documento legal indexado dá a entender
   que está em vigor.
3. **57 marcadores de pendência** (31 nos Termos, 26 na Privacidade),
   separados por natureza: `REVISÃO JURÍDICA`, `DEFINIÇÃO COMERCIAL`,
   `DEFINIÇÃO OPERACIONAL` e `A DEFINIR` para dados da empresa.

### O quadro de dados é insumo, não redação

A Política inclui uma tabela do que o sistema **realmente** coleta,
extraída do código, apontando o arquivo de origem de cada item
(`lib/lead.ts`, `lib/conta.ts`, `lib/cliente.ts`, `lib/cobranca.ts`,
`components/Analytics.tsx`). É verificável e economiza a primeira hora de
quem for redigir.

Também estão registrados como fato, não como promessa: os operadores em uso
(**Supabase**, região `us-east-1`; GA e Clarity só se as variáveis
existirem), o que a exclusão de conta faz hoje (cascade em empresa, clientes
e cobranças) e as medidas de segurança já implementadas e testadas.

### Dois pontos que o levantamento deixou explícitos para o advogado

- **Dados de terceiros.** Parte do que a Zelo guarda é dos clientes **dos
  usuários** — pessoas que nunca interagiram com a Zelo. A relação
  operadora/controlador sobre esses dados precisa estar escrita.
- **Transferência internacional.** O banco está em `us-east-1`. Isso cai
  nos arts. 33 a 36 da LGPD e exige cláusula própria, não menção de
  passagem.

### Arquivos

**Novos:** `app/(legal)/Legal.module.css` · `app/(legal)/PecasLegais.tsx` ·
`app/(legal)/termos/page.tsx` · `app/(legal)/privacidade/page.tsx`
**Alterado:** `components/SiteFooter.tsx` — os dois itens de "Legal"
deixaram de ser texto "a definir" e viraram links reais. O aviso de rascunho
fica na página, onde quem abre consegue ler.

Nada mais foi tocado: landing page, banco, funcionalidades e demais rotas
intactos.

### Testes — 19/19

`/termos` e `/privacidade` respondem **200** · 1 `h1` em cada · 11 e 10
seções com `h2` · aviso de não vigência visível · `noindex` ativo · `title`
correto · **0** links ou botões sem nome acessível · **0px de overflow** em
1440/1280/1024/768/390/360 · **0 erros de JS** · rodapé da landing aponta
para as duas.

Verificação específica contra invenção: busca por padrão de CNPJ e razão
social no texto renderizado — **nenhuma ocorrência** nas duas páginas.

Typecheck limpo · build exit 0 · **31 rotas**.

### PENDENTE — bloqueio de lançamento

**O conteúdo jurídico definitivo não existe e não pode ser escrito por
mim.** Precisa de profissional habilitado. O que falta, por natureza:

| natureza | itens |
|---|---|
| **dados da empresa** | razão social, CNPJ, endereço, e-mail de contato, encarregado (DPO) |
| **revisão jurídica** | objeto contratual, base legal de cada tratamento (art. 7º), limitação de responsabilidade, direito de arrependimento (art. 49 CDC), retenção, transferência internacional, resposta a incidente (art. 48), foro |
| **definição comercial** | processador de pagamentos contratado, disponibilidade e suporte, política de reembolso |
| **definição operacional** | canal e prazo para o titular exercer os direitos do art. 18 |

Enquanto isso não existir, **as páginas continuam `noindex` e marcadas como
não vigentes** — e o Zelo não deve receber usuário real, porque passará a
tratar dado pessoal de terceiro sem política publicada.

---

## 45. Arquitetura do core financeiro — projetada, NÃO implementada (31/08/2026)

Documento completo em `ZELO_FINANCIAL_CORE_ARCHITECTURE.md`. Cobre as 24
seções pedidas: modelo de domínio, mapa de identificadores, máquinas de
estado (cobrança, autorização Pix Automático, instrução de pagamento,
recorrência), integração Asaas ponta a ponta, onboarding financeiro,
consistência/concorrência, reconciliação, mapa de falhas, segurança,
dashboard, UX, observabilidade, banco (conceitual), Server Actions
necessárias, estratégia de testes, plano de migração da base atual, e
roadmap em 9 fases com critério de conclusão por fase.

**Nada foi codificado.** Nenhuma migration foi criada. Nenhum arquivo de
produto ou de `lib/asaas/` foi alterado. O documento é o plano, não o
trabalho.

**Achado principal da análise:** `cobrancas.status` hoje mistura três
conceitos que precisam ser entidades separadas — a cobrança em si, a
autorização do Pix Automático e a instrução de pagamento de cada ciclo.
Sem separar, "pendente" teria que significar ao mesmo tempo "ainda não
venceu" e "aguardando o cliente autorizar", que são coisas diferentes.

**8 pontos ficaram sinalizados como bloqueados por documentação** —
principalmente o schema exato de `POST /v3/pix/automatic/authorizations`,
o endpoint de cancelamento de autorização, e a política de retentativa de
pagamento recusado. Listados no fim do documento; nenhum foi decidido por
suposição.

**Não muda o que já está pronto:** a auditoria confirma que
`lib/asaas/{config,cliente-api,credenciais,webhook}.ts`, o motor de
recorrência e toda a base RLS/multi-tenant estão certos como estão — o
plano é sobre o que falta ligar em cima, não sobre reescrever a base.

---

## 46. Core financeiro — Fase 1: fundação de domínio (31/08/2026)

**Só a fundação. Nenhuma chamada real ao Asaas foi feita. Nenhuma tela
foi criada ou ligada.** Integração de autorização/instrução com a UI
continua na Fase 2+.

### Correção da arquitetura antes de implementar

A pesquisa desta fase, contra a API Reference oficial do Asaas
(`POST`/`DELETE /v3/pix/automatic/authorizations`), corrigiu 3 pontos que
`ZELO_FINANCIAL_CORE_ARCHITECTURE.md` tinha errado ou deixado bloqueado:

1. O enum de status de autorização é `CREATED | ACTIVE | CANCELLED |
   REFUSED | EXPIRED` — 5 valores, sem o estado intermediário que o
   documento original tinha inventado.
2. A criação de autorização **não tem** `externalReference` — usa
   `contractId`. É `/payments` que tem `externalReference`, não
   `/pix/automatic/authorizations`. Confundir os dois quebraria a
   correlação assim que fosse implementado.
3. `finishDate` é campo que o **Zelo escolhe** ao criar a autorização —
   não é um prazo de expiração imprevisível do Asaas. Resolve o que
   estava listado como bloqueado.

Achado extra, não previsto: a resposta de criação da autorização traz
`subscriptionId` mesmo em modo `MANUAL` — o Asaas cria um objeto de
assinatura por baixo independente do modo escolhido. Campo gravado
(`autorizacoes_pix.asaas_subscription_id`) para não perder essa
informação.

Documento atualizado com as correções riscadas, não apagadas — mantém o
histórico de revisão.

### Banco — migration `fase7_fundacao_core_financeiro`, aditiva

- `cobrancas` ganhou a constraint `(id, empresa_id)` que `clientes` e
  `recorrencias` já tinham — necessária pra FK composta, sem risco (o PK
  em `id` já garante unicidade).
- `clientes.asaas_customer_id`, único quando preenchido.
- **`autorizacoes_pix`** (nova): estado real de 5 valores, `finish_date`
  sempre obrigatório, FK composta garantindo que cliente e recorrência
  são da mesma empresa da autorização, **índice único parcial que
  permite só uma autorização viva (CREATED/ACTIVE) por recorrência**.
  RLS com policy de leitura para o membro; **sem policy de escrita** —
  só `service_role` grava nesta fase, o frontend não tem como fabricar
  uma autorização "ACTIVE" sozinho.
- **`instrucoes_pagamento`** (nova): mesmo padrão — índice único parcial
  de uma instrução viva por cobrança, FK composta pra cobrança da mesma
  empresa, RLS só leitura.
- **`pagamentos`** (nova): `asaas_payment_id` único — é a idempotência do
  *efeito* financeiro, separada da idempotência do *evento* que já
  existia em `eventos_asaas`. RLS só leitura.
- **`log_acoes_financeiras`** (nova): auditoria de ação humana. RLS só
  leitura — nenhuma policy de INSERT, um usuário não pode forjar o
  próprio log.
- `recorrencias.autorizacao_atual_id`, nullable, FK pra
  `autorizacoes_pix`.

Nenhuma tabela existente perdeu coluna. `cobrancas.status` não foi
tocado — a separação conceitual (cobrança × autorização × instrução ×
pagamento) se resolve com tabelas novas, como o plano previa.

### Tipos — `lib/core/`

`erros.ts` (erro de domínio tipado, 6 categorias, nunca vaza detalhe
interno pro usuário — mesma disciplina que `lib/asaas/webhook.ts` já
aplicava ao log), `autorizacao.ts`, `instrucao-pagamento.ts`,
`pagamento.ts` — mesmo padrão de `lib/cobranca.ts`/`lib/recorrencia.ts`:
sem React, sem DOM, tipos + funções de transição puras.

### Estados

Autorização: 5 estados reais do Asaas, com tabela de transições válidas
(`CREATED→ACTIVE`, `CREATED→REFUSED`, `ACTIVE→CANCELLED`,
`ACTIVE→EXPIRED`, `CREATED→CANCELLED` — nada mais, nenhum estado final
reabre) e tabela de **origem permitida por estado**
(`origemPermitida()`): `CREATED` só nasce de caso de uso, os demais só
de webhook/reconciliação. É a regra "frontend nunca muda status
financeiro" (§14 da arquitetura) expressa em tipo, verificável em teste,
não só em comentário.

Instrução de pagamento: 4 estados, mesma disciplina de transição.

Pagamento: sem máquina de estados — é efeito observado, não editável.

### Testes — `tools/teste-core-financeiro.ts`, 47/47

19 de domínio puro (transições válidas/inválidas, origem permitida,
valor bruto derivado, erro de domínio não vaza detalhe). 15 de banco:
unicidade de `asaas_authorization_id`/`asaas_payment_id`, uma
autorização/instrução viva por vez, FK composta bloqueando referência
cruzada entre empresas. 7 de isolamento por RLS via chamada direta à
API: usuário só enxerga o que é da própria empresa, **não consegue
INSERT em `autorizacoes_pix`** (só `service_role`), não consegue forjar
o próprio log de auditoria. 1 de compatibilidade: update em `cobrancas`
pelo fluxo antigo continua funcionando sem nenhuma mudança.

### Regressão — 106/106, nenhuma quebra

`teste-fase4` 29/29 · `teste-fase5` 16/16 · `teste-fase6` 35/35 ·
`teste-rls-empresas` 14/14 · `teste-limite-plano` 12/12. Typecheck
limpo, build exit 0, 32 rotas — nenhuma rota nova, porque nesta fase
não existe UI.

### O que NÃO foi feito, de propósito

Nenhuma Server Action chama `lib/core/*` ainda. Nenhuma tela de
onboarding/autorização existe. Nenhuma chamada real
`POST /pix/automatic/authorizations` foi feita — nem em sandbox. Fica
para a Fase 2 em diante, que depende de decidir e confirmar o restante
dos pontos ainda bloqueados na arquitetura (consulta de status de
autorização, `externalReference` nos eventos de Pix Automático, motivo
de recusa de subconta).

---

## 47. Core financeiro — Fase 2: onboarding financeiro (31/08/2026)

**Só onboarding: criar subconta, guardar credencial, saber o status.
Nenhuma autorização Pix Automático, nenhuma instrução de pagamento,
nenhuma cobrança real foi implementada — isso é Fase 3+.**

### Pesquisa que corrigiu a suposição do plano

A ideia inicial era que a resposta de `POST /v3/accounts` traria um
`onboardingUrl` único para o usuário completar o cadastro. **Não é bem
assim**, confirmado por leitura direta de 3 páginas da documentação
oficial:

- `onboardingUrl` existe **por documento pendente**, não uma vez por
  conta — vem de um endpoint separado de consulta de documentos
  (`verificar-documentos-pendentes`), que esta fase não chama.
- O status geral de aprovação da conta **não vem embutido na resposta
  de criação** — chega só por webhook, evento
  `ACCOUNT_STATUS_GENERAL_APPROVAL_{PENDING|AWAITING_APPROVAL|APPROVED|REJECTED}`
  (confirmado em `docs.asaas.com/docs/webhook-para-verificar-situacao-da-conta`).
  Esse é o enum real usado no schema — nada inventado.

O onboarding completo de documentos (upload, link externo por
documento) fica para quando a Fase 3 decidir tratar isso — está fora do
escopo desta fase, e não foi simulado nem prometido na UI.

### Banco — migration `fase8_onboarding_financeiro`, aditiva

Reutilizados sem duplicar: `asaas_account_id`, `asaas_wallet_id`,
`asaas_status`, `provider`, `provider_account_id`, `provider_status`
(todos já existiam de migrations anteriores). Acrescentado só o que
faltava: `provider_aprovacao` (o enum real do Asaas acima),
`provider_conectado_em`, `provider_sincronizado_em`. `provider_status`
ganhou o valor `'criando'` — é o estado transitório que sustenta a
idempotência da criação.

**Bug real encontrado e corrigido durante os testes desta fase:**
`log_acoes_financeiras.entidade_id` tinha sido criado como `uuid` na
Fase 1, mas o `accountId` que o Asaas devolve não é UUID — a gravação da
auditoria de "onboarding concluído" falhava **em silêncio** (o log
engolia o erro de propósito, para não derrubar a operação principal, e
isso escondeu o bug). Corrigido: coluna virou `text` (aditivo, sem perda
de dado) e o log de erro de auditoria deixou de ser silencioso — ele não
derruba mais nada, mas agora aparece no log do servidor.

### Camada — `lib/core/`

`conta-financeira.ts` (tipos + `prontaParaCobrar()` + texto seguro pra
UI via `descricaoDoEstado()`), `onboarding.ts` (o caso de uso).

**Idempotência por compare-and-swap no banco**, não por chave gerada no
cliente: `UPDATE empresas SET provider_status='criando' WHERE
provider_status IN ('pendente','recusada')` só afeta uma linha se
ninguém mais estiver no meio da mesma operação — mesmo padrão que
`marcarComoPaga()` já usava para cobrança, agora aplicado à criação de
subconta. **Testado com duas chamadas de verdade em paralelo
(`Promise.all`), não simulado**: das duas, só uma chega a chamar o
Asaas; a outra recebe conflito.

**Limitação conhecida e registrada, não escondida:** se o processo cair
depois do CAS e antes da chamada ao Asaas terminar, a empresa fica presa
em `provider_status = 'criando'` até um operador destravar manualmente
pelo Supabase Studio. Não existe ainda rotina de reconciliação
automática para isso — fica para a Fase 3, que o documento de
arquitetura já previa (§12).

### Webhook — eventos de conta, separados de pagamento

`lib/asaas/tipos.ts` ganhou os 14 eventos `ACCOUNT_STATUS_*` reais.
`lib/asaas/webhook.ts` trata só o ramo `GENERAL_APPROVAL_*` — extrai o
status do próprio nome do evento (não inventa um campo de payload que
não foi confirmado) e atualiza `provider_aprovacao`. Os demais ramos
(`BANK_ACCOUNT_INFO`, `COMMERCIAL_INFO`, `DOCUMENT`) são reconhecidos
pelo tipo mas **não têm handler** — não inventado o que fazer com eles
antes da Fase 3 decidir. Bloco isolado do de pagamento/assinatura: um
evento de conta não consegue, por acidente de código, tocar em
`cobrancas` ou `recorrencias`.

### Server Action e UI

`app/(app)/app/configuracoes/acoes.ts` ganhou `conectarContaFinanceira()`
e `situacaoDaContaFinanceira()` — `empresa_id` e `usuario_id` sempre da
sessão, nunca do formulário. A Server Action importa só o **tipo**
`CriarSubcontaDados` de `lib/asaas/subconta`, nunca a função — quem fala
com o Asaas é exclusivamente `lib/core/onboarding.ts`.

`app/(app)/app/configuracoes/ContaFinanceira.tsx` (novo componente):
os 4 estados pedidos (não conectado / configurando / pronto / problema),
formulário mínimo que aparece só ao clicar "Configurar agora", nunca
mostra credencial nem stack trace. Distinta da seção "Integração
Financeira (Asaas)" que já existia na página — aquela mostra se a
**plataforma** Zelo tem `ASAAS_API_KEY` no ambiente; esta mostra se
**esta empresa** tem subconta conectada. Os dois conceitos são
diferentes e ficaram claramente separados.

### Testes — `tools/teste-onboarding-financeiro.ts`, 28/28

9 de domínio puro (transições, `prontaParaCobrar()`, texto sem stack
trace). 2 de integração real sem mock — sem `ASAAS_API_KEY` configurada,
o caminho "Asaas indisponível" é exercitado de verdade, não simulado. 5
com criador injetado (mock): sucesso grava conta+log sem vazar segredo,
timeout não trava a empresa em `criando`. 3 de idempotência real — **duas
chamadas simultâneas de verdade via `Promise.all`**, confirmando que só
uma chega a chamar o Asaas e a outra recebe conflito; retry após já
criada não duplica. 5 de segurança: usuário não lê credencial, não
consegue forjar `provider_status`/`provider_aprovacao` (grants
restritos, herdados da Fase 6), não altera empresa alheia. 3 estruturais
confirmando a regra de camadas: a Server Action chama o caso de uso, não
importa a função que fala com o Asaas.

### Regressão — 181/181, nenhuma quebra

`teste-fase4` 29/29 · `teste-fase5` 16/16 · `teste-fase6` 35/35 ·
`teste-rls-empresas` 14/14 · `teste-limite-plano` 12/12 ·
`teste-core-financeiro` (Fase 1) 47/47 ·
`teste-onboarding-financeiro` (Fase 2) 28/28. Typecheck limpo, build
exit 0, 32 rotas. Advisories de segurança do Supabase: os mesmos 5 já
conhecidos e documentados como intencionais — nenhum novo.

### O que NÃO foi feito, de propósito

Nenhuma chamada real ao Asaas em produção — sem `ASAAS_API_KEY`
configurada, o botão "Configurar agora" sempre vai devolver "não
conseguimos conectar" até a credencial existir. Onboarding de documentos
(upload, `onboardingUrl` por documento) não implementado. Autorização
Pix Automático, instrução de pagamento e cobrança real seguem
inteiramente para as próximas fases.

## 48. Core financeiro — Fase 3: onboarding completo + reconciliação (31/08/2026)

### Pesquisa confirmada contra a documentação oficial

`GET /v3/myAccount/status/` (situação cadastral, 4 campos:
`commercialInfo`, `bankAccountInfo`, `documentation`, `general` — "a
conta estará 100% aprovada quando `general` for APPROVED", citação
literal da doc) e `GET /v3/myAccount/documents` (documentos pendentes,
`onboardingUrl` **por documento**, confirmando o achado da Fase 2/3 de
que não existe uma URL única de onboarding por conta — corrigido também
em `ZELO_FINANCIAL_CORE_ARCHITECTURE.md`, ver abaixo). Ambos exigem a
credencial **da subconta**, nunca a da plataforma. `POST
/myAccount/documents/{id}` (upload de documento) **não foi confirmado**
— a página de referência retornou 404 — e continua deliberadamente não
implementado (`lib/asaas/conta.ts`, `enviarDocumentoViaApi = null`),
para não inventar contrato de API. `GET /v3/accounts?cpfCnpj=` (busca de
subconta, credencial da plataforma) foi confirmado para uso exclusivo em
reconciliação.

### Novo: `lib/asaas/conta.ts`

`consultarSituacaoConta()`, `consultarDocumentosPendentes()`,
`buscarSubcontaPorDocumento()` — todas servidor-apenas. Documentado
inline por que `/myAccount/*` precisa da credencial da subconta e
`/accounts` precisa da credencial da plataforma (são operações "eu
mesmo" vs. "minhas subcontas", contas diferentes na visão do Asaas).

### `lib/core/conta-financeira.ts` — estado derivado, não duplicado

`EstadoOnboarding` ganhou `'bloqueada'` (subconta existe do lado do
Asaas, mas o Zelo perdeu a credencial — a `apiKey` só é devolvida uma
vez na criação; distinto de `recusada`, que significa "seguro tentar de
novo"). Novo tipo `SituacaoContaAsaas` (os 4 campos reais) e
`estadoConceitual()`: função pura que combina `estadoOnboarding`
(persistido) com uma `SituacaoContaAsaas` **lida ao vivo** (não
persistida) para derivar os 8 estados conceituais pedidos pela fase —
de propósito, para não duplicar em banco o que já vem do Asaas sob
demanda. `descricaoDoEstado()` ganhou um segundo parâmetro opcional
(`situacao`): sem ele, cai para o texto mais simples baseado só em
`statusAprovacao` (comportamento herdado da Fase 2, preservado porque
sintetizar os 4 campos a partir de um só inventaria `documentation`).

### `lib/core/onboarding.ts` — duas novas funções

`sincronizarStatusFinanceiro(empresaId)`: consulta o Asaas ao vivo
(status + documentos pendentes) com a credencial da subconta, persiste
só `provider_aprovacao`/`provider_sincronizado_em` (os outros 3 campos
continuam não-persistidos, de propósito). `reconciliarContaFinanceira(
empresaId, usuarioId?, buscador?)`: cobre o buraco descrito desde a Fase
2 — empresa presa em `criando` porque o processo caiu entre o
compare-and-swap e a conclusão da chamada ao Asaas. Duas classes:
**(A)** `asaas_account_id` já existe localmente → resync direto, sem
chamar o Asaas; **(B)** não existe localmente → `GET /accounts?cpfCnpj=`
decide entre "realmente não existe" (destrava para `recusada`) e "existe
mas a credencial é irrecuperável" (transiciona para `bloqueada`, exige
suporte manual — nunca finge que está tudo bem). O terceiro parâmetro
(`buscador`) é injetável só para teste, mesmo padrão de
`CriadorDeSubconta` da Fase 2.

Dois bugs de concorrência encontrados e corrigidos **pelos próprios
testes desta fase**: (1) o CAS da classe A fazia `UPDATE ... WHERE
provider_status IN (...)` sem checar se alguma linha foi realmente
afetada — um `UPDATE` que não bate em nenhuma linha não gera `error` no
Supabase, então a auditoria (`registrarAcao`) estava sendo gravada mesmo
quando o resync não aconteceu de verdade. Corrigido com `.select("id")
.maybeSingle()`, o mesmo padrão já usado no CAS de
`iniciarOnboardingFinanceiro`. (2) `linhaParaConta()` não mapeava
`provider_status = 'bloqueada'` para `EstadoOnboarding = 'bloqueada'` —
caía no `else` genérico e virava `'nao_iniciada'`, escondendo o estado
bloqueado da própria função que lê o estado atual.

### Webhooks — os 3 ramos que faltavam

`BANK_ACCOUNT_INFO_*`, `COMMERCIAL_INFO_*` e `DOCUMENT_APPROVED` (que a
Fase 2 deixou reconhecidos mas sem handler) agora dependem de
`sincronizarStatusFinanceiro()`: o nome do evento não carrega o valor
final do jeito que `GENERAL_APPROVAL_*` carrega, então a única ação
honesta é usá-lo como gatilho para consultar o estado real, não fabricar
um valor a partir do nome do evento.

### UI

`ContaFinanceira.tsx` parou de duplicar a lógica de estado (a função
`textoDoEstado()` local foi substituída por uma chamada a
`descricaoDoEstado()` do domínio) e ganhou: lista de documentos
pendentes com link `onboardingUrl` quando a conta está com documentação
pendente; botão "Verificar status agora" (chama
`sincronizarContaFinanceira()`) para conta `criada` ainda não aprovada;
botão "Verificar novamente" (chama `reconciliarContaFinanceiraAcao()`)
para conta presa em `criando`/`recusada`; estado `bloqueada` com link de
suporte, sem tentativa automática de nada.

### Testes — `tools/teste-reconciliacao-financeira.ts`, 32/32

9 de domínio puro (`estadoConceitual` nos 8 estados incluindo a
distinção "documentação pendente" vs. "em análise" vs. "fila de
aprovação"). 3 de transições incluindo `bloqueada`. 3 de
`descricaoDoEstado` confirmando que nenhum token técnico (`PENDING`,
`REJECTED`, `APPROVED`) vaza pro texto da UI. 1 de sincronização sem
credencial (Asaas indisponível, real). 8 de reconciliação cobrindo
as duas classes, empresa sem documento, empresa inexistente e conta já
`criada` (no-op). 2 de concorrência real via `Promise.all` (é o teste
que pegou o bug do CAS acima). 1 de tenant isolation. 3 de webhook:
evento reconhecido não derruba o processamento mesmo sem credencial de
subconta, fica marcado como processado, e reenviá-lo é idempotente. 1
de limpeza.

### Regressão — 213/213, nenhuma quebra

Os 181 anteriores (`teste-fase4` 29 · `teste-fase5` 16 · `teste-fase6`
35 · `teste-rls-empresas` 14 · `teste-limite-plano` 12 ·
`teste-core-financeiro` 47 · `teste-onboarding-financeiro` 28) + os 32
novos desta fase. Typecheck limpo, build exit 0, mesmas 32 rotas.

### O que NÃO foi feito, de propósito

Upload de documento via API continua fora de escopo (contrato não
confirmável). `sincronizarStatusFinanceiro`/`reconciliarContaFinanceira`
não têm disparo automático por cron — só pelo botão manual na tela e
pelo webhook de conta; um cron de reconciliação periódica fica para
quando a Fase 9 (webhooks + reconciliação financeira mais ampla) tratar
disso de forma mais geral, cobrindo também autorização/instrução/
pagamento, não só a conta. Cobrança real, autorização Pix Automático e
instrução de pagamento seguem para as próximas fases.

## 49. Core financeiro — Fase 4: Cliente Zelo ↔ Asaas (31/08/2026)

### Auditoria antes de implementar

`lib/asaas/cliente.ts` já existia (Fase 5 antiga, pré-Core-Financeiro):
`criarClienteAsaas`, `buscarClientePorCpfCnpj`, `buscarClientePorEmail`,
`obterClienteAsaas`, `atualizarClienteAsaas` — todas já aceitam
`credencial` opcional. `clientes.asaas_customer_id` e o índice único
parcial `clientes_asaas_customer_id_unico` já existiam desde a
`fase7_fundacao_core_financeiro` (Fase 1). Nada disso precisou ser
recriado — só faltava o caso de uso que orquestra a chamada.

### Novo: `lib/core/cliente-financeiro.ts`

`sincronizarClienteFinanceiro(clienteId, empresaId, usuarioId?, criador?,
buscador?)` — mesmo padrão de compare-and-swap das fases anteriores:
`UPDATE clientes SET asaas_sync_status='sincronizando' WHERE
asaas_sync_status IN ('pendente','erro') AND asaas_customer_id IS NULL`
só afeta a linha se ninguém mais estiver sincronizando aquele cliente.
Antes de criar, busca por `externalReference = cliente.id` (não por
`cpfCnpj` sozinho — o Asaas não impõe unicidade de documento em
`/customers`) para recuperar uma criação anterior cuja resposta se
perdeu, em vez de duplicar. `criador`/`buscador` são injetáveis só para
teste, mesmo padrão de `CriadorDeSubconta`/`BuscadorDeSubconta`.

`registrarAcaoFinanceira` foi extraído de `lib/core/onboarding.ts` para
`lib/core/auditoria.ts` (era função privada duplicável, agora
compartilhada pelas duas fases).

### Banco — 1 migration nova + 1 de segurança

`fase10_sincronizacao_cliente_asaas`: `clientes.asaas_sync_status`
(check `pendente|sincronizando|sincronizado|erro`, default `pendente`).
`fase10_restringe_grants_sincronizacao_cliente`: **gap de segurança
encontrado nesta fase** — `authenticated` e `anon` tinham INSERT/UPDATE
diretos em `clientes.asaas_customer_id` e `asaas_sync_status`, o que
permitiria forjar o vínculo financeiro via REST API direto (mesma classe
de problema que a Fase 6 já tinha corrigido em `empresas.provider_*`,
mas que nunca tinha sido replicado para `clientes`). Revogado — agora só
`service_role` grava essas duas colunas.

### Bug corrigido de graça: timeout inexistente em `asaasRequisicao`

`lib/asaas/cliente-api.ts` não tinha nenhum timeout — um `fetch` sem
`AbortController` podia travar para sempre. Adicionado timeout de 15s
(configurável por chamada), retornando `status: 504` — usado por toda
chamada ao Asaas do sistema inteiro, não só por esta fase. Encontrado
porque a Fase 4 exige teste de "timeout" como categoria obrigatória, e
não havia nenhum mecanismo real para testar.

### Fluxo de integração no produto

`criarCliente()` (Server Action do CRM) dispara a sincronização
best-effort logo após o INSERT local — nunca bloqueia o cadastro: sem
conta financeira conectada, o cliente é salvo normalmente e fica
`asaas_sync_status='erro'` (ou `'pendente'`), retentável depois.
`atualizarCliente()` propaga edições (nome/e-mail/whatsapp/documento)
para o Asaas quando o cliente já está sincronizado — também best-effort,
nunca bloqueia a edição local. Nova ação manual de retry
`sincronizarClienteAsaasAcao(clienteId)` para quando a automática falhou.
Cliente arquivado não pode ser (re)sincronizado.

### Testes — `tools/teste-cliente-financeiro.ts`, 25/25

1 de integração real sem credencial (Asaas indisponível, sem mock). 2 de
validação (cliente inexistente, cliente arquivado). 4 de sucesso
mockado (grava id, log de auditoria, banco reflete estado). 2 de
idempotência (chamar de novo não rechama o Asaas). 2 de erro/timeout
(não fica preso em `sincronizando`). 1 de retry após erro. 3 de
resposta perdida (recupera por `externalReference` em vez de duplicar).
2 de concorrência real via `Promise.all` — confirma o mesmo contrato do
CAS de onboarding: quem perde a corrida recebe conflito, não erro nem
duplicata. 2 de IDs únicos (dois clientes diferentes, dois
`asaas_customer_id` diferentes; banco recusa duplicata via índice). 2 de
segurança (tenant isolation; cliente anônimo não forja
`asaas_customer_id` — confirma a correção de grants desta fase). 3
estruturais confirmando a regra de camadas.

### Regressão — 238/238, nenhuma quebra

Os 213 anteriores + os 25 novos desta fase. Typecheck limpo, build exit
0, mesmas 32 rotas. Advisories de segurança do Supabase: os mesmos 5 já
conhecidos — nenhum novo (a correção de grants desta fase não é
capturada pelo advisor automático, só pelos testes de RLS/grants).

### O que NÃO foi feito, de propósito

Nenhuma cobrança real ainda — esta fase é só o vínculo Cliente↔Asaas,
não `Cobrança`. Sincronização de cliente não roda em cron nem em lote
para clientes já existentes antes desta fase (eles ficam
`asaas_sync_status='pendente'` até serem editados ou até uma rotina de
backfill futura ser explicitamente pedida). Cobrança → Asaas segue para
a próxima fase.

## 50. Core financeiro — Fase 5: Cobrança Zelo ↔ Asaas (31/08/2026)

### Pesquisa confirmada contra a documentação oficial

`POST /v3/payments`: campos obrigatórios `customer`, `billingType`
(`UNDEFINED|BOLETO|CREDIT_CARD|PIX`), `value`, `dueDate` (`YYYY-MM-DD`);
opcionais incluem `description`, `externalReference`,
`pixAutomaticAuthorizationId` (não usado nesta fase — é da Fase 6).
**Sem idempotency-key ou mecanismo de retry-safety documentado do lado
do Asaas** — confirmado por consulta direta; a idempotência é
responsabilidade exclusiva do Zelo (compare-and-swap local + dedup por
`externalReference`, mesma estratégia da Fase 4). `GET /v3/payments`
aceita `externalReference` como filtro — confirmado, é o mecanismo de
reconciliação desta fase. Enum de status confirmado (`PENDING`,
`RECEIVED`, `CONFIRMED`, `OVERDUE`, `REFUNDED`, etc.) — já existia em
`lib/asaas/tipos.ts` desde antes desta fase, sem divergência relevante
encontrada.

### Achado: metade da ponte já existia

`lib/asaas/webhook.ts` já processava `PAYMENT_RECEIVED`,
`PAYMENT_CONFIRMED`, `PAYMENT_DELETED`, `PAYMENT_RESTORED` para
`cobrancas` — de uma fase anterior à criação do Core Financeiro. Faltava
só a CRIAÇÃO (`POST /payments` + persistir `asaas_payment_id`), que é o
que esta fase entrega. O webhook já esperava `externalReference =
cobranca.id`; a estratégia de dedup desta fase nasceu compatível sem
precisar tocar no webhook.

### Novo: `lib/core/cobranca-financeira.ts`

`sincronizarCobrancaFinanceira(cobrancaId, empresaId, usuarioId?,
criador?, buscador?)` — mesmo compare-and-swap das fases anteriores.
Pré-condições, em ordem: cobrança existe e está `pendente`/`enviada`
(não paga/cancelada); empresa tem subconta conectada; cliente existe,
não está arquivado; cliente tem `asaas_customer_id` — se não tiver, esta
fase **reaproveita a Fase 4** chamando `sincronizarClienteFinanceiro`
antes de prosseguir, em vez de duplicar a lógica ou exigir que o
profissional sincronize o cliente manualmente primeiro. Dedup via busca
por `externalReference = cobranca.id` antes de criar (resposta perdida).
`cancelarCobrancaFinanceira(cobrancaId, empresaId, usuarioId?,
cancelador?)` — só marca `cancelada` localmente DEPOIS que o Asaas
confirma (ou responde 404, que é tratado como "já não existe mais lá",
retry seguro); se o Asaas falhar de verdade, o status local não muda —
nunca mostra "cancelada" para o profissional enquanto o Asaas ainda
pode cobrar o cliente dele.

### Separação de eixos (regra central desta fase)

`cobrancas.status` (comercial: `pendente|enviada|paga|cancelada`) NUNCA
é tocado por `sincronizarCobrancaFinanceira` — só o webhook marca
`'paga'`, e só quando o Asaas confirma de verdade. `asaas_sync_status`
(novo, técnico: `pendente|sincronizando|sincronizado|erro`) é o único
lugar que sabe "esse payment existe no Asaas?". Importante:
`status='enviada'` já existia ANTES desta fase com outro significado —
"o profissional avisou o cliente por fora" (ação manual, botão próprio,
nada a ver com Asaas) — por isso não foi reaproveitado como sinal
técnico, o que teria misturado dois conceitos diferentes sob o mesmo
valor.

### Banco — 1 migration de schema + 1 de correção de segurança

`fase11_sincronizacao_cobranca_asaas`: `cobrancas.asaas_sync_status`
(mesmo padrão de `clientes.asaas_sync_status`, Fase 4).

**Bug de segurança real encontrado e corrigido nesta fase — retroage à
Fase 4:** `clientes` e `cobrancas` tinham `GRANT INSERT`/`GRANT UPDATE`
de TABELA INTEIRA (sem lista de colunas) para `authenticated`/`anon` —
diferente de `empresas`, que só tem colunas específicas concedidas. Em
Postgres, privilégio de tabela inteira e privilégio por coluna são
ADITIVOS: o `REVOKE UPDATE (coluna)` que a Fase 4 fez em `clientes`
**não tinha efeito nenhum**, porque o grant de tabela inteira continuava
valendo por baixo. O teste de segurança da Fase 4 "passou" pelo motivo
errado — usava a chave `anon` sem sessão, que RLS já bloqueia para
qualquer coluna, então não provava que o grant funcionava.

Encontrado ao tentar aplicar a mesma proteção em `cobrancas` nesta fase
e notar, por auditoria direta de `information_schema.table_privileges`,
que a tabela tinha `GRANT UPDATE` sem lista de colunas. Corrigido para
as DUAS tabelas de uma vez (migration
`fase11_corrige_grants_tabela_ampla_clientes_cobrancas`): revogado
INSERT/UPDATE de tabela inteira, reconcedido só nas colunas que os
Server Actions RLS-scoped (`clientes/acoes.ts`, `cobrancas/acoes.ts`,
`recorrencias/acoes.ts`) realmente gravam hoje — auditado arquivo por
arquivo antes de escrever a lista. `asaas_customer_id`/`asaas_sync_status`
(clientes) e `asaas_payment_id`/`asaas_sync_status` (cobrancas) ficam de
fora da lista — só `service_role` grava essas quatro colunas daqui em
diante. **Verificado com uma sessão autenticada real** (não `anon`) —
dono legítimo da linha, que passa por RLS mas é barrado pelo GRANT de
coluna com erro `42501`, e ainda consegue editar uma coluna legítima
normalmente. Os testes da Fase 4 (`teste-cliente-financeiro.ts`) foram
corrigidos para usar esse mesmo método, substituindo a prova fraca
anterior.

### Fluxo de integração no produto

`criarCobranca()` dispara a sincronização best-effort após o INSERT —
nunca bloqueia o cadastro. `gerarProximoCiclo()` e a primeira cobrança
de `criarRecorrencia()` (em `recorrencias/acoes.ts`) também disparam a
sincronização — criar uma cobrança via recorrência é, para este efeito,
o mesmo evento que criar uma avulsa. `cancelarCobranca()` agora chama
`cancelarCobrancaFinanceira()` em vez de só marcar o status local. Nova
ação manual de retry `sincronizarCobrancaAsaasAcao(cobrancaId)`.

### Testes — `tools/teste-cobranca-financeira.ts`, 44/44

1 de integração real sem credencial. 3 de validação de estado
(inexistente, já paga, já cancelada). 2 de validação de cliente
(arquivado; sem `asaas_customer_id` — confirma que tenta auto-sincronizar
via Fase 4 e propaga falha real, sem fingir sucesso). 5 de sucesso
mockado (grava id, não toca `status` comercial, log de auditoria). 2 de
idempotência. 9 de erro Asaas (4xx/5xx/timeout × devolve
`integracao_externa` / não trava em `sincronizando` / retry funciona). 3
de resposta perdida. 2 de concorrência real via `Promise.all`. 2 de IDs
únicos (índice único barra duplicata). 6 de cancelamento (local-only,
chama o Asaas quando sincronizada, NÃO cancela localmente se o Asaas
falhar, retry idempotente com 404). 3 de segurança (tenant isolation;
dono real não forja `asaas_payment_id`; ainda edita coluna legítima). 5
estruturais de camadas.

### Regressão — 283/283, nenhuma quebra

Os 239 anteriores + os 44 novos desta fase. Typecheck limpo, build exit
0, mesmas 32 rotas. Advisories de segurança do Supabase: os mesmos 5 já
conhecidos — nenhum novo (a correção de grants desta fase não é
capturada pelo advisor automático, só pelos testes com sessão real).

### O que NÃO foi feito, de propósito

Autorização Pix Automático, QR Code de consentimento, instrução de
pagamento e fluxo completo de recorrência financeira — explicitamente
fora de escopo desta fase, seguem para a Fase 6. Nenhuma cobrança
financeira real foi criada em produção (sem `ASAAS_API_KEY`
configurada, todo teste rodou com credencial/DI simulados).

## 51. Core financeiro — Fase 6: Pix Automático, autorização + primeiro pagamento (01/09/2026)

### Pesquisa confirmada contra a documentação oficial (não reaproveitou pesquisa antiga)

`POST /v3/pix/automatic/authorizations`: obrigatórios `customerId`,
`frequency` (`WEEKLY|MONTHLY|QUARTERLY|SEMIANNUALLY|ANNUALLY`),
`contractId` (máx. 35 chars — um UUID com hífens tem 36, por isso a
Zelo usa o UUID da recorrência SEM hífens), `startDate`,
`immediateQrCode` (com `originalValue`+`expirationSeconds`
obrigatórios). Resposta: `payload`/`encodedImage` são campos de
PRIMEIRO NÍVEL (não aninhados em `immediateQrCode`, que na resposta só
tem `conciliationIdentifier`/`expirationDate`). `GET .../{id}`
(consulta), `DELETE .../{id}` (cancelamento), `GET
.../?customerId=` (listagem — sem filtro por `contractId`, filtrado em
memória) — todos confirmados. Sem idempotency-key do lado do Asaas,
igual às Fases 4–5.

**Achado não previsto pela arquitetura**: o payload de webhook de
`PIX_AUTOMATIC_RECURRING_AUTHORIZATION_*` não traz `account` como todo
outro evento v3 traz (confirmado no exemplo oficial de
`ACTIVATED`). Resolvido em `lib/asaas/webhook.ts`: tenant resolvido por
`authorization.id` → `autorizacoes_pix.empresa_id` (a linha só existe
porque o próprio Zelo a criou com a credencial daquela subconta —
confiável do mesmo jeito que `account.id` seria, por um caminho
diferente), com conferência cruzada contra `account.id` quando presente.

### DECISÃO paymentCreationMode: MANUAL

Confirmado com a doc real: em `MANUAL` "sua aplicação cria cada
cobrança recorrente pela API"; em `SUBSCRIPTION` "as cobranças são
geradas automaticamente por uma assinatura" e a Zelo não deveria criar
nada. A Zelo já tem motor de recorrência próprio (`gerarProximoCiclo`,
Fase 4) e camada de cobrança↔Asaas (`sincronizarCobrancaFinanceira`,
Fase 5) — `SUBSCRIPTION` duplicaria esse controle com um segundo motor
de agenda (o do Asaas), complicaria reconciliação e tiraria da Zelo o
controle de pausar/editar por ciclo que o produto já tem. `MANUAL` é
literalmente o que as Fases 4–5 já constroem; esta fase só liga a
autorização a esse fluxo existente. Fixo no código, nunca escolhido em
runtime.

### Novo: `lib/core/autorizacao-pix.ts` + `lib/asaas/autorizacao-pix.ts`

`criarAutorizacaoPix(recorrenciaId, empresaId, usuarioId?, criador?,
listador?)`: valida recorrência ativa sem autorização viva, cliente não
arquivado (auto-sincroniza via Fase 4 se ainda não tiver
`asaas_customer_id`), conta com `prontaParaCobrar()` (Fase 3) e
credencial conectada. Idempotência com um mecanismo NOVO em relação às
Fases 2–5: como não existe linha de `autorizacoes_pix` antes da chamada
ao Asaas, o lock pré-chamada vive em
`recorrencias.autorizacao_solicitada_em` (TTL de 2min — nova coluna,
migration `fase12_autorizacao_pix_lock_e_grants`). Antes de criar,
SEMPRE busca no Asaas por uma autorização com o mesmo `contractId`
(resposta perdida/retry), nunca cria cegamente — o índice único parcial
`autorizacoes_pix_uma_viva_por_recorrencia` (já existia desde a Fase 1)
é a rede de segurança final no banco.

`sincronizarStatusAutorizacaoPix()`: consulta ativa (pull), complementa
o webhook. `cancelarAutorizacaoPix()`: distinto de cancelar cobrança
(Fase 5) e de encerrar recorrência (CRM) — revoga o consentimento, não
a cobrança nem a recorrência em si.

### QR Code / primeiro pagamento

`payload` (copia-e-cola) e `encodedImage` (QR em base64) são devolvidos
pro frontend só na criação/recuperação — nunca persistidos no banco
(a regra explícita da fase: "não salvar payload inteiro do Asaas sem
necessidade"). **Confirmado por teste**: o status devolvido na criação
é sempre `CREATED`, nunca `ACTIVE` — a autorização só vira `ACTIVE`
por webhook (`ACTIVATED`) ou reconciliação, nunca pela resposta síncrona
da criação. Nenhuma tabela nova de "pagamento" foi criada para o QR
imediato nesta fase — representá-lo como `pagamentos`/`instrucoes_pagamento`
pertence à Fase 7 (instrução de pagamento), que também não foi
implementada aqui, como pedido.

### Webhook — eventos de AUTORIZAÇÃO

`lib/asaas/webhook.ts` ganhou `processarEventoAutorizacaoPix()`: mapeia
`CREATED|ACTIVATED|CANCELLED|EXPIRED|REFUSED` pros 5 valores reais de
`StatusAutorizacao`, valida a transição com as MESMAS regras de
`lib/core/autorizacao.ts` (`transicaoValida`/`origemPermitida` — o
webhook não decide sozinho o que é uma transição legítima), reenvio do
mesmo estado é idempotente (no-op), transição inválida é recusada e
logada (não aplicada). Ao chegar num estado terminal (`CANCELLED`,
`EXPIRED`, `REFUSED`), libera `recorrencias.autorizacao_atual_id` de
volta pra `null` — a recorrência pode pedir uma nova autorização depois.
`PIX_AUTOMATIC_RECURRING_ELIGIBILITY_UPDATED` é só reconhecido/auditado
(o próprio Asaas já cancela as autorizações afetadas, que chegam como
`CANCELLED` normais).

### Reconciliação

`sincronizarStatusAutorizacaoPix()` cobre os 3 cenários pedidos: Zelo
`CREATED`/Asaas `ACTIVE` (consulta e atualiza), Zelo sem autorização/
Asaas com autorização (coberto na CRIAÇÃO, não numa reconciliação
separada — a busca por `contractId` já acontece sempre antes de criar),
Zelo `ACTIVE`/Asaas `CANCELLED` (consulta detecta e aplica a
transição). Usa as mesmas guardas de transição do webhook — reconciliação
não pode fazer uma transição que o domínio não permite.

### Bug de segurança real encontrado e corrigido nesta fase

Mesma classe de bug da Fase 5 (grant de tabela inteira, aditivo ao de
coluna): `recorrencias` E `autorizacoes_pix` tinham `GRANT INSERT`/
`GRANT UPDATE` de tabela inteira para `authenticated`/`anon`. Corrigido
na mesma migration que adicionou o lock (`fase12_autorizacao_pix_lock_e_grants`):
`recorrencias` ganhou grants por coluna (só as que
`recorrencias/acoes.ts` realmente grava); `autorizacoes_pix` não tem
NENHUM Server Action RLS-scoped gravando nela hoje, então ficou sem
nenhum grant de INSERT/UPDATE pra `authenticated`/`anon` — só
`service_role`, mesmo padrão de `log_acoes_financeiras`/`eventos_asaas`
desde a Fase 1. Verificado com sessão autenticada real (dono legítimo
da recorrência tentando alterar `status` de `autorizacoes_pix` direto:
`42501`).

### UI

`app/(app)/app/recorrencias/AutorizacaoPix.tsx` (novo componente,
embutido na ficha da recorrência quando `status === 'ativa'`): os 6
estados pedidos (antes/aguardando com QR/ativa/recusada/expirada/
cancelada), botão de copiar o Pix copia-e-cola, "verificar status
agora" (chama a reconciliação), cancelar. Nunca mostra JSON bruto nem
qualquer campo administrativo do Asaas.

### Testes — `tools/teste-autorizacao-pix.ts`, 46/46

1 de domínio (regressão de estado impossível). 1 de integração real sem
credencial. 2 de conta não apta. 4 de validação (recorrência
inexistente/pausada, cliente arquivado, autorização já existente). 4 de
sucesso mockado (QR devolvido, status `CREATED` ≠ `ACTIVE`, recorrência
vinculada e lock liberado, auditoria). 2 de idempotência. 6 de erro
Asaas (4xx/timeout × falha certa/destrava/retry funciona). 3 de
resposta perdida. 2 de concorrência real via `Promise.all` (aceita os
dois desfechos válidos da perdedora — conflito OU sucesso idempotente,
dependendo de quem termina primeiro; só a contagem de chamadas ao Asaas
prova a exclusão mútua). 15 de webhook (CREATED/ACTIVATED/REFUSED/
CANCELLED/EXPIRED, duplicado, fora de ordem, tenant desconhecido,
recorrência liberada nos estados terminais). 3 de cancelamento via caso
de uso. 2 de segurança (tenant isolation; sessão real não altera status
direto). 3 estruturais de camadas.

### Regressão — 329/329, nenhuma quebra

Os 283 anteriores + os 46 novos desta fase. Typecheck limpo, build exit
0, mesmas 32 rotas. Advisories de segurança do Supabase: os mesmos 5 já
conhecidos — nenhum novo.

### O que NÃO foi feito, de propósito

Instruções de pagamento dos ciclos futuros, scheduler de pagamento,
nova cobrança mensal automática vinculada à autorização, dashboard
financeiro, notificações, billing da própria Zelo — tudo explicitamente
fora de escopo, como pedido. **Gap real, não resolvido nesta fase**:
`encerrarRecorrencia()` não cancela a autorização Pix Automático
associada — uma recorrência encerrada com autorização ativa deixa a
autorização órfã no Asaas. Fica para a Fase 7.

## 52. Core financeiro — Fase 7: ciclos reais + instruções Pix Automático (01/09/2026)

### Pesquisa confirmada contra a documentação oficial

`GET /v3/pix/automatic/paymentInstructions/{id}` (consulta),
`GET /v3/pix/automatic/paymentInstructions?authorizationId=&customerId=&paymentId=&status=`
(listagem — `paymentId` é a correlação mais direta, exatamente o que
`cobrancas.asaas_payment_id` já guarda), `POST
.../paymentInstructions/{id}/retries` (retentativa — wrapper criado,
não usado ainda por nenhum caso de uso). **Confirmado: não existe
endpoint de criação de instrução** — ela nasce automaticamente quando
o Zelo cria o `payment` com `pixAutomaticAuthorizationId` (`POST
/v3/payments`, campo confirmado como válido). Janela operacional
confirmada literalmente: "crie a instrução de pagamento entre 2 e 10
dias úteis antes do vencimento" — dias ÚTEIS, doc não documenta o que
acontece fora da janela (por isso o Zelo trata como precondição
própria, recusada antes de chamar o Asaas).

### Achado importante: o enum de status da Fase 1 estava errado

`lib/core/instrucao-pagamento.ts` (Fase 1) usava
`CRIADA|AGENDADA|RECUSADA|CANCELADA_EXTERNAMENTE` — nomes inventados
antes de qualquer pesquisa de doc, o mesmo problema que
`autorizacoes_pix` já tinha antes da Fase 6 corrigir. O enum real,
confirmado agora: `AWAITING_REQUEST|SCHEDULED|DONE|CANCELLED|REFUSED`.
A tabela nunca teve nenhuma linha gravada até esta fase, então a
correção (migration `fase13_instrucao_pagamento_pix_automatico`) não
exigiu migração de dado — só de schema e do teste que validava o enum
errado (`teste-core-financeiro.ts`, corrigido, 47/47 continua passando).
`DONE` não é sinônimo de "pagamento recebido" — só o webhook de
pagamento (`PAYMENT_RECEIVED`/`CONFIRMED`, já existente desde a Fase 5)
confirma isso; e não existe evento de webhook para `DONE` (só 4 eventos
reais existem: CREATED/SCHEDULED/REFUSED/CANCELLED) — `DONE` só é
descoberto por reconciliação (consulta ativa).

### Novo: `lib/asaas/instrucao-pagamento.ts` + `lib/core/instrucao-pagamento-pix.ts`

`prepararCicloPixAutomatico(recorrenciaId, empresaId, usuarioId?, ...)`:
valida recorrência ativa com autorização `ACTIVE` vinculada, calcula o
próximo vencimento (reaproveita `calcularPrimeiroVencimento`/
`calcularProximoVencimento` da Fase 4, sem duplicar), respeita a janela
de 2–10 dias úteis (função de domínio nova, `janelaDeEnvio`/
`diasUteisAte`), cria a cobrança, chama
`sincronizarCobrancaFinanceira` (Fase 5, agora aceitando
`pixAutomaticAuthorizationId` opcional — assinatura por opções no
final, zero mudança nos 17 call-sites existentes) e descobre a
instrução gerada pelo Asaas por `paymentId`.

**Bug real encontrado e corrigido pelos próprios testes desta fase**: a
primeira versão sempre recalculava "o próximo ciclo" a partir da última
cobrança existente — então um RETRY sequencial depois de uma falha
(cobrança já criada localmente, sem `payment_id`) avançava pro MÊS
SEGUINTE em vez de retomar o ciclo que falhou. Corrigido: antes de
calcular um novo ciclo, o caso de uso procura uma cobrança já existente
da recorrência que ainda não foi enviada (`asaas_payment_id IS NULL`) e
retoma ela — só calcula (e valida a janela) pra um ciclo genuinamente
novo.

`sincronizarStatusInstrucao()`: reconciliação (pull), usa `consultor`
quando já tem `asaas_instruction_id`, ou `listador` por `paymentId`
quando ainda não descobriu — mesmas guardas de transição do webhook.

### Banco

`fase13_instrucao_pagamento_pix_automatico`: correção do enum (acima);
novo índice único `cobrancas_ciclo_unico (recorrencia_id, vence_em)` —
não existia antes, é a chave lógica de ciclo que garante no BANCO (não
só na aplicação) que duas execuções concorrentes nunca geram duas
cobranças pro mesmo ciclo; colunas novas em `instrucoes_pagamento`
(`asaas_instruction_id`, `due_date`, `refusal_reason`,
`sincronizado_em`). **Mesmo bug de segurança das Fases 5–6, achado de
novo**: `instrucoes_pagamento` e `pagamentos` tinham grant de tabela
inteira pra `authenticated`/`anon`, sem nenhum Server Action RLS-scoped
escrevendo nelas — corrigido revogando tudo, só `service_role` grava
(mesmo padrão de `autorizacoes_pix`, `log_acoes_financeiras`,
`eventos_asaas`). Verificado com sessão autenticada real: `42501` ao
tentar alterar `instrucoes_pagamento.status` ou forjar uma linha em
`pagamentos`.

### Webhook

4 eventos de instrução (`CREATED/SCHEDULED/REFUSED/CANCELLED`) —
resolução de tenant por `paymentInstruction.paymentId` →
`instrucoes_pagamento.asaas_payment_id` (mesmo achado da Fase 6: o
payload de exemplo não traz `account`). O bloco de pagamento existente
(Fase 5) ganhou a criação de linhas em `pagamentos` quando a cobrança
tem instrução vinculada — nunca toca `instrucoes_pagamento.status`
(entidades deliberadamente separadas, regra explícita da fase).

### Recorrência

`gerarProximoCiclo()` (Server Action) delega inteiramente pro caso de
uso novo quando a recorrência tem `autorizacao_atual_id` — o caminho
antigo (CRM sem Pix Automático) continua idêntico, zero mudança pra
quem não ligou a autorização.

### UI

`CicloInstrucao.tsx` (novo, na ficha da recorrência): estados da
instrução (aguardando/agendada/recusada com motivo/cancelada/
processada) e "✓ Recebido" — que só aparece quando a COBRANÇA está paga
(nunca inferido do status da instrução).

### Testes — `tools/teste-instrucao-pix.ts`, 67/67

7 de janela operacional (dias úteis, função pura — cobre os limites de
2 e 10 exatos, fim de semana, vencimento no passado). 5 de domínio
(máquina de estados, regressão do enum corrigido). 1 de integração real
sem credencial. 3 de validação (recorrência sem autorização, autorização
não ativa). 7 de sucesso normal (payment ID, instrução encontrada,
payload correto, status COMERCIAL da cobrança intocado). 2 de
idempotência. 1 de descoberta pendente (placeholder sem id externo). 3
de janela (fora da janela não chama o Asaas). 5 de erro/retry (o bug
acima, pego aqui). 2 de resposta perdida. 3 de concorrência real via
`Promise.all`. 15 de webhook (4 eventos reais + duplicado + fora de
ordem + tenant desconhecido + instrução inexistente). 7 de pagamento
(linha criada só com vínculo real, valores calculados do `netValue`,
instrução não tocada, sem duplicar). 4 de reconciliação (transição
válida vs. impossível). 3 de segurança. 3 estruturais de camadas.

### Regressão — 396/396, nenhuma quebra

Os 329 anteriores + os 67 novos desta fase. Typecheck limpo, build exit
0, mesmas 32 rotas. Advisories de segurança do Supabase: os mesmos 5 já
conhecidos — nenhum novo.

### O que NÃO foi feito, de propósito

Retentativa de instrução recusada (`criarRetentativaInstrucaoAsaas`
existe como wrapper em `lib/asaas/instrucao-pagamento.ts`, mas nenhum
caso de uso a usa ainda — decisão de escopo, não esquecimento).
Scheduler automático (cron) que chama `prepararCicloPixAutomatico`
sozinho — hoje é sempre acionado pelo usuário via
`gerarProximoCiclo()`. **Gap que segue sem solução**, já sinalizado na
Fase 6 e repetido aqui: `encerrarRecorrencia()` continua sem cancelar a
autorização Pix Automático associada.

---

## 53. Core financeiro — Fase 8: recorrência financeira real (01/09/2026)

**Objetivo:** fechar a integração fim-a-fim do motor de recorrência
(autorização → ciclo → cobrança → instrução → pagamento) e corrigir o
gap sinalizado nas Fases 6 e 7: `encerrarRecorrencia()` não tratava a
autorização Pix Automático associada.

### Pesquisa confirmada

`docs.asaas.com/reference/cancelar-uma-autorizacao-pix-automatico`
(01/09/2026): cancelar a autorização (`DELETE
/v3/pix/automatic/authorizations/{id}`) cancela automaticamente
instruções já agendadas — não precisa tratar instrução manualmente ao
encerrar, o webhook (Fase 7) já espelha isso quando o evento chegar.
`docs.asaas.com/reference/criar-uma-autorizacao-pix-automatico`:
`value` (sempre enviado pela Zelo, `criarAutorizacaoPix`) é um valor
FIXO — "todas as cobranças criadas para essa autorização devem
utilizar esse valor"; para mudar o valor, "cancele a atual e crie uma
nova" (não existe endpoint de alteração).

### Novo: `lib/core/recorrencia-financeira.ts`

Módulo de domínio novo (o gap das Fases 6–7 tinha virado lógica de
negócio dentro de `acoes.ts`, quebrando a camada estabelecida desde a
Fase 2 — corrigido aqui). Três funções:

- **`encerrarRecorrenciaFinanceira`**: antes de marcar `encerrada`,
  cancela toda cobrança em aberto (pendente/enviada) da recorrência
  via `cancelarCobrancaFinanceira` (Fase 5), e cancela a autorização
  Pix Automático se ela ainda estiver viva (`estaViva`, evita chamar o
  Asaas de novo numa autorização já morta por corrida com o webhook)
  via `cancelarAutorizacaoPix` (Fase 6). Se qualquer cancelamento
  falhar, a recorrência NÃO é marcada como encerrada — mesmo princípio
  de `cancelarCobrancaFinanceira`: não fingir que parou algo que ainda
  pode estar ativo no Asaas. Registra `recorrencia_encerrada` na
  auditoria.
- **`valorBloqueadoPelaAutorizacao`** (pura): usada por
  `atualizarRecorrencia()` pra bloquear cedo a edição de valor quando
  há autorização ativa — em vez de deixar o Asaas rejeitar a cobrança
  meses depois, obscuramente, no próximo ciclo.
- **`jaTeveAutorizacaoPix`**: usada por `gerarProximoCiclo()` pra
  recusar o fallback silencioso pro caminho manual (CRM puro) quando a
  autorização Pix Automático morreu (cancelada pelo pagador, recusada,
  expirada — o webhook já zera `autorizacao_atual_id` nesses casos) e
  ninguém pediu uma nova. Sem essa checagem, o profissional continuaria
  achando que está recebendo por Pix Automático enquanto a Zelo
  silenciosamente gerava cobrança manual.

`app/(app)/app/recorrencias/acoes.ts` ficou mais fino: `encerrarRecorrencia()`,
`atualizarRecorrencia()` e `gerarProximoCiclo()` delegam pro módulo
novo em vez de conter a lógica inline.

### Achado de segurança (fora do escopo original, corrigido por estar
diretamente relacionado ao ciclo de vida da recorrência)

Auditando o caminho de leitura do novo código, achamos que `clientes`,
`cobrancas` e `recorrencias` tinham política de RLS permitindo
**DELETE direto** por qualquer membro da empresa (`eh_membro(empresa_id)`,
sem nenhuma outra restrição). Nenhuma Server Action jamais chama
`.delete()` nessas tabelas — o produto inteiro é construído sobre
transição de status (arquivado/cancelada/encerrada). Um DELETE direto
pelo cliente Supabase apagaria o registro local de uma cobrança ou
recorrência enquanto o payment ou a autorização Pix Automático
correspondente ainda existe ATIVA no Asaas — órfã, sem trilha de
auditoria, sem jeito de cancelar depois. Corrigido em
`fase14_remove_delete_perigoso_e_grants_orfaos_core_financeiro`:
`DROP POLICY` nas três, mais `REVOKE DELETE, TRUNCATE, REFERENCES,
TRIGGER` de `authenticated`/`anon` nelas e em `autorizacoes_pix`,
`instrucoes_pagamento`, `pagamentos` (mesmo padrão de over-grant das
Fases 5–7, desta vez em privilégios que não são INSERT/UPDATE — TRUNCATE
em especial não é filtrado por RLS, é operação de tabela inteira).
`log_acoes_financeiras`/`eventos_asaas` também tinham INSERT/UPDATE de
tabela inteira nunca usados (só SELECT tem policy) — revogado junto.
Verificado com sessão autenticada real: `42501` ao tentar apagar
cliente/cobrança/recorrência. INSERT/UPDATE column-scoped (Fases 5–6)
confirmados intactos antes e depois via `information_schema.role_column_grants`.

### Testes — `tools/teste-recorrencia-financeira.ts`, 36/36

3 de domínio puro (`valorBloqueadoPelaAutorizacao`). 3 de encerramento
simples. 4 de cancelamento de cobranças em aberto (pendente/enviada
canceladas, paga intocada). 5 de cancelamento de autorização viva
(desvincula, marca CANCELLED, chama o cancelador exatamente uma vez).
2 de autorização já morta (não cancela de novo — protege contra a
corrida com o webhook). 2 de falha ao cancelar cobrança (bloqueia,
recorrência continua ativa). 3 de falha ao cancelar autorização
(bloqueia, vínculo intacto). 3 de idempotência/isolamento (já
encerrada, empresa errada, inexistente). 2 de vínculo correto
(`jaTeveAutorizacaoPix`). 4 de segurança (DELETE bloqueado nas três
tabelas + cobrança sobrevive). 4 estruturais de camadas. 1 de limpeza.

### Regressão — 432/432, nenhuma quebra

Os 396 anteriores + os 36 novos desta fase. Typecheck limpo, build
exit 0, mesmas 32 rotas — nenhuma UI nova (Fase 8 é só domínio/
segurança). Advisories de segurança do Supabase: os mesmos 5 já
conhecidos — nenhum novo.

### O que NÃO foi feito, de propósito

Dashboard, notificações e redesign global (fora de escopo, Fases
11/13/16-17). Scheduler automático continua não existindo — ciclos
seguem acionados pelo usuário via `gerarProximoCiclo()`. Retentativa
automática de instrução recusada continua sem caso de uso (Fase 7 já
registrava isso).

---

## 54. Core financeiro — Fase 9: webhooks financeiros + reconciliação completa (01/09/2026)

**Objetivo:** cobrir os eventos de pagamento que faltavam (estorno,
chargeback) e fechar a reconciliação por consulta ativa para a última
entidade que só tinha webhook: cobrança/pagamento (autorização Fase 6,
instrução Fase 7, conta Fase 3 já tinham).

### Pesquisa confirmada

`docs.asaas.com/reference/refund-payment` (01/09/2026): Pix aceita
estorno total ou múltiplos parciais; total muda `payment.status` para
`REFUNDED`, parcial mantém `RECEIVED`/`CONFIRMED` — só o array
`refunds` (já presente, mesmo que `null`, no payload do webhook,
confirmado em `docs.asaas.com/docs/webhook-para-cobrancas`) cresce.
Lista completa de eventos de pagamento levantada em
`docs.asaas.com/docs/payment-events` — `PAYMENT_REFUNDED`,
`PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED`,
`PAYMENT_CHARGEBACK_DISPUTE`, `PAYMENT_AWAITING_CHARGEBACK_REVERSAL`,
`PAYMENT_REFUND_IN_PROGRESS`, `PAYMENT_REFUND_DENIED` já estavam no
enum `AsaasEventType` (de uma fase anterior, corretos mas nunca
tratados) — só `PAYMENT_REFUND_DENIED` faltava no enum, adicionado
agora. Eventos irrelevantes pro billing type fixo da Zelo (`PIX` — cartão,
boleto, análise de risco, dunning) deliberadamente NÃO tratados: não
existe caminho no código que gere esses eventos.

### Novo: estorno como estado comercial real

`cobrancas.status` ganhou `estornada` (migração
`fase15_estorno_de_cobranca`) — distinto de `cancelada`, que hoje só
significa "nunca foi paga". Estorno é dinheiro que ENTROU e voltou:
`pago_em`/`valor_pago_centavos` são preservados (fato histórico), e
`valor_estornado_centavos`/`estornado_em` (colunas novas, sem grant
pra `authenticated`/`anon` — só leitura, escrita é `service_role`)
registram o quanto e quando. `lib/asaas/webhook.ts`: `PAYMENT_REFUNDED`
(total) → `estornada`; `PAYMENT_PARTIALLY_REFUNDED` → continua `paga`,
só soma `valor_estornado_centavos` (a soma do array `refunds` pode
bater o valor total mesmo num evento "parcial" — tratado como estorno
total nesse caso). Chargeback (`CHARGEBACK_REQUESTED`/`DISPUTE`/
`AWAITING_CHARGEBACK_REVERSAL`) e `REFUND_IN_PROGRESS`/`REFUND_DENIED`:
só auditoria, nenhum status novo — são etapas intermediárias não
terminais, inventar um status por etapa seria a mesma "invenção de
etapa" que a arquitetura já proíbe (fica pra Fase 12, com timeline
real). `lib/cobranca.ts`, 4 páginas de UI (badge + filtro) e
`App.module.css` (`.sitEstornada`) atualizados pra refletir o novo
estado — só o necessário pra não quebrar a UI existente, nenhuma tela
nova.

### Novo: `sincronizarStatusCobranca` (`lib/core/cobranca-financeira.ts`)

Reconciliação por consulta ativa, mesmo padrão de
`sincronizarStatusAutorizacaoPix`/`sincronizarStatusInstrucao`:
deliberadamente conservadora, só aplica as MESMAS transições que o
webhook aplicaria, gated pelo status LOCAL atual — uma divergência fora
dessas transições conhecidas (ex.: Asaas diz `PENDING` mas local está
`paga`) não é revertida às cegas, fica como está. Achado ao implementar:
reconciliar uma cobrança RECEIVED com instrução Pix Automático vinculada
também precisa criar a linha em `pagamentos` — senão um webhook perdido
reconciliaria o status mas deixaria a trilha de valor líquido/taxa
permanentemente ausente mesmo depois da "correção". Corrigido: mesma
lógica do webhook, replicada aqui. Server Action nova:
`sincronizarStatusCobrancaAcao` (`app/(app)/app/cobrancas/acoes.ts`) +
botão "Verificar status agora" em `AcoesCobranca.tsx` (só aparece
quando a cobrança já foi enviada ao Asaas).

### Testes — `tools/teste-webhook-reconciliacao-fase9.ts`, 46/46

9 de estorno total (status, valor, data, preservação do histórico,
auditoria, idempotência do reenvio). 4 de estorno parcial. 2 de estorno
parcial que soma o valor total. 3 de estorno sem cobrança `paga`
correspondente (evento fora de ordem — não corrompe, não finge
sucesso). 7 de chargeback (5 eventos × processamento + status intocado
+ auditoria completa). 1 de isolamento (evento da conta errada não
afeta a cobrança). 11 de reconciliação de cobrança (RECEIVED→paga,
paridade com `pagamentos`, REFUNDED→estornada, deleted→cancelada,
já-bate é no-op, divergência não revertida às cegas, sem
`asaas_payment_id`, falha do Asaas). 2 de isolamento/sem-credencial na
reconciliação. 6 estruturais de camadas. 1 de limpeza.

### Regressão — 478/478, nenhuma quebra

Os 432 anteriores + os 46 novos desta fase. Typecheck limpo, build exit
0, mesmas 32 rotas. Advisories de segurança do Supabase: os mesmos 5 já
conhecidos — nenhum novo.

### O que NÃO foi feito, de propósito

Reconciliação de "recorrência" como entidade própria — não existe
objeto Asaas equivalente a uma recorrência Zelo (é conceito só do
Zelo); as partes dela que SÃO externas (autorização, cobrança) já têm
reconciliação própria. Timeline visual de chargeback/estorno na
interface — fica pra Fase 12 (centro financeiro), aqui é só o registro
de auditoria. Eventos de pagamento fora do billing type `PIX` (cartão,
boleto, análise de risco, dunning) permanecem não tratados — nenhum
código gera esses eventos hoje.

---

## 55. Core financeiro — Fase 10: confiabilidade, retries e consistência (01/09/2026)

**Fase de auditoria — nenhuma funcionalidade de negócio nova.** Objetivo:
testar de verdade (não só revisar código) duplo clique, concorrência real,
timeout, resposta perdida, processo interrompido, e corrigir o que for
achado. Quatro achados reais, todos corrigidos:

### 1. Lock `asaas_sync_status='sincronizando'` sem TTL de recuperação

`asaasRequisicao()` nunca lança exceção — todo erro de rede/timeout já
virava `{ok:false}`, que sempre desbloqueia pra `'erro'`. Mas o único
jeito de uma linha ficar presa em `'sincronizando'` PRA SEMPRE — o
PROCESSO cair no meio do caminho (deploy, crash, OOM) entre travar e
destravar — não tinha nenhuma recuperação, ao contrário do lock de
autorização Pix (`autorizacao_solicitada_em`, TTL de 2min, Fase 6).
Corrigido em `sincronizarClienteFinanceiro`/`sincronizarCobrancaFinanceira`:
reaproveitam `atualizado_em` (já existe, já atualizado por trigger em
todo UPDATE — sem migração nova) com o mesmo TTL de 2min. Achado ao
escrever o teste: relógio do processo Node local e do Postgres do
Supabase não são o mesmo relógio (desvio de centenas de ms observado
neste ambiente) — irrelevante pro TTL real de produção (2min é ordens
de magnitude maior), mas exigiu margem generosa no teste.

### 2. `sincronizarClienteFinanceiro`: resposta perdida frágil

Buscava por CPF/CNPJ e filtrava por `externalReference` na memória.
Confirmado em `docs.asaas.com/reference/listar-clientes` (01/09/2026):
`externalReference` é filtro de servidor independente, não precisa de
`cpfCnpj` junto. Trocado pra buscar direto por `externalReference` —
mais robusto (não depende do cliente ter documento nem da formatação
bater), mesma estratégia já usada em cobrança/autorização. Confirmado
também: `cpfCnpj` é obrigatório pra CRIAR um cliente no Asaas — um
cliente sem documento nunca chega a ser criado lá, então nunca era um
caso de resposta perdida real (só uma busca desnecessariamente frágil).

### 3. Achado real de concorrência: `prepararCicloPixAutomatico`

Sob stress de 8 chamadas simultâneas de verdade (não só 3, como a Fase
7 testava) — a checagem de "existe cobrança pendente?" e o cálculo do
próximo vencimento eram DUAS consultas separadas. Entre uma e outra,
uma chamada concorrente podia inserir a linha do ciclo atual (ainda sem
`asaas_payment_id`) — a checagem de pendente já tinha rodado sem ver
nada, mas o cálculo de vencimento (que não filtrava por status de
sincronização) achava essa linha recém-criada e avançava pro MÊS
SEGUINTE, como se o ciclo atual já tivesse sido tratado. Mesma classe
de bug do retry sequencial já corrigido na Fase 7, mas uma variante nova
que só concorrência real expõe. Corrigido unificando as duas consultas
em uma só (`decidirProximoCiclo`, `lib/core/instrucao-pagamento-pix.ts`):
lê a última cobrança uma vez, decide a partir da MESMA linha — não
existe nenhuma → primeiro vencimento; existe mas não sincronizada →
retoma ela; existe e sincronizada → aí sim calcula o próximo.

### 4. Achado real de concorrência: `cancelarAutorizacaoPix`

O UPDATE final que marca `CANCELLED` não checava `count` — duas
chamadas concorrentes que ambas liam a autorização como viva ANTES de
qualquer trava (inofensivo em si: `DELETE` é idempotente no Asaas, 404
já tratado como sucesso) ambas registravam auditoria e reatualizavam
`recorrencias`, mesmo a que perdeu a corrida do CAS local — trilha de
auditoria duplicada pra um único evento real. Corrigido com `count` no
UPDATE: quem não mudou nada localmente não duplica o efeito colateral.
**Risco residual aceito, documentado, não corrigido nesta fase**: o
Asaas ainda pode ser chamado mais de uma vez por múltiplas concorrentes
(sem pré-trava antes da chamada externa, que exigiria um novo estado
intermediário no domínio — fora do escopo "sem funcionalidade nova"
desta fase) — harmless pela idempotência confirmada do `DELETE`, mas
gera chamadas HTTP redundantes sob concorrência real.

### Testes — `tools/teste-confiabilidade-fase10.ts`, 25/25

3 de TTL do lock (cliente destrava após TTL, cliente NÃO destrava
dentro do TTL, cobrança destrava após TTL). 2 de falha do Asaas nunca
deixando lock preso. 4 de concorrência real (8x) em
`sincronizarCobrancaFinanceira`. 3 em `sincronizarClienteFinanceiro`. 3
em `prepararCicloPixAutomatico` (prova direta do achado #3). 3 em
`encerrarRecorrenciaFinanceira`. 4 em `cancelarAutorizacaoPix` direto
(prova direta do achado #4, incluindo a auditoria única). 1 de limpeza.
Regressão completa (`teste-instrucao-pix.ts`, 67/67, e
`teste-cliente-financeiro.ts`, 26/26) confirma que nenhum dos fixes
quebrou os caminhos já testados — inclusive um teste de concorrência
pré-existente em `teste-cliente-financeiro.ts` que nunca tinha recebido
o ajuste de "vencedor ok, perdedor conflito OU já-existia" já aplicado
nas Fases 5–8 (corrigido aqui, mesmo padrão).

### Regressão — 503/503, nenhuma quebra

Os 478 anteriores + os 25 novos desta fase. Typecheck limpo, build exit
0, mesmas 32 rotas. Advisories de segurança do Supabase: os mesmos 5 já
conhecidos — nenhum novo.

### Riscos residuais (auditoria, não corrigidos nesta fase — documentados por decisão)

- **`cancelarAutorizacaoPix` sob concorrência**: ver achado #4 acima —
  chamadas HTTP redundantes ao Asaas possíveis, sem risco financeiro.
- **Banco indisponível**: não simulado com um teste real (derrubar a
  conexão do Supabase em pleno teste não é praticável no ambiente
  atual) — auditoria de código confirma que toda função do core
  financeiro checa `supabaseConfigurado()` cedo e trata erro de
  UPDATE/INSERT explicitamente, mas não há uma prova empírica
  equivalente ao stress de concorrência feito aqui.
- **Processamento assíncrono do webhook**: continua síncrono, dentro da
  própria requisição (decisão já registrada na arquitetura, §10 — "volume
  atual não justifica fila"). Reavaliar se `eventos_asaas` crescer rápido.
- **Reconciliação continua 100% manual** (botão) — sem cron periódico,
  já sinalizado como pendência desde a Fase 9.

---

## 56. Core financeiro — Fase 11: dashboard financeiro de produção (01/09/2026)

**Objetivo:** interface reflete a realidade com dados reais — nenhum
mock, nenhuma projeção inventada. Requisito explícito e recorrente:
nunca misturar pagamento confirmado (Asaas) com registro manual.

### Achado real: não existia como distinguir a origem do pagamento

`cobrancas.status='paga'` era gravado do mesmo jeito pelo webhook
(confirmação real) e por `marcarComoPaga()` (o profissional declarando
"recebi por fora") — sem nenhum sinal de origem sobrevivendo à
gravação. Coluna nova `pago_via` ('asaas'|'manual', NULL enquanto não
paga) fecha isso — migração `fase16_origem_do_pagamento_confirmado` +
grant de coluna pra `marcarComoPaga()` continuar gravando via RLS
(`fase16_grant_pago_via_coluna`). Constraint `cobrancas_pagamento_coerente`
estendida: `status IN ('paga','estornada') ⟺ pago_em E pago_via não
nulos`. Gravado em três lugares: webhook (`PAYMENT_RECEIVED`/
`CONFIRMED` → 'asaas'; `PAYMENT_DELETED`/`RESTORED` → limpa junto com
`pago_em`), `sincronizarStatusCobranca` (Fase 9, reconciliação → 'asaas'),
`marcarComoPaga()` (→ 'manual', e ganhou a auditoria que estava
faltando — achado ao ligar essa distinção no painel).

### Painel novo (`app/(app)/app/page.tsx`)

- **Resumo**: "Recebido no mês" agora é só `pago_via='asaas'` (o número
  confiável) com uma linha secundária discreta "+ R$X registrados
  manualmente", mostrada só quando existe algo assim — nunca somado sem
  indicar. "A receber", "Processando" (cobrança já enviada ao Asaas,
  aguardando confirmação — dado real, não projetado) e "Vencido".
- **Stats compactas**: clientes ativos · recorrências ativas — texto
  inline, não outro cartão.
- **Ações rápidas**: nova cobrança / novo cliente / nova recorrência,
  sempre visíveis (antes só apareciam nos estados vazios).
- **Problemas**: cobrança vencida, falha ao enviar ao Asaas
  (`asaas_sync_status='erro'`), débito automático recusado
  (`instrucoes_pagamento.status='REFUSED'` numa cobrança ainda
  pendente/enviada) — só aparece o que existe, nada de item fixo vazio.
- **Atividade recente**: últimas 6 entradas de `log_acoes_financeiras`,
  com rótulo humano (`ROTULO_ACAO`, ~25 ações mapeadas + fallback
  genérico pra ação nova ainda não mapeada) e tempo relativo. Decisão de
  escopo: sem resolver nome de cliente/cobrança por entrada — evitaria
  N+1 (a tabela não tem FK fixa em `entidade_id`, o tipo muda por
  `acao`).
- **Aviso de conexão**: banner quando `!prontaParaCobrar()` (mesma
  função da Fase 2, não uma regra nova), com CTA pra Configurações.
- **Próximos vencimentos**: mantido (Fase 1), sem mudança de comportamento.

### Performance

12 consultas pequenas em paralelo (`Promise.all`), cada uma agregada
(`count`/`select` de 1 coluna) ou limitada (`.limit(5)`/`.limit(6)`) no
banco — nenhuma traz mais linhas que o necessário, nenhum N+1. Mesmo
padrão que o painel já usava desde a Fase 1, só com mais consultas
pequenas em vez de consultas maiores.

### UX — estados

Loading/erro já cobertos genericamente por `app/(app)/app/loading.tsx`/
`error.tsx` (existentes, não tocados). Vazio "sem cliente" (mantido),
"sem integração" (novo, banner), "sem movimentação" (novo, texto no
bloco Atividade recente), "sem problemas" (novo, texto no bloco
Problemas). Testado em desktop e mobile via Browser MCP com uma conta
de teste seedada e depois removida — 375px não quebra layout (grid dos
4 cartões colapsa pra 1 coluna, já era regra existente da Fase 1;
painel de Problemas/Atividade colapsa pra 1 coluna, regra nova desta
fase).

### Testes — `tools/teste-dashboard-financeiro-fase11.ts`, 19/19

3 de webhook (`pago_via` gravado/limpo certo). 2 de reconciliação. 2 de
constraint do banco (recusa `paga` sem `pago_via`, recusa valor fora do
enum). 2 de segurança (grant de coluna liberado pro dono, valor gravado
certo). 6 estruturais de camadas.

### Regressão — 522/522, nenhuma quebra

Os 503 anteriores + os 19 novos. Typecheck limpo, build exit 0, mesmas
32 rotas. Advisories de segurança do Supabase: os mesmos 5 já conhecidos.

### O que NÃO foi feito, de propósito

"Previsto" como projeção de recorrências ativas × ciclos futuros — não
implementado (decisão de escopo, exigiria simular calendário de cada
recorrência sem estado real por trás; "Processando" cobre o caso real
equivalente). Selo de autorização na ficha do cliente — autorização é
por recorrência, não por cliente, um selo único inventaria uma relação
que não existe no domínio. Cron de reconciliação periódica (Fase 9/10
já sinalizavam isso). Gráfico — mencionado como componente possível na
fase, mas com dados ainda modestos (poucos meses de histórico real em
qualquer conta), um gráfico seria decoração sem sinal — fica pra quando
houver série temporal que valha a pena mostrar.

---

## 57. Core financeiro — Fase 12: centro financeiro (01/09/2026)

**Objetivo:** listagens de verdade (busca/filtros/período/valor/paginação)
pra recebimentos, cobranças, recorrências, autorizações e instruções —
hoje autorização/instrução só eram visíveis uma de cada vez, na ficha
da própria recorrência. Timeline real na ficha da cobrança.

### Telas novas

- **`/app/recebimentos`**: lista `pagamentos` (dinheiro que o Asaas
  confirmou de verdade via Pix Automático — valor líquido e taxa reais,
  não o valor bruto da cobrança). Distinto de propósito de "Cobranças
  pagas": uma cobrança marcada paga manualmente (`pago_via='manual'`,
  Fase 11) nunca aparece aqui, porque não existe linha em `pagamentos`
  pra ela — a ausência É a separação, não uma coincidência. Filtros:
  busca por cliente (embed 2 níveis `pagamentos→instrucoes_pagamento→
  cobrancas→clientes`), período, valor. Paginado.
- **`/app/recorrencias/autorizacoes`**: todas as autorizações Pix
  Automático da empresa, filtro por status. Achado real ao testar a
  consulta de verdade (não só ler o código): quebrava com `PGRST201`
  (relação ambígua) — `autorizacoes_pix` tem duas relações com
  `recorrencias` (a FK direta `recorrencia_id` e a reversa
  `recorrencias.autorizacao_atual_id`, que aponta de volta). Corrigido
  nomeando a constraint explicitamente no embed
  (`recorrencias!autorizacoes_pix_recorrencia_id_fkey!inner(...)`).
- **`/app/recorrencias/instrucoes`**: todas as instruções de pagamento,
  filtro por status — "Recusadas" é a categoria que mais importa (=
  "falhas" pedidas pela fase: cada uma é um ciclo que precisa de
  decisão, a cobrança comercial continua pendente por trás).
- **`/app/cobrancas`**: filtros novos de período (`vence_em`) e valor
  (`valor_centavos`), somando aos já existentes (busca, status).

### Timeline real na ficha da cobrança

"Não inventar etapas": a timeline não é um progress-bar fixo de N
passos — é literalmente o `log_acoes_financeiras` da cobrança e (se Pix
Automático) da instrução vinculada, ordenado por `criado_em`, com só
"Cobrança criada" como item sintético (`cobrancas.criado_em`, uma
coluna real, não inventada). Motivo de recusa (`instrucoes_pagamento.
refusal_reason`) atrás de um `<details>/<summary>` nativo — mesma
disciplina de "não revelar payload bruto sem clique" que
`CicloInstrucao.tsx` já usava (Fase 7), só que sem precisar de
`"use client"` aqui.

### Nav e navegação

"Recebimentos" entrou como item de primeiro nível (paralelo a
"Cobranças" — dinheiro que já caiu, algo que se olha regularmente).
"Autorizações"/"Instruções" não viraram itens de nav — são sub-conceito
de recorrência, linkados a partir de `/app/recorrencias` (decisão de
escopo: evitar poluir a barra lateral com 3 itens nuevos quando 2 deles
são naturalmente alcançados de um lugar só).

### Código compartilhado

`lib/atividade.ts` (novo): `ROTULO_ACAO`/`rotuloAcao`/`tempoRelativo`
extraídos de `app/(app)/app/page.tsx` (Fase 11) — agora reusados também
na timeline da cobrança, ~10 rótulos novos adicionados (chargeback,
reconciliação de autorização, etc. que a Fase 9/10 introduziram e ainda
não tinham entrado no mapa).

### Testes — `tools/teste-centro-financeiro-fase12.ts`, 24/24

5 de recebimentos (lista, período dentro/fora, valor, isolamento). 5 de
autorizações (a consulta com FK nomeada não quebra — regressão do
achado, lista, 2 filtros de status, isolamento). 3 de instruções (lista,
filtro REFUSED, isolamento). 3 de filtros novos de cobrança (período,
valor mín, valor máx). 1 de timeline (reúne eventos de cobrança +
instrução). 6 estruturais de camadas. 1 de limpeza. Todas as consultas
testadas com sessão real (`signInWithPassword`), não `service_role` —
mesma disciplina de isolamento por tenant das fases anteriores.

### Regressão — 546/546, nenhuma quebra

Os 522 anteriores + os 24 novos. Typecheck limpo, build exit 0, 35
rotas (32 + `/app/recebimentos`, `/app/recorrencias/autorizacoes`,
`/app/recorrencias/instrucoes`). Advisories de segurança do Supabase:
os mesmos 5 já conhecidos.

### O que NÃO foi feito, de propósito

Busca por texto em Autorizações/Instruções (só filtro por status) —
decisão de escopo, dado o tempo; o profissional já acha pela ficha da
recorrência/cobrança quando sabe qual é. Ação de "reenviar"/retentativa
a partir da lista de falhas — a fase pediu visibilidade, não uma ação
nova (isso já existe na ficha da cobrança/recorrência, via os botões
"Verificar status agora" das Fases 7/9).

---

## 58. Core financeiro — Fase 13: notificações internas e centro de alertas (02/09/2026)

**Objetivo:** avisar o profissional de eventos financeiros reais — sem
duplicar por reenvio de webhook, sem vazar entre tenants.

### Modelo de dados

Tabela nova `notificacoes` (migração `fase17_notificacoes_internas`):
`id/empresa_id/tipo/titulo/mensagem/prioridade(baixa|media|alta)/lida/
link/chave_idempotencia/criado_em`. `unique(empresa_id,
chave_idempotencia)` é a idempotência — mesmo padrão do resto do
projeto: 23505 é o caminho feliz, tratado como no-op por
`criarNotificacao()`, nunca como erro. RLS: membro lê só as próprias
(`eh_membro`); só a coluna `lida` tem grant de escrita pro
`authenticated` (mesma disciplina de coluna específica das Fases 5-6)
— tipo/mensagem/prioridade/link são decisão do sistema, nunca do
frontend; INSERT/DELETE são `service_role` apenas.

### `lib/core/notificacoes.ts` (novo)

`criarNotificacao` (nunca lança — mesmo princípio de
`registrarAcaoFinanceira`), `marcarComoLida`, `marcarTodasComoLidas`,
`contarNaoLidas`.

### Gatilhos reais ligados

Todos no ponto exato onde o evento acontece de verdade — nenhum é
inventado nem depende de cron:

- **Autorização** (`lib/asaas/webhook.ts`): `ACTIVE` (média),
  `REFUSED`/`EXPIRED` (alta), `CANCELLED` — só quando chega por
  WEBHOOK (o pagador revogou direto no banco dele). Cancelamento pelo
  próprio profissional (`cancelarAutorizacaoPix()`, que grava direto no
  banco sem passar pelo webhook) nunca duplica aviso do que ele mesmo
  já sabe que fez.
- **Instrução**: `SCHEDULED` (baixa), `REFUSED` (alta). `CREATED` e
  `CANCELLED` de propósito não notificam — ruído (o primeiro já foi
  visto ao gerar o ciclo; o segundo normalmente é consequência de uma
  autorização cancelada, já notificada).
- **Pagamento**: `PAYMENT_RECEIVED`/`CONFIRMED` (baixa, cita o valor).
  `PAYMENT_REFUNDED` total (alta).
- **Conta financeira**: `ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED`
  (média) / `REJECTED` (alta) — chave por `evento.id`, não só por
  empresa: a idempotência de "não duplicar o MESMO evento" já vem de
  `eventos_asaas`; usar só `empresaId` impediria uma segunda aprovação
  genuína (rara, mas possível) de notificar de novo.
- **Integração com problema**: falha ao sincronizar cobrança
  (`sincronizarCobrancaFinanceira`) ou cliente
  (`sincronizarClienteFinanceiro`) com o Asaas — chave por dia
  (`{id}:{YYYY-MM-DD}`): uma sequência de retries no mesmo dia (comum —
  o usuário clica "tentar de novo" várias vezes) não vira notificação
  por tentativa, mas uma falha nova amanhã ainda avisa.

### UI

Indicador de não lidas na barra lateral (contagem buscada no próprio
`layout.tsx`, que já é Server Component). `/app/notificacoes`: lista
paginada, filtro todas/não-lidas, "marcar todas como lidas". Clicar
numa notificação marca como lida e navega pro `link` (contextual —
cobrança, recorrência ou configurações, conforme o gatilho) —
`NotificacaoItem.tsx`, mesmo padrão de client component + Server Action
já usado em `AcoesCobranca.tsx`.

### Testes — `tools/teste-notificacoes-fase13.ts`, 31/31

5 de infraestrutura (idempotência, marcar como lida, contagem). 2 de
isolamento (`marcarComoLida` não atravessa tenant). 3 de autorização
via webhook real. 3 de instrução via webhook real. 3 de pagamento/
estorno via webhook real. 2 de conta via webhook real. 3 de falha de
sincronização (cobrança + cliente + não-duplicação no mesmo dia). 5 de
segurança/RLS (leitura, INSERT/DELETE bloqueados, só `lida` gravável).
4 estruturais de camadas. 1 de limpeza. Todos os gatilhos testados
fazendo o evento acontecer de verdade
(`processarEventoWebhook`/`sincronizarCobrancaFinanceira`/
`sincronizarClienteFinanceiro`), nunca inserindo a notificação direto.

### Regressão — 577/577, nenhuma quebra

Os 546 anteriores + os 31 novos. Typecheck limpo, build exit 0, 36
rotas (35 + `/app/notificacoes`). Advisories de segurança do Supabase:
os mesmos 5 já conhecidos — `notificacoes` não aparece como "RLS sem
policy" (as 2 policies foram reconhecidas corretamente).

**Verificação visual não concluída nesta fase**: a automação do
navegador (Browser MCP) não conseguiu completar o login na sessão
usada para QA — o campo de e-mail não recebeu o texto digitado em
repetidas tentativas, um problema do ambiente de automação nesta
sessão, não do código (confirmado: nenhuma requisição de login chegou
ao servidor nos logs). A tela reaproveita exatamente os mesmos
componentes CSS já verificados visualmente na Fase 11 (`.numero`,
`.etiqueta`, `.vazio`, listas), então o risco residual é baixo, mas
fica registrado como verificação pendente.

### O que NÃO foi feito, de propósito

"Cobrança próxima do vencimento" (citada na lista original de eventos)
— não implementada: não existe um gatilho de evento real pra isso sem
um cron (a mesma limitação já documentada nas Fases 9/10/11). Toast/
notificação em tempo real (o indicador só atualiza no próximo
carregamento de página — não há WebSocket nem polling). "Cobrança
criada" como notificação — decisão de escopo: pra criação manual
(single) é ruído (o profissional está olhando pra tela que acabou de
confirmar); pra criação automática via ciclo Pix Automático, o próprio
"Débito automático agendado" já cobre o caso que importa.

## 59. Core financeiro — Fase 14: onboarding completo até o primeiro recebimento (01/09/2026)

**Objetivo:** guiar o profissional recém-cadastrado até o primeiro
pagamento confirmado, sem inventar um "passo atual" que possa ficar
desatualizado.

### `lib/core/jornada-onboarding.ts` (novo)

Nenhum passo é um flag persistido — não existe `current_step` na
empresa. Cada um dos 8 passos (`conta_criada`, `negocio_configurado`,
`conta_financeira_pronta`, `primeiro_cliente`, `primeira_recorrencia`,
`autorizacao_pix`, `primeira_cobranca`, `primeiro_recebimento`) é
DERIVADO do estado real do banco a cada leitura — o que torna a
jornada automaticamente retomável (refresh, logout, login em outro
dispositivo sempre mostram o progresso real) e garante que nenhum
dado já preenchido é perguntado de novo.

Os passos são computados independentemente, não em cadeia: um
profissional pode gerar uma cobrança avulsa sem nunca configurar
recorrência/Pix Automático, e isso não pode aparecer como pendência
falsa. `proximoPasso` é só o primeiro pendente na ordem sugerida — uma
sugestão, não um bloqueio.

Reaproveita `obterContaFinanceira` (Fase 3) e `prontaParaCobrar`/
`descricaoDoEstado` (Fases 2-6) em vez de duplicar a regra de "conta
pronta pra cobrar" — mesma disciplina de camadas de todas as fases
anteriores. `primeiro_recebimento` só conta `cobrancas.pago_via =
'asaas'` (Fase 11) — um recebimento marcado manualmente não fecha esse
passo, porque o objetivo é confirmar que a integração real funciona.

### Painel (`app/(app)/app/page.tsx`)

Checklist "Primeiros passos (N/8)" mostrado ACIMA do dashboard
existente enquanto `!jornada.completa` — nunca substitui as seções já
existentes (Resumo, Problemas, Atividade recente, etc.), que sempre
renderizam com dados reais independente da jornada, cada uma com seu
próprio vazio já tratado desde a Fase 11/12. Passo concluído aparece
riscado; passo pendente é um link direto pra tela que resolve. Quando
há um `detalhe` (ex.: conta recusada pelo Asaas), reaproveita o texto
de `descricaoDoEstado()` — não inventa uma explicação nova pro mesmo
estado.

`page.tsx` não importa mais `obterContaFinanceira`/`prontaParaCobrar`
diretamente (movidos para dentro de `jornada-onboarding.ts`) — a
consulta de conta financeira também saiu do `Promise.all` da página,
evitando busca duplicada.

### Testes — `tools/teste-jornada-onboarding-fase14.ts`, 32/32

Estado inicial (só "criar conta" concluído). Progressão passo-a-passo
real (documento → conta aprovada → cliente → recorrência → autorização
→ cobrança → recebimento), cada passo fechado fazendo a ação de
verdade acontecer, não inserindo estado direto. Recebimento só conta
via `pago_via='asaas'`, não `'manual'`. Ordem não é obrigatória
(cobrança avulsa sem recorrência fecha `primeira_cobranca` sem depender
dos passos anteriores). Conta recusada mostra o `detalhe` explicativo
correto. Isolamento por tenant (jornada de uma empresa nunca enxerga
dados de outra). Estruturais de camadas (reaproveita `obterContaFinanceira`/
`prontaParaCobrar`, painel não fala com `lib/asaas` direto).

### Achado real durante a fase

A refatoração do painel tornou stale 2 asserções da Fase 11
(`tools/teste-dashboard-financeiro-fase11.ts`) que checavam
`obterContaFinanceira`/`prontaParaCobrar` importados direto em
`page.tsx` — passaram a falhar (17/19) não por regressão funcional,
mas porque essas duas funções migraram pra dentro de
`jornada-onboarding.ts`, exatamente como pretendido. Corrigido
apontando as mesmas asserções pra `lib/core/jornada-onboarding.ts`,
mantendo a original "painel não importa nada de `lib/asaas` direto"
em `page.tsx`.

### Regressão — 609/609, nenhuma quebra

Os 577 anteriores + os 32 novos. Typecheck limpo, build exit 0, mesmas
36 rotas (a jornada não adiciona rota nova, só uma seção no `/app`
existente). Advisories de segurança do Supabase inalterados — nenhuma
migração nesta fase.

### Verificação visual — concluída

Login via Browser MCP funcionou nesta fase (conta de teste nova,
`preview.jornada.zelo@gmail.com`, confirmada direto via
`auth.admin.updateUserById` pra pular o e-mail de ativação, já que o
domínio `.test` é recusado pelo Supabase Auth como e-mail não-real).
Confirmado visualmente em desktop (1280×720) e mobile (375×812):

- Checklist "Primeiros passos (1/8)" renderiza com "Criar sua conta"
  riscado/marcado e os outros 7 passos como link, botão de atalho pro
  `proximoPasso` no topo.
- **Teste de ponta a ponta real, não só leitura de tela**: preenchi o
  CPF em `/app/configuracoes`, salvei, voltei pro painel — o checklist
  avançou sozinho pra "2/8", "Configurar seu negócio" apareceu riscado
  e o botão de atalho mudou pra "Conectar e aprovar sua conta
  financeira", provando que a jornada é mesmo derivada do banco em
  tempo real, não um estado congelado da primeira carga.
- Grid vira coluna única em mobile, texto de `detalhe` (motivo
  pendente) legível abaixo do passo correspondente.

Conta de teste e empresa associada removidas ao final (cascade via
`auth.admin.deleteUser`, confirmado que nenhuma linha órfã ficou em
`empresas`).

## 60. Assinatura e planos da própria Zelo — Fase 15 (02/09/2026)

**Objetivo:** fundação profissional pra assinatura que o profissional paga
à Zelo — domínio separado das cobranças que os clientes DELE pagam a ele.
Sem inventar comercial: preço, planos e provider vieram todos do que já
existia auditado, não de suposição.

### Auditoria — muito mais já existia do que o esperado

Antes de escrever qualquer linha, a fase começou lendo
`ZELO_PROJECT_CONTEXT.md`, `PROJECT_STATUS.md` e
`ZELO_FINANCIAL_CORE_ARCHITECTURE.md`, e auditando o código. Achado:

- `empresas.assinatura_status` (`trial`/`ativa`/`inadimplente`/`cancelada`)
  já existia desde a Fase 0/1, com CHECK constraint no banco e o mesmo
  enum espelhado em `lib/empresa.ts` (`StatusAssinatura`,
  `situacaoDaConta()`, `avisoDaConta()`) — **nunca tinha teste próprio**,
  apesar de já ser usado em `layout.tsx`, no painel e na própria tela de
  assinatura.
- `empresas.plano` (`essencial`=20 clientes / `profissional`=50 /
  `premium`=150) já existia com trigger `impoe_limite_de_clientes()` no
  banco (não só RLS — um `insert` direto via `service_role` também é
  recusado) e `lib/plano.ts` como fonte única dos números, já testado
  (`teste-limite-plano.ts`, 12/12, preexistente).
- `empresas.asaas_customer_id`/`asaas_subscription_id` e
  `lib/asaas/config.ts::credencialDaPlataforma()`/`contaDaPlataforma()`
  já existiam, com a separação plataforma×subconta já documentada em
  comentário. O webhook (`lib/asaas/webhook.ts`) já resolvia
  `contexto.tipo === "plataforma"` e **já tinha** um handler parcial:
  `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` → `ativa`, e
  `SUBSCRIPTION_DELETED` → `cancelada`.
- **Gap real encontrado**: nada em lugar nenhum jamais setava
  `assinatura_status = 'inadimplente'` — `PAYMENT_OVERDUE` era um evento
  reconhecido em `tipos.ts` mas nunca tratado. O estado existia no CHECK
  constraint e no tipo TypeScript, mas não tinha origem nenhuma no
  código. Fechado nesta fase.
- Nenhuma tabela dedicada de "cobrança da assinatura" existe — decisão
  **já documentada** em `ZELO_FINANCIAL_CORE_ARCHITECTURE.md` §3
  ("`empresas.assinatura_status`... suficiente por ora"), porque a
  assinatura é 1:1 com a empresa. Mantido: não criada tabela nova sem
  necessidade real (nenhum pagamento de assinatura jamais aconteceu —
  confirmado por query: as 15 empresas reais do banco estão todas em
  `trial`/`essencial`, nenhuma com `asaas_customer_id` preenchido).

### `lib/core/assinatura.ts` (novo)

Mesmo padrão de `lib/core/autorizacao.ts`: tabela de transições válidas
e de origem permitida, sem React/DOM.

```
trial        → ativa         (primeiro pagamento confirmado)
ativa        → inadimplente  (PAYMENT_OVERDUE)
ativa        → cancelada     (SUBSCRIPTION_DELETED)
inadimplente → ativa         (pagamento recuperado)
inadimplente → cancelada     (SUBSCRIPTION_DELETED)
```

`cancelada` é terminal — não reabre. `trial` nunca é destino (nasce do
trigger que cria a empresa). Nenhum estado aceita origem `caso_de_uso`:
mesma regra da arquitetura financeira (§14) — "nenhum pagamento marcado
como confirmado pelo cliente" vale também pra própria mensalidade da
Zelo. Só `webhook` está implementado; `reconciliacao` fica reservado
(mesmo padrão do resto do Core Financeiro) pra quando existir consulta
ativa à assinatura no Asaas.

`obterUsoDoPlano()`: uso real (clientes ativos) contra o limite de
`lib/plano.ts` — não recalcula o número, importa da fonte única.

### Banco — migração `fase18_assinatura_zelo_timestamp`, aditiva

Só uma coluna nova: `empresas.assinatura_atualizada_em timestamptz`.
Não é dado comercial — é "quando `assinatura_status` mudou pela última
vez", pra mostrar "cancelada em"/"inadimplente desde" na UI.
**De propósito sem grant de UPDATE pra `authenticated`/`anon`**: só o
webhook (via `service_role`) grava — confirmado por query direta em
`information_schema.column_privileges` depois da migração.

### Webhook — `processarEventoAssinaturaPlataforma()` (novo, em `lib/asaas/webhook.ts`)

Extrai a lógica que antes estava solta no `else` do contexto
plataforma pra uma função dedicada, mesma disciplina de
`processarEventoAutorizacaoPix`: busca a empresa, se já está no estado
alvo é idempotente (nada a fazer), valida a transição contra
`lib/core/assinatura.ts` antes de escrever — nunca decide sozinho — e
só então grava `assinatura_status` + `assinatura_atualizada_em`,
registra auditoria (`assinatura_zelo_ativada`/`_inadimplente`/
`_cancelada`) e notifica (reaproveitando `lib/core/notificacoes.ts` da
Fase 13; chave por `evento.id`, mesmo padrão de `conta_aprovada`).

Agora trata `PAYMENT_OVERDUE` (gap fechado) e valida a transição antes
de qualquer escrita — um evento de pagamento fora de ordem chegando
depois do cancelamento não reabre a assinatura (`cancelada` é
terminal), testado com uma sequência real de 5 eventos em ordem.

### Tela `/app/assinatura` — reescrita completa

Situação real (`Ativa`/`Teste grátis`/`Teste terminado`/`Pagamento
pendente`/`Cancelada`, com a mesma paleta de `.sitPaga`/`.sitVencida`/
`.sitEstornada` já usada em cobranças — verde/âmbar/vermelho, não uma
cor nova), plano e mensalidade, uso do plano com medidor visual
(`.medidor`/`.medidorPreenchido`, fica âmbar a partir de 80% do
limite), e um bloco específico por estado — cada um com texto real,
não genérico:

- **trial ativo**: prazo + link pros primeiros passos (Fase 14).
- **trial vencido**: qual é o bloqueio real (`empresa_liberada()` só
  libera `ativa` ou `trial` dentro do prazo — confirmado lendo a
  função SQL, não assumido) — não cria novos clientes/cobranças/
  recorrências, mas o que já existe continua acessível pra leitura e
  edição (só a policy de INSERT das 3 tabelas é gated por
  `empresa_liberada()` — confirmado por query nas policies).
- **ativa**: desde quando, limite do plano.
- **inadimplente**: mesmo texto de bloqueio + "resolve sozinho quando o
  pagamento confirmar, não precisa fazer nada aqui".
- **cancelada**: data + mesmo bloqueio + reativação não é self-service
  (não implementada — sem regra comercial definida pra isso).

Bloco "Pagamento ainda não está disponível" mantido (billing provider
não configurado — `ASAAS_API_KEY` ausente até em `.env.local`,
confirmado) — sem inventar botão de assinar/cancelar que prometeria
uma cobrança que não vai acontecer.

### O que NÃO foi implementado, de propósito

- **Upgrade/downgrade de plano**: sem preço definido pra
  `profissional`/`premium` em lugar nenhum do projeto — implementar
  trocaria de plano sem cobrar diferença nenhuma, ou obrigaria inventar
  um preço. `ZELO_PROJECT_CONTEXT.md` §3 é explícito: "não existem
  outros planos... autorizados" (comercial público). `plano` continua
  existindo só como capacidade técnica interna (limite de clientes),
  mostrada com honestidade na tela, sem virar oferta.
- **Cancelamento self-service**: regra comercial (cancela imediato?
  fim do período? reembolso?) não definida. Só documentado como
  bloqueado.
- **Chamada real a `criarAssinaturaAsaas()`** (já pronta em
  `lib/asaas/assinatura.ts` desde antes desta fase): sem
  `ASAAS_API_KEY`, e sem decisão de QUANDO disparar (fim do trial?
  manual?), não haveria caso de uso real pra chamar — ficaria
  encanamento pra lugar nenhum.

### Testes — `tools/teste-assinatura-fase15.ts`, 67/67

10 de transições válidas/inválidas. 5 de origem permitida. 15 de
`situacaoDaConta`/`avisoDaConta` (nunca tinham teste próprio, apesar de
já estarem em produção desde a Fase 0). 5 de `obterUsoDoPlano` (uso
real por status `ativo`, não por `LIMITE_DE_CLIENTES` sozinho — achado
no processo: insert em lote do PostgREST manda `null` explícito em
coluna omitida quando outra linha do MESMO lote especifica essa coluna,
não aplica o default — bug do teste, não do produto, corrigido). 17 de
webhook real via `processarEventoWebhook` — sequência completa
trial→ativa→inadimplente→ativa→cancelada, idempotência de reenvio, e
`cancelada` recusando reabrir. 2 de impacto real de bloqueio (INSERT de
cliente recusado com assinatura inadimplente — prova ao vivo do texto
da UI, não suposição). 4 de segurança de grants (`assinatura_status`/
`plano`/`assinatura_atualizada_em` são só-leitura pra `authenticated`).
1 de isolamento de tenant. 4 estruturais de camadas.

### Regressão — 676/676, nenhuma quebra

Os 609 anteriores + os 67 novos. Typecheck limpo, build exit 0, mesmas
36 rotas. Advisories de segurança do Supabase: os mesmos 5 já
conhecidos e intencionais. `teste-confiabilidade-fase10.ts` (Fase 10,
não tocado nesta fase) oscilou entre 25/25 e 23/25 em execuções
repetidas — o mesmo clock-drift Node↔Postgres já documentado na Fase
10 (TTL de lock com margem apertada pro ambiente de teste), confirmado
não relacionado: passa sozinho quando reexecutado, e nenhum arquivo que
toca não foi tocado nesta fase.

### Verificação visual — Playwright + Browser MCP, 5 estados

Conta de teste criada e confirmada via `auth.admin` (mesmo caminho da
Fase 14, pra pular e-mail de ativação). Os 5 estados
(`trial`/`trial vencido`/`ativa`/`inadimplente`/`cancelada`) verificados
via `browser_snapshot` do Playwright, lendo o texto real renderizado —
**achado durante a verificação**: o estado `cancelada` tinha uma frase
que reiniciava com minúscula depois de ponto final ("Cancelada em
X. cadastrar novos clientes..."), corrigido antes de fechar a fase.
Estado `ativa` com uso do plano a 90% (18/20) confirmado visualmente
via Browser MCP em desktop e mobile — medidor vira âmbar corretamente
acima de 80%. Conta de teste e clientes de teste removidos ao final.

### Documentação atualizada

`ZELO_FINANCIAL_CORE_ARCHITECTURE.md` §3 (linha da entidade Assinatura)
e §6.1 (linha de `webhook.ts`) — só as linhas que esta fase tornou
desatualizadas, sem reescrever as tabelas inteiras (que já estavam
obsoletas antes desta fase, de fases anteriores que não as
atualizaram — fora do escopo da Fase 15 corrigir todo o documento).

## 61. Design System oficial da Zelo — Fase 16 (02/09/2026)

**Objetivo:** sistematizar a identidade visual já existente — não criar
marca nova — e resolver uma instrução direta desta fase: o produto
(`/app`, telas de conta) não pode ficar excessivamente escuro. A
landing continua congelada.

### `ZELO_COMPETITIVE_INTELLIGENCE_V3.md` não existe

O pacote de fases pede a leitura desse arquivo antes de começar.
Verificado por busca no repositório inteiro: não existe, em nenhuma
pasta. Seguido sem ele — não inventado conteúdo de inteligência
competitiva pra preencher a lacuna. Se o proprietário tiver esse
documento fora do repositório, vale anexá-lo pra fases futuras.

### O problema real: dois sistemas de cor, um escondido dentro do outro

O produto (`/app/*`, `/entrar`, `/criar-conta`) sempre leu os MESMOS
tokens `:root` da landing (`app/globals.css`) — por isso saía escuro:
herdava a paleta cinematográfica de `Stage.tsx` sem ter pedido. A
landing é congelada por decisão explícita (§5 de
`ZELO_PROJECT_CONTEXT.md`); mudar `:root` mudaria as duas coisas ao
mesmo tempo, o que violaria a landing sem necessidade.

**Solução:** `app/product-tokens.css` (novo) — um bloco de custom
properties escopado a uma classe `.zelo-produto`, aplicada nos
wrappers raiz de `/app` (`layout.tsx`) e das telas de conta
(`(auth)/layout.tsx`), ao lado da classe hasheada do CSS Module. Custom
properties CSS cascam por herança: tudo dentro de `.zelo-produto` vê os
tokens claros novos; a landing, fora dela, nunca vê nada disso.
Verificado visualmente: landing idêntica antes/depois.

**Achado técnico durante a implementação:** a primeira versão escopou
os tokens direto em `.moldura`/`.pagina` (os nomes usados no JSX) — não
funcionou, porque essas são classes de CSS Module e viram algo como
`App-module__igqh8W__moldura` no build; um stylesheet global não
alcança um seletor hasheado. Corrigido adicionando uma classe global
estável (`zelo-produto`) lado a lado no `className`.

### Migração de ~1100 linhas de CSS já escritas, sem reescrever

`App.module.css`/`Auth.module.css` (Fases 1-15) referenciam tokens
antigos (`--black`, `--graphite-900`, `--paper`, `--off`,
`--gray-200..500`). Reescrever cada referência seria o tipo de
"melhoria fora do escopo" que a fase pede pra evitar. Em vez disso,
`product-tokens.css` **realiasa** os nomes antigos pros tokens
semânticos novos (`--graphite-900: var(--surface)`, `--paper:
var(--text-primary)`, etc.) — verificado por grep, caso a caso, que
cada nome antigo só era usado como `color:` OU só como `background:`
em todo o arquivo, nunca os dois (senão o alias quebraria uma das duas
direções).

**O que não é alias-ável, editado de verdade:**
- 33 ocorrências de `rgba(226, 232, 230, X)` (cinza-claro-sobre-preto)
  → `rgba(var(--border-rgb), X)`.
- 5 cores de status em hex (`#4ade9b`/`#d9ae6a`/`#d98282`/`#f0aaaa`/
  `#f4c3c3`) → `var(--success)`/`var(--warning)`/`var(--danger)`.
- 5 variações de `rgba(triplo-de-status, X)` → tokens `-rgb`
  correspondentes.
- **Bug real encontrado:** `rgba(10, 15, 13, 0.72)` — fundo quase-preto
  de `<input>` em 4 lugares (busca de cobranças, campo de e-mail/senha
  do login). Um alias não pegaria isso (a intenção óbvia num tema claro
  é fundo branco, não "preto realiasado pra algo claro"); corrigido pra
  `var(--surface)`.
- **Bug de acessibilidade real encontrado:** `--violet-highlight`
  (usado em 7 lugares como cor de link/texto, incluindo "Esqueci minha
  senha" e "Criar conta" no login) é o lilás mais claro da landing —
  contraste de 2,2:1 sobre fundo claro, abaixo até do mínimo de 3:1
  pra borda, quanto mais dos 4,5:1 de texto. Verificado visualmente
  (screenshot do `/entrar` mostrou os links quase invisíveis) antes de
  corrigir. Aliasado pra `var(--violet-hover)` (6,8:1, verificado pela
  fórmula de luminância do WCAG).
- Dois blocos de estado na tela de assinatura (Fase 15) usavam
  `style={{borderColor: "rgba(...)"}}` inline em vez de classe CSS —
  virou `.blocoAviso`/`.blocoPerigo`, novas variantes de `.bloco`.

### Tokens documentados em `ZELO_DESIGN_SYSTEM.md` (novo)

Cor (com contraste WCAG verificado por cálculo, não visual), tipografia,
espaçamento, radius, shadow (novo — modo escuro usava só borda pra
separar camadas, modo claro precisa de sombra de verdade), motion,
z-index. Inventário honesto de componentes: o que existe
(`Button`/`Input`/`Badge`/`Alert`/`Card`/`Empty state`/`Loading
state`/`Progress`/`Navigation`), o que é parcial (`Tabs` visual sem
`role="tablist"` semântico, `Checkbox` só no checklist de onboarding),
e o que **não existe** (`Avatar`, `Toast`, `Modal`/`Dropdown`/
`Tooltip`/`Confirm dialog` — auditado: só um ponto do produto usa
confirmação de ação destrutiva, `window.confirm()` nativo em
`AutorizacaoPix.tsx`; construir um sistema de modal acessível pra um
único call site não passa no teste "resolve necessidade real" desta
fase — documentado como gap conhecido, não fingido como resolvido).

### Verificação visual — Browser MCP, conta de teste populada

Conta nova com 3 clientes e 3 cobranças em estados diferentes
(pendente/vencida/paga), plano Profissional. Confirmado por
`get_page_text` + `elementFromPoint` (não só screenshot — ver nota
abaixo) em: `/entrar`, `/app` (dashboard com checklist de onboarding +
resumo financeiro + tabela), `/app/cobrancas` (filtros, pílulas de
status, tabela), `/app/assinatura`. Desktop (1280px) e mobile (375px).
Landing (`/`) confirmada inalterada.

**Achado sobre a própria ferramenta de verificação:** screenshots do
Browser MCP mostraram um retângulo preto sólido cobrindo parte da tela
após rolagem, reproduzível de forma consistente. Investigado antes de
assumir que era bug do produto: `document.body.scrollHeight` e a
altura real de `.moldura` batiam exatamente (nenhum vão sem cobertura);
`elementFromPoint()` na coordenada exata do "retângulo preto" devolveu
um `<span>` de valor financeiro com `background: rgb(255,255,255)` —
ou seja, a página real ali é branca. Confirmado: artefato de captura
do painel do navegador (mesma classe de problema já documentada nas
Fases 11/13), não um bug de CSS. Registrado o método de diagnóstico
(inspeção de DOM via `javascript_tool`, não só screenshot) para as
próximas fases.

### Testes — regressão, sem teste de domínio novo

Fase é puramente CSS/tokens — nenhuma lógica de servidor mudou.
609+67 = 676 testes de fases anteriores, todos passando (exceto o
flake conhecido e não-relacionado de `teste-confiabilidade-fase10`,
que oscilou 25/25↔23/25 de novo — mesmo clock-drift Node↔Postgres já
documentado na Fase 10, confirmado não tocado nesta fase). Typecheck
limpo, build exit 0, 36 rotas (nenhuma nova). Advisories de segurança
do Supabase: os mesmos 5 já conhecidos — nenhuma migration nesta fase.

### O que NÃO foi feito, de propósito

Migração linha-a-linha das ~1100 linhas de CSS pros nomes de token
novos (`--gray-400` → `--text-muted` direto) — mecânica, baixo risco,
mas sem necessidade real agora; fica pra quando cada tela for tocada
de novo (natural durante a Fase 17). `Avatar`/`Toast`/`Modal`/
`Dropdown`/`Tooltip`/`Confirm dialog` — sem necessidade real
comprovada hoje. Auditoria de teclado/`aria-*`/screen reader — é o
escopo da Fase 18, não desta.

## 62. Aplicação da identidade visual ao produto — Fase 17 (02/09/2026)

**Objetivo:** auditar cada tela do produto procurando o que a Fase 16
não alcançou — CSS Modules separados de `App.module.css`, estilo
inline, cores que não vieram de token — e confirmar responsividade real
em desktop/tablet/mobile, não só "não quebrou".

### Achados reais — dois arquivos CSS inteiros nunca migrados

A varredura da Fase 16 cobriu `App.module.css`/`Auth.module.css`, mas
o produto tem mais 2 stylesheets próprios que passaram batido:
`ContaFinanceira.module.css` (cartão de status da conta financeira,
`/app/configuracoes`) e `AutorizacaoPix.module.css` (cartão de
autorização Pix, `/app/recorrencias`) — comentário no próprio arquivo
já dizia "mesmo padrão visual" um do outro, confirmando que eram cópias
irmãs com os mesmos problemas:

- `background: rgba(0, 0, 0, 0.22)` — cartão flutuante calibrado pra
  ficar mais escuro que um fundo já escuro; em tema claro isso é
  simplesmente um cartão cinza-escuro sobre fundo claro. Virou
  `var(--surface)`.
- `rgba(226, 232, 230, X)` (bordas) → `rgba(var(--border-rgb), X)`,
  mesmo padrão da Fase 16.
- `#e8b45c`/`#4ade9b`/`#ff7a72` (selo de estado atenção/sucesso/erro,
  cores DIFERENTES das já tokenizadas na Fase 16 pro mesmo conceito) →
  consolidadas em `var(--warning)`/`var(--success)`/`var(--danger)` —
  não inventar uma terceira variante de "amarelo de atenção" quando já
  existe uma.
- **Tokens quebrados encontrados:** `var(--text)`, `var(--text-2, ...)`,
  `var(--primary, #8b7bff)`, `var(--muted, rgba(...))` — nenhum desses
  nomes (`--text`, `--text-2`, `--primary`, `--muted`) jamais foi
  declarado em lugar nenhum do projeto. Onde havia fallback inline
  (`var(--x, valor)`), o CSS funcionava usando sempre o fallback
  (calibrado pro modo escuro); onde não havia (`var(--text)` sozinho),
  a propriedade ficava inválida e o elemento simplesmente herdava a
  cor do pai — um bug pré-existente, silencioso, de antes desta fase.
  Corrigido apontando pros tokens reais (`--text-primary`,
  `--text-secondary`, `--violet-hover`, `--text-muted`).

### Achados reais — estilo inline bypassando token, em 3 arquivos `.tsx`

Grep dedicado por `style={{...color/background/border...}}` em todo
`app/(app)` e `app/(auth)` (não só nos arquivos CSS) achou:

- `app/(app)/app/cobrancas/[id]/page.tsx`: aviso de "débito recusado"
  com `borderColor`/`background` em rgba cru — virou classe
  `.avisoConexaoPerigo` (nova variante de `.avisoConexao`, mesmo
  princípio de `.blocoAviso`/`.blocoPerigo` da Fase 15/16).
- `app/(app)/app/configuracoes/page.tsx`, 3 pontos: `borderTop: "1px
  solid rgba(255, 255, 255, 0.08)"` (linha branca — invisível em fundo
  claro), e dois usos de `color: "var(--muted)"` (token que nunca
  existiu, mesmo bug do item acima). Corrigidos com `var(--border)` e
  `var(--text-muted)`/`var(--text-secondary)`.

Confirmado por grep final: zero ocorrências de hex/rgba cru dentro de
`style={{}}` em todo `app/(app)` e `app/(auth)`.

### Verificação de responsividade — 3 larguras reais, não só "não quebrou"

Testado com dado real (conta de preview com 3 clientes, 3 cobranças em
3 estados) em:

- **Mobile (375px):** sidebar vira navegação horizontal, grade de
  métricas cai pra 1 coluna, cards de detalhe empilham — confirmado em
  `/app`, `/app/cobrancas/[id]`.
- **Tablet retrato (768px):** mesmo breakpoint da navegação (860px)
  ainda usa o layout horizontal — decisão existente mantida, não
  redesenhada: nesta largura a grade de métricas já cabe em 2 colunas
  e o checklist de onboarding também, sem sensação de "mobile
  esticado". Registrado como decisão preservada, não auditada a fundo
  pra trocar de breakpoint sem necessidade comprovada.
- **Tablet paisagem / desktop pequeno (1024px):** acima do breakpoint
  de 860px, a sidebar fixa de 232px aparece — confirmado que não fica
  "espremida": conteúdo com respiro real, tabela de cobranças legível,
  nada de scroll horizontal.
- **Desktop (1280px):** sidebar + conteúdo com boa densidade, cores de
  situação (pílulas) legíveis à distância.

### Verificação da própria ferramenta de captura

Confirmado outra vez (mesmo método da Fase 16: `elementFromPoint` na
coordenada exata do "retângulo preto" da screenshot, comparado com o
`background-color` computado real) que o artefato de captura do
Browser MCP em determinadas posições de rolagem não reflete o DOM
real. Usado Playwright como segunda ferramenta pra screenshot em
alguns pontos — capturou limpo onde o Browser MCP mostrou o artefato,
confirmando que é específico da ferramenta, não do produto.

### Playwright — fluxo crítico ponta a ponta

Login (preenchimento real de formulário, não seed direto) →
`/app` (dashboard completo, checklist, resumo financeiro, tabela,
problemas) → `/app/cobrancas/[id]` (detalhe). Verificado em 1280px e
375px. Zero erros/warnings no console do navegador em toda a
navegação. Estrutura semântica confirmada pelo snapshot de
acessibilidade do Playwright: tabela com `columnheader`/`cell` reais,
lista do checklist com `listitem`, hierarquia de heading (h1 único por
página, h2/h3 consistentes) — não auditado a fundo ainda (isso é Fase
18), mas nada de errado apareceu de graça.

### Testes — regressão, sem teste de domínio novo

Mesma natureza da Fase 16: puramente CSS/JSX de apresentação, nenhuma
lógica de servidor mudou. 676 testes de fases anteriores, todos
passando (exceto o flake conhecido de `teste-confiabilidade-fase10`,
23/25 de novo — mesmo clock-drift documentado, não relacionado).
Typecheck limpo, build exit 0, 36 rotas.

### Documentação atualizada

`ZELO_DESIGN_SYSTEM.md` — adicionado o achado dos dois CSS Modules
órfãos e dos tokens quebrados, pra quem ler o documento saber que a
varredura da Fase 16 não era exaustiva e por quê a Fase 17 precisou
completar.

### O que NÃO foi feito, de propósito

Migração linha-a-linha do restante do CSS pros nomes de token novos —
mesma decisão da Fase 16, mantida. Reformular o breakpoint de
tablet-retrato (768px) pra usar sidebar em vez de navegação
horizontal — a UX atual já é boa nessa largura, trocar sem um problema
real seria mudança estética sem necessidade. Auditoria formal de
teclado/`aria`/screen reader — Fase 18. Suíte E2E completa — Fase 19.

## 63. UX + Acessibilidade + Performance — Fase 18 (02/09/2026)

**Objetivo:** auditar teclado, ARIA, contraste, screen reader e
performance nos fluxos críticos — não assumir que "responsivo" já
significa "acessível" ou "rápido".

### Achado real: nenhum skip-link, corrigido

`/app` tem 8 itens de navegação + notificações + sair antes do
conteúdo — em toda página, toda vez. Um usuário de teclado ou leitor
de tela tinha que passar por todos eles de novo a cada troca de rota.
Corrigido: `<a href="#conteudo-principal">Pular para o conteúdo</a>`
como primeiro elemento focável de `layout.tsx`, invisível até ganhar
foco (`.linkPular`, novo em `App.module.css`), `id="conteudo-principal"`
no `<main>`. Testado de ponta a ponta via Playwright: `Tab` foca o
link, ele aparece (top: -100px → 12px), `Enter` navega e o foco pula
pra `#conteudo-principal` — confirmado pela URL mudando de verdade,
não só suposto.

### O que já estava sólido (verificado, não reconstruído)

Auditoria encontrou uma base de acessibilidade bem mais madura do que
o esperado antes de procurar:

- **Labels:** todo formulário do produto usa `htmlFor`/`id` (auth via
  componente `CampoConta` compartilhado — label, `aria-invalid`,
  `aria-describedby` corretos nos 4 formulários de conta sem depender
  de repetir a lógica; clientes/cobranças/recorrências confirmados por
  grep).
- **Imagens:** único `<img>` do produto (QR code Pix) já tem `alt`
  descritivo.
- **Hierarquia de heading:** testado nas 8 telas principais via script
  (não amostragem visual) — exatamente 1 `<h1>` por página em todas,
  nenhum salto de nível (H1→H3 sem H2) em nenhuma.
- **Foco visível:** confirmado via Playwright que todo item da
  navegação lateral usa `box-shadow` como indicador de foco (técnica
  válida, alternativa ao `outline`) — a checagem inicial só olhou
  `outline` e por pouco reportou um falso positivo; corrigido de olhar
  também `box-shadow` antes de concluir.
- **Erro de rota (`error.tsx`):** `role="alert"`, código de erro
  (`digest`) mostrado sem vazar mensagem/stack trace real, botão
  "Tentar de novo", cópia que tranquiliza ("nada foi perdido") — já
  correto, CSS já tokenizado desde a Fase 16/17.
- **Motion:** único efeito de verdade no produto é o shimmer do
  skeleton, já com `prefers-reduced-motion` — nenhum outro
  `transform`/`animation` decorativo existe pra auditar.
- **Status nunca só por cor:** confirmado por varredura de DOM em
  clientes/cobranças/recorrências/autorizações/instruções — toda
  etiqueta de situação tem texto, nenhuma vazia.

### Performance — arquitetura já favorável

18 Client Components no produto inteiro (`app/(app)` + `app/(auth)`),
todos formulários/ações interativas reais — nenhum Server Component
convertido em cliente sem necessidade. Fontes com `display: "swap"`
(sem texto invisível durante carregamento). Nenhum `transform`/
`animation` supérfluo pra otimizar. Não foi necessário nenhum ajuste
de performance nesta fase — a arquitetura RSC-first já estava correta
desde as fases anteriores.

### Testes

Regressão: 676 (mesmos de sempre, exceto o flake conhecido de
`teste-confiabilidade-fase10`). Typecheck limpo, build exit 0, 36
rotas. Console do navegador: 0 erros/warnings em navegação por 8+
páginas via Playwright. Advisories de segurança inalterados.

### O que NÃO foi feito, de propósito

Auditoria de screen reader real (NVDA/VoiceOver) — fora do alcance de
automação; a estrutura semântica (heading, `role`, `aria-*`) foi
verificada programaticamente, que é o que a ferramenta permite. Suíte
E2E formal com Playwright — é o escopo explícito da Fase 19, não desta.

## 64. Playwright E2E + Strix + hardening — Fase 19 (02/09/2026)

**Objetivo:** suíte E2E de verdade pros fluxos críticos (não só a
sondagem manual via Browser MCP das fases anteriores) e uma segunda
camada independente de auditoria de segurança.

### `@playwright/test` instalado — decisão consciente, não default

O projeto não tinha framework de teste E2E (só a automação manual via
Browser MCP usada nas Fases 11-18). A Fase 19 pede explicitamente
"criar/verificar E2E", então instalado `@playwright/test` como
devDependency + Chromium e WebKit como browsers — mesma disciplina de
"cada dependência tem uma razão documentada" do resto do projeto.
`playwright.config.ts`: 3 projetos (`desktop` 1280px, `tablet` 768px,
`mobile` = preset `iPhone 13`, que roda em WebKit de verdade, não
Chrome emulando mobile).

### Suíte — `tests/e2e/`, 6 arquivos, 18 testes × 3 viewports = 54

`helpers.ts` (criação/limpeza de conta real via `service_role`, login
compartilhado), `auth.spec.ts` (rota protegida, credenciais
inválidas, login válido + sessão persiste, logout), `onboarding.spec.ts`
(jornada 1/8 → 2/8 completando um passo real), `cliente.spec.ts` (criar,
editar, **isolamento entre tenants por URL direta** — não só a chamada
de API que os testes de domínio já cobrem, mas a navegação real do
navegador), `cobranca.spec.ts` (criar, cancelar com confirmação em 2
passos, filtro de situação), `recorrencia.spec.ts` (estado vazio, criar,
página de autorizações responde), `assinatura.spec.ts` (trial/plano/uso
real, limite de plano bloqueando a UI, mudança de status via banco
refletindo na tela).

**Financeiro (instrução/pagamento/recebimento) não tem E2E de UI**:
sem `ASAAS_API_KEY`, não há como gerar uma instrução/pagamento real —
documentado explicitamente como limite, não simulado. Esse caminho já
tem 676 testes de domínio cobrindo a lógica (Fases 6-15); o que falta é
só a chamada real ao Asaas, que nenhuma fase anterior fingiu ter.

### Dois achados reais durante a estabilização em WebKit

Rodar a mesma suíte em Chromium (`desktop`/`tablet`) e WebKit
(`mobile`) expôs dois problemas que só apareciam no segundo:

1. **`fill()` pode dessincronizar do estado React em WebKit.**
   `page.getByLabel(...).fill(valor)` seta o valor no DOM (passa em
   `toHaveValue`) sem, em alguns timings do WebKit, disparar o evento
   que o componente controlado (`CampoConta`, `FormularioCliente` etc.)
   escuta — o campo aparecia preenchido mas o `submit` via com o campo
   vazio no estado React, caindo na validação client-side. Corrigido
   trocando `fill()` por `pressSequentially()` (digitação por evento
   real de teclado) em todo campo de texto da suíte —
   `preencher()`/`loginE2E()` em `helpers.ts`, reusado por todos os 6
   arquivos.
2. **Corrida entre `router.refresh()`/`router.push()` e a navegação
   seguinte do teste.** `FormularioLogin`/`FormularioConfiguracoes`
   chamam `router.refresh()` antes de navegar; em WebKit a navegação
   real às vezes ainda estava em voo quando a URL já batia o padrão
   esperado, e um `page.goto()` imediato do teste seguinte era abortado
   ("interrupted by another navigation"). Corrigido com
   `waitForLoadState("networkidle")` + assentamento curto em
   `loginE2E()`.

Nenhum dos dois é bug do produto — usuários reais não preenchem
formulário em milissegundos como `fill()` faz, e um segundo clique
humano não corre contra o próprio redirect do primeiro. Registrado
porque é exatamente o tipo de coisa que só aparece testando em mais de
um motor de navegador, que é o que a Fase 19 pediu.

### Resultado final — 54/54, nos 3 viewports, confirmado estável

Rodado o suite completo mais de uma vez depois das correções pra
confirmar que não era sorte de uma execução — 54/54 consistente.

### Strix — ambiente sem Docker, auditoria manual equivalente feita

`strix` (CLI) e Docker **não estão instalados neste ambiente** —
confirmado (`command not found` pros dois). Instalar Docker Desktop
seria mudança de infraestrutura do sistema, fora do escopo de agir
sozinho sem autorização explícita. Registrado como limitação real, não
escondido.

Em vez de simular o resultado, feita uma auditoria manual cobrindo a
mesma lista pedida pela Fase 19, com evidência, não leitura de código
sozinha:

| item | resultado | evidência |
|---|---|---|
| Dependências vulneráveis | 0 achados | `npm audit` — 0 críticas/altas/moderadas/baixas em 101 pacotes |
| Secrets vazados | nenhum | `SERVICE_ROLE_KEY` só em `lib/supabase/admin.ts` + scripts de teste/tooling (nunca em código de cliente); nenhum arquivo `"use client"` importa `admin.ts`; `.env.local` nunca foi commitado (`git log` vazio pro arquivo) |
| Webhook — auth | timing-safe, sem fallback | `comparaEmTempoConstante()` (XOR por byte, não `===`); testado ao vivo: POST sem token → **503** (não 401 — distingue "mal configurado" de "não autorizado", por design) |
| CSRF | protegido | Server Actions do Next mantêm a checagem de Origin padrão — `next.config.ts` não tem `experimental.serverActions.allowedOrigins` nenhum configurado que a desative |
| SQL injection | não aplicável | nenhuma query SQL crua/`\|.rpc()\|` em todo `lib`/`app` — 100% via query builder do Supabase (parametrizado por construção) |
| Mass assignment | não encontrado | os 2 únicos `.insert({...spread})` do produto usam uma função allowlist nomeada (`paraBanco`/`cobrancaParaBanco`, campos explícitos) — nunca o payload cru do cliente; `empresa_id` sempre a última chave do objeto (vence o spread) e vem de `usuarioAtual()`, nunca do formulário |
| IDOR / isolamento de tenant | confirmado, 2ª camada | além dos ~150 testes de domínio já existentes, o novo `cliente.spec.ts` prova isolamento pela **navegação real do navegador** (empresa B tentando `/app/clientes/{id-de-A}` por URL direta) |
| Rotas protegidas | confirmado ao vivo | `proxy.ts` (middleware) + E2E `auth.spec.ts` provam `/app` sem sessão → redirect pra `/entrar`, preservando o destino em `?de=` |
| Erros/logs | sem vazamento | `error.tsx` mostra só `digest`, nunca stack trace; `console.error` de `apiKey`/token audita a AUSÊNCIA do campo, nunca loga o valor (comentário explícito no código: "não logamos a resposta: ela contém a chave") |
| Headers de segurança | presentes, CSP conscientemente adiada | `X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy`/`Permissions-Policy` em `next.config.ts`; CSP fora de propósito documentado (GSAP/gtag/Clarity inline quebrariam com CSP mal calibrada) — fica como pendência explícita, não esquecida |

**Nenhum achado crítico ou alto.** Um item fica registrado como
pendência de decisão pra Fase 20: CSP ausente é aceitável hoje
(documentado, não esquecido), mas antes de produção vale decidir se
compensa calibrar uma CSP com as exceções necessárias pro GSAP/gtag/
Clarity, ou aceitar o risco conscientemente.

### Regressão

609+67 = 676 de sempre, mesma composição. `teste-confiabilidade-fase10`
oscilou mais que o normal nesta rodada (21/25, não os 23-25/25 já
documentados) — investigado antes de assumir que era o de sempre:
mesmas 2 categorias de asserção (TTL de lock, cliente e cobrança),
nenhum arquivo relacionado tocado nesta fase. Explicação mais provável:
~23 processos de Chrome/WebKit/Node ainda vivos da própria suíte E2E
desta fase competindo por CPU, amplificando o clock-drift Node↔Postgres
já documentado na Fase 10 — não uma regressão nova. Typecheck limpo,
build exit 0, 36 rotas.

### O que NÃO foi feito, de propósito

Strix de verdade (precisa de Docker, não instalado neste ambiente) —
substituído por auditoria manual equivalente, documentada acima, não
fingida. E2E do fluxo financeiro real (instrução → pagamento →
recebimento) — sem `ASAAS_API_KEY`, não há Asaas real pra testar
contra; fica pra quando a Fase 20 (ou depois) resolver isso.
Recalibração dos TTLs de teste da Fase 10 — fora do escopo desta fase,
que é regressão, não conserto de teste legado.

## 65. Produção + GO/NO-GO — Fase 20 (02/09/2026)

**Objetivo:** checklist objetivo de lançamento. Não "fazer deploy" —
determinar com evidência se a Zelo pode receber usuário real e operar
dinheiro real com segurança hoje.

### Achado real, corrigido: banco com 15 empresas de teste órfãs

Antes de qualquer avaliação, `list_tables` mostrou 15 linhas em
`empresas` — investigado antes de assumir que eram dados reais: todos
os 15 usuários associados tinham e-mail `@zelo.test` com prefixo de
arquivo de teste (`recfin_`/`instr_`/`cli_`), datados de 01/09/2026 —
sobras de execuções das Fases 9/10 que não completaram a própria
limpeza (provavelmente interrompidas por um corte de sessão). Nenhum
dado real misturado — confirmado por e-mail antes de apagar. Removidos
via `auth.admin.deleteUser` (cascade). **Banco de produção agora
começa zerado, como deveria.**

### Checklist, com evidência — não suposição

**1. Ambiente.** `.env.local` só tem as 4 chaves do Supabase. Ausentes:
as 5 do Asaas (`ASAAS_API_KEY`, `ASAAS_CREDENTIALS_KEY`, `ASAAS_ENV`,
`ASAAS_PLATFORM_ACCOUNT_ID`, `ASAAS_WEBHOOK_TOKEN`) e as 2 de analytics
(`NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_CLARITY_ID`). Nenhum secret vazado
(Fase 19). `NEXT_PUBLIC_SITE_URL` ausente — cai no fallback
`zelopay.com.br` já no código.

**2. Supabase.** 30 migrations aplicadas, todas nomeadas e
sequenciais (`list_migrations`). RLS ligado nas 13 tabelas de
`public` (`list_tables`, verificado agora, não lembrado de fase
anterior). Advisories: os mesmos 5 conhecidos e intencionais desde a
Fase 8, nenhum novo em nenhuma das Fases 15-20. **Um ponto estrutural
pra registrar:** não existe projeto Supabase de staging separado do de
produção — é o mesmo projeto (`krwzohklsqdysdrfkjcd`) usado por todo
teste automatizado desta sessão inteira. Funciona porque cada teste
cria e limpa a própria conta, mas não há isolamento real entre
"ambiente de desenvolvimento" e "produção" — são a mesma coisa hoje.

**3. Asaas.** `ASAAS_API_KEY` ausente — confirmado (`getAsaasConfiguration().isConfigured
=== false`, testado ao vivo na Fase 15/16). Nenhuma operação
financeira real é possível hoje. Todo o Core Financeiro (Fases 1-15,
676 testes) foi construído e testado contra essa ausência sendo
tratada honestamente — nunca fingida.

**4. Webhooks.** Auditado de novo na Fase 19: auth timing-safe, sem
fallback, idempotência por `asaas_event_id` único, resolução de tenant
por `account.id` (nunca por `externalReference` sozinho), tratamento
de falha sem vazar detalhe. **Sólido — não é bloqueador.**

**5. Domínio.** `zelopay.com.br` **não resolve** — `nslookup`
confirmou "Non-existent domain" agora, ao vivo. Domínio não registrado
ou DNS não configurado. HTTPS/canonical/sitemap/robots existem no
código (`robots.txt`/`sitemap.xml` geram na build), mas não têm onde
apontar hoje.

**6. Analytics.** GA4/Clarity ausentes, degradam graciosamente
(`Analytics.tsx` não renderiza `<Script>` nenhum sem a env var — zero
requisição, build não quebra). Bloqueador de decisão de tráfego, não
de segurança.

**7. E-mail (SMTP).** **BLOCKED desde a Fase 35** (26/08/2026),
nunca resolvido em nenhuma fase depois: SMTP padrão do Supabase limita
2-3 e-mails/hora, inviável pra cadastro real aberto.

**8. Monitoramento.** Nenhum serviço de observabilidade (Sentry/
Datadog/etc.) — confirmado por `grep` no `package.json`. O que existe:
disciplina de `console.error` com contexto estruturado em todo o
código (auditado na Fase 19 — nunca loga secret), e `eventos_asaas`
como trilha de auditoria de webhook no banco. Suficiente pra debugar
depois do fato, insuficiente pra alertar em tempo real.

**9. Legal.** `/termos` e `/privacidade` existem com estrutura e
conteúdo reais (136/157 linhas), mas CNPJ e razão social estão
marcados `<Pendente>A DEFINIR</Pendente>` no próprio componente —
confirmado por grep, não por lembrança. **LGPD real bloqueado**: o
sistema já guarda CPF/CNPJ/e-mail/WhatsApp de clientes de terceiros
sem uma política publicada de verdade.

**10. Fluxo financeiro real.** Não verificável ponta a ponta sem
Asaas real (item 3). O que existe: 676 testes de domínio (Fases 1-15)
cobrindo cada transição de estado, mais 54 E2E (Fase 19) cobrindo a
UI. O elo que falta é só a chamada real à API do Asaas — nunca
simulada como se existisse.

**11. Teste controlado.** Não realizado — não existe ambiente seguro
pra isso sem credencial Asaas real e sem domínio publicado. Não
fingido.

**12. Playwright final.** 54/54 (Fase 19), reconfirmado estável com
múltiplas execuções.

**13. Strix final.** Auditoria manual equivalente (Fase 19) — Docker
não disponível neste ambiente, documentado, não escondido. Zero
achados críticos/altos.

**14. Regressão final.** 676 testes de domínio — 651 em 18 arquivos
sem nenhuma falha, mais `teste-confiabilidade-fase10` oscilando
(21-23/25) pela mesma sensibilidade a clock-drift Node↔Postgres já
documentada desde a própria Fase 10 (não uma regressão desta fase —
confirmado que nenhum arquivo relacionado foi tocado nas Fases 16-20).
Typecheck limpo. Build exit 0, 36 rotas.

### Matriz GO/NO-GO

| Critério | Estado | Evidência | Bloqueador |
|---|---|---|---|
| Build | 🟢 OK | `npm run build` exit 0, 36 rotas | não |
| TypeScript | 🟢 OK | `tsc --noEmit` limpo | não |
| Testes (domínio) | 🟡 OK com ressalva | 651/651 estável + 25 oscilando por clock-drift de ambiente, não de produto | não |
| E2E | 🟢 OK | 54/54, desktop+tablet+mobile, 3 execuções | não |
| Segurança | 🟢 OK | 0 achados críticos/altos (auditoria manual, Fase 19); Strix real não rodou (sem Docker) | não |
| Supabase | 🟡 OK, sem staging | RLS 100%, migrations OK; mesmo projeto pra dev e prod | não, mas registrado |
| Asaas | 🔴 não configurado | `ASAAS_API_KEY` ausente, confirmado ao vivo | **sim** |
| Webhooks | 🟢 OK | auth timing-safe, idempotente, testado | não |
| Financeiro real | 🔴 não verificável | depende do Asaas (acima) | **sim** |
| Domínio | 🔴 não resolve | `nslookup zelopay.com.br` → non-existent | **sim** |
| E-mail | 🔴 não configurado | SMTP padrão, BLOCKED desde 26/08 | **sim** |
| Analytics | 🟡 ausente | degrada bem, não é bloqueador de segurança | não |
| Legal | 🔴 incompleto | CNPJ/razão social `A DEFINIR` no próprio componente | **sim** |
| Mobile | 🟢 OK | E2E WebKit real, 18/18 × 3 execuções | não |
| Tablet | 🟢 OK | E2E 768px/1024px, 18/18 × 3 execuções | não |
| Desktop | 🟢 OK | E2E 1280px, 18/18 × 3 execuções | não |
| Observabilidade | 🟡 básica | logs estruturados + `eventos_asaas`; sem alerta em tempo real | não, mas registrado |

### GO / NO-GO

# 🔴 NO-GO

Cinco bloqueadores reais, nenhum deles do código construído nas Fases
1-20 — todos são configuração/decisão que só o proprietário resolve:

1. **Credenciais do Asaas** ausentes — bloqueia todo o fluxo
   financeiro real (cobrança, Pix Automático, e a própria assinatura
   da Zelo).
2. **Domínio `zelopay.com.br`** não resolve — não há onde publicar.
3. **SMTP de e-mails de autenticação** não configurado — cadastro
   real falha depois de 2-3 tentativas/hora.
4. **CNPJ/razão social** pendentes — Termos e Privacidade incompletos,
   risco de LGPD real (o sistema já guarda dado de terceiro).
5. **Nenhum ambiente de staging** separado de produção — risco
   operacional pra quando os 4 itens acima forem resolvidos e o
   primeiro teste real acontecer.

**O código em si não é o bloqueador.** Build, TypeScript, 676 testes
de domínio, 54 E2E cross-browser, e uma auditoria de segurança sem
achado crítico — tudo isso passa. O produto está pronto pra ser
ligado assim que as 5 decisões acima forem tomadas pelo proprietário;
nenhuma delas é conserto de código.

## 66. Reverse engineering de produto + upgrade de UX (02/09/2026)

Entre a Fase 20 e esta seção, duas rodadas de trabalho de produto
aconteceram fora da numeração de fases (não pedido pelo dono nessas
duas tarefas): **Etapa 3A** (preparação de staging — `robots.txt`
condicional por ambiente) e a **Rodada de Simplificação UX**, que
implementou os P0 da auditoria `ZELO_UX_SIMPLICITY_AUDIT.md`: CTA
primário do dashboard trocado pra recorrência, link público
`/autorizar/[id]` (o "cliente autoriza" da promessa comercial, antes
inexistente), KYC com explicação de propósito e CPF/CNPJ
reaproveitado, painel técnico de Configurações escondido atrás de
"Avançado". Essas mudanças **continuavam sem commit** no início desta
seção — preservadas, não retrabalhadas.

Esta seção é a operação de "reverse engineering + product upgrade":
comparação com Stripe/Linear/Midday/Mercury/Ramp/Lemon Squeezy
(pesquisa ao vivo nos quatro primeiros; conhecimento de produto já
consolidado nos dois últimos, que bloquearam o fetch automatizado),
gap analysis contra o estado real do código, e implementação dos
gaps de menor risco. Diagnóstico completo em
`ZELO_PRODUCT_REVERSE_ENGINEERING.md`; relatório desta rodada em
`ZELO_PRODUCT_UPGRADE_REPORT.md`.

**Achado real, não presumido**: a navegação lateral, documentada em
`ZELO_DESIGN_SYSTEM.md` como "vira navegação horizontal em 860px",
de fato virava — mas quebrava em várias linhas (`flex-wrap: wrap`)
em vez de uma faixa compacta, empurrando todo o conteúdo da página
pra baixo da dobra num aparelho de 812px de altura. Confirmado ao
vivo com `resize_window` mobile antes de mexer, não suposto.

**Implementado nesta rodada** (todos frontend/CSS, nenhuma mudança em
`lib/core`, `lib/asaas`, schema, RLS ou webhook):
1. Navegação mobile/tablet (`≤860px`) virou uma faixa horizontal
   rolável de uma linha só (`overflow-x: auto`, sem quebra) em vez de
   3-4 linhas empilhadas — `app/(app)/App.module.css`.
2. Confirmação leve ("Verificado agora") nos três pontos do produto
   onde um clique em "Verificar status agora" podia não mudar nada na
   tela e portanto não dar nenhum sinal de que funcionou —
   `AutorizacaoPix.tsx`, `CicloInstrucao.tsx`, `ContaFinanceira.tsx`
   (mesmo padrão já usado em "Copiado!"/"Link copiado!", só estendido).
3. Hierarquia visual do dashboard: "Recebido no mês" (a resposta pra
   "o que está acontecendo com meu dinheiro?") ganhou leve destaque
   tipográfico e um fundo verde muito sutil — antes os 4 números do
   topo tinham peso visual idêntico.

**Não implementado nesta rodada, por decisão explícita** (ver
`ZELO_PRODUCT_REVERSE_ENGINEERING.md` §E): modal/dropdown estilizado
(decisão já registrada no Design System de não construir isso pra um
único call site), `role="tablist"` nos filtros, frase de confiança
específica sobre o Asaas na tela de KYC (fica pra quando alguém
confirmar que a afirmação regulatória exata está correta), redesenho
de densidade do dashboard estilo Midday.

**Testes**: `tsc --noEmit` limpo (2×), `next build` limpo — 36 rotas,
`/autorizar/[id]` presente e fora de `(app)`. Regressão:
`teste-autorizacao-pix.ts` 46/46, `teste-autorizacao-publica.ts`
21/21 — nenhum dos dois arquivos de lib tocado nesta rodada, rodados
mesmo assim por tocarem os componentes React que os usam.
Responsividade verificada ao vivo (não só lida): mobile 375px e
tablet 768px em `/app`, `/app/clientes`, `/app/recorrencias/nova`,
`/autorizar/[id]` — sem overflow horizontal de página (tabelas
scrollam dentro do próprio contêiner, como já era o padrão).
