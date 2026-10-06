import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";
import { Empresa, avisoDaConta, situacaoDaConta } from "@/lib/empresa";
import { contarNaoLidas } from "@/lib/core/notificacoes";
import { ehAdministradorZelo } from "@/lib/core/influenciadores";
import { aceiteVigente } from "@/lib/core/aceite-legal";
import NavegacaoApp from "./NavegacaoApp";
import BotaoSair from "./BotaoSair";
import { IconeNotificacoes } from "./Icones";
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

  /* Conta excluída (exclusão lógica + anonimização): o acesso acabou. O login
     também foi bloqueado, esta tela cobre só quem ainda tem uma sessão aberta. */
  if (empresa.deleted_at) {
    return (
      <div className={`${s.moldura} zelo-produto`}>
        <main className={s.conteudo}>
          <h1 className={s.titulo}>Conta excluída</h1>
          <p className={s.subtitulo}>Esta conta foi excluída e não tem mais acesso ao Zelo.</p>
          <div className={s.acoes}>
            <BotaoSair />
          </div>
        </main>
      </div>
    );
  }

  /* Aceite dos Termos e da Política nas versões VIGENTES. Quem ainda não
     aceitou (conta antiga, ou a versão mudou) passa por /aceite antes de usar
     o app. */
  if (!(await aceiteVigente(atual.user.id))) redirect("/aceite");

  const situacao = situacaoDaConta(empresa);
  const aviso = avisoDaConta(situacao);
  const [naoLidas, administrador] = await Promise.all([
    contarNaoLidas(empresa.id),
    ehAdministradorZelo(atual.user.id),
  ]);

  /* O texto do link acompanha o que a pessoa precisa fazer agora — "Ver
     assinatura" não diz nada a quem está com a conta travada. */
  const rotuloDoAviso = situacao.aguardandoPagamento
    ? "Escolher plano"
    : situacao.status === "inadimplente"
      ? "Regularizar pagamento"
      : situacao.carenciaLegada
        ? "Assinar agora"
        : "Ver assinatura";

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

        <NavegacaoApp administrador={administrador} />

        <Link href="/app/notificacoes" className={s.linkNotificacoes}>
          <span className={s.linkNotificacoesRotulo}>
            <IconeNotificacoes className={s.navIcone} aria-hidden="true" />
            Notificações
          </span>
          {naoLidas > 0 && <span className={s.contadorNotificacoes}>{naoLidas > 99 ? "99+" : naoLidas}</span>}
        </Link>

        <div className={s.rodapeLateral}>
          <span className={s.avatarEmpresa} aria-hidden="true">
            {(empresa.nome.trim().charAt(0) || "Z").toUpperCase()}
          </span>
          <span className={s.usuario}>
            <span className={s.usuarioNome}>{empresa.nome}</span>
            <span className={s.usuarioEmail}>{atual.user.email}</span>
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
              {rotuloDoAviso}
            </Link>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
