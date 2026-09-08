import { redirect } from "next/navigation";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { getAsaasConfiguration } from "@/lib/asaas/config";
import { obterContaFinanceira } from "@/lib/core/onboarding";
import { formatarDocumento } from "@/lib/cliente";
import FormularioConfiguracoes from "./FormularioConfiguracoes";
import ContaFinanceira from "./ContaFinanceira";
import s from "../../App.module.css";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) redirect("/entrar?de=/app/configuracoes");

  const supabase = await supabaseServer();
  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, nome, documento, assinatura_status, asaas_customer_id, asaas_subscription_id")
    .eq("id", empresaId)
    .maybeSingle();

  if (!empresa) redirect("/entrar");

  const asaasConfig = getAsaasConfiguration();
  const contaFinanceira = await obterContaFinanceira(empresaId);

  return (
    <>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>Configurações</h1>
        <p className={s.subtitulo}>
          Gerencie os dados da sua empresa e o status das integrações.
        </p>
      </header>

      {/* Conta de recebimentos (subconta Asaas desta empresa) — distinta
          do painel técnico abaixo, que mostra se a PLATAFORMA Zelo tem a
          chave de API configurada. Uma é por empresa; a outra é global. */}
      <ContaFinanceira inicial={contaFinanceira} documentoEmpresa={empresa.documento} />

      {/* Dados da Empresa */}
      <section style={{ marginBottom: 40 }}>
        <h2 className={s.vazioTitulo} style={{ marginBottom: 16 }}>
          Dados da Empresa
        </h2>
        <FormularioConfiguracoes
          inicial={{
            nome: empresa.nome || "",
            documento: empresa.documento ? formatarDocumento(empresa.documento) : "",
          }}
        />
      </section>

      {/* Painel técnico — nada aqui pede ação do usuário (é leitura de
          configuração de infraestrutura), então fica atrás de um
          <details> recolhido, não na visão normal da tela. Achado da
          auditoria de UX: "Webhook URL"/"Ambiente"/ID bruto não são
          acionáveis pra quem não é desenvolvedor. */}
      <details className={s.resumoTecnico} style={{ marginTop: 8 }}>
        <summary>Avançado — detalhes técnicos da integração</summary>
        <section style={{ marginTop: 16 }}>
          <div className={s.numeros}>
            <div className={s.numero}>
              <span className={s.numeroRotulo}>Status da Conexão</span>
              <span className={s.numeroValor}>
                <span
                  className={`${s.etiqueta} ${
                    asaasConfig.isConfigured ? s.sitPaga : s.sitVencida
                  }`}
                >
                  {asaasConfig.isConfigured ? "Conectado" : "Aguardando chave"}
                </span>
              </span>
            </div>

            <div className={s.numero}>
              <span className={s.numeroRotulo}>Ambiente</span>
              <span className={s.numeroValor}>
                {asaasConfig.environment === "production" ? "Produção" : "Sandbox"}
              </span>
            </div>

            <div className={s.numero}>
              <span className={s.numeroRotulo}>Webhook URL</span>
              <span
                className={s.numeroValor}
                style={{ fontSize: "0.85rem", wordBreak: "break-all" }}
              >
                /api/webhooks/asaas
              </span>
            </div>

            <div className={s.numero}>
              <span className={s.numeroRotulo}>Identificador da Empresa</span>
              <span
                className={s.numeroValor}
                style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}
              >
                {empresa.asaas_customer_id || "Não gerado"}
              </span>
            </div>
          </div>

          {!asaasConfig.isConfigured && (
            <div className={s.avisoConexao} style={{ marginTop: 20 }}>
              A chave da API do parceiro de pagamentos ainda não foi configurada nas variáveis de ambiente.
              O sistema está operando na modalidade de gestão interna com baixa manual de pagamentos até a ativação das credenciais.
            </div>
          )}
        </section>
      </details>
    </>
  );
}
