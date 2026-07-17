import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { validateSale } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { autoCheckSale, type PlatformSaleRow } from "@/lib/auto-match";

export const Route = createFileRoute("/_authenticated/admin/validacao")({
  ssr: false,
  beforeLoad: ({ context }) => { if (!(context as any).isAdmin) throw redirect({ to: "/dashboard" }); },
  component: Validacao,
});

function Validacao() {
  const validateFn = useServerFn(validateSale);
  const [rows, setRows] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());
  const [profileList, setProfileList] = useState<any[]>([]);
  const [platformRows, setPlatformRows] = useState<PlatformSaleRow[]>([]);
  const [filter, setFilter] = useState<"pending" | "validated" | "all">("pending");
  const [sellerFilter, setSellerFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [edits, setEdits] = useState<Record<string, { amount?: string; commission_amount?: string }>>({});

  async function load() {
    let q = supabase.from("sales").select("*, products(name)").order("sale_date", { ascending: false });
    if (filter === "pending") q = q.eq("validated", false);
    if (filter === "validated") q = q.eq("validated", true);
    if (sellerFilter !== "all") q = q.eq("seller_id", sellerFilter);
    if (monthFilter !== "all") {
      const [y, m] = monthFilter.split("-").map(Number);
      const first = `${monthFilter}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const last = `${monthFilter}-${String(lastDay).padStart(2, "0")}`;
      q = q.gte("sale_date", first).lte("sale_date", last);
    }
    const { data } = await q;
    setRows(data ?? []);
    setEdits({});
    const { data: p } = await supabase.from("profiles").select("*");
    const list = p ?? [];
    setProfiles(new Map(list.map((x: any) => [x.id, x])));
    setProfileList(list);
    if (monthFilter !== "all") {
      const { data: ps } = await supabase.from("platform_sales").select("*").eq("month", monthFilter);
      setPlatformRows((ps ?? []) as any);
    } else {
      setPlatformRows([]);
    }
  }
  useEffect(() => { load(); }, [filter, sellerFilter, monthFilter]);

  async function toggle(id: string, validated: boolean) {
    try {
      await validateFn({ data: { sale_id: id, validated } });
      toast.success(validated ? "Venda validada" : "Validação removida");
      load();
    } catch (e: any) { toast.error(e.message ?? "Erro"); }
  }

  async function saveRow(r: any) {
    const e = edits[r.id] ?? {};
    const patch: any = {};
    if (e.amount !== undefined && Number(e.amount) !== Number(r.amount)) patch.amount = Number(e.amount);
    if (e.commission_amount !== undefined && Number(e.commission_amount) !== Number(r.commission_amount)) {
      patch.commission_amount = Number(e.commission_amount);
    }
    if (Object.keys(patch).length === 0) return;
    const { error } = await supabase.from("sales").update(patch).eq("id", r.id);
    if (error) toast.error(error.message); else { toast.success("Atualizada"); load(); }
  }

  async function toggleRefund(r: any) {
    const next = !r.refunded;
    const { error } = await supabase.from("sales").update({ refunded: next }).eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success(next ? "Marcada como reembolsada" : "Reembolso removido"); load(); }
  }

  const totals = useMemo(() => ({
    receita: rows.reduce((s, r) => s + Number(r.amount), 0),
    comissao: rows.reduce((s, r) => s + Number(r.commission_amount), 0),
  }), [rows]);

  const autoByRow = useMemo(() => {
    const map = new Map<string, ReturnType<typeof autoCheckSale>>();
    if (platformRows.length === 0) return map;
    for (const r of rows) map.set(r.id, autoCheckSale(r, platformRows));
    return map;
  }, [rows, platformRows]);

  const sellerName = sellerFilter === "all" ? "Todos os vendedores" : (profiles.get(sellerFilter)?.full_name || profiles.get(sellerFilter)?.email || "—");

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

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Fechamento</CardTitle>
          <div className="text-sm text-muted-foreground mt-1">
            {sellerName} · {rows.length} venda(s) · Receita {brl(totals.receita)} · Comissão {brl(totals.comissao)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sellerFilter} onValueChange={setSellerFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Vendedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {profileList.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="validated">Validadas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>Vendedor</TableHead><TableHead>Produto</TableHead>
            <TableHead className="w-32">Valor</TableHead><TableHead className="w-32">Comissão</TableHead><TableHead>Plataforma</TableHead>
            <TableHead>Tipo</TableHead><TableHead>Automático</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ação</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(r => {
              const e = edits[r.id] ?? {};
              const amountVal = e.amount ?? String(r.amount);
              const commVal = e.commission_amount ?? String(r.commission_amount);
              const dirty = Number(amountVal) !== Number(r.amount) || Number(commVal) !== Number(r.commission_amount);
              const auto = autoByRow.get(r.id);
              const isDivergent = auto?.status === "divergent";
              return (
                <TableRow key={r.id} className={`${r.refunded ? "opacity-60" : ""} ${isDivergent ? "bg-destructive/10" : ""}`}>
                  <TableCell>{r.sale_date}</TableCell>
                  <TableCell>{profiles.get(r.seller_id)?.full_name || profiles.get(r.seller_id)?.email || "—"}</TableCell>
                  <TableCell>{r.products?.name}</TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" value={amountVal} className="h-8 w-28"
                      onChange={(ev) => setEdits({ ...edits, [r.id]: { ...e, amount: ev.target.value } })} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" value={commVal} className="h-8 w-28"
                      disabled={r.refunded}
                      onChange={(ev) => setEdits({ ...edits, [r.id]: { ...e, commission_amount: ev.target.value } })} />
                  </TableCell>
                  <TableCell>{r.platform}</TableCell>
                  <TableCell>{r.sale_type}</TableCell>
                  <TableCell>
                    {!auto ? <span className="text-xs text-muted-foreground">—</span>
                      : auto.status === "ok"
                        ? <Badge className="bg-emerald-600 text-white">OK</Badge>
                        : <Badge variant="destructive" title={auto.reason}>Divergência</Badge>}
                    {auto?.reason && auto.status === "divergent" && (
                      <div className="text-[10px] text-muted-foreground mt-1 max-w-[160px]">{auto.reason}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.refunded
                      ? <Badge variant="destructive">Reembolsada</Badge>
                      : r.validated
                        ? <Badge className="bg-accent text-accent-foreground">Validado</Badge>
                        : <Badge variant="secondary">Pendente</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {dirty && <Button size="sm" variant="outline" onClick={() => saveRow(r)}>Salvar</Button>}
                      <Button size="sm" variant="ghost" onClick={() => toggleRefund(r)} title={r.refunded ? "Reverter reembolso" : "Marcar reembolso"}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      {r.validated
                        ? <Button size="sm" variant="ghost" onClick={() => toggle(r.id, false)}>Reabrir</Button>
                        : <Button size="sm" onClick={() => toggle(r.id, true)}>Validar</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Sem vendas.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}