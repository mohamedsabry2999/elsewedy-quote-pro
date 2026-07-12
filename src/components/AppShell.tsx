import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, FileText, Settings, LogOut, Plus, DollarSign, Bell, Scissors, FileSpreadsheet, Factory, Shield, Search, ImageIcon, Layers, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS } from "@/lib/roles";
import type { PermissionKey } from "@/lib/permissions";
import { useBrand } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type NavItem = { to: string; icon: typeof LayoutDashboard; label: string; perm?: PermissionKey };

const mainNav: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, label: "لوحة التحكم", perm: "view_dashboard" },
  { to: "/quotations", icon: FileText, label: "عروض الأسعار", perm: "view_own_quotations" },
  { to: "/quotations/new", icon: Plus, label: "إنشاء عرض سعر", perm: "create_quotation" },
  { to: "/job-orders", icon: Factory, label: "أوامر التشغيل", perm: "view_job_orders" },
  { to: "/customers", icon: Users, label: "العملاء", perm: "view_customers" },
];

const adminNav: NavItem[] = [
  { to: "/users", icon: Shield, label: "المستخدمون والصلاحيات", perm: "manage_users" },
  { to: "/pricing", icon: DollarSign, label: "قواعد التسعير", perm: "view_pricing" },
  { to: "/finishing", icon: Scissors, label: "خدمات التشطيبات", perm: "view_pricing" },
  { to: "/item-templates", icon: Layers, label: "قوالب البنود", perm: "manage_item_templates" },
  { to: "/import-history", icon: History, label: "سجل رفع البيانات", perm: "view_import_history" },
  { to: "/import", icon: FileSpreadsheet, label: "استيراد Excel (قديم)", perm: "import_customers" },
  { to: "/settings", icon: ImageIcon, label: "إعدادات الهوية والـ PDF", perm: "manage_settings" },
];

export function AppShell() {
  const { pathname } = useRouterState({ select: (s) => s.location });
  const auth = useAuth();
  const brand = useBrand();
  const navigate = useNavigate();

  const canSee = (perm?: PermissionKey) => !perm || auth.can(perm);
  const visibleMain = mainNav.filter((n) => canSee(n.perm));
  const visibleAdmin = adminNav.filter((n) => canSee(n.perm));

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
    navigate({ to: "/auth" });
  };


  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-4 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center justify-center bg-white/95 rounded-lg p-2.5 hover:bg-white transition">
            <img src={brand.logo_url} alt={brand.company_name_en} className="h-11 w-auto object-contain" />
          </Link>
        </div>

        <div className="p-3">
          <Button asChild className="w-full gradient-brand text-white hover:opacity-90 border-0 shadow-elegant">
            <Link to="/quotations/new"><Plus className="size-4 ms-1" /> عرض سعر جديد</Link>
          </Button>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {nav.map((n) => {
            const active = n.to === "/quotations/new"
              ? pathname === "/quotations/new"
              : n.to === "/quotations"
                ? pathname === "/quotations" || (pathname.startsWith("/quotations/") && pathname !== "/quotations/new")
                : pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/60"
                }`}>
                <n.icon className="size-4" /> {n.label}
              </Link>
            );
          })}
          {isAdmin && (
            <>
              <div className="pt-4 pb-1 px-3 text-[11px] uppercase tracking-wider opacity-60">الإدارة</div>
              <Link to="/users" className={navItemCls(pathname.startsWith("/users"))}>
                <Shield className="size-4" /> المستخدمون والصلاحيات
              </Link>
              <Link to="/pricing" className={navItemCls(pathname.startsWith("/pricing"))}>
                <DollarSign className="size-4" /> قواعد التسعير
              </Link>
              <Link to="/finishing" className={navItemCls(pathname.startsWith("/finishing"))}>
                <Scissors className="size-4" /> خدمات التشطيبات
              </Link>
              <Link to="/item-templates" className={navItemCls(pathname.startsWith("/item-templates"))}>
                <Layers className="size-4" /> قوالب البنود
              </Link>
              <Link to="/import-history" className={navItemCls(pathname.startsWith("/import-history"))}>
                <History className="size-4" /> سجل رفع البيانات
              </Link>
              <Link to="/import" className={navItemCls(pathname.startsWith("/import") && !pathname.startsWith("/import-history"))}>
                <FileSpreadsheet className="size-4" /> استيراد Excel (قديم)
              </Link>
              <Link to="/settings" className={navItemCls(pathname.startsWith("/settings"))}>
                <ImageIcon className="size-4" /> إعدادات الهوية والـ PDF
              </Link>
            </>
          )}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="rounded-lg bg-sidebar-accent/60 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <div className="size-9 rounded-full gradient-brand text-white flex items-center justify-center text-xs font-bold">
                {auth.fullName?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate">{auth.fullName}</div>
                <div className="text-[11px] opacity-70 truncate">
                  {auth.roles.map((r) => ROLE_LABELS[r]).join("، ") || "بدون صلاحيات"}
                </div>
              </div>
            </div>
            <Button onClick={signOut} variant="ghost" size="sm" className="w-full mt-2 text-sidebar-foreground hover:bg-sidebar-accent">
              <LogOut className="size-4 ms-1" /> تسجيل الخروج
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <div className="h-16 bg-card border-b flex items-center gap-4 px-6 shadow-card">
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="بحث سريع…" className="ps-3 pe-9 bg-muted/50 border-0" />
          </div>
          <Button asChild size="sm" className="gradient-brand text-white border-0">
            <Link to="/quotations/new"><Plus className="size-4 ms-1" /> عرض جديد</Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label="الإشعارات">
            <Bell className="size-4" />
          </Button>
          <div className="flex items-center gap-2 text-sm">
            <div className="text-right">
              <div className="font-medium leading-tight">{auth.fullName}</div>
              <div className="text-[11px] text-muted-foreground">{auth.roles.map((r) => ROLE_LABELS[r]).join("، ")}</div>
            </div>
            <div className="size-9 rounded-full gradient-brand text-white flex items-center justify-center text-xs font-bold">
              {auth.fullName?.[0]?.toUpperCase() ?? "?"}
            </div>
          </div>
        </div>
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function navItemCls(active: boolean) {
  return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
    active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/60"
  }`;
}
