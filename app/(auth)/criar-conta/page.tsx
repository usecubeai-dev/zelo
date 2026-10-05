import type { Metadata } from "next";
import Link from "next/link";
import FormularioCadastro from "./FormularioCadastro";
import { indicacaoDoCookie } from "./acoes";
import { formatarCentavos } from "@/lib/dinheiro";
import { normalizarCodigo } from "@/lib/indicacao-codigo";
import {
  NOME_DO_PLANO,
  PRECO_POR_PLANO_CENTAVOS,
  TAXA_DE_RECEBIMENTO_CENTAVOS,
  ehPlano,
} from "@/lib/plano";
import c from "./Cadastro.module.css";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta na Zelo e escolha o plano para organizar suas cobranças recorrentes.",
  robots: { index: false, follow: true },
};

type Parametros = { ref?: string | string[]; plano?: string | string[] };

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
        {planoEscolhido
          ? `Plano ${NOME_DO_PLANO[planoEscolhido]} · ${formatarCentavos(PRECO_POR_PLANO_CENTAVOS[planoEscolhido])}/mês + ${formatarCentavos(TAXA_DE_RECEBIMENTO_CENTAVOS)} por recebimento`
          : `Planos a partir de ${formatarCentavos(PRECO_POR_PLANO_CENTAVOS.essencial)}/mês · você escolhe o plano logo após criar a conta`}
      </span>
      {planoEscolhido && (
        <p className={c.ofertaNota}>
          Você confirma o plano e gera o pagamento logo depois de criar a conta. Sua conta é liberada assim que o
          primeiro pagamento for confirmado.
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
