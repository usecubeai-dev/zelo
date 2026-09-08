# ZELO — Reverse Engineering de Produto (benchmark → gap → recomendação)

Diagnóstico produzido antes de qualquer implementação desta rodada. Não copia nenhum produto — usa os seis de referência só para extrair **padrões**, comparados com o estado real do código Zelo (lido diretamente, não presumido). Complementa, sem repetir, dois documentos já existentes: [ZELO_DESIGN_SYSTEM.md](ZELO_DESIGN_SYSTEM.md) (inventário de tokens/componentes já construído) e [ZELO_UX_SIMPLICITY_AUDIT.md](ZELO_UX_SIMPLICITY_AUDIT.md) (auditoria de fluxo/linguagem de uma rodada anterior, cujos P0 já foram implementados — CTA do dashboard, link público de autorização, simplificação de KYC, painel técnico escondido).

**Método**: leitura do código-fonte real do produto (`app/(app)/app/**`, `app/product-tokens.css`, `App.module.css`) + consulta a páginas públicas dos produtos de referência (Stripe Checkout, Linear, Midday, Mercury — via fetch ao vivo; Ramp e Lemon Squeezy bloquearam o fetch automatizado, então essas duas entram com base em conhecimento de produto já consolidado publicamente, sinalizado onde usado).

---

## A. Estado atual do Zelo

Confirmado por leitura de código nesta sessão e nas duas anteriores:

- **Arquitetura visual**: dois sistemas de token — landing escura (`app/globals.css`, congelada) e produto claro (`app/product-tokens.css`, escopado em `.zelo-produto`). Contraste WCAG verificado token a token. Documentado em `ZELO_DESIGN_SYSTEM.md`.
- **Componentes que já existem e funcionam bem**: botão primário/secundário, input com erro/dica associados (`aria-describedby`), badge de status (cor **e** texto, nunca só cor), card de métrica (`.numeros`/`.numero`), estado vazio contextual (`.vazio`), skeleton de loading por rota com `aria-busy`, página de erro genérica humana (`error.tsx`, não vaza detalhe técnico), grade responsiva de métricas (4→2→1 coluna).
- **O que está documentado como gap conhecido, não escondido**: nenhum Modal/Dropdown/Tooltip/Confirm dialog estilizado existe — um único `window.confirm()` nativo (cancelar autorização Pix); nenhum Toast existe — o padrão é a Server Action redirecionar/revalidar a própria tela; Tabs são pills de filtro, não `role="tablist"` semântico; Avatar não existe (sem necessidade real ainda).
- **Fluxo principal** (após a rodada anterior de simplificação): cadastro → onboarding (checklist de 8 passos derivados do estado real) → dashboard com CTA primário "Nova cobrança automática" → conta de recebimento com explicação de propósito antes do KYC → cliente → recorrência → link público `/autorizar/[id]` (sem login) → cliente autoriza → cobrança automática. Já testado com 267 testes automatizados + build limpo na rodada anterior.
- **Bloqueadores de produção** (não mudam nesta rodada, são decisão do proprietário): Asaas sem credencial real, domínio não resolve, SMTP limitado, CNPJ/razão social pendentes, sem staging separado — nenhum é problema de código.

## B. Benchmark

### Stripe (Checkout — fetch ao vivo, stripe.com/payments/checkout)
- **Padrão**: validação em tempo real por campo, com mensagem de erro descritiva no ponto do erro — nunca só no envio.
- **Por que funciona**: corrige o usuário no momento da digitação, antes de ele perder contexto.
- **Aplicabilidade ao Zelo**: os formulários do Zelo já fazem isso (validação client-side espelhando a do servidor, foco automático no primeiro campo inválido) — **gap pequeno**, não zero: nem todo campo tem validação síncrona por-tecla (alguns só validam no submit).
- **Padrão**: tela de sucesso dedicada, com resumo da transação, não só um toast que some.
- **Aplicabilidade**: o Zelo já faz isso para "cliente cadastrado" (redireciona para a ficha) e "cobrança criada" (idem) — alinhado.
- **Padrão**: customização de marca (cor, logo, radius) mantendo o layout estrutural fixo — a identidade muda, a arquitetura da tela não.
- **Aplicabilidade**: Zelo já separa tokens de landing/produto sem duplicar estrutura — alinhado.

### Linear (fetch ao vivo, linear.app)
- **Padrão**: divulgação progressiva — lista densa mostra só o essencial (id, título, status, responsável), detalhe completo só ao abrir o item.
- **Por que funciona**: reduz carga cognitiva na visão geral sem esconder informação de quem precisa dela.
- **Aplicabilidade ao Zelo**: as listas (clientes, cobranças, recorrências) já são enxutas (4-5 colunas), mas o **dashboard** mistura visão geral com listas de tabela completas na mesma tela — gap real, ver seção C.
- **Padrão**: paleta quase monocromática, cor reservada só para status/prioridade — nunca decorativa.
- **Aplicabilidade**: o Zelo já segue essa regra por token (`--success`/`--warning`/`--danger` só em badge/etiqueta) — alinhado, mas a auditoria anterior encontrou pontos de texto técnico fora de lugar (já corrigidos na rodada passada).
- **Padrão**: identificadores técnicos (ENG-2852) em fonte monoespaçada — sinaliza "isto é um dado de sistema", separado do texto humano ao redor.
- **Aplicabilidade**: o Zelo tem poucos identificadores visíveis ao usuário (bom — a rodada anterior escondeu a maioria atrás de "Avançado"); onde aparecem (ex.: `/autorizar/[id]` não expõe nenhum), não é um gap ativo.

### Midday (fetch ao vivo, midday.ai — freelancer/invoicing SaaS, o benchmark mais próximo do Zelo em público-alvo)
- **Padrão**: tabela de transações como âncora visual do dashboard — dinheiro entrando/saindo é a primeira coisa que a pessoa vê, com cor por tipo (verde entrada, vermelho saída).
- **Por que funciona**: para um autônomo, "quanto entrou" é a pergunta #1 — a tela responde sem exigir clique.
- **Aplicabilidade ao Zelo**: o dashboard já lidera com "Recebido no mês"/"A receber"/"Vencido" — alinhado estruturalmente; a diferença é densidade visual (Midday usa uma tabela contínua, o Zelo usa cards + tabela separada) — gap de polimento, não de arquitetura.
- **Padrão**: cada capacidade do produto (faturamento, transações, clientes) é um módulo próprio, não uma tela genérica — reforça que o usuário está numa ferramenta financeira séria, não um CRUD.
- **Aplicabilidade**: o Zelo já segmenta assim (Clientes/Cobranças/Recorrências/Recebimentos são áreas distintas) — alinhado.
- **Padrão**: "Inbox" com sugestão de conciliação (par transação↔recibo) com botão "Review" — reduz trabalho manual de bater conta.
- **Aplicabilidade**: fora de escopo — o Zelo já reconcilia automaticamente via webhook, o usuário não precisa conciliar manualmente. Não é um gap, é uma vantagem estrutural do Zelo (webhook + idempotência) sobre o problema que o Midday resolve de outro jeito.

### Mercury (fetch ao vivo, mercury.com — banking)
- **Padrão**: sinais de confiança em camadas — prova social específica, validação de mídia, transparência de segurança (ex.: seguro FDIC explícito), nunca genérico ("seguro e confiável" sem número).
- **Por que funciona**: fintech vende confiança antes de vender funcionalidade — número específico convence mais que adjetivo.
- **Aplicabilidade ao Zelo**: a landing (congelada) já tem seção de confiança; o **produto pós-login** não tem nenhum sinal de confiança visível (ex.: nada explica que o dinheiro passa pelo Asaas, que é regulado) — gap real mas **de baixo risco de implementar mal** (é conteúdo, não arquitetura), ver seção C.
- **Padrão**: velocidade como promessa central de onboarding ("aplique em 10 minutos") — tempo é o benefício, não uma lista de features.
- **Aplicabilidade**: alinhado com o que a rodada anterior já entregou (Time-to-first-value como critério de sucesso).
- **Padrão**: nunca mostra a interface real crua na comunicação — usa vinhetas ilustradas de tarefas discretas concluídas.
- **Aplicabilidade**: não se aplica ao produto em si (é tática de marketing, não de UI) — fora de escopo aqui.

### Ramp (conhecimento consolidado — fetch automatizado não retornou conteúdo de interface)
- **Padrão conhecido publicamente**: dashboard com número grande e único como âncora (gasto do mês), cartões de transação com logo do estabelecimento, badges de política ("dentro da política"/"fora da política") ao lado de cada linha.
- **Por que funciona**: uma pessoa de operações precisa saber "está tudo dentro do esperado?" num relance — o badge por linha responde isso sem exigir abrir cada item.
- **Aplicabilidade ao Zelo**: o equivalente é o bloco "Problemas" do dashboard (cobrança vencida, falha no Asaas, débito recusado) — já existe e já é a mesma ideia (exceção em destaque, não lista completa). Alinhado.

### Lemon Squeezy (conhecimento consolidado — fetch automatizado bloqueado, 403)
- **Padrão conhecido publicamente**: onboarding de poucos passos até o primeiro produto/checkout publicado, preço e regras fiscais tratados pela plataforma (não expostos como configuração ao usuário).
- **Por que funciona**: quem vende não quer aprender tributação — a plataforma decide por trás, o usuário só vê o resultado.
- **Aplicabilidade ao Zelo**: exatamente o espírito da simplificação de KYC feita na rodada anterior — esconder "por que isso é pedido" atrás de uma frase, não de um manual. Já alinhado depois da última rodada; reforça que a direção tomada estava certa.

## C. Gap Analysis

| Área | Zelo atual | Benchmark | Gap | Prioridade |
|---|---|---|---|---|
| Dashboard — densidade | Cards de métrica + tabela de próximos vencimentos + 2 blocos (Problemas/Atividade), tudo na mesma rolagem | Linear/Midday: uma âncora visual dominante, resto é secundário e compacto | Sem hierarquia de peso entre "números" e "tabela" — tudo tem o mesmo destaque visual | P2 |
| Confirmação de ação | Server Action redireciona pra tela com o novo estado (cliente/cobrança criados) — sem microfeedback na própria ação | Stripe: tela de sucesso dedicada; Linear: feedback inline imediato | Redirecionar já confirma, mas não há nenhum reforço visual imediato (ex.: campo/linha nova destacada por um instante) — perda pequena de percepção de "algo aconteceu" | P2 |
| Confirmação destrutiva | `window.confirm()` nativo do navegador (cancelar autorização) | Produtos de referência usam diálogo estilizado, consistente com o resto da UI | Quebra de consistência visual num único ponto — já documentado como decisão deliberada no Design System (não vale construir modal pra 1 call site) | P3 — mantém decisão anterior |
| Sinal de confiança pós-login | Nenhum — a tela de configurações menciona Asaas só no painel técnico agora escondido | Mercury: confiança explícita e específica em todo lugar sensível | Tela de conexão financeira (KYC) não reforça "por que isso é seguro", só "por que é pedido" (já corrigido) | P2 |
| Responsividade — não verificada nesta sessão | Grade `.numeros` já tem breakpoints documentados (860px/420px); não testada ao vivo desde a Fase 19 (E2E) | Todos os benchmarks são mobile-first de fato | Risco de regressão silenciosa desde a última verificação formal — precisa reconfirmar, não necessariamente corrigir | P1 (verificação) |
| Tabela do dashboard vs. cards | Cards de métrica em grade 4 colunas + tabela full-width abaixo | Midday: tudo dentro de um único ritmo visual (tabela como âncora) | Estético, não funcional — baixo risco/baixo ganho de mexer | P3 |
| Acessibilidade de tabs de filtro | `.filtro` são links estilizados como pills, sem `role="tablist"` | Nenhum benchmark exige isso especificamente, mas é WCAG básico | Gap real, mas já registrado como decisão consciente no Design System (§5, linha Tabs) — pendente de decisão do time, não desta rodada isoladamente | P3 |
| Toast/feedback transiente | Não existe (decisão documentada: página recarrega em vez disso) | Todos os benchmarks usam feedback transiente para ações rápidas (favoritar, marcar como lido) | Onde já existe recarregamento de página (criar cliente/cobrança), não é gap. Onde existe ação sem navegação (marcar notificação como lida, verificar status) — não há confirmação nenhuma | P1 |

## D. Recomendações

Ordenadas pela prioridade da tabela acima, e pelo que é seguro implementar sem tocar arquitetura financeira:

1. **P1 — Verificar responsividade ao vivo** (mobile 375px, tablet 768px, desktop) nas telas do fluxo principal (dashboard, clientes, cobranças, formulário de recorrência, `/autorizar/[id]`) e corrigir qualquer quebra real encontrada. Não presumir que os breakpoints documentados continuam corretos sem checar.
2. **P1 — Confirmação leve para ações sem navegação** (marcar notificação como lida, "Verificar status agora"): hoje o `router.refresh()` já atualiza o estado, mas nada comunica "isso funcionou" no instante do clique além do próprio dado mudar. Adicionar uma confirmação textual mínima e acessível (`aria-live`) nesses pontos específicos — não construir um sistema de toast genérico (a decisão anterior de não construir infraestrutura nova pra isso continua válida; a correção é local, não arquitetural).
3. **P2 — Reforçar hierarquia visual do dashboard**: dar mais peso tipográfico/espacial ao bloco "Recebido no mês" (a resposta pra "o que está acontecendo com meu dinheiro") frente aos outros três números, seguindo o padrão Midday/Ramp de uma âncora visual clara em vez de quatro números com peso igual.
4. **P2 — Frase de confiança na conexão financeira**: uma linha curta e verdadeira (ex.: menção a que o Asaas é instituição de pagamento autorizada pelo Banco Central — checar se essa afirmação é precisa antes de publicar) perto do formulário de KYC, no espírito Mercury de confiança específica, não genérica.
5. **P3 — não implementar nesta rodada**: modal/dropdown estilizado (decisão já registrada e ainda válida), reformular tabs de filtro para `role="tablist"` (baixo risco mas baixo ganho isolado, melhor decidir junto de uma revisão de acessibilidade mais ampla), redesenho de densidade do dashboard estilo Midday (mudança estética sem problema funcional comprovado).

## E. O que NÃO deve ser alterado

- **Landing page inteira** (`Stage.tsx`, `lib/scene.ts`, beats, `Hero`, `CommercialProblem`, `HowItWorks`, `Automation`, `JourneyProgress`, `SmoothScroll`, Lenis) — congelada, confirmado em `ZELO_PROJECT_CONTEXT.md` §5. Nenhum benchmark encontrado justifica reabrir essa área: os padrões observados (Mercury/prova social, Stripe/confiança) já foram endereçados na landing em fases anteriores.
- **Arquitetura financeira**: `lib/core/*`, `lib/asaas/*`, webhook, idempotência, RLS, schema — nenhum gap de benchmark é sobre isso; os seis produtos de referência são referência de **interface**, não de motor de pagamento, e o motor do Zelo já é auditado e testado (676 testes de domínio).
- **Provider Asaas** — sem qualquer indício de que trocar ou alterar a integração resolva um gap de UX. OpenPix continua fora de escopo.
- **`window.confirm()` de cancelar autorização** — decisão já tomada e registrada no Design System; não revertida aqui.
- **Onboarding checklist de 8 passos, o link público `/autorizar/[id]`, a simplificação de KYC, o painel técnico escondido** — implementados na rodada imediatamente anterior a esta, já testados (267 testes) e verificados ao vivo. Não retrabalhar.
