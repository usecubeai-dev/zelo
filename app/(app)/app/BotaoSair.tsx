import s from "../App.module.css";
import { IconeSair } from "./Icones";

/**
 * Sair por POST, não por link: logout via GET permite que um `<img>` em
 * outro site derrube a sessão do usuário sem ele pedir.
 */
export default function BotaoSair() {
  return (
    <form action="/auth/sair" method="post">
      <button type="submit" className={s.sair}>
        <IconeSair className={s.navIcone} aria-hidden="true" />
        Sair
      </button>
    </form>
  );
}
