
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS refunded BOOLEAN NOT NULL DEFAULT false;

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
  should_recalc BOOLEAN;
BEGIN
  SELECT platform_fee_pct, agency_commission_pct, seller_commission_pct
    INTO p_platform, p_agency, p_seller
  FROM public.products WHERE id = NEW.product_id;
  IF p_seller IS NULL THEN RAISE EXCEPTION 'Produto inválido'; END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.commission_pct_snapshot := p_seller;
    NEW.platform_fee_pct_snapshot := p_platform;
    NEW.agency_commission_pct_snapshot := p_agency;
    should_recalc := true;
  ELSE
    -- recalc only when inputs to the formula changed and commission wasn't manually overridden this update
    should_recalc :=
      (NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.product_id IS DISTINCT FROM OLD.product_id
       OR NEW.refunded IS DISTINCT FROM OLD.refunded)
      AND NEW.commission_amount IS NOT DISTINCT FROM OLD.commission_amount;
  END IF;

  IF NEW.refunded THEN
    NEW.commission_amount := 0;
  ELSIF should_recalc THEN
    net_after_platform := NEW.amount * (1 - NEW.platform_fee_pct_snapshot / 100);
    agency_amount := net_after_platform * (NEW.agency_commission_pct_snapshot / 100);
    NEW.commission_amount := ROUND(agency_amount * (NEW.commission_pct_snapshot / 100), 2);
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
