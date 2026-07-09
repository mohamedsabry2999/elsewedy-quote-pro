import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { currency, number, percent } from "@/lib/format";
import { FileText, CheckCircle2, Clock, XCircle, TrendingUp, DollarSign, Users, Award } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { canSeeCosts } from "@/lib/roles";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "لوحة التحكم — Elsewedy Smart Quotation" }] }),
  component: Dashboard,
});

const CATEGORY_LABELS: Record<string, string> = {
  digital: "طباعة ديجيتال",
  offset: "طباعة أوفست",
  folding_cartons: "علب مطوية",
  paper_packaging: "تغليف ورقي",
  labels: "ملصقات و ستيكرز",
  pharma: "علب أدوية",
  cosmetics: "مستحضرات تجميل",
  food: "تغليف مواد غذائية",
  marketing: "مطبوعات تسويقية",
  custom: "منتج مخصص",
};

function Dashboard() {
  const auth = useAuth();
  const showCosts = canSeeCosts(auth.roles);

  const { data: quotations = [] } = useQuery({
    queryKey: ["quotations-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quotations").select("*, customers(company_name), profiles:sales_rep_id(full_name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = quotations.length;
  const accepted = quotations.filter((q) => q.status === "accepted" || q.status === "converted").length;
  const pending = quotations.filter((q) => q.status === "pending_approval" || q.status === "draft" || q.status === "sent" || q.status === "approved").length;
  const rejected = quotations.filter((q) => q.status === "rejected").length;
  const totalValue = quotations.reduce((s, q) => s + Number(q.final_price ?? 0), 0);
  const conversionRate = total ? (accepted / total) * 100 : 0;
  const avgMargin = quotations.length ? quotations.reduce((s, q) => s + Number(q.profit_margin_pct ?? 0), 0) / quotations.length : 0;

  // Top customers
  const custMap = new Map<string, { name: string; value: number; count: number }>();
  quotations.forEach((q) => {
    const name = (q as any).customers?.company_name ?? "—";
    const key = q.customer_id ?? name;
    const cur = custMap.get(key) ?? { name, value: 0, count: 0 };
    cur.value += Number(q.final_price ?? 0);
    cur.count += 1;
    custMap.set(key, cur);
  });
  const topCustomers = Array.from(custMap.values()).sort((a, b) => b.value - a.value).slice(0, 5);

  // Top reps
  const repMap = new Map<string, { name: string; count: number; value: number }>();
  quotations.forEach((q) => {
    const name = (q as any).profiles?.full_name ?? "—";
    const key = q.sales_rep_id ?? name;
    const cur = repMap.get(key) ?? { name, count: 0, value: 0 };
    cur.count += 1;
    cur.value += Number(q.final_price ?? 0);
    repMap.set(key, cur);
  });
  const topReps = Array.from(repMap.values()).sort((a, b) => b.value - a.value).slice(0, 5);

  // Category demand
  const catMap = new Map<string, number>();
  quotations.forEach((q) => {
    const k = q.product_category ?? "other";
    catMap.set(k, (catMap.get(k) ?? 0) + 1);
  });
  const catData = Array.from(catMap.entries()).map(([k, v]) => ({ name: CATEGORY_LABELS[k] ?? k, count: v }));

  const statusData = [
    { name: "مقبول", value: accepted, fill: "var(--color-chart-3)" },
    { name: "قيد المتابعة", value: pending, fill: "var(--color-chart-1)" },
    { name: "مرفوض", value: rejected, fill: "var(--color-chart-4)" },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">لوحة التحكم</h1>
          <p className="text-sm text-muted-foreground">نظرة عامة على أداء المبيعات وعروض الأسعار</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="إجمالي عروض الأسعار" value={number(total)} tone="primary" />
        <StatCard icon={CheckCircle2} label="مقبولة" value={number(accepted)} tone="success" />
        <StatCard icon={Clock} label="قيد المتابعة" value={number(pending)} tone="warning" />
        <StatCard icon={XCircle} label="مرفوضة" value={number(rejected)} tone="destructive" />
        <StatCard icon={DollarSign} label="إجمالي القيمة" value={currency(totalValue)} tone="gold" />
        <StatCard icon={TrendingUp} label="نسبة التحويل" value={percent(conversionRate)} tone="success" />
        {showCosts && <StatCard icon={Award} label="متوسط هامش الربح" value={percent(avgMargin)} tone="primary" />}
        <StatCard icon={Users} label="عدد العملاء" value={number(custMap.size)} tone="primary" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>الطلب حسب فئة المنتج</CardTitle></CardHeader>
          <CardContent className="h-72">
            {catData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ direction: "rtl", fontFamily: "Cairo" }} />
                  <Bar dataKey="count" fill="var(--color-chart-1)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>حالة العروض</CardTitle></CardHeader>
          <CardContent className="h-72">
            {statusData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={4}>
                    {statusData.map((s, i) => <Cell key={i} fill={s.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ direction: "rtl", fontFamily: "Cairo" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>أكبر العملاء</CardTitle></CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? <Empty /> : (
              <ul className="space-y-3">
                {topCustomers.map((c, i) => (
                  <li key={i} className="flex items-center justify-between border-b last:border-0 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="size-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="font-medium">{c.name}</span>
                      <Badge variant="secondary">{c.count} عرض</Badge>
                    </div>
                    <span className="text-sm font-semibold text-primary">{currency(c.value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>أفضل مندوبي المبيعات</CardTitle></CardHeader>
          <CardContent>
            {topReps.length === 0 ? <Empty /> : (
              <ul className="space-y-3">
                {topReps.map((r, i) => (
                  <li key={i} className="flex items-center justify-between border-b last:border-0 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="size-7 rounded-full gradient-gold text-gold-foreground text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="font-medium">{r.name}</span>
                      <Badge variant="secondary">{r.count} عرض</Badge>
                    </div>
                    <span className="text-sm font-semibold">{currency(r.value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Empty() {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات بعد — ابدأ بإنشاء أول عرض سعر.</div>;
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "primary" | "success" | "warning" | "destructive" | "gold" }) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/10 text-destructive",
    gold: "bg-gold/20 text-gold-foreground",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`size-10 rounded-lg flex items-center justify-center ${tones[tone]}`}><Icon className="size-5" /></div>
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-lg font-bold">{value}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
