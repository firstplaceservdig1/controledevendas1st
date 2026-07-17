// Shared bulk-validation matching helpers.

export type PlatformSaleRow = {
  id: string;
  month: string;
  buyer_email: string;
  platform: string;
  platform_status: string | null;
  amount: number | string;
  purchase_date?: string | null;
};

export type SaleRow = {
  id: string;
  buyer_email: string;
  platform: string;
  amount: number | string;
  sale_date: string;
  refunded?: boolean;
};

export type AutoStatus = "ok" | "value_mismatch" | "not_found" | "refunded";

export type AutoResult = {
  status: AutoStatus;
  reason?: string;
  match?: PlatformSaleRow;
};

const norm = (s: string) => (s ?? "").trim().toLowerCase();
const REFUND_WORDS = ["refund", "reembols", "chargeback", "cancel", "estorn"];

export function isRefundStatus(s: string | null | undefined): boolean {
  if (!s) return false;
  const v = s.toLowerCase();
  return REFUND_WORDS.some((w) => v.includes(w));
}

export function monthOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function autoCheckSale(sale: SaleRow, platformRows: PlatformSaleRow[]): AutoResult {
  const email = norm(sale.buyer_email);
  const amount = Number(sale.amount);
  const month = monthOf(sale.sale_date);

  const sameEmail = platformRows.filter(
    (p) => p.month === month && norm(p.buyer_email) === email,
  );
  if (sameEmail.length === 0) {
    return { status: "not_found", reason: "E-mail não encontrado no CSV" };
  }
  // Prefer exact value match if any
  const exact = sameEmail.find((p) => Math.abs(Number(p.amount) - amount) < 0.01);
  const chosen = exact ?? sameEmail[0];
  if (isRefundStatus(chosen.platform_status)) {
    return { status: "refunded", reason: `Estornado na plataforma (${chosen.platform_status})`, match: chosen };
  }
  if (!exact) {
    const diffs = sameEmail.map((p) => Number(p.amount).toFixed(2)).join(", ");
    return { status: "value_mismatch", reason: `Valor divergente (plataforma: ${diffs})`, match: chosen };
  }
  return { status: "ok", match: exact };
}