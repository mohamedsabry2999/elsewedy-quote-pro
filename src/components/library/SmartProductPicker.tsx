import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Library, Sparkles, Pencil, PlusCircle, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

export interface PickedProduct {
  name: string;
  category?: string;
  description?: string;
  material?: string;
  gsm?: string;
  size?: string;
  printing_method?: string;
  finishing_options?: string[];
  customer_notes?: string;
  internal_notes?: string;
}

/**
 * Smart selector at the top of every quotation item.
 * The sales user can:
 *  - pick a product from the library (auto-fills fields)
 *  - keep "منتج مخصص" (fully manual entry stays available)
 * Selections are suggestions only — every field remains editable afterwards.
 */
export function SmartProductPicker({ onApply }: { onApply: (v: PickedProduct) => void }) {
  const auth = useAuth();
  const canSave = auth.can("save_manual_to_library");
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["picker-products"],
    queryFn: async () => (await supabase.from("common_products").select("*").eq("is_active", true).order("name_ar")).data ?? [],
  });
  const { data: materials = [] } = useQuery({
    queryKey: ["picker-materials"],
    queryFn: async () => (await supabase.from("paper_materials").select("id,name_ar").eq("is_active", true)).data ?? [],
  });
  const { data: weights = [] } = useQuery({
    queryKey: ["picker-weights"],
    queryFn: async () => (await supabase.from("paper_weights").select("id,gsm,display_name").eq("is_active", true).order("gsm")).data ?? [],
  });
  const { data: sizes = [] } = useQuery({
    queryKey: ["picker-sizes"],
    queryFn: async () => (await supabase.from("common_sizes").select("id,name").eq("is_active", true)).data ?? [],
  });
  const { data: finishings = [] } = useQuery({
    queryKey: ["picker-finishings"],
    queryFn: async () => (await supabase.from("common_finishings").select("id,name_ar,technical_name").eq("is_active", true)).data ?? [],
  });

  const materialById = useMemo(() => new Map(materials.map((m: any) => [m.id, m.name_ar])), [materials]);
  const weightById = useMemo(() => new Map(weights.map((w: any) => [w.id, w])), [weights]);
  const sizeById = useMemo(() => new Map(sizes.map((s: any) => [s.id, s.name])), [sizes]);
  const finishingByIdKey = useMemo(() => new Map(finishings.map((f: any) => [f.id, f.technical_name || f.name_ar])), [finishings]);

  const applyProduct = (p: any) => {
    const w: any = p.suggested_weight_id ? weightById.get(p.suggested_weight_id) : null;
    onApply({
      name: p.name_ar,
      category: p.category ?? undefined,
      description: p.default_description ?? undefined,
      material: p.suggested_material_id ? (materialById.get(p.suggested_material_id) as string) : undefined,
      gsm: w ? String(w.gsm) : undefined,
      size: p.suggested_size_id ? (sizeById.get(p.suggested_size_id) as string) : undefined,
      printing_method: p.suggested_printing_method ?? undefined,
      finishing_options: (Array.isArray(p.suggested_finishings) ? p.suggested_finishings : [])
        .map((id: string) => finishingByIdKey.get(id) as string).filter(Boolean),
      customer_notes: p.customer_notes ?? undefined,
      internal_notes: p.internal_notes ?? undefined,
    });
    toast.success(`تم تطبيق مقترحات "${p.name_ar}" — يمكنك التعديل`);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap p-2.5 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
      <Sparkles className="size-4 text-primary shrink-0" />
      <span className="text-xs font-medium text-primary">مساعد ذكي:</span>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="h-8">
            <Library className="size-3.5 ms-1" /> اختيار من المكتبة
            <ChevronsUpDown className="size-3 ms-1 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="ابحث عن منتج…" />
            <CommandList>
              <CommandEmpty>
                <div className="py-4 text-center text-sm">
                  <div className="text-muted-foreground">لا توجد نتائج</div>
                  <div className="text-xs mt-1">يمكنك إدخال المنتج يدويًا في الحقول أدناه</div>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {products.map((p: any) => (
                  <CommandItem key={p.id} value={`${p.name_ar} ${p.name_en ?? ""} ${p.category ?? ""}`} onSelect={() => applyProduct(p)}>
                    <Check className="size-3 opacity-0 ms-1" />
                    <div className="flex flex-col">
                      <span className="font-medium">{p.name_ar}</span>
                      {p.category && <span className="text-[11px] text-muted-foreground">{p.category}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Button size="sm" variant="ghost" className="h-8" onClick={() => setCustomOpen(true)}>
        <Pencil className="size-3.5 ms-1" /> منتج مخصص (إدخال يدوي)
      </Button>

      <span className="text-[11px] text-muted-foreground ms-auto">الاختيار من المكتبة اختياري — يمكنك دائمًا الإدخال يدويًا</span>

      <CustomEntryDialog open={customOpen} onOpenChange={setCustomOpen} onApply={onApply} canSave={canSave} />
    </div>
  );
}

function CustomEntryDialog({ open, onOpenChange, onApply, canSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; onApply: (v: PickedProduct) => void; canSave: boolean;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [material, setMaterial] = useState("");
  const [gsm, setGsm] = useState("");
  const [size, setSize] = useState("");
  const [printingMethod, setPrintingMethod] = useState("");
  const [saveToLib, setSaveToLib] = useState(false);

  const reset = () => { setName(""); setCategory(""); setDescription(""); setMaterial(""); setGsm(""); setSize(""); setPrintingMethod(""); setSaveToLib(false); };

  const saveLib = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("common_products").insert({
        name_ar: name, category: category || null, default_description: description || null,
        suggested_printing_method: printingMethod || null, is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حفظ المنتج في المكتبة"); qc.invalidateQueries({ queryKey: ["picker-products"] }); },
    onError: (e: any) => toast.error("تعذر الحفظ في المكتبة", { description: e.message }),
  });

  const apply = async () => {
    if (!name.trim()) { toast.error("اكتب اسم المنتج"); return; }
    onApply({
      name, category: category || undefined, description: description || undefined,
      material: material || undefined, gsm: gsm || undefined, size: size || undefined,
      printing_method: printingMethod || undefined,
    });
    if (saveToLib && canSave) { await saveLib.mutateAsync(); }
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PlusCircle className="size-5 text-primary" /> إدخال منتج مخصص</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>اسم المنتج *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اكتب أي اسم" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>الفئة</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
            <div><Label>طريقة الطباعة</Label><Input value={printingMethod} onChange={(e) => setPrintingMethod(e.target.value)} /></div>
            <div><Label>الخامة</Label><Input value={material} onChange={(e) => setMaterial(e.target.value)} /></div>
            <div><Label>GSM</Label><Input value={gsm} onChange={(e) => setGsm(e.target.value)} /></div>
            <div className="col-span-2"><Label>المقاس</Label><Input value={size} onChange={(e) => setSize(e.target.value)} /></div>
          </div>
          <div><Label>الوصف</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>

          <div className="rounded-lg border p-3 bg-muted/30">
            {canSave ? (
              <label className="flex items-start gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={saveToLib} onChange={(e) => setSaveToLib(e.target.checked)} className="mt-1" />
                <span>هل تريد حفظ هذا العنصر في المكتبة للاستخدام لاحقًا؟</span>
              </label>
            ) : (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Badge variant="outline">استخدام في هذا العرض فقط</Badge>
                لا تملك صلاحية حفظ القيم اليدوية في المكتبة.
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={apply} className="gradient-brand text-white border-0">تطبيق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
