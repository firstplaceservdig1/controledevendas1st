import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { validateSale } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/validacao")({
  ssr: false,
  beforeLoad: ({ context }) => { if (!(context as any).isAdmin) throw redirect({ to: "/dashboard" }); },
  component: Validacao,
});

function Validacao() {
  const validateFn = useServerFn(validateSale);
  const [rows, setRows] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());
  const [filter, setFilter] = useState<"pending" | "validated" | "all">("pending");

  async function load() {
    let q = supabase.from("sales").select("*, products(name)").order("sale_date", { ascending: false });
    if (filter === "pending") q = q.eq("validated", false);
    if (filter === "validated") q = q.eq("validated", true);
    const { data } = await q;
    setRows(data ?? []);
    const { data: p } = await supabase.from("profiles").select("*");
    setProfiles(new Map((p ?? []).map((x: any) => [x.id, x])));
  }
  useEffect(() => { load(); }, [filter]);

  async function toggle(id: string, validated: boolean) {
    try {
      await validateFn({ data: { sale_id: id, validated } });
      toast.success(validated ? "Venda validada" : "Validação removida");
      load();
    } catch (e: any) { toast.error(e.message ?? "Erro"); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Validar vendas</CardTitle>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="validated">Validadas</SelectItem>
            <SelectItem value="all">Todas</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>Vendedor</TableHead><TableHead>Produto</TableHead>
            <TableHead>Valor</TableHead><TableHead>Comissão</TableHead><TableHead>Plataforma</TableHead>
            <TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ação</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.sale_date}</TableCell>
                <TableCell>{profiles.get(r.seller_id)?.full_name || profiles.get(r.seller_id)?.email || "—"}</TableCell>
                <TableCell>{r.products?.name}</TableCell>
                <TableCell>{brl(Number(r.amount))}</TableCell>
                <TableCell>{brl(Number(r.commission_amount))}</TableCell>
                <TableCell>{r.platform}</TableCell>
                <TableCell>{r.sale_type}</TableCell>
                <TableCell>{r.validated ? <Badge className="bg-accent text-accent-foreground">Validado</Badge> : <Badge variant="secondary">Pendente</Badge>}</TableCell>
                <TableCell className="text-right">
                  {r.validated
                    ? <Button size="sm" variant="ghost" onClick={() => toggle(r.id, false)}>Reabrir</Button>
                    : <Button size="sm" onClick={() => toggle(r.id, true)}>Validar</Button>}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sem vendas.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}