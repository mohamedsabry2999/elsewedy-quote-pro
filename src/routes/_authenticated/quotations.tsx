import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText, Eye } from "lucide-react";
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
  custom: "مخصص",
};

function QuotationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");

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

  const filtered = quotations.filter((q: any) => {
    const s = search.toLowerCase();
    const matchSearch = !s || [q.quotation_number, q.customers?.company_name, q.profiles?.full_name].some((f) => f?.toLowerCase().includes(s));
    const matchStatus = status === "all" || q.status === status;
    return matchSearch && matchStatus;
  });

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
        <CardHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="بحث برقم العرض، العميل، المندوب..." className="pe-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">كل الحالات</option>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div className="text-sm text-muted-foreground me-auto">{filtered.length} عرض</div>
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
                  <div className="mt-3 text-muted-foreground">لم يتم إنشاء أي عرض سعر بعد</div>
                  <Button asChild className="mt-4"><Link to="/quotations/new">إنشاء أول عرض سعر</Link></Button>
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
