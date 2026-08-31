"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  COBRANCA_VAZIA,
  CampoCobranca,
  DadosCobranca,
  ErrosCobranca,
  ROTULOS_COBRANCA,
  primeiroCampoInvalidoCobranca,
  validarCobranca,
} from "@/lib/cobranca";
import { formatarCentavos, paraCentavos } from "@/lib/dinheiro";
import { criarCobranca, atualizarCobranca } from "./acoes";
import s from "../../App.module.css";

export type OpcaoCliente = { id: string; nome: string };

export default function FormularioCobranca({
  id,
  clientes,
  inicial = COBRANCA_VAZIA,
  pisoData,
}: {
  id?: string;
  clientes: OpcaoCliente[];
  inicial?: DadosCobranca;
  /** menor vencimento aceito — na edição pode ser passado */
  pisoData?: string;
}) {
  const router = useRouter();
  const [dados, setDados] = useState<DadosCobranca>(inicial);
  const [erros, setErros] = useState<ErrosCobranca>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const foco = useRef<CampoCobranca | null>(null);

  useEffect(() => {
    const c = foco.current;
    if (!c || !erros[c]) return;
    document.getElementById(c)?.focus();
    foco.current = null;
  }, [erros]);

  const atualizar = (campo: CampoCobranca, valor: string) => {
    setDados((a) => ({ ...a, [campo]: valor }));
    setErros((a) => ({ ...a, [campo]: undefined }));
    setErroGeral(null);
  };

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErroGeral(null);
    const encontrados = validarCobranca(dados, pisoData);
    foco.current = primeiroCampoInvalidoCobranca(encontrados);
    setErros(encontrados);
    if (foco.current) return;

    setSalvando(true);
    const r = id ? await atualizarCobranca(id, dados) : await criarCobranca(dados);
    setSalvando(false);

    if (!r.ok) {
      if ("erros" in r) {
        foco.current = primeiroCampoInvalidoCobranca(r.erros);
        setErros(r.erros);
        return;
      }
      setErroGeral(r.mensagem);
      return;
    }
    router.push(`/app/cobrancas/${id ?? r.id ?? ""}`);
    router.refresh();
  };

  const temErro = Object.keys(erros).length > 0 || Boolean(erroGeral);
  /* espelho do valor: o usuário digita "29,90" e confere "R$ 29,90" antes
     de salvar. Erro de vírgula em cobrança é caro. */
  const centavos = paraCentavos(dados.valor);

  return (
    <form className={s.formApp} noValidate onSubmit={enviar}>
      <div className={s.erroForm} role="alert" aria-live="assertive" hidden={!temErro}>
        {erroGeral ?? (temErro ? "Revise os campos destacados." : "")}
      </div>

      <div className={s.campoApp}>
        <label htmlFor="cliente_id">{ROTULOS_COBRANCA.cliente_id}</label>
        <select
          id="cliente_id"
          name="cliente_id"
          value={dados.cliente_id}
          aria-invalid={Boolean(erros.cliente_id)}
          aria-describedby={erros.cliente_id ? "cliente_id-erro" : undefined}
          onChange={(e) => atualizar("cliente_id", e.target.value)}
        >
          <option value="">Selecione um cliente</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
        {erros.cliente_id && (
          <p id="cliente_id-erro" className={s.erroCampo}>{erros.cliente_id}</p>
        )}
      </div>

      <div className={s.campoApp}>
        <label htmlFor="descricao">{ROTULOS_COBRANCA.descricao}</label>
        <input
          id="descricao"
          name="descricao"
          value={dados.descricao}
          placeholder="Mensalidade de setembro"
          aria-invalid={Boolean(erros.descricao)}
          aria-describedby={erros.descricao ? "descricao-erro" : undefined}
          onChange={(e) => atualizar("descricao", e.target.value)}
        />
        {erros.descricao && (
          <p id="descricao-erro" className={s.erroCampo}>{erros.descricao}</p>
        )}
      </div>

      <div className={s.duplaColuna}>
        <div className={s.campoApp}>
          <label htmlFor="valor">{ROTULOS_COBRANCA.valor}</label>
          <input
            id="valor"
            name="valor"
            inputMode="decimal"
            value={dados.valor}
            placeholder="350,00"
            aria-invalid={Boolean(erros.valor)}
            aria-describedby={erros.valor ? "valor-erro" : "valor-dica"}
            onChange={(e) => atualizar("valor", e.target.value)}
          />
          {erros.valor ? (
            <p id="valor-erro" className={s.erroCampo}>{erros.valor}</p>
          ) : (
            <p id="valor-dica" className={s.dicaCampo}>
              {centavos && centavos > 0 ? formatarCentavos(centavos) : "Em reais"}
            </p>
          )}
        </div>

        <div className={s.campoApp}>
          <label htmlFor="vence_em">{ROTULOS_COBRANCA.vence_em}</label>
          <input
            id="vence_em"
            name="vence_em"
            type="date"
            value={dados.vence_em}
            aria-invalid={Boolean(erros.vence_em)}
            aria-describedby={erros.vence_em ? "vence_em-erro" : undefined}
            onChange={(e) => atualizar("vence_em", e.target.value)}
          />
          {erros.vence_em && (
            <p id="vence_em-erro" className={s.erroCampo}>{erros.vence_em}</p>
          )}
        </div>
      </div>

      <div className={s.acoes}>
        <button type="submit" className={s.botao} disabled={salvando}>
          {salvando ? "Salvando…" : id ? "Salvar alterações" : "Criar cobrança"}
        </button>
        <Link href={id ? `/app/cobrancas/${id}` : "/app/cobrancas"} className={s.botaoSec}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
