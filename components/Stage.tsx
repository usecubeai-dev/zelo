"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import s from "./Stage.module.css";
import {
  BEAT,
  RITMO,
  CHARGES,
  MESSAGES,
  SHEET_ROWS,
  SCROLL_LENGTH,
  DATAS,
  PAGO_EM,
  SALDO,
} from "@/lib/scene";
import StaticStory from "./StaticStory";
import { Check, Bell, Zap, ArrowRight, ArrowDown } from "./icons";

gsap.registerPlugin(ScrollTrigger);

/** Posições de repouso de cada elemento do caos, em % do viewport. */
const CARD_POS = [
  { left: "56%", top: "16%" },
  { left: "16%", top: "54%" },
  { left: "62%", top: "60%" },
];
const MSG_POS = [
  { left: "10%", top: "20%" },
  { left: "70%", top: "38%" },
  { left: "26%", top: "78%" },
  { left: "48%", top: "8%" },
];
/* Sobrou um só. "Vence hoje" e "Atrasado 3 dias" repetiam o que os próprios
   status dos cards já dizem — densidade sem informação nova. "2º lembrete" é
   o único que acrescenta algo que nenhum card carrega: já houve um primeiro. */
const CHIP_POS = [{ left: "40%", top: "34%", label: "2º lembrete" }];
/**
 * Os condutos do fundo do hero, num viewBox de 1440x900.
 * A leitura é entrada → núcleo → saída: duas trajetórias convergem para a
 * região onde a demonstração vive (~1150, 440) e duas partem dela. São curvas
 * de propósito — reta lê como gráfico, curva lê como infraestrutura.
 */
const CONDUITS = [
  { id: "in-a", dir: "in", d: "M -40 96 C 300 150 640 250 1046 402", dur: "12s", delay: "0s" },
  { id: "in-b", dir: "in", d: "M -60 742 C 320 726 760 612 1052 470", dur: "15s", delay: "4.2s" },
  { id: "out-a", dir: "out", d: "M 1258 470 C 1352 566 1408 690 1470 848", dur: "11s", delay: "7.4s" },
  { id: "out-b", dir: "out", d: "M 1250 404 C 1340 336 1414 268 1500 196", dur: "13s", delay: "9.8s" },
] as const;

/** Pontos de luz onde os condutos encontram a região do núcleo. */
const NODES = [
  { cx: 1046, cy: 402, r: 2.4, delay: "0s" },
  { cx: 1052, cy: 470, r: 2, delay: "1.6s" },
  { cx: 1258, cy: 470, r: 2, delay: "3.1s" },
  { cx: 1250, cy: 404, r: 2.4, delay: "4.4s" },
];

/** Luzes distantes que acendem quando a Zelo processa. Três, não trinta. */
const SPARKS = [
  { cx: 792, cy: 214, r: 1.6 },
  { cx: 1372, cy: 630, r: 1.4 },
  { cx: 960, cy: 742, r: 1.5 },
];

/* ---------------- a arquitetura em perspectiva ----------------
   O ponto de fuga fica na região da demonstração (VP): a estrutura do
   espaço converge para o produto. É isso que transforma "linhas no fundo"
   em "a demonstração está DENTRO de um lugar". Tudo gerado, não desenhado
   à mão, para as convergências ficarem geometricamente corretas. */
const VP = { x: 1150, y: 470 };

/** Vigas radiando do ponto de fuga até fora do quadro. */
const BEAMS = (() => {
  const alvos = [
    [-260, 900], [-120, 980], [120, 1010], [420, 1020], [760, 1030],
    [-300, 40], [-60, -120], [420, -180], [980, -200], [1560, -140],
    [1700, 200], [1740, 700], [1660, 1010],
  ];
  return alvos.map(([x, y], i) => ({
    d: `M ${VP.x} ${VP.y} L ${x} ${y}`,
    /* quanto mais perto do centro do quadro, mais fraca: a viga só ganha
       corpo depois que se afasta do ponto de fuga */
    op: 0.1 + (i % 4) * 0.028,
  }));
})();

/** Travessas do piso: o espaçamento encurta em direção ao horizonte.
    Contagem fixa de propósito — uma progressão geométrica com laço `while`
    converge antes de chegar ao horizonte e nunca termina. */
const RUNGS = (() => {
  const N = 9;
  const BASE = 900;
  const HORIZONTE = VP.y + 58;
  return Array.from({ length: N }, (_, i) => {
    const t = (N - 1 - i) / (N - 1);
    const y = HORIZONTE + (BASE - HORIZONTE) * t * t;
    return { y: Math.round(y), op: 0.06 + t * 0.24 };
  });
})();

const MOTES = [
  { left: "22%", top: "62%", dur: 15, delay: 0 },
  { left: "31%", top: "48%", dur: 19, delay: 2.4 },
  { left: "44%", top: "70%", dur: 17, delay: 5.1 },
  { left: "57%", top: "40%", dur: 21, delay: 1.2 },
  { left: "66%", top: "66%", dur: 16, delay: 7.3 },
  { left: "73%", top: "34%", dur: 20, delay: 3.6 },
  { left: "81%", top: "58%", dur: 18, delay: 9.1 },
  { left: "38%", top: "28%", dur: 22, delay: 6.4 },
  { left: "52%", top: "82%", dur: 17, delay: 11.2 },
  { left: "88%", top: "46%", dur: 19, delay: 8.5 },
];

export default function Stage() {
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useLayoutEffect(() => {
    if (reduced !== false) return;
    const el = root.current;
    const vp = viewport.current;
    if (!el || !vp) return;

    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(el);
      const mm = gsap.matchMedia();

      mm.add(
        { isDesktop: "(min-width: 861px)", isMobile: "(max-width: 860px)" },
        (context) => {
          const { isMobile } = context.conditions as { isMobile: boolean };
          const len = isMobile ? SCROLL_LENGTH.mobile : SCROLL_LENGTH.desktop;
          /** No mobile a mesma história acontece num espaço mais raso. */
          const d = isMobile ? 0.5 : 1;

          const camera = q(`.${s.camera}`)[0];
          const rig = q(`.${s.rig}`)[0];
          const room = q(`.${s.room}`)[0];
          const layer = q(`.${s.layer}`)[0];
          const copy = q(`.${s.copy}`)[0];
          const hint = q(`.${s.hint}`);
          /* hero: pequena demonstração viva do produto, ao lado da copy */
          const heroDemo = q(`.${s.heroDemo}`)[0];
          const heroNodes = q(`.${s.heroNode}`);
          const heroCore = q("[data-hero-core]")[0];
          const heroCoreMark = q("[data-hero-core-mark]")[0];
          const heroCoreRing = q("[data-hero-core-ring]")[0];
          const heroCoreField = q("[data-hero-core-field]")[0];
          const heroPulse1 = q('[data-hero-pulse="1"]')[0];
          const heroPulse2 = q('[data-hero-pulse="2"]')[0];
          const heroStateCriada = q('[data-hero-state="criada"]')[0];
          const heroStateAuth = q('[data-hero-state="auth"]')[0];
          const heroStateProc = q('[data-hero-state="proc"]')[0];
          const heroStatePago = q('[data-hero-state="pago"]')[0];
          const heroSaldoRest = q('[data-hero-saldo="rest"]')[0];
          const heroSaldoPago = q('[data-hero-saldo="pago"]')[0];
          const heroDot = q("[data-hero-dot]")[0];
          const heroScape = q("[data-hero-scape]")[0];
          const heroConduits = q("[data-hero-conduits]")[0];
          const heroSparks = q("[data-hero-spark]");
          const vignette = q(`.${s.vignette}`)[0];
          const heroAura = q("[data-hero-aura]")[0];
          const heroAuraIn = q("[data-hero-aura-in]")[0];
          const heroAuraDeep = q("[data-hero-aura-deep]")[0];
          const cards = q("[data-card]");
          const cardAnchors = q("[data-anchor-card]");
          const msgs = q("[data-msg]");
          const msgAnchors = q("[data-anchor-msg]");
          const figure = q(`.${s.figure}`)[0];
          const chips = q("[data-chip]");
          const sheet = q("[data-sheet]")[0];
          const sheetAnchor = q("[data-anchor-sheet]")[0];
          const chipAnchors = q("[data-anchor-chip]");
          const greenLight = q(`.${s.greenLight}`)[0];
          const phraseWrap = q(`.${s.phrase}`)[0];
          const phraseWords = q("[data-word]");
          const brand = q(`.${s.brand}`)[0];
          const brandMark = q(`.${s.brandMark}`)[0];
          const brandName = q(`.${s.brandName}`)[0];
          const brandLine = q(`.${s.brandLine}`)[0];
          const composer = q(`.${s.composer}`)[0];
          const btnFill = q(`.${s.compBtnFill}`)[0];
          const btnLabel = q(`.${s.compBtnLabel}`)[0];
          const btnLoading = q(`.${s.compBtnLoading}`)[0];
          const btnDone = q(`.${s.compBtnDone}`)[0];
          const badge = q(`.${s.compBadge}`)[0];
          /* capítulo 2 */
          const dots = q("[data-dot]");
          const sinal = q(`.${s.sinal}`)[0];
          const sinalLine = q(`.${s.sinalLine}`)[0];
          const painelAcao = q('[data-painel="acao"]')[0];
          const painelAuth = q('[data-painel="auth"]')[0];
          const painelAtiva = q('[data-painel="ativa"]')[0];
          const authBox = q(`.${s.authBox}`)[0];
          const authPend = q("[data-auth-pend]")[0];
          const authOk = q("[data-auth-ok]")[0];
          const tituloA = q("[data-titulo-a]")[0];
          const tituloB = q("[data-titulo-b]")[0];
          /* capítulo 3 */
          const poloCliente = q('[data-polo="cliente"]')[0];
          const poloVoce = q('[data-polo="voce"]')[0];
          const valor = q("[data-valor]")[0];
          const valorCorpo = q("[data-valor-corpo]");
          const valorPago = q("[data-valor-pago]")[0];
          const saldo = q("[data-saldo]")[0];
          const saldoValor = q("[data-saldo-valor]")[0];
          const datas = q("[data-datas]")[0];
          const pagoDatas = q("[data-pago-datas]")[0];
          /* capítulos 4 e 5 */
          const pagos = q("[data-pago]");
          const statusAntigos = q(`.${s.status}`);
          const acoesCobrar = q(`.${s.cardAct}`);
          const silhueta = q("[data-silhueta]")[0];
          const laptop = q(`.${s.laptop}`)[0];
          const brandIn = q(`.${s.brandIn}`)[0];
          const cta = q("[data-cta]")[0];
          const publico = q("[data-publico]")[0];

          /* Centralizações que o GSAP precisa possuir — se ficassem no CSS,
             o primeiro tween de transform as apagaria. */
          gsap.set(copy, { yPercent: isMobile ? 0 : -50 });
          gsap.set(heroDemo, {
            yPercent: isMobile ? 0 : -50,
            xPercent: isMobile ? -50 : 0,
          });
          gsap.set(figure, { xPercent: -50, z: -150 * d });
          gsap.set(composer, { xPercent: -50, yPercent: -50 });

          /* No mobile o caos é mais enxuto: menos coisas ao mesmo tempo. */
          /* No mobile a prioridade é legibilidade, não densidade: uma
             mensagem, um lembrete, e cada elemento na sua faixa. */
          const liveMsgs = isMobile ? msgs.slice(0, 2) : msgs;
          const liveChips = isMobile ? chips.slice(0, 2) : chips;
          if (isMobile) {
            gsap.set(msgs.slice(2), { display: "none" });
          }

          /* ---------- movimento de repouso (respiração da cena) ----------
             Vive nas âncoras, nunca nos elementos que a timeline move: dois
             tweens na mesma propriedade do mesmo nó brigam e tremem. */
          const idles: gsap.core.Tween[] = [];
          idles.push(
            gsap.to(q(`.${s.haze}`), {
              opacity: 0.72,
              duration: 7,
              yoyo: true,
              repeat: -1,
              ease: "sine.inOut",
            })
          );
          cardAnchors.forEach((a, i) => {
            idles.push(
              gsap.to(a, {
                y: "+=9",
                duration: 5 + i * 1.3,
                yoyo: true,
                repeat: -1,
                ease: "sine.inOut",
                delay: i * 0.6,
              })
            );
          });
          msgAnchors.slice(0, isMobile ? 2 : msgAnchors.length).forEach((a, i) => {
            idles.push(
              gsap.to(a, {
                y: "+=6",
                duration: 6 + i,
                yoyo: true,
                repeat: -1,
                ease: "sine.inOut",
                delay: i * 0.8,
              })
            );
          });
          idles.push(
            gsap.to(figure, {
              y: "+=3",
              rotate: 0.25,
              duration: 6.5,
              yoyo: true,
              repeat: -1,
              ease: "sine.inOut",
            })
          );
          /* a demonstração passa a existir DENTRO da sala, não colada por cima:
             cada peça ganha uma inclinação e uma profundidade próprias, a
             mesma linguagem dos cards do capítulo 1. Vai por gsap.set porque
             o GSAP já é dono do transform destes nós (a respiração escreve
             `y` neles) — se fosse CSS, o primeiro tween apagaria.
             No mobile fica plano: em tela estreita a perspectiva custa
             legibilidade sem entregar profundidade. */
          if (!isMobile) {
            const PROFUNDIDADE = [
              { el: heroNodes[0], rotateY: -9, rotateX: 1.4, z: -34 },
              { el: heroCore, rotateY: -7, rotateX: 0.8, z: -6 },
              { el: heroNodes[1], rotateY: -9, rotateX: -1.2, z: 22 },
            ];
            PROFUNDIDADE.forEach((p) => {
              if (p.el) gsap.set(p.el, { rotateY: p.rotateY, rotateX: p.rotateX, z: p.z });
            });
          }

          /* a aura respira: o sistema está ligado mesmo com a página parada.
             Entra no mesmo array de repouso, então congela junto no freeze.
             Quem respira é a camada INTERNA — o contêiner fica livre para o
             scroll levá-lo embora sem brigar com este tween. */
          if (heroAuraIn) {
            gsap.set(heroAuraIn, { opacity: 0.74 });
            idles.push(
              gsap.to(heroAuraIn, {
                opacity: 0.95,
                /* no mobile a aura é larga (132vw) e escalá-la obriga a
                   re-rasterizar o gradiente a cada quadro — custava ~1,5fps
                   medidos. Lá ela respira só em opacidade. */
                ...(isMobile ? {} : { scale: 1.06 }),
                duration: 8,
                yoyo: true,
                repeat: -1,
                ease: "sine.inOut",
              })
            );
          }
          /* a demonstração do hero respira sozinha, sem depender do scroll —
             mesmo mecanismo do resto do "movimento de repouso" da cena. */
          [...heroNodes, heroCore].forEach((n, i) => {
            idles.push(
              gsap.to(n, {
                y: "+=4",
                duration: 5.5 + i,
                yoyo: true,
                repeat: -1,
                ease: "sine.inOut",
                delay: i * 0.7,
              })
            );
          });
          /* o pequeno "produto" do hero percorre um ciclo: a mesma cobrança
             muda de estado, como no capítulo 2, com a Zelo como núcleo entre
             os dois polos — criada → autorizada → o valor entra na Zelo → a
             Zelo processa (o núcleo acende) → o valor sai pro profissional
             → pago → o saldo aparece. Quem avança este roteiro é o SCROLL. */
          let heroCycle: gsap.core.Timeline | null = null;
          if (
            heroPulse1 &&
            heroPulse2 &&
            heroStateCriada &&
            heroStateAuth &&
            heroStateProc &&
            heroStatePago
          ) {
            gsap.set([heroStateCriada, heroStateProc, heroSaldoRest], { opacity: 1 });
            gsap.set(heroConduits, { opacity: 0.62 });
            /* PAUSADO, não `repeat: -1`. Era um loop de ~9,3s que rodava à
               revelia do scroll: o visitante rolava e a apresentação não
               respondia. Agora este mesmo roteiro — sem uma linha alterada —
               vira o conteúdo dos beats 0→6, e quem empurra o playhead é a
               timeline mestre. É a menor mudança arquitetural possível: um
               parâmetro aqui e um tween lá embaixo. */
            const cycle = gsap.timeline({ paused: true });
            heroCycle = cycle;
            cycle
              .set([heroPulse1, heroPulse2], { top: "6%", opacity: 0 })
              /* 1 — cliente autoriza */
              .to(heroStateCriada, { opacity: 0, duration: 0.5 }, 1.2)
              .to(heroStateAuth, { opacity: 1, duration: 0.5 }, 1.2)
              /* 2 — a informação percorre até a Zelo */
              .to(heroPulse1, { opacity: 1, duration: 0.3 }, 2.2)
              .to(heroPulse1, { top: "88%", duration: 1.4, ease: "power1.inOut" }, 2.2)
              .to(heroPulse1, { opacity: 0, duration: 0.3 }, 3.3)
              /* 3 — a Zelo processa: o núcleo acende por um instante */
              .to(heroCoreMark, { scale: 1.16, duration: 0.3, ease: "power2.out" }, 3.5)
              .to(heroCoreMark, { scale: 1, duration: 0.5, ease: "power2.out" }, 3.8)
              .to(heroCoreRing, { opacity: 0.9, scale: 1.7, duration: 0.5, ease: "power2.out" }, 3.5)
              .to(heroCoreRing, { opacity: 0, duration: 0.9, ease: "power2.in" }, 3.9)
              /* o campo vaza pro ambiente no mesmo instante — mais lento e
                 mais suave que o anel, para ler como "luz", não "clique" */
              .to(heroCoreField, { opacity: 1, scale: 1.15, duration: 0.7, ease: "power2.out" }, 3.5)
              .to(heroCoreField, { opacity: 0, scale: 1, duration: 1.6, ease: "power2.in" }, 4.3)
              /* a SALA reage junto: a aura funda acende no mesmo instante em
                 que a Zelo processa. É o movimento com mais propósito do
                 hero — a luz do ambiente vem do produto trabalhando. */
              .to(
                heroAuraDeep,
                { opacity: 1, ...(isMobile ? {} : { scale: 1.1 }), duration: 0.9, ease: "power2.out" },
                3.5
              )
              .to(
                heroAuraDeep,
                { opacity: 0, ...(isMobile ? {} : { scale: 1 }), duration: 2.2, ease: "power2.in" },
                4.5
              )
              /* a infraestrutura inteira reage: quando a Zelo processa, os
                 condutos ganham intensidade por um instante e voltam ao
                 repouso. É o "existe algo trabalhando por trás" — sem piscar. */
              .to(heroConduits, { opacity: 1, duration: 0.8, ease: "power2.out" }, 3.5)
              .to(heroConduits, { opacity: 0.62, duration: 2.4, ease: "power2.in" }, 4.6)
              /* as luzes distantes acendem em sequência, não juntas: dá a
                 sensação de que o sinal ATRAVESSA a infraestrutura */
              .to(
                heroSparks,
                { opacity: 0.75, duration: 0.5, stagger: 0.22, ease: "power2.out" },
                3.6
              )
              .to(
                heroSparks,
                { opacity: 0.12, duration: 1.8, stagger: 0.22, ease: "power2.in" },
                4.8
              )
              /* 4 — o valor sai da Zelo em direção ao profissional */
              .to(heroPulse2, { opacity: 1, duration: 0.3 }, 4.0)
              .to(heroPulse2, { top: "88%", duration: 1.4, ease: "power1.inOut" }, 4.0)
              /* 5 — pagamento confirmado */
              .to(heroStateProc, { opacity: 0, duration: 0.4 }, 5.2)
              .to(heroStatePago, { opacity: 1, duration: 0.4 }, 5.2)
              .to(heroPulse2, { opacity: 0, duration: 0.3 }, 5.2)
              .to(heroDot, { scale: 1.35, duration: 0.3, ease: "power2.out" }, 5.2)
              .to(heroDot, { scale: 1, duration: 0.5, ease: "power2.out" }, 5.5)
              .to(heroSaldoRest, { opacity: 0, duration: 0.4 }, 5.2)
              .to(heroSaldoPago, { opacity: 1, duration: 0.4 }, 5.3)
              /* 6 — a cena descansa e volta suavemente ao estado inicial */
              .to(heroSaldoPago, { opacity: 0, duration: 0.4 }, 7.0)
              .to(heroSaldoRest, { opacity: 1, duration: 0.4 }, 7.1)
              .to(heroStatePago, { opacity: 0, duration: 0.5 }, 7.4)
              .to(heroStateProc, { opacity: 1, duration: 0.5 }, 7.4)
              .to(heroStateAuth, { opacity: 0, duration: 0.5 }, 7.4)
              .to(heroStateCriada, { opacity: 1, duration: 0.5 }, 7.4);
          }

          /* ---------- entrada da headline ---------- */
          gsap.from(q("[data-hl]"), {
            yPercent: 112,
            duration: 1.25,
            stagger: 0.11,
            ease: "power3.out",
            delay: 0.15,
          });
          gsap.from([q("[data-hero-brand]"), q(`.${s.kicker}`), q(`.${s.sub}`), q(`.${s.ctaRow}`)], {
            opacity: 0,
            y: 18,
            duration: 1,
            stagger: 0.12,
            ease: "power2.out",
            delay: 0.55,
          });
          gsap.from(heroDemo, {
            opacity: 0,
            x: isMobile ? 0 : 16,
            y: isMobile ? 12 : 0,
            duration: 1.1,
            ease: "power2.out",
            delay: 0.8,
          });

          /* ---------- timeline mestre, dirigida pelo scroll ---------- */
          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: el,
              start: "top top",
              end: `+=${len}`,
              scrub: 1,
              pin: vp,
              anticipatePin: 1,
              onUpdate: (self) => {
                const p = self.progress * 100;
                const frozen = p >= BEAT.freeze && p < BEAT.retreat + 2;
                vp.dataset.frozen = frozen ? "true" : "false";
                idles.forEach((tw) => tw.timeScale(frozen ? 0 : 1));
              },
            },
          });
          tl.to({}, { duration: BEAT.end }, 0);

          if (process.env.NODE_ENV === "development") {
            (window as unknown as { __st?: ScrollTrigger }).__st =
              tl.scrollTrigger as ScrollTrigger;
          }

          /* --- câmera: aproxima no caos, desacelera, recua, muda de eixo --- */
          tl.fromTo(
            camera,
            { z: 0, y: 0, rotateY: 0, rotateX: 0 },
            { z: 40 * d, rotateY: -0.6, duration: BEAT.charge1 },
            0
          )
            .to(
              camera,
              {
                z: 110 * d,
                y: -18 * d,
                rotateX: 1.1,
                duration: BEAT.chaosPeak - BEAT.charge1,
                ease: "power1.in",
              },
              BEAT.charge1
            )
            .to(
              camera,
              { z: 132 * d, duration: BEAT.freeze - BEAT.chaosPeak, ease: "power3.out" },
              BEAT.chaosPeak
            )
            /* o recuo acontece enquanto a cena se esvazia — e termina antes
               do silêncio: nos beats seguintes a câmera não se mexe */
            .to(
              camera,
              {
                z: -70 * d,
                y: 0,
                rotateX: 0,
                duration: 7,
                ease: "power2.inOut",
              },
              BEAT.retreat
            )
            /* durante a frase e o sinal, a câmera só deriva */
            .to(
              camera,
              { z: -110 * d, rotateY: 1.4, duration: BEAT.sistema - BEAT.phrase },
              BEAT.phrase
            )
            /* acompanha a reorganização do caos em estrutura */
            .to(
              camera,
              {
                z: -30 * d,
                rotateY: -1.4,
                duration: BEAT.marca - BEAT.sistema,
                ease: "power1.inOut",
              },
              BEAT.sistema
            )
            /* começa a avançar: vamos entrar no sistema */
            .to(
              camera,
              { z: 70 * d, duration: BEAT.entra - BEAT.marca, ease: "power2.in" },
              BEAT.marca
            )
            .to(
              camera,
              {
                z: 210 * d,
                rotateY: 0,
                duration: BEAT.interfaceOn - BEAT.entra,
                ease: "power2.out",
              },
              BEAT.entra
            )
            /* a partir daqui o ambiente só respira ao fundo da interface */
            .to(
              camera,
              {
                z: 250 * d,
                duration: BEAT.capituloDois - BEAT.interfaceOn,
                ease: "none",
              },
              BEAT.interfaceOn
            );

          /* ---------- a demonstração passa a ser dirigida pelo scroll ----------
             Os beats 0→6 percorrem o roteiro do `heroCycle`. Não é um
             ScrollTrigger novo: é UM tween dentro da timeline mestre que já
             existe, e o alvo dele é o playhead do próprio ciclo.

             Para em 5,9s de um roteiro de ~7,9s de propósito: 5,9 é onde o
             pagamento já foi confirmado e o saldo assentou. O trecho final
             (7,0→7,9) só existia para desfazer tudo e recomeçar o loop —
             agora seria um anticlímax, apagando o resultado bem na hora em
             que o visitante chega ao fim do hero. O hero termina no PAGO.

             Reversível como o resto da cena: rolar para cima desfaz. */
          if (heroCycle) {
            const FIM_DA_DEMO = 5.9 / heroCycle.duration();
            tl.to(
              heroCycle,
              { progress: FIM_DA_DEMO, duration: BEAT.copyOut, ease: "none" },
              0
            );
          }

          /* --- a headline recua em profundidade, não some com fade --- */
          tl.to(
            copy,
            { z: -520, opacity: 0, filter: "blur(7px)", duration: 7, ease: "power2.in" },
            BEAT.copyOut
          );
          /* a demonstração recua junto da headline — a mesma câmera que
             leva a copy embora leva o "produto vivo" do hero junto */
          tl.to(
            heroDemo,
            { z: -420 * d, opacity: 0, filter: "blur(6px)", duration: 7, ease: "power2.in" },
            BEAT.copyOut
          );
          /* a infraestrutura se dissolve e REVELA a sala por baixo — ela é o
             fundo do hero, não dos capítulos. Sai mais rápido que a copy para
             a sala já estar assentada quando a primeira cobrança chega
             (BEAT.charge1), sem alterar nenhum beat. */
          tl.to(heroScape, { opacity: 0, duration: 5, ease: "power2.inOut" }, BEAT.copyOut);
          /* A vignette é dos CAPÍTULOS e continua intacta lá. Só que durante
             o hero ela apagava justamente os cantos onde a arquitetura vive
             — media 3,43 de delta contra 3,31 de toda a infraestrutura nova
             somada. Aqui ela entra fraca e volta ao valor original no
             copyOut; a classe e os capítulos não mudam. */
          gsap.set(vignette, { opacity: 0.22 });
          tl.to(vignette, { opacity: 1, duration: 5, ease: "power2.inOut" }, BEAT.copyOut);
          /* a aura é a luz do produto: quando o produto sai de cena, ela sai
             junto e a sala volta à iluminação calibrada dos capítulos */
          tl.to(heroAura, { opacity: 0, duration: 6, ease: "power2.in" }, BEAT.copyOut);
          /* A silhueta é da SALA, não do hero. O heroScape saía em 5 beats e
             a demonstração em 7: entre o beat 8 e o 13 a sala reaparecia com
             os cards ainda na tela, e a figura ficava exatamente atrás deles,
             disputando a atenção com o que é o protagonista do hero.
             Ela agora entra só depois que a demonstração terminou de sair.
             Nenhum beat, duração ou posição mudou — só a opacidade dela,
             que nunca teve dono em tween nenhum. */
          gsap.set(figure, { opacity: 0 });
          tl.to(
            figure,
            { opacity: 1, duration: 3, ease: "power2.out" },
            BEAT.copyOut + 7
          );
          /* o indicador de rolagem fica visível até o primeiro cliente
             chegar de verdade — sumir em 1,5–4 beats era cedo demais e não
             existia versão mobile (ver Stage.module.css). */
          tl.to(hint, { opacity: 0, duration: 3 }, BEAT.charge1 - 1);

          /* ================= O CAOS =================
             Desktop e mobile contam a mesma história com coreografias
             diferentes: no desktop os elementos se acumulam no espaço; no
             mobile eles atravessam a cena no tempo. */
          if (isMobile) {
            /* ---------- coreografia temporal do mobile ----------
               Cada elemento entra numa faixa vertical própria, ocupa o quadro
               por alguns beats e sai por um caminho diferente do que entrou.
               Nunca há mais de quatro ao mesmo tempo — e esses quatro só
               coexistem no pico da pressão, imediatamente antes do silêncio. */
            type Passagem = {
              el: Element;
              ancora: Element;
              pos: { left: string; top: string };
              escala?: number;
              entra: number;
              dur?: number;
              de: { z: number; x: number; y: number; rotateY: number };
              repouso: { z: number; rotY: number; rotX: number };
              sai?: {
                em: number;
                dur: number;
                z: number;
                x: number;
                y: number;
                scale: number;
                blur: number;
              };
            };

            const CENA: Passagem[] = [
              /* 1. Mariana chega e ocupa a cena sozinha */
              {
                el: cards[0],
                ancora: cardAnchors[0],
                pos: { left: "6%", top: "12%" },
                entra: 8,
                dur: RITMO.mariana,
                de: { z: -820, x: 130, y: 60, rotateY: -10 },
                repouso: { z: -60, rotY: -4, rotX: 1.4 },
                /* 3. sobe e recua: sai por cima, para o fundo */
                sai: { em: 17, dur: 4, z: -660, x: -30, y: -180, scale: 0.82, blur: 8 },
              },
              /* 2. o lembrete que você teria que mandar */
              {
                el: msgs[0],
                ancora: msgAnchors[0],
                pos: { left: "18%", top: "62%" },
                entra: 14,
                dur: RITMO.mensagem,
                de: { z: -560, x: -220, y: 0, rotateY: 10 },
                repouso: { z: -180, rotY: 6, rotX: 1.2 },
                /* passa pela câmera: cresce, desfoca e sai por baixo */
                sai: { em: 22, dur: 3, z: 430, x: 90, y: 50, scale: 1.08, blur: 10 },
              },
              /* 4. João surge no lugar que Mariana desocupou */
              {
                el: cards[1],
                ancora: cardAnchors[1],
                pos: { left: "5%", top: "34%" },
                entra: 18,
                dur: RITMO.joao,
                de: { z: -900, x: -180, y: -50, rotateY: 12 },
                repouso: { z: -120, rotY: 5, rotX: -1.2 },
                /* 6. recua no próprio lugar, engolido pela profundidade */
                sai: { em: 26, dur: 3.5, z: -760, x: -70, y: 0, scale: 0.86, blur: 9 },
              },
              /* 8. a planilha aparece por um momento entre as transições */
              {
                el: sheet,
                ancora: sheetAnchor,
                pos: { left: "8%", top: "8%" },
                escala: 0.74,
                entra: 23,
                dur: RITMO.planilha,
                de: { z: -420, x: 0, y: 210, rotateY: 8 },
                repouso: { z: -140, rotY: 5, rotX: -1.6 },
                /* 9. e some por cima, atravessando o topo do quadro */
                sai: { em: 30, dur: 3.5, z: 170, x: 0, y: -250, scale: 1.06, blur: 8 },
              },
              /* 7. Carlos entra e fica: é ele quem chega ao congelamento */
              {
                el: cards[2],
                ancora: cardAnchors[2],
                pos: { left: "6%", top: "56%" },
                entra: 27.5,
                dur: RITMO.carlos,
                de: { z: -700, x: 110, y: 130, rotateY: -8 },
                repouso: { z: -20, rotY: -3, rotX: 2 },
              },
              /* 10. o pico: mais três coisas chegam por cima de Carlos */
              {
                el: msgs[1],
                ancora: msgAnchors[1],
                pos: { left: "16%", top: "40%" },
                entra: 32,
                dur: RITMO.mensagem,
                de: { z: -520, x: 210, y: 0, rotateY: -9 },
                repouso: { z: -150, rotY: -5, rotX: 1 },
              },
              {
                el: chips[0],
                ancora: chipAnchors[0],
                pos: { left: "30%", top: "26%" },
                entra: 34,
                dur: RITMO.lembrete,
                de: { z: -400, x: -60, y: 0, rotateY: 8 },
                repouso: { z: -110, rotY: 4, rotX: 0 },
              },
              {
                el: chips[1],
                ancora: chipAnchors[1],
                pos: { left: "8%", top: "10%" },
                entra: 35.5,
                dur: RITMO.lembrete,
                de: { z: -400, x: 70, y: 0, rotateY: -8 },
                repouso: { z: -70, rotY: -4, rotX: 0 },
              },
            ];

            /* a coreografia mobile é escrita para um elenco fixo; com um chip
               a menos, a entrada dele simplesmente não existe mais */
            CENA.filter((p) => p.el && p.ancora).forEach((p) => {
              gsap.set(p.ancora, {
                left: p.pos.left,
                top: p.pos.top,
                ...(p.escala ? { scale: p.escala } : {}),
              });
              tl.fromTo(
                p.el,
                {
                  z: p.de.z * d,
                  x: p.de.x * d,
                  y: p.de.y * d,
                  rotateY: p.de.rotateY,
                  scale: 0.84,
                  opacity: 0,
                  filter: "blur(7px)",
                },
                {
                  z: p.repouso.z * d,
                  x: 0,
                  y: 0,
                  rotateY: p.repouso.rotY,
                  rotateX: p.repouso.rotX,
                  scale: 1,
                  opacity: 1,
                  filter: "blur(0px)",
                  duration: p.dur ?? 6,
                  ease: "power2.out",
                },
                p.entra
              );
              if (p.sai) {
                tl.to(
                  p.el,
                  {
                    z: p.sai.z * d,
                    x: p.sai.x * d,
                    y: p.sai.y * d,
                    scale: p.sai.scale,
                    opacity: 0,
                    filter: `blur(${p.sai.blur}px)`,
                    duration: p.sai.dur,
                    ease: "power2.in",
                  },
                  p.sai.em
                );
              }
            });
          } else {
            /* --- as três cobranças, cada uma vinda de uma profundidade --- */
            /* Cada cobrança para numa profundidade e numa inclinação própria:
               plano físico no ambiente, não card colado na tela. O que está mais
               longe perde um pouco de contraste (perspectiva aérea). */
            const CARD_IN = [
              {
                from: { z: -820, x: 150, y: 70, rotateY: -10 },
                to: { z: -120, rotY: -4.5, rotX: 1.4, op: 0.98, blur: 0.4 },
              },
              {
                from: { z: -980, x: -190, y: -60, rotateY: 12 },
                to: { z: -230, rotY: 5.5, rotX: -1.2, op: 0.93, blur: 1.1 },
              },
              {
                from: { z: -700, x: 90, y: 150, rotateY: -6 },
                to: { z: -30, rotY: -2.6, rotX: 2, op: 1, blur: 0 },
              },
            ];
            const cardAt = [BEAT.charge1, BEAT.charge2, BEAT.charge3];
            /* A terceira cobrança entra quase o dobro mais rápido que a
               primeira, e com curva mais seca: é o tempo que carrega a
               pressão, não a quantidade. */
            const cardDur = [RITMO.mariana, RITMO.joao, RITMO.carlos];
            const cardEase = ["power2.out", "power2.out", "power3.out"];
            cards.forEach((card, i) => {
              const cfg = CARD_IN[i];
              tl.fromTo(
                card,
                {
                  z: cfg.from.z * d,
                  x: cfg.from.x * d,
                  y: cfg.from.y * d,
                  rotateY: cfg.from.rotateY,
                  scale: 0.82,
                  opacity: 0,
                  filter: "blur(9px)",
                },
                {
                  z: cfg.to.z * d,
                  x: 0,
                  y: 0,
                  rotateY: cfg.to.rotY,
                  rotateX: cfg.to.rotX,
                  scale: 1,
                  opacity: cfg.to.op,
                  filter: `blur(${isMobile ? 0 : cfg.to.blur}px)`,
                  duration: cardDur[i],
                  ease: cardEase[i],
                },
                cardAt[i]
              );
              /* depois de entrar, continua vindo na direção da câmera */
              tl.to(
                card,
                {
                  z: (cfg.to.z + 70) * d,
                  x: isMobile ? 0 : i === 1 ? 40 : -34,
                  duration: BEAT.freeze - cardAt[i] - cardDur[i],
                  ease: "power1.in",
                },
                cardAt[i] + cardDur[i]
              );
            });

            /* --- mensagens: entram de lado, desfocadas, como parte do ar --- */
            liveMsgs.forEach((m, i) => {
              tl.fromTo(
                m,
                {
                  z: -620 * d,
                  x: (i % 2 === 0 ? -240 : 240) * d,
                  opacity: 0,
                  filter: "blur(7px)",
                  scale: 0.9,
                },
                {
                  z: (-260 + i * 70) * d,
                  x: 0,
                  rotateY: i % 2 === 0 ? 6 : -5,
                  rotateX: 1.2,
                  opacity: isMobile ? 0.96 : 0.9,
                  filter: `blur(${isMobile ? 0 : 1.2}px)`,
                  scale: 1,
                  duration: RITMO.mensagem,
                  ease: "power2.out",
                },
                BEAT.whats + [0, 2, 3.5, 4.75][i]
              );
            });

            /* --- chips de lembrete: densidade, não decoração --- */
            liveChips.forEach((c, i) => {
              tl.fromTo(
                c,
                { z: -420 * d, opacity: 0, scale: 0.86, filter: "blur(5px)" },
                {
                  z: (-120 + i * 90) * d,
                  rotateY: i === 1 ? -4 : 4,
                  opacity: 0.88,
                  scale: 1,
                  filter: "blur(0.6px)",
                  duration: RITMO.lembrete,
                  ease: "power3.out",
                },
                BEAT.whats + 2.5 + [0, 1.5, 2.5][i]
              );
            });

            /* --- a planilha sobe do plano da mesa --- */
            tl.fromTo(
              sheet,
              {
                z: -300 * d,
                y: 300 * d,
                rotateX: 58,
                opacity: 0,
                filter: "blur(6px)",
                transformOrigin: "50% 100%",
              },
              {
                z: -100 * d,
                y: 0,
                rotateX: -1.6,
                rotateY: 5,
                opacity: 0.96,
                filter: "blur(0.5px)",
                duration: RITMO.planilha,
                ease: "power2.out",
              },
              BEAT.sheet
            );
          }

          /* --- congelamento: tudo trava e perde cor --- */
          tl.to(
            layer,
            { filter: "saturate(0.12) contrast(1.06)", duration: 3, ease: "power2.out" },
            BEAT.freeze
          );

          /* --- esvaziamento: a cena se desfaz por profundidade ---
             Não é um efeito aplicado em massa: o que está perto passa pela
             câmera, o que está no meio recua, o que está longe se apaga no
             ambiente. Três caminhos, um só objetivo — esvaziar o quadro. */
          const passaPelaCamera = (alvos: Element[], em: number, escalona = 0.25) =>
            tl.to(
              alvos,
              {
                z: 560 * d,
                scale: 1.18,
                opacity: 0,
                filter: "blur(13px)",
                duration: RITMO.saidaPerto,
                ease: "power2.in",
                stagger: escalona,
              },
              em
            );
          const recua = (alvos: Element[], em: number, escalona = 0.3) =>
            tl.to(
              alvos,
              {
                z: -740 * d,
                scale: 0.86,
                opacity: 0,
                filter: "blur(9px)",
                duration: RITMO.saidaMeio,
                ease: "power2.in",
                stagger: escalona,
              },
              em
            );

          if (isMobile) {
            /* Carlos está na frente de tudo: é ele quem passa pela câmera */
            passaPelaCamera([cards[2]], BEAT.retreat);
            recua([msgs[1], chips[0]].filter(Boolean), BEAT.retreat + 1.5, 0.5);
          } else {
            passaPelaCamera(
              [cards[0], cards[2], msgs[3]].filter(Boolean),
              BEAT.retreat
            );
            recua([cards[1], msgs[2], chips[0], sheet].filter(Boolean), BEAT.retreat + 1.5);
            /* os mais distantes não recuam: apagam no ambiente */
            tl.to(
              [msgs[0], msgs[1]],
              {
                z: -980 * d,
                y: -60 * d,
                scale: 0.8,
                opacity: 0,
                filter: "blur(14px)",
                duration: RITMO.saidaLonge,
                ease: "power1.in",
                stagger: 0.4,
              },
              BEAT.retreat + 3
            );
          }
          tl.to(room, { opacity: 0.16, duration: 6, ease: "power2.inOut" }, BEAT.retreat);

          /* --- a frase, no silêncio --- */
          tl.set(phraseWrap, { opacity: 1 }, BEAT.phrase - 0.01);
          tl.fromTo(
            phraseWords,
            { yPercent: 112 },
            { yPercent: 0, duration: 4, stagger: 0.55, ease: "power3.out" },
            BEAT.phrase
          );
          /* ============================================================
             CAPÍTULO 2 — a pergunta vira sistema
             Nada aqui é uma seção nova: é a mesma cena continuando. A frase
             não sai, ela perde importância; o caos não some, ele se alinha;
             a marca não aparece sobre o fundo, ela nasce da estrutura.
             ============================================================ */

          /* --- a frase recua para o ambiente em vez de sair --- */
          tl.to(
            phraseWrap,
            {
              z: -520 * d,
              scale: 0.84,
              opacity: 0.13,
              duration: RITMO.recuoDaFrase,
              ease: "power2.inOut",
            },
            BEAT.fraseRecua
          );
          tl.to(phraseWrap, { opacity: 0, duration: 5 }, BEAT.sistema + 3);

          /* --- o primeiro sinal verde: um estado ativo no quadro vazio --- */
          tl.fromTo(
            sinal,
            { opacity: 0 },
            { opacity: 1, duration: 3.5, ease: "power2.out" },
            BEAT.sinalVerde
          );
          tl.fromTo(
            sinalLine,
            { scaleX: 0 },
            { scaleX: 1, duration: 4.5, ease: "power3.out" },
            BEAT.sinalVerde + 0.6
          );
          /* o sinal não some antes da estrutura: ele apaga no instante em que
             a primeira cobrança assenta em cima dele e o indicador daquela
             linha acende. Um ponto só, do começo ao fim. */
          tl.to(
            sinal,
            { opacity: 0, duration: 1.2, ease: "power2.in" },
            BEAT.sistema + RITMO.alinhamento - 0.6
          );

          /* --- o caos volta e se alinha: três problemas viram uma estrutura --- */
          const SLOT = ["30%", "50%", "70%"];
          cards.forEach((card, i) => {
            const em = BEAT.sistema + i * 0.8;
            tl.to(
              cardAnchors[i],
              {
                left: "50%",
                top: SLOT[i],
                xPercent: -50,
                yPercent: -50,
                duration: RITMO.alinhamento,
                ease: "power3.out",
              },
              em
            );
            tl.to(
              card,
              {
                z: -80 * d,
                x: 0,
                y: 0,
                rotateY: 0,
                rotateX: 0,
                scale: 0.9,
                filter: "blur(0px)",
                duration: RITMO.alinhamento,
                ease: "power3.out",
              },
              em
            );
            /* a linha só se torna visível depois de já estar em movimento —
               assim o sinal verde permanece sozinho enquanto ela se aproxima */
            tl.to(card, { opacity: 1, duration: 4, ease: "power2.out" }, em + 1.5);
            /* o indicador acende no instante em que a linha assenta */
            tl.to(dots[i], { opacity: 1, duration: 1.2 }, em + RITMO.alinhamento - 0.6);
          });
          tl.to(room, { opacity: 0.26, duration: 8 }, BEAT.sistema);
          /* a cor volta junto com a organização: a dessaturação do
             congelamento seguia aplicada na camada e apagava até o verde */
          tl.to(
            layer,
            { filter: "saturate(1) contrast(1)", duration: 8, ease: "power2.inOut" },
            BEAT.sistema
          );

          /* --- a marca nasce de dentro da estrutura --- */
          /* a estrutura recua ANTES do nome chegar: quando COBRA CERTO
             assenta, ela já é fundo — senão os dois disputam a leitura */
          tl.to(
            cards,
            {
              z: -520 * d,
              opacity: 0.12,
              filter: "blur(4px)",
              duration: 8,
              ease: "power2.inOut",
            },
            BEAT.marca - 3
          );
          tl.to(dots, { opacity: 0.2, duration: 6 }, BEAT.marca - 3);
          tl.set(brand, { opacity: 1 }, BEAT.marca - 0.01);
          tl.fromTo(
            brandMark,
            { scale: 0.5, opacity: 0, z: -280 * d },
            { scale: 1, opacity: 1, z: 0, duration: RITMO.marcaEntra, ease: "power3.out" },
            BEAT.marca
          );
          tl.fromTo(
            brandName,
            { letterSpacing: "0.4em", opacity: 0, y: 14 },
            {
              letterSpacing: "0.02em",
              opacity: 1,
              y: 0,
              duration: RITMO.marcaEntra + 1.5,
              ease: "power3.out",
            },
            BEAT.marca + 1
          );
          tl.fromTo(
            brandLine,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 4, ease: "power2.out" },
            BEAT.marca + 3
          );
          tl.to(greenLight, { opacity: 0.42, duration: 7 }, BEAT.marca);

          /* --- a câmera atravessa a marca e entra na interface --- */
          /* o movimento acelera em direção à câmera (power2.in), mas a
             legibilidade cai de forma linear: é isso que faz a marca demorar
             oito beats atravessando, em vez de sumir de uma vez no fim */
          tl.to(
            [brandMark, brandName, brandLine],
            {
              z: 460 * d,
              scale: 1.28,
              filter: "blur(10px)",
              duration: RITMO.travessia,
              stagger: 0.5,
              ease: "power2.in",
            },
            BEAT.entra
          );
          tl.to(
            [brandMark, brandName, brandLine],
            { opacity: 0, duration: RITMO.travessia - 1, stagger: 0.5, ease: "none" },
            BEAT.entra
          );
          tl.set(brand, { opacity: 0 }, BEAT.entra + RITMO.travessia + 2);
          tl.to(
            cards,
            { z: -760 * d, opacity: 0, duration: 6, ease: "power2.in" },
            BEAT.entra
          );
          tl.to(dots, { opacity: 0, duration: 3 }, BEAT.entra);

          /* A travessia em duas fases. Fase 1: a interface já existe, muito
             pequena e muito ao fundo, atrás da marca que começou a avançar —
             ela não ganha opacidade enquanto o nome ainda está legível. */
          tl.fromTo(
            composer,
            {
              xPercent: -50,
              yPercent: -50,
              z: -1150 * d,
              scale: 0.88,
              rotateX: 9,
              opacity: 0,
            },
            {
              xPercent: -50,
              yPercent: -50,
              opacity: 0.14,
              duration: 5,
              ease: "none",
            },
            BEAT.entra + 1
          );
          /* Fase 2: a marca já passou pela câmera. A interface permanece no
             mesmo ponto do espaço e cresce — entramos nela. */
          tl.to(
            composer,
            {
              z: 0,
              scale: 1,
              rotateX: 0,
              opacity: 1,
              duration: BEAT.interfaceOn - (BEAT.entra + 6),
              ease: "power2.out",
            },
            BEAT.entra + 6
          );
          /* a aproximação não para mais: a interface vai ocupando o campo */
          tl.to(
            composer,
            { z: 80 * d, duration: BEAT.ativa - BEAT.interfaceOn, ease: "none" },
            BEAT.interfaceOn
          );
          tl.to(
            composer,
            {
              z: 118 * d,
              duration: BEAT.capituloDois - BEAT.ativa,
              ease: "power2.out",
            },
            BEAT.ativa
          );

          /* --- estado 1: criar cobrança --- */
          tl.to(painelAcao, { opacity: 1, duration: 2.5 }, BEAT.entra + 5);
          tl.to(
            btnFill,
            { scaleX: 1, duration: RITMO.troca, ease: "power2.inOut" },
            BEAT.criar
          );
          tl.to(btnLabel, { opacity: 0, y: -12, duration: 1.6 }, BEAT.criando);
          tl.fromTo(
            btnLoading,
            { opacity: 0, y: 12 },
            { opacity: 1, y: 0, duration: 1.6, ease: "power2.out" },
            BEAT.criando + 0.7
          );
          tl.to(btnLoading, { opacity: 0, y: -12, duration: 1.6 }, BEAT.criada);
          tl.fromTo(
            btnDone,
            { opacity: 0, y: 12 },
            { opacity: 1, y: 0, duration: 1.8, ease: "power2.out" },
            BEAT.criada + 0.7
          );

          /* --- estado 2: a autorização do cliente --- */
          tl.to(
            painelAcao,
            { opacity: 0, y: -18, duration: RITMO.saidaEstado, ease: "power2.in" },
            BEAT.autorizacao - RITMO.saidaEstado
          );
          tl.fromTo(
            painelAuth,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: RITMO.entradaEstado, ease: "power2.out" },
            BEAT.autorizacao - RITMO.saidaEstado + 0.8
          );
          tl.to(authPend, { opacity: 0, y: -10, duration: 1.6 }, BEAT.autorizado);
          tl.fromTo(
            authOk,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 1.8, ease: "power2.out" },
            BEAT.autorizado + 0.7
          );
          /* a caixa inteira muda de estado: era neutra, fica verde. Sem isso,
             "autorizado" seria apenas uma palavra trocando de lugar. */
          tl.to(
            authBox,
            {
              borderColor: "rgba(22, 128, 92, 0.34)",
              backgroundColor: "#e7f3ee",
              duration: 3,
              ease: "power2.out",
            },
            BEAT.autorizado
          );
          tl.to(greenLight, { opacity: 0.6, duration: 6 }, BEAT.autorizado);

          /* --- estado 3: a cobrança viva --- */
          tl.to(
            painelAuth,
            { opacity: 0, y: -18, duration: RITMO.saidaEstado, ease: "power2.in" },
            BEAT.ativa - RITMO.saidaEstado
          );
          tl.fromTo(
            painelAtiva,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: RITMO.entradaEstado, ease: "power2.out" },
            BEAT.ativa - RITMO.saidaEstado + 0.8
          );
          tl.to(tituloA, { opacity: 0, y: -10, duration: 1.6 }, BEAT.ativa);
          tl.fromTo(
            tituloB,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 1.8, ease: "power2.out" },
            BEAT.ativa + 0.7
          );
          tl.fromTo(
            badge,
            { opacity: 0, y: 8, scale: 0.9 },
            { opacity: 1, y: 0, scale: 1, duration: 2.6, ease: "back.out(2)" },
            BEAT.ativa + 1.6
          );
          tl.to(greenLight, { opacity: 0.78, duration: 6 }, BEAT.ativa);


          /* ============================================================
             CAPÍTULO 3 — o dinheiro
             A interface não é o produto: ela é o começo. Aqui a câmera faz o
             movimento inverso do capítulo 2 — recua e revela que a sala, a
             mesa e o profissional sempre estiveram lá. O profissional não faz
             absolutamente nada do início ao fim: é essa ausência de ação que
             carrega a mensagem.
             ============================================================ */

          const vw = window.innerWidth;
          const vh = window.innerHeight;

          /* Os dois polos. No desktop o dinheiro atravessa na horizontal; no
             mobile ele cai. Em ambos o destino é a mesa onde o profissional
             está sentado desde o primeiro beat da página. */
          const CLIENTE = isMobile
            ? { left: 50, top: 30 }
            : { left: 22, top: 46 };
          const VOCE = isMobile ? { left: 50, top: 70 } : { left: 78, top: 74 };
          const ROTULO_CLIENTE = isMobile
            ? { left: 50, top: 4 }
            : { left: 22, top: 17 };
          const ROTULO_VOCE = isMobile
            ? { left: 50, top: 60 }
            : { left: 78, top: 62 };
          const ESCALA_CARD = isMobile ? 0.68 : 0.6;

          /* deslocamentos em pixels: animar transform em vez de left/top
             evita recalcular layout a cada quadro da viagem */
          const paraCard = {
            x: ((CLIENTE.left - 50) / 100) * vw,
            y: ((CLIENTE.top - 50) / 100) * vh,
          };
          const viagem = {
            x: ((VOCE.left - CLIENTE.left) / 100) * vw,
            y: ((VOCE.top - CLIENTE.top) / 100) * vh,
          };

          gsap.set(poloCliente, {
            left: `${ROTULO_CLIENTE.left}%`,
            top: `${ROTULO_CLIENTE.top}%`,
            xPercent: -50,
          });
          gsap.set(poloVoce, {
            left: `${ROTULO_VOCE.left}%`,
            top: `${ROTULO_VOCE.top}%`,
            xPercent: -50,
          });
          gsap.set(saldo, {
            left: `${VOCE.left}%`,
            top: `${VOCE.top}%`,
            xPercent: -50,
          });
          gsap.set(valor, {
            left: `${CLIENTE.left}%`,
            top: `${CLIENTE.top}%`,
            xPercent: -50,
            yPercent: -50,
          });

          /* a rolagem de datas: mover uma faixa de N itens em passos de 100/N */
          const passoData = 100 / DATAS.length;
          const passoPago = 100 / PAGO_EM.length;
          const moeda = (n: number) =>
            "R$ " +
            n.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
          /* O saldo é função pura do beat: nenhum tween escreve no DOM.
             Assim ele nunca fica preso num valor de um ciclo futuro quando o
             usuário rola para cima. */
          const contagens: { de: number; ate: number; a: number; b: number }[] =
            [];
          const saldoNoBeat = (beat: number) => {
            let v = SALDO[0];
            for (const c of contagens) {
              if (beat >= c.ate) v = c.b;
              else if (beat > c.de) {
                const p = (beat - c.de) / (c.ate - c.de);
                v = c.a + (c.b - c.a) * (1 - Math.pow(1 - p, 2));
              }
            }
            return v;
          };
          tl.eventCallback("onUpdate", () => {
            (saldoValor as HTMLElement).textContent = moeda(saldoNoBeat(tl.time()));
          });

          /* --- abertura: a câmera recua e o espaço volta a existir --- */
          tl.to(
            camera,
            { z: 60 * d, duration: 12, ease: "power2.out" },
            BEAT.abertura
          );
          tl.to(
            room,
            { opacity: 0.6, duration: 12, ease: "power2.out" },
            BEAT.abertura
          );
          tl.to(greenLight, { opacity: 0.5, duration: 10 }, BEAT.abertura);
          /* a interface do capítulo 2 é o mesmo objeto: ela encolhe e assume
             o polo do cliente. Nada aparece, nada corta. */
          tl.to(
            composer,
            {
              x: paraCard.x,
              y: paraCard.y,
              scale: ESCALA_CARD,
              z: 0,
              duration: 8,
              ease: "power2.inOut",
            },
            BEAT.abertura
          );
          tl.fromTo(
            [poloCliente, poloVoce],
            { opacity: 0, y: 12 },
            { opacity: 1, y: 0, duration: 3, stagger: 0.6, ease: "power2.out" },
            BEAT.abertura + 6
          );

          /* --- o dia chega: o gatilho é o calendário, não uma pessoa --- */
          tl.to(
            datas,
            { yPercent: -passoData, duration: 2.5, ease: "power3.inOut" },
            BEAT.diaChega
          );

          /* --- o Pix Automático debita: o valor se desprende do card --- */
          tl.fromTo(
            valor,
            { opacity: 0, scale: 0.82, z: -80 * d, y: 0 },
            {
              opacity: 1,
              scale: 1,
              z: 0,
              y: -14,
              duration: 4.5,
              ease: "power3.out",
            },
            BEAT.debito
          );

          /* --- trânsito: o próprio valor é a conexão entre os dois lados --- */
          tl.to(
            valor,
            {
              x: viagem.x,
              y: viagem.y,
              duration: RITMO.viagem1,
              ease: "power1.inOut",
            },
            BEAT.transito
          );
          /* no meio do caminho ele passa perto da câmera e fica maior */
          tl.to(
            valor,
            { z: 190 * d, duration: RITMO.viagem1 / 2, ease: "power2.out" },
            BEAT.transito
          );
          tl.to(
            valor,
            { z: -40 * d, duration: RITMO.viagem1 / 2, ease: "power2.in" },
            BEAT.transito + RITMO.viagem1 / 2
          );
          /* a câmera acompanha lateralmente: a sala deriva para o lado oposto */
          tl.to(
            camera,
            {
              x: isMobile ? 0 : -46 * d,
              y: isMobile ? -26 * d : 0,
              duration: RITMO.viagem1,
              ease: "power1.inOut",
            },
            BEAT.transito
          );

          /* --- confirmação: o dinheiro vira comprovante --- */
          tl.to(
            valorCorpo,
            { opacity: 0, y: -8, duration: 2, ease: "power2.in" },
            BEAT.confirmado
          );
          tl.fromTo(
            valorPago,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 2.4, ease: "power2.out" },
            BEAT.confirmado + 0.8
          );

          /* --- recebimento: a câmera para junto com o dinheiro --- */
          tl.fromTo(
            saldo,
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 3, ease: "power2.out" },
            BEAT.recebimento
          );
          contagens.push({
            de: BEAT.recebimento + 1,
            ate: BEAT.recebimento + 1 + RITMO.contagem,
            a: SALDO[0],
            b: SALDO[1],
          });
          tl.to(
            valor,
            { opacity: 0, scale: 0.92, duration: 3, ease: "power2.in" },
            BEAT.recebimento + 1.5
          );

          /* --- a próxima cobrança já está preparada --- */
          tl.to(
            datas,
            { yPercent: -passoData * 2, duration: 2.5, ease: "power3.inOut" },
            BEAT.proxima
          );

          /* --- a recorrência: a mesma volta, cada vez mais curta ---
             Nenhum texto explica que isso se repete. O movimento prova. */
          /* Cada volta é a mesma volta, mais curta.
             Nada aqui usa fromTo: um fromTo de um ciclo futuro se impõe
             quando a timeline é posicionada ANTES dele, e apagava o valor
             durante a primeira viagem. Tweens `.to` encadeados resolvem na
             ordem certa nos dois sentidos do scroll. */
          const ciclo = (
            inicio: number,
            duracao: number,
            indice: number,
            dataFinal: number
          ) => {
            /* recomeço: o token volta ao ponto de origem já invisível */
            tl.to(valor, { opacity: 0, duration: 0.6, ease: "none" }, inicio - 1.4);
            tl.to(
              valor,
              { x: 0, y: -14, z: 0, scale: 0.86, duration: 0.01 },
              inicio - 0.6
            );
            tl.to(valorPago, { opacity: 0, duration: 0.01 }, inicio - 0.6);
            tl.to(valorCorpo, { opacity: 1, duration: 0.01 }, inicio - 0.6);
            tl.to(
              pagoDatas,
              { yPercent: -passoPago * (indice - 1), duration: 0.5, ease: "none" },
              inicio - 0.5
            );

            tl.to(
              valor,
              { opacity: 1, scale: 1, duration: 1.6, ease: "power3.out" },
              inicio
            );
            tl.to(
              valor,
              {
                x: viagem.x,
                y: viagem.y,
                duration: duracao,
                ease: "power1.inOut",
              },
              inicio + 1.6
            );
            tl.to(
              valor,
              { z: 90 * d, duration: duracao / 2, ease: "power2.out" },
              inicio + 1.6
            );
            tl.to(
              valor,
              { z: -30 * d, duration: duracao / 2, ease: "power2.in" },
              inicio + 1.6 + duracao / 2
            );

            const chegada = inicio + 1.6 + duracao;
            tl.to(valorCorpo, { opacity: 0, duration: 1, ease: "power2.in" }, chegada);
            tl.to(
              valorPago,
              { opacity: 1, y: 0, duration: 1.2, ease: "power2.out" },
              chegada + 0.4
            );
            contagens.push({
              de: chegada + 0.6,
              ate: chegada + 4,
              a: SALDO[indice - 1],
              b: SALDO[indice],
            });
            tl.to(
              valor,
              { opacity: 0, scale: 0.92, duration: 1.6, ease: "power2.in" },
              chegada + 1.4
            );
            tl.to(
              datas,
              { yPercent: -passoData * dataFinal, duration: 2, ease: "power3.inOut" },
              chegada + 1.2
            );
          };

          ciclo(BEAT.ciclo2, RITMO.viagem2, 2, 3);
          ciclo(BEAT.ciclo3, RITMO.viagem3, 3, 4);

          /* quanto mais o sistema funciona, menos espaço ele ocupa */
          tl.to(
            camera,
            { z: 10 * d, x: 0, y: 0, duration: 16, ease: "power1.inOut" },
            BEAT.ciclo2
          );

          /* --- assentamento: nada explode, tudo desacelera --- */
          tl.to(
            composer,
            { scale: ESCALA_CARD * 0.88, duration: 6, ease: "power2.out" },
            BEAT.assenta
          );
          tl.to(
            [poloCliente, poloVoce, saldo],
            { scale: 0.9, duration: 6, ease: "power2.out" },
            BEAT.assenta
          );
          tl.to(
            camera,
            {
              z: -70 * d,
              duration: BEAT.capituloTres - BEAT.assenta,
              ease: "power2.out",
            },
            BEAT.assenta
          );
          tl.to(
            room,
            { opacity: 0.74, duration: BEAT.capituloTres - BEAT.assenta },
            BEAT.assenta
          );
          tl.to(greenLight, { opacity: 0.4, duration: 6 }, BEAT.assenta);


          /* ============================================================
             CAPÍTULO 4 — a atenção
             A câmera vai até o profissional pela primeira vez desde o beat 0.
             Ele cresce e continua sem fazer nada. O sistema não desliga: ele
             sai de foco e continua rodando. É a profundidade de campo que diz
             "isso saiu da sua atenção" — nenhum texto precisa dizer.
             ============================================================ */

          /* Compensação medida: a coluna vive dentro da câmera, e o avanço
             dela desloca a camada 28% para cima no desktop e 12% no mobile. */
          const COLUNA = isMobile
            ? { left: 50, tops: [50, 63, 76] }
            : { left: 20, tops: [59, 75, 91] };
          const SISTEMA_TOPO = 12;

          /* --- a câmera avança e ele cresce --- */
          tl.to(
            camera,
            {
              /* o mobile roda com metade da profundidade (d = 0.5), então o
                 mesmo z faria o profissional crescer só 20%. O avanço dele é
                 compensado para que o crescimento seja equivalente. */
              z: (isMobile ? 760 : 420) * d,
              y: (isMobile ? -320 : -190) * d,
              x: (isMobile ? 0 : 90) * d,
              duration: RITMO.aproximacao,
              ease: "power2.inOut",
            },
            BEAT.atencao
          );
          tl.to(
            room,
            { opacity: 0.88, duration: RITMO.aproximacao, ease: "power2.out" },
            BEAT.atencao
          );

          /* --- o sistema perde o foco, sem perder a vida --- */
          tl.to(
            [poloCliente, poloVoce],
            { opacity: 0, y: -14, duration: 4, ease: "power2.in" },
            BEAT.atencao
          );
          tl.to(
            composer,
            isMobile
              ? {
                  opacity: 0,
                  scale: ESCALA_CARD * 0.7,
                  duration: RITMO.aproximacao,
                  ease: "power2.inOut",
                }
              : {
                  x: ((COLUNA.left - 50) / 100) * vw,
                  y: ((SISTEMA_TOPO - 50) / 100) * vh,
                  scale: ESCALA_CARD * 0.58,
                  opacity: 0.42,
                  filter: "blur(3.5px)",
                  duration: RITMO.aproximacao,
                  ease: "power2.inOut",
                },
            BEAT.atencao
          );
          /* no mobile o saldo sobe para o topo: é ele que fica no lugar do
             sistema, contando desfocado enquanto as cobranças ocupam o meio */
          tl.to(
            saldo,
            {
              /* no desktop ele sobe e vai para a direita, saindo de cima da
                 tampa do notebook; no mobile sobe para o topo da tela */
              x: isMobile ? 0 : 0.1 * vw,
              y: isMobile ? -0.59 * vh : -0.09 * vh,
              scale: 0.62,
              opacity: 0.5,
              filter: "blur(3px)",
              duration: RITMO.aproximacao - 3,
              ease: "power2.inOut",
            },
            BEAT.atencao + 3
          );

          /* --- os mesmos três clientes do caos voltam, agora em ordem --- */
          cards.forEach((card, i) => {
            const em = BEAT.clientesVoltam + i * 0.9;
            tl.to(
              cardAnchors[i],
              {
                left: `${COLUNA.left}%`,
                top: `${COLUNA.tops[i]}%`,
                xPercent: -50,
                yPercent: -50,
                scale: 1,
                duration: RITMO.retornoCards,
                ease: "power3.out",
              },
              em
            );
            tl.to(
              card,
              {
                z: -520 * d,
                x: 0,
                y: 0,
                rotateY: 0,
                rotateX: 0,
                scale: 0.5,
                opacity: 1,
                filter: "blur(0px)",
                duration: RITMO.retornoCards,
                ease: "power3.out",
              },
              em
            );
          });

          /* --- e agora estão pagos: o estado antigo sai, o novo entra --- */
          tl.to(
            statusAntigos,
            { opacity: 0, duration: 1.8, stagger: 0.7, ease: "power2.in" },
            BEAT.pagos
          );
          tl.to(
            acoesCobrar,
            { opacity: 0, duration: 1.8, stagger: 0.7, ease: "power2.in" },
            BEAT.pagos
          );
          tl.to(
            pagos,
            { opacity: 1, duration: 2, stagger: 0.7, ease: "power2.out" },
            BEAT.pagos + 1
          );
          tl.to(
            dots,
            { opacity: 1, duration: 2, stagger: 0.7, ease: "power2.out" },
            BEAT.pagos
          );

          /* --- a rotina continua acontecendo fora de foco --- */
          tl.to(
            cards,
            {
              filter: "blur(3px)",
              opacity: 0.46,
              duration: RITMO.foraDeFoco,
              ease: "power2.inOut",
            },
            BEAT.rotina
          );
          /* o saldo segue subindo e as datas seguem rolando: desfocado, vivo */
          contagens.push({
            de: BEAT.rotina,
            ate: BEAT.rotina + 5,
            a: SALDO[3],
            b: SALDO[4],
          });
          contagens.push({
            de: BEAT.rotina + 5.5,
            ate: BEAT.rotina + 10,
            a: SALDO[4],
            b: SALDO[5],
          });
          tl.to(
            datas,
            { yPercent: -passoData * 5, duration: 2, ease: "power3.inOut" },
            BEAT.rotina + 1
          );
          tl.to(
            datas,
            { yPercent: -passoData * 6, duration: 2, ease: "power3.inOut" },
            BEAT.rotina + 6.5
          );

          /* --- a assinatura nasce da cena, baixa, ao lado dele --- */
          tl.to(brand, { opacity: 1, duration: 0.01 }, BEAT.assinatura - 0.02);
          tl.to(
            brandIn,
            {
              x: (isMobile ? 0 : -290) * d,
              y: (isMobile ? 610 : 215) * d,
              duration: 0.01,
            },
            BEAT.assinatura - 0.02
          );
          /* No mobile a assinatura com 0.26em de entreletras passa de 390px e
             corta nas duas bordas. O ajuste vale só a partir deste beat: o
             capítulo 2 continua renderizando exatamente como foi aprovado. */
          tl.fromTo(
            brandLine,
            {
              opacity: 0,
              y: 14,
              filter: "blur(6px)",
              ...(isMobile ? { letterSpacing: "0.26em", fontSize: "0.78rem" } : {}),
            },
            {
              opacity: 0.85,
              y: 0,
              filter: "blur(0px)",
              ...(isMobile ? { letterSpacing: "0.09em", fontSize: "0.72rem" } : {}),
              duration: 5,
              ease: "power2.out",
            },
            BEAT.assinatura
          );

          /* ============================================================
             CAPÍTULO 5 — a decisão
             A marca não entra: ela se remonta em volta da assinatura que já
             estava na cena. O botão é o mesmo objeto do capítulo 2.
             ============================================================ */

          /* --- a assinatura sobe e a marca se remonta em volta dela --- */
          tl.to(
            brandIn,
            {
              x: 0,
              y: -70 * d,
              duration: RITMO.subidaMarca,
              ease: "power2.inOut",
            },
            BEAT.marcaFinal
          );
          tl.to(
            brandLine,
            { opacity: 1, duration: 4, ease: "power2.out" },
            BEAT.marcaFinal
          );
          tl.to(
            brandMark,
            {
              opacity: 1,
              scale: 1,
              z: 0,
              y: 0,
              filter: "blur(0px)",
              duration: 5,
              ease: "power3.out",
            },
            BEAT.marcaFinal + 1
          );
          tl.to(
            brandName,
            {
              opacity: 1,
              scale: 1,
              z: 0,
              y: 0,
              filter: "blur(0px)",
              duration: 5,
              ease: "power3.out",
            },
            BEAT.marcaFinal + 1.8
          );

          /* --- o botão que ele viu funcionar volta como ação --- */
          tl.fromTo(
            cta,
            { opacity: 0, y: 18 },
            { opacity: 1, y: 0, duration: RITMO.entradaCta, ease: "power2.out" },
            BEAT.cta
          );
          /* só clicável quando existe de fato */
          tl.to(cta, { pointerEvents: "auto", duration: 0.01 }, BEAT.cta + 3);
          tl.fromTo(
            publico,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 4, ease: "power2.out" },
            BEAT.cta + 3
          );

          /* No mobile o contraluz da janela não alcança o profissional nesta
             posição de câmera: ela termina em y 70% e ele começa em 72%. Sem
             luz atrás, ele vira uma forma preta sobre a mesa preta. A correção
             não acrescenta luz nenhuma — intensifica gradualmente o mesmo
             contraluz que a silhueta já carrega, do beat da assinatura até o
             fim. Posição, escala, câmera e movimento seguem intactos. */
          if (isMobile) {
            tl.to(
              figure,
              {
                filter:
                  "drop-shadow(-18px -10px 26px rgba(255, 250, 240, 0.3)) drop-shadow(14px -8px 30px rgba(255, 250, 240, 0.16))",
                duration: BEAT.end - BEAT.assinatura,
                ease: "power1.inOut",
              },
              BEAT.assinatura
            );
          }

          /* No mobile a tampa do notebook cobre a cabeça do profissional
             nesta altura de quadro — e nenhuma posição de câmera resolve,
             porque os dois escalam juntos. A tampa perde opacidade no fecho:
             continua sendo volume sobre a mesa, mas para de bloquear a
             silhueta. Posição, tamanho e perspectiva dela seguem intactos. */
          if (isMobile) {
            tl.to(
              laptop,
              {
                opacity: 0.35,
                duration: BEAT.end - BEAT.silencio,
                /* sine.out bate a curva pedida (~0,62 / ~0,42 / 0,35) sem o
                   tombo inicial que a power2.out produzia */
                ease: "sine.out",
              },
              BEAT.silencio
            );
          }

          /* --- silêncio: ficam a marca, o botão e ele --- */
          tl.to(
            [composer, saldo, ...cards, poloCliente, poloVoce],
            { opacity: 0, duration: RITMO.apagar, ease: "power2.inOut" },
            isMobile ? BEAT.marcaFinal : BEAT.silencio
          );
          tl.to(
            camera,
            {
              /* No mobile o recuo final ia até z ~90 e empurrava o profissional
                 para a faixa mais escura do quadro, onde a tampa do notebook
                 cobria a cabeça dele. O movimento é o mesmo — só menos
                 agressivo. Desktop inalterado. */
              z: (isMobile ? 400 : 180) * d,
              y: -110 * d,
              duration: RITMO.apagar,
              ease: "power2.out",
            },
            BEAT.silencio
          );
          tl.to(
            room,
            {
              opacity: isMobile ? 0.72 : 0.6,
              duration: RITMO.apagar,
              ease: "power2.out",
            },
            BEAT.silencio
          );
          tl.to(
            greenLight,
            { opacity: 0.3, duration: RITMO.apagar, ease: "power2.out" },
            BEAT.silencio
          );


          /* ---------- parallax de mouse: sutil, em três profundidades ---------- */
          const fine = window.matchMedia("(pointer: fine)").matches;
          let onMove: ((e: MouseEvent) => void) | null = null;
          if (fine && !isMobile) {
            const rigX = gsap.quickTo(rig, "x", { duration: 0.9, ease: "power3" });
            const rigY = gsap.quickTo(rig, "y", { duration: 0.9, ease: "power3" });
            const rotY = gsap.quickTo(rig, "rotateY", { duration: 1.1, ease: "power3" });
            const layX = gsap.quickTo(layer, "x", { duration: 0.7, ease: "power3" });
            const layY = gsap.quickTo(layer, "y", { duration: 0.7, ease: "power3" });
            onMove = (e: MouseEvent) => {
              const nx = e.clientX / window.innerWidth - 0.5;
              const ny = e.clientY / window.innerHeight - 0.5;
              rigX(nx * -14);
              rigY(ny * -8);
              rotY(nx * 1.6);
              layX(nx * -26);
              layY(ny * -14);
            };
            window.addEventListener("mousemove", onMove, { passive: true });
          }

          return () => {
            if (onMove) window.removeEventListener("mousemove", onMove);
            idles.forEach((tw) => tw.kill());
          };
        }
      );

      /* fontes mudam a métrica do texto — o pin precisa ser recalculado */
      if (document.fonts?.ready) {
        document.fonts.ready.then(() => ScrollTrigger.refresh());
      }
    }, root);

    return () => ctx.revert();
  }, [reduced]);

  if (reduced === null) {
    /* evita renderizar a cena antes de saber a preferência de movimento */
    return <div style={{ height: "100vh" }} aria-hidden="true" />;
  }

  if (reduced) return <StaticStory />;

  return (
    <div className={s.scene} ref={root}>
      <div className={s.viewport} ref={viewport} data-frozen="false">
        {/* ---------------- ambiente ---------------- */}
        <div className={s.camera}>
          <div className={s.rig}>
            <div className={s.room}>
              <div className={s.wall} />
              <div className={s.window}>
                <span className={s.mullionV} style={{ left: "42%" }} />
                <span className={s.mullionH} style={{ top: "46%" }} />
              </div>
              <div className={s.bloom} />
              <div className={s.haze} />
              <div className={s.desk}>
                <div className={s.deskEdge} />
              </div>
              <div className={s.figureShadow} />
              <div className={s.figure}>
                <svg viewBox="0 0 460 360" aria-hidden="true">
                  <defs>
                    <linearGradient id="rim" x1="0.88" y1="0.04" x2="0.56" y2="0.52">
                      <stop offset="0%" stopColor="rgba(255,251,240,.92)" />
                      <stop offset="10%" stopColor="rgba(255,251,240,.3)" />
                      <stop offset="26%" stopColor="rgba(255,251,240,0)" />
                    </linearGradient>
                    <g id="pessoa">
                      <ellipse cx="234" cy="108" rx="45" ry="51" />
                      <path d="M110 360c4-92 40-146 88-170l4-24h64l4 26c48 24 84 76 88 168z" />
                    </g>
                  </defs>
                  {/* o contraluz é a mesma forma deslocada na direção da
                      janela: a luz contornando cabeça e ombro */}
                  <g transform="translate(4,-3)" fill="url(#rim)" opacity="0.85">
                    <use href="#pessoa" />
                  </g>
                  <g data-silhueta fill="#030504">
                    <use href="#pessoa" />
                  </g>
                  {/* braço indo para a mesa */}
                  <path d="M138 360c10-56 36-92 76-108l12 108z" fill="#010302" />
                </svg>
              </div>
              <div className={s.screenGlow} />
              <div className={s.laptop} />
              <div className={s.nearField} />
              <div className={s.dust}>
                {MOTES.map((m, i) => (
                  <span
                    key={i}
                    className={s.mote}
                    style={{
                      left: m.left,
                      top: m.top,
                      animationDuration: `${m.dur}s`,
                      animationDelay: `${m.delay}s`,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* ---------------- o caos ---------------- */}
            <div className={s.layer}>
              {CHARGES.map((c, i) => (
                <div
                  key={c.id}
                  data-anchor-card
                  className={s.anchor}
                  style={CARD_POS[i]}
                  aria-hidden="true"
                >
                <article data-card className={s.card}>
                  <span data-dot className={s.rowDot} />
                  <div className={s.cardTop}>
                    <div className={s.cardWho}>
                      <span className={s.cardAv}>
                        {c.nome
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                      <div>
                        <div className={s.cardName}>{c.nome}</div>
                        <div className={s.cardPlan}>{c.plano}</div>
                      </div>
                    </div>
                    <Bell className={s.cardBell} />
                  </div>
                  <div className={s.cardMoney}>
                    <span className={`${s.cardValue} tnum`}>{c.valor}</span>
                    <span className={s.cardPeriod}>{c.periodo}</span>
                  </div>
                  <div className={s.cardFoot}>
                    <span className={`${s.status} ${s[c.tone]}`}>{c.status}</span>
                    <span className={s.cardAct}>cobrar</span>
                    {/* capítulo 4: o mesmo cliente, agora resolvido */}
                    <span data-pago className={s.statusPago}>
                      <Check stroke="currentColor" /> Pago
                    </span>
                  </div>
                </article>
                </div>
              ))}

              {MESSAGES.map((m, i) => (
                <div
                  key={i}
                  data-anchor-msg
                  className={s.anchor}
                  style={MSG_POS[i]}
                  aria-hidden="true"
                >
                  <div data-msg className={s.msg}>
                    <div className={s.msgMeta}>
                      <span className={s.msgDot} />
                      você · agora
                    </div>
                    {m}
                  </div>
                </div>
              ))}

              {CHIP_POS.map((c, i) => (
                <div
                  key={i}
                  data-anchor-chip
                  className={s.anchor}
                  style={{ left: c.left, top: c.top }}
                  aria-hidden="true"
                >
                  <div data-chip className={s.chip}>
                    {c.label}
                  </div>
                </div>
              ))}

              <div
                data-anchor-sheet
                className={s.anchor}
                style={{ left: "30%", top: "27%" }}
                aria-hidden="true"
              >
                <div data-sheet className={s.sheet}>
                <div className={s.sheetTop}>controle.xlsx</div>
                <div className={`${s.sheetGrid} ${s.sheetHead}`}>
                  <span>Cliente</span>
                  <span>Vencimento</span>
                  <span>Status</span>
                  <span className={s.sheetVal}>Valor</span>
                </div>
                {SHEET_ROWS.map((row, i) => (
                  <div className={s.sheetGrid} key={i}>
                    <span>{row[0]}</span>
                    <span>{row[1]}</span>
                    <span>{row[2]}</span>
                    <span className={`${s.sheetVal} tnum`}>{row[3]}</span>
                  </div>
                ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={s.greenLight} />

        {/* o primeiro verde da página: um indicador de estado ativo, no
            lugar exato onde a estrutura vai se formar */}
        <div className={s.sinal} aria-hidden="true">
          <span className={s.sinalDot} />
          <span className={s.sinalLine} />
        </div>

        {/* ---------------- hero ---------------- */}
        <div className={s.copy}>
          {/* assinatura: o nome do produto existia só como chip de 22px dentro
              da demonstração. Perceptível no primeiro olhar, mas abaixo da
              headline na hierarquia — não é navbar nem logo grande. */}
          <span data-hero-brand className={s.heroBrand}>
            <span className={s.heroBrandMark} />
            Zelo
          </span>
          <span className={s.kicker}>Cobrança recorrente no Pix Automático</span>
          <p className={s.headline}>
            <span>
              <i data-hl>Pare de cobrar.</i>
            </span>
            <span>
              <i data-hl className={s.second}>
                Comece a receber.
              </i>
            </span>
          </p>
          <p className={s.sub}>
            Automatize suas cobranças recorrentes via Pix Automático e receba sem
            precisar lembrar seus clientes de pagar.
          </p>
          <div className={s.ctaRow}>
            <a className={s.btnPrimary} href="/criar-conta">
              Começar agora <ArrowRight className={s.arrow} />
            </a>
            <a className={s.btnGhost} href="#como-funciona">
              Ver como funciona
            </a>
          </div>
        </div>

        {/* ---------------- hero: a aura do produto ----------------
            a luz que a Zelo emite na sala. Respira sozinha e acende quando
            o núcleo processa a cobrança — não é gradiente decorativo, é a
            segunda fonte de luz da cena */}
        <div data-hero-aura className={s.heroAura} aria-hidden="true">
          <span data-hero-aura-in className={s.heroAuraIn} />
          <span data-hero-aura-deep className={s.heroAuraDeep} />
        </div>

        {/* ---------------- hero: a infraestrutura ----------------
            Só existe nos beats do hero: cobre a sala (que pertence aos
            capítulos e continua intacta no DOM) e a devolve no copyOut.
            Três planos de profundidade — base distante, arquitetura
            intermediária, fluxos perto da demonstração. */}
        <div data-hero-scape className={s.heroScape} aria-hidden="true">
          <span className={s.heroScapeBase} />

          <div className={s.heroStructure}>
            <span className={`${s.heroPlane} ${s.heroPlaneA}`} />
            <span className={`${s.heroPlane} ${s.heroPlaneB}`} />
          </div>

          {/* a arquitetura do espaço: vigas e travessas convergindo para o
              ponto de fuga que fica exatamente onde a demonstração vive.
              Estáticas — quem se move são os planos, os pulsos e a aura. */}
          <svg
            className={s.heroArch}
            viewBox="0 0 1440 900"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            {BEAMS.map((v, i) => (
              <path key={`b-${i}`} d={v.d} className={s.heroBeam} style={{ opacity: v.op }} />
            ))}
            {RUNGS.map((r, i) => (
              <line
                key={`r-${i}`}
                x1="-200"
                x2="1640"
                y1={r.y}
                y2={r.y}
                className={s.heroRung}
                style={{ opacity: r.op }}
              />
            ))}
          </svg>

          {/* os condutos: trajetórias curvas, não linhas retas. Duas entram
              na região do núcleo (cliente → Zelo) e duas saem dela (Zelo →
              prestador). O traçado fica sempre visível, muito fraco; o pulso
              é que viaja por ele. */}
          <svg
            data-hero-conduits
            className={s.heroConduits}
            viewBox="0 0 1440 900"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <defs>
              {/* a energia muda de qualidade ao atravessar a Zelo: ENTRA em
                  violeta profundo (a cobrança ainda sendo processada) e SAI
                  em violeta claro tendendo ao branco (o dinheiro confirmado).
                  Nunca vira verde — o verde pertence aos capítulos. */}
              <linearGradient id="zeloFlowIn" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(75,47,168,0)" />
                <stop offset="55%" stopColor="rgba(123,79,232,.46)" />
                <stop offset="100%" stopColor="rgba(165,133,255,.92)" />
              </linearGradient>
              <linearGradient id="zeloFlowOut" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(165,133,255,.9)" />
                <stop offset="42%" stopColor="rgba(214,206,255,.6)" />
                <stop offset="100%" stopColor="rgba(248,246,255,0)" />
              </linearGradient>
              {/* o traçado em repouso: quase nada longe do núcleo, um pouco
                  mais perto dele — a convergência precisa ser legível mesmo
                  quando nenhum pulso está passando. Duas versões porque o
                  núcleo fica no FIM dos condutos de entrada e no INÍCIO dos
                  de saída; um gradiente só deixaria metade invertida. */}
              <linearGradient id="zeloTrackIn" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(168,182,220,0)" />
                <stop offset="60%" stopColor="rgba(168,182,220,.07)" />
                <stop offset="100%" stopColor="rgba(139,106,255,.34)" />
              </linearGradient>
              <linearGradient id="zeloTrackOut" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(139,106,255,.34)" />
                <stop offset="40%" stopColor="rgba(168,182,220,.07)" />
                <stop offset="100%" stopColor="rgba(168,182,220,0)" />
              </linearGradient>
            </defs>

            {CONDUITS.map((c) => (
              <path
                key={`t-${c.id}`}
                className={s.heroConduitTrack}
                d={c.d}
                stroke={c.dir === "in" ? "url(#zeloTrackIn)" : "url(#zeloTrackOut)"}
              />
            ))}
            {CONDUITS.map((c) => (
              <path
                key={`p-${c.id}`}
                className={s.heroConduitPulse}
                d={c.d}
                stroke={c.dir === "in" ? "url(#zeloFlowIn)" : "url(#zeloFlowOut)"}
                style={
                  { "--dur": c.dur, "--delay": c.delay } as React.CSSProperties
                }
              />
            ))}

            {/* pontos de luz onde os condutos encontram o núcleo */}
            {NODES.map((n, i) => (
              <circle
                key={i}
                className={s.heroConduitNode}
                cx={n.cx}
                cy={n.cy}
                r={n.r}
                style={{ "--delay": n.delay } as React.CSSProperties}
              />
            ))}

            {/* luzes distantes: o ambiente responde quando a Zelo processa —
                poucas, escolhidas, nunca um campo de partículas */}
            {SPARKS.map((sp, i) => (
              <circle
                key={`s-${i}`}
                data-hero-spark
                className={s.heroSpark}
                cx={sp.cx}
                cy={sp.cy}
                r={sp.r}
              />
            ))}
          </svg>

          {/* primeiro plano: duas estruturas cortadas pela borda. Não são
              decoração — são o que dá ESCALA e coloca a câmera dentro do
              espaço. Ficam longe da coluna da headline. */}
          <div className={s.heroFore}>
            <span data-hero-fore className={`${s.heroForeEdge} ${s.heroForeEdgeA}`} />
            <span data-hero-fore className={`${s.heroForeEdge} ${s.heroForeEdgeB}`} />
          </div>
        </div>

        {/* ---------------- hero: o produto já em movimento ---------------- */}
        <div className={s.heroDemo} aria-hidden="true">
          <div className={s.heroNode}>
            <span className={s.heroNodeDot} />
            <div>
              <span className={s.heroNodeLabel}>Cliente</span>
              <span className={s.heroNodeSub}>
                <b className="tnum">R$ 350,00</b> <small>/ mês</small>
              </span>
            </div>
          </div>

          <div className={s.heroLink}>
            <span className={s.heroLinkTrack} />
            <span data-hero-pulse="1" className={s.heroLinkPulse} />
            <span className={s.heroLinkTag}>
              <Zap className={s.heroLinkIcon} />
              <span className={s.heroLinkTextSlot}>
                <span data-hero-state="criada" className={s.heroLinkState}>
                  Cobrança criada
                </span>
                <span data-hero-state="auth" className={s.heroLinkState}>
                  Pix Automático autorizado
                </span>
              </span>
            </span>
          </div>

          {/* o núcleo: a Zelo processando a cobrança entre os dois polos —
              a mesma marca que o resto da cena mostra só a partir do
              beat 94, aqui já apresentada desde o primeiro segundo */}
          <div data-hero-core className={s.heroCore}>
            {/* o "campo" que a Zelo projeta no ambiente quando processa —
                a mesma ativação do núcleo, só que vazando pro fundo */}
            <span data-hero-core-field className={s.heroCoreField} />
            <span data-hero-core-mark className={s.heroCoreMark}>
              <span data-hero-core-ring className={s.heroCoreRing} />
              <Check stroke="#fff" />
            </span>
            <span className={s.heroCoreLabel}>Zelo</span>
          </div>

          <div className={s.heroLink}>
            <span className={s.heroLinkTrack} />
            <span data-hero-pulse="2" className={s.heroLinkPulse} />
            <span className={s.heroLinkTag}>
              <Zap className={s.heroLinkIcon} />
              <span className={s.heroLinkTextSlot}>
                <span data-hero-state="proc" className={s.heroLinkState}>
                  Cobrança automática
                </span>
                <span data-hero-state="pago" className={s.heroLinkState}>
                  <Check className={s.heroCheckIcon} stroke="currentColor" /> Pago
                </span>
              </span>
            </span>
          </div>

          <div className={s.heroNode}>
            <span data-hero-dot className={`${s.heroNodeDot} ${s.heroNodeDotOk}`} />
            <div>
              <span className={s.heroNodeLabel}>Você recebe</span>
              <span className={s.heroNodeSubSlot}>
                <span data-hero-saldo="rest" className={s.heroNodeSub}>
                  automaticamente
                </span>
                <span data-hero-saldo="pago" className={s.heroNodeSub}>
                  <b className="tnum">+ R$ 350,00</b>
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className={s.hint} aria-hidden="true">
          <span className={s.hintLabel}>Role para conhecer a Zelo</span>
          <span className={s.hintBar} />
          <ArrowDown className={s.hintArrow} />
        </div>

        {/* ---------------- a frase ---------------- */}
        <div className={s.phrase} aria-hidden="true">
          <p className={s.phraseText}>
            <span>
              <i data-word>E se você</i>
            </span>{" "}
            <span>
              <i data-word>não precisasse</i>
            </span>{" "}
            <span>
              <i data-word>mais cobrar?</i>
            </span>
          </p>
        </div>

        {/* ---------------- a marca ---------------- */}
        <div className={s.brand} aria-hidden="true">
          <div className={s.brandIn}>
            <span className={s.brandMark}>
              <Check stroke="#fff" />
            </span>
            <span className={s.brandName}>Zelo</span>
            <span className={s.brandLine}>você trabalha. a Zelo cobra.</span>
            <a data-cta className={s.ctaFinal} href="/criar-conta">
              Criar minha primeira cobrança <ArrowRight />
            </a>
            <p data-publico className={s.publico}>
              Para quem vive de mensalidade — personal, terapeuta, professor,
              consultor.
            </p>
          </div>
        </div>

        {/* ---------------- a interface ---------------- */}
        <section className={s.composer} aria-label="Nova cobrança na Zelo">
          <header className={s.compTop}>
            <span className={s.compTitle}>
              <span data-titulo-a>Nova cobrança</span>
              <span data-titulo-b className={s.compTitleB}>
                Cobrança ativa
              </span>
            </span>
            <span className={s.compBrand}>
              <i /> Zelo
            </span>
          </header>
          <div className={s.compBody}>
            <div className={s.compRow}>
              <span className={s.compLabel}>Cliente</span>
              <span className={s.compValue}>Mariana Souza</span>
            </div>
            <div className={s.compRow}>
              <span className={s.compLabel}>Serviço</span>
              <span className={s.compValue}>Plano mensal</span>
            </div>
            <div className={s.compRow}>
              <span className={s.compLabel}>Valor</span>
              <span className={s.compValue}>
                <b className="tnum">R$ 350,00</b> <small>/ mês</small>
              </span>
            </div>
            <div className={s.compRow}>
              <span className={s.compLabel}>Recorrência</span>
              <span className={s.compValue}>Mensal</span>
            </div>
            <div className={s.compRow}>
              <span className={s.compLabel}>Próxima cobrança</span>
              <span className={s.compValue}>
                {/* a data rola: o tempo passa fisicamente */}
                <span className={s.roll}>
                  <span data-datas className={s.rollTrack}>
                    {DATAS.map((dia) => (
                      <span key={dia}>{dia}</span>
                    ))}
                  </span>
                </span>{" "}
                <span className={s.compBadge}>
                  <Check stroke="currentColor" /> Agendada
                </span>
              </span>
            </div>
          </div>
          <div className={s.compFoot}>
            <div className={s.compStage}>
              {/* estado 1 — a ação */}
              <div data-painel="acao" className={s.compPanel}>
                <div className={s.compBtn} id="comecar">
                  <span className={s.compBtnFill} />
                  <span className={s.compBtnLabel}>Criar cobrança</span>
                  <span className={s.compBtnLoading}>Criando…</span>
                  <span className={s.compBtnDone}>
                    <Check stroke="currentColor" /> Cobrança criada
                  </span>
                </div>
                <p className={s.compNote}>Você faz isso uma vez. Só uma.</p>
              </div>

              {/* estado 2 — a autorização do cliente */}
              <div data-painel="auth" className={s.compPanel}>
                <div className={s.authBox}>
                  <span className={s.authWho}>
                    <Zap /> Pix Automático
                  </span>
                  <span className={s.authStatus}>
                    <span data-auth-pend className={s.authPend}>
                      <i /> Autorização pendente
                    </span>
                    <span data-auth-ok className={s.authOk}>
                      <i /> Autorizado
                    </span>
                  </span>
                </div>
                <p className={s.compNote}>
                  Mariana autoriza uma vez, no app do banco dela.
                </p>
              </div>

              {/* estado 3 — a cobrança viva */}
              <div data-painel="ativa" className={s.compPanel}>
                <div className={s.ativaBox}>
                  <span className={`${s.ativaVal} tnum`}>
                    R$ 350,00 <small>/ mês</small>
                  </span>
                  <span className={s.ativaTag}>
                    <Check stroke="currentColor" /> Ativa
                  </span>
                </div>
                <p className={s.compNote}>
                  Entra na sua conta todo dia 05, sem você fazer nada.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- capítulo 3: o dinheiro ---------------- */}
        <div data-polo="cliente" className={s.polo} aria-hidden="true">
          <span className={s.poloLabel}>Cliente</span>
          <span className={s.poloNome}>Mariana Souza</span>
        </div>
        <div data-polo="voce" className={s.polo} aria-hidden="true">
          <span className={s.poloLabel}>Prestador</span>
          <span className={s.poloNome}>Você</span>
        </div>

        {/* o dinheiro é o próprio valor: ele viaja e depois vira comprovante */}
        <div data-valor className={s.valor} aria-hidden="true">
          <span data-valor-corpo>
            <span className={`${s.valorCifra} tnum`}>R$ 350,00</span>
          </span>
          <span data-valor-corpo className={s.valorTag}>
            <Zap /> Pix Automático
          </span>
          <span data-valor-pago className={s.valorPago}>
            <Check stroke="currentColor" /> Pago ·{" "}
            <span className={s.roll}>
              <span data-pago-datas className={s.rollTrack}>
                {PAGO_EM.map((dia) => (
                  <span key={dia}>{dia}</span>
                ))}
              </span>
            </span>
          </span>
        </div>

        <div data-saldo className={s.saldo} aria-hidden="true">
          <span className={s.saldoLabel}>Recebido desde setembro</span>
          <span data-saldo-valor className={s.saldoValor}>
            R$ 0,00
          </span>
        </div>

        <div className={s.vignette} aria-hidden="true" />
        <div className={s.grain} aria-hidden="true" />
      </div>
    </div>
  );
}
