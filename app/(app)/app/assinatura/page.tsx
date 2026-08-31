import { usuarioAtual } from "@/lib/supabase/server";
import { Empresa, PRECO_MENSAL_CENTAVOS, situacaoDaConta } from "@/lib/empresa";
import { formatarCentavos } from "@/lib/dinheiro";
import s from "../../App.module.css";

export const metadata = { title: "Assinatura" };

const ROTULO: Record<string, string> = {
  trial: "Teste grátis",
  ativa: "Ativa",
  inadimplente: "Pagamento pendente",
  cancelada: "Cancelada",
};

export default async function Assinatura() {
  const atual = await usuarioAtual();
  const empresa = (atual?.membro?.empresas ?? null) as Empresa | null;
  if (!empresa) return null;

  const situacao = situacaoDaConta(empresa);
  const termina = new Date(empresa.trial_termina_em).toLocaleDateString("pt-BR");

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Assinatura</h1>
        <p className={s.subtitulo}>
          {formatarCentavos(PRECO_MENSAL_CENTAVOS)} por mês, depois dos 14 dias
          grátis.
        </p>
      </header>

      <div className={s.numeros}>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Situação</span>
          <span className={s.numeroValor}>{ROTULO[situacao.status]}</span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>
            {situacao.emTrial ? "Termina em" : "Teste terminou em"}
          </span>
          <span className={s.numeroValor}>{termina}</span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Mensalidade</span>
          <span className={s.numeroValor}>
            {formatarCentavos(PRECO_MENSAL_CENTAVOS)}
          </span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Dias restantes</span>
          <span className={s.numeroValor}>{situacao.diasRestantes}</span>
        </div>
      </div>

      {/* Não existe botão de assinar: o meio de pagamento é o Asaas, que é
          fase posterior. Um botão que não cobra seria pior que nenhum. */}
      <section className={s.vazio}>
        <h2 className={s.vazioTitulo}>Pagamento ainda não está disponível</h2>
        <p className={s.vazioTexto}>
          A cobrança da assinatura será feita pelo Asaas e ainda está sendo
          configurada. Enquanto isso, sua conta continua funcionando
          normalmente durante o teste grátis.
        </p>
      </section>
    </>
  );
}
