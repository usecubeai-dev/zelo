import s from "../App.module.css";
import { IconeSair } from "./Icones";

/**
 * Sair por POST, não por link: logout via GET permite que um `<img>` em
 * outro site derrube a sessão do usuário sem ele pedir.
 *
 * `variante="texto"` é o item "Sair" do menu da conta (no cabeçalho);
 * a variante de ícone é a usada nas telas sem cabeçalho.
 */
export default function BotaoSair({ variante = "icone" }: { variante?: "icone" | "texto" }) {
  return (
    <form action="/auth/sair" method="post">
      {variante === "texto" ? (
        <button type="submit" className={s.perfilSair}>
          <IconeSair className={s.navIcone} aria-hidden="true" />
          Sair
        </button>
      ) : (
        <button type="submit" className={s.sair} title="Sair" aria-label="Sair">
          <IconeSair className={s.navIcone} aria-hidden="true" />
        </button>
      )}
    </form>
  );
}
