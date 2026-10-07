import e from "./Envio.module.css";

/**
 * Confirmação logo depois de criar: a pessoa nunca fica sem saber se
 * funcionou. É só leitura (vem de `?criada=1` + dados reais da cobrança) e o
 * próximo passo, "Enviar para o cliente", vem logo abaixo.
 */
export default function CobrancaCriada({
  titulo = "Cobrança criada",
  cliente,
  detalhe,
  vencimento,
}: {
  titulo?: string;
  cliente: string;
  /** "R$ 380,00" ou "R$ 380,00 por mês" */
  detalhe: string;
  /** "Vencimento: 05/11/2026" ou "Todo dia 5" */
  vencimento: string;
}) {
  return (
    <section className={e.criada} role="status" aria-live="polite" aria-label={`${titulo} com sucesso`}>
      <span className={e.criadaIcone} aria-hidden="true">
        ✓
      </span>
      <div>
        <h2 className={e.criadaTitulo}>{titulo} ✅</h2>
        <p className={e.criadaLinha}>
          <strong>{cliente}</strong>
        </p>
        <p className={e.criadaLinha}>
          <strong>{detalhe}</strong> · {vencimento}
        </p>
      </div>
    </section>
  );
}
