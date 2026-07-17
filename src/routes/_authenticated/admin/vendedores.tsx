import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createUser } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/vendedores")({
  ssr: false,
  beforeLoad: ({ context }) => { if (!(context as any).isAdmin) throw redirect({ to: "/dashboard" }); },
  component: Vendedores,
});

function Vendedores() {
  const createUserFn = useServerFn(createUser);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "vendedor" as "vendedor" | "admin" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const [p, r, s] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
      supabase.from("sales").select("seller_id, amount, commission_amount, validated"),
    ]);
    setProfiles(p.data ?? []); setRoles(r.data ?? []); setSales(s.data ?? []);
  }
  useEffect(() => { load(); }, []);

  const byUser = useMemo(() => {
    const m = new Map<string, { count: number; revenue: number; commission: number; validated: number }>();
    sales.forEach(v => {
      const cur = m.get(v.seller_id) ?? { count: 0, revenue: 0, commission: 0, validated: 0 };
      cur.count++; cur.revenue += Number(v.amount); cur.commission += Number(v.commission_amount);
      if (v.validated) cur.validated++;
      m.set(v.seller_id, cur);
    });
    return m;
  }, [sales]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createUserFn({ data: form });
      toast.success("Usuário criado");
      setForm({ email: "", password: "", full_name: "", role: "vendedor" });
      load();
    } catch (err: any) { toast.error(err.message ?? "Erro"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Cadastrar usuário</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>Nome</Label><Input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>E-mail</Label><Input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Senha</Label><Input type="password" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Perfil</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 flex justify-end"><Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Criar usuário"}</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Desempenho da equipe</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Perfil</TableHead>
              <TableHead>Vendas</TableHead><TableHead>Receita</TableHead><TableHead>Comissão</TableHead><TableHead>Validadas</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {profiles.map(p => {
                const stat = byUser.get(p.id) ?? { count: 0, revenue: 0, commission: 0, validated: 0 };
                const isAdm = roles.some(r => r.user_id === p.id && r.role === "admin");
                return (
                  <TableRow key={p.id}>
                    <TableCell>{p.full_name || "—"}</TableCell>
                    <TableCell>{p.email}</TableCell>
                    <TableCell>{isAdm ? "Admin" : "Vendedor"}</TableCell>
                    <TableCell>{stat.count}</TableCell>
                    <TableCell>{brl(stat.revenue)}</TableCell>
                    <TableCell>{brl(stat.commission)}</TableCell>
                    <TableCell>{stat.validated}/{stat.count}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}