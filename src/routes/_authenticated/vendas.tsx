import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vendas")({
  ssr: false,
  component: VendasPage,
});

function VendasPage() {
  const { user } = Route.useRouteContext();
  const [rows, setRows] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  async function load() {
    const { data } = await supabase
      .from("sales").select("*, products(name)")
      .eq("seller_id", user.id).order("sale_date", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { supabase.from("products").select("*").order("name").then(({ data }) => setProducts(data ?? [])); }, []);

  async function remove(id: string) {
    if (!confirm("Excluir esta venda?")) return;
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluída"); load(); }
  }

  async function saveEdit() {
    const e = editing;
    const { error } = await supabase.from("sales").update({
      product_id: e.product_id, amount: Number(e.amount), platform: e.platform,
      buyer_email: e.buyer_email, buyer_phone: e.buyer_phone, sale_type: e.sale_type, notes: e.notes,
    }).eq("id", e.id);
    if (error) { toast.error(error.message); return; }
    setEditing(null); toast.success("Atualizada"); load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Minhas vendas</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Produto</TableHead><TableHead>Valor</TableHead>
              <TableHead>Comissão</TableHead><TableHead>Plataforma</TableHead><TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.sale_date}</TableCell>
                  <TableCell>{r.products?.name}</TableCell>
                  <TableCell>{brl(Number(r.amount))}</TableCell>
                  <TableCell>{brl(Number(r.commission_amount))}</TableCell>
                  <TableCell>{r.platform}</TableCell>
                  <TableCell>{r.sale_type}</TableCell>
                  <TableCell>{r.validated
                    ? <Badge className="bg-accent text-accent-foreground">Validado</Badge>
                    : <Badge variant="secondary">Não validado</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" disabled={r.validated} onClick={() => setEditing({ ...r })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" disabled={r.validated} onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma venda registrada.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar venda</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Produto</Label>
                <Select value={editing.product_id} onValueChange={(v) => setEditing({ ...editing, product_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Valor</Label><Input type="number" step="0.01" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2"><Label>Plataforma</Label>
                  <Select value={editing.platform} onValueChange={(v) => setEditing({ ...editing, platform: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["Kiwify","Hotmart","Lia","Própria"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>Tipo</Label>
                  <Select value={editing.sale_type} onValueChange={(v) => setEditing({ ...editing, sale_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["Passiva","Ativa"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2"><Label>E-mail</Label><Input value={editing.buyer_email} onChange={(e) => setEditing({ ...editing, buyer_email: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Telefone</Label><Input value={editing.buyer_phone} onChange={(e) => setEditing({ ...editing, buyer_phone: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Observações</Label><Textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}