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
    <section className={s.bloco} style={{ marginBottom: 26 }}>
      <div className={s.barraTopo} style={{ marginBottom: 4 }}>
        <h2 className={s.blocoTitulo} style={{ margin: 0 }}>
          Comece por aqui
        </h2>
        {proximo && (
          <Link href={proximo.href} className={s.botao}>
            {proximo.titulo}
          </Link>
        )}
      </div>
      <ul className={s.jornadaLista}>
        {passos.map((p) => (
          <li key={p.id} className={s.jornadaItem} data-concluido={p.concluido ? "true" : "false"}>
            <span className={s.jornadaMarca} aria-hidden="true">
              {p.concluido ? "✓" : ""}
            </span>
            <span>{p.concluido ? <span>{p.titulo}</span> : <Link href={p.href}>{p.titulo}</Link>}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
