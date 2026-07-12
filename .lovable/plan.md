# خطة تطوير إدارة المستخدمين والصلاحيات

الصفحة الحالية بها Drawer لتعديل الأدوار والصلاحيات، لكن ينقصها إنشاء مستخدم جديد آمن، توسّع في قائمة الصلاحيات، تفعيل هذه الصلاحيات فعليًا في الواجهات والـ Sidebar، وإغلاق التسجيل العام. الخطة تُنفّذ الكل دفعة واحدة.

## ١. قاعدة البيانات (migration واحدة)

- إضافة أعمدة على `profiles`: `department` (text)، `internal_notes` (text)، `phone` موجود مسبقًا.
- إنشاء جدول `user_activity_logs` (user_id, action, details, created_at) مع RLS: يقرأه المالك/الأدمن، وتكتب فيه الدوال فقط.
- إضافة كل مفاتيح الصلاحيات الجديدة (لا يوجد enum ثابت — المفاتيح نصية، سنستخدم فقط ثابتة في الفرونت).
- سياسة RLS جديدة على `profiles` تسمح لمن يملك `manage_users` بقراءة الكل.
- سياسة RLS جديدة على `user_permissions` تسمح لمن يملك `manage_users` بالكتابة.

## ٢. Server functions للعمليات الحساسة

يُنشأ `src/lib/admin-users.functions.ts` بمعرِّف `requireSupabaseAuth` + فحص `has_role('admin')/is_owner`، وتستخدم `supabaseAdmin` داخل الـ handler فقط.
- `createUserFn` — ينشئ Auth User، Profile، User Role، وصلاحيات (الافتراضية أو المحددة). خيار "إرسال دعوة" باستخدام `inviteUserByEmail`.
- `resetPasswordFn` — يرسل رابط إعادة تعيين للمستخدم.
- `deleteUserFn` — يحذف المستخدم (مع منع المالك).
- `logActivityFn` — يسجّل حدث في `user_activity_logs`.

## ٣. توسيع قائمة الصلاحيات

`src/lib/permissions.ts` — إضافة المفاتيح الناقصة: `use_global_search`, `view_notifications`, `change_quotation_status`, `edit_all_pricing`, `edit_finishing_prices`, `edit_waste_rate`, `edit_tax`, `edit_payment_terms`, `edit_validity`, `manage_settings`, `edit_brand_settings`, `upload_logo`, `create_user`, `edit_user`, `suspend_user`, `activate_user`, `reset_password`, `edit_user_permissions`, `view_sales_reports`, `view_user_reports`, `export_reports_excel`, `export_reports_pdf`, `create_job_order`, `edit_job_order`, `view_customer_in_job_order`، وتحديث `ROLE_DEFAULT_PERMISSIONS` لكل دور طبقًا للمواصفات.

## ٤. صفحة المستخدمين — إعادة تصميم

`src/routes/_authenticated/users.tsx`:
- كروت إحصائية أعلى الصفحة: إجمالي المستخدمين، نشط، موقوف، عدد الأدوار.
- زر "إضافة مستخدم جديد" (يفتح Sheet جديد `AddUserSheet`).
- الجدول كما هو مع تحسينات: badge دور، badge حالة، آخر دخول، عدد العروض، إجمالي القيمة.
- زر "إدارة" يفتح `UserDrawer` الحالي (بعد توسيعه).

### `AddUserSheet`
- حقول: الاسم، الإيميل، الهاتف، الدور، القسم، كلمة المرور + التأكيد، الحالة، ملاحظات داخلية.
- خيار "إرسال دعوة عبر البريد" بدل كلمة المرور.
- قسم "الصلاحيات" بنفس checklist مقسّم على أقسام قابلة للطي (Accordion).
- أزرار: تحديد الكل، إلغاء الكل، تطبيق الافتراضي حسب الدور، حفظ، حفظ وإرسال، إلغاء.
- استدعاء `createUserFn` عبر `useServerFn`.

### `UserDrawer` (توسيع)
- تبويبات: البيانات الأساسية / الصلاحيات / النشاط.
- زر إعادة تعيين كلمة المرور (استدعاء `resetPasswordFn`).
- عرض `user_activity_logs` آخر ٢٠ حدثًا.
- Confirmation dialog لإيقاف/تفعيل/حذف.

## ٥. تفعيل الصلاحيات في كامل التطبيق

`useAuth` يوفّر `permissions: Set<string>` و `can(key)` و `roles`.

- **Sidebar (`AppShell.tsx`)**: كل عنصر مربوط بمفتاح صلاحية → إخفاء العنصر إذا لم يمتلكها. المالك يرى كل شيء.
- **صفحات القوائم**:
  - `quotations.index` — إذا لا يملك `view_all_quotations` نُصفّي بـ `sales_rep_id = auth.uid()`.
  - `customers` — أزرار الإضافة/التعديل/الحذف تختفي حسب الصلاحيات.
  - `pricing / finishing / item-templates / import / import-history / job-orders / users / settings` — كل زر إجراء مربوط بمفتاح.
- **تفاصيل عرض السعر** — تكلفة، هامش الربح، والقسم الداخلي مخفية إذا لا يملك `view_cost/view_profit_margin`. زر PDF داخلي كذلك.
- **PDF** — `variant="internal"` ممنوع تلقائيًا لمن لا يملك `view_cost`.

## ٦. إغلاق التسجيل العام

`src/routes/auth.tsx`:
- حذف تبويب "إنشاء حساب" (كان مخفيًا سابقًا لكن نتحقق).
- حذف "متابعة بحساب جوجل".
- الشاشة تحتوي فقط: البريد، كلمة المرور، زر تسجيل الدخول، ورابط "نسيت كلمة المرور؟".
- إبقاء طلب إعادة تعيين كلمة المرور فعّالًا.

## ٧. الاختبار

- إضافة مستخدم بدور مندوب مبيعات → دخوله يعرض عروضه فقط، لا يرى صفحة المستخدمين ولا التكلفة.
- تعديل صلاحياته لإضافة `view_cost` → تظهر التكلفة فورًا بعد إعادة تسجيل الدخول أو invalidate.
- محاولة إيقاف المالك → رفض واضح من الـ trigger الموجود.
- إعادة تعيين كلمة المرور → يستقبل المستخدم البريد.

## الملفات المتأثرة

جديد: `supabase/migrations/<...>_users_admin.sql`, `src/lib/admin-users.functions.ts`, `src/components/users/AddUserSheet.tsx`, `src/components/users/UserActivityList.tsx`.

معدّل: `src/lib/permissions.ts`, `src/hooks/use-auth.ts`, `src/components/AppShell.tsx`, `src/routes/_authenticated/users.tsx`, `src/routes/_authenticated/quotations.index.tsx`, `src/routes/_authenticated/quotations.$id.tsx`, `src/routes/_authenticated/customers.tsx`, `src/routes/_authenticated/pricing.tsx`, `src/routes/_authenticated/finishing.tsx`, `src/routes/_authenticated/import.tsx`, `src/routes/_authenticated/import-history.tsx`, `src/routes/_authenticated/job-orders.tsx`, `src/routes/_authenticated/item-templates.tsx`, `src/routes/_authenticated/settings.tsx`, `src/routes/auth.tsx`, `src/lib/pdf.ts`.
