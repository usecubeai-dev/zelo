import Link from "next/link";
import { usuarioAtual } from "@/lib/supabase/server";
import { Empresa, situacaoDaConta } from "@/lib/empresa";
import { obterUsoDoPlano } from "@/lib/core/assinatura";
import { TAXA_DE_RECEBIMENTO_CENTAVOS } from "@/lib/plano";
import { getAsaasConfiguration } from "@/lib/asaas/config";
import { formatarCentavos } from "@/lib/dinheiro";
import s from "../../App.module.css";

export const metadata = { title: "Assinatura" };

const ROTULO: Record<string, string> = {
  trial: "Teste grátis",
  ativa: "Ativa",
  inadimplente: "Pagamento pendente",
  cancelada: "Cancelada",
};

/** `.sitPaga`/`.sitVencida`/`.sitEstornada` já existem (cobranças) — mesma
 * paleta, sem inventar cor nova pra um estado que é a mesma ideia:
 * verde = em dia, âmbar = atenção, vermelho = encerrado. */
const ETIQUETA_SITUACAO: Record<string, string> = {
  trial: s.etiqueta,
  ativa: `${s.etiqueta} ${s.sitPaga}`,
  inadimplente: `${s.etiqueta} ${s.sitVencida}`,
  cancelada: `${s.etiqueta} ${s.sitEstornada}`,
};

function formatarData(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR");
}

const BLOQUEIO_TEXTO =
  "cadastrar novos clientes, cobranças ou recorrências fica bloqueado — o que já existe continua acessível para consulta e edição.";

export default async function Assinatura() {
  const atual = await usuarioAtual();
  const empresa = (atual?.membro?.empresas ?? null) as Empresa | null;
  if (!empresa) return null;

  const situacao = situacaoDaConta(empresa);
  const uso = await obterUsoDoPlano(empresa.id, empresa.plano);
  const billingConfigurado = getAsaasConfiguration().isConfigured;

  const termina = formatarData(empresa.trial_termina_em);
  const atualizadaEm = formatarData(empresa.assinatura_atualizada_em);

  const percentUso = uso.limiteClientes > 0
    ? Math.min(100, Math.round((uso.clientesAtivos / uso.limiteClientes) * 100))
    : 0;
  const percentUsoCobrancas = uso.limiteCobrancasMes > 0
    ? Math.min(100, Math.round((uso.cobrancasNoMes / uso.limiteCobrancasMes) * 100))
    : 0;

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Assinatura</h1>
        <p className={s.subtitulo}>
          {formatarCentavos(uso.precoCentavos)} por mês, depois dos 30 dias
          grátis. Taxa de recebimento: {formatarCentavos(TAXA_DE_RECEBIMENTO_CENTAVOS)} por pagamento recebido.
        </p>
      </header>

      <div className={s.numeros}>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Situação</span>
          <span className={s.numeroValor}>
            <span className={ETIQUETA_SITUACAO[situacao.status]}>
              {situacao.trialExpirado ? "Teste terminado" : ROTULO[situacao.status]}
            </span>
          </span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Plano</span>
          <span className={s.numeroValor}>{uso.nomePlano}</span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>Mensalidade</span>
          <span className={s.numeroValor}>
            {formatarCentavos(uso.precoCentavos)}
          </span>
        </div>
        <div className={s.numero}>
          <span className={s.numeroRotulo}>
            {situacao.status === "trial" ? (situacao.emTrial ? "Termina em" : "Teste terminou em") : "Última mudança"}
          </span>
          <span className={s.numeroValor}>
            {situacao.status === "trial" ? (termina ?? "—") : (atualizadaEm ?? "—")}
          </span>
        </div>
      </div>

      <section className={s.bloco} style={{ marginBottom: 26 }}>
        <h2 className={s.blocoTitulo}>Uso do plano — {uso.nomePlano}</h2>
        <div className={s.medidorLinha}>
          <span>Clientes ativos</span>
          <span>
            {uso.clientesAtivos} / {uso.limiteClientes}
          </span>
        </div>
        <div className={s.medidor}>
          <div
            className={s.medidorPreenchido}
            data-perto={percentUso >= 80 ? "true" : "false"}
            style={{ width: `${percentUso}%` }}
          />
        </div>
        <div className={s.medidorLinha} style={{ marginTop: 14 }}>
          <span>Cobranças criadas este mês</span>
          <span>
            {uso.cobrancasNoMes} / {uso.limiteCobrancasMes}
          </span>
        </div>
        <div className={s.medidor}>
          <div
            className={s.medidorPreenchido}
            data-perto={percentUsoCobrancas >= 80 ? "true" : "false"}
            style={{ width: `${percentUsoCobrancas}%` }}
          />
        </div>
      </section>

      {situacao.status === "trial" && !situacao.trialExpirado && (
        <section className={s.vazio}>
          <h2 className={s.vazioTitulo}>Seu teste grátis está em andamento</h2>
          <p className={s.vazioTexto}>
            Você pode usar o Zelo livremente até {termina}. Depois disso, a
            assinatura de {formatarCentavos(uso.precoCentavos)} por mês
            passa a valer.
          </p>
          <div className={s.acoes}>
            <Link href="/app" className={s.botaoSec}>
              Ver seus primeiros passos
            </Link>
          </div>
        </section>
      )}

      {situacao.trialExpirado && (
        <section className={`${s.bloco} ${s.blocoAviso}`}>
          <h2 className={s.blocoTitulo}>Seu teste grátis terminou</h2>
          <p className={s.vazioTexto} style={{ margin: 0 }}>
            Terminou em {termina}. Enquanto a cobrança da assinatura ainda
            está sendo configurada, {BLOQUEIO_TEXTO}
          </p>
        </section>
      )}

      {situacao.status === "ativa" && (
        <section className={s.bloco}>
          <h2 className={s.blocoTitulo}>Assinatura ativa</h2>
          <p className={s.vazioTexto} style={{ margin: 0 }}>
            Sua assinatura está em dia
            {atualizadaEm ? ` desde ${atualizadaEm}` : ""}. O plano{" "}
            {uso.nomePlano} permite até {uso.limiteClientes} clientes ativos.
          </p>
        </section>
      )}

      {situacao.status === "inadimplente" && (
        <section className={`${s.bloco} ${s.blocoAviso}`}>
          <h2 className={s.blocoTitulo}>Pagamento pendente</h2>
          <p className={s.vazioTexto} style={{ margin: 0 }}>
            Não conseguimos confirmar o pagamento da sua assinatura
            {atualizadaEm ? ` desde ${atualizadaEm}` : ""}. Enquanto isso,{" "}
            {BLOQUEIO_TEXTO} Assim que o pagamento for confirmado, sua conta
            volta a ficar liberada automaticamente — não é preciso fazer
            nada aqui.
          </p>
        </section>
      )}

      {situacao.status === "cancelada" && (
        <section className={`${s.bloco} ${s.blocoPerigo}`}>
          <h2 className={s.blocoTitulo}>Assinatura cancelada</h2>
          <p className={s.vazioTexto} style={{ margin: 0 }}>
            Cancelada{atualizadaEm ? ` em ${atualizadaEm}` : ""}. Desde então,{" "}
            {BLOQUEIO_TEXTO} A reativação ainda não é self-service — fale com
            o suporte para retomar sua assinatura.
          </p>
        </section>
      )}

      {/* Não existe botão de assinar/cancelar: o meio de pagamento é o
          Asaas, que ainda está sendo configurado (ver lib/asaas/config.ts).
          Um botão que não cobra, ou que promete cancelar sem provider
          nenhum por trás, seria pior que nenhum botão. */}
      {!billingConfigurado && (
        <section className={s.vazio} style={{ marginTop: 26 }}>
          <h2 className={s.vazioTitulo}>Pagamento ainda não está disponível</h2>
          <p className={s.vazioTexto}>
            A cobrança da assinatura será feita pelo nosso parceiro financeiro
            e ainda está sendo configurada. Enquanto isso, sua conta segue as
            regras acima — teste grátis, e depois liberação conforme o status
            da assinatura.
          </p>
        </section>
      )}
    </>
  );
}
