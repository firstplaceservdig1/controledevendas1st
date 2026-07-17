import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { brl, ymd } from "@/lib/format";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  ssr: false,
  beforeLoad: ({ context }) => { if (!(context as any).isAdmin) throw redirect({ to: "/dashboard" }); },
  component: AdminDashboard,
});

function AdminDashboard() {
  const [rows, setRows] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    const now = new Date();
    const first = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
    const last = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    supabase.from("sales").select("*, products(name)")
      .gte("sale_date", first).lte("sale_date", last)
      .order("sale_date", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
    supabase.from("profiles").select("*")
      .then(({ data }) => setProfiles(new Map((data ?? []).map((p: any) => [p.id, p]))));
  }, []);

  const totalVendas = rows.length;
  const receita = rows.reduce((s, r) => s + Number(r.amount), 0);
  const comissao = rows.reduce((s, r) => s + Number(r.commission_amount), 0);
  const validadas = rows.filter((r) => r.validated).length;
  const reembolsadas = rows.filter((r) => r.refunded).length;

  const bySeller = useMemo(() => {
    const m = new Map<string, { vendas: number; receita: number; comissao: number; validadas: number }>();
    for (const r of rows) {
      const cur = m.get(r.seller_id) ?? { vendas: 0, receita: 0, comissao: 0, validadas: 0 };
      cur.vendas += 1;
      cur.receita += Number(r.amount);
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
    name: t, value: rows.filter((r) => r.sale_type === t).length,
  }));

  const productAgg = new Map<string, number>();
  rows.forEach((r) => {
    const n = r.products?.name ?? "—";
    productAgg.set(n, (productAgg.get(n) ?? 0) + Number(r.amount));
  });
  const topProdutos = [...productAgg.entries()]
    .map(([name, receita]) => ({ name, receita }))
    .sort((a, b) => b.receita - a.receita).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        <Stat title="Vendas (mês)" value={String(totalVendas)} />
        <Stat title="Receita bruta" value={brl(receita)} />
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
              <TableHead className="text-right">Receita</TableHead><TableHead className="text-right">Comissão</TableHead>
              <TableHead className="text-right">Validadas</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {bySeller.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.nome}</TableCell>
                  <TableCell className="text-right">{s.vendas}</TableCell>
                  <TableCell className="text-right">{brl(s.receita)}</TableCell>
                  <TableCell className="text-right">{brl(s.comissao)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={s.validadas === s.vendas ? "default" : "secondary"} className={s.validadas === s.vendas ? "bg-accent text-accent-foreground" : ""}>
                      {s.validadas}/{s.vendas}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {bySeller.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem vendas no mês.</TableCell></TableRow>}
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