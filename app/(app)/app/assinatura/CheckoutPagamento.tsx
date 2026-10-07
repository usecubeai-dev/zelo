"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  EstadoPagamento,
  FormaDoCheckout,
  RECURSOS_DOS_PLANOS,
  TEXTO_DO_ESTADO,
  mascararDocumento,
  textoDoLimite,
} from "@/lib/checkout";
import { NOME_DO_PLANO, PRECO_POR_PLANO_CENTAVOS, Plano, TAXA_DE_RECEBIMENTO_CENTAVOS } from "@/lib/plano";
import { formatarCentavos } from "@/lib/dinheiro";
import { soDigitos } from "@/lib/cliente";
import type { PagamentoDaAssinatura } from "@/lib/core/pagamento-assinatura";
import { assinarPlano } from "./acoes";
import { atualizarPagamentoDaAssinatura, lerPagamentoDaAssinatura } from "./acoesPagamento";
import c from "./Checkout.module.css";

type Props = {
  plano: Plano;
  documentoInicial: string;
  /** pagamento que já estava em aberto quando a página carregou (retomada) */
  pagamentoInicial: PagamentoDaAssinatura | null;
  /** a conta já está liberada (ativa no Grátis): o plano pago só vale depois do pagamento */
  contaLiberada: boolean;
  pagamentoDisponivel: boolean;
  aoAlterarPlano: () => void;
};

const INTERVALO_CONFERENCIA_MS = 12_000;
const LIMITE_CONFERENCIA_MS = 12 * 60_000;

/**
 * Checkout: pagamento à esquerda, resumo do pedido à direita (uma coluna no
 * celular). Pix com QR Code e "copia e cola" na própria tela; cartão e boleto na
 * página segura do parceiro de pagamentos — o Zelo nunca vê dado de cartão.
 *
 * Regra de ouro: esta tela NUNCA decide que o pagamento foi feito. "Já paguei —
 * atualizar" só pergunta ao servidor o estado atual; "pago" só aparece quando o
 * servidor confirma (a mensalidade está paga no banco).
 */
export default function CheckoutPagamento({ plano, documentoInicial, pagamentoInicial, contaLiberada, pagamentoDisponivel, aoAlterarPlano }: Props) {
  const [pagamento, setPagamento] = useState<PagamentoDaAssinatura | null>(pagamentoInicial);
  const [documento, setDocumento] = useState(mascararDocumento(documentoInicial));
  const [erroDocumento, setErroDocumento] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [forma, setForma] = useState<FormaDoCheckout>("pix");
  const [pixCopiado, setPixCopiado] = useState(false);
  const campoDocumento = useRef<HTMLInputElement>(null);
  const tituloEstado = useRef<HTMLHeadingElement>(null);
  const temporizadorCopia = useRef<ReturnType<typeof setTimeout> | null>(null);

  const planoDoPedido: Plano = pagamento?.plano ?? plano;
  const valorCentavos = pagamento?.valorCentavos ?? PRECO_POR_PLANO_CENTAVOS[plano];
  const estado: EstadoPagamento | null = pagamento?.estado ?? null;

  useEffect(
    () => () => {
      if (temporizadorCopia.current) clearTimeout(temporizadorCopia.current);
    },
    []
  );

  /** Lê de novo o pagamento no servidor. `conferir` pede antes ao parceiro o estado atual. */
  const recarregar = useCallback(async (conferir: boolean): Promise<EstadoPagamento | null> => {
    if (conferir) {
      const r = await atualizarPagamentoDaAssinatura();
      if (!r.ok) throw new Error(r.mensagem);
    }
    const leitura = await lerPagamentoDaAssinatura();
    if (!leitura.ok) throw new Error(leitura.mensagem);
    setPagamento(leitura.pagamento);
    return leitura.pagamento?.estado ?? null;
  }, []);

  /* Enquanto aguarda ou processa, confere sozinho de tempos em tempos (e para
     depois de alguns minutos). Só pergunta ao servidor — nunca decide nada. */
  useEffect(() => {
    if (estado !== "aguardando" && estado !== "processando") return;
    const inicio = Date.now();
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - inicio > LIMITE_CONFERENCIA_MS) {
        clearInterval(id);
        return;
      }
      recarregar(true).catch(() => null);
    }, INTERVALO_CONFERENCIA_MS);
    return () => clearInterval(id);
  }, [estado, recarregar]);

  useEffect(() => {
    if (estado === "pago") tituloEstado.current?.focus();
  }, [estado]);

  const gerar = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (gerando) return;
    setErroGeral(null);
    const digitos = soDigitos(documento);
    if (digitos.length !== 11 && digitos.length !== 14) {
      setErroDocumento("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).");
      campoDocumento.current?.focus();
      return;
    }
    setErroDocumento(null);
    setGerando(true);
    try {
      const r = await assinarPlano(plano, digitos);
      if (!r.ok) {
        setErroGeral(r.mensagem);
        if (r.codigo === "documento_invalido") campoDocumento.current?.focus();
        return;
      }
      await recarregar(false);
    } catch {
      setErroGeral("Não conseguimos preparar o pagamento agora. Tente novamente em instantes.");
    } finally {
      setGerando(false);
    }
  };

  const jaPaguei = async () => {
    setAtualizando(true);
    setStatus(null);
    try {
      const novo = await recarregar(true);
      setStatus(
        novo === "pago"
          ? null
          : novo === "processando"
            ? "Recebemos o aviso e estamos confirmando. Costuma levar poucos instantes."
            : "Ainda não recebemos a confirmação. Se você acabou de pagar, aguarde alguns instantes e atualize de novo."
      );
    } catch {
      setStatus("Não conseguimos atualizar agora. Tente novamente em instantes.");
    } finally {
      setAtualizando(false);
    }
  };

  const copiarPix = async () => {
    if (!pagamento?.pix) return;
    try {
      await navigator.clipboard.writeText(pagamento.pix.payload);
      setPixCopiado(true);
      setStatus(null);
    } catch {
      setStatus("Não consegui copiar. Selecione o código e copie na mão.");
      return;
    }
    if (temporizadorCopia.current) clearTimeout(temporizadorCopia.current);
    temporizadorCopia.current = setTimeout(() => setPixCopiado(false), 4000);
  };

  const formas: { id: FormaDoCheckout; nome: string; texto: string }[] = [
    { id: "pix", nome: "Pix", texto: "Pagamento instantâneo." },
    { id: "cartao", nome: "Cartão", texto: "Pagamento com cartão." },
    ...(pagamento?.linkBoleto ? [{ id: "boleto" as const, nome: "Boleto", texto: "Compensa em até 3 dias úteis." }] : []),
  ];

  return (
    <div className={c.raiz}>
      <div className={c.cabecalhoCheckout}>
        <span className={c.marca}>Zelo</span>
        <span className={c.seguro}>Pagamento seguro</span>
      </div>

      <div className={c.checkout}>
        {/* ---------- ESQUERDA: pagamento ---------- */}
        <div className={`${c.painel} ${c.painelDestaque}`} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          {estado === "pago" ? (
            <div className={c.sucesso} role="status" aria-live="polite">
              <span className={c.sucessoIcone} aria-hidden="true">
                ✓
              </span>
              <h2 ref={tituloEstado} tabIndex={-1} className={c.sucessoTitulo}>
                {TEXTO_DO_ESTADO.pago.titulo}
              </h2>
              <p className={c.sucessoPlano}>
                {TEXTO_DO_ESTADO.pago.descricao}
                <br />
                <strong>{NOME_DO_PLANO[planoDoPedido]}</strong> · <span className="tnum">{formatarCentavos(valorCentavos)}/mês</span>
              </p>
              <div className={c.sucessoAcoes}>
                <Link href="/app" className={`${c.botaoGrande} ${c.botaoSucesso}`}>
                  Ir para meu painel
                </Link>
                <a className={c.linkSecundario} href="/app/assinatura">
                  Ver minha assinatura
                </a>
              </div>
            </div>
          ) : !pagamento ? (
            <form onSubmit={gerar} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <div>
                <h2 className={c.confirmaTitulo}>Dados para o pagamento</h2>
                <p className={c.dica} style={{ marginTop: 6 }}>
                  Precisamos do seu CPF ou CNPJ para gerar a cobrança da mensalidade.
                </p>
              </div>

              <div className={c.campo}>
                <label htmlFor="documento">CPF ou CNPJ</label>
                <input
                  id="documento"
                  ref={campoDocumento}
                  inputMode="numeric"
                  autoComplete="off"
                  value={documento}
                  placeholder="000.000.000-00"
                  aria-invalid={Boolean(erroDocumento)}
                  aria-describedby={erroDocumento ? "documento-erro" : "documento-dica"}
                  onChange={(ev) => {
                    setDocumento(mascararDocumento(ev.target.value));
                    setErroDocumento(null);
                  }}
                />
                {erroDocumento ? (
                  <p id="documento-erro" className={c.erro}>
                    ⚠ {erroDocumento}
                  </p>
                ) : (
                  <p id="documento-dica" className={c.dica}>
                    Usado só para emitir a cobrança do plano.
                  </p>
                )}
              </div>

              {!pagamentoDisponivel && (
                <p className={c.erro} role="alert">
                  O pagamento ainda não está disponível. Tente novamente em instantes.
                </p>
              )}
              {erroGeral && (
                <p className={c.erro} role="alert">
                  {erroGeral}
                </p>
              )}

              <div className={c.acoesPagamento}>
                <button type="submit" className={c.botaoGrande} disabled={gerando || !pagamentoDisponivel}>
                  {gerando ? (
                    <>
                      <span className={c.girando} aria-hidden="true" /> Preparando o pagamento…
                    </>
                  ) : (
                    "Continuar"
                  )}
                </button>
                <button type="button" className={c.linkSecundario} onClick={aoAlterarPlano} disabled={gerando}>
                  Alterar plano
                </button>
              </div>
            </form>
          ) : (
            <>
              <div>
                <h2 className={c.confirmaTitulo}>Como você quer pagar?</h2>
              </div>

              {estado && estado !== "aguardando" && (
                <div className={c.estado} data-tom={TEXTO_DO_ESTADO[estado].tom} role="status" aria-live="polite">
                  {estado === "processando" && <span className={c.pulso} aria-hidden="true" />}
                  <div>
                    <h3 ref={tituloEstado} tabIndex={-1} className={c.estadoTitulo}>
                      {TEXTO_DO_ESTADO[estado].titulo}
                    </h3>
                    <p className={c.estadoTexto}>{TEXTO_DO_ESTADO[estado].descricao}</p>
                  </div>
                </div>
              )}

              {(estado === "aguardando" || estado === "processando") && (
                <>
                  <fieldset className={c.formas}>
                    <legend className="sr-only">Forma de pagamento</legend>
                    {formas.map((f) => (
                      <label key={f.id} className={`${c.forma} ${forma === f.id ? c.formaMarcada : ""}`}>
                        <input type="radio" name="forma" value={f.id} checked={forma === f.id} onChange={() => setForma(f.id)} />
                        <span className={c.formaNome}>{f.nome}</span>
                        <span className={c.formaTexto}>{f.texto}</span>
                      </label>
                    ))}
                  </fieldset>

                  {forma === "pix" && (
                    <div className={c.pix}>
                      {pagamento.pix ? (
                        <>
                          <div className={c.qr}>
                            {pagamento.pix.imagem ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={`data:image/png;base64,${pagamento.pix.imagem}`} alt="QR Code Pix para pagar a assinatura" />
                            ) : (
                              <span className={c.dica}>QR Code indisponível. Use o código ao lado.</span>
                            )}
                          </div>
                          <div className={c.pixTexto}>
                            <h3 className={c.pixTitulo}>Pague com Pix</h3>
                            <p className={c.dica}>
                              Escaneie o QR Code ou copie o código. Valor: <strong className="tnum">{formatarCentavos(valorCentavos)}</strong>.
                            </p>
                            <label htmlFor="pix-codigo" className="sr-only">
                              Pix Copia e Cola
                            </label>
                            <textarea id="pix-codigo" className={c.copiaCola} readOnly value={pagamento.pix.payload} onFocus={(ev) => ev.currentTarget.select()} />
                            <button type="button" className={`${c.botaoGrande} ${pixCopiado ? c.botaoSucesso : ""}`} onClick={copiarPix}>
                              {pixCopiado ? "Código Pix copiado." : "Copiar código"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className={c.dica} style={{ gridColumn: "1 / -1" }}>
                          O Pix não ficou disponível agora. Toque em atualizar ou escolha outra forma de pagamento.
                        </p>
                      )}
                    </div>
                  )}

                  {forma === "cartao" && (
                    <div className={c.pixTexto}>
                      <h3 className={c.pixTitulo}>Pague com cartão</h3>
                      <p className={c.dica}>
                        Você paga numa página segura de pagamento e escolhe o cartão lá. O Zelo não recebe nem guarda os dados do seu cartão.
                      </p>
                      {pagamento.linkSeguro ? (
                        <a className={c.botaoGrande} href={pagamento.linkSeguro} target="_blank" rel="noopener noreferrer">
                          Pagar com cartão
                          <span className="sr-only"> (abre em nova aba)</span>
                        </a>
                      ) : (
                        <p className={c.erro}>A página de pagamento ainda não ficou disponível. Toque em atualizar em instantes.</p>
                      )}
                    </div>
                  )}

                  {forma === "boleto" && pagamento.linkBoleto && (
                    <div className={c.pixTexto}>
                      <h3 className={c.pixTitulo}>Pague com boleto</h3>
                      <p className={c.dica}>O boleto pode levar até 3 dias úteis para ser confirmado. Sua assinatura é ativada assim que o pagamento for confirmado.</p>
                      <a className={c.botaoGrande} href={pagamento.linkBoleto} target="_blank" rel="noopener noreferrer">
                        Abrir boleto
                        <span className="sr-only"> (abre em nova aba)</span>
                      </a>
                    </div>
                  )}

                  <div className={c.estado} data-tom={TEXTO_DO_ESTADO.aguardando.tom} role="status" aria-live="polite" hidden={estado !== "aguardando"}>
                    <span className={c.pulso} aria-hidden="true" />
                    <div>
                      <h3 className={c.estadoTitulo}>{TEXTO_DO_ESTADO.aguardando.titulo}</h3>
                      <p className={c.estadoTexto}>{TEXTO_DO_ESTADO.aguardando.descricao}</p>
                    </div>
                  </div>

                  <div className={c.acoesPagamento}>
                    <button type="button" className={`${c.botaoGrande} ${c.botaoContorno}`} onClick={jaPaguei} disabled={atualizando}>
                      {atualizando ? (
                        <>
                          <span className={c.girando} aria-hidden="true" /> Atualizando…
                        </>
                      ) : (
                        "Já paguei — verificar pagamento"
                      )}
                    </button>
                    <button type="button" className={c.linkSecundario} onClick={aoAlterarPlano}>
                      Alterar plano
                    </button>
                  </div>
                  <p className={c.status} role="status" aria-live="polite">
                    {status}
                  </p>
                </>
              )}

              {(estado === "falhou" || estado === "expirado" || estado === "cancelado") && (
                <div className={c.acoesPagamento}>
                  <button type="button" className={c.botaoGrande} onClick={() => gerar()} disabled={gerando || !pagamentoDisponivel}>
                    {gerando ? "Preparando…" : "Tentar novamente"}
                  </button>
                  <button type="button" className={c.linkSecundario} onClick={aoAlterarPlano}>
                    Voltar para planos
                  </button>
                </div>
              )}
              {erroGeral && (
                <p className={c.erro} role="alert">
                  {erroGeral}
                </p>
              )}
            </>
          )}
        </div>

        {/* ---------- DIREITA: resumo do pedido ---------- */}
        <aside className={c.resumo} aria-label="Resumo do pedido">
          <h2 className={c.resumoTitulo}>Resumo do pedido</h2>
          <dl className={c.resumoLista}>
            <div className={c.resumoLinha}>
              <dt>Seu plano</dt>
              <dd>{NOME_DO_PLANO[planoDoPedido]}</dd>
            </div>
            <div className={c.resumoLinha}>
              <dt>Mensalidade</dt>
              <dd className="tnum">{formatarCentavos(valorCentavos)}/mês</dd>
            </div>
            <div className={c.resumoLinha}>
              <dt>Clientes</dt>
              <dd>{textoDoLimite(planoDoPedido).replace("Até ", "até ").replace("Clientes ilimitados", "ilimitados")}</dd>
            </div>
            <div className={c.resumoLinha}>
              <dt>Taxa</dt>
              <dd className="tnum">{formatarCentavos(TAXA_DE_RECEBIMENTO_CENTAVOS)} por Pix recebido</dd>
            </div>
          </dl>
          <div className={c.resumoTotal}>
            <span className={c.resumoTotalRotulo}>Total da assinatura</span>
            <strong className={`${c.resumoTotalValor} tnum`}>
              {formatarCentavos(valorCentavos)}
              <small>/mês</small>
            </strong>
          </div>
          <p className={c.resumoNota}>
            A taxa de {formatarCentavos(TAXA_DE_RECEBIMENTO_CENTAVOS)} é cobrada só quando você recebe um Pix de um cliente. Ela <strong>não</strong> é somada à
            mensalidade.
          </p>
          {contaLiberada && (
            <p className={c.resumoNota}>
              Seu plano passa a ser o {NOME_DO_PLANO[planoDoPedido]} quando o pagamento for confirmado. Até lá, sua conta segue no plano Grátis.
            </p>
          )}
          <p className={c.resumoVenda}>Você está contratando o Zelo para organizar suas cobranças e recebimentos.</p>
          <ul className={c.resumoBeneficios}>
            {RECURSOS_DOS_PLANOS.map((r) => (
              <li key={r}>
                <span className={c.check} aria-hidden="true">
                  ✓
                </span>
                {r}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
