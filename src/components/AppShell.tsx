import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, FileText, Settings, LogOut, Printer, Plus, DollarSign, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS, canManagePricing } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const nav = [
  { to: "/dashboard", icon: LayoutDashboard, label: "لوحة التحكم" },
  { to: "/quotations", icon: FileText, label: "عروض الأسعار" },
  { to: "/customers", icon: Users, label: "العملاء" },
] as const;

export function AppShell() {
  const { pathname } = useRouterState({ select: (s) => s.location });
  const auth = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen flex bg-muted/30">
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-5 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="size-10 rounded-lg gradient-gold flex items-center justify-center">
              <Printer className="size-5 text-gold-foreground" />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">Elsewedy</div>
              <div className="text-xs opacity-70">Smart Quotation</div>
            </div>
          </Link>
        </div>

        <div className="p-3">
          <Button asChild className="w-full gradient-gold text-gold-foreground hover:opacity-90 border-0">
            <Link to="/quotations/new"><Plus className="size-4 ms-1" /> عرض سعر جديد</Link>
          </Button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50"
                }`}>
                <n.icon className="size-4" /> {n.label}
              </Link>
            );
          })}
          {canManagePricing(auth.roles) && (
            <>
              <div className="pt-4 pb-1 px-3 text-[11px] uppercase tracking-wider opacity-60">الإدارة</div>
              <Link to="/pricing" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${pathname.startsWith("/pricing") ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50"}`}>
                <DollarSign className="size-4" /> قواعد التسعير
              </Link>
              <Link to="/settings" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${pathname.startsWith("/settings") ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50"}`}>
                <Settings className="size-4" /> إعدادات الشركة
              </Link>
            </>
          )}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="rounded-lg bg-sidebar-accent/40 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <div className="size-8 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center text-xs font-bold">
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

      <main className="flex-1 min-w-0">
        <div className="h-14 bg-card border-b flex items-center gap-3 px-6">
          <Sparkles className="size-4 text-gold" />
          <div className="text-sm text-muted-foreground">
            مرحباً <span className="font-medium text-foreground">{auth.fullName}</span> — نظام عروض الأسعار الذكي
          </div>
        </div>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
