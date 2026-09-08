"use client";

import { useEffect } from "react";
import { track, EVENTOS } from "@/lib/analytics";

const CHAVE = "zelo_onboarding_completo_contado";

/**
 * Dispara `onboarding_completed` uma vez por navegador quando a jornada
 * chega a 100% — nunca no banco (a jornada é sempre derivada do estado
 * real, de propósito, ver `lib/core/jornada-onboarding.ts`), então o
 * guard de "já contei isso" mora em `localStorage`, não numa coluna.
 * Falha ao ler/escrever localStorage (modo privado, storage bloqueado)
 * só significa que o evento pode disparar mais de uma vez — pior caso é
 * uma métrica levemente inflada, nunca uma quebra de tela.
 */
export default function OnboardingCompletoTracker({ completa }: { completa: boolean }) {
  useEffect(() => {
    if (!completa) return;
    try {
      if (localStorage.getItem(CHAVE)) return;
      localStorage.setItem(CHAVE, "1");
    } catch {
      // segue e dispara mesmo assim — ver comentário acima
    }
    track(EVENTOS.onboardingCompleted);
  }, [completa]);

  return null;
}
