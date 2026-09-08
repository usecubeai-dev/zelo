import Link from "next/link";
import s from "./Autorizar.module.css";

/**
 * Casca da tela pública de autorização Pix Automático.
 *
 * Quem abre este link não é o profissional que usa a Zelo — é o CLIENTE
 * dele, sem conta, sem login. Por isso fica fora de `(app)` (que exige
 * sessão) e de `(auth)` (que é sobre criar/entrar numa conta da Zelo,
 * não sobre isto). Chrome mínimo de propósito, igual à casca de conta.
 */
export default function LayoutAutorizar({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${s.pagina} zelo-produto`}>
      <header className={s.topo}>
        <Link href="/" className={s.marca}>
          <span className={s.marcaPonto} aria-hidden="true" />
          Zelo
        </Link>
      </header>
      <main className={s.corpo}>
        <div className={s.envolve}>{children}</div>
      </main>
    </div>
  );
}
