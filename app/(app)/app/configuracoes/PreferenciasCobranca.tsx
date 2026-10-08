"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FormaPagamento,
  PreferenciasCobranca as Preferencias,
  REGRAS_DE_LEMBRETE,
  ROTULO_CANAL,
  encargosDoTexto,
  percentualParaCampo,
  validarEncargos,
  textoEncargos,
  temEncargos,
  type CanalPreferencial,
} from "@/lib/recuperacao";
import { salvarPreferenciasCobranca } from "./acoesCobranca";
import { useToast } from "../Feedback";
import s from "../../App.module.css";
import c from "../Recuperacao.module.css";

/**
 * "Cobrança e recuperação": os padrões que valem para cobranças NOVAS.
 * Mudar aqui nunca altera uma cobrança que já existe.
 */
export default function PreferenciasCobranca({ inicial, podeEditar }: { inicial: Preferencias; podeEditar: boolean }) {
  const router = useRouter();
  const [forma, setForma] = useState<FormaPagamento>(inicial.forma);
  const [multa, setMulta] = useState(percentualParaCampo(inicial.encargos.multaPct));
  const [juros, setJuros] = useState(percentualParaCampo(inicial.encargos.jurosPctMes));
  const [lembretes, setLembretes] = useState<Record<string, boolean>>({ ...inicial.lembretes });
  const [canal, setCanal] = useState<CanalPreferencial>(inicial.canal);
  const [erros, setErros] = useState<{ multa?: string; juros?: string }>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();

  const mudou = () => {
    setSucesso(false);
    setErroGeral(null);
  };

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mudou();
    const encontrados = validarEncargos(multa, juros);
    setErros(encontrados);
    if (encontrados.multa || encontrados.juros) return;

    setSalvando(true);
    const r = await salvarPreferenciasCobranca({ forma, multa, juros, lembretes, canal });
    setSalvando(false);
    if (!r.ok) {
      if (r.erros) setErros(r.erros);
      else setErroGeral(r.mensagem ?? "Não conseguimos salvar.");
      return;
    }
    setSucesso(true);
    toast.sucesso("Padrões salvos ✅");
    router.refresh();
  };

  const encargos = encargosDoTexto(multa, juros);

  return (
    <section id="cobranca-e-recuperacao" style={{ marginBottom: 40 }} aria-labelledby="titulo-cobranca-recuperacao">
      <h2 id="titulo-cobranca-recuperacao" className={s.vazioTitulo} style={{ marginBottom: 6 }}>
        Cobrança e recuperação
      </h2>
      <p className={c.nota} style={{ marginBottom: 16 }}>
        Estes padrões valem para as cobranças que você criar daqui para frente. Uma cobrança que já existe não muda sozinha, e você
        pode ajustar cobrança por cobrança.
      </p>

      <form className={s.formApp} noValidate onSubmit={enviar}>
        {erroGeral && (
          <div className={s.erroForm} role="alert">
            {erroGeral}
          </div>
        )}
        {sucesso && (
          <div className={s.sucessoForm} role="status">
            Padrões salvos.
          </div>
        )}

        <fieldset className={c.grupo} disabled={!podeEditar}>
          <legend className={c.grupoTitulo}>Forma de pagamento preferida</legend>
          <label className={c.marcar}>
            <input type="radio" name="forma_padrao" checked={forma === "pix"} onChange={() => (setForma("pix"), mudou())} />
            <span>
              <strong>Só Pix</strong> — o cliente paga por Pix.
            </span>
          </label>
          <label className={c.marcar}>
            <input
              type="radio"
              name="forma_padrao"
              checked={forma === "cliente_escolhe"}
              onChange={() => (setForma("cliente_escolhe"), mudou())}
            />
            <span>
              <strong>Seu cliente escolhe como pagar</strong> — Pix, boleto ou cartão numa página de pagamento segura.
            </span>
          </label>
        </fieldset>

        <div className={c.encargosLinha}>
          <div className={s.campoApp}>
            <label htmlFor="multa_padrao">Multa padrão após o vencimento (%)</label>
            <input
              id="multa_padrao"
              inputMode="decimal"
              value={multa}
              placeholder="2"
              disabled={!podeEditar}
              aria-invalid={Boolean(erros.multa)}
              aria-describedby={erros.multa ? "multa_padrao-erro" : undefined}
              onChange={(e) => (setMulta(e.target.value), setErros((a) => ({ ...a, multa: undefined })), mudou())}
            />
            {erros.multa && (
              <p id="multa_padrao-erro" className={s.erroCampo}>
                {erros.multa}
              </p>
            )}
          </div>
          <div className={s.campoApp}>
            <label htmlFor="juros_padrao">Juros padrão (% ao mês)</label>
            <input
              id="juros_padrao"
              inputMode="decimal"
              value={juros}
              placeholder="1"
              disabled={!podeEditar}
              aria-invalid={Boolean(erros.juros)}
              aria-describedby={erros.juros ? "juros_padrao-erro" : undefined}
              onChange={(e) => (setJuros(e.target.value), setErros((a) => ({ ...a, juros: undefined })), mudou())}
            />
            {erros.juros && (
              <p id="juros_padrao-erro" className={s.erroCampo}>
                {erros.juros}
              </p>
            )}
          </div>
        </div>
        <p className={c.nota}>
          {temEncargos(encargos) ? `Se atrasar: ${textoEncargos(encargos)}. ` : ""}Multa e juros só valem para pagamento por boleto, então só
          são aplicados quando o cliente pode escolher como pagar. No Pix o valor não muda.
        </p>

        <fieldset id="notificacoes" className={c.grupo} disabled={!podeEditar} style={{ scrollMarginTop: 96 }}>
          <legend className={c.grupoTitulo}>Lembretes</legend>
          {REGRAS_DE_LEMBRETE.map((r) => (
            <label key={r.id} className={c.marcar}>
              <input
                type="checkbox"
                checked={Boolean(lembretes[r.id])}
                onChange={(e) => (setLembretes((a) => ({ ...a, [r.id]: e.target.checked })), mudou())}
              />
              <span>{r.rotulo}</span>
            </label>
          ))}
          <p className={c.nota}>
            Os lembretes aparecem na lista <strong>Lembretes de hoje</strong>, em <strong>Em atraso</strong>. Você envia com um
            clique pelo WhatsApp. O Zelo não manda mensagem sozinho.
          </p>
        </fieldset>

        <fieldset className={c.grupo} disabled={!podeEditar}>
          <legend className={c.grupoTitulo}>Canal preferido</legend>
          {(Object.keys(ROTULO_CANAL) as CanalPreferencial[]).map((k) => (
            <label key={k} className={c.marcar}>
              <input type="radio" name="canal_padrao" checked={canal === k} onChange={() => (setCanal(k), mudou())} />
              <span>{ROTULO_CANAL[k]}</span>
            </label>
          ))}
        </fieldset>

        {!podeEditar && <p className={c.nota}>Só o responsável pela conta pode alterar estes padrões.</p>}

        <div className={s.acoes}>
          <button type="submit" className={s.botao} disabled={salvando || !podeEditar}>
            {salvando ? "Salvando…" : "Salvar padrões"}
          </button>
        </div>
      </form>
    </section>
  );
}
