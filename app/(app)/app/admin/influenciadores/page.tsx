import { notFound } from "next/navigation";
import { administradorAtual } from "../acesso";
import { listarComissoes, listarResumoInfluenciadores } from "@/lib/core/influenciadores";
import { linkDeIndicacao } from "@/lib/indicacao-codigo";
import { formatarCentavos } from "@/lib/dinheiro";
import FormularioInfluenciador from "./FormularioInfluenciador";
import TabelaInfluenciadores from "./TabelaInfluenciadores";
import TabelaComissoes from "./TabelaComissoes";
import TabelaTaxas from "./TabelaTaxas";
import TabelaReembolsos from "./TabelaReembolsos";
import { listarPedidosReembolso } from "@/lib/core/reembolso";
import { listarTaxasACobrar } from "@/lib/core/taxa-recebimento";
import s from "../../../App.module.css";
import a from "./Admin.module.css";

export const metadata = { title: "Influenciadores", robots: { index: false, follow: false } };

/* Nunca em cache: o painel mostra dinheiro a pagar e precisa refletir o
   estado do banco no instante em que o administrador abre. */
export const dynamic = "force-dynamic";

/**
 * Painel do administrador do Zelo: influenciadores, links de indicação e
 * comissões. A checagem é refeita AQUI (e em cada action) — esconder o item
 * do menu não é proteção. Para quem não é administrador a rota simplesmente
 * não existe (404), sem revelar que há um painel.
 */
export default async function Influenciadores() {
  if (!(await administradorAtual())) notFound();

  const [resumo, comissoes, taxas, reembolsos] = await Promise.all([
    listarResumoInfluenciadores(),
    listarComissoes(),
    listarTaxasACobrar().catch(() => []),
    listarPedidosReembolso().catch(() => []),
  ]);

  /* `listarResumoInfluenciadores` já soma só o ambiente `production`:
     comissão de teste (sandbox) nunca entra nos totais. */
  const totais = resumo.reduce(
    (t, i) => ({
      pendente: t.pendente + i.pendenteCentavos,
      disponivel: t.disponivel + i.disponivelCentavos,
      pago: t.pago + i.pagoCentavos,
    }),
    { pendente: 0, disponivel: 0, pago: 0 }
  );

  const linhasInfluenciadores = resumo.map((i) => ({
    id: i.id,
    nome: i.nome,
    codigo: i.codigo,
    link: linkDeIndicacao(i.codigo),
    status: i.status,
    indicacoes: i.indicacoes,
    convertidos: i.convertidos,
    pendenteCentavos: i.pendenteCentavos,
    disponivelCentavos: i.disponivelCentavos,
    pagoCentavos: i.pagoCentavos,
    termoAssinadoEm: i.termo_parceria_assinado_em ?? null,
  }));

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Influenciadores</h1>
        <p className={s.subtitulo}>Links de indicação e comissões. Totais consideram só pagamentos reais.</p>
      </header>

      <div className={a.totais}>
        <div className={a.total}>
          <span className={s.numeroRotulo}>Pendente</span>
          <span className={s.numeroValor}>{formatarCentavos(totais.pendente)}</span>
        </div>
        <div className={a.total}>
          <span className={s.numeroRotulo}>Disponível</span>
          <span className={s.numeroValor}>{formatarCentavos(totais.disponivel)}</span>
        </div>
        <div className={a.total}>
          <span className={s.numeroRotulo}>Pago</span>
          <span className={`${s.numeroValor} ${a.totalPago}`}>{formatarCentavos(totais.pago)}</span>
        </div>
      </div>

      <FormularioInfluenciador />

      <section className={a.secao} aria-labelledby="titulo-influenciadores">
        <h2 id="titulo-influenciadores" className={a.secaoTitulo}>
          Influenciadores
        </h2>
        <TabelaInfluenciadores linhas={linhasInfluenciadores} />
      </section>

      <section className={a.secao} aria-labelledby="titulo-reembolsos">
        <h2 id="titulo-reembolsos" className={a.secaoTitulo}>
          Pedidos de reembolso (arrependimento)
        </h2>
        <p className={a.aviso} role="note">
          <strong>O estorno só acontece quando você clica; nada é devolvido automaticamente.</strong> “Estornar no Asaas”
          pede o estorno integral da mensalidade e não dá para desfazer. Só pedidos pendentes ou que falharam aceitam ação.
        </p>
        <TabelaReembolsos linhas={reembolsos} />
      </section>

      <section className={a.secao} aria-labelledby="titulo-comissoes">
        <h2 id="titulo-comissoes" className={a.secaoTitulo}>
          Comissões
        </h2>
        <p className={a.aviso} role="note">
          <strong>Marcar como paga apenas REGISTRA que você pagou o influenciador por fora; o Zelo não transfere dinheiro.</strong>{" "}
          O histórico nunca é apagado: comissões pagas ou canceladas ficam aqui, sem ação.
        </p>
        <TabelaComissoes linhas={comissoes} />
      </section>

      <section className={a.secao} aria-labelledby="titulo-taxas">
        <h2 id="titulo-taxas" className={a.secaoTitulo}>
          Taxas de recebimento a cobrar
        </h2>
        <p className={a.aviso} role="note">
          <strong>R$ 1,99 por Pix recebido pelo profissional.</strong> Só recebimentos reais entram. “Marcar como
          cobrada” apenas REGISTRA que você cobrou por fora; o Zelo ainda não debita essa taxa automaticamente.
        </p>
        <TabelaTaxas linhas={taxas} />
      </section>
    </>
  );
}
