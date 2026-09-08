import Link from "next/link";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { marcarTodasNotificacoesLidasAcao } from "./acoes";
import NotificacaoItem from "./NotificacaoItem";
import s from "../../App.module.css";

export const metadata = { title: "Notificações" };

const POR_PAGINA = 30;

const FILTROS = [
  { v: "todas", r: "Todas" },
  { v: "nao_lidas", r: "Não lidas" },
];

type Notificacao = {
  id: string;
  titulo: string;
  mensagem: string;
  prioridade: "baixa" | "media" | "alta";
  lida: boolean;
  link: string | null;
  criado_em: string;
};

/**
 * Centro de notificações — Fase 13 do Core Financeiro.
 *
 * Lê só via RLS (`membro le notificacoes`) — nenhuma notificação de
 * outro tenant pode aparecer aqui, a política já garante isso antes de
 * qualquer filtro deste componente.
 */
export default async function ListaNotificacoes({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; pagina?: string }>;
}) {
  const { f = "todas", pagina = "1" } = await searchParams;
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) return null;

  const p = Math.max(1, Number(pagina) || 1);
  const de = (p - 1) * POR_PAGINA;

  const supabase = await supabaseServer();
  let consulta = supabase
    .from("notificacoes")
    .select("id, titulo, mensagem, prioridade, lida, link, criado_em", { count: "exact" })
    .eq("empresa_id", empresaId)
    .order("criado_em", { ascending: false })
    .range(de, de + POR_PAGINA - 1);

  if (f === "nao_lidas") consulta = consulta.eq("lida", false);

  const { data, count, error } = await consulta;
  const notificacoes = (data ?? []) as Notificacao[];
  const total = count ?? 0;
  const ultima = Math.max(1, Math.ceil(total / POR_PAGINA));

  const { count: totalNaoLidas } = await supabase
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("lida", false);

  const url = (m: { f?: string; pagina?: string }) => {
    const sp = new URLSearchParams();
    const alvo = { f, pagina: String(p), ...m };
    if (alvo.f && alvo.f !== "todas") sp.set("f", alvo.f);
    if (alvo.pagina && alvo.pagina !== "1") sp.set("pagina", alvo.pagina);
    const t = sp.toString();
    return t ? `/app/notificacoes?${t}` : "/app/notificacoes";
  };

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Notificações</h1>
        <p className={s.subtitulo}>
          {(totalNaoLidas ?? 0) === 0 ? "Tudo em dia." : `${totalNaoLidas} não lida${totalNaoLidas !== 1 ? "s" : ""}.`}
        </p>
      </header>

      <div className={s.barraTopo}>
        <div className={s.filtros}>
          {FILTROS.map((x) => (
            <Link
              key={x.v}
              href={url({ f: x.v, pagina: "1" })}
              className={f === x.v ? `${s.filtro} ${s.filtroAtivo}` : s.filtro}
              aria-current={f === x.v ? "true" : undefined}
            >
              {x.r}
            </Link>
          ))}
        </div>
        {(totalNaoLidas ?? 0) > 0 && (
          <form
            action={async () => {
              "use server";
              await marcarTodasNotificacoesLidasAcao();
            }}
          >
            <button type="submit" className={s.botaoSec}>Marcar todas como lidas</button>
          </form>
        )}
      </div>

      {error && (
        <div className={s.erroForm} role="alert">
          Não conseguimos carregar suas notificações agora. Recarregue a página.
        </div>
      )}

      {!error && notificacoes.length === 0 && (
        <section className={s.vazio}>
          <h2 className={s.vazioTitulo}>{f === "nao_lidas" ? "Nenhuma notificação não lida" : "Nenhuma notificação ainda"}</h2>
          <p className={s.vazioTexto}>
            {f === "nao_lidas"
              ? "Tudo que chegou até agora já foi visto."
              : "Avisos sobre autorização, pagamento, estorno e problemas de integração aparecem aqui."}
          </p>
        </section>
      )}

      {notificacoes.length > 0 && (
        <>
          <div className={s.notificacaoLista}>
            {notificacoes.map((n) => (
              <NotificacaoItem
                key={n.id}
                id={n.id}
                titulo={n.titulo}
                mensagem={n.mensagem}
                prioridade={n.prioridade}
                lida={n.lida}
                link={n.link}
                quando={new Date(n.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              />
            ))}
          </div>

          {ultima > 1 && (
            <nav className={s.paginacao} aria-label="Paginação">
              <span>Página {p} de {ultima}</span>
              <span className={s.paginacaoAcoes}>
                {p > 1 && <Link href={url({ pagina: String(p - 1) })} className={s.botaoSec}>Anterior</Link>}
                {p < ultima && <Link href={url({ pagina: String(p + 1) })} className={s.botaoSec}>Próxima</Link>}
              </span>
            </nav>
          )}
        </>
      )}
    </>
  );
}
