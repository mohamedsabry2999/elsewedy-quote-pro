import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useMemo } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, GripVertical, Layers, Wand2, Eye, Save, Copy, Package } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { canManagePricing } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/item-templates")({
  head: () => ({ meta: [{ title: "قوالب البنود — Elsewedy Smart Quotation" }] }),
  component: TemplatesPage,
});

const CATEGORIES: Record<string, string> = {
  digital: "طباعة ديجيتال",
  offset: "طباعة أوفست",
  packaging: "علب كرتون",
  paper_wrap: "تغليف ورقي",
  labels: "استيكرات وليبلز",
  catalog: "كتالوج / بروشور",
  marketing: "منتجات تسويقية",
  custom: "منتج مخصص",
};

const FIELD_TYPES: { key: string; label: string; hasOptions?: boolean }[] = [
  { key: "text", label: "نص" },
  { key: "long_text", label: "نص طويل" },
  { key: "number", label: "رقم" },
  { key: "decimal", label: "رقم عشري" },
  { key: "currency", label: "عملة" },
  { key: "percentage", label: "نسبة مئوية" },
  { key: "quantity", label: "كمية" },
  { key: "dropdown", label: "قائمة", hasOptions: true },
  { key: "multi_select", label: "قائمة متعددة", hasOptions: true },
  { key: "checkbox", label: "خانة اختيار" },
  { key: "date", label: "تاريخ" },
  { key: "size", label: "مقاس" },
  { key: "material_selector", label: "منتقي خامة" },
  { key: "paper_selector", label: "منتقي ورق" },
  { key: "finishing_selector", label: "منتقي تشطيبات" },
  { key: "pricing_rule_selector", label: "منتقي قاعدة تسعير" },
  { key: "file_upload", label: "رفع ملف" },
  { key: "formula", label: "حقل صيغة" },
];

type Template = {
  id: string; name_ar: string; name_en: string | null; category: string;
  description: string | null; is_active: boolean; is_system: boolean;
  calculation_config: any;
};
type Section = { id: string; template_id: string; section_name: string; section_key: string; sort_order: number; is_active: boolean };
type Field = {
  id: string; template_id: string; section_id: string | null;
  field_label_ar: string; field_label_en: string | null; field_key: string; field_type: string;
  required: boolean; visible_to_customer: boolean; internal_only: boolean; included_in_calculation: boolean;
  default_value: string | null; placeholder: string | null; help_text: string | null;
  options: any; validation_rules: any; conditional_rules: any; formula: any;
  sort_order: number; is_active: boolean;
};

function TemplatesPage() {
  const auth = useAuth();
  const qc = useQueryClient();
  const canManage = canManagePricing(auth.roles);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTpl, setNewTpl] = useState({ name_ar: "", category: "digital", description: "" });

  const { data: templates = [] } = useQuery({
    queryKey: ["item-templates"],
    queryFn: async () => (await supabase.from("item_templates").select("*").order("category").order("name_ar")).data as Template[] ?? [],
  });

  useEffect(() => { if (!selectedId && templates.length) setSelectedId(templates[0].id); }, [templates, selectedId]);

  const selected = templates.find((t) => t.id === selectedId);

  const createTpl = useMutation({
    mutationFn: async () => {
      if (!newTpl.name_ar) throw new Error("أدخل اسم القالب");
      const { data, error } = await supabase.from("item_templates").insert({ ...newTpl, created_by: auth.userId } as any).select("id").single();
      if (error) throw error;
      // add default 3 sections
      const sections = [
        { template_id: data!.id, section_name: "البيانات الأساسية", section_key: "basics", sort_order: 0 },
        { template_id: data!.id, section_name: "المواصفات", section_key: "specs", sort_order: 10 },
        { template_id: data!.id, section_name: "التسعير", section_key: "pricing", sort_order: 20 },
      ];
      await supabase.from("item_template_sections").insert(sections as any);
      return data!.id;
    },
    onSuccess: (id) => {
      toast.success("تم إنشاء القالب"); setShowNew(false);
      setNewTpl({ name_ar: "", category: "digital", description: "" });
      qc.invalidateQueries({ queryKey: ["item-templates"] });
      setSelectedId(id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicateTpl = useMutation({
    mutationFn: async (t: Template) => {
      const { data: tpl, error } = await supabase.from("item_templates").insert({
        name_ar: `${t.name_ar} (نسخة)`, name_en: t.name_en, category: t.category, description: t.description,
        calculation_config: t.calculation_config, is_system: false, created_by: auth.userId,
      } as any).select("id").single();
      if (error) throw error;
      const { data: secs } = await supabase.from("item_template_sections").select("*").eq("template_id", t.id);
      const secMap = new Map<string, string>();
      for (const s of (secs ?? [])) {
        const { data: newS } = await supabase.from("item_template_sections").insert({
          template_id: tpl!.id, section_name: (s as any).section_name, section_key: (s as any).section_key,
          sort_order: (s as any).sort_order, is_active: (s as any).is_active,
        } as any).select("id").single();
        secMap.set((s as any).id, newS!.id);
      }
      const { data: fields } = await supabase.from("item_template_fields").select("*").eq("template_id", t.id);
      for (const f of (fields ?? [])) {
        const copy: any = { ...f, id: undefined, template_id: tpl!.id, section_id: secMap.get((f as any).section_id) ?? null };
        delete copy.created_at; delete copy.updated_at;
        await supabase.from("item_template_fields").insert(copy);
      }
      return tpl!.id;
    },
    onSuccess: (id) => { toast.success("تم تكرار القالب"); qc.invalidateQueries({ queryKey: ["item-templates"] }); setSelectedId(id); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTpl = useMutation({
    mutationFn: async (id: string) => {
      const { count } = await supabase.from("quotation_items").select("id", { count: "exact", head: true }).eq("template_id", id);
      if ((count ?? 0) > 0) {
        if (!confirm(`هذا القالب مستخدم في ${count} عرض سعر. سيتم تعطيله بدلاً من حذفه. متابعة؟`)) return;
        await supabase.from("item_templates").update({ is_active: false }).eq("id", id);
      } else {
        await supabase.from("item_templates").delete().eq("id", id);
      }
    },
    onSuccess: () => { toast.success("تم"); qc.invalidateQueries({ queryKey: ["item-templates"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!canManage) return <div className="text-center py-16 text-muted-foreground">هذه الصفحة متاحة لمسؤول النظام فقط.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Layers className="size-6 text-primary" /> قوالب البنود والعناصر</h1>
          <p className="text-sm text-muted-foreground">صمّم حقول كل فئة منتج بحرية كاملة — أقسام، حقول ديناميكية، شروط ظهور، وصيغ حسابية.</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gradient-brand text-white border-0"><Plus className="size-4 ms-1" /> قالب جديد</Button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Templates list */}
        <Card className="col-span-3">
          <CardHeader><CardTitle className="text-sm">القوالب ({templates.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1 max-h-[75vh] overflow-y-auto p-2">
            {templates.map((t) => (
              <button key={t.id} onClick={() => setSelectedId(t.id)}
                className={`w-full text-right rounded-lg p-2.5 text-sm transition ${selectedId === t.id ? "bg-primary/10 border border-primary" : "hover:bg-muted"}`}>
                <div className="flex items-center justify-between">
                  <div className="font-medium truncate">{t.name_ar}</div>
                  {t.is_system && <Badge variant="outline" className="text-[9px]">افتراضي</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{CATEGORIES[t.category] ?? t.category}</div>
              </button>
            ))}
            {!templates.length && <div className="text-center text-xs text-muted-foreground py-6">لا توجد قوالب</div>}
          </CardContent>
        </Card>

        {/* Editor */}
        <div className="col-span-9">
          {selected ? (
            <TemplateEditor
              template={selected}
              onDuplicate={() => duplicateTpl.mutate(selected)}
              onDelete={() => deleteTpl.mutate(selected.id)}
            />
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><Package className="size-10 mx-auto opacity-50" /><div className="mt-2">اختر قالباً أو أنشئ قالباً جديداً</div></CardContent></Card>
          )}
        </div>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>قالب بند جديد</DialogTitle>
            <DialogDescription>سيتم إنشاء 3 أقسام افتراضية — تقدر تعدلهم بعدين.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>اسم القالب</Label><Input value={newTpl.name_ar} onChange={(e) => setNewTpl({ ...newTpl, name_ar: e.target.value })} /></div>
            <div className="space-y-1"><Label>الفئة</Label>
              <select className="w-full h-10 rounded-md border bg-transparent px-3" value={newTpl.category} onChange={(e) => setNewTpl({ ...newTpl, category: e.target.value })}>
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>وصف مختصر</Label><Textarea rows={2} value={newTpl.description} onChange={(e) => setNewTpl({ ...newTpl, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>إلغاء</Button>
            <Button onClick={() => createTpl.mutate()} disabled={createTpl.isPending}>إنشاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Template Editor ============
function TemplateEditor({ template, onDuplicate, onDelete }: { template: Template; onDuplicate: () => void; onDelete: () => void }) {
  const qc = useQueryClient();

  const { data: sections = [] } = useQuery({
    queryKey: ["template-sections", template.id],
    queryFn: async () => (await supabase.from("item_template_sections").select("*").eq("template_id", template.id).order("sort_order")).data as Section[] ?? [],
  });
  const { data: fields = [] } = useQuery({
    queryKey: ["template-fields", template.id],
    queryFn: async () => (await supabase.from("item_template_fields").select("*").eq("template_id", template.id).order("sort_order")).data as Field[] ?? [],
  });

  const [tab, setTab] = useState("builder");
  const [tplForm, setTplForm] = useState({ name_ar: template.name_ar, name_en: template.name_en ?? "", description: template.description ?? "", is_active: template.is_active });
  const [calc, setCalc] = useState<any>(template.calculation_config ?? {});
  useEffect(() => {
    setTplForm({ name_ar: template.name_ar, name_en: template.name_en ?? "", description: template.description ?? "", is_active: template.is_active });
    setCalc(template.calculation_config ?? {});
  }, [template.id]);

  const saveTpl = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("item_templates").update({
        name_ar: tplForm.name_ar, name_en: tplForm.name_en || null,
        description: tplForm.description || null, is_active: tplForm.is_active,
        calculation_config: calc,
      }).eq("id", template.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حفظ القالب"); qc.invalidateQueries({ queryKey: ["item-templates"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const addSection = useMutation({
    mutationFn: async () => {
      await supabase.from("item_template_sections").insert({
        template_id: template.id, section_name: "قسم جديد",
        section_key: `section_${Date.now()}`, sort_order: (sections.at(-1)?.sort_order ?? 0) + 10,
      } as any);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["template-sections", template.id] }),
  });

  const updateSection = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Section> }) => {
      await supabase.from("item_template_sections").update(patch as any).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["template-sections", template.id] }),
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const used = fields.some((f) => f.section_id === id);
      if (used && !confirm("هذا القسم يحتوي على حقول. سيتم فك ربطها. متابعة؟")) return;
      await supabase.from("item_template_sections").delete().eq("id", id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["template-sections", template.id] }); qc.invalidateQueries({ queryKey: ["template-fields", template.id] }); },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <Input value={tplForm.name_ar} onChange={(e) => setTplForm({ ...tplForm, name_ar: e.target.value })} className="text-lg font-bold" />
              <Input placeholder="English name" value={tplForm.name_en} onChange={(e) => setTplForm({ ...tplForm, name_en: e.target.value })} className="max-w-xs" dir="ltr" />
            </div>
            <Textarea rows={2} placeholder="وصف مختصر" value={tplForm.description} onChange={(e) => setTplForm({ ...tplForm, description: e.target.value })} />
            <div className="flex items-center gap-4">
              <Badge variant="outline">{CATEGORIES[template.category] ?? template.category}</Badge>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={tplForm.is_active} onCheckedChange={(v) => setTplForm({ ...tplForm, is_active: v })} />
                نشط
              </label>
              {template.is_system && <Badge variant="secondary" className="text-[10px]">قالب افتراضي</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onDuplicate}><Copy className="size-4 ms-1" /> نسخ</Button>
            <Button variant="outline" size="sm" onClick={onDelete}><Trash2 className="size-4 ms-1 text-destructive" /></Button>
            <Button size="sm" onClick={() => saveTpl.mutate()} className="gradient-brand text-white border-0"><Save className="size-4 ms-1" /> حفظ</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="builder"><Wand2 className="size-4 ms-1" /> باني الحقول</TabsTrigger>
            <TabsTrigger value="calc">إعدادات الحساب</TabsTrigger>
            <TabsTrigger value="preview"><Eye className="size-4 ms-1" /> معاينة</TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => addSection.mutate()}><Plus className="size-4 ms-1" /> قسم جديد</Button>
            </div>
            <div className="space-y-4">
              {sections.map((sec) => (
                <SectionCard key={sec.id} section={sec}
                  fields={fields.filter((f) => f.section_id === sec.id)}
                  allFields={fields} templateId={template.id}
                  onRename={(name) => updateSection.mutate({ id: sec.id, patch: { section_name: name } })}
                  onDelete={() => deleteSection.mutate(sec.id)} />
              ))}
              {!sections.length && <div className="text-center py-10 text-muted-foreground text-sm">لا توجد أقسام — أضف الأول من الأعلى</div>}
            </div>
          </TabsContent>

          <TabsContent value="calc" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {["quantity_field", "unit_price_field", "discount_field", "margin_field", "tax_field"].map((k) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs">{k}</Label>
                  <select className="w-full h-9 rounded-md border bg-transparent px-3 text-sm" value={calc?.[k] ?? ""} onChange={(e) => setCalc({ ...calc, [k]: e.target.value })}>
                    <option value="">— لا شيء —</option>
                    {fields.map((f) => <option key={f.id} value={f.field_key}>{f.field_label_ar}</option>)}
                  </select>
                </div>
              ))}
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">الصيغة (مثال: quantity * unit_price)</Label>
                <Input value={calc?.formula ?? ""} onChange={(e) => setCalc({ ...calc, formula: e.target.value })} dir="ltr" placeholder="quantity * unit_price" />
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-xs">
              <b>المتغيرات المتاحة:</b> {fields.filter((f) => f.included_in_calculation).map((f) => f.field_key).join(", ") || "لا يوجد — علّم الحقول بـ 'يدخل في الحساب'"}
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-3">
            <PreviewPanel sections={sections} fields={fields} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ============ Section with drag-drop fields ============
function SectionCard({ section, fields, allFields, templateId, onRename, onDelete }: {
  section: Section; fields: Field[]; allFields: Field[]; templateId: string;
  onRename: (name: string) => void; onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [editField, setEditField] = useState<Field | null>(null);
  const [showNewField, setShowNewField] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const reorder = useMutation({
    mutationFn: async (ordered: Field[]) => {
      for (let i = 0; i < ordered.length; i++) {
        await supabase.from("item_template_fields").update({ sort_order: i * 10 }).eq("id", ordered[i].id);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["template-fields", templateId] }),
  });

  const deleteField = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm("قد يكون هذا الحقل مستخدماً في عروض أسعار سابقة. سيتم تعطيله بدلاً من الحذف الفوري إن أمكن. متابعة؟")) return;
      await supabase.from("item_template_fields").update({ is_active: false }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["template-fields", templateId] }),
  });

  function handleDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === e.active.id);
    const newIndex = fields.findIndex((f) => f.id === e.over!.id);
    reorder.mutate(arrayMove(fields, oldIndex, newIndex));
  }

  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2 p-3 bg-muted/40 border-b">
        <Input defaultValue={section.section_name} onBlur={(e) => e.target.value !== section.section_name && onRename(e.target.value)} className="max-w-xs font-semibold" />
        <Badge variant="outline" className="text-[10px] font-mono">{section.section_key}</Badge>
        <div className="text-xs text-muted-foreground">{fields.length} حقل</div>
        <div className="ms-auto flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setShowNewField(true)}><Plus className="size-4 ms-1" /> حقل</Button>
          <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="size-4 text-destructive" /></Button>
        </div>
      </div>
      <div className="p-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            {fields.map((f) => <FieldRow key={f.id} field={f} onEdit={() => setEditField(f)} onDelete={() => deleteField.mutate(f.id)} />)}
          </SortableContext>
        </DndContext>
        {!fields.length && <div className="text-center py-4 text-muted-foreground text-xs">لا توجد حقول — أضف الأول</div>}
      </div>
      {(editField || showNewField) && (
        <FieldEditor
          field={editField}
          templateId={templateId} sectionId={section.id}
          allFields={allFields}
          onClose={() => { setEditField(null); setShowNewField(false); }}
        />
      )}
    </div>
  );
}

function FieldRow({ field, onEdit, onDelete }: { field: Field; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 rounded hover:bg-muted/40 group">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground"><GripVertical className="size-4" /></button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{field.field_label_ar}</div>
        <div className="text-[10px] text-muted-foreground font-mono truncate">{field.field_key}</div>
      </div>
      <Badge variant="outline" className="text-[10px]">{FIELD_TYPES.find((t) => t.key === field.field_type)?.label ?? field.field_type}</Badge>
      {field.required && <Badge variant="destructive" className="text-[10px]">إلزامي</Badge>}
      {field.visible_to_customer && <Badge className="bg-success text-success-foreground text-[10px]">للعميل</Badge>}
      {field.internal_only && <Badge className="bg-warning text-warning-foreground text-[10px]">داخلي</Badge>}
      {field.included_in_calculation && <Badge variant="secondary" className="text-[10px]">حساب</Badge>}
      {!field.is_active && <Badge variant="outline" className="text-[10px]">معطل</Badge>}
      <Button size="sm" variant="ghost" onClick={onEdit}>تعديل</Button>
      <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="size-4 text-destructive" /></Button>
    </div>
  );
}

// ============ Field editor ============
function FieldEditor({ field, templateId, sectionId, allFields, onClose }: {
  field: Field | null; templateId: string; sectionId: string; allFields: Field[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    field_label_ar: field?.field_label_ar ?? "",
    field_label_en: field?.field_label_en ?? "",
    field_key: field?.field_key ?? "",
    field_type: field?.field_type ?? "text",
    required: field?.required ?? false,
    visible_to_customer: field?.visible_to_customer ?? true,
    internal_only: field?.internal_only ?? false,
    included_in_calculation: field?.included_in_calculation ?? false,
    default_value: field?.default_value ?? "",
    placeholder: field?.placeholder ?? "",
    help_text: field?.help_text ?? "",
    is_active: field?.is_active ?? true,
    options: JSON.stringify(field?.options ?? [], null, 2),
    conditional_rules: JSON.stringify(field?.conditional_rules ?? {}, null, 2),
    formula: JSON.stringify(field?.formula ?? {}, null, 2),
  });

  const fieldType = FIELD_TYPES.find((t) => t.key === form.field_type);

  const save = useMutation({
    mutationFn: async () => {
      const key = form.field_key || form.field_label_ar.toLowerCase().replace(/\s+/g, "_").replace(/[^\w\u0600-\u06FF]/g, "");
      let opts: any = []; let cond: any = {}; let form_: any = {};
      try { opts = JSON.parse(form.options || "[]"); } catch { throw new Error("خيارات القائمة JSON غير صحيح"); }
      try { cond = JSON.parse(form.conditional_rules || "{}"); } catch { throw new Error("قواعد الشرط JSON غير صحيح"); }
      try { form_ = JSON.parse(form.formula || "{}"); } catch { throw new Error("الصيغة JSON غير صحيح"); }
      const payload = {
        template_id: templateId, section_id: sectionId,
        field_label_ar: form.field_label_ar, field_label_en: form.field_label_en || null,
        field_key: key, field_type: form.field_type,
        required: form.required, visible_to_customer: form.visible_to_customer,
        internal_only: form.internal_only, included_in_calculation: form.included_in_calculation,
        default_value: form.default_value || null, placeholder: form.placeholder || null, help_text: form.help_text || null,
        options: opts, conditional_rules: cond, formula: form_, is_active: form.is_active,
      };
      if (field) {
        const { error } = await supabase.from("item_template_fields").update(payload).eq("id", field.id);
        if (error) throw error;
      } else {
        const sortOrder = (allFields.filter((f) => f.section_id === sectionId).at(-1)?.sort_order ?? 0) + 10;
        const { error } = await supabase.from("item_template_fields").insert({ ...payload, sort_order: sortOrder } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("تم"); qc.invalidateQueries({ queryKey: ["template-fields", templateId] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{field ? "تعديل حقل" : "حقل جديد"}</DialogTitle>
          <DialogDescription>تحكم كامل في سلوك الحقل وظهوره وحسابه</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>الاسم بالعربي *</Label><Input value={form.field_label_ar} onChange={(e) => setForm({ ...form, field_label_ar: e.target.value })} /></div>
          <div className="space-y-1"><Label>الاسم بالإنجليزي</Label><Input dir="ltr" value={form.field_label_en} onChange={(e) => setForm({ ...form, field_label_en: e.target.value })} /></div>
          <div className="space-y-1"><Label>المعرف (field_key)</Label><Input dir="ltr" value={form.field_key} onChange={(e) => setForm({ ...form, field_key: e.target.value.trim() })} placeholder="auto-generated" /></div>
          <div className="space-y-1"><Label>النوع</Label>
            <select className="w-full h-10 rounded-md border bg-transparent px-3" value={form.field_type} onChange={(e) => setForm({ ...form, field_type: e.target.value })}>
              {FIELD_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label>القيمة الافتراضية</Label><Input value={form.default_value} onChange={(e) => setForm({ ...form, default_value: e.target.value })} /></div>
          <div className="space-y-1"><Label>Placeholder</Label><Input value={form.placeholder} onChange={(e) => setForm({ ...form, placeholder: e.target.value })} /></div>
          <div className="col-span-2 space-y-1"><Label>نص مساعد</Label><Input value={form.help_text} onChange={(e) => setForm({ ...form, help_text: e.target.value })} /></div>

          <div className="col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t">
            <SwitchRow label="مطلوب" checked={form.required} onChange={(v) => setForm({ ...form, required: v })} />
            <SwitchRow label="ظاهر للعميل في PDF" checked={form.visible_to_customer} onChange={(v) => setForm({ ...form, visible_to_customer: v })} />
            <SwitchRow label="داخلي فقط" checked={form.internal_only} onChange={(v) => setForm({ ...form, internal_only: v })} />
            <SwitchRow label="يدخل في الحساب" checked={form.included_in_calculation} onChange={(v) => setForm({ ...form, included_in_calculation: v })} />
            <SwitchRow label="نشط" checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
          </div>

          {fieldType?.hasOptions && (
            <div className="col-span-2 space-y-1">
              <Label>خيارات القائمة (JSON: [&#123;"value":"a","label":"أ"&#125;])</Label>
              <Textarea dir="ltr" rows={4} className="font-mono text-xs" value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} />
            </div>
          )}

          <div className="col-span-2 space-y-1">
            <Label>قواعد الظهور الشرطي (JSON)</Label>
            <Textarea dir="ltr" rows={3} className="font-mono text-xs" value={form.conditional_rules} onChange={(e) => setForm({ ...form, conditional_rules: e.target.value })}
              placeholder='{"show_if":{"field":"category","equals":"packaging"}}' />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>الصيغة الحسابية (JSON)</Label>
            <Textarea dir="ltr" rows={2} className="font-mono text-xs" value={form.formula} onChange={(e) => setForm({ ...form, formula: e.target.value })}
              placeholder='{"expression":"quantity * unit_price"}' />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => save.mutate()} disabled={!form.field_label_ar || save.isPending}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs rounded-md border p-2 cursor-pointer hover:bg-muted/40">
      <Switch checked={checked} onCheckedChange={onChange} /> {label}
    </label>
  );
}

// ============ Live preview ============
function PreviewPanel({ sections, fields }: { sections: Section[]; fields: Field[] }) {
  const [values, setValues] = useState<Record<string, any>>({});

  const activeFields = fields.filter((f) => f.is_active);

  const visibleField = (f: Field) => {
    const cond = f.conditional_rules?.show_if;
    if (!cond?.field) return true;
    return String(values[cond.field] ?? "") === String(cond.equals ?? "");
  };

  const calcTotal = useMemo(() => {
    const qty = Number(values.quantity ?? 0);
    const price = Number(values.unit_price ?? 0);
    const disc = Number(values.discount ?? 0);
    const sub = qty * price;
    return sub - (sub * disc / 100);
  }, [values]);

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">هذه معاينة حيّة لشكل نموذج البند داخل عرض السعر — جرّب الحقول وشاهد الحساب.</div>
      {sections.sort((a, b) => a.sort_order - b.sort_order).map((sec) => {
        const secFields = activeFields.filter((f) => f.section_id === sec.id).filter(visibleField).sort((a, b) => a.sort_order - b.sort_order);
        if (!secFields.length) return null;
        return (
          <div key={sec.id} className="rounded-lg border p-4">
            <div className="text-sm font-semibold mb-3">{sec.section_name}</div>
            <div className="grid md:grid-cols-2 gap-3">
              {secFields.map((f) => (
                <div key={f.id} className="space-y-1">
                  <Label className="text-xs">{f.field_label_ar} {f.required && <span className="text-destructive">*</span>}
                    {f.internal_only && <Badge variant="outline" className="text-[9px] me-1">داخلي</Badge>}
                  </Label>
                  <PreviewInput field={f} value={values[f.field_key]} onChange={(v) => setValues({ ...values, [f.field_key]: v })} />
                  {f.help_text && <div className="text-[10px] text-muted-foreground">{f.help_text}</div>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="rounded-lg bg-primary/5 border border-primary p-4 flex items-center justify-between">
        <div className="text-sm">الإجمالي المحسوب</div>
        <div className="text-2xl font-bold text-primary">{calcTotal.toFixed(2)}</div>
      </div>
    </div>
  );
}

function PreviewInput({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  const t = field.field_type;
  if (t === "long_text") return <Textarea rows={2} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} />;
  if (t === "checkbox") return <Switch checked={!!value} onCheckedChange={onChange} />;
  if (t === "dropdown" || t === "multi_select") {
    const opts: any[] = Array.isArray(field.options) ? field.options : [];
    return (
      <select className="w-full h-9 rounded-md border bg-transparent px-3 text-sm" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">— اختر —</option>
        {opts.map((o: any) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
    );
  }
  if (t === "number" || t === "decimal" || t === "currency" || t === "percentage" || t === "quantity")
    return <Input type="number" step="0.01" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} />;
  if (t === "date") return <Input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  return <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} />;
}
