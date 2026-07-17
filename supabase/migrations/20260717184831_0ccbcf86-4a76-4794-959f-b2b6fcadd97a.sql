
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS platform_fee_pct numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agency_commission_pct numeric(5,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS seller_commission_pct numeric(5,2);

-- Migrate legacy commission_pct into seller_commission_pct where not set
UPDATE public.products
  SET seller_commission_pct = commission_pct
  WHERE seller_commission_pct IS NULL;

ALTER TABLE public.products
  ALTER COLUMN seller_commission_pct SET NOT NULL,
  ALTER COLUMN seller_commission_pct SET DEFAULT 0;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS platform_fee_pct_snapshot numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agency_commission_pct_snapshot numeric(5,2) NOT NULL DEFAULT 100;

CREATE OR REPLACE FUNCTION public.sales_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  p_platform NUMERIC(5,2);
  p_agency   NUMERIC(5,2);
  p_seller   NUMERIC(5,2);
  net_after_platform NUMERIC(14,4);
  agency_amount NUMERIC(14,4);
BEGIN
  SELECT platform_fee_pct, agency_commission_pct, seller_commission_pct
    INTO p_platform, p_agency, p_seller
  FROM public.products WHERE id = NEW.product_id;
  IF p_seller IS NULL THEN RAISE EXCEPTION 'Produto inválido'; END IF;

  IF TG_OP = 'INSERT' OR NEW.commission_pct_snapshot IS NULL OR NEW.commission_pct_snapshot = 0 THEN
    NEW.commission_pct_snapshot := p_seller;
    NEW.platform_fee_pct_snapshot := p_platform;
    NEW.agency_commission_pct_snapshot := p_agency;
  END IF;

  net_after_platform := NEW.amount * (1 - NEW.platform_fee_pct_snapshot / 100);
  agency_amount := net_after_platform * (NEW.agency_commission_pct_snapshot / 100);
  NEW.commission_amount := ROUND(agency_amount * (NEW.commission_pct_snapshot / 100), 2);
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- Recompute existing sales with new formula
UPDATE public.sales s
SET amount = amount
FROM public.products p
WHERE s.product_id = p.id;
