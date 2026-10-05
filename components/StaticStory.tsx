import { CHARGES, MESSAGES } from "@/lib/scene";
import { Check, Zap, ArrowRight } from "./icons";
import s from "./StaticStory.module.css";

/**
 * Versão para prefers-reduced-motion: a mesma história, sem câmera e sem
 * scroll dirigido. Nada é escondido atrás de animação — todos os estados da
 * narrativa ficam legíveis de uma vez.
 */
export default function StaticStory() {
  return (
    <div className={s.doc}>
      <section className={s.hero}>
        <span className={s.kicker}>Cobrança recorrente no Pix Automático</span>
        <p className={s.headline}>
          Pare de cobrar.
          <br />
          <span>Comece a receber.</span>
        </p>
        <p className={s.sub}>
          Automatize suas cobranças recorrentes via Pix Automático e receba sem
          precisar lembrar seus clientes de pagar.
        </p>
        <div className={s.ctaRow}>
          <a className={s.btnPrimary} href="/criar-conta">
            Começar agora <ArrowRight />
          </a>
          <a className={s.btnGhost} href="#como-funciona">
            Ver como funciona
          </a>
        </div>
      </section>

      <section className={s.block}>
        <h2 className={s.h2}>Hoje, cobrar é o seu segundo trabalho</h2>
        <ul className={s.list}>
          {CHARGES.map((c) => (
            <li key={c.id} className={s.item}>
              <strong>{c.nome}</strong>
              <span>{c.plano}</span>
              <span className="tnum">
                {c.valor} {c.periodo}
              </span>
              <em>{c.status}</em>
            </li>
          ))}
        </ul>
        <ul className={s.msgs}>
          {MESSAGES.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      </section>

      <section className={s.block}>
        <p className={s.phrase}>E se você não precisasse mais cobrar?</p>
      </section>

      <section className={s.block}>
        <h2 className={s.brandName}>Zelo</h2>
        <p className={s.brandLine}>Você trabalha. A Zelo cobra.</p>
      </section>

      <section className={s.block}>
        <h2 className={s.h2}>Uma cobrança, criada uma vez</h2>
        <dl className={s.card} id="comecar">
          <div>
            <dt>Cliente</dt>
            <dd>Mariana Souza</dd>
          </div>
          <div>
            <dt>Serviço</dt>
            <dd>Plano mensal</dd>
          </div>
          <div>
            <dt>Valor</dt>
            <dd className="tnum">R$ 350,00 / mês</dd>
          </div>
          <div>
            <dt>Recorrência</dt>
            <dd>Mensal</dd>
          </div>
          <div>
            <dt>Próxima cobrança</dt>
            <dd>
              05 SET{" "}
              <span className={s.badge}>
                <Check /> Agendada
              </span>
            </dd>
          </div>
        </dl>
        <ol className={s.estados}>
          <li>
            <strong>Criar cobrança</strong>
            <span>Você faz isso uma vez. Só uma.</span>
          </li>
          <li>
            <strong className={s.pix}>
              <Zap /> Pix Automático — autorizado
            </strong>
            <span>Mariana autoriza uma vez, no app do banco dela.</span>
          </li>
          <li>
            <strong>Cobrança ativa · R$ 350,00 / mês</strong>
            <span>Entra na sua conta todo dia 05, sem você fazer nada.</span>
          </li>
        </ol>
      </section>

      <section className={s.block}>
        <h2 className={s.h2}>E aí o dia 05 chega</h2>
        <ol className={s.estados}>
          <li>
            <strong>Mariana Souza · cliente</strong>
            <span>
              A cobrança de R$ 350,00 / mês vence. O gatilho é o calendário,
              não você.
            </span>
          </li>
          <li>
            <strong className={s.pix}>
              <Zap /> O Pix Automático debita
            </strong>
            <span>R$ 350,00 saem da conta dela, autorizados uma única vez.</span>
          </li>
          <li>
            <strong>Você · prestador</strong>
            <span className="tnum">
              Recebido desde setembro: R$ 350,00 — depois R$ 700,00, depois
              R$ 1.050,00. Você não fez nada em nenhum dos meses.
            </span>
          </li>
          <li>
            <strong>Próxima cobrança: 05 DEZ</strong>
            <span>Já preparada, sem nenhuma ação manual.</span>
          </li>
        </ol>
      </section>

      <section className={s.block}>
        <h2 className={s.h2}>E você continua trabalhando</h2>
        <ul className={s.list}>
          {CHARGES.map((c) => (
            <li key={c.id} className={s.item}>
              <strong>{c.nome}</strong>
              <span>{c.plano}</span>
              <span className="tnum">
                {c.valor} {c.periodo}
              </span>
              <em className={s.pix}>
                <Check /> Pago
              </em>
            </li>
          ))}
        </ul>
        <p className={s.note}>
          Os mesmos clientes do começo. Sem mensagem, sem lembrete, sem
          planilha — e sem você precisar acompanhar.
        </p>
      </section>

      <section className={s.fim}>
        <p className={s.brandLine}>Você trabalha. A Zelo cobra.</p>
        <a className={s.ctaFinal} href="/criar-conta">
          Criar minha primeira cobrança <ArrowRight />
        </a>
        <p className={s.publico}>
          Para quem vive de mensalidade — personal, terapeuta, professor,
          consultor.
        </p>
      </section>
    </div>
  );
}
