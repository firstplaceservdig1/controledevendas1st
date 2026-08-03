import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { businessDaysInMonth } from "@/lib/format";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  ssr: false,
  beforeLoad: ({ context }) => { if (!(context as any).isAdmin) throw redirect({ to: "/dashboard" }); },
  component: Configuracoes,
});

function monthLabel(m: string) {
  const [y, mm] = m.split("-").map(Number);
  return new Date(y, mm - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function Configuracoes() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [rows, setRows] = useState<any[]>([]);
  const [month, setMonth] = useState(currentMonth);
  const [days, setDays] = useState("");

  async function load() {
    const { data } = await supabase.from("month_settings").select("*").order("month", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  const suggestion = (() => {
    const [y, mm] = month.split("-").map(Number);
    if (!y || !mm) return null;
    return businessDaysInMonth(y, mm - 1).length;
  })();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(days);
    if (!Number.isInteger(n) || n < 0 || n > 31) { toast.error("Informe um número de dias entre 0 e 31."); return; }
    const { error } = await supabase
      .from("month_settings")
      .upsert({ month, business_days: n, updated_at: new Date().toISOString() }, { onConflict: "month" });
    if (error) { toast.error(error.message); return; }
    toast.success("Dias úteis salvos.");
    setDays("");
    load();
  }

  async function updateDays(id: string, value: number) {
    const { error } = await supabase
      .from("month_settings")
      .update({ business_days: value, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message); else load();
  }

  async function remove(id: string) {
    if (!confirm("Remover configuração deste mês?")) return;
    const { error } = await supabase.from("month_settings").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader><CardTitle>Dias úteis do mês</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-3 md:grid-cols-3 items-end">
            <div className="grid gap-2">
              <Label>Mês</Label>
              <Input type="month" required value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Dias úteis</Label>
              <Input type="number" min={0} max={31} required value={days} onChange={(e) => setDays(e.target.value)} placeholder={suggestion ? String(suggestion) : ""} />
            </div>
            <Button type="submit">Salvar</Button>
          </form>
          <p className="text-xs text-muted-foreground mt-3">
            Sugestão pelo calendário (seg–sex, sem feriados): <span className="text-foreground">{suggestion ?? "—"}</span> dias.
            O valor definido aqui é usado no bônus por consistência do vendedor.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Meses configurados</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Mês</TableHead><TableHead>Dias úteis</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-muted-foreground">Nenhum mês configurado ainda.</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="capitalize">{monthLabel(r.month)}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={31}
                      className="w-24"
                      defaultValue={r.business_days}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== r.business_days) updateDays(r.id, v);
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}