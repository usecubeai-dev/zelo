import { linkDePagamentoDaCobranca } from "@/lib/core/link-cobranca";
import { prepararEnvioWhatsApp } from "@/lib/whatsapp";
import { hojeISO } from "@/lib/cobranca";
import PainelRecuperar from "./PainelRecuperar";

type Props = {
  empresaId: string;
  cobranca: { id: string; valor_centavos: number; vence_em: string; asaas_payment_id: string | null; negociada_em: string | null };
  cliente: { id: string; nome: string; whatsapp: string | null };
  regra?: string;
  rotulo?: string;
  local?: string;
  canal?: "whatsapp" | "link";
};

/**
 * Prepara as opções de recuperação de UMA cobrança: busca o link público que o
 * Asaas já gerou (somente leitura) e monta o MESMO link `wa.me` do botão da
 * ficha da cobrança (`prepararEnvioWhatsApp`). Server Component assíncrono,
 * usado dentro de <Suspense> por linha: a consulta ao provedor de uma linha não
 * segura as outras.
 */
export default async function OpcoesRecuperacao({ empresaId, cobranca, cliente, regra, rotulo, local, canal }: Props) {
  const resultado = await linkDePagamentoDaCobranca(empresaId, cobranca.asaas_payment_id);
  const link = resultado.ok ? resultado.link : null;

  const preparo = prepararEnvioWhatsApp({
    nomeCliente: cliente.nome,
    whatsapp: cliente.whatsapp,
    valorCentavos: cobranca.valor_centavos,
    venceEm: cobranca.vence_em,
    link,
    hoje: hojeISO(),
  });

  return (
    <PainelRecuperar
      cobrancaId={cobranca.id}
      clienteId={cliente.id}
      whatsappHref={preparo.estado === "pronto" ? preparo.href : null}
      semTelefone={preparo.estado === "indisponivel" ? preparo.semTelefone : false}
      semLink={preparo.estado === "indisponivel" ? preparo.semLink : false}
      link={link}
      regra={regra}
      negociada={Boolean(cobranca.negociada_em)}
      rotulo={rotulo}
      local={local}
      canal={canal}
    />
  );
}

export function RecuperacaoPreparando() {
  return <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Preparando as opções…</span>;
}
