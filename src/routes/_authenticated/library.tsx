import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Library as LibraryIcon, Search, Package, Weight, Ruler, Scissors, Boxes } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({ meta: [{ title: "مكتبة الخامات والمنتجات — Elsewedy Smart Quotation" }] }),
  component: LibraryPage,
});

type Material = { id: string; name_ar: string; name_en: string | null; code: string | null; material_type: string | null; description: string | null; is_active: boolean; internal_notes: string | null };
type Weight = { id: string; gsm: number; display_name: string; is_active: boolean };
type Size = { id: string; name: string; width: number | null; height: number | null; unit: string; size_type: string | null; is_active: boolean };
type Finishing = { id: string; name_ar: string; technical_name: string | null; description: string | null; affects_price: boolean; is_active: boolean };
type Product = {
  id: string; name_ar: string; name_en: string | null; category: string | null; default_description: string | null;
  suggested_material_id: string | null; suggested_weight_id: string | null; suggested_size_id: string | null;
  suggested_printing_method: string | null; suggested_finishings: string[]; customer_notes: string | null; internal_notes: string | null; is_active: boolean;
};

function LibraryPage() {
  const auth = useAuth();
  const canManage = auth.can("manage_material_library");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LibraryIcon className="size-6 text-primary" /> مكتبة الخامات والمنتجات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">مكتبة مرجعية للسيلز — يمكن الاختيار منها أو الإدخال اليدوي دائمًا</p>
        </div>
        {!canManage && <Badge variant="outline">للعرض فقط — لا تملك صلاحية الإدارة</Badge>}
      </div>

      <Tabs defaultValue="materials" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="materials"><Package className="size-4 ms-1" /> الخامات</TabsTrigger>
          <TabsTrigger value="weights"><Weight className="size-4 ms-1" /> الأوزان</TabsTrigger>
          <TabsTrigger value="products"><Boxes className="size-4 ms-1" /> المنتجات</TabsTrigger>
          <TabsTrigger value="sizes"><Ruler className="size-4 ms-1" /> المقاسات</TabsTrigger>
          <TabsTrigger value="finishings"><Scissors className="size-4 ms-1" /> التشطيبات</TabsTrigger>
        </TabsList>

        <TabsContent value="materials"><MaterialsTab canManage={canManage} /></TabsContent>
        <TabsContent value="weights"><WeightsTab canManage={canManage} /></TabsContent>
        <TabsContent value="products"><ProductsTab canManage={canManage} /></TabsContent>
        <TabsContent value="sizes"><SizesTab canManage={canManage} /></TabsContent>
        <TabsContent value="finishings"><FinishingsTab canManage={canManage} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== Materials ====================
function MaterialsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Material> | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["library-materials"],
    queryFn: async () => ((await supabase.from("paper_materials").select("*").order("name_ar")).data ?? []) as Material[],
  });

  const filtered = data.filter((m) =>
    !search || m.name_ar.toLowerCase().includes(search.toLowerCase()) || (m.name_en ?? "").toLowerCase().includes(search.toLowerCase()) || (m.code ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const save = useMutation({
    mutationFn: async (row: Partial<Material>) => {
      const payload = { name_ar: row.name_ar!, name_en: row.name_en ?? null, code: row.code ?? null, material_type: row.material_type ?? null, description: row.description ?? null, internal_notes: row.internal_notes ?? null, is_active: row.is_active ?? true };
      if (row.id) {
        const { error } = await supabase.from("paper_materials").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("paper_materials").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["library-materials"] }); setEditing(null); },
    onError: (e: any) => toast.error("تعذر الحفظ", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("paper_materials").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["library-materials"] }); },
    onError: (e: any) => toast.error("تعذر الحذف", { description: e.message }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">خامات الورق ({data.length})</CardTitle>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="بحث…" value={search} onChange={(e) => setSearch(e.target.value)} className="pe-9 w-64" />
          </div>
          {canManage && <Button onClick={() => setEditing({ is_active: true })} className="gradient-brand text-white border-0"><Plus className="size-4 ms-1" /> خامة جديدة</Button>}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">الاسم بالعربي</TableHead>
              <TableHead className="text-right">الإنجليزي</TableHead>
              <TableHead className="text-right">الكود</TableHead>
              <TableHead className="text-right">النوع</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              {canManage && <TableHead className="text-right w-24">إجراءات</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={canManage ? 6 : 5} className="text-center text-muted-foreground py-8">لا توجد نتائج</TableCell></TableRow>}
            {filtered.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name_ar}</TableCell>
                <TableCell className="text-muted-foreground">{m.name_en ?? "—"}</TableCell>
                <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{m.code ?? "—"}</code></TableCell>
                <TableCell>{m.material_type ?? "—"}</TableCell>
                <TableCell>{m.is_active ? <Badge className="bg-success/15 text-success border-success/30">نشطة</Badge> : <Badge variant="outline">موقوفة</Badge>}</TableCell>
                {canManage && (
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(m)}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => confirm(`حذف ${m.name_ar}؟`) && remove.mutate(m.id)} className="text-destructive"><Trash2 className="size-4" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "تعديل خامة" : "إضافة خامة جديدة"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>الاسم بالعربي *</Label><Input value={editing.name_ar ?? ""} onChange={(e) => setEditing({ ...editing, name_ar: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>الاسم بالإنجليزي</Label><Input value={editing.name_en ?? ""} onChange={(e) => setEditing({ ...editing, name_en: e.target.value })} /></div>
                <div><Label>الكود الداخلي</Label><Input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} /></div>
              </div>
              <div><Label>نوع الخامة</Label><Input value={editing.material_type ?? ""} onChange={(e) => setEditing({ ...editing, material_type: e.target.value })} placeholder="مثال: ورق مصقول، كرتون، استيكر…" /></div>
              <div><Label>الوصف</Label><Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div><Label>ملاحظات داخلية</Label><Textarea rows={2} value={editing.internal_notes ?? ""} onChange={(e) => setEditing({ ...editing, internal_notes: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /> <Label>نشطة</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>إلغاء</Button>
            <Button onClick={() => save.mutate(editing!)} disabled={!editing?.name_ar || save.isPending} className="gradient-brand text-white border-0">حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ==================== Weights ====================
function WeightsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Weight> | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["library-weights"],
    queryFn: async () => ((await supabase.from("paper_weights").select("*").order("gsm")).data ?? []) as Weight[],
  });

  const save = useMutation({
    mutationFn: async (row: Partial<Weight>) => {
      const payload = { gsm: row.gsm!, display_name: row.display_name ?? `${row.gsm} GSM`, is_active: row.is_active ?? true };
      if (row.id) { const { error } = await supabase.from("paper_weights").update(payload).eq("id", row.id); if (error) throw error; }
      else { const { error } = await supabase.from("paper_weights").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["library-weights"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("paper_weights").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["library-weights"] }); },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">أوزان الورق ({data.length})</CardTitle>
        {canManage && <Button onClick={() => setEditing({ is_active: true })} className="gradient-brand text-white border-0"><Plus className="size-4 ms-1" /> وزن جديد</Button>}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead className="text-right">GSM</TableHead><TableHead className="text-right">الاسم</TableHead><TableHead className="text-right">الحالة</TableHead>{canManage && <TableHead className="text-right w-24">إجراءات</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {data.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-mono font-semibold">{w.gsm}</TableCell>
                <TableCell>{w.display_name}</TableCell>
                <TableCell>{w.is_active ? <Badge className="bg-success/15 text-success border-success/30">نشط</Badge> : <Badge variant="outline">موقوف</Badge>}</TableCell>
                {canManage && (
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(w)}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => confirm("حذف؟") && remove.mutate(w.id)} className="text-destructive"><Trash2 className="size-4" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "تعديل وزن" : "وزن جديد"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>GSM *</Label><Input type="number" value={editing.gsm ?? ""} onChange={(e) => setEditing({ ...editing, gsm: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>اسم العرض</Label><Input value={editing.display_name ?? ""} onChange={(e) => setEditing({ ...editing, display_name: e.target.value })} placeholder={editing.gsm ? `${editing.gsm} GSM` : ""} /></div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /> <Label>نشط</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>إلغاء</Button>
            <Button onClick={() => save.mutate(editing!)} disabled={!editing?.gsm || save.isPending} className="gradient-brand text-white border-0">حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ==================== Sizes ====================
function SizesTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Size> | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["library-sizes"],
    queryFn: async () => ((await supabase.from("common_sizes").select("*").order("name")).data ?? []) as Size[],
  });

  const save = useMutation({
    mutationFn: async (row: Partial<Size>) => {
      const payload = { name: row.name!, width: row.width ?? null, height: row.height ?? null, unit: row.unit ?? "cm", size_type: row.size_type ?? null, is_active: row.is_active ?? true };
      if (row.id) { const { error } = await supabase.from("common_sizes").update(payload).eq("id", row.id); if (error) throw error; }
      else { const { error } = await supabase.from("common_sizes").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["library-sizes"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("common_sizes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["library-sizes"] }); toast.success("تم الحذف"); },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">المقاسات الشائعة ({data.length})</CardTitle>
        {canManage && <Button onClick={() => setEditing({ is_active: true, unit: "cm" })} className="gradient-brand text-white border-0"><Plus className="size-4 ms-1" /> مقاس جديد</Button>}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead className="text-right">الاسم</TableHead><TableHead className="text-right">الأبعاد</TableHead><TableHead className="text-right">النوع</TableHead><TableHead className="text-right">الحالة</TableHead>{canManage && <TableHead className="w-24 text-right">إجراءات</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {data.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.width && s.height ? `${s.width} × ${s.height} ${s.unit}` : "—"}</TableCell>
                <TableCell>{s.size_type ?? "—"}</TableCell>
                <TableCell>{s.is_active ? <Badge className="bg-success/15 text-success border-success/30">نشط</Badge> : <Badge variant="outline">موقوف</Badge>}</TableCell>
                {canManage && (
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(s)}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => confirm("حذف؟") && remove.mutate(s.id)} className="text-destructive"><Trash2 className="size-4" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "تعديل مقاس" : "مقاس جديد"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>اسم المقاس *</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>العرض</Label><Input type="number" step="0.1" value={editing.width ?? ""} onChange={(e) => setEditing({ ...editing, width: parseFloat(e.target.value) || null })} /></div>
                <div><Label>الارتفاع</Label><Input type="number" step="0.1" value={editing.height ?? ""} onChange={(e) => setEditing({ ...editing, height: parseFloat(e.target.value) || null })} /></div>
                <div><Label>الوحدة</Label>
                  <Select value={editing.unit ?? "cm"} onValueChange={(v) => setEditing({ ...editing, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cm">سم</SelectItem><SelectItem value="mm">مم</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>النوع</Label>
                <Select value={editing.size_type ?? ""} onValueChange={(v) => setEditing({ ...editing, size_type: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent><SelectItem value="نهائي">نهائي</SelectItem><SelectItem value="مفتوح">مفتوح</SelectItem><SelectItem value="مغلق">مغلق</SelectItem><SelectItem value="شيت">شيت</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /> <Label>نشط</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>إلغاء</Button>
            <Button onClick={() => save.mutate(editing!)} disabled={!editing?.name || save.isPending} className="gradient-brand text-white border-0">حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ==================== Finishings ====================
function FinishingsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Finishing> | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["library-finishings"],
    queryFn: async () => ((await supabase.from("common_finishings").select("*").order("name_ar")).data ?? []) as Finishing[],
  });

  const save = useMutation({
    mutationFn: async (row: Partial<Finishing>) => {
      const payload = { name_ar: row.name_ar!, technical_name: row.technical_name ?? null, description: row.description ?? null, affects_price: row.affects_price ?? true, is_active: row.is_active ?? true };
      if (row.id) { const { error } = await supabase.from("common_finishings").update(payload).eq("id", row.id); if (error) throw error; }
      else { const { error } = await supabase.from("common_finishings").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["library-finishings"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("common_finishings").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["library-finishings"] }); toast.success("تم الحذف"); },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">التشطيبات الشائعة ({data.length})</CardTitle>
        {canManage && <Button onClick={() => setEditing({ is_active: true, affects_price: true })} className="gradient-brand text-white border-0"><Plus className="size-4 ms-1" /> تشطيب جديد</Button>}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead className="text-right">الاسم بالعربي</TableHead><TableHead className="text-right">الاسم التقني</TableHead><TableHead className="text-right">يؤثر على السعر</TableHead><TableHead className="text-right">الحالة</TableHead>{canManage && <TableHead className="w-24 text-right">إجراءات</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {data.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.name_ar}</TableCell>
                <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{f.technical_name ?? "—"}</code></TableCell>
                <TableCell>{f.affects_price ? <Badge>نعم</Badge> : <Badge variant="outline">لا</Badge>}</TableCell>
                <TableCell>{f.is_active ? <Badge className="bg-success/15 text-success border-success/30">نشط</Badge> : <Badge variant="outline">موقوف</Badge>}</TableCell>
                {canManage && (
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(f)}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => confirm("حذف؟") && remove.mutate(f.id)} className="text-destructive"><Trash2 className="size-4" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "تعديل تشطيب" : "تشطيب جديد"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>الاسم بالعربي *</Label><Input value={editing.name_ar ?? ""} onChange={(e) => setEditing({ ...editing, name_ar: e.target.value })} /></div>
              <div><Label>الاسم التقني (English key)</Label><Input value={editing.technical_name ?? ""} onChange={(e) => setEditing({ ...editing, technical_name: e.target.value })} placeholder="e.g. matte_lam" /></div>
              <div><Label>الوصف</Label><Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={editing.affects_price ?? true} onCheckedChange={(v) => setEditing({ ...editing, affects_price: v })} /> <Label>يؤثر على السعر</Label></div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /> <Label>نشط</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>إلغاء</Button>
            <Button onClick={() => save.mutate(editing!)} disabled={!editing?.name_ar || save.isPending} className="gradient-brand text-white border-0">حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ==================== Products (with linking) ====================
function ProductsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<Product> | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["library-products"],
    queryFn: async () => {
      const { data } = await supabase.from("common_products").select("*").order("name_ar");
      return (data ?? []).map((r: any) => ({ ...r, suggested_finishings: Array.isArray(r.suggested_finishings) ? r.suggested_finishings : [] })) as Product[];
    },
  });
  const { data: materials = [] } = useQuery({ queryKey: ["library-materials-min"], queryFn: async () => ((await supabase.from("paper_materials").select("id,name_ar").order("name_ar")).data ?? []) });
  const { data: weights = [] } = useQuery({ queryKey: ["library-weights-min"], queryFn: async () => ((await supabase.from("paper_weights").select("id,gsm,display_name").order("gsm")).data ?? []) });
  const { data: sizes = [] } = useQuery({ queryKey: ["library-sizes-min"], queryFn: async () => ((await supabase.from("common_sizes").select("id,name").order("name")).data ?? []) });
  const { data: finishings = [] } = useQuery({ queryKey: ["library-finishings-min"], queryFn: async () => ((await supabase.from("common_finishings").select("id,name_ar").order("name_ar")).data ?? []) });

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[], [products]);

  const filtered = products.filter((p) => {
    if (category !== "all" && p.category !== category) return false;
    if (search && !p.name_ar.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const save = useMutation({
    mutationFn: async (row: Partial<Product>) => {
      const payload = {
        name_ar: row.name_ar!, name_en: row.name_en ?? null, category: row.category ?? null,
        default_description: row.default_description ?? null,
        suggested_material_id: row.suggested_material_id ?? null,
        suggested_weight_id: row.suggested_weight_id ?? null,
        suggested_size_id: row.suggested_size_id ?? null,
        suggested_printing_method: row.suggested_printing_method ?? null,
        suggested_finishings: row.suggested_finishings ?? [],
        customer_notes: row.customer_notes ?? null,
        internal_notes: row.internal_notes ?? null,
        is_active: row.is_active ?? true,
      };
      if (row.id) { const { error } = await supabase.from("common_products").update(payload).eq("id", row.id); if (error) throw error; }
      else { const { error } = await supabase.from("common_products").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["library-products"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("common_products").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["library-products"] }); toast.success("تم الحذف"); },
  });

  const toggleFin = (id: string) => {
    if (!editing) return;
    const set = new Set(editing.suggested_finishings ?? []);
    set.has(id) ? set.delete(id) : set.add(id);
    setEditing({ ...editing, suggested_finishings: Array.from(set) });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">المنتجات الشائعة ({products.length})</CardTitle>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="بحث…" value={search} onChange={(e) => setSearch(e.target.value)} className="pe-9 w-56" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفئات</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {canManage && <Button onClick={() => setEditing({ is_active: true, suggested_finishings: [] })} className="gradient-brand text-white border-0"><Plus className="size-4 ms-1" /> منتج جديد</Button>}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead className="text-right">الاسم</TableHead><TableHead className="text-right">الفئة</TableHead><TableHead className="text-right">الخامة المقترحة</TableHead><TableHead className="text-right">الطباعة</TableHead><TableHead className="text-right">الحالة</TableHead>{canManage && <TableHead className="w-24 text-right">إجراءات</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {filtered.map((p) => {
              const mat = materials.find((m: any) => m.id === p.suggested_material_id);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name_ar}</TableCell>
                  <TableCell>{p.category ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{mat?.name_ar ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.suggested_printing_method ?? "—"}</TableCell>
                  <TableCell>{p.is_active ? <Badge className="bg-success/15 text-success border-success/30">نشط</Badge> : <Badge variant="outline">موقوف</Badge>}</TableCell>
                  {canManage && (
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(p)}><Pencil className="size-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => confirm("حذف؟") && remove.mutate(p.id)} className="text-destructive"><Trash2 className="size-4" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "تعديل منتج" : "منتج شائع جديد"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>الاسم بالعربي *</Label><Input value={editing.name_ar ?? ""} onChange={(e) => setEditing({ ...editing, name_ar: e.target.value })} /></div>
                <div><Label>الاسم بالإنجليزي</Label><Input value={editing.name_en ?? ""} onChange={(e) => setEditing({ ...editing, name_en: e.target.value })} /></div>
              </div>
              <div><Label>الفئة</Label><Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="مثال: علب تغليف، استيكرات…" list="cat-list" />
                <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div><Label>الوصف الافتراضي</Label><Textarea rows={2} value={editing.default_description ?? ""} onChange={(e) => setEditing({ ...editing, default_description: e.target.value })} /></div>
              <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <div className="text-sm font-semibold">🔗 الربط الذكي — اقتراحات للسيلز</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>الخامة المقترحة</Label>
                    <Select value={editing.suggested_material_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, suggested_material_id: v === "none" ? null : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="none">— بدون —</SelectItem>{materials.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name_ar}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>الوزن المقترح</Label>
                    <Select value={editing.suggested_weight_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, suggested_weight_id: v === "none" ? null : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="none">— بدون —</SelectItem>{weights.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.display_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>المقاس المقترح</Label>
                    <Select value={editing.suggested_size_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, suggested_size_id: v === "none" ? null : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="none">— بدون —</SelectItem>{sizes.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>طريقة الطباعة</Label><Input value={editing.suggested_printing_method ?? ""} onChange={(e) => setEditing({ ...editing, suggested_printing_method: e.target.value })} placeholder="أوفست / ديجيتال…" /></div>
                </div>
                <div>
                  <Label>التشطيبات المقترحة</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {finishings.map((f: any) => {
                      const on = (editing.suggested_finishings ?? []).includes(f.id);
                      return (
                        <Badge key={f.id} variant={on ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleFin(f.id)}>{f.name_ar}</Badge>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ملاحظات للعميل</Label><Textarea rows={2} value={editing.customer_notes ?? ""} onChange={(e) => setEditing({ ...editing, customer_notes: e.target.value })} /></div>
                <div><Label>ملاحظات داخلية</Label><Textarea rows={2} value={editing.internal_notes ?? ""} onChange={(e) => setEditing({ ...editing, internal_notes: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /> <Label>نشط</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>إلغاء</Button>
            <Button onClick={() => save.mutate(editing!)} disabled={!editing?.name_ar || save.isPending} className="gradient-brand text-white border-0">حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
