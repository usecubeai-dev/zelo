import Link from "next/link";
import s from "./Legal.module.css";

/**
 * Peças compartilhadas das páginas legais.
 *
 * Regra que governa estes dois documentos: **nada aqui é texto jurídico.**
 * O que existe é a ESTRUTURA que um advogado preenche, mais o levantamento
 * factual do que o sistema realmente coleta — que é verificável no código
 * e economiza a primeira hora de quem for redigir.
 *
 * Texto genérico de internet apresentado como política é pior que política
 * nenhuma: cria a impressão de conformidade sem nenhuma.
 */

export function MolduraLegal({
  titulo,
  atualizacao,
  children,
}: {
  titulo: string;
  atualizacao: string;
  children: React.ReactNode;
}) {
  return (
    <div className={s.pagina}>
      <header className={s.topo}>
        <Link href="/" className={s.marca}>
          <span className={s.marcaPonto} aria-hidden="true" />
          Zelo
        </Link>
      </header>

      <main className={s.corpo}>
        <div className={s.inner}>
          <h1 className={s.titulo}>{titulo}</h1>
          <p className={s.subtitulo}>{atualizacao}</p>

          <AvisoRascunho />

          {children}

          <footer className={s.rodape}>
            <Link href="/" className={s.link}>
              ← Voltar para a página inicial
            </Link>
            <Link href="/termos" className={s.link}>
              Termos de uso
            </Link>
            <Link href="/privacidade" className={s.link}>
              Política de privacidade
            </Link>
          </footer>
        </div>
      </main>
    </div>
  );
}

/**
 * Este aviso não é decoração: sem ele, um documento com títulos de seção
 * e aparência de política passa a impressão de estar em vigor.
 */
function AvisoRascunho() {
  return (
    <section className={s.avisoRascunho} role="note" aria-labelledby="aviso-rascunho">
      <h2 id="aviso-rascunho" className={s.avisoTitulo}>
        Documento em elaboração — ainda não vigente
      </h2>
      <p className={s.avisoTexto}>
        Esta página existe como estrutura, à espera do texto definitivo
        redigido e revisado por profissional habilitado. O que está aqui{" "}
        <strong>não constitui contrato, política em vigor ou orientação
        jurídica</strong>. Os trechos marcados como pendentes dependem de
        dados da empresa e de revisão jurídica.
      </p>
    </section>
  );
}

export function Secao({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className={s.secao} aria-labelledby={id}>
      <h2 id={id} className={s.secaoTitulo}>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/** Marcador do que falta. Precisa saltar aos olhos de quem revisa. */
export function Pendente({ children }: { children: React.ReactNode }) {
  return <span className={s.pendente}>[{children}]</span>;
}

export function BlocoPendente({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className={s.blocoPendente}>
      <Pendente>{rotulo}</Pendente>
      <p className={s.blocoPendenteTexto}>{children}</p>
    </div>
  );
}

export function Texto({ children }: { children: React.ReactNode }) {
  return <p className={s.texto}>{children}</p>;
}

export function Lista({ itens }: { itens: React.ReactNode[] }) {
  return (
    <ul className={s.lista}>
      {itens.map((i, n) => (
        <li key={n}>{i}</li>
      ))}
    </ul>
  );
}

/**
 * O que o sistema coleta HOJE — levantado do código, não redigido.
 *
 * `lib/lead.ts`, `lib/conta.ts`, `lib/cliente.ts` e `lib/cobranca.ts` são a
 * fonte. Se um campo mudar lá e não mudar aqui, este quadro fica errado —
 * e é exatamente por isso que ele é curto e aponta os arquivos.
 */
export function QuadroDeDados() {
  const linhas: [string, string, string][] = [
    [
      "Interessado (lead)",
      "Nome, WhatsApp, e-mail",
      "Formulário de /comecar. Origem: lib/lead.ts",
    ],
    [
      "Titular da conta",
      "Nome, e-mail, senha (armazenada pelo Supabase Auth, nunca pela Zelo em texto)",
      "Cadastro. Origem: lib/conta.ts",
    ],
    [
      "Empresa do usuário",
      "Nome comercial, documento (CPF/CNPJ) quando informado",
      "Configurações. Origem: tabela empresas",
    ],
    [
      "Clientes do usuário",
      "Nome, e-mail, WhatsApp, CPF/CNPJ e observações — todos opcionais, exceto o nome",
      "Cadastrados pelo usuário. Origem: lib/cliente.ts",
    ],
    [
      "Cobranças",
      "Descrição, valor, vencimento, situação e data de pagamento",
      "Origem: lib/cobranca.ts",
    ],
    [
      "Uso do site",
      "Eventos de navegação e conversão, se Google Analytics ou Microsoft Clarity estiverem configurados",
      "Só carregam se as variáveis de ambiente existirem. Origem: components/Analytics.tsx",
    ],
  ];

  return (
    <div className={s.tabelaEnvolve}>
      <table className={s.tabela}>
        <caption className="sr-only">
          Dados que o sistema coleta atualmente, levantados do código-fonte
        </caption>
        <thead>
          <tr>
            <th scope="col">Titular</th>
            <th scope="col">Dados</th>
            <th scope="col">Onde e origem no código</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(([titular, dados, origem]) => (
            <tr key={titular}>
              <th scope="row" style={{ fontWeight: 600, color: "var(--paper)" }}>
                {titular}
              </th>
              <td>{dados}</td>
              <td>{origem}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
