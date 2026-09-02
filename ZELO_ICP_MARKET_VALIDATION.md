# ZELO — VALIDAÇÃO DE MERCADO DO ICP (Personal Trainer / Fitness)

Valida `ZELO_ICP_PERSONAL_TRAINER.md` (commit `86ad9ca`) contra pesquisa real de
mercado. **Objetivo era encontrar onde estamos errados, não confirmar o
documento.** Resultado líquido: o nicho se confirma como viável e com demanda
comprovada (existe concorrência direta ativa), mas duas premissas quantitativas
do ICP original não resistem à pesquisa e precisam mudar — ver seções 3–5.

Nenhum código, banco, preço ou o ICP original foi alterado. Este documento é
insumo para decisão futura do proprietário.

---

## 1. Resumo executivo

A pesquisa confirma que existe um mercado real, ativo e crescente de personal
trainers autônomos no Brasil, e — mais importante — **já existe concorrência
direta validando a demanda**: a Mensio vende exatamente "cobrança recorrente
para personal trainer", incluindo Pix Automático via BACEN, por R$49,90/mês.
Isso é a evidência mais forte possível de que o problema é real e as pessoas
pagam para resolvê-lo — e a Zelo entra mais barata (R$29,90) nesse mesmo
espaço.

Por outro lado, duas partes do ICP original não se sustentam como estavam
escritas: (1) a faixa de "15–60 alunos" não bate com nenhum dado ou proxy
encontrado — os sinais reais apontam pra uma faixa mais estreita e dependente
do modelo de atendimento (presencial vs. online); (2) a pergunta central "que
fração do mercado tem receita recorrente" não tem resposta quantitativa em
nenhuma fonte encontrada — o critério de recorrência continua correto em
princípio, mas não pode ser calibrado por dado de mercado, só por sinal
direto do próprio perfil pesquisado.

Um achado não previsto: personal trainers **não podem ser MEI** desde 2018
(regra do CGSN), o que levantou uma dúvida real sobre se o Pix Automático da
Zelo (que costuma exigir CNPJ) excluiria boa parte do público. Verificado
contra `ZELO_FINANCIAL_CORE_ARCHITECTURE.md`: o formulário de subconta da
Zelo já aceita CPF ou CNPJ — o risco não se confirma, mas fica registrado
porque quase mudaria a leitura do ICP inteiro.

## 2. ICP atual (recapitulação de `ZELO_ICP_PERSONAL_TRAINER.md`)

Personal trainer/profissional de fitness autônomo, com carteira própria,
cobrando de forma recorrente (mensalidade/pacote), hoje via cobrança manual
(Pix, WhatsApp, planilha). Critérios obrigatórios: fit de nicho, carteira
própria, recorrência, contato público disponível. Scoring 0–100 em 10
critérios. Classificação A (80–100) / B (60–79) / C (40–59) / D (exclusão ou
<40).

## 3. O que foi confirmado

- **O nicho tem demanda comprovada por ferramenta de cobrança.** A Mensio
  existe, é paga, e vende exatamente esse problema pra exatamente esse
  público. *(ALTA CONFIANÇA — fonte primária: site oficial da Mensio)*
- **Cobrança manual e o desconforto de cobrar são temas reais e discutidos
  abertamente no setor**, não só uma suposição de SaaS. Múltiplos produtos
  (Mensio, Sacador, Tecnofit) usam esse desconforto como argumento central de
  venda. *(MÉDIA CONFIANÇA — múltiplas fontes do setor convergem, mas são
  majoritariamente material comercial dos próprios concorrentes, não relatos
  independentes de PTs)*
- **WhatsApp é canal universal de relacionamento e cobrança**, Instagram é
  canal universal de captação/prova social. *(ALTA CONFIANÇA — convergência
  de todas as fontes pesquisadas, sem exceção)*
- **Existem planos mensais/pacotes de fato no mercado**, com faixas de preço
  claras: presencial R$560–1.800/mês (2–3x/semana), online R$90–350/mês.
  *(MÉDIA CONFIANÇA — convergência de múltiplas fontes secundárias
  independentes, nenhuma é pesquisa acadêmica)*
- **O mercado é majoritariamente autônomo**: mais de 60% dos personal
  trainers brasileiros atuam de forma independente, segundo fonte que cita o
  "IHRSA Global Report 2026" *(MÉDIA CONFIANÇA — não verifiquei o relatório
  original diretamente, só uma fonte secundária que o cita)*.
- **O modelo de subconta CPF/CNPJ da Zelo já resolve** o risco regulatório de
  PT não poder ser MEI. *(ALTA CONFIANÇA — verificado no próprio
  `ZELO_FINANCIAL_CORE_ARCHITECTURE.md`, linha 351)*

## 4. O que foi refutado

- **A faixa "15–60 alunos" do ICP original não é sustentada por nenhum dado
  ou proxy encontrado.** Os únicos números concretos achados foram: (a) "~8
  alunos" citado como limite prático de personalização em consultoria
  online *(BAIXA CONFIANÇA — fonte é blog comercial de concorrente, a
  MFIT)*; (b) exemplos de cálculo de meta de renda variando de 10 a 67
  alunos dependendo do ticket escolhido *(são exemplos hipotéticos de
  cálculo, não uma média observada)*. Nenhuma fonte apresentou uma média ou
  mediana real de alunos por PT autônomo.
- **Não existe estatística que responda à pergunta central da seção 2 do
  ICP original** ("que fração do mercado tem receita recorrente"). O
  critério continua fazendo sentido logicamente, mas não pode ser calibrado
  com dado de mercado agora — só é verificável perfil a perfil, na pesquisa
  pública de cada lead.

## 5. O que precisa mudar

1. **Substituir a faixa única "15–60 alunos" por faixas diferentes por
   modelo de atendimento** — ver seção 8 para a proposta.
2. **Adicionar "ferramentas já utilizadas" como sinal de scoring, não só
   campo de dado.** Um PT que já paga por Tecnofit/MFIT (que já embutem
   cobrança) é um lead mais difícil de converter — a ferramenta concorrente
   já resolve parte do problema dele. Isso não estava no ICP original.
3. **Registrar explicitamente que "recorrência" (critério obrigatório #3) só
   pode ser verificado por evidência direta do perfil pesquisado**, não por
   proxy de mercado — a pesquisa não encontrou base pra estimar isso a
   priori.

*(Nenhuma dessas mudanças foi aplicada ao ICP original nesta tarefa — ficam
registradas para decisão posterior, conforme instruído.)*

## 6. Dados de mercado

| Dado | Valor encontrado | Confiança |
|---|---|---|
| Profissionais registrados no CONFEF | Fontes secundárias divergem entre "mais de 100 mil" e "mais de 450–500 mil" — **DADO CONFLITANTE**, não consegui confirmar direto na fonte primária (tentativa de acesso a `confef.org.br/registrados/` falhou por redirecionamento) | BAIXA |
| Personal trainers atuando como autônomos | ">300 mil", mais de 60% do total segundo fonte que cita IHRSA | BAIXA–MÉDIA |
| Crescimento de PTs em atividade 2022→2023 | +32,76% a +32,78%, dado proprietário da Tecnofit (maior plataforma de gestão fitness do Brasil) | MÉDIA (fonte única, mas relevante e replicada por imprensa do setor) |
| Faturamento do setor fitness/academias | Entre R$17 bi e R$20+ bi/ano (ACAD Brasil, fontes divergem no valor exato) | BAIXA |
| Faturamento específico do "mercado do personal" | ">R$2,5 bi/ano" (Trainer Brasil, sem metodologia visível) | BAIXA |
| Concentração regional | **DADO NÃO ENCONTRADO** | — |
| Online crescendo mais rápido que presencial | Confirmado qualitativamente por múltiplas fontes do setor, sem número comparativo direto | MÉDIA |

## 7. Modelo de cobrança

Confirma-se que mensalidade/pacote mensal e trimestral existem e são comuns,
tanto presencial quanto online. **Não encontrei estatística sobre que fração
do mercado usa cada modelo** (mensalidade fixa vs. avulso vs. pacote por
sessões). O que se pode afirmar com mais segurança: a existência de três
produtos concorrentes vivos vendendo "automatize sua cobrança recorrente"
para esse público (Mensio, Tecnofit, Sacador) é evidência indireta forte de
que uma fração suficientemente grande do mercado já opera de forma
recorrente para sustentar esses negócios — mas isso é inferência, não dado
direto. **DADO NÃO ENCONTRADO** para a pergunta quantitativa exata.

## 8. Número de clientes

A faixa "15–60" do ICP original não resistiu à pesquisa (seção 4). Proposta
de ajuste, baseada nos proxies encontrados:

| Modelo de atendimento | Faixa proposta | Base |
|---|---|---|
| Online (consultoria) | 8–35 alunos | limite de personalização citado (~8) até exemplos de cálculo de meta em ticket mais baixo (~34 a R$150/mês) |
| Presencial | 10–30 alunos ativos | inferido da limitação de agenda por hora/dia (não há dado direto — **HIPÓTESE**) |
| Híbrido | sobreposição das duas faixas | sem dado próprio |

Esta é uma proposta a validar com dado real (seção 19), não uma correção
definitiva.

## 9. Ticket

- Sessão avulsa presencial: R$50–250, dependendo de experiência e cidade
  (capitais mais caras). *(MÉDIA CONFIANÇA — convergência de múltiplas
  fontes secundárias)*
- Pacote mensal presencial (2–3x/semana): R$560–1.800/mês. *(MÉDIA)*
- Consultoria online mensal: R$90–350/mês, com blog de concorrente citando
  R$90–320 como faixa "comum". *(MÉDIA)*

**Em qual faixa a automação de cobrança começa a gerar valor perceptível?**
Não há estudo que responda isso diretamente. Raciocínio indireto: mesmo no
extremo mais barato (online, R$90/mês, ~8–10 alunos), o profissional já move
R$720–900/mês em recebíveis — controlar isso manualmente já é
operacionalmente relevante. Isso sugere que o valor percebido não depende
tanto do ticket em si quanto do **número de cobranças recorrentes por mês**
(mais alunos = mais conferência manual = mais dor), reforçando que "número
de clientes" é o proxy mais forte de valor, não o ticket. **HIPÓTESE**, não
validada diretamente.

## 10. Dor de cobrança

Confirmada como tema real e ativamente discutido no setor (seção 3), mas com
uma limitação importante: **as fontes encontradas são majoritariamente
material comercial dos próprios concorrentes** (Mensio, Tecnofit, Sacador,
InfinitePay) explicando por que o problema deles importa — não relatos
independentes de personal trainers reais em fóruns, grupos ou comunidades.
Não encontrei uma comunidade/fórum brasileiro de personal trainers com
discussão orgânica sobre esse problema especificamente (pode existir e não
ter aparecido nas buscas realizadas, ou pode ser um sinal de que a dor é
real mas não é o tópico #1 espontâneo de conversa do nicho — ambas as
leituras são possíveis). **MÉDIA CONFIANÇA na existência da dor, BAIXA
CONFIANÇA em quão "dolorosa" ela é comparada a outras dores do dia a dia do
PT** (ex.: captar aluno, se manter atualizado, gerir tempo).

## 11. Ferramentas existentes

| Ferramenta | O que é | Preço | Cobrança recorrente? |
|---|---|---|---|
| **Tecnofit Personal** | App de gestão de treino + alunos, líder de mercado citado | App gratuito para o PT; planos avançados com "controle de acesso automático por recorrência de pagamento" | Sim, como parte de um produto muito mais amplo (treinos, avaliação física, biblioteca de exercícios) |
| **MFIT Personal** | App de prescrição de treino + avaliação + "coleta de pagamentos" | A partir de R$10,90/mês (entrada) | Sim, como feature dentro de um app de treino |
| **Mensio** | Cobrança + gestão de alunos, foco em autônomos (PT, nutricionista, psicólogo, etc.) | R$49,90/mês, 14 dias grátis | **Sim — Pix Automático BACEN (CNPJ) ou Pix + lembrete WhatsApp (CPF)** |
| **Sacador** | Cobrança via WhatsApp (boleto/Pix com link) para prestadores de serviço com mensalidade (academias, escolas, clínicas) | Não divulgado publicamente | Recorrente por periodicidade, mas via **link de pagamento reenviado a cada ciclo**, não débito automático |

**O que fazem quando já têm ferramenta de gestão?** Tecnofit e MFIT já
embutem cobrança dentro de um produto de gestão de treino mais amplo — um PT
que já usa um desses para treino ganha cobrança "de brinde", o que é
concorrência direta e reduz a urgência de adotar uma ferramenta separada só
pra isso. Isso sugere que a Zelo deveria se perguntar se compete como
**substituta** (troca a cobrança de dentro do Tecnofit/MFIT) ou como
**complementar** (o PT mantém o app de treino e só usa a Zelo pra cobrança) —
a pesquisa não resolve essa pergunta, mas a torna concreta e registrável
(seção 19).

## 12. Concorrência

**A pergunta central era: existe espaço para uma solução extremamente
simples focada especificamente em cobrança recorrente?**

Resposta: **sim, parcialmente — e já existe uma concorrente ocupando quase
exatamente esse espaço (Mensio), só que mais cara e com mais recursos do
que "só cobrança".** A Zelo, mais simples e mais barata, tem um ângulo real:
ser a opção "só isso, mais barato" para quem acha o Mensio (ou o
Tecnofit/MFIT) complexo ou caro demais para o que precisa.

| Solução | Resolve | Preço | Público | Pontos fortes | Pontos fracos | Onde a Zelo pode ser diferente |
|---|---|---|---|---|---|---|
| Mensio | Cobrança recorrente + relacionamento com aluno | R$49,90/mês | PT e outros autônomos com mensalidade | Pix Automático real, IA, ficha de treino, página de vendas — pacote completo | Mais caro, mais complexo do que "só cobrança" | Preço menor (R$29,90) e foco só em cobrança pode atrair quem acha o Mensio "demais" |
| Tecnofit | Gestão de treino + alunos (cobrança é acessório) | Gratuito (app do PT) + planos pagos avançados | PT que já quer gestão completa de treino | Marca forte, base grande, gratuito de entrada | Cobrança é secundária dentro de um produto de treino — não é o foco | Zelo não compete em treino; compete em ser 100% dedicada à cobrança |
| MFIT | Prescrição de treino + avaliação + pagamentos | A partir de R$10,90/mês | PT iniciante, poucos alunos | Barreira de entrada baixíssima | Cobrança também é acessório, não núcleo | Mesmo raciocínio do Tecnofit |
| Sacador | Cobrança via WhatsApp para negócios com mensalidade (não específico de fitness) | Não divulgado | Academias, escolas, clínicas — B2B mais amplo | Não exige app do cliente, cobrança por link | Não é recorrência automática de débito, é reenvio de link por ciclo; não é fitness-specific | Zelo usa Pix Automático de verdade (autoriza uma vez), não link recorrente |

## 13. Canais

Instagram é universalmente citado como canal primário de presença/captação;
WhatsApp como canal de conversão e relacionamento contínuo. Isso é
consistente com o desenho de scoring já existente (critérios 5 e 6). **Toda
a pesquisa encontrada é sobre captação orgânica/inbound do PT (como ele
atrai aluno)** — não encontrei nenhum dado sobre qual canal funciona melhor
para alguém fazer **outbound frio** para personal trainers especificamente
(ex.: taxa de resposta de DM no Instagram vs. mensagem de WhatsApp vs.
comentário público). **DADO NÃO ENCONTRADO** para essa pergunta específica,
que é a mais relevante para o Outbound Engine.

## 14. Comportamento de compra

- Trial grátis sem cartão é o padrão do setor: Mensio (14 dias, igual à
  Zelo) e Sacador oferecem período de teste — a Zelo já está alinhada com a
  prática do mercado nisso.
- Preço de entrada baixo é um padrão competitivo relevante: MFIT entra a
  R$10,90/mês, Zelo a R$29,90/mês, Mensio a R$49,90/mês — a Zelo fica no
  meio, mais barata que a concorrente mais parecida (Mensio) e mais cara que
  o "grátis com upsell" do Tecnofit. **Isso não é dado de comportamento do
  comprador, é posicionamento relativo de preço** — não encontrei pesquisa
  sobre elasticidade de preço específica desse público.
- **Não encontrei dado direto sobre sensibilidade a preço, resistência a
  sistema ou importância de indicação especificamente para personal
  trainers.** A pesquisa genérica sobre pequenos negócios brasileiros e
  software (seção de fontes) não é específica o bastante para ser tratada
  como evidência aqui — registrada como contexto, não como fato aplicável.
- **Avaliação do preço R$29,90/mês:** parece coerente — está abaixo do
  concorrente mais parecido (Mensio, R$49,90) e seria perceptível como
  "barato" frente a um ticket mensal de aluno de R$90+ que o próprio PT
  cobra. Não há dado que confirme isso como fato de comportamento de
  compra, é leitura posicional. **Preço não foi e não deve ser alterado
  nesta tarefa.**

## 15. Segmentação

| Segmento | Bom ICP pra 1ª fase? | Por quê |
|---|---|---|
| A — PT presencial | **Sim** | Modelo mais tradicional, cobrança manual mais documentada, mercado maior em volume |
| B — PT online | **Sim** | Crescimento citado como mais rápido que presencial; ticket e faixa de clientes mais bem documentados nesta pesquisa |
| C — PT híbrido | **Sim** | Sobreposição natural de A e B, sem motivo para excluir |
| D — Coach/profissional de fitness genérico | **Parcial** | Só se mantiver carteira própria e cobrança recorrente (critérios obrigatórios já cobrem isso) — não é um segmento à parte, é o mesmo ICP com rótulo diferente |
| E — Pequenos estúdios | **Talvez, fase 2** | Mais próximo de "pequena empresa" que "autônomo"; decisão de compra pode não ser de uma pessoa só — não invalida, mas muda a abordagem |
| F — Personal com equipe | **Talvez, fase 2** | Mesmo raciocínio de E — a arquitetura da Zelo já suporta múltiplos membros por empresa, mas não há evidência de que esse segmento tenha sido pesquisado o suficiente aqui |
| G — Outros subnichos | **Não avaliado** | Fora do escopo desta pesquisa |

Não encontrei dado que quantifique a distribuição real entre esses
segmentos — a recomendação acima é lógica/qualitativa, não baseada em
proporção de mercado medida.

## 16. Validação do scoring

| Critério (peso) | Status | Motivo |
|---|---|---|
| Fit de nicho (15) | **VALIDADO** | Nicho existe, tem demanda comprovada por concorrência ativa |
| Recorrência (15) | **PARCIALMENTE VALIDADO** | O conceito é correto e planos mensais existem de fato; não há dado sobre qual fração do mercado opera assim — só verificável por perfil, não por proxy de mercado |
| Número de clientes (10) | **NÃO VALIDADO** | A faixa usada (15–60) diverge dos proxies encontrados; ver seção 8 para proposta de ajuste |
| Evidência de cobrança manual (15) | **PARCIALMENTE VALIDADO** | A dor é real e discutida pelo setor, mas as fontes são majoritariamente comerciais, não relatos independentes |
| Presença no WhatsApp (10) | **VALIDADO** | Canal universal confirmado por todas as fontes |
| Presença no Instagram (10) | **VALIDADO como canal**, mas **SEM EVIDÊNCIA** de correlação direta com propensão a comprar cobrança | Instagram ativo prova maturidade de marketing, não necessariamente dor de cobrança |
| Potencial de conversão/retenção (10) | **HIPÓTESE** | Nenhum dado de churn/retenção de SaaS para esse público foi encontrado |
| Maturidade do negócio (5) | **SEM EVIDÊNCIA direta**, mas logicamente consistente | Nenhuma fonte testou essa correlação especificamente |
| Dor aparente (5) | **PARCIALMENTE VALIDADO** | Existe, mas relatos diretos (não comerciais) de PTs não foram encontrados nesta pesquisa |
| Facilidade de contato (5) | **VALIDADO** | Consistente com toda a prática de captação do setor (contato público direto é a norma) |

**Proposta de alteração de peso:** nenhuma, com evidência suficiente para
justificar. A mudança recomendada é de **critério** (adicionar "ferramenta
já utilizada" como sinal de scoring — seção 5, item 2) e de **faixa**
(número de clientes — seção 8), não de peso dos critérios existentes.

## 17. Oportunidades de produto (registro, não implementação)

**OPORTUNIDADE FUTURA** — recuperação de inadimplência: a Mensio já vende
"detecção de inadimplência" e "risco de cancelamento" como parte do pacote.
Pode valer a pena investigar isso além da cobrança recorrente pura.

**OPORTUNIDADE FUTURA** — lembretes/renovação: o padrão de mercado (D-3,
vencimento, atraso) já é bem estabelecido pelos concorrentes — se a Zelo não
tiver isso, é tabela básica esperada pelo mercado, não diferencial.

**OPORTUNIDADE FUTURA** — página de vendas/checkout para o próprio PT
vender pacotes: a Mensio oferece isso ("página de vendas profissional").
Pode ser um diferencial de aquisição (o PT usa a Zelo pra vender, não só pra
cobrar).

**OPORTUNIDADE FUTURA** — decisão de posicionamento "substituta vs.
complementar" a apps de treino (Tecnofit/MFIT) — ver seção 11. Isso pode
mudar como o produto é vendido (mensagem de marketing), sem mudar código
agora.

## 18. Lacunas de informação

- Número oficial exato de PTs/profissionais de educação física no Brasil.
- Concentração regional/por cidade.
- Fração do mercado que cobra recorrente vs. avulso.
- Número médio real de alunos por PT autônomo (com fonte primária, não
  proxy comercial).
- Qualquer estudo Sebrae, IBGE ou acadêmico específico sobre o setor de
  personal trainer (não encontrado — só material genérico de MEI/CNPJ do
  Sebrae).
- Taxa de resposta por canal para abordagem fria (outbound) — toda a
  pesquisa encontrada é sobre captação orgânica do próprio PT, não sobre
  como uma empresa aborda o PT de fora.
- Preço/modelo comercial exato do Sacador e do Tecnofit em seus planos
  pagos avançados.

## 19. Hipóteses que precisam ser testadas com clientes reais

1. A faixa de alunos por modelo de atendimento proposta na seção 8 (8–35
   online, 10–30 presencial) precisa ser confirmada com uma amostra real de
   leads pesquisados.
2. Se "ferramenta já utilizada" (Tecnofit/MFIT) realmente reduz taxa de
   conversão na prática, ou se pelo contrário indica maturidade digital que
   ajuda a conversão — a leitura pode ir nos dois sentidos e só um teste
   real resolve.
3. Se Instagram ativo correlaciona de fato com maior taxa de resposta a
   abordagem outbound, ou é irrelevante para esse fim específico.
4. Se o posicionamento "mais simples e mais barato que o Mensio" realmente
   funciona como argumento de venda, ou se o mercado prefere o pacote mais
   completo mesmo pagando mais.
5. Se personal trainers com equipe/estúdio (segmentos E/F) respondem à
   mesma abordagem dos autônomos solo, ou precisam de motion comercial
   diferente.
6. Se a ausência de relatos espontâneos de dor de cobrança em comunidades
   (seção 10) significa que a dor é menor do que assumido, ou só que essas
   comunidades não foram encontradas nesta pesquisa.

## 20. Recomendação final

**Prosseguir com o ICP de Personal Trainer/Fitness — a pesquisa não encontrou
motivo para abandonar o nicho.** A existência de concorrência direta ativa
(Mensio) é a validação mais forte possível de que o problema é real e
monetizável, e a Zelo tem um ângulo de preço/simplicidade genuíno dentro
desse espaço já provado.

Antes de escalar prospecção (Fase 9 do Outbound Engine), recomenda-se:
1. Ajustar a faixa de número de clientes no ICP (seção 8), diferenciando
   presencial/online.
2. Adicionar "ferramenta já utilizada" como sinal de scoring (seção 5).
3. Rodar a primeira leva pequena de pesquisa real (não prospecção) só para
   validar as hipóteses da seção 19 antes de comprometer a base de 500 leads
   inteira ao modelo atual.

Essas mudanças ficam registradas aqui para decisão do proprietário — nenhuma
foi aplicada ao ICP original nesta tarefa.

---

### Fontes consultadas (lista consolidada)

Sites/artigos: CREFSP, CONFEF, APPTS, Saúde Digital News, Fit Local,
Leonardo Farah, Trainer Brasil, Revista ProAtiva, Tecnofit (blog e produto),
Bling, Fitness Brasil, ACAD Brasil, Encontre Sua Franquia, Digitais.net.br,
Sebrae Respostas, Contabilidade.com, Contabilizei, Neon, Agilize, Minha
Contabilidade Online, Cainan Sync, AccountTech, Contili, Suplemento
Pernambuco, Cronoshare, Grupo Guias Locais, PersonalGO, Ta Contratado,
PersonalTrainerX, Superprof, MFIT (blog e produto), Mensio (site oficial),
Sacador (site oficial), InfinitePay, Wiki4fit, Vedius, Vexado, Millbody,
Ravia, UNIFOR, Wellhub, TreinoAI, Gazeta da Semana, Pluga, E-Commerce
Brasil.

Nenhuma fonte paga/paywall foi acessada. Nenhum dado de cliente real da Zelo
foi usado (não existe ainda). `ZELO_FINANCIAL_CORE_ARCHITECTURE.md` foi
consultado como fonte interna para verificar o ponto de CPF/CNPJ.
