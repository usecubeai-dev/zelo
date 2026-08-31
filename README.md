# Zelo — experiência de scroll storytelling

Não é uma landing page de SaaS. É uma cena única, dirigida pelo scroll, que
vai do problema (cobrar na mão) até o produto (cobrança agendada no Pix
Automático).

```bash
npm run dev     # http://localhost:3210
npm run build
```

## Como a narrativa é construída

Uma seção pinada (`Stage`) segura a tela por 7200px de scroll (5200 no
mobile) enquanto **uma timeline mestre** com `scrub` avança a história. Como
tudo está preso ao progresso do scroll, rolar para cima faz a história voltar.

Os instantes de cada beat ficam em [`lib/scene.ts`](lib/scene.ts), numa escala
de 0 a 100. Mudar a direção da cena é mexer nesses números — nenhum componente
precisa ser tocado.

| beat | o que acontece |
| --- | --- |
| 0–8 | calma: mesa, luz de janela, silhueta trabalhando. Zero verde. |
| 9–21,5 | Mariana, João e Carlos entram do fundo — intervalos de 7 e 4,5 |
| 25–32 | mensagens, lembretes e planilha se atropelam (intervalos de 2 a 0,5) |
| 32–40 | pico: a cena cheia, com a câmera ainda empurrando |
| 40–44 | congelamento de 4 beats: câmera imóvel, cena sem cor |
| 44–51 | esvaziamento por profundidade — três caminhos de saída |
| 51–57 | **silêncio**: quadro limpo, câmera parada |
| 57–66 | "E se você não precisasse mais cobrar?" |
| 69–77 | a luz verde entra pela primeira vez com a marca |
| 67–76 | a frase **recua** para o ambiente: diminui e perde contraste |
| 72 | o primeiro verde da página: um ponto de estado e uma linha curta |
| 74–85 | **o caos vira sistema**: as três cobranças voltam e se alinham |
| 94–103 | COBRA CERTO nasce de dentro da estrutura |
| 108–118 | a câmera atravessa a marca e entra na interface |
| 123–135 | Criar cobrança → Criando… → Cobrança criada ✓ |
| 143–152 | Pix Automático: autorização pendente → autorizado ✓ |
| 160–172 | Cobrança ativa · Agendada ✓ |
| 172–180 | **capítulo 3** — a câmera recua, a interface encolhe e vira o polo do cliente |
| 179–185 | o dia 05 chega: a data rola de `05 SET` para `Hoje` |
| 185–207 | o Pix Automático debita, o valor atravessa o espaço e vira comprovante |
| 207–215 | `Recebido desde setembro` conta até R$ 350,00 |
| 220–236 | a recorrência: outubro e novembro, cada volta mais curta |
| 236–242 | a sala volta a dominar o quadro; R$ 1.050,00 e `05 DEZ` |
| 242–254 | **capítulo 4** — a câmera vai até o profissional; ele cresce 45% |
| 254–268 | os três clientes do caos voltam alinhados e viram `Pago` |
| 268–278 | o sistema segue vivo fora de foco: saldo até R$ 1.750,00, datas até `05 FEV` |
| 278–287 | a assinatura nasce da cena, baixa, ao lado dele |
| 287–302 | **capítulo 5** — a assinatura sobe e a marca se remonta em volta dela |
| 294–302 | o CTA "Criar minha primeira cobrança" — o botão do capítulo 2, agora acionável |
| 302–312 | silêncio: ficam a marca, o botão e ele |

**A rima que fecha a peça.** Os três cards que soterravam o profissional no
capítulo 1 são os **mesmos nós do DOM** que voltam no capítulo 4, agora
alinhados, pequenos e pagos. Nenhum cliente novo foi criado. O estado `Pago` é
uma pílula posicionada de forma absoluta sobre a antiga — `.cardFoot` ganhou
`position: relative` e nada mais mudou nos capítulos 1 a 3.

**O profissional nunca age.** Em nenhum beat dos capítulos 3, 4 e 5 ele clica,
confere ou reage. `tools/cap45.mjs` mede o crescimento dele (115px → 167px no
desktop) e cobra que ele permaneça na cena até o último beat. É a ausência de
ação que carrega a conclusão.

**O capítulo 3 é o movimento inverso do 2.** O 2 termina dentro da interface;
o 3 começa recuando dela e revelando que a sala, a mesa e o profissional
sempre estiveram lá. O card não é substituído: ele encolhe e assume o polo do
cliente. O dinheiro é o **próprio valor tipográfico** que se desprende do card
e viaja — sem seta, sem linha, sem moeda. O profissional não faz nada em
nenhum beat: essa ausência é a mensagem.

**Dois bugs de seek que só apareceram com sonda.** Numa timeline com `scrub`,
posicionar o playhead num beat renderiza *também* os tweens seguintes, no
estado inicial deles. Isso quebrou duas coisas: (1) três tweens escrevendo o
saldo por `onUpdate` deixavam o número preso num valor de um ciclo futuro —
o saldo virou **função pura do beat**, calculada no `onUpdate` da timeline;
(2) o `fromTo` dos ciclos 2 e 3 se impunha durante a **primeira** viagem e
apagava o valor dentro do token — os ciclos passaram a usar só `.to`
encadeado. `tools/cap3.mjs` cobra os dois invariantes a cada meio beat.

**O capítulo 2 não é uma seção nova.** A frase não sai de cena, ela perde
importância; os elementos do caos não são substituídos, eles **voltam da
profundidade em que sumiram e se alinham** numa coluna com um indicador de
estado cada — o mesmo problema, agora organizado. As mensagens e os lembretes
não voltam: eles eram o ruído, e o ruído é o que o sistema elimina. A marca
sobe de dentro dessa estrutura, e a câmera atravessa a marca para chegar na
interface. Em nenhum ponto há corte, fade de tela ou seção aparecendo.

**O tempo é distribuído por importância, não por ordem.** A régua está em
`tools/cap2.mjs`, que mede quanto tempo cada momento existe *formado* — não
quando começa, mas por quantos beats fica inteiro na tela. Foi ela que mostrou
a distribuição invertida da primeira versão: o botão parado esperando tinha
13,5 beats e as duas confirmações (cobrança criada, autorizado) tinham 4 cada.
Hoje: espera 7,5 · confirmações 9,5 e 8,5.

**A travessia é profundidade, não dissolução.** O movimento da marca acelera
em direção à câmera (`power2.in`), mas a opacidade dela cai de forma **linear**
— sem isso ela ficava legível até o fim do tween e sumia de uma vez, e os oito
beats de travessia viravam três de crossfade. A interface já existe atrás da
marca, muito pequena e muito ao fundo, e só ganha opacidade depois que o nome
deixou de ser legível.

**Uma interface, vários estados.** O `.compStage` tem altura fixa e os três
painéis (ação, autorização, cobrança ativa) se trocam dentro dele: a interface
nunca cresce nem encolhe, e o cabeçalho troca "Nova cobrança" por "Cobrança
ativa" no mesmo lugar. É a mesma cobrança do começo ao fim.

**Esticar a narrativa não pode acelerar o que já foi aprovado.** É por isso
que `SCROLL_LENGTH` deriva de `PX_POR_BEAT × BEAT.end`: quando o roteiro
cresceu de 100 para 172 beats, o caos continuou percorrendo exatamente os
mesmos 72px por beat. O silêncio permaneceu em 5,5 beats (396px) no desktop e
6,5 (338px) no mobile, medidos antes e depois.

**A duração de cada entrada é dramaturgia, não enfeite** (`RITMO`, em
`lib/scene.ts`): Mariana entra em 6 beats com `power2.out`, João em 4,5,
Carlos em 3,5 com `power3.out`, mensagens em 3 e lembretes em 2. Intervalos
que encurtam + entradas que encurtam = pressão crescente. Se todos entrassem
com a mesma duração e a mesma curva, a terceira interrupção não seria mais
urgente que a primeira — seria só mais uma.

**O silêncio é medido, não estimado.** A cena precisa estar vazia *e* a frase
apagada por uma janela contínua antes da primeira palavra se mover: hoje são
5,5 beats no desktop (396px) e 6,5 no mobile (338px), com a câmera imóvel.
`tools/ritmo.mjs` mede isso a cada meio beat — foi ele que mostrou que, antes,
essa janela era de **zero beats**: a frase subia enquanto seis elementos ainda
se dissolviam.

## Direção de luz

O ambiente foi calibrado por **medição de luminância**, não a olho
(`tools/lum.mjs` fotografa a cena e lê o brilho médio de cada região). A
primeira versão colocava mesa, notebook e profissional todos entre 4 e 6 de
luminância — indistinguíveis entre si e do preto, o que custava credibilidade
sem ganhar nada de cinema. Hoje o ambiente vive entre 7 e 19, a interface em
96 e o CTA em 45.

A regra que rege a cena: **a silhueta é o elemento mais escuro do quadro**
(`#030504`), e é a diferença entre ela e um ambiente com volume que a torna
legível — não iluminá-la. Clarear a silhueta a deixaria mais clara que a mesa
e inverteria a leitura.

## Decisões que não são óbvias

**Arquitetura de camadas.** `.room` e `.layer` são dois planos achatados, cada
um com `perspective` própria, dentro do rig 3D. Se a sala ficar em
`preserve-3d` junto com o caos, o plano da mesa atravessa o volume da cena e
**oclui** os cards que estão atrás dele — eles existem, têm `opacity: 1`, e
simplesmente não são pintados.

**Quem é dono do transform.** Um elemento não pode ter transform no CSS e ser
animado pelo GSAP: o primeiro tween apaga o que estava no CSS. Centralizações
(`.copy`, `.figure`, `.composer`) são feitas por `gsap.set` com
`xPercent`/`yPercent`. Pelo mesmo motivo, a respiração de repouso vive nas
âncoras (`.anchor`) e o movimento de cena vive nos filhos — dois tweens na
mesma propriedade do mesmo nó brigam e tremem.

**Desfoque é caro.** A câmera muda de escala a cada quadro, o que força
re-rasterizar qualquer camada com `filter: blur()`. Os brilhos de ambiente
usam paradas suaves dentro do próprio gradiente, sem filtro: isso levou a cena
de 38fps para 58fps. `filter: blur()` só aparece durante a entrada e a saída
dos elementos, com raio pequeno.

**A mesa é um plano em perspectiva, não uma faixa.** Ela começa no meio do
quadro, some para a esquerda por uma `mask-image` e sai pela direita e por
baixo do enquadramento — nenhuma aresta atravessa a tela. A superfície é mais
escura que a parede: só o poço de luz da janela a revela. `.nearField` fecha a
profundidade de campo escurecendo o primeiro plano, perto demais da câmera
para estar em foco.

**Superfícies obedecem à mesma luz.** Cards, mensagens e planilha usam
gradiente a 225° (claro no alto à direita, onde está a janela) e sombra caindo
para baixo e para a esquerda. Cada elemento para numa inclinação
(`rotateY`/`rotateX`) e numa profundidade própria, com perspectiva aérea —
o que está mais longe perde contraste e ganha um desfoque de menos de 1,5px.
É isso que separa "plano físico no ambiente" de "card colado na tela".

**No mobile o caos é temporal, não espacial.** No desktop os elementos se
acumulam no espaço; em tela estreita isso só produz colisão. Então o mobile tem
coreografia própria (`CENA`, dentro do ramo `isMobile`): cada elemento entra
numa faixa vertical própria, ocupa o quadro por alguns beats e **sai por um
caminho diferente do que entrou** — Mariana sobe e recua para o fundo, a
mensagem passa pela câmera e sai por baixo, João é engolido pela profundidade
no próprio lugar, a planilha atravessa o topo. Nunca há mais de quatro
elementos ao mesmo tempo, e esses quatro só coexistem no pico da pressão,
imediatamente antes do congelamento.

| beat | mobile |
| --- | --- |
| 8–20 | Mariana chega e ocupa a cena sozinha |
| 14–28 | o lembrete entra embaixo; Mariana sobe e recua |
| 22–36 | João surge no espaço que ela desocupou |
| 30–42 | a planilha aparece entre as transições |
| 38 | Carlos entra — é ele quem chega ao congelamento |
| 43–50 | pico: Carlos + mensagem + dois lembretes, tudo pronto antes do freeze |

Nenhuma entrada termina depois de `BEAT.freeze`: quando tudo para, nada pode
estar entrando. O desfoque de repouso também sai no mobile, porque em tela
estreita ele custa legibilidade sem entregar profundidade.

**A pessoa é uma silhueta em SVG**, não uma foto. Uma foto de banco de imagens
nunca combina com a luz da cena — o contraluz aqui é a mesma forma deslocada
na direção da janela, então a luz sempre bate certo.

## Acessibilidade

Com `prefers-reduced-motion: reduce` a cena inteira é trocada por
[`StaticStory`](components/StaticStory.tsx): a mesma história em documento
legível, sem pin, sem câmera, sem Lenis. Nada da narrativa fica escondido
atrás de animação.

## Ferramentas de verificação

O painel de preview nem sempre compõe quadros, então a conferência visual é
feita fora dele:

```bash
node tools/shots.mjs 1440 900 shots          # quadros de cada beat
node tools/shots.mjs 390 844 shots-mobile    # o mesmo no mobile
node tools/reduced.mjs                       # versão sem movimento
node tools/fps.mjs                           # ritmo de quadros no scroll
node tools/diag.mjs 0.3 0.47                 # o que está visível em cada ponto
node tools/bandas.mjs                        # faixa que cada elemento ocupa no mobile
node tools/colisao.mjs 390 844 0.02          # varre o caos atrás de colisão e corte
node tools/reverso.mjs 390 844               # confere se a história volta idêntica
node tools/fpsmob.mjs                        # ritmo de quadros no viewport mobile
node tools/ritmo.mjs 1440 900                # cadência, densidade e respiro beat a beat
```

Os scripts dependem de `puppeteer-core` (instalado sem `--save`) e do Chrome
local. Eles usam os handles `window.__st` e `window.__lenis`, que só existem
em desenvolvimento.
