# ZELO — AUTONOMOUS EXECUTION PLAN

Versão: 1.0 · Agosto de 2026

Fila de execução autônoma do projeto Zelo. Conteúdo fornecido pelo
proprietário em 25/08/2026 e gravado aqui para que o arquivo exista no
projeto (antes disso ele era citado mas não estava no disco).

O progresso de cada tarefa é registrado no PROJECT_STATUS.md, seção 21.

---

## 1. Objetivo

Levar a landing page ao estado mais próximo possível de lançamento.

Fluxo: visitante → entende o problema → entende a Zelo → entende como
funciona → entende os benefícios → identifica-se → vê o preço → confia →
tira dúvidas → clica → começa. A página deve vender a ideia antes de pedir
cadastro.

## 2. Regra principal

O projeto não é novo. **Preservar o que já funciona.** Alterações pequenas,
isoladas e testáveis.

## 3. Prioridade

CONVERSÃO > CLAREZA > CONFIANÇA > EXPERIÊNCIA > PERFORMANCE > ESTÉTICA.
A estética nunca prejudica os cinco primeiros.

## 4. Já concluído — não reconstruir

Hero, fundo e demonstração do hero, capítulos 1–5, Problema, Como Funciona,
Automação, Header, Footer, âncoras, Lenis, sistema de scroll.

## 5. Áreas congeladas

`Stage.tsx`, `Stage.module.css`, `lib/scene.ts`, beats, RITMO, câmera,
coreografia, capítulos 1–5, `JourneyProgress`, `SmoothScroll`, Lenis global,
Hero, Problema, Como Funciona, Automação.

Se uma tarefa exigir mexer nelas: **BLOCKED — FROZEN AREA**, e seguir.

## 6. Identidade visual

Fintech premium. Preto + violeta elétrico + verde dinheiro.
Violeta = tecnologia, processo, automação, fluxo.
Verde = dinheiro, sucesso, resultado, recebimento.
Evitar: neon excessivo, cyberpunk, gradiente genérico, glow demais,
dashboards, visual de template, excesso de cards.

## 7. Regras de animação

Máximo **1 ScrollTrigger por seção**; `scrub` quando depender do scroll;
`gsap.context` com `revert`; transform e opacity; nada de blur pesado;
respeitar `prefers-reduced-motion`; estado legível sem JavaScript; testar
desktop e mobile.

Toda animação responde: *"isso melhora compreensão, confiança ou conversão?"*
Se não: **não adicionar**.

## 8. Performance

Baseline ~57–58 fps desktop e mobile. Não degradar. Evitar blur, partículas,
canvas, SVG grande animado, propriedades caras, re-render desnecessário e
dependências novas.

## 9. Copy

Preservar a copy existente. **Não inventar** números, estatísticas, clientes,
depoimentos, parceiros, certificações, resultados ou métricas financeiras.

---

## 10. Fila

| # | tarefa | escopo |
|---|---|---|
| 01 | **Benefícios** | comunicar os ganhos concretos; entrada progressiva, destaque sequencial; preservar a copy |
| 02 | **Para quem é** | o visitante pensar "isso serve pro meu negócio"; animação discreta e útil |
| 03 | **Pricing** | refinar estrutura; **não definir preço**; placeholder identificado |
| 04 | **Trust** | aumentar confiança sem inventar provas |
| 05 | **FAQ** | estrutura, legibilidade, abertura/fechamento; não inventar respostas |
| 06 | **CTA final** | destino, âncoras, tracking, acessibilidade, mobile |
| 07 | **/comecar** | só com informação suficiente; não inventar integração |
| 08 | **Logo** | integrar quando os arquivos oficiais existirem |
| 09 | **SEO** | title, description, canonical, OG, Twitter, robots, sitemap, lang; JSON-LD só com dados reais |
| 10 | **Responsividade** | 1440 · 1280 · 1024 · 768 · 390 · 360 |
| 11 | **Acessibilidade** | headings, ARIA, teclado, foco, contraste, reduced motion |
| 12 | **Analytics** | conferir os eventos existentes |
| 13 | **Links** | nenhum 404, âncora inexistente, destino vazio ou URL inventada |
| 14 | **Footer** | dados não confirmados permanecem "A DEFINIR" |
| 15 | **Legal** | estrutura de /termos e /privacidade; não inventar conteúdo jurídico |
| 16 | **QA final** | typecheck, build, console, links, CTAs, âncoras, overflow, mobile, reduced motion, FPS, regressões |

## 26–28. Testes obrigatórios

Overflow 0px em 1440/1280/1024/768/390/360. Reduced motion legível e sem
depender de animação. FPS com múltiplas medições e A/B — uma medição isolada
não é regressão.

## 29. Git

O projeto pode não ter Git. **Não rodar `git init` sem autorização.** Backup
local antes de alterações grandes.

## 30. Decisões bloqueadas

Não inventar. Registrar **BLOCKED — OWNER DECISION REQUIRED** e seguir.
Exemplos: preço, modelo comercial, CNPJ, razão social, endereço, e-mail,
parceiros, dados regulatórios, termos jurídicos, política de privacidade,
destino real do cadastro.

## 31. Execução autônoma

Terminada uma tarefa, não perguntar: ler o plano, identificar a próxima,
executar, testar, registrar, continuar. Parar só quando tudo que é possível
estiver concluído ou o resto estiver bloqueado.

## 34. Regra final

Simples > complexo. Clareza + performance > efeito visual. Na dúvida sobre
informação comercial, não inventar. Na dúvida sobre área congelada, não
alterar. Tarefa claramente definida: executar sem aguardar confirmação.
