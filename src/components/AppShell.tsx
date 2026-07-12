import { useState } from "react";
import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, FileText, LogOut, Plus, DollarSign, Bell, Scissors,
  FileSpreadsheet, Factory, Shield, Search, ImageIcon, Layers, History, Library, Menu, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS } from "@/lib/roles";
import type { PermissionKey } from "@/lib/permissions";
import { useBrand } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
  { to: "/library", icon: Library, label: "مكتبة الخامات والمنتجات", perm: "view_material_library" },
  { to: "/item-templates", icon: Layers, label: "قوالب البنود", perm: "manage_item_templates" },
  { to: "/import-history", icon: History, label: "سجل رفع البيانات", perm: "view_import_history" },
  { to: "/import", icon: FileSpreadsheet, label: "استيراد Excel (قديم)", perm: "import_customers" },
  { to: "/settings", icon: ImageIcon, label: "إعدادات الهوية والـ PDF", perm: "manage_settings" },
];

// Bottom-nav items on mobile (the essentials)
const bottomNav: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, label: "الرئيسية", perm: "view_dashboard" },
  { to: "/quotations", icon: FileText, label: "العروض", perm: "view_own_quotations" },
  { to: "/quotations/new", icon: Plus, label: "جديد", perm: "create_quotation" },
  { to: "/customers", icon: Users, label: "العملاء", perm: "view_customers" },
];

export function AppShell() {
  const { pathname } = useRouterState({ select: (s) => s.location });
  const auth = useAuth();
  const brand = useBrand();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const canSee = (perm?: PermissionKey) => !perm || auth.can(perm);
  const visibleMain = mainNav.filter((n) => canSee(n.perm));
  const visibleAdmin = adminNav.filter((n) => canSee(n.perm));
  const visibleBottom = bottomNav.filter((n) => canSee(n.perm));

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
    navigate({ to: "/auth" });
  };

  const isActive = (to: string) => {
    if (to === "/quotations/new") return pathname === "/quotations/new";
    if (to === "/quotations") return pathname === "/quotations" || (pathname.startsWith("/quotations/") && pathname !== "/quotations/new");
    if (to === "/import") return pathname.startsWith("/import") && !pathname.startsWith("/import-history");
    return pathname.startsWith(to);
  };

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {visibleMain.map((n) => (
        <Link key={n.to} to={n.to} onClick={onNavigate} className={navItemCls(isActive(n.to))}>
          <n.icon className="size-4 shrink-0" />
          <span className="truncate">{n.label}</span>
        </Link>
      ))}
      {visibleAdmin.length > 0 && (
        <>
          <div className="pt-4 pb-1 px-3 text-[11px] uppercase tracking-wider opacity-60">الإدارة</div>
          {visibleAdmin.map((n) => (
            <Link key={n.to} to={n.to} onClick={onNavigate} className={navItemCls(isActive(n.to))}>
              <n.icon className="size-4 shrink-0" />
              <span className="truncate">{n.label}</span>
            </Link>
          ))}
        </>
      )}
    </>
  );

  const UserFooter = ({ onSignOut }: { onSignOut: () => void }) => (
    <div className="rounded-lg bg-sidebar-accent/60 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <div className="size-9 shrink-0 rounded-full gradient-brand text-white flex items-center justify-center text-xs font-bold">
          {auth.fullName?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate">{auth.fullName}</div>
          <div className="text-[11px] opacity-70 truncate">
            {auth.roles.map((r) => ROLE_LABELS[r]).join("، ") || "بدون صلاحيات"}
          </div>
        </div>
      </div>
      <Button onClick={onSignOut} variant="ghost" size="sm" className="w-full mt-2 text-sidebar-foreground hover:bg-sidebar-accent">
        <LogOut className="size-4 ms-1" /> تسجيل الخروج
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background w-full overflow-x-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-sidebar text-sidebar-foreground flex-col">
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
          <NavList />
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <UserFooter onSignOut={signOut} />
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Desktop top bar */}
        <div className="hidden lg:flex h-16 bg-card border-b items-center gap-4 px-6 shadow-card">
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

        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 h-14 bg-sidebar text-sidebar-foreground border-b border-sidebar-border flex items-center gap-2 px-3 shadow-card">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent shrink-0" aria-label="القائمة">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0 w-[85vw] max-w-[320px] bg-sidebar text-sidebar-foreground border-sidebar-border [&>button]:text-sidebar-foreground">
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-sidebar-border">
                  <Link to="/dashboard" onClick={() => setDrawerOpen(false)} className="flex items-center justify-center bg-white/95 rounded-lg p-2 hover:bg-white transition">
                    <img src={brand.logo_url} alt={brand.company_name_en} className="h-10 w-auto object-contain" />
                  </Link>
                </div>
                <div className="p-3">
                  <Button asChild className="w-full gradient-brand text-white hover:opacity-90 border-0 shadow-elegant h-11">
                    <Link to="/quotations/new" onClick={() => setDrawerOpen(false)}>
                      <Plus className="size-4 ms-1" /> عرض سعر جديد
                    </Link>
                  </Button>
                </div>
                <nav className="flex-1 px-3 space-y-1 overflow-y-auto pb-4">
                  <NavList onNavigate={() => setDrawerOpen(false)} />
                </nav>
                <div className="p-3 border-t border-sidebar-border">
                  <UserFooter onSignOut={() => { setDrawerOpen(false); signOut(); }} />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/dashboard" className="flex items-center gap-2 min-w-0 flex-1">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-white/95 p-1 flex items-center justify-center">
              <img src={brand.logo_url} alt={brand.company_name_en} className="max-h-full max-w-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold truncate leading-tight">السويدي</div>
              <div className="text-[10px] opacity-70 truncate leading-tight">عروض الأسعار</div>
            </div>
          </Link>

          <Button asChild size="icon" className="gradient-brand text-white border-0 shrink-0 h-9 w-9" aria-label="عرض جديد">
            <Link to="/quotations/new"><Plus className="size-4" /></Link>
          </Button>
          <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent shrink-0 h-9 w-9" aria-label="الإشعارات">
            <Bell className="size-4" />
          </Button>
        </div>

        <div className="flex-1 min-w-0 p-4 lg:p-6 pb-24 lg:pb-6">
          <Outlet />
        </div>

        {/* Mobile bottom nav */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-sidebar text-sidebar-foreground border-t border-sidebar-border shadow-[0_-4px_12px_-4px_rgb(0_0_0_/_0.15)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="grid grid-cols-5">
            {visibleBottom.slice(0, 4).map((n) => {
              const active = isActive(n.to);
              const isNew = n.to === "/quotations/new";
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] min-h-[56px] transition ${
                    active ? "text-white" : "text-white/70"
                  }`}
                >
                  {isNew ? (
                    <div className="size-9 -mt-1 rounded-full gradient-brand shadow-elegant flex items-center justify-center">
                      <n.icon className="size-5 text-white" />
                    </div>
                  ) : (
                    <n.icon className={`size-5 ${active ? "text-primary-glow" : ""}`} />
                  )}
                  <span className="truncate max-w-full px-1">{n.label}</span>
                </Link>
              );
            })}
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] min-h-[56px] text-white/70"
              aria-label="المزيد"
            >
              <Menu className="size-5" />
              <span>المزيد</span>
            </button>
          </div>
        </nav>
      </main>
    </div>
  );
}

function navItemCls(active: boolean) {
  return `flex items-center gap-3 rounded-lg px-3 py-3 text-sm min-h-[44px] transition ${
    active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/60"
  }`;
}
