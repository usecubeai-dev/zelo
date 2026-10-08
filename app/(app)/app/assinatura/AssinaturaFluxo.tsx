"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plano, planoPago } from "@/lib/plano";
import type { PagamentoDaAssinatura } from "@/lib/core/pagamento-assinatura";
import { assinarPlano } from "./acoes";
import PlanosPremium from "./PlanosPremium";
import ConfirmarPlano from "./ConfirmarPlano";
import CheckoutPagamento from "./CheckoutPagamento";
import s from "../../App.module.css";
import c from "./Checkout.module.css";

type Etapa = "planos" | "confirmar" | "pagamento" | "gratis";

type Props = {
  /** plano pré-selecionado (vindo da URL, do cadastro ou do destaque) */
  planoInicial: Plano;
  /** a pessoa já chegou com um plano em mente (link da landing / cadastro): começa na confirmação */
  iniciarNaConfirmacao: boolean;
  /** só dígitos (ou vazio) */
  documentoInicial: string;
  /** só o dono da conta pode assinar — o servidor também exige */
  podeAssinar: boolean;
  /** `getAsaasConfiguration().isConfigured`, lido no servidor */
  pagamentoDisponivel: boolean;
  /** pagamento que já estava em aberto quando a página carregou (retomada) */
  pagamentoEmAberto: PagamentoDaAssinatura | null;
  /** conta já liberada (ativa no Grátis): o plano pago só vale quando o pagamento for confirmado */
  contaLiberada: boolean;
  planoVigente: Plano | null;
  /** só o administrador do Zelo: acrescenta o plano de teste ao fim da lista */
  incluirPlanoDeTeste?: boolean;
};

const ORDEM: { id: Etapa; rotulo: string }[] = [
  { id: "planos", rotulo: "Plano" },
  { id: "confirmar", rotulo: "Confirmação" },
  { id: "pagamento", rotulo: "Pagamento" },
];

/**
 * Escolher plano → entender o que contrata → confirmar → pagar → entrar no Zelo.
 *
 * Todas as regras vêm do servidor: o preço sai de `lib/plano.ts`, a empresa vem
 * da sessão e a assinatura só vira "ativa" quando o pagamento é confirmado pelo
 * backend. Aqui só se conduz a pessoa, passo a passo.
 */
export default function AssinaturaFluxo({
  planoInicial,
  iniciarNaConfirmacao,
  documentoInicial,
  podeAssinar,
  pagamentoDisponivel,
  pagamentoEmAberto,
  contaLiberada,
  planoVigente,
  incluirPlanoDeTeste = false,
}: Props) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>(pagamentoEmAberto ? "pagamento" : iniciarNaConfirmacao && podeAssinar ? "confirmar" : "planos");
  const [plano, setPlano] = useState<Plano>(pagamentoEmAberto?.plano ?? planoInicial);
  const [ativando, setAtivando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const tituloGratis = useRef<HTMLHeadingElement>(null);

  /* o foco acompanha a etapa: leitor de tela e teclado nunca ficam "perdidos" */
  useEffect(() => {
    if (etapa === "gratis") tituloGratis.current?.focus();
  }, [etapa]);

  const escolher = (p: Plano) => {
    setPlano(p);
    setErro(null);
    setEtapa("confirmar");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const continuar = async () => {
    setErro(null);
    if (planoPago(plano)) {
      setEtapa("pagamento");
      return;
    }
    // Grátis: ativa na hora, sem pagamento
    setAtivando(true);
    try {
      const r = await assinarPlano(plano, "");
      if (!r.ok) {
        setErro(r.mensagem);
        return;
      }
      setEtapa("gratis");
      router.refresh();
    } catch {
      setErro("Não foi possível ativar o plano agora. Tente novamente em instantes.");
    } finally {
      setAtivando(false);
    }
  };

  const alterar = () => {
    setErro(null);
    setEtapa("planos");
  };

  if (etapa === "gratis") {
    return (
      <div className={c.raiz}>
        <section className={c.sucesso} aria-labelledby="gratis-titulo">
          <span className={c.sucessoIcone} aria-hidden="true">
            ✓
          </span>
          <h2 id="gratis-titulo" ref={tituloGratis} tabIndex={-1} className={c.sucessoTitulo}>
            Plano Grátis ativado
          </h2>
          <p className={c.sucessoPlano}>
            Sua conta está liberada. O plano Grátis não tem mensalidade nem prazo: ele não expira. Se um dia precisar de mais clientes, é só contratar
            um plano aqui em Assinatura.
          </p>
          <div className={c.sucessoAcoes}>
            <Link className={`${c.botaoGrande} ${c.botaoSucesso}`} href="/app">
              Ir para meu painel
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const indice = ORDEM.findIndex((o) => o.id === etapa);

  return (
    <div className={c.raiz}>
      {etapa === "planos" && (
        <header className={c.cabecalho}>
          <h2 id="titulo-planos" className={c.titulo}>
            Escolha o plano ideal para o seu negócio
          </h2>
          <p className={c.subtitulo}>Tenha mais controle das suas cobranças, recebimentos e do seu negócio.</p>
        </header>
      )}

      <ol className={c.etapas} aria-label="Etapas da assinatura">
        {ORDEM.map((o, i) => (
          <li
            key={o.id}
            className={`${c.etapa} ${i === indice ? c.etapaAtual : ""} ${i < indice ? c.etapaFeita : ""}`}
            aria-current={i === indice ? "step" : undefined}
          >
            <span className={c.etapaNumero} aria-hidden="true">
              {i < indice ? "✓" : String(i + 1).padStart(2, "0")}
            </span>
            {o.rotulo}
          </li>
        ))}
      </ol>

      {etapa === "planos" && (
        <PlanosPremium
          planoVigente={planoVigente}
          incluirPlanoDeTeste={incluirPlanoDeTeste}
          podeAssinar={podeAssinar}
          aoEscolher={escolher}
        />
      )}

      {etapa === "confirmar" && (
        <ConfirmarPlano plano={plano} ocupado={ativando} erro={erro} aoContinuar={continuar} aoAlterar={alterar} />
      )}

      {etapa === "pagamento" && (
        <CheckoutPagamento
          plano={plano}
          documentoInicial={documentoInicial}
          pagamentoInicial={pagamentoEmAberto}
          contaLiberada={contaLiberada}
          pagamentoDisponivel={pagamentoDisponivel}
          aoAlterarPlano={alterar}
        />
      )}

      {etapa === "planos" && podeAssinar && (
        <p className={s.dicaCampo} style={{ margin: 0 }}>
          Dúvidas? Você escolhe agora e só paga na etapa final. Sua assinatura só começa quando o pagamento é confirmado.
        </p>
      )}
    </div>
  );
}

