import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { canManagePricing } from "@/lib/roles";
import { Plus, Save, Trash2, Scissors, Upload } from "lucide-react";
import { SmartImportModal } from "@/components/SmartImportModal";

export const Route = createFileRoute("/_authenticated/finishing")({
  head: () => ({ meta: [{ title: "خدمات التشطيبات — Elsewedy Smart Quotation" }] }),
  component: FinishingPage,
});

function FinishingPage() {
  const auth = useAuth();
  const qc = useQueryClient();
  const canEdit = canManagePricing(auth.roles);
  const [edits, setEdits] = useState<Record<string, { label_ar?: string; value?: number; unit?: string }>>({});
  const [nk, setNk] = useState({ key: "", label_ar: "", value: 0, unit: "فرخ" });
  const [importOpen, setImportOpen] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["finishing-rules"],
    queryFn: async () => (await supabase.from("pricing_rules").select("*").eq("category", "finishing").order("key")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      for (const [id, patch] of Object.entries(edits)) {
        const { error } = await supabase.from("pricing_rules").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("تم الحفظ"); setEdits({}); qc.invalidateQueries({ queryKey: ["finishing-rules"] }); qc.invalidateQueries({ queryKey: ["pricing-rules"] }); qc.invalidateQueries({ queryKey: ["pricing-rules-admin"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!nk.key || !nk.label_ar) throw new Error("أدخل المعرف والوصف");
      const { error } = await supabase.from("pricing_rules").insert({ category: "finishing", ...nk });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تمت الإضافة"); setNk({ key: "", label_ar: "", value: 0, unit: "فرخ" }); qc.invalidateQueries({ queryKey: ["finishing-rules"] }); qc.invalidateQueries({ queryKey: ["pricing-rules"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("pricing_rules").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["finishing-rules"] }); qc.invalidateQueries({ queryKey: ["pricing-rules"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const patch = (id: string, k: string, v: any) => setEdits({ ...edits, [id]: { ...edits[id], [k]: v } });

  if (!canEdit) return <div className="text-center py-16 text-muted-foreground">هذه الصفحة متاحة لمسؤول النظام فقط.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Scissors className="size-6 text-gold" /> إدارة خدمات التشطيبات</h1>
          <p className="text-sm text-muted-foreground">تحكم كامل في أنواع التشطيبات وأسعار كل خدمة</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="size-4 ms-1" /> رفع بيانات</Button>
          <Button onClick={() => save.mutate()} disabled={!Object.keys(edits).length || save.isPending} className="gradient-primary">
            <Save className="size-4 ms-1" /> حفظ التعديلات ({Object.keys(edits).length})
          </Button>
        </div>
      </div>

      <SmartImportModal open={importOpen} onOpenChange={setImportOpen} module="finishing"
        onComplete={() => { qc.invalidateQueries({ queryKey: ["finishing-rules"] }); qc.invalidateQueries({ queryKey: ["pricing-rules"] }); }} />

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="size-4" /> إضافة تشطيب جديد</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1"><Label>المعرف</Label><Input placeholder="matte_lam" value={nk.key} onChange={(e) => setNk({ ...nk, key: e.target.value.trim().toLowerCase().replace(/\s+/g, "_") })} /></div>
            <div className="space-y-1"><Label>الوصف بالعربي</Label><Input placeholder="سلوفان مطفي" value={nk.label_ar} onChange={(e) => setNk({ ...nk, label_ar: e.target.value })} /></div>
            <div className="space-y-1"><Label>السعر</Label><Input type="number" step="0.01" value={nk.value} onChange={(e) => setNk({ ...nk, value: +e.target.value })} /></div>
            <div className="space-y-1"><Label>الوحدة</Label><Input value={nk.unit} onChange={(e) => setNk({ ...nk, unit: e.target.value })} /></div>
          </div>
          <div className="flex justify-end mt-3">
            <Button onClick={() => add.mutate()} disabled={add.isPending}><Plus className="size-4 ms-1" /> إضافة</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">قائمة التشطيبات</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>الوصف</TableHead>
              <TableHead>المعرف</TableHead>
              <TableHead>السعر</TableHead>
              <TableHead>الوحدة</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell><Input defaultValue={r.label_ar} onChange={(e) => patch(r.id, "label_ar", e.target.value)} /></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.key}</TableCell>
                  <TableCell><Input type="number" step="0.01" className="w-28" defaultValue={r.value} onChange={(e) => patch(r.id, "value", +e.target.value)} /></TableCell>
                  <TableCell><Input className="w-28" defaultValue={r.unit ?? ""} onChange={(e) => patch(r.id, "unit", e.target.value)} /></TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => confirm(`حذف ${r.label_ar}?`) && del.mutate(r.id)}><Trash2 className="size-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد تشطيبات — أضف الأولى بالأعلى.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
