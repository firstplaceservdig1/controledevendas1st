
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor');
CREATE TYPE public.sale_platform AS ENUM ('Kiwify', 'Hotmart', 'Lia', 'Própria');
CREATE TYPE public.sale_type AS ENUM ('Passiva', 'Ativa');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  commission_pct NUMERIC(5,2) NOT NULL CHECK (commission_pct >= 0 AND commission_pct <= 100),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Sales
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  platform sale_platform NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  sale_type sale_type NOT NULL,
  notes TEXT,
  commission_pct_snapshot NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL,
  validated BOOLEAN NOT NULL DEFAULT false,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id),
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_sales_seller ON public.sales(seller_id);
CREATE INDEX idx_sales_date ON public.sales(sale_date);

-- Trigger to update updated_at & recompute commission on insert/update
CREATE OR REPLACE FUNCTION public.sales_before_write()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE p_pct NUMERIC(5,2);
BEGIN
  -- lock commission after validation
  IF TG_OP = 'UPDATE' AND OLD.validated = true THEN
    -- only admin can update validated sales; validation info can change; block seller edits handled by RLS
    NULL;
  END IF;
  SELECT commission_pct INTO p_pct FROM public.products WHERE id = NEW.product_id;
  IF p_pct IS NULL THEN RAISE EXCEPTION 'Produto inválido'; END IF;
  IF NEW.commission_pct_snapshot IS NULL OR NEW.commission_pct_snapshot = 0 OR TG_OP = 'INSERT' THEN
    NEW.commission_pct_snapshot := p_pct;
  END IF;
  NEW.commission_amount := ROUND(NEW.amount * NEW.commission_pct_snapshot / 100, 2);
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE TRIGGER sales_before_write_trg
BEFORE INSERT OR UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.sales_before_write();

-- RLS Policies

-- profiles: user reads own; admin reads all
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- user_roles: user reads own; admin reads all (service_role handles writes)
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- products: any authenticated reads; admin writes
CREATE POLICY "products read" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products admin write" ON public.products FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- sales:
-- Seller reads own; admin reads all
CREATE POLICY "sales read" ON public.sales FOR SELECT TO authenticated
USING (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));
-- Seller inserts own
CREATE POLICY "sales insert own" ON public.sales FOR INSERT TO authenticated
WITH CHECK (auth.uid() = seller_id);
-- Seller updates own only if NOT validated; admin can always update
CREATE POLICY "sales update" ON public.sales FOR UPDATE TO authenticated
USING (
  (auth.uid() = seller_id AND validated = false)
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  (auth.uid() = seller_id AND validated = false)
  OR public.has_role(auth.uid(), 'admin')
);
-- Seller deletes own only if NOT validated; admin any
CREATE POLICY "sales delete" ON public.sales FOR DELETE TO authenticated
USING (
  (auth.uid() = seller_id AND validated = false)
  OR public.has_role(auth.uid(), 'admin')
);

-- Auto profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  -- default role: vendedor
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'vendedor')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
