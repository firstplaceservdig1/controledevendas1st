import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, ymd, businessDaysInMonth } from "@/lib/format";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  ssr: false,
  beforeLoad: ({ context }) => { if (!(context as any).isAdmin) throw redirect({ to: "/dashboard" }); },
  component: AdminDashboard,
});

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function generateMonthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  for (let y = currentYear - 1; y <= currentYear + 1; y++) {
    for (let m = 0; m < 12; m++) {
      const value = `${y}-${String(m + 1).padStart(2, "0")}`;
      opts.push({ value, label: `${MONTH_LABELS[m]}/${y}` });
    }
  }
  return opts;
}

function monthBounds(value: string) {
  const [y, m] = value.split("-").map(Number);
  const first = ymd(new Date(y, m - 1, 1));
  const last = ymd(new Date(y, m, 0));
  return { first, last, y, m };
}

function AdminDashboard() {
  const [rows, setRows] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());
  const [sellerFilter, setSellerFilter] = useState<string>("all");
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const [configDays, setConfigDays] = useState<number | null>(null);

  useEffect(() => {
    const { first, last } = monthBounds(month);
    supabase.from("sales").select("*, products(name)")
      .gte("sale_date", first).lte("sale_date", last)
      .order("sale_date", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
    supabase.from("profiles").select("*")
      .then(({ data }) => setProfiles(new Map((data ?? []).map((p: any) => [p.id, p]))));
    supabase.from("month_settings").select("business_days").eq("month", month).maybeSingle()
      .then(({ data }) => setConfigDays(data ? Number(data.business_days) : null));
  }, [month]);

  const totalBDays = useMemo(() => {
    if (configDays != null) return configDays;
    const { y, m } = monthBounds(month);
    return businessDaysInMonth(y, m - 1).length;
  }, [configDays, month]);

  const filteredRows = useMemo(() => {
    if (sellerFilter === "all") return rows;
    return rows.filter((r) => r.seller_id === sellerFilter);
  }, [rows, sellerFilter]);

  const totalVendas = filteredRows.length;
  const receita = filteredRows.reduce((s, r) => s + Number(r.amount), 0);
  const liquidoAgencia = filteredRows.reduce((s, r) => {
    if (r.refunded) return s;
    const net = Number(r.amount) * (1 - Number(r.platform_fee_pct_snapshot) / 100);
    return s + net * (Number(r.agency_commission_pct_snapshot) / 100);
  }, 0);
  const comissao = filteredRows.reduce((s, r) => s + Number(r.commission_amount), 0);
  const validadas = filteredRows.filter((r) => r.validated).length;
  const reembolsadas = filteredRows.filter((r) => r.refunded).length;

  const bySeller = useMemo(() => {
    const m = new Map<string, { vendas: number; receita: number; liquido: number; comissao: number; validadas: number }>();
    for (const r of rows) {
      const cur = m.get(r.seller_id) ?? { vendas: 0, receita: 0, liquido: 0, comissao: 0, validadas: 0 };
      cur.vendas += 1;
      cur.receita += Number(r.amount);
      if (!r.refunded) {
        const net = Number(r.amount) * (1 - Number(r.platform_fee_pct_snapshot) / 100);
        cur.liquido += net * (Number(r.agency_commission_pct_snapshot) / 100);
      }
      cur.comissao += Number(r.commission_amount);
      if (r.validated) cur.validadas += 1;
      m.set(r.seller_id, cur);
    }
    return [...m.entries()].map(([id, v]) => ({
      id,
      nome: profiles.get(id)?.full_name || profiles.get(id)?.email || "—",
      ...v,
    })).sort((a, b) => b.receita - a.receita);
  }, [rows, profiles]);

  const byType = ["Passiva", "Ativa"].map((t) => ({
    name: t, value: filteredRows.filter((r) => r.sale_type === t).length,
  }));

  const productAgg = new Map<string, number>();
  filteredRows.forEach((r) => {
    const n = r.products?.name ?? "—";
    productAgg.set(n, (productAgg.get(n) ?? 0) + Number(r.amount));
  });
  const topProdutos = [...productAgg.entries()]
    .map(([name, receita]) => ({ name, receita }))
    .sort((a, b) => b.receita - a.receita).slice(0, 6);

  const sellerOptions = useMemo(() => {
    return [...profiles.entries()].map(([id, p]) => ({ id, nome: p.full_name || p.email || "—" }));
  }, [profiles]);

  const selectedMonthLabel = monthOptions.find((o) => o.value === month)?.label ?? month;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Dashboard geral</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada de {selectedMonthLabel}.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sellerFilter} onValueChange={setSellerFilter}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Filtrar por vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {sellerOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Stat title="Vendas (mês)" value={String(totalVendas)} />
        <Stat title="Receita bruta" value={brl(receita)} />
        <Stat title="Líquido agência" value={brl(liquidoAgencia)} />
        <Stat title="Comissão total" value={brl(comissao)} />
        <Stat title="Validadas" value={`${validadas}/${totalVendas}`} />
        <Stat title="Reembolsadas" value={String(reembolsadas)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Desempenho por vendedor</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Vendedor</TableHead><TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Receita</TableHead><TableHead className="text-right">Líquido agência</TableHead>
              <TableHead className="text-right">Comissão</TableHead>
              <TableHead className="text-right">Validadas</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {bySeller.map((s) => (
                <TableRow key={s.id} className={sellerFilter === s.id ? "bg-muted/50" : undefined}>
                  <TableCell className="font-medium">{s.nome}</TableCell>
                  <TableCell className="text-right">{s.vendas}</TableCell>
                  <TableCell className="text-right">{brl(s.receita)}</TableCell>
                  <TableCell className="text-right">{brl(s.liquido)}</TableCell>
                  <TableCell className="text-right">{brl(s.comissao)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={s.validadas === s.vendas ? "default" : "secondary"} className={s.validadas === s.vendas ? "bg-accent text-accent-foreground" : ""}>
                      {s.validadas}/{s.vendas}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {bySeller.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem vendas no mês.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Tipos de venda</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            {totalVendas === 0 ? <div className="text-muted-foreground text-sm">Sem dados.</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byType} dataKey="value" nameKey="name" outerRadius={100} label>
                    <Cell fill="oklch(0.75 0.18 145)" />
                    <Cell fill="oklch(0.7 0.15 200)" />
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 20%)" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Top produtos (receita)</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            {topProdutos.length === 0 ? <div className="text-muted-foreground text-sm">Sem dados.</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProdutos}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                  <XAxis dataKey="name" stroke="hsl(0 0% 60%)" fontSize={12} />
                  <YAxis stroke="hsl(0 0% 60%)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 20%)" }} formatter={(v: any) => brl(Number(v))} />
                  <Bar dataKey="receita" fill="oklch(0.75 0.18 145)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</CardTitle></CardHeader>
      <CardContent><div className="text-2xl font-semibold truncate">{value}</div></CardContent>
    </Card>
  );
}
