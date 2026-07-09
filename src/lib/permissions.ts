// Permission catalog — keys must match what RLS/DB functions check.
export type PermissionKey =
  // General
  | "access_system"
  | "view_dashboard"
  | "manage_customers"
  | "create_customer"
  | "edit_customer"
  | "delete_customer"
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
  | "view_cost"
  | "view_profit_margin"
  | "edit_profit_margin"
  | "edit_discount"
  | "manage_pricing"
  | "manage_users"
  | "view_financial_reports"
  | "export_reports"
  // Production
  | "view_job_orders"
  | "update_job_order_status"
  | "view_specs_only"
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
  // Item template management
  | "manage_item_templates"
  | "add_template"
  | "edit_template"
  | "delete_template"
  | "add_custom_field"
  | "edit_custom_field"
  | "delete_custom_field"
  | "manual_price_override"
  | "view_internal_fields"
  | "view_cost_fields"
  | "toggle_pdf_visibility";

export interface PermissionDef {
  key: PermissionKey;
  label: string;
}
export interface PermissionGroup {
  title: string;
  items: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: "الصلاحيات العامة",
    items: [
      { key: "access_system", label: "الدخول للنظام" },
      { key: "view_dashboard", label: "عرض لوحة التحكم" },
      { key: "manage_customers", label: "إدارة العملاء" },
      { key: "create_customer", label: "إضافة عميل" },
      { key: "edit_customer", label: "تعديل عميل" },
      { key: "delete_customer", label: "حذف عميل" },
    ],
  },
  {
    title: "صلاحيات عروض الأسعار",
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
    title: "صلاحيات الإدارة",
    items: [
      { key: "view_all_quotations", label: "عرض كل عروض الأسعار" },
      { key: "edit_all_quotations", label: "تعديل كل عروض الأسعار" },
      { key: "delete_all_quotations", label: "حذف كل عروض الأسعار" },
      { key: "approve_quotations", label: "اعتماد عروض الأسعار" },
      { key: "reject_quotations", label: "رفض عروض الأسعار" },
      { key: "view_cost", label: "رؤية تكلفة العرض" },
      { key: "view_profit_margin", label: "رؤية هامش الربح" },
      { key: "edit_profit_margin", label: "تعديل هامش الربح" },
      { key: "edit_discount", label: "تعديل الخصم" },
      { key: "manage_pricing", label: "تعديل إعدادات التسعير" },
      { key: "manage_users", label: "إدارة المستخدمين والصلاحيات" },
    ],
  },
  {
    title: "صلاحيات التقارير",
    items: [
      { key: "view_financial_reports", label: "عرض التقارير المالية" },
      { key: "export_reports", label: "تصدير التقارير" },
    ],
  },
  {
    title: "صلاحيات الإنتاج",
    items: [
      { key: "view_job_orders", label: "عرض أوامر التشغيل" },
      { key: "update_job_order_status", label: "تحديث حالة أمر التشغيل" },
      { key: "view_specs_only", label: "عرض المواصفات فقط بدون الأسعار" },
    ],
  },
  {
    title: "صلاحيات الاستيراد",
    items: [
      { key: "import_customers", label: "رفع بيانات العملاء" },
      { key: "import_products", label: "رفع بيانات المنتجات" },
      { key: "import_quotations", label: "رفع بيانات عروض الأسعار" },
      { key: "import_pricing", label: "رفع بيانات إعدادات التسعير" },
      { key: "import_job_orders", label: "رفع بيانات أوامر التشغيل" },
      { key: "import_users", label: "رفع بيانات المستخدمين" },
      { key: "export_import_errors", label: "تصدير أخطاء الاستيراد" },
      { key: "view_import_history", label: "عرض سجل عمليات الاستيراد" },
      { key: "rollback_import", label: "التراجع عن عمليات الاستيراد" },
    ],
  },
  {
    title: "صلاحيات قوالب البنود",
    items: [
      { key: "manage_item_templates", label: "إدارة قوالب البنود" },
      { key: "add_template", label: "إضافة قالب بند" },
      { key: "edit_template", label: "تعديل قالب بند" },
      { key: "delete_template", label: "حذف قالب بند" },
      { key: "add_custom_field", label: "إضافة حقول مخصصة" },
      { key: "edit_custom_field", label: "تعديل حقول مخصصة" },
      { key: "delete_custom_field", label: "حذف حقول مخصصة" },
      { key: "manual_price_override", label: "تعديل السعر يدويًا" },
      { key: "view_internal_fields", label: "رؤية الحقول الداخلية" },
      { key: "view_cost_fields", label: "رؤية حقول التكلفة" },
      { key: "toggle_pdf_visibility", label: "إظهار/إخفاء الحقول في PDF" },
    ],
  },
];

// Default permissions per role
export const ROLE_DEFAULT_PERMISSIONS: Record<string, PermissionKey[]> = {
  admin: PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key)),
  sales_manager: [
    "access_system", "view_dashboard",
    "manage_customers", "create_customer", "edit_customer",
    "create_quotation", "view_own_quotations", "edit_own_quotations", "delete_own_quotations",
    "export_own_pdf", "send_own_whatsapp", "send_own_email", "convert_to_job_order",
    "approve_quotations", "reject_quotations",
    "view_cost", "view_profit_margin", "edit_discount",
    "view_job_orders",
    "import_customers", "import_quotations", "view_import_history", "export_import_errors",
  ],
  sales_rep: [
    "access_system", "view_dashboard",
    "create_customer", "edit_customer",
    "create_quotation", "view_own_quotations", "edit_own_quotations", "delete_own_quotations",
    "export_own_pdf", "send_own_whatsapp", "send_own_email",
    "import_customers",
  ],
  finance: [
    "access_system", "view_dashboard",
    "view_all_quotations", "view_cost", "view_profit_margin",
    "view_financial_reports", "export_reports",
    "view_import_history",
  ],
  production_viewer: [
    "access_system",
    "view_job_orders", "update_job_order_status", "view_specs_only",
  ],
};
