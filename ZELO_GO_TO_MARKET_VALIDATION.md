# ZELO — SÍNTESE ESTRATÉGICA: ICP + DIFERENCIAÇÃO + OFERTA

Transforma as evidências de `ZELO_ICP_PERSONAL_TRAINER.md` (commit `86ad9ca`)
e `ZELO_ICP_MARKET_VALIDATION.md` (commit `42a6e32`) em decisão estratégica.
Documento exclusivamente documental — nenhum código, banco, preço, landing
page ou o ICP original foi alterado.

**Convenção usada em todo o documento:** cada afirmação é marcada como
**DECISÃO** (proponho isso agora, com base no que já se sabe), **EVIDÊNCIA**
(dado real encontrado, com fonte), **HIPÓTESE** (raciocínio plausível, sem
dado direto) ou **A VALIDAR** (pergunta em aberto que só teste real
resolve). Nada aqui vira fato só porque está escrito.

---

## 1. Resumo executivo

A Zelo tem um ângulo competitivo real dentro do nicho de Personal
Trainer/Fitness: ser a opção **mais simples e mais barata** dedicada
**exclusivamente** a cobrança recorrente automática, num mercado onde a
concorrência ou é cara/completa demais (Mensio, R$49,90/mês, faz cobrança +
relacionamento + IA) ou trata cobrança como acessório de um app de treino
(Tecnofit, MFIT). Isso é **EVIDÊNCIA**, não suposição — validado no
documento anterior.

Mas há um achado desta síntese que muda a sequência de tudo: **o núcleo
financeiro real da Zelo está em NO-GO de produção agora** (`PROJECT_STATUS.md`,
Fase 20, 02/09/2026) — credencial do Asaas ausente, domínio não resolve,
SMTP de cadastro bloqueado, CNPJ/razão social pendentes nos Termos. Isso não
é um problema de estratégia de mercado, é um bloqueador operacional anterior
a qualquer entrada em mercado real. **EVIDÊNCIA direta, fonte primária do
projeto.** Por isso, a oferta e o experimento propostos aqui (Partes 8 e 10)
são desenhados para funcionar **antes** desses bloqueadores serem resolvidos
— testam mensagem e interesse, não conversão paga real.

Beachhead recomendado: **Personal Trainer online**, com presencial e
híbrido como segmento secundário próximo. Posicionamento recomendado:
especialista em cobrança recorrente automática de verdade (Pix Automático,
não link reenviado), não gestão de treino.

## 2. ICP V2 recomendado (não substitui o documento original)

`ZELO_ICP_PERSONAL_TRAINER.md` **permanece intacto**. Recomendações de
ajuste, a aplicar em uma V2 futura, decisão do proprietário:

| Item | ICP V1 (atual) | Recomendação V2 | Status |
|---|---|---|---|
| Número de clientes | 15–60 (faixa única) | 8–35 online / 10–30 presencial (faixas separadas por modelo) | **EVIDÊNCIA** de que a faixa única não se sustenta; a faixa nova é ainda **HIPÓTESE**, não validada com amostra própria |
| Critério de scoring "ferramenta já utilizada" | Só campo de dado, não pontuado | Virar sinal de scoring — já usar Tecnofit/MFIT pode reduzir OU aumentar conversão | **HIPÓTESE**, direção do efeito é A VALIDAR (item 2 das hipóteses críticas, seção 12) |
| Critério obrigatório "recorrência" | Tratado como filtro binário | Manter como filtro, mas registrar que só é verificável por evidência direta do perfil pesquisado, nunca por proxy de mercado | **EVIDÊNCIA** — nenhuma fonte mediu a fração do mercado que é recorrente |
| Pesos dos 10 critérios existentes | Como estão | **Nenhuma mudança de peso recomendada** — não há evidência suficiente para justificar realocar pontos | **DECISÃO** (manter, por falta de evidência contrária) |

## 3. Segmentação (nota 0–10 por dimensão)

| Dimensão | A Presencial | B Online | C Híbrido | D Pequena equipe | E Studio pequeno |
|---|---|---|---|---|---|
| Potencial de recorrência | 7 | 9 | 8 | 7 | 7 |
| Dor de cobrança | 8 | 9 | 8 | 8 | 7 |
| Ticket (contexto do negócio do lead) | 8 | 6 | 7 | 6 | 6 |
| Facilidade de identificação | 7 | 8 | 7 | 6 | 6 |
| Facilidade de contato | 8 | 8 | 8 | 5 | 6 |
| Complexidade (nota alta = mais simples de vender) | 7 | 8 | 7 | 4 | 4 |
| Concorrência (nota alta = menos disputado) | 5 | 4 | 5 | 5 | 4 |
| Potencial de conversão | 6 | 8 | 7 | 5 | 5 |
| Potencial de retenção | 7 | 6 | 7 | 7 | 6 |
| **Média** | **7,0** | **7,3** | **7,1** | **5,9** | **5,7** |

Notas são **HIPÓTESE informada pela evidência** de `ZELO_ICP_MARKET_VALIDATION.md`
(ex.: online pontua mais alto em recorrência porque consultoria online é
estruturalmente mensal, quase não existe avulso online; D/E pontuam mais
baixo em complexidade porque a decisão de compra deixa de ser de uma
pessoa só) — não são medição direta de mercado.

### Beachhead

- **BEACHHEAD PRINCIPAL: B — Personal Trainer online.** Maior nota
  agregada, recorrência mais estrutural, decisão de compra de uma pessoa só,
  identificação mais fácil (presença 100% digital).
- **SEGMENTO SECUNDÁRIO: A (presencial) e C (híbrido).** Notas muito
  próximas de B, provavelmente representam volume de mercado maior em
  número absoluto de profissionais (presencial ainda é o modelo mais comum
  — `ZELO_ICP_MARKET_VALIDATION.md`, seção 6).
- **SEGMENTOS PARA DEPOIS: D (equipe) e E (studio).** Decisão de compra
  mais lenta e mais complexa, motion comercial diferente (venda B2B
  pequena, não abordagem individual) — não é prioridade para a primeira
  leva.

## 4. Concorrência (análise estratégica, não só comparação de recursos)

| Dimensão | Mensio | MFIT | Tecnofit | Cobrança manual |
|---|---|---|---|---|
| Posicionamento | Cobrança + relacionamento para autônomos (não só PT) | Gestão de treino com pagamento embutido | Gestão de treino/aluno, líder de mercado | "Não é ferramenta", é hábito |
| Complexidade | Média-alta (IA, ficha, NPS, página de vendas) | Média (treino + avaliação + cobrança) | Alta (treinos, avaliação, biblioteca, agenda) | Baixa (WhatsApp + Pix manual) mas alto custo de tempo |
| Preço | R$49,90/mês | A partir de R$10,90/mês | Gratuito (app do PT) + planos avançados pagos | "Grátis", mas custa tempo e desgaste de relação |
| Público | PT e outros autônomos com mensalidade | PT focado em treino, entrada barata | PT que quer gestão completa | Todo o mercado, é o status quo |
| Proposta de valor | "Pare de perseguir aluno pra cobrar" | "Gerencie treino e receba pagamento" | "Gerencie sua carreira de PT" | Nenhuma — é ausência de solução |
| Dependência de gestão de treino | Não exige | Sim, é o núcleo do produto | Sim, é o núcleo do produto | Não se aplica |
| Cobrança | Núcleo do produto, Pix Automático real | Acessório | Acessório | Manual, sem automação |
| Experiência | Completa, mais telas pra aprender | Boa pra quem já quer app de treino | Robusta, curva de aprendizado maior | Familiar (é o que já fazem), mas dolorosa |
| Barreira de entrada (pro PT trocar) | Baixa (14 dias grátis) | Muito baixa (preço de entrada) | Nenhuma (gratuito) | Não há troca, é o ponto de partida |
| Motivo provável de trocar por Zelo | Zelo mais barata e mais simples, se o PT não quer os recursos extras do Mensio | PT quer cobrança de verdade (débito automático), não só "coleta de pagamento" genérica | PT não quer/precisa de gestão de treino, só de cobrança | Dor de cobrar/perseguir aluno atingiu um limite |
| Motivo provável de NÃO trocar | PT já gosta dos recursos extras (IA, ficha, NPS) e não se importa com o preço maior | PT já usa MFIT pra treino e a cobrança "de brinde" já resolve o suficiente | PT já usa Tecnofit pra tudo e trocar de ecossistema tem custo de migração | Inércia, desconfiança de automatizar algo que envolve dinheiro |

**Principal ameaça:** Tecnofit e MFIT, porque já têm a cobrança **dentro**
de uma ferramenta que o PT já usa por outro motivo (treino) — o custo de
adicionar mais uma ferramenta só para cobrança compete com "já ter isso de
brinde". **EVIDÊNCIA.**

**Principal oportunidade:** nenhum dos concorrentes pesquisados combina
**Pix Automático real** (débito recorrente de verdade, não link reenviado)
+ **preço baixo** + **produto dedicado só a cobrança**. Mensio tem o Pix
Automático mas é mais caro e mais completo; Sacador é barato/simples mas
usa link recorrente, não débito automático. **EVIDÊNCIA — é a lacuna mais
clara encontrada na pesquisa.**

## 5. Diferenciação — 5 hipóteses de posicionamento

| # | Direção | Benefício | Força | Fraqueza | Concorrente que combate | Difícil de copiar? | Clareza pro cliente |
|---|---|---|---|---|---|---|---|
| 1 | Simplicidade / especialista em cobrança | "Só faz uma coisa, e faz bem" | Foco, clareza de proposta | Pode parecer "menos produto" pra quem quer tudo-em-um | Tecnofit, MFIT (tudo-em-um) | Sim — pivotar de "tudo-em-um" pra "especialista" é caro pra quem já investiu no oposto | Alta |
| 2 | Preço/acessibilidade | "Mais barato que o concorrente mais parecido" | Barreira de entrada baixa | MFIT é ainda mais barato (embora bundled); "barato" pode soar arriscado pra lidar com dinheiro | Mensio | Não — qualquer um baixa preço | Alta, mas genérica |
| 3 | Automação real (Pix Automático vs. link) | "Autoriza uma vez, nunca mais pensa nisso" | Diferencial técnico real e verificável | Exige explicar a diferença técnica (mercado nem sempre distingue) | Sacador, BOT Cobranças, ferramentas de link | Médio — depende de integração BACEN; Mensio também tem isso | Média (precisa de contexto) |
| 4 | Redução de trabalho/constrangimento | "Você trabalha. A Zelo cobra." (mote já registrado) | Fala direto com a dor emocional | Mensagem fácil de copiar por qualquer concorrente | Cobrança manual (comportamental) | Baixo — é posicionamento de mensagem, não de produto | Alta |
| 5 | Previsibilidade financeira | "Saiba quanto vai entrar, sem perseguir ninguém" | Fala com ansiedade financeira do autônomo, não só tarefa chata | Mais abstrato, menos "ação concreta" que os outros | Nenhum concorrente pesquisado usa esse ângulo diretamente | Médio | Média-baixa |

### POSICIONAMENTO RECOMENDADO

**Combinação de #1 + #3: "Especialista em cobrança recorrente automática de
verdade — não gestão de treino, não link de pagamento reenviado toda hora."**

Por quê: é a combinação com evidência mais direta (lacuna real de mercado,
seção 4) e a mais difícil de copiar rapidamente — um concorrente "tudo em
um" não vira especialista da noite pro dia, e um concorrente "link
recorrente" não implementa Pix Automático BACEN da noite pro dia. As
direções #2, #4 e #5 são mais fáceis de copiar ou mais genéricas — podem
compor a comunicação, mas não devem ser o pilar central. **DECISÃO
proposta**, não implementada em nenhum canal ainda.

## 6. Mensagem central

| Mensagem | Clareza | Dor | Diferenciação | Credibilidade | Especificidade | Potencial comercial |
|---|---|---|---|---|---|---|
| A — "Pare de cobrar seus alunos." | Alta | Sim | Baixa (qualquer concorrente diz isso) | Média | Baixa | Médio-alto |
| B — "Receba sua mensalidade automaticamente." | Alta | Média | Baixa | Média-alta | Média | Médio-alto |
| C — "Seu cliente autoriza uma vez. A Zelo cobra todos os meses." | Média-alta | Média | **Alta** (explica o mecanismo único) | **Alta** | **Alta** | Médio (mais explicativa que "vendedora" isolada) |
| D — "Você trabalha. A Zelo cobra." | Alta | Média (implícita) | Baixa-média | Média | Baixa | **Alto** (marca, não conversão direta) |
| E — proposta nova: "Seu aluno autoriza uma vez. Você nunca mais manda mensagem de cobrança." | Alta | **Alta** (nomeia a ação específica que dói) | Alta | Alta | Alta | Alto |

**Recomendação:** usar **E** como mensagem de abordagem direta/anúncio
(nomeia a dor específica confirmada na pesquisa — mandar mensagem de
cobrança — e o mecanismo diferenciador), e manter **D** como mote de marca
para identidade/branding (já registrado em `ZELO_PROJECT_CONTEXT.md`, serve
a um propósito diferente: reconhecimento, não conversão em anúncio frio).
**DECISÃO proposta, A VALIDAR em teste direto (hipótese 4, seção 12).**

## 7. Estratégia em relação a MFIT/Tecnofit/Mensio

**A Zelo deve se posicionar como especialista em cobrança, complementar a
ferramentas de gestão de treino — não como substituta delas.**

Raciocínio: Zelo não tem (nem deveria construir agora) prescrição de
treino, avaliação física, biblioteca de exercícios — competir de frente com
Tecnofit/MFIT nesse terreno exigiria replicar um produto inteiro que não é
o core da Zelo. Posicionar como "use seu app de treino normalmente, use a
Zelo só pra cobrar" reduz o atrito de troca (o PT não precisa abandonar
nada que já usa) e é honesto sobre o que a Zelo realmente faz. **DECISÃO.**

Contra Mensio, que É concorrente direto (mesmo escopo: cobrança + gestão
leve de aluno), a estratégia é diferente: competir em preço e simplicidade,
não em complementaridade. **DECISÃO.**

**A VALIDAR:** se PTs realmente aceitam bem usar duas ferramentas em
paralelo (uma de treino, uma de cobrança) ou se a fricção de "mais um
login, mais uma mensalidade" anula a vantagem de preço/simplicidade da
Zelo — isso só um teste real responde (hipótese 9, seção 12).

## 8. Avaliação do preço (R$29,90/mês — não alterado)

- **Coerência com o mercado:** parece coerente — fica abaixo do concorrente
  mais parecido (Mensio, R$49,90) e é uma fração pequena do ticket que o
  próprio PT cobra do aluno dele (mesmo no cenário mais barato, R$90/mês
  online). **EVIDÊNCIA de posicionamento relativo**, não de aceitação real.
- **Vantagem competitiva:** sim, frente ao Mensio especificamente. Frente
  ao MFIT (R$10,90 de entrada), a Zelo não é a mais barata — mas o MFIT
  entrega cobrança como acessório de um app de treino, não como produto
  dedicado. **EVIDÊNCIA + HIPÓTESE** de que "dedicado" justifica o preço
  maior que o MFIT de entrada.
- **Risco de parecer barato demais:** existe, especificamente porque o
  produto lida com autorização de débito recorrente — dinheiro do cliente
  do PT. Preço muito baixo pode gerar desconfiança ("por que é tão barato
  pra mexer com meu dinheiro?"). **HIPÓTESE, A VALIDAR.**
- **Risco de não transmitir valor:** menor que o risco anterior, porque
  R$29,90 ainda está na faixa "SaaS pequeno negócio" comum no Brasil (MFIT
  citado a R$10,90 já normaliza esse patamar de preço no nicho).
- **Adequação ao ICP:** adequada ao segmento B (online) e A/C, onde o
  ticket do PT já é maior que o preço da Zelo por uma margem confortável;
  menos clara para D/E, onde o valor por usuário adicional não escala com o
  preço fixo — pode ser sub ou sobre-precificado para equipe, sem dado que
  resolva isso agora.

**Determinação:** **MANTIDO.** Não há evidência que justifique mudar o
preço agora, e a instrução da tarefa proíbe alterá-lo. A adequação ao ICP
para os segmentos D/E fica **A VALIDAR** antes de qualquer expansão pra
esses segmentos.

## 9. Oferta inicial

**Achado que muda esta seção inteira:** o núcleo financeiro real da Zelo
está em **NO-GO de produção** agora (`PROJECT_STATUS.md`, Fase 20,
02/09/2026) — sem credencial Asaas configurada, nenhuma cobrança real ou
autorização Pix Automático é possível hoje; o domínio não resolve; o SMTP
de cadastro quebra depois de poucas tentativas por hora. **EVIDÊNCIA
direta, fonte primária do próprio projeto.**

Isso significa: **nenhuma oferta que dependa de cobrança real funcionando
pode ser usada agora.** A oferta precisa ser sequenciada em duas fases:

**Fase pré-bloqueadores (agora) — validação de interesse, não de produto:**
- Conversa/demonstração manual (mostrar a tela, explicar o mecanismo, sem
  processar dinheiro real) — **DECISÃO**, é a única opção segura hoje.
- Lista de espera / "avise-me quando estiver disponível" — **DECISÃO**,
  alternativa mais leve à demonstração.
- **Não recomendado agora:** "primeira cobrança grátis", "crie sua primeira
  cobrança" como CTA de produto, teste grátis com cadastro aberto — todos
  dependem de partes do sistema que hoje não funcionam de ponta a ponta
  (Asaas, SMTP).

**Fase pós-bloqueadores (depois que o proprietário resolver Asaas, domínio,
SMTP e Termos) — oferta original:**
- 14 dias grátis sem cartão + "crie sua primeira cobrança" como CTA de
  ativação — **HIPÓTESE A TESTAR**, e só executável depois. Coerente com o
  padrão do mercado (Mensio e Sacador também oferecem trial sem cartão).
- Onboarding assistido para os primeiros clientes (concierge manual) —
  **HIPÓTESE A TESTAR**, reduz risco de abandono no primeiro uso de um
  mecanismo (Pix Automático) que o mercado ainda não conhece bem.
- **Não recomendado:** garantia formal de qualquer tipo, enquanto Termos e
  Privacidade estiverem com CNPJ/razão social pendentes (`A DEFINIR`) —
  risco jurídico real, não só comercial.

## 10. Hipóteses críticas (top 10)

| # | Hipótese | Importância | Como validar | Métrica | Critério de sucesso |
|---|---|---|---|---|---|
| 1 | PTs que cobram mensalidade têm dor suficiente pra pagar R$29,90/mês por ferramenta EXCLUSIVA de cobrança | Alta — é a base de todo o negócio | Conversa/demonstração com leads reais do beachhead | % que demonstra interesse real (pede pra saber mais/testar) | ≥30% de interesse numa amostra piloto (ver seção 11) |
| 2 | PTs que já usam MFIT/Tecnofit ainda têm espaço pra uma ferramenta especializada de cobrança | Alta — define se são bons leads ou devem ser evitados | Perguntar diretamente na conversa se já usam alguma ferramenta e como reagem à proposta de complementar | % de interesse entre "já usa" vs. "não usa" | Se "já usa" responder pior que "não usa" por margem grande, ajustar scoring (item 2, seção 2) |
| 3 | Segmento B (online) converte melhor que A (presencial), como a pontuação da seção 3 sugere | Média-alta — define o beachhead de verdade | Comparar taxa de interesse por segmento no piloto | Taxa de interesse por segmento | B com taxa visivelmente maior que A/C confirma; empate ou inversão exige revisar a seção 3 |
| 4 | A mensagem E ("nunca mais manda mensagem de cobrança") performa melhor que D ("Você trabalha. A Zelo cobra.") em abordagem direta | Média — orienta comunicação de aquisição | Teste A/B de mensagem no piloto (mesma pessoa, mensagens diferentes por grupo) | Taxa de resposta e taxa de interesse por mensagem | Diferença de pelo menos alguns pontos percentuais consistente entre grupos |
| 5 | PTs confiam em autorizar Pix Automático (débito recorrente) via ferramenta nova e desconhecida | Alta — é o mecanismo central do produto | Só validável quando o produto estiver ativo (pós-bloqueadores) — nesta fase, perguntar na conversa se já usam/conhecem Pix Automático de outros contextos | % que já conhece/usa o mecanismo | Baixo conhecimento prévio → precisa de mais explicação na oferta, não é motivo para descartar |
| 6 | O preço R$29,90 é percebido como confiável, não como "barato demais pra mexer com dinheiro" | Média | Perguntar reação ao preço na conversa, sem ancorar com o preço do Mensio | Reação qualitativa (confortável / desconfiado / indiferente) | Maioria "confortável ou indiferente" mantém o preço; sinal forte de desconfiança vira pauta de investigação, não mudança de preço |
| 7 | A complexidade de decisão em D (equipe)/E (studio) realmente atrasa conversão | Baixa nesta fase (segmentos não priorizados) | Não testar agora — registrar como pendente para quando D/E entrarem em pauta | — | — |
| 8 | Instagram tem melhor taxa de resposta que WhatsApp direto pra abordagem fria | Alta — define canal do Outbound Engine | Comparar taxa de resposta por canal no piloto | Taxa de resposta por canal | Canal com taxa consistentemente maior vira prioridade nas próximas fases |
| 9 | PTs aceitam usar duas ferramentas em paralelo (treino + cobrança) sem fricção relevante | Alta — valida a estratégia da Parte 7 (complementar, não substituta) | Perguntar diretamente na conversa como reagem à ideia de manter o app de treino e só trocar a cobrança | Reação qualitativa + taxa de interesse | Resistência forte e recorrente exige revisar a estratégia de complementaridade |
| 10 | Depois que a Zelo estiver com Asaas configurado, o fluxo real de autorização Pix Automático tem abandono aceitável | Alta, mas só testável pós-bloqueadores | Teste controlado com poucos usuários reais assim que Asaas estiver ativo, antes de qualquer campanha maior | Taxa de conclusão do fluxo de autorização | Sem baseline ainda — primeira medição vira o próprio baseline |

## 11. Experimento comercial (especificação — NÃO EXECUTAR)

**Objetivo:** aprender quem responde, por qual canal, com qual mensagem —
sem prospectar os 500 leads e sem depender do núcleo financeiro estar
ativo.

- **Tamanho inicial da amostra:** 60 perfis pesquisados e classificados
  A/B/C/D conforme `ZELO_ICP_PERSONAL_TRAINER.md` — só classe A e B do
  scoring (não confundir com os segmentos A–E desta síntese).
- **Distribuição por segmento (desta síntese):** 20 online (B), 20
  presencial (A), 20 híbrido (C). D e E ficam de fora do piloto.
- **Mensagens a comparar:** 2 variações por grupo — mensagem D (mote atual
  de marca) vs. mensagem E (proposta nova, seção 6). Sem terceira variação
  nesta rodada, para manter o piloto simples de analisar.
- **Canais a comparar:** Instagram (comentário público ou DM, o que for
  eticamente apropriado e não invasivo) vs. WhatsApp direto, quando
  disponível publicamente.
- **O que constitui "contato" no experimento:** uma conversa inicial que
  explica o problema e pergunta interesse — **sem** oferecer cadastro na
  Zelo (porque o produto não está pronto pra receber cadastro real em
  produção, seção 9). É validação de mensagem e interesse, não aquisição.
- **Critérios de sucesso:** taxa de resposta (respondeu algo) e taxa de
  interesse (pediu mais informação/demonstração) — nunca taxa de conversão
  paga nesta rodada.
- **Como decidir qual argumento venceu:** comparar taxa de resposta e de
  interesse por combinação segmento × mensagem × canal; só declarar um
  vencedor com diferença consistente, não com uma única amostra pequena
  favorecendo por acaso.

## 12. Métricas

- Taxa de resposta (por segmento, mensagem e canal).
- Taxa de interesse declarado ("quero saber mais"/"como funciona").
- Tempo até a primeira resposta.
- Distribuição de motivos de recusa/desinteresse, quando manifestados
  espontaneamente (não perguntar diretamente "por que não", registrar o
  que for dito sem forçar).

**Não incluída nesta fase:** taxa de conversão paga, CAC, LTV — dependem do
núcleo financeiro estar ativo (seção 9).

## 13. Critérios de decisão

- Se um segmento tiver taxa de interesse visivelmente maior que os outros
  dois, ele vira o beachhead confirmado (substitui a recomendação da seção
  3, que é hipótese).
- Se a mensagem E performar consistentemente melhor que D, adotar E como
  mensagem de aquisição e manter D só como identidade de marca.
- Se "já usa ferramenta concorrente" correlacionar com MENOS interesse
  (não mais), tratar isso como sinal de exclusão no scoring, não só um
  campo de dado.
- Se a resistência a "duas ferramentas em paralelo" for forte e recorrente,
  reabrir a Parte 7 antes de qualquer decisão de posicionamento definitiva.
- Nenhuma decisão de escala (prospecção real, Fase 9 do Outbound Engine)
  deve acontecer antes de (a) este piloto rodar e (b) os 5 bloqueadores de
  produção da seção 9/1 serem resolvidos pelo proprietário.

## 14. O que NÃO devemos fazer ainda

- Prospectar os 500 leads.
- Prometer cobrança automática funcionando de verdade (Asaas não está
  configurado em produção).
- Enviar tráfego (pago ou não) para uma página de cadastro real — o SMTP
  padrão quebra depois de poucas tentativas por hora.
- Tratar o preço R$29,90 como validado — está mantido por falta de
  evidência contrária, não porque foi comprovado.
- Escalar qualquer canal antes do piloto da seção 11 rodar.
- Incluir os segmentos D (equipe) e E (studio) nesta primeira rodada.
- Alterar `ZELO_ICP_PERSONAL_TRAINER.md`.
- Oferecer qualquer garantia formal antes dos Termos/Privacidade terem
  CNPJ e razão social definidos.
- Iniciar a Fase 9 do Outbound Engine.
- Tratar qualquer nota de segmentação (seção 3) ou hipótese de mensagem
  (seção 6) como fato — todas são hipótese até o piloto confirmar.

---

### Fontes desta síntese

`ZELO_PROJECT_CONTEXT.md`, `ZELO_AUTONOMOUS_PLAN.md`,
`ZELO_ICP_PERSONAL_TRAINER.md`, `ZELO_ICP_MARKET_VALIDATION.md`,
`ZELO_FINANCIAL_CORE_ARCHITECTURE.md` (seções 1 e 24), `PROJECT_STATUS.md`
(seção 65 — Fase 20, GO/NO-GO de 02/09/2026). Nenhuma pesquisa externa nova
foi feita nesta tarefa — é síntese do que já existia.
