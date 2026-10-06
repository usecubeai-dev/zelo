/**
 * Plano de TESTE (R$ 5) — só administrador.
 *
 * Valida: fora das listas públicas, recusado sem permissão, aceito no banco
 * (constraints + limite) e preço de R$ 5,00 (mínimo do Asaas). Não chama o Asaas.
 */
import fs from "fs";
import { iniciarAssinaturaZelo } from "../lib/core/assinatura-zelo";
import { ehPlano, ehPlanoOuTeste, normalizarPlano, PLANOS_EM_ORDEM, PRECO_POR_PLANO_CENTAVOS, limiteDoPlano, planoPago } from "../lib/plano";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.trim().match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const URL_ = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) as string;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };

let total = 0;
let ok = 0;
const assert = (c: boolean, t: string) => {
  total++;
  if (c) ok++;
  console.log(`  ${c ? "✓" : "✗ FALHA:"} ${t}`);
};

async function main() {
  console.log("Plano de teste (R$ 5) — só administrador\n");

  assert(!PLANOS_EM_ORDEM.includes("teste" as never), "fora da lista pública de planos");
  assert(!ehPlano("teste"), "ehPlano recusa 'teste' (cadastro/URL públicos)");
  assert(ehPlanoOuTeste("teste") && ehPlanoOuTeste("essencial"), "ehPlanoOuTeste aceita teste e os públicos");
  assert(normalizarPlano("teste") === "teste", "normalizarPlano reconhece o plano gravado");
  assert(PRECO_POR_PLANO_CENTAVOS.teste === 500 && planoPago("teste"), "preço R$ 5,00 e plano pago");
  assert(limiteDoPlano("teste") === 10, "limite de clientes 10");

  const email = `teste_plano_teste_${Date.now()}@zelo.test`;
  const user = await (await fetch(`${URL_}/auth/v1/admin/users`, {
    method: "POST", headers: H,
    body: JSON.stringify({ email, password: "senha_teste_12345", email_confirm: true, user_metadata: { nome: "Empresa Plano Teste" } }),
  })).json();
  const userId = user.id || user.user?.id;
  const membros = await (await fetch(`${URL_}/rest/v1/membros?user_id=eq.${userId}`, { headers: H })).json();
  const empresaId = membros[0]?.empresa_id;

  try {
    const base = { empresaId, userId, papel: "dono", email, plano: "teste", documento: "52998224725" };

    const semPermissao = await iniciarAssinaturaZelo(base);
    assert(!semPermissao.ok && semPermissao.codigo === "plano_invalido", "sem permissão de administrador: plano de teste recusado");

    const naoDono = await iniciarAssinaturaZelo({ ...base, papel: "membro", permitirPlanoDeTeste: true });
    assert(!naoDono.ok && naoDono.codigo === "sem_permissao", "mesmo administrador: só o dono da conta assina");

    const lixo = await iniciarAssinaturaZelo({ ...base, plano: "teste2", permitirPlanoDeTeste: true });
    assert(!lixo.ok && lixo.codigo === "plano_invalido", "plano inexistente continua recusado");

    const r = await fetch(`${URL_}/rest/v1/empresas?id=eq.${empresaId}`, {
      method: "PATCH", headers: H, body: JSON.stringify({ plano: "teste", plano_escolhido: "teste" }),
    });
    assert(r.ok, "banco aceita plano 'teste' (empresas.plano e plano_escolhido)");

    const lim = await (await fetch(`${URL_}/rest/v1/rpc/limite_de_clientes`, {
      method: "POST", headers: H, body: JSON.stringify({ p_plano: "teste" }),
    })).json();
    assert(lim === 10, "banco: limite_de_clientes('teste') = 10");

    const ruim = await fetch(`${URL_}/rest/v1/empresas?id=eq.${empresaId}`, {
      method: "PATCH", headers: H, body: JSON.stringify({ plano: "teste_invalido" }),
    });
    assert(!ruim.ok, "banco continua recusando plano desconhecido");
  } finally {
    if (userId) await fetch(`${URL_}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: H });
  }

  console.log(`\n=== ${ok}/${total} passaram ===`);
  if (ok !== total) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
