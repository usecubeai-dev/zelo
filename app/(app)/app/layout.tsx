import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";
import { Empresa, avisoDaConta, situacaoDaConta } from "@/lib/empresa";
import { contarNaoLidas } from "@/lib/core/notificacoes";
import NavegacaoApp from "./NavegacaoApp";
import BotaoSair from "./BotaoSair";
import s from "../App.module.css";

/**
 * Casca da área autenticada.
 *
 * A checagem de sessão aqui NÃO é a autorização — o middleware já
 * redirecionou quem não tem sessão, e o RLS é quem garante que ninguém lê
 * dado de outra empresa. Este `redirect` é a terceira camada, para o caso
 * de a rota ser alcançada por um caminho que o matcher do middleware não
 * cubra. Barato e evita renderizar tela com dado nenhum.
 */
export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const atual = await usuarioAtual();
  if (!atual) redirect("/entrar?de=/app");

  const empresa = (atual.membro?.empresas ?? null) as Empresa | null;

  /* Sem empresa, o trigger de criação falhou — não dá para seguir fingindo
     que está tudo bem, porque nenhuma consulta seguinte vai funcionar. */
  if (!empresa) {
    return (
      <div className={`${s.moldura} zelo-produto`}>
        <main className={s.conteudo}>
          <h1 className={s.titulo}>Conta incompleta</h1>
          <p className={s.subtitulo}>
            Sua conta existe, mas não encontramos a empresa vinculada a ela.
            Saia e entre de novo; se continuar, fale com o suporte.
          </p>
          <div className={s.acoes}>
            <BotaoSair />
          </div>
        </main>
      </div>
    );
  }

  const situacao = situacaoDaConta(empresa);
  const aviso = avisoDaConta(situacao);
  const naoLidas = await contarNaoLidas(empresa.id);

  return (
    <div className={`${s.moldura} zelo-produto`}>
      <a href="#conteudo-principal" className={s.linkPular}>
        Pular para o conteúdo
      </a>
      <aside className={s.lateral}>
        <Link href="/app" className={s.marca}>
          <span className={s.marcaPonto} aria-hidden="true" />
          Zelo
        </Link>

        <NavegacaoApp />

        <Link href="/app/notificacoes" className={s.linkNotificacoes}>
          Notificações
          {naoLidas > 0 && <span className={s.contadorNotificacoes}>{naoLidas > 99 ? "99+" : naoLidas}</span>}
        </Link>

        <div className={s.rodapeLateral}>
          <span className={s.usuario}>
            {empresa.nome}
            <br />
            {atual.user.email}
          </span>
          <BotaoSair />
        </div>
      </aside>

      <main id="conteudo-principal" className={s.conteudo}>
        {aviso && (
          <div
            className={
              situacao.liberada ? s.faixaTrial : `${s.faixaTrial} ${s.faixaTrialFim}`
            }
            role="status"
          >
            <span>{aviso}</span>
            <Link href="/app/assinatura" className={s.faixaLink}>
              Ver assinatura
            </Link>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
