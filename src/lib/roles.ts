export type AppRole = "admin" | "sales_manager" | "sales_rep" | "finance" | "production_viewer";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مسؤول النظام",
  sales_manager: "مدير مبيعات",
  sales_rep: "مندوب مبيعات",
  finance: "الحسابات",
  production_viewer: "متابعة الإنتاج",
};

export const canSeeCosts = (roles: AppRole[]) =>
  roles.some((r) => r === "admin" || r === "sales_manager" || r === "finance");

export const canManagePricing = (roles: AppRole[]) => roles.includes("admin");
export const canApprove = (roles: AppRole[]) => roles.some((r) => r === "admin" || r === "sales_manager");
export const canCreateQuotation = (roles: AppRole[]) =>
  roles.some((r) => r === "admin" || r === "sales_manager" || r === "sales_rep");
export const canManageCustomers = canCreateQuotation;
