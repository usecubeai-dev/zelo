"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  COBRANCA_VAZIA,
  CampoCobranca,
  formatarData,
  DadosCobranca,
  ErrosCobranca,
  ROTULOS_COBRANCA,
  primeiroCampoInvalidoCobranca,
  validarCobranca,
} from "@/lib/cobranca";
import { formatarCentavos, paraCentavos } from "@/lib/dinheiro";
import { criarCobranca, atualizarCobranca } from "./acoes";
import { track, EVENTOS } from "@/lib/analytics";
import PagamentoDaCobranca from "./PagamentoDaCobranca";
import NovoClienteNaCobranca from "./NovoClienteNaCobranca";
import GuiaPrimeiraCobranca from "./GuiaPrimeiraCobranca";
import { VALOR_MINIMO_ASAAS_CENTAVOS, abaixoDoMinimoDoAsaas, type FormaPagamento } from "@/lib/encargos";
import s from "../../App.module.css";
import e from "./Envio.module.css";

export type OpcaoCliente = { id: string; nome: string };
export type OpcaoServico = { id: string; nome: string; valor_centavos: number };

/** campo → id do elemento que recebe o foco quando há erro */
const ID_DO_CAMPO: Record<CampoCobranca, string> = {
  cliente_id: "cliente_id",
  servico_id: "servico_id",
  descricao: "descricao",
  valor: "valor",
  vence_em: "vence_em",
  forma_pagamento: "forma_pagamento",
  multa: "multa",
  juros: "juros",
};

export default function FormularioCobranca({
  id,
  clientes: clientesIniciais,
  servicos = [],
  inicial = COBRANCA_VAZIA,
  pisoData,
  pagamentoTravado = false,
  primeiraVez = false,
}: {
  id?: string;
  clientes: OpcaoCliente[];
  /** ativos, para preencher descrição/valor sozinhos — nenhum é obrigatório: continua dando pra digitar avulso. */
  servicos?: OpcaoServico[];
  inicial?: DadosCobranca;
  /** menor vencimento aceito — na edição pode ser passado */
  pisoData?: string;
  /** cobrança cujo pagamento já foi preparado: a forma de pagamento e os encargos ficam como estão */
  pagamentoTravado?: boolean;
  /** primeira cobrança desta empresa: mostra o guia curto de 4 passos */
  primeiraVez?: boolean;
}) {
  const router = useRouter();
  const [clientes, setClientes] = useState<OpcaoCliente[]>(clientesIniciais);
  const [dados, setDados] = useState<DadosCobranca>(inicial);
  const [erros, setErros] = useState<ErrosCobranca>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [criada, setCriada] = useState(false);
  const [novoClienteAberto, setNovoClienteAberto] = useState(clientesIniciais.length === 0 && !id);
  const [pagamentoAberto, setPagamentoAberto] = useState(inicial.forma_pagamento === "cliente_escolhe");
  const foco = useRef<CampoCobranca | null>(null);

  /* Depois de uma validação com erro: leva o foco E a rolagem até o PRIMEIRO
     campo com erro — no celular e no iPad o campo inválido pode estar fora da
     tela. Cada erro continua escrito no próprio campo; a faixa do topo é só o
     resumo. */
  useEffect(() => {
    const campo = foco.current;
    if (!campo || !erros[campo]) return;
    if (campo === "forma_pagamento" || campo === "multa" || campo === "juros") setPagamentoAberto(true);
    // espera o React abrir o bloco de pagamento antes de procurar o elemento
    const t = setTimeout(() => {
      const el = document.getElementById(ID_DO_CAMPO[campo]);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      (el?.querySelector<HTMLElement>("input,select,textarea") ?? el)?.focus?.({ preventScroll: true });
    }, 0);
    foco.current = null;
    return () => clearTimeout(t);
  }, [erros]);

  const atualizar = (campo: CampoCobranca, valor: string) => {
    setDados((a) => ({ ...a, [campo]: valor }));
    setErros((a) => ({ ...a, [campo]: undefined }));
    setErroGeral(null);
  };

  const mudarForma = (forma: FormaPagamento) => {
    setDados((a) => ({ ...a, forma_pagamento: forma }));
    setErros((a) => ({ ...a, forma_pagamento: undefined, multa: undefined, juros: undefined }));
    setErroGeral(null);
  };

  /* Selecionar um serviço preenche descrição e valor — mas o usuário
     continua livre para editar os dois depois. Escolher "nenhum" de novo
     não apaga o que já foi preenchido, só solta o vínculo. */
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

  const clienteCriado = (novo: { id: string; nome: string }) => {
    setClientes((lista) => [...lista, novo].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    atualizar("cliente_id", novo.id); // já volta para a cobrança com o cliente selecionado
    setNovoClienteAberto(false);
    setTimeout(() => document.getElementById("descricao")?.focus(), 0);
  };

  const enviar = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    setErroGeral(null);
    const encontrados = validarCobranca(dados, pisoData);
    foco.current = primeiroCampoInvalidoCobranca(encontrados);
    setErros(encontrados);
    if (foco.current) return;

    setSalvando(true);
    const r = id ? await atualizarCobranca(id, dados) : await criarCobranca(dados);
    if (!r.ok) {
      setSalvando(false);
      if ("erros" in r) {
        foco.current = primeiroCampoInvalidoCobranca(r.erros);
        setErros(r.erros);
        return;
      }
      setErroGeral(r.mensagem);
      return;
    }
    // sucesso: o botão mostra "Cobrança criada ✅" enquanto a tela seguinte abre
    setCriada(true);
    if (!id) track(EVENTOS.chargeCreated, { primeiro: !!r.primeiro });
    router.push(id ? `/app/cobrancas/${id}` : `/app/cobrancas/${r.id ?? ""}?criada=1`);
    router.refresh();
  };

  const temErro = Object.values(erros).some(Boolean) || Boolean(erroGeral);
  /* espelho do valor: o usuário digita "29,90" e confere "R$ 29,90" antes
     de salvar. Erro de vírgula em cobrança é caro. */
  const centavos = paraCentavos(dados.valor);
  const rotuloBotao = criada ? (id ? "Salvo ✅" : "Cobrança criada ✅") : salvando ? (id ? "Salvando…" : "Criando cobrança…") : id ? "Salvar alterações" : "Criar cobrança";

  const nomeDoCliente = clientes.find((c) => c.id === dados.cliente_id)?.nome ?? "";
  const vencimento = /^\d{4}-\d{2}-\d{2}$/.test(dados.vence_em) ? formatarData(dados.vence_em) : "";
  const linhasDoResumo: [string, string][] = [
    ["Cliente", nomeDoCliente],
    ["Descrição", dados.descricao.trim()],
    ["Valor", centavos && centavos > 0 ? formatarCentavos(centavos) : ""],
    ["Vencimento", vencimento],
  ];

  return (
    <div className={e.layoutNova}>
    <form className={s.formApp} noValidate onSubmit={enviar}>
      {primeiraVez && !id && <GuiaPrimeiraCobranca />}

      <div className={s.erroForm} role="alert" aria-live="assertive" hidden={!temErro}>
        {erroGeral ?? (temErro ? "Revise os campos destacados." : "")}
      </div>

      {clientes.length === 0 && !id && (
        <p className={e.vazioCliente} role="note">
          <strong>Você ainda não tem clientes.</strong> Cadastre seu primeiro cliente para começar a cobrar.
        </p>
      )}

      <div className={s.campoApp}>
        <label htmlFor="cliente_id">{ROTULOS_COBRANCA.cliente_id}</label>
        <select
          id="cliente_id"
          name="cliente_id"
          value={dados.cliente_id}
          aria-invalid={Boolean(erros.cliente_id)}
          aria-describedby={erros.cliente_id ? "cliente_id-erro" : undefined}
          onChange={(ev) => atualizar("cliente_id", ev.target.value)}
        >
          <option value="">{clientes.length === 0 ? "Nenhum cliente ainda" : "Selecione um cliente"}</option>
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
        <NovoClienteNaCobranca
          aberto={novoClienteAberto}
          onCriado={clienteCriado}
          onCancelar={() => setNovoClienteAberto(false)}
        />
      )}

      {servicos.length > 0 && (
        <div className={s.campoApp}>
          <label htmlFor="servico_id">{ROTULOS_COBRANCA.servico_id} (opcional)</label>
          <select
            id="servico_id"
            name="servico_id"
            value={dados.servico_id}
            onChange={(ev) => escolherServico(ev.target.value)}
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
        <label htmlFor="descricao">{ROTULOS_COBRANCA.descricao}</label>
        <input
          id="descricao"
          name="descricao"
          value={dados.descricao}
          placeholder="Mensalidade de setembro"
          aria-invalid={Boolean(erros.descricao)}
          aria-describedby={erros.descricao ? "descricao-erro" : undefined}
          onChange={(ev) => atualizar("descricao", ev.target.value)}
        />
        {erros.descricao && (
          <p id="descricao-erro" className={s.erroCampo}>⚠ {erros.descricao}</p>
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
            onChange={(ev) => atualizar("valor", ev.target.value)}
          />
          {erros.valor ? (
            <p id="valor-erro" className={s.erroCampo}>⚠ {erros.valor}</p>
          ) : (
            <p id="valor-dica" className={s.dicaCampo}>
              {centavos && centavos > 0 ? formatarCentavos(centavos) : "Em reais"}
            </p>
          )}
          {/* importante, então fica à vista (fora das opções recolhidas) */}
          {abaixoDoMinimoDoAsaas(centavos) && (
            <p className={e.vazioCliente} role="note" style={{ marginTop: 6 }}>
              O link de pagamento só é gerado a partir de {formatarCentavos(VALOR_MINIMO_ASAAS_CENTAVOS)}. Abaixo disso a cobrança fica só no Zelo, e você
              registra o pagamento na mão.
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
            onChange={(ev) => atualizar("vence_em", ev.target.value)}
          />
          {erros.vence_em && (
            <p id="vence_em-erro" className={s.erroCampo}>⚠ {erros.vence_em}</p>
          )}
        </div>
      </div>

      {/* Opções de pagamento: fora do caminho principal. Quem só quer cobrar por
          Pix não precisa abrir; abre sozinho se o padrão da empresa for "cliente
          escolhe" ou se houver erro nesses campos. */}
      <details className={e.opcoesPagamento} open={pagamentoAberto} onToggle={(ev) => setPagamentoAberto((ev.currentTarget as HTMLDetailsElement).open)}>
        <summary>Como seu cliente paga (opcional)</summary>
        <div className={e.opcoesPagamentoCorpo}>
          <PagamentoDaCobranca
            forma={dados.forma_pagamento}
            multa={dados.multa}
            juros={dados.juros}
            valorCentavos={centavos}
            travado={pagamentoTravado}
            erroForma={erros.forma_pagamento}
            erroMulta={erros.multa}
            erroJuros={erros.juros}
            aoMudarForma={mudarForma}
            aoMudarMulta={(v) => atualizar("multa", v)}
            aoMudarJuros={(v) => atualizar("juros", v)}
          />
        </div>
      </details>

      <div className={s.acoes}>
        <button type="submit" className={s.botao} disabled={salvando || criada} style={{ minHeight: 52 }}>
          {rotuloBotao}
        </button>
        <Link href={id ? `/app/cobrancas/${id}` : "/app/cobrancas"} className={s.botaoSec}>
          Cancelar
        </Link>
      </div>
    </form>

    {/* Painel ao lado (telas largas): confere o que está sendo criado e mostra o que vem depois. Só leitura. */}
    <aside className={e.painelLateral} aria-label="Resumo da cobrança">
      <svg className={e.ilustracao} viewBox="0 0 260 150" aria-hidden="true" focusable="false">
        <rect x="14" y="26" width="116" height="104" rx="14" fill="var(--violet-soft)" />
        <rect x="30" y="44" width="62" height="8" rx="4" fill="var(--violet)" opacity="0.85" />
        <rect x="30" y="62" width="84" height="6" rx="3" fill="var(--violet)" opacity="0.28" />
        <rect x="30" y="76" width="70" height="6" rx="3" fill="var(--violet)" opacity="0.28" />
        <rect x="30" y="100" width="46" height="16" rx="8" fill="var(--violet)" />
        <rect x="150" y="14" width="96" height="122" rx="16" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2" />
        <rect x="186" y="22" width="24" height="4" rx="2" fill="var(--border-strong)" />
        <rect x="162" y="40" width="72" height="38" rx="10" fill="var(--violet-soft)" />
        <rect x="170" y="49" width="40" height="5" rx="2.5" fill="var(--violet)" opacity="0.5" />
        <rect x="170" y="60" width="54" height="5" rx="2.5" fill="var(--violet)" opacity="0.28" />
        <circle cx="198" cy="106" r="15" fill="var(--success)" />
        <path d="M190.5 106.5l5.5 5.5 10-11" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M130 78c8 0 11 6 20 6" fill="none" stroke="var(--violet)" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round" />
      </svg>

      <h2 className={e.resumoTitulo}>{id ? "Resumo da cobrança" : "Confira antes de criar"}</h2>
      <dl className={e.resumoLista}>
        {linhasDoResumo.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt>{rotulo}</dt>
            <dd className={valor ? undefined : e.resumoVazio}>{valor || "—"}</dd>
          </div>
        ))}
      </dl>

      {!id && (
        <>
          <p className={e.depoisTitulo}>Depois de criar</p>
          <ol className={e.depois}>
            <li>Você escolhe como enviar: WhatsApp, link ou e-mail.</li>
            <li>Seu cliente abre o link e paga.</li>
            <li>Você acompanha a situação aqui no Zelo.</li>
          </ol>
        </>
      )}
    </aside>
    </div>
  );
}
