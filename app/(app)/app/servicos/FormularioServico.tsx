"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  SERVICO_VAZIO,
  CampoServico,
  DadosServico,
  ErrosServico,
  ORDEM_TIPOS_SERVICO,
  ROTULOS_SERVICO,
  ROTULO_TIPO_SERVICO,
  primeiroCampoInvalidoServico,
  validarServico,
} from "@/lib/servico";
import { criarServico, atualizarServico } from "./acoes";
import s from "../../App.module.css";

/** Um formulário para criar e para editar — mesmo padrão de FormularioCliente.tsx. */
export default function FormularioServico({
  id,
  inicial = SERVICO_VAZIO,
}: {
  id?: string;
  inicial?: DadosServico;
}) {
  const router = useRouter();
  const [dados, setDados] = useState<DadosServico>(inicial);
  const [erros, setErros] = useState<ErrosServico>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const focoPendente = useRef<CampoServico | null>(null);

  useEffect(() => {
    const campo = focoPendente.current;
    if (!campo || !erros[campo]) return;
    document.getElementById(campo)?.focus();
    focoPendente.current = null;
  }, [erros]);

  const atualizar = (campo: CampoServico, valor: string) => {
    setDados((a) => ({ ...a, [campo]: valor }));
    setErros((a) => ({ ...a, [campo]: undefined }));
    setErroGeral(null);
  };

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErroGeral(null);

    const encontrados = validarServico(dados);
    focoPendente.current = primeiroCampoInvalidoServico(encontrados);
    setErros(encontrados);
    if (focoPendente.current) return;

    setSalvando(true);
    const r = id ? await atualizarServico(id, dados) : await criarServico(dados);
    setSalvando(false);

    if (!r.ok) {
      if ("erros" in r) {
        focoPendente.current = primeiroCampoInvalidoServico(r.erros);
        setErros(r.erros);
        return;
      }
      setErroGeral(r.mensagem);
      return;
    }

    router.push("/app/servicos");
    router.refresh();
  };

  const temErro = Object.keys(erros).length > 0 || Boolean(erroGeral);

  return (
    <form className={s.formApp} noValidate onSubmit={enviar}>
      <div className={s.erroForm} role="alert" aria-live="assertive" hidden={!temErro}>
        {erroGeral ?? (temErro ? "Revise os campos destacados." : "")}
      </div>

      <div className={s.campoApp}>
        <label htmlFor="nome">{ROTULOS_SERVICO.nome}</label>
        <input
          id="nome"
          name="nome"
          value={dados.nome}
          aria-invalid={Boolean(erros.nome)}
          aria-describedby={erros.nome ? "nome-erro" : undefined}
          onChange={(e) => atualizar("nome", e.target.value)}
        />
        {erros.nome && <p id="nome-erro" className={s.erroCampo}>{erros.nome}</p>}
      </div>

      <div className={s.duplaColuna}>
        <div className={s.campoApp}>
          <label htmlFor="tipo">{ROTULOS_SERVICO.tipo}</label>
          <select id="tipo" name="tipo" value={dados.tipo} onChange={(e) => atualizar("tipo", e.target.value)}>
            {ORDEM_TIPOS_SERVICO.map((t) => (
              <option key={t} value={t}>{ROTULO_TIPO_SERVICO[t]}</option>
            ))}
          </select>
        </div>
        <div className={s.campoApp}>
          <label htmlFor="valor">{ROTULOS_SERVICO.valor}</label>
          <input
            id="valor"
            name="valor"
            inputMode="decimal"
            placeholder="0,00"
            value={dados.valor}
            aria-invalid={Boolean(erros.valor)}
            aria-describedby={erros.valor ? "valor-erro" : undefined}
            onChange={(e) => atualizar("valor", e.target.value)}
          />
          {erros.valor && <p id="valor-erro" className={s.erroCampo}>{erros.valor}</p>}
        </div>
      </div>

      <div className={s.acoes}>
        <button type="submit" className={s.botao} disabled={salvando}>
          {salvando ? "Salvando…" : id ? "Salvar alterações" : "Cadastrar serviço"}
        </button>
        <Link href="/app/servicos" className={s.botaoSec}>Cancelar</Link>
      </div>
    </form>
  );
}
