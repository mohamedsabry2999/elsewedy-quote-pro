import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { canManagePricing } from "@/lib/roles";
import { Save, DollarSign, Upload } from "lucide-react";
import { SmartImportModal } from "@/components/SmartImportModal";

export const Route = createFileRoute("/_authenticated/pricing")({
  head: () => ({ meta: [{ title: "قواعد التسعير — Elsewedy Smart Quotation" }] }),
  component: PricingPage,
});

const CAT_LABEL: Record<string, string> = {
  paper: "أسعار الورق",
  printing: "تكاليف الطباعة والزنك",
  ink: "الأحبار الخاصة",
  finishing: "التشطيبات",
  waste: "نسب الهالك",
  margin: "هوامش الربح",
  discount: "حدود الخصم",
  delivery: "التوصيل",
  order: "الحد الأدنى للطلب",
};

function PricingPage() {
  const auth = useAuth();
  const qc = useQueryClient();
  const canEdit = canManagePricing(auth.roles);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [importOpen, setImportOpen] = useState(false);

  const { data: rules = [] } = useQuery({
    queryKey: ["pricing-rules-admin"],
    queryFn: async () => (await supabase.from("pricing_rules").select("*").order("category").order("key")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(edits);
      for (const [id, value] of updates) {
        const { error } = await supabase.from("pricing_rules").update({ value, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("تم حفظ التعديلات"); setEdits({}); qc.invalidateQueries({ queryKey: ["pricing-rules-admin"] }); qc.invalidateQueries({ queryKey: ["pricing-rules"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const grouped = rules.reduce<Record<string, any[]>>((acc, r: any) => {
    (acc[r.category] ??= []).push(r); return acc;
  }, {});

  if (!canEdit) {
    return <div className="text-center py-16 text-muted-foreground">هذه الصفحة متاحة لمسؤول النظام فقط.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="size-6 text-gold" /> قواعد التسعير</h1>
          <p className="text-sm text-muted-foreground">تحكم كامل في أسعار الورق، الطباعة، التشطيبات، الهوامش، والخصومات</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="size-4 ms-1" /> رفع بيانات</Button>
          <Button onClick={() => save.mutate()} disabled={Object.keys(edits).length === 0 || save.isPending} className="gradient-primary">
            <Save className="size-4 ms-1" /> حفظ التعديلات ({Object.keys(edits).length})
          </Button>
        </div>
      </div>

      <SmartImportModal open={importOpen} onOpenChange={setImportOpen} module="pricing_rules"
        onComplete={() => { qc.invalidateQueries({ queryKey: ["pricing-rules-admin"] }); qc.invalidateQueries({ queryKey: ["pricing-rules"] }); }} />

      {Object.entries(grouped).map(([cat, items]) => (
        <Card key={cat}>
          <CardHeader><CardTitle>{CAT_LABEL[cat] ?? cat}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>الوصف</TableHead>
                <TableHead>المعرف</TableHead>
                <TableHead>القيمة</TableHead>
                <TableHead>الوحدة</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {items.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.label_ar}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.key}</TableCell>
                    <TableCell><Input type="number" step="0.01" className="w-32" defaultValue={r.value} onChange={(e) => setEdits({ ...edits, [r.id]: +e.target.value })} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
