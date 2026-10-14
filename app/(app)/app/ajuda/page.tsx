import { usuarioAtual } from "@/lib/supabase/server";
import { entradaDoTutorialDaEmpresa } from "@/lib/core/recebimentos-estado";
import { EMPRESA, mailtoDe } from "@/lib/company";
import PageHeader from "../PageHeader";
import TutorialPrimeiraCobranca from "../TutorialPrimeiraCobranca";
import s from "../../App.module.css";

export const metadata = { title: "Ajuda" };

/**
 * Ajuda: onde se reabre o tutorial da primeira cobrança (sempre aberto aqui) e
 * onde está o canal de atendimento. Os passos refletem o estado real da conta.
 */
export default async function Ajuda() {
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) return null;

  const entrada = await entradaDoTutorialDaEmpresa(empresaId);
  const mail = mailtoDe(EMPRESA.emailSuporte);

  return (
    <>
      <PageHeader titulo="Ajuda" subtitulo="O caminho da primeira cobrança, passo a passo, com o que ainda falta na sua conta." />
      <TutorialPrimeiraCobranca modo="pagina" {...entrada} />
      <section className={s.bloco} aria-labelledby="titulo-contato">
        <h2 id="titulo-contato" className={s.blocoTitulo}>
          Precisa falar com a gente?
        </h2>
        <p className={s.subtitulo} style={{ margin: 0 }}>
          {mail ? (
            <>
              Escreva para{" "}
              <a href={mail} className={s.linkTabela}>
                {EMPRESA.emailSuporte}
              </a>
              . {EMPRESA.horarioAtendimento}.
            </>
          ) : (
            <>Atendimento por e-mail. {EMPRESA.horarioAtendimento}.</>
          )}
        </p>
      </section>
    </>
  );
}
