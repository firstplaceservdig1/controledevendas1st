import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  ssr: false,
  beforeLoad: ({ context }) => { if (!(context as any).isAdmin) throw redirect({ to: "/dashboard" }); },
  component: Produtos,
});

function Produtos() {
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState(""); const [pct, setPct] = useState("");

  async function load() { const { data } = await supabase.from("products").select("*").order("name"); setRows(data ?? []); }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("products").insert({ name, commission_pct: Number(pct) });
    if (error) { toast.error(error.message); return; }
    setName(""); setPct(""); load();
  }
  async function toggle(id: string, active: boolean) { await supabase.from("products").update({ active }).eq("id", id); load(); }
  async function updatePct(id: string, value: number) { await supabase.from("products").update({ commission_pct: value }).eq("id", id); load(); }
  async function remove(id: string) {
    if (!confirm("Excluir produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader><CardTitle>Novo produto</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={add} className="flex gap-3 items-end flex-wrap">
            <div className="grid gap-2 flex-1 min-w-[200px]"><Label>Nome</Label><Input required value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="grid gap-2 w-32"><Label>Comissão %</Label><Input required type="number" step="0.01" value={pct} onChange={e => setPct(e.target.value)} /></div>
            <Button type="submit">Adicionar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Produtos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Comissão %</TableHead><TableHead>Ativo</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" defaultValue={r.commission_pct} className="w-24"
                      onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(r.commission_pct)) updatePct(r.id, v); }} />
                  </TableCell>
                  <TableCell><Switch checked={r.active} onCheckedChange={(v) => toggle(r.id, v)} /></TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum produto.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}