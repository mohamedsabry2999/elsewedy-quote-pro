
-- Update trigger fn (reuse existing touch_updated_at)

-- 1) paper_materials
CREATE TABLE public.paper_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text,
  code text UNIQUE,
  material_type text,
  description text,
  suitable_for jsonb NOT NULL DEFAULT '[]'::jsonb,
  internal_notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paper_materials TO authenticated;
GRANT ALL ON public.paper_materials TO service_role;
ALTER TABLE public.paper_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read materials" ON public.paper_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage materials" ON public.paper_materials FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_material_library'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_material_library'));
CREATE TRIGGER trg_paper_materials_updated BEFORE UPDATE ON public.paper_materials
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) paper_weights
CREATE TABLE public.paper_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gsm integer NOT NULL,
  display_name text NOT NULL,
  material_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  product_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paper_weights TO authenticated;
GRANT ALL ON public.paper_weights TO service_role;
ALTER TABLE public.paper_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read weights" ON public.paper_weights FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage weights" ON public.paper_weights FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_material_library'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_material_library'));
CREATE TRIGGER trg_paper_weights_updated BEFORE UPDATE ON public.paper_weights
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) common_sizes
CREATE TABLE public.common_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  width numeric,
  height numeric,
  unit text NOT NULL DEFAULT 'cm',
  size_type text,
  suitable_for jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.common_sizes TO authenticated;
GRANT ALL ON public.common_sizes TO service_role;
ALTER TABLE public.common_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read sizes" ON public.common_sizes FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage sizes" ON public.common_sizes FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_material_library'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_material_library'));
CREATE TRIGGER trg_common_sizes_updated BEFORE UPDATE ON public.common_sizes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) common_finishings
CREATE TABLE public.common_finishings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  technical_name text,
  description text,
  suitable_for jsonb NOT NULL DEFAULT '[]'::jsonb,
  affects_price boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.common_finishings TO authenticated;
GRANT ALL ON public.common_finishings TO service_role;
ALTER TABLE public.common_finishings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read finishings" ON public.common_finishings FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage finishings" ON public.common_finishings FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_material_library'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_material_library'));
CREATE TRIGGER trg_common_finishings_updated BEFORE UPDATE ON public.common_finishings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) common_products
CREATE TABLE public.common_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text,
  category text,
  default_description text,
  suggested_material_id uuid REFERENCES public.paper_materials(id) ON DELETE SET NULL,
  suggested_weight_id uuid REFERENCES public.paper_weights(id) ON DELETE SET NULL,
  suggested_size_id uuid REFERENCES public.common_sizes(id) ON DELETE SET NULL,
  suggested_printing_method text,
  suggested_finishings jsonb NOT NULL DEFAULT '[]'::jsonb,
  customer_notes text,
  internal_notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.common_products TO authenticated;
GRANT ALL ON public.common_products TO service_role;
ALTER TABLE public.common_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read products" ON public.common_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage products" ON public.common_products FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_material_library'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_material_library'));
CREATE TRIGGER trg_common_products_updated BEFORE UPDATE ON public.common_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6) product_material_rules
CREATE TABLE public.product_material_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  common_product_id uuid NOT NULL REFERENCES public.common_products(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.paper_materials(id) ON DELETE CASCADE,
  weight_id uuid REFERENCES public.paper_weights(id) ON DELETE SET NULL,
  finishing_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_material_rules TO authenticated;
GRANT ALL ON public.product_material_rules TO service_role;
ALTER TABLE public.product_material_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read rules" ON public.product_material_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage rules" ON public.product_material_rules FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_material_library'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_material_library'));
CREATE TRIGGER trg_product_material_rules_updated BEFORE UPDATE ON public.product_material_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================
-- Seed data
-- =========================

-- Materials
INSERT INTO public.paper_materials (name_ar, name_en, code, material_type, description) VALUES
  ('كوشيه', 'Couche', 'MAT-COUCHE', 'ورق مصقول', 'ورق مصقول لامع/مطفي مناسب للطباعة الملونة'),
  ('بريستول', 'Bristol', 'MAT-BRISTOL', 'كرتون رفيع', 'ورق كرتوني قوي للكروت والأغلفة'),
  ('دوبلكس', 'Duplex', 'MAT-DUPLEX', 'كرتون', 'كرتون دوبلكس للعلب والتغليف'),
  ('كرافت', 'Kraft', 'MAT-KRAFT', 'ورق بني', 'ورق بني طبيعي للتغليف البيئي'),
  ('فابريانو', 'Fabriano', 'MAT-FABRIANO', 'ورق فاخر', 'ورق فاخر للأغراض الراقية'),
  ('كارتون رمادي', 'Grey Board', 'MAT-GREY', 'كرتون سميك', 'كرتون رمادي سميك للعلب الصلبة'),
  ('ورق لاصق', 'Adhesive Paper', 'MAT-ADH', 'استيكر', 'ورق لاصق عام'),
  ('استيكر ورق', 'Paper Sticker', 'MAT-STK-PAPER', 'استيكر', 'استيكر بخامة ورقية'),
  ('استيكر بلاستيك', 'Vinyl Sticker', 'MAT-STK-VINYL', 'استيكر', 'استيكر بلاستيك مقاوم للماء'),
  ('استيكر شفاف', 'Transparent Sticker', 'MAT-STK-CLEAR', 'استيكر', 'استيكر شفاف'),
  ('استيكر ميتاليك', 'Metallic Sticker', 'MAT-STK-METAL', 'استيكر', 'استيكر بلمسة معدنية'),
  ('ورق ميتاليز', 'Metallized Paper', 'MAT-METALLIZED', 'ورق خاص', 'ورق بطبقة معدنية'),
  ('ورق أوفست', 'Offset Paper', 'MAT-OFFSET', 'ورق عادي', 'ورق أوفست للطباعة العادية'),
  ('ورق داخلي للكتالوجات', 'Catalog Inner', 'MAT-CAT-INNER', 'ورق كتالوج', 'ورق مخصص للصفحات الداخلية للكتالوجات');

-- Weights
INSERT INTO public.paper_weights (gsm, display_name) VALUES
  (80,'80 GSM'),(100,'100 GSM'),(120,'120 GSM'),(150,'150 GSM'),(170,'170 GSM'),
  (200,'200 GSM'),(250,'250 GSM'),(300,'300 GSM'),(350,'350 GSM'),(400,'400 GSM');

-- Sizes
INSERT INTO public.common_sizes (name, width, height, unit, size_type) VALUES
  ('A4', 21, 29.7, 'cm', 'نهائي'),
  ('A5', 14.8, 21, 'cm', 'نهائي'),
  ('A3', 29.7, 42, 'cm', 'نهائي'),
  ('50×70', 50, 70, 'cm', 'شيت'),
  ('35×50', 35, 50, 'cm', 'شيت'),
  ('كارت شخصي 9×5.5', 9, 5.5, 'cm', 'نهائي'),
  ('مقاس مخصص', NULL, NULL, 'cm', 'مفتوح');

-- Finishings
INSERT INTO public.common_finishings (name_ar, technical_name, description, affects_price) VALUES
  ('سلوفان مطفي', 'matte_lam', 'تغليف بطبقة سلوفان مطفية', true),
  ('سلوفان لامع', 'gloss_lam', 'تغليف بطبقة سلوفان لامعة', true),
  ('فويل', 'foil', 'ختم فويل معدني', true),
  ('سبوت UV', 'spot_uv', 'طلاء UV محلي لامع', true),
  ('تكسير', 'creasing', 'تكسير للطي', true),
  ('قص', 'cutting', 'قص بأشكال محددة', true),
  ('طي', 'folding', 'طي على خطوط محددة', true),
  ('لصق', 'gluing', 'لصق للعلب والأغلفة', true),
  ('سلك', 'wire_stitching', 'تدبيس سلكي', true),
  ('دبوس', 'stapling', 'تدبيس عادي', true),
  ('تغليف', 'shrink_wrap', 'تغليف الطلبية', false),
  ('تخريم', 'perforation', 'تخريم بخط قابل للفصل', true),
  ('تجليد', 'binding', 'تجليد الكتب والكتالوجات', true);

-- Common products
INSERT INTO public.common_products (name_ar, name_en, category, default_description, suggested_printing_method) VALUES
  ('علبة شوكولاتة','Chocolate Box','علب تغليف','علبة شوكولاتة مطبوعة بألوان CMYK','أوفست'),
  ('علبة تمر','Dates Box','علب تغليف','علبة تمر فاخرة','أوفست'),
  ('علبة دواء','Medicine Box','علب تغليف','علبة دواء مطبوعة حسب المواصفات','أوفست'),
  ('علبة مستحضرات تجميل','Cosmetics Box','علب تغليف','علبة مستحضرات تجميل','أوفست'),
  ('سليف تغليف','Packaging Sleeve','تغليف','سليف تغليف كرتوني','أوفست'),
  ('استيكر ورق','Paper Sticker','استيكرات','استيكر بخامة ورقية','ديجيتال'),
  ('استيكر شفاف','Transparent Sticker','استيكرات','استيكر شفاف','ديجيتال'),
  ('استيكر ميتاليك','Metallic Sticker','استيكرات','استيكر بلمسة معدنية','ديجيتال'),
  ('ليبل رول','Roll Label','استيكرات','ليبلات على شكل رول','ديجيتال'),
  ('بروشور A4 مطوي','Folded A4 Brochure','بروشورات','بروشور A4 بطية واحدة أو ثلاثية','أوفست'),
  ('فلاير A5','A5 Flyer','بروشورات','فلاير دعائي مقاس A5','أوفست'),
  ('كتالوج','Catalog','كتالوجات','كتالوج شركة أو منتجات','أوفست'),
  ('فولدر','Folder','مطبوعات مكتبية','فولدر تقديمي بجيوب','أوفست'),
  ('كارت شكر','Thank You Card','كروت','كارت شكر مع الطلبية','ديجيتال'),
  ('تاج ملابس','Clothing Tag','تاجات','تاج معلق للملابس','أوفست'),
  ('منيو','Menu','مطاعم','منيو مطعم','أوفست'),
  ('كارت شخصي','Business Card','كروت','كارت شخصي','ديجيتال'),
  ('بوستر','Poster','دعاية','بوستر إعلاني','أوفست'),
  ('بانر ورقي','Paper Banner','دعاية','بانر ورقي','أوفست'),
  ('ورق مراسلات','Letterhead','مطبوعات مكتبية','ورق مراسلات رسمي','أوفست'),
  ('ظرف','Envelope','مطبوعات مكتبية','ظرف مراسلات','أوفست'),
  ('نوت بوك','Notebook','مطبوعات مكتبية','نوت بوك مجلد','أوفست'),
  ('كارت ضمان','Warranty Card','كروت','كارت ضمان المنتج','ديجيتال'),
  ('إنسرت داخل العبوة','Package Insert','تغليف','ورقة تعليمات داخل العبوة','أوفست');
