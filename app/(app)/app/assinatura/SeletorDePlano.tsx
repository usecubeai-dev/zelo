"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assinarPlano } from "./acoes";
import { formatarCentavos } from "@/lib/dinheiro";
import { soDigitos } from "@/lib/cliente";
import {
  LIMITE_DE_CLIENTES,
  LIMITE_DE_COBRANCAS_MENSAL,
  NOME_DO_PLANO,
  PLANO_EM_DESTAQUE,
  PRECO_POR_PLANO_CENTAVOS,
  TAXA_DE_RECEBIMENTO_CENTAVOS,
  type Plano,
} from "@/lib/plano";
import s from "../../App.module.css";
import c from "./Assinatura.module.css";

const PLANOS: Plano[] = ["essencial", "profissional", "premium"];
const TAXA = formatarCentavos(TAXA_DE_RECEBIMENTO_CENTAVOS);

/** CPF até 11 dígitos, CNPJ de 12 a 14 — máscara progressiva, enquanto a pessoa digita. */
function mascararDocumento(valor: string): string {
  const d = soDigitos(valor).slice(0, 14);
  if (d.length <= 11) {
    const [a, b, e, f] = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)];
    return a + (b ? `.${b}` : "") + (e ? `.${e}` : "") + (f ? `-${f}` : "");
  }
  const [a, b, e, f, g] = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)];
  return `${a}.${b}.${e}/${f}${g ? `-${g}` : ""}`;
}

type Cobranca = { plano: Plano; linkPagamento: string | null };

type Props = {
  planoInicial: Plano;
  /** só dígitos (ou vazio) */
  documentoInicial: string;
  /** só o dono da conta pode assinar — o servidor também exige */
  podeAssinar: boolean;
  /** `getAsaasConfiguration().isConfigured`, lido no servidor */
  pagamentoDisponivel: boolean;
  /** cobrança que já estava em aberto quando a página carregou */
  cobrancaEmAberto: Cobranca | null;
  /** texto do botão e do título do seletor, conforme a situação da conta */
  tituloSeletor: string;
  rotuloBotao: string;
};

/**
 * Escolha do plano + geração da cobrança da mensalidade.
 *
 * Nada aqui ativa a conta: "Gerar cobrança" só cria a fatura no provedor
 * (a conta continua pendente) e a ativação acontece sozinha quando o
 * pagamento é CONFIRMADO pelo webhook. O preço mostrado é só de leitura —
 * o servidor decide o valor a partir do plano e ignora qualquer número do
 * navegador.
 */
export default function SeletorDePlano({
  planoInicial,
  documentoInicial,
  podeAssinar,
  pagamentoDisponivel,
  cobrancaEmAberto,
  tituloSeletor,
  rotuloBotao,
}: Props) {
  const router = useRouter();
  const [plano, setPlano] = useState<Plano>(planoInicial);
  const [documento, setDocumento] = useState(mascararDocumento(documentoInicial));
  const [erroDocumento, setErroDocumento] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [cobranca, setCobranca] = useState<Cobranca | null>(cobrancaEmAberto);
  const [trocando, setTrocando] = useState(false);
  const [atualizando, iniciarAtualizacao] = useTransition();
  const [verificou, setVerificou] = useState(false);

  const tituloCobranca = useRef<HTMLHeadingElement>(null);
  const campoDocumento = useRef<HTMLInputElement>(null);
  const focarCobranca = useRef(false);

  /* Depois de gerar a cobrança, o foco vai para o resumo: quem usa leitor
     de tela ou teclado precisa cair no botão "Pagar agora", não ficar no
     formulário que acabou de sumir. */
  useEffect(() => {
    if (cobranca && focarCobranca.current) {
      tituloCobranca.current?.focus();
      focarCobranca.current = false;
    }
  }, [cobranca]);

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (enviando) return;
    setErroGeral(null);

    const digitos = soDigitos(documento);
    if (digitos.length !== 11 && digitos.length !== 14) {
      setErroDocumento("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).");
      campoDocumento.current?.focus();
      return;
    }
    setErroDocumento(null);

    setEnviando(true);
    try {
      const r = await assinarPlano(plano, digitos);
      if (!r.ok) {
        setErroGeral(r.mensagem);
        if (r.codigo === "documento_invalido") campoDocumento.current?.focus();
        return;
      }
      focarCobranca.current = true;
      setVerificou(false);
      setTrocando(false);
      setCobranca({ plano: r.plano, linkPagamento: r.linkPagamento });
    } catch {
      setErroGeral("Não foi possível gerar a cobrança agora. Tente novamente em instantes.");
    } finally {
      setEnviando(false);
    }
  };

  const atualizar = () => {
    setVerificou(false);
    iniciarAtualizacao(() => {
      router.refresh();
    });
  };

  /* quando a transição termina e a conta continua aqui, o pagamento ainda
     não foi confirmado — avisa em vez de parecer que nada aconteceu */
  const jaAtualizou = useRef(false);
  useEffect(() => {
    if (atualizando) {
      jaAtualizou.current = true;
    } else if (jaAtualizou.current) {
      jaAtualizou.current = false;
      setVerificou(true);
    }
  }, [atualizando]);

  const mostrarSeletor = !cobranca || trocando;

  return (
    <div className={c.raiz}>
      {cobranca && (
        <section className={c.cobranca} aria-labelledby="cobranca-titulo">
          <h2 id="cobranca-titulo" ref={tituloCobranca} tabIndex={-1} className={c.cobrancaTitulo}>
            Falta só o pagamento
          </h2>
          <dl className={c.resumo}>
            <div>
              <dt>Plano</dt>
              <dd>{NOME_DO_PLANO[cobranca.plano]}</dd>
            </div>
            <div>
              <dt>Mensalidade</dt>
              <dd className="tnum">{formatarCentavos(PRECO_POR_PLANO_CENTAVOS[cobranca.plano])}</dd>
            </div>
            <div>
              <dt>Por recebimento</dt>
              <dd className="tnum">{TAXA}</dd>
            </div>
          </dl>
          <p className={c.cobrancaTexto}>
            A assinatura começa quando o pagamento for confirmado — sua conta é liberada automaticamente, sem você
            precisar fazer mais nada.
          </p>

          <div className={c.cobrancaAcoes}>
            {cobranca.linkPagamento ? (
              <a
                className={`${s.botao} ${c.botaoGrande}`}
                href={cobranca.linkPagamento}
                target="_blank"
                rel="noopener noreferrer"
              >
                Pagar agora
                <span className={s.somenteLeitor}> (abre em nova aba)</span>
              </a>
            ) : (
              <p className={c.semLink}>
                O link de pagamento ainda não ficou disponível. Toque em atualizar em alguns instantes.
              </p>
            )}
            <button
              type="button"
              className={`${s.botaoSec} ${c.botaoGrande}`}
              onClick={atualizar}
              disabled={atualizando}
              aria-busy={atualizando}
            >
              {atualizando ? "Verificando…" : "Já paguei — atualizar"}
            </button>
          </div>

          <p className={c.status} role="status" aria-live="polite">
            {verificou && !atualizando
              ? "Ainda não recebemos a confirmação do pagamento. Pix costuma confirmar em instantes; boleto pode levar mais tempo. Sua conta é liberada assim que a confirmação chegar."
              : ""}
          </p>

          {podeAssinar && !trocando && pagamentoDisponivel && (
            <button type="button" className={c.linkBotao} onClick={() => setTrocando(true)}>
              Trocar de plano
            </button>
          )}
        </section>
      )}

      {mostrarSeletor && (
        <form className={c.seletor} noValidate onSubmit={enviar} aria-labelledby="seletor-titulo">
          <h2 id="seletor-titulo" className={c.seletorTitulo}>
            {cobranca ? "Trocar de plano" : tituloSeletor}
          </h2>

          {!podeAssinar ? (
            <p className={c.aviso}>Só o responsável pela conta pode escolher o plano e gerar o pagamento.</p>
          ) : (
            <>
              <fieldset className={c.planos}>
                <legend className={s.somenteLeitor}>Plano</legend>
                {PLANOS.map((p) => {
                  const marcado = plano === p;
                  return (
                    <label
                      key={p}
                      className={`${c.plano} ${marcado ? c.planoMarcado : ""}`}
                      data-destaque={p === PLANO_EM_DESTAQUE ? "true" : "false"}
                    >
                      <input
                        className={c.radio}
                        type="radio"
                        name="plano"
                        value={p}
                        checked={marcado}
                        onChange={() => setPlano(p)}
                      />
                      <span className={c.planoMarca} aria-hidden="true" />
                      <span className={c.planoCorpo}>
                        <span className={c.planoNomeLinha}>
                          <span className={c.planoNome}>{NOME_DO_PLANO[p]}</span>
                          {p === PLANO_EM_DESTAQUE && <span className={c.planoFita}>Mais escolhido</span>}
                        </span>
                        <span className={c.planoLimites}>
                          Até {LIMITE_DE_CLIENTES[p]} clientes ativos
                          <br />
                          {LIMITE_DE_COBRANCAS_MENSAL[p]} cobranças por mês
                        </span>
                      </span>
                      <span className={c.planoPreco}>
                        <span className={`${c.planoValor} tnum`}>{formatarCentavos(PRECO_POR_PLANO_CENTAVOS[p])}</span>
                        <span className={c.planoMes}>/mês</span>
                        <span className={c.planoTaxa}>+ {TAXA} por recebimento</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <div className={`${s.campoApp} ${c.campoDocumento}`}>
                <label htmlFor="documento">CPF ou CNPJ</label>
                <input
                  id="documento"
                  ref={campoDocumento}
                  name="documento"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  value={documento}
                  onChange={(e) => {
                    setDocumento(mascararDocumento(e.target.value));
                    setErroDocumento(null);
                    setErroGeral(null);
                  }}
                  aria-invalid={erroDocumento ? true : undefined}
                  aria-describedby={erroDocumento ? "documento-erro" : "documento-dica"}
                />
                {erroDocumento ? (
                  <span id="documento-erro" className={s.erroCampo} role="alert">
                    {erroDocumento}
                  </span>
                ) : (
                  <span id="documento-dica" className={s.dicaCampo}>
                    Necessário para gerar a cobrança da mensalidade.
                  </span>
                )}
              </div>

              <div className={c.erro} role="alert" aria-live="assertive" hidden={!erroGeral}>
                {erroGeral}
              </div>

              <p className={c.resumoEscolha}>
                <strong>{NOME_DO_PLANO[plano]}</strong> · {formatarCentavos(PRECO_POR_PLANO_CENTAVOS[plano])} por mês,
                mais {TAXA} por pagamento recebido. A assinatura começa quando o pagamento for confirmado.
              </p>

              {pagamentoDisponivel ? (
                <div className={c.formAcoes}>
                  <button
                    type="submit"
                    className={`${s.botao} ${c.botaoGrande}`}
                    disabled={enviando}
                    aria-busy={enviando}
                  >
                    {enviando && <span className={c.spinner} aria-hidden="true" />}
                    {enviando ? "Gerando cobrança…" : rotuloBotao}
                  </button>
                  {cobranca && (
                    <button type="button" className={s.botaoSec} onClick={() => setTrocando(false)}>
                      Cancelar
                    </button>
                  )}
                </div>
              ) : (
                <p className={c.aviso} role="status">
                  Pagamento indisponível no momento. Tente novamente em alguns instantes.
                </p>
              )}
            </>
          )}
        </form>
      )}
    </div>
  );
}
