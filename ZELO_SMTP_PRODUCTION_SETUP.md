# Zelo — Configuração de SMTP para produção (Fase 21)

Nenhuma credencial foi configurada ou solicitada nesta fase. Este documento
só levanta o que precisa ser decidido e configurado — a decisão de qual
provider usar é comercial/externa, não técnica.

## Por que isso importa

O Supabase Auth usa um SMTP próprio (compartilhado entre todos os projetos
gratuitos/pequenos) por padrão. Ele tem um **allowlist restrito de
destinatários e um limite baixo de envios por hora** — funciona para
desenvolvimento, mas qualquer cadastro real de um e-mail fora do allowlist
falha silenciosamente do ponto de vista do usuário (ele nunca recebe o
e-mail de confirmação, e a tela de "link enviado" aparece do mesmo jeito —
ver `app/(auth)/recuperar-senha/FormularioRecuperar.tsx`, que mostra
"Link enviado" mesmo quando o envio falha, por desenho anti-enumeração).
Sem SMTP próprio configurado, o Zelo não consegue de fato confirmar
cadastro nem recuperar senha para usuários reais fora do allowlist.

## Fluxos de autenticação que dependem de e-mail (confirmados por leitura do código)

| Fluxo | Arquivo | Redirect usado |
|---|---|---|
| Confirmação de cadastro | `app/(auth)/criar-conta/FormularioCadastro.tsx` | `${origin}/auth/callback?proximo=/app` |
| Recuperação de senha | `app/(auth)/recuperar-senha/FormularioRecuperar.tsx` | `${origin}/auth/callback?proximo=/nova-senha` |
| Definir nova senha (pós-link) | `app/(auth)/nova-senha/FormularioNovaSenha.tsx` | consome a sessão já trocada pelo callback acima |

Não existe fluxo de troca de e-mail nem de convite de membro adicional no
código hoje — só os três acima. Os dois redirects já usam
`window.location.origin` (calculado em runtime no navegador do usuário),
não uma URL fixa — ou seja, **já funcionam corretamente em qualquer
domínio sem precisar de ajuste de código**, desde que o domínio de
produção esteja na allowlist de redirect URLs do Supabase Auth (ver
abaixo). `NEXT_PUBLIC_SITE_URL` (usado só em `app/layout.tsx`, para
metadata/SEO) é uma variável separada — não precisa bater com o SMTP.

## O que precisa ser decidido (decisão externa, não técnica)

1. **Provider SMTP.** Não decidido ainda neste projeto. Opções comuns para
   este volume (produto novo, poucos cadastros/dia no início): Resend,
   Amazon SES, Postmark, SendGrid. Qualquer um funciona com o Supabase
   Auth (ele aceita SMTP genérico).
2. ~~**Domínio de envio** (`from`) — precisa ser um domínio que a Zelo
   controle o DNS.~~ **Resolvido em 10/09/2026**: `zelopay.com.br` está
   registrado, conectado à Vercel e servindo o site em produção (DNS
   validado, SSL ativo). O domínio já pode receber os registros
   SPF/DKIM/DMARC do passo 7 abaixo — não é mais um bloqueador desta
   etapa, só falta escolher o provider (item 1) e publicar os registros.

## Por que isto não pode ser "implementado em código"

Diferente do e-mail transacional próprio da Zelo (`lib/email/`, ver
`ZELO_EMAIL_RESEND_SETUP.md`), o SMTP do Supabase Auth **não é lido por
nenhum arquivo deste repositório**. Ele é configurado inteiramente no
painel do Supabase (Authentication → Emails → SMTP Settings) — não existe
`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` em `.env.example` porque
nenhum código aqui os leria. Adicionar essas variáveis ao projeto seria
enganoso: pareceriam ativas sem nunca serem consultadas. Confirmado por
busca no código nesta auditoria: nenhuma referência a `nodemailer`,
`createTransport` ou `SMTP_*` existe no repositório — os dois únicos
pontos que dependem de e-mail de autenticação
(`supabase.auth.signUp`, `supabase.auth.resetPasswordForEmail`) chamam a
API do Supabase Auth diretamente, que decide como enviar com base
unicamente na configuração do painel.

A configuração real (escolher provider, gerar credencial, colar no
painel, publicar DNS) exige acesso ao painel do Supabase e uma decisão
comercial de provider — nenhum dos dois disponível nesta sessão. Nenhuma
credencial foi inventada.

## Checklist de configuração (preencher quando o provider for escolhido)

1. **Provider SMTP** — a decidir.
2. **Host** — a decidir (depende do provider).
3. **Porta** — normalmente `587` (STARTTLS) ou `465` (SSL implícito); confirmar com o provider escolhido.
4. **TLS/SSL** — usar STARTTLS na porta 587 (recomendação padrão da maioria dos providers transacionais); nunca porta 25.
5. **Remetente (`from`)** — ex. `naoresponda@<domínio-da-zelo>` — precisa ser um endereço no domínio verificado do passo 7.
6. **Reply-To** — endereço de suporte real (ex. `suporte@<domínio-da-zelo>`) para que uma resposta do usuário chegue a alguém, não caia em `naoresponda@`.
7. **DNS — SPF** — registro TXT no domínio de envio autorizando o provider escolhido a enviar em nome dele. Valor exato fornecido pelo provider ao verificar o domínio.
8. **DNS — DKIM** — registro(s) CNAME ou TXT fornecidos pelo provider (assinatura criptográfica dos e-mails enviados).
9. **DNS — DMARC** — registro TXT em `_dmarc.<domínio>` definindo a política (recomendado começar em `p=none` para só observar, depois evoluir para `p=quarantine`/`p=reject` conforme a reputação do domínio se consolidar).
10. **Configuração no Supabase** — Painel do projeto → Authentication → Emails → SMTP Settings: host, porta, usuário, senha (a senha/API key do provider — nunca commitar, nunca colar em chat), remetente e nome de exibição. Authentication → URL Configuration → Redirect URLs: adicionar o domínio de produção (ex. `https://<domínio-da-zelo>/**`) — sem isso, `emailRedirectTo`/`redirectTo` acima são recusados pelo Supabase mesmo com SMTP correto.
11. **Testes obrigatórios antes de considerar concluído:**
    - Cadastro de uma conta nova com e-mail real (fora de qualquer allowlist de teste) → confirma que o e-mail chega e o link funciona.
    - Recuperação de senha de ponta a ponta (pedir → receber → definir nova senha → logar com a nova senha).
    - Verificar que o e-mail não cai em spam (checar pelo menos Gmail e um provedor corporativo comum, se houver usuário de teste disponível).
    - Confirmar que os registros SPF/DKIM/DMARC estão publicados e propagados (`dig txt <domínio>`, ou uma ferramenta de verificação de e-mail) antes do primeiro envio real em volume.

## O que este documento não faz

Não configura nada. Não expõe nem solicita nenhuma senha, API key ou
credencial. A execução real desta checklist (escolher provider, configurar
DNS, colar credenciais no painel do Supabase) é uma ação manual do
responsável pelo projeto, fora do escopo desta fase.
