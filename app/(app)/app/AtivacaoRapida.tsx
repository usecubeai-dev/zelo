"use client";

import { useEffect } from "react";
import Link from "next/link";
import { track, EVENTOS } from "@/lib/analytics";
import type { PassoJornada } from "@/lib/core/jornada-onboarding";
import s from "../App.module.css";

const CHAVE = "zelo_ativacao_rapida_contada";

/**
 * Fase 23 — versão curta e prioritária da jornada de onboarding
 * (`lib/core/jornada-onboarding.ts`, `ativacaoRapida`): 3 passos, não 9.
 * Reaproveita exatamente as mesmas classes CSS do card "Primeiros passos"
 * (`App.module.css`) — não é um componente visual novo, é o mesmo padrão
 * com menos itens. Mesmo raciocínio de `OnboardingCompletoTracker` para o
 * disparo do evento de conclusão: guard em `localStorage` (a jornada em
 * si é sempre derivada do banco, nunca um flag persistido).
 */
export default function AtivacaoRapida({ passos, completa }: { passos: PassoJornada[]; completa: boolean }) {
  useEffect(() => {
    if (!completa) return;
    try {
      if (localStorage.getItem(CHAVE)) return;
      localStorage.setItem(CHAVE, "1");
    } catch {
      // segue e dispara mesmo assim — pior caso é métrica levemente inflada, nunca quebra de tela.
    }
    track(EVENTOS.activationCompleted);
  }, [completa]);

  if (completa) return null;

  const proximo = passos.find((p) => !p.concluido);

  return (
    <section className={s.inicio} aria-labelledby="inicio-titulo">
      <div className={s.inicioTopo}>
        <div>
          <h2 id="inicio-titulo" className={s.inicioTitulo}>
            Comece por aqui
          </h2>
          <p className={s.inicioLead}>Vamos colocar seu negócio para funcionar.</p>
        </div>
        {proximo && (
          <Link href={proximo.href} className={s.botao}>
            {proximo.titulo}
          </Link>
        )}
      </div>
      <ol className={s.inicioPassos}>
        {passos.map((p, i) => {
          const estado = p.concluido ? "feito" : p.id === proximo?.id ? "atual" : "futuro";
          return (
            <li key={p.id} className={s.inicioPasso} data-estado={estado}>
              <span className={s.inicioNumero} aria-hidden="true">
                {p.concluido ? "✓" : i + 1}
              </span>
              <span>{p.concluido ? <span>{p.titulo}</span> : <Link href={p.href}>{p.titulo}</Link>}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
