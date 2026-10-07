"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { conectarContaFinanceira, sincronizarContaFinanceira, reconciliarContaFinanceiraAcao } from "./acoes";
import { descricaoDoEstado, type ContaFinanceira as ContaFinanceiraTipo, type SituacaoContaAsaas } from "@/lib/core/conta-financeira";
import type { DocumentoPendenteAsaas } from "@/lib/asaas/conta";
import type { CriarSubcontaDados } from "@/lib/asaas/subconta";
import {
  TIPOS_DE_EMPRESA,
  mascararCelular,
  mascararCep,
  mascararDocumento,
  tipoDePessoa,
  validarDadosDaSubconta,
  type CampoSubconta,
  type ErrosSubconta,
} from "@/lib/core/dados-subconta";
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

function camposVazios(documentoEmpresa: string | null): CriarSubcontaDados {
  return {
    name: "",
    email: "",
    // Reaproveita o CPF/CNPJ já salvo em "Dados da Empresa" — evita pedir
    // o mesmo dado duas vezes na mesma tela (achado da auditoria de UX).
    cpfCnpj: mascararDocumento(documentoEmpresa ?? ""),
    mobilePhone: "",
    incomeValue: 0,
    address: "",
    addressNumber: "",
    province: "",
    postalCode: "",
    birthDate: "",
  };
}

/** campo → id do elemento que recebe o foco quando há erro */
const ID_DO_CAMPO: Record<CampoSubconta, string> = {
  name: "cf-name",
  email: "cf-email",
  cpfCnpj: "cf-doc",
  birthDate: "cf-nasc",
  companyType: "cf-tipo",
  mobilePhone: "cf-tel",
  incomeValue: "cf-renda",
  postalCode: "cf-cep",
  address: "cf-endereco",
  addressNumber: "cf-numero",
  province: "cf-bairro",
};

const HOJE_ISO = () => new Date().toISOString().slice(0, 10);

/** rótulo + controle + dica/erro, ligados por id para leitor de tela */
function Campo({
  id,
  rotulo,
  erro,
  dica,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={s.campoApp}>
      <label htmlFor={id}>{rotulo}</label>
      {children}
      {erro ? (
        <p id={`${id}-erro`} className={s.erroCampo}>⚠ {erro}</p>
      ) : dica ? (
        <p id={`${id}-dica`} className={s.dicaCampo}>{dica}</p>
      ) : null}
    </div>
  );
}

export default function ContaFinanceira({
  inicial,
  documentoEmpresa = null,
}: {
  inicial: ContaFinanceiraTipo | null;
  /** CPF/CNPJ já salvo em "Dados da Empresa" — só dígitos, ou `null` se ainda não preenchido. */
  documentoEmpresa?: string | null;
}) {
  const router = useRouter();
  const [conta, setConta] = useState(inicial);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [dados, setDados] = useState<CriarSubcontaDados>(() => camposVazios(documentoEmpresa));
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [erros, setErros] = useState<ErrosSubconta>({});
  const foco = useRef<CampoSubconta | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [situacao, setSituacao] = useState<SituacaoContaAsaas | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoPendenteAsaas[]>([]);
  const [verificando, setVerificando] = useState(false);
  const [verificado, setVerificado] = useState(false);

  const texto = textoDoEstado(conta, situacao);
  const pessoa = tipoDePessoa(dados.cpfCnpj);

  /* Depois de uma validação com erro: leva o foco e a rolagem até o PRIMEIRO campo com erro. */
  useEffect(() => {
    const campo = foco.current;
    if (!campo || !erros[campo]) return;
    foco.current = null;
    const el = document.getElementById(ID_DO_CAMPO[campo]);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    el?.focus({ preventScroll: true });
  }, [erros]);

  const confirmarVerificacao = () => {
    setVerificado(true);
    setTimeout(() => setVerificado(false), 2500);
  };

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
    confirmarVerificacao();
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
    confirmarVerificacao();
    router.refresh();
  };

  const atualizar = (campo: keyof CriarSubcontaDados, valor: string) => {
    const v =
      campo === "cpfCnpj"
        ? mascararDocumento(valor)
        : campo === "mobilePhone"
          ? mascararCelular(valor)
          : campo === "postalCode"
            ? mascararCep(valor)
            : valor;
    setDados((a) => ({ ...a, [campo]: campo === "incomeValue" ? Number(v) || 0 : v }));
    setErros((a) => ({ ...a, [campo]: undefined }));
    setErroGeral(null);
  };

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErroGeral(null);

    /* A tela avisa campo a campo; o servidor confere de novo e é quem decide. */
    const conferido = validarDadosDaSubconta(dados);
    if (!conferido.ok) {
      foco.current = conferido.primeiroCampo;
      setErros(conferido.erros);
      return;
    }

    setEnviando(true);
    const r = await conectarContaFinanceira(conferido.dados);
    setEnviando(false);

    if (!r.ok) {
      if (r.erros) {
        const primeiro = (Object.keys(r.erros) as CampoSubconta[]).find((c) => r.erros?.[c]);
        foco.current = primeiro ?? null;
        setErros(r.erros);
      }
      setErroGeral(r.mensagem);
      return;
    }

    setErros({});
    setConta(r.conta);
    setMostrarFormulario(false);
    router.refresh();
  };

  return (
    <section className={s.cartaoSelo} data-tom={texto.tom}>
      <span className={s.seloLateral} aria-hidden="true" />
      <div className={s.cartaoCorpo}>
        <h2 className={s.cartaoTitulo}>{texto.titulo}</h2>
        <p className={s.cartaoDetalhe}>{texto.detalhe}</p>

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

        {/* Conexão recusada: sem isto a pessoa ficava presa, só com "Verificar novamente" (que apenas consulta).
            O servidor já aceita uma nova tentativa nesse estado. */}
        {conta?.estadoOnboarding === "recusada" && !mostrarFormulario && (
          <button type="button" className={s.botao} style={{ marginLeft: 8 }} onClick={() => setMostrarFormulario(true)}>
            Corrigir dados e tentar de novo
          </button>
        )}

        {conta?.estadoOnboarding === "bloqueada" && (
          <a className={s.botao} href="mailto:usecube.ai@gmail.com">
            Falar com o suporte
          </a>
        )}

        {conta?.estadoOnboarding === "criada" && conta.statusAprovacao !== "APPROVED" && (
          <button type="button" className={s.botaoSec} onClick={verificarStatus} disabled={verificando}>
            {verificando ? "Verificando…" : "Verificar status agora"}
          </button>
        )}

        <p className={s.cartaoConfirmacao} role="status" aria-live="polite" hidden={!verificado}>
          {verificado ? "Verificado agora." : ""}
        </p>
      </div>

      {mostrarFormulario && (
        <div className={s.formComPainel} data-formulario>
        <form className={s.formApp} noValidate onSubmit={enviar}>
          <p className={s.dicaCampo} style={{ marginBottom: 4 }}>
            Esses dados são exigidos pelo nosso parceiro financeiro para configurar sua conta de recebimento
            e garantir que os pagamentos caiam corretamente para você. É a mesma verificação que qualquer banco faz
            antes de liberar uma conta para receber dinheiro.
          </p>

          <div className={s.erroForm} role="alert" aria-live="assertive" hidden={!erroGeral}>
            {erroGeral}
          </div>

          <fieldset className={cs.secao}>
            <legend className={cs.secaoTitulo}>
              <span className={cs.secaoNumero} aria-hidden="true">1</span> Quem é o titular
            </legend>
            <Campo id="cf-name" rotulo="Nome completo ou razão social" erro={erros.name}>
              <input id="cf-name" autoComplete="name" value={dados.name} onChange={(e) => atualizar("name", e.target.value)} aria-invalid={Boolean(erros.name)} aria-describedby={erros.name ? "cf-name-erro" : undefined} />
            </Campo>
            <Campo id="cf-email" rotulo="E-mail" erro={erros.email}>
              <input id="cf-email" type="email" autoComplete="email" value={dados.email} onChange={(e) => atualizar("email", e.target.value)} aria-invalid={Boolean(erros.email)} aria-describedby={erros.email ? "cf-email-erro" : undefined} />
            </Campo>
            <div className={s.duplaColuna}>
              <Campo
                id="cf-doc"
                rotulo="CPF ou CNPJ"
                erro={erros.cpfCnpj}
                dica={
                  documentoEmpresa
                    ? "Já preenchido com o CPF/CNPJ salvo em “Dados da Empresa”."
                    : "CPF para pessoa física; CNPJ para empresa."
                }
              >
                <input id="cf-doc" inputMode="numeric" autoComplete="off" value={dados.cpfCnpj} onChange={(e) => atualizar("cpfCnpj", e.target.value)} aria-invalid={Boolean(erros.cpfCnpj)} aria-describedby={erros.cpfCnpj ? "cf-doc-erro" : "cf-doc-dica"} />
              </Campo>

              {pessoa === "fisica" && (
                <Campo id="cf-nasc" rotulo="Data de nascimento" erro={erros.birthDate} dica="O parceiro financeiro exige para pessoa física.">
                  <input id="cf-nasc" type="date" autoComplete="bday" max={HOJE_ISO()} value={dados.birthDate ?? ""} onChange={(e) => atualizar("birthDate", e.target.value)} aria-invalid={Boolean(erros.birthDate)} aria-describedby={erros.birthDate ? "cf-nasc-erro" : "cf-nasc-dica"} />
                </Campo>
              )}
              {pessoa === "juridica" && (
                <Campo id="cf-tipo" rotulo="Tipo da empresa" erro={erros.companyType}>
                  <select id="cf-tipo" value={dados.companyType ?? ""} onChange={(e) => atualizar("companyType", e.target.value)} aria-invalid={Boolean(erros.companyType)} aria-describedby={erros.companyType ? "cf-tipo-erro" : undefined}>
                    <option value="">Selecione</option>
                    {TIPOS_DE_EMPRESA.map((tp) => (
                      <option key={tp.valor} value={tp.valor}>{tp.rotulo}</option>
                    ))}
                  </select>
                </Campo>
              )}
            </div>
          </fieldset>

          <fieldset className={cs.secao}>
            <legend className={cs.secaoTitulo}>
              <span className={cs.secaoNumero} aria-hidden="true">2</span> Contato e faturamento
            </legend>
            <div className={s.duplaColuna}>
              <Campo id="cf-tel" rotulo="Celular com DDD" erro={erros.mobilePhone}>
                <input id="cf-tel" type="tel" inputMode="tel" autoComplete="tel-national" value={dados.mobilePhone} onChange={(e) => atualizar("mobilePhone", e.target.value)} aria-invalid={Boolean(erros.mobilePhone)} aria-describedby={erros.mobilePhone ? "cf-tel-erro" : undefined} />
              </Campo>
              <Campo id="cf-renda" rotulo="Renda ou faturamento mensal (R$)" erro={erros.incomeValue} dica="Um valor aproximado. Não afeta suas cobranças nem o que você recebe.">
                <input id="cf-renda" type="number" inputMode="decimal" min="0" value={dados.incomeValue || ""} onChange={(e) => atualizar("incomeValue", e.target.value)} aria-invalid={Boolean(erros.incomeValue)} aria-describedby={erros.incomeValue ? "cf-renda-erro" : "cf-renda-dica"} />
              </Campo>
            </div>
          </fieldset>

          <fieldset className={cs.secao}>
            <legend className={cs.secaoTitulo}>
              <span className={cs.secaoNumero} aria-hidden="true">3</span> Endereço
            </legend>
            <div className={s.duplaColuna}>
              <Campo id="cf-cep" rotulo="CEP" erro={erros.postalCode}>
                <input id="cf-cep" inputMode="numeric" autoComplete="postal-code" value={dados.postalCode} onChange={(e) => atualizar("postalCode", e.target.value)} aria-invalid={Boolean(erros.postalCode)} aria-describedby={erros.postalCode ? "cf-cep-erro" : undefined} />
              </Campo>
              <Campo id="cf-numero" rotulo="Número" erro={erros.addressNumber}>
                <input id="cf-numero" autoComplete="off" value={dados.addressNumber} onChange={(e) => atualizar("addressNumber", e.target.value)} aria-invalid={Boolean(erros.addressNumber)} aria-describedby={erros.addressNumber ? "cf-numero-erro" : undefined} />
              </Campo>
            </div>
            <Campo id="cf-endereco" rotulo="Rua ou avenida" erro={erros.address}>
              <input id="cf-endereco" autoComplete="address-line1" value={dados.address} onChange={(e) => atualizar("address", e.target.value)} aria-invalid={Boolean(erros.address)} aria-describedby={erros.address ? "cf-endereco-erro" : undefined} />
            </Campo>
            <Campo id="cf-bairro" rotulo="Bairro" erro={erros.province}>
              <input id="cf-bairro" autoComplete="off" value={dados.province} onChange={(e) => atualizar("province", e.target.value)} aria-invalid={Boolean(erros.province)} aria-describedby={erros.province ? "cf-bairro-erro" : undefined} />
            </Campo>
          </fieldset>

          <div className={s.acoes}>
            <button type="submit" className={s.botao} disabled={enviando}>
              {enviando ? "Conectando…" : "Conectar conta"}
            </button>
            <button type="button" className={s.botaoSec} onClick={() => setMostrarFormulario(false)} disabled={enviando}>
              Cancelar
            </button>
          </div>
        </form>

        <aside className={s.painelAjuda} aria-label="Sobre a conta de recebimentos">
          <svg viewBox="0 0 200 130" aria-hidden="true" focusable="false">
            <rect x="20" y="52" width="160" height="62" rx="10" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2" />
            <path d="M20 66h160" stroke="var(--border-strong)" strokeWidth="2" />
            <rect x="34" y="82" width="46" height="8" rx="4" fill="var(--violet)" opacity="0.55" />
            <rect x="34" y="96" width="30" height="6" rx="3" fill="var(--violet)" opacity="0.25" />
            <path d="M100 6l30 11v22c0 17-12 29-30 35-18-6-30-18-30-35V17z" fill="var(--violet)" />
            <path d="M86 40l10 10 19-21" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h3>Por que pedimos esses dados?</h3>
          <ul>
            <li>São os dados que o parceiro financeiro exige para abrir sua conta de recebimento.</li>
            <li>O Zelo nunca pede a senha do seu banco.</li>
            <li>Depois de enviar, você acompanha a análise aqui mesmo, em &quot;Verificar status agora&quot;.</li>
          </ul>
        </aside>
        </div>
      )}
    </section>
  );
}
