## Reconfirmação ao vivo — zelo-ops, 2026-09-21

Reverificação pontual (sem alteração de código/config), disparada por
divergência encontrada entre este documento e o estado real do
repositório/DNS. Resumo — detalhe completo no relatório entregue ao dono
na mesma data:

- **Domínio `zelopay.com.br`**: RESOLVIDO. `nslookup` retorna IP real,
  `curl -I -L https://zelopay.com.br` retorna 200 via Vercel (redirect
  308 para `www.`). O item 4 original da matriz P0 ("env vars do
  Supabase na Vercel — status incerto") parece resolvido na prática (200,
  não "Internal Server Error"), mas isso não foi confirmado var-a-var no
  painel Vercel — inferido só pelo comportamento HTTP.
- **CNPJ/razão social**: RESOLVIDO no código. `termos/page.tsx` e
  `privacidade/page.tsx` têm `48.443.579/0001-93` /
  "GOGOMOB TECNOLOGIA BR LTDA" (não mais "A DEFINIR"). Risco legal
  **reduzido, não fechado**: `privacidade/page.tsx` ainda tem ~10 blocos
  `BlocoPendente` abertos, incluindo DPO não designado formalmente e
  "Processador de pagamentos — NÃO CONTRATADO e ainda não ativo".
- **Asaas**: `.env.local` tem `ASAAS_API_KEY` (sandbox) preenchida, mas
  `ASAAS_WEBHOOK_TOKEN`, `ASAAS_PLATFORM_ACCOUNT_ID` e
  `ASAAS_CREDENTIALS_KEY` continuam ausentes — sem essas três o endpoint
  de webhook responde 503 e nenhuma subconta pode ser criada de verdade,
  mesmo em sandbox. Status da Vercel/produção não verificável nesta
  sessão (sem acesso ao painel).
- **SMTP de cadastro**: SEM MUDANÇA — `ZELO_SMTP_PRODUCTION_SETUP.md`
  confirma que nenhum provider foi escolhido nem configurado no painel
  do Supabase. Continua bloqueando cadastro/recuperação de senha para
  e-mail real fora do allowlist padrão.
- **Staging formal**: SEM MUDANÇA — ainda não existe projeto separado;
  `STAGING_EXECUTION_PLAN.md` continua sendo plano, não execução.
- **Estado não commitado**: há mudanças extensas no working tree
  (Fase 21 elegibilidade Pix, Fase 22 e-mail Resend) não commitadas —
  não é possível confirmar se o que está servindo `zelopay.com.br` agora
  reflete esse trabalho ou o último commit (`e0b117c`).
- Duas migrations pendentes de confirmação de aplicação:
  `20260909000000_pix_automatico_elegibilidade.sql` e
  `20260910000000_limite_cobrancas_e_delete_cliente.sql` — sem acesso ao
  MCP do Supabase nesta sessão, não verificado se estão aplicadas.

---

# Zelo — Blockers de lançamento (Fase 21)

Data: 2026-09-09. Atualiza o que já existia em documentos anteriores
(`ZELO_GO_NO_GO_FINAL_AUDIT.md`, `ZELO_GO_LIVE_EXECUTION_CHECKLIST.md`) com
o que foi encontrado/mudado nesta fase (elegibilidade Pix Automático,
fallback, dois modos de cobrança). Classificado pelo estado real
encontrado no código nesta data — não pelo que um documento anterior dizia.

## Matriz de escopo desta execução

| Categoria | Item |
|---|---|
| **IMPLEMENTAR AGORA** (feito nesta fase) | Abstração de elegibilidade (`lib/core/elegibilidade-pix.ts`), decisão de método de cobrança (`lib/core/metodo-cobranca.ts`), parsing seguro do webhook de elegibilidade + notificação (`lib/asaas/webhook.ts`), guard honesto em `criarAutorizacaoPix`, UX de fallback na tela de recorrência, correção de texto no onboarding, teto defensivo no agendador, testes unitários novos |
| **BLOQUEADO POR ASAAS** | Confirmar em produção que `eligibility` chega no formato documentado; verificar por escrito regras de elegibilidade para o(s) nicho(s)-alvo; `ASAAS_API_KEY` de produção |
| **BLOQUEADO POR SMTP** | Cadastro/recuperação de senha para usuários reais fora do allowlist padrão do Supabase (ver `ZELO_SMTP_PRODUCTION_SETUP.md`) |
| **BLOQUEADO POR VERCEL/DNS** | Aplicar a migration desta fase e confirmar env vars do Supabase em produção (status da sessão anterior: incerto) — não é Vercel/DNS em si, mas depende do mesmo ciclo de deploy |
| **NÃO FAZER AGORA** | Fila/worker para o agendador; checkout de assinatura própria; implementar a cobrança real da taxa de R$1,99; refactor do agendador além do `.limit()` defensivo; qualquer regra de elegibilidade baseada em profissão/nicho |

---

## P0 — impede lançamento

1. **Migration da Fase 21 não aplicada.** `supabase/migrations/20260909000000_pix_automatico_elegibilidade.sql` adiciona `empresas.pix_automatico_status/motivo/atualizado_em`. Sem ela, todo o código novo desta fase continua funcionando (degrada com segurança para `UNKNOWN`/no-op), mas o comportamento novo — bloquear "Gerar autorização" quando inelegível, notificar o profissional — nunca liga de verdade. Aplicar via MCP do Supabase ou SQL Editor, no projeto de produção.
2. **`ASAAS_API_KEY` de produção ainda não configurada** (confirmado em auditorias anteriores a esta fase — não reverificado agora, mas nada nesta fase mudou esse fato).
3. **SMTP de produção não configurado** — ver `ZELO_SMTP_PRODUCTION_SETUP.md`. Sem isso, cadastro e recuperação de senha não funcionam de verdade para e-mails reais fora do allowlist padrão do Supabase.
4. **Env vars do Supabase na Vercel — status incerto.** Sessão anterior deixou a configuração em andamento (`NEXT_PUBLIC_SUPABASE_URL` confirmada, as demais 3 incertas). Sem as 4, o middleware (`proxy.ts`) quebra em praticamente toda rota — já observado como "Internal Server Error" em produção.
5. **CNPJ da própria empresa Zelo não existe.** `app/(legal)/termos/page.tsx` e `privacidade/page.tsx` têm "CNPJ: A DEFINIR". Bloqueia: termos/privacidade válidos, conta de plataforma junto ao Asaas, e a própria Zelo conseguir se cobrar (Fase 6 já confirmou que não há checkout de assinatura própria).
6. **Nenhuma confirmação por escrito do Asaas sobre elegibilidade de Pix Automático para o público-alvo real do Zelo.** Decisão de produto/mercado, não técnica — o código desta fase (elegibilidade dinâmica, nunca hardcoded) já está preparado para qualquer resultado dessa confirmação, mas a confirmação em si não foi feita.

## P1 — importante, mas pode lançar sem

1. **Agendador de cobranças (`lib/core/agendador-cobrancas.ts`) escala mal.** A query varre todas as recorrências ativas (O(total)) para achar as que vencem hoje — vira problema real por volta de 100–200 clientes pagantes simultâneos. Esta fase adicionou só um `.limit(5000)` defensivo (evita um scan sem teto nenhum); a correção real (indexar por próximo vencimento, paginar, cron mais frequente) fica para quando houver clientes pagantes de verdade.
2. **Taxa de R$1,99 por recebimento é só texto.** Aparece em `components/Pricing.tsx`, `components/Faq.tsx`, `app/(legal)/termos/page.tsx` e `app/(app)/app/assinatura/page.tsx` (via `lib/plano.ts`, `TAXA_DE_RECEBIMENTO_CENTAVOS`) — mas não existe nenhuma lógica no código que efetivamente cobre, deduza ou repasse esse valor. `pagamentos.taxa_centavos` guarda a taxa REAL do Asaas (diferença entre `value` e `netValue` do payment), não a taxa da Zelo. Decisão comercial pendente: implementar a cobrança de verdade, ou ajustar a comunicação para não prometer o que o sistema não faz — nenhuma das duas foi decidida aqui (regra explícita desta fase: não decidir valor comercial sem confirmação).
3. **Checkout de assinatura própria não existe.** `app/(app)/app/assinatura/page.tsx` já é honesto sobre isso (sem botão que promete o que não cobra) — mas sem ele, quando o trial expirar, a reativação da conta depende de intervenção manual/suporte, não de self-service.
4. **`provider_status = 'criando'` sem reconciliação automática** (dívida documentada desde a Fase 3 do core financeiro) — se o processo cair entre o CAS e a chamada ao Asaas terminar, a empresa fica travada até um operador destravar manualmente pelo Supabase Studio.
5. **O payload real de `PIX_AUTOMATIC_RECURRING_ELIGIBILITY_UPDATED` nunca foi observado em produção.** O código desta fase foi escrito a partir de consulta à documentação pública do Asaas (não de um evento real capturado) — ver `ZELO_ASAAS_ELIGIBILITY_MATRIX.md`. Degrada com segurança se o formato real for diferente, mas o comportamento novo (notificação, bloqueio) só é validado de fato no primeiro evento real que chegar.

## P2 — pós-lançamento

1. **Fallback de Pix comum não tem lembrete automático dedicado (ex. WhatsApp).** Hoje é cobrança avulsa manual — funcional, mas sem o polimento que tornaria essa a experiência principal para contas inelegíveis a Pix Automático.
2. **Estado `PENDING` de elegibilidade** (`lib/core/elegibilidade-pix.ts`) existe só na abstração — nenhum caso de uso ainda o grava. Reservado para um futuro fluxo de verificação ativa no onboarding.
3. **Auditoria de segurança dedicada** (a exemplo da Fase 19 anterior) não foi refeita nesta fase — fora de escopo do pedido atual.
