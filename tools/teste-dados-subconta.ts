/**
 * Dados da subconta de recebimento — regras puras (sem banco, sem Asaas).
 *
 * Nasceu de um bug real em produção: o Asaas recusou a conexão com HTTP 400
 * "É necessário informar a data de nascimento." porque a tela nunca pedia o
 * campo. Aqui fica travado o que o Asaas exige para CPF e para CNPJ.
 */

import fs from "fs";
import path from "path";
import {
  TIPOS_DE_EMPRESA,
  cnpjValido,
  cpfValido,
  dataDeNascimentoValida,
  explicarRecusaDoParceiro,
  redigirParaLog,
  mascararCelular,
  mascararCep,
  mascararDocumento,
  tipoDePessoa,
  validarDadosDaSubconta,
} from "../lib/core/dados-subconta";
import type { CriarSubcontaDados } from "../lib/asaas/subconta";

let passou = 0,
  falhou = 0;
const t = (n: string, c: boolean, d = "") => {
  if (c) {
    passou++;
    console.log(`  ✓ ${n}`);
  } else {
    falhou++;
    console.log(`  ✗ ${n}${d ? ` — ${d}` : ""}`);
  }
};

const HOJE = new Date(Date.UTC(2026, 9, 7));
// documentos de teste públicos e válidos pelo dígito verificador
const CPF = "529.982.247-25";
const CNPJ = "11.222.333/0001-81";

const base: CriarSubcontaDados = {
  name: "Maria da Silva",
  email: "Maria@Exemplo.com ",
  cpfCnpj: CPF,
  mobilePhone: "(11) 91234-5678",
  incomeValue: 5000,
  address: "Rua das Flores",
  addressNumber: "120",
  province: "Centro",
  postalCode: "01310-100",
  birthDate: "1990-05-20",
};

console.log("\n=== DADOS DA SUBCONTA ===\n");

console.log("DOCUMENTOS");
t("CPF válido aceito", cpfValido(CPF));
t("CPF com dígito errado recusado", !cpfValido("529.982.247-24"));
t("CPF repetido (111.111.111-11) recusado", !cpfValido("111.111.111-11"));
t("CNPJ válido aceito", cnpjValido(CNPJ));
t("CNPJ com dígito errado recusado", !cnpjValido("11.222.333/0001-80"));
t("tipo de pessoa pelo tamanho", tipoDePessoa(CPF) === "fisica" && tipoDePessoa(CNPJ) === "juridica" && tipoDePessoa("123") === null);

console.log("\nDATA DE NASCIMENTO");
t("data comum aceita", dataDeNascimentoValida("1990-05-20", HOJE).ok);
t("vazia recusada", !dataDeNascimentoValida("", HOJE).ok);
t("31/02 não existe", !dataDeNascimentoValida("1990-02-31", HOJE).ok);
t("futura recusada", !dataDeNascimentoValida("2030-01-01", HOJE).ok);
t("menor de 18 recusado", !dataDeNascimentoValida("2012-01-01", HOJE).ok);
t("faz 18 hoje: aceito", dataDeNascimentoValida("2008-10-07", HOJE).ok);
t("faz 18 amanhã: recusado", !dataDeNascimentoValida("2008-10-08", HOJE).ok);
t("ano antigo demais recusado", !dataDeNascimentoValida("1850-01-01", HOJE).ok);

console.log("\nMÁSCARAS");
t("CPF mascarado", mascararDocumento("52998224725") === CPF);
t("CNPJ mascarado", mascararDocumento("11222333000181") === CNPJ);
t("CPF parcial mascarado", mascararDocumento("529982") === "529.982");
t("celular com 9 dígitos", mascararCelular("11912345678") === "(11) 91234-5678");
t("celular fixo de 10 dígitos", mascararCelular("1132345678") === "(11) 3234-5678");
t("CEP mascarado", mascararCep("01310100") === "01310-100");
t("máscara ignora letras", mascararDocumento("abc529x982") === "529.982");

console.log("\nPESSOA FÍSICA (CPF) — exige data de nascimento");
const pf = validarDadosDaSubconta(base, HOJE);
t("dados completos passam", pf.ok);
if (pf.ok) {
  t("CPF sai só com dígitos", pf.dados.cpfCnpj === "52998224725");
  t("celular sai só com dígitos", pf.dados.mobilePhone === "11912345678");
  t("CEP sai só com dígitos", pf.dados.postalCode === "01310100");
  t("e-mail sai aparado e em minúsculas", pf.dados.email === "maria@exemplo.com");
  t("data de nascimento segue no envio", pf.dados.birthDate === "1990-05-20");
  t("sem tipo de empresa para CPF", pf.dados.companyType === undefined);
}
const semNasc = validarDadosDaSubconta({ ...base, birthDate: "" }, HOJE);
t("SEM data de nascimento é recusado (o bug de produção)", !semNasc.ok && !!semNasc.erros.birthDate);
t("o primeiro campo com erro é a data de nascimento", !semNasc.ok && semNasc.primeiroCampo === "birthDate");
const soNome = validarDadosDaSubconta({ ...base, name: "Maria" }, HOJE);
t("pessoa física precisa de nome e sobrenome", !soNome.ok && !!soNome.erros.name);

console.log("\nPESSOA JURÍDICA (CNPJ) — exige tipo da empresa");
const pj = validarDadosDaSubconta({ ...base, name: "Zelo", cpfCnpj: CNPJ, birthDate: "", companyType: "MEI" }, HOJE);
t("empresa completa passa (razão social de uma palavra)", pj.ok);
if (pj.ok) {
  t("tipo da empresa segue no envio", pj.dados.companyType === "MEI");
  t("sem data de nascimento para CNPJ", pj.dados.birthDate === undefined);
}
const semTipo = validarDadosDaSubconta({ ...base, name: "Zelo", cpfCnpj: CNPJ, birthDate: "" }, HOJE);
t("SEM tipo da empresa é recusado", !semTipo.ok && !!semTipo.erros.companyType);
const tipoInvalido = validarDadosDaSubconta({ ...base, cpfCnpj: CNPJ, companyType: "XYZ" as never }, HOJE);
t("tipo da empresa inventado é recusado", !tipoInvalido.ok && !!tipoInvalido.erros.companyType);
t("os 4 tipos aceitos pelo Asaas estão na lista", ["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"].every((v) => TIPOS_DE_EMPRESA.some((x) => x.valor === v)));

console.log("\nOUTROS CAMPOS");
const vazio = validarDadosDaSubconta(
  { name: "", email: "", cpfCnpj: "", mobilePhone: "", incomeValue: 0, address: "", addressNumber: "", province: "", postalCode: "" },
  HOJE
);
t("formulário vazio acusa todos os campos básicos", !vazio.ok && ["name", "email", "cpfCnpj", "mobilePhone", "incomeValue", "postalCode", "address", "addressNumber", "province"].every((c) => vazio.erros[c as keyof typeof vazio.erros]));
t("e-mail inválido recusado", !validarDadosDaSubconta({ ...base, email: "maria@" }, HOJE).ok);
t("celular curto recusado", !validarDadosDaSubconta({ ...base, mobilePhone: "(11) 1234" }, HOJE).ok);
t("CEP curto recusado", !validarDadosDaSubconta({ ...base, postalCode: "0131" }, HOJE).ok);
t("renda zero recusada", !validarDadosDaSubconta({ ...base, incomeValue: 0 }, HOJE).ok);
t("renda absurda recusada", !validarDadosDaSubconta({ ...base, incomeValue: 5e12 }, HOJE).ok);

console.log("\nMENSAGENS DE RECUSA E LOG SEGURO");
t("log tira e-mail", !/@/.test(redigirParaLog("O email maria@exemplo.com já está em uso.")));
t("log tira CPF, telefone e CEP", !/\d{5,}/.test(redigirParaLog("CPF 529.982.247-25, fone 11912345678, CEP 01310-100")));
t("log mantém o texto útil", /já está em uso/.test(redigirParaLog("O email maria@exemplo.com já está em uso.")));
t("e-mail já usado vira orientação clara, sem repetir o e-mail", (() => {
  const m = explicarRecusaDoParceiro(400, "O email maria@exemplo.com já está em uso.");
  return /outro e-mail/i.test(m) && !m.includes("@");
})());
t("400 de validação mostra o motivo", /não aceitou os dados: É necessário informar a data de nascimento/.test(explicarRecusaDoParceiro(400, "É necessário informar a data de nascimento.")));
t("400 não repete dado pessoal na tela", !/\d{5,}/.test(explicarRecusaDoParceiro(400, "CPF 52998224725 inválido")));
t("503 diz que o Zelo não está pronto e que nada foi criado", /não está pronto/.test(explicarRecusaDoParceiro(503, "x")) && /Nada foi criado/.test(explicarRecusaDoParceiro(503, "x")));
t("outros erros ficam genéricos", explicarRecusaDoParceiro(500, "boom") === explicarRecusaDoParceiro(504, undefined));

console.log("\nESTRUTURA");
const raiz = path.resolve(__dirname, "..");
const acao = fs.readFileSync(path.join(raiz, "app/(app)/app/configuracoes/acoes.ts"), "utf8");
t("a Server Action valida no servidor antes de chamar o onboarding", /validarDadosDaSubconta\(dados\)/.test(acao) && acao.indexOf("validarDadosDaSubconta(dados)") < acao.indexOf("iniciarOnboardingFinanceiro("));
t("a Server Action envia os dados normalizados (não os brutos)", /conferido\.dados/.test(acao));
const onboarding = fs.readFileSync(path.join(raiz, "lib/core/onboarding.ts"), "utf8");
t("a recusa do parceiro vira mensagem clara para a pessoa", /explicarRecusaDoParceiro\(resultado\.status, resultado\.erro\)/.test(onboarding));
t("a recusa é registrada no log do servidor, com redação de dados pessoais", /console\.error\(\s*"\[onboarding\] subconta recusada/.test(onboarding) && /redigirParaLog\(resultado\.erro/.test(onboarding));
const subconta = fs.readFileSync(path.join(raiz, "lib/asaas/subconta.ts"), "utf8");
t(
  "a chave de cifra é conferida ANTES de criar a subconta no Asaas (sem subconta órfã)",
  subconta.indexOf("cifraConfigurada()") > -1 && subconta.indexOf("cifraConfigurada()") < subconta.indexOf('asaasRequisicao<AsaasSubconta>("/accounts"')
);
t("sem chave de cifra a criação é recusada com 503 e o motivo vai para o log", /NÃO criada/.test(subconta) && /status: 503/.test(subconta));
const credenciais = fs.readFileSync(path.join(raiz, "lib/asaas/credenciais.ts"), "utf8");
t("a ausência da chave de cifra deixa rastro no log (antes era silenciosa)", /ASAAS_CREDENTIALS_KEY ausente ou inválida/.test(credenciais));
const modulo = fs.readFileSync(path.join(raiz, "lib/core/dados-subconta.ts"), "utf8");
t("o módulo de validação é puro (sem rede, banco ou segredo)", !/fetch\(|supabase|process\.env/.test(modulo));

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou ? 1 : 0);
