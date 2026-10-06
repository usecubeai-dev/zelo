import { EMPRESA, estaPendente, mailtoDe } from "@/lib/company";
import s from "./RodapeEmpresa.module.css";

/**
 * Identificação da empresa e canais de atendimento.
 *
 * Server-safe (sem hooks, sem estado): pode ser usado em Server Components
 * e dentro de componentes cliente. Todos os dados vêm de `EMPRESA`
 * (`lib/company.ts`), a fonte única. Campo ainda `[PREENCHER]` aparece como
 * texto marcado — nunca como link (`mailto:[PREENCHER]` seria um link
 * quebrado) e nunca é substituído por algo inventado.
 *
 * `variante`: o produto e as telas de conta são claros; a landing e as
 * páginas legais usam os tokens escuros da marca. `compacto`: linha discreta
 * para telas de auth, onde o rodapé não pode competir com o formulário.
 */
export default function RodapeEmpresa({
  variante = "escuro",
  compacto = false,
  semRecuoLateral = false,
  titulo = "Quem somos e como falar com a gente",
}: {
  variante?: "claro" | "escuro";
  compacto?: boolean;
  /** quando já está dentro de uma coluna com padding próprio (ex.: conteúdo do /app) */
  semRecuoLateral?: boolean;
  titulo?: string;
}) {
  const classe = [
    s.raiz,
    variante === "claro" ? s.claro : s.escuro,
    compacto ? s.compacto : "",
    semRecuoLateral ? s.semRecuo : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <footer className={classe} aria-label="Identificação da empresa">
      {!compacto && <h2 className={s.titulo}>{titulo}</h2>}

      <dl className={s.dados}>
        <Item rotulo="Razão social" valor={EMPRESA.razaoSocial} />
        <Item rotulo="Nome fantasia" valor={EMPRESA.nomeFantasia} />
        <Item rotulo="CNPJ" valor={EMPRESA.cnpj} />
        <Item rotulo="Endereço" valor={EMPRESA.endereco} largo />
        <Item rotulo="E-mail de suporte" valor={EMPRESA.emailSuporte} tipo="email" />
        <Item rotulo="E-mail de privacidade" valor={EMPRESA.emailPrivacidade} tipo="email" />
        <Item rotulo="Telefone / WhatsApp" valor={EMPRESA.telefoneAtendimento} tipo="telefone" />
        <Item rotulo="Horário de atendimento" valor={EMPRESA.horarioAtendimento} />
      </dl>

      <nav className={s.links} aria-label="Documentos e privacidade">
        <a href="/termos">Termos de Uso</a>
        <a href="/privacidade">Política de Privacidade</a>
        <a href="/privacidade/solicitacao">Solicitação de titular de dados</a>
      </nav>
    </footer>
  );
}

function Item({
  rotulo,
  valor,
  tipo,
  largo,
}: {
  rotulo: string;
  valor: string;
  tipo?: "email" | "telefone";
  largo?: boolean;
}) {
  const pendente = estaPendente(valor);
  let conteudo: React.ReactNode = valor;

  if (pendente) {
    conteudo = <span className={s.pendente}>{valor}</span>;
  } else if (tipo === "email") {
    const href = mailtoDe(valor);
    if (href) conteudo = <a href={href}>{valor}</a>;
  } else if (tipo === "telefone") {
    const digitos = valor.replace(/[^\d+]/g, "");
    if (digitos.length >= 8) conteudo = <a href={`tel:${digitos}`}>{valor}</a>;
  }

  return (
    <div className={largo ? `${s.item} ${s.itemLargo}` : s.item}>
      <dt>{rotulo}</dt>
      <dd>{conteudo}</dd>
    </div>
  );
}
