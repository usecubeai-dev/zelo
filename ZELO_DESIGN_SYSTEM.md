# ZELO — DESIGN SYSTEM OFICIAL

Fase 16 do pacote "Fases 16-20". Sistematiza a identidade visual que já
existe — **não é uma marca nova**. Documenta o que passou a existir de
fato no código nesta fase (`app/product-tokens.css`,
`app/(app)/App.module.css`, `app/(auth)/Auth.module.css`), não uma
aspiração.

Companheiro deste documento: `ZELO_PROJECT_CONTEXT.md` §4 (identidade
da marca) e §5 (áreas congeladas da landing).

---

## 1. Dois sistemas de cor, um só embaixo do outro

A Zelo tem **duas peças visuais com propósitos diferentes**, e desde
a Fase 16 elas usam paletas conscientemente diferentes:

| | Landing (`/`, `/comecar`) | Produto (`/app/*`, `/entrar`, `/criar-conta`, `/recuperar-senha`, `/nova-senha`) |
|---|---|---|
| tom | escura, cinematográfica | clara, premium, "produtividade" |
| tokens | `:root` em `app/globals.css` — **congelados**, Fase 16 não tocou um valor | `.zelo-produto` em `app/product-tokens.css` — novo nesta fase |
| por quê | experiência aprovada, `Stage.tsx`/beats/coreografia — mexer exige autorização explícita | instrução direta desta fase: "o aplicativo não deve ficar excessivamente escuro" |

**Mecanismo:** `app/product-tokens.css` declara um novo bloco de custom
properties escopado à classe `.zelo-produto` (aplicada em
`.moldura`/`.pagina`, os wrappers raiz de `/app` e das telas de conta).
Precisa ser uma classe global de verdade — `.moldura`/`.pagina` são
nomes de CSS Module e viram algo como `App-module__igqh8W__moldura` no
build, que um stylesheet global não alcança. Como custom properties CSS
são herdadas por cascata, **tudo dentro de `.zelo-produto` passa a
enxergar os tokens claros**, e nada fora dela (a landing) é afetado —
verificado visualmente nesta fase (screenshot da landing após a
mudança, idêntica).

## 2. Tokens de cor (produto)

Todos os pares texto/fundo abaixo foram verificados manualmente pela
fórmula de luminância relativa do WCAG antes de entrar no sistema —
não é "parece que dá" no olho.

| token | valor | contraste verificado |
|---|---|---|
| `--bg` | `#F6F7F6` | fundo de página — não branco puro (branco puro ao lado de card branco apaga a hierarquia) |
| `--surface` | `#FFFFFF` | cards, inputs, sidebar |
| `--surface-elevated` | `#FFFFFF` | reservado pra modal/dropdown quando existirem (mesmo tom, diferenciado por `--shadow-lg`) |
| `--surface-sunken` | `#EEF1EF` | trilho de medidor, hover sutil |
| `--text-primary` | `#14201C` | **16,8:1** sobre `--surface` |
| `--text-secondary` | `#45504C` | **8,4:1** sobre `--surface` |
| `--text-muted` | `#5F6965` | **5,7:1** sobre `--surface` |
| `--border` / `--border-strong` | `rgba(var(--border-rgb), .12 / .24)` | hairlines — grafite em baixa opacidade, não decoração |
| `--violet` | `#6C3BFF` | idêntico à landing — marca não muda |
| `--violet-hover` | `#5A2FE0` | **6,8:1** como texto/link (substitui `--violet-highlight`, que dava 2,2:1 em fundo claro) |
| `--violet-active` | `#4520C9` | = `--violet-deep` da landing |
| `--success` | `#16805C` | **4,9:1** — mesmo verde institucional |
| `--warning` | `#96702A` | **4,5:1** (limiar da AA — não escurecer sem reverificar) |
| `--danger` | `#B23B3B` | **5,9:1** — novo, consolida 3 tons de vermelho que existiam soltos (`#d98282`/`#f0aaaa`/`#f4c3c3`) |
| `--info` | `#2B5FA8` | novo — não existia antes |

Cada cor de estado tem par `-soft` (fundo pálido pra badge/alerta) e
`-rgb` (triplo pra `rgba()` com opacidade customizada — bordas de
etiqueta, glows).

### Camada de compatibilidade

`App.module.css`/`Auth.module.css` somam ~1100 linhas escritas ao
longo das Fases 1-15, todas referenciando os tokens antigos
(`--black`, `--graphite-900`, `--paper`, `--off`, `--gray-200..500`).
Reescrever cada uma dessas linhas agora, só por pureza de nome, seria
exatamente o tipo de "melhoria fora do escopo" que as regras gerais
desta fase pedem pra evitar — risco de regressão real por zero
ganho visível.

Em vez disso, `product-tokens.css` **realiasa** os nomes antigos pros
tokens novos (`--graphite-900: var(--surface)`, `--paper: var(--text-primary)`,
etc.), verificado caso a caso (cada token antigo só era usado como
`color:` OU só como `background:`, nunca os dois — confirmado por
grep antes de aliasar). O efeito: todo o CSS já escrito passou a
render claro sem precisar tocar uma regra.

**O que precisou de edição de verdade** (não é alias-ável):
- `rgba(226, 232, 230, X)` (33 ocorrências) — cinza-claro-sobre-preto
  não tem tradução automática pra "cinza-escuro-sobre-branco"; virou
  `rgba(var(--border-rgb), X)`.
- 5 cores de status em hex puro (`#4ade9b`, `#d9ae6a`, `#d98282`,
  `#f0aaaa`, `#f4c3c3`) — viraram `var(--success)`/`var(--warning)`/
  `var(--danger)`.
- 5 variações de `rgba(triplo-de-status, X)` — viraram
  `rgba(var(--*-rgb), X)`.
- `rgba(10, 15, 13, 0.72)` (4 ocorrências) — fundo quase-preto de
  `<input>`, um bug real que o alias não pegaria (input ficaria escuro
  num formulário claro); virou `var(--surface)`.
- `--violet-highlight` (usado em 7 lugares como link/texto) — o lilás
  claro da landing dá 2,2:1 sobre fundo claro (abaixo até do mínimo de
  3:1 pra borda). Aliasado pra `var(--violet-hover)`, que dá 6,8:1.

Migração linha-a-linha do restante (trocar `var(--gray-400)` por
`var(--text-muted)` direto, por exemplo) fica pra quando cada tela for
tocada de novo — não antes.

## 3. Tipografia

Já existia, mantida sem mudança:

| token | uso |
|---|---|
| `--font-display` (Plus Jakarta Sans) | títulos, valores financeiros, marca |
| `--font-sans` (Inter) | corpo de texto, labels, formulário |

Números monetários usam a classe utilitária `.tnum`
(`font-variant-numeric: tabular-nums`) — já existia em
`app/globals.css`, garante que valores em tabela alinhem por casa
decimal.

## 4. Espaçamento, radius, shadow, motion, z-index

Consolidados como tokens em `product-tokens.css`, a partir da escala
que já estava em uso de fato (não inventada):

```
--space-1..12   4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48px
--radius-sm/md/lg/xl/full   4 / 7 / 10 / 12 / 999px
--shadow-sm/md/lg    novo — o modo escuro usava só borda pra separar
                     camadas; modo claro precisa de sombra de verdade
                     pra dar profundidade sem virar um retângulo cinza
--duration-fast/base/slow   0.15 / 0.2 / 0.35s
--ease-out                  já existia, mantido
--z-dropdown/sticky/overlay/modal/toast   20/30/40/50/60 — hierarquia
                                          única; nenhum valor solto
                                          antes existia pra colidir,
                                          mas fica documentado antes
                                          que exista
```

Migração do CSS existente pra essas escalas (trocar `padding: 16px
18px` por `padding: var(--space-4) var(--space-5)`) é a mesma
decisão do item 2: mecânica, baixo risco, mas não vale reescrever
~1100 linhas sem necessidade. Todo componente **novo** a partir daqui
usa os tokens diretamente.

## 5. Componentes — inventário real

O produto não usa um framework de componentes (React puro + CSS
Modules). "Componente" aqui é uma classe (ou conjunto de classes) em
`App.module.css`/`Auth.module.css` com um contrato visual estável.

| componente do prompt | existe? | onde |
|---|---|---|
| Button (primário) | 🟢 | `.botao` |
| Button (secundário) | 🟢 | `.botaoSec` |
| Input / Textarea | 🟢 | `.campo`/`.formApp input,textarea` |
| Select | 🟢 | mesma classe de input, `<select>` nativo |
| Checkbox / Radio | 🟡 | só o checklist de onboarding (`.jornadaMarca`) usa uma caixa customizada; nenhum formulário do produto usa checkbox/radio de verdade ainda (nenhum caso de uso pediu) |
| Badge / Status indicator | 🟢 | `.etiqueta` + modificadores `.sitPaga`/`.sitVencida`/`.sitEstornada`/`.sitCancelada`/`.sitPendente`/`.sitEnviada` |
| Alert | 🟢 | `.erroForm` (erro de formulário), `.erroGeral`/`.aviso` (Auth) |
| Card / Financial summary | 🟢 | `.numeros`/`.numero` (grade de métricas), `.bloco` (card genérico) — **novo nesta fase:** `.blocoAviso`/`.blocoPerigo`, variantes de atenção que substituíram `style={{borderColor: "..."}}` inline na tela de assinatura |
| Empty state | 🟢 | `.vazio`/`.vazioTitulo`/`.vazioTexto` |
| Loading state | 🟢 | `loading.tsx` por rota (skeleton com `aria-busy`/`aria-live`, já com `prefers-reduced-motion`) |
| Error state | 🟡 | erro de formulário coberto (`.erroForm`); página de erro genérica (`error.tsx`) não auditada nesta fase — Fase 18 |
| Progress | 🟢 | `.medidor`/`.medidorPreenchido` (Fase 15, uso do plano) |
| Navigation / Sidebar / Header | 🟢 | `.lateral`/`.nav`/`.item`, `.cabecalho` |
| Page header | 🟢 | `.cabecalho`/`.titulo`/`.subtitulo` |
| Section | 🟢 | `.bloco`/`.blocoTitulo` |
| Avatar | 🔴 | não existe — nenhuma tela mostra foto/iniciais de usuário; não criado por falta de necessidade real |
| Tabs | 🟡 | os filtros de lista (`.filtro`) funcionam como tabs visuais, mas não são `role="tablist"` semântico — Fase 18 (acessibilidade) decide se formaliza |
| Table / Data list | 🟢 | tabelas nativas com classes próprias por tela (cobrancas, cobranças, recorrências) — mesmo padrão visual, não uma classe genérica compartilhada ainda |
| Toast | 🔴 | não existe — nenhuma ação do produto usa notificação transiente; o padrão atual é a própria tela recarregar com o novo estado (Server Actions), ou o centro de notificações persistente da Fase 13 |
| Modal / Dropdown / Tooltip / Confirm dialog | 🔴 | não existem. Auditado: só UM ponto no produto usa confirmação de ação destrutiva (`window.confirm()` nativo, em `AutorizacaoPix.tsx`, cancelar autorização Pix). Construir um sistema de modal acessível (focus trap, ESC, aria) pra um único call site, com as Fases 17-20 inteiras ainda pela frente, não passa no teste "resolve necessidade real" — fica documentado como gap conhecido, não fingido como resolvido |

## 6. Estados

Cobertos onde existe interação real:

- **Botões:** default, hover, `:disabled` (opacidade + cursor `wait`),
  focus visível (novo: outline violeta em vez do verde herdado da
  landing — verde não é a cor de foco do produto).
- **Inputs:** default, `:focus-visible` (glow violeta), `aria-invalid`
  (borda vermelha), erro associado (`.erro`, `.erroGeral`).
- **Badges de status:** cada status financeiro é cor **e** texto (nunca
  só cor — "Vencida"/"Paga"/"Pendente" sempre escrito, a cor reforça,
  não substitui).
- **Loading:** skeleton por rota, `aria-busy`/`aria-live="polite"`.
- **Empty:** `.vazio` em toda lista sem dados.
- **Responsive:** grade `.numeros` cai de 4 → 2 → 1 coluna
  (860px/420px); sidebar vira navegação horizontal em 860px.

## 7. Acessibilidade — o que este sistema garante

- **Foco visível em todo o produto:** `.zelo-produto :focus-visible`
  redefine o outline pra violeta (a landing usa verde — cores de foco
  diferentes por peça visual, cada uma consistente dentro de si).
- **Contraste:** todo token de texto novo verificado ≥ 4,5:1 (ver
  tabela do item 2). `--warning` está exatamente no limiar (4,52:1) —
  documentado pra não escurecer sem reverificar se algum dia mudar.
- **Nunca só cor:** todo indicador de status carrega texto.
- **`prefers-reduced-motion`:** já coberto pelo skeleton; motion tokens
  (`--duration-*`) preparados pra qualquer animação nova respeitar o
  mesmo princípio.
- **Áreas clicáveis:** botões mantêm `min-height: 42-50px` (já era
  assim, mantido).

O que este sistema **não** audita ainda (fica pra Fase 18, que é
especificamente sobre isso): navegação por teclado ponta-a-ponta,
semântica de `aria-*` em tabelas/formulários existentes, ordem de
heading, screen reader real.

## 7.1 Nota da Fase 17 — a varredura da Fase 16 não era exaustiva

A Fase 16 migrou `App.module.css` e `Auth.module.css`. A Fase 17 achou
mais dois stylesheets do produto que tinham passado batido —
`ContaFinanceira.module.css` e `AutorizacaoPix.module.css` — com os
mesmos problemas (fundo `rgba(0,0,0,0.22)`, bordas cinza-claro, 3 cores
de status duplicadas com hex diferente das já tokenizadas) **mais**
quatro nomes de token que nunca foram declarados em lugar nenhum
(`--text`, `--text-2`, `--primary`, `--muted`) — um bug pré-existente
e silencioso (a propriedade ficava inválida e o elemento herdava a cor
do pai). Os dois arquivos foram migrados na Fase 17. Lição registrada:
antes de declarar um sistema de tokens "aplicado", `grep -rn
"\.module\.css"` no projeto inteiro — não confiar que os arquivos mais
óbvios são os únicos.

## 8. Como usar (daqui pra frente)

Componente novo: usar os tokens de `product-tokens.css` diretamente
(`var(--surface)`, `var(--space-4)`, etc.), nunca os nomes antigos
(`--graphite-900` etc.) — esses só existem pra não quebrar o que já
foi escrito.

Cor de status nova: primeiro perguntar se `--success`/`--warning`/
`--danger`/`--info` já cobre. Só criar tor novo com a mesma
verificação de contraste documentada acima.
