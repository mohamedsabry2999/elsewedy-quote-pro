import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Factory, Search, Eye, Pencil, Upload } from "lucide-react";
import { SmartImportModal } from "@/components/SmartImportModal";
import { currency, dateAr } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/job-orders")({
  head: () => ({ meta: [{ title: "أوامر التشغيل — Elsewedy" }] }),
  component: JobOrdersPage,
});

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  pending: { label: "بانتظار البدء", variant: "outline" },
  in_production: { label: "قيد التنفيذ", variant: "secondary" },
  completed: { label: "مكتمل", variant: "default", className: "bg-success text-success-foreground" },
  delivered: { label: "تم التسليم", variant: "default", className: "bg-primary" },
  cancelled: { label: "ملغي", variant: "destructive" },
};

function JobOrdersPage() {
  const qc = useQueryClient();
  const auth = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [importOpen, setImportOpen] = useState(false);

  const { data: jobOrders = [], isLoading } = useQuery({
    queryKey: ["job-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_orders")
        .select("*, quotations(id, quotation_number, final_price, customers(company_name), product_category)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => jobOrders.filter((j: any) => {
    const s = search.toLowerCase();
    const matchSearch = !s ||
      [j.job_order_number, j.quotations?.quotation_number, j.quotations?.customers?.company_name]
        .some((f) => f?.toLowerCase().includes(s));
    const matchStatus = statusFilter === "all" || j.production_status === statusFilter;
    return matchSearch && matchStatus;
  }), [jobOrders, search, statusFilter]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("job_orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["job-orders"] }); toast.success("تم تحديث أمر التشغيل"); },
    onError: (e: any) => toast.error(e.message),
  });

  const canManage = auth.roles.some((r) => r === "admin" || r === "sales_manager");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">أوامر التشغيل</h1>
          <p className="text-sm text-muted-foreground">متابعة الإنتاج من العرض المقبول حتى التسليم</p>
        </div>
        {canManage && (
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="size-4 ms-1" /> رفع بيانات</Button>
        )}
      </div>

      <SmartImportModal open={importOpen} onOpenChange={setImportOpen} module="job_orders"
        onComplete={() => qc.invalidateQueries({ queryKey: ["job-orders"] })} />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="بحث برقم الأمر، العرض، أو العميل..." className="pe-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">كل الحالات</option>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div className="text-sm text-muted-foreground me-auto">{filtered.length} أمر تشغيل</div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم أمر التشغيل</TableHead>
                <TableHead>رقم العرض</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>قيمة العرض</TableHead>
                <TableHead>حالة الإنتاج</TableHead>
                <TableHead>تاريخ التسليم</TableHead>
                <TableHead>تاريخ الإنشاء</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">جارِ التحميل...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12">
                  <Factory className="size-10 mx-auto text-muted-foreground/50" />
                  <div className="mt-3 text-muted-foreground">لا توجد أوامر تشغيل بعد</div>
                  <div className="text-xs text-muted-foreground mt-1">حوّل عرض سعر مقبول إلى أمر تشغيل من صفحة العرض.</div>
                </TableCell></TableRow>
              ) : filtered.map((j: any) => (
                <TableRow key={j.id}>
                  <TableCell className="font-mono font-semibold">{j.job_order_number}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {j.quotations?.id ? (
                      <Link to="/quotations/$id" params={{ id: j.quotations.id }} className="text-primary hover:underline">
                        {j.quotations.quotation_number}
                      </Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{j.quotations?.customers?.company_name ?? "—"}</TableCell>
                  <TableCell className="font-semibold text-primary">{currency(j.quotations?.final_price)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_META[j.production_status]?.variant} className={STATUS_META[j.production_status]?.className}>
                      {STATUS_META[j.production_status]?.label ?? j.production_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{j.due_date ? dateAr(j.due_date) : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{dateAr(j.created_at)}</TableCell>
                  <TableCell className="flex gap-1">
                    {j.quotations?.id && (
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/quotations/$id" params={{ id: j.quotations.id }}><Eye className="size-4" /></Link>
                      </Button>
                    )}
                    {canManage && <EditJobOrderDialog jo={j} onSave={(patch) => updateStatus.mutate({ id: j.id, patch })} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function EditJobOrderDialog({ jo, onSave }: { jo: any; onSave: (patch: any) => void }) {
  const [status, setStatus] = useState<string>(jo.production_status);
  const [dueDate, setDueDate] = useState<string>(jo.due_date ?? "");
  const [notes, setNotes] = useState<string>(jo.production_notes ?? "");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Pencil className="size-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل أمر التشغيل {jo.job_order_number}</DialogTitle>
          <DialogDescription>حدّث حالة الإنتاج وموعد التسليم والملاحظات.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>حالة الإنتاج</Label>
            <select className="w-full h-10 rounded-md border bg-transparent px-3" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>تاريخ التسليم المستهدف</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>ملاحظات الإنتاج</Label>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onSave({ production_status: status, due_date: dueDate || null, production_notes: notes })}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
