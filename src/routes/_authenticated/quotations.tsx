import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText, Eye, ShieldAlert, Clock, X } from "lucide-react";
import { currency, dateAr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/quotations")({
  head: () => ({ meta: [{ title: "عروض الأسعار — Elsewedy Smart Quotation" }] }),
  component: QuotationsPage,
});

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "مسودة", variant: "outline" },
  pending_approval: { label: "بانتظار الاعتماد", variant: "secondary" },
  approved: { label: "معتمد", variant: "default" },
  sent: { label: "تم الإرسال", variant: "default" },
  accepted: { label: "مقبول", variant: "default" },
  rejected: { label: "مرفوض", variant: "destructive" },
  converted: { label: "أمر تشغيل", variant: "default" },
};

const CATEGORY_LABELS: Record<string, string> = {
  digital: "طباعة ديجيتال",
  offset: "طباعة أوفست",
  folding_cartons: "علب مطوية",
  paper_packaging: "تغليف ورقي",
  labels: "ملصقات",
  pharma: "علب أدوية",
  cosmetics: "تجميل",
  food: "أغذية",
  marketing: "مطبوعات تسويقية",
  finishing_only: "تشطيبات فقط",
  custom: "مخصص",
};

function QuotationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [rep, setRep] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [minValue, setMinValue] = useState<string>("");
  const [maxValue, setMaxValue] = useState<string>("");
  const [needsApproval, setNeedsApproval] = useState(false);
  const [expiringSoon, setExpiringSoon] = useState(false);

  const { data: quotations = [] } = useQuery({
    queryKey: ["quotations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quotations")
        .select("*, customers(company_name), profiles:sales_rep_id(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const reps = useMemo(() => {
    const map = new Map<string, string>();
    quotations.forEach((q: any) => {
      if (q.sales_rep_id && q.profiles?.full_name) map.set(q.sales_rep_id, q.profiles.full_name);
    });
    return Array.from(map.entries());
  }, [quotations]);

  const filtered = useMemo(() => quotations.filter((q: any) => {
    const s = search.toLowerCase();
    if (s && ![q.quotation_number, q.customers?.company_name, q.profiles?.full_name].some((f: any) => f?.toLowerCase().includes(s))) return false;
    if (status !== "all" && q.status !== status) return false;
    if (category !== "all" && q.product_category !== category) return false;
    if (rep !== "all" && q.sales_rep_id !== rep) return false;
    if (dateFrom && new Date(q.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(q.created_at) > new Date(new Date(dateTo).getTime() + 86400000)) return false;
    if (minValue && Number(q.final_price) < Number(minValue)) return false;
    if (maxValue && Number(q.final_price) > Number(maxValue)) return false;
    if (needsApproval && q.status !== "pending_approval") return false;
    if (expiringSoon) {
      const validity = q.validity_days ?? 30;
      const created = new Date(q.created_at);
      const expiryDate = new Date(created.getTime() + validity * 86400000);
      const daysLeft = (expiryDate.getTime() - Date.now()) / 86400000;
      if (!(daysLeft > 0 && daysLeft <= 7)) return false;
    }
    return true;
  }), [quotations, search, status, category, rep, dateFrom, dateTo, minValue, maxValue, needsApproval, expiringSoon]);

  const activeFilters =
    (status !== "all") ||
    (category !== "all") ||
    (rep !== "all") ||
    !!dateFrom || !!dateTo || !!minValue || !!maxValue || needsApproval || expiringSoon;

  const resetFilters = () => {
    setStatus("all"); setCategory("all"); setRep("all");
    setDateFrom(""); setDateTo(""); setMinValue(""); setMaxValue("");
    setNeedsApproval(false); setExpiringSoon(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">عروض الأسعار</h1>
          <p className="text-sm text-muted-foreground">جميع عروض الأسعار المُعدّة في النظام</p>
        </div>
        <Button asChild className="gradient-primary"><Link to="/quotations/new"><Plus className="size-4 ms-1" /> عرض سعر جديد</Link></Button>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="بحث برقم العرض، العميل، المندوب..." className="pe-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="text-sm text-muted-foreground me-auto">{filtered.length} من {quotations.length}</div>
            {activeFilters && (
              <Button size="sm" variant="ghost" onClick={resetFilters}><X className="size-4 ms-1" /> مسح الفلاتر</Button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">كل الحالات</option>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">كل الفئات</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={rep} onChange={(e) => setRep(e.target.value)}>
              <option value="all">كل المندوبين</option>
              {reps.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <div className="flex gap-2">
              <Input type="number" placeholder="قيمة أدنى" className="h-9" value={minValue} onChange={(e) => setMinValue(e.target.value)} />
              <Input type="number" placeholder="قيمة أعلى" className="h-9" value={maxValue} onChange={(e) => setMaxValue(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Input type="date" className="h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" className="h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm rounded-md border h-9 px-3 cursor-pointer hover:bg-muted/50">
              <input type="checkbox" checked={needsApproval} onChange={(e) => setNeedsApproval(e.target.checked)} />
              <ShieldAlert className="size-4 text-warning-foreground" /> تحتاج اعتماد
            </label>
            <label className="flex items-center gap-2 text-sm rounded-md border h-9 px-3 cursor-pointer hover:bg-muted/50">
              <input type="checkbox" checked={expiringSoon} onChange={(e) => setExpiringSoon(e.target.checked)} />
              <Clock className="size-4 text-warning-foreground" /> قاربت الصلاحية
            </label>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم العرض</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>المندوب</TableHead>
                <TableHead>القيمة النهائية</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12">
                  <FileText className="size-10 mx-auto text-muted-foreground/50" />
                  <div className="mt-3 text-muted-foreground">
                    {quotations.length === 0 ? "لم يتم إنشاء أي عرض سعر بعد" : "لا توجد نتائج مطابقة للفلاتر"}
                  </div>
                  {quotations.length === 0 && <Button asChild className="mt-4"><Link to="/quotations/new">إنشاء أول عرض سعر</Link></Button>}
                </TableCell></TableRow>
              ) : filtered.map((q: any) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-sm font-semibold">{q.quotation_number}</TableCell>
                  <TableCell>{q.customers?.company_name ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{CATEGORY_LABELS[q.product_category] ?? q.product_category ?? "—"}</Badge></TableCell>
                  <TableCell className="text-sm">{q.profiles?.full_name ?? "—"}</TableCell>
                  <TableCell className="font-semibold text-primary">{currency(q.final_price)}</TableCell>
                  <TableCell><Badge variant={STATUS_META[q.status]?.variant ?? "outline"}>{STATUS_META[q.status]?.label ?? q.status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{dateAr(q.created_at)}</TableCell>
                  <TableCell><Button size="sm" variant="outline" asChild><Link to="/quotations/$id" params={{ id: q.id }}><Eye className="size-4" /></Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
