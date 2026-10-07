import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";
import RetornoPagamento from "./RetornoPagamento";
import s from "../../../App.module.css";

export const metadata = { title: "Confirmando pagamento", robots: { index: false, follow: false } };

/* Nunca em cache: mostra o estado real do pagamento. */
export const dynamic = "force-dynamic";

/**
 * Retorno depois do pagamento. Quem decide se está pago é o servidor — esta
 * página só consulta e mostra. Ver `RetornoPagamento`.
 */
export default async function Retorno() {
  const atual = await usuarioAtual();
  if (!atual?.membro?.empresa_id) redirect("/entrar?de=/app/assinatura/retorno");

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Estamos confirmando seu pagamento…</h1>
        <p className={s.subtitulo}>Isso costuma levar poucos instantes. Você não precisa fazer mais nada.</p>
      </header>
      <RetornoPagamento />
    </>
  );
}
