"use client";

import { useRef, useState } from "react";
import {
  CLIENTE_VAZIO,
  CampoCliente,
  DadosCliente,
  ErrosCliente,
  ROTULOS_CLIENTE,
  primeiroCampoInvalidoCliente,
  validarCliente,
} from "@/lib/cliente";
import { criarCliente } from "../clientes/acoes";
import { useToast } from "../Feedback";
import s from "../../App.module.css";
import e from "./Envio.module.css";

/**
 * Cadastro rápido de cliente DENTRO da cobrança — a pessoa não abandona o
 * fluxo. Só pede o essencial (nome; WhatsApp e e-mail para poder enviar) e
 * usa a mesma ação e a mesma validação do cadastro completo (`criarCliente`,
 * `validarCliente`): nenhuma regra nova. Quando salva, devolve o cliente para
 * a cobrança, que já o deixa selecionado.
 */
export default function NovoClienteNaCobranca({
  aberto,
  onCriado,
  onCancelar,
}: {
  aberto: boolean;
  onCriado: (cliente: { id: string; nome: string }) => void;
  onCancelar: () => void;
}) {
  const [dados, setDados] = useState<DadosCliente>(CLIENTE_VAZIO);
  const toast = useToast();
  const [erros, setErros] = useState<ErrosCliente>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  if (!aberto) return null;

  const atualizar = (campo: CampoCliente, valor: string) => {
    setDados((a) => ({ ...a, [campo]: valor }));
    setErros((a) => ({ ...a, [campo]: undefined }));
    setErroGeral(null);
  };

  const focar = (campo: CampoCliente | null) => {
    if (!campo) return;
    const el = raiz.current?.querySelector<HTMLElement>(`#novo-${campo}`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    el?.focus();
  };

  const salvar = async () => {
    setErroGeral(null);
    const encontrados = validarCliente(dados);
    setErros(encontrados);
    const primeiro = primeiroCampoInvalidoCliente(encontrados);
    if (primeiro) {
      focar(primeiro);
      return;
    }
    setSalvando(true);
    const r = await criarCliente(dados);
    setSalvando(false);
    if (!r.ok) {
      if ("erros" in r) {
        setErros(r.erros);
        focar(primeiroCampoInvalidoCliente(r.erros));
        return;
      }
      setErroGeral(r.mensagem);
      return;
    }
    toast.sucesso("Cliente cadastrado ✅");
    onCriado({ id: r.id ?? "", nome: dados.nome.trim().replace(/\s+/g, " ") });
    setDados(CLIENTE_VAZIO);
  };

  const campo = (id: CampoCliente, tipo = "text", dica?: string, autoComplete?: string) => (
    <div className={s.campoApp}>
      <label htmlFor={`novo-${id}`}>{ROTULOS_CLIENTE[id]}</label>
      <input
        id={`novo-${id}`}
        type={tipo}
        value={dados[id]}
        autoComplete={autoComplete}
        aria-invalid={Boolean(erros[id])}
        aria-describedby={erros[id] ? `novo-${id}-erro` : dica ? `novo-${id}-dica` : undefined}
        onChange={(ev) => atualizar(id, ev.target.value)}
        onKeyDown={(ev) => {
          // Enter aqui cadastra o cliente, não envia a cobrança inteira
          if (ev.key === "Enter") {
            ev.preventDefault();
            void salvar();
          }
        }}
      />
      {erros[id] ? (
        <p id={`novo-${id}-erro`} className={s.erroCampo}>
          {erros[id]}
        </p>
      ) : (
        dica && (
          <p id={`novo-${id}-dica`} className={s.dicaCampo}>
            {dica}
          </p>
        )
      )}
    </div>
  );

  return (
    <div ref={raiz} className={e.novoCliente} role="group" aria-label="Cadastrar novo cliente">
      <p className={e.novoClienteTitulo}>Cadastrar novo cliente</p>
      {erroGeral && (
        <p role="alert" className={s.erroCampo} style={{ marginTop: 0 }}>
          {erroGeral}
        </p>
      )}
      {campo("nome", "text", undefined, "off")}
      <div className={s.duplaColuna}>
        {campo("whatsapp", "tel", "Para enviar a cobrança pelo WhatsApp. Opcional, com DDD.", "off")}
        {campo("email", "email", "Para enviar por e-mail. Opcional.", "off")}
      </div>
      <div className={s.acoes} style={{ marginTop: 0 }}>
        <button type="button" className={s.botao} onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar cliente"}
        </button>
        <button type="button" className={s.botaoSec} onClick={onCancelar} disabled={salvando}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
