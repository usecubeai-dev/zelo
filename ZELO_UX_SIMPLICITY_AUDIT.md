# ZELO — Auditoria de UX e Simplicidade do Produto

Auditoria somente-diagnóstico, baseada em leitura direta do código (nenhum arquivo alterado). Escopo: tudo dentro de `app/(auth)`, `app/(app)/app`, `app/comecar`, e a lógica de `lib/` que alimenta essas telas. A landing page (`app/page.tsx`, `components/Hero*` etc.) foi lida só como referência da promessa, não auditada — está congelada por decisão do time.

---

## 1. Executive Summary

A landing page promete uma coisa muito simples: **crie a cobrança, o cliente autoriza, a Zelo cobra sozinha, você recebe.** O produto entrega isso — mas não é o caminho mais visível, e não é o caminho curto.

Três achados dominam esta auditoria:

1. **O botão mais proeminente do dashboard não leva à promessa central.** "Nova cobrança" (o CTA primário de `/app`) cria uma cobrança avulsa, sem Pix Automático, sem autorização, sem nada recorrente. Quem clica no botão mais óbvio da tela nunca experimenta o que a landing vendeu. O caminho real da promessa é "Nova recorrência" — um botão secundário, ao lado.
2. **Existe um portão de KYC bancário de 9 campos no meio do caminho**, obrigatório antes de qualquer cobrança automática funcionar, com linguagem de banco ("razão social", "renda ou faturamento mensal") que não é como um personal trainer descreveria o próprio negócio — e que pode ficar pendente de aprovação externa (documento, análise), fora do controle do produto.
3. **Não existe, no produto, nenhuma forma de entregar o pedido de autorização ao cliente.** O QR code/código Pix aparece só dentro do painel autenticado do profissional. Para o cliente autorizar, o profissional precisa sair da Zelo e mandar isso por fora (print, WhatsApp manual) — o "cliente autoriza" da promessa comercial é, hoje, um processo manual não coberto pelo produto.

Ao lado disso, o produto tem fundamentos de UX genuinamente bons que vale preservar: um checklist de onboarding derivado do estado real (nunca pergunta de novo o que já foi feito), formulários com validação acessível e foco automático no primeiro erro, estados vazios que mudam de mensagem conforme o contexto e chegam a estimar tempo ("leva menos de um minuto"), e uma tela de erro genérica que nunca vaza informação técnica. O problema não é falta de cuidado — é que o produto cresceu com mais capacidade do que a promessa da landing page assume, e essa capacidade extra (KYC, cobrança avulsa vs. recorrência, sub-telas de autorizações/instruções) ficou toda no caminho principal em vez de escondida atrás dele.

**Números-chave** (detalhados nas seções 14 e 19): **8 telas/ações** e cerca de **19 campos obrigatórios** entre criar a conta e ter uma cobrança Pix Automático pronta para o cliente autorizar — mais uma etapa manual, fora do produto, que hoje não tem contorno nenhum.

---

## 2. Product Map

Mapeado por leitura de `app/**/page.tsx` — nada presumido.

**Público (fora de autenticação):**
- `/` — landing (congelada, fora de escopo)
- `/comecar` — captura de lead (formulário de nome/whatsapp/e-mail; `noindex`). **Não cria conta.** Grava um "lead" numa tabela separada (`leads`), sem senha, sem sessão.
- `/termos`, `/privacidade`
- `/preview/hero` — ferramenta interna de desenvolvimento, não é produto

**Autenticação:**
- `/criar-conta` — cadastro real (nome, e-mail, senha)
- `/entrar` — login (e-mail, senha)
- `/recuperar-senha`, `/nova-senha`
- `/auth/callback` — destino do link de confirmação por e-mail

**Área logada (`/app/*`)** — navegação principal tem 7 itens: Visão geral, Clientes, Cobranças, Recebimentos, Recorrências, Assinatura, Configurações. Notificações fica fora dessa lista, num link à parte na barra lateral.

- `/app` — dashboard ("Visão geral")
- `/app/clientes`, `/novo`, `/[id]`, `/[id]/editar`
- `/app/cobrancas`, `/nova`, `/[id]`, `/[id]/editar` — **cobrança avulsa**, sem Pix Automático
- `/app/recorrencias`, `/nova`, `/[id]`, `/[id]/editar` — o motor real de Pix Automático
  - `/app/recorrencias/autorizacoes` — lista de consentimentos do pagador (não está no menu principal; só acessível por um link dentro da própria lista de Recorrências)
  - `/app/recorrencias/instrucoes` — lista técnica de "instruções de pagamento" enviadas ao Asaas (mesma situação: só alcançável de dentro de Recorrências)
- `/app/recebimentos` — só o que o Asaas confirmou de fato (distinto de "cobranças pagas")
- `/app/assinatura` — status da assinatura da própria Zelo (não do cliente do profissional)
- `/app/configuracoes` — **três seções empilhadas na mesma tela**: conta financeira (subconta Asaas/KYC), dados da empresa (nome/CPF-CNPJ), e um painel técnico de integração
- `/app/notificacoes`

**Descoberta não presumida**: o produto tem DUAS formas de "criar uma cobrança" (avulsa e recorrência) e DUAS formas de "começar" (`/comecar` e `/criar-conta`), sem nenhuma ligação de produto entre os pares. Isso é tratado em detalhe nas seções 4 e 11.

---

## 3. First Value Journey

Ver seção 12 (Time To First Value) para a análise de esforço/tempo. Aqui, o caminho passo a passo.

| # | Tela/rota | Ação | Campos obrigatórios | Decisões | Parece necessário? |
|---|---|---|---|---|---|
| 1 | `/criar-conta` | Preencher e enviar | nome, e-mail, senha | nenhuma decisão de configuração | Sim |
| 2 | E-mail (fora do produto) | Clicar no link de confirmação | — | — | Sim, mas é uma saída forçada do produto — risco real de abandono (spam, e-mail digitado errado, demora do provedor) |
| 3 | `/app` | Ver checklist "Primeiros passos (1/8)" | — | Nenhuma — é uma lista, não uma decisão | Sim, e é um bom padrão (ver seção 12/16) |

O restante do caminho até a primeira cobrança Pix Automático está detalhado na seção 4.

---

## 4. First Charge Journey

Esta é a jornada mais importante da auditoria porque é onde a promessa da landing (`Criar cobrança → cliente autoriza → Zelo cobra automaticamente → prestador recebe`) precisa se provar. Reconstruída a partir de `lib/core/jornada-onboarding.ts`, dos formulários e das Server Actions.

| # | Tela/rota | Ação | Campos obrigatórios | Decisões do usuário | Informação técnica exposta | Pode dar erro? |
|---|---|---|---|---|---|---|
| 1 | `/app/configuracoes` | Preencher CPF/CNPJ da empresa | 1 (documento) | — | — | Validação de formato |
| 2 | `/app/configuracoes` → "Configurar agora" | Preencher KYC da subconta Asaas | **9** (nome/razão social, e-mail, CPF/CNPJ — de novo —, celular, renda/faturamento mensal, CEP, endereço, número, bairro) | Nenhuma decisão, mas é um formulário longo e de teor bancário | "subconta", campos de KYC financeiro | Sim — e pode entrar em estado "em análise", pedindo upload de documento, fora do controle do usuário |
| 3 | `/app/clientes/novo` | Cadastrar cliente | 1 (nome) | — | — | Validação simples |
| 4 | `/app/recorrencias/nova` | Configurar a recorrência | 4 (cliente, descrição, valor, dia de vencimento) — `inicia_em` já vem preenchido | Dia do mês, valor | — | Validação de valor/data |
| 5 | `/app/recorrencias/[id]` → "Gerar autorização" | Pedir a autorização Pix ao cliente | — | — | QR code + "código Pix" bruto exibidos na tela | — |
| 6 | **(fora do produto)** | Levar o QR/código até o cliente | — | Como enviar? WhatsApp pessoal? Print? | — | Sem cobertura do produto — ver achado #3 do resumo |
| 7 | Cliente autoriza (externo, no app do banco dele) | — | — | — | — | Fora de qualquer controle da Zelo, correto que seja assim |
| 8 | `/app/recorrencias/[id]` → "Verificar status agora" | Conferir se já autorizou | — | — | — | Botão manual — sem verificação automática visível ao usuário nesta tela |

**Quantos passos reais existem até a primeira cobrança?**
**8 telas/ações distintas**, **~19 campos preenchidos pelo profissional**, mais **1 etapa inteiramente manual e fora do produto** (entregar o QR/código ao cliente). Isso não conta a espera por aprovação da subconta Asaas, que em produção real pode levar de minutos a dias.

**Achado crítico que não aparece na tabela**: nada disso é o caminho que o botão mais visível do dashboard oferece. "Nova cobrança" (destacado, primeira opção) pula direto para uma cobrança avulsa de 4 campos, sem nenhuma menção a Pix Automático — ver seção 11.

---

## 5. Client Journey (Cadastrar Cliente)

Fonte: `app/(app)/app/clientes/FormularioCliente.tsx`, `lib/cliente.ts`.

- **Campos**: nome (obrigatório), e-mail (opcional), WhatsApp (opcional), documento/CPF-CNPJ (opcional — com nota explícita "Será necessário para emitir cobrança"), observações (opcional, texto livre).
- **Ordem**: nome primeiro, depois e-mail/WhatsApp lado a lado, depois documento, depois observações — ordem que corresponde à importância real.
- **Linguagem**: limpa, em português direto, sem termo técnico.
- **Feedback após salvar**: redireciona para a ficha do cliente recém-criado (`/app/clientes/{id}`) — não para a lista.
- **Próximo passo sugerido**: **nenhum**, explicitamente. A ficha do cliente (não lida nesta auditoria em detalhe, mas confirmada como a página de destino) não tem um CTA do tipo "Agora crie uma cobrança para {nome}" — o próprio texto da página `/app/clientes/novo` já avisa "Só o nome é obrigatório. O resto você completa depois", o que é uma boa gestão de expectativa, mas para a ação seguinte.

**O usuário sabe imediatamente o que fazer depois de cadastrar o cliente?** 🟡 Parcialmente. Ele chega na ficha do cliente, mas nada na tela empurra ativamente para "criar uma cobrança para esta pessoa agora". Comparar com o estado vazio da lista de clientes, que SIM diz isso ("Depois de cadastrar, você cria cobranças para eles") — a mensagem existe no produto, só não está no lugar de maior atenção (o momento exato pós-cadastro).

---

## 6. Billing Journey (Criar Cobrança)

Classificação de campos pedida pelo escopo, para as duas formas de "cobrança" que existem no produto.

### 6.1 — `/app/cobrancas/nova` (avulsa)

| Campo | Classificação | Nota |
|---|---|---|
| Cliente | ESSENCIAL | sem ele não existe cobrança |
| Descrição | ESSENCIAL | aparece em toda a UI subsequente (dashboard, listas, recibo) |
| Valor | ESSENCIAL | — |
| Vencimento | ESSENCIAL, mas — | não vem pré-preenchido; um padrão razoável (hoje, ou +7 dias) eliminaria uma decisão sem custo real |

### 6.2 — `/app/recorrencias/nova` (o caminho da promessa)

| Campo | Classificação | Nota |
|---|---|---|
| Cliente | ESSENCIAL | — |
| Descrição | ESSENCIAL | — |
| Valor | ESSENCIAL | — |
| Dia de vencimento | ESSENCIAL | mas também sem sugestão inicial — o usuário sempre escolhe entre 28 opções |
| Data de início | **IMPORTANTE, deveria ser AVANÇADO** | já chega pré-preenchida com a data de hoje (`hojeISO()`); hoje ocupa uma linha inteira do formulário para um campo que 90%+ das vezes ninguém muda |

### 6.3 — O portão antes de qualquer cobrança automática: KYC da subconta (`ContaFinanceira.tsx`)

| Campo | Classificação | Nota |
|---|---|---|
| Nome completo/razão social, e-mail, CPF/CNPJ, celular | ESSENCIAL | exigência real do Asaas para abrir a subconta — não é invenção do produto |
| Renda ou faturamento mensal | IMPORTANTE | é KYC bancário genuíno, mas o rótulo não explica por que a Zelo precisa saber disso — gera desconfiança sem contexto |
| CEP, endereço, número, bairro | **DESNECESSÁRIO NA FORMA ATUAL** | 4 campos manuais quando um único CEP já permite preencher rua/bairro automaticamente (autopreenchimento por CEP é prática padrão em formulários brasileiros) |

**Achado adicional**: CPF/CNPJ é pedido **duas vezes** em dois formulários diferentes da mesma tela de Configurações (uma vez em "Dados da Empresa", outra dentro do KYC da subconta) — sem nenhum reaproveitamento do valor já digitado.

---

## 7. Dashboard Audit

Fonte: `app/(app)/app/page.tsx`.

- **O usuário entende imediatamente onde está?** Sim — título "Visão geral", subtítulo contextual ("Sua conta está pronta." ou "O resumo do seu mês.").
- **Entende quanto recebeu?** Sim, com clareza: "Recebido no mês" é o primeiro e mais destacado número.
- **Entende o que precisa fazer?** Parcialmente — o checklist de onboarding cobre isso enquanto incompleto, mas depois que os "8/8" passos terminam, o dashboard vira só um painel de leitura, sem nenhuma orientação de próxima ação.
- **Existe uma ação principal claramente dominante?** Sim, visualmente — mas é a ação **errada** para quem quer a promessa central (ver seção 11). Há três botões lado a lado (Nova cobrança / Novo cliente / Nova recorrência), com "Nova cobrança" em destaque visual (botão primário) e os outros dois secundários.
- **O CTA principal é óbvio?** Visualmente sim. Estrategicamente, não é o CTA que entrega a promessa.
- **Há informação demais?** Não — 4 números, uma tabela de próximos vencimentos, dois blocos pequenos (Problemas/Atividade). Bem dosado.
- **Há métricas que não ajudam um usuário novo?** "Processando" (valor enviado ao Asaas aguardando confirmação) é uma métrica operacional que só faz sentido depois que existe volume — para o dia 1, é mais um número zerado sem significado.
- **O estado vazio orienta corretamente?** Sim — "Crie sua primeira cobrança e acompanhe tudo por aqui" durante o trial. Boa mensagem, mesmo problema estrutural: o "criar" mais óbvio ao lado não é o caminho recorrente.
- **O sistema conduz ou só apresenta informações?** Conduz, via o checklist de 8 passos — esse é o melhor elemento de condução do produto inteiro.

**Classificação: 🟡 Precisa simplificar.**
Justificativa: os elementos individuais são bons (números claros, estados vazios com contexto, checklist orientador). O problema não é a tela em si — é que ela oferece dois caminhos de "criar cobrança" sem diferenciá-los, e o mais visível não é o mais relevante para a promessa vendida.

---

## 8. Navigation Audit

Fonte: `NavegacaoApp.tsx`, `app/(app)/app/layout.tsx`.

- **Menu principal**: 7 itens (Visão geral, Clientes, Cobranças, Recebimentos, Recorrências, Assinatura, Configurações) — nomes em português simples, nenhum jargão técnico no menu em si.
- **Notificações**: fora do menu principal, num link à parte com contador — decisão razoável (é uma caixa de entrada, não uma seção de dados), mas pode passar despercebida por não estar entre os outros itens.
- **"Autorizações" e "Instruções"**: só acessíveis de dentro da lista de Recorrências, nunca do menu principal. "Instruções de pagamento" é, pelo próprio código, uma tela quase técnica ("instrução nasce automaticamente quando um ciclo Pix Automático é enviado ao Asaas") — apropriado que fique escondida, mas o nome "Instruções" sozinho, sem esse contexto, não comunica nada a um usuário novo.
- **Cobranças vs. Recorrências**: dois itens de menu igualmente proeminentes, sem nenhuma indicação visual de que um é "manual" e o outro é "automático" — a diferença só fica clara depois de entrar em cada um.

**Um pequeno empresário consegue navegar sem conhecer conceitos de software financeiro?** Majoritariamente sim — os rótulos do menu são bons. O ponto fraco não é a navegação em si, é a ambiguidade entre Cobranças/Recorrências, que a navegação não resolve (ver seção 11).

**Oportunidades de agrupamento**: "Recebimentos" (só o que o Asaas confirmou) e "Cobranças" (todos os status, incluindo os não confirmados) são conceitos próximos o bastante para confundir sem uma explicação — hoje cada um é uma tela separada no mesmo nível do menu, sem nenhuma ligação visual entre elas.

---

## 9. Language Audit

| Texto atual | Onde | Problema | Linguagem recomendada |
|---|---|---|---|
| "Webhook URL: /api/webhooks/asaas" | `/app/configuracoes` | Termo de desenvolvedor, endpoint técnico exposto sem necessidade | Remover da tela do usuário — não é uma informação acionável para ele |
| "Ambiente: Sandbox / Produção" | `/app/configuracoes` | Jargão de engenharia de software | Remover, ou (se precisar existir) "Modo de testes" só quando aplicável |
| "Identificador da Empresa: {asaas_customer_id bruto}" | `/app/configuracoes` | ID interno de sistema, sem significado para o usuário | Remover, ou trocar por algo como "Conta conectada ✓" |
| "Camada de comunicação bancária e recebimento de webhooks" | `/app/configuracoes` | Frase inteira em vocabulário de infraestrutura | "Como sua cobrança chega até o banco do seu cliente" (ou remover a seção) |
| "subconta" | `/app/configuracoes` (comentário e rótulo de estado) | Termo do modelo de negócio do Asaas, não do usuário final | "sua conta de recebimento" |
| "self-service" | `/app/assinatura` | Anglicismo técnico | "você mesmo, pelo site" ou similar |
| "Instrução de pagamento" / "instrução aguardando processamento" | `/app/recorrencias/instrucoes`, `CicloInstrucao.tsx` | Nome de objeto interno de sistema (`instrucoes_pagamento`) vazando pro rótulo de tela | "Cobrança deste mês" / "Aguardando o banco processar" |
| "Débito agendado no banco do cliente" | `CicloInstrucao.tsx` | Aceitável — mas "instrução"/"ciclo" ao redor dele quebram a clareza | Manter esse padrão específico, é o melhor exemplo de linguagem humana do produto |
| "Autorização Pix Automático" / "status: CREATED / ACTIVE / REFUSED" (nos filtros de `/app/recorrencias/autorizacoes`) | Lista de autorizações | Os rótulos visíveis já traduzem para "Aguardando/Ativa/Recusada" — correto — mas o conceito "autorização" em si nunca é explicado a quem chega ali pela primeira vez | Uma linha de apoio explicando o que é uma autorização ajudaria |

**Nota geral**: fora da tela de Configurações, a linguagem do produto é consistentemente boa — em português, sem anglicismo, com bom uso de negrito/estrutura. O problema de linguagem está concentrado, quase inteiramente, num único bloco de uma única tela.

---

## 10. Empty States

| Tela | Mensagem | Ensina o próximo passo? |
|---|---|---|
| Clientes (nenhum) | "Cadastre seu primeiro cliente" + "Depois de cadastrar, você cria cobranças para eles" | 🟢 Sim, e explica o "porquê" |
| Cobranças (nenhuma, sem cliente) | "Cadastre um cliente primeiro" + "Toda cobrança pertence a um cliente" | 🟢 Sim, resolve a dependência real |
| Cobranças (nenhuma, com cliente) | "Crie sua primeira cobrança" + "Escolha o cliente, o valor e o vencimento. Leva menos de um minuto." | 🟢 Excelente — estima esforço |
| Recorrências (nenhuma) | Mesmo padrão condicional (sem cliente vs. com cliente) + "Configure uma mensalidade para gerar cobranças automáticas sem esforço manual" | 🟢 Sim |
| Autorizações (nenhuma) | "Autorização Pix Automático é solicitada a partir da ficha de uma recorrência ativa" | 🟡 Explica de onde vem, mas não há um link direto para lá |
| Instruções (nenhuma) | "Instrução de pagamento nasce automaticamente quando um ciclo Pix Automático é enviado ao Asaas" | 🔴 Linguagem técnica (ver seção 9); não há ação nenhuma, nem precisa haver — mas o texto não é para o público certo |
| Dashboard sem cobranças pendentes | "Nenhuma cobrança em aberto" + mensagem condicional por estar em trial ou não | 🟢 Bom |

**Conclusão da seção**: os estados vazios são, de forma consistente, um dos pontos mais fortes do produto — a exceção é justamente onde a linguagem técnica já havia sido sinalizada na seção 9.

---

## 11. Error & Feedback Audit

- **Erros de formulário**: em todos os formulários auditados (cliente, cobrança, recorrência, cadastro, login), o padrão é idêntico e bom — mensagem geral no topo (`role="alert"`), foco automático movido para o primeiro campo com erro, mensagem específica por campo. Nenhuma mensagem técnica encontrada (sem stack trace, sem código de erro bruto) nos formulários do usuário final.
- **Erro de sistema (`error.tsx`)**: modelo exemplar — "O problema é do nosso lado. Tente de novo — se continuar, seus dados seguem seguros e nada foi perdido", com um código de rastreio (`digest`) só para citar ao suporte, nunca a mensagem crua do erro. Este é o melhor texto de erro do produto inteiro.
- **Confirmação/sucesso**: "Alterações salvas com sucesso", "Cadastro recebido", "Confirme seu e-mail" — todos em `role="status"`/`aria-live`, human e diretos.
- **Estados de processamento**: botões trocam de rótulo durante a ação ("Salvando…", "Entrando…", "Verificando…", "Gerando…") — consistente em todo o produto, sem "spinner mudo".
- **Estados de falha específicos do Pix Automático** ("Autorização recusada", "O cliente não concluiu o primeiro pagamento a tempo. Gere uma nova autorização quando quiser tentar de novo.") — em linguagem humana e acionável.
- **Único ponto fraco real**: a mensagem de "Instrução recusada" ("O banco do cliente recusou o débito automático. Pode ser saldo insuficiente, limite ou a autorização não estar mais válida...") é boa, mas o botão "Ver motivo" revela o texto cru devolvido pelo Asaas ("Motivo informado pelo Asaas: ...") — pode conter linguagem de gateway de pagamento não traduzida.

**Conclusão**: esta é, isoladamente, a área mais madura do produto. Nada aqui precisa de correção urgente.

---

## 12. Cognitive Load

| Fluxo | Telas | Cliques/campos | Decisões | Conceitos novos | Chance de erro |
|---|---|---|---|---|---|
| Criar conta + confirmar e-mail | 2 (+ sair do produto) | 3 campos | 0 | 0 | Baixa |
| Cadastrar cliente | 1 | 1 campo obrigatório | 0 | 0 | Muito baixa |
| Criar cobrança avulsa | 1 | 4 campos | 2 (cliente, data) | "cobrança" vs. "recorrência" ainda não explicado | Baixa |
| Configurar CPF/CNPJ da empresa | 1 | 1 campo | 0 | 0 | Muito baixa |
| Conectar conta financeira (KYC) | 1 (+ possível espera externa) | 9 campos | 0 decisões, mas alta carga de digitação | "subconta", KYC bancário, possível análise de documento | Média — validação de CPF/CEP/celular, mais a incerteza de aprovação |
| Criar recorrência | 1 | 4-5 campos | 2 (valor, dia) | "recorrência" como conceito distinto de "cobrança" | Baixa |
| Gerar e entregar autorização Pix | 1 tela + 1 etapa fora do produto | 1 clique + ação manual externa | 1 grande decisão não coberta: "como eu mando isso pro cliente?" | QR code, "código Pix", autorização | Média-alta — depende inteiramente de o profissional improvisar um canal |

**Classificação por fluxo:**
- Criar conta: 🟢 SIMPLES
- Cadastrar cliente: 🟢 SIMPLES
- Criar cobrança avulsa: 🟡 MODERADO
- Configurar conta financeira (KYC): 🟠 COMPLEXO
- Criar recorrência: 🟡 MODERADO
- Gerar + entregar autorização ao cliente: 🔴 EXCESSIVAMENTE COMPLEXO (pela ausência de qualquer caminho dentro do produto)

---

## 13. Landing vs. Product Gap

**A experiência do produto entrega a mesma simplicidade que a landing page promete? Não.**

A landing resume a promessa em quatro verbos: **criar → autorizar → cobrar → receber.** Cada um desses verbos, no produto real, esconde uma complexidade que a landing não prepara o visitante para encontrar:

| Verbo da promessa | O que a landing sugere | O que o produto exige |
|---|---|---|
| **Criar** (a cobrança) | Uma ação simples e direta | Na prática, exige primeiro montar uma conta financeira com 9 campos de KYC bancário — antes de qualquer "criar" fazer sentido para automação |
| **Autorizar** (o cliente) | Algo que "só acontece", automaticamente fluido | O produto gera um QR code numa tela que só o profissional vê — a entrega até o cliente é 100% manual e fora do produto |
| **Cobrar** (automaticamente) | Zero esforço recorrente | Funciona bem quando chega lá — esta parte do motor está genuinamente bem construída (webhooks, idempotência, sincronização) |
| **Receber** | Direto, sem fricção | Funciona bem — "Recebimentos" é claro e correto |

**Onde acontece a quebra, concretamente:**
- **Landing promete**: implicitamente, poucos passos ("pare de cobrar, comece a receber").
- **Produto exige**: 8 telas/ações e ~19 campos, com um formulário de KYC bancário no meio e uma etapa manual sem cobertura de produto.
- **O maior gap não é quantidade — é direção**: o botão mais visível do produto (Nova cobrança, no dashboard) leva para fora da promessa, não para dentro dela. Isso é mais grave do que qualquer contagem de campos: um usuário pode usar a Zelo por semanas criando cobranças avulsas manualmente, exatamente o comportamento que a landing prometeu eliminar, sem nunca descobrir a recorrência automática.

---

## 14. Time To First Value

Definição usada: do momento "acabei de criar minha conta" até "minha primeira cobrança está criada e pronta para o cliente autorizar" (ou seja, até o fim do passo 5 da seção 4 — gerar a autorização e ter o QR/código em mãos).

**Estimativa fundamentada** (não medida ao vivo — baseada no número e na complexidade real dos campos/telas mapeados):
- Confirmação de e-mail: 1-3 minutos (depende do provedor de e-mail e de o usuário lembrar de checar)
- CPF/CNPJ da empresa: <1 minuto
- KYC da subconta (9 campos, dados bancários que a pessoa pode precisar consultar — CEP, renda declarada): 3-6 minutos, mais o tempo de espera por aprovação, se houver
- Cadastro de cliente: <1 minuto
- Criação da recorrência: 1-2 minutos
- Gerar autorização: instantâneo

**Total estimado, melhor cenário (subconta aprovada automaticamente, sem pedido de documento): 6–10 minutos de esforço ativo.**
**Cenário realista, com qualquer fricção (documento pedido, campo de CEP não localizado, dúvida sobre "renda ou faturamento"): 10+ minutos, com uma parada de duração indefinida esperando aprovação externa.**

**Classificação: 🟠 Atenção (5–10 min) na melhor hipótese, 🔴 Problema de UX (10+ min) no cenário mais realista.**

Isso não conta a etapa 6 da seção 4 (entregar o QR/código ao cliente) nem o tempo até o cliente de fato autorizar — que estão, corretamente, fora do controle do produto, mas que também não têm nenhum apoio dele.

---

## 15. Personal Trainer Test

Personal trainer, 30 anos, nunca usou software financeiro, acabou de criar conta.

| Tela | Ele saberia o que fazer sem ajuda? |
|---|---|
| `/criar-conta` | 🟢 sim |
| E-mail de confirmação | 🟢 sim |
| `/app` (dashboard, checklist 1/8) | 🟢 sim — o checklist literalmente diz o próximo passo |
| `/app/configuracoes` — CPF/CNPJ | 🟢 sim |
| `/app/configuracoes` — "Configurar agora" (KYC, 9 campos) | 🟡 provavelmente — os campos são conhecidos (nome, CEP, celular), mas "renda ou faturamento mensal" sem explicação pode gerar hesitação ("por que eles precisam saber isso?") |
| `/app/configuracoes` — bloco "Integração Financeira" (Webhook URL, Ambiente, Identificador) | 🔴 não — ele não tem contexto nenhum para interpretar essas informações, e elas não pedem nenhuma ação dele |
| `/app/clientes/novo` | 🟢 sim |
| `/app/recorrencias/nova` | 🟢 sim — os campos e as dicas ("R$ X / mês", "a primeira cobrança será gerada automaticamente") são claros |
| Dashboard, escolhendo entre "Nova cobrança" e "Nova recorrência" | 🟠 provavelmente não — nada na tela explica a diferença entre os dois botões; ele pode clicar no botão de destaque ("Nova cobrança") achando que é "o jeito de cobrar automaticamente", porque é o mais visível |
| `/app/recorrencias/[id]` — "Gerar autorização" | 🟢 sim, o botão e o texto são claros |
| Depois de gerar o QR code | 🔴 não — nada na tela diz o que fazer com aquele QR/código. Ele precisa decidir sozinho como mandar isso ao cliente |

**Resumo do teste**: o produto passa bem em quase toda tela individual. Os dois pontos onde ele "trava" (escolher entre os dois botões de cobrança, e descobrir como entregar a autorização) são exatamente os dois achados centrais desta auditoria.

---

## 16. Complexity Inventory

| Área | Complexidade | Problema | Impacto | Prioridade |
|---|---|---|---|---|
| Onboarding (checklist) | 🟢 Baixa | Nenhum — é o melhor mecanismo do produto | Positivo | — |
| Dashboard | 🟡 Média | CTA primário não leva à promessa central | Alto — define a primeira impressão de "como a Zelo funciona" | **P0** |
| Clientes | 🟢 Baixa | Nenhum problema relevante | — | — |
| Cobranças (avulsa) | 🟡 Média | Coexiste com Recorrências sem diferenciação explicada | Médio — gera confusão de qual usar | P1 |
| Recorrência | 🟡 Média | Bem desenhada, só falta o link do "porquê" e um default melhor para "início" | Baixo | P2 |
| Autorização Pix | 🔴 Alta | Nenhum caminho para entregar o QR/código ao cliente dentro do produto | Alto — é literalmente o "cliente autoriza" da promessa | **P0** |
| Navegação | 🟢 Baixa | "Autorizações"/"Instruções" pouco descobríveis, mas escondê-las é defensável | Baixo | P3 |
| Configurações | 🔴 Alta | 3 seções não relacionadas na mesma tela; painel técnico (webhook/ambiente/ID) exposto ao usuário; CPF/CNPJ pedido duas vezes; KYC de 9 campos sem explicação de propósito | Alto — é o portão obrigatório antes de qualquer automação funcionar | **P0** |
| Mensagens (erros/estados) | 🟢 Baixa | Só a mensagem crua do Asaas em "Ver motivo" | Baixo | P3 |

**Legenda**: P0 = bloqueia a promessa central; P1 = prejudica muito; P2 = melhoria importante; P3 = refinamento.

---

## 17. Top 10 Problems

**1. O CTA primário do dashboard não entrega a promessa da landing**
Onde: `/app` — botão "Nova cobrança" em destaque visual sobre "Nova recorrência".
Por que prejudica: é a primeira decisão real que um usuário novo toma depois do onboarding, e a mais visível leva para fora do diferencial do produto.
Impacto comercial: usuários podem operar a Zelo como uma ferramenta de controle manual de cobrança — exatamente o problema que a Zelo promete resolver — sem nunca ativar a automação, prejudicando retenção e percepção de valor.
Prioridade: **P0**.
Recomendação de alto nível: inverter a ênfase visual (recorrência como ação primária) ou, no mínimo, rotular os dois botões de forma que a diferença fique óbvia sem precisar clicar.

**2. Não existe caminho, dentro do produto, para entregar a autorização ao cliente**
Onde: `/app/recorrencias/[id]`, componente `AutorizacaoPix.tsx`.
Por que prejudica: o "cliente autoriza" da promessa comercial depende inteiramente de o profissional inventar um canal por fora (WhatsApp pessoal, print de tela).
Impacto comercial: fricção alta o suficiente para travar a ativação — é o ponto exato em que "pare de cobrar" vira, de novo, "vá cobrar seu cliente manualmente" (mesmo que só para mandar um QR code).
Prioridade: **P0**.
Recomendação de alto nível: um link público e compartilhável (mesmo que simples) para essa tela de autorização, que o profissional possa colar direto numa mensagem.

**3. Portão de KYC de 9 campos, com linguagem bancária, sem explicação de propósito**
Onde: `ContaFinanceira.tsx`, dentro de `/app/configuracoes`.
Por que prejudica: é o maior formulário do produto, obrigatório antes de qualquer automação, pedindo dado sensível (renda) sem dizer por quê.
Impacto comercial: ponto de abandono provável — especialmente por depender de aprovação externa que foge do controle do produto.
Prioridade: **P0**.
Recomendação de alto nível: uma frase de contexto antes do formulário ("Isso é exigido pelo banco parceiro para que o dinheiro caia direto na sua conta") + autopreenchimento de endereço por CEP.

**4. Painel técnico exposto na tela de Configurações**
Onde: bloco "Integração Financeira (Asaas & Pix Automático)" em `/app/configuracoes`.
Por que prejudica: "Webhook URL", "Ambiente: Sandbox/Produção" e um ID bruto não pedem nenhuma ação do usuário e não comunicam nada útil — só geram a sensação de "isso não é pra mim".
Impacto comercial: reforça a percepção de complexidade logo na tela mais visitada do fluxo de setup.
Prioridade: P1.
Recomendação de alto nível: remover da visão do usuário final ou mover para uma área de "avançado"/suporte.

**5. Duas formas de "começar" sem ligação entre si**
Onde: `/comecar` (captura de lead) vs. `/criar-conta` (cadastro real).
Por que prejudica: quem passa por `/comecar` não sai de lá com uma conta — e nada no produto faz a ponte de volta para `/criar-conta`.
Impacto comercial: possível perda de conversão entre "mostrei interesse" e "criei conta de fato".
Prioridade: P1.
Recomendação de alto nível: decisão de produto (fora do escopo desta auditoria) sobre se `/comecar` deveria redirecionar/levar direto ao cadastro assim que o backend de lead estiver validado.

**6. CPF/CNPJ pedido duas vezes na mesma tela**
Onde: `/app/configuracoes` — "Dados da Empresa" e o formulário de KYC da subconta.
Por que prejudica: retrabalho perceptível, sem motivo aparente para quem preenche.
Impacto comercial: pequeno, mas soma à sensação geral de "esse formulário é grande".
Prioridade: P2.
Recomendação de alto nível: reaproveitar o valor já salvo como preenchimento inicial do segundo formulário.

**7. "Cobrança" e "Recorrência" são conceitos sobrepostos sem essa sobreposição ser explicada**
Onde: em todo o produto — dashboard, menu, checklist de onboarding.
Por que prejudica: criar uma recorrência já gera a primeira cobrança automaticamente (confirmado no código), mas nada no produto explica essa relação — o usuário pode não entender por que dois itens do checklist ("primeira recorrência" e "primeira cobrança") ficam concluídos ao mesmo tempo.
Impacto comercial: confusão conceitual de baixo custo individual, mas que sustenta o problema #1.
Prioridade: P1.
Recomendação de alto nível: uma frase curta em `/app/recorrencias/nova` — "Isso já gera a primeira cobrança automaticamente".

**8. Formulários sem valores padrão óbvios**
Onde: vencimento da cobrança avulsa (sem default), dia de vencimento da recorrência (sem sugestão).
Por que prejudica: decisões extras onde uma escolha razoável já existiria (hoje, ou o dia atual do mês).
Impacto comercial: baixo, mas soma à carga cognitiva.
Prioridade: P2.
Recomendação de alto nível: pré-selecionar um valor sensato, permitindo alterar.

**9. "Instruções de pagamento" e "Autorizações" nomeadas para o sistema, não para o usuário**
Onde: `/app/recorrencias/instrucoes`.
Por que prejudica: são telas escondidas do menu principal (o que é correto), mas quando alguém chega lá, o texto ("instrução nasce automaticamente quando um ciclo é enviado ao Asaas") fala a língua do banco de dados, não a do usuário.
Impacto comercial: baixo — telas pouco visitadas — mas reforça a sensação técnica quando alguém entra ali por curiosidade.
Prioridade: P3.
Recomendação de alto nível: revisar rótulos com a mesma régua usada em `CicloInstrucao.tsx`, que já faz isso bem.

**10. Motivo de recusa do Asaas exibido sem tradução**
Onde: botão "Ver motivo" em `CicloInstrucao.tsx`.
Por que prejudica: pode expor um texto de gateway de pagamento em inglês ou em jargão bancário, quebrando o tom cuidadoso do resto das mensagens de erro.
Impacto comercial: baixo, afeta só quem já está numa situação de erro.
Prioridade: P3.
Recomendação de alto nível: mapear os motivos mais comuns do Asaas para frases próprias, como já feito para os status principais.

---

## 18. Ideal Zelo Journey

Sem alterar código — só a forma da jornada, seguindo "o que sobraria se tirássemos tudo que não é necessário".

### Primeira sessão
O usuário deveria ver **uma única pergunta**: "Quem você quer começar a cobrar?" — não um dashboard de números zerados. O checklist de 8 passos já existe e é bom; ele deveria ser praticamente a tela inteira até o primeiro cliente existir, sem competir com números e tabelas vazias.

### Primeira cobrança
O caminho mínimo, se a KYC bancária e a recorrência são inegociáveis para a automação funcionar, deveria ser: **criar conta → conectar conta financeira (com contexto de por que) → cadastrar cliente → criar recorrência → obter um link para mandar ao cliente.** Isso é essencialmente o caminho que já existe hoje — falta só (a) a explicação de propósito no KYC, (b) um jeito de sair do produto com algo pronto para compartilhar (link, não só QR na tela), e (c) fazer esse caminho ser o único "criar cobrança" que o usuário encontra primeiro — a cobrança avulsa pode continuar existindo, mas como uma opção secundária, não concorrendo em destaque visual com a automática.

### Uso recorrente
Depois que a Zelo está funcionando, o dia a dia ideal é exatamente o que o dashboard atual já entrega bem: "quanto entrou", "o que está pendente", "o que precisa de atenção" — sem exigir nenhuma ação além de reagir a alertas reais (autorização recusada, débito recusado). Esse estado futuro já está bem resolvido no código; o trabalho está todo concentrado na primeira sessão.

---

## 19. Simplicity Metrics

| Métrica | Atual | Ideal |
|---|---|---|
| Passos até a primeira cobrança Pix Automático pronta | 8 telas/ações | 5 (conta → conectar conta financeira → cliente → recorrência → link de autorização) |
| Campos até lá | ~19 | ~14 (removendo CPF/CNPJ duplicado e os 4 campos de endereço substituíveis por CEP) |
| Campos potencialmente elimináveis | 5 (CPF/CNPJ duplicado, endereço/número/bairro substituíveis por busca de CEP) | 0 |
| Decisões atuais sem default sugerido | 3 (vencimento avulso, dia de vencimento recorrente, "como entregar a autorização") | 1 (só o valor da cobrança realmente exige decisão nova a cada vez) |
| Telas atuais no caminho crítico | 8 | 5 |
| Complexidade geral (0–10, 10 = muito complexo) | **6** | — |
| Simplicidade percebida (0–10) | **5** | — |
| Aderência à promessa da landing page (0–10) | **4** | — |

Justificativa dos três scores finais: o produto entrega a promessa quando o usuário encontra o caminho certo — mas o caminho certo não é o mais visível, exige um formulário bancário sem contexto, e termina numa etapa manual sem suporte nenhum do produto. Isso pesa mais na nota do que a soma de pequenos atritos, porque atinge diretamente os três verbos centrais da promessa comercial ("criar", "autorizar" — o "cobrar" e "receber" automáticos, esses sim, funcionam bem uma vez que se chega lá).

---

## 20. Recommended Priorities

Ordem sugerida de ataque, sem propor implementação nesta etapa (auditoria apenas):

1. **P0 — Resolver a ambiguidade do CTA do dashboard** (achado #1): decisão de produto sobre qual ação deveria ser a primária.
2. **P0 — Dar ao produto uma forma de entregar a autorização ao cliente** (achado #2): mesmo uma solução simples (link público) fecha o maior buraco da jornada.
3. **P0 — Contextualizar o formulário de KYC** (achado #3): uma frase de propósito antes do formulário, e considerar autopreenchimento por CEP.
4. **P1 — Tirar o painel técnico da tela de Configurações** (achado #4) e **ligar `/comecar` a `/criar-conta`** (achado #5) — dois ajustes independentes, ambos de baixo risco técnico.
5. **P1 — Explicar a relação entre "recorrência" e "cobrança"** (achado #7) com uma frase no formulário de recorrência.
6. **P2/P3** — os demais nove achados menores da seção 17, que somam qualidade sem serem bloqueantes.

Nenhuma dessas recomendações foi implementada nesta etapa — são apontamentos de alto nível para decisão do time antes de qualquer trabalho de código.

---

*Auditoria produzida por leitura de código apenas — nenhum teste de usuário real foi conduzido. Onde a avaliação depende de percepção humana (linguagem, carga cognitiva, "teste do personal trainer"), isso está marcado como julgamento fundamentado, não medição.*
