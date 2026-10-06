import type { Metadata } from "next";
import { MolduraLegal, Texto } from "../../PecasLegais";
import FormularioSolicitacao from "./FormularioSolicitacao";

export const metadata: Metadata = {
  title: "Solicitação de titular de dados",
  description: "Peça acesso, correção, exclusão ou portabilidade dos seus dados pessoais tratados pelo Zelo.",
  alternates: { canonical: "/privacidade/solicitacao" },
  robots: { index: false, follow: true },
};

export default function SolicitacaoTitular() {
  return (
    <MolduraLegal
      titulo="Solicitação de titular de dados"
      atualizacao="Pedidos sobre os seus dados pessoais"
      avisoRascunho={false}
    >
      <Texto>
        Se o Zelo trata dados pessoais seus, você pode pedir acesso, correção, exclusão ou portabilidade, ou fazer outro
        pedido sobre eles. Isso vale tanto para quem tem conta no Zelo quanto para quem é cliente de um profissional que
        usa o Zelo.
      </Texto>
      <Texto>
        Preencha o formulário. O pedido é registrado e a resposta é enviada ao e-mail que você informar. Não pedimos
        senha nem documentos neste formulário.
      </Texto>

      <FormularioSolicitacao />
    </MolduraLegal>
  );
}
