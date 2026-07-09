
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS tax_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tax_pct numeric NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_price numeric NOT NULL DEFAULT 0;

CREATE SEQUENCE IF NOT EXISTS public.job_order_seq START 1;

CREATE OR REPLACE FUNCTION public.next_job_order_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT 'JO-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.job_order_seq')::text,5,'0') $$;

CREATE TABLE IF NOT EXISTS public.job_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_order_number text UNIQUE NOT NULL DEFAULT public.next_job_order_number(),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE RESTRICT,
  production_status text NOT NULL DEFAULT 'pending' CHECK (production_status IN ('pending','in_production','completed','delivered','cancelled')),
  due_date date,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  production_notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_orders_quotation ON public.job_orders(quotation_id);
CREATE INDEX IF NOT EXISTS idx_job_orders_status ON public.job_orders(production_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_orders TO authenticated;
GRANT ALL ON public.job_orders TO service_role;

ALTER TABLE public.job_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_orders_select_all_auth" ON public.job_orders;
CREATE POLICY "job_orders_select_all_auth" ON public.job_orders
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "job_orders_admin_manage" ON public.job_orders;
CREATE POLICY "job_orders_admin_manage" ON public.job_orders
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','sales_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','sales_manager']::app_role[]));

DROP POLICY IF EXISTS "job_orders_sales_insert_own" ON public.job_orders;
CREATE POLICY "job_orders_sales_insert_own" ON public.job_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'sales_rep')
    AND EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_id AND q.sales_rep_id = auth.uid())
  );

DROP TRIGGER IF EXISTS trg_job_orders_updated_at ON public.job_orders;
CREATE TRIGGER trg_job_orders_updated_at
  BEFORE UPDATE ON public.job_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.pricing_rules (category, key, label_ar, value, unit)
VALUES
  ('config','min_margin_pct','الحد الأدنى لهامش الربح %',10,'%'),
  ('config','max_discount_pct','الحد الأقصى للخصم بدون موافقة %',15,'%'),
  ('config','high_value_threshold','قيمة العرض التي تحتاج موافقة',50000,'EGP'),
  ('config','default_tax_pct','نسبة ضريبة القيمة المضافة الافتراضية %',14,'%'),
  ('config','default_validity_days','مدة صلاحية عرض السعر الافتراضية',30,'يوم'),
  ('config','default_delivery_days','مدة التوريد الافتراضية',7,'يوم')
ON CONFLICT (category, key) DO NOTHING;
