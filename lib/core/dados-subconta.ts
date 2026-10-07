/**
 * Validação dos dados que o Asaas exige para abrir a subconta de recebimento.
 *
 * Função pura, sem I/O: roda na tela (para avisar campo a campo) e de novo no
 * servidor (que nunca confia na tela). Regras conforme a documentação do
 * Asaas (POST /v3/accounts):
 *   - todos: nome, e-mail, CPF/CNPJ, celular, renda/faturamento, endereço;
 *   - CPF (pessoa física): data de nascimento (AAAA-MM-DD);
 *   - CNPJ (pessoa jurídica): tipo da empresa (MEI, LIMITED, INDIVIDUAL, ASSOCIATION).
 *
 * Foi a ausência da data de nascimento que fez o Asaas recusar a conexão
 * (HTTP 400 "É necessário informar a data de nascimento.").
 */

import type { CriarSubcontaDados } from "../asaas/subconta";

export type CampoSubconta =
  | "name"
  | "email"
  | "cpfCnpj"
  | "birthDate"
  | "companyType"
  | "mobilePhone"
  | "incomeValue"
  | "postalCode"
  | "address"
  | "addressNumber"
  | "province";

export type ErrosSubconta = Partial<Record<CampoSubconta, string>>;

export type TipoDeEmpresa = NonNullable<CriarSubcontaDados["companyType"]>;

export const TIPOS_DE_EMPRESA: { valor: TipoDeEmpresa; rotulo: string }[] = [
  { valor: "MEI", rotulo: "MEI (microempreendedor individual)" },
  { valor: "INDIVIDUAL", rotulo: "Empresário individual" },
  { valor: "LIMITED", rotulo: "Empresa (Ltda., S.A. e similares)" },
  { valor: "ASSOCIATION", rotulo: "Associação ou entidade sem fins lucrativos" },
];

const soDigitos = (v: string) => v.replace(/\D/g, "");

export function tipoDePessoa(documento: string): "fisica" | "juridica" | null {
  const d = soDigitos(documento);
  if (d.length === 11) return "fisica";
  if (d.length === 14) return "juridica";
  return null;
}

export function cpfValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(d.slice(0, 9), 10) === Number(d[9]) && dv(d.slice(0, 10), 11) === Number(d[10]);
}

export function cnpjValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((t, c, i) => t + Number(c) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
}

/** "AAAA-MM-DD" real (rejeita 31/02) e, se pedido, só maior de idade e não futura. */
export function dataDeNascimentoValida(iso: string, hoje: Date = new Date()): { ok: true } | { ok: false; motivo: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { ok: false, motivo: "Informe a data de nascimento." };
  const [a, m, d] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) {
    return { ok: false, motivo: "Essa data não existe. Confira o dia e o mês." };
  }
  if (a < 1900) return { ok: false, motivo: "Confira o ano de nascimento." };
  const limite = new Date(Date.UTC(hoje.getUTCFullYear() - 18, hoje.getUTCMonth(), hoje.getUTCDate()));
  if (data > hoje) return { ok: false, motivo: "A data de nascimento não pode ser futura." };
  if (data > limite) return { ok: false, motivo: "A conta de recebimento é só para maiores de 18 anos." };
  return { ok: true };
}

/** Máscaras só de exibição — o valor enviado sempre sai só com dígitos. */
export function mascararDocumento(valor: string): string {
  const d = soDigitos(valor).slice(0, 14);
  if (d.length <= 11) {
    const [a, b, c, e] = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)];
    return a + (b ? `.${b}` : "") + (c ? `.${c}` : "") + (e ? `-${e}` : "");
  }
  const [a, b, c, e, f] = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)];
  return `${a}.${b}.${c}/${e}${f ? `-${f}` : ""}`;
}

export function mascararCelular(valor: string): string {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  const corte = resto.length > 8 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}${resto.length > corte ? `-${resto.slice(corte)}` : ""}`;
}

export function mascararCep(valor: string): string {
  const d = soDigitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export type ResultadoValidacaoSubconta =
  | { ok: true; dados: CriarSubcontaDados }
  | { ok: false; erros: ErrosSubconta; primeiroCampo: CampoSubconta };

const ORDEM: CampoSubconta[] = [
  "name",
  "email",
  "cpfCnpj",
  "birthDate",
  "companyType",
  "mobilePhone",
  "incomeValue",
  "postalCode",
  "address",
  "addressNumber",
  "province",
];

/** Confere e normaliza (só dígitos em CPF/CNPJ/celular/CEP, e-mail em minúsculas). */
export function validarDadosDaSubconta(entrada: CriarSubcontaDados, hoje: Date = new Date()): ResultadoValidacaoSubconta {
  const erros: ErrosSubconta = {};

  const cpfCnpj = soDigitos(entrada.cpfCnpj);
  const pessoa = tipoDePessoa(cpfCnpj);

  const name = entrada.name.trim().replace(/\s+/g, " ");
  if (name.length < 3) erros.name = "Informe o nome completo ou a razão social.";
  else if (pessoa === "fisica" && !name.includes(" ")) erros.name = "Informe o nome completo (nome e sobrenome).";
  else if (name.length > 120) erros.name = "Nome muito longo.";

  const email = entrada.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) erros.email = "Informe um e-mail válido.";

  if (!pessoa) erros.cpfCnpj = "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).";
  else if (pessoa === "fisica" && !cpfValido(cpfCnpj)) erros.cpfCnpj = "Esse CPF não parece válido. Confira os números.";
  else if (pessoa === "juridica" && !cnpjValido(cpfCnpj)) erros.cpfCnpj = "Esse CNPJ não parece válido. Confira os números.";

  let birthDate: string | undefined;
  let companyType: TipoDeEmpresa | undefined;
  if (pessoa === "fisica") {
    const r = dataDeNascimentoValida((entrada.birthDate ?? "").trim(), hoje);
    if (!r.ok) erros.birthDate = r.motivo;
    else birthDate = (entrada.birthDate ?? "").trim();
  } else if (pessoa === "juridica") {
    if (!TIPOS_DE_EMPRESA.some((t) => t.valor === entrada.companyType)) erros.companyType = "Escolha o tipo da empresa.";
    else companyType = entrada.companyType;
  }

  const mobilePhone = soDigitos(entrada.mobilePhone);
  if (mobilePhone.length < 10 || mobilePhone.length > 11) erros.mobilePhone = "Informe o celular com DDD. Ex.: (11) 91234-5678.";

  if (!Number.isFinite(entrada.incomeValue) || entrada.incomeValue <= 0) {
    erros.incomeValue = "Informe sua renda ou faturamento mensal aproximado.";
  } else if (entrada.incomeValue > 1_000_000_000) {
    erros.incomeValue = "Valor muito alto. Confira.";
  }

  const postalCode = soDigitos(entrada.postalCode);
  if (postalCode.length !== 8) erros.postalCode = "O CEP tem 8 números.";

  const address = entrada.address.trim().replace(/\s+/g, " ");
  if (address.length < 3) erros.address = "Informe a rua ou avenida.";

  const addressNumber = entrada.addressNumber.trim();
  if (!addressNumber) erros.addressNumber = "Informe o número (ou S/N).";

  const province = entrada.province.trim().replace(/\s+/g, " ");
  if (province.length < 2) erros.province = "Informe o bairro.";

  const primeiroCampo = ORDEM.find((c) => erros[c]);
  if (primeiroCampo) return { ok: false, erros, primeiroCampo };

  return {
    ok: true,
    dados: {
      name,
      email,
      cpfCnpj,
      mobilePhone,
      incomeValue: Math.round(entrada.incomeValue * 100) / 100,
      address,
      addressNumber,
      province,
      postalCode,
      ...(entrada.complement?.trim() ? { complement: entrada.complement.trim() } : {}),
      ...(birthDate ? { birthDate } : {}),
      ...(companyType ? { companyType } : {}),
    },
  };
}
