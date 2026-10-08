import s from "../App.module.css";

export type ItemResumo = {
  rotulo: string;
  valor: string;
  /** cor do número: dinheiro que entrou, atenção, ou neutro */
  tom?: "sucesso" | "alerta" | "neutro";
  apoio?: string;
};

/**
 * Faixa de 3–4 números no topo das listas (Recebido, A receber, Atrasado…).
 * Só apresenta valores que a página já calculou no servidor.
 */
export default function ResumoCards({ itens, rotulo }: { itens: ItemResumo[]; rotulo: string }) {
  return (
    <section className={s.resumoCards} aria-label={rotulo}>
      {itens.map((i) => (
        <div key={i.rotulo} className={`${s.resumoCard} ${i.tom === "sucesso" ? s.resumoSucesso : i.tom === "alerta" ? s.resumoAlerta : ""}`}>
          <span className={s.resumoRotulo}>{i.rotulo}</span>
          <strong className={s.resumoValor}>{i.valor}</strong>
          {i.apoio && <span className={s.resumoApoio}>{i.apoio}</span>}
        </div>
      ))}
    </section>
  );
}
