import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, Copy, ChevronDown, Sparkles, Save, ShieldAlert, PackageOpen, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { canSeeCosts } from "@/lib/roles";
import { useBrand } from "@/lib/brand";
import { ruleMap, calcDigital, calcOffset, calcPackaging, calcLabels, calcFinishingOnly, type PricingBreakdown } from "@/lib/pricing";
import { currency, number } from "@/lib/format";
import { SmartProductPicker, type PickedProduct } from "@/components/library/SmartProductPicker";

const searchSchema = z.object({ customer: z.string().optional() });

export const Route = createFileRoute("/_authenticated/quotations/new")({
  head: () => ({ meta: [{ title: "إنشاء عرض سعر — Medhat Elsewedy Printhouse" }] }),
  validateSearch: searchSchema,
  component: BuilderPage,
});

const CATEGORIES = [
  { key: "digital", label: "طباعة ديجيتال" },
  { key: "offset", label: "طباعة أوفست" },
  { key: "folding_cartons", label: "علب مطوية" },
  { key: "paper_packaging", label: "تغليف ورقي" },
  { key: "labels", label: "ملصقات و ستيكرز" },
  { key: "pharma", label: "علب أدوية" },
  { key: "cosmetics", label: "علب مستحضرات تجميل" },
  { key: "food", label: "تغليف مواد غذائية" },
  { key: "marketing", label: "مطبوعات تسويقية" },
  { key: "booklet", label: "كتالوج / كتيب" },
  { key: "custom", label: "منتج مخصص" },
];

const PRINTING_METHODS = ["ديجيتال HP Indigo", "أوفست 50×70", "أوفست 70×100", "فليكسو", "طباعة مخصصة"];
const PRINTING_SIDES = [{ value: "1", label: "وجه واحد" }, { value: "2", label: "وجهين" }];

interface QuotationItem {
  id: string;
  title: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  size: string;
  material: string;
  gsm: string;
  printing_method: string;
  printing_sides: string;
  colors: string;
  finishing_options: string[];
  unit_price: number;
  unit_cost: number;
  discount_pct: number;
  margin_pct: number;
  customer_notes: string;
  internal_notes: string;
  cost_breakdown: Partial<PricingBreakdown>;
  auto_specs: Record<string, any>;
  collapsed: boolean;
}

function newItem(n: number): QuotationItem {
  return {
    id: crypto.randomUUID(), title: `بند ${n}`, category: "digital",
    description: "", quantity: 1000, unit: "قطعة", size: "", material: "",
    gsm: "", printing_method: "ديجيتال HP Indigo", printing_sides: "2",
    colors: "CMYK 4/4", finishing_options: [], unit_price: 0, unit_cost: 0,
    discount_pct: 0, margin_pct: 25, customer_notes: "", internal_notes: "",
    cost_breakdown: {}, auto_specs: {}, collapsed: false,
  };
}

function BuilderPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const auth = useAuth();
  const brand = useBrand();
  const showCosts = canSeeCosts(auth.roles);

  const [customerId, setCustomerId] = useState(search.customer ?? "");
  const [items, setItems] = useState<QuotationItem[]>([newItem(1)]);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxPct, setTaxPct] = useState(14);
  const [paymentTerms, setPaymentTerms] = useState(brand.default_payment_terms);
  const [validityDays, setValidityDays] = useState(brand.default_validity_days);
  const [deliveryDays, setDeliveryDays] = useState(7);
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setPaymentTerms(brand.default_payment_terms); setValidityDays(brand.default_validity_days); }, [brand]);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-min"],
    queryFn: async () => (await supabase.from("customers").select("id,company_name,contact_person").order("company_name")).data ?? [],
  });

  const { data: rulesRaw = [] } = useQuery({
    queryKey: ["pricing-rules"],
    queryFn: async () => (await supabase.from("pricing_rules").select("*")).data ?? [],
  });
  const rules = useMemo(() => ruleMap(rulesRaw as any), [rulesRaw]);
  const papers = useMemo(() => rulesRaw.filter((r: any) => r.category === "paper"), [rulesRaw]);
  const finishingRules = useMemo(() => rulesRaw.filter((r: any) => r.category === "finishing"), [rulesRaw]);

  // Aggregations
  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    const totalCost = items.reduce((s, it) => s + it.quantity * (it.unit_cost || 0), 0);
    const discount = items.reduce((s, it) => s + (it.quantity * it.unit_price) * (it.discount_pct / 100), 0);
    const priceBeforeTax = subtotal - discount;
    const taxAmount = taxEnabled ? priceBeforeTax * (taxPct / 100) : 0;
    const finalPrice = priceBeforeTax + taxAmount;
    const profit = priceBeforeTax - totalCost;
    const avgMargin = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    const totalQty = items.reduce((s, it) => s + it.quantity, 0);
    return { subtotal, totalCost, discount, priceBeforeTax, taxAmount, finalPrice, profit, avgMargin, totalQty };
  }, [items, taxEnabled, taxPct]);

  const minMargin = rules["config.min_margin_pct"] ?? 10;
  const maxDiscount = rules["config.max_discount_pct"] ?? 15;
  const highValueThreshold = rules["config.high_value_threshold"] ?? 50000;
  const approvalRequired =
    totals.avgMargin < minMargin ||
    items.some((it) => it.discount_pct > maxDiscount) ||
    totals.finalPrice > highValueThreshold;

  const updateItem = (id: string, patch: Partial<QuotationItem>) =>
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const addItem = () => setItems((arr) => [...arr, newItem(arr.length + 1)]);
  const duplicateItem = (id: string) =>
    setItems((arr) => {
      const idx = arr.findIndex((i) => i.id === id);
      if (idx < 0) return arr;
      const copy = { ...arr[idx], id: crypto.randomUUID(), title: `${arr[idx].title} — نسخة` };
      return [...arr.slice(0, idx + 1), copy, ...arr.slice(idx + 1)];
    });
  const removeItem = (id: string) => setItems((arr) => (arr.length === 1 ? arr : arr.filter((i) => i.id !== id)));
  const moveItem = (id: string, dir: -1 | 1) => setItems((arr) => {
    const idx = arr.findIndex((i) => i.id === id);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= arr.length) return arr;
    const next = [...arr];
    [next[idx], next[to]] = [next[to], next[idx]];
    return next;
  });

  const autoCalcItem = (id: string) => {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    const taxOpts = { taxEnabled: false, taxPct: 0 }; // per-item excludes VAT (VAT applied at quotation level)
    let breakdown: PricingBreakdown | null = null;
    const paperKey = it.auto_specs.paperKey || "coated_300gsm";
    try {
      if (it.category === "digital" || it.category === "marketing" || it.category === "booklet" || it.category === "custom") {
        breakdown = calcDigital({
          sheetSize: (it.auto_specs.sheetSize as any) || "50x70",
          copiesPerSheet: it.auto_specs.copiesPerSheet ?? 4,
          quantity: it.quantity,
          paperKey,
          printingSides: (parseInt(it.printing_sides) || 2) as 1 | 2,
          colors: (it.colors.includes("CMYK") ? 4 : 1) as 1 | 4,
          specialInks: it.auto_specs.specialInks ?? 0,
          finishingKeys: it.finishing_options,
          marginPct: it.margin_pct,
          discountPct: it.discount_pct,
          ...taxOpts,
        }, rules);
      } else if (it.category === "offset") {
        breakdown = calcOffset({
          quantity: it.quantity,
          copiesPerSheet: it.auto_specs.copiesPerSheet ?? 4,
          paperKey,
          colors: parseInt(it.colors) || 4,
          printingSides: (parseInt(it.printing_sides) || 2) as 1 | 2,
          finishingKeys: it.finishing_options,
          marginPct: it.margin_pct,
          discountPct: it.discount_pct,
          ...taxOpts,
        }, rules);
      } else if (it.category === "labels") {
        breakdown = calcLabels({
          quantity: it.quantity,
          labelWidthMm: it.auto_specs.labelW ?? 60,
          labelHeightMm: it.auto_specs.labelH ?? 40,
          materialKey: paperKey,
          method: (it.auto_specs.labelMethod as any) || "digital",
          colors: parseInt(it.colors) || 4,
          laminateKey: it.finishing_options[0],
          hasDieCut: true,
          form: (it.auto_specs.labelForm as any) || "roll",
          marginPct: it.margin_pct,
          discountPct: it.discount_pct,
          ...taxOpts,
        }, rules);
      } else if (["folding_cartons","paper_packaging","pharma","cosmetics","food"].includes(it.category)) {
        breakdown = calcPackaging({
          quantity: it.quantity,
          boxLengthCm: it.auto_specs.boxL ?? 15,
          boxWidthCm: it.auto_specs.boxW ?? 5,
          boxHeightCm: it.auto_specs.boxH ?? 20,
          boardKey: paperKey,
          colors: parseInt(it.colors) || 4,
          printingSides: (parseInt(it.printing_sides) || 1) as 1 | 2,
          finishingKeys: it.finishing_options,
          hasDieCut: true, hasGluing: true,
          marginPct: it.margin_pct,
          discountPct: it.discount_pct,
          ...taxOpts,
        }, rules);
      }
    } catch (e) {
      toast.error("تعذر الحساب التلقائي — أدخل السعر يدوياً");
      return;
    }
    if (!breakdown) return;
    const unitCost = breakdown.totalCost / Math.max(1, it.quantity);
    const unitPrice = breakdown.subtotal / Math.max(1, it.quantity);
    updateItem(id, {
      unit_cost: unitCost,
      unit_price: unitPrice,
      cost_breakdown: breakdown as any,
    });
    toast.success("تم الحساب التلقائي");
  };

  const validate = (): string | null => {
    if (!customerId) return "اختر العميل أولاً";
    if (items.length === 0) return "أضف بنداً واحداً على الأقل";
    for (const [i, it] of items.entries()) {
      if (!it.title.trim()) return `البند ${i + 1}: أدخل اسم المنتج`;
      if (!it.category) return `البند ${i + 1}: اختر الفئة`;
      if (it.quantity <= 0) return `البند ${i + 1}: الكمية غير صحيحة`;
      if (it.unit_price < 0) return `البند ${i + 1}: سعر الوحدة غير صحيح`;
    }
    if (totals.finalPrice <= 0) return "الإجمالي يجب أن يكون أكبر من صفر";
    return null;
  };

  const save = async (finalStatus: "draft" | "pending_approval") => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const { data: numRow, error: nerr } = await supabase.rpc("next_quotation_number");
      if (nerr) throw nerr;
      const quotationNumber = numRow as unknown as string;
      const status = approvalRequired && finalStatus !== "draft" ? "pending_approval" : finalStatus;
      const firstCat = items[0]?.category ?? "digital";

      const { data: q, error } = await supabase.from("quotations").insert({
        quotation_number: quotationNumber,
        customer_id: customerId,
        sales_rep_id: auth.userId,
        status,
        product_category: firstCat,
        quantity: totals.totalQty,
        subtotal: totals.subtotal,
        total_cost: totals.totalCost,
        discount: totals.discount,
        profit_margin_pct: Math.max(0, totals.avgMargin),
        final_price: totals.finalPrice,
        unit_price: totals.finalPrice / Math.max(1, totals.totalQty),
        tax_enabled: taxEnabled,
        tax_pct: taxPct,
        tax_amount: totals.taxAmount,
        payment_terms: paymentTerms,
        delivery_days: deliveryDays,
        validity_days: validityDays,
        customer_notes: customerNotes,
        internal_notes: internalNotes,
        approval_required: approvalRequired,
        specs: { itemsCount: items.length } as any,
      }).select("id").single();
      if (error) throw error;

      const itemRows = items.map((it, i) => ({
        quotation_id: q.id,
        item_number: i + 1,
        title: it.title,
        description: it.description,
        category: it.category,
        quantity: it.quantity,
        unit: it.unit,
        size: it.size,
        material: it.material,
        gsm: it.gsm,
        printing_method: it.printing_method,
        printing_sides: it.printing_sides,
        colors: it.colors,
        finishing_options: it.finishing_options,
        cost_breakdown: it.cost_breakdown as any,
        unit_price: it.unit_price,
        unit_cost: it.unit_cost,
        total_price: it.quantity * it.unit_price * (1 - it.discount_pct / 100),
        discount: (it.quantity * it.unit_price) * (it.discount_pct / 100),
        profit_margin_pct: it.margin_pct,
        customer_notes: it.customer_notes,
        internal_notes: it.internal_notes,
        sort_order: i,
        specs: { ...it.auto_specs, colors: it.colors, printing_sides: it.printing_sides } as any,
      }));

      const { error: ierr } = await supabase.from("quotation_items").insert(itemRows);
      if (ierr) throw ierr;

      await supabase.from("activity_log").insert({
        quotation_id: q.id, user_id: auth.userId, action: "created",
        details: { status, approvalRequired, itemsCount: items.length, finalPrice: totals.finalPrice },
      });

      toast.success(`تم إنشاء العرض ${quotationNumber}${approvalRequired ? " — بانتظار اعتماد المدير" : ""}`);
      navigate({ to: "/quotations/$id", params: { id: q.id } });
    } catch (e: any) {
      console.error("[save quotation]", e);
      toast.error("تعذر حفظ العرض", { description: e.message ?? "خطأ غير متوقع" });
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-7xl mx-auto pb-32">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="size-6 text-primary" /> إنشاء عرض سعر جديد</h1>
          <p className="text-sm text-muted-foreground mt-1">أضف بنداً واحداً أو أكثر — كل بند بمواصفاته وسعره المستقل</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save("draft")} disabled={saving}>حفظ كمسودة</Button>
          <Button onClick={() => save("pending_approval")} disabled={saving} className="gradient-brand text-white border-0">
            <Save className="size-4 ms-1" /> {saving ? "جاري الحفظ…" : "حفظ وإنشاء العرض"}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">بيانات العميل</CardTitle></CardHeader>
            <CardContent>
              <select className="w-full h-11 rounded-md border bg-transparent px-3 text-sm" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">-- اختر العميل --</option>
                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.company_name}{c.contact_person ? ` — ${c.contact_person}` : ""}</option>)}
              </select>
              <p className="text-xs text-muted-foreground mt-2">لم تجد العميل؟ أضفه من صفحة العملاء ثم عد لاختياره.</p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold flex items-center gap-2">
              <PackageOpen className="size-4 text-primary" /> بنود عرض السعر <Badge variant="outline">{items.length}</Badge>
            </div>
            <Button size="sm" onClick={addItem} className="gradient-brand text-white border-0">
              <Plus className="size-4 ms-1" /> إضافة بند جديد
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((it, i) => (
              <ItemCard
                key={it.id}
                item={it}
                index={i}
                papers={papers}
                finishingRules={finishingRules}
                showCosts={showCosts}
                onChange={(patch) => updateItem(it.id, patch)}
                onDuplicate={() => duplicateItem(it.id)}
                onRemove={() => removeItem(it.id)}
                onMoveUp={() => moveItem(it.id, -1)}
                onMoveDown={() => moveItem(it.id, 1)}
                onAutoCalc={() => autoCalcItem(it.id)}
                canRemove={items.length > 1}
                canMoveUp={i > 0}
                canMoveDown={i < items.length - 1}
              />
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">شروط وتفاصيل العرض</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-xs">شروط الدفع</Label><Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">مدة التسليم (يوم)</Label><Input type="number" value={deliveryDays} onChange={(e) => setDeliveryDays(parseInt(e.target.value || "0", 10))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">صلاحية العرض (يوم)</Label><Input type="number" value={validityDays} onChange={(e) => setValidityDays(parseInt(e.target.value || "0", 10))} /></div>
              <div className="space-y-1.5">
                <Label className="text-xs">الضريبة (VAT)</Label>
                <div className="flex items-center gap-3 h-10">
                  <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} />
                  <Input type="number" className="w-20" value={taxPct} onChange={(e) => setTaxPct(parseFloat(e.target.value || "0"))} disabled={!taxEnabled} />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="col-span-2 space-y-1.5"><Label className="text-xs">ملاحظات للعميل (تظهر في الـ PDF)</Label><Textarea value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} rows={2} /></div>
              {showCosts && (
                <div className="col-span-2 space-y-1.5"><Label className="text-xs">ملاحظات داخلية (لا تظهر للعميل)</Label><Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} /></div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            <Card className="shadow-elegant">
              <CardHeader className="pb-3 bg-gradient-to-br from-primary/5 to-transparent">
                <CardTitle className="text-base flex items-center gap-2"><Sparkles className="size-4 text-primary" /> ملخص العرض</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="عدد البنود" value={number(items.length)} />
                <Row label="إجمالي الكميات" value={number(totals.totalQty)} />
                <Row label="المجموع" value={currency(totals.subtotal)} />
                {totals.discount > 0 && <Row label="الخصم" value={`- ${currency(totals.discount)}`} className="text-destructive" />}
                {taxEnabled && <Row label={`الضريبة (${taxPct}%)`} value={currency(totals.taxAmount)} />}
                <div className="rounded-lg gradient-brand text-white p-3 mt-3">
                  <div className="text-xs opacity-90">السعر النهائي {taxEnabled ? "(شامل الضريبة)" : ""}</div>
                  <div className="text-2xl font-bold mt-1">{currency(totals.finalPrice)}</div>
                </div>
                {showCosts && (
                  <div className="border-t pt-2 mt-2 space-y-1">
                    <Row label="إجمالي التكلفة" value={currency(totals.totalCost)} muted />
                    <Row label="الربح المتوقع" value={currency(totals.profit)} muted />
                    <Row label="متوسط الهامش" value={`${totals.avgMargin.toFixed(1)}%`} muted />
                  </div>
                )}
                {approvalRequired && (
                  <div className="rounded-lg border border-warning bg-warning/10 text-warning-foreground p-2.5 text-xs flex items-start gap-2">
                    <ShieldAlert className="size-4 shrink-0 mt-0.5 text-warning" />
                    <div>هذا العرض يحتاج اعتماد مدير قبل الإرسال (هامش منخفض، خصم مرتفع، أو قيمة كبيرة).</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, className, muted }: { label: string; value: string; className?: string; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${className ?? ""} ${muted ? "text-xs text-muted-foreground" : ""}`}>
      <span>{label}</span><span className="font-semibold">{value}</span>
    </div>
  );
}

function ItemCard({
  item, index, papers, finishingRules, showCosts,
  onChange, onDuplicate, onRemove, onMoveUp, onMoveDown, onAutoCalc,
  canRemove, canMoveUp, canMoveDown,
}: {
  item: QuotationItem; index: number; papers: any[]; finishingRules: any[]; showCosts: boolean;
  onChange: (p: Partial<QuotationItem>) => void;
  onDuplicate: () => void; onRemove: () => void;
  onMoveUp: () => void; onMoveDown: () => void; onAutoCalc: () => void;
  canRemove: boolean; canMoveUp: boolean; canMoveDown: boolean;
}) {
  const [open, setOpen] = useState(true);
  const itemTotal = item.quantity * item.unit_price * (1 - item.discount_pct / 100);
  const isPackaging = ["folding_cartons","paper_packaging","pharma","cosmetics","food"].includes(item.category);
  const isLabels = item.category === "labels";

  const toggleFinishing = (key: string) => {
    const set = new Set(item.finishing_options);
    set.has(key) ? set.delete(key) : set.add(key);
    onChange({ finishing_options: Array.from(set) });
  };

  return (
    <Card className="shadow-card">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
          <Badge className="gradient-brand text-white border-0">#{index + 1}</Badge>
          <Input className="flex-1 border-0 bg-transparent focus-visible:ring-0 font-semibold text-base"
            value={item.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="اسم المنتج" />
          <div className="text-primary font-bold whitespace-nowrap">{currency(itemTotal)}</div>
          <Button size="sm" variant="ghost" onClick={onMoveUp} disabled={!canMoveUp} title="لأعلى">↑</Button>
          <Button size="sm" variant="ghost" onClick={onMoveDown} disabled={!canMoveDown} title="لأسفل">↓</Button>
          <Button size="sm" variant="ghost" onClick={onDuplicate} title="تكرار البند"><Copy className="size-4" /></Button>
          <Button size="sm" variant="ghost" onClick={onRemove} disabled={!canRemove} title="حذف البند" className="text-destructive"><Trash2 className="size-4" /></Button>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="ghost"><ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} /></Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <CardContent className="p-4 space-y-3">
            <SmartProductPicker onApply={(v: PickedProduct) => {
              const patch: any = {};
              if (v.name) patch.title = v.name;
              if (v.category) {
                const catKey = CATEGORIES.find((c) => c.label === v.category || c.key === v.category)?.key;
                if (catKey) patch.category = catKey;
              }
              if (v.description) patch.description = v.description;
              if (v.size) patch.size = v.size;
              if (v.material) patch.material = v.material;
              if (v.gsm) patch.gsm = v.gsm;
              if (v.printing_method) {
                const method = PRINTING_METHODS.find((m) => m === v.printing_method || m.includes(v.printing_method!)) ?? v.printing_method;
                patch.printing_method = method;
              }
              if (v.finishing_options?.length) {
                const existing = new Set(item.finishing_options);
                v.finishing_options.forEach((f) => existing.add(f));
                patch.finishing_options = Array.from(existing);
              }
              if (v.customer_notes) patch.customer_notes = v.customer_notes;
              if (v.internal_notes) patch.internal_notes = v.internal_notes;
              onChange(patch);
            }} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="فئة المنتج">
              <Select value={item.category} onValueChange={(v) => onChange({ category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="الكمية"><Input type="number" min={1} value={item.quantity} onChange={(e) => onChange({ quantity: Math.max(1, parseInt(e.target.value || "1", 10)) })} /></Field>
            <Field label="الوحدة"><Input value={item.unit} onChange={(e) => onChange({ unit: e.target.value })} /></Field>
            <Field label="المقاس"><Input value={item.size} onChange={(e) => onChange({ size: e.target.value })} placeholder="مثال: A4، 15×10 سم" /></Field>
            <Field label="الخامة / الورق">
              <Select value={item.material} onValueChange={(v) => onChange({ material: v, auto_specs: { ...item.auto_specs, paperKey: v } })}>
                <SelectTrigger><SelectValue placeholder="اختر الخامة" /></SelectTrigger>
                <SelectContent>
                  {papers.length === 0 && <SelectItem value="_none">— لا يوجد —</SelectItem>}
                  {papers.map((p: any) => <SelectItem key={p.key} value={p.key}>{p.label_ar}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="GSM"><Input value={item.gsm} onChange={(e) => onChange({ gsm: e.target.value })} placeholder="مثال: 300" /></Field>
            <Field label="طريقة الطباعة">
              <Select value={item.printing_method} onValueChange={(v) => onChange({ printing_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRINTING_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="الأوجه">
              <Select value={item.printing_sides} onValueChange={(v) => onChange({ printing_sides: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRINTING_SIDES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="الألوان"><Input value={item.colors} onChange={(e) => onChange({ colors: e.target.value })} placeholder="CMYK 4/4" /></Field>

            {(isPackaging || isLabels) && (
              <div className="md:col-span-3 grid grid-cols-3 gap-3 rounded-lg bg-muted/40 p-3">
                {isPackaging && (
                  <>
                    <Field label="الطول (سم)"><Input type="number" value={item.auto_specs.boxL ?? 15} onChange={(e) => onChange({ auto_specs: { ...item.auto_specs, boxL: +e.target.value } })} /></Field>
                    <Field label="العرض (سم)"><Input type="number" value={item.auto_specs.boxW ?? 5} onChange={(e) => onChange({ auto_specs: { ...item.auto_specs, boxW: +e.target.value } })} /></Field>
                    <Field label="الارتفاع (سم)"><Input type="number" value={item.auto_specs.boxH ?? 20} onChange={(e) => onChange({ auto_specs: { ...item.auto_specs, boxH: +e.target.value } })} /></Field>
                  </>
                )}
                {isLabels && (
                  <>
                    <Field label="عرض الملصق (مم)"><Input type="number" value={item.auto_specs.labelW ?? 60} onChange={(e) => onChange({ auto_specs: { ...item.auto_specs, labelW: +e.target.value } })} /></Field>
                    <Field label="ارتفاع الملصق (مم)"><Input type="number" value={item.auto_specs.labelH ?? 40} onChange={(e) => onChange({ auto_specs: { ...item.auto_specs, labelH: +e.target.value } })} /></Field>
                    <Field label="الشكل">
                      <Select value={item.auto_specs.labelForm ?? "roll"} onValueChange={(v) => onChange({ auto_specs: { ...item.auto_specs, labelForm: v } })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="roll">رول</SelectItem><SelectItem value="sheet">أفرخ</SelectItem></SelectContent>
                      </Select>
                    </Field>
                  </>
                )}
              </div>
            )}

            <div className="md:col-span-3 space-y-2">
              <Label className="text-xs">التشطيبات</Label>
              <div className="flex flex-wrap gap-2">
                {finishingRules.length === 0 && <span className="text-xs text-muted-foreground">لا توجد تشطيبات مضبوطة — أضفها من صفحة التشطيبات</span>}
                {finishingRules.map((f: any) => {
                  const active = item.finishing_options.includes(f.key);
                  return (
                    <button key={f.key} type="button" onClick={() => toggleFinishing(f.key)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:border-primary"}`}>
                      {f.label_ar}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-3 grid grid-cols-4 gap-3 rounded-lg bg-gradient-to-br from-primary/5 to-transparent p-3">
              <Field label="سعر الوحدة">
                <Input type="number" step="0.01" min={0} value={item.unit_price} onChange={(e) => onChange({ unit_price: parseFloat(e.target.value || "0") })} />
              </Field>
              {showCosts && (
                <Field label="تكلفة الوحدة">
                  <Input type="number" step="0.01" min={0} value={item.unit_cost} onChange={(e) => onChange({ unit_cost: parseFloat(e.target.value || "0") })} />
                </Field>
              )}
              <Field label="الخصم %"><Input type="number" min={0} max={100} value={item.discount_pct} onChange={(e) => onChange({ discount_pct: parseFloat(e.target.value || "0") })} /></Field>
              {showCosts && (
                <Field label="هامش %"><Input type="number" min={0} value={item.margin_pct} onChange={(e) => onChange({ margin_pct: parseFloat(e.target.value || "0") })} /></Field>
              )}
              <div className="col-span-4 flex items-center justify-between border-t pt-2">
                <Button type="button" size="sm" variant="outline" onClick={onAutoCalc}>
                  <Sparkles className="size-3 ms-1" /> حساب تلقائي (تجريبي)
                </Button>
                <div className="text-sm">
                  <span className="text-muted-foreground">إجمالي البند:</span>{" "}
                  <span className="text-lg font-bold text-primary">{currency(itemTotal)}</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-3 space-y-1.5"><Label className="text-xs">وصف البند (يظهر في الـ PDF)</Label><Textarea rows={2} value={item.description} onChange={(e) => onChange({ description: e.target.value })} /></div>
            <div className="md:col-span-3 space-y-1.5"><Label className="text-xs">ملاحظات للعميل</Label><Textarea rows={2} value={item.customer_notes} onChange={(e) => onChange({ customer_notes: e.target.value })} /></div>
            {showCosts && (
              <div className="md:col-span-3 space-y-1.5"><Label className="text-xs">ملاحظات داخلية</Label><Textarea rows={2} value={item.internal_notes} onChange={(e) => onChange({ internal_notes: e.target.value })} /></div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
