import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/_authenticated/historico")({
  ssr: false,
  component: Historico,
});

const META = 800;

function monthKey(d: string) { return d.slice(0, 7); }
function monthLabel(k: string) {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

function Historico() {
  const { user } = Route.useRouteContext();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("sales").select("*")
      .eq("seller_id", user.id)
      .order("sale_date", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, [user.id]);

  const byMonth = useMemo(() => {
    const m = new Map<string, { vendas: number; comissao: number; validadas: number; reembolsos: number }>();
    for (const r of rows) {
      const k = monthKey(r.sale_date);
      const cur = m.get(k) ?? { vendas: 0, comissao: 0, validadas: 0, reembolsos: 0 };
      cur.vendas += 1;
      cur.comissao += Number(r.commission_amount);
      if (r.validated) cur.validadas += 1;
      if (r.refunded) cur.reembolsos += 1;
      m.set(k, cur);
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ key: k, label: monthLabel(k), ...v, metaPct: Math.min(100, Math.round((v.comissao / META) * 100)) }));
  }, [rows]);

  const chartData = byMonth.slice(-12);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Comissão por mês (últimos 12)</CardTitle></CardHeader>
        <CardContent style={{ height: 280 }}>
          {chartData.length === 0 ? <div className="text-muted-foreground text-sm">Sem histórico ainda.</div> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                <XAxis dataKey="label" stroke="hsl(0 0% 60%)" fontSize={12} />
                <YAxis stroke="hsl(0 0% 60%)" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 20%)" }} formatter={(v: any) => brl(Number(v))} />
                <Bar dataKey="comissao" fill="oklch(0.75 0.18 145)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Evolução mensal</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Comissão</TableHead>
              <TableHead className="text-right">Meta ({brl(META)})</TableHead>
              <TableHead className="text-right">Validadas</TableHead>
              <TableHead className="text-right">Reembolsos</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {[...byMonth].reverse().map((m) => (
                <TableRow key={m.key}>
                  <TableCell className="font-medium capitalize">{m.label}</TableCell>
                  <TableCell className="text-right">{m.vendas}</TableCell>
                  <TableCell className="text-right">{brl(m.comissao)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={m.metaPct >= 100 ? "default" : "secondary"} className={m.metaPct >= 100 ? "bg-accent text-accent-foreground" : ""}>
                      {m.metaPct}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{m.validadas}/{m.vendas}</TableCell>
                  <TableCell className="text-right">{m.reembolsos}</TableCell>
                </TableRow>
              ))}
              {byMonth.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem histórico.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}