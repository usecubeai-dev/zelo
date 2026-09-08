import type { Metadata } from "next";
import { obterAutorizacaoPublica } from "@/lib/core/autorizacao-pix";
import AutorizarCliente from "./AutorizarCliente";
import s from "../Autorizar.module.css";

export const metadata: Metadata = {
  title: "Autorizar cobrança automática",
  robots: { index: false, follow: false },
};

/**
 * Tela pública de autorização Pix Automático — o "cliente autoriza" da
 * promessa comercial da Zelo. Sem login: o `id` na URL é a própria
 * credencial de acesso (ver `obterAutorizacaoPublica`).
 */
export default async function AutorizarPagina({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resultado = await obterAutorizacaoPublica(id);

  if (!resultado.ok) {
    return (
      <section className={s.cartao} data-tom="erro">
        <h1 className={s.titulo}>Link inválido</h1>
        <p className={s.texto}>
          Este link de autorização não existe ou não está mais disponível. Peça um novo link ao profissional que te
          enviou.
        </p>
      </section>
    );
  }

  return <AutorizarCliente autorizacaoId={id} dado={resultado.dado} />;
}
