"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CLIENTE_VAZIO,
  CampoCliente,
  DadosCliente,
  ErrosCliente,
  ROTULOS_CLIENTE,
  primeiroCampoInvalidoCliente,
  validarCliente,
} from "@/lib/cliente";
import { criarCliente, atualizarCliente } from "./acoes";
import s from "../../App.module.css";

/**
 * Um formulário para criar e para editar. A diferença é só o `id`: duas
 * telas quase iguais divergem no primeiro ajuste que alguém esquece de
 * replicar.
 *
 * A validação roda aqui **e** na Server Action. A daqui é para a pessoa
 * não esperar ida e volta; a de lá é a que vale.
 */
export default function FormularioCliente({
  id,
  inicial = CLIENTE_VAZIO,
}: {
  id?: string;
  inicial?: DadosCliente;
}) {
  const router = useRouter();
  const [dados, setDados] = useState<DadosCliente>(inicial);
  const [erros, setErros] = useState<ErrosCliente>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const focoPendente = useRef<CampoCliente | null>(null);

  useEffect(() => {
    const campo = focoPendente.current;
    if (!campo || !erros[campo]) return;
    document.getElementById(campo)?.focus();
    focoPendente.current = null;
  }, [erros]);

  const atualizar = (campo: CampoCliente, valor: string) => {
    setDados((a) => ({ ...a, [campo]: valor }));
    setErros((a) => ({ ...a, [campo]: undefined }));
    setErroGeral(null);
  };

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErroGeral(null);

    const encontrados = validarCliente(dados);
    focoPendente.current = primeiroCampoInvalidoCliente(encontrados);
    setErros(encontrados);
    if (focoPendente.current) return;

    setSalvando(true);
    const r = id
      ? await atualizarCliente(id, dados)
      : await criarCliente(dados);
    setSalvando(false);

    if (!r.ok) {
      if ("erros" in r) {
        /* o servidor recusou: só acontece se alguém contornar o formulário,
           mas se acontecer a pessoa precisa ver por quê */
        focoPendente.current = primeiroCampoInvalidoCliente(r.erros);
        setErros(r.erros);
        return;
      }
      setErroGeral(r.mensagem);
      return;
    }

    router.push(id ? `/app/clientes/${id}` : `/app/clientes/${r.id ?? ""}`);
    router.refresh();
  };

  const temErro = Object.keys(erros).length > 0 || Boolean(erroGeral);

  return (
    <form className={s.formApp} noValidate onSubmit={enviar}>
      <div className={s.erroForm} role="alert" aria-live="assertive" hidden={!temErro}>
        {erroGeral ?? (temErro ? "Revise os campos destacados." : "")}
      </div>

      <Campo
        id="nome"
        valor={dados.nome}
        erro={erros.nome}
        autoComplete="name"
        onChange={(v) => atualizar("nome", v)}
      />

      <div className={s.duplaColuna}>
        <Campo
          id="email"
          tipo="email"
          valor={dados.email}
          erro={erros.email}
          dica="Opcional"
          autoComplete="email"
          onChange={(v) => atualizar("email", v)}
        />
        <Campo
          id="whatsapp"
          tipo="tel"
          valor={dados.whatsapp}
          erro={erros.whatsapp}
          dica="Opcional, com DDD"
          autoComplete="tel"
          onChange={(v) => atualizar("whatsapp", v)}
        />
      </div>

      <Campo
        id="documento"
        valor={dados.documento}
        erro={erros.documento}
        dica="Opcional agora. Será necessário para emitir cobrança."
        onChange={(v) => atualizar("documento", v)}
      />

      <div className={s.campoApp}>
        <label htmlFor="observacoes">{ROTULOS_CLIENTE.observacoes}</label>
        <textarea
          id="observacoes"
          name="observacoes"
          value={dados.observacoes}
          aria-invalid={Boolean(erros.observacoes)}
          aria-describedby={erros.observacoes ? "observacoes-erro" : undefined}
          onChange={(e) => atualizar("observacoes", e.target.value)}
        />
        {erros.observacoes && (
          <p id="observacoes-erro" className={s.erroCampo}>
            {erros.observacoes}
          </p>
        )}
      </div>

      <div className={s.acoes}>
        <button type="submit" className={s.botao} disabled={salvando}>
          {salvando ? "Salvando…" : id ? "Salvar alterações" : "Cadastrar cliente"}
        </button>
        <Link
          href={id ? `/app/clientes/${id}` : "/app/clientes"}
          className={s.botaoSec}
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function Campo({
  id,
  valor,
  erro,
  dica,
  tipo = "text",
  autoComplete,
  onChange,
}: {
  id: CampoCliente;
  valor: string;
  erro?: string;
  dica?: string;
  tipo?: string;
  autoComplete?: string;
  onChange: (v: string) => void;
}) {
  const idErro = `${id}-erro`;
  const idDica = `${id}-dica`;
  const descrito = [erro ? idErro : null, dica && !erro ? idDica : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={s.campoApp}>
      <label htmlFor={id}>{ROTULOS_CLIENTE[id]}</label>
      <input
        id={id}
        name={id}
        type={tipo}
        value={valor}
        autoComplete={autoComplete}
        aria-invalid={Boolean(erro)}
        aria-describedby={descrito || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {erro && (
        <p id={idErro} className={s.erroCampo}>
          {erro}
        </p>
      )}
      {dica && !erro && (
        <p id={idDica} className={s.dicaCampo}>
          {dica}
        </p>
      )}
    </div>
  );
}
