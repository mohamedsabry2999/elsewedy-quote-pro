
-- ============ 1. Import batches & errors ============
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  target_module text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_name text,
  total_rows integer NOT NULL DEFAULT 0,
  success_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  skipped_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_rolled_back boolean NOT NULL DEFAULT false,
  rolled_back_at timestamptz,
  rolled_back_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read import batches" ON public.import_batches FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_owner(auth.uid()));
CREATE POLICY "authenticated insert import batches" ON public.import_batches FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "own or admin update import batches" ON public.import_batches FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_owner(auth.uid()));
CREATE POLICY "admin delete import batches" ON public.import_batches FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_owner(auth.uid()));
CREATE TRIGGER trg_import_batches_updated BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.import_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  field_name text,
  error_message text NOT NULL,
  raw_row_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.import_errors TO authenticated;
GRANT ALL ON public.import_errors TO service_role;
ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read errors of visible batches" ON public.import_errors FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = import_batch_id
    AND (b.uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_owner(auth.uid()))));
CREATE POLICY "insert errors on own batches" ON public.import_errors FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = import_batch_id AND b.uploaded_by = auth.uid()));

-- ============ 2. Field aliases (smart mapping dictionary) ============
CREATE TABLE public.field_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL,
  system_field text NOT NULL,
  alias_name text NOT NULL,
  language text NOT NULL DEFAULT 'ar',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_name, system_field, alias_name)
);
GRANT SELECT ON public.field_aliases TO authenticated;
GRANT ALL ON public.field_aliases TO service_role;
ALTER TABLE public.field_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read aliases" ON public.field_aliases FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage aliases" ON public.field_aliases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_owner(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_owner(auth.uid()));

-- ============ 3. Add import_batch_id to existing tables ============
ALTER TABLE public.customers        ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL;
ALTER TABLE public.quotations       ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL;
ALTER TABLE public.quotation_items  ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL;
ALTER TABLE public.pricing_rules    ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL;

-- ============ 4. Item templates ============
CREATE TABLE public.item_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text,
  category text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  calculation_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.item_templates TO authenticated;
GRANT ALL ON public.item_templates TO service_role;
ALTER TABLE public.item_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read active templates" ON public.item_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage templates" ON public.item_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_owner(auth.uid()) OR public.has_permission(auth.uid(),'manage_item_templates'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_owner(auth.uid()) OR public.has_permission(auth.uid(),'manage_item_templates'));
CREATE TRIGGER trg_item_templates_updated BEFORE UPDATE ON public.item_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.item_template_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.item_templates(id) ON DELETE CASCADE,
  section_name text NOT NULL,
  section_key text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.item_template_sections TO authenticated;
GRANT ALL ON public.item_template_sections TO service_role;
ALTER TABLE public.item_template_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read sections" ON public.item_template_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage sections" ON public.item_template_sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_owner(auth.uid()) OR public.has_permission(auth.uid(),'manage_item_templates'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_owner(auth.uid()) OR public.has_permission(auth.uid(),'manage_item_templates'));
CREATE TRIGGER trg_item_template_sections_updated BEFORE UPDATE ON public.item_template_sections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.item_template_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.item_templates(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.item_template_sections(id) ON DELETE SET NULL,
  field_label_ar text NOT NULL,
  field_label_en text,
  field_key text NOT NULL,
  field_type text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  visible_to_customer boolean NOT NULL DEFAULT true,
  internal_only boolean NOT NULL DEFAULT false,
  included_in_calculation boolean NOT NULL DEFAULT false,
  default_value text,
  placeholder text,
  help_text text,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditional_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  formula jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, field_key)
);
GRANT SELECT ON public.item_template_fields TO authenticated;
GRANT ALL ON public.item_template_fields TO service_role;
ALTER TABLE public.item_template_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read fields" ON public.item_template_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage fields" ON public.item_template_fields FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_owner(auth.uid()) OR public.has_permission(auth.uid(),'manage_item_templates'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_owner(auth.uid()) OR public.has_permission(auth.uid(),'manage_item_templates'));
CREATE TRIGGER trg_item_template_fields_updated BEFORE UPDATE ON public.item_template_fields
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ 5. Extend quotation_items with template link + snapshot ============
ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.item_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS calculation_inputs jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ============ 6. Extend profiles ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS department text;

-- ============ 7. Seed field aliases ============
INSERT INTO public.field_aliases (module_name, system_field, alias_name, language) VALUES
-- customers
('customers','company_name','اسم العميل','ar'),('customers','company_name','العميل','ar'),('customers','company_name','الشركة','ar'),('customers','company_name','اسم الشركة','ar'),
('customers','company_name','Customer','en'),('customers','company_name','Customer Name','en'),('customers','company_name','Company','en'),('customers','company_name','Company Name','en'),
('customers','contact_person','مسؤول التواصل','ar'),('customers','contact_person','الشخص المسؤول','ar'),('customers','contact_person','جهة الاتصال','ar'),
('customers','contact_person','Contact','en'),('customers','contact_person','Contact Person','en'),
('customers','phone','الهاتف','ar'),('customers','phone','رقم الهاتف','ar'),('customers','phone','التليفون','ar'),
('customers','phone','Phone','en'),('customers','phone','Mobile','en'),('customers','phone','Tel','en'),
('customers','whatsapp','واتساب','ar'),('customers','whatsapp','رقم واتساب','ar'),
('customers','whatsapp','Whatsapp','en'),('customers','whatsapp','WhatsApp Number','en'),
('customers','email','البريد الإلكتروني','ar'),('customers','email','الايميل','ar'),('customers','email','البريد','ar'),
('customers','email','Email','en'),('customers','email','Mail','en'),
('customers','industry','المجال','ar'),('customers','industry','النشاط','ar'),('customers','industry','الصناعة','ar'),('customers','industry','القطاع','ar'),
('customers','industry','Industry','en'),('customers','industry','Sector','en'),
('customers','address','العنوان','ar'),
('customers','address','Address','en'),('customers','address','Location','en'),
('customers','notes','ملاحظات','ar'),
('customers','notes','Notes','en'),('customers','notes','Remarks','en'),
-- quotations
('quotations','quotation_number','رقم عرض السعر','ar'),('quotations','quotation_number','رقم العرض','ar'),
('quotations','quotation_number','Quotation Number','en'),('quotations','quotation_number','Quote Number','en'),
('quotations','customer_name','العميل','ar'),('quotations','customer_name','اسم العميل','ar'),
('quotations','customer_name','Customer','en'),
('quotations','status','الحالة','ar'),
('quotations','status','Status','en'),
('quotations','issue_date','التاريخ','ar'),('quotations','issue_date','تاريخ العرض','ar'),
('quotations','issue_date','Date','en'),('quotations','issue_date','Issue Date','en'),
('quotations','total','الإجمالي','ar'),('quotations','total','القيمة النهائية','ar'),
('quotations','total','Total','en'),('quotations','total','Final Total','en'),
('quotations','sales_rep_email','السيلز','ar'),('quotations','sales_rep_email','مندوب المبيعات','ar'),
('quotations','sales_rep_email','Sales','en'),('quotations','sales_rep_email','Sales Rep','en'),
('quotations','notes','ملاحظات','ar'),
('quotations','notes','Notes','en'),
-- quotation items
('quotation_items','product_name','اسم المنتج','ar'),('quotation_items','product_name','البند','ar'),('quotation_items','product_name','المنتج','ar'),
('quotation_items','product_name','Product Name','en'),('quotation_items','product_name','Item','en'),
('quotation_items','category','الفئة','ar'),('quotation_items','category','النوع','ar'),
('quotation_items','category','Category','en'),
('quotation_items','quantity','الكمية','ar'),
('quotation_items','quantity','Quantity','en'),('quotation_items','quantity','Qty','en'),
('quotation_items','size','المقاس','ar'),
('quotation_items','size','Size','en'),
('quotation_items','material','الخامة','ar'),('quotation_items','material','نوع الورق','ar'),
('quotation_items','material','Material','en'),('quotation_items','material','Paper Type','en'),
('quotation_items','gsm','الجراماج','ar'),
('quotation_items','gsm','GSM','en'),
('quotation_items','printing_method','طريقة الطباعة','ar'),
('quotation_items','printing_method','Printing Method','en'),
('quotation_items','finishing_options','التشطيب','ar'),('quotation_items','finishing_options','التشطيبات','ar'),
('quotation_items','finishing_options','Finishing','en'),
('quotation_items','unit_price','سعر الوحدة','ar'),
('quotation_items','unit_price','Unit Price','en'),
('quotation_items','total_price','الإجمالي','ar'),
('quotation_items','total_price','Total','en'),
('quotation_items','notes','ملاحظات','ar'),
('quotation_items','notes','Notes','en'),
-- pricing rules
('pricing_rules','label_ar','اسم البند','ar'),('pricing_rules','label_ar','الوصف','ar'),
('pricing_rules','label_ar','Item Name','en'),('pricing_rules','label_ar','Name','en'),
('pricing_rules','category','نوع التكلفة','ar'),('pricing_rules','category','الفئة','ar'),
('pricing_rules','category','Cost Type','en'),('pricing_rules','category','Category','en'),
('pricing_rules','value','السعر','ar'),('pricing_rules','value','القيمة','ar'),
('pricing_rules','value','Price','en'),('pricing_rules','value','Value','en'),
('pricing_rules','unit','الوحدة','ar'),
('pricing_rules','unit','Unit','en'),
('pricing_rules','key','المعرف','ar'),('pricing_rules','key','الكود','ar'),
('pricing_rules','key','Key','en'),('pricing_rules','key','Code','en'),
('pricing_rules','is_active','نشط','ar'),
('pricing_rules','is_active','Active','en');

-- ============ 8. Seed default item templates ============
DO $$
DECLARE
  cats text[] := ARRAY['digital','offset','packaging','paper_wrap','labels','catalog','marketing','custom'];
  cat_labels_ar jsonb := '{"digital":"طباعة ديجيتال","offset":"طباعة أوفست","packaging":"علب كرتون","paper_wrap":"تغليف ورقي","labels":"استيكرات وليبلز","catalog":"كتالوج / بروشور","marketing":"منتجات تسويقية","custom":"منتج مخصص"}'::jsonb;
  c text;
  tid uuid;
  sid_basics uuid;
  sid_specs uuid;
  sid_pricing uuid;
BEGIN
  FOREACH c IN ARRAY cats LOOP
    INSERT INTO public.item_templates (name_ar, category, is_system, description)
    VALUES (cat_labels_ar->>c, c, true, 'قالب افتراضي — قابل للتخصيص')
    RETURNING id INTO tid;

    INSERT INTO public.item_template_sections (template_id, section_name, section_key, sort_order)
    VALUES (tid, 'البيانات الأساسية', 'basics', 0) RETURNING id INTO sid_basics;
    INSERT INTO public.item_template_sections (template_id, section_name, section_key, sort_order)
    VALUES (tid, 'المواصفات', 'specs', 10) RETURNING id INTO sid_specs;
    INSERT INTO public.item_template_sections (template_id, section_name, section_key, sort_order)
    VALUES (tid, 'التسعير', 'pricing', 20) RETURNING id INTO sid_pricing;

    INSERT INTO public.item_template_fields (template_id, section_id, field_label_ar, field_key, field_type, required, visible_to_customer, sort_order) VALUES
      (tid, sid_basics, 'اسم المنتج', 'product_name', 'text', true, true, 0),
      (tid, sid_basics, 'ملاحظات العميل', 'customer_notes', 'long_text', false, true, 10),
      (tid, sid_specs, 'المقاس', 'size', 'size', false, true, 0),
      (tid, sid_specs, 'الخامة', 'material', 'material_selector', false, true, 10),
      (tid, sid_specs, 'الجراماج', 'gsm', 'number', false, true, 20),
      (tid, sid_specs, 'طريقة الطباعة', 'printing_method', 'dropdown', false, true, 30),
      (tid, sid_specs, 'التشطيبات', 'finishing_options', 'multi_select', false, true, 40);
    INSERT INTO public.item_template_fields (template_id, section_id, field_label_ar, field_key, field_type, required, visible_to_customer, included_in_calculation, sort_order) VALUES
      (tid, sid_pricing, 'الكمية', 'quantity', 'quantity', true, true, true, 0),
      (tid, sid_pricing, 'سعر الوحدة', 'unit_price', 'currency', true, true, true, 10),
      (tid, sid_pricing, 'الخصم %', 'discount', 'percentage', false, true, true, 20),
      (tid, sid_pricing, 'هامش الربح %', 'margin', 'percentage', false, false, true, 30);

    UPDATE public.item_templates SET calculation_config =
      '{"quantity_field":"quantity","unit_price_field":"unit_price","discount_field":"discount","margin_field":"margin","formula":"quantity*unit_price"}'::jsonb
    WHERE id = tid;
  END LOOP;
END $$;
