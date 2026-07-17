
CREATE TABLE public.platform_sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month text NOT NULL,
  purchase_date date,
  buyer_email text NOT NULL,
  platform public.sale_platform NOT NULL,
  platform_status text,
  amount numeric(14,2) NOT NULL,
  import_batch uuid NOT NULL,
  imported_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX platform_sales_month_idx ON public.platform_sales(month);
CREATE INDEX platform_sales_lookup_idx ON public.platform_sales(month, platform, buyer_email);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_sales TO authenticated;
GRANT ALL ON public.platform_sales TO service_role;

ALTER TABLE public.platform_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_sales admin all" ON public.platform_sales
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
