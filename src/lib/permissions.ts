// Permission catalog — keys are stored as text in public.user_permissions.
export type PermissionKey =
  // General
  | "access_system"
  | "view_dashboard"
  | "use_global_search"
  | "view_notifications"
  // Customers
  | "view_customers"
  | "create_customer"
  | "edit_customer"
  | "delete_customer"
  | "export_customers"
  // Quotations (own)
  | "create_quotation"
  | "view_own_quotations"
  | "edit_own_quotations"
  | "delete_own_quotations"
  | "export_own_pdf"
  | "send_own_whatsapp"
  | "send_own_email"
  | "convert_to_job_order"
  // Management (all)
  | "view_all_quotations"
  | "edit_all_quotations"
  | "delete_all_quotations"
  | "approve_quotations"
  | "reject_quotations"
  | "change_quotation_status"
  | "view_cost"
  | "view_profit_margin"
  | "edit_profit_margin"
  | "edit_discount"
  // Products
  | "view_products"
  | "create_product"
  | "edit_product"
  | "delete_product"
  | "manage_item_templates"
  | "add_template"
  | "edit_template"
  | "delete_template"
  | "add_custom_field"
  | "edit_custom_field"
  | "delete_custom_field"
  // Pricing
  | "view_pricing"
  | "edit_pricing"
  | "add_material"
  | "edit_material_prices"
  | "edit_finishing_prices"
  | "edit_waste_rate"
  | "edit_tax"
  | "edit_payment_terms"
  | "edit_validity"
  // Import
  | "import_customers"
  | "import_products"
  | "import_quotations"
  | "import_pricing"
  | "import_job_orders"
  | "import_users"
  | "export_import_errors"
  | "view_import_history"
  | "rollback_import"
  // Job orders
  | "view_job_orders"
  | "create_job_order"
  | "edit_job_order"
  | "update_job_order_status"
  | "view_specs_only"
  | "view_customer_in_job_order"
  // Reports
  | "view_reports"
  | "view_sales_reports"
  | "view_financial_reports"
  | "view_user_reports"
  | "export_reports_excel"
  | "export_reports_pdf"
  // System
  | "manage_users"
  | "create_user"
  | "edit_user"
  | "suspend_user"
  | "activate_user"
  | "reset_password"
  | "edit_user_permissions"
  | "manage_settings"
  | "edit_brand_settings"
  // Material library
  | "view_material_library"
  | "manage_material_library"
  | "manual_material_entry"
  | "manual_weight_entry"
  | "manual_size_entry"
  | "manual_finishing_entry"
  | "manual_product_entry"
  | "save_manual_to_library"
  | "upload_logo"
  // Legacy compatibility
  | "manage_customers"
  | "manage_pricing"
  | "export_reports"
  | "manual_price_override"
  | "view_internal_fields"
  | "view_cost_fields"
  | "toggle_pdf_visibility";

export interface PermissionDef { key: PermissionKey; label: string }
export interface PermissionGroup { title: string; items: PermissionDef[] }

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: "الصلاحيات العامة",
    items: [
      { key: "access_system", label: "الدخول للنظام" },
      { key: "view_dashboard", label: "عرض لوحة التحكم" },
      { key: "use_global_search", label: "استخدام البحث العام" },
      { key: "view_notifications", label: "عرض الإشعارات" },
    ],
  },
  {
    title: "عروض الأسعار — خاصة به",
    items: [
      { key: "create_quotation", label: "إنشاء عرض سعر" },
      { key: "view_own_quotations", label: "عرض عروضه فقط" },
      { key: "edit_own_quotations", label: "تعديل عروضه فقط" },
      { key: "delete_own_quotations", label: "حذف عروضه فقط" },
      { key: "export_own_pdf", label: "تصدير PDF لعروضه" },
      { key: "send_own_whatsapp", label: "إرسال واتساب لعروضه" },
      { key: "send_own_email", label: "إرسال إيميل لعروضه" },
      { key: "convert_to_job_order", label: "تحويل إلى أمر تشغيل" },
    ],
  },
  {
    title: "إدارة عروض الأسعار",
    items: [
      { key: "view_all_quotations", label: "عرض كل عروض الأسعار" },
      { key: "edit_all_quotations", label: "تعديل كل عروض الأسعار" },
      { key: "delete_all_quotations", label: "حذف كل عروض الأسعار" },
      { key: "approve_quotations", label: "اعتماد عروض الأسعار" },
      { key: "reject_quotations", label: "رفض عروض الأسعار" },
      { key: "change_quotation_status", label: "تغيير حالة العرض" },
      { key: "view_cost", label: "رؤية التكلفة الداخلية" },
      { key: "view_profit_margin", label: "رؤية هامش الربح" },
      { key: "edit_profit_margin", label: "تعديل هامش الربح" },
      { key: "edit_discount", label: "تعديل الخصم" },
    ],
  },
  {
    title: "العملاء",
    items: [
      { key: "view_customers", label: "عرض العملاء" },
      { key: "create_customer", label: "إضافة عميل" },
      { key: "edit_customer", label: "تعديل عميل" },
      { key: "delete_customer", label: "حذف عميل" },
      { key: "import_customers", label: "استيراد عملاء من Excel" },
      { key: "export_customers", label: "تصدير العملاء" },
    ],
  },
  {
    title: "المنتجات والبنود",
    items: [
      { key: "view_products", label: "عرض المنتجات" },
      { key: "create_product", label: "إضافة منتج" },
      { key: "edit_product", label: "تعديل منتج" },
      { key: "delete_product", label: "حذف منتج" },
      { key: "manage_item_templates", label: "إدارة قوالب البنود" },
      { key: "add_template", label: "إضافة قالب بند" },
      { key: "edit_template", label: "تعديل قالب بند" },
      { key: "delete_template", label: "حذف قالب بند" },
      { key: "add_custom_field", label: "إضافة حقول مخصصة" },
      { key: "delete_custom_field", label: "حذف حقول مخصصة" },
    ],
  },
  {
    title: "التسعير",
    items: [
      { key: "view_pricing", label: "عرض قواعد التسعير" },
      { key: "edit_pricing", label: "تعديل قواعد التسعير" },
      { key: "add_material", label: "إضافة خامات" },
      { key: "edit_material_prices", label: "تعديل أسعار الخامات" },
      { key: "edit_finishing_prices", label: "تعديل أسعار التشطيبات" },
      { key: "edit_waste_rate", label: "تعديل نسب الهالك" },
      { key: "edit_tax", label: "تعديل الضريبة" },
      { key: "edit_payment_terms", label: "تعديل شروط الدفع" },
      { key: "edit_validity", label: "تعديل مدة صلاحية العرض" },
    ],
  },
  {
    title: "Excel ورفع البيانات",
    items: [
      { key: "import_products", label: "رفع بيانات المنتجات" },
      { key: "import_quotations", label: "رفع بيانات عروض الأسعار" },
      { key: "import_pricing", label: "رفع إعدادات التسعير" },
      { key: "import_job_orders", label: "رفع أوامر التشغيل" },
      { key: "import_users", label: "رفع بيانات المستخدمين" },
      { key: "view_import_history", label: "عرض سجل رفع البيانات" },
      { key: "export_import_errors", label: "تحميل تقرير الأخطاء" },
      { key: "rollback_import", label: "التراجع عن عملية رفع" },
    ],
  },
  {
    title: "أوامر التشغيل",
    items: [
      { key: "view_job_orders", label: "عرض أوامر التشغيل" },
      { key: "create_job_order", label: "إنشاء أمر تشغيل" },
      { key: "edit_job_order", label: "تعديل أمر تشغيل" },
      { key: "update_job_order_status", label: "تغيير حالة أمر التشغيل" },
      { key: "view_specs_only", label: "عرض المواصفات فقط" },
      { key: "view_customer_in_job_order", label: "رؤية بيانات العميل داخل أمر التشغيل" },
    ],
  },
  {
    title: "التقارير",
    items: [
      { key: "view_reports", label: "عرض التقارير" },
      { key: "view_sales_reports", label: "تقارير المبيعات" },
      { key: "view_financial_reports", label: "التقارير المالية" },
      { key: "view_user_reports", label: "تقارير المستخدمين" },
      { key: "export_reports_excel", label: "تصدير Excel" },
      { key: "export_reports_pdf", label: "تصدير PDF" },
    ],
  },
  {
    title: "النظام",
    items: [
      { key: "manage_users", label: "إدارة المستخدمين والصلاحيات" },
      { key: "create_user", label: "إضافة مستخدم" },
      { key: "edit_user", label: "تعديل مستخدم" },
      { key: "suspend_user", label: "إيقاف مستخدم" },
      { key: "activate_user", label: "تفعيل مستخدم" },
      { key: "reset_password", label: "إعادة تعيين كلمة المرور" },
      { key: "edit_user_permissions", label: "تعديل صلاحيات المستخدمين" },
      { key: "manage_settings", label: "إعدادات الهوية والـ PDF" },
      { key: "edit_brand_settings", label: "تعديل بيانات الشركة" },
      { key: "upload_logo", label: "رفع اللوجو" },
    ],
  },
  {
    title: "مكتبة الخامات والمنتجات",
    items: [
      { key: "view_material_library", label: "عرض مكتبة الخامات والمنتجات" },
      { key: "manage_material_library", label: "إدارة مكتبة الخامات والمنتجات" },
      { key: "manual_product_entry", label: "إدخال منتج مخصص داخل العرض" },
      { key: "manual_material_entry", label: "إدخال خامة يدوية داخل العرض" },
      { key: "manual_weight_entry", label: "إدخال وزن يدوي داخل العرض" },
      { key: "manual_size_entry", label: "إدخال مقاس يدوي داخل العرض" },
      { key: "manual_finishing_entry", label: "إدخال تشطيب يدوي داخل العرض" },
      { key: "save_manual_to_library", label: "حفظ القيم اليدوية داخل المكتبة" },
    ],
  },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

// Default permissions per role
export const ROLE_DEFAULT_PERMISSIONS: Record<string, PermissionKey[]> = {
  admin: ALL_PERMISSION_KEYS,
  sales_manager: [
    "access_system", "view_dashboard", "use_global_search", "view_notifications",
    "view_customers", "create_customer", "edit_customer", "import_customers", "export_customers",
    "create_quotation", "view_own_quotations", "edit_own_quotations", "delete_own_quotations",
    "export_own_pdf", "send_own_whatsapp", "send_own_email", "convert_to_job_order",
    "view_all_quotations", "approve_quotations", "reject_quotations", "change_quotation_status",
    "edit_discount",
    "view_products",
    "view_pricing",
    "view_job_orders", "create_job_order", "view_customer_in_job_order",
    "view_reports", "view_sales_reports", "export_reports_excel", "export_reports_pdf",
    "view_import_history", "export_import_errors",
    "view_material_library", "manage_material_library",
    "manual_product_entry", "manual_material_entry", "manual_weight_entry",
    "manual_size_entry", "manual_finishing_entry", "save_manual_to_library",
  ],
  sales_rep: [
    "access_system", "view_dashboard", "use_global_search", "view_notifications",
    "view_customers", "create_customer", "edit_customer",
    "create_quotation", "view_own_quotations", "edit_own_quotations", "delete_own_quotations",
    "export_own_pdf", "send_own_whatsapp", "send_own_email",
    "view_products", "view_pricing",
    "import_customers",
    "view_material_library",
    "manual_product_entry", "manual_material_entry", "manual_weight_entry",
    "manual_size_entry", "manual_finishing_entry",
  ],
  finance: [
    "access_system", "view_dashboard", "view_notifications",
    "view_all_quotations", "view_cost", "view_profit_margin",
    "view_reports", "view_financial_reports", "export_reports_excel", "export_reports_pdf",
    "view_import_history",
  ],
  production_viewer: [
    "access_system", "view_notifications",
    "view_job_orders", "update_job_order_status", "view_specs_only",
    "view_customer_in_job_order",
  ],
};

// UI helper
export function hasPerm(perms: ReadonlySet<string> | null | undefined, key: PermissionKey): boolean {
  if (!perms) return false;
  return perms.has(key);
}
