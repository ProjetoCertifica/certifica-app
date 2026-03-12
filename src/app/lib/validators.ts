/* ── CNPJ ── */
export function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calc = (base: string, weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += parseInt(base[i]) * weights[i];
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calc(digits, w1);
  if (parseInt(digits[12]) !== d1) return false;

  const d2 = calc(digits, w2);
  return parseInt(digits[13]) === d2;
}

export function formatCNPJ(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/* ── Email ── */
export function validateEmail(email: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/* ── Telefone ── */
export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length > 0 ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function validatePhone(phone: string): boolean {
  const d = phone.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 11;
}

/* ── BrasilAPI ── */
export interface BrasilAPIResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  porte: string;
  municipio: string;
  uf: string;
  logradouro: string;
  numero: string;
  bairro: string;
  descricao_situacao_cadastral: string;
}

export async function consultarCNPJ(cnpj: string): Promise<BrasilAPIResponse | null> {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return null;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      cnpj: data.cnpj ?? "",
      razao_social: data.razao_social ?? "",
      nome_fantasia: data.nome_fantasia ?? "",
      porte: mapPorte(data.porte ?? ""),
      municipio: data.municipio ?? "",
      uf: data.uf ?? "",
      logradouro: data.logradouro ?? "",
      numero: data.numero ?? "",
      bairro: data.bairro ?? "",
      descricao_situacao_cadastral: data.descricao_situacao_cadastral ?? "",
    };
  } catch {
    return null;
  }
}

function mapPorte(porte: string): string {
  const p = porte.toUpperCase();
  if (p.includes("MEI")) return "MEI";
  if (p.includes("MICRO") || p.includes("ME")) return "ME";
  if (p.includes("PEQUEN") || p.includes("EPP")) return "EPP";
  if (p.includes("MEDIO") || p.includes("MÉDIO")) return "Medio";
  if (p.includes("GRANDE") || p.includes("DEMAIS")) return "Grande";
  return "EPP";
}
