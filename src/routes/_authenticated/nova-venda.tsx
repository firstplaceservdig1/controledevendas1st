import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/nova-venda")({
  ssr: false,
  component: NovaVenda,
});

function NovaVenda() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_id: "", amount: "", platform: "", buyer_email: "", buyer_phone: "",
    sale_type: "", notes: "",
  });

  useEffect(() => {
    supabase.from("products").select("*").eq("active", true).order("name").then(({ data }) => setProducts(data ?? []));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.product_id || !form.platform || !form.sale_type) { toast.error("Preencha todos os campos obrigatórios."); return; }
    setSaving(true);
    const { error } = await supabase.from("sales").insert({
      seller_id: user.id,
      product_id: form.product_id,
      amount: Number(form.amount),
      platform: form.platform as any,
      buyer_email: form.buyer_email,
      buyer_phone: form.buyer_phone,
      sale_type: form.sale_type as any,
      notes: form.notes || null,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Venda registrada!");
    navigate({ to: "/vendas" });
  }

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader><CardTitle>Nova venda</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label>Produto *</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {p.commission_pct}%</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {products.length === 0 && <p className="text-xs text-muted-foreground">Nenhum produto cadastrado ainda. Peça ao admin.</p>}
            </div>
            <div className="grid gap-2">
              <Label>Valor da venda (R$) *</Label>
              <Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Plataforma *</Label>
                <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {["Kiwify","Hotmart","Lia","Própria"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Tipo de venda *</Label>
                <Select value={form.sale_type} onValueChange={(v) => setForm({ ...form, sale_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {["Passiva","Ativa"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>E-mail do comprador *</Label>
                <Input type="email" required value={form.buyer_email} onChange={(e) => setForm({ ...form, buyer_email: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Telefone do comprador *</Label>
                <Input required value={form.buyer_phone} onChange={(e) => setForm({ ...form, buyer_phone: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => navigate({ to: "/vendas" })}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Registrar venda"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}