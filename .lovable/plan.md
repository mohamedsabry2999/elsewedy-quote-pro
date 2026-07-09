# خطة الإصلاح الشامل لنظام Elsewedy Smart Quotation

سأنفذ الإصلاح على **4 جولات** متتالية بعد موافقتك، بحيث كل جولة تنتهي بميزة كاملة قابلة للاختبار بدون كسر ما هو شغال. هذه الجولة الأولى فقط تُنفَّذ بعد الموافقة، ثم أكمل الباقي جولة جولة.

---

## الجولة 1 — Backend + Workflow + Validations (الأساس)

**Migration واحدة تضيف:**
- `job_orders` (رقم أمر التشغيل تلقائي `JO-YYYY-#####`، quotation_id, production_status، due_date، notes، assigned_to)
- أعمدة على `quotations`: `tax_enabled` (bool default true)، `tax_pct` (default 14)، `tax_amount`، `payment_terms`، `delivery_days`، `validity_days`، `internal_notes`
- أعمدة على `pricing_rules` seed: `min_margin_pct` (10)، `max_discount_pct` (15)، `high_value_threshold` (50000)
- RLS + GRANT كاملة + trigger للـ job order number
- دوال DB: `has_role`، `can_view_quotation` للتحقق من الصلاحيات

**كود:**
- إضافة VAT للـ pricing engines الخمسة (digital/offset/packaging/labels/finishing_only)
- Approval routing حقيقي: خصم > حد، هامش < حد، قيمة > threshold → `pending_approval` تلقائي
- Validations قوية: zod schemas في الويزارد (كمية>0، عميل مطلوب، أسعار غير سلبية، هاتف صحيح)
- Confirmation dialogs (AlertDialog) لكل: حذف، اعتماد، رفض، تحويل لأمر تشغيل، إرسال
- منع الحذف إلا لـ admin + منع تصدير PDF لعرض ناقص البيانات
- تحويل الحالات كاملة: Draft → Pending Approval → Approved → Sent → Accepted/Rejected → Converted
- زر "تحويل لأمر تشغيل" ينشئ job_order فعلي ويحدث الحالة

## الجولة 2 — PDF الاحترافي

- إعادة كتابة `src/lib/pdf.ts` باستخدام `pdfmake` (يدعم RTL أعمق من jsPDF-autotable) أو تحسين jsPDF-autotable مع:
  - تكرار رأس الجدول تلقائيًا عبر الصفحات (`showHead: 'everyPage'`)
  - Page break ذكي (`rowPageBreak: 'avoid'` للبنود القصيرة)
  - Header + Footer ثابتين مع رقم الصفحة `X من Y`
  - Font Cairo مدمج (base64) لضمان عربي سليم
  - Watermark للحالات Draft/Rejected
  - نسختين: عميل (بدون تكلفة/ربح) + داخلي (كامل مع ملاحظات إدارية)
  - QR code لرقم العرض
  - جدول شروط الدفع + مدة التوريد + الصلاحية + الملاحظات في أقسام منفصلة
  - Section titles مرتبطة بمحتواها (keep-with-next)

## الجولة 3 — تجربة إنشاء عرض السعر (UX)

- Stepper محسّن مع progress + validation لكل خطوة
- Auto-save draft كل 10 ثواني
- **Modal إضافة عميل جديد** من داخل الويزارد بدون مغادرة الصفحة
- **بنود متعددة** (multi-line items) لكل عرض سعر مع سعر وحدة + إجمالي
- معاينة live للـ PDF جانب النموذج (mini preview)
- حقول ضريبة/شروط دفع/مدة توريد/صلاحية ظاهرة وقابلة للتعديل
- زر "حفظ كمسودة" منفصل عن "إصدار نهائي"

## الجولة 4 — UI/UX Enterprise + Dashboard + Filters

- **Top bar** جديد: بحث عام (Cmd+K)، إشعارات (عروض تحتاج موافقة/قاربت الانتهاء)، قائمة المستخدم
- Empty states + Loading skeletons + Success/Error toasts موحدة
- Dashboard إضافي: عروض قاربت الصلاحية (7 أيام)، عروض تحتاج متابعة، KPIs جديدة (متوسط وقت الاستجابة، معدل الرفض)
- فلاتر متقدمة في `/quotations`: رقم، عميل، تاريخ (range)، حالة، سيلز، فئة، نطاق قيمة، تحتاج موافقة، قاربت الانتهاء
- Dropdown export للفلترة الحالية إلى Excel
- تحسين الـ sidebar بأيقونات وتجميع منطقي
- تحسين responsive للموبايل

---

## ملاحظات تنفيذية

- **لن أكسر شيئًا شغالًا**: كل جولة تُختبر مستقلة، والـ migration additive فقط (لا drop لأعمدة موجودة).
- **VAT**: افتراضي 14% مُفعل، قابل للإيقاف من الإعدادات ومن كل عرض سعر منفردًا.
- **Job Orders**: صفحة `/job-orders` جديدة تعرض القائمة + تفاصيل الإنتاج + حالة (pending/in_production/completed/delivered).
- كل جولة تنتهي أُبلغك بما تم واختبار سريع للسيناريو.

---

**هل أبدأ بالجولة 1 (Backend + Workflow + Validations + Job Orders + VAT)؟**
بعد ما أخلصها وتراجعها، أنتقل للجولة 2 (PDF)، ثم 3، ثم 4.
