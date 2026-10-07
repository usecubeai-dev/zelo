import { linkDePagamentoDaCobranca } from "@/lib/core/link-cobranca";
import { credencialDaEmpresa } from "@/lib/asaas/credenciais";
import { estadoDoEmailDoCliente } from "@/lib/email/estado";
import { prepararEnvioWhatsApp } from "@/lib/whatsapp";
import { hojeISO } from "@/lib/cobranca";
import BlocoEnviar, { type EstadoLink } from "../BlocoEnviar";
import c from "./Whatsapp.module.css";

type Props = {
  empresaId: string;
  cobrancaId: string;
  cobranca: {
    valor_centavos: number;
    vence_em: string;
    asaas_payment_id: string | null;
    asaas_sync_status?: string | null;
  };
  cliente: { id: string; nome: string; whatsapp: string | null; email?: string | null };
};

/**
 * "Enviar para o cliente": o WhatsApp (ação principal, o MESMO botão de sempre),
 * copiar link e e-mail — e o que fazer quando ainda não há link de pagamento.
 *
 * Só LÊ: busca o link público que o provedor já gerou, monta o link `wa.me` e
 * descobre se o e-mail está disponível. Não cria cobrança, não grava nada, não
 * muda o estado financeiro. Server Component assíncrono dentro de <Suspense> na
 * página: a consulta ao provedor não segura o resto da tela, e quando o botão
 * aparece ele já é um link pronto (clique imediato).
 */
export default async function WhatsappCobranca({ empresaId, cobrancaId, cobranca, cliente }: Props) {
  const resultado = await linkDePagamentoDaCobranca(empresaId, cobranca.asaas_payment_id);
  const link = resultado.ok ? resultado.link : null;

  let estadoLink: EstadoLink = "ok";
  if (!link) {
    if (!resultado.ok) estadoLink = "falhou";
    else if (!cobranca.asaas_payment_id && !(await credencialDaEmpresa(empresaId))) estadoLink = "sem_conta";
    else if (cobranca.asaas_sync_status === "erro") estadoLink = "falhou";
    else estadoLink = "preparando";
  }

  const preparo = prepararEnvioWhatsApp({
    nomeCliente: cliente.nome,
    whatsapp: cliente.whatsapp,
    valorCentavos: cobranca.valor_centavos,
    venceEm: cobranca.vence_em,
    link,
    hoje: hojeISO(),
  });

  const estadoEmail = estadoDoEmailDoCliente(cliente.email);

  return (
    <BlocoEnviar
      cobrancaId={cobrancaId}
      whatsappHref={preparo.estado === "pronto" ? preparo.href : null}
      semTelefone={preparo.estado === "indisponivel" ? preparo.semTelefone : false}
      clienteId={cliente.id}
      link={link}
      estadoLink={estadoLink}
      estadoEmail={estadoEmail}
    />
  );
}

export function WhatsappPreparando() {
  return <span className={c.preparando}>Preparando as opções de envio…</span>;
}
