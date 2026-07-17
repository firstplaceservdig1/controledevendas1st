import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { brl, businessDaysInMonth, ymd } from "@/lib/format";
import { quoteOfTheDay } from "@/lib/quotes";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  component: Dashboard,
});

const META = 800;

function Dashboard() {
  const { user, isAdmin } = Route.useRouteContext();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const first = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
    const last = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    let q = supabase
      .from("sales")
      .select("*, products(name)")
      .gte("sale_date", first)
      .lte("sale_date", last);
    if (!isAdmin) q = q.eq("seller_id", user.id);
    q.then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, [user.id, isAdmin]);

  const totalVendas = rows.length;
  const comissao = rows.reduce((s, r) => s + Number(r.commission_amount), 0);
  const receita = rows.reduce((s, r) => s + Number(r.amount), 0);
  const progresso = Math.min(100, Math.round((comissao / META) * 100));

  const byType = ["Passiva", "Ativa"].map((t) => ({
    name: t, value: rows.filter((r) => r.sale_type === t).length,
  }));

  const productCount = new Map<string, number>();
  rows.forEach((r) => {
    const n = r.products?.name ?? "—";
    productCount.set(n, (productCount.get(n) ?? 0) + 1);
  });
  const topProduto = [...productCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const now = new Date();
  const bDays = businessDaysInMonth(now.getFullYear(), now.getMonth());
  const passedBDays = bDays.filter((d) => d <= now);
  const daysWithSale = new Set(rows.map((r) => r.sale_date));
  const hit = passedBDays.filter((d) => daysWithSale.has(ymd(d))).length;
  const bonusOk = hit === passedBDays.length && passedBDays.length > 0;

  return (
    <div className="space-y-6">
      <Card className="border-accent/30">
        <CardContent className="py-5">
          <div className="text-xs uppercase tracking-widest text-accent">Motivação de hoje</div>
          <div className="mt-1 text-xl md:text-2xl font-medium">{quoteOfTheDay()}</div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Total de vendas (mês)" value={String(totalVendas)} />
        <Stat title="Comissão acumulada" value={brl(comissao)} />
        <Stat title="Produto mais vendido" value={topProduto} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Meta de comissão · {brl(META)}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Progress value={progresso} />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{brl(comissao)} de {brl(META)}</span><span>{progresso}%</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Bônus por consistência
              <Badge variant={bonusOk ? "default" : "secondary"} className={bonusOk ? "bg-accent text-accent-foreground" : ""}>
                {bonusOk ? "No caminho" : "Em risco"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{hit}/{passedBDays.length}</div>
            <div className="text-sm text-muted-foreground mt-1">
              Dias úteis do mês com pelo menos 1 venda registrada.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Tipos de venda</CardTitle></CardHeader>
        <CardContent style={{ height: 280 }}>
          {loading ? (
            <div className="text-muted-foreground text-sm">Carregando…</div>
          ) : totalVendas === 0 ? (
            <div className="text-muted-foreground text-sm">Sem vendas neste mês ainda.</div>
          ) : (
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