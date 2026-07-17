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

export type AutoStatus = "ok" | "divergent" | "missing";

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
  const platform = sale.platform;
  const amount = Number(sale.amount);
  const month = monthOf(sale.sale_date);

  const sameKey = platformRows.filter(
    (p) => p.month === month && p.platform === platform && norm(p.buyer_email) === email,
  );
  if (sameKey.length === 0) {
    return { status: "divergent", reason: "Sem correspondente na plataforma" };
  }
  const exact = sameKey.find((p) => Math.abs(Number(p.amount) - amount) < 0.01);
  if (!exact) {
    const diffs = sameKey.map((p) => Number(p.amount).toFixed(2)).join(", ");
    return { status: "divergent", reason: `Valor divergente (plataforma: ${diffs})`, match: sameKey[0] };
  }
  if (isRefundStatus(exact.platform_status) && !sale.refunded) {
    return { status: "divergent", reason: `Status na plataforma: ${exact.platform_status}`, match: exact };
  }
  if (sale.refunded && !isRefundStatus(exact.platform_status)) {
    return { status: "divergent", reason: "Marcada como reembolsada, mas plataforma aprovou", match: exact };
  }
  return { status: "ok", match: exact };
}