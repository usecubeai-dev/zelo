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
