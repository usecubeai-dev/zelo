"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CampoRecorrencia,
  DadosRecorrencia,
  ErrosRecorrencia,
  RECORRENCIA_VAZIA,
  ROTULOS_RECORRENCIA,
  primeiroCampoInvalidoRecorrencia,
  validarRecorrencia,
} from "@/lib/recorrencia";
import { formatarCentavos, paraCentavos } from "@/lib/dinheiro";
import { criarRecorrencia, atualizarRecorrencia } from "./acoes";
import { track, EVENTOS } from "@/lib/analytics";
import NovoClienteNaCobranca from "../cobrancas/NovoClienteNaCobranca";
import s from "../../App.module.css";

export type OpcaoCliente = { id: string; nome: string };
export type OpcaoServico = { id: string; nome: string; valor_centavos: number };

export default function FormularioRecorrencia({
  id,
  clientes: clientesIniciais,
  servicos = [],
  inicial = RECORRENCIA_VAZIA,
}: {
  id?: string;
  clientes: OpcaoCliente[];
  /** ativos, para preencher descrição/valor sozinhos — nenhum é obrigatório. */
  servicos?: OpcaoServico[];
  inicial?: DadosRecorrencia;
}) {
  const router = useRouter();
  const [clientes, setClientes] = useState<OpcaoCliente[]>(clientesIniciais);
  const [novoClienteAberto, setNovoClienteAberto] = useState(clientesIniciais.length === 0 && !id);
  const [dados, setDados] = useState<DadosRecorrencia>(inicial);
  const [erros, setErros] = useState<ErrosRecorrencia>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const foco = useRef<CampoRecorrencia | null>(null);

  useEffect(() => {
    const c = foco.current;
    if (!c || !erros[c]) return;
    const el = document.getElementById(c);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    el?.focus({ preventScroll: true });
    foco.current = null;
  }, [erros]);

  const atualizar = (campo: CampoRecorrencia, valor: string) => {
    setDados((a) => ({ ...a, [campo]: valor }));
    setErros((a) => ({ ...a, [campo]: undefined }));
    setErroGeral(null);
  };

  /* Mesmo padrão de FormularioCobranca.tsx: selecionar um serviço
     preenche descrição e valor, mas nenhum dos dois fica travado. */
  const clienteCriado = (novo: OpcaoCliente) => {
    setClientes((lista) => [...lista, novo].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    atualizar("cliente_id", novo.id); // volta para a cobrança automática com o cliente já selecionado
    setNovoClienteAberto(false);
    setTimeout(() => document.getElementById("descricao")?.focus(), 0);
  };

  const escolherServico = (servicoId: string) => {
    const servico = servicos.find((sv) => sv.id === servicoId);
    setDados((a) => ({
      ...a,
      servico_id: servicoId,
      descricao: servico ? servico.nome : a.descricao,
      valor: servico ? (servico.valor_centavos / 100).toFixed(2).replace(".", ",") : a.valor,
    }));
    setErros((a) => ({ ...a, descricao: undefined, valor: undefined }));
    setErroGeral(null);
  };

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErroGeral(null);
    const encontrados = validarRecorrencia(dados);
    foco.current = primeiroCampoInvalidoRecorrencia(encontrados);
    setErros(encontrados);
    if (foco.current) return;

    setSalvando(true);
    const r = id ? await atualizarRecorrencia(id, dados) : await criarRecorrencia(dados);
    setSalvando(false);

    if (!r.ok) {
      if ("erros" in r) {
        foco.current = primeiroCampoInvalidoRecorrencia(r.erros);
        setErros(r.erros);
        return;
      }
      setErroGeral(r.mensagem);
      return;
    }
    if (!id) track(EVENTOS.recurringChargeCreated);
    router.push(id ? `/app/recorrencias/${id}` : `/app/recorrencias/${r.id ?? ""}?criada=1`);
    router.refresh();
  };

  const temErro = Object.keys(erros).length > 0 || Boolean(erroGeral);
  const centavos = paraCentavos(dados.valor);

  return (
    <form className={s.formApp} noValidate onSubmit={enviar}>
      <div className={s.erroForm} role="alert" aria-live="assertive" hidden={!temErro}>
        {erroGeral ?? (temErro ? "Revise os campos destacados." : "")}
      </div>

      <div className={s.campoApp}>
        <label htmlFor="cliente_id">{ROTULOS_RECORRENCIA.cliente_id}</label>
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
          <p id="cliente_id-erro" className={s.erroCampo}>⚠ {erros.cliente_id}</p>
        )}
        {!id && !novoClienteAberto && (
          <button type="button" className={s.botaoTerciario} style={{ alignSelf: "flex-start" }} onClick={() => setNovoClienteAberto(true)}>
            + Cadastrar novo cliente
          </button>
        )}
      </div>

      {!id && (
        <NovoClienteNaCobranca aberto={novoClienteAberto} onCriado={clienteCriado} onCancelar={() => setNovoClienteAberto(false)} />
      )}

      {servicos.length > 0 && (
        <div className={s.campoApp}>
          <label htmlFor="servico_id">{ROTULOS_RECORRENCIA.servico_id} (opcional)</label>
          <select
            id="servico_id"
            name="servico_id"
            value={dados.servico_id}
            onChange={(e) => escolherServico(e.target.value)}
          >
            <option value="">Nenhum — digitar avulso</option>
            {servicos.map((sv) => (
              <option key={sv.id} value={sv.id}>{sv.nome}</option>
            ))}
          </select>
          <p className={s.dicaCampo}>Preenche descrição e valor sozinho. Você pode ajustar os dois depois.</p>
        </div>
      )}

      <div className={s.campoApp}>
        <label htmlFor="descricao">{ROTULOS_RECORRENCIA.descricao}</label>
        <input
          id="descricao"
          name="descricao"
          value={dados.descricao}
          placeholder="Mensalidade do plano"
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
          <label htmlFor="valor">{ROTULOS_RECORRENCIA.valor}</label>
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
              {centavos && centavos > 0 ? `${formatarCentavos(centavos)} / mês` : "Valor mensal"}
            </p>
          )}
        </div>

        <div className={s.campoApp}>
          <label htmlFor="dia_vencimento">{ROTULOS_RECORRENCIA.dia_vencimento}</label>
          <select
            id="dia_vencimento"
            name="dia_vencimento"
            value={dados.dia_vencimento}
            aria-invalid={Boolean(erros.dia_vencimento)}
            aria-describedby={erros.dia_vencimento ? "dia_vencimento-erro" : undefined}
            onChange={(e) => atualizar("dia_vencimento", e.target.value)}
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((dia) => (
              <option key={dia} value={String(dia)}>
                Dia {dia}
              </option>
            ))}
          </select>
          {erros.dia_vencimento && (
            <p id="dia_vencimento-erro" className={s.erroCampo}>{erros.dia_vencimento}</p>
          )}
        </div>
      </div>

      <div className={s.campoApp}>
        <label htmlFor="inicia_em">{ROTULOS_RECORRENCIA.inicia_em}</label>
        <input
          id="inicia_em"
          name="inicia_em"
          type="date"
          value={dados.inicia_em}
          aria-invalid={Boolean(erros.inicia_em)}
          aria-describedby={erros.inicia_em ? "inicia_em-erro" : "inicia_em-dica"}
          onChange={(e) => atualizar("inicia_em", e.target.value)}
        />
        {erros.inicia_em ? (
          <p id="inicia_em-erro" className={s.erroCampo}>{erros.inicia_em}</p>
        ) : (
          <p id="inicia_em-dica" className={s.dicaCampo}>
            A primeira cobrança será gerada automaticamente com base nesta data.
          </p>
        )}
      </div>

      <div className={s.acoes}>
        <button type="submit" className={s.botao} disabled={salvando}>
          {salvando ? "Salvando…" : id ? "Salvar alterações" : "Criar cobrança automática"}
        </button>
        <Link href={id ? `/app/recorrencias/${id}` : "/app/recorrencias"} className={s.botaoSec}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
