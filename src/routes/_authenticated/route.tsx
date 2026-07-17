import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { LayoutDashboard, PlusCircle, List, Package, Users, CheckCircle2, LogOut, BarChart3, History, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    return { user: data.user, isAdmin };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user, isAdmin } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/auth", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sellerItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Nova venda", url: "/nova-venda", icon: PlusCircle },
    { title: "Minhas vendas", url: "/vendas", icon: List },
    { title: "Histórico", url: "/historico", icon: History },
  ];
  const adminItems = [
    { title: "Dashboard geral", url: "/admin/dashboard", icon: BarChart3 },
    { title: "Produtos", url: "/admin/produtos", icon: Package },
    { title: "Vendedores", url: "/admin/vendedores", icon: Users },
    { title: "Fechamento", url: "/admin/validacao", icon: CheckCircle2 },
    { title: "Validação em massa", url: "/admin/validacao-massa", icon: FileSpreadsheet },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarHeader className="px-4 py-4">
            <div className="text-lg font-semibold tracking-tight">Vendas</div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Vendedor</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sellerItems.map((it) => (
                    <SidebarMenuItem key={it.url}>
                      <SidebarMenuButton asChild isActive={pathname === it.url}>
                        <Link to={it.url}>
                          <it.icon />
                          <span>{it.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {isAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel>Administração</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminItems.map((it) => (
                      <SidebarMenuItem key={it.url}>
                        <SidebarMenuButton asChild isActive={pathname === it.url}>
                          <Link to={it.url}>
                            <it.icon />
                            <span>{it.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>
          <SidebarFooter className="p-3">
            <div className="text-xs text-muted-foreground px-1 pb-2 truncate">{user.email}</div>
            <Button variant="ghost" size="sm" onClick={signOut} disabled={signingOut} className="justify-start">
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </SidebarFooter>
        </Sidebar>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border/60 px-3 gap-2">
            <SidebarTrigger />
            <div className="text-sm text-muted-foreground">
              {isAdmin ? "Administrador" : "Vendedor"}
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto"><Outlet /></main>
        </div>
      </div>
    </SidebarProvider>
  );
}