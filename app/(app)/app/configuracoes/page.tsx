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
          da seção abaixo, que mostra se a PLATAFORMA Zelo tem a chave de
          API configurada. Uma é por empresa; a outra é global. */}
      <ContaFinanceira inicial={contaFinanceira} />

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

      {/* Integração Financeira Asaas */}
      <section style={{ borderTop: "1px solid var(--border)", paddingTop: 32 }}>
        <h2 className={s.vazioTitulo} style={{ marginBottom: 8 }}>
          Integração Financeira (Asaas & Pix Automático)
        </h2>
        <p className={s.subtitulo} style={{ marginBottom: 20 }}>
          Camada de comunicação bancária e recebimento de webhooks.
        </p>

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
          <div
            style={{
              padding: "11px 13px",
              borderLeft: "2px solid var(--border-strong)",
              background: "var(--surface-sunken)",
              color: "var(--text-secondary)",
              fontSize: "0.85rem",
              lineHeight: 1.45,
              marginTop: 20,
            }}
          >
            A chave da API do Asaas ainda não foi configurada nas variáveis de ambiente.
            O sistema está operando na modalidade de gestão interna com baixa manual de pagamentos até a ativação das credenciais.
          </div>
        )}
      </section>
    </>
  );
}
