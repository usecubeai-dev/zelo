import Link from "next/link";
import type { AvisoRecebimentos as Aviso } from "@/lib/core/recebimentos";
import PrepararPagamentos from "./PrepararPagamentos";
import s from "../../App.module.css";
import e from "./Envio.module.css";

/**
 * Diz, ANTES de a pessoa cobrar, se a conta de recebimentos já está pronta para
 * gerar o link de pagamento — e, quando não está, a única ação que resolve.
 * Quando há cobranças salvas sem link, oferece prepará-las (ação explícita).
 *
 * Nunca esconde a criação da cobrança: ela pode ser salva a qualquer momento;
 * o que depende da conta é só o link de pagamento.
 */
export default function AvisoRecebimentos({
  aviso,
  semLink,
  contexto,
}: {
  aviso: Aviso;
  semLink: number;
  contexto: "nova" | "lista";
}) {
  const pronta = aviso.podeGerarLink;
  if (pronta && semLink === 0) return null;

  const mostrarConta = !pronta;
  const podePreparar = (aviso.podeGerarLink || aviso.podeTentar) && semLink > 0;

  return (
    <section className={e.contaAviso} data-tom={mostrarConta ? aviso.tom : "neutro"} aria-label="Conta de recebimentos">
      {mostrarConta && (
        <div className={e.contaAvisoCorpo}>
          <h2 className={e.contaAvisoTitulo}>{aviso.titulo}</h2>
          <p className={e.contaAvisoTexto}>
            {aviso.texto}
            {contexto === "nova" &&
              " Você pode criar a cobrança agora: ela fica salva, e o link de pagamento é gerado quando a conta estiver pronta."}
          </p>
          {aviso.acao && (
            <div className={e.contaAvisoAcoes}>
              <Link href={aviso.acao.href} className={s.botao}>
                {aviso.acao.rotulo}
              </Link>
            </div>
          )}
        </div>
      )}
      {semLink > 0 && (
        <div className={e.contaAvisoCorpo}>
          <h2 className={e.contaAvisoTitulo}>
            {semLink === 1 ? "1 cobrança salva está sem link de pagamento" : `${semLink} cobranças salvas estão sem link de pagamento`}
          </h2>
          <p className={e.contaAvisoTexto}>
            {pronta
              ? "O pagamento delas ainda não foi preparado. Prepare agora para poder enviar ao cliente."
              : "O cliente só recebe o link depois que o pagamento for preparado."}
          </p>
          {podePreparar && <PrepararPagamentos quantidade={semLink} />}
        </div>
      )}
    </section>
  );
}
