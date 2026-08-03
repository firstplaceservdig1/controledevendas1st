CREATE TABLE public.month_settings (
  id uuid primary key default gen_random_uuid(),
  month text not null unique,
  business_days integer not null check (business_days >= 0 and business_days <= 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.month_settings TO authenticated;
GRANT ALL ON public.month_settings TO service_role;
ALTER TABLE public.month_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "month_settings_select" ON public.month_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "month_settings_admin_write" ON public.month_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));