# Zelo — Cobrar, lembrar, recuperar, receber

O que foi construído, o que o Asaas realmente faz (confirmado na documentação e
no **sandbox**, 06/10/2026) e o que ficou de fora de propósito.

## Fatos do Asaas que mandam no desenho

| Fato | Origem | Consequência no Zelo |
|---|---|---|
| Toda cobrança tem valor **mínimo de R$ 5,00** (Pix, boleto ou "cliente escolhe") | sandbox: HTTP 400 abaixo disso | o formulário avisa; "cliente escolhe" é recusado abaixo de R$ 5 (UI, servidor e `CHECK` no banco) |
| **Multa e juros só valem para boleto**; em Pix e cartão o campo é ignorado | documentação oficial | encargos só existem quando o cliente pode escolher (`billingType UNDEFINED`); nunca se promete encargo num Pix |
| Juros: **máximo 11% ao mês**; multa aceita até 50% | sandbox | Zelo limita juros a 11% e multa a 10% (trava de digitação, não regra jurídica) |
| `UNDEFINED` = o pagador escolhe Pix, boleto ou cartão numa fatura hospedada | documentação | o Zelo nunca recebe nem guarda dado de cartão |
| Notificações do Asaas: `scheduleOffset` só aceita 0, 1, 5, 7, 10, 15 e 30 dias; **todo canal é tarifado** | documentação | "3 dias antes/depois" não é possível lá; ver Lembretes |

## O que existe

- **Forma de pagamento por cobrança** (`cobrancas.forma_pagamento`): só Pix (padrão) ou "seu cliente escolhe como pagar". Pix Automático é sempre Pix.
- **Multa e juros** (`multa_pct`, `juros_pct_mes`): só na forma "cliente escolhe". Depois que a cobrança existe no Asaas, **nada disso muda mais** (trava no banco: `trava_pagamento_da_cobranca`).
- **Padrões da empresa** (`empresas.*_padrao`, lembretes, canal) — só o ponto de partida de cobranças **novas**.
- **Central "Em atraso"** (`/app/inadimplencia`): quem deve, quanto, dias, valor atualizado (**estimativa**), última ação, ação recomendada e "Recuperar cobrança".
- **Lembretes de hoje**: lista de quem está na vez (3 dias antes, no dia, 1/3/7 dias depois). **Nada é enviado sozinho**: o botão abre o WhatsApp (mesmo link `wa.me` de sempre) e o profissional aperta Enviar.
- **Ações de contato** (`acoes_cobranca`, RLS por empresa, imutável): WhatsApp aberto, link copiado, negociada.
- **Taxa de R$ 1,99 só em Pix recebido**: o webhook só registra a taxa quando `billingType` é PIX (ou ausente, payload antigo). Boleto/cartão pagos não geram taxa do Zelo.
- Painel: Recebido / A receber / Em atraso / Previsão mensal + faixa "N cobranças atrasadas precisam da sua atenção". Cliente: totais, "Em dia"/"Em atraso".

## Limitações conhecidas

- **Valor atualizado é estimativa** (multa uma vez + juros pro rata `%/30` por dia). Quem calcula o valor final é o Asaas, no pagamento do boleto.
- **Lembretes automáticos pelo Asaas não foram ligados**: 3 dias não existe nos offsets e cada canal tem tarifa para a subconta do profissional. Foi feita a camada de configuração/estado no Zelo (fila de lembretes + envio manual).
- **Boleto/cartão dependem da subconta estar liberada** para esses meios (não verificável por API; a tela avisa).
- **Diferenciação por plano**: não existe infraestrutura de entitlements no projeto (só o limite de clientes por plano). Nada foi bloqueado por plano; criar essa camada é decisão futura.
- Recorrência com Pix Automático não usa os padrões de forma/encargos (autorização é Pix).

## Banco (migrations aditivas)

`20261007000000_cobranca_recuperacao.sql`, `20261007000100_cobranca_recuperacao_grants.sql`.
