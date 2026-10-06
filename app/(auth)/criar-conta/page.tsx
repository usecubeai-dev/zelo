import type { Metadata } from "next";
import Link from "next/link";
import FormularioCadastro from "./FormularioCadastro";
import { indicacaoDoCookie } from "./acoes";
import { formatarCentavos } from "@/lib/dinheiro";
import AvisoTaxa from "@/components/AvisoTaxa";
import { normalizarCodigo } from "@/lib/indicacao-codigo";
import {
  LIMITE_DE_CLIENTES,
  NOME_DO_PLANO,
  PRECO_POR_PLANO_CENTAVOS,
  TEXTO_TAXA,
  ehPlano,
  planoPago,
  type Plano,
} from "@/lib/plano";
import c from "./Cadastro.module.css";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta na Zelo, comece no plano Grátis ou escolha um plano para organizar suas cobranças recorrentes.",
  robots: { index: false, follow: true },
};

type Parametros = { ref?: string | string[]; plano?: string | string[] };

/* Oferta honesta, sem trial: o Grátis é um plano permanente, e a taxa por
   Pix recebido aparece junto do preço para ninguém descobrir depois. */
function textoDaOferta(plano: Plano | null): string {
  if (!plano) {
    return `Comece no plano Grátis (até ${LIMITE_DE_CLIENTES.gratis} clientes) ou escolha um plano a partir de ${formatarCentavos(PRECO_POR_PLANO_CENTAVOS.essencial)}/mês ${TEXTO_TAXA} · você escolhe logo após criar a conta`;
  }
  if (!planoPago(plano)) {
    return `Plano ${NOME_DO_PLANO[plano]} · sem mensalidade ${TEXTO_TAXA}`;
  }
  return `Plano ${NOME_DO_PLANO[plano]} · ${formatarCentavos(PRECO_POR_PLANO_CENTAVOS[plano])}/mês ${TEXTO_TAXA}`;
}

/** `?ref=` pode vir repetido (`?ref=A&ref=B`): vale o primeiro. */
const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CriarConta({ searchParams }: { searchParams: Promise<Parametros> }) {
  const params = await searchParams;

  /* O link ganha do cookie: quem clicou agora num link de indicação mostra a
     intenção mais recente. Aqui só o FORMATO é checado — a validade real
     (código existente e ativo) é do banco, no vínculo. O nome do
     influenciador nunca é exibido. */
  const indicacao = normalizarCodigo(primeiro(params.ref)) ?? (await indicacaoDoCookie());

  const planoParam = primeiro(params.plano);
  const planoEscolhido = ehPlano(planoParam) ? planoParam : null;

  return (
    <>
      <h1 className={c.titulo}>Crie sua conta</h1>
      <p className={c.lead}>Comece a organizar seus recebimentos com o Zelo.</p>

      <span className={c.oferta}>
        <span className={c.ofertaPonto} aria-hidden="true" />
        {textoDaOferta(planoEscolhido)}
      </span>
      <div className={c.ofertaNota}>
        <AvisoTaxa somenteNota />
      </div>
      {planoEscolhido && (
        <p className={c.ofertaNota}>
          {planoPago(planoEscolhido)
            ? "Você confirma o plano e gera o pagamento logo depois de criar a conta. Sua conta é liberada assim que o primeiro pagamento for confirmado."
            : "Você confirma o plano Grátis logo depois de criar a conta, sem pagamento nem prazo. Se precisar de mais clientes, é só contratar um plano depois."}
        </p>
      )}

      <FormularioCadastro indicacao={indicacao} planoEscolhido={planoEscolhido} />

      <div className={c.rodape}>
        <span>
          Já tem uma conta?{" "}
          <Link href="/entrar" className={c.link}>
            Entrar
          </Link>
        </span>
      </div>
    </>
  );
}
