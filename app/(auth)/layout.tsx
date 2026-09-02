import Link from "next/link";
import s from "./Auth.module.css";

/**
 * Casca das telas de conta. Chrome mínimo de propósito: uma tela de login
 * com menu completo é convite para o visitante sair sem entrar. O único
 * caminho é a marca, de volta para a home.
 */
export default function LayoutAuth({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${s.pagina} zelo-produto`}>
      <header className={s.topo}>
        <Link href="/" className={s.marca}>
          <span className={s.marcaPonto} aria-hidden="true" />
          Zelo
        </Link>
      </header>
      <main className={s.corpo}>
        <div className={s.cartao}>{children}</div>
      </main>
    </div>
  );
}
