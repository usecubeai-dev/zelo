# ZELO — ICP OPERACIONAL: PERSONAL TRAINER / FITNESS

Transforma o ICP estratégico (Personal Trainers/Fitness como primeiro mercado
de aquisição da Zelo) num modelo operacional: pesquisável → identificável →
qualificável → pontuável → abordável → mensurável.

**Escopo desta tarefa:** definição e documentação. Nada aqui foi
implementado em código, nenhum lead real foi coletado, nenhum scraping foi
feito. Isso alimenta o Outbound Engine (`Documents/outbound-engine/`)
futuramente, quando a Fase 9+ for autorizada.

**Como este documento foi construído:** não existe pesquisa de mercado nem
dado real de personal trainers registrado neste projeto até agora (verificado
em `PROJECT_STATUS.md`, `ZELO_PROJECT_CONTEXT.md`, `ZELO_AUTONOMOUS_PLAN.md` —
nenhum menciona ICP, persona, nicho de fitness ou concorrência comercial).
O modelo abaixo é construído a partir de: (a) o que já está decidido sobre a
Zelo nesses documentos (preço, posicionamento, regras de não inventar dado),
e (b) o comportamento operacional amplamente conhecido de como personal
trainers autônomos cobram no Brasil (mensalidade fixa por pacote de
acompanhamento, cobrança manual via Pix/transferência, lembrete por
WhatsApp). Onde uma suposição quantitativa foi necessária para o modelo
funcionar, ela está marcada explicitamente como **hipótese a validar** — ver
seção 12. Nenhum número de mercado (quantidade de PTs no Brasil, ticket
médio real, taxa de conversão esperada) foi inventado como fato.

**Divergências encontradas nos documentos existentes (registradas, não
resolvidas — não é escopo desta tarefa decidir):**
1. `ZELO_PROJECT_CONTEXT.md` (seção 2, "Público") lista um público amplo
   (academias, estúdios, clínicas, escolas, autônomos, consultorias,
   agências, manutenção, clubes, associações, SaaS) e **não menciona**
   Personal Trainer/Fitness como mercado prioritário de aquisição. A
   definição de "primeiro mercado" trazida nesta tarefa é mais recente que
   esse documento e ainda não está refletida nele.
2. O mote de marca citado nesta tarefa ("Pare de cobrar. Comece a receber.")
   difere do registrado em `ZELO_PROJECT_CONTEXT.md` ("Você trabalha. A Zelo
   cobra."). Não sei qual é o atual — sinalizado como pendência (seção 12).

Companheiros deste documento: `ZELO_PROJECT_CONTEXT.md` (contexto geral do
produto), `PROJECT_STATUS.md` (estado técnico), `Documents/outbound-engine/`
(motor que vai consumir este ICP).

---

## 1. Definição oficial do ICP

**Personal trainers e profissionais de fitness autônomos (ou com equipe
pequena) que atendem uma carteira própria de alunos/clientes e cobram por
isso de forma recorrente — mensalidade ou pacote mensal de acompanhamento —
hoje usando cobrança manual (Pix copia-e-cola, transferência, dinheiro) e
cobrança/lembrete por WhatsApp.**

O ICP não é "alguém que trabalha com fitness". É especificamente alguém que
**já tem o comportamento de cobrança recorrente manual** que a Zelo resolve.
Um personal que só dá aula avulsa, sem pacote fixo, não tem a dor que o
produto ataca — mesmo sendo "fitness".

## 2. Persona operacional

**Nome de trabalho:** "Personal Autônomo com Carteira Recorrente" (perfil
composto, não uma pessoa real).

- Atua sozinho ou com 1–2 profissionais parceiros/funcionários.
- Atendimento presencial, online ou híbrido — o canal não importa para o
  ICP, a recorrência da cobrança importa.
- Tem carteira própria de alunos (não é apenas instrutor contratado de uma
  academia, sem relação de cobrança direta com o aluno).
- Cobra por pacote/mensalidade de acompanhamento, não por aula avulsa
  isolada.
- Hoje, cobra manualmente: manda o Pix, pede o comprovante, confere se
  caiu, manda lembrete de vencimento pelo WhatsApp.
- Controla clientes e pagamentos por planilha, agenda física/digital
  genérica ou de cabeça — não por um sistema financeiro dedicado.
- Tem alguma presença digital (Instagram e/ou WhatsApp Business) porque é
  como capta e mantém aluno hoje, mesmo que não seja sofisticada.
- **Faixa de alunos ativos**: hipótese de trabalho — normalmente entre ~15 e
  ~60 alunos pagantes simultâneos para um profissional autônomo (varia
  muito por presencial vs. online). **Não validado com dado real** — ver
  seção 12.

## 3. Critérios obrigatórios (must-have)

Um lead só é considerado ICP (mesmo que C) se atender a **todos**:

1. É profissional de fitness/personal trainer atuando com clientes diretos
   (não é apenas conteúdo/influência sem prestação de serviço).
2. Tem carteira própria — a relação comercial (cobrança) é entre ele e o
   aluno, não entre o aluno e uma empresa/rede.
3. O modelo de cobrança é recorrente (mensalidade, pacote mensal,
   trimestral) — não é só avulso por aula/sessão isolada.
4. É contatável publicamente por pelo menos um canal (Instagram, WhatsApp,
   site) sem precisar de intermediário.

Faltando qualquer um destes, o lead não entra na operação — vai para
critérios de exclusão (seção 5), não para C/D por pontuação baixa.

## 4. Critérios desejáveis (aumentam prioridade, não são obrigatórios)

- Evidência explícita de dor de cobrança (queixa sobre atraso, sobre
  "ficar cobrando", etc.).
- Presença digital ativa e atualizada (posts/stories recentes, não perfil
  parado).
- Menção comercial explícita no perfil ("mensalidade", "plano", "vagas").
- Uso de alguma ferramenta paga (agenda digital, app de treino, link na
  bio pago) — indica que já paga por ferramenta e tem maturidade digital
  pra adotar outra.
- Volume maior de alunos (mais dor de cobrança manual).
- Sinal de crescimento (contratou outro profissional, abriu espaço
  próprio, expandiu de presencial para híbrido).

## 5. Critérios de exclusão (descartar, não pontuar)

Aplicados **antes** do scoring — qualquer um destes classifica o lead como
**D** direto, independente de qualquer outro sinal positivo:

- Perfil abandonado / sem atividade recente aparente.
- Atua só com aula avulsa, sem pacote/mensalidade — sem recorrência não há
  cobrança recorrente para automatizar.
- É funcionário/instrutor de academia ou rede sem carteira própria — quem
  cobra o aluno é a empresa, não ele.
- Rede, franquia ou academia de porte médio/grande, com sistema de gestão e
  cobrança próprio já implantado (ERP de academia) — decisão de compra não
  é dele, e o produto não foi desenhado para esse porte.
- Nenhum canal de contato direto e público disponível.
- Negócio estruturalmente incompatível com cobrança recorrente B2C (ex:
  workshop pontual, evento único, curso fechado sem mensalidade).

## 6. Sinais de compra (públicos, identificáveis em pesquisa)

**Sinais fortes** (fit direto com o problema que a Zelo resolve):
- "mensalidade", "plano mensal", "plano trimestral"
- "acompanhamento mensal/contínuo"
- "vagas abertas para acompanhamento", "últimas vagas do mês"
- "manda o Pix", "chave Pix", referência explícita a cobrança via Pix
- "chama no WhatsApp para fechar/saber mais" combinado com menção de plano

**Sinais médios** (indicam modelo de negócio compatível, mas sem
confirmação direta de recorrência):
- "consultoria online", "treino personalizado", "acompanhamento online"
- "alunos" usado no plural, com destaque/story dedicado a eles
- bio com WhatsApp Business direto (não só "@" do Instagram)
- menção a "resultado em X meses" (sugere pacote, não aula avulsa)

**Sinais fracos** (contexto do nicho, sem sinal comercial claro):
- conteúdo majoritariamente educativo (dicas de treino/nutrição) sem CTA
  de venda
- perfil com bastante alcance/seguidores mas sem chamada comercial visível
- menção de preço por aula avulsa isolada, sem pacote

## 7. Sistema de scoring (0–100)

Aplicado **somente** a leads que já passaram pelos critérios obrigatórios
(seção 3) e não caíram em nenhuma exclusão (seção 5).

| # | Critério | Peso | Evidência necessária | Pontuação |
|---|---|---|---|---|
| 1 | Fit de nicho | 15 | Atua como PT/profissional de fitness com clientes diretos, confirmado pela bio/conteúdo | 15 = claro e direto · 8 = fitness mas ambíguo sobre atender direto · 0 = não seria pego, exclusão já teria filtrado |
| 2 | Recorrência evidente | 15 | Menção explícita de mensalidade/pacote/plano | 15 = mensalidade/pacote citado explicitamente · 8 = "acompanhamento" sem confirmar periodicidade · 0 = só aula avulsa citada (exclusão já filtraria) |
| 3 | Número de clientes/alunos | 10 | Menção numérica, destaque "meus alunos", ou volume de posts com alunos diferentes | 10 = evidência de carteira grande (dezenas) · 5 = carteira pequena/moderada · 0 = nenhuma evidência de volume |
| 4 | Evidência de cobrança manual | 15 | Menção/print de Pix, "manda o comprovante", queixa sobre cobrar | 15 = evidência direta e explícita · 7 = indício indireto (ex: só aceita Pix/dinheiro citado) · 0 = nenhuma evidência |
| 5 | Presença no WhatsApp | 10 | Número/link de WhatsApp acessível publicamente | 10 = WhatsApp direto e em destaque · 5 = precisa buscar/pedir · 0 = não encontrado |
| 6 | Presença no Instagram | 10 | Perfil ativo, postagem recente, bio informativa | 10 = ativo e atualizado (semanas) · 5 = existe mas pouco ativo · 0 = inexistente/abandonado |
| 7 | Potencial de conversão/retenção | 10 | Indícios de negócio estabelecido (não amador esporádico) — o preço da Zelo é fixo (R$29,90/mês), então este critério mede propensão a converter e continuar assinando, não "quanto pode pagar" | 10 = negócio estruturado, consistente · 5 = indícios parciais · 0 = amador/esporádico |
| 8 | Maturidade do negócio | 5 | Tempo de atuação, site próprio, uso de outra ferramenta paga | 5 = maduro (ferramenta paga, tempo de atuação visível) · 2 = indícios parciais · 0 = nenhum indício |
| 9 | Dor aparente | 5 | Queixa explícita sobre cobrança/administrativo | 5 = queixa explícita encontrada · 0 = nenhuma menção (não é sinal negativo, é ausência de dado) |
| 10 | Facilidade de contato | 5 | Canal direto, sem intermediário, resposta esperável | 5 = contato direto e simples · 2 = precisa de passo extra (DM antes do WhatsApp) · 0 = difícil/impossível |

**Total possível: 100.**

### Classificação

| Faixa | Classe | Significado |
|---|---|---|
| 80–100 | **A — ICP prioritário** | Alta prioridade para abordagem |
| 60–79 | **B — ICP qualificado** | Vale prospectar, depois dos A |
| 40–59 | **C — Baixa prioridade** | Manter só se houver capacidade |
| 0–39, **ou qualquer critério de exclusão (seção 5)** | **D — Descartar** | Não prospectar |

Exclusão sempre tem prioridade sobre pontuação: um lead que bateria 90
pontos mas é funcionário CLT de rede grande (sem carteira própria) é **D**,
não A.

## 8. Classificação A/B/C/D — regra de aplicação

- **A**: abordar primeiro, sem exceção. É onde a taxa de resposta e
  conversão esperada é mais alta.
- **B**: fila normal, depois que a fila de A tiver pelo menos um contato
  feito por lead.
- **C**: só entra se sobrar capacidade de prospecção depois de A e B — não
  deve consumir tempo que tiraria de um A/B.
- **D**: nunca entra na operação, nem para teste. Reprocessar um D exige
  nova pesquisa (a pessoa pode ter mudado de modelo de negócio), não uma
  reclassificação manual do mesmo dado.

## 9. Campos da base de leads (futuro — nenhum dado real coletado agora)

| Campo | Observação |
|---|---|
| `nome` | nome público do profissional/perfil |
| `profissao` | ex.: "personal trainer", "coach fitness" |
| `nicho` / `subnicho` | ex.: musculação, funcional, online, emagrecimento |
| `cidade` | quando identificável |
| `instagram` | handle/link público |
| `whatsapp` | só quando obtido de fonte pública legítima |
| `email` | só quando disponível publicamente e legitimamente |
| `site` | se existir |
| `numero_estimado_clientes` | estimativa qualitativa (faixa), não inventada como exata |
| `modelo_cobranca` | mensalidade / pacote mensal / trimestral / outro |
| `ticket_estimado` | só se houver evidência pública (ex.: preço citado no perfil) — nunca inventado |
| `evidencia_recorrencia` | texto/print/observação que sustenta a classificação |
| `evidencia_dor` | texto/observação sobre cobrança manual encontrada |
| `ferramentas_utilizadas` | agenda digital, app de treino, etc., se identificável |
| `icp_score` | 0–100, conforme seção 7 |
| `classificacao` | A / B / C / D |
| `motivo_classificacao` | por que recebeu essa nota/classe — obrigatório, não opcional |
| `fonte` | onde o lead foi encontrado (Instagram, indicação, etc.) |
| `data_pesquisa` | quando o levantamento foi feito |
| `observacoes` | campo livre |

## 10. Regras de priorização

1. 100% dos leads **A** são abordados antes de qualquer **B**.
2. **B** só começa depois que todos os **A** tiverem ao menos uma tentativa
   de contato registrada.
3. **C** só é trabalhado se sobrar capacidade — nunca compete por tempo com
   A/B.
4. **D** nunca entra na fila de prospecção.
5. Desempate dentro da mesma classe: sinal de compra forte (seção 6) >
   facilidade de contato > potencial de conversão/retenção.
6. Meta prática declarada pelo proprietário: de 1.000 personal trainers
   pesquisados, o modelo precisa apontar de forma consistente os primeiros
   500 a prospectar. Isso implica que, na calibração real (fora do escopo
   desta tarefa), A+B devem representar uma fração previsível e estável da
   amostra — se A+B vier muito acima ou muito abaixo de ~50% de forma
   consistente, os pesos/faixas precisam ser recalibrados com dado real,
   não só ajustados no papel.

## 11. Exemplos hipotéticos (perfis fictícios, não reais)

**A — ICP prioritário (score estimado: 88)**
Bio: "Personal Trainer | Acompanhamento mensal presencial e online |
Últimas vagas de novembro". Stories recentes mostrando alunos e “resultado
em 3 meses”. WhatsApp em destaque na bio. Menciona "manda o Pix" numa
resposta pública a comentário. ~40 alunos citados num destaque fixado
("meus alunos"). Perfil ativo, postagens semanais.
→ Fit de nicho 15, recorrência 15, clientes 10, cobrança manual 15,
WhatsApp 10, Instagram 10, conversão/retenção 8, maturidade 3, dor 0,
contato 5 → **91** (ajustado para 88 por incerteza de leitura de "vagas de
novembro" — o motivo da classificação deve sempre registrar essa incerteza).

**B — ICP qualificado (score estimado: 65)**
Bio: "Coach fitness | Treino personalizado | Consultoria online". Sem
menção clara de mensalidade x avulso. WhatsApp só descoberto após pedir no
direct. Poucos posts no último mês, mas perfil não parece abandonado.
→ Fit de nicho 15, recorrência 8, clientes 5, cobrança manual 7, WhatsApp
5, Instagram 5, conversão/retenção 5, maturidade 2, dor 0, contato 2 →
**~54–65** dependendo de quanto peso a pesquisa consegue confirmar — cai em
B se pelo menos a recorrência for confirmada por outro meio (ex.: destaque
"planos" no perfil), senão vira C.

**C — Baixa prioridade (score estimado: 42)**
Perfil ativo, mas 100% conteúdo educativo (dicas de treino/nutrição), sem
nenhuma chamada comercial, sem menção de preço, plano ou vaga. Contato só
por comentário público, sem WhatsApp visível.
→ Fit de nicho 15, recorrência 0, clientes 0, cobrança manual 0, WhatsApp
0, Instagram 8, conversão/retenção 5, maturidade 2, dor 0, contato 2 →
**42.**

**D — Descartar**
Perfil descreve "Personal Trainer na [Rede de Academias X]", currículo
menciona vínculo CLT, nenhuma menção de atendimento particular/carteira
própria, nenhum WhatsApp ou contato direto disponível.
→ Excluído pela seção 5 (funcionário sem carteira própria + sem canal de
contato direto) **antes** de calcular score. Classificação: **D**.

## 12. Perguntas que precisam ser validadas com dados reais

1. Qual a faixa real de número de alunos ativos por personal autônomo no
   Brasil? A faixa usada aqui (15–60) é hipótese de trabalho, não dado.
2. Que fração de personal trainers com presença digital pública realmente
   cobra recorrente (mensalidade/pacote) vs. avulso? Isso define o quão
   seletivo o critério obrigatório #3 precisa ser.
3. As faixas de score (80/60/40) produzem, na prática, A+B ≈ 50% de uma
   amostra de 1.000 perfis pesquisados? Só é validável rodando o modelo
   contra pesquisa real.
4. WhatsApp pessoal vs. WhatsApp Business — a distinção importa para
   "facilidade de contato" (critério #10) ou é irrelevante na prática?
5. Personal trainers 100% online têm padrão de dor de cobrança
   sistematicamente diferente dos presenciais (mais ou menos manual)?
6. O ticket que o personal cobra do próprio aluno dele varia o suficiente
   para valer a pena captar no scoring, já que o preço da Zelo é fixo
   (R$29,90/mês) e não escala com o ticket do cliente do lead?
7. `ZELO_PROJECT_CONTEXT.md` precisa ser atualizado para registrar Personal
   Trainer/Fitness como primeiro mercado de aquisição? (decisão do
   proprietário, não desta tarefa)
8. Qual o mote de marca atual — "Você trabalha. A Zelo cobra." (registrado
   em `ZELO_PROJECT_CONTEXT.md`) ou "Pare de cobrar. Comece a receber."
   (usado nesta tarefa)?
