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
  const [name, setName] = useState("");
  const [platformPct, setPlatformPct] = useState("");
  const [agencyPct, setAgencyPct] = useState("");
  const [sellerPct, setSellerPct] = useState("");

  async function load() { const { data } = await supabase.from("products").select("*").order("name"); setRows(data ?? []); }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("products").insert({
      name,
      platform_fee_pct: Number(platformPct || 0),
      agency_commission_pct: Number(agencyPct || 0),
      seller_commission_pct: Number(sellerPct || 0),
      commission_pct: Number(sellerPct || 0),
    });
    if (error) { toast.error(error.message); return; }
    setName(""); setPlatformPct(""); setAgencyPct(""); setSellerPct(""); load();
  }
  async function toggle(id: string, active: boolean) { await supabase.from("products").update({ active }).eq("id", id); load(); }
  async function updateField(id: string, field: string, value: number) {
    const patch: any = { [field]: value };
    if (field === "seller_commission_pct") patch.commission_pct = value;
    await supabase.from("products").update(patch).eq("id", id); load();
  }
  async function remove(id: string) {
    if (!confirm("Excluir produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <Card>
        <CardHeader><CardTitle>Novo produto</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={add} className="grid gap-3 md:grid-cols-5 items-end">
            <div className="grid gap-2 md:col-span-2"><Label>Nome</Label><Input required value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="grid gap-2"><Label>Taxa plataforma %</Label><Input required type="number" step="0.01" value={platformPct} onChange={e => setPlatformPct(e.target.value)} /></div>
            <div className="grid gap-2"><Label>Agência %</Label><Input required type="number" step="0.01" value={agencyPct} onChange={e => setAgencyPct(e.target.value)} /></div>
            <div className="grid gap-2"><Label>Vendedor %</Label><Input required type="number" step="0.01" value={sellerPct} onChange={e => setSellerPct(e.target.value)} /></div>
            <div className="md:col-span-5 flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Comissão do vendedor = (valor bruto − taxa da plataforma) × % agência × % vendedor.
              </p>
              <Button type="submit">Adicionar</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Produtos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Plataforma %</TableHead>
              <TableHead>Agência %</TableHead>
              <TableHead>Vendedor %</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" defaultValue={r.platform_fee_pct} className="w-24"
                      onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(r.platform_fee_pct)) updateField(r.id, "platform_fee_pct", v); }} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" defaultValue={r.agency_commission_pct} className="w-24"
                      onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(r.agency_commission_pct)) updateField(r.id, "agency_commission_pct", v); }} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" defaultValue={r.seller_commission_pct} className="w-24"
                      onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(r.seller_commission_pct)) updateField(r.id, "seller_commission_pct", v); }} />
                  </TableCell>
                  <TableCell><Switch checked={r.active} onCheckedChange={(v) => toggle(r.id, v)} /></TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum produto.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}