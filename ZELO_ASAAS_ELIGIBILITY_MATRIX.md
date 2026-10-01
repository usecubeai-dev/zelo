# Zelo — Matriz de elegibilidade Pix Automático (Fase 21)

Data: 2026-09-09. Escopo: só o que diz respeito a **quem pode usar Pix
Automático** — não é uma auditoria geral do projeto.

## O que o código sabe (verificado, com fonte)

| Fato | Fonte | Onde vive no código |
|---|---|---|
| Pix Automático exige recebedor PJ, CNPJ ativo há 6+ meses, CNAE compatível | Documentação pública do Asaas (citada em rodadas anteriores de consultoria — não reconfirmada nesta fase) | Nenhuma regra hardcoded — decisão explícita desta fase de **não** codificar isso como verdade absoluta |
| O evento de webhook `PIX_AUTOMATIC_RECURRING_ELIGIBILITY_UPDATED` traz `eligibility.status` (`ELIGIBLE`/`INELIGIBLE`) e `eligibility.ineligibleReasons` | Consulta direta a `docs.asaas.com/docs/eventos-para-pix-automático` nesta fase (09/09/2026) | `lib/asaas/tipos.ts` (`AsaasPixAutomaticEligibility`), `lib/asaas/webhook.ts` (`interpretarEventoElegibilidade`) |
| Quando a conta fica `INELIGIBLE`, o próprio Asaas cancela as autorizações ativas (chega como `AUTHORIZATION_CANCELLED` normal) | Comentário já existente no código antes desta fase, não reverificado agora | `lib/asaas/webhook.ts`, `processarEventoAutorizacaoPix` |
| Cobrança avulsa por Pix comum (`billingType: "PIX"`) já funciona hoje, para qualquer CPF ou CNPJ, sem depender de elegibilidade nenhuma | Leitura direta do código nesta fase | `lib/core/cobranca-financeira.ts` |

## O que ainda depende de teste real (não confirmado por nenhum código nem execução)

- **Se o campo `eligibility` do webhook realmente chega assim em produção.** A consulta à documentação nesta fase é a melhor fonte disponível sem credencial real do Asaas — mas nunca foi observado um evento real. O código (`interpretarEventoElegibilidade`) foi escrito para degradar com segurança (devolve `null`, e o chamador mantém só a auditoria de sempre) se o campo vier ausente ou com outro formato — **mas isso significa que, até o primeiro evento real chegar, ninguém sabe se o comportamento novo desta fase (bloquear "Gerar autorização", notificar o profissional) algum dia é de fato acionado.**
- **Se `empresas.pix_automatico_status` (coluna nova) alguma vez é escrita em produção.** A migration que a cria (`supabase/migrations/20260909000000_pix_automatico_elegibilidade.sql`) **não foi aplicada** — ver `ZELO_LAUNCH_BLOCKERS.md`.
- **Se um CPF autônomo consegue ou não criar uma autorização Pix Automático hoje.** Ninguém testou isso contra a API real do Asaas nesta fase nem em nenhuma fase anterior confirmada.
- **Se subcontas white-label criadas pela própria aplicação do Zelo seguem exatamente a mesma regra de elegibilidade de uma conta Asaas comum.** Não confirmado.

## O que depende de documentação do provider (não verificável sem consultar o Asaas diretamente, por escrito)

- Lista completa e atualizada de CNAEs compatíveis.
- Se o gate de "6 meses de CNPJ" é fixo ou pode ter exceção (ex.: conta já com faturamento histórico documentado por outro meio).
- Se `ineligibleReasons` tem um enum fechado e documentado, ou é texto livre — o código de hoje trata como texto livre (`string[]`, concatenado) porque não há confirmação de um enum fechado.
- O que exatamente dispara uma reavaliação de elegibilidade (é periódica? é por evento, tipo troca de CNAE cadastral?).

## O que não deve ser assumido

- **Que toda empresa `UNKNOWN` é elegível.** `UNKNOWN` significa só "nunca recebemos sinal do Asaas" — o sistema não bloqueia Pix Automático nesse estado (rule: ausência de sinal não é evidência de inelegibilidade), mas isso é uma escolha de UX permissiva, não uma confirmação de elegibilidade real.
- **Que CPF nunca é elegível.** O Zelo nunca assumiu isso no código — a decisão de quem é elegível é sempre do Asaas, nunca de uma regra `if (documento.length === 11)` ou parecida. Não existe, e não deveria existir, esse tipo de regra no código.
- **Que "aceitar Pix" e "aceitar Pix Automático" são a mesma coisa.** São dois produtos Asaas distintos com regras diferentes — ver `lib/core/metodo-cobranca.ts` para a separação explícita.
- **Que a taxa Zelo de R$1,99 por recebimento é cobrada de alguém hoje.** É texto de marketing/termos (`lib/plano.ts`, `TAXA_DE_RECEBIMENTO_CENTAVOS`) sem nenhuma lógica de cobrança real associada — ver `ZELO_LAUNCH_BLOCKERS.md`.
