import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileSpreadsheet, Download, RotateCcw, AlertTriangle, Eye } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { canManagePricing } from "@/lib/roles";
import { dateAr } from "@/lib/format";
import { downloadErrorReport, type RowError } from "@/lib/importer";

export const Route = createFileRoute("/_authenticated/import-history")({
  head: () => ({ meta: [{ title: "سجل رفع البيانات — Elsewedy Smart Quotation" }] }),
  component: ImportHistoryPage,
});

const MODULE_LABEL: Record<string, string> = {
  customers: "العملاء",
  quotations: "عروض الأسعار",
  quotation_items: "بنود العروض",
  pricing_rules: "قواعد التسعير",
  finishing: "التشطيبات",
  job_orders: "أوامر التشغيل",
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "قيد الانتظار", className: "bg-muted" },
  processing: { label: "قيد المعالجة", className: "bg-warning/20 text-warning-foreground" },
  completed: { label: "مكتمل", className: "bg-success text-success-foreground" },
  completed_with_errors: { label: "مكتمل مع أخطاء", className: "bg-warning text-warning-foreground" },
  rolled_back: { label: "تم التراجع", className: "bg-destructive/20 text-destructive" },
};

function ImportHistoryPage() {
  const auth = useAuth();
  const qc = useQueryClient();
  const isAdmin = canManagePricing(auth.roles);
  const [inspect, setInspect] = useState<any | null>(null);

  const { data: batches = [] } = useQuery({
    queryKey: ["import-batches"],
    queryFn: async () => (await supabase.from("import_batches").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const rollback = useMutation({
    mutationFn: async (batchId: string) => {
      const batch = batches.find((b: any) => b.id === batchId);
      if (!batch) throw new Error("Batch not found");
      const table = batch.target_module === "finishing" ? "pricing_rules" : batch.target_module;
      const { error } = await supabase.from(table as any).delete().eq("import_batch_id", batchId);
      if (error) throw error;
      await supabase.from("import_batches").update({
        is_rolled_back: true,
        rolled_back_at: new Date().toISOString(),
        rolled_back_by: auth.userId,
        status: "rolled_back",
      }).eq("id", batchId);
    },
    onSuccess: () => { toast.success("تم التراجع عن الاستيراد"); qc.invalidateQueries({ queryKey: ["import-batches"] }); },
    onError: (e: any) => toast.error(e.message ?? "فشل التراجع"),
  });

  const downloadErrors = async (batchId: string) => {
    const { data } = await supabase.from("import_errors").select("*").eq("import_batch_id", batchId).order("row_number");
    if (!data?.length) return toast.info("لا توجد أخطاء لهذه العملية");
    const errors: RowError[] = data.map((e: any) => ({
      row: e.row_number, field: e.field_name ?? undefined, message: e.error_message, rawData: e.raw_row_data ?? {},
    }));
    downloadErrorReport(errors, `errors_${batchId}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileSpreadsheet className="size-6 text-primary" /> سجل رفع البيانات</h1>
        <p className="text-sm text-muted-foreground">جميع عمليات الاستيراد التي تمت على النظام مع إمكانية التراجع.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{batches.length} عملية استيراد</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>الملف</TableHead>
              <TableHead>الوحدة</TableHead>
              <TableHead>بواسطة</TableHead>
              <TableHead>الصفوف</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead className="text-left">إجراءات</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {batches.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  لم يتم رفع أي بيانات بعد.
                </TableCell></TableRow>
              ) : batches.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.file_name}</TableCell>
                  <TableCell><Badge variant="outline">{MODULE_LABEL[b.target_module] ?? b.target_module}</Badge></TableCell>
                  <TableCell className="text-sm">{b.uploaded_by_name ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    <span className="text-success font-semibold">{b.success_rows}</span> نجاح
                    {b.failed_rows > 0 && <> · <span className="text-destructive">{b.failed_rows}</span> فشل</>}
                    {" "}<span className="text-muted-foreground">/ {b.total_rows}</span>
                  </TableCell>
                  <TableCell><Badge className={STATUS_META[b.status]?.className}>{STATUS_META[b.status]?.label ?? b.status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{dateAr(b.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setInspect(b)}><Eye className="size-4" /></Button>
                      {b.failed_rows > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => downloadErrors(b.id)}><Download className="size-4" /></Button>
                      )}
                      {isAdmin && !b.is_rolled_back && b.success_rows > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => {
                          if (confirm(`سيتم حذف ${b.success_rows} سجل تم إنشاؤه في هذه العملية. متابعة؟`))
                            rollback.mutate(b.id);
                        }}><RotateCcw className="size-4 text-destructive" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!inspect} onOpenChange={(o) => !o && setInspect(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{inspect?.file_name}</DialogTitle>
            <DialogDescription>تفاصيل عملية الاستيراد</DialogDescription>
          </DialogHeader>
          {inspect && (
            <div className="space-y-2 text-sm">
              <div><b>الوحدة:</b> {MODULE_LABEL[inspect.target_module] ?? inspect.target_module}</div>
              <div><b>بواسطة:</b> {inspect.uploaded_by_name ?? "—"}</div>
              <div><b>التاريخ:</b> {dateAr(inspect.created_at)}</div>
              <div><b>الإجمالي:</b> {inspect.total_rows} صف — نجاح {inspect.success_rows} — فشل {inspect.failed_rows}</div>
              <div className="pt-2 border-t"><b>ربط الأعمدة:</b></div>
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-48">{JSON.stringify(inspect.mapping, null, 2)}</pre>
              <div><b>خيارات:</b></div>
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(inspect.options, null, 2)}</pre>
              {inspect.is_rolled_back && (
                <div className="rounded-lg bg-destructive/10 border border-destructive p-2 text-destructive text-xs">
                  <AlertTriangle className="size-3 inline ms-1" /> تم التراجع عن هذه العملية
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInspect(null)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
