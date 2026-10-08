import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer, usuarioAtual } from "@/lib/supabase/server";
import { getAsaasConfiguration } from "@/lib/asaas/config";
import { obterContaFinanceira } from "@/lib/core/onboarding";
import { formatarDocumento } from "@/lib/cliente";
import FormularioConfiguracoes from "./FormularioConfiguracoes";
import ContaFinanceira from "./ContaFinanceira";
import ExcluirConta from "./ExcluirConta";
import PreferenciasCobranca from "./PreferenciasCobranca";
import { COLUNAS_PREFERENCIAS, preferenciasDaEmpresa } from "@/lib/recuperacao";
import { NOME_DO_PLANO, normalizarPlano } from "@/lib/plano";
import PageHeader from "../PageHeader";
import s from "../../App.module.css";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const atual = await usuarioAtual();
  const empresaId = atual?.membro?.empresa_id as string | undefined;
  if (!empresaId) redirect("/entrar?de=/app/configuracoes");

  const supabase = await supabaseServer();
  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, nome, documento, plano, assinatura_status, asaas_customer_id, asaas_subscription_id")
    .eq("id", empresaId)
    .maybeSingle();

  if (!empresa) redirect("/entrar");

  const { data: linhaPrefs } = await supabase.from("empresas").select(COLUNAS_PREFERENCIAS).eq("id", empresaId).maybeSingle();
  const preferencias = preferenciasDaEmpresa(linhaPrefs as Record<string, unknown> | null);

  const asaasConfig = getAsaasConfiguration();
  const contaFinanceira = await obterContaFinanceira(empresaId);

  const dono = atual?.membro?.papel === "dono";
  const plano = normalizarPlano(empresa.plano);

  const secoes = [
    { id: "recebimentos", rotulo: "Recebimentos" },
    { id: "empresa", rotulo: "Empresa" },
    { id: "cobranca-e-recuperacao", rotulo: "Cobranças" },
    { id: "notificacoes", rotulo: "Notificações" },
    { id: "conta", rotulo: "Conta" },
    { id: "privacidade", rotulo: "Privacidade" },
    { id: "seguranca", rotulo: "Segurança" },
  ];

  return (
    <>
      <PageHeader titulo="Configurações" subtitulo="Sua conta, sua empresa e como o Zelo cobra e avisa." />

      <div className={s.configLayout}>
        <nav className={s.configNav} aria-label="Seções de configurações">
          {secoes.map((x) => (
            <a key={x.id} href={`#${x.id}`} className={s.configNavLink}>
              {x.rotulo}
            </a>
          ))}
        </nav>

        <div className={s.configConteudo}>
          {/* Recebimentos: a conta financeira (subconta) desta empresa. É a
              primeira seção porque, sem ela, nenhum link de pagamento é gerado. */}
          <section id="recebimentos" className={s.configSecao} aria-label="Recebimentos">
            <ContaFinanceira inicial={contaFinanceira} documentoEmpresa={empresa.documento} />
          </section>

          <section id="empresa" className={s.configSecao}>
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

          {/* Padrões de cobrança, lembretes e canal — valem para cobranças NOVAS */}
          <div className={s.configSecao}>
            <PreferenciasCobranca inicial={preferencias} podeEditar={dono} />
          </div>

          <section id="conta" className={s.configSecao} aria-labelledby="titulo-conta">
            <h2 id="titulo-conta" className={s.vazioTitulo} style={{ marginBottom: 16 }}>
              Conta
            </h2>
            <dl className={s.detalhesLista} style={{ marginBottom: 0 }}>
              <div>
                <dt>E-mail de acesso</dt>
                <dd>{atual?.user.email ?? "—"}</dd>
              </div>
              <div>
                <dt>Empresa</dt>
                <dd>{empresa.nome}</dd>
              </div>
              <div>
                <dt>Plano</dt>
                <dd>
                  {plano ? NOME_DO_PLANO[plano] : "—"}{" "}
                  <Link href="/app/assinatura" className={s.faixaLink}>
                    Ver assinatura
                  </Link>
                </dd>
              </div>
            </dl>
          </section>

          <section id="privacidade" className={s.configSecao} aria-labelledby="titulo-privacidade">
            <h2 id="titulo-privacidade" className={s.vazioTitulo} style={{ marginBottom: 16 }}>
              Privacidade
            </h2>
            <div className={`${s.bloco} ${s.configLinks}`}>
              <Link href="/termos" className={s.faixaLink}>Termos de Uso</Link>
              <Link href="/privacidade" className={s.faixaLink}>Política de Privacidade</Link>
              <Link href="/privacidade/solicitacao" className={s.faixaLink}>Pedido de titular de dados</Link>
            </div>
          </section>

          <section id="seguranca" className={s.configSecao} aria-labelledby="titulo-seguranca">
            <h2 id="titulo-seguranca" className={s.vazioTitulo} style={{ marginBottom: 16 }}>
              Segurança
            </h2>
            <div className={`${s.bloco} ${s.configLinks}`}>
              <span>
                Para trocar a senha, enviamos um link ao seu e-mail:{" "}
                <Link href="/recuperar-senha" className={s.faixaLink}>
                  Alterar senha
                </Link>
              </span>
            </div>
          </section>

          {/* Exclusão da conta: zona de perigo, só o dono (o servidor também exige). */}
          {dono && <ExcluirConta />}

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
        </div>
      </div>
    </>
  );
}
