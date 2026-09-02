import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { autoCheckSale, isRefundStatus, type PlatformSaleRow } from "@/lib/auto-match";
import { Upload, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/validacao-massa")({
  ssr: false,
  beforeLoad: ({ context }) => { if (!(context as any).isAdmin) throw redirect({ to: "/dashboard" }); },
  component: ValidacaoMassa,
});

const PLATFORMS = ["Kiwify", "Hotmart", "Lia", "Própria"] as const;

function normalizeHeader(h: string) {
  return h
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/\s+/g, " ");
}
function parseNumber(v: string): number {
  if (v == null) return NaN;
  const s = String(v).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isNaN(n)) return n;
  return Number(String(v).replace(/[^0-9.\-]/g, ""));
}
function parseDate(v: string): string | null {
  if (!v) return null;
  const s = v.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}
function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(row).find((rk) => normalizeHeader(rk) === k);
    if (found && row[found] != null && row[found] !== "") return row[found];
  }
  return "";
}
function matchPlatform(v: string): typeof PLATFORMS[number] | null {
  const n = normalizeHeader(v);
  if (!n) return null;
  if (n.includes("kiwify")) return "Kiwify";
  if (n.includes("hotmart")) return "Hotmart";
  if (n.includes("lia")) return "Lia";
  if (n.includes("propr") || n === "própria" || n === "propria") return "Própria";
  return null;
}

function ValidacaoMassa() {
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [defaultPlatform, setDefaultPlatform] = useState<string>("");
  const [imported, setImported] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      opts.push({ value, label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) });
    }
    return opts;
  }, []);

  async function load() {
    setLoading(true);
    const [y, m] = monthFilter.split("-").map(Number);
    const first = `${monthFilter}-01`;
    const last = `${monthFilter}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
    const [imp, sls] = await Promise.all([
      supabase.from("platform_sales").select("*").eq("month", monthFilter).order("purchase_date", { ascending: true }),
      supabase.from("sales").select("id, sale_date, buyer_email, platform, amount, refunded, products(name), seller_id")
        .gte("sale_date", first).lte("sale_date", last),
    ]);
    setImported(imp.data ?? []);
    setSales(sls.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [monthFilter]);

  async function handleFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      complete: async (res) => {
        const rows = res.data;
        const batch = crypto.randomUUID();
        const payload: any[] = [];
        const errors: string[] = [];
        rows.forEach((r, i) => {
          const dateRaw = pick(r, ["data da compra", "data", "purchase date", "data compra"]);
          const email = pick(r, ["e-mail do comprador", "email do comprador", "email", "e-mail", "buyer email"]).trim();
          const status = pick(r, ["status da compra", "status", "situacao", "situação"]);
          const platformRaw = pick(r, ["plataforma", "platform"]);
          const amountRaw = pick(r, ["valor total", "valor", "amount", "total"]);
          if (!email || !amountRaw) { errors.push(`Linha ${i + 2}: e-mail ou valor ausente`); return; }
          const platform = matchPlatform(platformRaw) ?? matchPlatform(defaultPlatform);
          if (!platform) { errors.push(`Linha ${i + 2}: plataforma inválida (${platformRaw || "vazia"})`); return; }
          const amount = parseNumber(amountRaw);
          if (isNaN(amount)) { errors.push(`Linha ${i + 2}: valor inválido (${amountRaw})`); return; }
          payload.push({
            month: monthFilter,
            purchase_date: parseDate(dateRaw),
            buyer_email: email,
            platform,
            platform_status: status || null,
            amount,
            import_batch: batch,
          });
        });
        if (payload.length === 0) {
          toast.error("Nenhuma linha válida encontrada.");
          if (errors.length) console.warn(errors);
          return;
        }
        const del = await supabase.from("platform_sales").delete().eq("month", monthFilter);
        if (del.error) { toast.error(del.error.message); return; }
        const ins = await supabase.from("platform_sales").insert(payload);
        if (ins.error) { toast.error(ins.error.message); return; }
        toast.success(`${payload.length} registros importados${errors.length ? ` (${errors.length} ignorados)` : ""}`);
        if (fileRef.current) fileRef.current.value = "";
        load();
      },
      error: (err) => toast.error(err.message),
    });
  }

  async function clearMonth() {
    if (!confirm(`Remover todos os registros importados de ${monthFilter}?`)) return;
    const { error } = await supabase.from("platform_sales").delete().eq("month", monthFilter);
    if (error) toast.error(error.message); else { toast.success("Importação removida"); load(); }
  }

  const platformRows: PlatformSaleRow[] = imported;
  const results = useMemo(() => sales.map((s) => ({ sale: s, res: autoCheckSale(s, platformRows) })), [sales, platformRows]);
  const okCount = results.filter((r) => r.res.status === "ok").length;
  const mismatchCount = results.filter((r) => r.res.status === "value_mismatch").length;
  const notFoundCount = results.filter((r) => r.res.status === "not_found").length;
  const refundedCount = results.filter((r) => r.res.status === "refunded").length;

  // platform rows that have no matching system sale
  const orphanPlatform = useMemo(() => {
    return imported.filter((p) => {
      if (isRefundStatus(p.platform_status)) return false;
      const has = sales.some((s) =>
        (s.buyer_email || "").trim().toLowerCase() === (p.buyer_email || "").trim().toLowerCase()
      );
      return !has;
    });
  }, [imported, sales]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Validação em massa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Mês de referência</Label>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plataforma padrão (se o CSV não trouxer)</Label>
              <Select value={defaultPlatform} onValueChange={setDefaultPlatform}>
                <SelectTrigger><SelectValue placeholder="Detectar do CSV" /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Arquivo CSV</Label>
              <div className="flex gap-2">
                <Input ref={fileRef} type="file" accept=".csv,text/csv"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Colunas esperadas: <strong>data da compra</strong>, <strong>e-mail do comprador</strong>, <strong>status da compra</strong>, <strong>plataforma</strong>, <strong>valor total</strong>. Ao importar, os registros anteriores desse mês são substituídos.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{imported.length} registros na plataforma</Badge>
            <Badge variant="outline">{sales.length} vendas no sistema</Badge>
            <Badge className="bg-emerald-600 text-white">{okCount} OK</Badge>
            <Badge className="bg-amber-500 text-white">{mismatchCount} valor divergente</Badge>
            <Badge variant="destructive">{notFoundCount} não encontrado</Badge>
            <Badge className="bg-purple-600 text-white">{refundedCount} estornado</Badge>
            <Badge variant="secondary">{orphanPlatform.length} só na plataforma</Badge>
            {imported.length > 0 && (
              <Button size="sm" variant="ghost" onClick={clearMonth} className="ml-auto">
                <Trash2 className="h-4 w-4 mr-1" /> Limpar mês
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Vendas do sistema × plataforma</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>E-mail</TableHead><TableHead>Plataforma</TableHead>
              <TableHead>Produto</TableHead><TableHead className="text-right">Valor</TableHead>
              <TableHead>Automático</TableHead><TableHead>Observação</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {results.map(({ sale, res }) => {
                const rowClass =
                  res.status === "ok" ? "bg-emerald-500/10"
                  : res.status === "value_mismatch" ? "bg-amber-500/15"
                  : res.status === "not_found" ? "bg-destructive/15"
                  : "bg-purple-500/15";
                return (
                <TableRow key={sale.id} className={rowClass}>
                  <TableCell>{sale.sale_date}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{sale.buyer_email}</TableCell>
                  <TableCell>{sale.platform}</TableCell>
                  <TableCell>{sale.products?.name}</TableCell>
                  <TableCell className="text-right">{brl(Number(sale.amount))}</TableCell>
                  <TableCell>
                    {res.status === "ok" ? <Badge className="bg-emerald-600 text-white">OK</Badge>
                      : res.status === "value_mismatch" ? <Badge className="bg-amber-500 text-white">Valor divergente</Badge>
                      : res.status === "refunded" ? <Badge className="bg-purple-600 text-white">Estornado</Badge>
                      : <Badge variant="destructive">Não encontrado</Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{res.reason ?? ""}</TableCell>
                </TableRow>
                );
              })}
              {!loading && results.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma venda cadastrada nesse mês.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {orphanPlatform.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Somente na plataforma (não registrados por vendedores)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>E-mail</TableHead>
                <TableHead>Plataforma</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {orphanPlatform.map((p) => (
                  <TableRow key={p.id} className="bg-amber-500/10">
                    <TableCell>{p.purchase_date ?? "—"}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{p.buyer_email}</TableCell>
                    <TableCell>{p.platform}</TableCell>
                    <TableCell>{p.platform_status ?? "—"}</TableCell>
                    <TableCell className="text-right">{brl(Number(p.amount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}