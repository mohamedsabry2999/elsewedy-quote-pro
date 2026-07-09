
-- brand_settings singleton
CREATE TABLE IF NOT EXISTS public.brand_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  logo_url text,
  signature_url text,
  stamp_url text,
  company_name_ar text NOT NULL DEFAULT 'دار مدحت السويدي للطباعة',
  company_name_en text NOT NULL DEFAULT 'Medhat Elsewedy Printhouse',
  address text,
  phone text,
  whatsapp text,
  email text,
  website text,
  tax_number text,
  commercial_register text,
  pdf_footer text,
  default_terms text,
  default_payment_terms text DEFAULT '50% مقدم، 50% عند الاستلام',
  default_validity_days integer NOT NULL DEFAULT 15,
  primary_color text NOT NULL DEFAULT '#C8102E',
  secondary_color text NOT NULL DEFAULT '#EE5A24',
  accent_color text NOT NULL DEFAULT '#2C3E50',
  show_qr boolean NOT NULL DEFAULT true,
  show_bank_details boolean NOT NULL DEFAULT false,
  bank_name text,
  bank_account text,
  bank_iban text,
  bank_swift text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.brand_settings TO authenticated, anon;
GRANT ALL ON public.brand_settings TO service_role;

ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_settings read all" ON public.brand_settings;
CREATE POLICY "brand_settings read all" ON public.brand_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "brand_settings admin write" ON public.brand_settings;
CREATE POLICY "brand_settings admin write" ON public.brand_settings
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_owner(auth.uid()));

INSERT INTO public.brand_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- Extend quotation_items for full multi-item spec
ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS item_number integer,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS unit text DEFAULT 'قطعة',
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS material text,
  ADD COLUMN IF NOT EXISTS gsm text,
  ADD COLUMN IF NOT EXISTS printing_method text,
  ADD COLUMN IF NOT EXISTS printing_sides text,
  ADD COLUMN IF NOT EXISTS colors text,
  ADD COLUMN IF NOT EXISTS finishing_options jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cost_breakdown jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS discount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_margin_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS customer_notes text,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- created_by mirror on quotations for clarity/future use
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.quotations SET created_by = sales_rep_id WHERE created_by IS NULL;

-- keep created_by in sync with sales_rep_id on insert
CREATE OR REPLACE FUNCTION public.sync_quotation_created_by()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := NEW.sales_rep_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS quotations_sync_created_by ON public.quotations;
CREATE TRIGGER quotations_sync_created_by
BEFORE INSERT OR UPDATE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.sync_quotation_created_by();

-- updated_at trigger on brand_settings
DROP TRIGGER IF EXISTS brand_settings_updated_at ON public.brand_settings;
CREATE TRIGGER brand_settings_updated_at BEFORE UPDATE ON public.brand_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
