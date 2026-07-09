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
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Save, Sparkles, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { canSeeCosts } from "@/lib/roles";
import { calcDigital, calcOffset, calcPackaging, calcLabels, calcFinishingOnly, ruleMap, type PricingBreakdown } from "@/lib/pricing";
import { currency, number, percent } from "@/lib/format";

const searchSchema = z.object({ customer: z.string().optional() });

export const Route = createFileRoute("/_authenticated/quotations/new")({
  head: () => ({ meta: [{ title: "عرض سعر جديد — Elsewedy Smart Quotation" }] }),
  validateSearch: searchSchema,
  component: WizardPage,
});

const CATEGORIES = [
  { key: "digital", label: "طباعة ديجيتال", hint: "HP Indigo 12K • 50×70" },
  { key: "offset", label: "طباعة أوفست", hint: "أوفست 50×70 • ألوان متعددة" },
  { key: "folding_cartons", label: "علب مطوية", hint: "Folding Cartons" },
  { key: "paper_packaging", label: "تغليف ورقي", hint: "Paper Packaging" },
  { key: "labels", label: "ملصقات و ستيكرز", hint: "Rolls / Sheets" },
  { key: "pharma", label: "علب أدوية", hint: "Pharma Cartons" },
  { key: "cosmetics", label: "مستحضرات تجميل", hint: "Cosmetics Packaging" },
  { key: "food", label: "تغليف مواد غذائية", hint: "Food Grade" },
  { key: "marketing", label: "مطبوعات تسويقية", hint: "Brochures, Flyers" },
  { key: "finishing_only", label: "خدمة تشطيبات فقط", hint: "Finishing service" },
  { key: "custom", label: "منتج مخصص", hint: "Custom" },
];

const STEPS = [
  "بيانات العميل",
  "فئة المنتج",
  "المواصفات",
  "طريقة الطباعة",
  "الورق والخامة",
  "التشطيبات",
  "الكمية والتسليم",
  "حساب التكلفة",
  "المراجعة والاعتماد",
  "إنشاء العرض",
];

function WizardPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const auth = useAuth();
  const showCosts = canSeeCosts(auth.roles);

  const [step, setStep] = useState(0);
  const [customerId, setCustomerId] = useState(search.customer ?? "");
  const [category, setCategory] = useState<string>("digital");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Specs
  const [sheetSize, setSheetSize] = useState<"50x70" | "33x48" | "custom">("50x70");
  const [copiesPerSheet, setCopiesPerSheet] = useState(4);
  const [quantity, setQuantity] = useState(1000);
  const [printingSides, setPrintingSides] = useState<1 | 2>(2);
  const [colors, setColors] = useState<number>(4);
  const [specialInks, setSpecialInks] = useState(0);

  // Packaging specs (cm)
  const [boxL, setBoxL] = useState(15);
  const [boxW, setBoxW] = useState(5);
  const [boxH, setBoxH] = useState(20);
  const [hasDieCut, setHasDieCut] = useState(true);
  const [hasGluing, setHasGluing] = useState(true);

  // Label specs (mm)
  const [labelW, setLabelW] = useState(60);
  const [labelH, setLabelH] = useState(40);
  const [labelMethod, setLabelMethod] = useState<"digital" | "flexo">("digital");
  const [labelForm, setLabelForm] = useState<"roll" | "sheet">("roll");
  const [laminateKey, setLaminateKey] = useState<string>("");

  // Finishing-only service
  const [finishingSheetsCount, setFinishingSheetsCount] = useState(1000);

  // Material
  const [paperKey, setPaperKey] = useState("coated_300gsm");

  // Finishing
  const [finishingKeys, setFinishingKeys] = useState<string[]>([]);

  // Delivery & pricing
  const [deliveryDays, setDeliveryDays] = useState(7);
  const [validityDays, setValidityDays] = useState(30);
  const [paymentTerms, setPaymentTerms] = useState("50٪ مقدم — 50٪ عند التسليم");
  const [marginPct, setMarginPct] = useState(25);
  const [discountPct, setDiscountPct] = useState(0);
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [saving, setSaving] = useState(false);

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
  const finishingOptions = useMemo(() => rulesRaw.filter((r: any) => r.category === "finishing"), [rulesRaw]);
  const minMargin = rules["margin.minimum_pct"] ?? 12;
  const maxDiscount = rules["discount.max_pct"] ?? 10;

  const isPackaging = ["folding_cartons", "paper_packaging", "pharma", "cosmetics", "food"].includes(category);
  const isLabels = category === "labels";
  const isFinishingOnly = category === "finishing_only";
  const isOffset = category === "offset";
  const isDigital = category === "digital" || category === "marketing" || category === "custom";

  useEffect(() => {
    setMarginPct(rules["margin.default_pct"] ?? 25);
  }, [rules]);

  const breakdown: PricingBreakdown = useMemo(() => {
    if (isPackaging) {
      return calcPackaging({
        quantity, boxLengthCm: boxL, boxWidthCm: boxW, boxHeightCm: boxH,
        boardKey: paperKey, colors, printingSides, finishingKeys,
        hasDieCut, hasGluing, marginPct, discountPct,
      }, rules);
    }
    if (isLabels) {
      return calcLabels({
        quantity, labelWidthMm: labelW, labelHeightMm: labelH,
        materialKey: paperKey, method: labelMethod, colors,
        laminateKey: laminateKey || undefined, hasDieCut, form: labelForm,
        marginPct, discountPct,
      }, rules);
    }
    if (isFinishingOnly) {
      return calcFinishingOnly({ sheetsCount: finishingSheetsCount, finishingKeys, marginPct, discountPct }, rules);
    }
    if (isOffset) {
      return calcOffset({ quantity, copiesPerSheet, paperKey, colors, printingSides, finishingKeys, marginPct, discountPct }, rules);
    }
    return calcDigital({
      sheetSize, copiesPerSheet, quantity, paperKey, printingSides, colors: (colors as 1 | 4),
      specialInks, finishingKeys, marginPct, discountPct,
    }, rules);
  }, [isPackaging, isLabels, isFinishingOnly, isOffset, isDigital, quantity, copiesPerSheet, paperKey, colors, printingSides, sheetSize, specialInks, finishingKeys, marginPct, discountPct, rules, boxL, boxW, boxH, hasDieCut, hasGluing, labelW, labelH, labelMethod, labelForm, laminateKey, finishingSheetsCount]);


  const approvalRequired = marginPct < minMargin || discountPct > maxDiscount;

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const save = async (finalStatus: "draft" | "pending_approval" | "approved") => {
    if (!customerId) return toast.error("اختر العميل أولاً");
    if (!title) return toast.error("أدخل عنوان المنتج");
    setSaving(true);
    try {
      const { data: numRow, error: nerr } = await supabase.rpc("next_quotation_number");
      if (nerr) throw nerr;
      const quotationNumber = numRow as unknown as string;

      const status = approvalRequired && finalStatus !== "draft" ? "pending_approval" : finalStatus;

      const { data: q, error } = await supabase.from("quotations").insert({
        quotation_number: quotationNumber,
        customer_id: customerId,
        sales_rep_id: auth.userId,
        status,
        product_category: category,
        quantity,
        subtotal: breakdown.subtotal,
        total_cost: breakdown.totalCost,
        discount: breakdown.discount,
        profit_margin_pct: marginPct,
        final_price: breakdown.finalPrice,
        payment_terms: paymentTerms,
        delivery_days: deliveryDays,
        validity_days: validityDays,
        customer_notes: customerNotes,
        internal_notes: internalNotes,
        approval_required: approvalRequired,
        specs: {
          sheetSize, copiesPerSheet, printingSides, colors, specialInks,
          paperKey, finishingKeys, breakdown: { ...breakdown }, title, description,
        } as any,
      }).select("id").single();
      if (error) throw error;

      await supabase.from("quotation_items").insert({
        quotation_id: q.id,
        title,
        description,
        specs: { sheetSize, copiesPerSheet, printingSides, colors, specialInks, paperKey, finishingKeys },
        quantity,
        unit_price: breakdown.finalPrice / Math.max(1, quantity),
        unit_cost: breakdown.totalCost / Math.max(1, quantity),
        total_price: breakdown.finalPrice,
      });

      await supabase.from("activity_log").insert({
        quotation_id: q.id, user_id: auth.userId, action: "created",
        details: { status, approvalRequired },
      });

      toast.success(`تم إنشاء العرض ${quotationNumber}${approvalRequired ? " — بانتظار اعتماد المدير" : ""}`);
      navigate({ to: "/quotations/$id", params: { id: q.id } });
    } catch (e: any) {
      toast.error(e.message ?? "خطأ في حفظ العرض");
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">إنشاء عرض سعر جديد</h1>
        <p className="text-sm text-muted-foreground">اتبع الخطوات لإعداد عرض سعر احترافي بدقة</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-sm font-semibold">الخطوة {step + 1} من {STEPS.length}</div>
            <Badge variant="secondary">{STEPS[step]}</Badge>
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} />
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{STEPS[step]}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {step === 0 && (
              <div className="space-y-3">
                <Label>اختر العميل</Label>
                <select className="w-full h-10 rounded-md border bg-transparent px-3" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">-- اختر --</option>
                  {customers.map((c: any) => <option key={c.id} value={c.id}>{c.company_name} {c.contact_person ? `— ${c.contact_person}` : ""}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">لم تجد العميل؟ أضفه أولاً من صفحة "العملاء" ثم عد.</p>
              </div>
            )}
            {step === 1 && (
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map((c) => (
                  <button key={c.key} onClick={() => setCategory(c.key)}
                    className={`text-right rounded-xl border p-4 transition hover:border-primary ${category === c.key ? "border-primary bg-primary/5 shadow-elegant" : ""}`}>
                    <div className="font-semibold">{c.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{c.hint}</div>
                  </button>
                ))}
              </div>
            )}
            {step === 2 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1"><Label>عنوان المنتج *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: كتالوج شركة — 24 صفحة" /></div>
                <div className="col-span-2 space-y-1"><Label>وصف مختصر</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
                <div className="space-y-1"><Label>مقاس الفرخ</Label>
                  <select className="w-full h-10 rounded-md border bg-transparent px-3" value={sheetSize} onChange={(e) => setSheetSize(e.target.value as any)}>
                    <option value="50x70">50×70 (HP Indigo 12K)</option>
                    <option value="33x48">33×48</option>
                    <option value="custom">مخصص</option>
                  </select>
                </div>
                <div className="space-y-1"><Label>عدد النسخ في الفرخ</Label><Input type="number" min={1} value={copiesPerSheet} onChange={(e) => setCopiesPerSheet(Math.max(1, +e.target.value))} /></div>
              </div>
            )}
            {step === 3 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>أوجه الطباعة</Label>
                  <select className="w-full h-10 rounded-md border bg-transparent px-3" value={printingSides} onChange={(e) => setPrintingSides(+e.target.value as 1 | 2)}>
                    <option value={1}>وجه واحد</option>
                    <option value={2}>وجهين</option>
                  </select>
                </div>
                <div className="space-y-1"><Label>عدد الألوان</Label>
                  <select className="w-full h-10 rounded-md border bg-transparent px-3" value={colors} onChange={(e) => setColors(+e.target.value)}>
                    <option value={1}>لون واحد</option>
                    <option value={4}>4 ألوان CMYK</option>
                    {category === "offset" && <><option value={5}>5 ألوان</option><option value={6}>6 ألوان</option></>}
                  </select>
                </div>
                <div className="space-y-1"><Label>ألوان خاصة (Pantone)</Label><Input type="number" min={0} value={specialInks} onChange={(e) => setSpecialInks(Math.max(0, +e.target.value))} /></div>
                <div className="col-span-2 text-xs text-muted-foreground rounded-lg bg-accent p-3">
                  {category === "digital"
                    ? "الطباعة الديجيتال مناسبة للكميات الصغيرة والمتوسطة. HP Indigo 12K يدعم مقاس 50×70 بجودة أوفست."
                    : "الطباعة الأوفست مثالية للكميات الكبيرة مع تكلفة أقل لكل نسخة."}
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="grid grid-cols-2 gap-3">
                {papers.map((p: any) => (
                  <button key={p.key} onClick={() => setPaperKey(p.key)}
                    className={`text-right rounded-lg border p-3 hover:border-primary ${paperKey === p.key ? "border-primary bg-primary/5" : ""}`}>
                    <div className="font-medium">{p.label_ar}</div>
                    <div className="text-xs text-muted-foreground mt-1">{currency(p.value)} / {p.unit}</div>
                  </button>
                ))}
              </div>
            )}
            {step === 5 && (
              <div className="grid grid-cols-2 gap-2">
                {finishingOptions.map((f: any) => {
                  const checked = finishingKeys.includes(f.key);
                  return (
                    <label key={f.key} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${checked ? "border-primary bg-primary/5" : ""}`}>
                      <Checkbox checked={checked} onCheckedChange={(v) => setFinishingKeys(v ? [...finishingKeys, f.key] : finishingKeys.filter((k) => k !== f.key))} />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{f.label_ar}</div>
                        <div className="text-[11px] text-muted-foreground">{currency(f.value)} / {f.unit}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            {step === 6 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>الكمية</Label><Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, +e.target.value))} /></div>
                <div className="space-y-1"><Label>مدة التسليم (أيام)</Label><Input type="number" min={1} value={deliveryDays} onChange={(e) => setDeliveryDays(+e.target.value)} /></div>
                <div className="space-y-1"><Label>صلاحية العرض (أيام)</Label><Input type="number" min={1} value={validityDays} onChange={(e) => setValidityDays(+e.target.value)} /></div>
                <div className="space-y-1"><Label>شروط الدفع</Label><Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} /></div>
              </div>
            )}
            {step === 7 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>هامش الربح ٪</Label><Input type="number" min={0} value={marginPct} onChange={(e) => setMarginPct(+e.target.value)} /></div>
                <div className="space-y-1"><Label>خصم ٪</Label><Input type="number" min={0} value={discountPct} onChange={(e) => setDiscountPct(+e.target.value)} /></div>
                {approvalRequired && (
                  <div className="col-span-2 rounded-lg border border-warning bg-warning/10 p-3 flex items-start gap-2 text-sm">
                    <ShieldAlert className="size-5 text-warning-foreground shrink-0" />
                    <div>
                      <div className="font-semibold">يتطلب اعتماد المدير</div>
                      <div className="text-xs mt-1">
                        {marginPct < minMargin && <>هامش الربح أقل من الحد الأدنى ({percent(minMargin)}). </>}
                        {discountPct > maxDiscount && <>الخصم يتجاوز الحد المسموح ({percent(maxDiscount)}).</>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {step === 8 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>ملاحظات للعميل</Label><Textarea rows={3} value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} /></div>
                  <div className="space-y-1"><Label>ملاحظات داخلية</Label><Textarea rows={3} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} /></div>
                </div>
                <div className="rounded-lg bg-accent/50 p-4 text-sm">
                  راجع كل البيانات ثم اضغط <b>حفظ وإنشاء العرض</b>. سيتم توليد رقم تلقائي وسجل نشاط للعرض.
                </div>
              </div>
            )}
            {step === 9 && (
              <div className="text-center py-8 space-y-3">
                <Sparkles className="size-10 mx-auto text-gold" />
                <div className="text-lg font-semibold">جاهز لإنشاء العرض</div>
                <div className="text-sm text-muted-foreground">اضغط الزر بالأسفل لحفظ العرض والانتقال إلى صفحة التصدير و PDF.</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">ملخص التكلفة</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="عدد الأفرخ" value={number(breakdown.sheetsNeeded)} />
            <Row label="نسبة الهالك" value={percent(breakdown.wastePct)} />
            {showCosts && <>
              <div className="border-t my-2" />
              <Row label="تكلفة الورق" value={currency(breakdown.paperCost)} />
              <Row label="تكلفة الطباعة" value={currency(breakdown.printingCost)} />
              <Row label="تكلفة التشطيبات" value={currency(breakdown.finishingCost)} />
              <Row label="ألوان خاصة" value={currency(breakdown.specialInkCost)} />
              <Row label="تكلفة الضبط" value={currency(breakdown.setupCost)} />
              <div className="border-t my-2" />
              <Row label="إجمالي التكلفة" value={currency(breakdown.totalCost)} bold />
              <Row label={`الربح (${percent(marginPct)})`} value={currency(breakdown.profit)} />
              <Row label="المجموع قبل الخصم" value={currency(breakdown.subtotal)} />
              <Row label={`الخصم (${percent(discountPct)})`} value={`- ${currency(breakdown.discount)}`} />
              <div className="border-t my-2" />
            </>}
            <div className="rounded-lg gradient-primary text-primary-foreground p-3 mt-2">
              <div className="text-xs opacity-80">السعر النهائي</div>
              <div className="text-2xl font-bold">{currency(breakdown.finalPrice)}</div>
              <div className="text-[11px] opacity-80 mt-1">سعر الوحدة: {currency(breakdown.finalPrice / Math.max(1, quantity))}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={prev} disabled={step === 0}><ChevronRight className="size-4 ms-1" /> السابق</Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>التالي <ChevronLeft className="size-4 me-1" /></Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => save("draft")} disabled={saving}><Save className="size-4 ms-1" /> حفظ كمسودة</Button>
            <Button className="gradient-primary" onClick={() => save("approved")} disabled={saving}>
              <Sparkles className="size-4 ms-1" /> {approvalRequired ? "إرسال للاعتماد" : "حفظ وإنشاء العرض"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
