import { notFound } from "next/navigation";
import { administradorAtual } from "../acesso";
import { listarSolicitacoes } from "@/lib/core/solicitacao-titular";
import TabelaSolicitacoes from "./TabelaSolicitacoes";
import s from "../../../App.module.css";
import a from "../influenciadores/Admin.module.css";

export const metadata = { title: "Solicitações de titular", robots: { index: false, follow: false } };

/* Nunca em cache: é uma fila de atendimento e precisa refletir o banco agora. */
export const dynamic = "force-dynamic";

/**
 * Fila dos pedidos de titular de dados (LGPD) enviados em
 * /privacidade/solicitacao. Mesma regra do painel de influenciadores: a
 * checagem é refeita AQUI e em cada action, e quem não é administrador vê 404.
 */
export default async function Solicitacoes() {
  if (!(await administradorAtual())) notFound();

  const linhas = await listarSolicitacoes().catch(() => []);
  const abertas = linhas.filter((l) => l.status === "recebida" || l.status === "em_andamento").length;

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Solicitações de titular</h1>
        <p className={s.subtitulo}>
          Pedidos de acesso, correção, exclusão e portabilidade de dados.{" "}
          {linhas.length > 0 ? `${abertas} em aberto.` : ""}
        </p>
      </header>

      <p className={a.aviso} role="note">
        <strong>Mudar o status apenas REGISTRA o andamento.</strong> A resposta ao titular é enviada por você, fora do
        sistema, para o e-mail informado no pedido.
      </p>

      <TabelaSolicitacoes linhas={linhas} />
    </>
  );
}
