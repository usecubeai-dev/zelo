import Link from "next/link";
import { linkDePagamentoDaCobranca } from "@/lib/core/link-cobranca";
import { prepararEnvioWhatsApp } from "@/lib/whatsapp";
import { hojeISO } from "@/lib/cobranca";
import BotaoWhatsapp from "./BotaoWhatsapp";
import c from "./Whatsapp.module.css";

type Props = {
  empresaId: string;
  cobranca: { valor_centavos: number; vence_em: string; asaas_payment_id: string | null };
  cliente: { id: string; nome: string; whatsapp: string | null };
};

/**
 * Bloco "Enviar pelo WhatsApp" da cobrança em aberto.
 *
 * Só LÊ: busca o link público que o provedor já gerou e monta o link
 * `wa.me`. Não cria cobrança, não grava nada, não muda o estado financeiro.
 * Server Component assíncrono dentro de <Suspense> na página: a consulta ao
 * provedor não segura o resto da tela, e quando o botão aparece ele já é um
 * link pronto (clique imediato).
 */
export default async function WhatsappCobranca({ empresaId, cobranca, cliente }: Props) {
  const resultado = await linkDePagamentoDaCobranca(empresaId, cobranca.asaas_payment_id);

  if (!resultado.ok) {
    return (
      <div className={c.indisponivel} role="status">
        <p>Não conseguimos buscar o link de pagamento agora. Recarregue a página em instantes para enviar pelo WhatsApp.</p>
      </div>
    );
  }

  const preparo = prepararEnvioWhatsApp({
    nomeCliente: cliente.nome,
    whatsapp: cliente.whatsapp,
    valorCentavos: cobranca.valor_centavos,
    venceEm: cobranca.vence_em,
    link: resultado.link,
    hoje: hojeISO(),
  });

  if (preparo.estado === "pronto") return <BotaoWhatsapp href={preparo.href} />;

  return (
    <div className={c.indisponivel} role="status">
      {preparo.semTelefone && (
        <>
          <p>Este cliente não possui um WhatsApp válido cadastrado.</p>
          <Link href={`/app/clientes/${cliente.id}/editar`} className={c.acaoCorrigir}>
            Corrigir o cadastro do cliente
          </Link>
        </>
      )}
      {preparo.semLink && (
        <p>
          Esta cobrança ainda não possui link de pagamento, então não há o que enviar. O link aparece quando a cobrança é
          enviada ao parceiro de pagamentos.
        </p>
      )}
    </div>
  );
}

export function WhatsappPreparando() {
  return <span className={c.preparando}>Preparando o envio pelo WhatsApp…</span>;
}
