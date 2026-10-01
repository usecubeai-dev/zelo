import type { Metadata } from "next";
import {
  BlocoPendente,
  Lista,
  MolduraLegal,
  Pendente,
  QuadroDeDados,
  Secao,
  Texto,
} from "../PecasLegais";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description:
    "Política de privacidade da Zelo. Documento em elaboração, ainda não vigente.",
  alternates: { canonical: "/privacidade" },
  robots: { index: false, follow: true },
};

export default function Privacidade() {
  return (
    <MolduraLegal
      titulo="Política de privacidade"
      atualizacao="Estrutura criada em 26/08/2026 · sem versão vigente"
    >
      <Secao id="controlador" titulo="1. Quem trata os dados">
        <Texto>
          A LGPD exige identificar o controlador e um encarregado (DPO).
          Dados do controlador reais, fornecidos pelo proprietário em
          10/09/2026 — nenhum foi presumido. O encarregado formal segue
          pendente (ver abaixo).
        </Texto>
        <Lista
          itens={[
            <>Controlador (razão social): GOGOMOB TECNOLOGIA BR LTDA</>,
            <>CNPJ: 48.443.579/0001-93</>,
            <>Endereço: Av. Portugal, 1148, Cond. Orion Business, Sala C 2501, Setor Marista, Goiânia - GO, CEP 74.150-030</>,
            <>Encarregado (DPO) e canal de contato: usecube.ai@gmail.com — <Pendente>ainda não há um encarregado formalmente designado, nem canal dedicado separado do contato geral</Pendente></>,
          ]}
        />
      </Secao>

      <Secao id="dados" titulo="2. Dados tratados hoje">
        <Texto>
          O quadro abaixo <strong>não é texto jurídico</strong>: é o
          levantamento do que o sistema realmente coleta, extraído do código.
          Serve de insumo para quem for redigir a política.
        </Texto>
        <QuadroDeDados />
        <Texto>
          Um ponto merece atenção especial na redação: parte dos dados é de{" "}
          <strong>terceiros</strong> — os clientes cadastrados pelo usuário,
          que nunca interagiram com a Zelo. A relação entre Zelo (operadora) e
          usuário (controlador) sobre esses dados precisa estar explícita.
        </Texto>
      </Secao>

      <Secao id="finalidade" titulo="3. Finalidade e base legal">
        <BlocoPendente rotulo="REVISÃO JURÍDICA">
          Finalidade de cada tratamento e a base legal correspondente do art.
          7º da LGPD — execução de contrato, legítimo interesse, cumprimento
          de obrigação legal ou consentimento. Base legal errada invalida o
          tratamento inteiro, então isso não se escolhe por analogia.
        </BlocoPendente>
      </Secao>

      <Secao id="compartilhamento" titulo="4. Com quem os dados são compartilhados">
        <Texto>
          Operadores em uso hoje, verificáveis no código e nas variáveis de
          ambiente:
        </Texto>
        <Lista
          itens={[
            <>
              <strong>Supabase</strong> — banco de dados e autenticação.
              Região do projeto: <code>us-east-1</code> (Estados Unidos)
            </>,
            <>
              <strong>Google Analytics</strong> e <strong>Microsoft
              Clarity</strong> — só carregam se as variáveis de ambiente
              estiverem preenchidas
            </>,
            <>
              Processador de pagamentos — <Pendente>NÃO CONTRATADO</Pendente>{" "}
              e ainda não ativo
            </>,
          ]}
        />
        <BlocoPendente rotulo="REVISÃO JURÍDICA">
          A hospedagem fora do Brasil configura{" "}
          <strong>transferência internacional de dados</strong> e exige
          tratamento específico nos arts. 33 a 36 da LGPD. Precisa de cláusula
          própria, não de menção de passagem.
        </BlocoPendente>
      </Secao>

      <Secao id="retencao" titulo="5. Por quanto tempo os dados ficam guardados">
        <Texto>
          O que o sistema faz hoje, de fato: excluir a conta remove em cascata
          a empresa, os clientes e as cobranças vinculadas — não há cópia
          preservada fora do banco.
        </Texto>
        <BlocoPendente rotulo="REVISÃO JURÍDICA">
          Prazos de retenção por tipo de dado, considerando obrigações fiscais
          e contábeis que podem exigir guarda mesmo após o pedido de exclusão.
        </BlocoPendente>
      </Secao>

      <Secao id="direitos" titulo="6. Direitos do titular">
        <Texto>
          O art. 18 da LGPD garante confirmação, acesso, correção,
          anonimização, portabilidade, eliminação e informação sobre
          compartilhamento.
        </Texto>
        <BlocoPendente rotulo="DEFINIÇÃO OPERACIONAL E JURÍDICA">
          Canal para exercer cada direito, prazo de resposta e forma de
          verificar a identidade de quem solicita. Publicar direitos sem um
          canal que funcione é promessa sem cumprimento.
        </BlocoPendente>
      </Secao>

      <Secao id="seguranca" titulo="7. Segurança">
        <Texto>
          Medidas já implementadas e verificáveis no código:
        </Texto>
        <Lista
          itens={[
            "Isolamento entre empresas aplicado no banco por Row Level Security, testado contra acesso direto à API",
            "Senhas sob responsabilidade do Supabase Auth — a Zelo nunca as armazena nem as vê",
            "Chave de serviço restrita ao servidor, ausente do código enviado ao navegador",
            "Comunicação por HTTPS",
          ]}
        />
        <BlocoPendente rotulo="REVISÃO JURÍDICA">
          Procedimento de resposta a incidente de segurança e comunicação à
          ANPD e aos titulares, conforme o art. 48 da LGPD.
        </BlocoPendente>
      </Secao>

      <Secao id="cookies" titulo="8. Cookies">
        <Texto>
          Cookies em uso hoje: os de <strong>sessão</strong>, necessários para
          manter o usuário autenticado. Os de análise só existem se Google
          Analytics ou Microsoft Clarity estiverem configurados.
        </Texto>
        <BlocoPendente rotulo="DEFINIÇÃO JURÍDICA">
          Se ferramentas de análise forem ativadas, avaliar a necessidade de
          aviso e de gestão de consentimento.
        </BlocoPendente>
      </Secao>

      <Secao id="alteracoes" titulo="9. Alterações desta política">
        <BlocoPendente rotulo="REVISÃO JURÍDICA">
          Como mudanças serão comunicadas e a partir de quando passam a valer.
        </BlocoPendente>
      </Secao>
    </MolduraLegal>
  );
}
