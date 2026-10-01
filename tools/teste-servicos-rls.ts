/**
 * Verificação de isolamento multi-tenant em `servicos`.
 *
 * Escrito na execução autônoma pós-redesign, depois de encontrar que a
 * tabela `servicos` NÃO aparece em nenhum arquivo de `supabase/schema/`
 * (o snapshot é de 02/09/2026; `lib/servico.ts`, `servico_id` em
 * `cobrancas`/`recorrencias` e os testes de Fase 4/19 já a usam, o que
 * só é possível se ela existir na produção — ou seja, foi criada DEPOIS
 * do snapshot e nunca foi re-sincronizada nos arquivos versionados).
 *
 * Sem acesso a `pg_catalog`/Supabase MCP nesta sessão para confirmar
 * `relrowsecurity`/`pg_policies` diretamente, este teste responde a
 * mesma pergunta pelo único canal disponível: bater na API REST pública
 * como dois tenants diferentes e um anônimo, exatamente como
 * `tools/teste-fase4.ts` já faz para `recorrencias`. Mesmo padrão,
 * mesma limpeza no fim.
 */

import fs from "fs";

const dotenv = fs.readFileSync(".env.local", "utf8");
dotenv.split("\n").forEach((l) => {
  const c = l.trim();
  if (c.startsWith("#") || !c.includes("=")) return;
  const i = c.indexOf("=");
  process.env[c.slice(0, i).trim()] = c.slice(i + 1).trim();
});

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "") as string;
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "") as string;
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "") as string;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error("ERRO: variáveis do Supabase ausentes em .env.local");
  process.exit(1);
}

let passou = 0,
  falhou = 0;
const t = (n: string, c: boolean, d = "") => {
  if (c) {
    passou++;
    console.log(`  ✓ ${n}`);
  } else {
    falhou++;
    console.log(`  ✗ FALHA: ${n} ${d}`);
  }
};

async function run() {
  console.log("\n=== ISOLAMENTO MULTI-TENANT — TABELA `servicos` ===\n");

  console.log("ANÔNIMO — sem policy, sem sessão, deve ver e escrever nada");
  {
    const leitura = await fetch(`${SUPABASE_URL}/rest/v1/servicos`, { headers: { apikey: ANON_KEY } });
    const dados = await leitura.json();
    t(
      "anônimo lê servicos -> vazio (RLS ativo) ou tabela recusa leitura",
      leitura.status === 200 ? Array.isArray(dados) && dados.length === 0 : leitura.status >= 400,
      `status=${leitura.status} corpo=${JSON.stringify(dados).slice(0, 200)}`
    );

    const escrita = await fetch(`${SUPABASE_URL}/rest/v1/servicos`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ nome: "Ataque anônimo", tipo: "avulso", valor_centavos: 1000 }),
    });
    t("anônimo insere em servicos -> bloqueado", escrita.status === 401 || escrita.status === 403 || escrita.status === 400, `status=${escrita.status}`);
  }

  const adminHeaders: Record<string, string> = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  const emailA = `teste_servicos_rls_a_${Date.now()}@zelo.test`;
  const emailB = `teste_servicos_rls_b_${Date.now()}@zelo.test`;
  const senha = "senha_teste_12345";

  const userResA = await (
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ email: emailA, password: senha, email_confirm: true, user_metadata: { nome: "Empresa A servicos" } }),
    })
  ).json();
  const userResB = await (
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ email: emailB, password: senha, email_confirm: true, user_metadata: { nome: "Empresa B servicos" } }),
    })
  ).json();
  const userIdA = userResA.id || userResA.user?.id;
  const userIdB = userResB.id || userResB.user?.id;

  const loginA = await (
    await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailA, password: senha }),
    })
  ).json();
  const loginB = await (
    await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailB, password: senha }),
    })
  ).json();
  const tokenA = loginA.access_token;
  const tokenB = loginB.access_token;

  const membrosA = await (await fetch(`${SUPABASE_URL}/rest/v1/membros?user_id=eq.${userIdA}`, { headers: adminHeaders })).json();
  const membrosB = await (await fetch(`${SUPABASE_URL}/rest/v1/membros?user_id=eq.${userIdB}`, { headers: adminHeaders })).json();
  const empresaIdA = membrosA[0]?.empresa_id;
  const empresaIdB = membrosB[0]?.empresa_id;
  t("empresas A e B criadas com membros vinculados", Boolean(empresaIdA && empresaIdB));

  const headersA: Record<string, string> = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${tokenA}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  const headersB: Record<string, string> = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${tokenB}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  console.log("\nMEMBRO AUTENTICADO — cria e lê seu próprio serviço");
  let servicoA: { id: string } | undefined;
  {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/servicos`, {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({ empresa_id: empresaIdA, nome: "Serviço de A", tipo: "mensalidade", valor_centavos: 9900 }),
    });
    const corpo = await resp.json();
    servicoA = Array.isArray(corpo) ? corpo[0] : corpo;
    t("A insere serviço na própria empresa -> permitido", resp.status < 300 && Boolean(servicoA?.id), `status=${resp.status} corpo=${JSON.stringify(corpo).slice(0, 300)}`);
  }

  if (servicoA?.id) {
    console.log("\nCROSS-TENANT — A tenta gravar em nome de B / B tenta ler ou alterar o serviço de A");

    const tentativaCross = await fetch(`${SUPABASE_URL}/rest/v1/servicos`, {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({ empresa_id: empresaIdB, nome: "Ataque empresa cruzada", tipo: "avulso", valor_centavos: 1000 }),
    });
    t("A tenta inserir serviço com empresa_id de B -> bloqueado", tentativaCross.status >= 400, `status=${tentativaCross.status}`);

    const leituraB = await (await fetch(`${SUPABASE_URL}/rest/v1/servicos?id=eq.${servicoA.id}`, { headers: headersB })).json();
    t("B tenta ler serviço de A -> 0 linhas", Array.isArray(leituraB) && leituraB.length === 0, `corpo=${JSON.stringify(leituraB).slice(0, 300)}`);

    await fetch(`${SUPABASE_URL}/rest/v1/servicos?id=eq.${servicoA.id}`, {
      method: "PATCH",
      headers: headersB,
      body: JSON.stringify({ nome: "Hackeado por B" }),
    });
    const servicoAposAtaque = (await (await fetch(`${SUPABASE_URL}/rest/v1/servicos?id=eq.${servicoA.id}`, { headers: adminHeaders })).json())[0];
    t("B tenta alterar serviço de A -> bloqueado (nome não muda)", servicoAposAtaque?.nome === "Serviço de A", `nome atual="${servicoAposAtaque?.nome}"`);

    console.log("\nO PRÓPRIO DONO — A ainda consegue editar/arquivar o que é seu");
    const editaA = await fetch(`${SUPABASE_URL}/rest/v1/servicos?id=eq.${servicoA.id}`, {
      method: "PATCH",
      headers: headersA,
      body: JSON.stringify({ status: "arquivado" }),
    });
    const servicoEditado = (await (await fetch(`${SUPABASE_URL}/rest/v1/servicos?id=eq.${servicoA.id}`, { headers: headersA })).json())[0];
    t("A arquiva o próprio serviço -> permitido", editaA.status < 300 && servicoEditado?.status === "arquivado", `status=${editaA.status}`);
  } else {
    console.log("  (pulado — sem servicoA.id não dá pra testar cross-tenant)");
  }

  console.log("\nLIMPEZA");
  if (servicoA?.id) await fetch(`${SUPABASE_URL}/rest/v1/servicos?id=eq.${servicoA.id}`, { method: "DELETE", headers: adminHeaders });
  if (userIdA) await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userIdA}`, { method: "DELETE", headers: adminHeaders });
  if (userIdB) await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userIdB}`, { method: "DELETE", headers: adminHeaders });
  console.log("  ✓ dados de teste removidos");

  console.log(`\n=== ${passou} passaram, ${falhou} falharam ===\n`);
  process.exit(falhou > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("\nERRO FATAL:", e.message);
  process.exit(1);
});
