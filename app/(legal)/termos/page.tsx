import type { Metadata } from "next";
import {
  BlocoPendente,
  Lista,
  MolduraLegal,
  Pendente,
  Secao,
  Texto,
} from "../PecasLegais";
import { formatarCentavos } from "@/lib/dinheiro";
import { NOME_DO_PLANO, PRECO_POR_PLANO_CENTAVOS, TAXA_DE_RECEBIMENTO_CENTAVOS } from "@/lib/plano";

export const metadata: Metadata = {
  title: "Termos de uso",
  description:
    "Termos de uso da Zelo. Documento em elaboração, ainda não vigente.",
  alternates: { canonical: "/termos" },
  /* noindex enquanto for rascunho: um documento legal indexado dá a
     entender que está em vigor, e ele não está. */
  robots: { index: false, follow: true },
};

export default function Termos() {
  return (
    <MolduraLegal
      titulo="Termos de uso"
      atualizacao="Estrutura criada em 26/08/2026 · sem versão vigente"
    >
      <Secao id="objeto" titulo="1. Objeto e aceitação">
        <Texto>
          A Zelo é uma plataforma de gestão e cobrança recorrente. Esta seção
          deve definir o que o contratante aceita ao usar o serviço, quando a
          aceitação ocorre e como as alterações passam a valer.
        </Texto>
        <BlocoPendente rotulo="REVISÃO JURÍDICA">
          Redação do objeto contratual, momento e forma de aceite, e regra de
          alteração unilateral dos termos.
        </BlocoPendente>
      </Secao>

      <Secao id="identificacao" titulo="2. Identificação do contratado">
        <Texto>
          A legislação exige identificar quem presta o serviço. Dados reais,
          fornecidos pelo proprietário em 10/09/2026 — nenhum foi presumido.
        </Texto>
        <Lista
          itens={[
            <>Razão social: GOGOMOB TECNOLOGIA BR LTDA</>,
            <>CNPJ: 48.443.579/0001-93</>,
            <>Endereço: Av. Portugal, 1148, Cond. Orion Business, Sala C 2501, Setor Marista, Goiânia - GO, CEP 74.150-030</>,
            <>E-mail de contato: usecube.ai@gmail.com</>,
          ]}
        />
      </Secao>

      <Secao id="cadastro" titulo="3. Cadastro e conta">
        <Texto>
          O acesso exige conta com e-mail e senha. Cada conta pertence a uma
          empresa, e os dados de uma empresa não são acessíveis a outra.
        </Texto>
        <BlocoPendente rotulo="REVISÃO JURÍDICA">
          Requisitos de capacidade civil, veracidade das informações,
          responsabilidade pela guarda da senha e hipóteses de suspensão ou
          encerramento da conta.
        </BlocoPendente>
      </Secao>

      <Secao id="plano" titulo="4. Plano, teste gratuito e pagamento">
        <Texto>
          Condições comerciais já definidas: <strong>30 dias de teste
          gratuito</strong> em qualquer plano e, após esse período, mensalidade
          conforme o plano contratado — {NOME_DO_PLANO.essencial}{" "}
          ({formatarCentavos(PRECO_POR_PLANO_CENTAVOS.essencial)}/mês),{" "}
          {NOME_DO_PLANO.profissional}{" "}
          ({formatarCentavos(PRECO_POR_PLANO_CENTAVOS.profissional)}/mês) ou{" "}
          {NOME_DO_PLANO.premium}{" "}
          ({formatarCentavos(PRECO_POR_PLANO_CENTAVOS.premium)}/mês) — mais uma
          taxa de recebimento de {formatarCentavos(TAXA_DE_RECEBIMENTO_CENTAVOS)}{" "}
          por pagamento recebido. Durante o teste não há cobrança e não é
          exigido meio de pagamento.
        </Texto>
        <BlocoPendente rotulo="REVISÃO JURÍDICA">
          Forma e data de cobrança, consequências do não pagamento, política
          de reembolso, direito de arrependimento previsto no art. 49 do
          Código de Defesa do Consumidor e regra de reajuste.
        </BlocoPendente>
      </Secao>

      <Secao id="pagamentos" titulo="5. Processamento de pagamentos">
        <Texto>
          A Zelo organiza cobranças; o processamento financeiro é feito por
          terceiro. A integração de pagamento{" "}
          <strong>ainda não está ativa</strong> — nenhuma cobrança é
          processada no estado atual do sistema.
        </Texto>
        <BlocoPendente rotulo="DEFINIÇÃO COMERCIAL E JURÍDICA">
          Identificação do processador contratado, divisão de
          responsabilidades entre Zelo e processador, e prazos de repasse.
          Nada disso deve ser publicado antes de estar contratado.
        </BlocoPendente>
      </Secao>

      <Secao id="obrigacoes" titulo="6. Obrigações do usuário">
        <Texto>
          O usuário cadastra dados de terceiros na plataforma — os clientes
          dele. Isso cria obrigações específicas quanto à origem e ao uso
          desses dados.
        </Texto>
        <BlocoPendente rotulo="REVISÃO JURÍDICA">
          Uso permitido e vedado, base legal para o usuário tratar dados de
          seus próprios clientes, e responsabilidade pelo conteúdo inserido.
        </BlocoPendente>
      </Secao>

      <Secao id="disponibilidade" titulo="7. Disponibilidade e suporte">
        <BlocoPendente rotulo="DEFINIÇÃO COMERCIAL">
          Compromisso de disponibilidade, canais e horários de suporte e
          janelas de manutenção. Não prometer indicador que não seja medido.
        </BlocoPendente>
      </Secao>

      <Secao id="responsabilidade" titulo="8. Limitação de responsabilidade">
        <BlocoPendente rotulo="REVISÃO JURÍDICA">
          Limites de responsabilidade compatíveis com o Código de Defesa do
          Consumidor — cláusula copiada de modelo genérico costuma ser
          inválida no Brasil.
        </BlocoPendente>
      </Secao>

      <Secao id="rescisao" titulo="9. Cancelamento e encerramento">
        <BlocoPendente rotulo="REVISÃO JURÍDICA">
          Como cancelar, efeitos do cancelamento, prazo de retenção e forma de
          exportação dos dados antes da exclusão.
        </BlocoPendente>
      </Secao>

      <Secao id="foro" titulo="10. Legislação aplicável e foro">
        <BlocoPendente rotulo="REVISÃO JURÍDICA">
          Lei aplicável e foro eleito, observadas as regras de competência do
          consumidor.
        </BlocoPendente>
      </Secao>
    </MolduraLegal>
  );
}
