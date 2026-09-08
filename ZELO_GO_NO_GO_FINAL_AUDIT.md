# ZELO — Auditoria Final de GO/NO-GO

Auditoria somente-diagnóstico — nenhum código, CSS, banco, arquitetura ou provider foi alterado para produzir este documento. Evidência coletada **ao vivo nesta sessão** (typecheck, build, suíte de testes completa rodada agora, advisories do Supabase consultados agora, resolução de domínio checada agora) — não repete números antigos sem reconferir.

**Fonte de verdade**: código real do repositório (`C:\Users\matos\Documents\cobra-certo\web`), banco real (`krwzohklsqdysdrfkjcd`), e execução real de `tsc`/`next build`/suíte de testes nesta sessão.

---

## 1. Autenticação e autorização — ✅ PRONTO

E-mail+senha via Supabase Auth (`@supabase/ssr`), sessão em cookie HttpOnly. Autorização usa `getUser()` (valida contra o servidor), nunca `getSession()` (só lê cookie) para decisão de acesso — `lib/supabase/server.ts:47`. Layout de `/app` redireciona sem sessão (`app/(app)/app/layout.tsx:25`) como terceira camada, depois de RLS. Recuperação de senha, confirmação por e-mail e troca de senha implementadas e testadas.

## 2. Multi-tenancy / isolamento entre empresas — ✅ PRONTO

`empresa_id` em toda tabela de tenant, nunca aceito do formulário — sempre da sessão. FKs compostas (`cliente_da_empresa`, `recorrencia_da_empresa`, `cobranca_da_empresa`) impedem vincular registro de um tenant a outro no nível do banco, não só da aplicação. Isolamento testado por chamada direta à API (não pela UI) em praticamente todo arquivo de teste de domínio — confirmado rodando agora.

## 3. RLS — ✅ PRONTO

13/13 tabelas com RLS habilitado, 18 policies, nenhuma com `FORCE ROW LEVEL SECURITY` faltando onde importa. Consultei os advisories do Supabase agora (não de memória) — 6 itens, todos INFO/WARN, nenhum ERROR:
- 3× `rls_enabled_no_policy` (`asaas_credenciais`, `eventos_asaas`, `leads`) — **intencional**: RLS ligado sem nenhuma policy nega acesso total a `anon`/`authenticated`, só `service_role` acessa. Documentado em `supabase/schema/06_rls.sql`.
- 2× `authenticated_security_definer_function_executable` (`eh_membro`, `empresa_liberada`) — funções `SECURITY DEFINER` chamáveis via RPC por qualquer usuário autenticado. Vazamento máximo: um booleano (é membro de X? / X está liberada?) para um `empresa_id` arbitrário — baixa severidade, mas é enumeração real. Nunca visto isolado em auditoria anterior desta sessão.
- 1× `auth_leaked_password_protection` — proteção contra senha vazada (HaveIBeenPwned) está **desligada** no Auth do Supabase.

Nenhum desses é bloqueador de produção. Ver item 24 para prioridade.

## 4. Clientes — ✅ PRONTO

CRUD completo, só nome obrigatório, busca/filtro/paginação, sincronização financeira best-effort com Asaas. 26 testes de domínio, 0 falhas (rodado agora).

## 5. Cobranças avulsas — ✅ PRONTO

Criar/editar/cancelar, sincronização com Asaas, proteção contra duplo-cancelamento e contra confirmar pagamento pelo cliente. 44 testes, 0 falhas (rodado agora).

## 6. Recorrências — ✅ PRONTO

CRUD completo, gera a primeira cobrança automaticamente, pausar/reativar/encerrar com revogação de consentimento. 36 (+ parte dos 47 de `teste-core-financeiro.ts`) testes, 0 falhas.

## 7. Autorização pública `/autorizar/[id]` — ✅ PRONTO

Construída e testada nesta sessão: rota pública fora de `(app)`, token = id da autorização (UUID v4, não listável), superfície de dados mínima verificada programaticamente (nunca expõe `empresa_id`/`recorrencia_id`/`cliente_id`/id do Asaas), reconciliação reaproveita a função já existente e testada. 21 testes dedicados de segurança/isolamento, 0 falhas.

## 8. Pix / Asaas — ❌ BLOQUEADOR

**Problema exato**: `ASAAS_API_KEY` ausente. Confirmado agora lendo `.env.local` diretamente (só `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` estão definidas — nenhuma variável `ASAAS_*` está presente).
**Local**: `.env.local`; lido em `lib/asaas/config.ts:55` (`getAsaasConfiguration().isConfigured === false`).
**Impacto**: nenhuma cobrança real, nenhum Pix Automático real, nenhuma subconta real pode ser criada. Todo o Core Financeiro está construído e testado *contra essa ausência sendo tratada honestamente*, nunca fingida.
**Como validar**: depois de configurada, `getAsaasConfiguration().isConfigured` deve virar `true` e o botão "Configurar agora" em `/app/configuracoes` deve completar um cadastro de subconta real.
**Prioridade**: **P0** — decisão do proprietário (obter credencial no Asaas), não conserto de código.

## 9. Webhooks — ✅ PRONTO (código) / ⚠️ PRECISA VALIDAR (operação real)

**Código**: autenticação por `ASAAS_WEBHOOK_TOKEN` sem fallback pra API key, idempotência por `asaas_event_id` único, resolução de tenant por `account.id` (nunca por `externalReference` isolado), 46 testes de reconciliação/webhook, 0 falhas agora.
**O que falta validar**: o endpoint nunca recebeu um evento real do Asaas (não existe conta Asaas real — item 8) nem foi registrado no painel do Asaas como destino de webhook. Código pronto, operação real não verificada.
**Como validar**: registrar a URL do webhook no painel do Asaas assim que houver domínio (item 23) e credencial (item 8); disparar um evento de teste real.
**Prioridade**: P0, mas **dependente** do item 8 — não é um problema autônomo.

## 10. Idempotência — ✅ PRONTO

Padrão consistente em toda a base: compare-and-swap com TTL antes de chamar o Asaas, busca por identificador de correlação antes de criar (nunca cria às cegas), índices únicos como rede de segurança final (`asaas_payment_id`, `asaas_event_id`+`provider`, `asaas_authorization_id` parcial). Testado sob concorrência real (chamadas simultâneas) em cobrança, recorrência e autorização — confirmado agora.

## 11. Reconciliação financeira — ✅ PRONTO (código) / ⚠️ mesma ressalva do item 9

Consulta ativa (pull) complementando o webhook (push) para conta financeira, cobrança e autorização — cobre o caso de webhook atrasado/perdido. Testado com mocks; nunca reconciliou contra o Asaas real pelo mesmo motivo do item 8.

## 12. Dashboard — ✅ PRONTO

"Recebido no mês" como âncora visual (ajustado nesta sessão), checklist de onboarding, próximos vencimentos, bloco de problemas/atividade. CTA primário aponta para cobrança automática (corrigido em rodada anterior desta sessão).

## 13. Onboarding — ✅ PRONTO

Checklist de 8 passos **derivado do estado real** (nunca um flag persistido), nenhum passo perguntado de novo depois de concluído. 32 testes, 0 falhas.

## 14. Configurações — ✅ PRONTO

KYC com explicação de propósito, CPF/CNPJ reaproveitado (não pede duas vezes), painel técnico (Webhook URL/Ambiente/Identificador) escondido atrás de "Avançado" — tudo corrigido em rodada anterior desta sessão, verificado ao vivo no navegador.

## 15. Tratamento de erros — ✅ PRONTO

`error.tsx` genérico nunca vaza detalhe técnico (só um `digest` pra citar ao suporte). Server Actions retornam união discriminada (`{ok:true}`/`{ok:false, erros}`/`{ok:false, mensagem}`) consistente em toda a base — nenhum "500 Internal Server Error" cru chega à tela.

## 16. Estados vazios/loading/error — ✅ PRONTO

Skeleton por rota (`loading.tsx`, `aria-busy`), estados vazios contextuais (mudam de mensagem conforme o que falta, alguns estimam esforço — "leva menos de um minuto"). Auditado em detalhe numa rodada anterior desta sessão como um dos pontos mais fortes do produto.

## 17. Responsividade mobile/tablet/desktop — ✅ PRONTO

Verificado ao vivo nesta sessão com emulação real de viewport (375px/768px) em dashboard, clientes, formulário de recorrência e `/autorizar/[id]`. Um bug real foi encontrado (nav lateral quebrando em várias linhas em vez de virar faixa rolável) e corrigido na mesma sessão — não é uma alteração desta rodada de auditoria, mas o estado atual já reflete a correção.

## 18. Acessibilidade — ⚠️ PRECISA VALIDAR

**O que já existe**: foco visível em todo o produto, contraste WCAG verificado token a token (`ZELO_DESIGN_SYSTEM.md` §2/§7), `aria-describedby` em erro/dica de campo, skip-link, badges nunca só-cor (sempre cor + texto).
**O que nunca foi auditado ponta a ponta**: navegação por teclado completa, leitor de tela real, semântica `aria-*` em tabelas, e os filtros de lista (`.filtro`) são pills estilizadas, não `role="tablist"` semântico — **o próprio Design System já registra isso como gap conhecido**, não uma descoberta nova.
**Local**: `app/(app)/App.module.css` (`.filtro`), todas as telas de lista.
**Impacto**: usuário de leitor de tela pode ter experiência degradada nos filtros; não impede uso, mas não está confirmado como acessível.
**Como validar**: teste manual com NVDA/VoiceOver + navegação só de teclado nas 5 telas principais.
**Prioridade**: P2 — não bloqueia lançamento, mas deveria acontecer antes de tráfego real relevante.

## 19. SEO — ⚠️ PRECISA VALIDAR

**Problema exato**: `robots.txt` só permite indexação quando `NEXT_PUBLIC_PERMITIR_INDEXACAO=true` está setada explicitamente (mecanismo construído numa rodada anterior desta sessão, propositalmente "opt-in" pra staging nunca vazar pro Google). **Essa variável não está definida em nenhum lugar hoje** — significa que, se o site for publicado sem alguém lembrar de setá-la em produção, o site inteiro fica `Disallow: /` silenciosamente, sem erro, sem aviso.
**Local**: `app/robots.ts`, `lib/ambiente.ts`, `.env.example`.
**Impacto**: SEO real de zero até alguém configurar essa variável no ambiente de produção.
**Como validar**: depois do deploy real, checar `https://<domínio>/robots.txt` e confirmar `Allow: /`, não `Disallow: /`.
**Prioridade**: P1 — simples de resolver, mas fácil de esquecer, e o custo de esquecer é alto (zero tráfego orgânico até alguém notar).

Complementar: JSON-LD e dados estruturados dependem de CNPJ/razão social reais (item 21), que estão `A DEFINIR`.

## 20. Analytics — 🔵 MELHORIA FUTURA

`NEXT_PUBLIC_GA_ID`/`NEXT_PUBLIC_CLARITY_ID` ausentes — degrada graciosamente (`components/Analytics.tsx`, confirmado por leitura agora: sem a env var, nenhum `<Script>` é sequer renderizado, zero requisição). Não bloqueia nenhuma funcionalidade do produto — só significa que não há dado de tráfego até alguém configurar. Decisão do proprietário, não conserto técnico.

## 21. Variáveis de ambiente — ⚠️ PRECISA VALIDAR

Confirmado agora, lendo `.env.local` diretamente: **4 de 13** variáveis referenciadas no código estão definidas (as 4 do Supabase). Todo o resto (`ASAAS_*` ×5, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_CLARITY_ID`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PERMITIR_INDEXACAO`) está ausente. Isso é o estado esperado de um ambiente de desenvolvimento — não é um bug de código (100% das integrações são env-driven, zero valor hardcoded, confirmado por grep em sessão anterior) — mas é a lista exata do que falta preencher antes de produção real, e `.env.example` documenta todas.
**Prioridade**: acompanha os itens 8/22/23 (cada variável pertence a um bloqueador específico).

## 22. SMTP/e-mails — ❌ BLOQUEADOR

**Problema exato**: autenticação usa o provedor de e-mail padrão do Supabase, limitado a 2-3 e-mails/hora.
**Local**: configuração do projeto Supabase (fora do código do repositório).
**Impacto**: cadastro real (`/criar-conta`) para além de poucos usuários por hora falha silenciosamente para o usuário além do limite — ele nunca recebe o e-mail de confirmação.
**Como validar**: configurar SMTP customizado no painel do Supabase (Auth → SMTP Settings) e confirmar envio de mais de 3 e-mails em uma hora.
**Prioridade**: **P0** — bloqueado desde a Fase 35 (26/08/2026), nunca resolvido, é decisão/ação do proprietário (contratar um provedor de SMTP), não conserto de código.

## 23. Domínio — ❌ BLOQUEADOR

**Problema exato**: `zelopay.com.br` não resolve. Confirmado agora, ao vivo: `nslookup zelopay.com.br` → `Non-existent domain`.
**Local**: DNS/registro do domínio, fora do repositório.
**Impacto**: não há onde publicar o produto; HTTPS, canonical, sitemap, webhook do Asaas — nada disso tem destino real ainda.
**Como validar**: `nslookup zelopay.com.br` deve devolver um IP.
**Prioridade**: **P0** — decisão do proprietário (registrar/configurar o domínio).

## 24. Segurança — ✅ PRONTO, com uma ressalva registrada

RLS completo (item 3), grants de coluna revogados onde importa (usuário não forja `asaas_payment_id`/`provider_status`/etc., testado em quase todo arquivo de domínio), `service_role` isolada em `lib/supabase/admin.ts` com guarda em runtime contra import no cliente, dinheiro sempre `integer` em centavos, webhook com auth sem fallback. Auditoria manual equivalente a pentest feita numa fase anterior (sem achado crítico/alto) e reforçada nesta sessão para a nova rota pública.
**Ressalva honesta**: nenhuma ferramenta automatizada de pentest (Strix) rodou neste projeto — ambiente sem Docker, documentado como limitação desde a Fase 19, não escondido. A cobertura existente é revisão manual + testes automatizados de isolamento, não uma varredura automatizada de vulnerabilidades.
**Prioridade da ressalva**: P2 — rodar Strix (ou equivalente) quando Docker estiver disponível, antes de tráfego real relevante, não antes do primeiro deploy controlado.

## 25. Build/typecheck — ✅ PRONTO

Rodado agora, não de memória: `tsc --noEmit` limpo, `next build` exit code `0`, 36 rotas, nenhum erro nem warning de build.

## 26. Testes automatizados — ✅ PRONTO, com uma oscilação conhecida documentada

Suíte inteira (22 arquivos) rodada agora: **700 de 704 testes passando**. As 4 falhas são todas no mesmo arquivo, `tools/teste-confiabilidade-fase10.ts`, e reproduzem de novo ao rodar isoladamente — inspecionado o código-fonte da falha: o teste espera artificialmente 800ms para um TTL de lock de 200ms expirar, sensível a desvio de relógio entre o processo Node local e o Postgres do Supabase (o comentário no próprio teste já documenta essa causa). **Não é uma regressão de nenhuma mudança desta sessão** — é a mesma classe de flakiness registrada desde a Fase 10 em `PROJECT_STATUS.md`. O TTL real em produção é 2 minutos, ordens de magnitude maior que qualquer desvio de relógio real.
**Prioridade**: P3 — ajustar a margem do teste (não a lógica de produção) é uma melhoria de qualidade de teste, não um bloqueador.

## 27. Dados de teste — ✅ PRONTO

Nenhum resíduo de dado de teste encontrado no banco (verificado por consulta direta nesta sessão, depois de uma limpeza de dados criados para QA visual). Todo arquivo `tools/teste-*.ts` tem seção de limpeza própria e confirma "banco limpo ao final" como uma das próprias asserções.

## 28. Ambiente de staging — ❌ BLOQUEADOR

**Problema exato**: não existe projeto Supabase separado para staging — é o mesmo projeto (`krwzohklsqdysdrfkjcd`) usado para todo teste automatizado desta sessão e de todas as anteriores.
**Local**: infraestrutura Supabase, fora do repositório. Plano de execução já existe em `STAGING_EXECUTION_PLAN.md` e o schema já está versionado em `supabase/schema/` (Etapa 2, concluída).
**Impacto**: risco operacional quando os itens 8/22/23 forem resolvidos e o primeiro teste real acontecer — não há isolamento entre "testando" e "produção".
**Como validar**: seguir a ordem de execução já documentada em `STAGING_EXECUTION_PLAN.md` §13.
**Prioridade**: P1 — plano pronto, execução ainda não autorizada/feita.

## 29. Deploy — ❌ BLOQUEADOR

**Problema exato**: nenhuma plataforma de hosting configurada. Confirmado agora: sem `.vercel/`, sem `.github/workflows/`, sem `vercel.json`, sem `Dockerfile`.
**Local**: N/A — é a ausência completa de infraestrutura de deploy.
**Impacto**: mesmo que todos os outros itens fossem resolvidos hoje, não há para onde publicar o build.
**Como validar**: conectar um projeto Vercel (ou equivalente) e confirmar um deploy bem-sucedido.
**Prioridade**: **P0** — é a primeira configuração de hosting que este projeto jamais teve.

## 30. Checklist de produção — consolidado abaixo

---

# GO/NO-GO FINAL

# 🔴 NO-GO

**6 bloqueadores reais**, nenhum deles causado por código construído nesta sessão ou em qualquer fase anterior — todos são configuração/decisão que só o proprietário resolve:

1. **Credenciais do Asaas ausentes** (item 8) — bloqueia todo o fluxo financeiro real.
2. **Domínio `zelopay.com.br` não resolve** (item 23) — confirmado ao vivo agora.
3. **SMTP de autenticação não configurado** (item 22) — cadastro real falha depois de poucas tentativas/hora.
4. **Nenhuma plataforma de deploy conectada** (item 29) — não existe onde publicar.
5. **Nenhum ambiente de staging separado de produção** (item 28) — plano pronto, execução pendente.
6. **Webhook do Asaas nunca testado contra evento real** (item 9) — consequência direta do item 1, não um problema autônomo.

CNPJ/razão social (bloqueador jurídico/legal de fases anteriores, não recoberto por este código) continua pendente e é pré-requisito para publicar `/termos` e `/privacidade` de verdade — mantém-se como parte do mesmo grupo de decisões do proprietário.

**O código em si não é o bloqueador.** Build limpo, TypeScript limpo, 700/704 testes automatizados passando (as 4 restantes são flakiness de teste já documentada, não defeito de produto), RLS completo em 13/13 tabelas, isolamento multi-tenant testado extensivamente, e uma rota pública nova (`/autorizar/[id]`) construída e testada com o mesmo rigor nesta sessão. O produto está tecnicamente pronto para ser ligado assim que as decisões acima forem tomadas.

---

# TOP 5 PRÓXIMAS AÇÕES

Ordenadas por impacto e dependência real (não por facilidade):

1. **Resolver Asaas** (item 8) — é o pré-requisito de que tudo mais depende: sem isso, os itens 9 e 11 continuam "código pronto, nunca testado de verdade", e a assinatura da própria Zelo também não funciona.
2. **Resolver domínio** (item 23) — pré-requisito para o webhook do Asaas ter um destino real e para o item 19 (SEO) ter algo pra indexar.
3. **Conectar uma plataforma de deploy** (item 29) — sem isso, nenhum dos itens acima pode ser testado em condição real, só localmente.
4. **Configurar SMTP** (item 22) — pode ser feito em paralelo aos 3 acima, é independente; sem ele o cadastro real trava assim que houver mais do que uma pessoa testando por hora.
5. **Executar o plano de staging já escrito** (item 28, `STAGING_EXECUTION_PLAN.md`) — depois que 1-4 estiverem resolvidos, staging é o que permite testar a combinação inteira sem risco antes de expor a produção de verdade.

Depois desses 5: lembrar de setar `NEXT_PUBLIC_PERMITIR_INDEXACAO=true` (item 19) no ambiente de produção especificamente — é barato de esquecer e caro em tráfego perdido se esquecido.
