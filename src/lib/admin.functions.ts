import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1).max(120),
  role: z.enum(["admin", "vendedor"]),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "Falha ao criar usuário");
    }
    const uid = created.data.user.id;
    if (data.role === "admin") {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: uid, role: "admin" }, { onConflict: "user_id,role" }
      );
    }
    return { ok: true, user_id: uid };
  });

export const validateSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ sale_id: z.string().uuid(), validated: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("sales")
      .update({
        validated: data.validated,
        validated_at: data.validated ? new Date().toISOString() : null,
        validated_by: data.validated ? context.userId : null,
      })
      .eq("id", data.sale_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });