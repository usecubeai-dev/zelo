/**
 * Ponte para o Lenis.
 *
 * O handle `window.__lenis` só existe em desenvolvimento (é de inspeção).
 * Sem isto, as âncoras do header brigariam com o scroll suave em produção:
 * o Lenis intercepta a rolagem e o salto nativo do `href="#id"` fica preso.
 *
 * Quem preenche é o SmoothScroll; quem consome é o header.
 */
type LenisLike = {
  scrollTo: (alvo: string | HTMLElement | number, opcoes?: Record<string, unknown>) => void;
};

let instancia: LenisLike | null = null;

export function registrarLenis(l: LenisLike | null) {
  instancia = l;
}

/** Altura do header fixo — o alvo precisa parar abaixo dele. */
export const OFFSET_HEADER = 76;

/**
 * Rola até uma âncora. Usa o Lenis quando ele existe; cai no scroll nativo
 * em prefers-reduced-motion (onde o Lenis nem é montado).
 */
export function irPara(seletor: string) {
  const el = document.querySelector<HTMLElement>(seletor);
  if (!el) return;

  if (instancia) {
    instancia.scrollTo(el, { offset: -OFFSET_HEADER, duration: 1.1 });
    return;
  }

  const y = el.getBoundingClientRect().top + window.scrollY - OFFSET_HEADER;
  const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: y, behavior: reduzido ? "auto" : "smooth" });
}
