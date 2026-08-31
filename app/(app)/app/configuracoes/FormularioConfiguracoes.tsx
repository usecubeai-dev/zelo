"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { atualizarDadosEmpresa, DadosEmpresa } from "./acoes";
import s from "../../App.module.css";

export default function FormularioConfiguracoes({
  inicial,
}: {
  inicial: DadosEmpresa;
}) {
  const router = useRouter();
  const [dados, setDados] = useState<DadosEmpresa>(inicial);
  const [erros, setErros] = useState<Partial<Record<keyof DadosEmpresa, string>>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const atualizar = (campo: keyof DadosEmpresa, valor: string) => {
    setDados((a) => ({ ...a, [campo]: valor }));
    setErros((a) => ({ ...a, [campo]: undefined }));
    setErroGeral(null);
    setSucesso(false);
  };

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErroGeral(null);
    setSucesso(false);

    setSalvando(true);
    const r = await atualizarDadosEmpresa(dados);
    setSalvando(false);

    if (!r.ok) {
      if (r.erros) {
        setErros(r.erros);
        return;
      }
      setErroGeral(r.mensagem || "Não conseguimos salvar as alterações.");
      return;
    }

    setSucesso(true);
    router.refresh();
  };

  return (
    <form className={s.formApp} noValidate onSubmit={enviar}>
      {erroGeral && (
        <div className={s.erroForm} role="alert">
          {erroGeral}
        </div>
      )}

      {sucesso && (
        <div
          className={s.erroForm}
          style={{
            borderColor: "rgba(108, 59, 255, 0.4)",
            backgroundColor: "rgba(108, 59, 255, 0.08)",
            color: "var(--text)",
          }}
          role="status"
        >
          Alterações salvas com sucesso.
        </div>
      )}

      <div className={s.campoApp}>
        <label htmlFor="nome">Nome da empresa ou profissional</label>
        <input
          id="nome"
          name="nome"
          value={dados.nome}
          placeholder="Minha Empresa Ltda"
          aria-invalid={Boolean(erros.nome)}
          aria-describedby={erros.nome ? "nome-erro" : undefined}
          onChange={(e) => atualizar("nome", e.target.value)}
        />
        {erros.nome && <p id="nome-erro" className={s.erroCampo}>{erros.nome}</p>}
      </div>

      <div className={s.campoApp}>
        <label htmlFor="documento">CPF ou CNPJ da empresa</label>
        <input
          id="documento"
          name="documento"
          value={dados.documento}
          placeholder="00.000.000/0000-00"
          aria-invalid={Boolean(erros.documento)}
          aria-describedby={erros.documento ? "doc-erro" : "doc-dica"}
          onChange={(e) => atualizar("documento", e.target.value)}
        />
        {erros.documento ? (
          <p id="doc-erro" className={s.erroCampo}>{erros.documento}</p>
        ) : (
          <p id="doc-dica" className={s.dicaCampo}>
            Utilizado para a emissão de cobranças e integração Pix Automático.
          </p>
        )}
      </div>

      <div className={s.acoes}>
        <button type="submit" className={s.botao} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar configurações"}
        </button>
      </div>
    </form>
  );
}
