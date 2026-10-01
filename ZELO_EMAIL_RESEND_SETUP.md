# Zelo — E-mail transacional via Resend (Fase 22)

Nenhuma credencial foi configurada, solicitada ou vista nesta fase. Este
documento explica como configurar quando o responsável decidir fazê-lo.

## Isto é diferente do SMTP do Supabase Auth

Existem **dois sistemas de e-mail distintos** no Zelo, e esta fase só
cobre o segundo:

1. **SMTP do Supabase Auth** — confirmação de cadastro, recuperação de
   senha. Gerenciado inteiramente pelo Supabase (painel Authentication →
   Emails), **não** passa pelo código da aplicação. Documentado
   separadamente em `ZELO_SMTP_PRODUCTION_SETUP.md` (ainda pendente,
   escopo daquela fase, não desta).
2. **E-mail transacional próprio do Zelo** (esta fase) — notificações de
   cobrança, pagamento e Pix Automático, disparadas pelo próprio código
   via `lib/email/`, usando a API HTTP do Resend diretamente (não SMTP).

Se no futuro fizer sentido usar o Resend também como relay SMTP do
Supabase Auth (o Resend suporta isso), é uma configuração adicional no
painel do Supabase — não interfere em nada do que está descrito aqui.

## Arquitetura

```
lib/email/
  config.ts              lê RESEND_API_KEY / EMAIL_FROM / EMAIL_REPLY_TO
  tipos.ts                contrato: EmailEnvio, ResultadoEnvioEmail, ProvedorDeEmail
  resend.ts                único arquivo que sabe o formato da API do Resend
  provider.ts              resolve qual provider usar (só Resend hoje)
  enviar.ts                sendEmail() — único ponto de entrada
  sanitizar.ts              escaparHtml / sanitizarCabecalho
  registrar.ts              log estruturado, sem dado sensível
  templates/
    layout.ts               casca visual compartilhada (marca Zelo)
    notificacao.ts           template genérico, usado por toda notificação existente que ganhou e-mail
    boas-vindas.ts            existe, não conectado (ver arquivo — motivo documentado)

lib/core/
  destinatario-email.ts     resolve o e-mail do profissional (via membros + Supabase Auth Admin)
  notificacoes.ts            criarNotificacao() agora também despacha e-mail, quando o tipo tem template
```

Nenhum outro arquivo do sistema importa `lib/email/resend.ts` nem sabe
que o provider é o Resend — todos chamam `sendEmail()`
(`lib/email/enviar.ts`). Trocar de provider no futuro é um arquivo
(`lib/email/provider.ts`), não uma busca-e-substituição pelo projeto.

## Variáveis de ambiente

Documentadas em `.env.example`, sem valor real:

| Variável | Obrigatória para enviar de verdade | Onde configurar |
|---|---|---|
| `RESEND_API_KEY` | Sim | **Só** nas variáveis de ambiente da Vercel/produção (Project Settings → Environment Variables) — nunca em arquivo versionado |
| `EMAIL_FROM` | Sim | Mesmo lugar |
| `EMAIL_REPLY_TO` | Não (opcional) | Mesmo lugar |

Sem `RESEND_API_KEY`/`EMAIL_FROM`, `sendEmail()` devolve
`{status: "nao_configurado"}` — nenhuma funcionalidade principal é
afetada, nenhum e-mail finge ter sido enviado. Isso vale igual em
desenvolvimento local e em qualquer ambiente onde as variáveis não
estejam presentes.

## Configuração local (opcional — só se quiser testar envio de verdade)

1. Criar uma conta no Resend (resend.com).
2. Gerar uma API key em API Keys.
3. Colar em `.env.local` (nunca em `.env.example`, nunca versionado):
   ```
   RESEND_API_KEY=<a chave gerada>
   EMAIL_FROM=Zelo <onboarding@resend.dev>
   ```
   O domínio `resend.dev` funciona para teste imediato, sem verificação
   de DNS — só para desenvolvimento, nunca para produção.

## Configuração em produção

1. **Domínio remetente** — decidir e verificar o domínio de envio no
   painel do Resend (Domains → Add Domain). O Resend fornece os registros
   DNS (SPF/DKIM/DMARC-relacionados) a publicar no provedor de DNS do
   domínio da Zelo — não sobrepõem nada do domínio principal do site,
   mas precisam do mesmo cuidado de propagação do `ZELO_SMTP_PRODUCTION_SETUP.md`.
2. **`EMAIL_FROM`** — um endereço nesse domínio verificado, ex.
   `Zelo <notificacoes@zelopay.com.br>`.
3. **`EMAIL_REPLY_TO`** (opcional) — um endereço de suporte real, se
   quiser que uma resposta do profissional chegue a alguém.
4. **Cadastrar as variáveis na Vercel** — Project Settings → Environment
   Variables, ambiente Production. Nunca colar a chave em chat, ticket ou
   arquivo do repositório.
5. **Teste de envio** — depois de configurado, disparar qualquer evento
   já conectado (ver tabela abaixo) num ambiente com a variável presente
   e confirmar: (a) o e-mail chega, (b) não cai em spam, (c) o link do
   CTA abre a tela certa.

## Notificações conectadas (`lib/core/notificacoes.ts`, `MAPA_TOM_EMAIL`)

Só os tipos abaixo disparam e-mail — o resto continua só in-app
(o mapa é a única coisa que precisa mudar para conectar um tipo novo):

| Tipo de notificação | Evento |
|---|---|
| `pagamento_recebido` | Cliente final pagou uma cobrança |
| `cobranca_estornada` | Estorno (total ou parcial) |
| `conta_aprovada` / `conta_recusada` | Aprovação da subconta Asaas do profissional |
| `cobranca_automatica_falhou` | Agendador não conseguiu gerar um ciclo |
| `instrucao_pagamento_scheduled` / `_refused` | Débito automático agendado/recusado |
| `autorizacao_pix_active` / `_refused` / `_expired` / `_cancelled` | Mudança de estado da autorização Pix Automático |
| `pix_automatico_inelegivel` / `pix_automatico_elegivel` | **Fase 21** — conta perdeu/recuperou elegibilidade para Pix Automático |
| `assinatura_inadimplente` / `_regularizada` / `_cancelada` | Situação da assinatura do próprio Zelo |

## Template de boas-vindas — existe, não está conectado

`lib/email/templates/boas-vindas.ts` foi criado, mas nenhum código chama
`sendEmail` com ele. Motivo: a criação de empresa/membro acontece
inteiramente num trigger de banco (`ao_criar_usuario`) — não existe hoje
nenhum código de aplicação executado no momento do cadastro. Conectar
isto exigiria alterar o trigger (migração de banco) ou adicionar um novo
ponto de disparo na tela de cadastro — as duas fora do escopo desta fase.
Fica documentado como próximo passo, não implementado às pressas.

## O que este documento não faz

Não configura nada, não expõe nenhuma credencial. A execução real
(escolher domínio, configurar DNS, gerar a API key, colar na Vercel) é
ação manual do responsável pelo projeto.
