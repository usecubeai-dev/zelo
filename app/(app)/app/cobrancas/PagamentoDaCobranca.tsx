"use client";

import { formatarCentavos } from "@/lib/dinheiro";
import {
  FormaPagamento,
  VALOR_MINIMO_ASAAS_CENTAVOS,
  abaixoDoMinimoDoAsaas,
  encargosDoTexto,
  temEncargos,
  textoEncargos,
  validarEncargos,
  valorAtualizado,
} from "@/lib/recuperacao";
import s from "../../App.module.css";
import c from "../Recuperacao.module.css";

type Props = {
  forma: FormaPagamento;
  multa: string;
  juros: string;
  /** valor da cobrança em centavos, ou `null` enquanto não for um número válido */
  valorCentavos: number | null;
  /** cobrança que já existe no Asaas: a forma e os encargos não mudam mais */
  travado?: boolean;
  erroForma?: string;
  erroMulta?: string;
  erroJuros?: string;
  aoMudarForma: (forma: FormaPagamento) => void;
  aoMudarMulta: (texto: string) => void;
  aoMudarJuros: (texto: string) => void;
};

/**
 * "Como seu cliente paga" + multa/juros.
 *
 * "Seu cliente escolhe" usa a fatura hospedada pelo Asaas (Pix, boleto ou
 * cartão): o Zelo nunca recebe nem guarda dado de cartão. Multa e juros só
 * aparecem nessa opção porque o Asaas só os aplica a BOLETO — nada é
 * prometido para o Pix. O servidor revalida tudo; isto só espelha as regras.
 */
export default function PagamentoDaCobranca({
  forma,
  multa,
  juros,
  valorCentavos,
  travado = false,
  erroForma,
  erroMulta,
  erroJuros,
  aoMudarForma,
  aoMudarMulta,
  aoMudarJuros,
}: Props) {
  const escolhe = forma === "cliente_escolhe";
  const encargos = encargosDoTexto(multa, juros);
  const digitouEncargos = temEncargos(encargos);
  const errosEncargos = validarEncargos(multa, juros);
  const encargosOk = !errosEncargos.multa && !errosEncargos.juros;

  /* exemplo concreto: 10 dias de atraso sobre o valor digitado (estimativa) */
  const exemplo =
    valorCentavos && valorCentavos > 0 && digitouEncargos && encargosOk
      ? valorAtualizado({ valorCentavos, venceEm: "2000-01-01", hoje: "2000-01-11", encargos })
      : null;

  const opcao = (valor: FormaPagamento, titulo: string, texto: string) => {
    const marcada = forma === valor;
    return (
      <label key={valor} className={`${c.opcao} ${marcada ? c.opcaoMarcada : ""} ${travado ? c.opcaoTravada : ""}`}>
        <input
          className={c.opcaoRadio}
          type="radio"
          name="forma_pagamento"
          value={valor}
          checked={marcada}
          disabled={travado}
          onChange={() => aoMudarForma(valor)}
        />
        <span className={c.opcaoMarca} aria-hidden="true" />
        <span className={c.opcaoCorpo}>
          <span className={c.opcaoTitulo}>{titulo}</span>
          <span className={c.opcaoTexto}>{texto}</span>
        </span>
      </label>
    );
  };

  return (
    <>
      <div className={s.campoApp}>
        <fieldset className={c.opcoes} aria-describedby={erroForma ? "forma_pagamento-erro" : "forma_pagamento-dica"}>
          <legend style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 8, padding: 0 }}>Como seu cliente paga</legend>
          {opcao("pix", "Só Pix", "O cliente paga por Pix, sem outras opções.")}
          {opcao(
            "cliente_escolhe",
            "Seu cliente escolhe como pagar",
            "Pix, boleto ou cartão, numa página de pagamento segura. Você não lida com dados de cartão."
          )}
        </fieldset>
        {erroForma ? (
          <p id="forma_pagamento-erro" className={s.erroCampo}>
            {erroForma}
          </p>
        ) : (
          <p id="forma_pagamento-dica" className={s.dicaCampo}>
            {travado
              ? "O pagamento desta cobrança já foi preparado, então a forma de pagamento e os encargos não mudam mais."
              : escolhe
                ? "Seu cliente escolhe como pagar. Boleto e cartão dependem de a sua conta de recebimentos estar liberada para esses meios."
                : "Para o cliente poder pagar por boleto ou cartão, escolha a segunda opção."}
          </p>
        )}
      </div>

      {escolhe && (
        <>
          <div className={c.encargosLinha}>
            <div className={s.campoApp}>
              <label htmlFor="multa">Multa após o vencimento (%)</label>
              <input
                id="multa"
                name="multa"
                inputMode="decimal"
                value={multa}
                placeholder="2"
                disabled={travado}
                aria-invalid={Boolean(erroMulta)}
                aria-describedby={erroMulta ? "multa-erro" : undefined}
                onChange={(e) => aoMudarMulta(e.target.value)}
              />
              {erroMulta && (
                <p id="multa-erro" className={s.erroCampo}>
                  {erroMulta}
                </p>
              )}
            </div>
            <div className={s.campoApp}>
              <label htmlFor="juros">Juros (% ao mês)</label>
              <input
                id="juros"
                name="juros"
                inputMode="decimal"
                value={juros}
                placeholder="1"
                disabled={travado}
                aria-invalid={Boolean(erroJuros)}
                aria-describedby={erroJuros ? "juros-erro" : undefined}
                onChange={(e) => aoMudarJuros(e.target.value)}
              />
              {erroJuros && (
                <p id="juros-erro" className={s.erroCampo}>
                  {erroJuros}
                </p>
              )}
            </div>
          </div>

          <p className={c.previa} role="note">
            {digitouEncargos && encargosOk ? (
              <>
                <strong>Se atrasar, serão aplicados os encargos configurados:</strong> {textoEncargos(encargos)}. Valem para o
                pagamento por boleto; o valor final é calculado no momento do pagamento.
                {exemplo && (
                  <>
                    {" "}
                    Exemplo: com 10 dias de atraso, {formatarCentavos(valorCentavos ?? 0)} ficaria em cerca de{" "}
                    <strong>{formatarCentavos(exemplo.totalCentavos)}</strong> (estimativa).
                  </>
                )}
              </>
            ) : (
              <>Sem multa e sem juros: se atrasar, o valor não muda. Preencha acima para cobrar encargos no boleto.</>
            )}
          </p>
        </>
      )}

      {!escolhe && (
        <p className={c.nota}>Multa e juros só valem para boleto. Para usá-los, deixe o cliente escolher como pagar.</p>
      )}

      {abaixoDoMinimoDoAsaas(valorCentavos) && (
        <p className={c.aviso} role="note">
          O link de pagamento só é gerado a partir de {formatarCentavos(VALOR_MINIMO_ASAAS_CENTAVOS)}. Abaixo disso a cobrança
          fica só no Zelo, e você registra o pagamento na mão.
        </p>
      )}
    </>
  );
}
