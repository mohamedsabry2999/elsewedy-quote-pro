# Elsewedy Smart Quotation — Full System Audit & Upgrade

هذا العمل ضخم جدًا (١٥+ صفحة، محرك PDF كامل، RLS، صلاحيات، Excel، واتساب، UI/UX). لتنفيذه بجودة Enterprise حقيقية بدون كسر النظام، سأقسمه إلى مراحل متتابعة. كل مرحلة قابلة للاختبار قبل الانتقال للتالية.

## أولوية التنفيذ

الأولوية القصوى بحسب طلبك: **ملف PDF** (لأنه أهم مخرج للنظام) + **الوظائف الفعلية للأزرار** + **الصلاحيات الحقيقية (RLS)**. الشكل والألوان بعدها.

---

## المرحلة 1 — محرك PDF الاحترافي (الأهم)

**إعادة بناء `src/lib/pdf.ts` بالكامل** باستخدام pdfmake مع خط عربي مدمج (Cairo) — لأنه يدعم RTL و pagination ذكي بشكل أفضل من jsPDF.

- خط Cairo مدمج (base64) لعدم قطع الحروف.
- A4 ثابت، margins ثابتة، Header/Footer مع Page X of Y.
- كل بند = "كارت" واحد لا يُقسم (unbreakable block). لو لم يتسع، ينزل للصفحة التالية كاملًا.
- بند أطول من صفحة: يُقسم بذكاء مع تكرار "تابع بند رقم X" ورأس الجدول.
- تنسيق الأرقام: `12,500.00 ج.م` (Intl.NumberFormat ar-EG).
- ترجمة القيم التقنية (gloss_lam → سلوفان لامع...) عبر قاموس مركزي.
- **نسختان**: Customer PDF (بدون تكلفة/ربح) و Internal PDF (كل شيء).
- QR Code، بيانات الشركة، هوية Medhat Elsewedy في الهيدر/الفوتر.
- ترتيب الصفحات كما طلبت (هيدر → بيانات العميل → تفاصيل العرض → البنود → ملخص مالي → شروط → QR → فوتر).

## المرحلة 2 — صفحة معاينة PDF

- Route جديد `/quotations/$id/preview` مع Toggle بين Customer/Internal.
- أزرار: تحميل، طباعة، واتساب، رجوع للتعديل.
- المعاينة مطابقة تمامًا للـ PDF (نفس المحرك).

## المرحلة 3 — واتساب الذكي

- توليد PDF العميل → تحميل تلقائي.
- تحية حسب توقيت Africa/Cairo (صباح/مساء).
- فتح `wa.me` بالرسالة الجاهزة + تنبيه لإرفاق الملف.

## المرحلة 4 — RLS وصلاحيات حقيقية

- مراجعة policies على `quotations` و `quotation_items` و `customers` و `job_orders`:
  - كل مستخدم يرى **صفوفه فقط** (`sales_rep_id = auth.uid()`) افتراضيًا.
  - صلاحية `view_all_quotations` تعطي رؤية شاملة عبر `has_permission()`.
  - Admin/Owner يرى كل شيء.
- تعطيل sign-up العام من واجهة `/auth`.
- منع رؤية cost/margin بدون صلاحية `view_cost` / `view_margin`.

## المرحلة 5 — تدقيق كل صفحة (Buttons/Empty/Loading/Error)

مراجعة منهجية لكل صفحة موجودة:

| الصفحة | الفحص |
|---|---|
| Dashboard | KPIs حقيقية، فلترة بالمستخدم |
| Quotations list | فلاتر تعمل، بحث، pagination، تصدير |
| Quotation new/edit | Stepper، Autosave، Duplicate/Reorder، Manual + Library |
| Quotation detail | كل الأزرار (PDF/WA/Convert to JO/Status change) |
| Customers | CRUD كامل + بحث |
| Job Orders | حالة، طباعة، ربط بالعرض |
| Users & Permissions | مراجعة سابقة موجودة — إضافة إعادة تعيين كلمة السر |
| Library | مراجعة CRUD كامل للتبويبات الخمس |
| Pricing Rules | تفعيل CRUD إن كانت شكلية |
| Finishing Services | تفعيل CRUD |
| Item Templates | تفعيل CRUD |
| Import Batches | عرض سجل + إعادة تشغيل |
| Excel Import | Column mapping ذكي (عربي/إنجليزي) + Preview + Errors |
| Brand Settings | معاينة فورية لتغييرات الهوية |

كل زر وهمي → يُفعّل أو يُحذف. كل empty state يحصل على illustration + CTA.

## المرحلة 6 — UI/UX Polish (هوية Medhat Elsewedy)

- تحديث `src/styles.css`: tokens بألوان الشركة (أحمر/برتقالي/رمادي داكن).
- Sidebar، Header، Cards، Tables، Modals، Toasts.
- Loading skeletons موحدة.
- رسائل خطأ عربية واضحة (بدون permission denied/null).

## المرحلة 7 — Excel Import محسّن

- `field_aliases` موجود بالفعل — تفعيل mapping ذكي.
- Preview + row-level errors + batch progress.
- ربط تلقائي بالمستخدم + احترام الصلاحيات.

## المرحلة 8 — اختبار End-to-End

تشغيل السيناريوهات الـ 24 التي ذكرتها عبر Playwright، مع لقطات شاشة لكل خطوة.

---

## اقتراح التنفيذ الآن

لا يمكنني تنفيذ كل هذا في رد واحد بجودة عالية (سيؤدي لأخطاء وعمل سطحي). أقترح:

**أبدأ فورًا بالمرحلة 1 (محرك PDF الجديد)** لأنها الأهم والأكثر إلحاحًا، ثم أعرض عليك النتيجة، ونتحرك للمرحلة 2 وهكذا.

**أو** أبدأ بالمرحلتين 1+4 معًا (PDF + RLS/Permissions) لأنهما الأخطر تقنيًا.

**أو** ترتيب مختلف تحدده أنت.

أخبرني بأي مرحلة أبدأ (أو "ابدأ بالمرحلة 1")، وسأنفذها بالكامل وأعود إليك بنتيجة قابلة للاختبار.
