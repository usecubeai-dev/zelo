"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { conectarContaFinanceira, sincronizarContaFinanceira, reconciliarContaFinanceiraAcao } from "./acoes";
import { descricaoDoEstado, type ContaFinanceira as ContaFinanceiraTipo, type SituacaoContaAsaas } from "@/lib/core/conta-financeira";
import type { DocumentoPendenteAsaas } from "@/lib/asaas/conta";
import type { CriarSubcontaDados } from "@/lib/asaas/subconta";
import s from "../../App.module.css";
import cs from "./ContaFinanceira.module.css";

function textoDoEstado(conta: ContaFinanceiraTipo | null, situacao: SituacaoContaAsaas | null) {
  if (!conta) {
    return descricaoDoEstado({ estadoOnboarding: "nao_iniciada", statusAprovacao: null }, null);
  }
  return descricaoDoEstado(conta, situacao);
}

const NOMES_DOCUMENTO: Record<string, string> = {
  PENDING: "em análise",
  NOT_SENT: "não enviado",
  REJECTED: "recusado — reenvio necessário",
  APPROVED: "aprovado",
  IGNORED: "dispensado",
};

const CAMPOS_VAZIOS: CriarSubcontaDados = {
  name: "",
  email: "",
  cpfCnpj: "",
  mobilePhone: "",
  incomeValue: 0,
  address: "",
  addressNumber: "",
  province: "",
  postalCode: "",
};

export default function ContaFinanceira({ inicial }: { inicial: ContaFinanceiraTipo | null }) {
  const router = useRouter();
  const [conta, setConta] = useState(inicial);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [dados, setDados] = useState<CriarSubcontaDados>(CAMPOS_VAZIOS);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [situacao, setSituacao] = useState<SituacaoContaAsaas | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoPendenteAsaas[]>([]);
  const [verificando, setVerificando] = useState(false);

  const texto = textoDoEstado(conta, situacao);

  const verificarStatus = async () => {
    setVerificando(true);
    setErroGeral(null);
    const r = await sincronizarContaFinanceira();
    setVerificando(false);
    if (!r.ok) {
      setErroGeral(r.mensagem);
      return;
    }
    setSituacao(r.situacao);
    setDocumentos(r.documentosPendentes.filter((d) => d.status !== "APPROVED" && d.status !== "IGNORED"));
    router.refresh();
  };

  const tentarReconciliar = async () => {
    setVerificando(true);
    setErroGeral(null);
    const r = await reconciliarContaFinanceiraAcao();
    setVerificando(false);
    if (!r.ok) {
      setErroGeral(r.mensagem);
      return;
    }
    setConta(r.conta);
    router.refresh();
  };

  const atualizar = (campo: keyof CriarSubcontaDados, valor: string) => {
    setDados((a) => ({ ...a, [campo]: campo === "incomeValue" ? Number(valor) || 0 : valor }));
  };

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErroGeral(null);
    setEnviando(true);

    const r = await conectarContaFinanceira(dados);
    setEnviando(false);

    if (!r.ok) {
      setErroGeral(r.mensagem);
      return;
    }

    setConta(r.conta);
    setMostrarFormulario(false);
    router.refresh();
  };

  return (
    <section className={cs.cartao} data-tom={texto.tom}>
      <span className={cs.selo} aria-hidden="true" />
      <div className={cs.corpo}>
        <h2 className={cs.titulo}>{texto.titulo}</h2>
        <p className={cs.detalhe}>{texto.detalhe}</p>

        {conta?.asaasAccountId && (
          <p className={s.dicaCampo}>
            Conta: ····{conta.asaasAccountId.slice(-6)}
            {conta.conectadoEm && ` · conectada em ${new Date(conta.conectadoEm).toLocaleDateString("pt-BR")}`}
          </p>
        )}

        {erroGeral && !mostrarFormulario && (
          <div className={s.erroForm} role="alert">
            {erroGeral}
          </div>
        )}

        {documentos.length > 0 && (
          <ul className={cs.listaDocumentos}>
            {documentos.map((doc) => (
              <li key={doc.id}>
                <span>{doc.title}</span>
                <span className={cs.statusDocumento}>{NOMES_DOCUMENTO[doc.status] ?? doc.status}</span>
                {doc.onboardingUrl && (
                  <a href={doc.onboardingUrl} target="_blank" rel="noreferrer noopener">
                    Enviar documento
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}

        {(!conta || conta.estadoOnboarding === "nao_iniciada") && !mostrarFormulario && (
          <button type="button" className={s.botao} onClick={() => setMostrarFormulario(true)}>
            Configurar agora
          </button>
        )}

        {conta && (conta.estadoOnboarding === "criando" || conta.estadoOnboarding === "recusada") && (
          <button type="button" className={s.botaoSec} onClick={tentarReconciliar} disabled={verificando}>
            {verificando ? "Verificando…" : "Verificar novamente"}
          </button>
        )}

        {conta?.estadoOnboarding === "bloqueada" && (
          <a className={s.botao} href="mailto:suporte@zelopay.com.br">
            Falar com o suporte
          </a>
        )}

        {conta?.estadoOnboarding === "criada" && conta.statusAprovacao !== "APPROVED" && (
          <button type="button" className={s.botaoSec} onClick={verificarStatus} disabled={verificando}>
            {verificando ? "Verificando…" : "Verificar status agora"}
          </button>
        )}
      </div>

      {mostrarFormulario && (
        <form className={s.formApp} noValidate onSubmit={enviar}>
          {erroGeral && (
            <div className={s.erroForm} role="alert">
              {erroGeral}
            </div>
          )}

          <div className={s.campoApp}>
            <label htmlFor="cf-name">Nome completo ou razão social</label>
            <input id="cf-name" value={dados.name} onChange={(e) => atualizar("name", e.target.value)} required />
          </div>
          <div className={s.campoApp}>
            <label htmlFor="cf-email">E-mail</label>
            <input id="cf-email" type="email" value={dados.email} onChange={(e) => atualizar("email", e.target.value)} required />
          </div>
          <div className={s.campoApp}>
            <label htmlFor="cf-doc">CPF ou CNPJ</label>
            <input id="cf-doc" value={dados.cpfCnpj} onChange={(e) => atualizar("cpfCnpj", e.target.value)} required />
          </div>
          <div className={s.campoApp}>
            <label htmlFor="cf-tel">Celular</label>
            <input id="cf-tel" value={dados.mobilePhone} onChange={(e) => atualizar("mobilePhone", e.target.value)} required />
          </div>
          <div className={s.campoApp}>
            <label htmlFor="cf-renda">Renda ou faturamento mensal (R$)</label>
            <input
              id="cf-renda"
              type="number"
              min="0"
              value={dados.incomeValue || ""}
              onChange={(e) => atualizar("incomeValue", e.target.value)}
              required
            />
          </div>
          <div className={s.campoApp}>
            <label htmlFor="cf-cep">CEP</label>
            <input id="cf-cep" value={dados.postalCode} onChange={(e) => atualizar("postalCode", e.target.value)} required />
          </div>
          <div className={s.campoApp}>
            <label htmlFor="cf-endereco">Endereço</label>
            <input id="cf-endereco" value={dados.address} onChange={(e) => atualizar("address", e.target.value)} required />
          </div>
          <div className={s.campoApp}>
            <label htmlFor="cf-numero">Número</label>
            <input id="cf-numero" value={dados.addressNumber} onChange={(e) => atualizar("addressNumber", e.target.value)} required />
          </div>
          <div className={s.campoApp}>
            <label htmlFor="cf-bairro">Bairro</label>
            <input id="cf-bairro" value={dados.province} onChange={(e) => atualizar("province", e.target.value)} required />
          </div>

          <div className={s.acoes}>
            <button type="submit" className={s.botao} disabled={enviando}>
              {enviando ? "Conectando…" : "Conectar conta"}
            </button>
            <button type="button" className={s.botaoSec} onClick={() => setMostrarFormulario(false)} disabled={enviando}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
